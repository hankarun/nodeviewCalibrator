/**
 * FBX model list, transform/render-mode inputs, and loading — the Model
 * controls that sit alongside the display and eye panels.
 */
export function createModelPanel({ scene, elements, fileInterface, displayPanel }) {
  const {
    loadFbxBtn, modelListEl,
    modelPosXInput, modelPosYInput, modelPosZInput,
    modelRotYawInput, modelRotPitchInput, modelRotRollInput,
    modelScaleInput, modelRenderModeSelect, modelOpacityInput,
    modelOpacityValueSpan, modelOpacityRow, modelInputs, fbxFileInput,
    projectionResults
  } = elements;

  function setModelInputsEnabled(enabled) {
    modelInputs.forEach(input => { if (input) input.disabled = !enabled; });
    if (!enabled && modelOpacityRow) modelOpacityRow.style.display = 'none';
  }

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
      displayPanel.clearSelectionForModelPick();
      projectionResults.innerHTML = '<div class="info-placeholder">FBX model selected</div>';
      populateModelTransformInputs(idOrFalse);
      setModelInputsEnabled(true);
      renderModelList();
    } else {
      setModelInputsEnabled(false);
      renderModelList();
    }
  };

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

  if (loadFbxBtn) loadFbxBtn.addEventListener('click', handleLoadFbx);
  modelInputs.forEach(input => {
    if (input) input.addEventListener('input', updateModelFromInputs);
  });

  renderModelList();

  return { handleLoadFbx, renderModelList, reloadModelsFromConfig };
}
