// This file contains all canvas drawing functions and interactions for the application

/**
 * Draw eye position on the given canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} viewType - View type ('top', 'left', or 'front')
 */
export function drawEye(ctx, viewType) {
  const canvas = ctx.canvas;
  ctx.fillStyle = 'red';
  if (viewType === 'top') {
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (viewType === 'left') {
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (viewType === 'front') {
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw coordinate system on the given canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} viewType - View type ('top', 'left', or 'front') 
 * @param {number} scale - Current scale factor for this view
 * @param {number} defaultScale - Default scale factor
 */
export function drawCoordinateSystem(ctx, viewType, scale, defaultScale) {
  const canvas = ctx.canvas;
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  
  if (viewType === 'top') {
    // Origin is at eye position (center of canvas)
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;
    
    // Draw Z axis (forward)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, 20);
    ctx.stroke();
    
    // Draw X axis (right)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(canvas.width - 20, originY);
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = 'black';
    ctx.font = '12px sans-serif';
    ctx.fillText('Z', originX + 5, 30);
    ctx.fillText('X', canvas.width - 30, originY - 5);
    
    // Display current scale
    ctx.fillText(`Scale: ${(scale / defaultScale).toFixed(1)}x`, 10, 20);
  } else if (viewType === 'left') {
    // Origin is at eye position (center of canvas)
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;
    
    // Draw Z axis (forward)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(canvas.width - 20, originY);
    ctx.stroke();
    
    // Draw Y axis (up)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, 20);
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = 'black';
    ctx.font = '12px sans-serif';
    ctx.fillText('Z', canvas.width - 30, originY - 5);
    ctx.fillText('Y', originX + 5, 30);
    
    // Display current scale
    ctx.fillText(`Scale: ${(scale / defaultScale).toFixed(1)}x`, 10, 20);
  } else if (viewType === 'front') {
    // Origin is at eye position (center of canvas)
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;
    
    // Draw X axis (right)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(canvas.width - 20, originY);
    ctx.stroke();
    
    // Draw Y axis (up)
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, 20);
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = 'black';
    ctx.font = '12px sans-serif';
    ctx.fillText('X', canvas.width - 30, originY - 5);
    ctx.fillText('Y', originX + 5, 30);
    
    // Display current scale
    ctx.fillText(`Scale: ${(scale / defaultScale).toFixed(1)}x`, 10, 20);
  }
}

/**
 * Draw display on the given canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context 
 * @param {Object} display - Display object with position and dimensions
 * @param {string} viewType - View type ('top', 'left', or 'front')
 * @param {boolean} isSelected - Whether this display is currently selected
 * @param {number} selectedDisplayIndex - Index of selected display
 * @param {boolean} showAsRectangle - Whether to show as rectangles
 * @param {number} scale - Current scale factor for this view
 * @param {number} nearPlane - Near plane distance (null if not in lock mode)
 */
export function drawDisplay(ctx, display, viewType, isSelected, selectedDisplayIndex, showAsRectangle, scale, nearPlane = null) {
  const canvas = ctx.canvas;
  const { width, height, distance, yaw, pitch, roll, x, y, z } = display;
  
  // Check if showBorders is defined, default to true if not
  const showBorders = display.showBorders !== undefined ? display.showBorders : true;
  // Get border width in centimeters, default to 2cm if not specified
  const borderWidthCm = display.borderWidthCm !== undefined ? display.borderWidthCm : 1.4;
  // Get border color, default to black if not specified
  const borderColor = display.borderColor || 'black';
  
  // Convert angles to radians
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rollRad = roll * Math.PI / 180;
  
  if (viewType === 'top') {
    // Origin is at eye position (center)
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;
    
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
        };      });
      
      // Draw rectangle
      ctx.beginPath();
      ctx.moveTo(topViewCorners[0].x, topViewCorners[0].y);
      for (let i = 1; i < topViewCorners.length; i++) {
        ctx.lineTo(topViewCorners[i].x, topViewCorners[i].y);
      }
      ctx.closePath();
      
      if (showBorders) {
        // Draw borders with the specified style and width in cm
        // Convert cm to pixels based on current scale (scale is in meters)
        ctx.lineWidth = (borderWidthCm / 100) * scale;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      }
      
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
      
      if (showBorders) {
        // Draw borders with the specified style and width in cm
        ctx.lineWidth = (borderWidthCm / 100) * scale;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      } else if (isSelected) {
        // If selected, still show the line
        ctx.stroke();
      }
      
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
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;
    
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
      
      if (showBorders) {
        // Draw borders with the specified style and width in cm
        // Convert cm to pixels based on current scale (scale is in meters)
        ctx.lineWidth = (borderWidthCm / 100) * scale;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      } else {
        // If no borders but selected, still show outline
        if (isSelected) {
          ctx.stroke();
        }
      }
      
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
      
      if (showBorders) {
        // Draw borders with the specified style and width in cm
        ctx.lineWidth = (borderWidthCm / 100) * scale;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      } else if (isSelected) {
        // If selected, still show the line
        ctx.stroke();
      }
      
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
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;
    
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
      
      if (showBorders) {
        // Draw borders with the specified style and width in cm
        // Convert cm to pixels based on current scale (scale is in meters)
        ctx.lineWidth = (borderWidthCm / 100) * scale;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      } else {
        // If no borders but selected, still show outline
        if (isSelected) {
          ctx.stroke();
        }
      }
      
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
        // Draw display as a line rectangle
      ctx.beginPath();
      ctx.rect(originX + displayCenterX - halfWidth, originY + displayCenterY - halfHeight, 
               halfWidth * 2, halfHeight * 2);
      
      if (showBorders) {
        // Draw borders with the specified style and width in cm
        ctx.lineWidth = (borderWidthCm / 100) * scale;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      } else if (isSelected) {
        // If selected, still show the rectangle
        ctx.stroke();
      }
      
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
  
  // Draw the nearest point if this display is selected
  if (isSelected && display.nearestPoint) {
    const nearestPoint = display.nearestPoint;
    
    // Draw the nearest point with a distinctive appearance
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';  // Bright red
    
    if (viewType === 'top') {
      const originX = canvas.width / 2;
      const originY = canvas.height / 2;
      
      // Draw in top view (x-z plane)
      ctx.beginPath();
      ctx.arc(originX + nearestPoint.x * scale, originY - nearestPoint.z * scale, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw line from eye to nearest point
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + nearestPoint.x * scale, originY - nearestPoint.z * scale);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Add label
      ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.font = '12px sans-serif';
      ctx.fillText('Nearest point', originX + nearestPoint.x * scale + 8, originY - nearestPoint.z * scale - 8);
    }
    else if (viewType === 'left') {
      const originX = canvas.width / 2;
      const originY = canvas.height / 2;
      
      // Draw in left view (z-y plane)
      ctx.beginPath();
      ctx.arc(originX + nearestPoint.z * scale, originY - nearestPoint.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw line from eye to nearest point
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + nearestPoint.z * scale, originY - nearestPoint.y * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    else if (viewType === 'front') {
      const originX = canvas.width / 2;
      const originY = canvas.height / 2;
      
      // Draw in front view (x-y plane)
      ctx.beginPath();
      ctx.arc(originX + nearestPoint.x * scale, originY - nearestPoint.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw line from eye to nearest point
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + nearestPoint.x * scale, originY - nearestPoint.y * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  
  // Draw near plane visualization if nearPlane is provided and display is selected
  if (isSelected && nearPlane !== null && display.nearestPoint) {
    const nearestPoint = display.nearestPoint;
    const nearestDistance = Math.abs(nearestPoint.distance);
    
    // Only draw if nearPlane is different from nearest point distance
    if (Math.abs(nearPlane - nearestDistance) > 0.001) {
      const canvas = ctx.canvas;
      const originX = canvas.width / 2;
      const originY = canvas.height / 2;
      
      // Calculate the scale factor between near plane and nearest point
      const scaleFactor = nearPlane / nearestDistance;
      
      // Scale the nearest point to get the near plane point
      const nearPlanePoint = {
        x: nearestPoint.x * scaleFactor,
        y: nearestPoint.y * scaleFactor,
        z: nearestPoint.z * scaleFactor
      };
      
      // Draw near plane point
      ctx.fillStyle = 'rgba(0, 128, 255, 0.8)';  // Blue
      
      if (viewType === 'top') {
        // Draw in top view (x-z plane)
        ctx.beginPath();
        ctx.arc(originX + nearPlanePoint.x * scale, originY - nearPlanePoint.z * scale, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw line from eye to near plane point
        ctx.strokeStyle = 'rgba(0, 128, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + nearPlanePoint.x * scale, originY - nearPlanePoint.z * scale);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Add label
        ctx.fillStyle = 'rgba(0, 128, 255, 0.9)';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Near plane (${nearPlane.toFixed(3)}m)`, 
                     originX + nearPlanePoint.x * scale + 8, 
                     originY - nearPlanePoint.z * scale + 12);
      }
      else if (viewType === 'left') {
        // Draw in left view (z-y plane)
        ctx.beginPath();
        ctx.arc(originX + nearPlanePoint.z * scale, originY - nearPlanePoint.y * scale, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw line from eye to near plane point
        ctx.strokeStyle = 'rgba(0, 128, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + nearPlanePoint.z * scale, originY - nearPlanePoint.y * scale);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      else if (viewType === 'front') {
        // Draw in front view (x-y plane)
        ctx.beginPath();
        ctx.arc(originX + nearPlanePoint.x * scale, originY - nearPlanePoint.y * scale, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw line from eye to near plane point
        ctx.strokeStyle = 'rgba(0, 128, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(originX + nearPlanePoint.x * scale, originY - nearPlanePoint.y * scale);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

/**
 * Set canvas dimensions based on its container
 * @param {HTMLCanvasElement} canvas - Canvas element to resize
 */
export function setCanvasDimensions(canvas) {
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

/**
 * Initialize mouse drag functionality for a canvas
 * @param {HTMLCanvasElement} canvas - Canvas element to add drag functionality to
 * @param {string} viewType - View type ('top', 'left', or 'front')
 * @param {Function} onDisplayDrag - Callback for dragging display (right-click) - receives dx, dy, viewType
 * @param {Function} onCanvasDrag - Callback for dragging canvas view (left-click) - receives dx, dy, viewType
 */
export function initCanvasDrag(canvas, viewType, onDisplayDrag, onCanvasDrag) {
  let isDragging = false;
  let isDisplayDrag = false; // Flag to determine if we're dragging a display (right click) or the view (left click)
  let lastX, lastY;
  
  // Prevent context menu on right-click to allow right-click dragging
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    return false;
  });
  
  // Mouse down event - start dragging
  canvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    // Right mouse button (button === 2) drags display
    isDisplayDrag = event.button === 2;
    lastX = event.offsetX;
    lastY = event.offsetY;
    
    // Change cursor based on drag type
    if (isDisplayDrag) {
      canvas.style.cursor = 'move'; // Indicate display movement
    } else {
      canvas.style.cursor = 'grabbing'; // Indicate canvas/view movement
    }
  });
  
  // Mouse move event - calculate drag distance and invoke appropriate callback
  canvas.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    
    const dx = event.offsetX - lastX;
    const dy = event.offsetY - lastY;
    lastX = event.offsetX;
    lastY = event.offsetY;
    
    // Note: we reverse dy since canvas y-axis is inverted compared to our coordinate system
    if (isDisplayDrag) {
      // Right-click drag affects only the selected display
      onDisplayDrag(dx, -dy, viewType);
    } else {
      // Left-click drag affects the canvas view
      onCanvasDrag(dx, dy, viewType);
    }
  });
  
  // Mouse up event - stop dragging
  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    if (isDisplayDrag) {
      canvas.style.cursor = 'default';
    } else {
      canvas.style.cursor = 'grab';
    }
    isDisplayDrag = false;
  });
  
  // Mouse leave event - stop dragging if mouse leaves canvas
  canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      canvas.style.cursor = isDisplayDrag ? 'default' : 'grab';
      isDisplayDrag = false;
    }
  });
  
  // Mouse enter event - show appropriate cursor
  canvas.addEventListener('mouseenter', (event) => {
    if (event.buttons === 1) { // Left mouse button still down
      canvas.style.cursor = 'grabbing';
    } else if (event.buttons === 2) { // Right mouse button still down
      canvas.style.cursor = 'move';
    } else {
      canvas.style.cursor = 'grab';
    }
  });
  
  // Wheel event for zooming
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    
    // Determine scale factor based on wheel direction
    const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
    
    // Call the appropriate scale function based on view type
    if (viewType === 'top') {
      window.dispatchEvent(new CustomEvent('topViewScale', { detail: { factor: scaleFactor } }));
    } else if (viewType === 'left') {
      window.dispatchEvent(new CustomEvent('leftViewScale', { detail: { factor: scaleFactor } }));
    } else if (viewType === 'front') {
      window.dispatchEvent(new CustomEvent('frontViewScale', { detail: { factor: scaleFactor } }));
    }
  });
  
  // Set initial cursor to indicate draggable area
  canvas.style.cursor = 'grab';
}