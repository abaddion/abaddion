#!/usr/bin/env node
/**
 * JPEG placeholders → WebP (thumb 512, full 2048 long edge). Updates content.json paths.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/placeholder');
const contentPath = path.join(root, 'content.json');

async function convertPair(stem) {
    const thumbJpg = path.join(dir, `${stem}-thumb.jpg`);
    const fullJpg = path.join(dir, `${stem}-full.jpg`);
    if (fs.existsSync(thumbJpg)) {
        await sharp(thumbJpg)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(path.join(dir, `${stem}-thumb.webp`));
    }
    if (fs.existsSync(fullJpg)) {
        await sharp(fullJpg)
            .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(path.join(dir, `${stem}-full.webp`));
    }
    console.log('webp', stem);
}

for (let i = 1; i <= 20; i++) {
    const stem = `placeholder-${String(i).padStart(2, '0')}`;
    await convertPair(stem);
}

const data = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
const canvas = data.floors.find((f) => f.id === 'canvas');
if (canvas?.items) {
    for (const item of canvas.items) {
        if (item.thumb?.endsWith('.jpg')) item.thumb = item.thumb.replace(/\.jpg$/, '.webp');
        if (item.image?.endsWith('.jpg')) item.image = item.image.replace(/\.jpg$/, '.webp');
        item.imageWebp = item.image;
    }
}
fs.writeFileSync(contentPath, JSON.stringify(data, null, 2) + '\n');
console.log('content.json updated');
