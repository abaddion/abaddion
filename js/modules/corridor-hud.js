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
            <div class="corridor-nav">
                <button type="button" class="corridor-prev" aria-label="Previous painting">‹</button>
                <button type="button" class="corridor-next" aria-label="Next painting">›</button>
            </div>
            <p class="corridor-end-label" hidden>—— end / back to stack</p>
            <button type="button" class="corridor-back-start" hidden>back to start</button>
        `;
        document.body.appendChild(this.el);

        this.labelEl = this.el.querySelector('.corridor-active-label');
        this.endLabel = this.el.querySelector('.corridor-end-label');
        this.backStart = this.el.querySelector('.corridor-back-start');

        this.el.querySelector('.corridor-prev')?.addEventListener('click', () => this.onPrev());
        this.el.querySelector('.corridor-next')?.addEventListener('click', () => this.onNext());
        this.backStart?.addEventListener('click', () => this.onBackToStart());
    }

    setVisible(v) {
        this.el.hidden = !v;
    }

    update({ title, atEnd }) {
        this.labelEl.textContent = title ? `—— ${title}` : '';
        this.endLabel.hidden = !atEnd;
        this.backStart.hidden = !atEnd;
    }
}
