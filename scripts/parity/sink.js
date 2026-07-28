/*
 * Generic exfil sink for the in-page parity dumpers (the Chrome extension redacts big tool
 * returns, so both dumpers POST their JSON here).
 *   node scripts/parity/sink.js [outDir]
 *   POST http://localhost:8799/save?name=<file>   → writes <outDir>/<file>.json
 *   GET  http://localhost:8799/health
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT_DIR = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && u.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  // CORS-open source server for the in-page dumpers (the app pages are on other origins)
  if (req.method === 'GET' && u.pathname === '/js') {
    const f = path.join(__dirname, path.basename(u.searchParams.get('f') || ''));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no such script'); }
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end(fs.readFileSync(f));
  }
  if (req.method === 'POST' && u.pathname === '/save') {
    const name = (u.searchParams.get('name') || 'dump').replace(/[^A-Za-z0-9._-]/g, '_');
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const p = path.join(OUT_DIR, name + '.json');
      fs.writeFileSync(p, body);
      console.log(`saved ${body.length} bytes -> ${p}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bytes: body.length, path: p }));
    });
    return;
  }
  res.writeHead(404); res.end('not found');
}).listen(8799, () => console.log('parity sink on 8799 ->', OUT_DIR));
