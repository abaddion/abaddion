#!/usr/bin/env node
/**
 * Report-only: 3 samples 2s apart on prod + PR preview, About via rail click.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/about-motion-investigation');

const TARGETS = [
    { id: 'production', base: 'https://www.abaddion.com', bypass: false },
    {
        id: 'pr10-preview',
        base:
            process.env.PR10_PREVIEW_URL ??
            'https://glitch-portfolio-git-phase-17-sphere-b46373-abaddions-projects.vercel.app',
        bypass: true
    }
];

function loadBypass() {
    const envPath = path.join(root, '.env.local');
    if (!fs.existsSync(envPath)) return '';
    const m = fs.readFileSync(envPath, 'utf8').match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
    return m?.[1]?.trim() ?? '';
}

function urlFor(base, pathname, bypass) {
    const b = base.replace(/\/$/, '');
    const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const q = new URLSearchParams();
    if (bypass && loadBypass()) {
        q.set('x-vercel-protection-bypass', loadBypass());
        q.set('x-vercel-set-bypass-cookie', 'true');
    }
    const qs = q.toString();
    return qs ? `${b}${p}?${qs}` : `${b}${p}`;
}

function sampleState() {
    const aboutIdx = window.app?.content?.floors?.findIndex((f) => f.id === 'about');
    const crawl = aboutIdx >= 0 ? window.app?.cardLayer?.getAboutCrawl?.(aboutIdx) : null;
    const sphere = window.app?.webgl?.aboutSphere;
    const block = document.querySelector('.about-crawl-block');
    const transform = block ? getComputedStyle(block).transform : null;
    return {
        build: document.querySelector('meta[name=build]')?.content,
        webglPhase: window.__APP_STATE?.webglPhase,
        bootComplete: window.__APP_STATE?.bootComplete,
        noWebgl: document.documentElement.classList.contains('no-webgl'),
        reduceMotionHtml: document.documentElement.classList.contains('reduce-motion'),
        reducedMotionMatch: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        interactionState: window.app?.webgl?.interactionState?.state,
        sceneClass: document.querySelector('.about-crawl-scene')?.className ?? null,
        crawl: crawl
            ? {
                  flat: crawl.flat,
                  sphereActive: crawl.sphereActive,
                  paused: crawl.paused,
                  auto: crawl.auto,
                  offset: crawl.offset,
                  wantsSphere: crawl.wantsSphere,
                  startInSphere: crawl.startInSphere
              }
            : null,
        sphere: sphere
            ? {
                  visible: sphere.group?.visible,
                  scroll: sphere.scroll,
                  paused: sphere.paused,
                  autoScroll: sphere.autoScroll,
                  reducedMotion: sphere.reducedMotion
              }
            : null,
        flatTransform: transform,
        renderLoopFrozen: window.app?.renderLoop?.isFrozen?.(),
        renderLoopRunning: window.app?.renderLoop?.isRunning?.()
    };
}

async function openAboutViaRail(page) {
    await page.waitForSelector('#floor-rail a[href="/about"]', { timeout: 30000 });
    await page.click('#floor-rail a[href="/about"]');
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'open' || document.querySelector('.floor-card.is-open[data-floor-id="about"]'),
        { timeout: 45000 }
    );
    await new Promise((r) => setTimeout(r, 1500));
}

async function runViewport(page, target, label, width, height) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(urlFor(target.base, '/', target.bypass), {
        waitUntil: 'networkidle2',
        timeout: 120000
    });
    await page.waitForFunction(() => window.__APP_STATE?.bootComplete === true, { timeout: 90000 });
    await openAboutViaRail(page);

    const samples = [];
    for (let i = 0; i < 3; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2000));
        const state = await page.evaluate(sampleState);
        const shot = path.join(outDir, `${target.id}-${label}-t${i * 2}s-${width}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        samples.push({ tSec: i * 2, state, screenshot: path.basename(shot) });
    }
    return samples;
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 180000 });
    const page = await browser.newPage();

    const report = { capturedAt: new Date().toISOString(), targets: [] };

    for (const target of TARGETS) {
        const entry = { id: target.id, base: target.base, viewports: {} };
        try {
            entry.viewports['1440'] = await runViewport(page, target, 'desktop', 1440, 900);
            entry.viewports['390'] = await runViewport(page, target, 'mobile', 390, 844);
        } catch (e) {
            entry.error = e.message;
        }
        report.targets.push(entry);
    }

    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
