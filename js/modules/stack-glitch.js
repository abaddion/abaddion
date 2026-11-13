/**
 * Stack rest + focus micro-glitch — uniforms only; no extra draw calls.
 */

export class StackGlitch {
    /**
     * @param {import('./stack.js').BoardStack} stack
     * @param {{ labels?: import('./labels.js').FloorLabels, reducedMotion?: boolean }} opts
     */
    constructor(stack, opts = {}) {
        this.stack = stack;
        this.labels = opts.labels ?? null;
        this.reducedMotion = opts.reducedMotion ?? false;
        this.floorCount = stack.floorCount;
        this._restActive = false;
        this._restT0 = 0;
        this._restDur = 160;
        this._restSlab = -1;
        this._focusActive = false;
        this._focusT0 = 0;
        this._focusDur = 150;
        this._scheduleNextRest();
    }

    setReducedMotion(v) {
        this.reducedMotion = v;
        if (v) this._clear();
    }

    _scheduleNextRest() {
        const gap = 4000 + Math.random() * 5000;
        this._nextRestAt = performance.now() + gap;
    }

    _clear() {
        this._restActive = false;
        this._focusActive = false;
        this.stack.setGlitchState({ strength: 0, tear: 0, slab: -1 });
    }

    onFocusChange(index) {
        if (this.reducedMotion) return;
        this._focusActive = true;
        this._focusT0 = performance.now();
        this._focusDur = 150;
        this.stack.setGlitchState({
            strength: 0.85,
            tear: 0.35,
            slab: index,
            rgb: 0.4
        });
        this.labels?.triggerFocusGlitch?.(index);
    }

    tick(now, { frozen = false, reducedMotion = false } = {}) {
        if (frozen || reducedMotion || this.reducedMotion) {
            this._clear();
            return;
        }

        if (this._focusActive) {
            const p = (now - this._focusT0) / this._focusDur;
            if (p >= 1) {
                this._focusActive = false;
                if (!this._restActive) {
                    this.stack.setGlitchState({ strength: 0, tear: 0, slab: -1, rgb: 0 });
                }
            } else {
                const pulse = 1 - p;
                this.stack.setGlitchState({
                    strength: 0.85 * pulse,
                    tear: 0.35 * pulse,
                    slab: this.stack.focusIndex,
                    rgb: 0.35 * pulse
                });
            }
        }

        if (!this._restActive && !this._focusActive && now >= this._nextRestAt) {
            this._restSlab = Math.floor(Math.random() * this.floorCount);
            this._restActive = true;
            this._restT0 = now;
            this._restDur = 120 + Math.random() * 80;
        }

        if (this._restActive) {
            const p = (now - this._restT0) / this._restDur;
            if (p >= 1) {
                this._restActive = false;
                this._scheduleNextRest();
                if (!this._focusActive) {
                    this.stack.setGlitchState({ strength: 0, tear: 0, slab: -1, rgb: 0 });
                }
            } else {
                const env = p < 0.5 ? p * 2 : (1 - p) * 2;
                this.stack.setGlitchState({
                    strength: 0.65 * env,
                    tear: 0.55 * env,
                    slab: this._restSlab,
                    rgb: 0.25 * env,
                    drop: 0.4 * env
                });
            }
        }
    }
}
