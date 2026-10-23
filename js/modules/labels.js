/**
 * Floor labels — technical SVG annotations with leader lines.
 */

import * as THREE from 'three';
import { SLAB_W, SLAB_D } from './stack.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function textBBox(text) {
    try {
        const tb = text.getBBox();
        return {
            left: tb.x,
            top: tb.y,
            right: tb.x + tb.width,
            bottom: tb.y + tb.height
        };
    } catch {
        const x = parseFloat(text.getAttribute('x') || '0');
        const y = parseFloat(text.getAttribute('y') || '0');
        return { left: x, top: y - 12, right: x + 140, bottom: y + 4 };
    }
}

function rectsOverlap(a, b, pad = 4) {
    return !(
        a.right + pad < b.left ||
        a.left - pad > b.right ||
        a.bottom + pad < b.top ||
        a.top - pad > b.bottom
    );
}

function floorMeta(floor, site, index) {
    const idx = floor.index ?? String(index + 1).padStart(2, '0');
    const label =
        floor.label ??
        (floor.id === 'identity' ? `${site.name} / ${site.headline}` : floor.title);
    return { index: idx, label };
}

export class FloorLabels {
    constructor(container, stack, content, options = {}) {
        this.container = container;
        this.stack = stack;
        this.floors = content.floors;
        this.site = content.site;
        this.hintEl = options.hintEl ?? null;
        this.focusIndex = 0;
        this.groups = [];

        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'floor-labels-svg');
        this.svg.setAttribute('aria-hidden', 'true');
        container.replaceChildren(this.svg);

        this.floors.forEach((floor, index) => {
            const meta = floorMeta(floor, this.site, index);
            const g = document.createElementNS(SVG_NS, 'g');
            g.setAttribute('class', 'floor-label-anno');
            g.dataset.floorIndex = String(index);

            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('class', 'floor-label-leader');

            const text = document.createElementNS(SVG_NS, 'text');
            text.setAttribute('class', 'floor-label-text');
            text.textContent = `${meta.index} ———— ${meta.label}`;

            g.appendChild(line);
            g.appendChild(text);
            this.svg.appendChild(g);
            this.groups.push({ g, line, text, index });
        });

