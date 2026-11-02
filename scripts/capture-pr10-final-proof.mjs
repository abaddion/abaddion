#!/usr/bin/env node
/**
 * PR #10 final proof — sphere, ?about=flat, reduced-motion.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/pr10-proof-v2');
const previewHost =
    process.env.PR10_PREVIEW_URL ??
    'https://glitch-portfolio-git-phase-17-sphere-b46373-abaddions-projects.vercel.app';

function loadBypass() {
    const envPath = path.join(root, '.env.local');
    if (!fs.existsSync(envPath)) return '';
    const m = fs.readFileSync(envPath, 'utf8').match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
    return m?.[1]?.trim() ?? '';
}

function previewUrl(pathname = '/', query = '') {
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

function sampleState() {
    const aboutIdx = window.app?.content?.floors?.findIndex((f) => f.id === 'about');
    const crawl = aboutIdx >= 0 ? window.app?.cardLayer?.getAboutCrawl?.(aboutIdx) : null;
    const sphere = window.app?.webgl?.aboutSphere;
    const block = document.querySelector('.about-crawl-block');
    return {
        webglPhase: window.__APP_STATE?.webglPhase,
        build: document.querySelector('meta[name=build]')?.content,
        sceneClass: document.querySelector('.about-crawl-scene')?.className,
        reducedMotionMatch: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        reduceMotionHtml: document.documentElement.classList.contains('reduce-motion'),
        crawlOffset: crawl?.offset ?? null,
        sphereScroll: sphere?.scroll ?? null,
        flatTransform: block ? getComputedStyle(block).transform : null
    };
}

async function waitReady(page) {
    await page.waitForFunction(() => window.__APP_STATE?.webglPhase === 'ready', {
        timeout: 90000
    });
}

async function openAboutRail(page) {
    await page.waitForSelector('#floor-rail a[href="/about"]', { timeout: 30000 });
    await page.click('#floor-rail a[href="/about"]');
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'open',
        { timeout: 45000 }
    );
    await new Promise((r) => setTimeout(r, 800));
}

async function frames1s(page, prefix, width) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1000));
        const state = await page.evaluate(sampleState);
        const file = `${prefix}-f${i + 1}-${width}.png`;
        await page.screenshot({ path: path.join(outDir, file), fullPage: false });
        rows.push({ tSec: i, file, state });
    }
    return rows;
}

async function runCase(browser, { label, width, height, media, pathname = '/', startQuery = '', afterOpen }) {
    const page = await browser.newPage();
    await page.emulateMediaFeatures(media);
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(previewUrl(pathname, startQuery), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(page);
    if (afterOpen) await afterOpen(page);
    else if (pathname.replace(/\/$/, '') !== '/about') await openAboutRail(page);
    else {
        await page.waitForFunction(
            () => window.app?.webgl?.interactionState?.state === 'open',
            { timeout: 45000 }
        );
        await new Promise((r) => setTimeout(r, 800));
    }
    const rows = await frames1s(page, label, width);
    await page.close();
    return rows;
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 240000 });
    const report = { previewHost, capturedAt: new Date().toISOString(), cases: {} };

    report.cases.sphere1440 = await runCase(browser, {
        label: 'sphere-desktop',
        width: 1440,
        height: 900,
        media: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
        pathname: '/',
        startQuery: ''
    });
    report.cases.sphere390 = await runCase(browser, {
        label: 'sphere-mobile',
        width: 390,
        height: 844,
        media: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
        pathname: '/',
        startQuery: ''
    });
    report.cases.flat390 = await runCase(browser, {
        label: 'flat-mobile',
        width: 390,
        height: 844,
        media: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
        pathname: '/about',
        startQuery: 'about=flat'
    });
    report.cases.reduce390 = await runCase(browser, {
        label: 'reduce-mobile',
        width: 390,
        height: 844,
        media: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        pathname: '/about',
        startQuery: ''
    });

    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
