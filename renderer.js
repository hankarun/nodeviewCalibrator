// This file handles all the client-side JavaScript logic
// You can interact with the DOM and implement UI logic here

// Import display-related functions
import { createDisplayFromInputs, calculateDisplayProjection, formatDisplayCalculations, displayPresets } from './display.js';
// Import canvas drawing functions
import { drawEye, drawCoordinateSystem, drawDisplay, setCanvasDimensions, initCanvasDrag } from './canvasRenderer.js';
// Import unified file operations interface
import { getFileInterface, openConfigFile, saveConfig, saveConfigAs } from './fileInterface.js';
// Import projection tests
import { runProjectionTests } from './projectionTest.js';
// Import status bar
import { StatusBar } from './statusBar.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Electron application loaded successfully!');
  
  // Initialize the unified file interface
  const fileInterface = await getFileInterface();
  const envInfo = fileInterface.getEnvironmentInfo();
  console.log(`File interface initialized for ${envInfo.platform} environment`);
  
  // Initialize status bar
  const statusBar = new StatusBar(fileInterface);
  
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
  const displayNameInput = document.getElementById('displayName');
  const addDisplayBtn = document.getElementById('addDisplayBtn');
  const updateDisplayBtn = document.getElementById('updateDisplayBtn');
  const deleteDisplayBtn = document.getElementById('deleteDisplayBtn');
  const displayListContainer = document.getElementById('displayList');
  const projectionResults = document.getElementById('projectionResults');
  const presetSizeSelect = document.getElementById('presetSize');
  const showAsRectanglesInput = document.getElementById('showAsRectangles');
  const stableEdgeCalculationInput = document.getElementById('stableEdgeCalculation');
  const lockDisplayPositionInput = document.getElementById('lockDisplayPosition');
  const nearPlaneInput = document.getElementById('nearPlane');
  
  // File operation buttons
  const newConfigBtn = document.getElementById('newConfigBtn');
  const openConfigBtn = document.getElementById('openConfigBtn');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const saveAsConfigBtn = document.getElementById('saveAsConfigBtn');

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
  // Initialize drag functionality for each canvas view
  function initDragForAllCanvases() {
    // Define canvas view offsets for panning (used with left click drag)
    let topViewOffsetX = 0;
    let topViewOffsetY = 0;
    let leftViewOffsetX = 0;
    let leftViewOffsetY = 0;
    let frontViewOffsetX = 0;
    let frontViewOffsetY = 0;
    
    // Handler for display movement via right-click drag
    const handleDisplayDrag = (dx, dy, viewType) => {
      // Only proceed if a display is selected
      if (selectedDisplayIndex < 0) return;
      
      // Get the currently selected display
      const display = displays[selectedDisplayIndex];
      
      // Convert pixel movement to world coordinates based on current view scale
      // The scale factor converts meters to pixels, so we divide by it to convert back
      let moveX = 0, moveY = 0, moveZ = 0;
      
      if (viewType === 'top') {
        // In top view, X is horizontal and Z is vertical (inverted)
        moveX = dx / topViewScale;
        moveZ = dy / topViewScale; // dy is already inverted in the event handler
        
        // Update the display's position
        display.x += moveX;
        display.z += moveZ;
      } 
      else if (viewType === 'left') {
        // In left view, Z is horizontal and Y is vertical (inverted)
        moveZ = dx / leftViewScale;
        moveY = dy / leftViewScale; // dy is already inverted
        
        // Update the display's position
        display.z += moveZ;
        display.y += moveY;
      }
      else if (viewType === 'front') {
        // In front view, X is horizontal and Y is vertical (inverted)
        moveX = dx / frontViewScale;
        moveY = dy / frontViewScale; // dy is already inverted
        
        // Update the display's position
        display.x += moveX;
        display.y += moveY;
      }
      
      // Update the display inputs in the UI
      if (selectedDisplayIndex >= 0) {
        displayOffsetXInput.value = display.x;
        displayOffsetYInput.value = display.y;
        displayOffsetZInput.value = display.z;
      }
      
      // Recalculate display properties
      if (selectedDisplayIndex >= 0) {
        showDisplayCalculations(display);
      }
      
      // Update display list to show new positions
      updateDisplayList();
      
      // Re-render the views with updated positions
      render();
    };
    
    // Handler for canvas/view movement via left-click drag
    const handleCanvasDrag = (dx, dy, viewType) => {
      // Update the view offset based on the view type
      if (viewType === 'top') {
        topViewOffsetX += dx;
        topViewOffsetY += dy;
      } 
      else if (viewType === 'left') {
        leftViewOffsetX += dx;
        leftViewOffsetY += dy;
      }
      else if (viewType === 'front') {
        frontViewOffsetX += dx;
        frontViewOffsetY += dy;
      }
      
      // Re-render the view with the updated offset
      render();
    };
    
    // Store the original render function
    const originalRender = render;
    
    // Override the render function to apply view offsets
    render = function() {
      // Clear canvases
      topCtx.clearRect(0, 0, topViewCanvas.width, topViewCanvas.height);
      leftCtx.clearRect(0, 0, leftViewCanvas.width, leftViewCanvas.height);
      frontCtx.clearRect(0, 0, frontViewCanvas.width, frontViewCanvas.height);
      
      // Apply view translations
      // Top view
      topCtx.save();
      topCtx.translate(topViewOffsetX, topViewOffsetY);
      
      // Left view
      leftCtx.save();
      leftCtx.translate(leftViewOffsetX, leftViewOffsetY);
      
      // Front view
      frontCtx.save();
      frontCtx.translate(frontViewOffsetX, frontViewOffsetY);
      
      // Draw coordinate systems
      drawCoordinateSystem(topCtx, 'top', topViewScale, DEFAULT_SCALE_FACTOR);
      drawCoordinateSystem(leftCtx, 'left', leftViewScale, DEFAULT_SCALE_FACTOR);
      drawCoordinateSystem(frontCtx, 'front', frontViewScale, DEFAULT_SCALE_FACTOR);
      
      // Draw eye
      drawEye(topCtx, 'top');
      drawEye(leftCtx, 'left');
      drawEye(frontCtx, 'front');
      
      // Get lock mode state and near plane value
      const lockPosition = lockDisplayPositionInput.checked;
      const nearPlane = lockPosition ? parseFloat(nearPlaneInput.value) : null;
      
      // Draw all displays
      displays.forEach((display, index) => {
        const isSelected = index === selectedDisplayIndex;
        const showAsRectangle = showAsRectanglesInput.checked;
        
        drawDisplay(topCtx, display, 'top', isSelected, selectedDisplayIndex, showAsRectangle, topViewScale, nearPlane);
        drawDisplay(leftCtx, display, 'left', isSelected, selectedDisplayIndex, showAsRectangle, leftViewScale, nearPlane);
        drawDisplay(frontCtx, display, 'front', isSelected, selectedDisplayIndex, showAsRectangle, frontViewScale, nearPlane);
      });
      
      // Restore context
      topCtx.restore();
      leftCtx.restore();
      frontCtx.restore();
    };
    
    // Function to reset view offsets
    function resetViewOffsets() {
      topViewOffsetX = 0;
      topViewOffsetY = 0;
      leftViewOffsetX = 0;
      leftViewOffsetY = 0;
      frontViewOffsetX = 0;
      frontViewOffsetY = 0;
      render();
    }
    
    // Add double-click event to reset view offsets
    topViewCanvas.addEventListener('dblclick', resetViewOffsets);
    leftViewCanvas.addEventListener('dblclick', resetViewOffsets);
    frontViewCanvas.addEventListener('dblclick', resetViewOffsets);
    
    // Initialize drag for each canvas view with both callbacks
    initCanvasDrag(topViewCanvas, 'top', handleDisplayDrag, handleCanvasDrag);
    initCanvasDrag(leftViewCanvas, 'left', handleDisplayDrag, handleCanvasDrag);
    initCanvasDrag(frontViewCanvas, 'front', handleDisplayDrag, handleCanvasDrag);
  }
  
  // Call the initialization function
  initDragForAllCanvases();

  // Update display list in the UI
  function updateDisplayList() {
    // Clear the current list
    displayListContainer.innerHTML = '';
    
    if (displays.length === 0) {
      displayListContainer.innerHTML = '<div class="empty-list-message">No displays added yet</div>';
      statusBar.updateDisplayCount(0);
      return;
    }
    
    // Add each display to the list
    displays.forEach((display, index) => {
      const displayItem = document.createElement('div');
      displayItem.classList.add('display-item');
      if (index === selectedDisplayIndex) {
        displayItem.classList.add('selected');
      }
      
      const displayLabel = display.name ? `Display ${index + 1} (${display.name})` : `Display ${index + 1}`;
      displayItem.textContent = displayLabel;
      displayItem.title = `${display.width}m × ${display.height}m at (${display.x.toFixed(2)}, ${display.y.toFixed(2)}, ${display.z.toFixed(2)})`;
      
      displayItem.addEventListener('click', () => {
        selectDisplay(index);
      });
      
      displayListContainer.appendChild(displayItem);
    });
    
    // Update status bar
    statusBar.updateDisplayCount(displays.length);
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
      displayNameInput.value = display.name || '';
      
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
    const useStableCalculation = stableEdgeCalculationInput.checked;
    const lockPosition = lockDisplayPositionInput.checked;
    const nearPlane = lockPosition ? parseFloat(nearPlaneInput.value) : null;
    projectionResults.innerHTML = formatDisplayCalculations(result, display, useStableCalculation, nearPlane);
  }
  
  // Base render function - this gets overridden in initDragForAllCanvases
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
    
    // Get lock mode state and near plane value
    const lockPosition = lockDisplayPositionInput.checked;
    const nearPlane = lockPosition ? parseFloat(nearPlaneInput.value) : null;
    
    // Draw all displays
    displays.forEach((display, index) => {
      const isSelected = index === selectedDisplayIndex;
      const showAsRectangle = showAsRectanglesInput.checked;
      
      drawDisplay(topCtx, display, 'top', isSelected, selectedDisplayIndex, showAsRectangle, topViewScale, nearPlane);
      drawDisplay(leftCtx, display, 'left', isSelected, selectedDisplayIndex, showAsRectangle, leftViewScale, nearPlane);
      drawDisplay(frontCtx, display, 'front', isSelected, selectedDisplayIndex, showAsRectangle, frontViewScale, nearPlane);
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
    const result = createDisplayFromInputs(inputs);
    return result;
  }
  
  // File Operation Functions
  
  // Create new configuration
  function handleNewConfig() {
    // Confirm if there are unsaved changes
    if (displays.length > 0 && !fileInterface.confirmUnsavedChanges('create a new configuration')) {
      return;
    }
    
    // Clear all displays
    displays.length = 0;
    selectedDisplayIndex = -1;
    
    // Create new configuration through file interface
    fileInterface.createNew();
    
    // Reset UI
    updateDisplayList();
    projectionResults.innerHTML = '<div>Calculated corners will appear here</div>';
    updateDisplayBtn.disabled = true;
    
    // Re-render
    render();
  }
  
  // Open configuration from file
  function handleOpenConfigFile() {
    if (displays.length > 0 && !fileInterface.confirmUnsavedChanges('open a new configuration')) {
      return;
    }
    
    openConfigFile()
      .then(result => {
        if (result.canceled) return;
        
        // Load the configuration
        displays.length = 0;
        displays.push(...result.config.displays);
        
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
        console.error('Error opening file:', error);
      });
  }
  
  // Save configuration to current file
  function handleSaveConfig() {
    saveConfig(displays)
      .then(result => {
        // Success notification is handled by the file interface
      })
      .catch(error => {
        console.error('Error saving file:', error);
      });
  }
  
  // Save configuration with new filename
  function handleSaveConfigAs() {
    saveConfigAs(displays)
      .then(result => {
        // Success notification is handled by the file interface
      })
      .catch(error => {
        console.error('Error saving file:', error);
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
    fileInterface.markUnsaved(); // Mark as having unsaved changes
  });
  
  updateDisplayBtn.addEventListener('click', () => {
    if (selectedDisplayIndex >= 0) {
      displays[selectedDisplayIndex] = getDisplayFromInputs();
      console.log('Updated display at index', selectedDisplayIndex, displays[selectedDisplayIndex]);
      showDisplayCalculations(displays[selectedDisplayIndex]);
      updateDisplayList();
      render();
      fileInterface.markUnsaved(); // Mark as having unsaved changes
    }
  });
  
  deleteDisplayBtn.addEventListener('click', () => {
    deleteDisplay();
    if (displays.length >= 0) {
      fileInterface.markUnsaved(); // Mark as having unsaved changes
    }
  });
  
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
  
  // Add wheel zoom event listeners
  window.addEventListener('topViewScale', (event) => changeTopViewScale(event.detail.factor));
  window.addEventListener('leftViewScale', (event) => changeLeftViewScale(event.detail.factor));
  window.addEventListener('frontViewScale', (event) => changeFrontViewScale(event.detail.factor));

  // Add event listener for the new checkbox
  showAsRectanglesInput.addEventListener('change', render);

  // Add event listener for the stable edge calculation checkbox
  stableEdgeCalculationInput.addEventListener('change', () => {
    // Recalculate and update display if one is selected
    if (selectedDisplayIndex >= 0) {
      showDisplayCalculations(displays[selectedDisplayIndex]);
    }
  });

  // Add event listener for lock display position checkbox
  lockDisplayPositionInput.addEventListener('change', () => {
    // Enable/disable near plane input based on lock state
    nearPlaneInput.disabled = !lockDisplayPositionInput.checked;
    // Recalculate and update display if one is selected
    if (selectedDisplayIndex >= 0) {
      showDisplayCalculations(displays[selectedDisplayIndex]);
    }
  });

  // Add event listener for near plane input
  nearPlaneInput.addEventListener('input', () => {
    // Only update if lock position mode is active and a display is selected
    if (lockDisplayPositionInput.checked && selectedDisplayIndex >= 0) {
      showDisplayCalculations(displays[selectedDisplayIndex]);
      render(); // Re-render to update near plane visualization
    }
  });

  // Initialize near plane input state
  nearPlaneInput.disabled = !lockDisplayPositionInput.checked;

  // File operation button event listeners
  newConfigBtn.addEventListener('click', handleNewConfig);
  openConfigBtn.addEventListener('click', handleOpenConfigFile);
  saveConfigBtn.addEventListener('click', handleSaveConfig);
  saveAsConfigBtn.addEventListener('click', handleSaveConfigAs);    
});