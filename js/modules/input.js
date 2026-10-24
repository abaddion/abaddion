/**
 * Floor navigation — wheel, trackpad, touch, keyboard; corridor walk + tap.
 */

export class FloorInput {
    constructor(options) {
        this.getFocusIndex = options.getFocusIndex;
        this.getFloorCount = options.getFloorCount;
        this.onFloorChange = options.onFloorChange;
        this.onOpen = options.onOpen;
        this.onClose = options.onClose;
        this.isOpen = options.isOpen;
        this.isTransitioning = options.isTransitioning ?? (() => false);
        this.onActivity = options.onActivity;
        this.onCancelTransition = options.onCancelTransition;
        this.isCorridorActive = options.isCorridorActive ?? (() => false);
        this.isDetailOpen = options.isDetailOpen ?? (() => false);
        this.onCorridorScroll = options.onCorridorScroll ?? (() => {});
        this.onCorridorStep = options.onCorridorStep ?? (() => {});
        this.onCorridorTap = options.onCorridorTap ?? (() => {});
        this.onAboutWheel = options.onAboutWheel ?? (() => false);
        this.isAboutOpen = options.isAboutOpen ?? (() => false);
        this.canvas = options.canvas;
        this.cardsRoot = options.cardsRoot ?? document.getElementById('cards');

        this.wheelAccum = 0;
        this.wheelIdleTimer = null;
        this.wheelGestureLocked = false;
        this.touchStartY = null;
        this.touchStartX = null;
        this.edgeScrollArmed = false;
        this.pointerDown = null;

        this.bind();
    }

    bind() {
        window.addEventListener(
            'wheel',
            (e) => {
                this.onActivity();
                if (this.isDetailOpen()) return;
                if (this.isCorridorActive()) {
                    e.preventDefault();
                    this.onCorridorScroll(e.deltaY);
                    return;
                }
                if (this.isOpen()) {
                    if (this.isAboutOpen() && this.onAboutWheel(e.deltaY)) {
                        e.preventDefault();
                        return;
                    }
                    this.handleWheelOpen(e);
                    return;
                }
                if (this.isTransitioning()) {
                    this.onCancelTransition?.();
                }
                this.handleWheelFocus(e);
            },
            { passive: false }
        );

        this.canvas?.addEventListener(
            'pointerdown',
            (e) => {
                this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
                this.onActivity();
            },
            { passive: true }
        );

        this.canvas?.addEventListener(
            'pointerup',
            (e) => {
                if (!this.pointerDown) return;
                const dx = e.clientX - this.pointerDown.x;
                const dy = e.clientY - this.pointerDown.y;
                const dt = performance.now() - this.pointerDown.t;
                this.pointerDown = null;

                if (this.isCorridorActive()) {
                    if (Math.hypot(dx, dy) < 10 && dt < 300) {
                        e.preventDefault();
                        this.onCorridorTap(e.clientX, e.clientY);
                    } else if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
                        this.onCorridorScroll(dy);
                    }
                    return;
                }

                if (this.isOpen() || this.isDetailOpen()) return;
                if (Math.abs(dy) < 40 && Math.hypot(dx, dy) < 10) {
                    this.tryOpenFromClick();
                }
            },
            { passive: false }
        );

        this.canvas?.addEventListener(
            'touchstart',
            (e) => {
                this.touchStartY = e.touches[0].clientY;
                this.touchStartX = e.touches[0].clientX;
                this.onActivity();
            },
            { passive: true }
        );

        this.canvas?.addEventListener(
            'touchend',
            (e) => {
                if (this.touchStartY == null) return;
                const dy = e.changedTouches[0].clientY - this.touchStartY;
                const dx = e.changedTouches[0].clientX - (this.touchStartX ?? 0);
                this.touchStartY = null;
                this.touchStartX = null;

                if (this.isCorridorActive()) {
                    // Tap → pointerup (Pointer Events). Touchend only handles swipe scroll.
                    if (Math.hypot(dx, dy) >= 12) {
                        this.onCorridorScroll(dy);
                    }
                    return;
                }

                if (this.isOpen()) {
                    this.handleSwipeOpen(dy);
                    return;
                }
                if (Math.abs(dy) < 40) {
                    this.tryOpenFromClick();
                    return;
                }
                if (this.isTransitioning()) this.onCancelTransition?.();
                this.changeFloor(dy < 0 ? 1 : -1);
            },
            { passive: true }
        );

