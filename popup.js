// ============================================================
// popup.js — URL parsing & navigation logic
// ============================================================
//
// All core functions are pure (no side-effects, no DOM, no storage).
// The rendering layer (Prompt 3) calls these and handles the UI.
//
// Data types (JSDoc):
//
//   InstanceType  = 'editor' | 'preview' | 'publish'
//   PageType      = 'language-master' | 'live-copy' | 'other'
//
//   LiveCopy {
//     label:       string   — display label, e.g. "NA – English (US)"
//     path:        string   — full JCR path, e.g. /content/site/na/en-us
//     maskedPath?: string   — explicit publish-rewrite prefix, e.g. /en-us
//                             omit to derive automatically from path
//   }
//
//   I18nMapping {
//     masterPath:  string      — full JCR path to LM root
//     liveCopies:  LiveCopy[]
//   }
//
//   EnvConfig {
//     author:  string   — author base URL, no trailing slash
//     publish: string   — publish base URL, no trailing slash
//   }
//
//   PageContext {
//     instance:  InstanceType
//     pageType:  PageType
//     pagePath:  string           — relative path under matched root (no leading /, no .html)
//     mapping:   I18nMapping|null — matched i18n mapping (language-master or live-copy)
//     liveCopy:  LiveCopy|null    — matched live copy entry (live-copy only)
//     fullPath:  string|null      — full path incl. .html (other only)
//   }
//
//   ActionUrls {
//     editor:    string | null
//     preview:   string | null
//     published: string | Array<{label:string, url:string}> | null
//       (array when current page is a language-master with multiple live copies)
//   }
//
// ============================================================

// ---------------------------------------------------------------------------
// Async helpers (used by the rendering layer)
// ---------------------------------------------------------------------------

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function loadStorageConfig() {
  const data = await chrome.storage.sync.get(["envs", "i18nMappings"]);
  return {
    envs:         data.envs         || {},
    i18nMappings: data.i18nMappings || [],
  };
}

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------

/**
 * Escape a string for use inside a RegExp.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalise a JCR or URL path:
 *   - single leading slash
 *   - no trailing slash
 *   - no .html suffix
 *
 * @param {string} p
 * @returns {string}  e.g. "/content/root/websites/na/en-us"
 */
function normalizePath(p) {
  const clean = (p || "").trim().replace(/\.html$/, "").replace(/\/+$/, "");
  if (!clean) return "";
  return clean.startsWith("/") ? clean : "/" + clean;
}

// ---------------------------------------------------------------------------
// Instance detection
// ---------------------------------------------------------------------------

/**
 * Detect which AEM instance type a URL belongs to, using URL patterns only.
 * No env config needed.
 *
 * Rules:
 *   - contains "editor.html" or "cf#"  → editor
 *   - contains "wcmmode=disabled"       → preview
 *   - everything else                   → publish
 *
 * @param {string} url
 * @returns {'editor'|'preview'|'publish'}
 */
function detectInstance(url) {
  const decoded = decodeURIComponent(url);
  if (decoded.includes("editor.html") || decoded.includes("cf#")) return "editor";
  if (decoded.includes("wcmmode=disabled")) return "preview";
  return "publish";
}

// ---------------------------------------------------------------------------
// Content path extraction
// ---------------------------------------------------------------------------

/**
 * Extract the raw JCR content path from any AEM URL.
 * Returns a normalised path (leading slash, no trailing slash, no .html).
 *
 * Examples:
 *   editor  https://author/ui#/aem/editor.html/content/site/page.html
 *           → /content/site/page
 *
 *   editor  http://localhost:4502/editor.html/content/site/page.html
 *           → /content/site/page
 *
 *   preview https://author/content/site/page.html?wcmmode=disabled
 *           → /content/site/page
 *
 *   publish https://www.example.com/en-us/my-page
 *           → /en-us/my-page
 *
 *   publish https://www.example.com/content/site/page.html
 *           → /content/site/page
 *
 * @param {string} url
 * @returns {string}
 */
