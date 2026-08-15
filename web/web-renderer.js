// Web renderer for Node View Calibrator
// Thin wrapper around renderer-core for the web environment

import { initApp } from '../src/renderer-core.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
