/*
 * Tiny sink for the in-page extractor's `H.post(url)`. The Chrome extension
 * redacts large tool returns, so the extractor POSTs the whole export here and
 * this writes it to disk. CORS-open so a fetch from the served app page works.
 *
 *   node scripts/extract-sink.js            # writes docs/export-v781-fresh.json
 *   POST http://localhost:8799/save         # body = the export JSON
 *   GET  http://localhost:8799/health       # {ok:true}
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8799;
const OUT = path.join(__dirname, '..', 'docs', 'export-v781-fresh.json');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  if (req.method === 'POST' && req.url === '/save') {
    const chunks = [];
    let bytes = 0;
    req.on('data', (c) => {
      chunks.push(c);
      bytes += c.length;
    });
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      fs.writeFileSync(OUT, body);
      // quick sanity: item count
      let n = -1;
      try {
        n = JSON.parse(body.toString('utf8')).items.length;
      } catch {
        /* ignore */
      }
      console.log(`saved ${bytes} bytes -> ${OUT} (items=${n})`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bytes, items: n, path: OUT }));
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => console.log(`extract-sink listening on ${PORT}, writing ${OUT}`));
