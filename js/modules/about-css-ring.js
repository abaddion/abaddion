/**
 * About floor — CSS 3D text ring (DOM only, no canvas texture).
 */

import { aboutCrawlLoopSeconds } from './about-crawl-speed.js';

const R_MOBILE = 220;
const R_DESKTOP = 280;

export class AboutCssRing {
    /**
     * @param {HTMLElement} host
     * @param {{ lines: string[], onFirstLoopComplete?: () => void, reducedMotion?: boolean }} opts
     */
    constructor(host, opts) {
        this.host = host;
        this.lines = opts.lines ?? [];
        this.onFirstLoopComplete = opts.onFirstLoopComplete ?? (() => {});
        this.reducedMotion = opts.reducedMotion ?? false;
        this.loopSec = aboutCrawlLoopSeconds({ paragraphs: this.lines });
        this.ringDeg = 0;
        this.auto = true;
        this.paused = false;
        this.resumeTimer = null;
        this.firstLoopDone = false;
        this.raf = null;
        this._lastTs = 0;
        this._onResize = () => this.relayout();
    }

    mount() {
        this.host.innerHTML = `
            <div class="about-css-ring-stage" aria-live="off">
                <div class="about-css-ring"></div>
            </div>`;
        this.stage = this.host.querySelector('.about-css-ring-stage');
        this.ring = this.host.querySelector('.about-css-ring');
        window.addEventListener('resize', this._onResize);
        this.relayout();
        if (!this.reducedMotion) this.start();
    }

    setLines(lines) {
        this.lines = lines;
        this.loopSec = aboutCrawlLoopSeconds({ paragraphs: lines });
        this.relayout();
    }

    wrapLines(rawLines, maxWidth) {
        const probe = document.createElement('div');
        probe.className = 'about-css-ring-measure';
        probe.style.cssText = `position:fixed;left:-9999px;width:${maxWidth}px;visibility:hidden`;
        document.body.appendChild(probe);
        const out = [];
        for (const raw of rawLines) {
            const words = raw.split(/\s+/).filter(Boolean);
            let row = '';
            for (const w of words) {
                const next = row ? `${row} ${w}` : w;
                probe.textContent = next;
                if (probe.scrollWidth > maxWidth && row) {
                    out.push(row);
                    row = w;
                } else row = next;
            }
            if (row) out.push(row);
        }
        probe.remove();
        return out.length ? out : [''];
    }

    relayout() {
        if (!this.ring) return;
        const mobile = window.innerWidth < 768;
        const R = mobile ? R_MOBILE : R_DESKTOP;
        const maxW = Math.min(320, window.innerWidth - 48);
        const wrapped = this.wrapLines(this.lines, maxW);
        const step = 360 / Math.max(wrapped.length, 1);
        this.ring.replaceChildren();
        wrapped.forEach((text, i) => {
            const el = document.createElement('p');
            el.className = 'about-css-ring-line';
            el.textContent = text;
            el.style.setProperty('--line-i', String(i));
            el.style.setProperty('--line-angle', `${i * step}deg`);
            el.style.setProperty('--ring-r', `${R}px`);
            this.ring.appendChild(el);
        });
        this.stepDeg = step;
        this._applyRing();
    }

    _degPerSec() {
        return 360 / Math.max(this.loopSec, 8);
    }

    _applyRing() {
        if (!this.ring) return;
        this.ring.style.transform = `rotateX(${this.ringDeg}deg)`;
    }

    start() {
        this.stop();
        if (this.reducedMotion) return;
        this._lastTs = performance.now();
        const tick = (ts) => {
            const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
            this._lastTs = ts;
            if (!this.paused && this.auto) {
                const prev = this.ringDeg;
                this.ringDeg += this._degPerSec() * dt;
                if (!this.firstLoopDone && prev < 360 && this.ringDeg >= 360) {
                    this.firstLoopDone = true;
                    this.onFirstLoopComplete();
                }
                this.ringDeg %= 360;
                this._applyRing();
            }
            this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
    }

    stop() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
    }

    onWheel(deltaY) {
        if (this.reducedMotion) return false;
        this.auto = false;
        this.paused = false;
        clearTimeout(this.resumeTimer);
        this.ringDeg += deltaY * 0.14;
        this.ringDeg %= 360;
        this._applyRing();
        this.resumeTimer = setTimeout(() => {
            this.auto = true;
        }, 2000);
        return true;
    }

    togglePause() {
        if (this.reducedMotion) return;
        this.paused = !this.paused;
        clearTimeout(this.resumeTimer);
        if (!this.paused) {
            this.resumeTimer = setTimeout(() => {
                this.auto = true;
            }, 2000);
        }
    }

    /** @returns {string} first line likely visible at bottom front */
    visibleLineHint() {
        if (!this.ring) return '';
        const lines = [...this.ring.querySelectorAll('.about-css-ring-line')];
        if (!lines.length) return '';
        const idx = Math.floor(((360 - (this.ringDeg % 360)) / (this.stepDeg || 1)) % lines.length);
        return lines[idx]?.textContent?.slice(0, 80) ?? '';
    }

    destroy() {
        this.stop();
        clearTimeout(this.resumeTimer);
        window.removeEventListener('resize', this._onResize);
        this.host?.replaceChildren();
    }
}
