/**
 * DOM content cards from content.json — lazy per floor.
 */

import { getItems } from './content-loader.js';
import { FloorFrame, floorLabelText } from './floor-frame.js';
import { FloorViewUI } from './floor-view-ui.js';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function isImmersiveFloor(id) {
    return id === 'canvas' || id === 'about';
}

function tileMetaLine(item) {
    const year = item.year ?? '—';
    const stack = Array.isArray(item.stack) && item.stack.length ? item.stack.join(' · ') : '—';
    const status = item.approved === false ? 'draft' : 'live';
    return `${year} · ${stack} · ${status}`;
}

function renderIdentity(floor, site) {
    const spaced = site.name.split('').join(' ');
    const legend = (site.intro ?? 'code · math · canvas')
        .split('·')
        .map((s) => s.trim())
        .filter(Boolean);
    const legendHtml = legend
        .map(
            (item, i) =>
                `<li class="identity-spec-row"><span class="identity-spec-idx">${String(i + 1).padStart(2, '0')}</span><span class="identity-spec-key">${escapeHtml(item)}</span><span class="identity-spec-tick" aria-hidden="true"></span></li>`
        )
        .join('');
    return `
        <p class="card-eyebrow identity-name-ghost">${escapeHtml(spaced)}</p>
        <h2 id="card-title-${floor.id}" class="card-title card-title--hero floor-heading-reveal" tabindex="-1">${escapeHtml(site.headline)}</h2>
        <p class="card-body identity-lead">${escapeHtml(floor.body === 'PLACEHOLDER' ? site.intro : floor.body)}</p>
        <ul class="identity-spec-legend" aria-label="Practice areas">${legendHtml}</ul>`;
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
            (item, i) => `
        <article class="floor-tile floor-tile--monitor floor-tile--tilt" style="--tile-i: ${i}">
            <span class="floor-tile-index" aria-hidden="true">${floor.index}.${i + 1}</span>
            <div class="floor-tile-media floor-tile-media--16x10">
                ${
                    item.thumb
                        ? `<img class="code-shot" src="${escapeHtml(item.thumb)}" alt="" loading="lazy" width="320" height="200" />`
                        : '<span class="floor-tile-media-fallback"></span>'
                }
            </div>
            <h3 class="floor-tile-title"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>
            <p class="card-body floor-tile-summary">${escapeHtml(item.summary)}</p>
            <p class="floor-tile-annotation"><span class="floor-tile-anno-line" aria-hidden="true"></span>${escapeHtml(tileMetaLine(item))}</p>
        </article>`
        )
        .join('');
    const body = floor.body === 'PLACEHOLDER' ? '' : floor.body;
    return `
        <h2 id="card-title-${floor.id}" class="card-title floor-heading-reveal">${escapeHtml(floor.title)}</h2>
        ${body ? `<p class="card-body">${escapeHtml(body)}</p>` : ''}
        <div class="card-list floor-tile-grid">${list}</div>`;
}

