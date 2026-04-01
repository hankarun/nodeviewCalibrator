// This file contains display-related functionality and utilities

import { calculateProjectionCorners, rotateVector } from './mathutils.js';

function calculateDisplayAxes(display) {
  const yawRad = (display.yaw || 0) * Math.PI / 180;
  const pitchRad = (display.pitch || 0) * Math.PI / 180;
  const rollRad = (display.roll || 0) * Math.PI / 180;

  return {
    localX: rotateVector({ x: 1, y: 0, z: 0 }, yawRad, pitchRad, rollRad),
    localY: rotateVector({ x: 0, y: 1, z: 0 }, yawRad, pitchRad, rollRad)
  };
}

// Create a new display from input values
export function createDisplayFromInputs(inputs) {
  const result = {
    name: inputs.name !== undefined ? inputs.name : '',
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
  // Optional per-display near plane override (null = use computed nearest point distance)
  if (inputs.nearPlane !== undefined && inputs.nearPlane !== null && inputs.nearPlane !== '') {
    result.nearPlane = parseFloat(inputs.nearPlane);
  }
  return result;
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
export function formatDisplayCalculations(result, display = null, useStableCalculation = true, nearPlane = null) {
  const nearestPoint = result.offcenterProjection.nearestPoint;
  const anglesToCorners = result.anglesToCorners;

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
  
  // Display-distance frustum: use leftM/rightM/topM/bottomM (projected to z=1) * nearest distance
  const nearestDist = Math.abs(nearestPoint.distance);
  const { leftM, rightM, topM, bottomM } = result.projection;
  
  const displayFrustum = {
    left: leftM * nearestDist,
    right: rightM * nearestDist,
    top: topM * nearestDist,
    bottom: bottomM * nearestDist
  };

  // Build display-distance section (always shown)
  let html = `
    <section class="projection-summary">
      <header class="projection-header">Offcenter Projection at Display (${modeLabel})</header>
      <table class="projection-table">
        <tbody>
          <tr><th scope="row">Near Plane</th><td>${formatMeters(nearestDist)}</td></tr>
          <tr><th scope="row">Left</th><td>${formatMeters(displayFrustum.left)}</td></tr>
          <tr><th scope="row">Right</th><td>${formatMeters(displayFrustum.right)}</td></tr>
          <tr><th scope="row">Top</th><td>${formatMeters(displayFrustum.top)}</td></tr>
          <tr><th scope="row">Bottom</th><td>${formatMeters(displayFrustum.bottom)}</td></tr>
        </tbody>
      </table>
    </section>`;

  // Custom near plane section: convert to angles (atan), then recalculate at custom near (tan)
  if (nearPlane !== null && nearestDist > 0.0001) {
    const angleLeft = Math.atan(displayFrustum.left / nearestDist);
    const angleRight = Math.atan(displayFrustum.right / nearestDist);
    const angleTop = Math.atan(displayFrustum.top / nearestDist);
    const angleBottom = Math.atan(displayFrustum.bottom / nearestDist);

    const customFrustum = {
      left: nearPlane * Math.tan(angleLeft),
      right: nearPlane * Math.tan(angleRight),
      top: nearPlane * Math.tan(angleTop),
      bottom: nearPlane * Math.tan(angleBottom)
    };

    html += `
    <section class="projection-summary">
      <header class="projection-header">Offcenter Projection at Custom Near Plane</header>
      <table class="projection-table">
        <tbody>
          <tr><th scope="row">Near Plane</th><td>${formatMeters(nearPlane)}</td></tr>
          <tr><th scope="row">Left</th><td>${formatMeters(customFrustum.left)}</td></tr>
          <tr><th scope="row">Right</th><td>${formatMeters(customFrustum.right)}</td></tr>
          <tr><th scope="row">Top</th><td>${formatMeters(customFrustum.top)}</td></tr>
          <tr><th scope="row">Bottom</th><td>${formatMeters(customFrustum.bottom)}</td></tr>
        </tbody>
      </table>
    </section>`;
  }

  html += `
    <section class="corner-angles-summary">
      <header class="corner-angles-header">Corner Angles</header>
      <div class="corner-angles-grid">
        <div class="corner-angle-card">
          <div class="corner-angle-label">Top-Left</div>
          <div class="corner-angle-values">
            <span>H: ${anglesToCorners[0].horizontal.toFixed(2)}°</span>
            <span>V: ${anglesToCorners[0].vertical.toFixed(2)}°</span>
          </div>
        </div>
        <div class="corner-angle-card">
          <div class="corner-angle-label">Top-Right</div>
          <div class="corner-angle-values">
            <span>H: ${anglesToCorners[1].horizontal.toFixed(2)}°</span>
            <span>V: ${anglesToCorners[1].vertical.toFixed(2)}°</span>
          </div>
        </div>
        <div class="corner-angle-card">
          <div class="corner-angle-label">Bottom-Left</div>
          <div class="corner-angle-values">
            <span>H: ${anglesToCorners[2].horizontal.toFixed(2)}°</span>
            <span>V: ${anglesToCorners[2].vertical.toFixed(2)}°</span>
          </div>
        </div>
        <div class="corner-angle-card">
          <div class="corner-angle-label">Bottom-Right</div>
          <div class="corner-angle-values">
            <span>H: ${anglesToCorners[3].horizontal.toFixed(2)}°</span>
            <span>V: ${anglesToCorners[3].vertical.toFixed(2)}°</span>
          </div>
        </div>
      </div>
    </section>
  `;

  return html;
}

// Calculate signed offsets from the nearest point to each display edge (left, right, top, bottom)
// Dispatches to stable or precise calculation based on flag
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

  const shared = { left, right, top, bottom, localX, localY, centerOnLocalX, centerOnLocalY };

  if (useStableCalculation) {
    return calculateEdgeDistancesStable(display, shared);
  }
  return calculateEdgeDistancesPrecise(corners, shared);
}

// Stable edge calculation — uses display center + local axes, minimizes changes when moving rotated displays
function calculateEdgeDistancesStable(display, { left, right, top, bottom, localX, localY, centerOnLocalX, centerOnLocalY }) {
  const halfWidth = display.width / 2;
  const halfHeight = display.height / 2;
  const displayCenter = { x: display.x, y: display.y, z: display.z };

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
    magnitudes: {
      left: Math.abs(left),
      right: Math.abs(right),
      top: Math.abs(top),
      bottom: Math.abs(bottom)
    }
  };
}

