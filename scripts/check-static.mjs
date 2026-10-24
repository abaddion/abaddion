#!/usr/bin/env node
/**
 * Static deploy gate — no browser, no network.
 * Referenced path == exists on disk == tracked in git.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function fail(msg) {
    errors.push(msg);
}

function toRepoPath(absOrRel) {
    let p = absOrRel.replace(/\\/g, '/');
    if (p.startsWith('/')) p = p.slice(1);
    if (p.startsWith('./')) p = p.slice(2);
    return p;
}

function assertTracked(repoPath) {
    const abs = path.join(root, repoPath);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        fail(`missing file: ${repoPath}`);
        return;
    }
    const r = spawnSync('git', ['ls-files', '--error-unmatch', repoPath], { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) {
        fail(`not tracked in git: ${repoPath}`);
    }
}

function loadImportMap() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const m = html.match(/<script type="importmap">\s*([\s\S]*?)<\/script>/);
    if (!m) throw new Error('import map not found in index.html');
    return JSON.parse(m[1]).imports || {};
}

function resolveImport(spec, fromRepoFile, importMap) {
    if (spec.startsWith('http:') || spec.startsWith('https:') || spec.startsWith('data:')) return null;
    if (spec.startsWith('.')) {
        const dir = path.dirname(fromRepoFile);
        return toRepoPath(path.normalize(path.join(dir, spec)));
    }
    if (importMap[spec]) {
        const target = importMap[spec];
        if (target.startsWith('http')) return null;
        const rel = target.startsWith('./') ? target.slice(2) : target;
        return toRepoPath(rel);
    }
    const prefixes = Object.entries(importMap)
        .filter(([k]) => k.endsWith('/'))
        .sort((a, b) => b[0].length - a[0].length);
    for (const [prefix, base] of prefixes) {
        if (spec.startsWith(prefix)) {
            const tail = spec.slice(prefix.length);
            const baseRel = base.startsWith('./') ? base.slice(2) : base;
            return toRepoPath(baseRel + tail);
        }
    }
    fail(`unresolved import specifier "${spec}" from ${fromRepoFile}`);
    return null;
}

const STATIC_ASSET = /\.(js|css|json|woff2|webp|jpg|jpeg|png|svg|ico)$/i;

function collectIndexAssetPaths() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const paths = new Set();
    const attrRe = /(?:href|src)=["']([^"']+)["']/g;
    let m;
    while ((m = attrRe.exec(html)) !== null) {
        const p = m[1];
        if (p.startsWith('http') || p.startsWith('#') || p.startsWith('data:')) continue;
        const repo = toRepoPath(p.startsWith('/') ? p.slice(1) : p);
        if (!STATIC_ASSET.test(repo)) continue;
        paths.add(repo);
    }
    const importMap = loadImportMap();
    for (const v of Object.values(importMap)) {
        if (typeof v !== 'string' || v.startsWith('http') || v.endsWith('/')) continue;
        const rel = v.startsWith('./') ? v.slice(2) : v;
        paths.add(toRepoPath(rel));
    }
    return [...paths];
}

function walkJsFiles(dir, rel = 'js') {
    const out = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const nextRel = `${rel}/${ent.name}`;
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walkJsFiles(abs, nextRel));
        else if (ent.name.endsWith('.js')) out.push(nextRel);
    }
    return out;
}

function extractImportSpecifiers(source) {
    const specs = [];
    for (const line of source.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('import')) continue;
        const dynamic = t.match(/^import\s*\(\s*['"]([^'"]+)['"]/);
        if (dynamic) {
            specs.push(dynamic[1]);
            continue;
        }
        const fromClause = t.match(/\bfrom\s+['"]([^'"]+)['"]/);
        if (fromClause) specs.push(fromClause[1]);
        else {
            const sideEffect = t.match(/^import\s+['"]([^'"]+)['"]/);
            if (sideEffect) specs.push(sideEffect[1]);
        }
    }
    return specs;
}

function syntaxCheckJs(repoPath) {
    const abs = path.join(root, repoPath);
    const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
    if (r.status !== 0) {
        fail(`syntax ${repoPath}: ${(r.stderr || r.stdout || '').trim()}`);
    }
}

function validateContentJson() {
    const raw = fs.readFileSync(path.join(root, 'content.json'), 'utf8');
    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        fail(`content.json parse: ${e.message}`);
        return;
    }
    if (!data.site?.name) fail('content.json: missing site.name');
    if (!Array.isArray(data.floors) || !data.floors.length) {
        fail('content.json: floors must be a non-empty array');
        return;
    }
    const imagePaths = new Set();
    data.floors.forEach((floor, i) => {
        if (floor.index == null || floor.index === '') fail(`floor[${i}]: missing index`);
        if (!floor.label) fail(`floor[${i}]: missing label`);
        if (!floor.id) fail(`floor[${i}]: missing id`);
        if (!floor.route) fail(`floor[${i}]: missing route`);
        if (Array.isArray(floor.items)) {
            floor.items.forEach((item, j) => {
                if (!item.slug) fail(`floor[${i}].items[${j}]: missing slug`);
                if (floor.id === 'canvas' && !item.size) {
                    fail(`floor[${i}].items[${j}]: canvas item missing size`);
                }
                for (const key of ['thumb', 'image', 'imageWebp']) {
                    if (item[key]) imagePaths.add(toRepoPath(item[key].replace(/^\//, '')));
                }
            });
        }
    });
    for (const p of imagePaths) assertTracked(p);
    console.log('OK content.json', data.floors.length, 'floors', imagePaths.size, 'image paths');
}

console.log('check-static: index.html assets');
for (const p of collectIndexAssetPaths()) assertTracked(p);

console.log('check-static: js imports');
const importMap = loadImportMap();
const jsFiles = walkJsFiles(path.join(root, 'js'));
const importEdges = new Set();
for (const repoPath of jsFiles) {
    syntaxCheckJs(repoPath);
    const src = fs.readFileSync(path.join(root, repoPath), 'utf8');
    for (const spec of extractImportSpecifiers(src)) {
        const resolved = resolveImport(spec, repoPath, importMap);
        if (resolved && !resolved.endsWith('/')) {
            importEdges.add(resolved);
            assertTracked(resolved);
        }
    }
}

assertTracked('content.json');
assertTracked('index.html');
assertTracked('css/main.css');

console.log('check-static: content.json');
validateContentJson();

if (errors.length) {
    console.error('CHECK-STATIC FAILED\n' + errors.join('\n'));
    process.exit(1);
}
console.log(
    'CHECK-STATIC PASSED',
    `index+${importEdges.size} imports`,
    `${jsFiles.length} js syntax OK`
);
