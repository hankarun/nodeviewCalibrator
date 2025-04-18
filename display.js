// This file contains display-related functionality and utilities

import { calculateProjectionCorners } from './mathutils.js';

// Create a new display from input values
export function createDisplayFromInputs(inputs) {
  return {
    width: parseFloat(inputs.width),
    height: parseFloat(inputs.height),
    distance: parseFloat(inputs.distance), // Keep for backwards compatibility
    yaw: parseFloat(inputs.yaw),
    pitch: parseFloat(inputs.pitch),
    roll: parseFloat(inputs.roll),
    x: parseFloat(inputs.x),
    y: parseFloat(inputs.y),
    z: parseFloat(inputs.z)
  };
}

// Show calculations for the display
export function calculateDisplayProjection(display) {
  const result = calculateProjectionCorners(display);
  const nearestPoint = result.offcenterProjection.nearestPoint;
  
  // Store the nearest point in the display object for rendering
  display.nearestPoint = nearestPoint;
  
  return result;
}

// Format calculation results for display
export function formatDisplayCalculations(result) {
  const nearestPoint = result.offcenterProjection.nearestPoint;
  
  return ` 
    <div>Offcenter Projection Parameters:</div>
    <div>Eye to nearest point: ${nearestPoint.distance.toFixed(3)}m</div>
    
    <div>Nearest Point on Plane:</div>
    <div>Position: (${nearestPoint.x.toFixed(3)}, ${nearestPoint.y.toFixed(3)}, ${nearestPoint.z.toFixed(3)})</div>
    
    <div>Corner vectors from nearest point:</div>
    <div>Top-Left: (${result.cornersRelativeToNearest[0].x.toFixed(3)}, ${result.cornersRelativeToNearest[0].y.toFixed(3)}, ${result.cornersRelativeToNearest[0].z.toFixed(3)})</div>
    <div>Top-Right: (${result.cornersRelativeToNearest[1].x.toFixed(3)}, ${result.cornersRelativeToNearest[1].y.toFixed(3)}, ${result.cornersRelativeToNearest[1].z.toFixed(3)})</div>
    <div>Bottom-Left: (${result.cornersRelativeToNearest[2].x.toFixed(3)}, ${result.cornersRelativeToNearest[2].y.toFixed(3)}, ${result.cornersRelativeToNearest[2].z.toFixed(3)})</div>
    <div>Bottom-Right: (${result.cornersRelativeToNearest[3].x.toFixed(3)}, ${result.cornersRelativeToNearest[3].y.toFixed(3)}, ${result.cornersRelativeToNearest[3].z.toFixed(3)})</div>
  `;
}

// Display size presets (diagonal inches -> width & height in meters)
export const displayPresets = {
  "27": { width: 0.598, height: 0.336 },
  "32": { width: 0.708, height: 0.398 },
  "40": { width: 0.886, height: 0.498 },
  "43": { width: 0.952, height: 0.535 },
  "50": { width: 1.107, height: 0.623 },
  "55": { width: 1.218, height: 0.685 },
  "65": { width: 1.440, height: 0.810 },
  "75": { width: 1.660, height: 0.934 }
};