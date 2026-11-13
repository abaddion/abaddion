#!/usr/bin/env node
/**
 * Phase 2.0a proof — Vercel preview with bypass, real input, workflow.mdc cases.
 * Usage: PR18_PREVIEW_URL=https://… node scripts/capture-phase-2.0a-proof.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
import { GAME_SMOKE } from './lib/games-inventory.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/phase-2.0a-proof');
const previewHost = process.env.PR18_PREVIEW_URL || process.env.PR10_PREVIEW_URL || '';

function loadBypass() {
    const envPath = path.join(root, '.env.local');
    if (!fs.existsSync(envPath)) return '';
    const m = fs.readFileSync(envPath, 'utf8').match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
    return m?.[1]?.trim() ?? '';
}

function previewUrl(pathname = '/', query = '') {
    if (!previewHost) throw new Error('Set PR18_PREVIEW_URL');
    const bypass = loadBypass();
    const base = previewHost.replace(/\/$/, '');
    const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const q = new URLSearchParams(query.replace(/^\?/, ''));
    if (bypass) {
        q.set('x-vercel-protection-bypass', bypass);
        q.set('x-vercel-set-bypass-cookie', 'true');
    }
    const qs = q.toString();
    return qs ? `${base}${p}?${qs}` : `${base}${p}`;
}

async function waitReady(page) {
    await page.waitForFunction(() => window.__APP_STATE?.webglPhase === 'ready', { timeout: 120000 });
}

async function stateSnap(page) {
    return page.evaluate(() => ({
        webglPhase: window.__APP_STATE?.webglPhase,
        build: document.querySelector('meta[name=build]')?.content,
        interaction: window.app?.webgl?.interactionState?.state,
        floor: window.app?.webgl?.interactionState?.floorIndex,
        frozen: window.app?.renderLoop?.isFrozen?.(),
        calls: window.app?.renderer?.info?.render?.calls ?? null
    }));
}

async function drawCallsAtRest(page) {
    return page.evaluate(() => {
        const r = window.app?.renderer;
        if (!r) return null;
        r.info.reset();
        window.app.frameRender();
        return r.info.render.calls;
    });
}

async function shot(page, name) {
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(outDir, file), type: 'png' });
    return file;
}

async function viewportCases(browser, w, h, tag) {
    const out = {};
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });

    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(page);
    await page.waitForFunction(() => document.documentElement.classList.contains('canvas-ready'), {
        timeout: 60000
    });
    out[`a-home-stack-${tag}`] = await shot(page, `a-home-stack-${tag}`);
    out.drawCallsAtRest = await drawCallsAtRest(page);

    const motionFrames = [];
    for (let i = 0; i < 3; i++) {
        if (i) await new Promise((r) => setTimeout(r, 1000));
        await page.mouse.move(80 + i * 40, 120 + i * 30);
        await page.evaluate(() => window.app?.renderLoop?.ping());
        motionFrames.push({
            i,
            file: await shot(page, `g-twinkle-f${i + 1}-${tag}`),
            state: await stateSnap(page)
        });
    }
    out.g_motion = motionFrames;

    await page.evaluate(() => window.app.renderLoop.ping());
    await page.click('#floor-rail a[href="/canvas"]');
    await new Promise((r) => setTimeout(r, 280));
    out[`b-nova-mid-${tag}`] = await shot(page, `b-nova-mid-${tag}`);
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'open',
        { timeout: 45000 }
    );
    await new Promise((r) => setTimeout(r, 700));
    out[`b-floor-open-canvas-${tag}`] = await shot(page, `b-floor-open-canvas-${tag}`);

    await page.waitForFunction(
        () => window.app?.webgl?.corridor?.root?.visible === true,
        { timeout: 45000 }
    );
    await page.mouse.wheel({ deltaY: 400 });
    await new Promise((r) => setTimeout(r, 1200));
    out[`c-corridor-${tag}`] = await shot(page, `c-corridor-${tag}`);

    const rects = await page.evaluate(() => window.__APP_STATE?.corridor?.visiblePaintings || []);
    if (rects.length) {
        const pick = rects[0];
        await page.mouse.click(pick.x + pick.w / 2, pick.y + pick.h / 2);
        await page.waitForFunction(
            () => !document.querySelector('.canvas-detail')?.hidden,
            { timeout: 20000 }
        ).catch(() => {});
        await new Promise((r) => setTimeout(r, 900));
        out[`d-detail-${tag}`] = await shot(page, `d-detail-${tag}`);
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 600));
    }

    await page.evaluate(() => window.app.closeFloor());
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'focus',
        { timeout: 30000 }
    );
    await page.click('#floor-rail a[href="/about"]');
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'open',
        { timeout: 45000 }
    );
    await new Promise((r) => setTimeout(r, 1200));
    out[`e-about-${tag}`] = await shot(page, `e-about-${tag}`);

    await page.evaluate(() => window.app.closeFloor());
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'focus',
        { timeout: 30000 }
    );

    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(page);
    await new Promise((r) => setTimeout(r, 8500));
    out[`h-freeze-${tag}`] = await shot(page, `h-freeze-${tag}`);
    out.frozenState = await stateSnap(page);

    await page.close();
    return out;
}

async function reducedMotion(browser, tag) {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(page);
    await new Promise((r) => setTimeout(r, 800));
    const file = await shot(page, `g-reduced-motion-${tag}`);
    const state = await stateSnap(page);
    await page.close();
    return { file, state };
}

async function games(browser, tag) {
    const rows = {};
    for (const game of GAME_SMOKE) {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });
        await page.goto(previewUrl(game.path), { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForFunction(game.ready, { timeout: 60000 });
        await game.interact(page);
        await new Promise((r) => setTimeout(r, 400));
        const name = `f-game-${game.slug}-${tag}`;
        rows[game.slug] = await shot(page, name);
        await page.close();
    }
    return rows;
}

async function measureInitJs(page) {
    return page.evaluate(() => {
        const entries = performance.getEntriesByType('resource');
        const space = entries.filter(
            (e) => e.name.includes('nebula-bake') || e.name.includes('stars.js')
        );
        const transfer = space.reduce((s, e) => s + (e.transferSize || 0), 0);
        const nav = performance.getEntriesByType('navigation')[0];
        return {
            spaceTransferBytes: transfer,
            domInteractive: nav?.domInteractive,
            loadEventEnd: nav?.loadEventEnd
        };
    });
}

async function main() {
    if (!previewHost) {
        console.error('Set PR18_PREVIEW_URL to the Vercel preview origin.');
        process.exit(1);
    }
    if (!loadBypass()) {
        console.error('Missing VERCEL_AUTOMATION_BYPASS_SECRET in .env.local');
        process.exit(1);
    }
    fs.mkdirSync(outDir, { recursive: true });
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });

    const report = {
        previewHost,
        capturedAt: new Date().toISOString(),
        cases: {}
    };

    report.cases.v1440 = await viewportCases(browser, 1440, 900, '1440');
    report.cases.v390 = await viewportCases(browser, 390, 844, '390');
    report.cases.reduced = await reducedMotion(browser, '390');
    report.cases.games390 = await games(browser, '390');

    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(page);
    report.metrics = {
        initJs: await measureInitJs(page),
        webglPhase: await stateSnap(page)
    };
    await page.close();

    await browser.close();
    const summaryPath = path.join(outDir, 'proof-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
    console.log('Wrote', summaryPath);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
