const defaultConfig = {
    dev: { author: "", publish: "" },
    qa: { author: "", publish: "" },
    stage: { author: "", publish: "" },
    prod: { author: "", publish: "" },
  };
  
  function renderInputs(envs) {
    const container = document.getElementById("envInputs");
    container.innerHTML = "";
    for (const [key, urls] of Object.entries(envs)) {
      const div = document.createElement("div");
      div.className = "env-block";
      div.innerHTML = `
        <h3>${key.toUpperCase()}</h3>
        <label>Author</label>
        <input type="url" name="${key}-author" value="${urls.author}" placeholder="https://${key}-author.example.com">
        <label>Publish</label>
        <input type="url" name="${key}-publish" value="${urls.publish}" placeholder="https://${key}.example.com">
      `;
      container.appendChild(div);
    }
  }
  
  async function loadSettings() {
    const { envs } = await chrome.storage.sync.get("envs");
    renderInputs(envs || defaultConfig);
  }
  
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
    alert("Saved!");
  });
  
  loadSettings();
  