/**
 * Rasterize about copy to a single texture (byline + paragraphs).
 */

const BONE = '#ece8df';
const MAX_W = 2048;
const MAX_H = 4096;

function wrapLines(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = w;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

/**
 * @param {{ byline?: string, paragraphs?: string[], mobilePortrait?: boolean }} copy
 * @returns {{ canvas: HTMLCanvasElement, width: number, height: number }}
 */
export function rasterizeAboutCopy(copy) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mobilePortrait =
        copy.mobilePortrait ?? (window.innerWidth < 768 && window.innerHeight > window.innerWidth);
    const pad = mobilePortrait ? 48 : 64;
    const maxTextW = mobilePortrait ? 720 : 920;
    const bodySize = mobilePortrait ? 26 : 22;
    const bylineSize = mobilePortrait ? 20 : 18;

    const measure = document.createElement('canvas').getContext('2d');
    measure.font = `${bodySize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;

    const blocks = [];
    if (copy.byline) {
        blocks.push({ type: 'byline', lines: [copy.byline], size: bylineSize, gap: 28 });
    }
    for (const p of copy.paragraphs ?? []) {
        blocks.push({
            type: 'body',
            lines: wrapLines(measure, p, maxTextW),
            size: bodySize,
            gap: 36
        });
    }

    let contentH = pad;
    for (const b of blocks) {
        contentH += b.lines.length * (b.size * 1.55) + b.gap;
    }
    contentH += pad;

    const w = Math.min(MAX_W, Math.round(maxTextW + pad * 2));
    const h = Math.min(MAX_H, Math.ceil(contentH));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let y = pad;
    for (const b of blocks) {
        ctx.font = `${b.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
        ctx.fillStyle = BONE;
        if (b.type === 'byline') ctx.globalAlpha = 0.92;
        for (const line of b.lines) {
            ctx.fillText(line, w / 2, y);
            y += b.size * 1.55;
        }
        ctx.globalAlpha = 1;
        y += b.gap;
    }

    return { canvas, width: w, height: h };
}
