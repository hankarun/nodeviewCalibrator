// Native application menu for the desktop app.
//
// Menu items do not act on the scene directly; they forward a command string
// to the renderer over the 'menu-command' channel, where renderer-core maps it
// onto the same handlers the in-page controls use. The menu is rebuilt whenever
// the renderer reports new state so that checkmarks and enabled/disabled items
// stay in sync with the window.

const { app, Menu, dialog, shell } = require('electron');
const path = require('path');
const store = require('./store');

const isMac = process.platform === 'darwin';

/**
 * Build the File > Open Recent submenu from the persisted recent-files list.
 * @param {(command: string, payload?: *) => void} send - Command dispatcher
 * @returns {Electron.MenuItemConstructorOptions[]} Submenu items
 */
function buildRecentFilesSubmenu(send) {
  const recentFiles = store.pruneRecentFiles();

  if (recentFiles.length === 0) {
    return [{ label: 'No Recent Files', enabled: false }];
  }

  return [
    ...recentFiles.map((filePath, index) => ({
      // Numbered the way most desktop apps number their recent documents.
      label: `${index + 1}. ${path.basename(filePath)}`,
      toolTip: filePath,
      click: () => send('open-recent', filePath)
    })),
    { type: 'separator' },
    {
      label: 'Clear Recent Files',
      click: () => {
        store.clearRecentFiles();
        app.clearRecentDocuments();
        send('refresh-menu');
      }
    }
  ];
}

/**
 * Show the modal "About" box.
 * @param {Electron.BrowserWindow} window - Parent window
 */
function showAboutDialog(window) {
  dialog.showMessageBox(window, {
    type: 'info',
    title: 'About Node View Calibrator',
    message: 'Node View Calibrator',
    detail: [
      `Version ${app.getVersion()}`,
      '',
      'A display calibration tool for multi-display setups',
      'with 3D visualization.',
      '',
      `Electron ${process.versions.electron}`,
      `Chromium ${process.versions.chrome}`,
      `Node.js ${process.versions.node}`
    ].join('\n'),
    buttons: ['OK'],
    noLink: true
  });
}

/**
 * Show the modal keyboard-shortcut reference. Covers the viewport bindings
 * handled by the renderer, which have no menu entry of their own.
 * @param {Electron.BrowserWindow} window - Parent window
 */
function showShortcutsDialog(window) {
  const mod = isMac ? 'Cmd' : 'Ctrl';
  dialog.showMessageBox(window, {
    type: 'info',
    title: 'Keyboard Shortcuts',
    message: 'Keyboard Shortcuts',
    detail: [
      'File',
      `  ${mod}+N            New configuration`,
      `  ${mod}+O            Open configuration`,
      `  ${mod}+S            Save`,
      `  ${mod}+Shift+S      Save as`,
      `  ${mod}+I            Load FBX model`,
      '',
      'Displays',
      `  ${mod}+D            Add display (opens the Add Display dialog)`,
      `  ${mod}+U            Update selected display (auto-update off only)`,
      `  ${mod}+Delete       Delete selected display`,
      `  ${mod}+1 / 2 / 3    Display / Model / Eye panel`,
      '  Right-click        Display list menu: add or delete',
      '',
      'Viewport',
      '  F2 / F3            Orbit / first-person camera',
      '  F4                 Reset camera',
      '  Shift+drag         Snap-drag a display',
      '  Ctrl+click         Add a display to the selection'
    ].join('\n'),
    buttons: ['OK'],
    noLink: true
  });
}

/**
 * Build the full application menu.
 * @param {Object} options
 * @param {Electron.BrowserWindow} options.window - Window the menu belongs to
 * @param {Object} options.state - Last UI state reported by the renderer
 * @param {(command: string, payload?: *) => void} options.send - Command dispatcher
 * @returns {Electron.Menu} The application menu
 */
function buildMenu({ window, state, send }) {
  const { cameraMode, activePanel, hasSelection, autoUpdate } = state;

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    // macOS reserves the first menu for the application itself.
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: 'About Node View Calibrator', click: () => showAboutDialog(window) },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: '&File',
      submenu: [
        {
          label: 'New Configuration',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('new-config')
        },
        {
          label: 'Open Configuration...',
          accelerator: 'CmdOrCtrl+O',
          click: () => send('open-config')
        },
        {
          label: 'Open Recent',
          submenu: buildRecentFilesSubmenu(send)
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('save-config')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send('save-config-as')
        },
        { type: 'separator' },
        {
          label: 'Load FBX...',
          accelerator: 'CmdOrCtrl+I',
          click: () => send('load-fbx')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '&Display',
      submenu: [
        {
          label: 'Add Display...',
          accelerator: 'CmdOrCtrl+D',
          click: () => send('add-display')
        },
        {
          label: 'Auto-update Display',
          type: 'checkbox',
          checked: autoUpdate !== false,
          click: (menuItem) => send('toggle-auto-update', menuItem.checked)
        },
        {
          // Redundant while auto-update is on, since edits are applied as the
          // user makes them.
          label: 'Update Selected Display',
          accelerator: 'CmdOrCtrl+U',
          enabled: hasSelection && autoUpdate === false,
          click: () => send('update-display')
        },
        {
          label: 'Delete Selected Display',
          // Plain Delete would be swallowed before a focused number input
          // could see it, so the modifier is required here.
          accelerator: 'CmdOrCtrl+Delete',
          enabled: hasSelection,
          click: () => send('delete-display')
        },
        { type: 'separator' },
        {
          label: 'Display Settings',
          accelerator: 'CmdOrCtrl+1',
          type: 'radio',
          checked: activePanel === 'tab-display-settings',
          click: () => send('show-panel', 'tab-display-settings')
        },
        {
          label: '3D Model',
          accelerator: 'CmdOrCtrl+2',
          type: 'radio',
          checked: activePanel === 'tab-model',
          click: () => send('show-panel', 'tab-model')
        },
        {
          label: 'Eye Position',
          accelerator: 'CmdOrCtrl+3',
          type: 'radio',
          checked: activePanel === 'tab-eye',
          click: () => send('show-panel', 'tab-eye')
        },
        { type: 'separator' },
        {
          label: 'Reset Eye to Origin',
          click: () => send('reset-eye')
        }
      ]
    },
    {
      label: '&View',
      submenu: [
        {
          label: 'Orbit Camera',
          accelerator: 'F2',
          type: 'radio',
          checked: cameraMode !== 'firstperson',
          click: () => send('camera-mode', 'orbit')
        },
        {
          label: 'First-Person Camera',
          accelerator: 'F3',
          type: 'radio',
          checked: cameraMode === 'firstperson',
          click: () => send('camera-mode', 'firstperson')
        },
        {
          label: 'Reset Camera',
          accelerator: 'F4',
          click: () => send('reset-camera')
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          click: () => showShortcutsDialog(window)
        },
        {
          label: 'Project on GitHub',
          click: () => shell.openExternal('https://github.com/hankarun/nodeViewCalibrator')
        },
        ...(isMac ? [] : [
          { type: 'separator' },
          { label: 'About Node View Calibrator', click: () => showAboutDialog(window) }
        ])
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = { buildMenu };
