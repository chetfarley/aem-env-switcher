# AEM Environment Switcher - Copilot Instructions

## Project Overview
This is a Chrome Extension (Manifest V3) for AEM developers that enables quick environment switching between Author, Publish, and Preview modes across multiple environments (localhost, dev, qa, stage, prod).

## Architecture & Core Components

### Extension Structure
- **`manifest.json`**: Manifest V3 config with permissions for `tabs` and `storage`
- **`popup.html/js`**: Main UI that appears when clicking the extension icon
- **`options.html/js`**: Settings page for configuring environment URLs
- **`style.css`**: Dark theme with CSS custom properties for consistent styling

### Key Data Flow
1. **Storage**: Environment configs stored in `chrome.storage.sync` with structure:
   ```javascript
   {
     envs: {
       localhost: { author: "http://localhost:4502", publish: "http://localhost:3000" },
       dev: { author: "...", publish: "..." }
     }
   }
   ```

2. **URL Detection**: `extractAemPath()` extracts content paths from AEM URLs using regex patterns like `/content/[^?#]*?\.html`

3. **URL Transformation**: `transformUrl()` handles environment switching logic:
   - Detects current context (author/publish/preview) 
   - Localhost uses direct `/editor.html` paths
   - Non-localhost uses `/ui#/aem/editor.html` structure
   - Preview mode adds `?wcmmode=disabled` parameter

## AEM-Specific Patterns

### URL Structure Recognition
- **Author URLs**: Contain `editor.html` (editing mode)
- **Preview URLs**: Contain `wcmmode=disabled` (preview mode)  
- **Publish URLs**: Neither of the above (published content)

### Environment Detection
The extension identifies current environment by matching URL prefixes against stored `author`/`publish` base URLs in the config.

### Content Path Extraction
Uses regex `/\/content\/[^\?#]+\.html/` to extract AEM content paths that are preserved across environment switches.

## Development Patterns

### Chrome Extension APIs
- `chrome.tabs.query()` for current tab detection
- `chrome.tabs.create()` for opening new tabs (not replacing current)
- `chrome.storage.sync` for cross-device environment persistence
- `chrome.runtime.openOptionsPage()` for settings access

### DOM Manipulation
- `clear()` utility removes all child elements safely
- Dynamic rendering with `renderInputs()` and `renderLinks()`
- Event delegation for dynamically created elements

### Configuration Management
- `defaultConfig` provides fallback environment structure
- Custom environments can be added/removed through options page
- Environment display order controlled by `envOrder` array

## Testing & Development

### Local Development
- Load unpacked extension in Chrome developer mode
- Test with localhost AEM instances on ports 4502 (author) and 3000/4503 (publish)
- Use `alert()` for user feedback in options page

### Key Test Scenarios
- URL transformation between different AEM modes
- Environment switching from various starting contexts
- Custom environment addition/removal
- Settings persistence across browser sessions

## Code Conventions

### Error Handling
- Try-catch blocks in URL parsing (`extractAemPath`)
- Null checks for tab queries and URL operations
- Graceful fallbacks for missing configuration

### State Management
- No global state - loads from storage on each operation
- Immutable config updates through object spreading
- Event-driven UI updates

### Styling Approach
- CSS custom properties for theming consistency
- `rlh` units for responsive layout scaling
- Dark theme optimized for developer use
- Utility classes like `.popup`, `.small`, `.active`

## File Dependencies
- `popup.js` depends on stored environment config from `options.js`
- All HTML files reference `style.css` for consistent theming
- Extension permissions in `manifest.json` enable core functionality