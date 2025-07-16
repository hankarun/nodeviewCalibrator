# Unified File Operations Interface

The Node View Calibrator now features a unified file operations interface that seamlessly works in both Electron desktop and web browser environments. This interface automatically detects the runtime environment and provides appropriate file handling capabilities.

## Features

### 🔄 Automatic Environment Detection
- Automatically detects whether running in Electron or web browser
- Provides appropriate file operations for each environment
- Seamless user experience across platforms

### 💾 Unified File Operations
- **New Configuration**: Create empty configuration
- **Open File**: Load configuration from file (native dialog in Electron, file picker in web)
- **Save**: Save to current file or download in web
- **Save As**: Save with new filename or download with timestamp in web

### 📊 Status Bar
- Shows current file name and save status
- Displays environment (Desktop/Web)
- Indicates unsaved changes with visual markers
- Shows display count and other status information

### ⚡ Smart Change Tracking
- Automatically tracks unsaved changes
- Prompts user before discarding unsaved work
- Visual indicators for modified state

## Architecture

### Core Components

#### `fileInterface.js`
The main unified interface that handles all file operations:

```javascript
import { getFileInterface } from './fileInterface.js';

// Get the interface instance
const fileInterface = await getFileInterface();

// Use unified operations
const result = await fileInterface.openFile();
await fileInterface.saveFile(displays, false); // false = save, true = save as
```

#### `statusBar.js`
Provides visual feedback about the application state:

```javascript
import { StatusBar } from './statusBar.js';

// Create status bar
const statusBar = new StatusBar(fileInterface);

// Update display count
statusBar.updateDisplayCount(displays.length);

// Show temporary message
statusBar.showMessage('Configuration saved!', 3000);
```

### Environment Detection

The interface automatically detects the runtime environment:

```javascript
// Check if running in Electron
const isElectron = fileInterface.detectElectron();

// Get environment info
const envInfo = fileInterface.getEnvironmentInfo();
console.log(envInfo.platform); // 'desktop' or 'web'
```

## Usage Examples

### Basic File Operations

```javascript
// Create new configuration
const newConfig = fileInterface.createNew();

// Open file
try {
  const result = await fileInterface.openFile();
  if (!result.canceled) {
    displays.length = 0;
    displays.push(...result.config.displays);
  }
} catch (error) {
  console.error('Error opening file:', error);
}

// Save file
try {
  await fileInterface.saveFile(displays, false); // Regular save
  await fileInterface.saveFile(displays, true);  // Save As
} catch (error) {
  console.error('Error saving file:', error);
}
```

### Change Tracking

```javascript
// Mark as having unsaved changes
fileInterface.markUnsaved();

// Check for unsaved changes
if (fileInterface.hasUnsaved()) {
  console.log('There are unsaved changes');
}

// Confirm before discarding changes
if (fileInterface.confirmUnsavedChanges('create new configuration')) {
  // Proceed with action
}
```

### Status Updates

```javascript
// Update display count in status bar
statusBar.updateDisplayCount(displays.length);

// Show success message
statusBar.showMessage('Display added successfully!');

// Get current file name
const fileName = fileInterface.getCurrentFileName();
```

## Environment-Specific Behaviors

### Desktop (Electron) Environment

**File Operations:**
- Native file dialogs (Open/Save)
- Direct file system access
- Traditional file paths
- System notifications

**Features:**
- Full file system integration
- Native look and feel
- Desktop shortcuts and associations
- System tray integration (if implemented)

### Web Browser Environment

**File Operations:**
- HTML5 file input for opening
- Automatic file downloads for saving
- Browser-based notifications
- Local storage for preferences

**Features:**
- No installation required
- Cross-platform compatibility
- Mobile device support
- Automatic updates
- Easy sharing via URL

## Integration Guide

### For Existing Components

Replace old file operation imports:

```javascript
// OLD
import { openConfigFile, saveConfig, saveConfigAs } from './fileOperations.js';

// NEW
import { getFileInterface, openConfigFile, saveConfig, saveConfigAs } from './fileInterface.js';
```

