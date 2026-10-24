// Local dev server: loads .env, proxies /api/* into the Vercel handler, serves ui/dist.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import handler from '../api/index.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'ui', 'dist');
const PORT = Number(process.env.PORT) || 4321;

// .env -> process.env (also map NEXT_PUBLIC_* / SUPABASE_SERVICE_KEY to canonical names)
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}
const alias = { NEXT_PUBLIC_SUPABASE_URL: 'SUPABASE_URL', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY', SUPABASE_SERVICE_KEY: 'SUPABASE_SERVICE_ROLE_KEY' };
for (const [from, to] of Object.entries(alias)) if (process.env[from] && !process.env[to]) process.env[to] = process.env[from];

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };

http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    if (req.method !== 'GET' && String(req.headers['content-type']).startsWith('application/json')) {
      let b = '';
      for await (const c of req) b += c;
      req.body = JSON.parse(b || '{}');
    }
    return handler(req, res);
  }
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Studio dev → http://localhost:${PORT}`));
