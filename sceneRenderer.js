// 3D Scene Renderer for Node View Calibrator
// Replaces the 2D canvas rendering with a Three.js 3D viewport

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { rotateVector } from './mathutils.js';

// Display material colors
const DISPLAY_COLOR = 0x4488ff;
const DISPLAY_SELECTED_COLOR = 0xff8800;
const DISPLAY_OPACITY = 0.35;
const DISPLAY_SELECTED_OPACITY = 0.5;
const BORDER_DEFAULT_COLOR = 0x000000;
const EYE_COLOR = 0xff0000;
const SIGHT_LINE_COLOR = 0xff8800;
const NEAREST_POINT_COLOR = 0xff0000;
const NEAR_PLANE_COLOR = 0x0088ff;
const NEAR_PLANE_CUSTOM_COLOR = 0xffff00;

// Snap constants
const SNAP_THRESHOLD = 0.1;         // meters — distance within which snap activates
const SNAP_GUIDE_COLOR_IDLE = 0x888888;   // dim white for non-snapping guides
const SNAP_GUIDE_COLOR_ACTIVE = 0xffff00; // yellow for guides within snap range
const SNAP_GUIDE_ARM_LENGTH = 0.12; // half-arm length for crosshair guide lines

export class SceneRenderer {
  constructor(container) {
    this.container = container;
    this.displayMeshes = [];       // Array of THREE.Group, one per display
    this.sightLines = [];          // Sight line helpers for selected display
    this.nearestPointHelper = null; // Nearest point visualization
    this.nearPlaneHelpers = [];    // Near plane visualizations (one per displayed near plane)
    this.selectedIndex = -1;
    this.selectedIndices = [];         // Array of selected display indices (multi-select)
    this._pivotObject = new THREE.Object3D(); // Pivot object for multi-select gizmo
    this._multiOffsets = {};           // Map of display index → Vector3 offset from pivot
    this.cameraMode = 'orbit';     // 'orbit' or 'firstperson'
    this.gizmoMode = 'translate';  // 'translate' or 'rotate'
    this.onDisplayChange = null;   // Callback: (index, {x, y, z, yaw, pitch, roll}) => void
    this.onDisplaySelect = null;   // Callback: (index) => void
    this.onMultiSelect = null;     // Callback: (indices: number[]) => void
    this.onModelChange = null;     // Callback: ({x, y, z, yaw, pitch, roll, scale}) => void
    this.onModelSelect = null;     // Callback: (id: number | false) => void
    this.fbxModels = [];           // Array of {id, name, model: THREE.Group, visible: bool}
    this.selectedModelId = null;   // ID of the currently selected model (or null)
    this._nextModelId = 0;
    this.animationId = null;
    this._isPointerDown = false;
    this._pointerDownPos = new THREE.Vector2();
    this._shiftHeld = false;
    this._snapGuideGroup = new THREE.Group();

    this._initScene();
    this._initCamera();
    this._initRenderer();
    this._initControls();
    this._initLights();
    this._initGrid();
    this._initEye();
    this._initGizmo();
    this._initRaycaster();
    this._initEvents();
    this._animate();
  }

