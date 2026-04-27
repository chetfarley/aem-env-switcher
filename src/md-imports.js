// src/md-imports.js
// Imports every @material/web component used across the extension.
// This file is the single entry point for the esbuild bundle (md-bundle.js).
// Add new component imports here if needed in future prompts.

// ── Layout ──────────────────────────────────────────────────────────────────
import "@material/web/divider/divider.js";

// ── Buttons ─────────────────────────────────────────────────────────────────
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import "@material/web/iconbutton/icon-button.js";

// ── Icon ─────────────────────────────────────────────────────────────────────
import "@material/web/icon/icon.js";

// ── Select ───────────────────────────────────────────────────────────────────
import "@material/web/select/filled-select.js";
import "@material/web/select/select-option.js";

// ── Tabs (side panel settings) ────────────────────────────────────────────────
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";

// ── Menu ─────────────────────────────────────────────────────────────────────
import "@material/web/menu/menu.js";
import "@material/web/menu/menu-item.js";
import "@material/web/menu/sub-menu.js";

// ── Dialog (config modals — Prompts 5 & 6) ───────────────────────────────────
import "@material/web/dialog/dialog.js";

// ── Form fields (config modals — Prompts 5 & 6) ──────────────────────────────
import "@material/web/textfield/filled-text-field.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/checkbox/checkbox.js";

// ── Lists ────────────────────────────────────────────────────────────────────
import "@material/web/list/list.js";
import "@material/web/list/list-item.js";

// ── Chips ────────────────────────────────────────────────────────────────────
import "@material/web/chips/chip-set.js";
import "@material/web/chips/assist-chip.js";
import "@material/web/chips/input-chip.js";

// ── Ripple / Focus ring (used implicitly) ────────────────────────────────────
import "@material/web/ripple/ripple.js";
import "@material/web/focus/md-focus-ring.js";
