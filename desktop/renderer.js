// Desktop renderer for Node View Calibrator
// Thin wrapper around renderer-core with desktop-specific features enabled

import { initApp } from '../src/renderer-core.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
