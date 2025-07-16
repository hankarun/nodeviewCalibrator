/**
 * Environment detection and API abstraction for Node View Calibrator
 * This module provides a unified interface for both Electron and web environments
 */

/**
 * Check if we're running in an Electron environment
 * @returns {boolean} True if running in Electron, false if in web browser
 */
export function isElectron() {
  return typeof window !== 'undefined' && 
         typeof window.electronAPI !== 'undefined';
}

/**
 * Get the appropriate API based on the environment
 * @returns {Object} API object with file operations
 */
export async function getAPI() {
  if (isElectron()) {
    // Return Electron API
    return {
      openFile: () => window.electronAPI.openFile(),
      saveFile: () => window.electronAPI.saveFile(),
      readFile: (filePath) => window.electronAPI.readFile(filePath),
      writeFile: (filePath, content) => window.electronAPI.writeFile(filePath, content)
    };
  } else {
    // Import and return web API
    const { webAPI } = await import('./web-fileOperations.js');
    return webAPI;
  }
}

/**
 * Get the environment name for display purposes
 * @returns {string} Environment name
 */
export function getEnvironmentName() {
  return isElectron() ? 'Electron' : 'Web';
}

/**
 * Check if a feature is supported in the current environment
 * @param {string} feature - Feature name to check
 * @returns {boolean} True if feature is supported
 */
export function isFeatureSupported(feature) {
  switch (feature) {
    case 'nativeFileDialog':
      return isElectron();
    case 'fileDownload':
      return !isElectron();
    case 'localFileSystem':
      return isElectron();
    default:
      return true;
  }
}
