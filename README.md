# AEM Environment Switcher

An extension for AEM developers and authors to quickly switch between Author, Preview, and Publish modes across multiple environments.

## Description

AEM Environment Switcher streamlines dev workflow by simplifying navigation between different AEM environments and contexts. Whether you're testing content on localhost, validating changes in QA, or comparing behavior across Author and Publish instances, this extension eliminates the manual URL manipulation typically required.

**Current Features:**
- **One-Click Environment Switching**: Jump between localhost, dev, qa, stage, and production environments while preserving your current content path
- **Custom Environments**: Add and configure your own environment URLs through the settings page
- **Data Security**:  All Environment configurations are only stored in the local system and aren't uploaded to any server.

## Usage

### Switching Environments
1. Navigate to any AEM page (Author, Publish, or Preview)
2. Click the extension icon in your Chrome toolbar
3. The popup displays available environments and modes:
   - **Author**: Opens the page in editing mode
   - **Preview**: Opens the page in preview mode (author instance with `wcmmode=disabled`)
   - **Publish**: Opens the page on the publish instance
4. Click any environment/mode combination to open that URL in a new tab

### Configuring Environments
1. Right-click the extension icon and select "Options" (or click "Settings" in the popup)
2. Configure your environment URLs:
   - **Author URL**: The base URL for your AEM author instance (e.g., `http://localhost:4502`)
   - **Publish URL**: The base URL for your publish instance (e.g., `http://localhost:4503`)
3. Add custom environments using the "Add Environment" button
4. Remove environments using the "Remove" button next to each environment
5. Click "Save" to persist your changes

## Future Enhancements

### Possible Features
- **Import/Export environment configs:** for easy sharing among teams
- **Dark/Light modes:** or custom themes by user
- **Keyboard Shortcuts:** Assign hotkeys for switching to frequently used environments
- **URL History**: View and revisit your environment switching history

### Bugs & Improvements
- **Can't navigate from prod publish** Need to add URL transform support for prod masked dispatcher URLs
- **Move settings page into modal:** for easier configuration & UX 
- **Support for AEM Utilities:** Env switching between Sites, DAM, CRX, etc.
- **New tab/same tab:** Remove open in new tab by default, except for publish view

### Contributing
Contributions are welcome! Feel free to open issues for bug reports or feature requests, and submit pull requests for improvements.
