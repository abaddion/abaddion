#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPuppeteer, chromeLaunchOpts } from './lib/puppeteer-launch.mjs';
import { createStaticServer } from './lib/static-server.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/product/sky-sphere-proof');
const previewHost = process.env.SKY_PREVIEW_URL || '';
/** Stack floor numbers 1, 3, 6 → 0-based indices 0, 2, 5 */
const FLOORS = [0, 2, 5];

function bypass() {
    const p = path.join(root, '.env.local');
    if (!fs.existsSync(p)) return '';
    const m = fs.readFileSync(p, 'utf8').match(/^VERCEL_AUTOMATION_BYPASS_SECRET=(.+)$/m);
    return m?.[1]?.trim() ?? '';
}

function pageUrl(base) {
    const b = bypass();
    const qs = new URLSearchParams();
    if (b) {
        qs.set('x-vercel-protection-bypass', b);
        qs.set('x-vercel-set-bypass-cookie', 'true');
    }
    const tail = qs.toString();
    const host = base.replace(/\/$/, '');
    return tail ? `${host}/?${tail}` : `${host}/`;
}

async function waitReady(page) {
    await page.waitForFunction(() => window.__APP_STATE?.webglPhase === 'ready', { timeout: 120000 });
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });
    let base = previewHost;
    let closeServer = () => {};
    if (!base) {
        const started = await createStaticServer(root);
        base = started.baseUrl;
        closeServer = () => started.server.close();
    }

    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ ...chromeLaunchOpts(), protocolTimeout: 300000 });
    const shots = {};
    for (const idx of FLOORS) {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });
        await page.goto(pageUrl(base), { waitUntil: 'networkidle2', timeout: 120000 });
        await waitReady(page);
        if (idx > 0) await page.evaluate((i) => window.app.goToFloor(i), idx);
        await new Promise((r) => setTimeout(r, 900));
        const name = `sky-floor-${idx + 1}-390.png`;
        await page.screenshot({ path: path.join(outDir, name), type: 'png' });
        shots[idx] = name;
        await page.close();
    }
    await browser.close();
    closeServer();
    fs.writeFileSync(
        path.join(outDir, 'proof-summary.json'),
        JSON.stringify({ capturedAt: new Date().toISOString(), previewHost: base, floors: FLOORS, shots }, null, 2)
    );
    console.log('sky proof', shots);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
