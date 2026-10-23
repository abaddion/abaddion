/**
 * UTILS.JS — core helpers.
 */

export async function yieldToMain() {
    if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
        await scheduler.yield();
        return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
}

export function formatFloorLabel(title) {
    const words = String(title).trim().split(/\s+/);
    const spaced = words.map((w) => w.split('').join(' ')).join('  ');
    return `———— ${spaced}`;
}

export const Utils = {
    lerp(start, end, t) {
        return start * (1 - t) + end * t;
    },

    map(value, inMin, inMax, outMin, outMax) {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    },

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    random(min = 0, max = 1) {
        return Math.random() * (max - min) + min;
    },

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    createFPSCounter() {
        let lastTime = performance.now();
        let frames = 0;
        let fps = 60;

        return {
            update() {
                frames++;
                const currentTime = performance.now();
                if (currentTime >= lastTime + 1000) {
                    fps = Math.round((frames * 1000) / (currentTime - lastTime));
                    frames = 0;
                    lastTime = currentTime;
                }
                return fps;
            }
        };
    },

    noise(x, y = 0, z = 0) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.5432) * 43758.5453;
        return n - Math.floor(n);
    }
};
