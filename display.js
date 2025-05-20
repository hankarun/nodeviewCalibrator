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
  
  // Calculate edge distances
  const display = {
    width: result.corners[1].x - result.corners[0].x,
    height: result.corners[0].y - result.corners[2].y,
    x: (result.corners[0].x + result.corners[3].x) / 2,
    y: (result.corners[0].y + result.corners[3].y) / 2,
    z: (result.corners[0].z + result.corners[3].z) / 2,
    yaw: 0, // These are already applied in the result
    pitch: 0,
    roll: 0
  };
  
  const edgeDistances = calculateEdgeDistancesFromNearestPoint({
    width: display.width,
    height: display.height,
    x: display.x,
    y: display.y,
    z: display.z,
    yaw: 0,
    pitch: 0,
    roll: 0,
    // Include the corners from the result so we can reuse them directly
    corners: result.corners,
    cornersRelativeToNearest: result.cornersRelativeToNearest
  });
  
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
    
    <div>Distances from nearest point to edges:</div>
    <div>Left: ${edgeDistances.left.toFixed(3)}m</div>
    <div>Top: ${edgeDistances.top.toFixed(3)}m</div>
    <div>Right: ${edgeDistances.right.toFixed(3)}m</div>
    <div>Bottom: ${edgeDistances.bottom.toFixed(3)}m</div>
  `;
}

// Calculate distances from nearest point to display edges (left, top, bottom, right)
export function calculateEdgeDistancesFromNearestPoint(display) {
  let corners;
  let result;
  
  // Check if corners are already provided (for reuse from formatDisplayCalculations)
  if (display.cornersRelativeToNearest) {
    corners = display.cornersRelativeToNearest;
  } else {
    // If not, calculate them using the full projection function
    result = calculateProjectionCorners(display);
    corners = result.cornersRelativeToNearest;
  }
  
  // Top-left, top-right, bottom-left, bottom-right
  // We need to calculate the closest distances from the nearest point to each edge
  
  // Calculate the distances from nearest point to each edge
  // For each edge, calculate the nearest point on the edge from the nearest point
  
  // For the left edge (between top-left and bottom-left corners)
  const leftEdgeVector = {
    x: corners[2].x - corners[0].x,
    y: corners[2].y - corners[0].y,
    z: corners[2].z - corners[0].z
  };
  
  // For the top edge (between top-left and top-right corners)
  const topEdgeVector = {
    x: corners[1].x - corners[0].x,
    y: corners[1].y - corners[0].y,
    z: corners[1].z - corners[0].z
  };
  
  // For the right edge (between top-right and bottom-right corners)
  const rightEdgeVector = {
    x: corners[3].x - corners[1].x,
    y: corners[3].y - corners[1].y,
    z: corners[3].z - corners[1].z
  };
  
  // For the bottom edge (between bottom-left and bottom-right corners)
  const bottomEdgeVector = {
    x: corners[3].x - corners[2].x,
    y: corners[3].y - corners[2].y,
    z: corners[3].z - corners[2].z
  };
  
  // Calculate the length of each edge vector
  const leftEdgeLength = Math.sqrt(
    leftEdgeVector.x * leftEdgeVector.x +
    leftEdgeVector.y * leftEdgeVector.y +
    leftEdgeVector.z * leftEdgeVector.z
  );
  
  const topEdgeLength = Math.sqrt(
    topEdgeVector.x * topEdgeVector.x +
    topEdgeVector.y * topEdgeVector.y +
    topEdgeVector.z * topEdgeVector.z
  );
  
  const rightEdgeLength = Math.sqrt(
    rightEdgeVector.x * rightEdgeVector.x +
    rightEdgeVector.y * rightEdgeVector.y +
    rightEdgeVector.z * rightEdgeVector.z
  );
  
  const bottomEdgeLength = Math.sqrt(
    bottomEdgeVector.x * bottomEdgeVector.x +
    bottomEdgeVector.y * bottomEdgeVector.y +
    bottomEdgeVector.z * bottomEdgeVector.z
  );
  
  // Normalized edge vectors (unit vectors)
  const leftEdgeNormalized = {
    x: leftEdgeVector.x / leftEdgeLength,
    y: leftEdgeVector.y / leftEdgeLength,
    z: leftEdgeVector.z / leftEdgeLength
  };
  
  const topEdgeNormalized = {
    x: topEdgeVector.x / topEdgeLength,
    y: topEdgeVector.y / topEdgeLength,
    z: topEdgeVector.z / topEdgeLength
  };
  
  const rightEdgeNormalized = {
    x: rightEdgeVector.x / rightEdgeLength,
    y: rightEdgeVector.y / rightEdgeLength,
    z: rightEdgeVector.z / rightEdgeLength
  };
  
  const bottomEdgeNormalized = {
    x: bottomEdgeVector.x / bottomEdgeLength,
    y: bottomEdgeVector.y / bottomEdgeLength,
    z: bottomEdgeVector.z / bottomEdgeLength
  };
  
  // Calculate the projection of the origin (nearest point is at origin in this space) 
  // onto each edge
  
  // For the left edge
  const leftEdgeProjection = -(
    corners[0].x * leftEdgeNormalized.x +
    corners[0].y * leftEdgeNormalized.y +
    corners[0].z * leftEdgeNormalized.z
  );
  
  // For the top edge
  const topEdgeProjection = -(
    corners[0].x * topEdgeNormalized.x +
    corners[0].y * topEdgeNormalized.y +
    corners[0].z * topEdgeNormalized.z
  );
  
  // For the right edge
  const rightEdgeProjection = -(
    corners[1].x * rightEdgeNormalized.x +
    corners[1].y * rightEdgeNormalized.y +
    corners[1].z * rightEdgeNormalized.z
  );
  
  // For the bottom edge
  const bottomEdgeProjection = -(
    corners[2].x * bottomEdgeNormalized.x +
    corners[2].y * bottomEdgeNormalized.y +
    corners[2].z * bottomEdgeNormalized.z
  );
  
  // Calculate the nearest point on each edge
  const leftEdgeNearest = {
    x: corners[0].x + leftEdgeNormalized.x * Math.max(0, Math.min(leftEdgeLength, leftEdgeProjection)),
    y: corners[0].y + leftEdgeNormalized.y * Math.max(0, Math.min(leftEdgeLength, leftEdgeProjection)),
    z: corners[0].z + leftEdgeNormalized.z * Math.max(0, Math.min(leftEdgeLength, leftEdgeProjection))
  };
  
  const topEdgeNearest = {
    x: corners[0].x + topEdgeNormalized.x * Math.max(0, Math.min(topEdgeLength, topEdgeProjection)),
    y: corners[0].y + topEdgeNormalized.y * Math.max(0, Math.min(topEdgeLength, topEdgeProjection)),
    z: corners[0].z + topEdgeNormalized.z * Math.max(0, Math.min(topEdgeLength, topEdgeProjection))
  };
  
  const rightEdgeNearest = {
    x: corners[1].x + rightEdgeNormalized.x * Math.max(0, Math.min(rightEdgeLength, rightEdgeProjection)),
    y: corners[1].y + rightEdgeNormalized.y * Math.max(0, Math.min(rightEdgeLength, rightEdgeProjection)),
    z: corners[1].z + rightEdgeNormalized.z * Math.max(0, Math.min(rightEdgeLength, rightEdgeProjection))
  };
  
  const bottomEdgeNearest = {
    x: corners[2].x + bottomEdgeNormalized.x * Math.max(0, Math.min(bottomEdgeLength, bottomEdgeProjection)),
    y: corners[2].y + bottomEdgeNormalized.y * Math.max(0, Math.min(bottomEdgeLength, bottomEdgeProjection)),
    z: corners[2].z + bottomEdgeNormalized.z * Math.max(0, Math.min(bottomEdgeLength, bottomEdgeProjection))
  };
  
  // Calculate the distance from nearest point to nearest point on each edge
  const leftDistance = Math.sqrt(
    leftEdgeNearest.x * leftEdgeNearest.x +
    leftEdgeNearest.y * leftEdgeNearest.y +
    leftEdgeNearest.z * leftEdgeNearest.z
  );
  
  const topDistance = Math.sqrt(
    topEdgeNearest.x * topEdgeNearest.x +
    topEdgeNearest.y * topEdgeNearest.y +
    topEdgeNearest.z * topEdgeNearest.z
  );
  
  const rightDistance = Math.sqrt(
    rightEdgeNearest.x * rightEdgeNearest.x +
    rightEdgeNearest.y * rightEdgeNearest.y +
    rightEdgeNearest.z * rightEdgeNearest.z
  );
  
  const bottomDistance = Math.sqrt(
    bottomEdgeNearest.x * bottomEdgeNearest.x +
    bottomEdgeNearest.y * bottomEdgeNearest.y +
    bottomEdgeNearest.z * bottomEdgeNearest.z
  );
  
  return {
    left: leftDistance,
    top: topDistance,
    right: rightDistance,
    bottom: bottomDistance,
    nearestPoints: {
      left: leftEdgeNearest,
      top: topEdgeNearest,
      right: rightEdgeNearest,
      bottom: bottomEdgeNearest
    }
  };
}

// Format edge distances for display
export function formatEdgeDistances(edgeDistances) {
  return `
    <div>Distances from nearest point to display edges:</div>
    <div>Left: ${edgeDistances.left.toFixed(3)}m</div>
    <div>Top: ${edgeDistances.top.toFixed(3)}m</div>
    <div>Right: ${edgeDistances.right.toFixed(3)}m</div>
    <div>Bottom: ${edgeDistances.bottom.toFixed(3)}m</div>
  `;
}

// Get near plane frustum values for camera setup
export function getNearPlaneFrustum(display, nearDistance = 0.1) {
  const result = calculateProjectionCorners(display);
  const nearestPoint = result.offcenterProjection.nearestPoint;
  const eyeToNearestDistance = nearestPoint.distance;
  
  // Scale factor to convert from eye-to-nearest to eye-to-near plane
  const scaleFactor = nearDistance / eyeToNearestDistance;
  
  // Scale the corner vectors to near plane distance
  const scaledCorners = result.cornersRelativeToNearest.map(corner => {
    return {
      x: corner.x * scaleFactor,
      y: corner.y * scaleFactor,
      z: corner.z * scaleFactor
    };
  });
  
  // Extract the frustum values (top, right, bottom, left)
  return {
    nearDistance,
    top: scaledCorners[0].y,       // Top (y-coordinate of top-left corner)
    left: scaledCorners[0].x,      // Left (x-coordinate of top-left corner)
    right: scaledCorners[1].x,     // Right (x-coordinate of top-right corner)
    bottom: scaledCorners[2].y     // Bottom (y-coordinate of bottom-left corner)
  };
}

// Format near plane frustum values for display
export function formatNearPlaneFrustum(frustumData) {
  return `
    <div>Camera Near Plane Frustum (distance: ${frustumData.nearDistance}m):</div>
    <div>Top: ${frustumData.top.toFixed(3)}</div>
    <div>Left: ${frustumData.left.toFixed(3)}</div>
    <div>Right: ${frustumData.right.toFixed(3)}</div>
    <div>Bottom: ${frustumData.bottom.toFixed(3)}</div>
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