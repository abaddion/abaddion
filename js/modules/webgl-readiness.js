/**
 * Shared WebGL boot state — About sphere gates on this.
 * Lifecycle: init → attached (GPU wired) → ready (first frame + render loop).
 */

/** @returns {boolean} First frame rendered and render loop running */
export function isWebGLReady() {
    if (document.documentElement.classList.contains('no-webgl')) return false;
    return window.__APP_STATE?.webglPhase === 'ready';
}
