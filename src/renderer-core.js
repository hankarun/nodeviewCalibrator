// Shared renderer core for Node View Calibrator
// Used by both desktop (renderer.js) and web (web/web-renderer.js)

import { SceneRenderer } from './sceneRenderer.js';
import { getFileInterface } from './fileInterface.js';
import { StatusBar } from './statusBar.js';
import { createTabController } from './ui/tabController.js';
import { createCameraControls } from './ui/cameraControls.js';
import { createEyeControls } from './ui/eyeControls.js';
import { createModelPanel } from './ui/modelPanel.js';
import { createDisplayPanel } from './ui/displayPanel.js';
import { createFileOperations } from './ui/fileOperations.js';

/**
 * Initialize the application.
 */
export async function initApp() {

  const fileInterface = await getFileInterface();
  const envInfo = fileInterface.getEnvironmentInfo();
  console.log(`Node View Calibrator loaded in ${envInfo.platform} environment`);

  const statusBar = new StatusBar(fileInterface);

  /**
   * Report renderer state that the native menu bar reflects (checkmarks and
   * enabled items). No-op in the browser, which has no menu bar.
   * @param {Object} state - Partial UI state
   */
  function reportUiState(state) {
    if (window.electronAPI && typeof window.electronAPI.setUiState === 'function') {
      window.electronAPI.setUiState(state);
    }
  }

  const elements = {
    // Display panel
    displayWidthInput: document.getElementById('displayWidth'),
    displayHeightInput: document.getElementById('displayHeight'),
    displayAngleInput: document.getElementById('displayAngle'),
    displayPitchInput: document.getElementById('displayPitch'),
    displayRollInput: document.getElementById('displayRoll'),
    displayOffsetXInput: document.getElementById('displayOffsetX'),
    displayOffsetYInput: document.getElementById('displayOffsetY'),
    displayOffsetZInput: document.getElementById('displayOffsetZ'),
    displayNameInput: document.getElementById('displayName'),
    addDisplayBtn: document.getElementById('addDisplayBtn'),
    updateDisplayBtn: document.getElementById('updateDisplayBtn'),
    autoUpdateInput: document.getElementById('autoUpdateDisplay'),
    displayListContainer: document.getElementById('displayList'),
    projectionResults: document.getElementById('projectionResults'),
    presetSizeSelect: document.getElementById('presetSize'),

    // Per-display near plane input
    nearPlaneInput: document.getElementById('nearPlane'),
    showNearPlaneInput: document.getElementById('showNearPlane'),

    // Global FOV scale input
    globalFovScaleInput: document.getElementById('globalFovScale'),

    // Add Display dialog. Its fields mirror the Display Settings panel, but the
    // panel edits the current selection while the dialog describes a new display.
    addDisplayDialog: document.getElementById('addDisplayDialog'),
    addDisplayConfirmBtn: document.getElementById('addDisplayConfirmBtn'),
    addDisplayCancelBtn: document.getElementById('addDisplayCancelBtn'),
    addDisplayError: document.getElementById('addDisplayError'),
    dlg: {
      preset: document.getElementById('dlgPresetSize'),
      name: document.getElementById('dlgDisplayName'),
      width: document.getElementById('dlgDisplayWidth'),
      height: document.getElementById('dlgDisplayHeight'),
      yaw: document.getElementById('dlgDisplayAngle'),
      pitch: document.getElementById('dlgDisplayPitch'),
      roll: document.getElementById('dlgDisplayRoll'),
      x: document.getElementById('dlgDisplayOffsetX'),
      y: document.getElementById('dlgDisplayOffsetY'),
      z: document.getElementById('dlgDisplayOffsetZ'),
      nearPlane: document.getElementById('dlgNearPlane'),
      showNearPlane: document.getElementById('dlgShowNearPlane')
    },

    // Right-click menu for the display list; it replaces the Delete button that
    // used to sit in the Display Settings panel.
    displayContextMenu: document.getElementById('displayContextMenu'),

    // Viewport control buttons
    orbitModeBtn: document.getElementById('orbitModeBtn'),
    fpModeBtn: document.getElementById('fpModeBtn'),
    resetCameraBtn: document.getElementById('resetCameraBtn'),
    translateModeBtn: document.getElementById('translateModeBtn'),
    rotateModeBtn: document.getElementById('rotateModeBtn'),

    // File operation buttons
    newConfigBtn: document.getElementById('newConfigBtn'),
    openConfigBtn: document.getElementById('openConfigBtn'),
    saveConfigBtn: document.getElementById('saveConfigBtn'),
    saveAsConfigBtn: document.getElementById('saveAsConfigBtn'),

    // Model controls
    loadFbxBtn: document.getElementById('loadFbxBtn'),
    modelListEl: document.getElementById('modelList'),
    modelPosXInput: document.getElementById('modelPosX'),
    modelPosYInput: document.getElementById('modelPosY'),
    modelPosZInput: document.getElementById('modelPosZ'),
    modelRotYawInput: document.getElementById('modelRotYaw'),
    modelRotPitchInput: document.getElementById('modelRotPitch'),
    modelRotRollInput: document.getElementById('modelRotRoll'),
    modelScaleInput: document.getElementById('modelScale'),
    modelRenderModeSelect: document.getElementById('modelRenderMode'),
    modelOpacityInput: document.getElementById('modelOpacity'),
    modelOpacityValueSpan: document.getElementById('modelOpacityValue'),
    modelOpacityRow: document.getElementById('modelOpacityRow'),
    fbxFileInput: document.getElementById('fbxFileInput'), // Web only

    // Eye controls
    eyePosXInput: document.getElementById('eyePosX'),
    eyePosYInput: document.getElementById('eyePosY'),
    eyePosZInput: document.getElementById('eyePosZ'),
    resetEyeBtn: document.getElementById('resetEyeBtn')
  };
  elements.modelInputs = [
    elements.modelPosXInput, elements.modelPosYInput, elements.modelPosZInput,
    elements.modelRotYawInput, elements.modelRotPitchInput, elements.modelRotRollInput,
    elements.modelScaleInput, elements.modelRenderModeSelect, elements.modelOpacityInput
  ];

  // Initialize 3D scene
  const viewportContainer = document.getElementById('viewport3d');
  const scene = new SceneRenderer(viewportContainer);

  const tabController = createTabController({ scene, reportUiState });
  const cameraControls = createCameraControls({ scene, elements, reportUiState });
  const eyeControls = createEyeControls({ scene, elements, fileInterface, tabController });
  const displayPanel = createDisplayPanel({ scene, elements, fileInterface, statusBar, reportUiState });
  const modelPanel = createModelPanel({ scene, elements, fileInterface, displayPanel });
  const fileOperations = createFileOperations({ scene, fileInterface, elements, displayPanel, modelPanel, eyeControls });

  // --- Native menu commands (desktop only) ---

  /**
   * Run a command issued from the native application menu. Every branch
   * routes to the same handler the equivalent in-page control uses.
   * @param {string} command - Command identifier from desktop/menu.js
   * @param {*} payload - Optional command argument
   */
  async function handleMenuCommand(command, payload) {
    switch (command) {
      case 'new-config': await fileOperations.handleNewConfig(); break;
      case 'open-config': await fileOperations.handleOpenConfigFile(); break;
      case 'open-recent': await fileOperations.handleOpenConfigFile(payload); break;
      case 'save-config': await fileOperations.handleSaveConfig(); break;
      case 'save-config-as': await fileOperations.handleSaveConfigAs(); break;
      case 'save-and-close': {
        // Triggered by the "Save" button of the close prompt: the window only
        // closes once the write actually succeeded.
        const saved = await fileOperations.handleSaveConfig();
        window.electronAPI.closeAfterSave(saved);
        break;
      }
      case 'load-fbx': await modelPanel.handleLoadFbx(); break;
      case 'add-display': displayPanel.openAddDisplayDialog(); break;
      case 'update-display': displayPanel.updateSelectedDisplay(); break;
      case 'toggle-auto-update': displayPanel.setAutoUpdate(payload); break;
      case 'delete-display': await displayPanel.deleteSelectedDisplay(); break;
      case 'show-panel': tabController.activatePanel(payload); break;
      case 'reset-eye': eyeControls.resetEye(); break;
      case 'camera-mode': cameraControls.setCameraMode(payload); break;
      case 'reset-camera': scene.resetCamera(); break;
      default: console.warn('Unhandled menu command:', command);
    }
  }

  if (window.electronAPI && typeof window.electronAPI.onMenuCommand === 'function') {
    window.electronAPI.onMenuCommand((command, payload) => {
      handleMenuCommand(command, payload).catch(error => {
        console.error(`Menu command "${command}" failed:`, error);
      });
    });
  }

  // Initialize
  reportUiState({
    cameraMode: 'orbit',
    activePanel: 'tab-display-settings',
    hasSelection: false,
    autoUpdate: displayPanel.isAutoUpdateOn()
  });
}
