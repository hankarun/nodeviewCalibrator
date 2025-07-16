# Node View Calibrator

A powerful display calibration tool that helps you configure multi-display setups with 3D visualization. Available as both an Electron desktop application and a web application.

## Features

- **3D Display Visualization**: View your display setup from top, left, and front perspectives
- **Interactive Configuration**: Drag displays to position them visually
- **Preset Display Sizes**: Quick setup for common display sizes (27", 32", 40", etc.)
- **Real-time Calculations**: See corner coordinates and projections update live
- **Unified File Operations**: Seamless file handling in both desktop and web environments
- **Smart Change Tracking**: Automatic detection and confirmation of unsaved changes
- **Status Bar**: Visual indicators for save status, environment, and configuration state
- **Dual Environment Support**: Works as both desktop and web application with identical functionality

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone or download the project
2. Navigate to the project directory
3. Install dependencies:

```powershell
npm install
```

## Usage

### Desktop Application (Electron)

Run the desktop version:

```powershell
npm start
```

**Features in Desktop Version:**
- Native file dialogs for opening/saving configurations
- Full filesystem access
- Desktop integration

### Web Application

1. Start the web server:

```powershell
npm run start-web
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

**Features in Web Version:**
- Browser-based file operations
- Automatic file downloads for saving
- Responsive design for mobile devices
- No installation required for end users

## How to Use

1. **Add Displays**: Use the preset sizes or enter custom dimensions
2. **Position Displays**: 
   - Enter coordinates manually, or
   - Drag displays in the canvas views (right-click and drag)
3. **View Setup**: Use the three canvas views to see your setup from different angles
4. **Zoom and Pan**: 
   - Use zoom buttons or mouse wheel to zoom
   - Left-click and drag to pan the view
   - Double-click to reset view position
5. **Save Configuration**: Use File > Save to store your setup

## File Operations

### Unified Interface
The application features a smart file operations interface that automatically adapts to the environment:

### Desktop Version
- **New**: Create a new configuration with unsaved changes confirmation
- **Open**: Native file dialog for browsing and opening .json configuration files
- **Save**: Save to the current file path
- **Save As**: Native save dialog with filename selection

### Web Version
- **New**: Create a new configuration with unsaved changes confirmation
- **Open**: HTML5 file picker for selecting .json files from your device
- **Save**: Automatic download of configuration file
- **Save As**: Download with timestamp-based filename

### Smart Features
- **Change Tracking**: Visual indicators for unsaved changes
- **Confirmation Dialogs**: Prevents accidental loss of unsaved work
- **Status Bar**: Shows current file, save status, and environment information
- **Cross-Environment Compatibility**: Same file format works in both versions

## Configuration Format

Configurations are saved as JSON files with the following structure:

```json
{
  "version": "1.0",
  "timestamp": "2025-07-16T...",
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

## Controls

### Canvas Interaction
- **Left Click + Drag**: Pan the view
- **Right Click + Drag**: Move selected display (if any)
- **Mouse Wheel**: Zoom in/out
- **Double Click**: Reset view position
- **Zoom Buttons**: Fine control over zoom level

### Display Management
- **Click on Display**: Select for editing
- **Add Display**: Add new display with current settings
- **Update Display**: Apply changes to selected display
- **Delete Display**: Remove selected display

## Development

### Project Structure

```
nodeViewCalibrator/
├── main.js              # Electron main process
├── preload.js           # Electron preload script
├── index.html           # Desktop app HTML
├── renderer.js          # Desktop app renderer
├── fileInterface.js     # Unified file operations interface
├── statusBar.js         # Status bar component
├── display.js           # Display calculation logic
├── canvasRenderer.js    # Canvas drawing functions
├── fileOperations.js    # Legacy desktop file operations
├── mathutils.js         # Mathematical utilities
├── styles.css           # Shared styles
└── web/                 # Web application
    ├── index.html       # Web app HTML
    ├── web-renderer.js  # Web app renderer
    ├── web-fileOperations.js  # Legacy web file operations
    ├── web-styles.css   # Web-specific styles
    ├── environment.js   # Environment detection (legacy)
    └── server.js        # Express server
```

### Building the Desktop App

To build the desktop application for distribution:

```powershell
# Build for current platform
npm run build

# Package without building installer
npm run pack

# Build Windows installer
npm run dist
```

### Deploying the Web App

The web application can be deployed to any static hosting service:

1. Copy all files except `node_modules` and `dist`
2. Ensure the server serves the `web/index.html` file
3. Configure the server to handle SPA routing

For production deployment, consider:
- Using a proper web server (nginx, Apache)
- Enabling HTTPS
- Configuring appropriate caching headers
- Minifying JavaScript and CSS files

## Browser Compatibility

The web version supports:
- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Modern mobile browsers

## License

ISC License - feel free to use and modify as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test both Electron and web versions
5. Submit a pull request

## Troubleshooting

### Common Issues

**Desktop app won't start:**
- Ensure Node.js is installed
- Run `npm install` to install dependencies
- Check for any error messages in the console

**Web app shows blank page:**
- Check browser console for JavaScript errors
- Ensure the server is running on the correct port
- Try refreshing the page

**File operations not working:**
- Desktop: Check file permissions
- Web: Ensure browser allows file downloads

**Canvas not responsive:**
- Try refreshing the page
- Check if browser supports HTML5 Canvas
- Ensure JavaScript is enabled