        this.corner = new THREE.Vector3();
    }

    setFocusIndex(index) {
        this.focusIndex = index;
    }

    isMobileLayout() {
        return window.innerWidth < 768;
    }

    getRailRect() {
        const rail = document.getElementById('floor-rail');
        return rail?.getBoundingClientRect() ?? { top: Infinity, left: 0, right: 0, bottom: 0 };
    }

    getForbiddenBottom() {
        if (!this.isMobileLayout()) return window.innerHeight;
        const rail = this.getRailRect();
        return rail.top < window.innerHeight ? rail.top : window.innerHeight;
    }

    update(camera) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        const heroHandoff =
            document.documentElement.classList.contains('hero-handoff') &&
            !document.documentElement.classList.contains('hero-dismissed');

        const mobile = this.isMobileLayout();
        const forbiddenBottom = this.getForbiddenBottom();
        const placements = [];

        this.groups.forEach(({ g, line, text, index }) => {
            if (index === 0 && heroHandoff) {
                g.setAttribute('visibility', 'hidden');
                return;
            }

            if (mobile && Math.abs(index - this.focusIndex) > 1) {
                g.setAttribute('visibility', 'hidden');
                return;
            }

            const group = this.stack.getFloorGroup(index);
            const hw = SLAB_W / 2;
            const hd = SLAB_D / 2;
            const y = this.stack.getFloorY(index);
            this.corner.set(-hw, y + 0.02, hd);
            this.corner.applyMatrix4(group.matrixWorld);
            this.corner.project(camera);

            if (this.corner.z > 1) {
                g.setAttribute('visibility', 'hidden');
                return;
            }

            const cx = (this.corner.x * 0.5 + 0.5) * w;
            const cy = (-this.corner.y * 0.5 + 0.5) * h;

            const focused = index === this.focusIndex;
            g.setAttribute('class', `floor-label-anno${focused ? ' is-focused' : ''}`);
            g.setAttribute('visibility', 'visible');

            const labelOffsetX = mobile ? -12 : -20;
            const textX = Math.max(12, Math.min(w - 12, cx + labelOffsetX));
            let textY = cy - (mobile ? 36 : 8);
            if (mobile) {
                textY += (index - this.focusIndex) * 26;
            }
            textY = Math.min(textY, forbiddenBottom - 40);
            textY = Math.max(24, textY);

            text?.setAttribute('x', String(textX));
            text?.setAttribute('y', String(textY));
            line?.setAttribute('x1', String(cx));
            line?.setAttribute('y1', String(cy));
            line?.setAttribute('x2', String(textX));
            line?.setAttribute('y2', String(textY));

            const rect = textBBox(text);
            placements.push({ index, rect, g, line, text, textY, focused, cx, cy, textX });
        });

        this._resolveCollisions(placements, forbiddenBottom);
        if (mobile) this._clipBelowRail();

        const focusedPlacement = placements.find((p) => p.index === this.focusIndex && p.g.getAttribute('visibility') !== 'hidden');
        this._positionHint(focusedPlacement, forbiddenBottom);
    }

    _clipBelowRail() {
        const railTop = this.getRailRect().top;
        if (railTop >= window.innerHeight) return;

        this.groups.forEach(({ g, text, line, index }) => {
            if (g.getAttribute('visibility') === 'hidden') return;
            let rect;
            try {
                rect = text.getBoundingClientRect();
            } catch {
                return;
            }
            if (rect.height <= 0) return;
            if (rect.bottom <= railTop - 8) return;

            if (index !== this.focusIndex) {
                g.setAttribute('visibility', 'hidden');
                return;
            }

            const overflow = rect.bottom - (railTop - 8);
            const curY = parseFloat(text.getAttribute('y') || '0');
            const nextY = Math.max(20, curY - overflow - 6);
            text.setAttribute('y', String(nextY));
            line?.setAttribute('y2', String(nextY));
        });
    }

    _resolveCollisions(placements, forbiddenBottom) {
        const rail = this.getRailRect();
        const hint = this.hintEl?.getBoundingClientRect();

        placements.sort((a, b) => {
            if (a.focused === b.focused) return 0;
            return a.focused ? -1 : 1;
        });

        const accepted = [];

        for (const p of placements) {
            let rect = { ...p.rect };
            let tries = 0;
            let hidden = false;

            while (tries < 6) {
                const hitRail = rect.bottom > rail.top - 4 && rail.top < window.innerHeight;
                const hitForbidden = rect.bottom > forbiddenBottom - 2;
                let hitOther = false;
                for (const a of accepted) {
                    if (rectsOverlap(rect, a.rect)) hitOther = true;
                }
                if (hint && rectsOverlap(rect, hint)) hitOther = true;

                if (!hitRail && !hitForbidden && !hitOther) break;

                if (hitRail || hitForbidden) {
                    p.textY -= 12;
                    p.text?.setAttribute('y', String(p.textY));
                    p.line?.setAttribute('y2', String(p.textY));
                    rect = textBBox(p.text);
                    tries++;
                    if (tries >= 6 && (rect.bottom > rail.top - 6 || rect.bottom > forbiddenBottom - 4)) {
                        if (!p.focused) hidden = true;
                        break;
                    }
                    continue;
                }

                if (!p.focused && hitOther) {
                    hidden = true;
                    break;
                }

                const shift = (tries % 2 === 0 ? -1 : 1) * 14 * (Math.floor(tries / 2) + 1);
                p.textY += shift;
                p.text?.setAttribute('y', String(p.textY));
                p.line?.setAttribute('y2', String(p.textY));
                rect = textBBox(p.text);
                tries++;
            }

            if (hidden) {
                p.g.setAttribute('visibility', 'hidden');
                continue;
            }

            p.rect = rect;
            accepted.push(p);
        }
    }

    _positionHint(focused, forbiddenBottom) {
        if (!this.hintEl || !focused || this.hintEl.classList.contains('hidden')) return;

        const tb = textBBox(focused.text);
        let top = tb.bottom + 10;
        const hintH = this.hintEl.offsetHeight || 16;
        if (top + hintH > forbiddenBottom - 8) {
            top = tb.top - hintH - 8;
        }

        this.hintEl.style.left = `${Math.max(12, tb.left)}px`;
        this.hintEl.style.top = `${Math.max(12, top)}px`;
        this.hintEl.style.bottom = 'auto';
    }
}