### Adding to New Components

```javascript
import { getFileInterface } from './fileInterface.js';
import { StatusBar } from './statusBar.js';

// Initialize in your component
async function initializeFileInterface() {
  const fileInterface = await getFileInterface();
  const statusBar = new StatusBar(fileInterface);
  
  // Use the interface
  document.getElementById('openBtn').addEventListener('click', async () => {
    const result = await fileInterface.openFile();
    // Handle result...
  });
}
```

## Configuration Format

Both environments use the same JSON configuration format:

```json
{
  "version": "1.0",
  "timestamp": "2025-07-16T12:34:56.789Z",
  "displays": [
    {
      "width": 0.5,
      "height": 0.3,
      "distance": 0.7,
      "yaw": 0,
      "pitch": 0,
      "roll": 0,
      "x": 0,
      "y": 0,
      "z": 0.7
    }
  ]
}
```

## Error Handling

The interface provides consistent error handling across environments:

```javascript
try {
  await fileInterface.saveFile(displays);
} catch (error) {
  // Error is automatically displayed to user
  // You can also handle it specifically
  console.error('Save failed:', error.message);
}
```

## Best Practices

### 1. Always Use the Unified Interface
```javascript
// ✅ Good
const fileInterface = await getFileInterface();
await fileInterface.saveFile(displays);

// ❌ Avoid direct environment-specific calls
if (isElectron()) {
  await electronAPI.writeFile(...);
} else {
  downloadFile(...);
}
```

### 2. Track Changes Properly
```javascript
// Mark unsaved changes when modifying data
function addDisplay(display) {
  displays.push(display);
  fileInterface.markUnsaved();
  statusBar.updateDisplayCount(displays.length);
}
```

### 3. Confirm Before Destructive Actions
```javascript
function createNew() {
  if (fileInterface.confirmUnsavedChanges('create a new configuration')) {
    // Proceed with creating new configuration
  }
}
```

### 4. Provide Visual Feedback
```javascript
// Use status bar for important updates
statusBar.showMessage('Configuration saved successfully!');
statusBar.updateDisplayCount(displays.length);
```

## Troubleshooting

### Common Issues

**File operations not working:**
- Ensure the file interface is properly initialized
- Check browser console for JavaScript errors
- Verify that async/await is used correctly

**Status bar not updating:**
- Make sure to call `statusBar.updateDisplayCount()` after modifying displays
- Check that the file interface is properly passed to the status bar

**Environment detection failing:**
- Verify that the Electron preload script is properly configured
- Check that `window.electronAPI` is available in the Electron environment

### Debugging

Enable debug logging:

```javascript
const fileInterface = await getFileInterface();
console.log('Environment info:', fileInterface.getEnvironmentInfo());
console.log('Current file:', fileInterface.getCurrentFileName());
console.log('Has unsaved changes:', fileInterface.hasUnsaved());
```

## Migration from Legacy Code

### Step 1: Update Imports
Replace old file operation imports with the new unified interface.

### Step 2: Initialize Interface
Add initialization code at the beginning of your main renderer:

```javascript
const fileInterface = await getFileInterface();
const statusBar = new StatusBar(fileInterface);
```

### Step 3: Update Event Handlers
Replace direct API calls with interface methods:

```javascript
// OLD
async function handleSave() {
  if (isElectron()) {
    await window.electronAPI.writeFile(path, content);
  } else {
    downloadFile(content, filename);
  }
}

// NEW
async function handleSave() {
  await fileInterface.saveFile(displays);
}
```

### Step 4: Add Change Tracking
Add `fileInterface.markUnsaved()` calls where data is modified.

### Step 5: Test Both Environments
Verify that the application works correctly in both Electron and web browser environments.

## Future Enhancements

Planned improvements to the unified interface:

- **Auto-save functionality** with configurable intervals
- **Cloud storage integration** for web environment
- **Collaboration features** for shared configurations
- **Version history** and undo/redo capabilities
- **Plugin system** for custom file formats
- **Drag & drop** file support
- **Recent files** menu and quick access
