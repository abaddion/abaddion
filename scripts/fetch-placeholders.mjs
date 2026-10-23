#!/usr/bin/env node
/**
 * Download picsum placeholders into assets/placeholder/ (run once, commit outputs).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets/placeholder');

const specs = [
    { id: '01', w: 600, h: 800, ratio: '3/4' },
    { id: '02', w: 800, h: 1000, ratio: '4/5' },
    { id: '03', w: 800, h: 800, ratio: '1/1' },
    { id: '04', w: 800, h: 600, ratio: '4/3' },
    { id: '05', w: 1280, h: 720, ratio: '16/9' },
    { id: '06', w: 600, h: 1200, ratio: '1/2' },
    { id: '07', w: 1200, h: 400, ratio: '3/1' },
    { id: '08', w: 700, h: 900, ratio: '3/4' },
    { id: '09', w: 900, h: 900, ratio: '1/1' },
    { id: '10', w: 1000, h: 625, ratio: '16/10' },
    { id: '11', w: 640, h: 960, ratio: '2/3' },
    { id: '12', w: 960, h: 640, ratio: '3/2' },
    { id: '13', w: 800, h: 1000, ratio: '4/5' },
    { id: '14', w: 1280, h: 800, ratio: '16/10' },
    { id: '15', w: 800, h: 800, ratio: '1/1' },
    { id: '16', w: 720, h: 1280, ratio: '9/16' },
    { id: '17', w: 1280, h: 720, ratio: '16/9' },
    { id: '18', w: 600, h: 900, ratio: '2/3' },
    { id: '19', w: 1500, h: 500, ratio: '3/1' },
    { id: '20', w: 800, h: 600, ratio: '4/3' }
];

async function download(url, dest) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
}

fs.mkdirSync(outDir, { recursive: true });

for (const s of specs) {
    const seed = `abaddion-${s.id}`;
    const fullUrl = `https://picsum.photos/seed/${seed}/${s.w}/${s.h}`;
    const thumbUrl = `https://picsum.photos/seed/${seed}-t/512/512`;
    const fullPath = path.join(outDir, `placeholder-${s.id}-full.jpg`);
    const thumbPath = path.join(outDir, `placeholder-${s.id}-thumb.jpg`);
    process.stdout.write(`fetch ${s.id}… `);
    await download(fullUrl, fullPath);
    await download(thumbUrl, thumbPath);
    console.log('ok');
}

const canvasItems = specs.map((s, i) => ({
    slug: `placeholder-${s.id}`,
    title: `Placeholder ${String(i + 1).padStart(2, '0')}`,
    year: 2024 + (i % 3),
    medium: 'placeholder medium',
    size: `${s.w}×${s.h}`,
    aspectRatio: s.ratio.replace('/', ' / '),
    thumb: `/assets/placeholder/placeholder-${s.id}-thumb.jpg`,
    image: `/assets/placeholder/placeholder-${s.id}-full.jpg`,
    placeholder: true,
    approved: true
}));

const contentPath = path.join(root, 'content.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
const canvasFloor = content.floors.find((f) => f.id === 'canvas');
canvasFloor.items = canvasItems;
canvasFloor.body = 'PLACEHOLDER grid stress test';

const codeFloor = content.floors.find((f) => f.id === 'code');
codeFloor.items = codeFloor.items.slice(0, 3).map((item, i) => ({
    ...item,
    thumb: `/assets/placeholder/placeholder-${String(i + 1).padStart(2, '0')}-thumb.jpg`,
    placeholder: true
}));

const aboutFloor = content.floors.find((f) => f.id === 'about');
aboutFloor.body =
    'PLACEHOLDER long about copy for scroll testing. '.repeat(40) +
    'End of placeholder about section.';

fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + '\n');
console.log('Updated content.json');
