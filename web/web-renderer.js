// Web renderer for Node View Calibrator - Three.js 3D version

import { createDisplayFromInputs, calculateDisplayProjection, formatDisplayCalculations, displayPresets } from '../display.js';
import { SceneRenderer } from '../sceneRenderer.js';
import { getFileInterface, openConfigFile, saveConfig, saveConfigAs } from '../fileInterface.js';
import { StatusBar } from '../statusBar.js';

document.addEventListener('DOMContentLoaded', async () => {
  const fileInterface = await getFileInterface();
  const envInfo = fileInterface.getEnvironmentInfo();
  console.log(`Node View Calibrator loaded in ${envInfo.platform} environment`);

  const statusBar = new StatusBar(fileInterface);

  // Input elements
  const displayWidthInput = document.getElementById('displayWidth');
  const displayHeightInput = document.getElementById('displayHeight');
  const displayDistanceInput = document.getElementById('displayDistance');
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
      displayDistanceInput.value = display.distance;
      displayAngleInput.value = display.yaw;
      displayPitchInput.value = display.pitch;
      displayRollInput.value = display.roll;
      displayOffsetXInput.value = display.x;
      displayOffsetYInput.value = display.y;
      displayOffsetZInput.value = display.z;
      displayNameInput.value = display.name || '';

      updateDisplayBtn.disabled = false;
      deleteDisplayBtn.disabled = false;

      showDisplayCalculations(display);
      scene.selectDisplay(index, display);
    } else {
      updateDisplayBtn.disabled = true;
      deleteDisplayBtn.disabled = true;
      scene.selectDisplay(-1);
    }
  }

  // --- Calculations ---

  function showDisplayCalculations(display) {
    const result = calculateDisplayProjection(display);
    const useStableCalculation = stableEdgeCalculationInput.checked;
    projectionResults.innerHTML = formatDisplayCalculations(result, display, useStableCalculation);
  }

  // --- Display CRUD ---

  function getDisplayFromInputs() {
    const inputs = {
      name: displayNameInput.value,
      width: displayWidthInput.value,
      height: displayHeightInput.value,
      distance: displayDistanceInput.value,
      yaw: displayAngleInput.value,
      pitch: displayPitchInput.value,
      roll: displayRollInput.value,
      x: displayOffsetXInput.value,
      y: displayOffsetYInput.value,
      z: displayOffsetZInput.value
    };
    return createDisplayFromInputs(inputs);
  }

  function rebuildAllDisplayMeshes() {
    scene.clearDisplays();
    displays.forEach((display) => scene.addDisplay(display));
    if (selectedDisplayIndex >= 0 && selectedDisplayIndex < displays.length) {
      scene.selectDisplay(selectedDisplayIndex, displays[selectedDisplayIndex]);
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

  // Initialize
  updateDisplayList();
});
