/**
 * Test cases for display projection calculations
 * This file contains test cases to verify the accuracy of projection corner calculations
 */

import { calculateProjectionCorners } from './mathutils.js';

// Function to run test cases and display results
function runProjectionTests() {
  console.log("Running projection tests...");
  
  // Test case: One center display and one angled display with touching corners
  // Center display at 1.16 meters away
  // Right display at 47 degree angle where corners touch
  const testCenterDisplay = {
    width: 1.44, // 65" display width in meters
    height: 0.81, // 65" display height in meters
    distance: 1.16, // Distance from eye in meters
    yaw: 0,
    pitch: 0,
    roll: 0,
    x: 0,
    y: 0,
    z: 1.16
  };
  
  // Calculate the position of the right display
  // With 47 degree yaw, the display should be positioned so its left edge 
  // touches the right edge of the center display
  
  // First get the corners of center display
  const centerResult = calculateProjectionCorners(testCenterDisplay);
  const centerCorners = centerResult.corners;
  
  // Center display corners
  console.log("Center Display Corners:");
  console.log("Top-Left:", centerCorners[0]);
  console.log("Top-Right:", centerCorners[1]);
  console.log("Bottom-Left:", centerCorners[2]);
  console.log("Bottom-Right:", centerCorners[3]);
  
  // Calculate right display position
  const rightDisplayYaw = 47; // 47 degrees
  const rightDisplayWidth = 1.44; // Same size as center display
  const rightDisplayHeight = 0.81;
    // Calculate the position of the right display so that its left edge touches 
  // the right edge of the center display
  
  // The center display's right edge midpoint is at:
  const centerRightEdgeMidpoint = {
    x: (centerCorners[1].x + centerCorners[3].x) / 2,
    y: (centerCorners[1].y + centerCorners[3].y) / 2,
    z: (centerCorners[1].z + centerCorners[3].z) / 2
  };
  
  // For correct projection, we should position the second display so that
  // its left corners precisely touch the right corners of the first display
  
  // Calculate the position of the angled display
  // For a 47 degree yaw, the display normal vector components are:
  const yawRad = rightDisplayYaw * Math.PI / 180;
  
  // Calculate the rotation matrix for yaw
  // For a rotation around the Y axis (yaw):
  // [ cos(yaw)  0  sin(yaw) ]
  // [    0      1     0     ]
  // [-sin(yaw)  0  cos(yaw) ]
  
  // Get the rotated display corners in local space
  const rightDisplayLocalCorners = [
    { x: -rightDisplayWidth / 2, y: rightDisplayHeight / 2, z: 0 },  // Top-Left
    { x: rightDisplayWidth / 2, y: rightDisplayHeight / 2, z: 0 },   // Top-Right
    { x: -rightDisplayWidth / 2, y: -rightDisplayHeight / 2, z: 0 }, // Bottom-Left
    { x: rightDisplayWidth / 2, y: -rightDisplayHeight / 2, z: 0 }   // Bottom-Right
  ];
  
  // Apply yaw rotation to the local corners
  const rightDisplayRotatedCorners = rightDisplayLocalCorners.map(corner => {
    return {
      x: corner.x * Math.cos(yawRad) - corner.z * Math.sin(yawRad),
      y: corner.y,
      z: corner.x * Math.sin(yawRad) + corner.z * Math.cos(yawRad)
    };
  });
  
  // Find the local left edge midpoint after rotation
  const localLeftEdgeMidpoint = {
    x: (rightDisplayRotatedCorners[0].x + rightDisplayRotatedCorners[2].x) / 2,
    y: (rightDisplayRotatedCorners[0].y + rightDisplayRotatedCorners[2].y) / 2,
    z: (rightDisplayRotatedCorners[0].z + rightDisplayRotatedCorners[2].z) / 2
  };
  
  // Calculate the translation needed to place the right display's left edge at the center display's right edge
  const rightDisplayX = centerRightEdgeMidpoint.x - localLeftEdgeMidpoint.x;
  const rightDisplayY = centerRightEdgeMidpoint.y - localLeftEdgeMidpoint.y;
  const rightDisplayZ = centerRightEdgeMidpoint.z - localLeftEdgeMidpoint.z;
  
  const testRightDisplay = {
    width: rightDisplayWidth,
    height: rightDisplayHeight,
    distance: 1.16, // Not actually used in calculations but kept for consistency
    yaw: rightDisplayYaw,
    pitch: 0,
    roll: 0,
    x: rightDisplayX,
    y: rightDisplayY,
    z: rightDisplayZ
  };
  
  // Calculate projection for the right display
  const rightResult = calculateProjectionCorners(testRightDisplay);
  const rightCorners = rightResult.corners;
  
  // Right display corners
  console.log("\nRight Display Corners:");
  console.log("Top-Left:", rightCorners[0]);
  console.log("Top-Right:", rightCorners[1]);
  console.log("Bottom-Left:", rightCorners[2]);
  console.log("Bottom-Right:", rightCorners[3]);
    // Verify the edges touch
  console.log("\nVerifying corners touch:");
  
  // Calculate distance between right edge of center display and left edge of right display
  // For top corners
  const topCornersDistance = Math.sqrt(
    Math.pow(centerCorners[1].x - rightCorners[0].x, 2) +
    Math.pow(centerCorners[1].y - rightCorners[0].y, 2) +
    Math.pow(centerCorners[1].z - rightCorners[0].z, 2)
  );
  
  // For bottom corners
  const bottomCornersDistance = Math.sqrt(
    Math.pow(centerCorners[3].x - rightCorners[2].x, 2) +
    Math.pow(centerCorners[3].y - rightCorners[2].y, 2) +
    Math.pow(centerCorners[3].z - rightCorners[2].z, 2)
  );
  
  console.log("Distance between top corners:", topCornersDistance.toFixed(6), "meters");
  console.log("Distance between bottom corners:", bottomCornersDistance.toFixed(6), "meters");
  
  // Ideally these should be very close to zero if the corners touch
  // A very small tolerance can be allowed for floating point precision
  if (topCornersDistance < 0.01 && bottomCornersDistance < 0.01) {
    console.log("TEST PASSED: Corners are touching (within tolerance)");
  } else {
    console.log("TEST FAILED: Corners are not touching");
    
    // Adjust the right display position and try again
    console.log("\nAttempting to adjust right display position...");
    
    // Let's try a different approach - force the corners to touch directly
    const adjustedRightDisplay = {
      ...testRightDisplay
    };
    
    // Move the display so that its left edge aligns with center display's right edge
    const offset = {
      x: centerCorners[1].x - rightCorners[0].x,
      y: 0, // Keep same height
      z: centerCorners[1].z - rightCorners[0].z
    };
    
    adjustedRightDisplay.x += offset.x;
    adjustedRightDisplay.z += offset.z;
    
    console.log("Adjusted position:", {
      x: adjustedRightDisplay.x.toFixed(6),
      y: adjustedRightDisplay.y.toFixed(6),
      z: adjustedRightDisplay.z.toFixed(6)
    });
    
    // Recalculate with adjusted position
    const adjustedRightResult = calculateProjectionCorners(adjustedRightDisplay);
    const adjustedRightCorners = adjustedRightResult.corners;
    
    // Recalculate distances
    const adjustedTopCornersDistance = Math.sqrt(
      Math.pow(centerCorners[1].x - adjustedRightCorners[0].x, 2) +
      Math.pow(centerCorners[1].y - adjustedRightCorners[0].y, 2) +
      Math.pow(centerCorners[1].z - adjustedRightCorners[0].z, 2)
    );
    
    const adjustedBottomCornersDistance = Math.sqrt(
      Math.pow(centerCorners[3].x - adjustedRightCorners[2].x, 2) +
      Math.pow(centerCorners[3].y - adjustedRightCorners[2].y, 2) +
      Math.pow(centerCorners[3].z - adjustedRightCorners[2].z, 2)
    );
    
    console.log("Adjusted distance between top corners:", adjustedTopCornersDistance.toFixed(6), "meters");
    console.log("Adjusted distance between bottom corners:", adjustedBottomCornersDistance.toFixed(6), "meters");
    
    // Print the adjusted display parameters
    console.log("\nAdjusted right display parameters:");
    console.log("x:", adjustedRightDisplay.x.toFixed(6));
    console.log("y:", adjustedRightDisplay.y.toFixed(6));
    console.log("z:", adjustedRightDisplay.z.toFixed(6));
    console.log("yaw:", adjustedRightDisplay.yaw);
    console.log("pitch:", adjustedRightDisplay.pitch);
    console.log("roll:", adjustedRightDisplay.roll);
  }
  
  // Calculate nearest point information and edge distances
  console.log("\nNearest Point Information:");
  console.log("Center Display:");
  console.log("Nearest Point:", centerResult.offcenterProjection.nearestPoint);
  
  console.log("\nRight Display:");
  console.log("Nearest Point:", rightResult.offcenterProjection.nearestPoint);
  
  return {
    centerDisplay: testCenterDisplay,
    rightDisplay: testRightDisplay,
    centerResult: centerResult,
    rightResult: rightResult
  };
}

// Export the test function
export { runProjectionTests };
