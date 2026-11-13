#!/usr/bin/env node
/**
 * One-off / report: capture game pages at 390×844 and 1440×900.
 * Usage: node scripts/capture-game-screenshots.mjs [baseUrl]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromeLaunchOpts, loadPuppeteer } from './lib/puppeteer-launch.mjs';
import { GAME_SMOKE } from './lib/games-inventory.mjs';

const outDir =
    process.argv[3] ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../docs/product/games-visual-report');
const base = (process.argv[2] || 'https://www.abaddion.com').replace(/\/$/, '');
const viewports = [
    { name: '390', width: 390, height: 844 },
    { name: '1440', width: 1440, height: 900 }
];

fs.mkdirSync(outDir, { recursive: true });

const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch(chromeLaunchOpts());

for (const game of GAME_SMOKE) {
    for (const vp of viewports) {
        const page = await browser.newPage();
        await page.setViewport(vp);
        const url = base + game.path;
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForFunction(game.ready, { timeout: 20000 });
        try {
            await game.interact(page);
            await new Promise((r) => setTimeout(r, 400));
        } catch {
            /* still capture load state */
        }
        const file = path.join(outDir, `${game.slug}-${vp.name}.png`);
        await page.screenshot({ path: file, type: 'png' });
        console.log('wrote', file);
        await page.close();
    }
}

await browser.close();
