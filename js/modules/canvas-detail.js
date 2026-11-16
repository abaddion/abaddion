/**
 * Technical-drawing detail view — DOM img + SVG leaders, inquiry dialog.
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
                <button type="button" class="detail-inquire" hidden>inquire →</button>
            </div>
            <dialog class="detail-inquiry-dialog" aria-labelledby="detail-inquiry-title">
                <form class="inquiry-form glass-panel" method="dialog" novalidate>
                    <h3 id="detail-inquiry-title">Inquire</h3>
                    <input type="hidden" name="painting" />
                    <label>Name<input name="name" required autocomplete="name" /></label>
                    <label>Email<input name="email" type="email" required autocomplete="email" /></label>
                    <label>Message<textarea name="message" rows="4" required></textarea></label>
                    <div class="detail-inquiry-actions">
                        <button type="button" class="detail-inquiry-close">Close</button>
                        <button type="submit">Send (Phase 2)</button>
                    </div>
                </form>
            </dialog>
            <button type="button" class="detail-prev" aria-label="Previous">‹</button>
            <button type="button" class="detail-next" aria-label="Next">›</button>
        `;
        document.body.appendChild(this.el);

        this.img = this.el.querySelector('.detail-img');
        this.svg = this.el.querySelector('.detail-annotations');
        this.inquireBtn = this.el.querySelector('.detail-inquire');
        this.inquiryDialog = this.el.querySelector('.detail-inquiry-dialog');
        this.items = getItems('canvas');
        this.currentSlug = null;
        this.decodeCache = new Map();
        this._corridorSlug = null;

        this.el.querySelector('.detail-back').addEventListener('click', () => this.close());
        this.el.querySelector('.detail-prev').addEventListener('click', () => this.step(-1));
        this.el.querySelector('.detail-next').addEventListener('click', () => this.step(1));
        this.inquireBtn.addEventListener('click', () => this.openInquiry());
        this.inquiryDialog.querySelector('.detail-inquiry-close')?.addEventListener('click', () => this.closeInquiry());
        this.inquiryDialog.querySelector('.inquiry-form').addEventListener('submit', (e) => e.preventDefault());
        this.inquiryDialog.addEventListener('cancel', (e) => {
            e.preventDefault();
            this.closeInquiry();
        });
        this.inquiryDialog.addEventListener('click', (e) => {
            if (e.target === this.inquiryDialog) this.closeInquiry();
        });

        window.addEventListener('keydown', (e) => {
            if (this.el.hidden) return;
            if (e.code === 'Escape') {
                if (this.inquiryDialog.open) {
                    e.preventDefault();
                    this.closeInquiry();
                    return;
                }
                e.preventDefault();
                this.close();
            }
            if (e.code === 'ArrowLeft') this.step(-1);
            if (e.code === 'ArrowRight') this.step(1);
        });

        window.addEventListener('popstate', () => {
            if (this.el.hidden) return;
            const path = location.pathname.replace(/\/+$/, '');
            if (path === '/canvas' || path === '') {
                this.close({ skipHistory: true });
            }
        });
    }

    /**
     * @param {string} slug
     * @param {{ handoffRect?: DOMRect }} [options]
     */
    async open(slug, options = {}) {
        const item = this.items.find((i) => i.slug === slug);
        if (!item) return;
        if (!this.currentSlug) this._corridorSlug = slug;
        this.currentSlug = slug;

        const src = fullImageSrc(item);
        await this._ensureDecoded(src);

        this.closeInquiry();
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
        if (location.pathname !== route) {
            history.pushState({ canvasDetail: slug }, '', route);
        }
        this.onNavigateSlug(slug);
    }

    close(options = {}) {
        this.el.hidden = true;
        this.closeInquiry();
        document.documentElement.classList.remove('detail-open');
        if (!options.skipHistory && location.pathname.includes('/canvas/')) {
            history.pushState({ canvasCorridor: true }, '', '/canvas');
        }
        const slug = this.currentSlug;
        this.currentSlug = null;
        this.onClose(slug);
    }

    step(dir) {
        const idx = this.items.findIndex((i) => i.slug === this.currentSlug);
        const next = this.items[(idx + dir + this.items.length) % this.items.length];
        if (next) this.open(next.slug);
    }

    openInquiry() {
        const item = this.items.find((i) => i.slug === this.currentSlug);
        this.inquiryDialog.querySelector('[name="painting"]').value = item?.title ?? '';
        if (typeof this.inquiryDialog.showModal === 'function') {
            this.inquiryDialog.showModal();
        }
    }

    closeInquiry() {
        if (this.inquiryDialog.open) this.inquiryDialog.close();
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
        this.svg.innerHTML = lines.join('');

        this.inquireBtn.hidden = false;
        const btnTop = imgTop + imgH + 8;
        const btnLeft = Math.min(w - 120, imgLeft + imgW - 20);
        this.inquireBtn.style.left = `${btnLeft}px`;
        this.inquireBtn.style.top = `${btnTop}px`;
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
        const dialogOpen = this.inquiryDialog.open;
        return { imgInViewport, overlap: dialogOpen, inquiryOpen: dialogOpen };
    }
}