  // --- Initialization ---

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.add(this._snapGuideGroup);
  }

  _initCamera() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 100);
    this.camera.position.set(1.5, 1.5, -1.5);
    this.camera.lookAt(0, 0, 0.7);

    // First-person camera stored separately
    this.fpCamera = new THREE.PerspectiveCamera(90, aspect, 0.01, 100);
    this.fpCamera.position.set(0, 0, 0);
    this.fpCamera.lookAt(0, 0, 1);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);
  }

  _initControls() {
    // Orbit controls for the main camera
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;
    this.orbitControls.target.set(0, 0, 0.7);
    this.orbitControls.update();

    // First-person: simple mouse look
    this._fpYaw = 0;
    this._fpPitch = 0;
    this._fpActive = false;
  }

  _initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 4, -2);
    this.scene.add(dir);
  }

  _initGrid() {
    // XZ ground grid
    const grid = new THREE.GridHelper(10, 20, 0x444466, 0x333355);
    this.scene.add(grid);

    // Axes helper at origin
    const axes = new THREE.AxesHelper(0.5);
    this.scene.add(axes);

    // Axis labels using sprites
    this._addAxisLabel('X', new THREE.Vector3(0.6, 0, 0), 0xff4444);
    this._addAxisLabel('Y', new THREE.Vector3(0, 0.6, 0), 0x44ff44);
    this._addAxisLabel('Z', new THREE.Vector3(0, 0, 0.6), 0x4444ff);
  }

  _addAxisLabel(text, position, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(position);
    sprite.scale.set(0.15, 0.15, 0.15);
    this.scene.add(sprite);
  }

  _initEye() {
    const geo = new THREE.SphereGeometry(0.03, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: EYE_COLOR });
    this.eyeMesh = new THREE.Mesh(geo, mat);
    this.eyeMesh.position.set(0, 0, 0);
    this.scene.add(this.eyeMesh);

    // Eye label
    this._addSpriteLabel('Eye', this.eyeMesh, new THREE.Vector3(0, 0.06, 0), 0xff4444);
  }

  _addSpriteLabel(text, parent, offset, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(offset);
    sprite.scale.set(0.15, 0.075, 1);
    parent.add(sprite);
  }

  _initGizmo() {
    this.scene.add(this._pivotObject);  // Invisible pivot for multi-select gizmo
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode('translate');
    this.transformControls.setSize(0.6);
    this.scene.add(this.transformControls.getHelper());

    // When gizmo dragging starts/stops, disable/enable orbit controls
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
      if (!event.value) {
        // Drag ended — clear snap guide lines
        this._clearSnapGuides();
      }
    });

    // When the gizmo moves/rotates a display or model, sync back to the data model
    this.transformControls.addEventListener('change', () => {
      // Handle FBX model gizmo changes
      const activeEntry = this.fbxModels.find(m => m.id === this.selectedModelId);
      if (activeEntry) {
        const pos = activeEntry.model.position;
        const euler = activeEntry.model.rotation;
        const s = activeEntry.model.scale.x;
        const yaw = -THREE.MathUtils.radToDeg(euler.y);
        const pitch = THREE.MathUtils.radToDeg(euler.x);
        const roll = THREE.MathUtils.radToDeg(euler.z);
        if (this.onModelChange) {
          this.onModelChange({ x: pos.x, y: pos.y, z: pos.z, yaw, pitch, roll, scale: s });
        }
        return;
      }

      // Multi-select: sync all selected display meshes from pivot position
      if (this.selectedIndices.length > 1) {
        const pivot = this._pivotObject.position;
        this.selectedIndices.forEach(i => {
          const group = this.displayMeshes[i];
          if (!group || !this._multiOffsets[i]) return;
          group.position.copy(pivot).add(this._multiOffsets[i]);
          if (this.onDisplayChange) {
            this.onDisplayChange(i, {
              x: group.position.x,
              y: group.position.y,
              z: group.position.z,
              yaw: -THREE.MathUtils.radToDeg(group.rotation.y),
              pitch: THREE.MathUtils.radToDeg(group.rotation.x),
              roll: THREE.MathUtils.radToDeg(group.rotation.z),
            });
          }
        });
        return;
      }

      // Handle display gizmo changes
      if (this.selectedIndex < 0) return;
      const group = this.displayMeshes[this.selectedIndex];
      if (!group) return;

      // Read back position and rotation from the mesh
      const pos = group.position;
      const euler = group.rotation;

      // Convert rotation back to degrees (our rotation order is ZXY)
      // Negate yaw back to match original convention
      const yaw = -THREE.MathUtils.radToDeg(euler.y);
      const pitch = THREE.MathUtils.radToDeg(euler.x);
      const roll = THREE.MathUtils.radToDeg(euler.z);

      // Apply snap when Shift is held during translation
      if (this._shiftHeld && this.gizmoMode === 'translate') {
        this._applySnapToGroup(this.selectedIndex);
        this._updateSnapGuides(this.selectedIndex);
      }

      if (this.onDisplayChange) {
        this.onDisplayChange(this.selectedIndex, {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          yaw,
          pitch,
          roll
        });
      }
    });
  }

  _initRaycaster() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }

  _initEvents() {
    // Click for selection
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; // left click only
      this._isPointerDown = true;
      this._pointerDownPos.set(e.clientX, e.clientY);
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (e.button !== 0 || !this._isPointerDown) return;
      this._isPointerDown = false;

      // Only count as click if mouse didn't move much (not a drag)
      const dx = e.clientX - this._pointerDownPos.x;
      const dy = e.clientY - this._pointerDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;

      this._handleClick(e);
    });

    // First-person mouse look
    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (this.cameraMode !== 'firstperson' || !this._fpActive) return;
      this._fpYaw -= e.movementX * 0.002;
      this._fpPitch -= e.movementY * 0.002;
      this._fpPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this._fpPitch));
      this.fpCamera.rotation.set(this._fpPitch, this._fpYaw, 0, 'YXZ');
    });

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (this.cameraMode === 'firstperson' && e.button === 0) {
        this._fpActive = true;
        this.renderer.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.renderer.domElement) {
        this._fpActive = false;
      }
    });

    // Keyboard: T for translate, R for rotate gizmo mode
    window.addEventListener('keydown', (e) => {
      // Track Shift state for snap (even when focused in inputs)
      if (e.key === 'Shift') {
        this._shiftHeld = true;
      }
      // Don't capture other keys if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 't' || e.key === 'T') {
        this.setGizmoMode('translate');
      } else if (e.key === 'r' || e.key === 'R') {
        this.setGizmoMode('rotate');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        this._shiftHeld = false;
        this._clearSnapGuides();
      }
    });

    // Resize
    window.addEventListener('resize', () => this.resize());
  }

  _handleClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const cam = this.cameraMode === 'orbit' ? this.camera : this.fpCamera;
    this.raycaster.setFromCamera(this.mouse, cam);

    // Collect all display plane meshes for intersection
    const targets = [];
    this.displayMeshes.forEach((group, index) => {
      group.traverse((child) => {
        if (child.isMesh && child.userData.isDisplayPlane) {
          child.userData.displayIndex = index;
          targets.push(child);
        }
      });
    });

    // Collect FBX model meshes for intersection
    const modelTargets = [];
    this.fbxModels.forEach((entry) => {
      if (!entry.visible) return;
      entry.model.traverse((child) => {
        if (child.isMesh) {
          child.userData.fbxModelId = entry.id;
          modelTargets.push(child);
        }
      });
    });

    const allTargets = [...targets, ...modelTargets];
    const intersects = this.raycaster.intersectObjects(allTargets);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit.userData.fbxModelId !== undefined) {
        // Clicked on an FBX model
        this.selectModel(hit.userData.fbxModelId);
      } else {
        const idx = hit.userData.displayIndex;
        this.deselectModel();
        if (event.ctrlKey || event.metaKey) {
          // Ctrl/Cmd held: toggle this display in the multi-selection
          const newSet = new Set(this.selectedIndices);
          if (newSet.has(idx)) {
            newSet.delete(idx);
          } else {
            newSet.add(idx);
          }
          const newIndices = [...newSet];
          if (newIndices.length <= 1) {
            // Collapsed to single select or empty
            const single = newIndices.length === 1 ? newIndices[0] : -1;
            if (this.onDisplaySelect) this.onDisplaySelect(single);
          } else {
            if (this.onMultiSelect) this.onMultiSelect(newIndices);
          }
        } else {
          // Normal single click — clear multi-selection
          if (this.onDisplaySelect) this.onDisplaySelect(idx);
        }
      }
    } else {
      // Click on background → deselect all
      this.deselectModel();
      if (this.onDisplaySelect) this.onDisplaySelect(-1);
    }
  }

  // --- Public API ---

  /**
   * Add a display mesh to the scene
   * @param {Object} display - Display data object
   * @returns {number} Index of the added display
   */
  addDisplay(display) {
    const group = this._createDisplayGroup(display);
    this.scene.add(group);
    this.displayMeshes.push(group);
    return this.displayMeshes.length - 1;
  }

  /**
   * Update an existing display mesh
   * @param {number} index - Display index
   * @param {Object} display - Updated display data
   */
  updateDisplay(index, display) {
    if (index < 0 || index >= this.displayMeshes.length) return;
    const oldGroup = this.displayMeshes[index];
    this.scene.remove(oldGroup);
    this._disposeGroup(oldGroup);

    const newGroup = this._createDisplayGroup(display);
    this.scene.add(newGroup);
    this.displayMeshes[index] = newGroup;

    // Reattach gizmo if this is the selected display
    if (index === this.selectedIndex) {
      this.transformControls.attach(newGroup);
      this._updateSightLines(display);
      this._updateNearestPoint(display);
    }
  }

  /**
   * Remove a display mesh
   * @param {number} index - Display index
   */
  removeDisplay(index) {
    if (index < 0 || index >= this.displayMeshes.length) return;
    const group = this.displayMeshes[index];

    // Remove from multi-selection and shift higher indices down
    this.selectedIndices = this.selectedIndices
      .filter(i => i !== index)
      .map(i => i > index ? i - 1 : i);

    if (this.selectedIndex === index) {
      this.transformControls.detach();
      this.selectedIndex = -1;
    } else if (this.selectedIndex > index) {
      this.selectedIndex--;
    }

    this.scene.remove(group);
    this._disposeGroup(group);
    this.displayMeshes.splice(index, 1);

    // Clamp selected index
    if (this.selectedIndex >= this.displayMeshes.length) {
      this.selectedIndex = this.displayMeshes.length - 1;
    }
  }

  /**
   * Remove all display meshes
   */
  clearDisplays() {
    this.transformControls.detach();
    for (const group of this.displayMeshes) {
      this.scene.remove(group);
      this._disposeGroup(group);
    }
    this.displayMeshes = [];
    this.selectedIndex = -1;
    this.selectedIndices = [];
    this._multiOffsets = {};
    this._clearSightLines();
    this._clearNearestPoint();
    this._clearNearPlanes();
  }

  /**
   * Update display mesh material colors based on this.selectedIndices.
   */
  _updateSelectionColors() {
    this.displayMeshes.forEach((group, i) => {
      const isSelected = this.selectedIndices.includes(i);
      group.traverse((child) => {
        if (child.isMesh && child.userData.isDisplayPlane) {
          child.material.color.setHex(isSelected ? DISPLAY_SELECTED_COLOR : DISPLAY_COLOR);
          child.material.opacity = isSelected ? DISPLAY_SELECTED_OPACITY : DISPLAY_OPACITY;
        }
        if (child.isLineSegments && child.userData.isDisplayBorder) {
          child.material.color.setHex(isSelected ? DISPLAY_SELECTED_COLOR : (child.userData.borderColorHex || BORDER_DEFAULT_COLOR));
        }
      });
    });
  }

  /**
   * Select a display by index (-1 to deselect). Clears any multi-selection.
   * @param {number} index
   * @param {Object} [display] - Display data for visualization helpers
   */
  selectDisplay(index, display) {
    this.selectedIndex = index;
    this.selectedIndices = index >= 0 ? [index] : [];
    this._updateSelectionColors();

    // Attach or detach gizmo
    if (index >= 0 && index < this.displayMeshes.length) {
      this.transformControls.attach(this.displayMeshes[index]);
      if (display) {
        this._updateSightLines(display);
        this._updateNearestPoint(display);
      }
    } else {
      this.transformControls.detach();
      this._clearSightLines();
      this._clearNearestPoint();
    }
  }

  /**
   * Select multiple displays. Places a shared pivot gizmo at their centroid.
   * @param {number[]} indices - Array of display indices
   * @param {Object[]} displays - Corresponding display data objects (same order as indices)
   */
  selectMultipleDisplays(indices, displays) {
    this.selectedIndices = [...indices];
    this.selectedIndex = indices.length > 0 ? indices[indices.length - 1] : -1;
    this._updateSelectionColors();
    this._clearSightLines();
    this._clearNearestPoint();

    if (indices.length === 0) {
      this.transformControls.detach();
      return;
    }

    if (indices.length === 1) {
      // Delegate to single-select path
      this.transformControls.attach(this.displayMeshes[indices[0]]);
      const display = displays && displays[0];
      if (display) {
        this._updateSightLines(display);
        this._updateNearestPoint(display);
      }
      return;
    }

    // Multi-select: place pivot at centroid and attach gizmo to it
    this.transformControls.setMode('translate');
    this.gizmoMode = 'translate';

    const centroid = new THREE.Vector3();
    indices.forEach(i => centroid.add(this.displayMeshes[i].position));
    centroid.divideScalar(indices.length);

    this._pivotObject.position.copy(centroid);
    this._pivotObject.rotation.set(0, 0, 0);

    this._multiOffsets = {};
    indices.forEach(i => {
      this._multiOffsets[i] = this.displayMeshes[i].position.clone().sub(centroid);
    });

    this.transformControls.attach(this._pivotObject);
  }

  /**
   * Update near plane visualizations for all displays.
   * Shows the near plane for the selected display (if it has a custom nearPlane),
   * plus any display with showNearPlane: true.
   * @param {Object[]} displays - All display data objects
   * @param {number} selectedIndex - Currently selected display index (-1 for none)
   */
  updateAllNearPlanes(displays, selectedIndex) {
    this._clearNearPlanes();
    if (!displays) return;
    displays.forEach((display, i) => {
      const isSelected = i === selectedIndex;
      if (!isSelected && !display.showNearPlane) return;
      const isCustom = display.nearPlane != null;
      this._drawNearPlaneForDisplay(display, isCustom);
    });
  }

  /**
   * Draw near plane quad for a single display and add to nearPlaneHelpers.
   */
  _drawNearPlaneForDisplay(display, isCustom) {
    if (!display || !display.nearestPoint) return;
    const np = display.nearestPoint;
    const nearestDist = Math.abs(np.distance);
    if (nearestDist < 0.0001) return;

    const color = isCustom ? NEAR_PLANE_CUSTOM_COLOR : NEAR_PLANE_COLOR;
    const nearPlane = display.nearPlane != null ? display.nearPlane : nearestDist;
    const scale = nearPlane / nearestDist;

    // Compute the 4 near-plane corners by scaling display corners from the eye (origin)
    const { width, height, yaw, pitch, roll, x, y, z } = display;
    const halfW = width / 2;
    const halfH = height / 2;
    const yawRad = yaw * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const rollRad = roll * Math.PI / 180;
    const localCorners = [
      { x: -halfW, y:  halfH, z: 0 },
      { x:  halfW, y:  halfH, z: 0 },
      { x:  halfW, y: -halfH, z: 0 },
      { x: -halfW, y: -halfH, z: 0 }
    ];
    const corners = localCorners.map(c => {
      const r = rotateVector(c, yawRad, pitchRad, rollRad);
      return new THREE.Vector3(
        (r.x + x) * scale,
        (r.y + y) * scale,
        (r.z + z) * scale
      );
    });

    // Translucent quad (two triangles: 0-1-2, 0-2-3)
    const positions = new Float32Array([
      corners[0].x, corners[0].y, corners[0].z,
      corners[1].x, corners[1].y, corners[1].z,
      corners[2].x, corners[2].y, corners[2].z,
      corners[0].x, corners[0].y, corners[0].z,
      corners[2].x, corners[2].y, corners[2].z,
      corners[3].x, corners[3].y, corners[3].z,
    ]);
    const quadGeo = new THREE.BufferGeometry();
    quadGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    quadGeo.computeVertexNormals();
    const quadMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(quadGeo, quadMat);
    this.scene.add(quad);

    // Border outline
    const borderGeo = new THREE.BufferGeometry().setFromPoints([
      corners[0], corners[1], corners[2], corners[3], corners[0]
    ]);
    const borderMat = new THREE.LineBasicMaterial({ color });
    const border = new THREE.Line(borderGeo, borderMat);
    this.scene.add(border);

    this.nearPlaneHelpers.push({ quad, border });
  }

  /**
   * Set camera mode: 'orbit' or 'firstperson'
   */
  setCameraMode(mode) {
    this.cameraMode = mode;
    if (mode === 'orbit') {
      this.orbitControls.enabled = true;
      this._fpActive = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      // Switch gizmo to orbit camera
      this.transformControls.camera = this.camera;
    } else {
      this.orbitControls.enabled = false;
      // Reset FP camera
      this.fpCamera.position.set(0, 0, 0);
      this._fpYaw = 0;
      this._fpPitch = 0;
      this.fpCamera.rotation.set(0, 0, 0, 'YXZ');
      // Detach gizmo in first-person mode
      this.transformControls.detach();
    }
  }

  /**
   * Set gizmo mode: 'translate' or 'rotate'
   */
  setGizmoMode(mode) {
    // Don't allow rotate when multiple displays are selected
    if (this.selectedIndices.length > 1 && mode === 'rotate') return;
    this.gizmoMode = mode;
    this.transformControls.setMode(mode);
  }

  /**
   * Reset orbit camera to default position
   */
  resetCamera() {
    if (this.cameraMode === 'orbit') {
      this.camera.position.set(1.5, 1.5, -1.5);
      this.orbitControls.target.set(0, 0, 0.7);
      this.orbitControls.update();
    } else {
      this.fpCamera.position.set(0, 0, 0);
      this._fpYaw = 0;
      this._fpPitch = 0;
      this.fpCamera.rotation.set(0, 0, 0, 'YXZ');
    }
  }

  /**
   * Handle container resize
   */
  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fpCamera.aspect = w / h;
    this.fpCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.transformControls.dispose();
    this.orbitControls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }

  // --- FBX Model API ---

  /**
   * Load an FBX model from a file path (Electron/local)
   * @param {string} filePath - Path to the .fbx file
   * @param {string} [name] - Display name for the model
   * @returns {Promise<number>} ID of the added model
   */
  loadFBXModel(filePath, name) {
    return new Promise((resolve, reject) => {
      const loader = new FBXLoader();
      loader.load(filePath, (object) => {
        const id = this._addFBXModel(object, name || filePath.split(/[/\\]/).pop());
        resolve(id);
      }, undefined, (error) => {
        reject(error);
      });
    });
  }

  /**
   * Load an FBX model from an ArrayBuffer (Web)
   * @param {ArrayBuffer} buffer - FBX file data
   * @param {string} [name] - Display name for the model
   * @returns {number} ID of the added model
   */
  loadFBXModelFromBuffer(buffer, name) {
    const loader = new FBXLoader();
    const object = loader.parse(buffer, '');
    return this._addFBXModel(object, name || 'Model');
  }

  _addFBXModel(object, name) {
    const id = this._nextModelId++;

    // Replace all materials with solid gray (no textures)
    const grayMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.1,
      roughness: 0.8,
    });
    object.traverse((child) => {
      if (child.isMesh) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
        child.material = grayMaterial;
        child.userData.isFBXModelMesh = true;
        child.userData.fbxModelId = id;
      }
    });

    object.userData.isFBXModel = true;
    object.rotation.order = 'ZXY';
    this.fbxModels.push({ id, name, model: object, visible: true });
    this.scene.add(object);
    return id;
  }

  /**
   * Remove an FBX model by ID
   * @param {number} id - Model ID
   */
  removeFBXModel(id) {
    const index = this.fbxModels.findIndex(m => m.id === id);
    if (index === -1) return;
    const entry = this.fbxModels[index];
    if (this.selectedModelId === id) {
      this.transformControls.detach();
      this.selectedModelId = null;
    }
    this.scene.remove(entry.model);
    entry.model.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.fbxModels.splice(index, 1);
    if (this.fbxModels.length === 0 && this.onModelSelect) {
      this.onModelSelect(false);
    }
  }

  /**
   * Toggle visibility of an FBX model by ID
   * @param {number} id - Model ID
   */
  toggleModelVisibility(id) {
    const entry = this.fbxModels.find(m => m.id === id);
    if (!entry) return;
    entry.visible = !entry.visible;
    entry.model.visible = entry.visible;
  }

  /**
   * Select the FBX model (attach gizmo, deselect displays)
   * @param {number} id - Model ID
   */
  selectModel(id) {
    const entry = this.fbxModels.find(m => m.id === id);
    if (!entry) return;
    // Deselect any selected display
    this.selectDisplay(-1);
    this.selectedModelId = id;
    this.transformControls.attach(entry.model);
    if (this.onModelSelect) this.onModelSelect(id);
  }

  /**
   * Deselect the FBX model
   */
  deselectModel() {
    if (this.selectedModelId === null) return;
    this.selectedModelId = null;
    this.transformControls.detach();
    if (this.onModelSelect) this.onModelSelect(false);
  }

  /**
   * Set FBX model transform from UI inputs
   * @param {number} id - Model ID
   */
  setModelTransform(id, x, y, z, yaw, pitch, roll, scale) {
    const entry = this.fbxModels.find(m => m.id === id);
    if (!entry) return;
    entry.model.position.set(x, y, z);
    entry.model.rotation.set(
      pitch * Math.PI / 180,
      -yaw * Math.PI / 180,
      roll * Math.PI / 180
    );
    entry.model.scale.setScalar(scale);
  }

  /**
   * Get current FBX model transform
   * @param {number} id - Model ID
   * @returns {{ x, y, z, yaw, pitch, roll, scale } | null}
   */
  getModelTransform(id) {
    const entry = this.fbxModels.find(m => m.id === id);
    if (!entry) return null;
    const pos = entry.model.position;
    const euler = entry.model.rotation;
    return {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: -THREE.MathUtils.radToDeg(euler.y),
      pitch: THREE.MathUtils.radToDeg(euler.x),
      roll: THREE.MathUtils.radToDeg(euler.z),
      scale: entry.model.scale.x
    };
  }

  // --- Internal: Display mesh creation ---

  _createDisplayGroup(display) {
    const group = new THREE.Group();
    const { width, height, yaw, pitch, roll, x, y, z } = display;
    group.userData.displayWidth = width;
    group.userData.displayHeight = height;
    const showBorders = display.showBorders !== undefined ? display.showBorders : true;
    const borderWidthCm = display.borderWidthCm !== undefined ? display.borderWidthCm : 1.4;
    const borderColor = display.borderColor || 'black';

    // Main display plane
    const planeGeo = new THREE.PlaneGeometry(width, height);
    const planeMat = new THREE.MeshStandardMaterial({
      color: DISPLAY_COLOR,
      transparent: true,
      opacity: DISPLAY_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.userData.isDisplayPlane = true;
    group.add(planeMesh);

    // Border outline
    if (showBorders) {
      const edgesGeo = new THREE.EdgesGeometry(planeGeo);
      const colorObj = new THREE.Color(borderColor);
      const edgesMat = new THREE.LineBasicMaterial({ color: colorObj });
      const edges = new THREE.LineSegments(edgesGeo, edgesMat);
      edges.userData.isDisplayBorder = true;
      edges.userData.borderColorHex = colorObj.getHex();
      group.add(edges);

      // Inner border rectangle to show border width
      const bw = borderWidthCm / 100; // Convert cm to meters
      if (bw > 0 && width > 2 * bw && height > 2 * bw) {
        const innerW = width - 2 * bw;
        const innerH = height - 2 * bw;
        const innerGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(innerW, innerH));
        const innerEdges = new THREE.LineSegments(innerGeo, new THREE.LineBasicMaterial({ color: colorObj, transparent: true, opacity: 0.5 }));
        innerEdges.userData.isDisplayBorder = true;
        innerEdges.userData.borderColorHex = colorObj.getHex();
        group.add(innerEdges);
      }
    }

    // Display name label
    const name = display.name || '';
    if (name) {
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 64;
      const ctx = labelCanvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 128, 32);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelMat = new THREE.SpriteMaterial({ map: labelTex, depthTest: false });
      const label = new THREE.Sprite(labelMat);
      label.position.set(0, height / 2 + 0.05, 0);
      label.scale.set(0.3, 0.075, 1);
      group.add(label);
    }

    // Apply rotation: the existing code applies roll→pitch→yaw to vertices.
    // Three.js Euler order 'ZXY' means: first roll(Z), then pitch(X), then yaw(Y)
    // Yaw is negated because Three.js Y rotation has opposite sign convention
    // Original: x'=x*cos-z*sin, z'=x*sin+z*cos  vs  Three.js: x'=x*cos+z*sin, z'=-x*sin+z*cos
    const yawRad = -yaw * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const rollRad = roll * Math.PI / 180;
    group.rotation.order = 'ZXY';
    group.rotation.set(pitchRad, yawRad, rollRad);

    // Apply position
    group.position.set(x, y, z);

    return group;
  }

  _disposeGroup(group) {
    group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }

  // --- Internal: Sight lines ---

  _updateSightLines(display) {
    this._clearSightLines();
    if (!display) return;

    const { width, height, yaw, pitch, roll, x, y, z } = display;
    const halfW = width / 2;
    const halfH = height / 2;
    const yawRad = yaw * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const rollRad = roll * Math.PI / 180;

    // Calculate 4 corners in world space using same rotation as canvasRenderer
    const localCorners = [
      { x: -halfW, y: halfH, z: 0 },
      { x: halfW, y: halfH, z: 0 },
      { x: halfW, y: -halfH, z: 0 },
      { x: -halfW, y: -halfH, z: 0 }
    ];

    const worldCorners = localCorners.map(c => {
      const r = rotateVector(c, yawRad, pitchRad, rollRad);
      return new THREE.Vector3(r.x + x, r.y + y, r.z + z);
    });

    const eyePos = new THREE.Vector3(0, 0, 0);
    const lineMat = new THREE.LineDashedMaterial({
      color: SIGHT_LINE_COLOR,
      transparent: true,
      opacity: 0.4,
      dashSize: 0.05,
      gapSize: 0.03
    });

    for (const corner of worldCorners) {
      const geo = new THREE.BufferGeometry().setFromPoints([eyePos, corner]);
      const line = new THREE.Line(geo, lineMat.clone());
      line.computeLineDistances();
      this.scene.add(line);
      this.sightLines.push(line);
    }
  }

  _clearSightLines() {
    for (const line of this.sightLines) {
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.sightLines = [];
  }

  // --- Internal: Nearest point ---

  _updateNearestPoint(display) {
    this._clearNearestPoint();
    if (!display || !display.nearestPoint) return;

    const np = display.nearestPoint;
    const pos = new THREE.Vector3(np.x, np.y, np.z);

    // Red sphere
    const geo = new THREE.SphereGeometry(0.02, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: NEAREST_POINT_COLOR });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(pos);
    this.scene.add(sphere);

    // Dashed line from eye to nearest point
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      pos
    ]);
    const lineMat = new THREE.LineDashedMaterial({
      color: NEAREST_POINT_COLOR,
      dashSize: 0.03,
      gapSize: 0.02
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    this.scene.add(line);

    // Distance label
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = '#ff4444';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${np.distance.toFixed(3)}m`, 128, 32);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, depthTest: false });
    const label = new THREE.Sprite(labelMat);
    const labelPos = pos.clone().lerp(new THREE.Vector3(0, 0, 0), 0.3);
    labelPos.y += 0.05;
    label.position.copy(labelPos);
    label.scale.set(0.2, 0.05, 1);
    this.scene.add(label);

    this.nearestPointHelper = { sphere, line, label };
  }

  _clearNearestPoint() {
    if (!this.nearestPointHelper) return;
    const { sphere, line, label } = this.nearestPointHelper;
    this.scene.remove(sphere);
    this.scene.remove(line);
    this.scene.remove(label);
    sphere.geometry.dispose();
    sphere.material.dispose();
    line.geometry.dispose();
    line.material.dispose();
    if (label.material.map) label.material.map.dispose();
    label.material.dispose();
    this.nearestPointHelper = null;
  }

  _clearNearPlanes() {
    for (const { quad, border } of this.nearPlaneHelpers) {
      this.scene.remove(quad);
      this.scene.remove(border);
      quad.geometry.dispose();
      quad.material.dispose();
      border.geometry.dispose();
      border.material.dispose();
    }
    this.nearPlaneHelpers = [];
  }

  // --- Internal: Snap helpers ---

  /**
   * Returns 8 world-space snap points for the given display:
   * 4 corners + 4 edge midpoints.
   */
  _calculateSnapPoints(displayIndex) {
    const group = this.displayMeshes[displayIndex];
    if (!group) return [];
    const hw = (group.userData.displayWidth || 0) / 2;
    const hh = (group.userData.displayHeight || 0) / 2;
    const localPoints = [
      new THREE.Vector3(-hw,  hh, 0), // top-left
      new THREE.Vector3( hw,  hh, 0), // top-right
      new THREE.Vector3( hw, -hh, 0), // bottom-right
      new THREE.Vector3(-hw, -hh, 0), // bottom-left
      new THREE.Vector3(  0,  hh, 0), // top-mid
      new THREE.Vector3(  0, -hh, 0), // bottom-mid
      new THREE.Vector3(-hw,   0, 0), // left-mid
      new THREE.Vector3( hw,   0, 0), // right-mid
    ];
    group.updateMatrixWorld(true);
    return localPoints.map(lp => group.localToWorld(lp));
  }

  /**
   * If a snap point of the moving display is within SNAP_THRESHOLD of any
   * snap point on another display, translate the moving group so the points coincide.
   */
  _applySnapToGroup(activeGroupIndex) {
    const movingPoints = this._calculateSnapPoints(activeGroupIndex);
    let bestDist = SNAP_THRESHOLD;
    let bestOffset = null;
    for (let i = 0; i < this.displayMeshes.length; i++) {
      if (i === activeGroupIndex) continue;
      const otherPoints = this._calculateSnapPoints(i);
      for (const mp of movingPoints) {
        for (const op of otherPoints) {
          const dist = mp.distanceTo(op);
          if (dist < bestDist) {
            bestDist = dist;
            bestOffset = new THREE.Vector3().subVectors(op, mp);
          }
        }
      }
    }
    if (bestOffset) {
      this.displayMeshes[activeGroupIndex].position.add(bestOffset);
    }
  }

  /**
   * Rebuild the dashed crosshair guide lines for all non-active displays.
   * Active snap points (within SNAP_THRESHOLD of any moving point) are yellow;
   * all others are dim grey.
   */
  _updateSnapGuides(activeGroupIndex) {
    this._clearSnapGuides();
    if (!this._shiftHeld || this.gizmoMode !== 'translate') return;
    const movingPoints = this._calculateSnapPoints(activeGroupIndex);

    for (let i = 0; i < this.displayMeshes.length; i++) {
      if (i === activeGroupIndex) continue;
      const otherGroup = this.displayMeshes[i];
      otherGroup.updateMatrixWorld(true);

      // World-space local axes of this display (for aligning crosshair arms)
      const me = otherGroup.matrixWorld.elements;
      const xAxis = new THREE.Vector3(me[0], me[1], me[2]).normalize();
      const yAxis = new THREE.Vector3(me[4], me[5], me[6]).normalize();

      const snapPoints = this._calculateSnapPoints(i);
      for (const op of snapPoints) {
        const isActive = movingPoints.some(mp => mp.distanceTo(op) < SNAP_THRESHOLD);
        const color = isActive ? SNAP_GUIDE_COLOR_ACTIVE : SNAP_GUIDE_COLOR_IDLE;
        const opacity = isActive ? 1.0 : 0.55;
        const arm = SNAP_GUIDE_ARM_LENGTH;

        const dashMat = new THREE.LineDashedMaterial({
          color,
          dashSize: 0.03,
          gapSize: 0.02,
          transparent: true,
          opacity,
        });

        // Horizontal arm (along display local X)
        const xGeo = new THREE.BufferGeometry().setFromPoints([
          op.clone().addScaledVector(xAxis, -arm),
          op.clone().addScaledVector(xAxis,  arm),
        ]);
        const xLine = new THREE.Line(xGeo, dashMat);
        xLine.computeLineDistances();
        this._snapGuideGroup.add(xLine);

        // Vertical arm (along display local Y)
        const yGeo = new THREE.BufferGeometry().setFromPoints([
          op.clone().addScaledVector(yAxis, -arm),
          op.clone().addScaledVector(yAxis,  arm),
        ]);
        const yLine = new THREE.Line(yGeo, dashMat.clone());
        yLine.computeLineDistances();
        this._snapGuideGroup.add(yLine);
      }
    }
  }

  /** Remove all snap guide lines from the scene and dispose their resources. */
  _clearSnapGuides() {
    const children = [...this._snapGuideGroup.children];
    for (const child of children) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this._snapGuideGroup.remove(child);
    }
  }

  // --- Animation loop ---

  _animate() {
    this.animationId = requestAnimationFrame(() => this._animate());
    if (this.cameraMode === 'orbit') {
      this.orbitControls.update();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.render(this.scene, this.fpCamera);
    }
  }
}
