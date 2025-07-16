/**
 * Web File Operations for nodeViewCalibrator
 * Handles loading and saving configuration files in the browser
 */

/**
 * Create a new empty configuration
 * @returns {Object} Empty configuration object
 */
export function createNewConfig() {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    displays: []
  };
}

/**
 * Show a notification to the user
 * @param {string} message - The message to show
 * @param {string} type - The type of notification (success, error, info)
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

/**
 * Open configuration from file using file input
 * @returns {Promise<Object>} Promise resolving to configuration object and file path
 */
export async function openConfigFile() {
  return new Promise((resolve) => {
    const fileInput = document.getElementById('fileInput');
    
    // Create a new change event handler
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
          
          // Validate the config has the displays array
          if (!Array.isArray(config.displays)) {
            throw new Error('Invalid configuration file format');
          }
          
          showNotification('Configuration loaded successfully!', 'success');
          resolve({
            canceled: false,
            config,
            filePath: file.name
          });
        } catch (error) {
          showNotification(`Error parsing configuration: ${error.message}`, 'error');
          resolve({ canceled: true, error: error.message });
        }
      };
      
      reader.onerror = () => {
        showNotification('Error reading file', 'error');
        resolve({ canceled: true, error: 'Error reading file' });
      };
      
      reader.readAsText(file);
      
      // Clean up: remove the event listener and reset the input
      fileInput.removeEventListener('change', handleFileSelect);
      fileInput.value = '';
    };
    
    // Add event listener and trigger file dialog
    fileInput.addEventListener('change', handleFileSelect);
    fileInput.click();
  });
}

/**
 * Download a file with the given content
 * @param {string} content - The content to download
 * @param {string} filename - The filename for the download
 * @param {string} mimeType - The MIME type of the file
 */
function downloadFile(content, filename, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Save configuration to specified file
 * @param {Array} displays - Array of display objects to save
 * @param {string} filename - Filename to save as
 * @returns {Promise<string>} Promise resolving to the file path
 */
export async function saveConfigToFile(displays, filename) {
  // Prepare data to save
  const configData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    displays: displays
  };
  
  // Convert to JSON string
  const content = JSON.stringify(configData, null, 2);
  
  // Download the file
  downloadFile(content, filename);
  
  showNotification('Configuration saved successfully!', 'success');
  return filename;
}

/**
 * Save configuration with new filename
 * @param {Array} displays - Array of display objects to save
 * @returns {Promise<Object>} Promise resolving to result object with filePath
 */
export async function saveConfigAs(displays) {
  try {
    // Generate a default filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `display-config-${timestamp}.json`;
    
    const filePath = await saveConfigToFile(displays, filename);
    return {
      canceled: false,
      filePath
    };
  } catch (error) {
    showNotification(`Error in save as operation: ${error.message}`, 'error');
    throw new Error(`Error in save as operation: ${error.message}`);
  }
}

/**
 * Save configuration to current file or prompt for new location
 * @param {Array} displays - Array of display objects to save
 * @param {string|null} currentFilePath - Current file path or null
 * @returns {Promise<Object>} Promise resolving to result object with filePath
 */
export async function saveConfig(displays, currentFilePath) {
  if (currentFilePath && currentFilePath !== 'untitled') {
    // We have a current filename, use it
    const filePath = await saveConfigToFile(displays, currentFilePath);
    return {
      canceled: false,
      filePath
    };
  } else {
    // No current file path, use Save As instead
    return await saveConfigAs(displays);
  }
}

/**
 * Web-specific API object that mimics the Electron API
 */
export const webAPI = {
  openFile: openConfigFile,
  saveFile: saveConfigAs,
  readFile: (filePath) => Promise.resolve(''), // Not used in web version
  writeFile: (filePath, content) => Promise.resolve(true) // Not used in web version
};
