import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const port = Number(process.env.E2E_PORT ?? 8899);
let offline = false;

const TYPES = Object.freeze({
  '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.webp': 'image/webp'
});

createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (request.method === 'POST' && pathname === '/__qa__/offline') {
    offline = true;
    response.writeHead(204).end();
    return;
  }
  if (offline) {
    response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }).end('offline fixture');
    return;
  }
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(target)).isFile()) throw new Error('not a file');
    const headers = {
      'cache-control': pathname.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'content-length': String((await stat(target)).size),
      'content-type': TYPES[extname(target)] ?? 'application/octet-stream'
    };
    response.writeHead(200, headers);
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
}).listen(port, '127.0.0.1');
