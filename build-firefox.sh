#!/usr/bin/env bash
# build-firefox.sh
#
# Assembles the Firefox extension into dist/firefox/ and zips it for submission
# to addons.mozilla.org (AMO) or temporary loading via about:debugging.
#
# Usage:
#   chmod +x build-firefox.sh
#   ./build-firefox.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist/firefox"

echo "Cleaning $DIST..."
rm -rf "$DIST"
mkdir -p "$DIST"

echo "Copying shared files..."
cp "$ROOT/style.css"      "$DIST/"
cp "$ROOT/background.js"  "$DIST/"
cp "$ROOT/popup.js"       "$DIST/"
# Bundled JS (built by: npm run build)
cp "$ROOT/swc-bundle.js"  "$DIST/"
cp "$ROOT/sidepanel.js"   "$DIST/"

# Copy icons from src/img/ (flatten to dist root)
[ -f "$ROOT/src/img/icon-light-16.png" ] && cp "$ROOT/src/img/icon-light-16.png" "$DIST/icon-light-16.png"
[ -f "$ROOT/src/img/icon-dark-16.png" ] && cp "$ROOT/src/img/icon-dark-16.png" "$DIST/icon-dark-16.png"
[ -f "$ROOT/src/img/icon-light-48.png" ] && cp "$ROOT/src/img/icon-light-48.png" "$DIST/icon-light-48.png"
[ -f "$ROOT/src/img/icon-dark-48.png" ] && cp "$ROOT/src/img/icon-dark-48.png" "$DIST/icon-dark-48.png"
[ -f "$ROOT/src/img/icon-light-128.png" ] && cp "$ROOT/src/img/icon-light-128.png" "$DIST/icon-light-128.png"
[ -f "$ROOT/src/img/icon-dark-128.png" ] && cp "$ROOT/src/img/icon-dark-128.png" "$DIST/icon-dark-128.png"
[ -f "$ROOT/icon.png" ] && cp "$ROOT/icon.png" "$DIST/"

echo "Copying Firefox-specific files..."
cp "$ROOT/firefox/manifest.json"    "$DIST/manifest.json"
cp "$ROOT/firefox/browser-compat.js" "$DIST/"

echo "Generating HTML files (injecting browser-compat.js shim into root HTML files)..."

# Inject <script src="browser-compat.js"></script> before the first <script> tag
# so the shim remaps `chrome` before any extension JS runs.
awk '
  !done && /<script/ {
    print "  <script src=\"browser-compat.js\"><\/script>";
    done = 1
  }
  { print }
' "$ROOT/popup.html" > "$DIST/popup.html"

awk '
  !done && /<script/ {
    print "  <script src=\"browser-compat.js\"><\/script>";
    done = 1
  }
  { print }
' "$ROOT/sidepanel.html" > "$DIST/sidepanel.html"

echo "Creating zip archive..."
ZIP="$ROOT/dist/aem-env-switcher-firefox.zip"
rm -f "$ZIP"
cd "$DIST" && zip -r "$ZIP" . && cd "$ROOT"

echo ""
echo "Done! Firefox extension built at:"
echo "  Unpacked : $DIST"
echo "  Zip      : $ZIP"
echo ""
echo "To test in Firefox:"
echo "  1. Open about:debugging in Firefox"
echo "  2. Click 'This Firefox' -> 'Load Temporary Add-on...'"
echo "  3. Select $DIST/manifest.json  (or the zip file)"
