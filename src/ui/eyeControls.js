/**
 * Eye rig position: the Eye tab's X/Y/Z inputs, the Reset Eye button, and the
 * gizmo/viewport interactions that keep them in sync.
 */
export function createEyeControls({ scene, elements, fileInterface, tabController }) {
  const { eyePosXInput, eyePosYInput, eyePosZInput, resetEyeBtn } = elements;

  function updateEyeInputs(t) {
    if (eyePosXInput) eyePosXInput.value = parseFloat(t.x.toFixed(4));
    if (eyePosYInput) eyePosYInput.value = parseFloat(t.y.toFixed(4));
    if (eyePosZInput) eyePosZInput.value = parseFloat(t.z.toFixed(4));
  }

  function activateEyeTab() {
    tabController.activatePanel('tab-eye');
  }

  // Gizmo drag on the eye → reflect in the input fields
  scene.onEyeChange = (changes) => {
    updateEyeInputs(changes);
    fileInterface.markUnsaved();
  };

  // Clicking the eye sphere in the viewport → open the Eye tab
  scene.onEyeSelect = () => {
    activateEyeTab();
  };

  function applyEyeFromInputs() {
    const x = parseFloat(eyePosXInput.value) || 0;
    const y = parseFloat(eyePosYInput.value) || 0;
    const z = parseFloat(eyePosZInput.value) || 0;
    scene.setEyeTransform(x, y, z);
    fileInterface.markUnsaved();
  }

  [eyePosXInput, eyePosYInput, eyePosZInput].forEach(input => {
    if (input) input.addEventListener('input', applyEyeFromInputs);
  });

  /** Move the eye rig back to the world origin. */
  function resetEye() {
    scene.setEyeTransform(0, 0, 0);
    updateEyeInputs({ x: 0, y: 0, z: 0 });
    fileInterface.markUnsaved();
  }

  if (resetEyeBtn) {
    resetEyeBtn.addEventListener('click', resetEye);
  }

  return { resetEye, updateEyeInputs };
}
