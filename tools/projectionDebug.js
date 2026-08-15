/**
 * Fix for projection corner calculations 
 */

// First, let's investigate what might be wrong with the current calculations
function analyzeProjectionCorners(display) {
  // Extract display properties
  const { width, height, distance, yaw, pitch, roll, x, y, z } = display;
  
  // Convert angles to radians
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;
  const rollRad = roll * Math.PI / 180;
  
  // Calculate half-dimensions
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  
  // Define corners in display local space (before rotation)
  // Top-left, top-right, bottom-left, bottom-right
  const corners = [
    { x: -halfWidth, y: halfHeight, z: 0 },
    { x: halfWidth, y: halfHeight, z: 0 },
    { x: -halfWidth, y: -halfHeight, z: 0 },
    { x: halfWidth, y: -halfHeight, z: 0 }
  ];
  
  // Rotation matrices
  // For a rotation around Z axis (roll):
  // [ cos(roll) -sin(roll) 0 ]
  // [ sin(roll)  cos(roll) 0 ]
  // [    0          0      1 ]
  
  // For a rotation around X axis (pitch):
  // [ 1     0         0     ]
  // [ 0  cos(pitch) -sin(pitch) ]
  // [ 0  sin(pitch)  cos(pitch) ]
  
  // For a rotation around Y axis (yaw):
  // [ cos(yaw)  0  sin(yaw) ]
  // [    0      1     0     ]
  // [-sin(yaw)  0  cos(yaw) ]
  
  // Apply rotations in order: roll, pitch, yaw
  const rotatedCorners = corners.map(corner => {
    let x1, y1, z1, x2, y2, z2, x3, y3, z3;
    
    // Roll (around Z)
    x1 = corner.x * Math.cos(rollRad) - corner.y * Math.sin(rollRad);
    y1 = corner.x * Math.sin(rollRad) + corner.y * Math.cos(rollRad);
    z1 = corner.z;
    
    // Pitch (around X)
    x2 = x1;
    y2 = y1 * Math.cos(pitchRad) - z1 * Math.sin(pitchRad);
    z2 = y1 * Math.sin(pitchRad) + z1 * Math.cos(pitchRad);
    
    // Yaw (around Y)
    x3 = x2 * Math.cos(yawRad) - z2 * Math.sin(yawRad);
    y3 = y2;
    z3 = x2 * Math.sin(yawRad) + z2 * Math.cos(yawRad);
    
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
  
  return {
    original: corners,
    rotated: rotatedCorners,
    final: finalCorners
  };
}

// Export the function
export { analyzeProjectionCorners };