function renderGames(floor) {
    const items = getItems('games');
    const list = items
        .map((item, i) => {
            const href = escapeHtml(item.url);
            const isInternal = String(item.url).startsWith('/');
            const linkAttrs = isInternal
                ? ''
                : ' target="_blank" rel="noopener noreferrer"';
            return `
        <article class="floor-tile floor-tile--game floor-tile--tilt" style="--tile-i: ${i}">
            <span class="floor-tile-index" aria-hidden="true">${floor.index}.${i + 1}</span>
            <div class="floor-tile-media">${item.thumb ? `<img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" />` : '<span class="floor-tile-media-fallback"></span>'}</div>
            <h3 class="floor-tile-title">${escapeHtml(item.title)}</h3>
            <p class="card-body floor-tile-summary">${escapeHtml(item.summary)}</p>
            <p class="floor-tile-annotation"><span class="floor-tile-anno-line" aria-hidden="true"></span>${escapeHtml(tileMetaLine(item))}</p>
            <a class="game-play-link floor-tile-cta" href="${href}"${linkAttrs}>Play ${escapeHtml(item.title)} →</a>
        </article>`;
        })
        .join('');
    return `
        <h2 id="card-title-${floor.id}" class="card-title floor-heading-reveal">${escapeHtml(floor.title)}</h2>
        <p class="card-body">${escapeHtml(floor.body)}</p>
        <div class="card-list card-list--games floor-tile-grid">${list}</div>`;
}

function renderCareer(floor) {
    const body = floor.body === 'PLACEHOLDER' ? 'Employer brand and career pages that convert — audited, redesigned, measured.' : floor.body;
    return `
        <h2 id="card-title-${floor.id}" class="card-title floor-heading-reveal">${escapeHtml(floor.title)}</h2>
        <p class="card-body career-statement">${escapeHtml(body)}</p>
        <ol class="career-process" aria-label="Process">
            <li class="career-process-step"><span class="career-step-num">01</span><span class="career-step-line" aria-hidden="true"></span><span>Audit — map journeys, ATS, and brand signal gaps.</span></li>
            <li class="career-process-step"><span class="career-step-num">02</span><span class="career-step-line" aria-hidden="true"></span><span>Redesign — career site, copy, and apply flow as one system.</span></li>
            <li class="career-process-step"><span class="career-step-num">03</span><span class="career-step-line" aria-hidden="true"></span><span>Measure — hiring velocity, quality, and brand lift.</span></li>
        </ol>
        <button type="button" class="career-contact-placeholder">Contact — placeholder</button>
        ${floor.xrayTeaser ? '<p class="card-teaser">X-ray teaser — Phase 2</p>' : ''}`;
}

function renderAbout(floor) {
    return `
        <h2 id="card-title-${floor.id}" class="card-title floor-heading-reveal">${escapeHtml(floor.title)}</h2>
        <div class="about-crawl-root"></div>
    `;
}

function buildFloorShell(floor, site, innerHtml) {
    const immersive = isImmersiveFloor(floor.id);
    const idx = escapeHtml(floor.index ?? '01');
    const label = escapeHtml(floorLabelText(floor, site));
    return `
            <header class="floor-view-topbar">
                <button type="button" class="floor-view-back">← stack</button>
            </header>
            <div class="floor-view-scroll">
                <div class="floor-view-shell floor-view-shell--${escapeHtml(floor.id)}">
                    <svg class="floor-view-frame" aria-hidden="true"></svg>
                    <div class="floor-view-parallax-frame">
                        <div class="floor-view-panel${immersive ? ' floor-view-panel--immersive' : ''}">
                            <div class="floor-view-index-ghost" aria-hidden="true">${idx}</div>
                            <p class="floor-view-label-mono">${label}</p>
                            <p class="floor-view-readout" aria-hidden="true"></p>
                            <div class="floor-view-panel-glass floor-view-parallax-content">
                                ${innerHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
}

function renderFloorInner(floor, site) {
    switch (floor.id) {
        case 'identity':
            return renderIdentity(floor, site);
        case 'canvas':
            return renderCanvas(floor);
        case 'code':
            return renderCode(floor);
        case 'games':
            return renderGames(floor);
        case 'career-pages':
            return renderCareer(floor);
        case 'about':
            return renderAbout(floor);
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
        this.openCanvasPiece = () => {};
        this.aboutCrawls = new Map();
        this.floorFrames = new Map();
        this.floorUIs = new Map();
        this.reducedMotion = false;
        if (!this._resizeBound) {
            this._resizeBound = () => {
                for (const frame of this.floorFrames.values()) frame.onResize?.();
            };
            window.addEventListener('resize', this._resizeBound);
        }
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
        section.innerHTML = buildFloorShell(floor, this.site, inner);
        section.classList.toggle('floor-view--immersive', isImmersiveFloor(floor.id));
        section.querySelector('.floor-view-back')?.addEventListener('click', () => {
            if (document.documentElement.classList.contains('detail-open')) {
                window.app?.webgl?.backToCorridorFromDetail?.();
                return;
            }
            window.app?.closeFloor?.();
        });
        this.root.appendChild(section);
        this.built.add(index);
        this.floorFrames.set(index, new FloorFrame(section, floor, this.site));
        this.floorUIs.set(index, new FloorViewUI(section, { reducedMotion: this.reducedMotion }));

        if (floor.id === 'canvas') {
            const glass = section.querySelector('.floor-view-panel-glass');
            glass?.replaceChildren();
            glass?.insertAdjacentHTML(
                'beforeend',
                '<p class="corridor-hint">Swipe or scroll to walk — tap a painting for detail.</p>'
            );
        }

        if (floor.id === 'about') {
            const crawlRoot = section.querySelector('.about-crawl-root');
            if (crawlRoot && !this.aboutCrawls.has(index)) {
                import('./about-crawl.js').then(({ AboutCrawl }) => {
                    const crawl = new AboutCrawl(crawlRoot, {
                        body: floor.body,
                        paragraphs: floor.paragraphs,
                        byline: floor.byline,
                        ctaLinks: floor.ctaLinks,
                        closingLine: floor.closingLine,
                        reducedMotion:
                            this.reducedMotion ||
                            document.documentElement.classList.contains('reduce-motion')
                    });
                    crawl.mount();
                    this.aboutCrawls.set(index, crawl);
                    if (this.activeIndex === index && crawl.sphereActive) {
                        void window.app?.webgl?.attachAboutSphere?.(crawl)?.then?.(() =>
                            window.app?.webgl?.setAboutSphereActive?.(true)
                        );
                    }
                });
            }
        }
    }

    /** @returns {import('./about-crawl.js').AboutCrawl | null} */
    getAboutCrawl(index) {
        return this.aboutCrawls.get(index) ?? null;
    }

    fallbackAllAboutToFlat() {
        for (const crawl of this.aboutCrawls.values()) {
            crawl.forceFlatMode?.();
        }
    }

    promoteAboutToSphereWhenReady() {
        for (const crawl of this.aboutCrawls.values()) {
            crawl.tryPromoteToSphere?.();
        }
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
        if (progress >= 1) {
            this.floorFrames.get(index)?.onOpen?.();
            this.floorUIs.get(index)?.activate?.();
            if (!options.instant) {
                this.lastFocus = document.activeElement;
                card.querySelector('.floor-view-back')?.focus?.();
            }
            if (card.dataset.floorId === 'about') {
                const crawl = this.getAboutCrawl(index);
                crawl?.tryPromoteToSphere?.();
                crawl?.startAuto?.();
            }
        }
    }

    hideActive(reducedMotion) {
        this.hideActiveCard(reducedMotion);
    }

    hideActiveCard(reducedMotion) {
        const card = this.root.querySelector('.floor-card.is-open');
        if (card) {
            const idx = Number(card.dataset.floorIndex);
            this.floorUIs.get(idx)?.deactivate?.();
            card.classList.remove('is-open', 'is-frame-ready', 'is-frame-drawing', 'is-tiles-ready');
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
        document.querySelector('.about-crawl-tail, .about-crawl-root')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    /** @param {(slug: string) => void} fn */
    setCanvasDetailOpener(fn) {
        this.openCanvasPiece = (slug) => {
            this.ensureBuilt(this.floors.findIndex((f) => f.id === 'canvas'));
            fn(slug);
        };
    }
}
