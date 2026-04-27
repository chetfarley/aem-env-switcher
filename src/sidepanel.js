// src/sidepanel.js
// Side-panel config UI — Environments tab + Masters & Live Copies tab.
//
// Replaces src/envs-dialog.js + src/i18n-dialog.js.
// Runs inside sidepanel.html as a standard ES module (no chrome.runtime needed
// other than chrome.storage.sync which is available in side panels).

// ── Constants ────────────────────────────────────────────────────────────────

export const BUILTIN_ENVS = ["localhost", "dev", "qa", "stage", "prod"];

const DEFAULT_ENVS = {
  localhost: { author: "http://localhost:4502",  publish: "http://localhost:4503" },
  dev:       { author: "", publish: "" },
  qa:        { author: "", publish: "" },
  stage:     { author: "", publish: "" },
  prod:      { author: "", publish: "" },
};

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  // ── Theme (system dark/light via sp-theme) ──────────────────────────────
  const spTheme = document.getElementById("sp-theme");
  const _mq = window.matchMedia("(prefers-color-scheme: dark)");
  function _applyTheme(e) { spTheme.color = e.matches ? "dark" : "light"; }
  _applyTheme(_mq);
  _mq.addEventListener("change", _applyTheme);

  await customElements.whenDefined("sp-tabs");

  // sp-tabs manages sp-tab-panel visibility natively via the `selected` / `value` attributes.
  // No manual show/hide logic needed — just react to the change event if future work needs it.
  // e.target.selected gives the value string of the newly selected tab.
  document.getElementById("sp-tabs").addEventListener("change", (_e) => {
    // Reserved for future per-tab side-effects (e.g. lazy loading).
  });

  // Wire save buttons
  document.getElementById("save-envs").addEventListener("click", () => saveEnvs());
  document.getElementById("save-i18n").addEventListener("click", () => saveI18n());

  // Load both tabs in parallel
  await Promise.all([loadEnvs(), loadI18n()]);

  // Add-row buttons
  document.getElementById("add-env-btn").addEventListener("click", () => appendEnvCard({ key: "", config: { author: "", publish: "" }, isBuiltin: false, isNew: true }));
  document.getElementById("add-lm-btn").addEventListener("click", () => appendLmCard({ masterPath: "", liveCopies: [] }));

  // Export / Import
  document.getElementById("export-btn").addEventListener("click", () => exportConfig());
  document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", (e) => importConfig(e));
}

