/**
 * Chunked 512×512 floor atlas — canvas 2D, yields between floors (<50 ms tasks).
 */

import { getItems, getFloors, getSite } from './content-loader.js';
import { yieldToMain } from './utils.js';

const ATLAS_SIZE = 512;
const ROW_H = Math.floor(ATLAS_SIZE / 5);

function drawTextBlock(ctx, text, x, y, w, h) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ece8df';
    ctx.font = 'bold 11px monospace';
    const lines = text.toLowerCase().match(/.{1,14}/g) || [text];
    lines.slice(0, 5).forEach((line, i) => {
        ctx.fillText(line, x + 6, y + 16 + i * 14);
    });
}

async function drawThumbGrid(ctx, items, x, y, w, h) {
    ctx.fillStyle = '#141414';
    ctx.fillRect(x, y, w, h);
    const cols = 4;
    const cell = Math.min(w / cols, h / Math.ceil(items.length / cols));
    for (let i = 0; i < Math.min(items.length, 8); i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = x + col * cell;
        const cy = y + row * cell;
        const src = items[i].thumb;
        if (!src) continue;
        try {
            const img = await loadImage(src);
            ctx.drawImage(img, cx + 1, cy + 1, cell - 2, cell - 2);
        } catch {
            ctx.fillStyle = '#333';
            ctx.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
        }
        if (i % 2 === 0) await yieldToMain();
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
            await drawThumbGrid(ctx, getItems('canvas'), x0, y0, w, h);
        } else if (floor.id === 'code') {
            await drawThumbGrid(ctx, getItems('code'), x0, y0, w, h);
        } else {
            const label =
                floor.id === 'identity' ? site.name : floor.title;
            drawTextBlock(ctx, label, x0, y0, w, h);
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
