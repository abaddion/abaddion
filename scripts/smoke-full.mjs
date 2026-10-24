#!/usr/bin/env node
/**
 * Full manual smoke — corridor, aspects, all viewports. Not a CI gate.
 * Usage: node scripts/smoke-full.mjs [--resume] [--shard=0/4]
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = path.join(root, 'docs/screens');

const SPA_PREFIXES = ['/canvas', '/code', '/career-pages', '/about', '/contact'];

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

const ALL_VIEWPORTS = [
    { name: '390x844', width: 390, height: 844, mobile: true },
    { name: '430x932', width: 430, height: 932, mobile: true },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '2560x1400', width: 2560, height: 1400 }
];

function parseArgs(argv) {
    let shardIndex = 0;
    let shardCount = 1;
    const shardArg = argv.find((a) => a.startsWith('--shard='));
    if (shardArg) {
        const m = shardArg.slice('--shard='.length).match(/^(\d+)\/(\d+)$/);
        if (!m) {
            console.error('Invalid --shard=N/M');
            process.exit(1);
        }
        shardIndex = Number(m[1]);
        shardCount = Number(m[2]);
    }
    return { shardIndex, shardCount, resume: argv.includes('--resume') };
}

const cli = parseArgs(process.argv.slice(2));
const errors = [];

function resolveFile(urlPath) {
    const clean = urlPath.split('?')[0].split('#')[0];
    if (clean === '/' || clean === '') return path.join(root, 'index.html');
    if (SPA_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`))) {
        return path.join(root, 'index.html');
    }
    const file = path.join(root, clean.replace(/^\//, ''));
    if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
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
        path.join(root, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')
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

let baseUrl = process.env.SMOKE_URL;
let ownedServer = null;
if (!baseUrl) {
    const started = await startStaticServer();
    ownedServer = started.server;
    baseUrl = started.baseUrl;
    console.log('Smoke server', baseUrl);
}

function pageUrl(route = '/') {
    return new URL(route, baseUrl).toString();
}

function collectAppModules() {
    const jsRoot = path.join(root, 'js');
    const out = [];
    function walk(dir, rel = '') {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const nextRel = rel ? `${rel}/${ent.name}` : ent.name;
            const abs = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(abs, nextRel);
            else if (ent.name.endsWith('.js')) out.push(`/js/${nextRel}`);
        }
    }
    walk(jsRoot);
    return out.sort();
}

const APP_MODULES = collectAppModules();

function chromeLaunchOpts() {
    const launchOpts = {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--ignore-gpu-blocklist',
            '--enable-webgl',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--use-gl=angle'
        ]
    };
    if (fs.existsSync(chrome)) launchOpts.executablePath = chrome;
    return launchOpts;
}

function progressFilePath() {
    if (process.env.SMOKE_PROGRESS_FILE) return process.env.SMOKE_PROGRESS_FILE;
    const shardTag =
        cli.shardCount > 1 ? `-shard${cli.shardIndex}of${cli.shardCount}` : '';
    return path.join(root, `.smoke-progress${shardTag}.json`);
}

function loadProgress() {
    const p = progressFilePath();
    if (!cli.resume || !fs.existsSync(p)) return { done: [] };
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
        return { done: [] };
    }
}

function markPhaseDone(phase, progress) {
    if (!progress.done.includes(phase)) progress.done.push(phase);
    fs.writeFileSync(progressFilePath(), JSON.stringify(progress, null, 2));
    console.log('checkpoint', phase);
}

async function runPhase(phase, fn, progress) {
    if (progress.done.includes(phase)) {
        console.log('skip (checkpoint)', phase);
        return;
    }
    await fn();
    markPhaseDone(phase, progress);
}

function browserDetectWebGL() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch {
        return false;
    }
}

async function assertModuleGraphLoads(page) {
    const failures = await page.evaluate(async (modules, origin) => {
        const bad = [];
        for (const m of modules) {
            try {
                await import(`${origin}${m}`);
            } catch (e) {
                const msg = e?.message || String(e);
                if (e instanceof SyntaxError || /SyntaxError|already been declared|Unexpected token/i.test(msg)) {
                    bad.push(`${m}: ${msg}`);
                }
            }
        }
        return bad;
    }, APP_MODULES, baseUrl);
    if (failures.length) throw new Error(`module graph: ${failures.join('; ')}`);
}

async function assertSwiftShaderWebGL(page) {
    const ok = await page.evaluate(browserDetectWebGL);
    if (!ok) throw new Error('browser WebGL unavailable (SwiftShader / launch args)');
}

async function runNoWebGLFallbackCase() {
    const browser = await launch(chromeLaunchOpts());
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
        const orig = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
            if (/webgl/i.test(String(type))) return null;
            return orig.call(this, type, ...rest);
        };
    });
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    await page.goto(pageUrl('/'), { waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForFunction(() => document.documentElement.classList.contains('no-webgl'), {
        timeout: 30000
    });
    await page.waitForFunction(() => window.app?.content, { timeout: 30000 });
    const boot = await page.evaluate(() => ({
        noWebgl: document.documentElement.classList.contains('no-webgl'),
        hasContent: !!window.app?.content
    }));
    if (!boot.noWebgl || !boot.hasContent) {
        await browser.close();
        throw new Error(`no-WebGL fallback failed: ${JSON.stringify(boot)}`);
    }
    const syntax = consoleErrors.filter((m) => /SyntaxError|already been declared/i.test(m));
    if (syntax.length) {
        await browser.close();
        throw new Error(`no-WebGL case console: ${syntax.join(' | ')}`);
    }
    await browser.close();
    console.log('OK no-WebGL fallback');
}

async function waitApp(page) {
    await page.goto(pageUrl('/'), { waitUntil: 'networkidle0', timeout: 90000 });
    await page.waitForFunction(() => window.app?.content, { timeout: 30000 });
    try {
        await page.waitForFunction(
            () =>
                window.app?.webgl?.bootComplete &&
                typeof window.app?.openFloor === 'function' &&
                !document.documentElement.classList.contains('no-webgl'),
            { timeout: 120000 }
        );
    } catch (err) {
        const boot = await page.evaluate(() => ({
            noWebgl: document.documentElement.classList.contains('no-webgl'),
            hasWebglLayer: !!window.app?.webgl,
            bootComplete: !!window.app?.webgl?.bootComplete,
            appState: window.__APP_STATE,
            openFloor: typeof window.app?.openFloor
        }));
        const webglErr = await page.evaluate(() => window.__WEBGL_ERR || null);
        throw new Error(
            `WebGL boot timeout (${JSON.stringify(boot)}${webglErr ? ` err=${webglErr}` : ''}): ${err.message}`
        );
    }
    const boot = await page.evaluate(() => ({
        noWebgl: document.documentElement.classList.contains('no-webgl'),
        hasWebglLayer: !!window.app?.webgl
    }));
    if (boot.noWebgl || !boot.hasWebglLayer) {
        throw new Error(`WebGL boot failed (${JSON.stringify(boot)})`);
    }
    await assertSwiftShaderWebGL(page);
}

function isBenignConsole(text) {
    return (
        /favicon/i.test(text) ||
        (/Failed to load resource/i.test(text) && /404/i.test(text)) ||
        /WebGL.*(deprecated|warning)/i.test(text)
    );
}

function attachConsoleCollectors(page, consoleErrors) {
    page.on('console', (m) => {
        if (m.type() === 'error') {
            const t = m.text();
            if (!isBenignConsole(t)) consoleErrors.push(t);
        }
    });
    page.on('pageerror', (e) => consoleErrors.push(e.message));
}

async function preparePage(browser, vp) {
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
    return page;
}

async function runFloorRailSmoke(page) {
    await page.evaluate(() => window.app.openFloor(1));
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => {
        const links = document.querySelectorAll('#floor-rail a');
        if (links[3]) links[3].click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.evaluate(() => window.app.closeFloor());
    await new Promise((r) => setTimeout(r, 500));
}

async function assertMobileChrome(page, vp) {
    const cursorPresent = await page.evaluate(() => !!document.getElementById('cursor'));
    if (cursorPresent) errors.push(`${vp.name}: custom cursor present (touch/mobile)`);

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
                !(a.right + pad < b.left || a.left - pad > b.right || a.bottom + pad < b.top || a.top - pad > b.bottom);
            const rail = document.getElementById('floor-rail')?.getBoundingClientRect();
            if (!rail?.height) return [];
            const issues = [];
            const labelRects = [];
            document.querySelectorAll('.floor-label-anno').forEach((g) => {
                if (g.getAttribute('visibility') === 'hidden') return;
                const t = g.querySelector('.floor-label-text');
                const r = t?.getBoundingClientRect();
                if (!r || r.width < 2 || r.height < 2) return;
                if (r.bottom > rail.top - pad) issues.push(`label${g.dataset.floorIndex}-in-rail`);
                labelRects.push(r);
            });
            const hintEl = document.getElementById('open-hint');
            if (hintEl && !hintEl.classList.contains('hidden')) {
                const hr = hintEl.getBoundingClientRect();
                if (hr.height > 0 && hr.bottom > rail.top - pad) issues.push('hint-in-rail');
                if (hr.height > 0) labelRects.push(hr);
            }
            for (let i = 0; i < labelRects.length; i++) {
                for (let j = i + 1; j < labelRects.length; j++) {
                    if (hit(labelRects[i], labelRects[j])) issues.push(`overlap-${i}-${j}`);
                }
            }
            return issues;
        });

        if (overlaps.length) errors.push(`${vp.name}: overlap floor ${floor}: ${overlaps.join(', ')}`);
        fs.mkdirSync(shotsDir, { recursive: true });
        await page.screenshot({ path: path.join(shotsDir, `smoke-${vp.name}-floor-${floor}.png`) });
    }
}

async function runViewportFull(vp) {
    const browser = await launch(chromeLaunchOpts());
    const page = await preparePage(browser, vp);
    const consoleErrors = [];
    attachConsoleCollectors(page, consoleErrors);

    await waitApp(page);
    fs.mkdirSync(shotsDir, { recursive: true });
    await page.screenshot({ path: path.join(shotsDir, `smoke-${vp.name}-home.png`) });

    if (vp.mobile) await assertMobileChrome(page, vp);

    const routes = ['/', '/canvas', '/code', '/about'];
    for (const r of routes) {
        await page.goto(pageUrl(r), { waitUntil: 'networkidle0', timeout: 60000 });
        await page.waitForFunction(() => window.app?.content, { timeout: 20000 });
    }

    await page.goto(pageUrl('/'), { waitUntil: 'networkidle0' });
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
        await page.waitForFunction(
            () => window.app?.webgl?.canvasDetail && !window.app.webgl.canvasDetail.el?.hidden,
            { timeout: 20000 }
        );
        await new Promise((r) => setTimeout(r, 400));
        const layout = await page.evaluate(() => {
            const d = window.app.canvasDetail;
            return d?.measureLayout?.() ?? { imgInViewport: false, overlap: true };
        });
        if (!layout.imgInViewport || layout.overlap) {
            errors.push(`${vp.name}: detail layout ${slug} ${JSON.stringify(layout)}`);
        }
        await page.evaluate(() => document.querySelector('.detail-inquire-btn')?.click());
        await new Promise((r) => setTimeout(r, 200));
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 150));
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 200));
    }
    await page.evaluate(() => window.app.closeFloor());
    await new Promise((r) => setTimeout(r, 700));

    const novaSettled = await page.evaluate(() => {
        const el = document.getElementById('nova-fallback');
        const novaPass = window.app?.postProcessing?.passes?.nova?.enabled ?? false;
        return {
            novaHidden: !el || el.hidden,
            novaTransition: document.documentElement.classList.contains('nova-transition'),
            novaPass,
            leaderLines: document.querySelectorAll('.floor-label-leader').length
        };
    });
    if (!novaSettled.novaHidden || novaSettled.novaTransition || novaSettled.novaPass) {
        errors.push(`${vp.name}: nova remnant ${JSON.stringify(novaSettled)}`);
    }
    if (novaSettled.leaderLines > 0) {
        errors.push(`${vp.name}: label leader lines present (${novaSettled.leaderLines})`);
    }

    const aboutIdx = await page.evaluate(() =>
        window.app.content.floors.findIndex((f) => f.id === 'about')
    );

    await page.evaluate((i) => window.app.openFloor(i), aboutIdx);
    await new Promise((r) => setTimeout(r, 900));
    const topBar = await page.evaluate(() => {
        const bar = document.querySelector('.floor-view-topbar')?.getBoundingClientRect();
        const title = document.querySelector('.floor-card.is-open .card-title')?.getBoundingClientRect();
        if (!bar || !title) return { ok: false };
        return { ok: title.top >= bar.bottom - 4, titleTop: title.top, barBottom: bar.bottom };
    });
    if (!topBar.ok) errors.push(`${vp.name}: top bar overlaps title ${JSON.stringify(topBar)}`);
    const crawlBefore = await page.evaluate(
        (i) => window.app.cardLayer?.getAboutCrawl?.(i)?.offset ?? 0,
        aboutIdx
    );
    await page.mouse.wheel({ deltaY: 400 });
    await new Promise((r) => setTimeout(r, 400));
    const crawlAfter = await page.evaluate(
        (i) => window.app.cardLayer?.getAboutCrawl?.(i)?.offset ?? 0,
        aboutIdx
    );
    if (crawlAfter <= crawlBefore) {
        const flat = await page.evaluate(
            () => document.querySelector('.about-crawl-scene')?.classList.contains('is-flat') ?? true
        );
        if (!flat) errors.push(`${vp.name}: about crawl did not advance on wheel`);
    }

    await page.evaluate(() => {
        const form = document.querySelector('#contact-form, .about-contact-form');
        if (!form) return;
        form.querySelector('[name="name"]').value = 'Smoke';
        form.querySelector('[name="email"]').value = 'smoke@test.com';
        form.querySelector('[name="message"]').value = 'Hello';
        form.requestSubmit();
    });
    const formOk = await page.evaluate(
        () => document.querySelector('[data-form-error]')?.hidden !== false
    );
    if (!formOk) errors.push(`${vp.name}: contact form validation failed`);

    await page.evaluate(() => window.app.closeFloor());
    await new Promise((r) => setTimeout(r, 500));

    await page.evaluate(() => window.app.openFloor(1));
    await new Promise((r) => setTimeout(r, 1000));
    const zBefore = await page.evaluate(() => window.app.webgl?.corridor?.cameraZ ?? 0);
    for (let i = 0; i < 8; i++) {
        await page.mouse.wheel({ deltaY: 120 });
        await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 400));
    const zAfter = await page.evaluate(() => window.app.webgl?.corridor?.cameraZ ?? 0);
    if (Math.abs(zAfter - zBefore) < 0.05) {
        errors.push(`${vp.name}: corridor did not walk on wheel`);
    }

    if (vp.mobile) {
        await page.waitForFunction(
            () => {
                const list = window.__APP_STATE?.corridor?.visiblePaintings;
                return list?.some((p) => p.focused && p.screenRect?.cx > 0);
            },
            { timeout: 30000 }
        );
        const tap = await page.evaluate(() => {
            const list = window.__APP_STATE?.corridor?.visiblePaintings ?? [];
            const target =
                list.find((p) => p.focused) ?? list.find((p) => p.screenRect?.cx > 0) ?? null;
            if (!target?.screenRect) return null;
            return { x: target.screenRect.cx, y: target.screenRect.cy, slug: target.slug };
        });
        if (!tap) {
            errors.push(`${vp.name}: no focused painting screenRect in __APP_STATE`);
        } else {
            await page.touchscreen.tap(tap.x, tap.y);
            try {
                await page.waitForFunction(
                    () => window.app?.webgl?.canvasDetail && !window.app.webgl.canvasDetail.el?.hidden,
                    { timeout: 20000 }
                );
            } catch {
                errors.push(`${vp.name}: corridor touch tap did not open detail (${tap.slug})`);
            }
        }
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 300));
    }

    const drawCalls = await page.evaluate(() => {
        window.app.webgl?.frameRender?.();
        return window.app?.renderer?.info?.render?.calls ?? null;
    });
    if (drawCalls != null && drawCalls > 80) {
        errors.push(`${vp.name}: high draw calls in corridor ${drawCalls}`);
    }

    await page.evaluate(() => window.app.closeFloor());
    await new Promise((r) => setTimeout(r, 500));

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
    if (railBox.left < -pad || railBox.top < -pad || railBox.right > railBox.vw + pad || railBox.bottom > railBox.vh + pad) {
        errors.push(`${vp.name}: rail clipped (${JSON.stringify(railBox)})`);
    }

    await page.screenshot({ path: path.join(shotsDir, `smoke-${vp.name}-final.png`) });
    if (consoleErrors.length) {
        errors.push(`${vp.name}: console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
    }

    await browser.close();
    console.log(`OK full ${vp.name}`);
}

/** Full suite shards: 0=global, 1=390, 2=430, 3=1440+2560 */
function fullPhasesForShard(shardIndex, shardCount) {
    if (shardCount !== 4) {
        return [
            { id: 'module-graph', run: runModuleGraphPhase },
            { id: 'no-webgl', run: runNoWebGLPhase },
            ...ALL_VIEWPORTS.map((vp) => ({ id: `viewport-${vp.name}`, run: () => runViewportFull(vp) }))
        ];
    }
    if (shardIndex === 0) {
        return [
            { id: 'module-graph', run: runModuleGraphPhase },
            { id: 'no-webgl', run: runNoWebGLPhase }
        ];
    }
    if (shardIndex === 1) {
        return [{ id: 'viewport-390x844', run: () => runViewportFull(ALL_VIEWPORTS[0]) }];
    }
    if (shardIndex === 2) {
        return [{ id: 'viewport-430x932', run: () => runViewportFull(ALL_VIEWPORTS[1]) }];
    }
    return [
        { id: 'viewport-1440x900', run: () => runViewportFull(ALL_VIEWPORTS[2]) },
        { id: 'viewport-2560x1400', run: () => runViewportFull(ALL_VIEWPORTS[3]) }
    ];
}

async function runModuleGraphPhase() {
    const probe = await launch(chromeLaunchOpts());
    const probePage = await probe.newPage();
    await probePage.goto(pageUrl('/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await assertModuleGraphLoads(probePage);
    await probe.close();
    console.log('OK module graph', APP_MODULES.length, 'modules');
}

async function runNoWebGLPhase() {
    await runNoWebGLFallbackCase();
}

async function runFullSuite() {
    const progress = loadProgress();
    const phases = fullPhasesForShard(cli.shardIndex, cli.shardCount);
    for (const phase of phases) {
        try {
            await runPhase(phase.id, phase.run, progress);
        } catch (e) {
            errors.push(`${phase.id}: ${e.message}`);
        }
    }
}

try {
    await runFullSuite();
} catch (e) {
    errors.push(e.message);
}

if (ownedServer) ownedServer.close();

if (errors.length) {
    console.error('SMOKE-FULL FAILED\n', errors.join('\n'));
    process.exit(1);
}
console.log('SMOKE-FULL PASSED');
