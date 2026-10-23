/**
 * Adaptive DPR, datamosh disable, glass blur tier.
 */

export class Quality {
    constructor(renderer, options = {}) {
        this.renderer = renderer;
        this.isMobile = options.isMobile ?? false;
        this.maxDpr = this.isMobile ? 1.5 : 2;
        this.minDpr = 0.75;
        this.dpr = Math.min(window.devicePixelRatio, this.maxDpr);
        this.samples = [];
        this.sampleUntil = performance.now() + 3000;
        this.datamoshAllowed = true;
        this.glassBlurAllowed = this.supportsGlass();
        this.onDatamoshChange = options.onDatamoshChange ?? (() => {});
        this.onGlassChange = options.onGlassChange ?? (() => {});
    }

    supportsGlass() {
        if (typeof CSS === 'undefined' || !CSS.supports) return true;
        return CSS.supports('backdrop-filter', 'blur(1px)');
    }

    applyDpr() {
        this.renderer.setPixelRatio(this.dpr);
    }

    dropGlassTier() {
        if (!this.glassBlurAllowed) return;
        this.glassBlurAllowed = false;
        document.documentElement.classList.add('no-glass-blur');
        this.onGlassChange(false);
    }

    recordFrame(ms) {
        if (performance.now() > this.sampleUntil) return;
        this.samples.push(ms);
        if (this.samples.length < 30) return;

        const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
        if (avg > 22) {
            if (this.dpr > this.minDpr) {
                this.dpr = Math.max(this.minDpr, this.dpr - 0.25);
                this.applyDpr();
            }
            if (this.datamoshAllowed) {
                this.datamoshAllowed = false;
                this.onDatamoshChange(false);
            }
            this.dropGlassTier();
        }
    }
}
