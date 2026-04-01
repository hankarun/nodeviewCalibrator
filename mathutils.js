/**
 * Math utility functions for 3D display calibration
 */

/**
 * Apply roll → pitch → yaw rotation to a vector.
 * @param {{x:number, y:number, z:number}} v - Input vector
 * @param {number} yawRad - Yaw in radians (around Y)
 * @param {number} pitchRad - Pitch in radians (around X)
 * @param {number} rollRad - Roll in radians (around Z)
 * @returns {{x:number, y:number, z:number}}
 */
export function rotateVector(v, yawRad, pitchRad, rollRad) {
  // Roll (around Z)
  const x1 = v.x * Math.cos(rollRad) - v.y * Math.sin(rollRad);
  const y1 = v.x * Math.sin(rollRad) + v.y * Math.cos(rollRad);
  const z1 = v.z;
  // Pitch (around X)
  const y2 = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
  const z2 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);
  const x2 = x1;
  // Yaw (around Y)
  const x3 = x2 * Math.cos(yawRad) - z2 * Math.sin(yawRad);
  const z3 = x2 * Math.sin(yawRad) + z2 * Math.cos(yawRad);
  const y3 = y2;
  return { x: x3, y: y3, z: z3 };
}

/**
 * Apply the inverse of roll → pitch → yaw rotation to a vector.
 * This is the exact inverse: (-yaw) → (-pitch) → (-roll), applied in that order.
 * @param {{x:number, y:number, z:number}} v - Input vector
 * @param {number} yawRad - Yaw in radians (around Y)
 * @param {number} pitchRad - Pitch in radians (around X)
 * @param {number} rollRad - Roll in radians (around Z)
 * @returns {{x:number, y:number, z:number}}
 */
export function inverseRotateVector(v, yawRad, pitchRad, rollRad) {
  // Inverse Yaw (around Y, by -yaw)
  const x1 = v.x * Math.cos(yawRad) + v.z * Math.sin(yawRad);
  const z1 = -v.x * Math.sin(yawRad) + v.z * Math.cos(yawRad);
  const y1 = v.y;
  // Inverse Pitch (around X, by -pitch)
  const y2 = y1 * Math.cos(pitchRad) + z1 * Math.sin(pitchRad);
  const z2 = -y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);
  const x2 = x1;
  // Inverse Roll (around Z, by -roll)
  const x3 = x2 * Math.cos(rollRad) + y2 * Math.sin(rollRad);
  const y3 = -x2 * Math.sin(rollRad) + y2 * Math.cos(rollRad);
  const z3 = z2;
  return { x: x3, y: y3, z: z3 };
}

// Function to calculate nearest point on display plane from eye position (0,0,0)
function calculateNearestPointOnPlane(display) {
  const { x, y, z, yaw, pitch, roll } = display;
  
  // Convert angles to radians
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rollRad = roll * Math.PI / 180;
  
  // Calculate normal vector of the display plane (starts pointing along -Z)
  let normal = { x: 0, y: 0, z: -1 };
  
  // Apply rotations in the correct order: roll, pitch, then yaw
  // 1. Apply roll (around Z)
  // Note: Roll doesn't affect the normal of a plane initially facing in Z direction
  
  // 2. Apply pitch (around X)
  let ny1 = normal.y * Math.cos(pitchRad) - normal.z * Math.sin(pitchRad);
  let nz1 = normal.y * Math.sin(pitchRad) + normal.z * Math.cos(pitchRad);
  normal.y = ny1;
  normal.z = nz1;
  
  // 3. Apply yaw (around Y)
  let nx2 = normal.x * Math.cos(yawRad) - normal.z * Math.sin(yawRad);
  let nz2 = normal.x * Math.sin(yawRad) + normal.z * Math.cos(yawRad);
  normal.x = nx2;
  normal.z = nz2;
  
  // Normalize the normal vector
  const magnitude = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
  normal.x /= magnitude;
  normal.y /= magnitude;
  normal.z /= magnitude;
  
  // Calculate the distance from eye to the display plane along the normal
  // This is the dot product of the display center position and the normal
  const d = x * normal.x + y * normal.y + z * normal.z;
  
  // Calculate the nearest point on the plane from the eye
  return {
    x: normal.x * d,
    y: normal.y * d,
    z: normal.z * d,
    distance: d,
    normal: normal // Include the normal in the result for debugging
  };
}

