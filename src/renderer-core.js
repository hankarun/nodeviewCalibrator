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
  const modelListEl = document.getElementById('modelList');
  const modelPosXInput = document.getElementById('modelPosX');
  const modelPosYInput = document.getElementById('modelPosY');
  const modelPosZInput = document.getElementById('modelPosZ');
  const modelRotYawInput = document.getElementById('modelRotYaw');
  const modelRotPitchInput = document.getElementById('modelRotPitch');
  const modelRotRollInput = document.getElementById('modelRotRoll');
  const modelScaleInput = document.getElementById('modelScale');
  const modelRenderModeSelect = document.getElementById('modelRenderMode');
  const modelOpacityInput = document.getElementById('modelOpacity');
  const modelOpacityValueSpan = document.getElementById('modelOpacityValue');
  const modelOpacityRow = document.getElementById('modelOpacityRow');
  const modelInputs = [modelPosXInput, modelPosYInput, modelPosZInput, modelRotYawInput, modelRotPitchInput, modelRotRollInput, modelScaleInput, modelRenderModeSelect, modelOpacityInput];
  const fbxFileInput = document.getElementById('fbxFileInput'); // Web only

  // Eye controls
  const eyePosXInput = document.getElementById('eyePosX');
  const eyePosYInput = document.getElementById('eyePosY');
  const eyePosZInput = document.getElementById('eyePosZ');
  const resetEyeBtn = document.getElementById('resetEyeBtn');

  // --- Tab switching ---
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.remove('hidden');
      // Attach the eye gizmo while the Eye tab is open; detach it otherwise.
      if (btn.dataset.target === 'tab-eye') {
        scene.selectEye();
      } else if (scene.eyeSelected) {
        scene.deselectEye();
      }
    });
  });

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
  let selectedDisplayIndices = [];  // All currently selected display indices

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

    // Only update UI inputs for the primary (last-clicked) display
    if (index === selectedDisplayIndex) {
      displayOffsetXInput.value = display.x;
      displayOffsetYInput.value = display.y;
      displayOffsetZInput.value = display.z;
      if (selectedDisplayIndices.length <= 1) {
        displayAngleInput.value = display.yaw;
        displayPitchInput.value = display.pitch;
        displayRollInput.value = display.roll;
        showDisplayCalculations(display);
      }
    }
    updateDisplayList();
    fileInterface.markUnsaved();
  };

  scene.onDisplaySelect = (index) => {
    selectDisplay(index);
  };

  scene.onDragEnd = (index) => {
    if (index >= 0 && displays[index]) {
      scene.selectDisplay(index, displays[index]);
    }
    updateNearPlaneVisualization();
  };

  scene.onMultiSelect = (indices) => {
    selectMultipleDisplays(indices);
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

  scene.onModelSelect = (idOrFalse) => {
    if (idOrFalse !== false) {
      // Deselect display when a model is selected
      selectedDisplayIndex = -1;
      selectedDisplayIndices = [];
      updateDisplayList();
      setDisplayPanelMode('single');
      updateDisplayBtn.disabled = true;
      deleteDisplayBtn.disabled = true;
      projectionResults.innerHTML = '<div class="info-placeholder">FBX model selected</div>';
      populateModelTransformInputs(idOrFalse);
      setModelInputsEnabled(true);
      renderModelList();
    } else {
      setModelInputsEnabled(false);
      renderModelList();
    }
  };

  function setModelInputsEnabled(enabled) {
    modelInputs.forEach(input => { if (input) input.disabled = !enabled; });
    if (!enabled && modelOpacityRow) modelOpacityRow.style.display = 'none';
  }

  // --- Eye rig callbacks & controls ---

  function updateEyeInputs(t) {
    if (eyePosXInput) eyePosXInput.value = parseFloat(t.x.toFixed(4));
    if (eyePosYInput) eyePosYInput.value = parseFloat(t.y.toFixed(4));
    if (eyePosZInput) eyePosZInput.value = parseFloat(t.z.toFixed(4));
  }

  function activateEyeTab() {
    const btn = document.querySelector('.tab-btn[data-target="tab-eye"]');
    if (btn && !btn.classList.contains('active')) btn.click();
  }

  // Gizmo drag on the eye → reflect in the input fields
  scene.onEyeChange = (changes) => {
    updateEyeInputs(changes);
    fileInterface.markUnsaved();
  };

  // Clicking the eye sphere in the viewport → open the Eye tab
  scene.onEyeSelect = () => {
    activateEyeTab();
  };

  function applyEyeFromInputs() {
    const x = parseFloat(eyePosXInput.value) || 0;
    const y = parseFloat(eyePosYInput.value) || 0;
    const z = parseFloat(eyePosZInput.value) || 0;
    scene.setEyeTransform(x, y, z);
    fileInterface.markUnsaved();
  }

  [eyePosXInput, eyePosYInput, eyePosZInput].forEach(input => {
    if (input) input.addEventListener('input', applyEyeFromInputs);
  });

  if (resetEyeBtn) {
    resetEyeBtn.addEventListener('click', () => {
      scene.setEyeTransform(0, 0, 0);
      updateEyeInputs({ x: 0, y: 0, z: 0 });
      fileInterface.markUnsaved();
    });
  }

  function populateModelTransformInputs(id) {
    const t = scene.getModelTransform(id);
    if (!t) return;
    modelPosXInput.value = parseFloat(t.x.toFixed(4));
    modelPosYInput.value = parseFloat(t.y.toFixed(4));
    modelPosZInput.value = parseFloat(t.z.toFixed(4));
    modelRotYawInput.value = parseFloat(t.yaw.toFixed(2));
    modelRotPitchInput.value = parseFloat(t.pitch.toFixed(2));
    modelRotRollInput.value = parseFloat(t.roll.toFixed(2));
    modelScaleInput.value = parseFloat(t.scale.toFixed(4));
    const rm = scene.getModelRenderMode(id);
    if (rm && modelRenderModeSelect) {
      modelRenderModeSelect.value = rm.mode;
      if (modelOpacityInput) modelOpacityInput.value = rm.opacity;
      if (modelOpacityValueSpan) modelOpacityValueSpan.textContent = parseFloat(rm.opacity).toFixed(2);
      if (modelOpacityRow) modelOpacityRow.style.display = rm.mode === 'transparent' ? '' : 'none';
    }
  }

  if (modelRenderModeSelect) {
    modelRenderModeSelect.addEventListener('change', () => {
      if (scene.selectedModelId === null) return;
      const mode = modelRenderModeSelect.value;
      const opacity = modelOpacityInput ? parseFloat(modelOpacityInput.value) : 1;
      if (modelOpacityRow) modelOpacityRow.style.display = mode === 'transparent' ? '' : 'none';
      scene.setModelRenderMode(scene.selectedModelId, mode, opacity);
    });
  }

  if (modelOpacityInput) {
    modelOpacityInput.addEventListener('input', () => {
      if (scene.selectedModelId === null) return;
      const opacity = parseFloat(modelOpacityInput.value);
      if (modelOpacityValueSpan) modelOpacityValueSpan.textContent = opacity.toFixed(2);
      scene.setModelRenderMode(scene.selectedModelId, 'transparent', opacity);
    });
  }

  function updateModelFromInputs() {
    if (scene.selectedModelId === null) return;
    scene.setModelTransform(
      scene.selectedModelId,
      parseFloat(modelPosXInput.value) || 0,
      parseFloat(modelPosYInput.value) || 0,
      parseFloat(modelPosZInput.value) || 0,
      parseFloat(modelRotYawInput.value) || 0,
      parseFloat(modelRotPitchInput.value) || 0,
      parseFloat(modelRotRollInput.value) || 0,
      parseFloat(modelScaleInput.value) || 1
    );
  }

  function renderModelList() {
    if (!modelListEl) return;
    modelListEl.innerHTML = '';
    if (scene.fbxModels.length === 0) {
      modelListEl.innerHTML = '<div class="empty-list-message">No models loaded</div>';
      return;
    }
    scene.fbxModels.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'model-list-row' + (entry.id === scene.selectedModelId ? ' selected' : '');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'model-list-name';
      nameSpan.textContent = entry.name;
      nameSpan.title = entry.name;
      nameSpan.addEventListener('click', () => {
        scene.selectModel(entry.id);
      });

      const visBtn = document.createElement('button');
      visBtn.className = 'model-visibility-btn';
      visBtn.textContent = entry.visible ? '👁' : '🚫';
      visBtn.title = entry.visible ? 'Hide model' : 'Show model';
      visBtn.addEventListener('click', () => {
        scene.toggleModelVisibility(entry.id);
        renderModelList();
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'model-remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove model';
      removeBtn.addEventListener('click', () => {
        const wasSelected = entry.id === scene.selectedModelId;
        scene.removeFBXModel(entry.id);
        if (wasSelected) {
          setModelInputsEnabled(false);
          modelPosXInput.value = 0;
          modelPosYInput.value = 0;
          modelPosZInput.value = 0;
          modelRotYawInput.value = 0;
          modelRotPitchInput.value = 0;
          modelRotRollInput.value = 0;
          modelScaleInput.value = 1;
        }
        renderModelList();
      });

      row.appendChild(nameSpan);
      row.appendChild(visBtn);
      row.appendChild(removeBtn);
      modelListEl.appendChild(row);
    });
  }

  async function handleLoadFbx() {
    try {
      let id;
      if (window.electronAPI) {
        // Desktop: read binary then parse; store the file path so the model
        // can be reloaded from the filesystem when the config is reopened
        const result = await window.electronAPI.openFbxFile();
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;
        const filePath = result.filePaths[0];
        const fileName = filePath.split(/[/\\]/).pop();
        const uint8arr = await window.electronAPI.readFileBinary(filePath);
        const fbxBuffer = uint8arr.buffer.slice(uint8arr.byteOffset, uint8arr.byteOffset + uint8arr.byteLength);
        id = scene.loadFBXModelFromBuffer(fbxBuffer, fileName, filePath);
      } else {
        // Web: use file input (no persistable filesystem path)
        if (!fbxFileInput) return;
        fbxFileInput.click();
        id = await new Promise((resolve) => {
          fbxFileInput.onchange = async () => {
            const file = fbxFileInput.files[0];
            if (!file) { resolve(null); return; }
            const buffer = await file.arrayBuffer();
            const newId = scene.loadFBXModelFromBuffer(buffer, file.name, null);
            resolve(newId);
          };
        });
      }
      if (id === null || id === undefined) return;
      renderModelList();
      scene.selectModel(id);
    } catch (error) {
      console.error('Error loading FBX:', error);
    }
  }

  // --- Display list ---

  // Build list of input-row elements hidden in multi-select mode
  const singleSelectOnlyRows = [
    presetSizeSelect ? presetSizeSelect.closest('.input-row') : null,
    displayNameInput ? displayNameInput.closest('.input-row') : null,
    displayWidthInput ? displayWidthInput.closest('.input-row') : null,
    displayHeightInput ? displayHeightInput.closest('.input-row') : null,
    displayAngleInput ? displayAngleInput.closest('.input-row') : null,
    displayPitchInput ? displayPitchInput.closest('.input-row') : null,
    displayRollInput ? displayRollInput.closest('.input-row') : null,
    nearPlaneInput ? nearPlaneInput.closest('.input-row') : null,
    showNearPlaneInput ? showNearPlaneInput.closest('.input-row') : null,
  ].filter(Boolean);

  // Inline info element shown in multi-select mode
  const multiSelectInfo = document.createElement('div');
  multiSelectInfo.className = 'multi-select-info';
  multiSelectInfo.style.display = 'none';
  const posXRow = displayOffsetXInput ? displayOffsetXInput.closest('.input-row') : null;
  if (posXRow) posXRow.parentNode.insertBefore(multiSelectInfo, posXRow);

  /**
   * Switch the display settings panel between 'single' and 'multi' modes.
   * In multi mode only the X/Y/Z position fields are visible (read-only).
   */
  function setDisplayPanelMode(mode, count) {
    if (mode === 'multi') {
      singleSelectOnlyRows.forEach(row => { row.style.display = 'none'; });
      multiSelectInfo.style.display = '';
      multiSelectInfo.textContent = `${count} displays selected`;
      displayOffsetXInput.readOnly = true;
      displayOffsetYInput.readOnly = true;
      displayOffsetZInput.readOnly = true;
      updateDisplayBtn.disabled = true;
      deleteDisplayBtn.disabled = false;
      deleteDisplayBtn.textContent = 'Delete Selected';
    } else {
      singleSelectOnlyRows.forEach(row => { row.style.display = ''; });
      multiSelectInfo.style.display = 'none';
      displayOffsetXInput.readOnly = false;
      displayOffsetYInput.readOnly = false;
      displayOffsetZInput.readOnly = false;
      deleteDisplayBtn.textContent = 'Delete Display';
    }
  }

  /**
   * Handle Ctrl+click multi-selection from the viewport.
   * Switches the UI to position-only mode and attaches a shared gizmo.
   */
  function selectMultipleDisplays(indices) {
    if (indices.length === 0) {
      selectDisplay(-1);
      return;
    }
    if (indices.length === 1) {
      selectDisplay(indices[0]);
      return;
    }

    selectedDisplayIndices = [...indices];
    selectedDisplayIndex = indices[indices.length - 1];
    updateDisplayList();

    const primaryDisplay = displays[selectedDisplayIndex];
    if (primaryDisplay) {
      displayOffsetXInput.value = primaryDisplay.x;
      displayOffsetYInput.value = primaryDisplay.y;
      displayOffsetZInput.value = primaryDisplay.z;
    }
    setDisplayPanelMode('multi', indices.length);
    projectionResults.innerHTML = `<div class="info-placeholder">${indices.length} displays selected — use gizmo to move</div>`;
    scene.selectMultipleDisplays(indices, indices.map(i => displays[i]));
    updateNearPlaneVisualization();
  }

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
      if (selectedDisplayIndices.includes(index)) {
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
    selectedDisplayIndices = index >= 0 ? [index] : [];
    setDisplayPanelMode('single');
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
    const nearPlane = display.nearPlane != null ? display.nearPlane : null;
    projectionResults.innerHTML = formatDisplayCalculations(result, display, true, nearPlane);
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
    selectedDisplayIndices = [];
    fileInterface.createNew();
    scene.setEyeTransform(0, 0, 0);
    updateEyeInputs({ x: 0, y: 0, z: 0 });
    setDisplayPanelMode('single');
    updateDisplayList();
    projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
  }

  /**
   * Reload FBX models referenced by a saved configuration.
   * Desktop: loads each model from its stored filesystem path and reapplies
   * transform/render/visibility state. Web: cannot access arbitrary paths, so
   * model reload is skipped (user must re-add models manually).
   * @param {Array} models - Model metadata from the saved config
   */
  async function reloadModelsFromConfig(models) {
    if (!models || models.length === 0) return;

    if (!window.electronAPI) {
      fileInterface.showNotification(
        'Models are not auto-loaded in the web version — re-add them manually.',
        'info'
      );
      return;
    }

    for (const m of models) {
      if (!m.filePath) continue;
      try {
        const id = await scene.loadFBXModel(m.filePath, m.name);
        scene.setModelTransform(id, m.x, m.y, m.z, m.yaw, m.pitch, m.roll, m.scale);
        scene.setModelRenderMode(id, m.renderMode, m.opacity);
        if (m.visible === false) scene.toggleModelVisibility(id);
      } catch (error) {
        console.error('Error reloading model:', m.filePath, error);
        fileInterface.showNotification(
          `Could not load model "${m.name}" from ${m.filePath}`,
          'error'
        );
      }
    }
    renderModelList();
  }

  async function handleOpenConfigFile() {
    try {
      if (displays.length > 0 && !fileInterface.confirmUnsavedChanges('open a new configuration')) {
        return;
      }
      const result = await fileInterface.openFile();
      if (result.canceled) return;
      displays.length = 0;
      selectedDisplayIndices = [];
      [...scene.fbxModels].forEach(m => scene.removeFBXModel(m.id));
      displays.push(...result.config.displays);
      updateDisplayList();
      rebuildAllDisplayMeshes();
      // Restore eye position (defaults to origin for older configs)
      const eye = result.config.eye || { x: 0, y: 0, z: 0 };
      scene.setEyeTransform(eye.x || 0, eye.y || 0, eye.z || 0);
      updateEyeInputs({ x: eye.x || 0, y: eye.y || 0, z: eye.z || 0 });
      await reloadModelsFromConfig(result.config.models || []);
      if (displays.length > 0) {
        selectDisplay(0);
      } else {
        selectedDisplayIndex = -1;
        setDisplayPanelMode('single');
        updateDisplayBtn.disabled = true;
        projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  }

  async function handleSaveConfig() {
    try {
      const models = scene.getFBXModelsForExport();
      await fileInterface.saveFile(displays, models, false, scene.getEyeTransform());
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  async function handleSaveConfigAs() {
    try {
      const models = scene.getFBXModelsForExport();
      await fileInterface.saveFile(displays, models, true, scene.getEyeTransform());
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  function deleteDisplay() {
    const toDelete = selectedDisplayIndices.length > 1
      ? [...selectedDisplayIndices]
      : (selectedDisplayIndex >= 0 ? [selectedDisplayIndex] : []);
    if (toDelete.length === 0) return;

    const msg = toDelete.length > 1
      ? `Delete ${toDelete.length} selected displays?`
      : `Are you sure you want to delete Display ${toDelete[0] + 1}?`;
    if (!confirm(msg)) return;

    // Remove from highest index to lowest to avoid index-shifting issues
    toDelete.sort((a, b) => b - a).forEach(index => {
      scene.removeDisplay(index);
      displays.splice(index, 1);
    });

    selectedDisplayIndex = -1;
    selectedDisplayIndices = [];

    if (displays.length === 0) {
      updateDisplayList();
      setDisplayPanelMode('single');
      updateDisplayBtn.disabled = true;
      deleteDisplayBtn.disabled = true;
      projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
    } else {
      selectDisplay(Math.min(toDelete[toDelete.length - 1], displays.length - 1));
      updateDisplayList();
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

  // Show near plane checkbox
  if (showNearPlaneInput) {
    showNearPlaneInput.addEventListener('change', () => {
      if (selectedDisplayIndex >= 0) {
        displays[selectedDisplayIndex].showNearPlane = showNearPlaneInput.checked;
        updateNearPlaneVisualization();
        fileInterface.markUnsaved();
      }
    });
  }

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
  modelInputs.forEach(input => {
    if (input) input.addEventListener('input', updateModelFromInputs);
  });

  // Initialize
  updateDisplayList();
  renderModelList();
}
