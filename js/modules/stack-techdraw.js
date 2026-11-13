/**
 * Technical-drawing SVG overlay — stack axis, brackets, readout (DOM only).
 */

import * as THREE from 'three';
import { SLAB_W, SLAB_D } from './stack.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MONO = 'var(--font-mono)';

function buildSha() {
    return document.querySelector('meta[name=build]')?.content?.slice(0, 7) ?? 'dev';
}

export class StackTechDraw {
    constructor(container, stack, content) {
        this.container = container;
        this.stack = stack;
        this.floors = content.floors;
        this.focusIndex = 0;
        this.buildSha = buildSha();
        this._drawStart = 0;
        this._vec = new THREE.Vector3();
        this._mobile = false;

        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'stack-techdraw-svg');
        this.svg.setAttribute('aria-hidden', 'true');

        this.gAxis = this._el('g', 'stack-tech-axis');
        this.gMarks = this._el('g', 'stack-tech-marks');
        this.gFocus = this._el('g', 'stack-tech-focus');
        this.gReadout = this._el('g', 'stack-tech-readout');

        this.axisLine = this._line();
        this.gAxis.appendChild(this.axisLine);

        this.tickGroups = [];
        for (let i = 0; i < this.floors.length; i++) {
            const g = this._el('g', `stack-tech-tick floor-${i}`);
            const tick = this._line();
            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('class', 'stack-tech-tick-label');
            const idx = this.floors[i].index ?? String(i + 1).padStart(2, '0');
            label.textContent = idx;
            g.appendChild(tick);
            g.appendChild(label);
            this.gAxis.appendChild(g);
            this.tickGroups.push({ g, tick, label, index: i });
        }

        this.bracket = this._el('g', 'stack-tech-brackets');
        for (let i = 0; i < 4; i++) {
            this.bracket.appendChild(this._line(`bracket-${i}`));
        }
        this.dimLine = this._line('stack-tech-dim');
        this.dimLabel = document.createElementNS(SVG_NS, 'text');
        this.dimLabel.setAttribute('class', 'stack-tech-dim-label');
        this.dimLabel.textContent = '8 × 8 / 1:64';
        this.leader = this._line('stack-tech-leader');
        this.cross = this._el('g', 'stack-tech-cross');
        this.cross.appendChild(this._line('cross-h'));
        this.cross.appendChild(this._line('cross-v'));

        this.gFocus.append(this.bracket, this.dimLine, this.dimLabel, this.leader, this.cross);

        for (let i = 0; i < 4; i++) {
            const m = this._el('g', `stack-tech-reg-${i}`);
            m.appendChild(this._line('reg-h'));
            m.appendChild(this._line('reg-v'));
            this.gMarks.appendChild(m);
        }

        this.readoutText = document.createElementNS(SVG_NS, 'text');
        this.readoutText.setAttribute('class', 'stack-tech-readout');
        this.gReadout.appendChild(this.readoutText);

