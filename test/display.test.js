import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDisplayFromInputs,
  calculateEdgeDistancesFromNearestPoint,
  formatDisplayCalculations,
  getNearPlaneFrustum,
  displayPresets
} from '../src/display.js';
import { calculateProjectionCorners } from '../src/mathutils.js';

const EPS = 1e-9;
const close = (actual, expected, msg) => assert.ok(
  Math.abs(actual - expected) < EPS,
  `${msg}: expected ${expected}, got ${actual}`
);

const centeredDisplay = { width: 1.44, height: 0.81, distance: 1.16, yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: 1.16 };

test('createDisplayFromInputs: parses numeric fields and applies defaults', () => {
  const display = createDisplayFromInputs({
    name: 'Main', width: '1.44', height: '0.81', distance: '1.16',
    yaw: '0', pitch: '0', roll: '0', x: '0', y: '0', z: '1.16'
  });
  close(display.width, 1.44, 'width');
  close(display.height, 0.81, 'height');
  assert.equal(display.name, 'Main');
  assert.equal(display.showBorders, true, 'showBorders defaults to true');
  close(display.borderWidthCm, 2, 'borderWidthCm defaults to 2');
  assert.equal(display.borderColor, 'black');
  assert.equal(display.showNearPlane, false, 'showNearPlane defaults to false');
  assert.equal('nearPlane' in display, false, 'nearPlane omitted when blank');
});

test('createDisplayFromInputs: honors an explicit nearPlane override', () => {
  const display = createDisplayFromInputs({
    width: '1', height: '1', distance: '1', yaw: '0', pitch: '0', roll: '0',
    x: '0', y: '0', z: '1', nearPlane: '0.25'
  });
  close(display.nearPlane, 0.25, 'nearPlane');
});

test('displayPresets: every preset is a positive, landscape 16:9-ish rectangle', () => {
  for (const [label, { width, height }] of Object.entries(displayPresets)) {
    assert.ok(width > 0 && height > 0, `${label}" has positive dimensions`);
    assert.ok(width > height, `${label}" is landscape`);
    const aspect = width / height;
    assert.ok(Math.abs(aspect - 16 / 9) < 0.01, `${label}" is close to 16:9, got ${aspect}`);
  }
});

test('calculateEdgeDistancesFromNearestPoint: centered unrotated display has exact half-extent edges', () => {
  const stable = calculateEdgeDistancesFromNearestPoint(centeredDisplay, true);
  close(stable.left, -0.72, 'left');
  close(stable.right, 0.72, 'right');
  close(stable.top, 0.405, 'top');
  close(stable.bottom, -0.405, 'bottom');
});

test('calculateEdgeDistancesFromNearestPoint: stable and precise modes agree for an unrotated display', () => {
  const stable = calculateEdgeDistancesFromNearestPoint(centeredDisplay, true);
  const precise = calculateEdgeDistancesFromNearestPoint(centeredDisplay, false);
  close(stable.magnitudes.left, precise.magnitudes.left, 'left magnitude');
  close(stable.magnitudes.right, precise.magnitudes.right, 'right magnitude');
  close(stable.magnitudes.top, precise.magnitudes.top, 'top magnitude');
  close(stable.magnitudes.bottom, precise.magnitudes.bottom, 'bottom magnitude');
});

test('getNearPlaneFrustum: frustum extents scale linearly with near distance', () => {
  const near = getNearPlaneFrustum(centeredDisplay, 0.1);
  const far = getNearPlaneFrustum(centeredDisplay, 0.2);
  close(far.top, near.top * 2, 'top scales');
  close(far.left, near.left * 2, 'left scales');
  close(far.right, near.right * 2, 'right scales');
  close(far.bottom, near.bottom * 2, 'bottom scales');
});

test('formatDisplayCalculations: renders the near plane and corner angles', () => {
  const result = calculateProjectionCorners(centeredDisplay);
  const html = formatDisplayCalculations(result, centeredDisplay);
  assert.match(html, /Offcenter Projection \(Stable\)/);
  assert.match(html, /Near Plane/);
  assert.match(html, /1\.160m/);
  assert.match(html, /Top-Left/);
});
