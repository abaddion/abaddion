#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
import { createStaticServer } from './lib/static-server.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/about-ring-speed-proof');

async function openAboutRing(page) {
    await page.goto(`${page.baseUrl}/about`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForFunction(() => document.documentElement.classList.contains('about-ring-active'), {
        timeout: 60000
    });
}

async function setSpeedStep(page, taps) {
    await page.evaluate((n) => {
        const crawl = window.app?.cardLayer?.getAboutCrawl?.(
            window.app.content.floors.findIndex((f) => f.id === 'about')
        );
        for (let i = 0; i < n; i++) crawl?._stepRingSpeed?.(-1);
        for (let i = 0; i < -n; i++) crawl?._stepRingSpeed?.(1);
    }, taps);
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const { baseUrl, server } = await createStaticServer(root);
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });
    const report = { capturedAt: new Date().toISOString(), shots: {} };

    for (const [w, h, tag] of [
        [390, 844, '390'],
        [1440, 900, '1440']
    ]) {
        const page = await browser.newPage();
        page.baseUrl = baseUrl;
        await page.setViewport({ width: w, height: h });
        await openAboutRing(page);
        await page.screenshot({ path: path.join(outDir, `ring-control-${tag}.png`) });
        report.shots[`ring-control-${tag}`] = `ring-control-${tag}.png`;

        for (const [label, step] of [
            ['slow', -2],
            ['fast', 2]
        ]) {
            await openAboutRing(page);
            if (step < 0) await setSpeedStep(page, step);
            if (step > 0) await setSpeedStep(page, step);
            let deg0 = await page.evaluate(() => window.app?.cardLayer?.getAboutCrawl?.(5)?.ring?.ringDeg ?? 0);
            for (let f = 1; f <= 3; f++) {
                await new Promise((r) => setTimeout(r, 1000));
                const deg = await page.evaluate(() => window.app?.cardLayer?.getAboutCrawl?.(5)?.ring?.ringDeg ?? 0);
                const file = `ring-${label}-f${f}-${tag}.png`;
                await page.screenshot({ path: path.join(outDir, file) });
                report.shots[file.replace('.png', '')] = file;
                if (f === 1) deg0 = deg;
                report[`${label}-${tag}-f${f}-deltaDeg`] = deg - deg0;
            }
        }
        await page.close();
    }

    await browser.close();
    server.close();
    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(report, null, 2));
    console.log(report);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});