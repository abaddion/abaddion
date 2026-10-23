#!/usr/bin/env node
/**
 * Lighthouse mobile ×3 — preview with Vercel automation bypass or local serve URL.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvLocal() {
    const envPath = path.join(root, '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const out = {};
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
}

function median(nums) {
    const s = nums.filter((n) => n != null && !Number.isNaN(n)).slice().sort((a, b) => a - b);
    if (!s.length) return null;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const url = args.find((a) => a.startsWith('http'));
if (!url) {
    console.error('Usage: node scripts/run-lighthouse-preview.mjs <preview-url> [--local]');
    process.exit(1);
}

const env = { ...process.env, ...loadEnvLocal() };
const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
const isVercel = url.includes('.vercel.app');

let extraHeaders = null;
if (isVercel && !isLocal) {
    if (!secret) {
        console.error('Missing VERCEL_AUTOMATION_BYPASS_SECRET in .env.local for preview runs.');
        process.exit(1);
    }
    extraHeaders = JSON.stringify({
        'x-vercel-protection-bypass': secret,
        'x-vercel-set-bypass-cookie': 'true'
    });
}

const runs = [];
for (let i = 1; i <= 3; i++) {
    const outFile = path.join('/tmp', `lh-phase12-${i}.json`);
    const lhArgs = [
        url,
        '--chrome-flags=--headless --no-sandbox',
        '--only-categories=performance',
        '--form-factor=mobile',
        '--output=json',
        `--output-path=${outFile}`,
        '--quiet'
    ];
    if (extraHeaders) {
        lhArgs.push(`--extra-headers=${extraHeaders}`);
    }
    const r = spawnSync('npx', ['lighthouse@12.8.2', ...lhArgs], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    if (r.status !== 0) {
        console.error(`Run ${i} failed`, r.stderr?.slice(0, 500));
        runs.push(null);
        continue;
    }
    const report = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    const a = report.audits;
    const scripts = (a['network-requests']?.details?.items || []).filter((x) => x.resourceType === 'Script');
    const jsTransfer = scripts.reduce((s, x) => s + (x.transferSize || 0), 0);
    const lcpEl = a['largest-contentful-paint-element']?.details?.items?.[0];
    runs.push({
        perf: Math.round(report.categories.performance.score * 100),
        lcp: a['largest-contentful-paint'].numericValue,
        lcpElement: lcpEl?.node?.snippet || lcpEl?.node?.selector || 'unknown',
        tbt: a['total-blocking-time'].numericValue,
        cls: a['cumulative-layout-shift'].numericValue,
        jsTransfer,
        finalUrl: report.finalUrl
    });
    console.log(`Run ${i}`, runs.at(-1));
}

const valid = runs.filter(Boolean);
const summary = {
    label: isLocal ? 'local (serve)' : 'preview',
    url,
    median: {
        perf: median(valid.map((r) => r.perf)),
        lcp: median(valid.map((r) => r.lcp)),
        tbt: median(valid.map((r) => r.tbt)),
        cls: median(valid.map((r) => r.cls)),
        jsTransfer: median(valid.map((r) => r.jsTransfer))
    },
    lcpElements: valid.map((r) => r.lcpElement),
    runs: valid
};
console.log('\nMEDIAN', JSON.stringify(summary, null, 2));
