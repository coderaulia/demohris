import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3000);
const DIST_DIR = path.resolve(process.cwd(), process.env.FRONTEND_DIST_DIR || 'apps/web-react/dist');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain; charset=utf-8',
};

function normalizePath(urlPathname = '/') {
    const trimmed = String(urlPathname || '/').split('?')[0].split('#')[0];
    const safePath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    return decodeURIComponent(safePath);
}

async function readFileSafe(filePath) {
    try {
        const data = await fs.readFile(filePath);
        return data;
    } catch {
        return null;
    }
}

async function resolveFile(requestPath) {
    const directPath = path.resolve(DIST_DIR, requestPath);
    if (!directPath.startsWith(DIST_DIR)) return null;

    try {
        const stat = await fs.stat(directPath);
        if (stat.isDirectory()) {
            const indexPath = path.join(directPath, 'index.html');
            const indexData = await readFileSafe(indexPath);
            if (indexData) {
                return { filePath: indexPath, data: indexData };
            }
        } else {
            const data = await readFileSafe(directPath);
            if (data) {
                return { filePath: directPath, data };
            }
        }
    } catch {
        return null;
    }

    return null;
}

function contentTypeFor(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

async function serveSpaFallback(res) {
    const indexPath = path.join(DIST_DIR, 'index.html');
    const indexData = await readFileSafe(indexPath);
    if (!indexData) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            error: {
                code: 'DIST_NOT_FOUND',
                message: `Could not load frontend build at ${DIST_DIR}`,
            },
        }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(indexData);
}

const server = createServer(async (req, res) => {
    try {
        const method = String(req.method || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD') {
            res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET and HEAD are supported.' } }));
            return;
        }

        const requestPath = normalizePath(req.url || '/');

        if (requestPath.startsWith('api/')) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                error: {
                    code: 'API_NOT_AVAILABLE',
                    message: 'No API runtime is enabled on this frontend-only Hostinger deployment.',
                },
            }));
            return;
        }

        const resolved = await resolveFile(requestPath || 'index.html');
        if (resolved) {
            res.writeHead(200, { 'Content-Type': contentTypeFor(resolved.filePath) });
            if (method === 'HEAD') {
                res.end();
                return;
            }
            res.end(resolved.data);
            return;
        }

        await serveSpaFallback(res);
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            error: {
                code: 'SERVER_ERROR',
                message: error instanceof Error ? error.message : 'Unexpected server error',
            },
        }));
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[hostinger-frontend-server] serving ${DIST_DIR} on port ${PORT}`);
});

