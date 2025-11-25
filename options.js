const defaultConfig = {
  localhost: { author: "http://localhost:4502", publish: "http://localhost:3000" },
  dev: { author: "", publish: "" },
  qa: { author: "", publish: "" },
  stage: { author: "", publish: "" },
  prod: { author: "", publish: "" },
};

const envOrder = ["localhost", "dev", "qa", "stage", "prod"]; // display order

// Helper function to create environment input block
function createEnvBlock(key, urls) {
  const div = document.createElement("div");
  div.className = "env-block";
  div.innerHTML = `
    <h3>${key.toUpperCase()}</h3>
    <label>Author URL</label>
    <input type="url" name="${key}-author" value="${urls.author}" placeholder="https://${key}-author.example.com">
    <label>Publish URL</label>
    <input type="url" name="${key}-publish" value="${urls.publish}" placeholder="https://${key}.example.com">
    ${!["localhost", "dev", "qa", "stage", "prod"].includes(key)
      ? `<button type="button" class="removeEnvBtn" data-env="${key}">Remove</button>`
      : ""}
  `;
  return div;
}

// Render environment inputs dynamically
function renderInputs(envs) {
  const container = document.getElementById("envInputs");
  container.innerHTML = "";

  // First render ordered environments
  for (const key of envOrder) {
    const urls = envs[key];
    if (!urls) continue;
    container.appendChild(createEnvBlock(key, urls));
  }
  
  // Then render any custom environments (not in envOrder)
  for (const [key, urls] of Object.entries(envs)) {
    if (envOrder.includes(key)) continue; // Skip already rendered
    container.appendChild(createEnvBlock(key, urls));
  }

  // Attach remove listeners
  document.querySelectorAll(".removeEnvBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const env = e.target.dataset.env;
      delete envs[env];
      renderInputs(envs);
    });
  });
}

// Load stored settings
async function loadSettings() {
  const { envs } = await chrome.storage.sync.get("envs");
  renderInputs(envs || defaultConfig);
}

// Save settings
document.getElementById("envForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const inputs = e.target.querySelectorAll("input");
  const envs = {};

  for (const input of inputs) {
    const [env, type] = input.name.split("-");
    envs[env] = envs[env] || {};
    // Remove trailing slash from URL if present
    envs[env][type] = input.value.replace(/\/$/, "");
  }

  await chrome.storage.sync.set({ envs });
  alert("Environments saved!");
});

// Export configuration to JSON file
document.getElementById("exportBtn").addEventListener("click", async () => {
  const { envs } = await chrome.storage.sync.get("envs");
  const config = envs || defaultConfig;
  
  const dataStr = JSON.stringify(config, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `aem-env-config-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  alert("Configuration exported!");
});

// Import configuration from JSON file
document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const config = JSON.parse(text);
    
    // Validate that the imported config has the expected structure
    if (typeof config !== "object" || config === null) {
      throw new Error("Invalid configuration format");
    }
    
    // Validate each environment has author and publish properties
    for (const [env, urls] of Object.entries(config)) {
      if (!urls.hasOwnProperty("author") || !urls.hasOwnProperty("publish")) {
        throw new Error(`Environment "${env}" is missing required properties`);
      }
    }
    
    // Save to storage and re-render
    await chrome.storage.sync.set({ envs: config });
    renderInputs(config);
    alert("Configuration imported successfully!");
  } catch (error) {
    alert(`Failed to import configuration: ${error.message}`);
  }
  
  // Reset file input
  e.target.value = "";
});

// Add custom environment
document.getElementById("addEnvBtn").addEventListener("click", async () => {
  const { envs } = await chrome.storage.sync.get("envs");
  const config = envs || defaultConfig;
  const newEnv = prompt("Enter a new environment name (e.g. 'sandbox' or 'demo'):");
  if (newEnv && !config[newEnv]) {
    config[newEnv] = { author: "", publish: "" };
    renderInputs(config);
  }
});

loadSettings();
