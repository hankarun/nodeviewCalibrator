/**
 * New/Open/Save/Save As — the top-level file-menu commands. Coordinates the
 * display panel, model panel, and eye rig, which each own the state a saved
 * configuration touches.
 */
export function createFileOperations({ scene, fileInterface, elements, displayPanel, modelPanel, eyeControls }) {
  const { newConfigBtn, openConfigBtn, saveConfigBtn, saveAsConfigBtn } = elements;

  async function handleNewConfig() {
    if (displayPanel.hasDisplays() && !await fileInterface.confirmUnsavedChanges('create a new configuration')) {
      return;
    }
    fileInterface.createNew();
    scene.setEyeTransform(0, 0, 0);
    eyeControls.updateEyeInputs({ x: 0, y: 0, z: 0 });
    displayPanel.resetForNewConfig();
  }

  /**
   * Load a configuration, prompting for the file unless a path is supplied.
   * @param {string|null} [knownFilePath] - Path from File > Open Recent
   */
  async function handleOpenConfigFile(knownFilePath = null) {
    try {
      if (displayPanel.hasDisplays() && !await fileInterface.confirmUnsavedChanges('open a new configuration')) {
        return;
      }
      const result = await fileInterface.openFile(knownFilePath);
      if (result.canceled) return;
      [...scene.fbxModels].forEach(m => scene.removeFBXModel(m.id));
      displayPanel.loadDisplays(result.config.displays);
      // Restore eye position (defaults to origin for older configs)
      const eye = result.config.eye || { x: 0, y: 0, z: 0 };
      scene.setEyeTransform(eye.x || 0, eye.y || 0, eye.z || 0);
      eyeControls.updateEyeInputs({ x: eye.x || 0, y: eye.y || 0, z: eye.z || 0 });
      // Restore global FOV scale (defaults to 1.0 for older configs)
      const parsedFovScale = parseFloat(result.config.fovScale);
      displayPanel.setGlobalFovScale((Number.isFinite(parsedFovScale) && parsedFovScale > 0) ? parsedFovScale : 1.0);
      await modelPanel.reloadModelsFromConfig(result.config.models || []);
      displayPanel.finishSelectionAfterLoad();
    } catch (error) {
      console.error('Error opening file:', error);
    }
  }

  /**
   * Save to the current file, prompting for a path only if there isn't one.
   * @returns {Promise<boolean>} True if the configuration was written
   */
  async function handleSaveConfig() {
    try {
      const models = scene.getFBXModelsForExport();
      const result = await fileInterface.saveFile(displayPanel.getDisplays(), models, false, scene.getEyeTransform(), displayPanel.getGlobalFovScale());
      return !result.canceled;
    } catch (error) {
      console.error('Error saving file:', error);
      return false;
    }
  }

  /**
   * Save to a newly chosen path.
   * @returns {Promise<boolean>} True if the configuration was written
   */
  async function handleSaveConfigAs() {
    try {
      const models = scene.getFBXModelsForExport();
      const result = await fileInterface.saveFile(displayPanel.getDisplays(), models, true, scene.getEyeTransform(), displayPanel.getGlobalFovScale());
      return !result.canceled;
    } catch (error) {
      console.error('Error saving file:', error);
      return false;
    }
  }

  // File operation buttons (absent on desktop, where the menu bar replaces them)
  if (newConfigBtn) newConfigBtn.addEventListener('click', handleNewConfig);
  if (openConfigBtn) openConfigBtn.addEventListener('click', () => handleOpenConfigFile());
  if (saveConfigBtn) saveConfigBtn.addEventListener('click', handleSaveConfig);
  if (saveAsConfigBtn) saveAsConfigBtn.addEventListener('click', handleSaveConfigAs);

  return { handleNewConfig, handleOpenConfigFile, handleSaveConfig, handleSaveConfigAs };
}
