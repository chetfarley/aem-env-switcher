// --- Utility functions ---
async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || "";
}

function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function createLinkSet(base, path) {
  return {
    author: base.author + path,
    publish: base.publish + path,
  };
}

// Extract the short path from any Author or Publish URL
function getShortPath(url, contentPrefix = "") {
  try {
    const decoded = decodeURIComponent(url);
    let clean = decoded
      .replace(/.*(editor\.html|cf#)/, "")
      .replace(/[?#].*$/, "");
    let match = clean.match(/\/content\/[^?#]*?\.html/);
    if (match) {
      // Author/preview URL
      const fullPath = match[0];
      let shortPath = fullPath.replace(contentPrefix, '').replace(/^\//, '').replace(/\.html$/, '');
      if (shortPath.startsWith('/')) shortPath = shortPath.slice(1);
      return shortPath;
    } else {
      // Publish URL
      const urlObj = new URL(decoded);
      let path = urlObj.pathname;
      if (path.endsWith('/')) path = path.slice(0, -1);
      if (path.startsWith('/')) path = path.slice(1);
      return path;
    }
  } catch {
    return "";
  }
}



// Helper function to build environment links based on available URLs
function buildEnvironmentLinks(key, base, shortPath) {
  const hasAuthor = base.author && base.author.trim() !== "";
  const hasPublish = base.publish && base.publish.trim() !== "";
  const contentPrefix = base.contentPrefix || "";
  
  if (!hasAuthor && !hasPublish) return null;
  
  const links = [];
  
  if (hasAuthor) {
    const fullPath = contentPrefix ? `/${contentPrefix}/${shortPath}.html` : `/${shortPath}.html`;
    const isLocalhost = base.author.includes("localhost");
    const authorUrl = isLocalhost ? `${base.author}/editor.html${fullPath}` : `${base.author}/ui#/aem/editor.html${fullPath}`;
    links.push(`<a class="button" href="#" data-env="${key}" data-type="author" data-url="${authorUrl}">Author</a>`);
    
    // Preview uses author URL with wcmmode=disabled
    const previewUrl = `${base.author}${fullPath}?wcmmode=disabled`;
    links.push(`<a class="button" href="#" data-env="${key}" data-type="preview" data-url="${previewUrl}">Preview</a>`);
  }
  
  if (hasPublish) {
    const publishUrl = `${base.publish}/${shortPath}`;
    links.push(`<a class="button" href="#" data-env="${key}" data-type="publish" data-url="${publishUrl}">Publish</a>`);
  }
  
  return `<strong>${key.toUpperCase()}</strong><div class="buttons">${links.join("")}</div>`;
}

// --- Main UI Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  const currentUrlDiv = document.getElementById("currentUrl");
  const envLinksDiv = document.getElementById("envLinks");
  const refreshBtn = document.getElementById("refreshLinks");
  const openOptionsBtn = document.getElementById("openOptions");

  const envOrder = ["localhost", "dev", "qa", "stage", "prod"]; // display order

  async function renderLinks() {
    clear(envLinksDiv);
    const currentUrl = await getCurrentTabUrl();
    currentUrlDiv.textContent = `Current: ${currentUrl}`;
    if (!currentUrl.includes(".com") && !currentUrl.includes("localhost")) return;

    // Load user config
    const { envs } = await chrome.storage.sync.get("envs");
    const config = envs || {};

    // Detect current environment & type
    let currentEnvKey = null;
    let currentType = null;
    let currentContentPrefix = "";
    for (const [key, base] of Object.entries(config)) {
      if (base.author && currentUrl.startsWith(base.author)) {
        currentEnvKey = key;
        currentContentPrefix = base.contentPrefix || "";
        if (currentUrl.includes("editor.html")) currentType = "author";
        else if (currentUrl.includes("wcmmode=disabled")) currentType = "preview";
        else currentType = "publish";
        break;
      }
      if (base.publish && currentUrl.startsWith(base.publish)) {
        currentEnvKey = key;
        currentContentPrefix = base.contentPrefix || "";
        if (currentUrl.includes("wcmmode=disabled")) currentType = "preview";
        else currentType = "publish";
        break;
      }
    }

    const shortPath = getShortPath(currentUrl, currentContentPrefix);

    // Render environment links - only for environments with configured URLs
    // First render ordered environments
    for (const key of envOrder) {
      const base = config[key];
      if (!base) continue;
      
      const linkHtml = buildEnvironmentLinks(key, base, shortPath);
      if (linkHtml) {
        const p = document.createElement("p");
        p.classList.add('buttongroup');
        p.innerHTML = linkHtml;
        envLinksDiv.appendChild(p);
      }
    }
    
    // Then render any custom environments (not in envOrder)
    for (const [key, base] of Object.entries(config)) {
      if (envOrder.includes(key)) continue; // Skip already rendered
      if (!base) continue;
      
      const linkHtml = buildEnvironmentLinks(key, base, shortPath);
      if (linkHtml) {
        const p = document.createElement("p");
        p.classList.add('buttongroup');
        p.innerHTML = linkHtml;
        envLinksDiv.appendChild(p);
      }
    }

    // Add click handlers and highlight active link
    envLinksDiv.querySelectorAll("a").forEach((a) => {
      const envKey = a.getAttribute("data-env");
      const linkType = a.getAttribute("data-type");

      // Highlight active
      if (envKey === currentEnvKey && linkType === currentType) {
        a.classList.add("active");
      }

      a.addEventListener("click", async (e) => {
        e.preventDefault();
        const newUrl = e.target.getAttribute("data-url");
        if (newUrl) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          chrome.tabs.update(tab.id, { url: newUrl });
        }
      });
    });
  }

  openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

  renderLinks();
});
