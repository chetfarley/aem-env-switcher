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

// Extract the AEM content path from any Author or Publish URL
function extractAemPath(url) {
  try {
    const decoded = decodeURIComponent(url);
    const clean = decoded
      .replace(/.*(editor\.html|cf#)/, "")
      .replace(/[?#].*$/, "");
    const match = clean.match(/\/content\/[^?#]*?\.html/);
    return match ? match[0] : "";
  } catch {
    return "";
  }
}

// --- Core Transform Logic ---
function transformUrl(currentUrl, clickedUrl, envBase, linkType) {
  const isAuthorTab = currentUrl.includes("editor.html");
  const isPreviewTab = currentUrl.includes("wcmmode=disabled");
  const isPublishTab = !isAuthorTab && !isPreviewTab;

  let contentPathMatch = clickedUrl.match(/\/content\/[^\?#]+\.html/);
  if (!contentPathMatch) return null;
  const contentPath = contentPathMatch[0];

  let newUrl;

  switch (linkType) {
    case "author":
      if (!envBase.author) return null;
      if (isAuthorTab || isPreviewTab || isPublishTab) {
        // Localhost doesn't need /ui#/aem/
        const isLocalhost = envBase.author.includes("localhost");
        if (isLocalhost) {
          newUrl = `${envBase.author}/editor.html${contentPath}`;
        } else {
          newUrl = `${envBase.author}/ui#/aem/editor.html${contentPath}`;
        }
      }
      break;

    case "publish":
      if (!envBase.publish) return null;
      if (isAuthorTab || isPublishTab || isPreviewTab) {
        newUrl = `${envBase.publish}${contentPath}`;
      }
      break;

    case "preview":
      if (!envBase.author) return null;
      if (isAuthorTab || isPreviewTab || isPublishTab) {
        newUrl = `${envBase.author}${contentPath}?wcmmode=disabled`;
      }
      break;
  }

  return newUrl;
}

// Helper function to build environment links based on available URLs
function buildEnvironmentLinks(key, base, path) {
  const hasAuthor = base.author && base.author.trim() !== "";
  const hasPublish = base.publish && base.publish.trim() !== "";
  
  if (!hasAuthor && !hasPublish) return null;
  
  const links = [];
  
  if (hasAuthor) {
    const authorUrl = base.author + path;
    links.push(`<a class="button" href="#" data-env="${key}" data-type="author" data-url="${authorUrl}">Author</a>`);
    
    // Preview uses author URL with wcmmode=disabled
    const previewUrl = base.author + path + "?wcmmode=disabled";
    links.push(`<a class="button" href="#" data-env="${key}" data-type="preview" data-url="${previewUrl}">Preview</a>`);
  }
  
  if (hasPublish) {
    const publishUrl = base.publish + path;
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

    const path = extractAemPath(currentUrl);

    // Load user config
    const { envs } = await chrome.storage.sync.get("envs");
    const config = envs || {};

    // Detect current environment & type
    let currentEnvKey = null;
    let currentType = null;
    for (const [key, base] of Object.entries(config)) {
      if (base.author && currentUrl.startsWith(base.author)) {
        currentEnvKey = key;
        if (currentUrl.includes("editor.html")) currentType = "author";
        else if (currentUrl.includes("wcmmode=disabled")) currentType = "preview";
        else currentType = "publish";
        break;
      }
      if (base.publish && currentUrl.startsWith(base.publish)) {
        currentEnvKey = key;
        if (currentUrl.includes("wcmmode=disabled")) currentType = "preview";
        else currentType = "publish";
        break;
      }
    }

    // Render environment links - only for environments with configured URLs
    // First render ordered environments
    for (const key of envOrder) {
      const base = config[key];
      if (!base) continue;
      
      const linkHtml = buildEnvironmentLinks(key, base, path);
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
      
      const linkHtml = buildEnvironmentLinks(key, base, path);
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
        const clickedUrl = e.target.getAttribute("data-url");
        const envKey = e.target.getAttribute("data-env");
        const linkType = e.target.getAttribute("data-type");
        const envBase = config[envKey];
        const currentTabUrl = await getCurrentTabUrl();
        const newUrl = transformUrl(currentTabUrl, clickedUrl, envBase, linkType);
        if (newUrl) {
          chrome.tabs.create({ url: newUrl }); // open in new tab
        }
      });
    });
  }

  openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

  renderLinks();
});
