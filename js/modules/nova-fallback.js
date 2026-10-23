/**
 * CSS nova when WebGL composer not ready — removed from DOM after each transition.
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

    resetStyles() {
        this.line.style.transform = 'scaleY(0)';
        this.line.style.opacity = '0';
        this.flash.style.opacity = '0';
        this.flash.style.transform = 'scale(0.5)';
    }

    /** @param {'collapse'|'nova'|'expand'|'hide'} phase */
    setPhase(phase, progress = 0) {
        if (phase === 'hide') {
            this.resetStyles();
            this.el.hidden = true;
            this.el.classList.remove('is-active');
            document.documentElement.classList.remove('nova-transition');
            return;
        }
        document.documentElement.classList.add('nova-transition');
        this.el.hidden = false;
        this.el.classList.add('is-active');
        const p = Math.max(0, Math.min(1, progress));
        if (phase === 'collapse') {
            this.line.style.opacity = String(0.35 + p * 0.65);
            this.line.style.transform = `scaleY(${Math.max(0.001, 1 - p)})`;
            this.flash.style.opacity = '0';
        } else if (phase === 'nova') {
            this.line.style.opacity = String(Math.max(0, 1 - p * 1.2));
            this.line.style.transform = 'scaleY(0.001)';
            this.flash.style.opacity = String(p * (1 - p * 0.45));
            this.flash.style.transform = `scale(${0.4 + p * 1.4})`;
        } else if (phase === 'expand') {
            this.line.style.opacity = '0';
            this.line.style.transform = 'scaleY(0.001)';
            this.flash.style.opacity = String(Math.max(0, 0.35 * (1 - p)));
            this.flash.style.transform = `scale(${1 + p * 0.5})`;
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
