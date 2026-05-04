// src/swc-imports.js
// Entry point for esbuild — imports all Spectrum Web Components used across
// popup.html and sidepanel.html.
//
// Built by: npm run build  →  swc-bundle.js
// Replaces: src/md-imports.js + md-bundle.js

// ── Core theme (must be first) ───────────────────────────────────────────────
import "@spectrum-web-components/theme/sp-theme.js";
import "@spectrum-web-components/theme/theme-light.js";
import "@spectrum-web-components/theme/theme-dark.js";
import "@spectrum-web-components/theme/scale-medium.js";
import "@spectrum-web-components/theme/scale-large.js";

// ── Buttons ──────────────────────────────────────────────────────────────────
import "@spectrum-web-components/button/sp-button.js";
import "@spectrum-web-components/action-button/sp-action-button.js";
import "@spectrum-web-components/button-group/sp-button-group.js";

// ── Picker / Menu ─────────────────────────────────────────────────────────────
import "@spectrum-web-components/picker/sp-picker.js";
import "@spectrum-web-components/menu/sp-menu.js";
import "@spectrum-web-components/menu/sp-menu-item.js";
import "@spectrum-web-components/menu/sp-menu-divider.js";

// ── Popover / Overlay ─────────────────────────────────────────────────────────
import "@spectrum-web-components/popover/sp-popover.js";
import "@spectrum-web-components/overlay/sp-overlay.js";

// ── Forms ─────────────────────────────────────────────────────────────────────
import "@spectrum-web-components/textfield/sp-textfield.js";
import "@spectrum-web-components/field-label/sp-field-label.js";
import "@spectrum-web-components/field-group/sp-field-group.js";

// ── Tabs ──────────────────────────────────────────────────────────────────────
import "@spectrum-web-components/tabs/sp-tabs.js";
import "@spectrum-web-components/tabs/sp-tab.js";
import "@spectrum-web-components/tabs/sp-tab-panel.js";

// ── Feedback ──────────────────────────────────────────────────────────────────
import "@spectrum-web-components/toast/sp-toast.js";
import "@spectrum-web-components/dialog/sp-dialog.js";
import "@spectrum-web-components/dialog/sp-dialog-wrapper.js";

// ── Layout & Decoration ───────────────────────────────────────────────────────
import "@spectrum-web-components/divider/sp-divider.js";
import "@spectrum-web-components/icon/sp-icon.js";
import "@spectrum-web-components/illustrated-message/sp-illustrated-message.js";

// ── Workflow Icons ────────────────────────────────────────────────────────────
import "@spectrum-web-components/icons-workflow/icons/sp-icon-settings.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-close.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-globe.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-edit.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-preview.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-publish-check.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-add.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-delete.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-remove.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-up.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-right.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-info.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-alert.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-checkmark.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-link-out.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-copy.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-download.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-data-upload.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-save-floppy.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-servers.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-web-page.js";
