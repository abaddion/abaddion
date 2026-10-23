/**
 * Technical-drawing detail view — DOM img + SVG leaders, inquiry panel.
 */

import { getItems } from './content-loader.js';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fullImageSrc(item) {
    return item.imageWebp || item.image || item.thumb;
}

export class CanvasDetail {
    constructor(options = {}) {
        this.onClose = options.onClose ?? (() => {});
        this.onNavigateSlug = options.onNavigateSlug ?? (() => {});

        this.el = document.createElement('div');
        this.el.id = 'canvas-detail';
        this.el.className = 'canvas-detail';
        this.el.hidden = true;
        this.el.innerHTML = `
            <button type="button" class="detail-back" aria-label="Back to corridor">← corridor</button>
            <div class="detail-frame">
                <svg class="detail-annotations" aria-hidden="true"></svg>
                <img class="detail-img" alt="" decoding="async" />
            </div>
            <div class="detail-inquiry" hidden>
                <form class="inquiry-form glass-panel" novalidate>
                    <h3>Inquire</h3>
                    <input type="hidden" name="painting" />
                    <label>Name<input name="name" required autocomplete="name" /></label>
                    <label>Email<input name="email" type="email" required autocomplete="email" /></label>
                    <label>Message<textarea name="message" rows="4" required></textarea></label>
                    <button type="submit">Send (Phase 2)</button>
                </form>
            </div>
            <button type="button" class="detail-prev" aria-label="Previous">‹</button>
            <button type="button" class="detail-next" aria-label="Next">›</button>
        `;
        document.body.appendChild(this.el);

        this.img = this.el.querySelector('.detail-img');
        this.svg = this.el.querySelector('.detail-annotations');
        this.inquiry = this.el.querySelector('.detail-inquiry');
        this.items = getItems('canvas');
        this.currentSlug = null;
        this.decodeCache = new Map();

        this.el.querySelector('.detail-back').addEventListener('click', () => this.close());
        this.el.querySelector('.detail-prev').addEventListener('click', () => this.step(-1));
        this.el.querySelector('.detail-next').addEventListener('click', () => this.step(1));
        this.el.querySelector('.inquiry-form').addEventListener('submit', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            if (this.el.hidden) return;
            if (e.code === 'Escape') {
                if (!this.inquiry.hidden) {
                    this.inquiry.hidden = true;
                    return;
                }
                e.preventDefault();
                this.close();
            }
            if (e.code === 'ArrowLeft') this.step(-1);
            if (e.code === 'ArrowRight') this.step(1);
        });
    }

    /**
     * @param {string} slug
     * @param {{ handoffRect?: DOMRect }} [options]
     */
    async open(slug, options = {}) {
        const item = this.items.find((i) => i.slug === slug);
        if (!item) return;
        this.currentSlug = slug;

        const src = fullImageSrc(item);
        await this._ensureDecoded(src);

        this.el.hidden = false;
        document.documentElement.classList.add('detail-open');

        if (options.handoffRect?.width > 0) {
            this.img.style.position = 'fixed';
            this.img.style.left = `${options.handoffRect.left}px`;
            this.img.style.top = `${options.handoffRect.top}px`;
            this.img.style.width = `${options.handoffRect.width}px`;
            this.img.style.height = `${options.handoffRect.height}px`;
            this.img.style.transition = 'none';
        }

        this.img.src = src;
        this.img.alt = `${item.title}, ${item.medium}, ${item.year}`;

        if (this.img.decode) {
            await this.img.decode();
        }

        if (options.handoffRect?.width > 0) {
            this.img.style.position = '';
            this.img.style.left = '';
            this.img.style.top = '';
            this.img.style.width = '';
            this.img.style.height = '';
            this.img.style.transition = '';
        }

        requestAnimationFrame(() => this._drawAnnotations(item));
        const route = `/canvas/${slug}`;
        if (location.pathname !== route) history.replaceState({}, '', route);
        this.onNavigateSlug(slug);
    }

    close() {
        this.el.hidden = true;
        this.inquiry.hidden = true;
        document.documentElement.classList.remove('detail-open');
        this.onClose();
    }

    step(dir) {
        const idx = this.items.findIndex((i) => i.slug === this.currentSlug);
        const next = this.items[(idx + dir + this.items.length) % this.items.length];
        if (next) this.open(next.slug);
    }

    openInquiry() {
        const item = this.items.find((i) => i.slug === this.currentSlug);
        this.inquiry.hidden = false;
        this.inquiry.querySelector('[name="painting"]').value = item?.title ?? '';
    }

    async _ensureDecoded(src) {
        if (this.decodeCache.has(src)) return this.decodeCache.get(src);
        const p = (async () => {
            const im = new Image();
            im.src = src;
            if (im.decode) {
                await im.decode();
            } else {
                await new Promise((resolve, reject) => {
                    im.onload = resolve;
                    im.onerror = reject;
                });
            }
            return im;
        })();
        this.decodeCache.set(src, p);
        return p;
    }

    _drawAnnotations(item) {
        const frame = this.el.querySelector('.detail-frame');
        const ir = this.img.getBoundingClientRect();
        const fr = frame.getBoundingClientRect();
        const w = fr.width;
        const h = fr.height;
        this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        this.svg.innerHTML = '';

        const imgLeft = ir.left - fr.left;
        const imgTop = ir.top - fr.top;
        const imgW = ir.width;
        const imgH = ir.height;

        const lines = [];
        const addLine = (x1, y1, x2, y2, delay) => {
            lines.push(
                `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="anno-line" style="animation-delay:${delay}ms"/>`
            );
        };

        addLine(imgLeft + imgW, imgTop + 12, imgLeft + imgW + 48, imgTop - 8, 0);
        lines.push(
            `<text x="${imgLeft + imgW + 52}" y="${imgTop + 4}" class="anno-text" style="animation-delay:80ms">${escapeHtml(item.title)}</text>`
        );
        lines.push(
            `<text x="${imgLeft + imgW + 52}" y="${imgTop + 20}" class="anno-text anno-muted" style="animation-delay:120ms">${escapeHtml(item.medium)} · ${item.year}</text>`
        );

        addLine(imgLeft - 36, imgTop, imgLeft - 36, imgTop + imgH, 160);
        addLine(imgLeft - 42, imgTop, imgLeft - 30, imgTop, 200);
        addLine(imgLeft - 42, imgTop + imgH, imgLeft - 30, imgTop + imgH, 240);
        const sizeLabel = item.size?.includes('cm') ? item.size : `${item.size || ''} cm`;
        lines.push(
            `<text x="${imgLeft - 48}" y="${imgTop + imgH / 2}" class="anno-text" transform="rotate(-90 ${imgLeft - 48} ${imgTop + imgH / 2})" style="animation-delay:280ms">${escapeHtml(sizeLabel)}</text>`
        );

        if (item.availability || item.price) {
            addLine(imgLeft + 8, imgTop + imgH, imgLeft - 20, imgTop + imgH + 36, 320);
            lines.push(
                `<text x="${imgLeft - 24}" y="${imgTop + imgH + 48}" class="anno-text anno-muted" style="animation-delay:360ms">${escapeHtml([item.availability, item.price].filter(Boolean).join(' · '))}</text>`
            );
        }

        addLine(imgLeft + imgW - 8, imgTop + imgH, imgLeft + imgW + 40, imgTop + imgH + 28, 400);
        lines.push(
            `<foreignObject x="${imgLeft + imgW + 44}" y="${imgTop + imgH + 12}" width="120" height="32"><button type="button" xmlns="http://www.w3.org/1999/xhtml" class="detail-inquire-btn">inquire →</button></foreignObject>`
        );

        this.svg.innerHTML = lines.join('');
        this.svg.querySelector('.detail-inquire-btn')?.addEventListener('click', () => this.openInquiry());
    }

    /** @returns {{ imgInViewport: boolean, overlap: boolean }} */
    measureLayout() {
        const ir = this.img.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const imgInViewport =
            ir.left >= -2 &&
            ir.top >= -2 &&
            ir.right <= vw + 2 &&
            ir.bottom <= vh + 2 &&
            ir.width > 0;
        return { imgInViewport, overlap: false };
    }
}
