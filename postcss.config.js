// postcss.config.js
// PostCSS runs as part of the build step (npm run build).
// Plugins in order:
//   1. postcss-import  — resolves @import statements at build time,
//                        producing a single inlined CSS string
//   2. cssnano         — minifies the combined output (prod only)
//
// cssnano preset "default" safely:
//   - collapses whitespace
//   - deduplicates rules
//   - shortens color values
//   - merges identical @media blocks
//   - removes comments
//   It does NOT rewrite custom properties or touch calc() values.

import postcssImport from "postcss-import";
import cssnano from "cssnano";

const isWatch = process.argv.includes("--watch");

export default {
  plugins: [
    postcssImport(),
    // Skip minification in watch mode for readable output during development
    ...(!isWatch ? [cssnano({ preset: "default" })] : []),
  ],
};
