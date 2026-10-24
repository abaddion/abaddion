#!/usr/bin/env node
/**
 * Assert custom domain HTML build marker matches the deployment commit.
 * Optional PR #2 sanity: canvas-detail.js includes inquiry modal + corridor back.
 */

const PRODUCTION_URL = (process.env.PRODUCTION_URL || 'https://www.abaddion.com').replace(/\/$/, '');
const EXPECTED_SHA = (process.env.EXPECTED_SHA || process.env.GITHUB_SHA || '').toLowerCase();
const PLACEHOLDER = '__build_sha__';

if (!EXPECTED_SHA || !/^[0-9a-f]{40}$/.test(EXPECTED_SHA)) {
    console.error('verify-production-domain: EXPECTED_SHA must be a 40-char git commit SHA');
    process.exit(1);
}

async function fetchText(url) {
    const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'abaddion-production-verify/1.0' }
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.text();
}

function parseBuildMeta(html) {
    const m = html.match(/<meta\s+name="build"\s+content="([^"]*)"/i);
    return m ? m[1].trim().toLowerCase() : null;
}

async function main() {
    const errors = [];

    const home = await fetchText(`${PRODUCTION_URL}/`);
    const servedSha = parseBuildMeta(home);

    if (!servedSha) {
        errors.push(`${PRODUCTION_URL}: missing <meta name="build">`);
    } else if (servedSha === PLACEHOLDER || servedSha === '__build_sha__') {
        errors.push(`${PRODUCTION_URL}: build meta still placeholder (deploy did not run inject-build-meta)`);
    } else if (servedSha !== EXPECTED_SHA) {
        errors.push(
            `${PRODUCTION_URL}: build marker mismatch — domain serves ${servedSha.slice(0, 7)}, expected ${EXPECTED_SHA.slice(0, 7)} (rollback / stale alias?)`
        );
    } else {
        console.log('OK build meta', servedSha.slice(0, 7), 'matches deployment');
    }

    const detailJs = await fetchText(`${PRODUCTION_URL}/js/modules/canvas-detail.js`);
    const markers = ['detail-back', 'detail-inquiry-dialog'];
    for (const needle of markers) {
        if (!detailJs.includes(needle)) {
            errors.push(`${PRODUCTION_URL}: canvas-detail.js missing "${needle}" (stale JS bundle?)`);
        }
    }
    if (errors.length === 0) {
        console.log('OK PR2 markers in canvas-detail.js');
    }

    if (errors.length) {
        console.error('VERIFY-PRODUCTION-DOMAIN FAILED\n' + errors.join('\n'));
        process.exit(1);
    }
    console.log('VERIFY-PRODUCTION-DOMAIN PASSED', PRODUCTION_URL);
}

main().catch((e) => {
    console.error('VERIFY-PRODUCTION-DOMAIN FAILED', e.message);
    process.exit(1);
});
