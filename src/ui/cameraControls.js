/**
 * Viewport camera mode (orbit/first-person) and transform gizmo mode
 * (translate/rotate) toolbar buttons, plus the T/R keyboard shortcuts.
 */
export function createCameraControls({ scene, elements, reportUiState }) {
  const { orbitModeBtn, fpModeBtn, resetCameraBtn, translateModeBtn, rotateModeBtn } = elements;

  /**
   * Switch the viewport camera and keep the toolbar buttons in step.
   * @param {'orbit'|'firstperson'} mode - Camera mode
   */
  function setCameraMode(mode) {
    scene.setCameraMode(mode);
    if (orbitModeBtn) orbitModeBtn.classList.toggle('active', mode === 'orbit');
    if (fpModeBtn) fpModeBtn.classList.toggle('active', mode === 'firstperson');
    reportUiState({ cameraMode: mode });
  }

  /**
   * Reflect a gizmo mode in the toolbar without re-issuing it to the scene —
   * used when the scene changed mode itself in response to the T/R keys.
   * @param {'translate'|'rotate'} mode - Gizmo mode
   */
  function syncGizmoButtons(mode) {
    if (translateModeBtn) translateModeBtn.classList.toggle('active', mode === 'translate');
    if (rotateModeBtn) rotateModeBtn.classList.toggle('active', mode === 'rotate');
  }

  /**
   * Switch the transform gizmo and keep the toolbar buttons in step.
   * @param {'translate'|'rotate'} mode - Gizmo mode
   */
  function setGizmoMode(mode) {
    scene.setGizmoMode(mode);
    syncGizmoButtons(mode);
  }

  if (orbitModeBtn) orbitModeBtn.addEventListener('click', () => setCameraMode('orbit'));
  if (fpModeBtn) fpModeBtn.addEventListener('click', () => setCameraMode('firstperson'));
  if (resetCameraBtn) resetCameraBtn.addEventListener('click', () => scene.resetCamera());
  if (translateModeBtn) translateModeBtn.addEventListener('click', () => setGizmoMode('translate'));
  if (rotateModeBtn) rotateModeBtn.addEventListener('click', () => setGizmoMode('rotate'));

  // The scene owns the T/R keys; mirror the result in the toolbar and menu.
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 't' || e.key === 'T') {
      syncGizmoButtons('translate');
    } else if (e.key === 'r' || e.key === 'R') {
      syncGizmoButtons('rotate');
    }
  });

  return { setCameraMode };
}
