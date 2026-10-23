/**
 * CSS nova when WebGL composer not ready — never blocks transitions.
 */

export class NovaFallback {
    constructor(root = document.body) {
        this.el = document.createElement('div');
        this.el.id = 'nova-fallback';
        this.el.className = 'nova-fallback';
        this.el.innerHTML = '<div class="nova-line"></div><div class="nova-flash"></div>';
        this.el.hidden = true;
        root.appendChild(this.el);
        this.line = this.el.querySelector('.nova-line');
        this.flash = this.el.querySelector('.nova-flash');
    }

    /** @param {'collapse'|'nova'|'expand'|'hide'} phase */
    setPhase(phase, progress = 0) {
        if (phase === 'hide') {
            this.el.hidden = true;
            this.el.classList.remove('is-active');
            return;
        }
        this.el.hidden = false;
        this.el.classList.add('is-active');
        const p = Math.max(0, Math.min(1, progress));
        if (phase === 'collapse') {
            this.line.style.transform = `scaleY(${1 - p})`;
            this.line.style.opacity = String(0.4 + p * 0.6);
        } else if (phase === 'nova') {
            this.flash.style.opacity = String(p * (1 - p * 0.5));
            this.flash.style.transform = `scale(${0.5 + p * 1.2})`;
        } else if (phase === 'expand') {
            this.line.style.transform = `scaleY(${p}) scaleX(${0.2 + p * 0.8})`;
        }
    }

    burst(durationMs = 200) {
        this.setPhase('nova', 0.5);
        return new Promise((resolve) => {
            setTimeout(() => {
                this.setPhase('hide');
                resolve();
            }, durationMs);
        });
    }
}
