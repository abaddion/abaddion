#!/usr/bin/env node
/** Proof: about sphere + flat, home stars, nova sequence. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/hotfix-about-stars-nova-proof');
const host = process.env.HOTFIX_PREVIEW_URL || '';

function bypass() {
    const p = path.join(root, '.env.local');
    if (!fs.existsSync(p)) return '';
    const m = fs.readFileSync(p, 'utf8').match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
    return m?.[1]?.trim() ?? '';
}

function url(pathname = '/', q = '') {
    const b = bypass();
    const base = host.replace(/\/$/, '');
    const qs = new URLSearchParams(q.replace(/^\?/, ''));
    if (b) {
        qs.set('x-vercel-protection-bypass', b);
        qs.set('x-vercel-set-bypass-cookie', 'true');
    }
    const tail = qs.toString();
    return tail ? `${base}${pathname}?${tail}` : `${base}${pathname}`;
}

async function waitReady(page) {
    await page.waitForFunction(() => window.__APP_STATE?.webglPhase === 'ready', { timeout: 120000 });
}

async function shot(page, name) {
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(outDir, file), type: 'png' });
    return file;
}

async function openAbout(page) {
    const idx = await page.evaluate(() => window.app.content.floors.findIndex((f) => f.id === 'about'));
    await page.evaluate((i) => window.app.openFloor(i), idx);
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'open',
        { timeout: 45000 }
    );
    await new Promise((r) => setTimeout(r, 900));
}

async function aboutProof(browser, w, h, tag) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.goto(url('/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(page);
    await openAbout(page);
    const out = { sphere: [], flat: [] };
    for (let i = 0; i < 3; i++) {
        if (i) await new Promise((r) => setTimeout(r, 1000));
        out.sphere.push(await shot(page, `about-sphere-f${i + 1}-${tag}`));
    }
    await page.click('.about-read-toggle');
    await page.waitForFunction(
        () => document.querySelector('.about-crawl-scene')?.classList.contains('is-flat'),
        { timeout: 10000 }
    );
    await new Promise((r) => setTimeout(r, 400));
    for (let i = 0; i < 3; i++) {
        if (i) await new Promise((r) => setTimeout(r, 1000));
        out.flat.push(await shot(page, `about-flat-f${i + 1}-${tag}`));
    }
    const copy = await page.evaluate(() => ({
        flatLen: document.querySelector('.about-crawl-copy')?.textContent?.trim().length ?? 0,
        titleOk: (() => {
            const bar = document.querySelector('.floor-view-topbar--about')?.getBoundingClientRect();
            const title = document.querySelector('.floor-view-floor-title')?.getBoundingClientRect();
            return Boolean(bar && title && title.top >= bar.top + 40);
        })(),
        sphereScroll: window.app?.webgl?.aboutSphere?.scroll ?? null
    }));
    out.copy = copy;
    await page.close();
    return out;
}

async function homeStars(browser, w, h, tag) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.goto(url('/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(page);
    await new Promise((r) => setTimeout(r, 600));
    const file = await shot(page, `home-stars-${tag}`);
    await page.close();
    return file;
}

async function novaSequence(browser, w, h, tag) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.goto(url('/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(page);
    const canvasIdx = await page.evaluate(() =>
        window.app.content.floors.findIndex((f) => f.id === 'canvas')
    );
    await page.click('#floor-rail a[href="/canvas"]');
    const frames = [];
    for (let t = 0; t < 3; t++) {
        await new Promise((r) => setTimeout(r, t === 0 ? 80 : 220));
        frames.push(await shot(page, `nova-f${t + 1}-${tag}`));
    }
    await page.close();
    return frames;
}

async function main() {
    if (!host) {
        console.error('Set HOTFIX_PREVIEW_URL');
        process.exit(1);
    }
    const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(host);
    if (!local && !bypass()) {
        console.error('Missing VERCEL_AUTOMATION_BYPASS_SECRET');
        process.exit(1);
    }
    fs.mkdirSync(outDir, { recursive: true });
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });
    const report = {
        previewHost: host,
        capturedAt: new Date().toISOString(),
        v390: await aboutProof(browser, 390, 844, '390'),
        v1440: await aboutProof(browser, 1440, 900, '1440'),
        home: {
            '390': await homeStars(browser, 390, 844, '390'),
            '1440': await homeStars(browser, 1440, 900, '1440')
        },
        nova: {
            '390': await novaSequence(browser, 390, 844, '390'),
            '1440': await novaSequence(browser, 1440, 900, '1440')
        }
    };
    await browser.close();
    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(report, null, 2));
    console.log('Wrote', path.join(outDir, 'proof-summary.json'));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
