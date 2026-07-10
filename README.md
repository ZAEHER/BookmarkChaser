# Bookmark Chaser

A Chrome/Brave (Manifest V3) extension that chases websites which periodically change their domain extension (e.g. `example.com` → `example.rodeo` → `example.city`). When you visit a tracked site on its new domain, the extension automatically deletes the old bookmark and creates a fresh one — same folder, same title, new URL.

**Author:** Vikas Tewatia
**Instagram:** [@VikasTewatia01](https://instagram.com/VikasTewatia01)
**Github:** [@ZAEHER](https://github.com/ZAEHER/BookmarkChaser)
---

## Features

- **Automatic bookmark swapping** — visit a tracked site on a new domain extension and the old bookmark is replaced in place (same folder, same title).
- **Track from existing bookmarks** — pick any bookmark from a searchable list; no manual URL entry needed.
- **History log** — every domain chase is recorded with a timestamp (`old-domain → new-domain`), up to the last 100 swaps.
- **Stacked TLD aware** — correctly handles two-part suffixes like `.com.au` and `.co.uk`, so `site.com.au` matches as `site`, not `site.com`.
- **Self-healing** — if a tracked bookmark was deleted manually, the next chase recreates it in Other Bookmarks instead of failing.
- **Badge notification** — the toolbar icon briefly shows a ↺ badge whenever a swap happens.

## Installation

**From the Chrome Web Store (recommended):** [Get Bookmark Chaser on the Chrome Web Store](https://chromewebstore.google.com/detail/njkedjbdaahfeceabaeocjgbggikiapn) and click **Add to Chrome/Brave**.

## Usage

1. Bookmark the site you want to track (if you haven't already).
2. Click the Bookmark Chaser icon in the toolbar.
3. Go to the **Add from bookmarks** tab, find the site, and click **Track**.
4. That's it. Next time the site moves to a new extension and you visit it, the bookmark updates itself. Check the **History** tab to see past chases.

To stop tracking a site, open the **Tracked sites** tab and click **Untrack**.

## How the matching works

The extension listens for completed page loads (`chrome.tabs.onUpdated`). For each visited page it strips `www.` and splits the hostname into a base name and its extension. If the base name matches a tracked site but the full hostname differs, it treats that as a domain move and swaps the bookmark.

- `example.com` → `example.city` ✅ chased
- `shop.example.com` → `shop.example.city` ✅ chased (subdomains are part of the base)
- `example.com` → `examplenew.com` ❌ not chased (different base name)

## Permissions

| Permission | Why it's needed |
|---|---|
| `bookmarks` | Read your bookmarks list, delete the old bookmark, create the new one |
| `storage` | Save the tracked-sites list and chase history locally |
| `tabs` | See the URL of pages you visit to detect domain changes |

No data ever leaves your browser. There are no external requests, no analytics, and no remote servers.

## Feedback

For issues or feedback, reach out on Instagram: [@VikasTewatia01](https://instagram.com/VikasTewatia01). 
If you found this extension helpful, a 5-star rating on the Chrome Web Store is much appreciated!

## Files

```
bookmark-chaser/
├── manifest.json    # MV3 manifest
├── background.js    # Service worker: detection + bookmark swapping
├── popup.html       # Popup UI (Tracked / Add / History tabs)
├── popup.js         # Popup logic
└── icons/           # 16 / 48 / 128 px icons
```

## License

MIT © Vikas Tewatia
