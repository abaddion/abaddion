/**
 * DOM content cards from content.json — lazy per floor.
 */

import { getItems } from './content-loader.js';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderIdentity(floor, site) {
    const spaced = site.name.split('').join(' ');
    return `
        <p class="card-eyebrow">${escapeHtml(spaced)}</p>
        <h2 id="card-title-${floor.id}" class="card-title" tabindex="-1">${escapeHtml(site.headline)}</h2>
        <p class="card-body">${escapeHtml(site.intro)}</p>
        <p class="card-body">${escapeHtml(floor.body)}</p>
    `;
}

function renderCanvas(floor) {
    const items = getItems('canvas');
    const thumbs = items
        .map(
            (item) => `
        <button type="button" class="canvas-thumb" data-canvas-slug="${escapeHtml(item.slug)}">
            ${
                item.thumb
                    ? `<img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" width="512" height="512" />`
                    : '<span class="canvas-thumb-fallback"></span>'
            }
            <span class="canvas-thumb-title">${escapeHtml(item.title)}</span>
        </button>`
        )
        .join('');
    return `
        <h2 id="card-title-${floor.id}" class="card-title">${escapeHtml(floor.title)}</h2>
        <p class="card-body">${escapeHtml(floor.body)}</p>
        <div class="canvas-grid">${thumbs}</div>
        <dialog class="canvas-lightbox" id="canvas-lightbox">
            <button type="button" class="canvas-lightbox-close" aria-label="Close">×</button>
            <button type="button" class="canvas-lightbox-prev" aria-label="Previous">‹</button>
            <button type="button" class="canvas-lightbox-next" aria-label="Next">›</button>
            <figure class="canvas-lightbox-figure">
                <img class="canvas-lightbox-img" alt="" />
                <figcaption class="canvas-lightbox-caption"></figcaption>
            </figure>
        </dialog>
    `;
}

function renderCode(floor) {
    const items = getItems('code');
    const list = items
        .map(
            (item) => `
        <article class="card-item">
            ${
                item.thumb
                    ? `<img class="code-shot" src="${escapeHtml(item.thumb)}" alt="" loading="lazy" />`
                    : ''
            }
            <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>
            <p class="card-body">${escapeHtml(item.summary)}</p>
        </article>`
        )
        .join('');
    return `
        <h2 id="card-title-${floor.id}" class="card-title">${escapeHtml(floor.title)}</h2>
        <p class="card-body">${escapeHtml(floor.body)}</p>
        <div class="card-list">${list}</div>
    `;
}

function renderCareer(floor) {
    return `
        <h2 id="card-title-${floor.id}" class="card-title">${escapeHtml(floor.title)}</h2>
        <p class="card-body">${escapeHtml(floor.body)}</p>
        ${floor.xrayTeaser ? '<p class="card-teaser">X-ray teaser — Phase 2</p>' : ''}
    `;
}

function renderAbout(floor, site) {
    return `
        <h2 id="card-title-${floor.id}" class="card-title">${escapeHtml(floor.title)}</h2>
        <p class="card-body about-email"><a href="mailto:${escapeHtml(site.email)}">${escapeHtml(site.email)}</a></p>
        <div class="about-crawl-root"></div>
        <form id="contact-form" class="contact-form" novalidate>
            <label>Name<input name="name" required autocomplete="name" /></label>
            <label>Email<input name="email" type="email" required autocomplete="email" /></label>
            <label>Message<textarea name="message" required rows="4"></textarea></label>
            <button type="submit">Send (Phase 2)</button>
            <p class="form-hint" hidden data-form-error>Please fill all fields with a valid email.</p>
        </form>
    `;
}

function renderFloorInner(floor, site) {
    switch (floor.id) {
        case 'identity':
            return renderIdentity(floor, site);
        case 'canvas':
            return renderCanvas(floor);
        case 'code':
            return renderCode(floor);
        case 'career-pages':
            return renderCareer(floor);
        case 'about':
            return renderAbout(floor, site);
        default:
            return `<h2 id="card-title-${floor.id}">${escapeHtml(floor.title)}</h2>`;
    }
}

export class CardLayer {
    constructor(rootEl) {
        this.root = rootEl;
        this.activeIndex = null;
        this.lastFocus = null;
        this.floors = [];
        this.site = null;
        this.built = new Set();
        this.contactFormBound = false;
        this.openCanvasPiece = () => {};
        this.aboutCrawls = new Map();
        this.reducedMotion = false;
    }

    setReducedMotion(v) {
        this.reducedMotion = v;
    }

    build(content, { initialIndex = 0 } = {}) {
        this.floors = content.floors;
        this.site = content.site;
        this.root.replaceChildren();
        this.built.clear();
        this.ensureBuilt(initialIndex);
    }

    ensureBuilt(index) {
        if (index < 0 || index >= this.floors.length) return;
        if (this.built.has(index)) return;

        const floor = this.floors[index];
        const inner = renderFloorInner(floor, this.site);
        const section = document.createElement('section');
        section.className = 'floor-card floor-view';
        section.dataset.floorIndex = String(index);
        section.dataset.floorId = floor.id;
        section.setAttribute('role', 'region');
        section.setAttribute('aria-labelledby', `card-title-${floor.id}`);
        section.hidden = true;
        section.innerHTML = `
            <header class="floor-view-topbar">
                <button type="button" class="floor-view-back">← stack</button>
            </header>
            <div class="floor-card-inner floor-view-scroll">${inner}</div>`;
        section.querySelector('.floor-view-back')?.addEventListener('click', () => {
            if (document.documentElement.classList.contains('detail-open')) {
                window.app?.webgl?.backToCorridorFromDetail?.();
                return;
            }
            window.app?.closeFloor?.();
        });
        this.root.appendChild(section);
        this.built.add(index);

        if (floor.id === 'canvas') {
            section.querySelector('.floor-card-inner')?.replaceChildren();
            section.querySelector('.floor-card-inner')?.insertAdjacentHTML(
                'beforeend',
                '<p class="corridor-hint">Swipe or scroll to walk — tap a painting for detail.</p>'
            );
        }

        if (floor.id === 'about') {
            const crawlRoot = section.querySelector('.about-crawl-root');
            const form = section.querySelector('#contact-form');
            if (crawlRoot && !this.aboutCrawls.has(index)) {
                import('./about-crawl.js').then(({ AboutCrawl }) => {
                    const crawl = new AboutCrawl(crawlRoot, {
                        body: floor.body,
                        paragraphs: floor.paragraphs,
                        byline: floor.byline,
                        ctaLinks: floor.ctaLinks,
                        closingLine: floor.closingLine,
                        reducedMotion: this.reducedMotion
                    });
                    crawl.mount();
                    if (form) {
                        form.remove();
                        crawl.attachForm(form);
                    }
                    this.aboutCrawls.set(index, crawl);
                });
            }
            if (!this.contactFormBound && form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const data = new FormData(e.target);
                    const ok =
                        data.get('name') &&
                        data.get('email') &&
                        String(data.get('email')).includes('@') &&
                        data.get('message');
                    e.target.querySelector('[data-form-error]').hidden = !!ok;
                });
                this.contactFormBound = true;
            }
        }
    }

    /** @returns {import('./about-crawl.js').AboutCrawl | null} */
    getAboutCrawl(index) {
        return this.aboutCrawls.get(index) ?? null;
    }

    isAboutFloorOpen() {
        if (this.activeIndex == null) return false;
        return this.floors[this.activeIndex]?.id === 'about';
    }

    showFloor(index, options = {}) {
        this.showCard(index, null, options);
    }

    showCard(index, _rect, options = {}) {
        this.ensureBuilt(index);
        const progress = options.progress ?? 1;

        const cards = this.root.querySelectorAll('.floor-card');
        cards.forEach((c) => {
            const idx = Number(c.dataset.floorIndex);
            c.hidden = idx !== index;
            c.classList.toggle('is-open', idx === index);
            c.classList.toggle('is-fade-only', false);
            c.classList.toggle('floor-card--glass', idx === index);
            c.classList.toggle('floor-view--canvas', idx === index && c.dataset.floorId === 'canvas');
            c.classList.toggle('floor-view--about', idx === index && c.dataset.floorId === 'about');
        });

        const card = this.root.querySelector(`.floor-card[data-floor-index="${index}"]`);
        if (!card) return;

        card.style.setProperty('--floor-expand', String(progress));
        document.documentElement.classList.toggle('floor-open', progress > 0.02);
        document.documentElement.classList.toggle('floor-open-canvas', progress > 0.5 && card.dataset.floorId === 'canvas');

        this.activeIndex = index;
        if (progress >= 1 && !options.instant) {
            this.lastFocus = document.activeElement;
            card.querySelector('.floor-view-back')?.focus?.();
            if (card.dataset.floorId === 'about') {
                this.getAboutCrawl(index)?.startAuto?.();
            }
        }
    }

    hideActive(reducedMotion) {
        this.hideActiveCard(reducedMotion);
    }

    hideActiveCard(reducedMotion) {
        const card = this.root.querySelector('.floor-card.is-open');
        if (card) {
            card.classList.remove('is-open');
            card.style.setProperty('--floor-expand', '0');
            if (reducedMotion) card.classList.add('is-closing');
            setTimeout(() => {
                card.hidden = true;
                card.classList.remove('is-closing', 'is-fade-only', 'floor-view--canvas');
            }, reducedMotion ? 200 : 400);
        }
        document.documentElement.classList.remove('floor-open', 'floor-open-canvas');
        this.activeIndex = null;
        if (this.lastFocus?.focus) this.lastFocus.focus();
    }

    scrollToContact() {
        const aboutIndex = this.floors.findIndex((f) => f.id === 'about');
        if (aboutIndex >= 0) this.ensureBuilt(aboutIndex);
        document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /** @param {(slug: string) => void} fn */
    setCanvasDetailOpener(fn) {
        this.openCanvasPiece = (slug) => {
            this.ensureBuilt(this.floors.findIndex((f) => f.id === 'canvas'));
            fn(slug);
        };
    }
}
