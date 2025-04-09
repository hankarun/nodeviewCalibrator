// This file handles all the client-side JavaScript logic
// You can interact with the DOM and implement UI logic here

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
  const calculateBtn = document.getElementById('calculateBtn');
  const addDisplayBtn = document.getElementById('addDisplayBtn');
  const updateDisplayBtn = document.getElementById('updateDisplayBtn');
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

  // Display size presets (diagonal inches -> width & height in meters)
  const displayPresets = {
    "27": { width: 0.598, height: 0.336 },
    "32": { width: 0.708, height: 0.398 },
    "40": { width: 0.886, height: 0.498 },
    "43": { width: 0.952, height: 0.535 },
    "50": { width: 1.107, height: 0.623 },
    "55": { width: 1.218, height: 0.685 },
    "65": { width: 1.440, height: 0.810 },
    "75": { width: 1.660, height: 0.934 }
  };

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
    // Function to set canvas dimensions based on its container
    function setCanvasDimensions(canvas) {
      const container = canvas.parentElement;
      const containerWidth = container.clientWidth - 30; // Account for padding
      const aspectRatio = 3/4; // Height is 3/4 of width (or 4/3 width to height)
      
      // Set dimensions based on container width, maintaining aspect ratio
      canvas.width = Math.min(containerWidth, 400); // Max width of 400px
      canvas.height = canvas.width * aspectRatio;
      
      // Set CSS dimensions to match the canvas dimensions
      canvas.style.width = canvas.width + 'px';
      canvas.style.height = canvas.height + 'px';
    }
    
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
    } else if (viewType === 'front') {
      ctx.beginPath();
      ctx.arc(frontViewCanvas.width / 2, frontViewCanvas.height / 2, 5, 0, Math.PI * 2);
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
      
      // Display current scale
      ctx.fillText(`Scale: ${(topViewScale / DEFAULT_SCALE_FACTOR).toFixed(1)}x`, 10, 20);
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
      
      // Display current scale
      ctx.fillText(`Scale: ${(leftViewScale / DEFAULT_SCALE_FACTOR).toFixed(1)}x`, 10, 20);
    } else if (viewType === 'front') {
      // Origin is at eye position (center of canvas)
      const originX = frontViewCanvas.width / 2;
      const originY = frontViewCanvas.height / 2;
      
      // Draw X axis (right)
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(frontViewCanvas.width - 20, originY);
      ctx.stroke();
      
      // Draw Y axis (up)
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX, 20);
      ctx.stroke();
      
      // Labels
      ctx.fillStyle = 'black';
      ctx.font = '12px sans-serif';
      ctx.fillText('X', frontViewCanvas.width - 30, originY - 5);
      ctx.fillText('Y', originX + 5, 30);
      
      // Display current scale
      ctx.fillText(`Scale: ${(frontViewScale / DEFAULT_SCALE_FACTOR).toFixed(1)}x`, 10, 20);
    }
  }
  
  // Draw display
  function drawDisplay(ctx, display, viewType, isSelected) {
    const { width, height, distance, yaw, pitch, roll, x, y, z } = display;
    const showAsRectangle = showAsRectanglesInput.checked;
    
    // Convert angles to radians
    const yawRad = yaw * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const rollRad = roll * Math.PI / 180;
    
    if (viewType === 'top') {
      // Origin is at eye position (center)
      const originX = topViewCanvas.width / 2;
      const originY = topViewCanvas.height / 2;
      const scale = topViewScale;
      
      // Calculate display center position
      const displayCenterX = x * scale;
      const displayCenterZ = -z * scale;
      
      // Set styles based on selection state
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.9)' : 'blue';
      
      if (showAsRectangle) {
        // Calculate all four corners of the display in 3D space
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        // Define corners in display local space (before rotation)
        // Top-left, top-right, bottom-right, bottom-left
        const corners = [
          { x: -halfWidth, y: halfHeight, z: 0 },
          { x: halfWidth, y: halfHeight, z: 0 },
          { x: halfWidth, y: -halfHeight, z: 0 },
          { x: -halfWidth, y: -halfHeight, z: 0 }
        ];
        
        // Apply rotations (roll, pitch, yaw in that order)
        const rotatedCorners = corners.map(corner => {
          // Apply roll (around Z)
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
        
        // Apply translation
        const finalCorners = rotatedCorners.map(corner => {
          return {
            x: corner.x + x,
            y: corner.y + y,
            z: corner.z + z
          };
        });
        
        // Project to top view (X-Z plane)
        const topViewCorners = finalCorners.map(corner => {
          return {
            x: originX + corner.x * scale,
            y: originY - corner.z * scale // Z axis is inverted in canvas
          };
        });
        
        // Draw rectangle
        ctx.beginPath();
        ctx.moveTo(topViewCorners[0].x, topViewCorners[0].y);
        for (let i = 1; i < topViewCorners.length; i++) {
          ctx.lineTo(topViewCorners[i].x, topViewCorners[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Fill with semi-transparent color
        ctx.fillStyle = isSelected ? 'rgba(255, 165, 0, 0.2)' : 'rgba(0, 0, 255, 0.1)';
        ctx.fill();
        
        // Draw sight lines from eye to corners
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.3)' : 'rgba(0, 0, 255, 0.3)';
        for (const corner of topViewCorners) {
          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.lineTo(corner.x, corner.y);
          ctx.stroke();
        }
      } else {
        // Original line-based drawing for top view
        const halfWidth = width * scale / 2;
        
        // Calculate corners
        const x1 = displayCenterX - halfWidth * Math.cos(yawRad);
        const z1 = displayCenterZ - halfWidth * Math.sin(yawRad);
        
        const x2 = displayCenterX + halfWidth * Math.cos(yawRad);
        const z2 = displayCenterZ + halfWidth * Math.sin(yawRad);
        
        // Draw display as a line
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
      }
      
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
      const scale = leftViewScale;
      
      // Calculate display position in left view (Y and Z coordinates)
      const displayCenterZ = z * scale;
      const displayCenterY = -y * scale;
      
      // Set styles based on selection state
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.9)' : 'green';
      
      if (showAsRectangle) {
        // Calculate all four corners of the display in 3D space
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        // Define corners in display local space (before rotation)
        // Top-left, top-right, bottom-right, bottom-left
        const corners = [
          { x: -halfWidth, y: halfHeight, z: 0 },
          { x: halfWidth, y: halfHeight, z: 0 },
          { x: halfWidth, y: -halfHeight, z: 0 },
          { x: -halfWidth, y: -halfHeight, z: 0 }
        ];
        
        // Apply rotations (roll, pitch, yaw in that order)
        const rotatedCorners = corners.map(corner => {
          // Apply roll (around Z)
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
        
        // Apply translation
        const finalCorners = rotatedCorners.map(corner => {
          return {
            x: corner.x + x,
            y: corner.y + y,
            z: corner.z + z
          };
        });
        
        // Project to left view (Z-Y plane)
        const leftViewCorners = finalCorners.map(corner => {
          return {
            x: originX + corner.z * scale,
            y: originY - corner.y * scale // Y axis is inverted in canvas
          };
        });
        
        // Draw rectangle
        ctx.beginPath();
        ctx.moveTo(leftViewCorners[0].x, leftViewCorners[0].y);
        for (let i = 1; i < leftViewCorners.length; i++) {
          ctx.lineTo(leftViewCorners[i].x, leftViewCorners[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Fill with semi-transparent color - increase opacity for better visibility
        ctx.fillStyle = isSelected ? 'rgba(255, 165, 0, 0.3)' : 'rgba(0, 128, 0, 0.2)';
        ctx.fill();
        
        // Draw sight lines from eye to corners
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.5)' : 'rgba(0, 128, 0, 0.5)';
        for (const corner of leftViewCorners) {
          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.lineTo(corner.x, corner.y);
          ctx.stroke();
        }
        
        // Draw a center point on the display to make it more visible
        ctx.fillStyle = isSelected ? 'rgba(255, 165, 0, 0.9)' : 'rgba(0, 128, 0, 0.9)';
        ctx.beginPath();
        const centerPoint = {
          x: originX + displayCenterZ,
          y: originY + displayCenterY
        };
        ctx.arc(centerPoint.x, centerPoint.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Original line-based drawing for left view
        const halfHeight = height * scale / 2;
        
        // Adjust positions based on pitch rotation
        const y1 = displayCenterY - halfHeight * Math.cos(pitchRad);
        const z1 = displayCenterZ - halfHeight * Math.sin(pitchRad);
        
        const y2 = displayCenterY + halfHeight * Math.cos(pitchRad);
        const z2 = displayCenterZ + halfHeight * Math.sin(pitchRad);
        
        // Draw display as a line
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
      }
      
      // Label if selected
      if (isSelected) {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Display ${selectedDisplayIndex + 1}`, originX + displayCenterZ, originY + displayCenterY - 10);
      }
    } else if (viewType === 'front') {
      // Origin is at eye position (center)
      const originX = frontViewCanvas.width / 2;
      const originY = frontViewCanvas.height / 2;
      const scale = frontViewScale;
      
      // Calculate display position in front view (X and Y coordinates)
      const displayCenterX = x * scale;
      const displayCenterY = -y * scale;
      
      // Set styles based on selection state
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.9)' : 'purple';
      
      if (showAsRectangle) {
        // Calculate all four corners of the display in 3D space
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        // Define corners in display local space (before rotation)
        // Top-left, top-right, bottom-right, bottom-left
        const corners = [
          { x: -halfWidth, y: halfHeight, z: 0 },
          { x: halfWidth, y: halfHeight, z: 0 },
          { x: halfWidth, y: -halfHeight, z: 0 },
          { x: -halfWidth, y: -halfHeight, z: 0 }
        ];
        
        // Apply rotations (roll, pitch, yaw in that order)
        const rotatedCorners = corners.map(corner => {
          // Apply roll (around Z)
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
        
        // Apply translation
        const finalCorners = rotatedCorners.map(corner => {
          return {
            x: corner.x + x,
            y: corner.y + y,
            z: corner.z + z
          };
        });
        
        // Project to front view (X-Y plane)
        const frontViewCorners = finalCorners.map(corner => {
          return {
            x: originX + corner.x * scale,
            y: originY - corner.y * scale // Y axis is inverted in canvas
          };
        });
        
        // Draw rectangle
        ctx.beginPath();
        ctx.moveTo(frontViewCorners[0].x, frontViewCorners[0].y);
        for (let i = 1; i < frontViewCorners.length; i++) {
          ctx.lineTo(frontViewCorners[i].x, frontViewCorners[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Fill with semi-transparent color
        ctx.fillStyle = isSelected ? 'rgba(255, 165, 0, 0.2)' : 'rgba(128, 0, 128, 0.1)';
        ctx.fill();
        
        // Draw sight lines from eye to corners
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.3)' : 'rgba(128, 0, 128, 0.3)';
        for (const corner of frontViewCorners) {
          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.lineTo(corner.x, corner.y);
          ctx.stroke();
        }
        
        // Draw a center point on the display to make it more visible
        ctx.fillStyle = isSelected ? 'rgba(255, 165, 0, 0.9)' : 'rgba(128, 0, 128, 0.9)';
        ctx.beginPath();
        const centerPoint = {
          x: originX + displayCenterX,
          y: originY + displayCenterY
        };
        ctx.arc(centerPoint.x, centerPoint.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Line-based drawing for front view
        const halfWidth = width * scale / 2;
        const halfHeight = height * scale / 2;
        
        // Adjust for rotations - simplified for basic display
        // This is a projection onto the X-Y plane
        
        // Draw display as a line rectangle
        ctx.beginPath();
        ctx.rect(originX + displayCenterX - halfWidth, originY + displayCenterY - halfHeight, 
                 halfWidth * 2, halfHeight * 2);
        ctx.stroke();
        
        // Draw sight lines from eye to display corners
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = isSelected ? 'rgba(255, 165, 0, 0.3)' : 'rgba(128, 0, 128, 0.3)';
        
        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + displayCenterX - halfWidth, originY + displayCenterY - halfHeight);
        ctx.stroke();
        
        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + displayCenterX + halfWidth, originY + displayCenterY - halfHeight);
        ctx.stroke();
        
        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + displayCenterX - halfWidth, originY + displayCenterY + halfHeight);
        ctx.stroke();
        
        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + displayCenterX + halfWidth, originY + displayCenterY + halfHeight);
        ctx.stroke();
      }
      
      // Label if selected
      if (isSelected) {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Display ${selectedDisplayIndex + 1}`, originX + displayCenterX, originY + displayCenterY - 10);
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
    
    // Calculate projection boundaries in meters at z=1 (unit distance)
    // Using normalized corner positions instead of angle tangents for accurate values
    // For each corner, project it to the z=1 plane by dividing x and y by z
    const normalizedCorners = finalCorners.map(corner => {
      // Only normalize if z is not 0 to avoid division by zero
      if (Math.abs(corner.z) > 0.0001) {
        return {
          x: corner.x / corner.z,
          y: corner.y / corner.z,
          z: 1
        };
      } else {
        // If z is close to 0, use a large value to represent "infinity"
        return {
          x: corner.x > 0 ? 1000 : -1000,
          y: corner.y > 0 ? 1000 : -1000,
          z: 1
        };
      }
    });
    
    // Find the extents in the normalized space (these are the actual meters at z=1)
    const leftM = Math.min(normalizedCorners[0].x, normalizedCorners[2].x);
    const rightM = Math.max(normalizedCorners[1].x, normalizedCorners[3].x);
    const bottomM = Math.min(normalizedCorners[2].y, normalizedCorners[3].y);
    const topM = Math.max(normalizedCorners[0].y, normalizedCorners[1].y);
    
    return {
      corners: finalCorners,
      anglesToCorners,
      normalizedCorners,
      projection: {
        left,
        right,
        bottom,
        top,
        leftM,
        rightM,
        bottomM,
        topM
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
      <div>Left: ${result.projection.left.toFixed(2)}°</div>
      <div>Right: ${result.projection.right.toFixed(2)}°</div>
      <div>Bottom: ${result.projection.bottom.toFixed(2)}°</div>
      <div>Top: ${result.projection.top.toFixed(2)}°</div>
      <div>Projection Corners (in meters at z=1):</div>
      <div>Left: ${result.projection.leftM.toFixed(3)}</div>
      <div>Right: ${result.projection.rightM.toFixed(3)}</div>
      <div>Bottom: ${result.projection.bottomM.toFixed(3)}</div>
      <div>Top: ${result.projection.topM.toFixed(3)}</div>
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
    frontCtx.clearRect(0, 0, frontViewCanvas.width, frontViewCanvas.height);
    
    // Draw coordinate systems
    drawCoordinateSystem(topCtx, 'top');
    drawCoordinateSystem(leftCtx, 'left');
    drawCoordinateSystem(frontCtx, 'front');
    
    // Draw eye
    drawEye(topCtx, 'top');
    drawEye(leftCtx, 'left');
    drawEye(frontCtx, 'front');
    
    // Draw all displays
    displays.forEach((display, index) => {
      const isSelected = index === selectedDisplayIndex;
      drawDisplay(topCtx, display, 'top', isSelected);
      drawDisplay(leftCtx, display, 'left', isSelected);
      drawDisplay(frontCtx, display, 'front', isSelected);
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
  
  // File Operation Functions
  
  // Create new configuration
  function createNewConfig() {
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
  function openConfigFile() {
    // Using Electron's dialog via IPC
    window.electronAPI.openFile()
      .then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          
          // Read file content
          window.electronAPI.readFile(filePath)
            .then(content => {
              try {
                const config = JSON.parse(content);
                
                // Validate the config has the displays array
                if (Array.isArray(config.displays)) {
                  // Load the configuration
                  displays.length = 0;
                  displays.push(...config.displays);
                  currentFilePath = filePath;
                  
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
                } else {
                  throw new Error('Invalid configuration file format');
                }
              } catch (error) {
                alert(`Error loading configuration: ${error.message}`);
              }
            })
            .catch(error => {
              alert(`Error reading file: ${error.message}`);
            });
        }
      })
      .catch(error => {
        alert(`Error opening file dialog: ${error.message}`);
      });
  }
  
  // Save configuration to current file
  function saveConfig() {
    if (currentFilePath) {
      // We already have a file path, just save
      saveConfigToFile(currentFilePath);
    } else {
      // No current file path, use Save As instead
      saveConfigAs();
    }
  }
  
  // Save configuration with new filename
  function saveConfigAs() {
    // Using Electron's dialog via IPC
    window.electronAPI.saveFile()
      .then(result => {
        if (!result.canceled && result.filePath) {
          saveConfigToFile(result.filePath);
        }
      })
      .catch(error => {
        alert(`Error opening save dialog: ${error.message}`);
      });
  }
  
  // Helper function to save to a specific file
  function saveConfigToFile(filePath) {
    // Prepare data to save
    const configData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      displays: displays
    };
    
    // Convert to JSON string
    const content = JSON.stringify(configData, null, 2);
    
    // Write to file
    window.electronAPI.writeFile(filePath, content)
      .then(() => {
        currentFilePath = filePath;
        alert('Configuration saved successfully!');
      })
      .catch(error => {
        alert(`Error saving file: ${error.message}`);
      });
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
  newConfigBtn.addEventListener('click', createNewConfig);
  openConfigBtn.addEventListener('click', openConfigFile);
  saveConfigBtn.addEventListener('click', saveConfig);
  saveAsConfigBtn.addEventListener('click', saveConfigAs);
});