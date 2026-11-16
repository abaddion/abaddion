#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
import { createStaticServer } from './lib/static-server.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/about-css-ring-proof');

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const { baseUrl, server } = await createStaticServer(root);
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });
    const frames = [];
    for (const [w, h, tag] of [
        [390, 844, '390'],
        [1440, 900, '1440']
    ]) {
        const page = await browser.newPage();
        await page.setViewport({ width: w, height: h });
        await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 120000 });
        await page.waitForFunction(() => window.__APP_STATE?.webglPhase === 'ready', { timeout: 120000 });
        await page.evaluate(() => window.app.goToFloor(5));
        await new Promise((r) => setTimeout(r, 400));
        for (let i = 0; i < 3; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            const hint = await page.evaluate(() => {
                const idx = 5;
                return window.app?.cardLayer?.getAboutCrawl?.(idx)?.getVisibleLineHint?.() ?? '';
            });
            const name = `about-ring-f${i + 1}-${tag}.png`;
            await page.screenshot({ path: path.join(outDir, name), type: 'png' });
            frames.push({ tag, frame: i + 1, visibleLine: hint, file: name });
        }
        await page.close();
    }
    await browser.close();
    server.close();
    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify({ capturedAt: new Date().toISOString(), frames }, null, 2));
    console.log(frames);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
