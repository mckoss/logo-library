#!/usr/bin/env node
// Serves the demo host site (demo/site/, from npm run hosts) the way
// mckoss.com's static hosting does: directory index pages, a redirect to the
// trailing slash, and the right types for modules, styles and Logo files.
//
// Usage: npm run serve   (PORT=8790 by default; HOST=127.0.0.1)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'site');
const port = Number(process.env.PORT) || 8790;
const host = process.env.HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.lgo': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8', head = false) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(head ? undefined : body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed\n');
  const head = req.method === 'HEAD';
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request\n');
  }
  const file = path.join(root, pathname);
  if (file !== root && !file.startsWith(root + path.sep)) return send(res, 403, 'Forbidden\n');

  let target = file;
  let stat = fs.statSync(target, { throwIfNoEntry: false });
  if (stat?.isDirectory()) {
    if (!pathname.endsWith('/')) {
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      res.writeHead(301, { Location: pathname + '/' + query });
      return res.end();
    }
    target = path.join(target, 'index.html');
    stat = fs.statSync(target, { throwIfNoEntry: false });
  }
  if (!stat?.isFile()) return send(res, 404, `Not found: ${pathname}\n`);

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  if (head) return res.end();
  fs.createReadStream(target).pipe(res);
});

server.listen(port, host, () => {
  console.log(`Serving ${path.relative(process.cwd(), root) || root} at http://${host === '127.0.0.1' ? 'localhost' : host}:${port}/`);
});