// Precise edge calculation — projects eye onto each edge segment for exact nearest distances
function calculateEdgeDistancesPrecise(corners, { left, right, top, bottom, localX, localY, centerOnLocalX, centerOnLocalY }) {
  function edgeCalc(startCorner, edgeVector) {
    const len = Math.sqrt(edgeVector.x ** 2 + edgeVector.y ** 2 + edgeVector.z ** 2);
    const norm = { x: edgeVector.x / len, y: edgeVector.y / len, z: edgeVector.z / len };
    const proj = -(startCorner.x * norm.x + startCorner.y * norm.y + startCorner.z * norm.z);
    const t = Math.max(0, Math.min(len, proj));
    const nearest = {
      x: startCorner.x + norm.x * t,
      y: startCorner.y + norm.y * t,
      z: startCorner.z + norm.z * t
    };
    const dist = Math.sqrt(nearest.x ** 2 + nearest.y ** 2 + nearest.z ** 2);
    return { nearest, dist };
  }

  const leftEdge = edgeCalc(corners[0], { x: corners[2].x - corners[0].x, y: corners[2].y - corners[0].y, z: corners[2].z - corners[0].z });
  const topEdge = edgeCalc(corners[0], { x: corners[1].x - corners[0].x, y: corners[1].y - corners[0].y, z: corners[1].z - corners[0].z });
  const rightEdge = edgeCalc(corners[1], { x: corners[3].x - corners[1].x, y: corners[3].y - corners[1].y, z: corners[3].z - corners[1].z });
  const bottomEdge = edgeCalc(corners[2], { x: corners[3].x - corners[2].x, y: corners[3].y - corners[2].y, z: corners[3].z - corners[2].z });

  return {
    left,
    right,
    top,
    bottom,
    nearestPoints: {
      left: leftEdge.nearest,
      top: topEdge.nearest,
      right: rightEdge.nearest,
      bottom: bottomEdge.nearest
    },
    localAxes: { x: localX, y: localY },
    projections: { centerOnLocalX, centerOnLocalY },
    magnitudes: {
      left: leftEdge.dist,
      right: rightEdge.dist,
      top: topEdge.dist,
      bottom: bottomEdge.dist
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
  const { leftM, rightM, topM, bottomM } = result.projection;
  
  // leftM/rightM/topM/bottomM are projections at z=1 (i.e. tan(angle))
  // Multiply by nearDistance to get frustum extents at the desired near plane
  return {
    nearDistance,
    left: leftM * nearDistance,
    right: rightM * nearDistance,
    top: topM * nearDistance,
    bottom: bottomM * nearDistance
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