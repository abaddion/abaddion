#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
import { createStaticServer } from './lib/static-server.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/phase-2.1-stack-proof');
const previewHost = process.env.P21_PREVIEW_URL || '';

function bypass() {
    const p = path.join(root, '.env.local');
    if (!fs.existsSync(p)) return '';
    const m = fs.readFileSync(p, 'utf8').match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
    return m?.[1]?.trim() ?? '';
}

function pageUrl(base, pathname = '/') {
    const b = bypass();
    const qs = new URLSearchParams();
    if (b) {
        qs.set('x-vercel-protection-bypass', b);
        qs.set('x-vercel-set-bypass-cookie', 'true');
    }
    const tail = qs.toString();
    const host = base.replace(/\/$/, '');
    return tail ? `${host}${pathname}?${tail}` : `${host}${pathname}`;
}

async function waitReady(page) {
    await page.waitForFunction(() => window.__APP_STATE?.webglPhase === 'ready', { timeout: 120000 });
}

async function shot(page, name) {
    const f = `${name}.png`;
    await page.screenshot({ path: path.join(outDir, f), type: 'png' });
    return f;
}

async function captureStack(browser, base, w, h, tag, floors) {
    const out = { floors: {}, glitch: [], frozen: null, reduced: null, drawCalls: null };
    for (const idx of floors) {
        const page = await browser.newPage();
        await page.setViewport({ width: w, height: h });
        await page.goto(pageUrl(base, '/'), { waitUntil: 'networkidle2', timeout: 120000 });
        await waitReady(page);
        await page.evaluate((i) => window.app.goToFloor(i), idx);
        await new Promise((r) => setTimeout(r, 700));
        out.floors[idx] = await shot(page, `stack-focus-${idx}-${tag}`);
        const metrics = await page.evaluate(() => ({
            stackDrawCalls: window.__APP_STATE?.stackDrawCalls,
            renderCalls: window.__APP_STATE?.renderCalls,
            webglPhase: window.__APP_STATE?.webglPhase
        }));
        out.drawCalls = metrics;
        await page.close();
    }

    const glitchPage = await browser.newPage();
    await glitchPage.setViewport({ width: w, height: h });
    await glitchPage.goto(pageUrl(base, '/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(glitchPage);
    for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 4200 : 1200));
        out.glitch.push(await shot(glitchPage, `stack-glitch-f${i + 1}-${tag}`));
    }
    await glitchPage.close();

    const freezePage = await browser.newPage();
    await freezePage.setViewport({ width: w, height: h });
    await freezePage.goto(pageUrl(base, '/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(freezePage);
    await new Promise((r) => setTimeout(r, 9000));
    out.frozen = await shot(freezePage, `stack-frozen-${tag}`);
    await freezePage.close();

    const rmPage = await browser.newPage();
    await rmPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rmPage.setViewport({ width: w, height: h });
    await rmPage.goto(pageUrl(base, '/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(rmPage);
    await new Promise((r) => setTimeout(r, 800));
    out.reduced = await shot(rmPage, `stack-reduced-${tag}`);
    await rmPage.close();

    return out;
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    let base = previewHost;
    let closeServer = () => {};
    const local = !base;
    if (local) {
        const started = await createStaticServer(root);
        base = started.baseUrl;
        closeServer = () => started.server.close();
    } else if (!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(base) && !bypass()) {
        console.error('Missing VERCEL_AUTOMATION_BYPASS_SECRET');
        process.exit(1);
    }

    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });
    const floors = [0, 2, 4];
    const report = {
        previewHost: base,
        capturedAt: new Date().toISOString(),
        v390: await captureStack(browser, base, 390, 844, '390', floors),
        v1440: await captureStack(browser, base, 1440, 900, '1440', floors)
    };
    await browser.close();
    closeServer();
    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(report, null, 2));
    console.log('Wrote proof-summary.json');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
