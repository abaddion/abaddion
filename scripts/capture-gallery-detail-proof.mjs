#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
import { createStaticServer } from './lib/static-server.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/gallery-detail-proof');

async function bootCanvas(page) {
    await page.goto(`${page.baseUrl}/canvas`, { waitUntil: 'networkidle0', timeout: 120000 });
    await page.waitForFunction(() => window.app?.content && window.__APP_STATE?.bootComplete, { timeout: 45000 });
    await page.evaluate(() => window.app.openFloor(1));
    await page.waitForFunction(() => window.app?.webgl?.corridor?.root?.visible, { timeout: 30000 });
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const { baseUrl, server } = await createStaticServer(root);
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });

    for (const [w, h, tag] of [
        [390, 844, '390'],
        [1440, 900, '1440']
    ]) {
        const page = await browser.newPage();
        page.baseUrl = baseUrl;
        await page.setViewport({ width: w, height: h });
        await bootCanvas(page);
        for (let i = 0; i < 12; i++) await page.evaluate(() => window.app.webgl?.frameRender?.());
        await page.screenshot({ path: path.join(outDir, `corridor-${tag}.png`) });
        await page.click('.corridor-walk-forward');
        await new Promise((r) => setTimeout(r, 700));
        await page.screenshot({ path: path.join(outDir, `corridor-forward-${tag}.png`) });
        const tap = await page.evaluate(() => {
            const t = window.__APP_STATE?.corridor?.visiblePaintings?.find((p) => p.focused && p.onScreen);
            return t?.screenRect ? { x: t.screenRect.cx, y: t.screenRect.cy } : null;
        });
        if (tap) {
            if (w < 500) await page.touchscreen.tap(tap.x, tap.y);
            else await page.mouse.click(tap.x, tap.y);
        }
        await new Promise((r) => setTimeout(r, 900));
        await page.screenshot({ path: path.join(outDir, `detail-${tag}.png`) });
        await page.click('.detail-inquire');
        await new Promise((r) => setTimeout(r, 400));
        await page.screenshot({ path: path.join(outDir, `inquiry-${tag}.png`) });
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 300));
        await page.click('.detail-back');
        await new Promise((r) => setTimeout(r, 500));
        await page.screenshot({ path: path.join(outDir, `corridor-return-${tag}.png`) });
        await page.close();
    }
    await browser.close();
    server.close();
    console.log('Wrote', outDir);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});