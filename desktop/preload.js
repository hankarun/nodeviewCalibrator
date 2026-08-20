const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file-dialog'),
  saveFile: () => ipcRenderer.invoke('save-file-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  openFbxFile: () => ipcRenderer.invoke('open-fbx-dialog'),
  readFileBinary: (filePath) => ipcRenderer.invoke('read-file-binary', filePath),
  writeFileBinary: (filePath, data) => ipcRenderer.invoke('write-file-binary', filePath, data),

  // --- Native window chrome ---

  /**
   * Subscribe to commands issued from the application menu.
   * @param {(command: string, payload?: *) => void} handler
   */
  onMenuCommand: (handler) => {
    ipcRenderer.on('menu-command', (_event, command, payload) => handler(command, payload));
  },

  /**
   * Report renderer state that the menu bar, window title and close prompt
   * depend on. Only the changed keys need to be sent.
   * @param {Object} state - Partial UI state
   */
  setUiState: (state) => ipcRenderer.send('ui-state-changed', state),

  /**
   * Answer the main process after a save triggered by the close prompt.
   * @param {boolean} saved - Whether the configuration was written
   */
  closeAfterSave: (saved) => ipcRenderer.send('close-after-save', saved),

  /**
   * Show a native modal message box.
   * @param {Object} options - type/title/message/detail/buttons
   * @returns {Promise<number>} Index of the clicked button
   */
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options)
});
