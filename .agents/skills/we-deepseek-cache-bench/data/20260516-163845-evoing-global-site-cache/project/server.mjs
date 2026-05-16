import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, 'src');
const PORT = 5173;
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function resolvePath(url) {
  let pathname = new URL(url, 'http://localhost').pathname;
  if (pathname === '/') pathname = '/index.html';
  return join(ROOT, pathname);
}

function isPathSafe(resolved) {
  return resolved.startsWith(ROOT);
}

const server = createServer(async (req, res) => {
  try {
    const filePath = resolvePath(req.url);
    if (!isPathSafe(filePath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Evoing global site running at http://${HOST}:${PORT}`);
});
