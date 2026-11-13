#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
import { createStaticServer } from './lib/static-server.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/phase-2.2-floor-proof');
const previewHost = process.env.P22_PREVIEW_URL || '';

/** Stack indices: identity, code, games, career-pages */
const FLOOR_INDICES = [0, 2, 3, 4];
const OPEN_SEQUENCE_FLOOR = 2;

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

async function openFloor(page, index) {
    await page.evaluate((i) => window.app.goToFloor(i), index);
    await new Promise((r) => setTimeout(r, 900));
}

async function captureFloors(browser, base, w, h, tag) {
    const out = { floors: {}, openSequence: [], reduced: null, gameLinks: null };
    const idByIndex = { 0: 'identity', 2: 'code', 3: 'games', 4: 'career-pages' };

    for (const idx of FLOOR_INDICES) {
        const page = await browser.newPage();
        await page.setViewport({ width: w, height: h });
        await page.goto(pageUrl(base, '/'), { waitUntil: 'networkidle2', timeout: 120000 });
        await waitReady(page);
        await openFloor(page, idx);
        out.floors[idx] = await shot(page, `floor-${idByIndex[idx]}-${tag}`);
        await page.close();
    }

    const seqPage = await browser.newPage();
    await seqPage.setViewport({ width: w, height: h });
    await seqPage.goto(pageUrl(base, '/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(seqPage);
    await seqPage.evaluate((i) => window.app.goToFloor(i), OPEN_SEQUENCE_FLOOR);
    for (let frame = 0; frame < 3; frame++) {
        const delay = frame === 0 ? 80 : 160;
        await new Promise((r) => setTimeout(r, delay));
        out.openSequence.push(await shot(seqPage, `floor-code-open-f${frame + 1}-${tag}`));
    }
    await seqPage.close();

    const rmPage = await browser.newPage();
    await rmPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rmPage.setViewport({ width: w, height: h });
    await rmPage.goto(pageUrl(base, '/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(rmPage);
    await openFloor(rmPage, 3);
    out.reduced = await shot(rmPage, `floor-games-reduced-${tag}`);
    await rmPage.close();

    const gamesPage = await browser.newPage();
    await gamesPage.setViewport({ width: w, height: h });
    await gamesPage.goto(pageUrl(base, '/'), { waitUntil: 'networkidle2', timeout: 120000 });
    await waitReady(gamesPage);
    await openFloor(gamesPage, 3);
    out.gameLinks = await gamesPage.evaluate(() => {
        const links = [...document.querySelectorAll('.floor-tile--game .game-play-link')].map((a) => ({
            href: a.getAttribute('href'),
            ok: /^\/games\/[^/]+\/$/.test(a.getAttribute('href') || '')
        }));
        return { count: links.length, links, allOk: links.length === 4 && links.every((l) => l.ok) };
    });
    await gamesPage.close();

    return out;
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    let base = previewHost;
    let closeServer = () => {};
    if (!base) {
        const started = await createStaticServer(root);
        base = started.baseUrl;
        closeServer = () => started.server.close();
    } else if (!/^https?:\/\/(127\.0\.0\.1|localhost)/i.test(base) && !bypass()) {
        console.error('Missing VERCEL_AUTOMATION_BYPASS_SECRET');
        process.exit(1);
    }

    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });
    const report = {
        previewHost: base,
        capturedAt: new Date().toISOString(),
        v390: await captureFloors(browser, base, 390, 844, '390'),
        v1440: await captureFloors(browser, base, 1440, 900, '1440')
    };
    await browser.close();
    closeServer();
    fs.writeFileSync(path.join(outDir, 'proof-summary.json'), JSON.stringify(report, null, 2));
    console.log('Wrote proof-summary.json', report.v390.gameLinks);
    if (!report.v390.gameLinks?.allOk || !report.v1440.gameLinks?.allOk) process.exit(2);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
