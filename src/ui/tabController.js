/**
 * Left-column tab strip: switches between panels and keeps the eye gizmo
 * attached only while the Eye tab is open.
 */
export function createTabController({ scene, reportUiState }) {
  /**
   * Show one of the left-column panels, updating the tab strip to match.
   * @param {string} target - Panel element id (e.g. 'tab-eye')
   */
  function activatePanel(target) {
    const panel = document.getElementById(target);
    if (!panel) return;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.target === target);
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    panel.classList.remove('hidden');
    // Attach the eye gizmo while the Eye tab is open; detach it otherwise.
    if (target === 'tab-eye') {
      scene.selectEye();
    } else if (scene.eyeSelected) {
      scene.deselectEye();
    }
    reportUiState({ activePanel: target });
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activatePanel(btn.dataset.target));
  });

  return { activatePanel };
}
