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
  const displayOffsetXInput = document.getElementById('displayOffsetX');
  const displayOffsetYInput = document.getElementById('displayOffsetY');
  const calculateBtn = document.getElementById('calculateBtn');
  const addDisplayBtn = document.getElementById('addDisplayBtn');
  const projectionResults = document.getElementById('projectionResults');
  
  // Store displays
  const displays = [];
  
  // Scale factors for drawing (pixels per meter)
  const SCALE_FACTOR = 200;
  
  // Draw eye position
  function drawEye(ctx, viewType) {
    ctx.fillStyle = 'red';
    if (viewType === 'top') {
      ctx.beginPath();
      ctx.arc(topViewCanvas.width / 2, topViewCanvas.height - 50, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (viewType === 'left') {
      ctx.beginPath();
      ctx.arc(50, leftViewCanvas.height / 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Draw coordinate system
  function drawCoordinateSystem(ctx, viewType) {
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    
    if (viewType === 'top') {
      // Origin is at eye position
      const originX = topViewCanvas.width / 2;
      const originY = topViewCanvas.height - 50;
      
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
      // Origin is at eye position
      const originX = 50;
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
  function drawDisplay(ctx, display, viewType) {
    const { width, height, distance, angle, offsetX, offsetY } = display;
    
    // Convert angle to radians
    const angleRad = angle * Math.PI / 180;
    
    if (viewType === 'top') {
      // Origin is at eye position
      const originX = topViewCanvas.width / 2;
      const originY = topViewCanvas.height - 50;
      
      // Calculate display position in top view (X and Z coordinates)
      const displayCenterZ = -distance * SCALE_FACTOR;
      const displayCenterX = offsetX * SCALE_FACTOR;
      
      // Calculate corners with rotation
      const halfWidth = width * SCALE_FACTOR / 2;
      
      // Calculate corners
      const x1 = displayCenterX - halfWidth * Math.cos(angleRad);
      const z1 = displayCenterZ - halfWidth * Math.sin(angleRad);
      
      const x2 = displayCenterX + halfWidth * Math.cos(angleRad);
      const z2 = displayCenterZ + halfWidth * Math.sin(angleRad);
      
      // Draw display as a line
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'blue';
      ctx.beginPath();
      ctx.moveTo(originX + x1, originY + z1);
      ctx.lineTo(originX + x2, originY + z2);
      ctx.stroke();
      
      // Draw sight lines from eye to display corners
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(0, 0, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + x1, originY + z1);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + x2, originY + z2);
      ctx.stroke();
      
    } else if (viewType === 'left') {
      // Origin is at eye position
      const originX = 50;
      const originY = leftViewCanvas.height / 2;
      
      // Calculate display position in left view (Y and Z coordinates)
      const displayCenterZ = distance * SCALE_FACTOR;
      const displayCenterY = -offsetY * SCALE_FACTOR;
      
      // Calculate corners
      const halfHeight = height * SCALE_FACTOR / 2;
      const y1 = displayCenterY - halfHeight;
      const y2 = displayCenterY + halfHeight;
      
      // Draw display as a line
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'green';
      ctx.beginPath();
      ctx.moveTo(originX + displayCenterZ, originY + y1);
      ctx.lineTo(originX + displayCenterZ, originY + y2);
      ctx.stroke();
      
      // Draw sight lines from eye to display corners
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(0, 128, 0, 0.3)';
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + displayCenterZ, originY + y1);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + displayCenterZ, originY + y2);
      ctx.stroke();
    }
  }
  
  // Calculate offcenter projection corners
  function calculateProjectionCorners(display) {
    const { width, height, distance, angle, offsetX, offsetY } = display;
    
    // Convert angle to radians
    const angleRad = angle * Math.PI / 180;
    
    // Calculate corners in display space
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    // Top-left, top-right, bottom-left, bottom-right
    const corners = [
      { x: -halfWidth, y: halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight }
    ];
    
    // Apply rotation around Y axis
    const rotatedCorners = corners.map(corner => {
      return {
        x: corner.x * Math.cos(angleRad) - distance * Math.sin(angleRad),
        y: corner.y,
        z: corner.x * Math.sin(angleRad) + distance * Math.cos(angleRad)
      };
    });
    
    // Apply offsets
    const finalCorners = rotatedCorners.map(corner => {
      return {
        x: corner.x + offsetX,
        y: corner.y + offsetY,
        z: corner.z
      };
    });
    
    // Calculate projection parameters for offcenter projection
    const left = Math.atan2(finalCorners[0].x, finalCorners[0].z);
    const right = Math.atan2(finalCorners[1].x, finalCorners[1].z);
    const bottom = Math.atan2(finalCorners[3].y, finalCorners[3].z);
    const top = Math.atan2(finalCorners[0].y, finalCorners[0].z);
    
    return {
      corners: finalCorners,
      projection: {
        left: left * 180 / Math.PI,
        right: right * 180 / Math.PI,
        bottom: bottom * 180 / Math.PI,
        top: top * 180 / Math.PI
      }
    };
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
    displays.forEach(display => {
      drawDisplay(topCtx, display, 'top');
      drawDisplay(leftCtx, display, 'left');
    });
  }
  
  // Initialize
  render();
  
  // Add event listeners
  calculateBtn.addEventListener('click', () => {
    const display = {
      width: parseFloat(displayWidthInput.value),
      height: parseFloat(displayHeightInput.value),
      distance: parseFloat(displayDistanceInput.value),
      angle: parseFloat(displayAngleInput.value),
      offsetX: parseFloat(displayOffsetXInput.value),
      offsetY: parseFloat(displayOffsetYInput.value)
    };
    
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
    
    // Preview display
    render();
  });
  
  addDisplayBtn.addEventListener('click', () => {
    const display = {
      width: parseFloat(displayWidthInput.value),
      height: parseFloat(displayHeightInput.value),
      distance: parseFloat(displayDistanceInput.value),
      angle: parseFloat(displayAngleInput.value),
      offsetX: parseFloat(displayOffsetXInput.value),
      offsetY: parseFloat(displayOffsetYInput.value)
    };
    
    displays.push(display);
    render();
  });
});