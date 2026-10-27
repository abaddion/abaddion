#!/usr/bin/env node
/**
 * Vercel build — stamp index.html with VERCEL_GIT_COMMIT_SHA for domain verification.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
const PLACEHOLDER = '__BUILD_SHA__';

const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    '';

if (!sha) {
    console.error('inject-build-meta: missing VERCEL_GIT_COMMIT_SHA / GITHUB_SHA');
    process.exit(1);
}

if (!/^[0-9a-f]{40}$/i.test(sha)) {
    console.error('inject-build-meta: invalid commit SHA', sha);
    process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('name="build"')) {
    console.error('inject-build-meta: <meta name="build"> missing from index.html');
    process.exit(1);
}

if (!html.includes(PLACEHOLDER) && !html.includes(`content="${sha}"`)) {
    const replaced = html.replace(
        /(<meta\s+name="build"\s+content=")[^"]*(")/i,
        `$1${sha}$2`
    );
    if (replaced === html) {
        console.error('inject-build-meta: could not update build meta');
        process.exit(1);
    }
    html = replaced;
} else {
    html = html.replaceAll(PLACEHOLDER, sha);
}

fs.writeFileSync(indexPath, html);
console.log('inject-build-meta: stamped', sha.slice(0, 7));