// Function to calculate offcenter projection parameters based on nearest point
function calculateProjectionCorners(display) {
  const { width, height, yaw, pitch, roll, x, y, z } = display;

  // Camera rotation defaults to display's orientation so the near plane is parallel to the display.
  // Users can override with explicit cameraYaw / cameraPitch / cameraRoll on the display object.
  const cameraYaw   = display.cameraYaw   !== undefined ? display.cameraYaw   : yaw;
  const cameraPitch = display.cameraPitch !== undefined ? display.cameraPitch : pitch;
  const cameraRoll  = display.cameraRoll  !== undefined ? display.cameraRoll  : roll;

  // Convert display angles to radians
  const yawRad   = yaw   * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rollRad  = roll  * Math.PI / 180;

  // Convert camera angles to radians
  const cameraYawRad   = cameraYaw   * Math.PI / 180;
  const cameraPitchRad = cameraPitch * Math.PI / 180;
  const cameraRollRad  = cameraRoll  * Math.PI / 180;

  // First, calculate the nearest point on the display plane from the eye (origin)
  const nearestPoint = calculateNearestPointOnPlane(display);

  // Calculate corners in display local space
  const halfWidth  = width  / 2;
  const halfHeight = height / 2;

  // Top-left, top-right, bottom-left, bottom-right (in display local space)
  const corners = [
    { x: -halfWidth,  y:  halfHeight, z: 0 },
    { x:  halfWidth,  y:  halfHeight, z: 0 },
    { x: -halfWidth,  y: -halfHeight, z: 0 },
    { x:  halfWidth,  y: -halfHeight, z: 0 }
  ];

  // Rotate corners to world space (roll → pitch → yaw)
  const rotatedCorners = corners.map(corner => rotateVector(corner, yawRad, pitchRad, rollRad));

  // Translate to world position
  const finalCorners = rotatedCorners.map(corner => ({
    x: corner.x + x,
    y: corner.y + y,
    z: corner.z + z
  }));

  // Distance from eye to display centre
  const eyeToDisplayDistance = Math.sqrt(x * x + y * y + z * z);

  // --- Transform corners to camera-local space ---
  // Applying the inverse of the camera rotation brings world-space corner positions
  // into the coordinate frame where the camera faces straight ahead (+Z).
  // In this frame, left/right/top/bottom are simply the x/y extents of the corners.
  const cameraLocalCorners = finalCorners.map(corner =>
    inverseRotateVector(corner, cameraYawRad, cameraPitchRad, cameraRollRad)
  );

  // Nearest point in camera-local space (used to compute relative corner offsets)
  const cameraLocalNearestPoint = inverseRotateVector(
    nearestPoint, cameraYawRad, cameraPitchRad, cameraRollRad
  );

  // Corners relative to the nearest point, expressed in camera-local space.
  // When the camera rotation equals the display rotation the display plane is
  // perpendicular to the camera's forward axis, so these vectors lie in the XY
  // plane (z ≈ 0) and their x/y components give the correct frustum offsets.
  const cornersRelativeToNearest = cameraLocalCorners.map(corner => ({
    x: corner.x - cameraLocalNearestPoint.x,
    y: corner.y - cameraLocalNearestPoint.y,
    z: corner.z - cameraLocalNearestPoint.z
  }));

  // Distances from eye to each corner (world space, unchanged)
  const cornerDistances = finalCorners.map(corner =>
    Math.sqrt(corner.x * corner.x + corner.y * corner.y + corner.z * corner.z)
  );

  // --- Angles to corners computed in camera-local space ---
  // atan2(x, z) gives the horizontal angle and atan2(y, z) the vertical angle
  // relative to the camera's forward axis, which is the correct reference for
  // the frustum regardless of how the display is rotated in world space.
  const anglesToCorners = cameraLocalCorners.map(localCorner => {
    const dist = Math.sqrt(
      localCorner.x * localCorner.x +
      localCorner.y * localCorner.y +
      localCorner.z * localCorner.z
    );
    return {
      horizontal: Math.atan2(localCorner.x, localCorner.z) * 180 / Math.PI,
      vertical:   Math.atan2(localCorner.y, localCorner.z) * 180 / Math.PI,
      distance: dist
    };
  });

  // Angle extents (left/right/top/bottom in degrees, camera-local)
  const left   = Math.min(anglesToCorners[0].horizontal, anglesToCorners[2].horizontal);
  const right  = Math.max(anglesToCorners[1].horizontal, anglesToCorners[3].horizontal);
  const bottom = Math.min(anglesToCorners[2].vertical,   anglesToCorners[3].vertical);
  const top    = Math.max(anglesToCorners[0].vertical,   anglesToCorners[1].vertical);

  // Normalized corners: perspective-projected to the z=1 plane in camera-local space.
  // These give the frustum extents in metres at unit depth.
  const normalizedCorners = cameraLocalCorners.map(localCorner => {
    if (Math.abs(localCorner.z) > 0.0001) {
      return {
        x: localCorner.x / localCorner.z,
        y: localCorner.y / localCorner.z,
        z: 1
      };
    }
    return {
      x: localCorner.x > 0 ? 1000 : -1000,
      y: localCorner.y > 0 ? 1000 : -1000,
      z: 1
    };
  });

  const leftM   = Math.min(normalizedCorners[0].x, normalizedCorners[2].x);
  const rightM  = Math.max(normalizedCorners[1].x, normalizedCorners[3].x);
  const bottomM = Math.min(normalizedCorners[2].y, normalizedCorners[3].y);
  const topM    = Math.max(normalizedCorners[0].y, normalizedCorners[1].y);

  const eyeToNearestDistance = nearestPoint.distance;

  // Projection of each corner onto the display plane normal (world space, for reference)
  const cornerProjectedDistances = finalCorners.map(corner =>
    corner.x * nearestPoint.normal.x +
    corner.y * nearestPoint.normal.y +
    corner.z * nearestPoint.normal.z
  );

  const offcenterProjection = {
    nearestPoint,
    cornersRelativeToNearest,
    eyeToNearestDistance,
    eyeToDisplayDistance,
    fovHorizontal: right - left,
    fovVertical:   top   - bottom,
    horizontalAsymmetry: (right + left) / (right - left),
    verticalAsymmetry:   (top  + bottom) / (top  - bottom)
  };

  return {
    corners: finalCorners,
    anglesToCorners,
    normalizedCorners,
    eyeToDisplayDistance,
    normalDistance: nearestPoint.distance,
    cornerDistances,
    cornerProjectedDistances,
    cornersRelativeToNearest,
    offcenterProjection,
    projection: {
      left, right, bottom, top,
      leftM, rightM, bottomM, topM
    }
  };
}

// Export the functions
export {
  calculateNearestPointOnPlane,
  calculateProjectionCorners
};
