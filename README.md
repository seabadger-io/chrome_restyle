# Restyle – per-site custom CSS & JS for Chrome

Inject your own CSS and JavaScript into websites, configured per URL pattern. Everything is stored locally (`chrome.storage.local`).

I've created this extension as I prefer not to give such powers to 3rd party/marketplace Chrome extensions, hence local installs only.

Example – fake light mode for a dark-only site, pattern `hackthebox.com`:

```css
html { filter: invert(100%) hue-rotate(180deg); }
```

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. Pin the extension (puzzle icon → pin)

### Enabling custom JavaScript (optional)

Chrome only lets extensions run user-supplied JS through the `userScripts` API, which you must opt into:

- **Chrome 138+**: `chrome://extensions` → Restyle → **Details** → enable **Allow User Scripts**
- **Chrome 120–137**: having **Developer mode** on is enough

CSS works without this.

## Usage

- **Popup**: shows the rules active on the current tab, lets you toggle them, create a rule for the site, or reload the tab.
- **Rules page** (gear / "Rules" button): full editor. Changes autosave; CSS updates open tabs live, JS applies on the next page load.
- **Import / Export** rules as JSON for backup or moving between machines.

### URL patterns (one per line)

| Pattern | Matches |
| --- | --- |
| `hackthebox.com` | that domain + all subdomains, any scheme/path |
| `*://*.example.com/*` | wildcard; `*.` also matches the bare domain |
| `https://example.com/docs/*` | specific path only |
| `/^https?:\/\/(a\|b)\.com/i` | regular expression |
| `# note` | comment |

### JS options

- **Run at**: `document_start` / `document_end` / `document_idle`
- **World**: *Page* (can access the site's own JS variables) or *Isolated*
- **Iframes**: off by default for both CSS and JS

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `lib/match.js` | pattern matching + storage helpers (shared) |
| `content.js` | injects CSS at `document_start`, live updates, SPA navigation |
| `background.js` | syncs JS rules into `chrome.userScripts`, badge, default rule |
| `popup/` | toolbar popup |
| `options/` | rules editor |
