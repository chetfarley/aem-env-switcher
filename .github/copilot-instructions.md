# AEM Environment Switcher - Copilot Instructions

## Project Overview
Chrome + Firefox Extension (Manifest V3) for AEM developers. Switches between Author, Preview, and Publish modes across configurable environments, with Language Master / Live Copy i18n support.

## Architecture

### Key Files
| File | Role |
|---|---|
| `popup.js` | All URL parsing logic + rendering (~800 lines). Pure core functions + DOM rendering layer in one file. |
| `src/sidepanel.js` | Settings UI — Environments tab + Masters & Live Copies tab. Compiled by esbuild to `sidepanel.js`. |
| `src/swc-imports.js` | Adobe Spectrum Web Components barrel import → compiled to `swc-bundle.js`. |
| `src/css/main.css` | PostCSS entry point (imports partials from `src/css/`) → compiled to `style.css`. |
| `build.js` | Single build script: esbuild for JS, PostCSS for CSS, packages Chrome zip. |
| `manifest.json` | Chrome MV3. Permissions: `tabs`, `storage`, `sidePanel`. |
| `firefox/manifest.json` | Firefox-specific overrides; `build-firefox.sh` assembles the Firefox dist. |

### Build Outputs (gitignored)
`swc-bundle.js`, `sidepanel.js`, `style.css` are build artifacts — **do not edit directly**. Edit sources under `src/`.

```
npm run build    # full production build + Chrome zip → dist/chrome/
npm run watch    # rebuild on change, unminified, with inline source maps
npm run package  # repackage only (skips JS/CSS rebuild)
```

To test: load `dist/chrome/` as an unpacked extension in Chrome developer mode.

## Storage Schema (`chrome.storage.sync`)
```javascript
{
  envs: {
    localhost: { author: "http://localhost:4502", publish: "http://localhost:4503", color: "green", order: 0 },
    prod:      { author: "https://author.example.com", publish: "https://www.example.com", color: null, order: 4 }
  },
  i18nMappings: [
    {
      masterPath: "/content/site/language-masters/en",
      liveCopies: [
        { label: "NA – English (US)", path: "/content/site/na/en-us", maskedPath: "/en-us" }
      ]
    }
  ]
}
```
- `color` maps to Adobe Spectrum color names (`"blue"`, `"red"`, `""` = none).
- `order` is 0-based DOM position; rewritten on every save.
- `maskedPath` is the dispatcher-rewritten publish prefix; leave blank to auto-derive from `path`.
- `contentPrefix` is **removed** from v2 — do not reintroduce it.

## AEM URL Patterns
| Mode | Signal |
|---|---|
| Author/Editor | URL contains `editor.html` |
| Preview | URL contains `wcmmode=disabled` |
| Publish | Neither of the above |

`popup.js` defines a `PageContext` type that drives all URL construction — understand it before modifying link generation logic.

## Spectrum Web Components (SWC) Patterns
- All UI uses `@spectrum-web-components` (`sp-textfield`, `sp-picker`, `sp-tabs`, `sp-toast`, etc.).
- Theme is set on `<sp-theme id="sp-theme">` — `.color` set to `"dark"` or `"light"` at runtime via `prefers-color-scheme`.
- `sp-picker` value **must be set after** items are appended (see `appendEnvCard` in `src/sidepanel.js`).
- Wait for `customElements.whenDefined("sp-tabs")` before manipulating tab components.
- Toast feedback: `variant="positive"` (success) / `variant="negative"` (error) with `timeout="5000"`.

## Settings UI Conventions (`src/sidepanel.js`)
- **No global state** — all data loaded fresh from `chrome.storage.sync` per operation.
- Build cards imperatively with `appendChild` when component attributes need JS values; use `innerHTML` for purely static structure.
- `_esc(s)` must wrap all user-supplied strings inserted via `innerHTML` to prevent XSS.
- `_normPath(p)` normalises JCR paths: strips `.html`, trims trailing slashes, ensures leading `/`.
- Status messages: `_showStatus(id, type, msg)` / `_clearStatus(id)` — IDs: `"envs-status"`, `"i18n-status"`, `"io-status"`.

## Import / Export Versioning
Three config formats are supported; `importConfig` migrates automatically:
- **v2**: `{ envs, i18nMappings }` — current format
- **v1**: `{ envs, globalConfig }` — migrated via `_migrateGlobalConfig()`
- **v0**: flat `envs` object

## CSS Architecture
Source partials in `src/css/` (assembled via `postcss-import`):
- `_tokens.css` — design tokens / CSS custom properties
- `_env-colors.css` — per-environment color utilities
- `_sidepanel.css` / `_popup.css` — component styles
- `_swc-overrides.css` — Spectrum component style overrides

## `popup.js` Data Flow
The rendering layer has one entry point into the pure core: `buildPageContext(url, i18nMappings)` → `PageContext`. Everything else flows from that:

```
tab.url + i18nMappings
   └── buildPageContext()     → PageContext { instance, pageType, pagePath, mapping, liveCopy, fullPath }
         └── buildActionUrls(envKey, envConfig, ctx, isActiveEnv) → ActionUrls { editor, preview, published }
```

- `published` is a **string** for live-copy/other pages, or an **array** `[{label, url}]` for language-master pages (drives the live copies dropdown).
- `null` means the action is not applicable for the current context — render the button as disabled.
- `detectCurrentEnv(url, envs)` is called separately to pre-select the active env in the dropdown; it is **not** part of `buildPageContext`.
- URL builder internals: `buildEditorUrl` uses `/editor.html` for localhost and `/ui#/aem/editor.html` for all other hosts. Preview always points to the author host with `?wcmmode=disabled`.

## Firefox Build
Run **after** `npm run build` (the sh script copies already-built artifacts):

```bash
chmod +x build-firefox.sh
./build-firefox.sh
# Output: dist/firefox/ (unpacked) + dist/aem-env-switcher-firefox.zip
```

Key differences from Chrome handled by the script:
- Uses `firefox/manifest.json` instead of root `manifest.json`.
- Injects `<script src="browser-compat.js"></script>` before the first `<script>` in each HTML file. `browser-compat.js` remaps `chrome.*` → `browser.*` so the extension JS runs unmodified in Firefox.

To test in Firefox: `about:debugging` → **This Firefox** → **Load Temporary Add-on** → select `dist/firefox/manifest.json`.

## Active TODOs (do not implement without discussion)
These are planned but not yet built — avoid adding them speculatively:
- **Sidebar**: Export/Import into an `sp-action-menu`; instructional text into `contextual-help`; background color panel; color swatch on env color fields.
- **Popup**: Instance badge via `sp-status-light`; links to CRX / Package Manager / OSGi via `sp-action-menu`; dynamic extension icon color per environment.
- **New features**: Page Properties link; click image → navigate to DAM.
