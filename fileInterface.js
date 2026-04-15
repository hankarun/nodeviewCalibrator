/**
 * Unified File Operations Interface for Node View Calibrator
 * Automatically detects environment (Electron vs Web) and provides appropriate file operations
 */

/**
 * File operation interface that works in both Electron and web environments
 */
class FileInterface {
  constructor() {
    this.isElectron = this.detectElectron();
    this.currentFilePath = null;
    this.hasUnsavedChanges = false;
    this.init();
  }

  /**
   * Detect if running in Electron environment
   * @returns {boolean} True if running in Electron
   */
  detectElectron() {
    return typeof window !== 'undefined' && 
           typeof window.electronAPI !== 'undefined' &&
           typeof window.electronAPI.openFile === 'function';
  }

  /**
   * Initialize the file interface
   */
  async init() {
    if (this.isElectron) {
      console.log('FileInterface: Initialized for Electron environment');
    } else {
      console.log('FileInterface: Initialized for Web environment');
    }
  }

  /**
   * Show notification to user
   * @param {string} message - Message to show
   * @param {string} type - Type of notification (success, error, info)
   */
  showNotification(message, type = 'info') {
    if (this.isElectron) {
      // Use system notifications or simple alert in Electron
      if (type === 'error') {
        alert(`Error: ${message}`);
      } else {
        console.log(`${type.toUpperCase()}: ${message}`);
      }
    } else {
      // Use web notifications
      this.createWebNotification(message, type);
    }
  }

