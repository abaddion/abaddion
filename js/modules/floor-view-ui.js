/**
 * Opened floor DOM effects — glitch heading, stagger, tune-in media, parallax, tilt.
 */

export class FloorViewUI {
    /**
     * @param {HTMLElement} section
     * @param {{ reducedMotion?: boolean }} opts
     */
    constructor(section, opts = {}) {
        this.section = section;
        this.reducedMotion =
            opts.reducedMotion ?? document.documentElement.classList.contains('reduce-motion');
        this._io = null;
        this._onScroll = this._onScroll.bind(this);
    }

    activate() {
        const immersive = this.section.classList.contains('floor-view--immersive');
        if (!immersive) {
            this._headingGlitch();
            this._staggerTiles();
            this._wireMediaTuneIn();
            this._wireTileTilt();
            this._wireParallax();
        }
        const scroll = this.section.querySelector('.floor-view-scroll') ?? this.section;
        scroll.removeEventListener('scroll', this._onScroll);
        scroll.addEventListener('scroll', this._onScroll, { passive: true });
    }

    deactivate() {
        const scroll = this.section.querySelector('.floor-view-scroll') ?? this.section;
        scroll.removeEventListener('scroll', this._onScroll);
        this._io?.disconnect();
        this._io = null;
    }

    _headingGlitch() {
        if (this.reducedMotion) return;
        const h = this.section.querySelector('.floor-heading-reveal');
        if (!h) return;
        h.classList.remove('is-glitching');
        void h.offsetWidth;
        h.classList.add('is-glitching');
        setTimeout(() => h.classList.remove('is-glitching'), 260);
    }

    _staggerTiles() {
        const tiles = this.section.querySelectorAll('.floor-tile');
        tiles.forEach((el, i) => el.style.setProperty('--tile-i', String(i)));
        if (this.reducedMotion) {
            tiles.forEach((el) => el.classList.add('is-tile-visible'));
            return;
        }
        this.section.classList.remove('is-tiles-ready');
        requestAnimationFrame(() => this.section.classList.add('is-tiles-ready'));
    }

    _wireMediaTuneIn() {
        if (this.section.dataset.floorId === 'canvas') return;
        const imgs = this.section.querySelectorAll('.floor-tile-media img, .code-shot');
        if (!imgs.length) return;
        if (this.reducedMotion) {
            imgs.forEach((img) => img.classList.add('is-sharp'));
            return;
        }
        imgs.forEach((img) => {
            img.classList.add('tune-in-pending');
            img.addEventListener(
                'load',
                () => {
                    if (!img.classList.contains('tune-in-pending')) return;
                },
                { once: true }
            );
        });
        this._io = new IntersectionObserver(
            (entries) => {
                for (const ent of entries) {
                    if (!ent.isIntersecting) continue;
                    const img = ent.target;
                    img.classList.remove('tune-in-pending');
                    requestAnimationFrame(() => img.classList.add('is-sharp'));
                    this._io?.unobserve(img);
                }
            },
            { root: this.section, threshold: 0.2 }
        );
        imgs.forEach((img) => this._io.observe(img));
    }

    _wireTileTilt() {
        if (this.reducedMotion || window.innerWidth < 769) return;
        this.section.querySelectorAll('.floor-tile--tilt').forEach((tile) => {
            tile.addEventListener('pointermove', (e) => {
                const r = tile.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - 0.5;
                const py = (e.clientY - r.top) / r.height - 0.5;
                tile.style.setProperty('--tilt-x', `${-py * 6}deg`);
                tile.style.setProperty('--tilt-y', `${px * 6}deg`);
            });
            tile.addEventListener('pointerleave', () => {
                tile.style.setProperty('--tilt-x', '0deg');
                tile.style.setProperty('--tilt-y', '0deg');
            });
        });
    }

    _wireParallax() {
        if (this.reducedMotion) return;
    }

    _onScroll() {
        if (this.reducedMotion) return;
        const scroll = this.section.querySelector('.floor-view-scroll') ?? this.section;
        const depth = Math.min(8, scroll.scrollTop * 0.04);
        const frame = this.section.querySelector('.floor-view-parallax-frame');
        const content = this.section.querySelector('.floor-view-parallax-content');
        if (frame) frame.style.transform = `translate3d(0, ${depth * 0.35}px, 0)`;
        if (content) content.style.transform = `translate3d(0, ${-depth * 0.25}px, 0)`;
    }
}
