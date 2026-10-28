#!/usr/bin/env node
/**
 * PR B — sphere motion proof on Vercel preview (?loop=short).
 * Output: docs/product/pr10-proof/* + proof-summary.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
const LOOP_SEC_SHORT = 14;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/pr10-proof');
const previewHost =
    process.env.PR10_PREVIEW_URL ??
    process.env.PR9_PREVIEW_URL ??
    'https://glitch-portfolio-git-phase-1-7-sphere-w-abaddions-projects.vercel.app';

function loadBypass() {
    const envPath = path.join(root, '.env.local');
    if (!fs.existsSync(envPath)) return '';
    const text = fs.readFileSync(envPath, 'utf8');
    const m = text.match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
    return m?.[1]?.trim() ?? '';
}

function previewUrl(pathname = '/about') {
    const bypass = loadBypass();
    const base = previewHost.replace(/\/$/, '');
    const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const q = new URLSearchParams({ loop: 'short' });
    if (bypass) {
        q.set('x-vercel-protection-bypass', bypass);
        q.set('x-vercel-set-bypass-cookie', 'true');
    }
    return `${base}${p}?${q}`;
}

async function openAboutFloor(page) {
    await page.waitForFunction(
        () =>
            window.__APP_STATE?.bootComplete === true &&
            window.__APP_STATE?.webglPhase === 'ready' &&
            typeof window.app?.openFloor === 'function',
        { timeout: 90000 }
    );
    await page.evaluate(async () => {
        const idx = window.app.content.floors.findIndex((f) => f.id === 'about');
        window.app.openFloor(idx, true);
    });
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'open',
        { timeout: 45000 }
    );
    await page.waitForFunction(
        () =>
            window.app?.webgl?.aboutSphere?.group?.visible === true ||
            document.querySelector('.about-crawl-scene')?.classList.contains('is-sphere'),
        { timeout: 45000 }
    );
}

async function captureMotionSet(page, label, width, height) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    const loopSec = LOOP_SEC_SHORT;
    const frames = [];

    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await openAboutFloor(page);
    await new Promise((r) => setTimeout(r, 400));

    const times = [0, Math.round(loopSec * 0.45 * 1000), Math.round((loopSec + 1.5) * 1000)];
    for (let i = 0; i < times.length; i++) {
        if (i > 0) {
            const wait = times[i] - times[i - 1];
            await new Promise((r) => setTimeout(r, wait));
        }
        const state = await page.evaluate(() => ({
            webglPhase: window.__APP_STATE?.webglPhase,
            scroll: window.app?.webgl?.aboutSphere?.scroll,
            tailVisible: document.querySelector('.about-crawl-scene')?.classList.contains('tail-visible'),
            isSphere: document.querySelector('.about-crawl-scene')?.classList.contains('is-sphere'),
            dim: window.app?.webgl?.aboutSphere?.bandMaterial?.uniforms?.uDim?.value
        }));
        const file = path.join(outDir, `${label}-frame${i + 1}-t${times[i]}ms-${width}.png`);
        await page.screenshot({ path: file, fullPage: false });
        frames.push({ file: path.basename(file), tMs: times[i], state });
    }

    await page.mouse.wheel({ deltaY: 500 });
    await new Promise((r) => setTimeout(r, 500));
    const scrollAfterWheel = await page.evaluate(() => window.app?.webgl?.aboutSphere?.scroll);
    const wheelFile = path.join(outDir, `${label}-wheel-scrub-${width}.png`);
    await page.screenshot({ path: wheelFile, fullPage: false });
    frames.push({ file: path.basename(wheelFile), note: 'after wheel scrub', scrollAfterWheel });

    return frames;
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch(chromeLaunchOpts());
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

    const desktopFrames = await captureMotionSet(page, 'desktop', 1440, 900);
    const mobileFrames = await captureMotionSet(page, 'mobile', 390, 844);

    const summary = {
        previewHost,
        capturedAt: new Date().toISOString(),
        bypassUsed: Boolean(loadBypass()),
        loopShortSec: LOOP_SEC_SHORT,
        desktopFrames,
        mobileFrames,
        note: 'Three frames over time per viewport; ?loop=short on preview. Puppeteer/SwiftShader — owner verifies GPU motion.'
    };
    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(summary, null, 2));
    await browser.close();
    console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
