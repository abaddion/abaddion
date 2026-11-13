/**
 * About floor — CSS 3D ring crawl or flat text; SEO copy always in DOM.
 */

import { isWebGLReady } from './webgl-readiness.js';
import { aboutCrawlLoopSeconds, aboutFlatPixelsPerSecond } from './about-crawl-speed.js';
import { AboutCssRing } from './about-css-ring.js';

/** @returns {boolean} Force flat HTML crawl (?about=flat) */
export function resolveAboutFlatFromUrl(location = globalThis.location) {
    const params = new URLSearchParams(location?.search ?? '');
    const flag = (params.get('about') ?? '').toLowerCase();
    return flag === 'flat' || flag === 'text';
}

export class AboutCrawl {
    constructor(root, options = {}) {
        this.root = root;
        this.body = options.body ?? '';
        this.paragraphs = options.paragraphs?.length
            ? options.paragraphs
            : this.body.split(/\n\n+/).filter(Boolean);
        this.byline = options.byline ?? '';
        this.ctaLinks = options.ctaLinks ?? [];
        this.closingLine = options.closingLine ?? '';
        this.reducedMotion =
            options.reducedMotion ??
            document.documentElement.classList.contains('reduce-motion');
        this.allowRing = options.startInSphere !== false;
        const forceFlat = resolveAboutFlatFromUrl();
        this.userChoseFlat = forceFlat;
        this.flat =
            forceFlat ||
            this.reducedMotion ||
            !this.allowRing ||
            document.documentElement.classList.contains('no-webgl');

        this.offset = 0;
        this.auto = true;
        this.paused = false;
        this.resumeTimer = null;
        this.raf = null;
        this.tailRevealed = false;
        this.flatPxPerSec = 32;
        this._autoLastTs = 0;
        this.ring = null;
        this.onWheel = this.onWheel.bind(this);
    }

    _lineSources() {
        const lines = [];
        if (this.byline) lines.push(this.byline);
        lines.push(...this.paragraphs);
        return lines;
    }

    mount() {
        this.root.innerHTML = `
            <div class="about-crawl-scene${this.flat ? ' is-flat' : ' is-ring'}">
                <div class="about-seo-copy visually-hidden" aria-hidden="true">${this._copyHtml()}${this._tailHtml()}</div>
                <div class="about-crawl-perspective about-crawl-flat-panel${this.flat ? '' : ' hidden'}">
                    <div class="about-crawl-block">
                        <div class="about-crawl-copy">${this._copyHtml()}</div>
                    </div>
                </div>
                <div class="about-css-ring-host${this.flat ? ' hidden' : ''}"></div>
                <div class="about-tail-dock">
                    <div class="about-crawl-form-slot">
                        <div class="about-crawl-tail about-tail-panel">${this._tailHtml()}</div>
                    </div>
                </div>
                <button type="button" class="about-read-toggle">${this.flat ? 'inside the ring' : 'read as text'}</button>
            </div>`;

        this.scene = this.root.querySelector('.about-crawl-scene');
        this.flatPanel = this.root.querySelector('.about-crawl-flat-panel');
        this.ringHost = this.root.querySelector('.about-css-ring-host');
        this.toggle = this.root.querySelector('.about-read-toggle');
        this.formSlot = this.root.querySelector('.about-crawl-form-slot');
        this.tail = this.root.querySelector('.about-crawl-tail');

        this.toggle?.addEventListener('click', () => this.setFlat(!this.flat, { user: true }));
        this.scene?.addEventListener('click', (e) => {
            if (e.target.closest('button, input, textarea, a, label')) return;
            if (!this.flat && this.ring) {
                this.ring.togglePause();
                this.paused = !this.paused;
            } else if (this.flat && !this.reducedMotion) {
                this.paused = !this.paused;
            }
        });

        if (this.flat) {
            this._bootFlat();
        } else {
            this._bootRing();
        }
    }

    _bootFlat() {
        document.documentElement.classList.remove('about-ring-active');
        this._refreshFlatSpeed();
        this.scene?.classList.add('tail-visible');
        if (this.reducedMotion) {
            this.formSlot?.classList.add('is-settled');
        } else {
            this.formSlot?.classList.remove('is-settled');
            this.startAuto();
        }
    }

    _bootRing() {
        document.documentElement.classList.add('about-ring-active');
        this.ring = new AboutCssRing(this.ringHost, {
            lines: this._lineSources(),
            reducedMotion: this.reducedMotion,
            onFirstLoopComplete: () => this.onFirstRingLoopComplete()
        });
        this.ring.mount();
        this.scene?.classList.remove('tail-visible');
        window.app?.webgl?.setAboutRingMode?.(true);
    }

