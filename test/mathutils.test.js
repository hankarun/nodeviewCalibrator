import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotateVector, calculateNearestPointOnPlane, calculateProjectionCorners } from '../src/mathutils.js';

const EPS = 1e-9;
const close = (actual, expected, msg) => assert.ok(
  Math.abs(actual - expected) < EPS,
  `${msg}: expected ${expected}, got ${actual}`
);

test('rotateVector: zero angles is the identity', () => {
  const v = { x: 1.5, y: -2.25, z: 3.75 };
  const r = rotateVector(v, 0, 0, 0);
  close(r.x, v.x, 'x');
  close(r.y, v.y, 'y');
  close(r.z, v.z, 'z');
});

test('rotateVector: 90deg yaw maps -Z onto +X', () => {
  const r = rotateVector({ x: 0, y: 0, z: -1 }, Math.PI / 2, 0, 0);
  close(r.x, 1, 'x');
  close(r.y, 0, 'y');
  close(r.z, 0, 'z');
});

test('rotateVector: 90deg roll maps +X onto +Y', () => {
  const r = rotateVector({ x: 1, y: 0, z: 0 }, 0, 0, Math.PI / 2);
  close(r.x, 0, 'x');
  close(r.y, 1, 'y');
  close(r.z, 0, 'z');
});

test('rotateVector: preserves vector magnitude under rotation', () => {
  const vectors = [
    { x: 1, y: 0, z: 0 },
    { x: 0.72, y: 0.405, z: -1.16 },
    { x: -3, y: 4, z: 12 }
  ];
  const angles = [
    [0.3, -0.7, 1.1],
    [Math.PI, Math.PI / 3, -Math.PI / 5],
    [2.4, -1.9, 0.1]
  ];
  for (const v of vectors) {
    const before = Math.hypot(v.x, v.y, v.z);
    for (const [yaw, pitch, roll] of angles) {
      const r = rotateVector(v, yaw, pitch, roll);
      const after = Math.hypot(r.x, r.y, r.z);
      close(after, before, `magnitude for v=${JSON.stringify(v)} angles=${yaw},${pitch},${roll}`);
    }
  }
});

test('calculateNearestPointOnPlane: display directly ahead, unrotated', () => {
  const display = { x: 0, y: 0, z: 1.16, yaw: 0, pitch: 0, roll: 0 };
  const result = calculateNearestPointOnPlane(display);
  close(result.x, 0, 'x');
  close(result.y, 0, 'y');
  close(result.z, 1.16, 'z');
  close(result.distance, -1.16, 'distance');
});

test('calculateNearestPointOnPlane: normal is always unit length', () => {
  const cases = [
    { x: 0, y: 0, z: 1.16, yaw: 0, pitch: 0, roll: 0 },
    { x: 0.5, y: -0.2, z: 1.5, yaw: 47, pitch: 0, roll: 0 },
    { x: -1, y: 0.3, z: 2, yaw: 15, pitch: -30, roll: 90 }
  ];
  for (const display of cases) {
    const { normal } = calculateNearestPointOnPlane(display);
    const mag = Math.hypot(normal.x, normal.y, normal.z);
    close(mag, 1, `unit normal for ${JSON.stringify(display)}`);
  }
});

test('calculateProjectionCorners: centered, unrotated display is symmetric', () => {
  const display = { width: 1.44, height: 0.81, distance: 1.16, yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: 1.16 };
  const { offcenterProjection, corners } = calculateProjectionCorners(display);

  close(offcenterProjection.horizontalAsymmetry, 0, 'horizontal asymmetry');
  close(offcenterProjection.verticalAsymmetry, 0, 'vertical asymmetry');
  assert.ok(offcenterProjection.fovHorizontal > 0, 'fovHorizontal should be positive');
  assert.ok(offcenterProjection.fovVertical > 0, 'fovVertical should be positive');

  for (const corner of corners) {
    close(corner.z, display.z, 'corner z stays at display depth when unrotated');
  }
});

test('calculateProjectionCorners: corner ordering is top-left, top-right, bottom-left, bottom-right', () => {
  const display = { width: 1.44, height: 0.81, distance: 1.16, yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: 1.16 };
  const { corners } = calculateProjectionCorners(display);
  const [topLeft, topRight, bottomLeft, bottomRight] = corners;

  assert.ok(topLeft.x < topRight.x, 'top-left is left of top-right');
  assert.ok(bottomLeft.x < bottomRight.x, 'bottom-left is left of bottom-right');
  assert.ok(topLeft.y > bottomLeft.y, 'top-left is above bottom-left');
  assert.ok(topRight.y > bottomRight.y, 'top-right is above bottom-right');
});
