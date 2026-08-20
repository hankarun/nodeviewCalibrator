const { app, BrowserWindow, Menu, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { buildMenu } = require('./menu');
const store = require('./store');

const APP_TITLE = 'Node View Calibrator';

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow;

// Last UI state reported by the renderer. Drives menu checkmarks, the window
// title and the unsaved-changes prompt on close.
let uiState = {
  cameraMode: 'orbit',
  activePanel: 'tab-display-settings',
  hasSelection: false,
  autoUpdate: true,
  fileName: 'Untitled',
  filePath: null,
  hasUnsavedChanges: false
};

// Set once the user has agreed to discard or has saved their changes, so the
// second pass through the 'close' handler is allowed through.
let allowClose = false;

/**
 * Forward a menu command to the renderer.
 * @param {string} command - Command identifier handled by renderer-core
 * @param {*} [payload] - Optional command argument
 */
function sendCommand(command, payload) {
  if (command === 'refresh-menu') {
    refreshMenu();
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu-command', command, payload);
  }
}

/** Rebuild and install the application menu from the current UI state. */
function refreshMenu() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  Menu.setApplicationMenu(buildMenu({ window: mainWindow, state: uiState, send: sendCommand }));
}

/**
 * Update the window title to the conventional "document — application" form,
 * with a leading asterisk while there are unsaved changes.
 */
function refreshTitle() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const marker = uiState.hasUnsavedChanges ? '*' : '';
  mainWindow.setTitle(`${marker}${uiState.fileName} - ${APP_TITLE}`);
  // macOS shows the dirty state as a dot in the close button instead.
  if (process.platform === 'darwin') {
    mainWindow.setDocumentEdited(uiState.hasUnsavedChanges);
  }
  if (uiState.filePath) {
    mainWindow.setRepresentedFilename(uiState.filePath);
  }
}

/** Persist the window geometry so the next launch reopens the same way. */
function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
  store.set('windowMaximized', mainWindow.isMaximized());
  if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

/**
 * Size a first-run window to a comfortable fraction of the primary monitor's
 * work area. A fixed default overflows small or high-DPI screens, which makes
 * Windows maximize the window on launch.
 * @returns {{width: number, height: number}} Default window size
 */
function defaultBounds() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    width: Math.max(900, Math.round(width * 0.85)),
    height: Math.max(600, Math.round(height * 0.85))
  };
}

/**
 * Drop a stored x/y that no longer lands on a connected monitor, so the window
 * can't come back off-screen after a display change.
 * @param {Object} bounds - Stored window bounds
 * @returns {Object} Bounds safe to hand to BrowserWindow
 */
function sanitizeBounds(bounds) {
  if (!bounds) return defaultBounds();
  if (bounds.x == null || bounds.y == null) return bounds;
  const onScreen = screen.getAllDisplays().some(({ workArea }) =>
    bounds.x < workArea.x + workArea.width &&
    bounds.x + (bounds.width || 0) > workArea.x &&
    bounds.y < workArea.y + workArea.height &&
    bounds.y + (bounds.height || 0) > workArea.y
  );
  if (onScreen) return bounds;
  const { x, y, ...rest } = bounds;
  return rest;
}

function createWindow() {
  const bounds = sanitizeBounds(store.get('windowBounds'));

  // Create the browser window
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    title: `${APP_TITLE}`,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (store.get('windowMaximized')) mainWindow.maximize();

  refreshMenu();

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Avoid the white flash while the 3D viewport initializes
  mainWindow.once('ready-to-show', () => {
    refreshTitle();
    mainWindow.show();
  });

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('close', handleWindowClose);

  // Emitted when the window is closed
  mainWindow.on('closed', function() {
    // Dereference the window object
    mainWindow = null;
  });
}

/**
 * Prompt before discarding unsaved work, the way a document-based desktop app
 * does. "Save" round-trips to the renderer, which reports back through the
 * 'close-after-save' channel.
 * @param {Electron.Event} event - The close event
 */
function handleWindowClose(event) {
  if (allowClose || !uiState.hasUnsavedChanges) {
    saveWindowState();
    return;
  }

  event.preventDefault();

  const SAVE = 0, DONT_SAVE = 1, CANCEL = 2;
  const response = dialog.showMessageBoxSync(mainWindow, {
    type: 'warning',
    title: APP_TITLE,
    message: `Do you want to save the changes you made to ${uiState.fileName}?`,
    detail: 'Your changes will be lost if you don\'t save them.',
    buttons: ['Save', 'Don\'t Save', 'Cancel'],
    defaultId: SAVE,
    cancelId: CANCEL,
    noLink: true
  });

  if (response === CANCEL) return;

  if (response === DONT_SAVE) {
    allowClose = true;
    mainWindow.close();
    return;
  }

  // The renderer owns the config data, so saving has to round-trip; it replies
  // on 'close-after-save' and the window closes then.
  mainWindow.webContents.send('menu-command', 'save-and-close');
}

// Create window when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', function() {
  // On macOS applications keep their menu bar active until the user quits explicitly
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function() {
  // On macOS it's common to re-create a window when the dock icon is clicked
  if (mainWindow === null) createWindow();
});

// --- Menu / window chrome IPC ---

ipcMain.on('ui-state-changed', (event, state) => {
  const previousPath = uiState.filePath;
  const menuAffecting = ['cameraMode', 'activePanel', 'hasSelection', 'autoUpdate'];
  const menuChanged = menuAffecting.some(key => key in state && state[key] !== uiState[key]);

  uiState = { ...uiState, ...state };

  if (uiState.filePath && uiState.filePath !== previousPath) {
    store.addRecentFile(uiState.filePath);
    app.addRecentDocument(uiState.filePath);
    refreshMenu();
  } else if (menuChanged) {
    refreshMenu();
  }

  refreshTitle();
});

ipcMain.on('close-after-save', (event, saved) => {
  if (!saved) return;
  allowClose = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: options.type || 'info',
    title: options.title || APP_TITLE,
    message: options.message || '',
    detail: options.detail,
    buttons: options.buttons || ['OK'],
    defaultId: options.defaultId ?? 0,
    cancelId: options.cancelId ?? (options.buttons ? options.buttons.length - 1 : 0),
    noLink: true
  });
  return result.response;
});

// IPC handlers for file operations
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Configuration Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('save-file-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'display-config.json',
    filters: [
      { name: 'Configuration Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('open-fbx-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'FBX Models', extensions: ['fbx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
});

ipcMain.handle('read-file-binary', async (event, filePath) => {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('write-file-binary', async (event, filePath, data) => {
  try {
    await fs.writeFile(filePath, Buffer.from(data));
    return true;
  } catch (error) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
});
