/**
 * Games under games/ — slugs from content.json, assets from each index.html.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function toRepoPath(p) {
    let s = p.replace(/\\/g, '/');
    if (s.startsWith('/')) s = s.slice(1);
    if (s.startsWith('./')) s = s.slice(2);
    if (s.includes('..')) throw new Error(`invalid path: ${p}`);
    return s;
}

export function loadGameSlugsFromContent() {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8'));
    const games = data.floors?.find((f) => f.id === 'games');
    if (!games?.items?.length) throw new Error('content.json: games floor has no items');
    return games.items.map((item) => {
        const m = String(item.url || '').match(/^\/games\/([^/]+)\/?$/);
        if (!m) throw new Error(`games item "${item.slug}" url must be /games/<slug>/`);
        return { slug: item.slug, url: item.url, dirSlug: m[1] };
    });
}

export function collectGameAssetPaths(slugDir) {
    const indexPath = path.join(root, 'games', slugDir, 'index.html');
    if (!fs.existsSync(indexPath)) throw new Error(`missing ${indexPath}`);
    const html = fs.readFileSync(indexPath, 'utf8');
    const base = `games/${slugDir}`;
    const out = new Set([`${base}/index.html`]);

    const attrRe = /(?:href|src)=["']([^"']+)["']/g;
    let m;
    while ((m = attrRe.exec(html)) !== null) {
        const raw = m[1];
        if (
            raw.startsWith('http') ||
            raw.startsWith('#') ||
            raw.startsWith('data:') ||
            raw.startsWith('<!--')
        ) {
            continue;
        }
        const resolved = raw.startsWith('/')
            ? toRepoPath(raw.slice(1))
            : toRepoPath(path.normalize(path.join(base, raw)));
        out.add(resolved);
    }
    return [...out];
}

export function sharedGamePaths() {
    return ['games/kiosk.js', 'games/kiosk.css'];
}

export const GAME_SMOKE = [
    {
        slug: 'interactive-ink',
        path: '/games/interactive-ink/',
        ready: () => !!document.getElementById('canvas'),
        interact: async (page) => {
            await page.click('#canvas', { offset: { x: 80, y: 80 } });
        }
    },
    {
        slug: 'interactive-sand',
        path: '/games/interactive-sand/',
        ready: () => !!document.getElementById('canvas'),
        interact: async (page) => {
            await page.click('#canvas', { offset: { x: 40, y: 40 } });
        }
    },
    {
        slug: 'calm-corner',
        path: '/games/calm-corner/',
        ready: () => !!document.querySelector('#home button[data-game]'),
        interact: async (page) => {
            await page.click('#home button[data-game="bubbles"]');
            await page.waitForFunction(() => document.getElementById('home').hidden === true, {
                timeout: 8000
            });
        }
    },
    {
        slug: 'smash-town',
        path: '/games/smash-town/',
        ready: () => !!document.getElementById('stage'),
        interact: async (page) => {
            await page.click('#stage', { offset: { x: 80, y: 200 } });
        }
    }
];

export { root };
