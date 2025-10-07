const defaultConfig = {
  localhost: { author: "http://localhost:4502", publish: "http://localhost:3000" },
  dev: { author: "", publish: "" },
  qa: { author: "", publish: "" },
  stage: { author: "", publish: "" },
  prod: { author: "", publish: "" },
};

// Render environment inputs dynamically
function renderInputs(envs) {
  const container = document.getElementById("envInputs");
  container.innerHTML = "";

  for (const [key, urls] of Object.entries(envs)) {
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
    container.appendChild(div);
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
    envs[env][type] = input.value;
  }

  await chrome.storage.sync.set({ envs });
  alert("✅ Environments saved!");
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
