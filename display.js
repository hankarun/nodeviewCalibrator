// This file contains display-related functionality and utilities

import { calculateProjectionCorners } from './mathutils.js';

function rotateVectorByDisplay(vector, yawRad, pitchRad, rollRad) {
  // Apply roll (around Z)
  const x1 = vector.x * Math.cos(rollRad) - vector.y * Math.sin(rollRad);
  const y1 = vector.x * Math.sin(rollRad) + vector.y * Math.cos(rollRad);
  const z1 = vector.z;

  // Apply pitch (around X)
  const y2 = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
  const z2 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);
  const x2 = x1;

  // Apply yaw (around Y)
  const x3 = x2 * Math.cos(yawRad) - z2 * Math.sin(yawRad);
  const z3 = x2 * Math.sin(yawRad) + z2 * Math.cos(yawRad);
  const y3 = y2;

  return { x: x3, y: y3, z: z3 };
}

function calculateDisplayAxes(display) {
  const yawRad = (display.yaw || 0) * Math.PI / 180;
  const pitchRad = (display.pitch || 0) * Math.PI / 180;
  const rollRad = (display.roll || 0) * Math.PI / 180;

  return {
    localX: rotateVectorByDisplay({ x: 1, y: 0, z: 0 }, yawRad, pitchRad, rollRad),
    localY: rotateVectorByDisplay({ x: 0, y: 1, z: 0 }, yawRad, pitchRad, rollRad)
  };
}

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
    z: parseFloat(inputs.z),
    showBorders: inputs.showBorders === undefined ? true : inputs.showBorders, // Default to true for visibility
    borderWidthCm: inputs.borderWidthCm === undefined ? 2 : parseFloat(inputs.borderWidthCm), // Border width in cm
    borderColor: inputs.borderColor || 'black' // Border color
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
export function formatDisplayCalculations(result, display = null, useStableCalculation = true) {
  const nearestPoint = result.offcenterProjection.nearestPoint;

  let edgeDistances;

  if (display && (display.yaw !== 0 || display.pitch !== 0 || display.roll !== 0)) {
    edgeDistances = calculateEdgeDistancesFromNearestPoint(display, useStableCalculation);
  } else {
    const displayData = {
      width: result.corners[1].x - result.corners[0].x,
      height: result.corners[0].y - result.corners[2].y,
      x: (result.corners[0].x + result.corners[3].x) / 2,
      y: (result.corners[0].y + result.corners[3].y) / 2,
      z: (result.corners[0].z + result.corners[3].z) / 2,
      yaw: 0,
      pitch: 0,
      roll: 0
    };

    edgeDistances = calculateEdgeDistancesFromNearestPoint({
      ...displayData,
      corners: result.corners,
      cornersRelativeToNearest: result.cornersRelativeToNearest
    }, useStableCalculation);
  }

  const modeLabel = useStableCalculation ? 'Stable' : 'Precise';

  const formatMeters = value => `${value.toFixed(3)}m`;
  const nearPlaneMeters = formatMeters(Math.abs(nearestPoint.distance));

  return `
    <section class="projection-summary">
      <header class="projection-header">Offcenter Projection Parameters (${modeLabel})</header>
      <table class="projection-table">
        <tbody>
          <tr><th scope="row">Near Plane</th><td>${nearPlaneMeters}</td></tr>
          <tr><th scope="row">Left</th><td>${formatMeters(edgeDistances.left)}</td></tr>
          <tr><th scope="row">Right</th><td>${formatMeters(edgeDistances.right)}</td></tr>
          <tr><th scope="row">Top</th><td>${formatMeters(edgeDistances.top)}</td></tr>
          <tr><th scope="row">Bottom</th><td>${formatMeters(edgeDistances.bottom)}</td></tr>
        </tbody>
      </table>
    </section>
  `;
}