  /**
   * Create web notification
   * @param {string} message - Message to show
   * @param {string} type - Type of notification
   */
  createWebNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  /**
   * Create new configuration
   * @returns {Object} Empty configuration object
   */
  createNew() {
    this.currentFilePath = null;
    this.hasUnsavedChanges = false;
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      displays: []
    };
  }

  /**
   * Open configuration file
   * @returns {Promise<Object>} Configuration data and metadata
   */
  async openFile() {
    try {
      let result;
      
      if (this.isElectron) {
        // Use Electron file dialog
        const dialogResult = await window.electronAPI.openFile();
        
        if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
          return { canceled: true };
        }
        
        const filePath = dialogResult.filePaths[0];
        const content = await window.electronAPI.readFile(filePath);
        const config = JSON.parse(content);
        
        result = {
          canceled: false,
          config,
          filePath,
          fileName: filePath.split(/[\\/]/).pop()
        };
      } else {
        // Use web file input
        result = await this.openFileWeb();
      }
      
      if (!result.canceled) {
        // Validate configuration
        if (!Array.isArray(result.config.displays)) {
          throw new Error('Invalid configuration file format: missing displays array');
        }
        
        this.currentFilePath = result.filePath;
        this.hasUnsavedChanges = false;
        this.showNotification('Configuration loaded successfully!', 'success');
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Error opening file: ${error.message}`;
      this.showNotification(errorMsg, 'error');
      throw new Error(errorMsg);
    }
  }

  /**
   * Open file in web environment
   * @returns {Promise<Object>} File content and metadata
   */
  openFileWeb() {
    return new Promise((resolve) => {
      const fileInput = document.getElementById('fileInput') || this.createFileInput();
      
      const handleFileSelect = (event) => {
        const file = event.target.files[0];
        
        if (!file) {
          resolve({ canceled: true });
          return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            const content = e.target.result;
            const config = JSON.parse(content);
            
            resolve({
              canceled: false,
              config,
              filePath: file.name,
              fileName: file.name,
              file: file
            });
          } catch (error) {
            this.showNotification(`Error parsing file: ${error.message}`, 'error');
            resolve({ canceled: true, error: error.message });
          }
        };
        
        reader.onerror = () => {
          this.showNotification('Error reading file', 'error');
          resolve({ canceled: true, error: 'Error reading file' });
        };
        
        reader.readAsText(file);
        
        // Clean up
        fileInput.removeEventListener('change', handleFileSelect);
        fileInput.value = '';
      };
      
      fileInput.addEventListener('change', handleFileSelect);
      fileInput.click();
    });
  }

  /**
   * Create hidden file input for web environment
   * @returns {HTMLInputElement} File input element
   */
  createFileInput() {
    let fileInput = document.getElementById('fileInput');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'fileInput';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }
    return fileInput;
  }

  /**
   * Save configuration
   * @param {Array} displays - Display configuration array
   * @param {boolean} saveAs - Whether to force "Save As" dialog
   * @returns {Promise<Object>} Save result
   */
  async saveFile(displays, saveAs = false) {
    try {
      const configData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        displays: displays
      };

      let result;
      
      if (this.isElectron) {
        result = await this.saveFileElectron(configData, saveAs);
      } else {
        result = await this.saveFileWeb(configData, saveAs);
      }
      
      if (!result.canceled) {
        this.currentFilePath = result.filePath;
        this.hasUnsavedChanges = false;
        this.showNotification('Configuration saved successfully!', 'success');
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Error saving file: ${error.message}`;
      this.showNotification(errorMsg, 'error');
      throw new Error(errorMsg);
    }
  }

  /**
   * Save file in Electron environment
   * @param {Object} configData - Configuration data to save
   * @param {boolean} saveAs - Whether to show save dialog
   * @returns {Promise<Object>} Save result
   */
  async saveFileElectron(configData, saveAs) {
    if (!saveAs && this.currentFilePath) {
      // Save to existing file
      await window.electronAPI.writeFile(this.currentFilePath, JSON.stringify(configData, null, 2));
      return {
        canceled: false,
        filePath: this.currentFilePath
      };
    } else {
      // Show save dialog
      const dialogResult = await window.electronAPI.saveFile();
      
      if (dialogResult.canceled || !dialogResult.filePath) {
        return { canceled: true };
      }
      
      await window.electronAPI.writeFile(dialogResult.filePath, JSON.stringify(configData, null, 2));
      return {
        canceled: false,
        filePath: dialogResult.filePath
      };
    }
  }

  /**
   * Save file in web environment
   * @param {Object} configData - Configuration data to save
   * @param {boolean} saveAs - Whether to force new filename
   * @returns {Promise<Object>} Save result
   */
  async saveFileWeb(configData, saveAs) {
    const content = JSON.stringify(configData, null, 2);
    let filename;
    
    if (!saveAs && this.currentFilePath && this.currentFilePath !== 'untitled') {
      filename = this.currentFilePath;
    } else {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      filename = `display-config-${timestamp}.json`;
    }
    
    // Download the file
    this.downloadFile(content, filename);
    
    return {
      canceled: false,
      filePath: filename
    };
  }

  /**
   * Download file in web browser
   * @param {string} content - File content
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   */
  downloadFile(content, filename, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Mark configuration as having unsaved changes
   */
  markUnsaved() {
    this.hasUnsavedChanges = true;
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean} True if there are unsaved changes
   */
  hasUnsaved() {
    return this.hasUnsavedChanges;
  }

  /**
   * Get current file name for display
   * @returns {string} Current file name or "Untitled"
   */
  getCurrentFileName() {
    if (!this.currentFilePath) {
      return 'Untitled';
    }
    
    if (this.isElectron) {
      return this.currentFilePath.split(/[\\/]/).pop();
    } else {
      return this.currentFilePath;
    }
  }

  /**
   * Confirm action if there are unsaved changes
   * @param {string} action - Action being performed
   * @returns {boolean} True if should proceed
   */
  confirmUnsavedChanges(action = 'continue') {
    if (this.hasUnsavedChanges) {
      return confirm(`You have unsaved changes. Are you sure you want to ${action}?`);
    }
    return true;
  }

  /**
   * Get environment info
   * @returns {Object} Environment information
   */
  getEnvironmentInfo() {
    return {
      isElectron: this.isElectron,
      platform: this.isElectron ? 'desktop' : 'web',
      currentFile: this.getCurrentFileName(),
      hasUnsavedChanges: this.hasUnsavedChanges
    };
  }

  /**
   * Build a binary bundle buffer containing displays + FBX model data.
   * Format: magic "NVC1" (4 bytes) | JSON length uint32LE | JSON UTF-8 |
   *         for each model: FBX length uint32LE | FBX bytes
   * @param {Array} displays
   * @param {Array} models - from scene.getFBXModelsForExport()
   * @returns {ArrayBuffer}
   */
  _createBundleBuffer(displays, models) {
    const metadata = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      displays,
      models: models.map(m => ({
        name: m.name,
        visible: m.visible,
        x: m.transform.x, y: m.transform.y, z: m.transform.z,
        yaw: m.transform.yaw, pitch: m.transform.pitch, roll: m.transform.roll,
        scale: m.transform.scale,
        renderMode: m.renderMode.mode,
        opacity: m.renderMode.opacity
      }))
    };

    const jsonBytes = new TextEncoder().encode(JSON.stringify(metadata));
    let totalSize = 4 + 4 + jsonBytes.length;
    for (const m of models) {
      totalSize += 4 + (m.fbxBuffer ? m.fbxBuffer.byteLength : 0);
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 0;

    // Magic "NVC1"
    bytes[offset++] = 0x4E; bytes[offset++] = 0x56; bytes[offset++] = 0x43; bytes[offset++] = 0x31;
    view.setUint32(offset, jsonBytes.length, true); offset += 4;
    bytes.set(jsonBytes, offset); offset += jsonBytes.length;

    for (const m of models) {
      const fbxData = m.fbxBuffer ? new Uint8Array(m.fbxBuffer) : new Uint8Array(0);
      view.setUint32(offset, fbxData.length, true); offset += 4;
      if (fbxData.length > 0) { bytes.set(fbxData, offset); offset += fbxData.length; }
    }

    return buffer;
  }

  /**
   * Parse a binary bundle buffer.
   * @param {ArrayBuffer} buffer
   * @returns {{ displays: Array, models: Array }}
   */
  _parseBundleBuffer(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== 'NVC1') throw new Error('Invalid bundle file: bad magic');

    let offset = 4;
    const jsonLength = view.getUint32(offset, true); offset += 4;
    const jsonStr = new TextDecoder().decode(bytes.slice(offset, offset + jsonLength));
    offset += jsonLength;
    const metadata = JSON.parse(jsonStr);

    const models = [];
    for (const modelMeta of (metadata.models || [])) {
      const fbxLength = view.getUint32(offset, true); offset += 4;
      const fbxBuffer = fbxLength > 0 ? buffer.slice(offset, offset + fbxLength) : null;
      offset += fbxLength;
      models.push({ ...modelMeta, fbxBuffer });
    }

    return { displays: metadata.displays || [], models };
  }

  /**
   * Save a scene bundle (.nvcb) containing displays and FBX model data.
   * @param {Array} displays
   * @param {Array} models - from scene.getFBXModelsForExport()
   * @param {boolean} saveAs
   */
  async saveBundle(displays, models, saveAs = false) {
    try {
      const bundleBuffer = this._createBundleBuffer(displays, models);

      if (this.isElectron) {
        let filePath;
        if (!saveAs && this.currentFilePath && this.currentFilePath.endsWith('.nvcb')) {
          filePath = this.currentFilePath;
        } else {
          const dialogResult = await window.electronAPI.saveBundleFile();
          if (dialogResult.canceled || !dialogResult.filePath) return { canceled: true };
          filePath = dialogResult.filePath;
        }
        await window.electronAPI.writeFileBinary(filePath, new Uint8Array(bundleBuffer));
        this.currentFilePath = filePath;
        this.hasUnsavedChanges = false;
        this.showNotification('Bundle saved!', 'success');
        return { canceled: false, filePath };
      } else {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `scene-bundle-${timestamp}.nvcb`;
        const blob = new Blob([bundleBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename; link.style.display = 'none';
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
        this.currentFilePath = filename;
        this.hasUnsavedChanges = false;
        this.showNotification('Bundle saved!', 'success');
        return { canceled: false, filePath: filename };
      }
    } catch (error) {
      const msg = `Error saving bundle: ${error.message}`;
      this.showNotification(msg, 'error');
      throw new Error(msg);
    }
  }

  /**
   * Open a scene bundle (.nvcb) and return displays + model data with FBX buffers.
   * @returns {Promise<{ canceled: boolean, displays?: Array, models?: Array }>}
   */
  async openBundle() {
    try {
      let bundleBuffer, filePath;

      if (this.isElectron) {
        const dialogResult = await window.electronAPI.openBundleFile();
        if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
          return { canceled: true };
        }
        filePath = dialogResult.filePaths[0];
        const uint8arr = await window.electronAPI.readFileBinary(filePath);
        bundleBuffer = uint8arr.buffer.slice(uint8arr.byteOffset, uint8arr.byteOffset + uint8arr.byteLength);
      } else {
        const result = await this._openBundleWeb();
        if (result.canceled) return { canceled: true };
        bundleBuffer = result.buffer;
        filePath = result.fileName;
      }

      const data = this._parseBundleBuffer(bundleBuffer);
      this.currentFilePath = filePath;
      this.hasUnsavedChanges = false;
      this.showNotification('Bundle loaded!', 'success');
      return { canceled: false, ...data, filePath };
    } catch (error) {
      const msg = `Error opening bundle: ${error.message}`;
      this.showNotification(msg, 'error');
      throw new Error(msg);
    }
  }

  _openBundleWeb() {
    return new Promise((resolve) => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.nvcb';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        document.body.removeChild(fileInput);
        if (!file) { resolve({ canceled: true }); return; }
        const buffer = await file.arrayBuffer();
        resolve({ canceled: false, buffer, fileName: file.name });
      });
      fileInput.click();
    });
  }
}

// Create global instance
let fileInterface = null;

/**
 * Get or create the global file interface instance
 * @returns {Promise<FileInterface>} File interface instance
 */
export async function getFileInterface() {
  if (!fileInterface) {
    fileInterface = new FileInterface();
    await fileInterface.init();
  }
  return fileInterface;
}
