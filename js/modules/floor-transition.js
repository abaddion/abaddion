/**
 * Nova collapse open/close — InteractionState + fullscreen floor views.
 */

import { InteractionStates } from './interaction-state.js';

const TILT_MS = 150;
const COLLAPSE_MS = 180;
const NOVA_MS = 200;
const EXPAND_MS = 250;
const REDUCED_FADE_MS = 200;

export class FloorTransition {
    constructor({
        interactionState,
        stack,
        postProcessing,
        floorView,
        cameraRig,
        reducedMotion,
        onActivity,
        novaFallback,
        onFloorOpen,
        onFloorClose
    }) {
        this.state = interactionState;
        this.stack = stack;
        this.postProcessing = postProcessing;
        this.floorView = floorView;
        this.cameraRig = cameraRig;
        this.reducedMotion = reducedMotion;
        this.onActivity = onActivity;
        this.novaFallback = novaFallback;
        this.onFloorOpen = onFloorOpen ?? (() => {});
        this.onFloorClose = onFloorClose ?? (() => {});

        this.t0 = 0;
        this.phase = 'idle';
        this.openRotationTarget = -Math.PI / 2 + 0.12;
    }

    isOpen() {
        return this.state.isOpen();
    }

    isAnimating() {
        return this.state.isTransitioning();
    }

    safeNova(progress, center = [0.5, 0.5]) {
        if (this.phase !== 'nova' && this.phase !== 'close-nova') return;
        try {
            this.postProcessing?.fireNova?.(progress, center);
        } catch {
            /* ignore */
        }
        this.novaFallback?.setPhase('nova', progress);
    }

    clearNova() {
        try {
            this.postProcessing?.clearNova?.();
        } catch {
            /* ignore */
        }
        this.novaFallback?.setPhase('hide');
        document.documentElement.classList.remove('nova-transition');
    }

    interruptToFocus(focusIndex) {
        this.phase = 'idle';
        this.stack.resetFloorVisuals();
        this.stack.setContentCollapse(1);
        this.floorView.hideActive(true);
        this.clearNova();
        this.onFloorClose();
        this.state.set(InteractionStates.FOCUS, focusIndex);
        this.cameraRig.setFocus(focusIndex);
        this.t0 = 0;
    }

    open(index) {
        this.onActivity();
        if (this.state.isOpen() && this.state.floorIndex === index) return;

        if (this.state.isTransitioning() || this.state.isOpen()) {
            this.interruptToFocus(this.state.floorIndex);
        }

        this.state.set(InteractionStates.OPENING, index);
        this.t0 = performance.now();
        this.phase = this.reducedMotion ? 'expand' : 'tilt';
        this.cameraRig.setOpen(index);
        this.stack.setContentCollapse(1);

        if (this.reducedMotion) {
            this.floorView.showFloor(index, { progress: 1, reduced: true });
            this.finishOpenVisual(index);
            return;
        }
    }

    close() {
        if (!this.state.isOpen() && this.state.state !== InteractionStates.OPENING) {
            if (this.state.isTransitioning()) this.interruptToFocus(this.state.floorIndex);
            return;
        }

        this.onActivity();
        const index = this.state.floorIndex;
        this.state.set(InteractionStates.CLOSING, index);
        this.t0 = performance.now();
        this.phase = this.reducedMotion ? 'fade' : 'close-collapse';

        if (this.reducedMotion) {
            this.floorView.hideActive(true);
            setTimeout(() => this.finishClose(), REDUCED_FADE_MS);
            return;
        }
    }

    finishClose() {
        this.stack.resetFloorVisuals();
        this.stack.setContentCollapse(1);
        this.clearNova();
        this.floorView.hideActive(false);
        this.onFloorClose();
        const idx = this.state.floorIndex;
        this.cameraRig.setFocus(idx);
        this.state.set(InteractionStates.FOCUS, idx);
        this.phase = 'idle';
        this.t0 = 0;
    }