    _copyHtml() {
        const parts = [];
        if (this.byline) {
            parts.push(`<p class="about-crawl-byline">${escapeHtml(this.byline)}</p>`);
        }
        for (const para of this.paragraphs) {
            parts.push(`<p>${escapeHtml(para)}</p>`);
        }
        return parts.join('');
    }

    _tailHtml() {
        const lines = [];
        for (const cta of this.ctaLinks) {
            lines.push(
                `<p class="about-crawl-cta">${escapeHtml(cta.lead)} <a href="${escapeHtml(cta.href)}">→ ${escapeHtml(cta.label)}</a></p>`
            );
        }
        if (this.closingLine) {
            lines.push(`<p class="about-crawl-closing">${escapeHtml(this.closingLine)}</p>`);
        }
        return lines.join('');
    }

    attachForm(formEl) {
        if (!formEl || !this.formSlot) return;
        formEl.classList.add('about-contact-form');
        this.formSlot.appendChild(formEl);
    }

    onFirstRingLoopComplete() {
        this.tailRevealed = true;
        this.scene?.classList.add('tail-visible');
    }

    tryPromoteToSphere() {
        /* WebGL text band removed — no-op for boot compatibility. */
    }

    setFlat(flat, opts = {}) {
        if (opts.user) this.userChoseFlat = flat;
        if (flat === this.flat) return;
        this.flat = flat;
        this.ring?.destroy();
        this.ring = null;
        this.stopAuto();
        this.scene?.classList.toggle('is-flat', flat);
        this.scene?.classList.toggle('is-ring', !flat);
        this.flatPanel?.classList.toggle('hidden', !flat);
        this.ringHost?.classList.toggle('hidden', flat);
        if (this.toggle) {
            this.toggle.textContent = flat ? 'inside the ring' : 'read as text';
        }
        if (flat) {
            window.app?.webgl?.setAboutRingMode?.(false);
            this._bootFlat();
        } else {
            this._bootRing();
        }
    }

    onWheel(deltaY) {
        if (!this.flat && this.ring) return this.ring.onWheel(deltaY);
        if (this.reducedMotion) return false;
        this.auto = false;
        this.paused = false;
        clearTimeout(this.resumeTimer);
        this.offset += deltaY * 0.15;
        this._applyOffset();
        this.resumeTimer = setTimeout(() => {
            this.auto = true;
        }, 2000);
        return true;
    }

    _refreshFlatSpeed() {
        const block = this.flatPanel?.querySelector('.about-crawl-block');
        const copy = { byline: this.byline, paragraphs: this.paragraphs };
        const loopSec = aboutCrawlLoopSeconds(copy);
        const max = Math.max(2400, block?.scrollHeight ? block.scrollHeight * 0.85 : 2400);
        this.flatPxPerSec = aboutFlatPixelsPerSecond(max, loopSec);
    }

    startAuto() {
        this.stopAuto();
        if (!this.flat || this.reducedMotion) return;
        this._autoLastTs = performance.now();
        const tick = (ts) => {
            const dt = Math.min(0.05, (ts - this._autoLastTs) / 1000);
            this._autoLastTs = ts;
            if (!this.paused && this.auto) {
                this.offset += this.flatPxPerSec * dt;
                this._applyOffset();
            }
            this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
    }

    stopAuto() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
    }

    _applyOffset() {
        if (this.reducedMotion) return;
        const block = this.flatPanel?.querySelector('.about-crawl-block');
        if (!block) return;
        const max = Math.max(2400, block.scrollHeight * 0.85);
        this.offset = Math.max(-200, Math.min(max, this.offset));
        block.style.transform = `rotateX(25deg) translate3d(0, ${-this.offset}px, 0)`;
        const atEnd = this.offset > max * 0.85;
        this.formSlot?.classList.toggle('is-settled', atEnd);
    }

    getCopyForSphere() {
        return { byline: this.byline, paragraphs: this.paragraphs };
    }

    /** First visible line label for proof captures */
    getVisibleLineHint() {
        return this.ring?.visibleLineHint?.() ?? '';
    }

    forceFlatMode() {
        window.app?.webgl?.setAboutRingMode?.(false);
        if (!this.flat) this.setFlat(true);
        else {
            this.flatPanel?.classList.remove('hidden');
            this.scene?.classList.add('tail-visible');
            this.startAuto();
        }
    }

    destroy() {
        this.stopAuto();
        clearTimeout(this.resumeTimer);
        this.ring?.destroy();
        document.documentElement.classList.remove('about-ring-active');
        window.app?.webgl?.setAboutRingMode?.(false);
        this.root?.replaceChildren();
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