function extractContentPath(url) {
  try {
    const decoded = decodeURIComponent(url);

    if (detectInstance(decoded) === "editor") {
      // Path lives after the last "editor.html" or "cf#" token
      const m = decoded.match(/(?:editor\.html|cf#)(\/[^?#]*)/);
      return m ? normalizePath(m[1]) : "";
    }

    // preview or publish — pathname only
    return normalizePath(new URL(decoded).pathname);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Masked path derivation
// ---------------------------------------------------------------------------

/**
 * Derive the publish-rewrite prefix from a live copy's JCR path by stripping
 * everything up to and including the root segment before the locale.
 *
 * Strategy: use the trailing locale-like segment (xx-xx) as the masked path.
 *   /content/root/websites/na/en-us  →  /en-us
 *   /content/root/websites/na/fr-ca  →  /fr-ca
 *
 * Falls back to the full JCR path if no locale segment is found (prevents
 * silent mismatches — user should set maskedPath explicitly in that case).
 *
 * @param {string} jcrPath  e.g. "/content/root/websites/na/en-us"
 * @returns {string}         e.g. "/en-us"
 */
function deriveMaskedPath(jcrPath) {
  const clean = normalizePath(jcrPath);
  const m = clean.match(/\/([a-z]{2}-[a-z]{2})$/i);
  return m ? "/" + m[1] : clean;
}

/**
 * Return the effective masked publish path for a live copy.
 * Uses liveCopy.maskedPath when explicitly set, otherwise derives it.
 *
 * @param {LiveCopy} liveCopy
 * @returns {string}
 */
function getEffectiveMaskedPath(liveCopy) {
  return (liveCopy.maskedPath && liveCopy.maskedPath.trim())
    ? normalizePath(liveCopy.maskedPath)
    : deriveMaskedPath(liveCopy.path);
}

// ---------------------------------------------------------------------------
// i18n mapping lookup
// ---------------------------------------------------------------------------

/**
 * Match a normalised content path against the stored i18n mappings.
 *
 * Matching priority (first match wins):
 *   1. Language Master JCR path   (mapping.masterPath)
 *   2. Live Copy full JCR path    (liveCopy.path)        — author/full-path publish
 *   3. Live Copy masked path      (effective masked path) — rewritten publish URLs
 *
 * @param {string}        contentPath    — output of extractContentPath()
 * @param {I18nMapping[]} i18nMappings
 * @returns {{ pageType: PageType, mapping: I18nMapping|null, liveCopy: LiveCopy|null, pagePath: string }}
 */
function matchI18nContext(contentPath, i18nMappings) {
  const noMatch = { pageType: "other", mapping: null, liveCopy: null, pagePath: "" };
  if (!contentPath || !Array.isArray(i18nMappings) || i18nMappings.length === 0) return noMatch;

  for (const mapping of i18nMappings) {
    const master = normalizePath(mapping.masterPath);
    if (!master) continue;

    // 1. Language Master match
    if (contentPath === master || contentPath.startsWith(master + "/")) {
      const pagePath = contentPath.slice(master.length).replace(/^\//, "");
      return { pageType: "language-master", mapping, liveCopy: null, pagePath };
    }

    for (const lc of mapping.liveCopies || []) {
      // 2. Live Copy full JCR path
      const lcPath = normalizePath(lc.path);
      if (lcPath && (contentPath === lcPath || contentPath.startsWith(lcPath + "/"))) {
        const pagePath = contentPath.slice(lcPath.length).replace(/^\//, "");
        return { pageType: "live-copy", mapping, liveCopy: lc, pagePath };
      }

      // 3. Live Copy masked (rewritten) path — relevant for publish URLs
      const masked = getEffectiveMaskedPath(lc);
      if (masked && (contentPath === masked || contentPath.startsWith(masked + "/"))) {
        const pagePath = contentPath.slice(masked.length).replace(/^\//, "");
        return { pageType: "live-copy", mapping, liveCopy: lc, pagePath };
      }
    }
  }

  return noMatch;
}

// ---------------------------------------------------------------------------
// Page context
// ---------------------------------------------------------------------------

/**
 * Build a complete PageContext from the current browser URL and stored config.
 * This is the single entry-point for the rendering layer.
 *
 * @param {string}        url
 * @param {I18nMapping[]} i18nMappings
 * @returns {PageContext}
 */
function buildPageContext(url, i18nMappings) {
  const instance    = detectInstance(url);
  const contentPath = extractContentPath(url);
  const { pageType, mapping, liveCopy, pagePath } = matchI18nContext(contentPath, i18nMappings);

  // "other" pages preserve .html for AEM URL compatibility
  let fullPath = null;
  if (pageType === "other" && contentPath) {
    fullPath = contentPath.endsWith(".html") ? contentPath : contentPath + ".html";
  }

  return { instance, pageType, pagePath, mapping, liveCopy, fullPath };
}

/**
 * Detect which configured environment the current URL belongs to.
 * Used by the rendering layer to pre-select the active env in the dropdown.
 *
 * @param {string}                    url
 * @param {Record<string, EnvConfig>} envs
 * @returns {{ envKey: string|null, instance: InstanceType }}
 */
function detectCurrentEnv(url, envs) {
  const instance = detectInstance(url);
  for (const [key, base] of Object.entries(envs || {})) {
    if (base.author  && url.startsWith(base.author))  return { envKey: key, instance };
    if (base.publish && url.startsWith(base.publish)) return { envKey: key, instance };
  }
  return { envKey: null, instance };
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/**
 * Build an AEM editor URL for a given author base and JCR path.
 *
 *   localhost  → {authorBase}/editor.html{jcrPath}.html
 *   other      → {authorBase}/ui#/aem/editor.html{jcrPath}.html
 *
 * @param {string} authorBase   e.g. "http://localhost:4502"
 * @param {string} jcrPath      normalised, e.g. "/content/site/page"
 * @returns {string}
 */
function buildEditorUrl(authorBase, jcrPath) {
  const path = jcrPath.endsWith(".html") ? jcrPath : jcrPath + ".html";
  return authorBase.includes("localhost")
    ? `${authorBase}/editor.html${path}`
    : `${authorBase}/ui#/aem/editor.html${path}`;
}

/**
 * Build an AEM preview URL (wcmmode=disabled, served from the author host).
 *
 * @param {string} authorBase
 * @param {string} jcrPath     normalised, e.g. "/content/site/page"
 * @returns {string}
 */
function buildPreviewUrl(authorBase, jcrPath) {
  const path = jcrPath.endsWith(".html") ? jcrPath : jcrPath + ".html";
  return `${authorBase}${path}?wcmmode=disabled`;
}

/**
 * Build a published URL for a live copy page.
 *
 * URL = publishBase + effectiveMaskedPath + "/" + pagePath
 *
 * If liveCopy.maskedPath is explicitly set, it is used as-is.
 * Otherwise the masked path is derived from liveCopy.path (see deriveMaskedPath).
 *
 * @param {string}   publishBase   e.g. "https://www.example.com"
 * @param {LiveCopy} liveCopy
 * @param {string}   pagePath      relative, e.g. "events/my-event" (may be empty)
 * @returns {string}
 */
function buildPublishUrl(publishBase, liveCopy, pagePath) {
  const masked = getEffectiveMaskedPath(liveCopy);
  const page   = pagePath ? `/${pagePath}` : "";
  return `${publishBase}${masked}${page}`;
}

// ---------------------------------------------------------------------------
// Action URL matrix
// ---------------------------------------------------------------------------

/**
 * Build the three contextual action URLs for a target environment.
 *
 * Requirements matrix (rows = button clicked, columns = current page context):
 *
 *                      | editor(master) | preview(master) | publish(master) | editor(copy) | preview(copy) | publish(copy)
 *   -------------------|----------------|-----------------|-----------------|--------------|---------------|---------------
 *   editor  (Edit LM)  | n/a            | master editor   | master editor   | master editor| master editor | master editor
 *   preview (Preview)  | master preview | n/a             | master preview  | copy preview | n/a           | n/a
 *   published (Publish)| copy dropdown  | copy dropdown   | copy dropdown   | copy publish | copy publish  | n/a
 *
 * For "other" page types: standard editor/preview/publish, no LM logic.
 *
 * Return values:
 *   string                        → navigate directly to this URL
 *   Array<{label, url}>           → show a picker dropdown (LM "published" action)
 *   null                          → action is n/a; render button as disabled
 *
 * @param {string}     envKey     — environment name (informational only)
 * @param {EnvConfig}  envConfig  — target environment { author, publish }
 * @param {PageContext} ctx       — output of buildPageContext()
 * @returns {ActionUrls}
 */
function buildActionUrls(envKey, envConfig, ctx, isActiveEnv) {
  const { instance, pageType, pagePath, mapping, liveCopy, fullPath } = ctx;
  const author  = (envConfig.author  || "").trim();
  const publish = (envConfig.publish || "").trim();
  const hasAuthor  = author  !== "";
  const hasPublish = publish !== "";

  // When a different env is selected the user is navigating away — all buttons
  // that have a valid URL should be enabled regardless of current instance.
  const sameInstance = (inst) => isActiveEnv && instance === inst;

  // ── other / generic AEM path ──────────────────────────────────────────────
  if (pageType === "other") {
    if (!fullPath) return { editor: null, preview: null, published: null };
    return {
      editor:    hasAuthor  && !sameInstance("editor")  ? buildEditorUrl(author, fullPath)   : null,
      preview:   hasAuthor  && !sameInstance("preview") ? buildPreviewUrl(author, fullPath)  : null,
      published: hasPublish && !sameInstance("publish") ? `${publish}${fullPath}`            : null,
    };
  }

  // ── language-master ───────────────────────────────────────────────────────
  if (pageType === "language-master") {
    const masterJcr = normalizePath(mapping.masterPath) + (pagePath ? "/" + pagePath : "");

    // "published" is always a dropdown of all configured live copies
    const publishedOptions = hasPublish
      ? (mapping.liveCopies || [])
          .map(lc => ({ label: lc.label, url: buildPublishUrl(publish, lc, pagePath) }))
          .filter(o => o.label && o.url)
      : null;

    return {
      editor:    !sameInstance("editor")  ? (hasAuthor ? buildEditorUrl(author, masterJcr)  : null) : null,
      preview:   !sameInstance("preview") ? (hasAuthor ? buildPreviewUrl(author, masterJcr) : null) : null,
      published: (publishedOptions && publishedOptions.length > 0) ? publishedOptions : null,
    };
  }

  // ── live-copy ─────────────────────────────────────────────────────────────
  if (pageType === "live-copy") {
    const masterJcr   = normalizePath(mapping.masterPath) + (pagePath ? "/" + pagePath : "");
    const liveCopyJcr = normalizePath(liveCopy.path)      + (pagePath ? "/" + pagePath : "");

    return {
      editor: hasAuthor ? buildEditorUrl(author, masterJcr) : null,

      preview: !sameInstance("preview")
        ? (hasAuthor ? buildPreviewUrl(author, liveCopyJcr) : null)
        : null,

      published: !sameInstance("publish")
        ? (hasPublish ? buildPublishUrl(publish, liveCopy, pagePath) : null)
        : null,
    };
  }

  return { editor: null, preview: null, published: null };
}

// ---------------------------------------------------------------------------
// Ordered environment list helper
// ---------------------------------------------------------------------------

const ENV_ORDER = ["localhost", "dev", "qa", "stage", "prod"];

/**
 * Return env entries sorted: known envs first (ENV_ORDER), then custom envs
 * alphabetically. Only includes envs that have at least one URL configured.
 *
 * @param {Record<string, EnvConfig>} envs
 * @returns {Array<[string, EnvConfig]>}  [ [key, config], ... ]
 */
function sortedEnvEntries(envs) {
  const hasUrl = ([, cfg]) => (cfg.author || "").trim() || (cfg.publish || "").trim();
  const known  = ENV_ORDER.filter(k => envs[k]).map(k => [k, envs[k]]).filter(hasUrl);
  const custom = Object.entries(envs)
    .filter(([k]) => !ENV_ORDER.includes(k))
    .filter(hasUrl)
    .sort(([a], [b]) => a.localeCompare(b));
  return [...known, ...custom];
}

// ---------------------------------------------------------------------------
// Rendering layer
// Wires the pure logic functions above to the MD3 DOM in popup.html.
// Runs as a deferred script so md-bundle.js (type="module") has already
// registered all custom elements before this executes.
// ---------------------------------------------------------------------------

(async function initPopup() {

  // Extra safety: wait for sp-picker to be defined before accessing it.
  await customElements.whenDefined("sp-picker");

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const envSelect      = document.getElementById("envSelect");
  const btnEditor      = document.getElementById("btn-editor");
  const btnPreview     = document.getElementById("btn-preview");
  const btnPublished   = document.getElementById("btn-published");
  const publishedMenu  = document.getElementById("published-menu");
  const publishedOverlay = document.getElementById("published-overlay");
  const publishedMenuList = publishedMenu.querySelector("sp-menu");
  const btnMenuToggle  = document.getElementById("btn-menu");
  const btnClose       = document.getElementById("btn-close");
  const contextLabel   = document.getElementById("contextLabel");
  const currentUrlEl   = document.getElementById("currentUrl");

  // ── State ───────────────────────────────────────────────────────────────────
  let _tab         = null;   // chrome Tab object
  let _envs        = {};     // Record<string, EnvConfig>
  let _i18n        = [];     // I18nMapping[]
  let _ctx         = null;   // PageContext for current URL
  let _activeEnv   = null;   // env key that the current tab URL matched
  let _selectedEnv = null;   // env key currently selected in the dropdown

  // ── Theme (system dark/light via sp-theme) ────────────────────────────────
  const spTheme = document.getElementById("sp-theme");
  const _mq = window.matchMedia("(prefers-color-scheme: dark)");
  function _applyTheme(e) { spTheme.color = e.matches ? "dark" : "light"; }
  _applyTheme(_mq);
  _mq.addEventListener("change", _applyTheme);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  _tab = await getCurrentTab();
  if (!_tab?.url) return;

  const cfg = await loadStorageConfig();
  _envs = cfg.envs;
  _i18n = cfg.i18nMappings;

  _ctx = buildPageContext(_tab.url, _i18n);

  const detected = detectCurrentEnv(_tab.url, _envs);
  _activeEnv   = detected.envKey;
  _selectedEnv = detected.envKey;

  // Must be set before renderActions() calls enablePublishedDropdown.
  const publishedAnchor = btnPublished.closest(".published-anchor");
  // sp-popover positioning is controlled by placement attribute + CSS — no anchorElement needed.

  populateEnvDropdown();
  renderActions();
  renderContextBar();

  // Expose a refresh hook for envs-dialog.js — called after a successful save
  // so the env dropdown reflects the newly saved environment list.
  window.__refreshEnvDropdown = async () => {
    const fresh = await loadStorageConfig();
    _envs = fresh.envs;
    _i18n = fresh.i18nMappings;
    populateEnvDropdown();
    renderActions();
  };

  // Expose a refresh hook for i18n-dialog.js — called after i18n mappings save
  // so the Published dropdown reflects updated live copy targets.
  window.__refreshPopup = async () => {
    const fresh = await loadStorageConfig();
    _envs = fresh.envs;
    _i18n = fresh.i18nMappings;
    renderActions();
  };

  // ── Environment dropdown ────────────────────────────────────────────────────

  function populateEnvDropdown() {
    while (envSelect.firstChild) envSelect.removeChild(envSelect.firstChild);

    const entries = sortedEnvEntries(_envs);
    if (entries.length === 0) {
      const opt = document.createElement("sp-menu-item");
      opt.value = "";
      opt.textContent = "No environments configured";
      opt.disabled = true;
      envSelect.appendChild(opt);
      return;
    }

    let firstKey = null;
    for (const [key] of entries) {
      if (!firstKey) firstKey = key;
      const opt = document.createElement("sp-menu-item");
      opt.value = key;
      opt.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      envSelect.appendChild(opt);
    }

    // If no env was detected from the current tab URL, pre-select the first one.
    if (!_selectedEnv && firstKey) {
      _selectedEnv = firstKey;
    }

    // Set picker value after options are in the DOM.
    envSelect.value = _selectedEnv;
  }

  // ── Action buttons ──────────────────────────────────────────────────────────

  function renderActions() {
    if (!_selectedEnv || !_ctx) {
      setBtn(btnEditor,    null, false);
      setBtn(btnPreview,   null, false);
      setBtn(btnPublished, null, false);
      return;
    }

    const envConfig = _envs[_selectedEnv];
    if (!envConfig) return;

    // Active state only applies when the selected env is the one currently visited.
    const isCurrentEnvSelected = _selectedEnv === _activeEnv;

    const actions = buildActionUrls(_selectedEnv, envConfig, _ctx, isCurrentEnvSelected);

    setBtn(btnEditor,    actions.editor,
      isCurrentEnvSelected && _ctx.instance === "editor");
    setBtn(btnPreview,   actions.preview,
      isCurrentEnvSelected && _ctx.instance === "preview");
    setBtn(btnPublished, actions.published,
      isCurrentEnvSelected && _ctx.instance === "publish");

    // Wire click handlers fresh on every render to avoid stale closures.
    btnEditor.onclick  = actions.editor  ? () => navigate(actions.editor)  : null;
    btnPreview.onclick = actions.preview ? () => navigate(actions.preview) : null;

    if (Array.isArray(actions.published)) {
      // Language-master: dropdown of live copies.
      enablePublishedDropdown(actions.published);
    } else {
      // Live-copy or other: direct navigation (or disabled if null).
      enablePublishedDirect(actions.published);
    }
  }

  /**
   * Set the visual state of one instance action button.
   *
   * @param {HTMLElement}       btn
   * @param {string|Array|null} action   — null means n/a (disabled)
   * @param {boolean}           isActive — true = this IS the current instance+env
   */
  function setBtn(btn, action, isActive) {
    const available = action !== null && action !== undefined;
    btn.disabled = !available;
    btn.classList.toggle("is-active", isActive);
  }

  // ── Published dropdown helpers ──────────────────────────────────────────────
  //
  // The Published button has two modes:
  //
  //   dropdown mode  (language-master page)
  //     — button gains trailing arrow icon + aria-haspopup
  //     — clicking opens an md-menu listing all live copies
  //     — each item navigates to the live copy's published URL
  //
  //   direct mode  (live-copy, other, or single result)
  //     — button navigates directly on click
  //     — no arrow icon, no menu
  //
  // The .published-anchor wrapper gets a .has-dropdown class so CSS can
  // adjust the button width and icon visibility without touching the
  // md-filled-button shadow DOM.
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Switch the Published button into dropdown mode.
   * Populates the menu and wires all interaction.
   *
   * @param {Array<{label: string, url: string}>} options
   */
  function enablePublishedDropdown(options) {
    publishedAnchor.classList.add("has-dropdown");
    btnPublished.setAttribute("aria-haspopup", "menu");

    populatePublishedMenu(options);

    // sp-overlay[trigger="btn-published@click"] owns open/close — no onclick needed.
    btnPublished.onclick = null;
  }

  /**
   * Switch the Published button into direct-navigation mode.
   * Wires a simple click-to-navigate and clears the menu.
   *
   * @param {string|null} url  — null leaves the button disabled
   */
  function enablePublishedDirect(url) {
    publishedAnchor.classList.remove("has-dropdown");
    btnPublished.setAttribute("aria-haspopup", "false");
    btnPublished.setAttribute("aria-expanded", "false");

    clearPublishedMenu();
    publishedOverlay.open = false;

    btnPublished.onclick = url ? () => navigate(url) : null;
  }

  /**
   * Render menu items from an options array.
   * Handles the empty-state (LM configured but no live copies added yet).
   *
   * @param {Array<{label: string, url: string}>} options
   */
  function populatePublishedMenu(options) {
    while (publishedMenuList.firstChild) publishedMenuList.removeChild(publishedMenuList.firstChild);

    if (options.length === 0) {
      const empty = document.createElement("sp-menu-item");
      empty.textContent = "No live copies configured";
      empty.disabled = true;
      empty.classList.add("published-menu__empty");
      publishedMenuList.appendChild(empty);
      return;
    }

    for (const { label, url } of options) {
      const item = document.createElement("sp-menu-item");
      item.setAttribute("role", "menuitem");
      const icon = document.createElement("sp-icon-globe");
      icon.setAttribute("slot", "icon");
      icon.setAttribute("aria-hidden", "true");
      item.appendChild(icon);
      item.append(label);

      item.addEventListener("click", () => {
        closePublishedMenu();
        navigate(url);
      });

      publishedMenuList.appendChild(item);
    }
  }

  function clearPublishedMenu() {
    while (publishedMenuList.firstChild) publishedMenuList.removeChild(publishedMenuList.firstChild);
  }

  /** Close the published menu and restore button state + focus. */
  function closePublishedMenu() {
    publishedOverlay.open = false;
    btnPublished.focus();
  }

  // ── Context bar ─────────────────────────────────────────────────────────────

  function renderContextBar() {
    if (!_ctx) return;

    const typeLabels = {
      "language-master": "Language Master",
      "live-copy":       `Live Copy${_ctx.liveCopy?.label ? " · " + _ctx.liveCopy.label : ""}`,
      "other":           "",
    };
    const instanceLabels = {
      editor:  "Editor",
      preview: "Preview",
      publish: "Published",
    };

    const typeStr = typeLabels[_ctx.pageType] || "";
    const instStr = instanceLabels[_ctx.instance] || "";
    contextLabel.textContent = [instStr, typeStr].filter(Boolean).join(" · ");

    const url = _tab?.url || "";
    currentUrlEl.textContent = url.length > 70 ? "…" + url.slice(-67) : url;
    currentUrlEl.title = url;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  async function navigate(url) {
    if (!url || !_tab) return;
    await chrome.tabs.update(_tab.id, { url });
    window.close();
  }

  // ── Event listeners ─────────────────────────────────────────────────────────

  // Env dropdown — stay on same instance type, switch target environment.
  envSelect.addEventListener("change", () => {
    _selectedEnv = envSelect.value;
    renderActions();
  });

  // Settings button — open the side panel directly.
  btnMenuToggle.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  });

  // Close button.
  btnClose.addEventListener("click", () => window.close());

  // Close any open menus on outside click.
  document.addEventListener("click", () => {
    if (publishedMenu.open) closePublishedMenu();
  });

  // Escape closes the published menu.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (publishedMenu.open) {
      e.stopPropagation();
      closePublishedMenu();
    }
  });

})();
