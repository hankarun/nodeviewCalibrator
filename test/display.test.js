import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDisplayFromInputs,
  calculateEdgeDistancesFromNearestPoint,
  formatDisplayCalculations,
  getNearPlaneFrustum,
  getFovGeometry,
  getBorderWidthMeters,
  isBorderExcludedFromFov,
  displayPresets
} from '../src/display.js';
import { calculateProjectionCorners } from '../src/mathutils.js';

const EPS = 1e-9;
const close = (actual, expected, msg) => assert.ok(
  Math.abs(actual - expected) < EPS,
  `${msg}: expected ${expected}, got ${actual}`
);

const centeredDisplay = { width: 1.44, height: 0.81, distance: 1.16, yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: 1.16, borderWidthCm: 0 };
const borderedDisplay = { ...centeredDisplay, borderWidthCm: 2 };

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
  assert.equal(display.excludeBordersFromFov, true, 'excludeBordersFromFov defaults to on');
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

test('createDisplayFromInputs: keeps a blank border at the default and honors the FOV opt-out', () => {
  const blank = createDisplayFromInputs({
    width: '1', height: '1', yaw: '0', pitch: '0', roll: '0', x: '0', y: '0', z: '1',
    borderWidthCm: ''
  });
  close(blank.borderWidthCm, 2, 'blank border falls back to the default');

  const optedOut = createDisplayFromInputs({
    width: '1', height: '1', yaw: '0', pitch: '0', roll: '0', x: '0', y: '0', z: '1',
    borderWidthCm: '1.5', excludeBordersFromFov: false
  });
  close(optedOut.borderWidthCm, 1.5, 'borderWidthCm');
  assert.equal(optedOut.excludeBordersFromFov, false, 'opt-out is kept');
});

test('getBorderWidthMeters: converts centimetres, defaulting when unusable', () => {
  close(getBorderWidthMeters({ borderWidthCm: 2 }), 0.02, 'explicit 2cm');
  close(getBorderWidthMeters({}), 0.02, 'missing border uses the 2cm default');
  close(getBorderWidthMeters({ borderWidthCm: 0 }), 0, 'zero border');
  close(getBorderWidthMeters({ borderWidthCm: 'abc' }), 0, 'unparseable border is no border');
});

test('isBorderExcludedFromFov: on unless the display opts out', () => {
  assert.equal(isBorderExcludedFromFov({}), true, 'default for older configurations');
  assert.equal(isBorderExcludedFromFov({ excludeBordersFromFov: true }), true);
  assert.equal(isBorderExcludedFromFov({ excludeBordersFromFov: false }), false);
});

test('getFovGeometry: takes the bezel off every side', () => {
  const fov = getFovGeometry(borderedDisplay);
  close(fov.width, 1.44 - 0.04, 'width loses two 2cm bezels');
  close(fov.height, 0.81 - 0.04, 'height loses two 2cm bezels');
  close(fov.x, borderedDisplay.x, 'position is untouched');
  close(fov.z, borderedDisplay.z, 'position is untouched');
});

test('getFovGeometry: is idempotent, so it can be applied down a chain', () => {
  const once = getFovGeometry(borderedDisplay);
  const twice = getFovGeometry(once);
  close(twice.width, once.width, 'width is only shrunk once');
  close(twice.height, once.height, 'height is only shrunk once');
});

test('getFovGeometry: returns the panel itself when there is nothing to take off', () => {
  assert.equal(getFovGeometry(centeredDisplay), centeredDisplay, 'no bezel');
  const optedOut = { ...borderedDisplay, excludeBordersFromFov: false };
  assert.equal(getFovGeometry(optedOut), optedOut, 'opted out of the exclusion');
  const swallowed = { ...borderedDisplay, width: 0.03, height: 0.03 };
  assert.equal(getFovGeometry(swallowed), swallowed, 'bezel larger than the panel');
});

test('calculateEdgeDistancesFromNearestPoint: edges are the active area, not the panel outline', () => {
  const stable = calculateEdgeDistancesFromNearestPoint(borderedDisplay, true);
  close(stable.left, -(1.44 - 0.04) / 2, 'left');
  close(stable.right, (1.44 - 0.04) / 2, 'right');
  close(stable.top, (0.81 - 0.04) / 2, 'top');
  close(stable.bottom, -(0.81 - 0.04) / 2, 'bottom');

  const included = calculateEdgeDistancesFromNearestPoint(
    { ...borderedDisplay, excludeBordersFromFov: false }, true
  );
  close(included.right, 0.72, 'opting out measures the full panel again');
});

test('calculateEdgeDistancesFromNearestPoint: precise mode excludes borders as well', () => {
  const precise = calculateEdgeDistancesFromNearestPoint(borderedDisplay, false);
  close(precise.magnitudes.right, (1.44 - 0.04) / 2, 'right magnitude follows the active area');
});

test('getNearPlaneFrustum: frustum is built from the active area', () => {
  const bordered = getNearPlaneFrustum(borderedDisplay, 0.1);
  const full = getNearPlaneFrustum(centeredDisplay, 0.1);
  assert.ok(Math.abs(bordered.right) < Math.abs(full.right), 'a bezel narrows the frustum');
  close(bordered.right, full.right * ((1.44 - 0.04) / 1.44), 'narrowed in proportion to the active width');
  close(bordered.top, full.top * ((0.81 - 0.04) / 0.81), 'narrowed in proportion to the active height');
});

test('formatDisplayCalculations: reports the active area when borders are excluded', () => {
  const result = calculateProjectionCorners(getFovGeometry(borderedDisplay));
  const html = formatDisplayCalculations(result, borderedDisplay);
  assert.match(html, /Active Area/);
  assert.match(html, /1\.400 × 0\.770m \(borders excluded\)/);
});

test('formatDisplayCalculations: names the whole panel when borders are included', () => {
  const html = formatDisplayCalculations(
    calculateProjectionCorners(centeredDisplay), centeredDisplay
  );
  assert.match(html, /1\.440 × 0\.810m \(full panel\)/);
});

test('formatDisplayCalculations: row count does not depend on the border setting', () => {
  const rows = html => (html.match(/<tr>/g) || []).length;
  const excluded = formatDisplayCalculations(
    calculateProjectionCorners(getFovGeometry(borderedDisplay)), borderedDisplay
  );
  const included = formatDisplayCalculations(
    calculateProjectionCorners(borderedDisplay),
    { ...borderedDisplay, excludeBordersFromFov: false }
  );
  assert.equal(rows(excluded), rows(included), 'the summary keeps its height either way');
});
