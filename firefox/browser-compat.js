/**
 * browser-compat.js
 *
 * Minimal compatibility shim so the extension's JS files can use the
 * `chrome.*` namespace on both Chrome (MV3) and Firefox (MV2).
 *
 * Firefox exposes the WebExtensions API as `browser.*` with native Promises.
 * It also provides a `chrome.*` alias for most APIs, but that alias uses
 * callbacks rather than Promises for some older Firefox versions.
 *
 * This shim ensures `chrome` always points to a Promise-based API object by
 * preferring `browser` when it is available (Firefox), and falling back to the
 * native `chrome` global (Chrome/Edge). Because all of the extension's JS
 * already uses `await chrome.*`, no other files need to change.
 */
(function () {
  if (typeof browser !== "undefined" && typeof chrome === "undefined") {
    // Pure Firefox without a chrome alias – expose browser as chrome.
    globalThis.chrome = browser;
  } else if (
    typeof browser !== "undefined" &&
    typeof chrome !== "undefined" &&
    browser !== chrome
  ) {
    // Firefox with both globals: prefer `browser` so we get native Promises.
    globalThis.chrome = browser;
  }
  // Otherwise we are on Chrome/Edge and `chrome` is already correct.
})();
