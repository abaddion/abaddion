#!/usr/bin/env node
/**
 * One-off: PR #9 preview proof screenshots (Vercel bypass from .env.local).
 * Output: docs/screens/pr9-proof/*.png + proof-summary.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/pr9-proof');
const previewHost =
    process.env.PR9_PREVIEW_URL ??
    'https://glitch-portfolio-git-fix-about-never-6e2ed4-abaddions-projects.vercel.app';

function loadBypass() {
    const envPath = path.join(root, '.env.local');
    if (!fs.existsSync(envPath)) return '';
    const text = fs.readFileSync(envPath, 'utf8');
    const m = text.match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
    return m?.[1]?.trim() ?? '';
}

function previewUrl(pathname = '/') {
    const bypass = loadBypass();
    const base = previewHost.replace(/\/$/, '');
    const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
    if (!bypass) return `${base}${p}`;
    const q = new URLSearchParams({
        'x-vercel-protection-bypass': bypass,
        'x-vercel-set-bypass-cookie': 'true'
    });
    return `${base}${p}?${q}`;
}

async function waitWebGL(page, timeoutMs = 50000) {
    try {
        await page.waitForFunction(
            () =>
                window.__APP_STATE?.webglPhase === 'ready' ||
                window.__APP_STATE?.webglPhase === 'failed' ||
                window.__APP_STATE?.webglPhase === 'unsupported',
            { timeout: timeoutMs }
        );
    } catch {
        /* continue with whatever state we have */
    }
}

async function captureSet(page, label, width, height) {
    await page.setViewport({ width, height, deviceScaleFactor: height >= 800 ? 2 : 2 });
    const shots = [];

    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 90000 });
    await waitWebGL(page);
    await new Promise((r) => setTimeout(r, 1200));
    const homePath = path.join(outDir, `${label}-home-${width}.png`);
    await page.screenshot({ path: homePath, fullPage: false });
    shots.push(homePath);

    await page.goto(previewUrl('/about'), { waitUntil: 'networkidle2', timeout: 90000 });
    await waitWebGL(page);
    await new Promise((r) => setTimeout(r, 1500));
    const aboutDirect = path.join(outDir, `${label}-about-direct-${width}.png`);
    await page.screenshot({ path: aboutDirect, fullPage: false });
    shots.push(aboutDirect);

    await page.goto(previewUrl('/'), { waitUntil: 'networkidle2', timeout: 90000 });
    await waitWebGL(page);
    await page.waitForSelector('#floor-rail a[href="/about"]', { timeout: 15000 });
    await page.click('#floor-rail a[href="/about"]');
    await page.waitForFunction(() => location.pathname.replace(/\/$/, '') === '/about', {
        timeout: 15000
    });
    await new Promise((r) => setTimeout(r, 1500));
    const aboutRail = path.join(outDir, `${label}-about-rail-${width}.png`);
    await page.screenshot({ path: aboutRail, fullPage: false });
    shots.push(aboutRail);

    return shots;
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch(chromeLaunchOpts());
    const page = await browser.newPage();

    const threeHeaders = {};
    page.on('response', async (res) => {
        const u = res.url();
        if (u.includes('three.module.min.js')) {
            const h = res.headers();
            threeHeaders.url = u;
            threeHeaders.status = res.status();
            threeHeaders.contentType = h['content-type'];
            threeHeaders.cacheControl = h['cache-control'];
        }
    });

    await captureSet(page, 'desktop', 1440, 900);
    await captureSet(page, 'mobile', 390, 844);

    await page.goto(previewUrl('/about'), { waitUntil: 'networkidle2', timeout: 90000 });
    await waitWebGL(page);
    const appState = await page.evaluate(() => ({
        build: document.querySelector('meta[name=build]')?.content,
        webglPhase: window.__APP_STATE?.webglPhase,
        webglBootError: window.__APP_STATE?.webglBootError,
        webglInitError: window.__APP_STATE?.webglInitError,
        noWebgl: document.documentElement.classList.contains('no-webgl'),
        floorOpen: document.documentElement.classList.contains('floor-open'),
        openId: document.querySelector('.floor-card.is-open')?.dataset?.floorId,
        crawlClass: document.querySelector('.about-crawl-scene')?.className,
        flatCopyLen: document.querySelector('.about-crawl-copy')?.textContent?.length ?? 0,
        heroIntro: document.querySelector('.identity-intro')?.textContent,
        heroVisible: (() => {
            const el = document.querySelector('.identity-hero');
            if (!el) return null;
            const s = getComputedStyle(el);
            return { visibility: s.visibility, opacity: s.opacity };
        })()
    }));

    const consolePath = path.join(outDir, 'proof-console-state.png');
    await page.evaluate((state) => {
        document.body.insertAdjacentHTML(
            'beforeend',
            `<pre id="pr9-proof-overlay" style="position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#111;color:#ece8df;font:11px monospace;padding:8px;max-height:40vh;overflow:auto;border-top:1px solid #444">${JSON.stringify(state, null, 2)}</pre>`
        );
    }, { ...appState, threeModule: threeHeaders });
    await page.screenshot({ path: consolePath, fullPage: false });

    const summary = {
        previewHost,
        capturedAt: new Date().toISOString(),
        bypassUsed: Boolean(loadBypass()),
        threeModule: threeHeaders,
        appState,
        note:
            'Puppeteer uses SwiftShader WebGL when available (same as smoke-boot). Cursor embedded browser cannot access SSO previews without bypass.'
    };
    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(summary, null, 2));

    await browser.close();
    console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
