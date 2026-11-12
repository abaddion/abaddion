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
const CLARITY_PLACEHOLDER = '<!-- __CLARITY_SNIPPET__ -->';

function claritySnippet(projectId) {
    if (!projectId || !/^[a-z0-9]+$/i.test(projectId)) return '';
    return [
        '<script>',
        '(function(c,l,a,r,i,t,y){',
        'c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};',
        't=l.createElement(r);t.async=1;',
        `t.src="https://www.clarity.ms/tag/"+i;`,
        'y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);',
        `})(window,document,"clarity","script","${projectId}");`,
        '</script>'
    ].join('');
}

function injectClarity(html) {
    // Public client ID (override with CLARITY_PROJECT_ID on Vercel if needed).
    const id = process.env.CLARITY_PROJECT_ID?.trim() || 'zcn4aq0rzr';
    if (!html.includes('__CLARITY_SNIPPET__')) {
        console.warn('inject-build-meta: __CLARITY_SNIPPET__ placeholder missing');
        return html;
    }
    const snippet = claritySnippet(id);
    if (id) {
        console.log('inject-build-meta: clarity project', id);
    }
    return html.replace(CLARITY_PLACEHOLDER, snippet);
}

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

html = injectClarity(html);

const gamesDir = path.join(root, 'games');
if (fs.existsSync(gamesDir)) {
    for (const name of fs.readdirSync(gamesDir)) {
        const gameIndexPath = path.join(gamesDir, name, 'index.html');
        if (!fs.existsSync(gameIndexPath)) continue;
        let gameHtml = fs.readFileSync(gameIndexPath, 'utf8');
        gameHtml = injectClarity(gameHtml);
        fs.writeFileSync(gameIndexPath, gameHtml);
        console.log('inject-build-meta: clarity stamped games/' + name);
    }
}

fs.writeFileSync(indexPath, html);
console.log('inject-build-meta: stamped', sha.slice(0, 7));
