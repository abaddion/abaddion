import fs from 'fs';
import http from 'http';
import path from 'path';

const SPA_PREFIXES = ['/canvas', '/code', '/career-pages', '/about', '/contact'];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml'
};

export function createStaticServer(root) {
    function resolveFile(urlPath) {
        const clean = urlPath.split('?')[0].split('#')[0];
        if (clean === '/' || clean === '') return path.join(root, 'index.html');
        if (SPA_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`))) {
            return path.join(root, 'index.html');
        }
        const file = path.join(root, clean.replace(/^\//, ''));
        if (file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
        return null;
    }

    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const file = resolveFile(req.url || '/');
            if (!file) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            const ext = path.extname(file);
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
        });
    });
}
