#!/usr/bin/env node
/**
 * Non-gating: HEAD index.html asset URLs on a deployed preview/production URL.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function collectIndexAssetPaths() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const paths = new Set();
    const attrRe = /(?:href|src)=["']([^"']+)["']/g;
    let m;
    while ((m = attrRe.exec(html)) !== null) {
        const p = m[1];
        if (p.startsWith('http') || p.startsWith('#') || p.startsWith('data:')) continue;
        paths.add(p.startsWith('/') ? p : `/${p}`);
    }
    const mapMatch = html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/);
    if (mapMatch) {
        const map = JSON.parse(mapMatch[1]);
        for (const v of Object.values(map.imports || {})) {
            if (typeof v !== 'string' || v.startsWith('http')) continue;
            const rel = v.startsWith('./') ? v.slice(1) : v.startsWith('/') ? v : `/${v}`;
            paths.add(rel.startsWith('/') ? rel : `/${rel}`);
        }
    }
    return [...paths].sort();
}

const deployBase = (process.env.DEPLOY_URL || process.env.SMOKE_DEPLOY_URL || '').replace(/\/$/, '');
if (!deployBase) {
    console.error('DEPLOY_URL or SMOKE_DEPLOY_URL required');
    process.exit(1);
}

const headers = {};
const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (secret) {
    headers['x-vercel-protection-bypass'] = secret;
    headers['x-vercel-set-bypass-cookie'] = 'true';
}

const paths = collectIndexAssetPaths();
const bad = [];
for (const p of paths) {
    const url = `${deployBase}${p}`;
    try {
        const res = await fetch(url, { method: 'HEAD', headers, redirect: 'follow' });
        if (res.status !== 200) bad.push(`${p} → ${res.status}`);
    } catch (e) {
        bad.push(`${p} ${e.message}`);
    }
}

if (bad.length) {
    console.error('PREVIEW ASSET CHECK FAILED\n' + bad.join('\n'));
    process.exit(1);
}
console.log('PREVIEW ASSET CHECK OK', paths.length, deployBase);
