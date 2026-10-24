/**
 * Technical-drawing detail view — DOM img + SVG leaders, inquiry modal.
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
        this.onBackToCorridor = options.onBackToCorridor ?? (() => {});
        this.onSlugRoute = options.onSlugRoute ?? (() => {});
        this.onClosed = options.onClosed ?? (() => {});

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
            <button type="button" class="detail-prev" hidden>
                <span class="detail-nav-label">‹ prev</span>
                <span class="detail-nav-title"></span>
            </button>
            <button type="button" class="detail-next" hidden>
                <span class="detail-nav-label">next ›</span>
                <span class="detail-nav-title"></span>
            </button>
            <dialog class="detail-inquiry-dialog glass-panel" aria-labelledby="detail-inquiry-title">
                <button type="button" class="detail-inquiry-close" aria-label="Close inquiry">×</button>
                <form class="inquiry-form" novalidate>
                    <h3 id="detail-inquiry-title">Inquire</h3>
                    <input type="hidden" name="painting" />
                    <label>Name<input name="name" required autocomplete="name" /></label>
                    <label>Email<input name="email" type="email" required autocomplete="email" /></label>
                    <label>Message<textarea name="message" rows="4" required></textarea></label>
                    <button type="submit">Send (Phase 2)</button>
                </form>
            </dialog>
        `;
        document.body.appendChild(this.el);

        this.img = this.el.querySelector('.detail-img');
        this.svg = this.el.querySelector('.detail-annotations');
        this.inquiryDialog = this.el.querySelector('.detail-inquiry-dialog');
        this.prevBtn = this.el.querySelector('.detail-prev');
        this.nextBtn = this.el.querySelector('.detail-next');
        this.inquireTrigger = null;
        this._suppressCorridorEscapeUntil = 0;
        this.items = getItems('canvas');
        this.currentSlug = null;
        this.decodeCache = new Map();

        this.el.querySelector('.detail-back').addEventListener('click', () => this.requestBackToCorridor());
        this.prevBtn.addEventListener('click', () => this.step(-1));
        this.nextBtn.addEventListener('click', () => this.step(1));
        this.inquiryDialog.querySelector('.inquiry-form').addEventListener('submit', (e) => e.preventDefault());
        this.inquiryDialog.querySelector('.detail-inquiry-close')?.addEventListener('click', () => this.closeInquiry());
        this.inquiryDialog.addEventListener('click', (e) => {
            if (e.target === this.inquiryDialog) this.closeInquiry();
        });
        this.inquiryDialog.addEventListener('close', () => {
            this.inquireTrigger?.focus?.();
            this.inquireTrigger = null;
        });

        window.addEventListener(
            'keydown',
            (e) => {
                if (this.el.hidden) return;
                if (e.code === 'Escape') {
                    if (this.inquiryDialog.open || performance.now() < this._suppressCorridorEscapeUntil) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.inquiryDialog.open) this.closeInquiry();
                        return;
                    }
                    e.preventDefault();
                    this.requestBackToCorridor();
                    return;
                }
                if (this.inquiryDialog.open) return;
                if (e.code === 'ArrowLeft') this.step(-1);
                if (e.code === 'ArrowRight') this.step(1);
            },
            true
        );
    }

    /**
     * @param {string} slug
     * @param {{ handoffRect?: DOMRect, replaceRoute?: boolean }} [options]
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
        this._updateNavButtons();
        this.onSlugRoute(slug, { replace: !!options.replaceRoute });
    }

    /** Hide detail UI (route / corridor restore handled by WebGL layer). */
    hide() {
        if (this.inquiryDialog.open) this.inquiryDialog.close();
        this.el.hidden = true;
        document.documentElement.classList.remove('detail-open');
        this.onClosed();
    }

    requestBackToCorridor() {
        if (this.inquiryDialog.open) {
            this.closeInquiry();
            return;
        }
        this.onBackToCorridor();
    }

    step(dir) {
        const idx = this.items.findIndex((i) => i.slug === this.currentSlug);
        if (idx < 0) return;
        const nextIdx = idx + dir;
        if (nextIdx < 0 || nextIdx >= this.items.length) return;
        this.open(this.items[nextIdx].slug, { replaceRoute: true });
    }

    _updateNavButtons() {
        const idx = this.items.findIndex((i) => i.slug === this.currentSlug);
        const prev = idx > 0 ? this.items[idx - 1] : null;
        const next = idx >= 0 && idx < this.items.length - 1 ? this.items[idx + 1] : null;

        this.prevBtn.hidden = !prev;
        this.nextBtn.hidden = !next;

        const prevTitle = this.prevBtn.querySelector('.detail-nav-title');
        const nextTitle = this.nextBtn.querySelector('.detail-nav-title');
        if (prev) {
            this.prevBtn.title = prev.title;
            if (prevTitle) prevTitle.textContent = prev.title;
        } else if (prevTitle) prevTitle.textContent = '';
        if (next) {
            this.nextBtn.title = next.title;
            if (nextTitle) nextTitle.textContent = next.title;
        } else if (nextTitle) nextTitle.textContent = '';
    }

    openInquiry(triggerEl) {
        const item = this.items.find((i) => i.slug === this.currentSlug);
        this.inquireTrigger = triggerEl ?? document.activeElement;
        this.inquiryDialog.querySelector('[name="painting"]').value = item?.title ?? '';
        if (typeof this.inquiryDialog.showModal === 'function') {
            this.inquiryDialog.showModal();
        }
    }

    closeInquiry() {
        if (!this.inquiryDialog.open) return;
        this._suppressCorridorEscapeUntil = performance.now() + 120;
        this.inquiryDialog.close();
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
        const inquireBtn = this.svg.querySelector('.detail-inquire-btn');
        inquireBtn?.addEventListener('click', () => this.openInquiry(inquireBtn));
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
