/**
 * UTILS.JS
 * Core utility functions for the glitch engine
 */

const Utils = {
    /**
     * Linear interpolation
     */
    lerp(start, end, t) {
        return start * (1 - t) + end * t;
    },

    /**
     * Map value from one range to another
     */
    map(value, inMin, inMax, outMin, outMax) {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    },

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * Random float between min and max
     */
    random(min = 0, max = 1) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Random choice from array
     */
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * Easing functions
     */
    easing: {
        linear: t => t,
        easeInQuad: t => t * t,
        easeOutQuad: t => t * (2 - t),
        easeInOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
        easeInCubic: t => t * t * t,
        easeOutCubic: t => (--t) * t * t + 1,
        easeInOutCubic: t => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
        easeOutElastic: t => {
            const p = 0.3;
            return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
        }
    },

    /**
     * Device detection
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    },

    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    /**
     * Get normalized mouse position (-1 to 1)
     */
    getNormalizedMouse(e) {
        return {
            x: (e.clientX / window.innerWidth) * 2 - 1,
            y: -(e.clientY / window.innerHeight) * 2 + 1
        };
    },

    /**
     * FPS Counter
     */
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
            },
            getFPS() {
                return fps;
            }
        };
    },

    /**
     * Generate noise
     */
    noise(x, y = 0, z = 0) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + z * 45.5432) * 43758.5453;
        return n - Math.floor(n);
    }
};

window.Utils = Utils;