    finishOpenVisual(index) {
        this.stack.setFloorOpenRotation(index, this.openRotationTarget);
        this.stack.setContentCollapse(1);
        this.clearNova();
        this.state.set(InteractionStates.OPEN, index);
        this.onFloorOpen(index);
        this.phase = 'idle';
        this.t0 = 0;
    }

    forceOpenComplete(index) {
        this.floorView.showFloor(index, { progress: 1, instant: true });
        this.finishOpenVisual(index);
    }

    update(camera, now) {
        this.state.tickWatchdog((forced) => {
            if (forced.to === InteractionStates.OPEN) {
                this.forceOpenComplete(forced.floorIndex);
            } else {
                this.finishClose();
            }
        });

        if (!this.state.isTransitioning()) return this.state.isOpen();

        const elapsed = now - this.t0;
        const index = this.state.floorIndex;

        if (this.reducedMotion) return this.state.isTransitioning();

        if (this.state.state === InteractionStates.OPENING) {
            this._updateOpening(elapsed, index, camera);
            return true;
        }

        if (this.state.state === InteractionStates.CLOSING) {
            this._updateClosing(elapsed, index);
            return true;
        }

        return false;
    }

    _updateOpening(elapsed, index, camera) {
        let t = elapsed;
        if (this.phase === 'tilt') {
            const p = Math.min(1, t / TILT_MS);
            const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            this.stack.setFloorOpenRotation(index, this.openRotationTarget * eased);
            if (p >= 1) {
                this.phase = 'collapse';
                this.t0 = performance.now();
            }
            return;
        }

        t = performance.now() - this.t0;
        if (this.phase === 'collapse') {
            const p = Math.min(1, t / COLLAPSE_MS);
            this.stack.setContentCollapse(1 - p);
            this.novaFallback?.setPhase('collapse', p);
            if (p >= 1) {
                this.phase = 'nova';
                this.t0 = performance.now();
                this.safeNova(0.6);
            }
            return;
        }

        t = performance.now() - this.t0;
        if (this.phase === 'nova') {
            const p = Math.min(1, t / NOVA_MS);
            this.safeNova(p * (1 - p * 0.3));
            if (p >= 1) {
                this.phase = 'expand';
                this.t0 = performance.now();
                this.floorView.showFloor(index, { progress: 0, instant: true });
            }
            return;
        }

        t = performance.now() - this.t0;
        if (this.phase === 'expand') {
            const p = Math.min(1, t / EXPAND_MS);
            this.novaFallback?.setPhase('expand', p);
            this.floorView.showFloor(index, { progress: p, instant: true });
            if (p >= 0.98) this.novaFallback?.setPhase('hide');
            if (p >= 1) {
                this.finishOpenVisual(index);
            }
        }
    }

    _updateClosing(elapsed, index) {
        if (this.phase === 'close-collapse') {
            const p = Math.min(1, elapsed / EXPAND_MS);
            this.floorView.showFloor(index, { progress: 1 - p, instant: true });
            if (p >= 1) {
                this.phase = 'close-nova';
                this.t0 = performance.now();
                this.safeNova(0.35);
            }
            return;
        }

        const t = performance.now() - this.t0;
        if (this.phase === 'close-nova') {
            const p = Math.min(1, t / NOVA_MS);
            this.safeNova(0.35 * (1 - p));
            if (p >= 1) {
                this.phase = 'close-slab';
                this.t0 = performance.now();
                this.floorView.hideActive(false);
            }
            return;
        }

        const t2 = performance.now() - this.t0;
        if (this.phase === 'close-slab') {
            const p = Math.min(1, t2 / COLLAPSE_MS);
            this.stack.setContentCollapse(p);
            this.novaFallback?.setPhase('collapse', 1 - p);
            const tiltP = Math.min(1, t2 / TILT_MS);
            this.stack.setFloorOpenRotation(index, this.openRotationTarget * (1 - tiltP));
            if (p >= 1 && tiltP >= 1) this.finishClose();
        }
    }
}