        this.svg.append(this.gMarks, this.gAxis, this.gFocus, this.gReadout);
        container.appendChild(this.svg);
    }

    _el(tag, cls) {
        const el = document.createElementNS(SVG_NS, tag);
        if (cls) el.setAttribute('class', cls);
        return el;
    }

    _line(cls) {
        const l = document.createElementNS(SVG_NS, 'line');
        l.setAttribute('class', cls ? `stack-tech-line ${cls}` : 'stack-tech-line');
        return l;
    }

    setFocusIndex(index) {
        if (index === this.focusIndex) return;
        this.focusIndex = index;
        this._drawStart = performance.now();
        this._animateIn();
    }

    _animateIn() {
        const dur = 300;
        const lines = this.svg.querySelectorAll('.stack-tech-line, .stack-tech-tick-label, .stack-tech-readout');
        lines.forEach((el) => {
            const len = el.getTotalLength?.() ?? 120;
            if (el.tagName === 'text') return;
            el.style.strokeDasharray = String(len);
            el.style.strokeDashoffset = String(len);
            el.style.transition = `stroke-dashoffset ${dur}ms var(--ease)`;
            requestAnimationFrame(() => {
                el.style.strokeDashoffset = '0';
            });
        });
    }

    _project(camera, floorIndex, x, y, z, w, h) {
        this._vec.set(x, y, z);
        const grp = this.stack.getFloorGroup(floorIndex);
        grp.updateMatrixWorld?.(true);
        this._vec.applyMatrix4(grp.matrixWorld);
        this._vec.project(camera);
        if (this._vec.z > 1) return null;
        return {
            x: (this._vec.x * 0.5 + 0.5) * w,
            y: (-this._vec.y * 0.5 + 0.5) * h
        };
    }

    _setLine(line, x1, y1, x2, y2) {
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
    }

    _railRect() {
        const rail = document.getElementById('floor-rail');
        return rail?.getBoundingClientRect();
    }

    _labelRects() {
        return [...this.svg.parentElement.querySelectorAll('.floor-label-text')].map((t) => {
            try {
                return t.getBoundingClientRect();
            } catch {
                return null;
            }
        }).filter(Boolean);
    }

    _hitsForbidden(rect) {
        const rail = this._railRect();
        const labels = this._labelRects();
        if (rail && rect.bottom > rail.top - 6) return true;
        for (const lb of labels) {
            if (
                rect.right > lb.left - 4 &&
                rect.left < lb.right + 4 &&
                rect.bottom > lb.top - 4 &&
                rect.top < lb.bottom + 4
            ) {
                return true;
            }
        }
        return false;
    }

    update(camera) {
        if (!camera?.position) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        this._mobile = w < 768;
        this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        const hidden = document.documentElement.classList.contains('floor-open');
        if (hidden) {
            this.svg.setAttribute('visibility', 'hidden');
            return;
        }
        this.svg.setAttribute('visibility', 'visible');

        const axX = w * 0.12;
        let yMin = h;
        let yMax = 0;
        for (let i = 0; i < this.stack.floorCount; i++) {
            const p = this._project(camera, i, 0, this.stack.getFloorY(i), 0, w, h);
            if (!p) continue;
            yMin = Math.min(yMin, p.y);
            yMax = Math.max(yMax, p.y);
            const tg = this.tickGroups[i];
            const hl = i === this.focusIndex;
            tg.g.setAttribute('class', `stack-tech-tick floor-${i}${hl ? ' is-active' : ''}`);
            this._setLine(tg.tick, axX - (hl ? 14 : 10), p.y, axX + (hl ? 14 : 10), p.y);
            tg.label.setAttribute('x', String(axX - 28));
            tg.label.setAttribute('y', String(p.y + 4));
        }
        this._setLine(this.axisLine, axX, yMin - 24, axX, yMax + 24);

        const reg = 18;
        const corners = [
            [reg, reg],
            [w - reg, reg],
            [w - reg, h - reg],
            [reg, h - reg]
        ];
        this.gMarks.querySelectorAll('g').forEach((g, i) => {
            const [cx, cy] = corners[i];
            const [hx, hy] = i % 2 === 0 ? [1, 1] : [-1, -1];
            const lines = g.querySelectorAll('line');
            this._setLine(lines[0], cx, cy, cx + hx * reg, cy);
            this._setLine(lines[1], cx, cy, cx, cy + hy * reg);
        });

        const fi = this.focusIndex;
        const y = this.stack.getFloorY(fi);
        const hw = SLAB_W / 2;
        const hd = SLAB_D / 2;
        const corners3d = [
            [-hw, y + 0.08, -hd],
            [hw, y + 0.08, -hd],
            [hw, y + 0.08, hd],
            [-hw, y + 0.08, hd]
        ];
        const pts = corners3d
            .map(([x, yy, z]) => this._project(camera, fi, x, yy, z, w, h))
            .filter(Boolean);
        const bracketLines = this.bracket.querySelectorAll('line');
        if (pts.length === 4) {
            const pad = 10;
            const sets = [
                [pts[0].x - pad, pts[0].y - pad, pts[0].x - pad + 16, pts[0].y - pad],
                [pts[0].x - pad, pts[0].y - pad, pts[0].x - pad, pts[0].y - pad + 16],
                [pts[2].x + pad, pts[2].y + pad, pts[2].x + pad - 16, pts[2].y + pad],
                [pts[2].x + pad, pts[2].y + pad, pts[2].x + pad, pts[2].y + pad - 16]
            ];
            sets.forEach((s, i) => this._setLine(bracketLines[i], ...s));
        }

        let showDim = !this._mobile;
        if (showDim && pts.length >= 2) {
            const dimY = pts[0].y - 22;
            const dimRect = {
                left: pts[0].x,
                top: dimY - 8,
                right: pts[1].x,
                bottom: dimY + 8
            };
            if (this._hitsForbidden(dimRect)) showDim = false;
        }
        this.dimLine.style.display = showDim ? '' : 'none';
        if (showDim && pts.length >= 2) {
            const midY = pts[0].y - 22;
            this._setLine(this.dimLine, pts[0].x, midY, pts[1].x, midY);
            this.dimLabel.setAttribute('x', String((pts[0].x + pts[1].x) / 2));
            this.dimLabel.setAttribute('y', String(midY - 6));
            this.dimLabel.setAttribute('text-anchor', 'middle');
        } else {
            this.dimLabel.setAttribute('visibility', 'hidden');
        }
        if (showDim) this.dimLabel.setAttribute('visibility', 'visible');

        const labelEl = this.container.querySelector(
            `.floor-label-anno[data-floor-index="${fi}"] .floor-label-text`
        );
        const cx = (pts[0]?.x + pts[2]?.x) / 2 || w / 2;
        const cy = (pts[0]?.y + pts[2]?.y) / 2 || h / 2;
        if (labelEl && pts.length) {
            const lb = labelEl.getBoundingClientRect();
            this._setLine(this.leader, pts[3]?.x ?? cx, pts[3]?.y ?? cy, lb.left, lb.top + lb.height / 2);
        }

        const crossLines = this.cross.querySelectorAll('line');
        if (pts[0] && pts[2]) {
            const ccx = (pts[0].x + pts[2].x) / 2;
            const ccy = (pts[0].y + pts[2].y) / 2;
            this._setLine(crossLines[0], ccx - 8, ccy, ccx + 8, ccy);
            this._setLine(crossLines[1], ccx, ccy - 8, ccx, ccy + 8);
        }

        const cam = camera.position;
        const n = this.floors.length;
        this.readoutText.textContent = `FL ${String(fi + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}  CAM ${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.z.toFixed(1)}  BLD ${this.buildSha}`;
        this.readoutText.setAttribute('x', String(w - 12));
        this.readoutText.setAttribute('y', String(h - 16));
        this.readoutText.setAttribute('text-anchor', 'end');
    }
}
