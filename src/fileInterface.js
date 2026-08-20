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
      this.notifyDocumentState();
    } else {
      console.log('FileInterface: Initialized for Web environment');
    }
  }

  /**
   * Push the current document identity and dirty flag to the main process so
   * the window title, recent-files menu and close prompt stay accurate.
   * No-op outside Electron.
   */
  notifyDocumentState() {
    if (!this.isElectron || typeof window.electronAPI.setUiState !== 'function') return;
    window.electronAPI.setUiState({
      fileName: this.getCurrentFileName(),
      filePath: this.currentFilePath,
      hasUnsavedChanges: this.hasUnsavedChanges
    });
  }

  /**
   * Show notification to user
   * @param {string} message - Message to show
   * @param {string} type - Type of notification (success, error, info)
   */
  showNotification(message, type = 'info') {
    if (this.isElectron) {
      // Errors get a native message box; successes stay in the status bar so
      // routine saves don't interrupt the user with a modal.
      if (type === 'error') {
        window.electronAPI.showMessageBox({
          type: 'error',
          title: 'Node View Calibrator',
          message: 'Something went wrong',
          detail: message
        }).catch(() => alert(`Error: ${message}`));
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
    this.notifyDocumentState();
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      displays: [],
      eye: { x: 0, y: 0, z: 0 }
    };
  }

  /**
   * Open configuration file
   * @param {string|null} [knownFilePath] - Skip the file dialog and read this
   *   path directly (Electron only; used by File > Open Recent)
   * @returns {Promise<Object>} Configuration data and metadata
   */
  async openFile(knownFilePath = null) {
    try {
      let result;

      if (this.isElectron) {
        let filePath = knownFilePath;

        if (!filePath) {
          // Use Electron file dialog
          const dialogResult = await window.electronAPI.openFile();

          if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
            return { canceled: true };
          }

          filePath = dialogResult.filePaths[0];
        }

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
        this.notifyDocumentState();
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
   * @param {Array} models - FBX model metadata from scene.getFBXModelsForExport()
   * @param {boolean} saveAs - Whether to force "Save As" dialog
   * @param {{x:number,y:number,z:number}|null} eye - Eye (rig) position
   * @param {number} [fovScale=1.0] - Global FOV scale factor (positive finite number; omitted from output when 1.0)
   * @returns {Promise<Object>} Save result
   */
  async saveFile(displays, models = [], saveAs = false, eye = null, fovScale = 1.0) {
    try {
      const configData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        displays: displays,
        eye: eye || { x: 0, y: 0, z: 0 },
        fovScale: (fovScale != null && fovScale !== 1.0) ? fovScale : undefined,
        models: (models || []).map(m => ({
          name: m.name,
          filePath: m.filePath || null,
          visible: m.visible,
          x: m.transform.x, y: m.transform.y, z: m.transform.z,
          yaw: m.transform.yaw, pitch: m.transform.pitch, roll: m.transform.roll,
          scale: m.transform.scale,
          renderMode: m.renderMode.mode,
          opacity: m.renderMode.opacity
        }))
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
        this.notifyDocumentState();
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
    const wasClean = !this.hasUnsavedChanges;
    this.hasUnsavedChanges = true;
    if (wasClean) this.notifyDocumentState();
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
   * @returns {Promise<boolean>} True if should proceed
   */
  async confirmUnsavedChanges(action = 'continue') {
    if (!this.hasUnsavedChanges) return true;
    return this.confirmAction(
      `You have unsaved changes. Are you sure you want to ${action}?`,
      'Discard changes'
    );
  }

  /**
   * Ask the user to confirm a destructive action, using a native message box
   * on the desktop and window.confirm on the web.
   * @param {string} message - Question to put to the user
   * @param {string} [confirmLabel] - Label for the confirming button
   * @returns {Promise<boolean>} True if the user confirmed
   */
  async confirmAction(message, confirmLabel = 'OK') {
    if (this.isElectron && typeof window.electronAPI.showMessageBox === 'function') {
      const response = await window.electronAPI.showMessageBox({
        type: 'warning',
        title: 'Node View Calibrator',
        message,
        buttons: [confirmLabel, 'Cancel'],
        defaultId: 1,
        cancelId: 1
      });
      return response === 0;
    }
    return confirm(message);
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
