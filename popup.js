// ============================================================================
//  Bookmark Chaser — popup
// ============================================================================

let state = { tracked: [], history: [] };
let allBookmarks = [];

const $ = (sel) => document.querySelector(sel);

// ---- tab switching -----------------------------------------------------------

document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll("section").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    $("#tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ---- messaging ----------------------------------------------------------------

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

// ---- rendering ------------------------------------------------------------------

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function highlightSuffix(hostname) {
  // Render "example.rodeo" with the extension emphasised: example.<b>rodeo</b>
  const wrap = el("div", "host");
  const i = hostname.lastIndexOf(".");
  if (i === -1) {
    wrap.textContent = hostname;
    return wrap;
  }
  wrap.append(hostname.slice(0, i + 1));
  const b = el("b", null, hostname.slice(i + 1));
  wrap.append(b);
  return wrap;
}

function renderTracked() {
  const list = $("#tracked-list");
  list.textContent = "";

  if (!state.tracked.length) {
    list.append(el("div", "empty", "Nothing tracked yet. Add a site from the next tab."));
    return;
  }

  for (const site of state.tracked) {
    const card = el("div", "card");
    const info = el("div", "info");
    info.append(el("div", "title", site.title || site.base));
    info.append(highlightSuffix(site.hostname));
    const btn = el("button", "btn remove", "Untrack");
    btn.addEventListener("click", async () => {
      const res = await send({ type: "untrack", bookmarkId: site.bookmarkId });
      if (res && res.ok) { state = res.state; renderAll(); }
    });
    card.append(info, btn);
    list.append(card);
  }
}

function renderBookmarks() {
  const list = $("#bookmark-list");
  const query = $("#search").value.trim().toLowerCase();
  list.textContent = "";

  const trackedIds = new Set(state.tracked.map((s) => s.bookmarkId));
  const candidates = allBookmarks.filter((b) => {
    if (trackedIds.has(b.id)) return false;
    if (!query) return true;
    return (b.title || "").toLowerCase().includes(query) || b.url.toLowerCase().includes(query);
  });

  if (!candidates.length) {
    list.append(el("div", "empty", query ? "No bookmarks match that search." : "No bookmarks available to track."));
    return;
  }

  for (const bm of candidates.slice(0, 60)) {
    const card = el("div", "card");
    const info = el("div", "info");
    info.append(el("div", "title", bm.title || "(untitled)"));
    let hostname = "";
    try { hostname = new URL(bm.url).hostname; } catch { /* skip */ }
    info.append(highlightSuffix(hostname));
    const btn = el("button", "btn track", "Track");
    btn.addEventListener("click", async () => {
      const res = await send({ type: "track", bookmark: { id: bm.id, title: bm.title, url: bm.url } });
      if (res && res.ok) { state = res.state; renderAll(); }
      else if (res) btn.textContent = "✕ " + res.error;
    });
    card.append(info, btn);
    list.append(card);
  }
}

function renderHistory() {
  const list = $("#history-list");
  list.textContent = "";

  if (!state.history.length) {
    list.append(el("div", "empty", "No chases yet. When a bookmark gets updated, it shows up here."));
    return;
  }

  for (const h of state.history) {
    const item = el("div", "hist");
    item.append(el("div", "when", new Date(h.time).toLocaleString()));
    const move = el("div", "move");
    move.append(h.from + " ");
    move.append(el("span", "arrow", "→"));
    move.append(" " + h.to);
    item.append(move);
    list.append(item);
  }
}

function renderAll() {
  renderTracked();
  renderBookmarks();
  renderHistory();
}

// ---- data loading ------------------------------------------------------------------

function flattenBookmarks(nodes, out) {
  for (const node of nodes) {
    if (node.url && /^https?:/i.test(node.url)) {
      out.push({ id: node.id, title: node.title, url: node.url });
    }
    if (node.children) flattenBookmarks(node.children, out);
  }
}

async function init() {
  const res = await send({ type: "getState" });
  if (res && res.ok) state = res.state;

  const tree = await chrome.bookmarks.getTree();
  allBookmarks = [];
  flattenBookmarks(tree, allBookmarks);

  renderAll();
}

$("#search").addEventListener("input", renderBookmarks);
$("#clear-history").addEventListener("click", async () => {
  const res = await send({ type: "clearHistory" });
  if (res && res.ok) { state = res.state; renderHistory(); }
});

init();
