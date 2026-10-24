import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

export async function loadPuppeteer() {
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

export function chromeLaunchOpts() {
    const chrome =
        process.env.CHROME_PATH ||
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
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
