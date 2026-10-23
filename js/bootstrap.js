/**
 * Shell boot — static HTML paints first; WebGL loads in idle time.
 */

import { Utils } from './modules/utils.js';
import { loadContent, getFloorByRoute, getFloorIndex } from './modules/content-loader.js';
import { CardLayer } from './modules/card-layer.js';
import { FloorRail } from './modules/rail.js';
import { AppRouter } from './modules/router.js';
import { disableCustomCursorIfNeeded } from './modules/cursor.js';

function initialCardIndex(content) {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const floor = getFloorByRoute(path);
    return floor ? getFloorIndex(floor) : 0;
}

function scheduleWebGLBoot(callback) {
    const smokeBoot = location.search.includes('smoke=1');
    if (smokeBoot) {
        setTimeout(callback, 0);
        return;
    }
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(callback, { timeout: 1500 });
    } else {
        setTimeout(callback, 0);
    }
}

export function failWebGL(reason) {
    console.warn('[webgl] falling back to HTML shell', reason);
    document.documentElement.classList.add('no-webgl');
    try {
        window.app?.webgl?.renderLoop?.stop();
    } catch {
        /* ignore */
    }
    const canvas = document.getElementById('glitch-canvas');
    if (canvas) canvas.setAttribute('aria-hidden', 'true');
}

function installFailureHandlers() {
    window.addEventListener('error', (e) => {
        if (window.app?.webgl) failWebGL(e.message || 'error');
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (window.app?.webgl) failWebGL(e.reason?.message || 'unhandled rejection');
    });
}

function applyDebugHud() {
    const hud = document.getElementById('hud');
    if (!hud) return;
    if (location.search.includes('debug')) {
        document.documentElement.classList.add('debug-hud');
    } else {
        hud.hidden = true;
    }
}

class ShellApp {
    constructor() {
        disableCustomCursorIfNeeded();
        installFailureHandlers();
        applyDebugHud();

        this.canvas = document.getElementById('glitch-canvas');
        this.reducedMotion = Utils.prefersReducedMotion();
        this.isMobile = Utils.isMobile() || Utils.isTouchDevice();
        this.focusIndex = 0;
        this.content = null;
        this.webgl = null;

        if (this.reducedMotion) {
            document.documentElement.classList.add('reduce-motion');
        }

        this.boot();
    }

    async boot() {
        try {
            const content = await loadContent();
            this.content = content;
            this.focusIndex = initialCardIndex(content);

            this.cardLayer = new CardLayer(document.getElementById('cards'));
            this.cardLayer.build(content, { initialIndex: this.focusIndex });

            this.rail = new FloorRail(
                document.getElementById('floor-rail'),
                content.floors,
                (route, index) => this.goToFloor(index, route)
            );

            this.router = new AppRouter({ onRoute: (payload) => this.handleRoute(payload) });
            this.router.start();

            scheduleWebGLBoot(() => {
                import('./webgl-app.js')
                    .then(({ attachWebGL }) => attachWebGL(this))
                    .catch((err) => {
                        console.error(err);
                        failWebGL(err?.message || 'webgl boot failed');
                    });
            });
        } catch (err) {
            console.error(err);
            failWebGL(err?.message || 'shell boot failed');
        }
    }

    handleRoute(payload) {
        this.focusIndex = payload.index;
        this.rail.setActive(payload.index);
        this.cardLayer.ensureBuilt(payload.index);
        if (this.webgl) {
            this.webgl.handleRoute(payload);
            return;
        }
        if (payload.openOnLoad) {
            this.cardLayer.showCard(payload.index, null, { fadeOnly: true });
        }
        if (payload.canvasSlug) {
            this.cardLayer.openCanvasPiece?.(payload.canvasSlug);
        }
        if (payload.scrollContact) {
            this.cardLayer.ensureBuilt(payload.index);
            setTimeout(() => this.cardLayer.scrollToContact(), 300);
        }
    }

    goToFloor(index, route) {
        this.focusIndex = index;
        this.rail.setActive(index);
        this.cardLayer.ensureBuilt(index);
        if (this.webgl) {
            this.webgl.navigateToFloor(index, route ?? this.router.routeForIndex(index));
            if (index !== 0) {
                this.webgl.openFloor(index, true);
            }
        } else {
            this.router.navigate(route ?? this.router.routeForIndex(index), true);
        }
    }

    routeForIndex(index) {
        return this.router.routeForIndex(index);
    }
}

const app = new ShellApp();
window.app = app;

export { ShellApp };
