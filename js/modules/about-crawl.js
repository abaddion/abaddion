/**
 * About floor — sphere crawl (WebGL) or flat text; SEO copy always in DOM.
 */

/** @returns {boolean} WebGL inner-sphere only when explicitly requested */
export function resolveAboutSphereEnabled(location = globalThis.location) {
    const params = new URLSearchParams(location?.search ?? '');
    const flag = (params.get('about') ?? params.get('sphere') ?? '').toLowerCase();
    return flag === 'sphere' || flag === '1' || flag === 'true';
}

export class AboutCrawl {
    /**
     * @param {HTMLElement} root
     * @param {{ body?: string, paragraphs?: string[], byline?: string, ctaLinks?: { lead: string, href: string, label: string }[], closingLine?: string, reducedMotion?: boolean, sphereCapable?: boolean, startInSphere?: boolean }} options
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
        const webglOk =
            !this.reducedMotion && !document.documentElement.classList.contains('no-webgl');
        this.sphereCapable = options.sphereCapable ?? webglOk;
        this.startInSphere = options.startInSphere ?? resolveAboutSphereEnabled();

        this.offset = 0;
        this.auto = true;
        this.paused = false;
        this.resumeTimer = null;
        this.raf = null;
        this.flat = this.reducedMotion || !this.startInSphere;
        this.sphereActive = false;
        this.tailRevealed = false;
        this.onWheel = this.onWheel.bind(this);
    }

    mount() {
        this.root.innerHTML = `
            <div class="about-crawl-scene${this.flat ? ' is-flat' : ' is-sphere'}">
                <div class="about-seo-copy visually-hidden" aria-hidden="true">${this._copyHtml()}${this._tailHtml()}</div>
                <div class="about-crawl-perspective about-crawl-flat-panel${this.flat ? '' : ' hidden'}">
                    <div class="about-crawl-block">
                        <div class="about-crawl-copy">${this._copyHtml()}</div>
                    </div>
                </div>
                <div class="about-tail-dock">
                    <div class="about-crawl-form-slot">
                        <div class="about-crawl-tail about-tail-panel">${this._tailHtml()}</div>
                    </div>
                </div>
                <button type="button" class="about-read-toggle">${this.flat ? 'inside the ball' : 'read as text'}</button>
            </div>`;

        this.scene = this.root.querySelector('.about-crawl-scene');
        this.flatPanel = this.root.querySelector('.about-crawl-flat-panel');
        this.toggle = this.root.querySelector('.about-read-toggle');
        this.formSlot = this.root.querySelector('.about-crawl-form-slot');
        this.tail = this.root.querySelector('.about-crawl-tail');

        this.toggle?.addEventListener('click', () => this.setFlat(!this.flat));
        this.scene?.addEventListener('click', (e) => {
            if (e.target.closest('button, input, textarea, a, label')) return;
            if (this.sphereActive) {
                window.app?.webgl?.aboutSphere?.onTapTogglePause?.();
                this.paused = !this.paused;
            } else if (!this.flat) {
                this.paused = !this.paused;
            }
        });

        if (this.flat) {
            this.formSlot?.classList.add('is-settled');
            this.scene?.classList.add('tail-visible');
            this.startAuto();
        } else if (this.sphereCapable && this.startInSphere) {
            this.sphereActive = true;
            void window.app?.webgl?.attachAboutSphere?.(this)?.then?.(() => {
                if (window.app?.cardLayer?.isAboutFloorOpen?.()) {
                    window.app?.webgl?.setAboutSphereActive?.(true);
                }
            });
        } else if (!this.flat) {
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

    onFirstSphereLoopComplete() {
        this.tailRevealed = true;
        this.scene?.classList.add('tail-visible');
        window.app?.webgl?.aboutSphere?.setDim?.(0.42);
    }

    setFlat(flat) {
        this.flat = flat;
        this.scene?.classList.toggle('is-flat', flat);
        this.scene?.classList.toggle('is-sphere', !flat);
        this.flatPanel?.classList.toggle('hidden', !flat);

        if (this.toggle) {
            this.toggle.textContent = flat ? 'inside the ball' : 'read as text';
        }

        if (flat) {
            window.app?.webgl?.setAboutSphereActive?.(false);
            this.sphereActive = false;
            this.formSlot?.classList.add('is-settled');
            this.scene?.classList.add('tail-visible');
            this.startAuto();
        } else if (this.sphereCapable) {
            this.formSlot?.classList.remove('is-settled');
            this.scene?.classList.toggle('tail-visible', this.tailRevealed);
            this.sphereActive = true;
            void window.app?.webgl?.attachAboutSphere?.(this)?.then?.(() =>
                window.app?.webgl?.setAboutSphereActive?.(true)
            );
        } else {
            this.offset = 0;
            this.formSlot?.classList.remove('is-settled');
            this.startAuto();
        }
    }

    onWheel(deltaY) {
        if (this.sphereActive) {
            return window.app?.webgl?.aboutSphere?.onWheel?.(deltaY) ?? false;
        }
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
        if (this.flat || this.sphereActive) return;
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
        const block = this.flatPanel?.querySelector('.about-crawl-block');
        if (!block || this.flat) return;
        const max = Math.max(2400, block.scrollHeight * 0.85);
        this.offset = Math.max(-200, Math.min(max, this.offset));
        block.style.transform = `translate3d(0, ${-this.offset}px, 0)`;
        const atEnd = this.offset > max * 0.85;
        this.formSlot?.classList.toggle('is-settled', atEnd);
    }

    getCopyForSphere() {
        return { byline: this.byline, paragraphs: this.paragraphs };
    }

    destroy() {
        this.stopAuto();
        clearTimeout(this.resumeTimer);
        window.app?.webgl?.disposeAboutSphere?.();
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
