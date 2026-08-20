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
  const autoUpdateInput = document.getElementById('autoUpdateDisplay');
  const displayListContainer = document.getElementById('displayList');
  const projectionResults = document.getElementById('projectionResults');
  const presetSizeSelect = document.getElementById('presetSize');

  // Per-display near plane input
  const nearPlaneInput = document.getElementById('nearPlane');
  const showNearPlaneInput = document.getElementById('showNearPlane');

  // Add Display dialog. Its fields mirror the Display Settings panel, but the
  // panel edits the current selection while the dialog describes a new display.
  const addDisplayDialog = document.getElementById('addDisplayDialog');
  const addDisplayConfirmBtn = document.getElementById('addDisplayConfirmBtn');
  const addDisplayCancelBtn = document.getElementById('addDisplayCancelBtn');
  const addDisplayError = document.getElementById('addDisplayError');
  const dlg = {
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
  };

  // Right-click menu for the display list; it replaces the Delete button that
  // used to sit in the Display Settings panel.
  const displayContextMenu = document.getElementById('displayContextMenu');

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

  /**
   * Show one of the left-column panels, updating the tab strip to match.
   * @param {string} target - Panel element id (e.g. 'tab-eye')
   */
  function activatePanel(target) {
    const panel = document.getElementById(target);
    if (!panel) return;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.target === target);
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    panel.classList.remove('hidden');
    // Attach the eye gizmo while the Eye tab is open; detach it otherwise.
    if (target === 'tab-eye') {
      scene.selectEye();
    } else if (scene.eyeSelected) {
      scene.deselectEye();
    }
    reportUiState({ activePanel: target });
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activatePanel(btn.dataset.target));
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
  let globalFovScale = 1.0;

  // Global FOV scale input
  const globalFovScaleInput = document.getElementById('globalFovScale');

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
    activatePanel('tab-eye');
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

  if (globalFovScaleInput) {
    globalFovScaleInput.addEventListener('input', () => {
      const val = parseFloat(globalFovScaleInput.value);
      if (!isNaN(val) && val > 0) {
        globalFovScale = val;
        if (selectedDisplayIndex >= 0 && selectedDisplayIndex < displays.length) {
          showDisplayCalculations(displays[selectedDisplayIndex]);
        }
        fileInterface.markUnsaved();
      }
    });
  }

  /** Move the eye rig back to the world origin. */
  function resetEye() {
    scene.setEyeTransform(0, 0, 0);
    updateEyeInputs({ x: 0, y: 0, z: 0 });
    fileInterface.markUnsaved();
  }

  if (resetEyeBtn) {
    resetEyeBtn.addEventListener('click', resetEye);
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
    autoUpdateInput ? autoUpdateInput.closest('.input-row') : null,
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
    } else {
      singleSelectOnlyRows.forEach(row => { row.style.display = ''; });
      multiSelectInfo.style.display = 'none';
      displayOffsetXInput.readOnly = false;
      displayOffsetYInput.readOnly = false;
      displayOffsetZInput.readOnly = false;
    }
    syncUpdateButton();
  }

  /**
   * Whether panel edits should reach the selected display as they are typed.
   * @returns {boolean} True when the auto-update checkbox is on (or absent)
   */
  function isAutoUpdateOn() {
    return !autoUpdateInput || autoUpdateInput.checked;
  }

  /**
   * Keep the Update Display button in step with the selection and the
   * auto-update toggle. The button only has work to do when auto-update is off
   * and exactly one display is selected.
   */
  function syncUpdateButton() {
    const singleSelection = selectedDisplayIndex >= 0 && selectedDisplayIndices.length <= 1;
    const auto = isAutoUpdateOn();
    updateDisplayBtn.disabled = auto || !singleSelection;
    updateDisplayBtn.title = auto
      ? 'Not needed while Auto-update display is on'
      : 'Apply the values above to the selected display';
    reportUiState({ autoUpdate: auto });
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
    reportUiState({ hasSelection: indices.length > 0 });
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
      displayItem.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        // Right-clicking outside the current selection retargets it, the way a
        // file manager treats a right-click on an unselected row.
        if (!selectedDisplayIndices.includes(index)) selectDisplay(index);
        openDisplayContextMenu(event.clientX, event.clientY);
      });
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

      reportUiState({ hasSelection: true });

      showDisplayCalculations(display);
      scene.selectDisplay(index, display);
      updateNearPlaneVisualization();
    } else {
      reportUiState({ hasSelection: false });
      scene.selectDisplay(-1);
      updateNearPlaneVisualization();
    }
  }

  // --- Calculations ---

  function showDisplayCalculations(display) {
    // Always update nearestPoint on the real display object so visualizations stay accurate.
    calculateDisplayProjection(display);
    const scaledDisplay = globalFovScale !== 1.0 ? {
      ...display,
      x: display.x / globalFovScale,
      y: display.y / globalFovScale,
      z: display.z / globalFovScale
    } : display;
    const result = calculateDisplayProjection(scaledDisplay);
    const nearPlane = display.nearPlane != null ? display.nearPlane : null;
    projectionResults.innerHTML = formatDisplayCalculations(result, scaledDisplay, true, nearPlane);
  }

  function updateNearPlaneVisualization() {
    scene.updateAllNearPlanes(displays, selectedDisplayIndex);
  }

  // --- Display CRUD ---

  /**
   * Raw (unparsed) values currently held by the Display Settings panel.
   * @returns {Object} Field values keyed the way createDisplayFromInputs wants
   */
  function readDisplayPanel() {
    return {
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
  }

  function getDisplayFromInputs() {
    return createDisplayFromInputs(readDisplayPanel());
  }

  /**
   * Check a set of raw display field values before they reach the scene.
   * @param {Object} values - Field values in readDisplayPanel's shape
   * @returns {string|null} A message describing the first problem, or null
   */
  function findInvalidDisplayValues(values) {
    const angleAndPosition = [
      ['yaw', 'Yaw'], ['pitch', 'Pitch'], ['roll', 'Roll'],
      ['x', 'X position'], ['y', 'Y position'], ['z', 'Z position']
    ];
    for (const [key, label] of angleAndPosition) {
      if (!Number.isFinite(parseFloat(values[key]))) return label + ' must be a number.';
    }
    const width = parseFloat(values.width);
    const height = parseFloat(values.height);
    if (!Number.isFinite(width) || width <= 0) return 'Width must be greater than 0.';
    if (!Number.isFinite(height) || height <= 0) return 'Height must be greater than 0.';
    if (values.nearPlane !== null && values.nearPlane !== '') {
      const nearPlane = parseFloat(values.nearPlane);
      if (!Number.isFinite(nearPlane) || nearPlane <= 0) {
        return 'Near plane must be greater than 0, or empty for automatic.';
      }
    }
    return null;
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

  async function handleNewConfig() {
    if (displays.length > 0 && !await fileInterface.confirmUnsavedChanges('create a new configuration')) {
      return;
    }
    displays.length = 0;
    selectedDisplayIndex = -1;
    selectedDisplayIndices = [];
    fileInterface.createNew();
    scene.setEyeTransform(0, 0, 0);
    updateEyeInputs({ x: 0, y: 0, z: 0 });
    globalFovScale = 1.0;
    if (globalFovScaleInput) globalFovScaleInput.value = 1.0;
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

  /**
   * Load a configuration, prompting for the file unless a path is supplied.
   * @param {string|null} [knownFilePath] - Path from File > Open Recent
   */
  async function handleOpenConfigFile(knownFilePath = null) {
    try {
      if (displays.length > 0 && !await fileInterface.confirmUnsavedChanges('open a new configuration')) {
        return;
      }
      const result = await fileInterface.openFile(knownFilePath);
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
      // Restore global FOV scale (defaults to 1.0 for older configs)
      const parsedFovScale = parseFloat(result.config.fovScale);
      globalFovScale = (Number.isFinite(parsedFovScale) && parsedFovScale > 0) ? parsedFovScale : 1.0;
      if (globalFovScaleInput) globalFovScaleInput.value = globalFovScale;
      await reloadModelsFromConfig(result.config.models || []);
      if (displays.length > 0) {
        selectDisplay(0);
      } else {
        selectedDisplayIndex = -1;
        setDisplayPanelMode('single');
        projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
      }
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
      const result = await fileInterface.saveFile(displays, models, false, scene.getEyeTransform(), globalFovScale);
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
      const result = await fileInterface.saveFile(displays, models, true, scene.getEyeTransform(), globalFovScale);
      return !result.canceled;
    } catch (error) {
      console.error('Error saving file:', error);
      return false;
    }
  }

  /**
   * Delete the selected display(s) after confirmation.
   * @returns {Promise<boolean>} True if displays were removed
   */
  async function deleteDisplay() {
    const toDelete = selectedDisplayIndices.length > 1
      ? [...selectedDisplayIndices]
      : (selectedDisplayIndex >= 0 ? [selectedDisplayIndex] : []);
    if (toDelete.length === 0) return false;

    const msg = toDelete.length > 1
      ? `Delete ${toDelete.length} selected displays?`
      : `Are you sure you want to delete Display ${toDelete[0] + 1}?`;
    if (!await fileInterface.confirmAction(msg, 'Delete')) return false;

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
      reportUiState({ hasSelection: false });
      projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
    } else {
      selectDisplay(Math.min(toDelete[toDelete.length - 1], displays.length - 1));
      updateDisplayList();
    }

    return true;
  }

  // --- Event listeners ---

  /**
   * Append a display and make it the selection.
   * @param {Object} display - Display object from createDisplayFromInputs
   */
  function addDisplay(display) {
    displays.push(display);
    scene.addDisplay(display);
    selectDisplay(displays.length - 1);
    updateDisplayList();
    fileInterface.markUnsaved();
  }

  /** Write the current input values back onto the selected display. */
  function updateSelectedDisplay() {
    if (selectedDisplayIndex < 0) return;
    displays[selectedDisplayIndex] = getDisplayFromInputs();
    scene.updateDisplay(selectedDisplayIndex, displays[selectedDisplayIndex]);
    showDisplayCalculations(displays[selectedDisplayIndex]);
    updateNearPlaneVisualization();
    updateDisplayList();
    fileInterface.markUnsaved();
  }

  /**
   * Turn auto-update on or off from the native menu, keeping the panel
   * checkbox in step.
   * @param {boolean} enabled - Desired state
   */
  function setAutoUpdate(enabled) {
    if (!autoUpdateInput) return;
    autoUpdateInput.checked = !!enabled;
    syncUpdateButton();
    applyLiveDisplayEdit();
  }

  /**
   * Push the panel values onto the selected display while the user edits them.
   * Half-typed or impossible values are skipped rather than sent to the scene,
   * so a field can be cleared and retyped without the display disappearing.
   */
  function applyLiveDisplayEdit() {
    if (!isAutoUpdateOn()) return;
    if (selectedDisplayIndex < 0 || selectedDisplayIndices.length > 1) return;
    if (findInvalidDisplayValues(readDisplayPanel())) return;
    updateSelectedDisplay();
  }

  /** Delete the current selection after confirming with the user. */
  async function deleteSelectedDisplay() {
    if (await deleteDisplay()) fileInterface.markUnsaved();
  }

  addDisplayBtn.addEventListener('click', openAddDisplayDialog);
  updateDisplayBtn.addEventListener('click', updateSelectedDisplay);

  // Every editable field of the panel feeds the same auto-update path, so the
  // Update Display button is only ever needed with auto-update switched off.
  [
    displayNameInput, displayWidthInput, displayHeightInput,
    displayAngleInput, displayPitchInput, displayRollInput,
    displayOffsetXInput, displayOffsetYInput, displayOffsetZInput,
    nearPlaneInput
  ].forEach(input => {
    if (input) input.addEventListener('input', applyLiveDisplayEdit);
  });

  // Registered after the listener that copies the preset into width/height.
  if (presetSizeSelect) presetSizeSelect.addEventListener('change', applyLiveDisplayEdit);
  if (showNearPlaneInput) showNearPlaneInput.addEventListener('change', applyLiveDisplayEdit);

  if (autoUpdateInput) {
    autoUpdateInput.addEventListener('change', () => {
      syncUpdateButton();
      // Switching it back on catches up with anything typed while it was off.
      applyLiveDisplayEdit();
    });
  }

  // --- Add Display dialog ---

  // The dialog keeps the values it was last confirmed with, so adding a row of
  // similar displays doesn't mean retyping the same numbers each time.
  let addDialogValues = {
    name: '', width: '0.5', height: '0.3',
    yaw: '0', pitch: '0', roll: '0',
    x: '0', y: '0', z: '0.7',
    nearPlane: '', showNearPlane: false
  };

  /**
   * Read the dialog fields.
   * @returns {Object} Raw field values in readDisplayPanel's shape
   */
  function readAddDialog() {
    return {
      name: dlg.name.value,
      width: dlg.width.value,
      height: dlg.height.value,
      yaw: dlg.yaw.value,
      pitch: dlg.pitch.value,
      roll: dlg.roll.value,
      x: dlg.x.value,
      y: dlg.y.value,
      z: dlg.z.value,
      nearPlane: dlg.nearPlane.value,
      showNearPlane: dlg.showNearPlane.checked
    };
  }

  /**
   * Fill the dialog fields.
   * @param {Object} values - Raw field values as returned by readAddDialog
   */
  function writeAddDialog(values) {
    dlg.preset.value = '';
    dlg.name.value = values.name;
    dlg.width.value = values.width;
    dlg.height.value = values.height;
    dlg.yaw.value = values.yaw;
    dlg.pitch.value = values.pitch;
    dlg.roll.value = values.roll;
    dlg.x.value = values.x;
    dlg.y.value = values.y;
    dlg.z.value = values.z;
    dlg.nearPlane.value = values.nearPlane;
    dlg.showNearPlane.checked = !!values.showNearPlane;
  }

  /** Open the Add Display dialog, seeded with the last values used. */
  function openAddDisplayDialog() {
    if (!addDisplayDialog) return;
    closeDisplayContextMenu();
    writeAddDialog(addDialogValues);
    addDisplayError.textContent = '';
    addDisplayDialog.classList.remove('hidden');
    dlg.name.focus();
    dlg.name.select();
  }

  /** Dismiss the Add Display dialog without adding anything. */
  function closeAddDisplayDialog() {
    if (addDisplayDialog) addDisplayDialog.classList.add('hidden');
  }

  /**
   * Add the display the dialog describes. Bad values leave the dialog open
   * with an explanation rather than producing a broken display.
   */
  function confirmAddDisplay() {
    const values = readAddDialog();
    const problem = findInvalidDisplayValues(values);
    if (problem) {
      addDisplayError.textContent = problem;
      return;
    }
    addDialogValues = values;
    addDisplay(createDisplayFromInputs(values));
    closeAddDisplayDialog();
  }

  if (addDisplayDialog) {
    dlg.preset.addEventListener('change', () => {
      const preset = displayPresets[dlg.preset.value];
      if (preset) {
        dlg.width.value = preset.width;
        dlg.height.value = preset.height;
      }
    });
    addDisplayConfirmBtn.addEventListener('click', confirmAddDisplay);
    addDisplayCancelBtn.addEventListener('click', closeAddDisplayDialog);
    // Only a press on the backdrop itself dismisses the dialog.
    addDisplayDialog.addEventListener('mousedown', (event) => {
      if (event.target === addDisplayDialog) closeAddDisplayDialog();
    });
    addDisplayDialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeAddDisplayDialog();
      } else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') {
        event.preventDefault();
        confirmAddDisplay();
      }
    });
  }

  // --- Display list right-click menu ---

  /** Hide the display list context menu. */
  function closeDisplayContextMenu() {
    if (displayContextMenu) displayContextMenu.classList.add('hidden');
  }

  /**
   * Show the display list context menu, built for the current selection.
   * @param {number} clientX - Preferred left edge, in viewport coordinates
   * @param {number} clientY - Preferred top edge, in viewport coordinates
   */
  function openDisplayContextMenu(clientX, clientY) {
    if (!displayContextMenu) return;

    const count = selectedDisplayIndices.length;
    const items = [{ label: 'Add Display\u2026', action: openAddDisplayDialog }];
    if (count > 0) {
      items.push({ separator: true });
      items.push({
        label: count > 1 ? 'Delete ' + count + ' Selected Displays' : 'Delete Display',
        danger: true,
        action: () => {
          deleteSelectedDisplay().catch(error => console.error('Error deleting display:', error));
        }
      });
    }

    displayContextMenu.innerHTML = '';
    items.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        displayContextMenu.appendChild(separator);
        return;
      }
      const entry = document.createElement('div');
      entry.className = item.danger ? 'context-menu-item danger' : 'context-menu-item';
      entry.textContent = item.label;
      entry.addEventListener('click', () => {
        closeDisplayContextMenu();
        item.action();
      });
      displayContextMenu.appendChild(entry);
    });

    // Place it at the pointer, then pull it back inside the window if the menu
    // would hang off the right or bottom edge.
    displayContextMenu.style.left = clientX + 'px';
    displayContextMenu.style.top = clientY + 'px';
    displayContextMenu.classList.remove('hidden');
    const rect = displayContextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      displayContextMenu.style.left = Math.max(0, window.innerWidth - rect.width - 4) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      displayContextMenu.style.top = Math.max(0, window.innerHeight - rect.height - 4) + 'px';
    }
  }

  if (displayListContainer) {
    // Right-clicking the empty part of the list still offers "Add Display".
    displayListContainer.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openDisplayContextMenu(event.clientX, event.clientY);
    });
  }

  window.addEventListener('mousedown', (event) => {
    if (displayContextMenu && !displayContextMenu.contains(event.target)) {
      closeDisplayContextMenu();
    }
  });
  window.addEventListener('blur', closeDisplayContextMenu);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDisplayContextMenu();
  });

  // --- Camera & gizmo controls ---

  /**
   * Switch the viewport camera and keep the toolbar buttons in step.
   * @param {'orbit'|'firstperson'} mode - Camera mode
   */
  function setCameraMode(mode) {
    scene.setCameraMode(mode);
    if (orbitModeBtn) orbitModeBtn.classList.toggle('active', mode === 'orbit');
    if (fpModeBtn) fpModeBtn.classList.toggle('active', mode === 'firstperson');
    reportUiState({ cameraMode: mode });
  }

  /**
   * Switch the transform gizmo and keep the toolbar buttons in step.
   * @param {'translate'|'rotate'} mode - Gizmo mode
   */
  function setGizmoMode(mode) {
    scene.setGizmoMode(mode);
    syncGizmoButtons(mode);
  }

  /**
   * Reflect a gizmo mode in the toolbar without re-issuing it to the scene —
   * used when the scene changed mode itself in response to the T/R keys.
   * @param {'translate'|'rotate'} mode - Gizmo mode
   */
  function syncGizmoButtons(mode) {
    if (translateModeBtn) translateModeBtn.classList.toggle('active', mode === 'translate');
    if (rotateModeBtn) rotateModeBtn.classList.toggle('active', mode === 'rotate');
  }

  if (orbitModeBtn) orbitModeBtn.addEventListener('click', () => setCameraMode('orbit'));
  if (fpModeBtn) fpModeBtn.addEventListener('click', () => setCameraMode('firstperson'));
  if (resetCameraBtn) resetCameraBtn.addEventListener('click', () => scene.resetCamera());
  if (translateModeBtn) translateModeBtn.addEventListener('click', () => setGizmoMode('translate'));
  if (rotateModeBtn) rotateModeBtn.addEventListener('click', () => setGizmoMode('rotate'));

  // The scene owns the T/R keys; mirror the result in the toolbar and menu.
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 't' || e.key === 'T') {
      syncGizmoButtons('translate');
    } else if (e.key === 'r' || e.key === 'R') {
      syncGizmoButtons('rotate');
    }
  });

  // File operation buttons (absent on desktop, where the menu bar replaces them)
  if (newConfigBtn) newConfigBtn.addEventListener('click', handleNewConfig);
  if (openConfigBtn) openConfigBtn.addEventListener('click', () => handleOpenConfigFile());
  if (saveConfigBtn) saveConfigBtn.addEventListener('click', handleSaveConfig);
  if (saveAsConfigBtn) saveAsConfigBtn.addEventListener('click', handleSaveConfigAs);

  // Model controls
  if (loadFbxBtn) loadFbxBtn.addEventListener('click', handleLoadFbx);
  modelInputs.forEach(input => {
    if (input) input.addEventListener('input', updateModelFromInputs);
  });

  // --- Native menu commands (desktop only) ---

  /**
   * Run a command issued from the native application menu. Every branch
   * routes to the same handler the equivalent in-page control uses.
   * @param {string} command - Command identifier from desktop/menu.js
   * @param {*} payload - Optional command argument
   */
  async function handleMenuCommand(command, payload) {
    switch (command) {
      case 'new-config': await handleNewConfig(); break;
      case 'open-config': await handleOpenConfigFile(); break;
      case 'open-recent': await handleOpenConfigFile(payload); break;
      case 'save-config': await handleSaveConfig(); break;
      case 'save-config-as': await handleSaveConfigAs(); break;
      case 'save-and-close': {
        // Triggered by the "Save" button of the close prompt: the window only
        // closes once the write actually succeeded.
        const saved = await handleSaveConfig();
        window.electronAPI.closeAfterSave(saved);
        break;
      }
      case 'load-fbx': await handleLoadFbx(); break;
      case 'add-display': openAddDisplayDialog(); break;
      case 'update-display': updateSelectedDisplay(); break;
      case 'toggle-auto-update': setAutoUpdate(payload); break;
      case 'delete-display': await deleteSelectedDisplay(); break;
      case 'show-panel': activatePanel(payload); break;
      case 'reset-eye': resetEye(); break;
      case 'camera-mode': setCameraMode(payload); break;
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
  updateDisplayList();
  renderModelList();
  syncUpdateButton();
  reportUiState({
    cameraMode: 'orbit',
    activePanel: 'tab-display-settings',
    hasSelection: false,
    autoUpdate: isAutoUpdateOn()
  });
}
