/**
 * Corridor HUD — active painting label, prev/next, end / back to stack.
 */

export class CorridorHud {
    constructor({ onPrev, onNext, onBackToStart, onBackStack }) {
        this.onPrev = onPrev;
        this.onNext = onNext;
        this.onBackToStart = onBackToStart;
        this.onBackStack = onBackStack;

        this.el = document.createElement('div');
        this.el.id = 'corridor-hud';
        this.el.className = 'corridor-hud';
        this.el.hidden = true;
        this.el.innerHTML = `
            <p class="corridor-active-label" aria-live="polite"></p>
            <p class="corridor-tap-hint" hidden>tap to view</p>
            <button type="button" class="corridor-walk-back" aria-label="Walk back">‹</button>
            <button type="button" class="corridor-walk-forward" aria-label="Walk forward">›</button>
            <p class="corridor-end-label" hidden>—— end / back to stack</p>
            <button type="button" class="corridor-back-start" hidden>back to start</button>
        `;
        document.body.appendChild(this.el);

        this.labelEl = this.el.querySelector('.corridor-active-label');
        this.tapHint = this.el.querySelector('.corridor-tap-hint');
        this.walkBack = this.el.querySelector('.corridor-walk-back');
        this.walkForward = this.el.querySelector('.corridor-walk-forward');
        this.endLabel = this.el.querySelector('.corridor-end-label');
        this.backStart = this.el.querySelector('.corridor-back-start');
        this._hintHidden = false;

        try {
            this._hintHidden = localStorage.getItem('corridor-tap-hint-seen') === '1';
        } catch (e) {}

        this.walkBack?.addEventListener('click', () => this.onPrev());
        this.walkForward?.addEventListener('click', () => this.onNext());
        this.backStart?.addEventListener('click', () => this.onBackToStart());
    }

    setVisible(v) {
        this.el.hidden = !v;
    }

    markTapSeen() {
        this._hintHidden = true;
        try {
            localStorage.setItem('corridor-tap-hint-seen', '1');
        } catch (e) {}
        if (this.tapHint) this.tapHint.hidden = true;
    }

    update({ title, atEnd, atStart, atEndIndex }) {
        this.labelEl.textContent = title ? `—— ${title}` : '';
        this.endLabel.hidden = !atEnd;
        this.backStart.hidden = !atEnd;
        if (this.tapHint) this.tapHint.hidden = this._hintHidden || !title;
        if (this.walkBack) this.walkBack.hidden = !!atStart;
        if (this.walkForward) this.walkForward.hidden = !!atEndIndex;
    }
}