        this.canvas?.addEventListener('click', (e) => {
            this.onActivity();
            if (this.isCorridorActive() || this.isOpen()) return;
            if (this.isTransitioning()) this.onCancelTransition?.();
            this.tryOpenFromClick();
        });

        this.cardsRoot?.addEventListener('click', (e) => {
            if (e.target === this.cardsRoot || e.target.classList?.contains('cards-root')) {
                this.onClose();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.isOpen()) {
                    e.preventDefault();
                    this.onClose();
                }
                return;
            }
            if (this.isCorridorActive()) {
                if (e.code === 'ArrowLeft') {
                    e.preventDefault();
                    this.onCorridorStep(-1);
                } else if (e.code === 'ArrowRight') {
                    e.preventDefault();
                    this.onCorridorStep(1);
                }
                return;
            }
            if (e.code === 'Enter') {
                if (!this.isOpen()) {
                    e.preventDefault();
                    this.onOpen(this.getFocusIndex());
                }
                return;
            }
            if (this.isOpen()) return;
            if (this.isTransitioning()) this.onCancelTransition?.();

            const up = ['ArrowUp', 'PageUp'];
            const down = ['ArrowDown', 'PageDown'];
            if (up.includes(e.code)) {
                e.preventDefault();
                this.changeFloor(-1);
            } else if (down.includes(e.code)) {
                e.preventDefault();
                this.changeFloor(1);
            }
        });
    }

    handleWheelFocus(e) {
        this.wheelAccum += e.deltaY;
        clearTimeout(this.wheelIdleTimer);
        this.wheelIdleTimer = setTimeout(() => {
            this.flushWheelFocus();
        }, 150);
    }

    flushWheelFocus() {
        if (this.wheelGestureLocked) return;
        if (Math.abs(this.wheelAccum) < 80) {
            this.wheelAccum = 0;
            return;
        }
        const dir = this.wheelAccum > 0 ? 1 : -1;
        this.wheelAccum = 0;
        this.wheelGestureLocked = true;
        setTimeout(() => {
            this.wheelGestureLocked = false;
        }, 400);
        this.changeFloor(dir);
    }

    handleWheelOpen(e) {
        const card = this.cardsRoot?.querySelector('.floor-card.is-open .floor-view-scroll');
        if (!card) {
            e.preventDefault();
            this.onClose();
            this.changeFloor(e.deltaY > 0 ? 1 : -1);
            return;
        }

        const atTop = card.scrollTop <= 0;
        const atBottom = card.scrollTop + card.clientHeight >= card.scrollHeight - 2;
        const scrollingDown = e.deltaY > 0;
        const scrollingUp = e.deltaY < 0;

        if ((scrollingDown && atBottom) || (scrollingUp && atTop)) {
            if (!this.edgeScrollArmed) {
                this.edgeScrollArmed = true;
                e.preventDefault();
                return;
            }
            e.preventDefault();
            this.edgeScrollArmed = false;
            this.onClose();
            this.changeFloor(scrollingDown ? 1 : -1);
            return;
        }

        this.edgeScrollArmed = false;
    }

    handleSwipeOpen(dy) {
        const card = this.cardsRoot?.querySelector('.floor-card.is-open .floor-view-scroll');
        if (!card) return;
        const atTop = card.scrollTop <= 0;
        const atBottom = card.scrollTop + card.clientHeight >= card.scrollHeight - 2;
        if (dy < -40 && atBottom) {
            this.onClose();
            this.changeFloor(1);
        } else if (dy > 40 && atTop) {
            this.onClose();
            this.changeFloor(-1);
        }
    }

    changeFloor(delta) {
        const count = this.getFloorCount();
        const next = Math.max(0, Math.min(count - 1, this.getFocusIndex() + delta));
        if (next !== this.getFocusIndex()) {
            this.onFloorChange(next);
        }
    }

    tryOpenFromClick() {
        if (this.isOpen()) return;
        this.onOpen(this.getFocusIndex());
    }
}
