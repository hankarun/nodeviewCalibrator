// This file handles all the client-side JavaScript logic
// You can interact with the DOM and implement UI logic here

document.addEventListener('DOMContentLoaded', () => {
  console.log('Electron application loaded successfully!');
  
  // Canvas elements
  const topViewCanvas = document.getElementById('topView');
  const leftViewCanvas = document.getElementById('leftView');
  const topCtx = topViewCanvas.getContext('2d');
  const leftCtx = leftViewCanvas.getContext('2d');
  
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
  const calculateBtn = document.getElementById('calculateBtn');
  const addDisplayBtn = document.getElementById('addDisplayBtn');
  const updateDisplayBtn = document.getElementById('updateDisplayBtn');
  const displayListContainer = document.getElementById('displayList');
  const projectionResults = document.getElementById('projectionResults');
  
  // Store displays
  const displays = [];
  let selectedDisplayIndex = -1;
  
  // Scale factors for drawing (pixels per meter)
  const SCALE_FACTOR = 200;
  
  // Draw eye position
  function drawEye(ctx, viewType) {
    ctx.fillStyle = 'red';
    if (viewType === 'top') {
      ctx.beginPath();
      ctx.arc(topViewCanvas.width / 2, topViewCanvas.height / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (viewType === 'left') {
      ctx.beginPath();
      ctx.arc(leftViewCanvas.width / 2, leftViewCanvas.height / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Draw coordinate system
  function drawCoordinateSystem(ctx, viewType) {
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    
    if (viewType === 'top') {
      // Origin is at eye position (center of canvas)
      const originX = topViewCanvas.width / 2;
      const originY = topViewCanvas.height / 2;
      
      // Draw Z axis (forward)
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX, 20);
      ctx.stroke();
      
      // Draw X axis (right)
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(topViewCanvas.width - 20, originY);
      ctx.stroke();
      
      // Labels
      ctx.fillStyle = 'black';
      ctx.font = '12px sans-serif';
      ctx.fillText('Z', originX + 5, 30);
      ctx.fillText('X', topViewCanvas.width - 30, originY - 5);
    } else if (viewType === 'left') {
      // Origin is at eye position (center of canvas)
      const originX = leftViewCanvas.width / 2;
      const originY = leftViewCanvas.height / 2;
      
      // Draw Z axis (forward)
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(leftViewCanvas.width - 20, originY);
      ctx.stroke();
      
      // Draw Y axis (up)
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX, 20);
      ctx.stroke();
      
      // Labels
      ctx.fillStyle = 'black';
      ctx.font = '12px sans-serif';
      ctx.fillText('Z', leftViewCanvas.width - 30, originY - 5);
      ctx.fillText('Y', originX + 5, 30);
    }
  }
  
  // Draw display
  function drawDisplay(ctx, display, viewType, isSelected) {
    const { width, height, distance, yaw, pitch, roll, x, y, z } = display;
    
    // Convert angles to radians
    const yawRad = yaw * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const rollRad = roll * Math.PI / 180;
    
    if (viewType === 'top') {
      // Origin is at eye position (center)
      const originX = topViewCanvas.width / 2;
      const originY = topViewCanvas.height / 2;
      
      // Calculate display center position in top view (X and Z coordinates)
      const displayCenterX = x * SCALE_FACTOR;
      const displayCenterZ = -z * SCALE_FACTOR;
      
      // Calculate corners with rotation (yaw)
      const halfWidth = width * SCALE_FACTOR / 2;
      
      // Calculate corners
      const x1 = displayCenterX - halfWidth * Math.cos(yawRad);
      const z1 = displayCenterZ - halfWidth * Math.sin(yawRad);
      
      const x2 = displayCenterX + halfWidth * Math.cos(yawRad);
      const z2 = displayCenterZ + halfWidth * Math.sin(yawRad);
      
      // Draw display as a line
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.9)' : 'blue';
      ctx.beginPath();
      ctx.moveTo(originX + x1, originY + z1);
      ctx.lineTo(originX + x2, originY + z2);
      ctx.stroke();
      
      // Draw sight lines from eye to display corners
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.3)' : 'rgba(0, 0, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + x1, originY + z1);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + x2, originY + z2);
      ctx.stroke();
      
      // Label if selected
      if (isSelected) {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Display ${selectedDisplayIndex + 1}`, originX + displayCenterX, originY + displayCenterZ - 10);
      }
      
    } else if (viewType === 'left') {
      // Origin is at eye position (center)
      const originX = leftViewCanvas.width / 2;
      const originY = leftViewCanvas.height / 2;
      
      // Calculate display position in left view (Y and Z coordinates)
      const displayCenterZ = z * SCALE_FACTOR;
      const displayCenterY = -y * SCALE_FACTOR;
      
      // Calculate corners with pitch rotation
      const halfHeight = height * SCALE_FACTOR / 2;
      
      // Adjust positions based on pitch rotation
      const y1 = displayCenterY - halfHeight * Math.cos(pitchRad);
      const z1 = displayCenterZ - halfHeight * Math.sin(pitchRad);
      
      const y2 = displayCenterY + halfHeight * Math.cos(pitchRad);
      const z2 = displayCenterZ + halfHeight * Math.sin(pitchRad);
      
      // Draw display as a line
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.9)' : 'green';
      ctx.beginPath();
      ctx.moveTo(originX + z1, originY + y1);
      ctx.lineTo(originX + z2, originY + y2);
      ctx.stroke();
      
      // Draw sight lines from eye to display corners
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.3)' : 'rgba(0, 128, 0, 0.3)';
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + z1, originY + y1);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + z2, originY + y2);
      ctx.stroke();
      
      // Label if selected
      if (isSelected) {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Display ${selectedDisplayIndex + 1}`, originX + displayCenterZ, originY + displayCenterY - 10);
      }
    }
  }
  
  // Calculate offcenter projection corners
  function calculateProjectionCorners(display) {
    const { width, height, distance, yaw, pitch, roll, x, y, z } = display;
    
    // Convert angles to radians
    const yawRad = yaw * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const rollRad = roll * Math.PI / 180;
    
    // Calculate corners in display space
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    // Top-left, top-right, bottom-left, bottom-right (in display local space)
    const corners = [
      { x: -halfWidth, y: halfHeight, z: 0 },
      { x: halfWidth, y: halfHeight, z: 0 },
      { x: -halfWidth, y: -halfHeight, z: 0 },
      { x: halfWidth, y: -halfHeight, z: 0 }
    ];
    
    // Apply rotations (yaw, pitch, roll)
    const rotatedCorners = corners.map(corner => {
      // First apply roll (around Z)
      let x1 = corner.x * Math.cos(rollRad) - corner.y * Math.sin(rollRad);
      let y1 = corner.x * Math.sin(rollRad) + corner.y * Math.cos(rollRad);
      let z1 = corner.z;
      
      // Apply pitch (around X)
      let y2 = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
      let z2 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);
      let x2 = x1;
      
      // Apply yaw (around Y)
      let x3 = x2 * Math.cos(yawRad) - z2 * Math.sin(yawRad);
      let z3 = x2 * Math.sin(yawRad) + z2 * Math.cos(yawRad);
      let y3 = y2;
      
      return { x: x3, y: y3, z: z3 };
    });
    
    // Apply translation (position)
    const finalCorners = rotatedCorners.map(corner => {
      return {
        x: corner.x + x,
        y: corner.y + y,
        z: corner.z + z
      };
    });
    
    // Calculate projection parameters for offcenter projection
    // These are angles from eye to each corner
    const anglesToCorners = finalCorners.map(corner => {
      const distance = Math.sqrt(corner.x * corner.x + corner.y * corner.y + corner.z * corner.z);
      return {
        horizontal: Math.atan2(corner.x, corner.z) * 180 / Math.PI,
        vertical: Math.atan2(corner.y, corner.z) * 180 / Math.PI,
        distance
      };
    });
    
    // Find the extents of these angles
    const left = Math.min(anglesToCorners[0].horizontal, anglesToCorners[2].horizontal);
    const right = Math.max(anglesToCorners[1].horizontal, anglesToCorners[3].horizontal);
    const bottom = Math.min(anglesToCorners[2].vertical, anglesToCorners[3].vertical);
    const top = Math.max(anglesToCorners[0].vertical, anglesToCorners[1].vertical);
    
    return {
      corners: finalCorners,
      anglesToCorners,
      projection: {
        left,
        right,
        bottom,
        top
      }
    };
  }
  
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
      
      // Enable update button
      updateDisplayBtn.disabled = false;
      
      // Show calculations for the selected display
      showDisplayCalculations(display);
    } else {
      // Disable update button when no display is selected
      updateDisplayBtn.disabled = true;
    }
    
    // Re-render
    render();
  }
  
  // Show calculations for the display
  function showDisplayCalculations(display) {
    const result = calculateProjectionCorners(display);
    
    // Format and display results
    projectionResults.innerHTML = `
      <div>Projection Corners (in degrees):</div>
      <div>Left: ${result.projection.left.toFixed(2)}</div>
      <div>Right: ${result.projection.right.toFixed(2)}</div>
      <div>Bottom: ${result.projection.bottom.toFixed(2)}</div>
      <div>Top: ${result.projection.top.toFixed(2)}</div>
      <div>Physical corners (meters from eye):</div>
      <div>Top-Left: (${result.corners[0].x.toFixed(2)}, ${result.corners[0].y.toFixed(2)}, ${result.corners[0].z.toFixed(2)})</div>
      <div>Top-Right: (${result.corners[1].x.toFixed(2)}, ${result.corners[1].y.toFixed(2)}, ${result.corners[1].z.toFixed(2)})</div>
      <div>Bottom-Left: (${result.corners[2].x.toFixed(2)}, ${result.corners[2].y.toFixed(2)}, ${result.corners[2].z.toFixed(2)})</div>
      <div>Bottom-Right: (${result.corners[3].x.toFixed(2)}, ${result.corners[3].y.toFixed(2)}, ${result.corners[3].z.toFixed(2)})</div>
    `;
  }
  
  // Render everything
  function render() {
    // Clear canvases
    topCtx.clearRect(0, 0, topViewCanvas.width, topViewCanvas.height);
    leftCtx.clearRect(0, 0, leftViewCanvas.width, leftViewCanvas.height);
    
    // Draw coordinate systems
    drawCoordinateSystem(topCtx, 'top');
    drawCoordinateSystem(leftCtx, 'left');
    
    // Draw eye
    drawEye(topCtx, 'top');
    drawEye(leftCtx, 'left');
    
    // Draw all displays
    displays.forEach((display, index) => {
      const isSelected = index === selectedDisplayIndex;
      drawDisplay(topCtx, display, 'top', isSelected);
      drawDisplay(leftCtx, display, 'left', isSelected);
    });
  }
  
  // Create a new display from input values
  function createDisplayFromInputs() {
    return {
      width: parseFloat(displayWidthInput.value),
      height: parseFloat(displayHeightInput.value),
      distance: parseFloat(displayDistanceInput.value), // Keep for backwards compatibility
      yaw: parseFloat(displayAngleInput.value),
      pitch: parseFloat(displayPitchInput.value),
      roll: parseFloat(displayRollInput.value),
      x: parseFloat(displayOffsetXInput.value),
      y: parseFloat(displayOffsetYInput.value),
      z: parseFloat(displayOffsetZInput.value)
    };
  }
  
  // Initialize
  render();
  updateDisplayList();
  
  // Add event listeners
  calculateBtn.addEventListener('click', () => {
    const display = createDisplayFromInputs();
    showDisplayCalculations(display);
    render();
  });
  
  addDisplayBtn.addEventListener('click', () => {
    const display = createDisplayFromInputs();
    displays.push(display);
    selectDisplay(displays.length - 1); // Select the newly added display
    updateDisplayList();
    render();
  });
  
  updateDisplayBtn.addEventListener('click', () => {
    if (selectedDisplayIndex >= 0) {
      displays[selectedDisplayIndex] = createDisplayFromInputs();
      showDisplayCalculations(displays[selectedDisplayIndex]);
      updateDisplayList();
      render();
    }
  });
});