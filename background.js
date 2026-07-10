// ============================================================================
//  Bookmark Chaser — background service worker
//  Watches visited tabs. When a tracked site shows up on a new domain
//  extension, the old bookmark is deleted and a fresh one is created in the
//  same folder with the same title.
// ============================================================================

const STORAGE_KEY = "chaser";
const HISTORY_LIMIT = 100;

// Two-part public suffixes we care about, so "site.com.au" -> base "site",
// not "site.com". Extend if you track sites on other stacked TLDs.
const TWO_PART_TLDS = new Set([
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au",
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk",
  "co.nz", "net.nz", "org.nz",
  "co.in", "net.in", "org.in", "firm.in",
  "com.sg", "com.my", "com.br", "com.mx", "co.jp", "co.kr", "com.cn"
]);

// ---- helpers ---------------------------------------------------------------

async function getState() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || { tracked: [], history: [] };
}

async function setState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

// "www.example.rodeo" -> { base: "example", suffix: "rodeo" }
// "shop.example.com.au" -> { base: "shop.example", suffix: "com.au" }
function splitHostname(hostname) {
  let h = hostname.toLowerCase();
  if (h.startsWith("www.")) h = h.slice(4);
  const parts = h.split(".");
  if (parts.length < 2) return null;

  const lastTwo = parts.slice(-2).join(".");
  if (parts.length >= 3 && TWO_PART_TLDS.has(lastTwo)) {
    return { base: parts.slice(0, -2).join("."), suffix: lastTwo };
  }
  return { base: parts.slice(0, -1).join("."), suffix: parts[parts.length - 1] };
}

function hostnameOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname;
  } catch {
    return null;
  }
}

async function pushHistory(state, entry) {
  state.history.unshift({ time: Date.now(), ...entry });
  if (state.history.length > HISTORY_LIMIT) {
    state.history.length = HISTORY_LIMIT;
  }
}

async function flashBadge(text) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#E8A33D" });
    await chrome.action.setBadgeText({ text });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
  } catch {
    /* badge is cosmetic; never let it break the swap */
  }
}

// ---- core: swap the bookmark ------------------------------------------------

async function swapBookmark(state, site, newUrl, newHostname) {
  let title = site.title;
  let parentId = null;

  // Find the existing bookmark so we can keep its folder + title.
  try {
    const [node] = await chrome.bookmarks.get(site.bookmarkId);
    if (node) {
      title = node.title || title;
      parentId = node.parentId;
      await chrome.bookmarks.remove(site.bookmarkId);
    }
  } catch {
    // Bookmark was deleted manually — recreate it in Other Bookmarks.
    parentId = null;
  }

  const created = await chrome.bookmarks.create({
    parentId: parentId || undefined,
    title,
    url: newUrl
  });

  const oldHostname = site.hostname;
  site.bookmarkId = created.id;
  site.url = newUrl;
  site.hostname = newHostname;
  site.title = title;

  await pushHistory(state, {
    label: site.base,
    from: oldHostname,
    to: newHostname
  });

  await flashBadge("↺");
}

// ---- event: watch every completed navigation --------------------------------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  const hostname = hostnameOf(tab.url);
  if (!hostname) return;

  const visited = splitHostname(hostname);
  if (!visited) return;

  const state = await getState();
  let changed = false;

  for (const site of state.tracked) {
    if (site.base === visited.base && site.hostname !== hostname) {
      // Same site, new domain — chase it.
      const cleanUrl = new URL(tab.url);
      const newUrl = `${cleanUrl.protocol}//${hostname}/`;
      try {
        await swapBookmark(state, site, newUrl, hostname);
        changed = true;
      } catch (e) {
        console.error("Bookmark Chaser: swap failed", e);
      }
    }
  }

  if (changed) await setState(state);
});

// ---- messages from the popup -------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const state = await getState();

    if (msg.type === "getState") {
      sendResponse({ ok: true, state });
      return;
    }

    if (msg.type === "track") {
      // msg.bookmark = { id, title, url }
      const hostname = hostnameOf(msg.bookmark.url);
      const parsed = hostname ? splitHostname(hostname) : null;
      if (!parsed) {
        sendResponse({ ok: false, error: "That bookmark isn't a normal web address." });
        return;
      }
      if (state.tracked.some(s => s.bookmarkId === msg.bookmark.id)) {
        sendResponse({ ok: false, error: "Already tracked." });
        return;
      }
      state.tracked.push({
        base: parsed.base,
        hostname,
        url: msg.bookmark.url,
        bookmarkId: msg.bookmark.id,
        title: msg.bookmark.title,
        addedAt: Date.now()
      });
      await setState(state);
      sendResponse({ ok: true, state });
      return;
    }

    if (msg.type === "untrack") {
      state.tracked = state.tracked.filter(s => s.bookmarkId !== msg.bookmarkId);
      await setState(state);
      sendResponse({ ok: true, state });
      return;
    }

    if (msg.type === "clearHistory") {
      state.history = [];
      await setState(state);
      sendResponse({ ok: true, state });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message." });
  })();

  return true; // keep the message channel open for the async response
});
