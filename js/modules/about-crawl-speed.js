/**
 * About crawl timing — reading speed from copy length (~1.5–2s per line).
 */

/** Seconds per line (middle of 1.5–2s spec) */
export const SEC_PER_LINE = 1.65;

/**
 * @param {{ byline?: string, paragraphs?: string[] }} copy
 * @returns {number}
 */
export function estimateAboutLineCount(copy) {
    const parts = [];
    if (copy.byline) parts.push(copy.byline);
    if (copy.paragraphs?.length) parts.push(...copy.paragraphs);
    const text = parts.join('\n\n');
    if (!text) return 8;
    const words = text.split(/\s+/).filter(Boolean).length;
    const wrapped = Math.ceil(text.length / 52);
    return Math.max(8, Math.ceil(words / 9) + wrapped * 0.35);
}

/**
 * Full loop duration (seconds). `?loop=short` only for tail QA.
 * @param {{ byline?: string, paragraphs?: string[] }} copy
 * @param {Location} [location]
 */
export function aboutCrawlLoopSeconds(copy, location = globalThis.location) {
    const flag = (new URLSearchParams(location?.search ?? '').get('loop') ?? '').toLowerCase();
    if (flag === 'short') return 14;
    return estimateAboutLineCount(copy) * SEC_PER_LINE;
}

/**
 * Flat panel auto-scroll speed (px/s) — first line clearly moves within ~1s.
 * @param {number} maxScrollPx
 * @param {number} loopSec
 */
export function aboutFlatPixelsPerSecond(maxScrollPx, loopSec, lineHeightPx = 28) {
    const fromLoop = maxScrollPx / Math.max(loopSec, 1);
    const minForFirstSecond = lineHeightPx * 1.05;
    return Math.max(fromLoop, minForFirstSecond);
}
