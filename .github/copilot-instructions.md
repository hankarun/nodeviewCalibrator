# Node View Calibrator — Project Guidelines

## Overview

A 3D display calibration tool for computing off-axis (asymmetric) frustum projection matrices for multi-display setups (e.g., CAVE systems). Eye is always fixed at world origin `(0, 0, 0)`.

## Build & Run

```powershell
npm install            # Install dependencies
npm start              # Run as Electron desktop app
npm run start-web      # Run as web app at http://localhost:3000
npm run pack           # Package without installer (electron-builder --dir)
npm run build          # Full Electron package
npm run dist           # Windows installer
```

No automated test runner — `tools/projectionTest.js` and `tools/projectionDebug.js` are manual validation scripts.

## Project Layout

- `src/` — shared browser core (ES modules), used by **both** the desktop and web front-ends
- `desktop/` — Electron-specific: `main.js`, `preload.js`, `index.html`, `renderer.js`
- `web/` — web-specific: `server.js`, `index.html`, `web-renderer.js`, `web-styles.css`
- `samples/` — example config JSON files
- `tools/` — manual, developer-run diagnostic scripts
- `scripts/` — `.bat` launchers and the standalone `launcher.html`

The Electron entry point is `desktop/main.js` (`main` field in `package.json`).
`desktop/index.html` has a strict CSP whose `sha256` covers the inline importmap
`<script>`; recompute the hash if you change that importmap.

## Architecture

| File | Role |
|------|------|
| `src/mathutils.js` | Pure 3D math — zero dependencies. Core frustum and rotation functions. |
| `src/display.js` | Display calculations: wraps mathutils, formats output, handles edge distances. |
| `src/renderer-core.js` | Application controller — shared between Electron and web, owns UI state and `displays[]` array. |
| `src/sceneRenderer.js` | Three.js 3D scene. Receives display objects; has no business logic. |
| `src/fileInterface.js` | Environment-agnostic file I/O — detects Electron via `window.electronAPI`. |
| `src/statusBar.js` | Status bar UI component. |
| `desktop/preload.js` | Electron security bridge (`contextIsolation: true`, `nodeIntegration: false`). |
| `desktop/main.js` | Electron main process — IPC handlers for file dialogs and `fs.promises`. |
| `desktop/renderer.js` | Electron renderer entry point. |
| `web/web-renderer.js` | Web entry point (delegates to `src/renderer-core.js`). |
| `web/server.js` | Express static server, port 3000 (serves `web/` and project root). |
| `tools/projectionTest.js` | Multi-display corner alignment validation. |
| `tools/projectionDebug.js` | Step-by-step rotation debug analysis. |

**Key rule**: Keep `src/mathutils.js` dependency-free. All pure math goes there. UI/formatting logic stays in `src/display.js` or `src/renderer-core.js`.

## Conventions

### Units
- Positions and dimensions: **meters** (e.g., `1.44` = 1.44 m)
- Angles in display objects: **degrees** — always convert to radians before passing to math functions
- The `distance` field in config JSON is **deprecated** — kept for backwards compatibility only

### Rotation Order
`rotateVector()` applies: **Roll → Pitch → Yaw** (in that sequence). This order is critical — do not change or reorder.

### Display Object Shape
```js
{
  name: string,         // optional
  width, height,        // meters
  x, y, z,             // world position (meters)
  yaw, pitch, roll,    // degrees
  showBorders,         // optional bool
  borderWidthCm,       // optional
  borderColor,         // optional CSS color
  nearPlane,           // optional override (meters)
  showNearPlane,       // optional bool
  // Runtime additions:
  nearestPoint: {...}  // set by calculateDisplayProjection()
}
```

### Config JSON Format
See `samples/display-config.json` for a reference file with multiple displays. Format uses `"version": "1.0"` and a `"displays"` array.

### Edge Distance Modes
- **Stable** (default): uses display center + local axes — preferred when manipulating/rotating displays
- **Precise**: projects eye onto each edge individually — use for validation/debugging only

### Desktop vs Web
- This is **both an Electron desktop app and a web app** — all functional changes must work correctly in both environments
- `window.electronAPI` presence is the sole platform detection mechanism (see `src/fileInterface.js`)
- `src/renderer-core.js` runs identically in both modes — do not add platform conditionals there
- Web mode has no filesystem access; file operation UI is hidden/disabled automatically
- When adding UI features, test entry points for both: `desktop/renderer.js` (Electron) and `web/web-renderer.js` (web)
- When adding IPC-dependent features (file I/O, dialogs), implement the fallback in `src/fileInterface.js` so web mode degrades gracefully

## Off-Axis Frustum — Key Concepts

1. Eye is at origin; all projections are relative to it.
2. Nearest point = perpendicular projection of eye onto display plane (foundation for all distance math).
3. Custom `nearPlane` scales frustum values linearly: `scaleFactor = customNearPlane / nearestPointDistance`.
4. Asymmetry ratio `(right + left) / (right - left)` quantifies how far the frustum center is offset.

For detailed derivation see `/memories/repo/projection-matrix-notes.md`.
