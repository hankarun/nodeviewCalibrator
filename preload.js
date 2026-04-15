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
  openBundleFile: () => ipcRenderer.invoke('open-bundle-dialog'),
  saveBundleFile: () => ipcRenderer.invoke('save-bundle-dialog')
});
