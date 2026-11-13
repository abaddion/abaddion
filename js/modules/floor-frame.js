/**
 * SVG technical frame for opened DOM floors (no WebGL).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildSha() {
    return document.querySelector('meta[name=build]')?.content?.slice(0, 7) ?? 'dev';
}

export function floorLabelText(floor, site) {
    const idx = floor.index ?? '01';
    const label = floor.label ?? (floor.id === 'identity' ? `${site.name} / ${site.headline}` : floor.title);
    return `${idx} ———— ${label}`;
}

export class FloorFrame {
    constructor(section, floor, site) {
        this.section = section;
        this.floor = floor;
        this.site = site;
        this.shell = section.querySelector('.floor-view-shell');
        this.svg = section.querySelector('.floor-view-frame');
        this.readoutEl = section.querySelector('.floor-view-readout');
        this.labelEl = section.querySelector('.floor-view-label-mono');
        this.indexGhost = section.querySelector('.floor-view-index-ghost');
        if (this.labelEl) this.labelEl.textContent = floorLabelText(floor, site);
        if (this.indexGhost) this.indexGhost.textContent = floor.index ?? '01';
        this._ensureSvg();
    }

    _ensureSvg() {
        if (!this.svg || this.svg.querySelector('.floor-frame-brackets')) return;
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'floor-frame-brackets');
        for (let i = 0; i < 4; i++) {
            const h = document.createElementNS(SVG_NS, 'line');
            const v = document.createElementNS(SVG_NS, 'line');
            h.setAttribute('class', 'floor-frame-line');
            v.setAttribute('class', 'floor-frame-line');
            g.appendChild(h);
            g.appendChild(v);
        }
        const rule = document.createElementNS(SVG_NS, 'line');
        rule.setAttribute('class', 'floor-frame-rule floor-frame-line');
        const ticks = document.createElementNS(SVG_NS, 'g');
        ticks.setAttribute('class', 'floor-frame-ticks');
        for (let i = 0; i < 12; i++) {
            const tick = document.createElementNS(SVG_NS, 'line');
            tick.setAttribute('class', 'floor-frame-line floor-frame-tick');
            ticks.appendChild(tick);
        }
        this.svg.appendChild(g);
        this.svg.appendChild(rule);
        this.svg.appendChild(ticks);
    }

    layout() {
        if (!this.svg) return;
        const panel = this.section.querySelector('.floor-view-panel');
        if (!panel) return;
        const rect = panel.getBoundingClientRect();
        if (rect.width < 8) return;
        const pad = 14;
        const x0 = rect.left + pad;
        const y0 = rect.top + pad;
        const x1 = rect.right - pad;
        const y1 = rect.bottom - pad;
        this.svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
        const lines = this.svg.querySelectorAll('.floor-frame-brackets line');
        const corners = [
            [x0, y0, 1, 1],
            [x1, y0, -1, 1],
            [x1, y1, -1, -1],
            [x0, y1, 1, -1]
        ];
        corners.forEach(([cx, cy, hx, hy], i) => {
            const h = lines[i * 2];
            const v = lines[i * 2 + 1];
            h.setAttribute('x1', cx);
            h.setAttribute('y1', cy);
            h.setAttribute('x2', cx + hx * 22);
            h.setAttribute('y2', cy);
            v.setAttribute('x1', cx);
            v.setAttribute('y1', cy);
            v.setAttribute('x2', cx);
            v.setAttribute('y2', cy + hy * 22);
        });
        const rule = this.svg.querySelector('.floor-frame-rule');
        const yRule = y0 + 36;
        if (rule) {
            rule.setAttribute('x1', x0 + 28);
            rule.setAttribute('x2', x1 - 28);
            rule.setAttribute('y1', String(yRule));
            rule.setAttribute('y2', String(yRule));
        }
        const tickEls = this.svg.querySelectorAll('.floor-frame-tick');
        const span = x1 - x0 - 56;
        tickEls.forEach((tick, i) => {
            const t = i / Math.max(1, tickEls.length - 1);
            const x = x0 + 28 + span * t;
            const tall = i % 3 === 0;
            tick.setAttribute('x1', String(x));
            tick.setAttribute('x2', String(x));
            tick.setAttribute('y1', String(yRule - (tall ? 6 : 3)));
            tick.setAttribute('y2', String(yRule + 1));
        });
    }

    onOpen() {
        this.layout();
        if (this.readoutEl) {
            const idx = this.floor.index ?? '01';
            this.readoutEl.textContent = `FL ${idx}  SYS glass  BLD ${buildSha()}`;
        }
        this.section.classList.add('is-frame-drawing');
        requestAnimationFrame(() => this.section.classList.add('is-frame-ready'));
        this.svg?.querySelectorAll('.floor-frame-line').forEach((ln) => {
            const len = ln.getTotalLength?.() ?? 240;
            ln.style.strokeDasharray = String(len);
            ln.style.strokeDashoffset = String(len);
        });
        requestAnimationFrame(() => {
            this.svg?.querySelectorAll('.floor-frame-line').forEach((ln) => {
                ln.style.strokeDashoffset = '0';
            });
        });
        setTimeout(() => this.section.classList.remove('is-frame-drawing'), 320);
    }

    onResize() {
        this.layout();
    }
}
