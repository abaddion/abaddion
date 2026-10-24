#!/usr/bin/env node
/**
 * Single desktop corridor case (1440×900): walk + center click for aspect slugs.
 * Headed by default; artifacts on first failure.
 * Usage: SMOKE_GPU=1 node scripts/smoke-desktop-corridor-case.mjs [--headless]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { acquireSmokeLock } from './lib/smoke-lock.mjs';
import { createStaticServer } from './lib/static-server.mjs';
import { chromeLaunchOpts, loadPuppeteer } from './lib/puppeteer-launch.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = path.join(root, 'docs/screens');
const vp = { name: '1440x900', width: 1440, height: 900, mobile: false };
const aspectSlugs = ['placeholder-01', 'placeholder-02', 'placeholder-03', 'placeholder-05', 'placeholder-09'];
const headless = process.argv.includes('--headless');

acquireSmokeLock('smoke-desktop-corridor-case');

async function corridorWalkToSlug(page, slug) {
    for (let step = 0; step < 80; step++) {
        const dir = await page.evaluate((s) => {
            window.app.webgl?.frameRender?.();
            const c = window.app.webgl?.corridor;
            if (!c) return null;
            const idx = c.meshes.findIndex((m) => m.userData.slug === s);
            if (idx < 0) return null;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const margin = 8;
            const list = window.__APP_STATE?.corridor?.visiblePaintings ?? [];
            const onScreen = list.some(
                (p) =>
                    p.slug === s &&
                    p.focused &&
                    p.onScreen &&
                    p.screenRect?.cx > margin &&
                    p.screenRect.cx < vw - margin &&
                    p.screenRect.cy > margin &&
                    p.screenRect.cy < vh - margin
            );
            if (onScreen) return 'done';
            if (idx !== c.focusIndex) return idx > c.focusIndex ? 'forward' : 'back';
            return 'forward';
        }, slug);
        if (dir === null) throw new Error(`corridor slug missing: ${slug}`);
        if (dir === 'done') return;
        await page.mouse.wheel({ deltaY: dir === 'forward' ? 120 : -120 });
        await new Promise((r) => setTimeout(r, 80));
    }
    throw new Error(`corridor walk timeout: ${slug}`);
}

async function getCorridorTapTarget(page, slug) {
    return page.evaluate((targetSlug) => {
        const list = window.__APP_STATE?.corridor?.visiblePaintings ?? [];
        const target = targetSlug
            ? list.find((p) => p.slug === targetSlug && p.onScreen && p.focused)
            : list.find((p) => p.focused && p.onScreen) ?? list.find((p) => p.onScreen);
        if (!target?.screenRect) return null;
        return { x: target.screenRect.cx, y: target.screenRect.cy, slug: target.slug };
    }, slug);
}

async function openDetailViaCorridorCenter(page, slug) {
    await corridorWalkToSlug(page, slug);
    await page.waitForFunction(
        (targetSlug) => {
            const list = window.__APP_STATE?.corridor?.visiblePaintings ?? [];
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const margin = 8;
            return list.some(
                (p) =>
                    p.slug === targetSlug &&
                    p.focused &&
                    p.onScreen &&
                    p.screenRect?.cx > margin &&
                    p.screenRect.cx < vw - margin &&
                    p.screenRect.cy > margin &&
                    p.screenRect.cy < vh - margin
            );
        },
        { timeout: 30000 },
        slug
    );
    await page.evaluate(() => {
        for (let i = 0; i < 10; i++) window.app.webgl?.frameRender?.();
    });
    await new Promise((r) => setTimeout(r, 350));
    let tap = await getCorridorTapTarget(page, slug);
    if (!tap) throw new Error(`no on-screen tap target (${slug})`);
    for (let attempt = 0; attempt < 2; attempt++) {
        await page.mouse.move(tap.x, tap.y);
        await page.mouse.click(tap.x, tap.y);
        try {
            await page.waitForFunction(
                () => window.app?.webgl?.canvasDetail && !window.app.webgl.canvasDetail.el?.hidden,
                { timeout: 30000 }
            );
            return;
        } catch {
            await new Promise((r) => setTimeout(r, 400));
            tap = (await getCorridorTapTarget(page, slug)) ?? tap;
        }
    }
    throw new Error(`detail did not open (${slug})`);
}

async function captureFailure(page, slug, err) {
    fs.mkdirSync(shotsDir, { recursive: true });
    const tag = `corridor-debug-${slug}`;
    const png = path.join(shotsDir, `${tag}.png`);
    const json = path.join(shotsDir, `${tag}.json`);
    await page.screenshot({ path: png, fullPage: false });
    const dump = await page.evaluate(() => ({
        error: null,
        corridor: window.__APP_STATE?.corridor ?? null,
        focusIndex: window.app?.webgl?.corridor?.focusIndex,
        cameraZ: window.app?.webgl?.corridor?.cameraZ,
        detailHidden: window.app?.webgl?.canvasDetail?.el?.hidden,
        path: location.pathname + location.search
    }));
    dump.error = err.message;
    fs.writeFileSync(json, JSON.stringify(dump, null, 2));
    console.log('artifact', png);
    console.log('artifact', json);
}

async function waitApp(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForFunction(() => window.app?.content, { timeout: 30000 });
    await page.waitForFunction(
        () =>
            window.app?.webgl?.bootComplete &&
            typeof window.app?.openFloor === 'function' &&
            !document.documentElement.classList.contains('no-webgl'),
        { timeout: 120000 }
    );
}

const started = await createStaticServer(root);
const baseUrl = started.baseUrl;
console.log('Smoke server', baseUrl);

const puppeteer = await loadPuppeteer();
const launchOpts = { ...chromeLaunchOpts(), headless: headless ? 'new' : false };
const browser = await puppeteer.launch(launchOpts);
const page = await browser.newPage();
await page.setViewport({ width: vp.width, height: vp.height });

try {
    await waitApp(page, baseUrl);
    for (const r of ['/', '/canvas', '/code', '/about']) {
        await page.goto(new URL(r, baseUrl).toString(), { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForFunction(() => window.app?.content, { timeout: 20000 });
    }
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    await waitApp(page, baseUrl);
    await page.evaluate(() => window.app.openFloor(1));
    await new Promise((r) => setTimeout(r, 900));
    await page.evaluate(() => {
        window.app.webgl?.corridor?.resetWalk?.();
        for (let i = 0; i < 12; i++) window.app.webgl?.frameRender?.();
    });
    await new Promise((r) => setTimeout(r, 400));

    for (const slug of aspectSlugs) {
        try {
            await openDetailViaCorridorCenter(page, slug);
            console.log('OK open', slug);
            await page.evaluate(() => document.querySelector('.canvas-detail .detail-back')?.click());
            await page.waitForFunction(
                () => !window.app?.webgl?.canvasDetail || window.app.webgl.canvasDetail.el?.hidden !== false,
                { timeout: 30000 }
            );
            await new Promise((r) => setTimeout(r, 250));
        } catch (e) {
            await captureFailure(page, slug, e);
            throw e;
        }
    }
    console.log('CORRIDOR-CASE PASSED');
} catch (e) {
    console.error('CORRIDOR-CASE FAILED', e.message);
    process.exitCode = 1;
} finally {
    await browser.close();
    started.server.close();
}
