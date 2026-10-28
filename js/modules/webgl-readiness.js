/**
 * Shared WebGL boot state — About fail-safe uses this (PR A hotfix).
 */

/** @returns {boolean} Renderer finished initAsync successfully */
export function isWebGLReady() {
    if (document.documentElement.classList.contains('no-webgl')) return false;
    return window.__APP_STATE?.webglPhase === 'ready';
}
