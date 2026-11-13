#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
import { createStaticServer } from './lib/static-server.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/stack-vibration-proof');

async function waitVibe(page, timeout = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const t = await page.evaluate(
            () => window.app?.stack?.material?.uniforms?.uVibrateT?.value ?? 0
        );
        if (t > 0.15) return t;
        await new Promise((r) => setTimeout(r, 40));
    }
    return 0;
}

async function captureTag(browser, base, w, h, tag) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.goto(`${base}/`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForFunction(() => window.__APP_STATE?.webglPhase === 'ready', { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(outDir, `stack-grain-rest-${tag}.png`), type: 'png' });
    await waitVibe(page);
    const frames = [];
    for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 55));
        const t = await page.evaluate(
            () => window.app?.stack?.material?.uniforms?.uVibrateT?.value ?? 0
        );
        const name = `stack-vibe-f${i + 1}-${tag}.png`;
        await page.screenshot({ path: path.join(outDir, name), type: 'png' });
        frames.push({ file: name, vibeT: t });
    }
    await page.close();
    return frames;
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const { baseUrl, server } = await createStaticServer(root);
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });
    const report = {
        v390: await captureTag(browser, baseUrl, 390, 844, '390'),
        v1440: await captureTag(browser, baseUrl, 1440, 900, '1440')
    };
    await browser.close();
    server.close();
    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(report, null, 2));
    console.log(report);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
