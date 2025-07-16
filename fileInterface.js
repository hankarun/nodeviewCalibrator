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
      // Load web-specific modules
      try {
        const webOps = await import('./web/web-fileOperations.js');
        this.webAPI = webOps.webAPI;
      } catch (error) {
        console.warn('Could not load web file operations:', error);
      }
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

/**
 * Legacy compatibility functions for existing code
 */

export async function createNewConfig() {
  const fi = await getFileInterface();
  return fi.createNew();
}

export async function openConfigFile() {
  const fi = await getFileInterface();
  return await fi.openFile();
}

export async function saveConfig(displays, currentFilePath) {
  const fi = await getFileInterface();
  return await fi.saveFile(displays, false);
}

export async function saveConfigAs(displays) {
  const fi = await getFileInterface();
  return await fi.saveFile(displays, true);
}
