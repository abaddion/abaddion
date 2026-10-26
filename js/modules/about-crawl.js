/**
 * About floor — perspective crawl (DOM/CSS), reduced-motion flat mode.
 */

export class AboutCrawl {
    /**
     * @param {HTMLElement} root
     * @param {{ body?: string, paragraphs?: string[], byline?: string, ctaLinks?: { lead: string, href: string, label: string }[], closingLine?: string, reducedMotion?: boolean }} options
     */
    constructor(root, options = {}) {
        this.root = root;
        this.body = options.body ?? '';
        this.paragraphs = options.paragraphs?.length
            ? options.paragraphs
            : this.body.split(/\n\n+/).filter(Boolean);
        this.byline = options.byline ?? '';
        this.ctaLinks = options.ctaLinks ?? [];
        this.closingLine = options.closingLine ?? '';
        this.reducedMotion = options.reducedMotion ?? false;
        this.offset = 0;
        this.auto = true;
        this.paused = false;
        this.resumeTimer = null;
        this.raf = null;
        this.flat = this.reducedMotion;
        this.onWheel = this.onWheel.bind(this);
    }

    mount() {
        this.root.innerHTML = `
            <div class="about-crawl-scene${this.flat ? ' is-flat' : ''}">
                <div class="about-crawl-perspective">
                    <div class="about-crawl-block">
                        <div class="about-crawl-copy">${this._copyHtml()}</div>
                        <div class="about-crawl-form-slot">
                            <div class="about-crawl-tail">${this._tailHtml()}</div>
                        </div>
                    </div>
                </div>
                <button type="button" class="about-read-toggle">${this.flat ? 'cinematic crawl' : 'read as text'}</button>
            </div>`;

        this.scene = this.root.querySelector('.about-crawl-scene');
        this.block = this.root.querySelector('.about-crawl-block');
        this.toggle = this.root.querySelector('.about-read-toggle');
        this.formSlot = this.root.querySelector('.about-crawl-form-slot');
        this.tail = this.root.querySelector('.about-crawl-tail');

        this.toggle?.addEventListener('click', () => this.setFlat(!this.flat));
        this.scene?.addEventListener('click', (e) => {
            if (e.target.closest('button, input, textarea, a, label')) return;
            this.paused = !this.paused;
        });

        if (this.flat) {
            this.formSlot?.classList.add('is-settled');
        } else {
            this.startAuto();
        }
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

    setFlat(flat) {
        this.flat = flat;
        this.scene?.classList.toggle('is-flat', flat);
        if (this.toggle) this.toggle.textContent = flat ? 'cinematic crawl' : 'read as text';
        if (flat) {
            this.stopAuto();
            this.block.style.transform = '';
            this.formSlot?.classList.add('is-settled');
        } else {
            this.offset = 0;
            this.formSlot?.classList.remove('is-settled');
            this.startAuto();
        }
    }

    onWheel(deltaY) {
        if (this.flat) return false;
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

    startAuto() {
        this.stopAuto();
        if (this.flat) return;
        const tick = () => {
            if (!this.paused && this.auto) {
                this.offset += 0.35;
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
        if (!this.block || this.flat) return;
        const max = Math.max(2400, this.block.scrollHeight * 0.85);
        this.offset = Math.max(-200, Math.min(max, this.offset));
        this.block.style.transform = `translate3d(0, ${-this.offset}px, 0)`;
        const atEnd = this.offset > max * 0.85;
        this.formSlot?.classList.toggle('is-settled', atEnd);
    }

    destroy() {
        this.stopAuto();
        clearTimeout(this.resumeTimer);
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
