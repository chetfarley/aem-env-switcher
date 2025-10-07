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
        if (isAuthorTab || isPreviewTab) {
          newUrl = `${envBase.author}/ui#/aem/editor.html${contentPath}`;
        } else if (isPublishTab) {
          newUrl = `${envBase.author}/ui#/aem/editor.html${contentPath}`;
        }
        break;
  
      case "publish":
        if (isAuthorTab) {
          newUrl = `${envBase.publish}${contentPath}`;
        } else if (isPublishTab) {
          newUrl = `${envBase.publish}${contentPath}`;
        } else if (isPreviewTab) {
          newUrl = `${envBase.publish}${contentPath}`;
        }
        break;
  
      case "preview":
        if (isAuthorTab || isPreviewTab || isPublishTab) {
          newUrl = `${envBase.author}${contentPath}?wcmmode=disabled`;
        }
        break;
    }
  
    return newUrl;
  }
  
  // --- Main UI Logic ---
  document.addEventListener("DOMContentLoaded", async () => {
    const currentUrlDiv = document.getElementById("currentUrl");
    const envLinksDiv = document.getElementById("envLinks");
    const refreshBtn = document.getElementById("refreshLinks");
    const openOptionsBtn = document.getElementById("openOptions");
  
    const envOrder = ["dev", "qa", "stage", "prod"]; // display order
  
    async function renderLinks() {
      clear(envLinksDiv);
      const currentUrl = await getCurrentTabUrl();
      currentUrlDiv.textContent = `Current: ${currentUrl}`;
      if (!currentUrl.includes(".com")) return;
  
      const path = extractAemPath(currentUrl);
  
      // Load user config (or defaults)
      const { envs } = await chrome.storage.sync.get("envs");
      const config = envs || {
        dev: { author: "https://author-dev.example.com", publish: "https://dev.example.com" },
        qa: { author: "https://author-p140127-e1482207.adobeaemcloud.com", publish: "https://qa-www.komatsu.com" },
        stage: { author: "https://author-stage.example.com", publish: "https://stage.example.com" },
        prod: { author: "https://author.example.com", publish: "https://www.example.com" },
      };
  
      // Detect current environment & type
      let currentEnvKey = null;
      let currentType = null;
      for (const [key, base] of Object.entries(config)) {
        if (currentUrl.startsWith(base.author)) {
          currentEnvKey = key;
          if (currentUrl.includes("editor.html")) currentType = "author";
          else if (currentUrl.includes("wcmmode=disabled")) currentType = "preview";
          else currentType = "publish";
          break;
        }
        if (currentUrl.startsWith(base.publish)) {
          currentEnvKey = key;
          if (currentUrl.includes("wcmmode=disabled")) currentType = "preview";
          else currentType = "publish";
          break;
        }
      }
  
      // Render environment links
      for (const key of envOrder) {
        const base = config[key];
        if (!base) continue;
  
        const links = createLinkSet(base, path);
        const p = document.createElement("p");
        p.innerHTML = `
          <strong>${key.toUpperCase()}</strong>:
          <a href="#" data-env="${key}" data-type="author" data-url="${links.author}">Author</a> |
          <a href="#" data-env="${key}" data-type="preview" data-url="${links.publish}">Preview</a> |
          <a href="#" data-env="${key}" data-type="publish" data-url="${links.publish}">Publish</a>
        `;
        envLinksDiv.appendChild(p);
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
  
    refreshBtn.addEventListener("click", renderLinks);
    openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
  
    renderLinks();
  });
  