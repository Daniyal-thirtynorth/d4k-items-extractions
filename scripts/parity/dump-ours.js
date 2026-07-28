/*
 * In-page dumper for OUR lite UI (D4K-backend/public/design-book-ui.html).
 * Injected via fetch+eval at http://localhost:8000/design-book/ui. Drives the UI's own filter
 * object `F` + load(), then scrapes #grid into the SAME normalized shape as dump-client.js:
 *
 *   { sections:[ { sec, cards:[ { fid, sku, code, grey, rows:[{l,p:[{l,s,o}]}], tiers:[{l,s}] } ] } ] }
 *
 * API:  __Q.run(filters,opts) → dump (awaits load + settle for the async per-card swaps)
 *       __Q.sweep(list)       → { key: dump } for [{key, filters}]
 *       __Q.post(name)        → POST accumulated results to the sink
 */
(function () {
  const $$ = (r, s) => Array.prototype.slice.call(r.querySelectorAll(s));
  const RESULTS = {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function rowsOf(card) {
    return $$(card, '.row').map(r => ({
      l: ((r.querySelector('.rl') || {}).textContent || '').trim(),
      p: $$(r, '.cp').map(b => ({
        l: b.textContent.trim(),
        s: b.classList.contains('sel'),
        o: b.classList.contains('off') || b.classList.contains('dead') || b.classList.contains('xed'),
      })),
    }));
  }
  function tiersOf(card) {
    return $$(card, '.progpills .cp').map(b => ({ l: b.textContent.trim(), s: b.classList.contains('sel') }));
  }

  function dump() {
    const g = document.getElementById('grid');
    const out = []; let cur = { sec: '', cards: [] }; out.push(cur);
    Array.prototype.forEach.call(g.children, n => {
      if (!n.classList) return;
      if (n.classList.contains('sechdr')) {
        cur = { sec: ((n.querySelector('.st') || {}).textContent || '').trim(), cards: [] }; out.push(cur); return;
      }
      if (!n.classList.contains('card')) return;
      const it = n.__item || {};
      cur.cards.push({
        fid: it.familyId || null,
        sku: n.dataset.sku || null,
        code: n.dataset.code || n.dataset.sku || '',
        grey: n.classList.contains('cardgrey'),
        rows: rowsOf(n), tiers: tiersOf(n),
      });
    });
    return { sections: out.filter(s => s.cards.length || s.sec) };
  }

  async function run(filters, opts) {
    opts = opts || {};
    Object.keys(F).forEach(k => delete F[k]);
    Object.keys(LABELS).forEach(k => delete LABELS[k]);
    Object.assign(F, filters || {});
    const lim = document.querySelector('#limit');
    if (lim) { // the limit control is a <select> — add the option we want if it isn't one of the presets
      const v = String(opts.limit || 200);
      if (lim.tagName === 'SELECT' && !Array.prototype.some.call(lim.options, o => o.value === v)) {
        const o = document.createElement('option'); o.value = v; o.textContent = v; lim.appendChild(o);
      }
      lim.value = v;
    }
    const q = document.querySelector('#q'); if (q) q.value = '';
    const kind = document.querySelector('#kind'); if (kind) kind.value = '';
    const fam = document.querySelector('#fFamily'); if (fam) fam.checked = true;
    const prog = document.querySelector('#progSel'); if (prog) prog.value = F.programs || '';
    page = 1;
    await load();
    // load() fires applyHeightPreselect / option-swaps async (per-card fetches). Wait for the
    // UI's own in-flight swap counter to drain, then a short tail for the re-render.
    const t0 = Date.now();
    await sleep(150);
    while ((window.__inflight || 0) > 0 && Date.now() - t0 < (opts.maxWait || 30000)) await sleep(120);
    await sleep(opts.settle || 300);
    return dump();
  }

  async function sweep(list, opts) {
    for (const item of list) RESULTS[item.key] = await run(item.filters, opts);
    return Object.keys(RESULTS).length;
  }

  async function post(name) {
    const r = await fetch('http://localhost:8799/save?name=' + encodeURIComponent(name), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side: 'ours', data: RESULTS }),
    });
    return r.json();
  }

  function clear() { Object.keys(RESULTS).forEach(k => delete RESULTS[k]); }

  window.__Q = { run, dump, sweep, post, clear, results: RESULTS };
  return 'ok';
})();