// ═══════════════════════════════════════════════════════════════════════════
// ── EXPORT / IMPORT ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function exportConfig() {
  _clearStatus("io-status");
  const { envs, i18nMappings } = await chrome.storage.sync.get(["envs", "i18nMappings"]);
  const payload = {
    envs:         envs         || DEFAULT_ENVS,
    i18nMappings: i18nMappings || [],
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `aem-env-config-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  _showStatus("io-status", "success", "Exported.");
}

async function importConfig(e) {
  _clearStatus("io-status");
  const file = e.target.files[0];
  e.target.value = ""; // reset so same file can be re-imported
  if (!file) return;

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return _showStatus("io-status", "error", "Invalid JSON file.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    return _showStatus("io-status", "error", "Unrecognised config format.");
  }

  // Support v2 { envs, i18nMappings }, v1 { envs, globalConfig }, v0 flat object
  const envsRaw    = parsed.envs || parsed;
  const i18nRaw    = parsed.i18nMappings || null;
  const legacyGlobal = parsed.globalConfig || null;

  // Validate envs shape
  const envsToImport = {};
  for (const [key, val] of Object.entries(envsRaw)) {
    if (key === "globalConfig" || key === "i18nMappings") continue;
    if (typeof val !== "object" || !("author" in val) || !("publish" in val)) {
      return _showStatus("io-status", "error", `Environment "${key}" is missing author/publish.`);
    }
    envsToImport[key] = { author: val.author || "", publish: val.publish || "" };
  }

  // Resolve i18n — prefer v2, attempt legacy migration from v1 globalConfig
  let i18nToImport = [];
  if (i18nRaw) {
    i18nToImport = i18nRaw;
  } else if (legacyGlobal) {
    i18nToImport = _migrateGlobalConfig(legacyGlobal);
  }

  await chrome.storage.sync.set({ envs: envsToImport, i18nMappings: i18nToImport });

  // Re-render both tabs with fresh data
  renderEnvs(envsToImport);
  renderI18n(i18nToImport);

  _showStatus("io-status", "success", "Imported successfully.");
}

/**
 * Converts the legacy globalConfig shape ({ localePath, languageMasterPath })
 * into a single-entry i18nMappings array. Returns [] if conversion isn't possible.
 */
function _migrateGlobalConfig({ localePath = "", languageMasterPath = "" }) {
  if (!localePath || !languageMasterPath) return [];
  const localeRe  = /\/([a-z]{2}-[a-z]{2})$/i;
  const lmMatch   = languageMasterPath.match(localeRe);
  const lcMatch   = localePath.match(localeRe);
  if (!lmMatch || !lcMatch) return [];
  const masterPath = "/" + languageMasterPath.replace(/^\/|\/$/, "");
  const livePath   = "/" + localePath.replace(/^\/|\/$/, "");
  const locale     = lcMatch[1];
  return [{ masterPath, liveCopies: [{ label: locale.toUpperCase(), path: livePath, maskedPath: "/" + locale }] }];
}

// ═══════════════════════════════════════════════════════════════════════════
// ── ENVIRONMENTS TAB ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function loadEnvs() {
  const { envs } = await chrome.storage.sync.get("envs");
  renderEnvs(envs || DEFAULT_ENVS);
}

function renderEnvs(envs) {
  const list = document.getElementById("env-list");
  list.innerHTML = "";

  const builtinKeys = BUILTIN_ENVS.filter(k => envs[k] !== undefined);
  const customKeys  = Object.keys(envs)
    .filter(k => !BUILTIN_ENVS.includes(k))
    .sort((a, b) => a.localeCompare(b));

  for (const key of [...builtinKeys, ...customKeys]) {
    appendEnvCard({ key, config: envs[key], isBuiltin: BUILTIN_ENVS.includes(key), isNew: false });
  }
}

function appendEnvCard({ key, config, isBuiltin, isNew }) {
  const list = document.getElementById("env-list");
  const card = document.createElement("div");
  card.className = `env-card${isBuiltin ? " env-card--builtin" : ""}`;
  card.dataset.envKey = key;

  card.innerHTML = `
    <div class="env-card__header">
      ${isBuiltin
        ? `<span class="env-card__name">${_cap(key)}</span>`
        : `<sp-textfield
             class="env-card__name-input"
             label="Name"
             value="${_esc(key)}"
             maxlength="32"
             help-text="Letters, numbers, - _ only"
           ></sp-textfield>`
      }
      ${!isBuiltin
        ? `<sp-action-button class="env-card__remove" quiet type="button" title="Remove">
             <sp-icon-delete slot="icon"></sp-icon-delete>
           </sp-action-button>`
        : ""
      }
    </div>
    <div class="env-card__fields">
      <sp-textfield
        class="env-card__author"
        type="url"
        label="Author URL"
        value="${_esc(config.author || "")}"
        placeholder="https://author.example.com"
        help-text="No trailing slash"
      ></sp-textfield>
      <sp-textfield
        class="env-card__publish"
        type="url"
        label="Publish URL"
        value="${_esc(config.publish || "")}"
        placeholder="https://www.example.com"
        help-text="No trailing slash"
      ></sp-textfield>
    </div>
  `;

  card.querySelector(".env-card__remove")?.addEventListener("click", () => card.remove());

  list.appendChild(card);

  if (isNew) {
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    requestAnimationFrame(() => card.querySelector(".env-card__name-input")?.focus());
  }
}

async function saveEnvs() {
  _clearStatus("envs-status");

  const cards = document.querySelectorAll("#env-list .env-card");
  const envs  = {};
  const seen  = new Set();

  for (const card of cards) {
    let key;
    if (card.classList.contains("env-card--builtin")) {
      key = card.dataset.envKey;
    } else {
      key = (card.querySelector(".env-card__name-input")?.value || "").trim().toLowerCase();
    }

    if (!key) {
      return _showStatus("envs-status", "error", "One or more environments is missing a name.");
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return _showStatus("envs-status", "error", `"${key}" is not a valid name. Use letters, numbers, - or _.`);
    }
    if (seen.has(key)) {
      return _showStatus("envs-status", "error", `Duplicate environment name: "${key}".`);
    }
    seen.add(key);

    const author  = (card.querySelector(".env-card__author")?.value  || "").trim().replace(/\/$/, "");
    const publish = (card.querySelector(".env-card__publish")?.value || "").trim().replace(/\/$/, "");
    envs[key] = { author, publish };
  }

  await chrome.storage.sync.set({ envs });
  _showStatus("envs-status", "success", "Environments saved.");
}

// ═══════════════════════════════════════════════════════════════════════════
// ── MASTERS & LIVE COPIES TAB ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function loadI18n() {
  const { i18nMappings } = await chrome.storage.sync.get("i18nMappings");
  renderI18n(i18nMappings || []);
}

function renderI18n(mappings) {
  const list = document.getElementById("lm-list");
  list.innerHTML = "";
  for (const mapping of mappings) {
    appendLmCard(mapping);
  }
}

function appendLmCard({ masterPath, liveCopies }) {
  const list = document.getElementById("lm-list");
  const card = document.createElement("div");
  card.className = "lm-card";

  // ── Header ──
  const header = document.createElement("div");
  header.className = "lm-card__header";

  const pathField = document.createElement("sp-textfield");
  pathField.className = "lm-card__path";
  pathField.setAttribute("label", "Language Master JCR Path");
  pathField.setAttribute("value", _esc(masterPath || ""));
  pathField.setAttribute("placeholder", "/content/site/language-masters/en-us");
  pathField.setAttribute("help-text", "Full JCR path — no trailing slash");

  const collapseBtn = document.createElement("sp-action-button");
  collapseBtn.className = "lm-card__collapse";
  collapseBtn.setAttribute("quiet", "");
  collapseBtn.setAttribute("type", "button");
  collapseBtn.setAttribute("title", "Toggle live copies");
  collapseBtn.setAttribute("aria-expanded", "true");
  const _collapseIcon = document.createElement("sp-icon-chevron-down");
  _collapseIcon.setAttribute("slot", "icon");
  collapseBtn.appendChild(_collapseIcon);

  const removeBtn = document.createElement("sp-action-button");
  removeBtn.className = "lm-card__remove";
  removeBtn.setAttribute("quiet", "");
  removeBtn.setAttribute("type", "button");
  removeBtn.setAttribute("title", "Remove Language Master");
  const _removeIcon = document.createElement("sp-icon-delete");
  _removeIcon.setAttribute("slot", "icon");
  removeBtn.appendChild(_removeIcon);

  header.append(pathField, collapseBtn, removeBtn);

  // ── Body ──
  const body = document.createElement("div");
  body.className = "lm-card__body";

  const lcList = document.createElement("div");
  lcList.className = "lc-list";
  body.appendChild(lcList);

  const addLcBtn = document.createElement("sp-button");
  addLcBtn.className = "lm-card__add-lc";
  addLcBtn.setAttribute("type", "button");
  addLcBtn.setAttribute("variant", "secondary");
  addLcBtn.setAttribute("quiet", "");
  addLcBtn.setAttribute("size", "m");
  const _addIcon = document.createElement("sp-icon-add");
  _addIcon.setAttribute("slot", "icon");
  addLcBtn.appendChild(_addIcon);
  addLcBtn.append(" Add Live Copy");
  body.appendChild(addLcBtn);

  // ── Events ──
  collapseBtn.addEventListener("click", () => {
    const collapsed = body.classList.toggle("lm-card__body--collapsed");
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    // Swap icon element — sp-icon-* can't change via textContent.
    const oldIcon = collapseBtn.querySelector("[slot='icon']");
    if (oldIcon) oldIcon.remove();
    const newIcon = document.createElement(collapsed ? "sp-icon-chevron-right" : "sp-icon-chevron-down");
    newIcon.setAttribute("slot", "icon");
    collapseBtn.appendChild(newIcon);
  });

  removeBtn.addEventListener("click", () => {
    if (confirm("Remove this Language Master and all its Live Copies?")) card.remove();
  });

  addLcBtn.addEventListener("click", () => {
    lcList.appendChild(makeLcRow({ label: "", path: "", maskedPath: "" }));
    requestAnimationFrame(() =>
      lcList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  });

  for (const lc of liveCopies || []) {
    lcList.appendChild(makeLcRow(lc));
  }

  card.append(header, body);
  list.appendChild(card);

  if (!masterPath) {
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    requestAnimationFrame(() => pathField.focus());
  }
}

function makeLcRow({ label, path, maskedPath }) {
  const row = document.createElement("div");
  row.className = "lc-row";

  const labelField = document.createElement("sp-textfield");
  labelField.className = "lc-row__label";
  labelField.setAttribute("label", "Label");
  labelField.setAttribute("value", _esc(label || ""));
  labelField.setAttribute("placeholder", "NA \u2013 English (US)");
  labelField.setAttribute("maxlength", "64");

  const pathField = document.createElement("sp-textfield");
  pathField.className = "lc-row__path";
  pathField.setAttribute("label", "Live Copy JCR Path");
  pathField.setAttribute("value", _esc(path || ""));
  pathField.setAttribute("placeholder", "/content/site/websites/na/en-us");

  const maskedField = document.createElement("sp-textfield");
  maskedField.className = "lc-row__masked";
  maskedField.setAttribute("label", "Masked Path (optional)");
  maskedField.setAttribute("value", _esc(maskedPath || ""));
  maskedField.setAttribute("placeholder", "/en-us");
  maskedField.setAttribute("help-text", "Leave blank to auto-derive");

  const removeBtn = document.createElement("sp-action-button");
  removeBtn.className = "lc-row__remove";
  removeBtn.setAttribute("quiet", "");
  removeBtn.setAttribute("type", "button");
  removeBtn.setAttribute("title", "Remove Live Copy");
  const _lcRemoveIcon = document.createElement("sp-icon-remove");
  _lcRemoveIcon.setAttribute("slot", "icon");
  removeBtn.appendChild(_lcRemoveIcon);
  removeBtn.addEventListener("click", () => row.remove());

  row.append(labelField, pathField, maskedField, removeBtn);
  return row;
}

async function saveI18n() {
  _clearStatus("i18n-status");

  const lmCards = document.querySelectorAll("#lm-list .lm-card");
  const i18nMappings = [];
  const seenMasters  = new Set();

  for (const card of lmCards) {
    const masterPath = _normPath(card.querySelector(".lm-card__path")?.value || "");

    if (!masterPath) {
      return _showStatus("i18n-status", "error", "One or more Language Masters is missing a JCR path.");
    }
    if (seenMasters.has(masterPath)) {
      return _showStatus("i18n-status", "error", `Duplicate Language Master path: "${masterPath}".`);
    }
    seenMasters.add(masterPath);

    const liveCopies  = [];
    const seenLcPaths = new Set();

    for (const row of card.querySelectorAll(".lc-row")) {
      const label      = (row.querySelector(".lc-row__label")?.value  || "").trim();
      const path       = _normPath(row.querySelector(".lc-row__path")?.value || "");
      const maskedPath = _normPath(row.querySelector(".lc-row__masked")?.value || "");

      if (!label) {
        return _showStatus("i18n-status", "error", `A Live Copy under "${masterPath}" is missing a label.`);
      }
      if (!path) {
        return _showStatus("i18n-status", "error", `Live Copy "${label}" is missing a JCR path.`);
      }
      if (seenLcPaths.has(path)) {
        return _showStatus("i18n-status", "error", `Duplicate Live Copy path "${path}" under "${masterPath}".`);
      }
      seenLcPaths.add(path);
      liveCopies.push({ label, path, maskedPath });
    }

    i18nMappings.push({ masterPath, liveCopies });
  }

  await chrome.storage.sync.set({ i18nMappings });
  _showStatus("i18n-status", "success", "Masters & Live Copies saved.");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _showStatus(id, type, msg) {
  const container = document.getElementById(id);
  if (!container) return;
  // Remove any existing toast first.
  container.innerHTML = "";
  const toast = document.createElement("sp-toast");
  // Spectrum toast variants: "positive" = success, "negative" = error.
  toast.setAttribute("variant", type === "error" ? "negative" : "positive");
  toast.setAttribute("open", "");
  toast.setAttribute("timeout", "5000");
  toast.textContent = msg;
  container.appendChild(toast);
}

function _clearStatus(id) {
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = "";
}

function _normPath(p) {
  const clean = (p || "").trim().replace(/\.html$/, "").replace(/\/+$/, "");
  if (!clean) return "";
  return clean.startsWith("/") ? clean : "/" + clean;
}

function _cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Run ───────────────────────────────────────────────────────────────────────

init();