// Calculate signed offsets from the nearest point to each display edge (left, right, top, bottom)
// Provides stable edge calculations for rotated displays and includes magnitude helpers
export function calculateEdgeDistancesFromNearestPoint(display, useStableCalculation = true) {
  let result;
  let corners;

  if (display.cornersRelativeToNearest) {
    corners = display.cornersRelativeToNearest;
  } else {
    result = calculateProjectionCorners(display);
    corners = result.cornersRelativeToNearest;
  }

  if (!result) {
    result = calculateProjectionCorners(display);
  }

  const nearestPoint = result.offcenterProjection.nearestPoint;
  const { localX, localY } = calculateDisplayAxes(display);
  const displayCenter = { x: display.x, y: display.y, z: display.z };
  const centerVector = {
    x: displayCenter.x - nearestPoint.x,
    y: displayCenter.y - nearestPoint.y,
    z: displayCenter.z - nearestPoint.z
  };

  const centerOnLocalX = centerVector.x * localX.x + centerVector.y * localX.y + centerVector.z * localX.z;
  const centerOnLocalY = centerVector.x * localY.x + centerVector.y * localY.y + centerVector.z * localY.z;

  const halfWidth = display.width / 2;
  const halfHeight = display.height / 2;

  const left = centerOnLocalX - halfWidth;
  const right = centerOnLocalX + halfWidth;
  const top = centerOnLocalY + halfHeight;
  const bottom = centerOnLocalY - halfHeight;

  const magnitudes = {
    left: Math.abs(left),
    right: Math.abs(right),
    top: Math.abs(top),
    bottom: Math.abs(bottom)
  };

  if (useStableCalculation) {
    const nearestPoints = {
      left: {
        x: displayCenter.x - localX.x * halfWidth,
        y: displayCenter.y - localX.y * halfWidth,
        z: displayCenter.z - localX.z * halfWidth
      },
      right: {
        x: displayCenter.x + localX.x * halfWidth,
        y: displayCenter.y + localX.y * halfWidth,
        z: displayCenter.z + localX.z * halfWidth
      },
      top: {
        x: displayCenter.x + localY.x * halfHeight,
        y: displayCenter.y + localY.y * halfHeight,
        z: displayCenter.z + localY.z * halfHeight
      },
      bottom: {
        x: displayCenter.x - localY.x * halfHeight,
        y: displayCenter.y - localY.y * halfHeight,
        z: displayCenter.z - localY.z * halfHeight
      }
    };

    return {
      left,
      right,
      top,
      bottom,
      nearestPoints,
      localAxes: { x: localX, y: localY },
      projections: { centerOnLocalX, centerOnLocalY },
      magnitudes
    };
  }

  const leftEdgeVector = {
    x: corners[2].x - corners[0].x,
    y: corners[2].y - corners[0].y,
    z: corners[2].z - corners[0].z
  };

  const topEdgeVector = {
    x: corners[1].x - corners[0].x,
    y: corners[1].y - corners[0].y,
    z: corners[1].z - corners[0].z
  };

  const rightEdgeVector = {
    x: corners[3].x - corners[1].x,
    y: corners[3].y - corners[1].y,
    z: corners[3].z - corners[1].z
  };

  const bottomEdgeVector = {
    x: corners[3].x - corners[2].x,
    y: corners[3].y - corners[2].y,
    z: corners[3].z - corners[2].z
  };

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

  const leftEdgeProjection = -(
    corners[0].x * leftEdgeNormalized.x +
    corners[0].y * leftEdgeNormalized.y +
    corners[0].z * leftEdgeNormalized.z
  );

  const topEdgeProjection = -(
    corners[0].x * topEdgeNormalized.x +
    corners[0].y * topEdgeNormalized.y +
    corners[0].z * topEdgeNormalized.z
  );

  const rightEdgeProjection = -(
    corners[1].x * rightEdgeNormalized.x +
    corners[1].y * rightEdgeNormalized.y +
    corners[1].z * rightEdgeNormalized.z
  );

  const bottomEdgeProjection = -(
    corners[2].x * bottomEdgeNormalized.x +
    corners[2].y * bottomEdgeNormalized.y +
    corners[2].z * bottomEdgeNormalized.z
  );

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
    left,
    right,
    top,
    bottom,
    nearestPoints: {
      left: leftEdgeNearest,
      top: topEdgeNearest,
      right: rightEdgeNearest,
      bottom: bottomEdgeNearest
    },
    localAxes: { x: localX, y: localY },
    projections: { centerOnLocalX, centerOnLocalY },
    magnitudes: {
      left: leftDistance,
      right: rightDistance,
      top: topDistance,
      bottom: bottomDistance
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