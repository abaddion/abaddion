/**
 * Floor atlas — 8×5 monitor cells per floor row (512×512).
 */

import { getItems, getFloors, getSite } from './content-loader.js';
import { yieldToMain } from './utils.js';

export const ATLAS_GRID_COLS = 8;
export const ATLAS_GRID_ROWS = 5;
const ATLAS_SIZE = 512;
const ROW_H = Math.floor(ATLAS_SIZE / 5);

function drawTextCell(ctx, text, x, y, w, h) {
    ctx.fillStyle = '#141414';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ece8df';
    ctx.font = '9px monospace';
    const line = String(text).slice(0, 10);
    ctx.fillText(line, x + 4, y + h * 0.55);
}

async function drawMonitorGrid(ctx, sources, x, y, w, h) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(x, y, w, h);
    const cols = ATLAS_GRID_COLS;
    const rows = ATLAS_GRID_ROWS;
    const cellW = w / cols;
    const cellH = h / rows;
    const list = sources?.length ? sources : [{ thumb: null, title: '—' }];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const item = list[i % list.length];
            const cx = x + c * cellW;
            const cy = y + r * cellH;
            const pad = Math.max(1, Math.floor(cellW * 0.06));
            if (item?.thumb) {
                try {
                    const img = await loadImage(item.thumb);
                    ctx.drawImage(img, cx + pad, cy + pad, cellW - pad * 2, cellH - pad * 2);
                } catch {
                    drawTextCell(ctx, item.title || '—', cx, cy, cellW, cellH);
                }
            } else {
                drawTextCell(ctx, item?.title || item || '—', cx, cy, cellW, cellH);
            }
            if (i % 4 === 0) await yieldToMain();
        }
    }
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * @returns {Promise<{ canvas: HTMLCanvasElement, rects: Float32Array }>}
 */
export async function buildFloorAtlas() {
    const floors = getFloors();
    const site = getSite();
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    const rects = new Float32Array(floors.length * 4);

    for (let f = 0; f < floors.length; f++) {
        const y0 = f * ROW_H;
        const x0 = 0;
        const w = ATLAS_SIZE;
        const h = ROW_H;
        const floor = floors[f];

        if (floor.id === 'canvas') {
            await drawMonitorGrid(ctx, getItems('canvas'), x0, y0, w, h);
        } else if (floor.id === 'code') {
            await drawMonitorGrid(ctx, getItems('code'), x0, y0, w, h);
        } else {
            const label = floor.id === 'identity' ? site.name : floor.title;
            const cells = Array.from({ length: ATLAS_GRID_COLS * ATLAS_GRID_ROWS }, (_, i) => ({
                title: `${label}-${i + 1}`
            }));
            await drawMonitorGrid(ctx, cells, x0, y0, w, h);
        }

        rects[f * 4] = x0 / ATLAS_SIZE;
        rects[f * 4 + 1] = 1 - (y0 + h) / ATLAS_SIZE;
        rects[f * 4 + 2] = (x0 + w) / ATLAS_SIZE;
        rects[f * 4 + 3] = 1 - y0 / ATLAS_SIZE;

        await yieldToMain();
    }

    return { canvas, rects };
}

export { ATLAS_SIZE };
