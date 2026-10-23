/**
 * Single source of truth: BOOT → FOCUS → OPENING → OPEN → CLOSING
 */

export const InteractionStates = {
    BOOT: 'boot',
    FOCUS: 'focus',
    OPENING: 'opening',
    OPEN: 'open',
    CLOSING: 'closing'
};

const WATCHDOG_MS = 1500;

export class InteractionState {
    constructor() {
        this.state = InteractionStates.BOOT;
        this.floorIndex = 0;
        this.since = performance.now();
    }

    set(state, floorIndex = this.floorIndex) {
        this.state = state;
        this.floorIndex = floorIndex;
        this.since = performance.now();
    }

    isTransitioning() {
        return (
            this.state === InteractionStates.OPENING || this.state === InteractionStates.CLOSING
        );
    }

    isOpen() {
        return this.state === InteractionStates.OPEN;
    }

    isFocus() {
        return this.state === InteractionStates.FOCUS;
    }

    ageMs() {
        return performance.now() - this.since;
    }

    /**
     * @param {(forced: { from: string, to: string, floorIndex: number }) => void} onForce
     */
    tickWatchdog(onForce) {
        if (!this.isTransitioning()) return;
        if (this.ageMs() < WATCHDOG_MS) return;
        const from = this.state;
        console.warn('[interaction watchdog] forcing end state', {
            from,
            floorIndex: this.floorIndex,
            ageMs: Math.round(this.ageMs())
        });
        if (from === InteractionStates.OPENING) {
            this.set(InteractionStates.OPEN, this.floorIndex);
            onForce({ from, to: InteractionStates.OPEN, floorIndex: this.floorIndex });
        } else if (from === InteractionStates.CLOSING) {
            this.set(InteractionStates.FOCUS, this.floorIndex);
            onForce({ from, to: InteractionStates.FOCUS, floorIndex: this.floorIndex });
        }
    }
}
