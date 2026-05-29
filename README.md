# AEM Environment Switcher

A Chrome (and Firefox) extension for AEM developers and authors to quickly switch between Author, Preview, and Publish modes across multiple environments — with full i18n / Language Master support.

## Features

- **One-click environment switching** — jump between localhost, dev, qa, stage, and production while preserving your current content path
- **Redesigned popup** — compact title bar with environment selector + settings, plus large card-style buttons for Editor / Preview / Published
- **Published dropdown** — on Language Master pages, the Published card opens a dropdown listing all configured Live Copies
- **Side panel settings** — full configuration UI accessible as a Chrome side panel or options page, with two tabs:
  - **Environments** — configure Author and Publish base URLs per environment; add/remove custom environments
  - **Masters & Live Copies** — map Language Master paths to Live Copies with optional masked paths; collapsible cards
- **Export / Import** — back up and restore all settings as a versioned JSON file; supports v0/v1/v2 migration
- **URL rewriting support** — handles publish URLs rewritten by a dispatcher (e.g. `/en-us/page` → `/content/site/en-us/page.html`)
- **Automatic dark / light theme** — follows your OS preference via `prefers-color-scheme`, powered by Adobe Spectrum Web Components
- **Data stays local** — all configuration is stored in `chrome.storage.sync`; nothing is sent to any server

## Usage

### Switching environments

1. Navigate to any AEM page (Author, Publish, or Preview)
2. Click the extension icon in your Chrome toolbar
3. Select the target environment from the title bar dropdown
4. Click **Editor**, **Preview**, or **Published** to open that instance — the active instance is highlighted
5. On Language Master pages, **Published** opens a dropdown of configured Live Copy destinations

### Configuring environments

1. Click the **Settings** (⚙) icon in the popup title bar, or open the Chrome side panel
2. Under the **Environments** tab, set the Author and Publish base URLs for each environment
3. Use **Add Environment** to create a custom entry
4. Click **Save**

### Configuring Language Masters & Live Copies

1. Open the side panel and switch to the **Masters & Live Copies** tab
2. Add a Language Master path (e.g. `/content/site/language-masters/en`)
3. For each Live Copy, set a label (shown in the Published dropdown), the Live Copy path, and an optional masked path for dispatcher-rewritten URLs
4. Click **Save**

### Export / Import

- **Export** — downloads a `aem-env-switcher-YYYY-MM-DD.json` backup of all environments and i18n mappings
- **Import** — load a previously exported file; legacy v0/v1 formats are automatically migrated

---

## Local Development

### Prerequisites

- Node.js 18+ and npm
- Chrome (for testing the extension)

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

This runs `build.js` (esbuild + PostCSS) and produces:

| Output file | Description |
|---|---|
| `swc-bundle.js` | Bundled Adobe Spectrum Web Components (all custom elements) |
| `sidepanel.js` | Compiled side panel + settings JS |
| `style.css` | Minified CSS compiled from `src/css/main.css` |
| `dist/chrome/` | Unpacked Chrome extension (load this folder in Chrome) |
| `dist/aem-env-switcher-chrome.zip` | Packaged Chrome extension ready for the Web Store |

> `swc-bundle.js`, `sidepanel.js`, and `style.css` are build artifacts — they are listed in `.gitignore` and not committed to source control.

### Watch mode

```bash
npm run watch
```

Rebuilds automatically on any source file change.

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/chrome/` folder
4. After any code change, run `npm run build` and click the **↺ Refresh** icon on the extension card

### Firefox

The Firefox build is a two-step process:

```bash
# 1. Compile JS and CSS (same as Chrome)
npm run build

# 2. Assemble the Firefox-specific package
./build-firefox.sh
```

`build-firefox.sh` does the following:
- Copies the compiled artifacts (`swc-bundle.js`, `sidepanel.js`, `style.css`, `popup.js`) into `dist/firefox/`
- Substitutes `firefox/manifest.json` (Manifest V2) for the Chrome MV3 manifest
- Patches `popup.html` and `sidepanel.html` via `sed` to inject `<script src="browser-compat.js">` before any extension script — this shim transparently remaps `chrome.*` API calls to Firefox's `browser.*` namespace
- Zips everything into `dist/aem-env-switcher-firefox.zip` for AMO submission

To test in Firefox before submitting:
1. Open `about:debugging` in Firefox
2. Click **This Firefox** → **Load Temporary Add-on...**
3. Select `dist/firefox/manifest.json`

---

## Project Structure

```
popup.html / popup.js       — Extension popup (title bar + instance cards)
sidepanel.html              — Side panel / options page HTML
src/sidepanel.js            — Side panel settings UI logic
src/swc-imports.js          — esbuild entry point: imports all Spectrum components
src/css/                    — PostCSS source (main.css imports partials)
build.js                    — Build script (esbuild + PostCSS + zip packaging)
firefox/                    — Firefox manifest and compat shim
```

---

## Future Enhancements

- **Keyboard shortcuts** — hotkeys for frequently used environment switches
- **Prod dispatcher URL support** — URL transform for masked production URLs
- **AEM Utilities navigation** — switching between Sites, DAM, CRX, etc.
- **Same-tab / new-tab preference** — configurable per-instance navigation behaviour

