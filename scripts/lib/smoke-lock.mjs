import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lockPath = path.join(root, '.smoke-run.lock');

function release() {
    try {
        if (fs.existsSync(lockPath)) {
            const raw = fs.readFileSync(lockPath, 'utf8');
            if (raw.includes(`pid=${process.pid}`)) fs.unlinkSync(lockPath);
        }
    } catch {
        /* ignore */
    }
}

/** Exit if another smoke script holds `.smoke-run.lock`. */
export function acquireSmokeLock(scriptLabel) {
    if (fs.existsSync(lockPath)) {
        const existing = fs.readFileSync(lockPath, 'utf8').trim();
        console.error(`Smoke already running (${existing}). Stop it before starting another.`);
        process.exit(1);
    }
    fs.writeFileSync(
        lockPath,
        `${scriptLabel} pid=${process.pid} started=${new Date().toISOString()}\n`
    );
    process.on('exit', release);
    process.on('SIGINT', () => {
        release();
        process.exit(130);
    });
    process.on('SIGTERM', () => {
        release();
        process.exit(143);
    });
}
