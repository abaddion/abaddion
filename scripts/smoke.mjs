#!/usr/bin/env node
/**
 * Pre-deploy smoke — puppeteer @ 390×844, 1440×900, 2560×1400
 * Starts a local static server (SPA rewrites) unless SMOKE_URL is set.
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = path.join(root, 'docs/screens');
const errors = [];

const SPA_PREFIXES = [
    '/canvas',
    '/code',
    '/career-pages',
    '/about',
    '/contact'
];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml'
};

function resolveFile(urlPath) {
    const clean = urlPath.split('?')[0].split('#')[0];
    if (clean === '/' || clean === '') {
        return path.join(root, 'index.html');
    }
    if (SPA_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`))) {
        return path.join(root, 'index.html');
    }
    const file = path.join(root, clean.replace(/^\//, ''));
    if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return file;
    }
    return null;
}

function startStaticServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const file = resolveFile(req.url || '/');
            if (!file) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            const ext = path.extname(file);
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
        });
    });
}

async function loadPuppeteer() {
    const candidates = [
        path.join(root, 'node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js'),
        path.join(root, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'),
        '/tmp/glitch-measure/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            const mod = await import(pathToFileURL(p).href);
            return mod.default ?? mod;
        }
    }
    throw new Error('puppeteer not found — run npm install');
}

const puppeteer = await loadPuppeteer();
const { launch } = puppeteer;

const chrome =
    process.env.CHROME_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const viewports = [
    { name: '390x844', width: 390, height: 844, mobile: true },
    { name: '430x932', width: 430, height: 932, mobile: true },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '2560x1400', width: 2560, height: 1400 }
];

async function assertMobileChrome(page, vp) {
    const cursorPresent = await page.evaluate(() => !!document.getElementById('cursor'));
    if (cursorPresent) {
        errors.push(`${vp.name}: custom cursor present (touch/mobile)`);
    }

    for (let floor = 0; floor < 5; floor++) {
        await page.evaluate((idx) => window.app.goToFloor(idx), floor);
        await new Promise((r) => setTimeout(r, 1500));
        await page.evaluate(() => window.app.webgl?.renderLoop?.ping?.());
        await new Promise((r) => setTimeout(r, 400));

        await page.evaluate(() => {
            for (let i = 0; i < 24; i++) window.app.frameRender?.();
        });

        const overlaps = await page.evaluate(() => {
            const pad = 2;
            const hit = (a, b) =>
                !(
                    a.right + pad < b.left ||
                    a.left - pad > b.right ||
                    a.bottom + pad < b.top ||
                    a.top - pad > b.bottom
                );
            const rail = document.getElementById('floor-rail')?.getBoundingClientRect();
            if (!rail?.height) return [];
            const issues = [];
            const labelRects = [];
            document.querySelectorAll('.floor-label-anno').forEach((g) => {
                if (g.getAttribute('visibility') === 'hidden') return;
                const t = g.querySelector('.floor-label-text');
                const r = t?.getBoundingClientRect();
                if (!r || r.width < 2 || r.height < 2) return;
                if (r.bottom > rail.top - pad) {
                    issues.push(`label${g.dataset.floorIndex}-in-rail`);
                }
                labelRects.push(r);
            });
            const hintEl = document.getElementById('open-hint');
            if (hintEl && !hintEl.classList.contains('hidden')) {
                const hr = hintEl.getBoundingClientRect();
                if (hr.height > 0 && hr.bottom > rail.top - pad) issues.push('hint-in-rail');
                if (hr.height > 0) labelRects.push({ id: 'hint', ...hr });
            }
            for (let i = 0; i < labelRects.length; i++) {
                for (let j = i + 1; j < labelRects.length; j++) {
                    if (hit(labelRects[i], labelRects[j])) {
                        issues.push(`overlap-${i}-${j}`);
                    }
                }
            }
            return issues;
        });

        if (overlaps.length) {
            errors.push(`${vp.name}: overlap floor ${floor}: ${overlaps.join(', ')}`);
        }

        await page.screenshot({
            path: path.join(shotsDir, `smoke-${vp.name}-floor-${floor}.png`)
        });
    }
}

let baseUrl = process.env.SMOKE_URL;
let ownedServer = null;
if (!baseUrl) {
    const started = await startStaticServer();
    ownedServer = started.server;
    baseUrl = started.baseUrl;
    console.log('Smoke server', baseUrl);
}

function smokeUrl(path = '/') {
    const u = new URL(path, baseUrl);
    u.searchParams.set('smoke', '1');
    return u.toString();
}

async function waitApp(page) {
    await page.goto(smokeUrl('/'), { waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForFunction(() => window.app?.content, { timeout: 30000 });
    try {
        await page.waitForFunction(
            () =>
                window.app?.webgl?.bootComplete &&
                window.app?.webgl?.canvasDetail &&
                typeof window.app?.openFloor === 'function',
            { timeout: 120000 }
        );
    } catch (err) {
        const boot = await page.evaluate(() => ({
            noWebgl: document.documentElement.classList.contains('no-webgl'),
            hasWebglLayer: !!window.app?.webgl,
            bootComplete: !!window.app?.webgl?.bootComplete,
            hasDetail: !!window.app?.webgl?.canvasDetail,
            openFloor: typeof window.app?.openFloor
        }));
        throw new Error(`WebGL boot timeout (${JSON.stringify(boot)}): ${err.message}`);
    }
    const boot = await page.evaluate(() => ({
        noWebgl: document.documentElement.classList.contains('no-webgl'),
        hasWebglLayer: !!window.app?.webgl
    }));
    if (boot.noWebgl || !boot.hasWebglLayer) {
        throw new Error(`WebGL boot failed (${JSON.stringify(boot)})`);
    }
}

async function getState(page) {
    return page.evaluate(() => {
        const s = window.app?.webgl?.interactionState;
        return s ? { state: s.state, floorIndex: s.floorIndex, ageMs: s.ageMs?.() } : { state: 'html' };
    });
}

function isBenignConsole(text) {
    return (
        /favicon/i.test(text) ||
        (/Failed to load resource/i.test(text) && /404/i.test(text)) ||
        /WebGL.*(deprecated|warning)/i.test(text)
    );
}

async function runViewport(vp) {
    const launchOpts = {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--ignore-gpu-blocklist',
            '--enable-webgl',
            '--use-gl=swiftshader'
        ]
    };
    if (fs.existsSync(chrome)) {
        launchOpts.executablePath = chrome;
    }
    const browser = await launch(launchOpts);
    const page = await browser.newPage();
    if (vp.mobile) {
        await page.emulate({
            viewport: {
                width: vp.width,
                height: vp.height,
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true
            },
            userAgent:
                'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        });
    } else {
        await page.setViewport({ width: vp.width, height: vp.height });
    }
    const consoleErrors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') {
            const t = m.text();
            if (!isBenignConsole(t)) consoleErrors.push(t);
        }
    });
    page.on('pageerror', (e) => consoleErrors.push(e.message));

    await waitApp(page);
    fs.mkdirSync(shotsDir, { recursive: true });
    await page.screenshot({ path: path.join(shotsDir, `smoke-${vp.name}-home.png`) });

    if (vp.mobile) {
        await assertMobileChrome(page, vp);
    }

    const routes = ['/', '/canvas', '/code', '/about'];
    for (const r of routes) {
        await page.goto(smokeUrl(r), { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForFunction(() => window.app?.content, { timeout: 20000 });
    }

    await page.goto(smokeUrl('/'), { waitUntil: 'networkidle0' });
    await waitApp(page);

    for (let i = 0; i < 6; i++) {
        await page.mouse.wheel({ deltaY: 120 });
        await new Promise((r) => setTimeout(r, 200));
    }
    for (let i = 0; i < 6; i++) {
        await page.mouse.wheel({ deltaY: -120 });
        await new Promise((r) => setTimeout(r, 200));
    }

    await page.evaluate(() => window.app.openFloor(1));
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => {
        const links = document.querySelectorAll('#floor-rail a');
        if (links[3]) links[3].click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.evaluate(() => window.app.openFloor(1));
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => window.app.closeFloor());
    await new Promise((r) => setTimeout(r, 800));

    await page.evaluate(() => window.app.openFloor(1));
    await new Promise((r) => setTimeout(r, 900));
    for (let i = 0; i < 12; i++) {
        await page.mouse.wheel({ deltaY: 100 });
        await new Promise((r) => setTimeout(r, 80));
    }
    const aspectSlugs = ['placeholder-01', 'placeholder-02', 'placeholder-03', 'placeholder-05', 'placeholder-09'];
    for (const slug of aspectSlugs) {
        await page.evaluate((s) => window.app.openCanvasDetail(s), slug);
        await new Promise((r) => setTimeout(r, 600));
        const layout = await page.evaluate(() => {
            const d = window.app.canvasDetail;
            return d?.measureLayout?.() ?? { imgInViewport: false, overlap: true };
        });
        if (!layout.imgInViewport || layout.overlap) {
            errors.push(`${vp.name}: detail layout ${slug} ${JSON.stringify(layout)}`);
        }
        await page.evaluate(() => {
            document.querySelector('.detail-inquire-btn')?.click();
        });
        await new Promise((r) => setTimeout(r, 200));
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 150));
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 200));
    }
    await page.evaluate(() => window.app.closeFloor());
    await new Promise((r) => setTimeout(r, 700));

    for (let i = 0; i < 20; i++) {
        await page.mouse.wheel({ deltaY: i % 2 ? 80 : -80 });
    }
    await new Promise((r) => setTimeout(r, 250));

    const stuck = await page.evaluate(() => {
        const s = window.app?.webgl?.interactionState;
        if (!s) return false;
        return s.isTransitioning() && s.ageMs() > 1500;
    });
    if (stuck) errors.push(`${vp.name}: transition stuck >1.5s`);

    const railBox = await page.evaluate(() => {
        const el = document.getElementById('floor-rail');
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
    });
    const pad = 2;
    if (
        railBox.left < -pad ||
        railBox.top < -pad ||
        railBox.right > railBox.vw + pad ||
        railBox.bottom > railBox.vh + pad
    ) {
        errors.push(`${vp.name}: rail clipped (${JSON.stringify(railBox)})`);
    }

    const finalState = await getState(page);
    await page.screenshot({ path: path.join(shotsDir, `smoke-${vp.name}-final.png`) });
    if (consoleErrors.length) {
        errors.push(`${vp.name}: console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
    }

    await browser.close();
    console.log(`OK viewport ${vp.name}`, finalState);
}

for (const vp of viewports) {
    try {
        await runViewport(vp);
    } catch (e) {
        errors.push(`${vp.name}: ${e.message}`);
    }
}

if (ownedServer) {
    ownedServer.close();
}

if (errors.length) {
    console.error('SMOKE FAILED\n', errors.join('\n'));
    process.exit(1);
}
console.log('SMOKE PASSED');
