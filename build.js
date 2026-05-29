// build.js — builds the Spectrum Web Components JS bundle, CSS stylesheet, and dist packages.
//
// JS pipeline  (esbuild):
//   src/swc-imports.js  →  swc-bundle.js
//
// CSS pipeline (PostCSS):
//   src/css/main.css   →  style.css
//
// Package step (Node fs + archiver):
//   dist/chrome/       →  dist/aem-env-switcher-chrome.zip
//   dist/firefox/      →  built by build-firefox.sh (unchanged)
//
// Scripts:
//   npm run build          → full production build + package
//   npm run watch          → rebuild JS + CSS on file changes (no packaging)
//   npm run package        → package only (skips JS/CSS rebuild)

import * as esbuild   from "esbuild";
import postcss        from "postcss";
import postcssImport  from "postcss-import";
import cssnano        from "cssnano";
import fs             from "node:fs";
import path           from "node:path";
import { execSync }   from "node:child_process";

const watch   = process.argv.includes("--watch");
const pkgOnly = process.argv.includes("--package-only");

const __dir  = path.dirname(new URL(import.meta.url).pathname);
const cssIn  = path.join(__dir, "src/css/main.css");
const cssOut = path.join(__dir, "style.css");

// ── CSS build ────────────────────────────────────────────────────────────────

const cssPlugins = [
  postcssImport(),
  ...(!watch ? [cssnano({ preset: "default" })] : []),
];

async function buildCSS() {
  const input  = fs.readFileSync(cssIn, "utf8");
  const result = await postcss(cssPlugins).process(input, {
    from: cssIn,
    to:   cssOut,
    map:  watch ? { inline: true } : false,
  });
  fs.writeFileSync(cssOut, result.css);
  if (result.map) fs.writeFileSync(cssOut + ".map", result.map.toString());
  console.log(`[css]  built → style.css${watch ? " (dev, unminified)" : ""}`);
}

// ── JS build (esbuild) ───────────────────────────────────────────────────────

const esbuildCtx = await esbuild.context({
  // Object form lets us control output filenames independently of source paths.
  entryPoints: {
    "swc-bundle": "src/swc-imports.js", // → swc-bundle.js
    "sidepanel":  "src/sidepanel.js",   // → sidepanel.js
  },
  bundle:    true,
  outdir:    ".",
  format:    "esm",
  minify:    !watch,
  sourcemap: watch ? "inline" : false,
  logLevel:  "silent",
});

// ── Chrome package ───────────────────────────────────────────────────────────

// Files copied verbatim into dist/chrome/
// Add any new extension files here as the project grows.
const CHROME_FILES = [
  "manifest.json",
  "background.js",
  "popup.html",
  "popup.js",
  "sidepanel.html",
  "sidepanel.js",   // built from src/sidepanel.js by esbuild
  "style.css",
  "swc-bundle.js",  // built from src/swc-imports.js by esbuild
  "icon.png",       // skipped silently if absent
];

// Icon files: sourced from src/img/, flattened to dist/chrome/ root
const ICON_FILES = [
  { src: "src/img/icon-light-16.png", dest: "icon-light-16.png" },
  { src: "src/img/icon-dark-16.png", dest: "icon-dark-16.png" },
  { src: "src/img/icon-light-48.png", dest: "icon-light-48.png" },
  { src: "src/img/icon-dark-48.png", dest: "icon-dark-48.png" },
  { src: "src/img/icon-light-128.png", dest: "icon-light-128.png" },
  { src: "src/img/icon-dark-128.png", dest: "icon-dark-128.png" },
];

async function packageChrome() {
  const distDir = path.join(__dir, "dist/chrome");
  const zipPath = path.join(__dir, "dist/aem-env-switcher-chrome.zip");

  // Clean and recreate dist/chrome/
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  // Copy each file (skip missing optional files like icon.png)
  for (const file of CHROME_FILES) {
    const src = path.join(__dir, file);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(distDir, file));
  }

  // Copy icons from src/img/ (flatten to dist/chrome/ root)
  for (const icon of ICON_FILES) {
    const srcPath = path.join(__dir, icon.src);
    if (!fs.existsSync(srcPath)) continue;
    fs.copyFileSync(srcPath, path.join(distDir, icon.dest));
  }

  // Zip using the system zip command (same approach as build-firefox.sh)
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: "pipe" });

  const size = (fs.statSync(zipPath).size / 1024).toFixed(1);
  console.log(`[pkg]  chrome → dist/chrome/  +  dist/aem-env-switcher-chrome.zip  (${size} KB)`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

if (pkgOnly) {
  await packageChrome();

} else if (watch) {
  // Initial build (no packaging in watch mode)
  await Promise.all([buildCSS(), esbuildCtx.watch()]);
  console.log("[js]   watching src/swc-imports.js…");

  const watcher = fs.watch(
    path.join(__dir, "src/css"),
    { recursive: true },
    async (_, filename) => {
      if (filename?.endsWith(".css")) {
        try { await buildCSS(); }
        catch (e) { console.error("[css] error:", e.message); }
      }
    }
  );

  console.log("Watching src/css/** and src/md-imports.js — Ctrl-C to stop.");

  process.on("SIGINT", async () => {
    watcher.close();
    await esbuildCtx.dispose();
    process.exit(0);
  });

} else {
  // Full production build + package
  await Promise.all([buildCSS(), esbuildCtx.rebuild()]);
  await esbuildCtx.dispose();
  await packageChrome();
}

