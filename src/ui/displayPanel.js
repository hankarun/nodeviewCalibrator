import {
  createDisplayFromInputs, calculateDisplayProjection, formatDisplayCalculations, displayPresets,
  DEFAULT_BORDER_WIDTH_CM, isBorderExcludedFromFov
} from '../display.js';

/**
 * Display list panel: the list of displays, the Display Settings fields that
 * edit the selection, the Add Display dialog, and the list's right-click menu.
 * Owns the `displays` array and the current selection — the state most other
 * parts of the app (file operations, model panel) need to read or clear.
 */
export function createDisplayPanel({ scene, elements, fileInterface, statusBar, reportUiState }) {
  const {
    displayWidthInput, displayHeightInput, displayAngleInput, displayPitchInput, displayRollInput,
    displayOffsetXInput, displayOffsetYInput, displayOffsetZInput, displayNameInput,
    addDisplayBtn, updateDisplayBtn, autoUpdateInput, displayListContainer, projectionResults,
    presetSizeSelect, nearPlaneInput, showNearPlaneInput,
    borderWidthInput, excludeBordersFromFovInput,
    addDisplayDialog, addDisplayConfirmBtn, addDisplayCancelBtn, addDisplayError, dlg,
    displayContextMenu, globalFovScaleInput
  } = elements;

  // Store displays
  const displays = [];
  let selectedDisplayIndex = -1;
  let selectedDisplayIndices = [];  // All currently selected display indices
  // Where a Shift+click range starts from, the way a file list works.
  let selectionAnchorIndex = -1;
  let globalFovScale = 1.0;

  // Set display dimensions when preset is selected
  presetSizeSelect.addEventListener('change', function() {
    const selectedSize = this.value;
    if (selectedSize && displayPresets[selectedSize]) {
      displayWidthInput.value = displayPresets[selectedSize].width;
      displayHeightInput.value = displayPresets[selectedSize].height;
    }
  });

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
    queueDisplayListUpdate();
    fileInterface.markUnsaved();
  };

  scene.onDisplaySelect = (index) => {
    selectDisplay(index);
  };

  scene.onDragEnd = (index, indices) => {
    if (Array.isArray(indices) && indices.length > 1) {
      // Keep the multi-selection intact — re-selecting rebuilds the shared
      // pivot around where the displays ended up, so the next drag starts from
      // the new centroid instead of collapsing to a single display.
      indices.forEach(i => { if (displays[i]) calculateDisplayProjection(displays[i]); });
      scene.selectMultipleDisplays(indices, indices.map(i => displays[i]));
    } else if (index >= 0 && displays[index]) {
      scene.selectDisplay(index, displays[index]);
    }
    updateNearPlaneVisualization();
  };

  scene.onMultiSelect = (indices) => {
    selectMultipleDisplays(indices);
  };

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

  // --- Display list ---

  // Build list of input-row elements hidden in multi-select mode
  const singleSelectOnlyRows = [
    presetSizeSelect ? presetSizeSelect.closest('.input-row') : null,
    displayNameInput ? displayNameInput.closest('.input-row') : null,
    displayWidthInput ? displayWidthInput.closest('.input-row') : null,
    displayHeightInput ? displayHeightInput.closest('.input-row') : null,
    borderWidthInput ? borderWidthInput.closest('.input-row') : null,
    excludeBordersFromFovInput ? excludeBordersFromFovInput.closest('.input-row') : null,
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
      multiSelectInfo.textContent = `${count} displays selected — drag the gizmo to transform them together`;
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
   * Select a set of displays and give them one shared gizmo, so dragging it
   * moves (or rotates) all of them together about their centroid. Reached from
   * Ctrl+click in the viewport, Ctrl/Shift+click in the list, and Select All.
   * Switches the UI to position-only mode; the last index is the primary.
   * @param {number[]} indices - Display indices to select
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
    projectionResults.innerHTML = `<div class="info-placeholder">${indices.length} displays selected — drag the gizmo to move or rotate them together</div>`;
    scene.selectMultipleDisplays(indices, indices.map(i => displays[i]));
    updateNearPlaneVisualization();
  }

  /** Select every display so the gizmo transforms the whole rig at once. */
  function selectAllDisplays() {
    if (displays.length === 0) return;
    selectionAnchorIndex = 0;
    selectMultipleDisplays(displays.map((_, i) => i));
  }

  // Dragging a multi-selection fires a change per display per frame, and each
  // one would otherwise rebuild the whole list. Collapse them into one rebuild.
  let displayListUpdateQueued = false;
  function queueDisplayListUpdate() {
    if (displayListUpdateQueued) return;
    displayListUpdateQueued = true;
    requestAnimationFrame(() => {
      displayListUpdateQueued = false;
      updateDisplayList();
    });
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
      displayItem.addEventListener('click', (event) => handleDisplayItemClick(index, event));
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

  /**
   * Selection click on a row of the display list.
   * Plain click replaces the selection, Ctrl/Cmd+click toggles one row, and
   * Shift+click takes the range back to the anchor. The clicked row is always
   * ordered last so it becomes the primary display.
   * @param {number} index - Row that was clicked
   * @param {MouseEvent} event - The originating click
   */
  function handleDisplayItemClick(index, event) {
    if (event.shiftKey && selectionAnchorIndex >= 0 && selectionAnchorIndex < displays.length) {
      // Shift-clicking a list drags a text selection along with it otherwise.
      window.getSelection().removeAllRanges();
      const range = [];
      const step = index >= selectionAnchorIndex ? 1 : -1;
      for (let i = selectionAnchorIndex; i !== index + step; i += step) range.push(i);
      selectMultipleDisplays(range);   // anchor deliberately left where it was
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      const next = selectedDisplayIndices.includes(index)
        ? selectedDisplayIndices.filter(i => i !== index)
        : [...selectedDisplayIndices, index];
      selectMultipleDisplays(next);
      selectionAnchorIndex = index;
      return;
    }

    selectDisplay(index);
  }

  function selectDisplay(index) {
    selectedDisplayIndex = index;
    selectedDisplayIndices = index >= 0 ? [index] : [];
    selectionAnchorIndex = index;
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

      // Border fields; configurations written before they existed fall back to
      // the same defaults createDisplayFromInputs applies.
      if (borderWidthInput) {
        borderWidthInput.value = display.borderWidthCm != null ? display.borderWidthCm : DEFAULT_BORDER_WIDTH_CM;
      }
      if (excludeBordersFromFovInput) {
        excludeBordersFromFovInput.checked = isBorderExcludedFromFov(display);
      }

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
      borderWidthCm: borderWidthInput ? borderWidthInput.value : undefined,
      excludeBordersFromFov: excludeBordersFromFovInput ? excludeBordersFromFovInput.checked : true,
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
    if (values.borderWidthCm !== undefined && values.borderWidthCm !== '') {
      const border = parseFloat(values.borderWidthCm);
      if (!Number.isFinite(border) || border < 0) return 'Border must be 0 or greater.';
      // Two bezels have to leave some active area behind, or there is nothing
      // left for the projection to be calculated from.
      const borderMeters = border / 100;
      if (2 * borderMeters >= Math.min(width, height)) {
        return 'Border is too large for the display size — two borders must fit inside the panel.';
      }
    }
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
    const previous = displays[selectedDisplayIndex];
    const updated = getDisplayFromInputs();
    // Border visibility and colour have no field in the panel, so carry over
    // whatever the display (or the configuration it came from) already had.
    if (previous) {
      if (previous.showBorders !== undefined) updated.showBorders = previous.showBorders;
      if (previous.borderColor !== undefined) updated.borderColor = previous.borderColor;
    }
    displays[selectedDisplayIndex] = updated;
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

  /**
   * Remove the currently selected display(s) after confirmation.
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
    selectionAnchorIndex = -1;

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

  /** Delete the current selection after confirming with the user. */
  async function deleteSelectedDisplay() {
    if (await deleteDisplay()) fileInterface.markUnsaved();
  }

  addDisplayBtn.addEventListener('click', openAddDisplayDialog);
  updateDisplayBtn.addEventListener('click', updateSelectedDisplay);

  // Every editable field of the panel feeds the same auto-update path, so the
  // Update Display button is only ever needed with auto-update switched off.
  [
    displayNameInput, displayWidthInput, displayHeightInput, borderWidthInput,
    displayAngleInput, displayPitchInput, displayRollInput,
    displayOffsetXInput, displayOffsetYInput, displayOffsetZInput,
    nearPlaneInput
  ].forEach(input => {
    if (input) input.addEventListener('input', applyLiveDisplayEdit);
  });

  // Registered after the listener that copies the preset into width/height.
  if (presetSizeSelect) presetSizeSelect.addEventListener('change', applyLiveDisplayEdit);
  if (showNearPlaneInput) showNearPlaneInput.addEventListener('change', applyLiveDisplayEdit);
  if (excludeBordersFromFovInput) excludeBordersFromFovInput.addEventListener('change', applyLiveDisplayEdit);

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
    borderWidthCm: String(DEFAULT_BORDER_WIDTH_CM), excludeBordersFromFov: true,
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
      borderWidthCm: dlg.borderWidth ? dlg.borderWidth.value : undefined,
      excludeBordersFromFov: dlg.excludeBordersFromFov ? dlg.excludeBordersFromFov.checked : true,
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
    if (dlg.borderWidth) dlg.borderWidth.value = values.borderWidthCm;
    if (dlg.excludeBordersFromFov) dlg.excludeBordersFromFov.checked = !!values.excludeBordersFromFov;
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
    const items = [{ label: 'Add Display…', action: openAddDisplayDialog }];
    if (displays.length > 1) {
      items.push({ label: 'Select All Displays', action: selectAllDisplays });
    }
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
    // Ctrl/Cmd+Shift+A selects every display. Plain Ctrl+A is left to the
    // text fields (and, on desktop, to Edit > Select All).
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault();
      selectAllDisplays();
    }
  });

  // --- Cross-module hooks (model panel, file operations) ---

  /** Clear the display selection without touching the scene (a model was picked instead). */
  function clearSelectionForModelPick() {
    selectedDisplayIndex = -1;
    selectedDisplayIndices = [];
    selectionAnchorIndex = -1;
    updateDisplayList();
    setDisplayPanelMode('single');
  }

  /** Replace the display list wholesale, e.g. after opening a configuration file. */
  function loadDisplays(newDisplays) {
    displays.length = 0;
    selectedDisplayIndices = [];
    selectionAnchorIndex = -1;
    displays.push(...newDisplays);
    updateDisplayList();
    rebuildAllDisplayMeshes();
  }

  /** Select the first display, or show the empty-state placeholder if there isn't one. */
  function finishSelectionAfterLoad() {
    if (displays.length > 0) {
      selectDisplay(0);
    } else {
      selectedDisplayIndex = -1;
      setDisplayPanelMode('single');
      projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
    }
  }

  /** Clear everything back to a blank configuration. */
  function resetForNewConfig() {
    displays.length = 0;
    selectedDisplayIndex = -1;
    selectedDisplayIndices = [];
    selectionAnchorIndex = -1;
    globalFovScale = 1.0;
    if (globalFovScaleInput) globalFovScaleInput.value = 1.0;
    setDisplayPanelMode('single');
    updateDisplayList();
    projectionResults.innerHTML = '<div class="info-placeholder">Select a display to see projection info</div>';
  }

  function setGlobalFovScale(value) {
    globalFovScale = value;
    if (globalFovScaleInput) globalFovScaleInput.value = globalFovScale;
  }

  // Initialize
  updateDisplayList();
  syncUpdateButton();

  return {
    getDisplays: () => displays,
    hasDisplays: () => displays.length > 0,
    getGlobalFovScale: () => globalFovScale,
    setGlobalFovScale,
    isAutoUpdateOn,
    selectDisplay,
    selectAllDisplays,
    openAddDisplayDialog,
    updateSelectedDisplay,
    setAutoUpdate,
    deleteSelectedDisplay,
    clearSelectionForModelPick,
    loadDisplays,
    finishSelectionAfterLoad,
    resetForNewConfig
  };
}
