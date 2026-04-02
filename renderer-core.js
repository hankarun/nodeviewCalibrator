// Shared renderer core for Node View Calibrator
// Used by both desktop (renderer.js) and web (web/web-renderer.js)

import { createDisplayFromInputs, calculateDisplayProjection, formatDisplayCalculations, displayPresets } from './display.js';
import { SceneRenderer } from './sceneRenderer.js';
import { getFileInterface } from './fileInterface.js';
import { StatusBar } from './statusBar.js';

/**
 * Initialize the application.
 */
export async function initApp() {

  const fileInterface = await getFileInterface();
  const envInfo = fileInterface.getEnvironmentInfo();
  console.log(`Node View Calibrator loaded in ${envInfo.platform} environment`);

  const statusBar = new StatusBar(fileInterface);

  // Input elements
  const displayWidthInput = document.getElementById('displayWidth');
  const displayHeightInput = document.getElementById('displayHeight');
  const displayAngleInput = document.getElementById('displayAngle');
  const displayPitchInput = document.getElementById('displayPitch');
  const displayRollInput = document.getElementById('displayRoll');
  const displayOffsetXInput = document.getElementById('displayOffsetX');
  const displayOffsetYInput = document.getElementById('displayOffsetY');
  const displayOffsetZInput = document.getElementById('displayOffsetZ');
  const displayNameInput = document.getElementById('displayName');
  const addDisplayBtn = document.getElementById('addDisplayBtn');
  const updateDisplayBtn = document.getElementById('updateDisplayBtn');
  const deleteDisplayBtn = document.getElementById('deleteDisplayBtn');
  const displayListContainer = document.getElementById('displayList');
  const projectionResults = document.getElementById('projectionResults');
  const presetSizeSelect = document.getElementById('presetSize');
  const stableEdgeCalculationInput = document.getElementById('stableEdgeCalculation');

  // Per-display near plane input
  const nearPlaneInput = document.getElementById('nearPlane');
  const showNearPlaneInput = document.getElementById('showNearPlane');

  // Viewport control buttons
  const orbitModeBtn = document.getElementById('orbitModeBtn');
  const fpModeBtn = document.getElementById('fpModeBtn');
  const resetCameraBtn = document.getElementById('resetCameraBtn');
  const translateModeBtn = document.getElementById('translateModeBtn');
  const rotateModeBtn = document.getElementById('rotateModeBtn');

  // File operation buttons
  const newConfigBtn = document.getElementById('newConfigBtn');
  const openConfigBtn = document.getElementById('openConfigBtn');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const saveAsConfigBtn = document.getElementById('saveAsConfigBtn');

  // Model controls
  const loadFbxBtn = document.getElementById('loadFbxBtn');
  const removeFbxBtn = document.getElementById('removeFbxBtn');
  const fbxFileNameLabel = document.getElementById('fbxFileName');
  const modelPosXInput = document.getElementById('modelPosX');
  const modelPosYInput = document.getElementById('modelPosY');
  const modelPosZInput = document.getElementById('modelPosZ');
  const modelRotYawInput = document.getElementById('modelRotYaw');
  const modelRotPitchInput = document.getElementById('modelRotPitch');
  const modelRotRollInput = document.getElementById('modelRotRoll');
  const modelScaleInput = document.getElementById('modelScale');
  const modelInputs = [modelPosXInput, modelPosYInput, modelPosZInput, modelRotYawInput, modelRotPitchInput, modelRotRollInput, modelScaleInput];
  const fbxFileInput = document.getElementById('fbxFileInput'); // Web only

  // Initialize 3D scene
  const viewportContainer = document.getElementById('viewport3d');
  const scene = new SceneRenderer(viewportContainer);

  // Set display dimensions when preset is selected
  presetSizeSelect.addEventListener('change', function() {
    const selectedSize = this.value;
    if (selectedSize && displayPresets[selectedSize]) {
      displayWidthInput.value = displayPresets[selectedSize].width;
      displayHeightInput.value = displayPresets[selectedSize].height;
    }
  });

  // Store displays
  const displays = [];
  let selectedDisplayIndex = -1;

  // --- Scene callbacks ---

  scene.onDisplayChange = (index, changes) => {
    const display = displays[index];
    if (!display) return;

    display.x = parseFloat(changes.x.toFixed(4));
    display.y = parseFloat(changes.y.toFixed(4));
    display.z = parseFloat(changes.z.toFixed(4));
    display.yaw = parseFloat(changes.yaw.toFixed(2));
    display.pitch = parseFloat(changes.pitch.toFixed(2));
    display.roll = parseFloat(changes.roll.toFixed(2));

    displayOffsetXInput.value = display.x;
    displayOffsetYInput.value = display.y;
    displayOffsetZInput.value = display.z;
    displayAngleInput.value = display.yaw;
    displayPitchInput.value = display.pitch;
    displayRollInput.value = display.roll;

    showDisplayCalculations(display);
    updateDisplayList();
    fileInterface.markUnsaved();
  };

  scene.onDisplaySelect = (index) => {
    selectDisplay(index);
  };

  // --- Model callbacks ---

  scene.onModelChange = (changes) => {
    modelPosXInput.value = parseFloat(changes.x.toFixed(4));
    modelPosYInput.value = parseFloat(changes.y.toFixed(4));
    modelPosZInput.value = parseFloat(changes.z.toFixed(4));
    modelRotYawInput.value = parseFloat(changes.yaw.toFixed(2));
    modelRotPitchInput.value = parseFloat(changes.pitch.toFixed(2));
    modelRotRollInput.value = parseFloat(changes.roll.toFixed(2));
    modelScaleInput.value = parseFloat(changes.scale.toFixed(4));
  };

  scene.onModelSelect = (selected) => {
    if (selected) {
      // Deselect display when model is selected
      selectedDisplayIndex = -1;
      updateDisplayList();
      updateDisplayBtn.disabled = true;
      deleteDisplayBtn.disabled = true;
      projectionResults.innerHTML = '<div class="info-placeholder">FBX model selected</div>';
    }
  };

  function setModelInputsEnabled(enabled) {
    modelInputs.forEach(input => { if (input) input.disabled = !enabled; });
    removeFbxBtn.disabled = !enabled;
  }

  function updateModelFromInputs() {
    if (!scene.fbxModel) return;
    scene.setModelTransform(
      parseFloat(modelPosXInput.value) || 0,
      parseFloat(modelPosYInput.value) || 0,
      parseFloat(modelPosZInput.value) || 0,
      parseFloat(modelRotYawInput.value) || 0,
      parseFloat(modelRotPitchInput.value) || 0,
      parseFloat(modelRotRollInput.value) || 0,
      parseFloat(modelScaleInput.value) || 1
    );
  }

  async function handleLoadFbx() {
    try {
      if (window.electronAPI) {
        // Desktop: use IPC file dialog
        const result = await window.electronAPI.openFbxFile();
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;
        const filePath = result.filePaths[0];
        const fileName = filePath.split(/[/\\]/).pop();
        fbxFileNameLabel.textContent = fileName;
        await scene.loadFBXModel(filePath);
      } else {
        // Web: use file input
        if (!fbxFileInput) return;
        fbxFileInput.click();
        await new Promise((resolve) => {
          fbxFileInput.onchange = async () => {
            const file = fbxFileInput.files[0];
            if (!file) { resolve(); return; }
            fbxFileNameLabel.textContent = file.name;
            const buffer = await file.arrayBuffer();
            scene.loadFBXModelFromBuffer(buffer);
            resolve();
          };
        });
      }
      // Enable model controls and set default values
      setModelInputsEnabled(true);
      const t = scene.getModelTransform();
      if (t) {
        modelPosXInput.value = t.x;
        modelPosYInput.value = t.y;
        modelPosZInput.value = t.z;
        modelRotYawInput.value = t.yaw;
        modelRotPitchInput.value = t.pitch;
        modelRotRollInput.value = t.roll;
        modelScaleInput.value = t.scale;
      }
    } catch (error) {
      console.error('Error loading FBX:', error);
      fbxFileNameLabel.textContent = 'Error loading model';
    }
  }

  function handleRemoveFbx() {
    scene.removeFBXModel();
    setModelInputsEnabled(false);
    fbxFileNameLabel.textContent = 'No model loaded';
    modelPosXInput.value = 0;
    modelPosYInput.value = 0;
    modelPosZInput.value = 0;
    modelRotYawInput.value = 0;
    modelRotPitchInput.value = 0;
    modelRotRollInput.value = 0;
    modelScaleInput.value = 1;
  }

  // --- Display list ---

  function updateDisplayList() {
    displayListContainer.innerHTML = '';
    if (displays.length === 0) {
      displayListContainer.innerHTML = '<div class="empty-list-message">No displays added yet</div>';
      statusBar.updateDisplayCount(0);
      return;
    }

    displays.forEach((display, index) => {
      const displayItem = document.createElement('div');
      displayItem.classList.add('display-item');
      if (index === selectedDisplayIndex) {
        displayItem.classList.add('selected');
      }
      const displayLabel = display.name ? `Display ${index + 1} (${display.name})` : `Display ${index + 1}`;
      displayItem.textContent = displayLabel;
      displayItem.title = `${display.width}m × ${display.height}m at (${display.x.toFixed(2)}, ${display.y.toFixed(2)}, ${display.z.toFixed(2)})`;
      displayItem.addEventListener('click', () => selectDisplay(index));
      displayListContainer.appendChild(displayItem);
    });

    statusBar.updateDisplayCount(displays.length);
  }

  // --- Selection ---

  function selectDisplay(index) {
    selectedDisplayIndex = index;
    updateDisplayList();

    if (index >= 0 && index < displays.length) {
      const display = displays[index];

      displayWidthInput.value = display.width;
      displayHeightInput.value = display.height;
      displayAngleInput.value = display.yaw;
      displayPitchInput.value = display.pitch;
      displayRollInput.value = display.roll;
      displayOffsetXInput.value = display.x;
      displayOffsetYInput.value = display.y;
      displayOffsetZInput.value = display.z;
      displayNameInput.value = display.name || '';

      // Populate per-display near plane input
      if (nearPlaneInput) {
        nearPlaneInput.value = display.nearPlane != null ? display.nearPlane : '';
      }
      if (showNearPlaneInput) {
        showNearPlaneInput.checked = !!display.showNearPlane;
      }

      updateDisplayBtn.disabled = false;
      deleteDisplayBtn.disabled = false;

      showDisplayCalculations(display);
      scene.selectDisplay(index, display);
      updateNearPlaneVisualization();
    } else {
      updateDisplayBtn.disabled = true;
      deleteDisplayBtn.disabled = true;
      scene.selectDisplay(-1);
      updateNearPlaneVisualization();
    }
  }

  // --- Calculations ---

  function showDisplayCalculations(display) {
    const result = calculateDisplayProjection(display);
    const useStableCalculation = stableEdgeCalculationInput.checked;
    const nearPlane = display.nearPlane != null ? display.nearPlane : null;
    projectionResults.innerHTML = formatDisplayCalculations(result, display, useStableCalculation, nearPlane);
  }

  function updateNearPlaneVisualization() {
    scene.updateAllNearPlanes(displays, selectedDisplayIndex);
  }

  // --- Display CRUD ---

  function getDisplayFromInputs() {
    const inputs = {
      name: displayNameInput.value,
      width: displayWidthInput.value,
      height: displayHeightInput.value,
      yaw: displayAngleInput.value,
      pitch: displayPitchInput.value,
      roll: displayRollInput.value,
      x: displayOffsetXInput.value,
      y: displayOffsetYInput.value,
      z: displayOffsetZInput.value,
      nearPlane: nearPlaneInput && nearPlaneInput.value !== '' ? nearPlaneInput.value : null,
      showNearPlane: showNearPlaneInput ? showNearPlaneInput.checked : false
    };
    return createDisplayFromInputs(inputs);
  }

  function rebuildAllDisplayMeshes() {
    scene.clearDisplays();
    displays.forEach((display) => scene.addDisplay(display));
    if (selectedDisplayIndex >= 0 && selectedDisplayIndex < displays.length) {
      scene.selectDisplay(selectedDisplayIndex, displays[selectedDisplayIndex]);
      updateNearPlaneVisualization();
    }
  }

  // --- File operations ---

  function handleNewConfig() {
    if (displays.length > 0 && !fileInterface.confirmUnsavedChanges('create a new configuration')) {
      return;
    }
    displays.length = 0;
    selectedDisplayIndex = -1;
    fileInterface.createNew();
    updateDisplayList();
    projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
  }

  async function handleOpenConfigFile() {
    try {
      if (displays.length > 0 && !fileInterface.confirmUnsavedChanges('open a new configuration')) {
        return;
      }
      const result = await fileInterface.openFile();
      if (result.canceled) return;
      displays.length = 0;
      displays.push(...result.config.displays);
      updateDisplayList();
      rebuildAllDisplayMeshes();
      if (displays.length > 0) {
        selectDisplay(0);
      } else {
        selectedDisplayIndex = -1;
        updateDisplayBtn.disabled = true;
        projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  }

  async function handleSaveConfig() {
    try {
      await fileInterface.saveFile(displays, false);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  async function handleSaveConfigAs() {
    try {
      await fileInterface.saveFile(displays, true);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  function deleteDisplay() {
    if (selectedDisplayIndex < 0) return;
    if (confirm(`Are you sure you want to delete Display ${selectedDisplayIndex + 1}?`)) {
      scene.removeDisplay(selectedDisplayIndex);
      displays.splice(selectedDisplayIndex, 1);

      if (displays.length === 0) {
        selectedDisplayIndex = -1;
      } else if (selectedDisplayIndex >= displays.length) {
        selectedDisplayIndex = displays.length - 1;
      }

      updateDisplayList();
      if (selectedDisplayIndex >= 0) {
        selectDisplay(selectedDisplayIndex);
      } else {
        updateDisplayBtn.disabled = true;
        deleteDisplayBtn.disabled = true;
        projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
      }
    }
  }

  // --- Event listeners ---

  addDisplayBtn.addEventListener('click', () => {
    const display = getDisplayFromInputs();
    displays.push(display);
    scene.addDisplay(display);
    selectDisplay(displays.length - 1);
    updateDisplayList();
    fileInterface.markUnsaved();
  });

  updateDisplayBtn.addEventListener('click', () => {
    if (selectedDisplayIndex >= 0) {
      displays[selectedDisplayIndex] = getDisplayFromInputs();
      scene.updateDisplay(selectedDisplayIndex, displays[selectedDisplayIndex]);
      showDisplayCalculations(displays[selectedDisplayIndex]);
      updateDisplayList();
      fileInterface.markUnsaved();
    }
  });

  deleteDisplayBtn.addEventListener('click', () => {
    deleteDisplay();
    if (displays.length >= 0) {
      fileInterface.markUnsaved();
    }
  });

  stableEdgeCalculationInput.addEventListener('change', () => {
    if (selectedDisplayIndex >= 0) {
      showDisplayCalculations(displays[selectedDisplayIndex]);
    }
  });

  // Per-display near plane input
  if (nearPlaneInput) {
    nearPlaneInput.addEventListener('input', () => {
      if (selectedDisplayIndex >= 0) {
        const val = nearPlaneInput.value;
        if (val === '' || val === null) {
          delete displays[selectedDisplayIndex].nearPlane;
        } else {
          displays[selectedDisplayIndex].nearPlane = parseFloat(val);
        }
        showDisplayCalculations(displays[selectedDisplayIndex]);
        updateNearPlaneVisualization();
        fileInterface.markUnsaved();
      }
    });
  }

  // --- Camera & gizmo controls ---

  orbitModeBtn.addEventListener('click', () => {
    scene.setCameraMode('orbit');
    orbitModeBtn.classList.add('active');
    fpModeBtn.classList.remove('active');
  });

  fpModeBtn.addEventListener('click', () => {
    scene.setCameraMode('firstperson');
    fpModeBtn.classList.add('active');
    orbitModeBtn.classList.remove('active');
  });

  resetCameraBtn.addEventListener('click', () => scene.resetCamera());

  translateModeBtn.addEventListener('click', () => {
    scene.setGizmoMode('translate');
    translateModeBtn.classList.add('active');
    rotateModeBtn.classList.remove('active');
  });

  rotateModeBtn.addEventListener('click', () => {
    scene.setGizmoMode('rotate');
    rotateModeBtn.classList.add('active');
    translateModeBtn.classList.remove('active');
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 't' || e.key === 'T') {
      translateModeBtn.classList.add('active');
      rotateModeBtn.classList.remove('active');
    } else if (e.key === 'r' || e.key === 'R') {
      rotateModeBtn.classList.add('active');
      translateModeBtn.classList.remove('active');
    }
  });

  // File operation buttons
  newConfigBtn.addEventListener('click', handleNewConfig);
  openConfigBtn.addEventListener('click', handleOpenConfigFile);
  saveConfigBtn.addEventListener('click', handleSaveConfig);
  saveAsConfigBtn.addEventListener('click', handleSaveConfigAs);

  // Model controls
  loadFbxBtn.addEventListener('click', handleLoadFbx);
  removeFbxBtn.addEventListener('click', handleRemoveFbx);
  modelInputs.forEach(input => {
    if (input) input.addEventListener('input', updateModelFromInputs);
  });

  // Initialize
  updateDisplayList();
}
