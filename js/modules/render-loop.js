/**
 * Adaptive render loop: full / 20fps ambient / frozen (0 fps).
 */

export class RenderLoop {
    constructor({ onFrame, getMode }) {
        this.onFrame = onFrame;
        this.getMode = getMode;
        this.raf = null;
        this.running = false;
        this.frozen = false;
        this.lastFrameTime = 0;
        this.freezeAfterMs = 8000;
        this.ambientIntervalMs = 50;
        this.lastActivity = performance.now();
    }

    ping() {
        this.lastActivity = performance.now();
        this.frozen = false;
        this.start();
    }

    getActivityAge() {
        return performance.now() - this.lastActivity;
    }

    start() {
        if (this.raf) return;
        this.running = true;
        this.lastFrameTime = 0;
        const tick = (t) => {
            if (document.hidden) {
                this.raf = null;
                this.running = false;
                return;
            }

            const mode = this.getMode(this.getActivityAge());
            if (mode === 'frozen') {
                this.raf = null;
                this.running = false;
                this.frozen = true;
                return;
            }

            if (mode === 'ambient') {
                if (t - this.lastFrameTime < this.ambientIntervalMs) {
                    this.raf = requestAnimationFrame(tick);
                    return;
                }
            }

            this.lastFrameTime = t;
            this.onFrame(t);
            this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
    }

    stop() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
        this.running = false;
        this.frozen = true;
    }

    isRunning() {
        return this.running;
    }

    isFrozen() {
        return this.frozen && !this.raf;
    }
}
