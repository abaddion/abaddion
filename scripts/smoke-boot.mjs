#!/usr/bin/env node
/**
 * Boot smoke — local static server, SwiftShader WebGL + no-WebGL fallback.
 * Waits on window.__APP_STATE / app APIs (no fixed sleeps).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStaticServer } from './lib/static-server.mjs';
import { chromeLaunchOpts, loadPuppeteer } from './lib/puppeteer-launch.mjs';
import { acquireSmokeLock } from './lib/smoke-lock.mjs';

acquireSmokeLock('smoke-boot');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOOT_TIMEOUT_MS = 45000;
const TRANSITION_TIMEOUT_MS = 30000;
const errors = [];

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

async function waitShellContent(page) {
    await page.waitForFunction(() => window.app?.content?.floors?.length > 0, {
        timeout: BOOT_TIMEOUT_MS
    });
}

async function waitWebGLBoot(page) {
    await waitShellContent(page);
    await page.waitForFunction(
        () =>
            window.__APP_STATE?.bootComplete === true &&
            typeof window.app?.openFloor === 'function' &&
            !document.documentElement.classList.contains('no-webgl'),
        { timeout: BOOT_TIMEOUT_MS }
    );
}

async function waitFloorOpen(page) {
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'open',
        { timeout: TRANSITION_TIMEOUT_MS }
    );
}

async function waitFloorFocus(page) {
    await page.waitForFunction(
        () => window.app?.webgl?.interactionState?.state === 'focus',
        { timeout: TRANSITION_TIMEOUT_MS }
    );
}

async function runWebGLCase(baseUrl) {
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch(chromeLaunchOpts());
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const consoleErrors = [];
    attachConsoleCollectors(page, consoleErrors);

    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: BOOT_TIMEOUT_MS });
    await waitWebGLBoot(page);

    await page.evaluate(() => window.app.openFloor(1));
    await waitFloorOpen(page);
    await page.evaluate(() => window.app.closeFloor());
    await waitFloorFocus(page);

    if (consoleErrors.length) {
        throw new Error(`console: ${consoleErrors.slice(0, 3).join(' | ')}`);
    }
    await browser.close();
    console.log('OK smoke-boot WebGL');
}

async function runNoWebGLCase(baseUrl) {
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch(chromeLaunchOpts());
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
        const orig = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
            if (/webgl/i.test(String(type))) return null;
            return orig.call(this, type, ...rest);
        };
    });
    const consoleErrors = [];
    attachConsoleCollectors(page, consoleErrors);

    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: BOOT_TIMEOUT_MS });
    await waitShellContent(page);
    await page.waitForFunction(
        () =>
            document.documentElement.classList.contains('no-webgl') ||
            window.__APP_STATE?.webglPhase === 'unsupported',
        { timeout: BOOT_TIMEOUT_MS }
    );

    await page.click('#floor-rail a[href="/about"]');
    await page.waitForFunction(() => window.location.pathname.replace(/\/$/, '') === '/about', {
        timeout: TRANSITION_TIMEOUT_MS
    });

    const syntax = consoleErrors.filter((m) => /SyntaxError|already been declared/i.test(m));
    if (syntax.length) throw new Error(`console: ${syntax.join(' | ')}`);

    await browser.close();
    console.log('OK smoke-boot no-WebGL fallback');
}

let baseUrl = process.env.SMOKE_URL;
let ownedServer = null;
if (!baseUrl) {
    const started = await createStaticServer(root);
    ownedServer = started.server;
    baseUrl = started.baseUrl;
    console.log('Smoke server', baseUrl);
}

try {
    await runWebGLCase(baseUrl);
} catch (e) {
    errors.push(`webgl: ${e.message}`);
}

try {
    await runNoWebGLCase(baseUrl);
} catch (e) {
    errors.push(`no-webgl: ${e.message}`);
}

if (ownedServer) ownedServer.close();

if (errors.length) {
    console.error('SMOKE-BOOT FAILED\n' + errors.join('\n'));
    process.exit(1);
}
console.log('SMOKE-BOOT PASSED');
