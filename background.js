// background.js
// Central action icon sync: receives theme updates from extension pages and
// updates the toolbar icon in one place.

const ICON_PATHS = {
  light: {
    "16": "icon-light-16.png",
    "48": "icon-light-48.png",
    "128": "icon-light-128.png",
  },
  dark: {
    "16": "icon-dark-16.png",
    "48": "icon-dark-48.png",
    "128": "icon-dark-128.png",
  },
};

function setActionIcon(isDark) {
  const actionApi = chrome?.action || chrome?.browserAction;
  if (!actionApi?.setIcon) return;

  try {
    const maybePromise = actionApi.setIcon({
      path: isDark ? ICON_PATHS.dark : ICON_PATHS.light,
    });
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => {});
    }
  } catch {
    // ignore icon sync errors
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "theme-sync") return;
  setActionIcon(Boolean(msg.isDark));
});

// Safe fallback on cold starts until a UI page reports the current theme.
chrome.runtime.onInstalled.addListener(() => setActionIcon(false));
chrome.runtime.onStartup.addListener(() => setActionIcon(false));
