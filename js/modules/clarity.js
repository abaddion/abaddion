/**
 * Microsoft Clarity — optional (snippet injected at build when CLARITY_PROJECT_ID is set).
 */

export function clarityEvent(name) {
    if (typeof window.clarity !== 'function') return;
    const key = String(name).slice(0, 64);
    window.clarity('event', key);
}

/** SPA route changes — helps attribute sessions to /games vs /canvas etc. */
export function clarityVirtualPage(pathname) {
    if (typeof window.clarity !== 'function') return;
    const path = pathname.replace(/\/+$/, '') || '/';
    window.clarity('set', 'page', path);
    clarityEvent(`route${path === '/' ? '-home' : path.replace(/\//g, '-')}`);
}
