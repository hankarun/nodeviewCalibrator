/**
 * Math utility functions for 3D display calibration
 */

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
  const { width, height, distance, yaw, pitch, roll, x, y, z } = display;
  
  // Convert angles to radians
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rollRad = roll * Math.PI / 180;
  
  // First, calculate the nearest point on the plane
  const nearestPoint = calculateNearestPointOnPlane(display);
  
  // Calculate corners in display space
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  
  // Top-left, top-right, bottom-right, bottom-left (in display local space)
  const corners = [
    { x: -halfWidth, y: halfHeight, z: 0 },
    { x: halfWidth, y: halfHeight, z: 0 },
    { x: -halfWidth, y: -halfHeight, z: 0 },
    { x: halfWidth, y: -halfHeight, z: 0 }
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
  
  // Apply translation (position)
  const finalCorners = rotatedCorners.map(corner => {
    return {
      x: corner.x + x,
      y: corner.y + y,
      z: corner.z + z
    };
  });
  
  // Calculate display center position after rotation and translation
  const displayCenter = { x, y, z };
  
  // Calculate distance from eye to display center
  const eyeToDisplayDistance = Math.sqrt(
    displayCenter.x * displayCenter.x + 
    displayCenter.y * displayCenter.y + 
    displayCenter.z * displayCenter.z
  );
  
  // Calculate vectors from nearest point to each corner
  const cornersRelativeToNearest = finalCorners.map(corner => {
    return {
      x: corner.x - nearestPoint.x,
      y: corner.y - nearestPoint.y,
      z: corner.z - nearestPoint.z
    };
  });
  
  // Calculate distances from eye to each corner
  const cornerDistances = finalCorners.map(corner => {
    return Math.sqrt(
      corner.x * corner.x + 
      corner.y * corner.y + 
      corner.z * corner.z
    );
  });
  
  // Calculate vectors from eye to each corner
  const eyeToCornerVectors = finalCorners.map(corner => {
    return {
      x: corner.x,
      y: corner.y,
      z: corner.z
    };
  });
  
  // Calculate angles from eye to each corner
  const anglesToCorners = eyeToCornerVectors.map(vector => {
    const distance = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    return {
      horizontal: Math.atan2(vector.x, vector.z) * 180 / Math.PI,
      vertical: Math.atan2(vector.y, vector.z) * 180 / Math.PI,
      distance
    };
  });
  
  // Find the extents of these angles for the offcenter projection
  const left = Math.min(anglesToCorners[0].horizontal, anglesToCorners[2].horizontal);
  const right = Math.max(anglesToCorners[1].horizontal, anglesToCorners[3].horizontal);
  const bottom = Math.min(anglesToCorners[2].vertical, anglesToCorners[3].vertical);
  const top = Math.max(anglesToCorners[0].vertical, anglesToCorners[1].vertical);
  
  // Calculate offcenter projection parameters with respect to the nearest point
  // Project corner vectors to a plane at distance 1 from the eye
  const normalizedCorners = eyeToCornerVectors.map(vector => {
    // Only normalize if z is not 0 to avoid division by zero
    if (Math.abs(vector.z) > 0.0001) {
      return {
        x: vector.x / vector.z,
        y: vector.y / vector.z,
        z: 1
      };
    } else {
      // If z is close to 0, use a large value to represent "infinity"
      return {
        x: vector.x > 0 ? 1000 : -1000,
        y: vector.y > 0 ? 1000 : -1000,
        z: 1
      };
    }
  });
  
  // Find the extents in the normalized space (these are the actual meters at z=1)
  const leftM = Math.min(normalizedCorners[0].x, normalizedCorners[2].x);
  const rightM = Math.max(normalizedCorners[1].x, normalizedCorners[3].x);
  const bottomM = Math.min(normalizedCorners[2].y, normalizedCorners[3].y);
  const topM = Math.max(normalizedCorners[0].y, normalizedCorners[1].y);
  
  // Calculate the distance from eye to nearest point
  const eyeToNearestDistance = nearestPoint.distance;
  
  // Calculate the projection of each corner onto the normal vector
  const cornerProjectedDistances = finalCorners.map(corner => {
    return corner.x * nearestPoint.normal.x + 
           corner.y * nearestPoint.normal.y + 
           corner.z * nearestPoint.normal.z;
  });
  
  // Calculate offcenter projection based on the nearest point
  const offcenterProjection = {
    // Position of the nearest point (eye's perpendicular projection onto the plane)
    nearestPoint: nearestPoint,
    
    // Corners positions relative to the nearest point
    cornersRelativeToNearest: cornersRelativeToNearest,
    
    // Distance from eye to nearest point
    eyeToNearestDistance: eyeToNearestDistance,
    
    // Eye to display center distance (for reference)
    eyeToDisplayDistance: eyeToDisplayDistance,
    
    // Field of view angles (from eye's perspective)
    fovHorizontal: right - left,
    fovVertical: top - bottom,
    
    // Asymmetry ratios (for offcenter projection)
    // These values show how much the projection is offset from center
    horizontalAsymmetry: (right + left) / (right - left),
    verticalAsymmetry: (top + bottom) / (top - bottom)
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

// Export the functions
export {
  calculateNearestPointOnPlane,
  calculateProjectionCorners
};
