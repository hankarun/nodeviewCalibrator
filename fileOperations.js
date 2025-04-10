/**
 * File operations for nodeViewCalibrator
 * Handles loading and saving configuration files
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
 * Open configuration from file
 * @returns {Promise<Object>} Promise resolving to configuration object and file path
 */
export async function openConfigFile() {
  try {
    const result = await window.electronAPI.openFile();
    
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    
    const filePath = result.filePaths[0];
    const content = await window.electronAPI.readFile(filePath);
    
    try {
      const config = JSON.parse(content);
      
      // Validate the config has the displays array
      if (!Array.isArray(config.displays)) {
        throw new Error('Invalid configuration file format');
      }
      
      return {
        canceled: false,
        config,
        filePath
      };
    } catch (error) {
      throw new Error(`Error parsing configuration: ${error.message}`);
    }
  } catch (error) {
    throw new Error(`Error opening file: ${error.message}`);
  }
}

/**
 * Save configuration to specified file
 * @param {Array} displays - Array of display objects to save
 * @param {string} filePath - Path to save the file to
 * @returns {Promise<string>} Promise resolving to the file path
 */
export async function saveConfigToFile(displays, filePath) {
  // Prepare data to save
  const configData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    displays: displays
  };
  
  // Convert to JSON string
  const content = JSON.stringify(configData, null, 2);
  
  // Write to file
  await window.electronAPI.writeFile(filePath, content);
  return filePath;
}

/**
 * Save configuration with new filename
 * @param {Array} displays - Array of display objects to save
 * @returns {Promise<Object>} Promise resolving to result object with filePath
 */
export async function saveConfigAs(displays) {
  try {
    const result = await window.electronAPI.saveFile();
    
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    
    const filePath = await saveConfigToFile(displays, result.filePath);
    return {
      canceled: false,
      filePath
    };
  } catch (error) {
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
  if (currentFilePath) {
    // We already have a file path, just save
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