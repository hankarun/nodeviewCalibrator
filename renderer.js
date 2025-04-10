// This file handles all the client-side JavaScript logic
// You can interact with the DOM and implement UI logic here

// Import display-related functions
import { createDisplayFromInputs, calculateDisplayProjection, formatDisplayCalculations, displayPresets } from './display.js';
// Import canvas drawing functions
import { drawEye, drawCoordinateSystem, drawDisplay, setCanvasDimensions } from './canvasRenderer.js';
// Import file operations
import { openConfigFile, saveConfig, saveConfigAs } from './fileOperations.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('Electron application loaded successfully!');
  
  // Canvas elements
  const topViewCanvas = document.getElementById('topView');
  const leftViewCanvas = document.getElementById('leftView');
  const frontViewCanvas = document.getElementById('frontView');
  const topCtx = topViewCanvas.getContext('2d');
  const leftCtx = leftViewCanvas.getContext('2d');
  const frontCtx = frontViewCanvas.getContext('2d');
  
  // Scale control buttons
  const topViewZoomIn = document.getElementById('topViewZoomIn');
  const topViewZoomOut = document.getElementById('topViewZoomOut');
  const topViewReset = document.getElementById('topViewReset');
  const leftViewZoomIn = document.getElementById('leftViewZoomIn');
  const leftViewZoomOut = document.getElementById('leftViewZoomOut');
  const leftViewReset = document.getElementById('leftViewReset');
  const frontViewZoomIn = document.getElementById('frontViewZoomIn');
  const frontViewZoomOut = document.getElementById('frontViewZoomOut');
  const frontViewReset = document.getElementById('frontViewReset');
  
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
  const addDisplayBtn = document.getElementById('addDisplayBtn');
  const updateDisplayBtn = document.getElementById('updateDisplayBtn');
  const deleteDisplayBtn = document.getElementById('deleteDisplayBtn');
  const displayListContainer = document.getElementById('displayList');
  const projectionResults = document.getElementById('projectionResults');
  const presetSizeSelect = document.getElementById('presetSize');
  const showAsRectanglesInput = document.getElementById('showAsRectangles');
  
  // File operation buttons
  const newConfigBtn = document.getElementById('newConfigBtn');
  const openConfigBtn = document.getElementById('openConfigBtn');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const saveAsConfigBtn = document.getElementById('saveAsConfigBtn');
  
  // Current file path for save operations
  let currentFilePath = null;

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
  
  // Scale factors for drawing (pixels per meter)
  const DEFAULT_SCALE_FACTOR = 200;
  let SCALE_FACTOR = DEFAULT_SCALE_FACTOR;
  let topViewScale = DEFAULT_SCALE_FACTOR;
  let leftViewScale = DEFAULT_SCALE_FACTOR;
  let frontViewScale = DEFAULT_SCALE_FACTOR;
  
  // Initialize canvases with correct dimensions
  function resizeCanvases() {
    // Apply to all canvases
    setCanvasDimensions(topViewCanvas);
    setCanvasDimensions(leftViewCanvas);
    setCanvasDimensions(frontViewCanvas);
    
    // Re-render after resize
    render();
  }
  
  // Call resize on load
  resizeCanvases();
  
  // Handle window resize events
  window.addEventListener('resize', () => {
    resizeCanvases();
  });

  // Update display list in the UI
  function updateDisplayList() {
    // Clear the current list
    displayListContainer.innerHTML = '';
    
    if (displays.length === 0) {
      displayListContainer.innerHTML = '<div class="empty-list-message">No displays added yet</div>';
      return;
    }
    
    // Add each display to the list
    displays.forEach((display, index) => {
      const displayItem = document.createElement('div');
      displayItem.classList.add('display-item');
      if (index === selectedDisplayIndex) {
        displayItem.classList.add('selected');
      }
      
      displayItem.textContent = `Display ${index + 1}: ${display.width}m × ${display.height}m at (${display.x.toFixed(2)}, ${display.y.toFixed(2)}, ${display.z.toFixed(2)})`;
      
      displayItem.addEventListener('click', () => {
        selectDisplay(index);
      });
      
      displayListContainer.appendChild(displayItem);
    });
  }
  
  // Select a display
  function selectDisplay(index) {
    selectedDisplayIndex = index;
    updateDisplayList();
    
    if (index >= 0) {
      const display = displays[index];
      
      // Update form inputs
      displayWidthInput.value = display.width;
      displayHeightInput.value = display.height;
      displayDistanceInput.value = display.distance;
      displayAngleInput.value = display.yaw;
      displayPitchInput.value = display.pitch;
      displayRollInput.value = display.roll;
      displayOffsetXInput.value = display.x;
      displayOffsetYInput.value = display.y;
      displayOffsetZInput.value = display.z;
      
      // Enable update and delete buttons
      updateDisplayBtn.disabled = false;
      deleteDisplayBtn.disabled = false;
      
      // Show calculations for the selected display
      showDisplayCalculations(display);
    } else {
      // Disable update and delete buttons when no display is selected
      updateDisplayBtn.disabled = true;
      deleteDisplayBtn.disabled = true;
    }
    
    // Re-render
    render();
  }
  
  // Show calculations for the display
  function showDisplayCalculations(display) {
    const result = calculateDisplayProjection(display);
    projectionResults.innerHTML = formatDisplayCalculations(result);
  }
  
  // Render everything
  function render() {
    // Clear canvases
    topCtx.clearRect(0, 0, topViewCanvas.width, topViewCanvas.height);
    leftCtx.clearRect(0, 0, leftViewCanvas.width, leftViewCanvas.height);
    frontCtx.clearRect(0, 0, frontViewCanvas.width, frontViewCanvas.height);
    
    // Draw coordinate systems
    drawCoordinateSystem(topCtx, 'top', topViewScale, DEFAULT_SCALE_FACTOR);
    drawCoordinateSystem(leftCtx, 'left', leftViewScale, DEFAULT_SCALE_FACTOR);
    drawCoordinateSystem(frontCtx, 'front', frontViewScale, DEFAULT_SCALE_FACTOR);
    
    // Draw eye
    drawEye(topCtx, 'top');
    drawEye(leftCtx, 'left');
    drawEye(frontCtx, 'front');
    
    // Draw all displays
    displays.forEach((display, index) => {
      const isSelected = index === selectedDisplayIndex;
      const showAsRectangle = showAsRectanglesInput.checked;
      
      drawDisplay(topCtx, display, 'top', isSelected, selectedDisplayIndex, showAsRectangle, topViewScale);
      drawDisplay(leftCtx, display, 'left', isSelected, selectedDisplayIndex, showAsRectangle, leftViewScale);
      drawDisplay(frontCtx, display, 'front', isSelected, selectedDisplayIndex, showAsRectangle, frontViewScale);
    });
  }
  
  // Scale handling functions
  function changeTopViewScale(factor) {
    const newScale = topViewScale * factor;
    // Limit scaling to reasonable range
    if (newScale >= DEFAULT_SCALE_FACTOR * 0.25 && newScale <= DEFAULT_SCALE_FACTOR * 4) {
      topViewScale = newScale;
      render();
    }
  }
  
  function changeLeftViewScale(factor) {
    const newScale = leftViewScale * factor;
    // Limit scaling to reasonable range
    if (newScale >= DEFAULT_SCALE_FACTOR * 0.25 && newScale <= DEFAULT_SCALE_FACTOR * 4) {
      leftViewScale = newScale;
      render();
    }
  }
  
  function changeFrontViewScale(factor) {
    const newScale = frontViewScale * factor;
    // Limit scaling to reasonable range
    if (newScale >= DEFAULT_SCALE_FACTOR * 0.25 && newScale <= DEFAULT_SCALE_FACTOR * 4) {
      frontViewScale = newScale;
      render();
    }
  }
  
  function resetTopViewScale() {
    topViewScale = DEFAULT_SCALE_FACTOR;
    render();
  }
  
  function resetLeftViewScale() {
    leftViewScale = DEFAULT_SCALE_FACTOR;
    render();
  }
  
  function resetFrontViewScale() {
    frontViewScale = DEFAULT_SCALE_FACTOR;
    render();
  }
  
  // Create a new display from input values (renamed to avoid conflict with imported function)
  function getDisplayFromInputs() {
    return createDisplayFromInputs({
      width: displayWidthInput.value,
      height: displayHeightInput.value,
      distance: displayDistanceInput.value,
      yaw: displayAngleInput.value,
      pitch: displayPitchInput.value,
      roll: displayRollInput.value,
      x: displayOffsetXInput.value,
      y: displayOffsetYInput.value,
      z: displayOffsetZInput.value
    });
  }
  
  // File Operation Functions
  
  // Create new configuration
  function handleNewConfig() {
    // Confirm if there are unsaved changes
    if (displays.length > 0) {
      if (!confirm('Creating a new configuration will clear all current displays. Continue?')) {
        return;
      }
    }
    
    // Clear all displays
    displays.length = 0;
    selectedDisplayIndex = -1;
    currentFilePath = null;
    
    // Reset UI
    updateDisplayList();
    projectionResults.innerHTML = '<div>Calculated corners will appear here</div>';
    updateDisplayBtn.disabled = true;
    
    // Re-render
    render();
  }
  
  // Open configuration from file
  function handleOpenConfigFile() {
    openConfigFile()
      .then(result => {
        if (result.canceled) return;
        
        // Load the configuration
        displays.length = 0;
        displays.push(...result.config.displays);
        currentFilePath = result.filePath;
        
        // Update UI
        updateDisplayList();
        
        // Select first display if available
        if (displays.length > 0) {
          selectDisplay(0);
        } else {
          selectedDisplayIndex = -1;
          updateDisplayBtn.disabled = true;
          projectionResults.innerHTML = '<div>Calculated corners will appear here</div>';
        }
        
        // Re-render
        render();
      })
      .catch(error => {
        alert(error.message);
      });
  }
  
  // Save configuration to current file
  function handleSaveConfig() {
    saveConfig(displays, currentFilePath)
      .then(result => {
        if (!result.canceled) {
          currentFilePath = result.filePath;
          alert('Configuration saved successfully!');
        }
      })
      .catch(error => {
        alert(error.message);
      });
  }
  
  // Save configuration with new filename
  function handleSaveConfigAs() {
    saveConfigAs(displays)
      .then(result => {
        if (!result.canceled) {
          currentFilePath = result.filePath;
          alert('Configuration saved successfully!');
        }
      })
      .catch(error => {
        alert(error.message);
      });
  }
  
  // Delete the currently selected display
  function deleteDisplay() {
    if (selectedDisplayIndex < 0) return;
    
    // Show a confirmation dialog
    if (confirm(`Are you sure you want to delete Display ${selectedDisplayIndex + 1}?`)) {
      // Remove the display from the array
      displays.splice(selectedDisplayIndex, 1);
      
      // Update the selected index
      if (displays.length === 0) {
        // No more displays left
        selectedDisplayIndex = -1;
      } else if (selectedDisplayIndex >= displays.length) {
        // If we deleted the last display, select the new last one
        selectedDisplayIndex = displays.length - 1;
      }
      // Otherwise keep the same index which now points to the next display
      
      // Update UI
      updateDisplayList();
      
      if (selectedDisplayIndex >= 0) {
        // Select the new display at this index
        selectDisplay(selectedDisplayIndex);
      } else {
        // No displays left, clear the form
        updateDisplayBtn.disabled = true;
        deleteDisplayBtn.disabled = true;
        projectionResults.innerHTML = '<div>Calculated corners will appear here</div>';
      }
      
      // Re-render
      render();
    }
  }
  
  // Initialize
  render();
  updateDisplayList();
  
 
  addDisplayBtn.addEventListener('click', () => {
    const display = getDisplayFromInputs();
    displays.push(display);
    selectDisplay(displays.length - 1); // Select the newly added display
    updateDisplayList();
    render();
  });
  
  updateDisplayBtn.addEventListener('click', () => {
    if (selectedDisplayIndex >= 0) {
      displays[selectedDisplayIndex] = getDisplayFromInputs();
      showDisplayCalculations(displays[selectedDisplayIndex]);
      updateDisplayList();
      render();
    }
  });
  
  deleteDisplayBtn.addEventListener('click', deleteDisplay);
  
  // Add scale button event listeners
  topViewZoomIn.addEventListener('click', () => changeTopViewScale(1.25));
  topViewZoomOut.addEventListener('click', () => changeTopViewScale(0.8));
  topViewReset.addEventListener('click', resetTopViewScale);
  
  leftViewZoomIn.addEventListener('click', () => changeLeftViewScale(1.25));
  leftViewZoomOut.addEventListener('click', () => changeLeftViewScale(0.8));
  leftViewReset.addEventListener('click', resetLeftViewScale);

  frontViewZoomIn.addEventListener('click', () => changeFrontViewScale(1.25));
  frontViewZoomOut.addEventListener('click', () => changeFrontViewScale(0.8));
  frontViewReset.addEventListener('click', resetFrontViewScale);

  // Add event listener for the new checkbox
  showAsRectanglesInput.addEventListener('change', render);

  // File operation button event listeners
  newConfigBtn.addEventListener('click', handleNewConfig);
  openConfigBtn.addEventListener('click', handleOpenConfigFile);
  saveConfigBtn.addEventListener('click', handleSaveConfig);
  saveAsConfigBtn.addEventListener('click', handleSaveConfigAs);
});