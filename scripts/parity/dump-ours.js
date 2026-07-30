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

  // A pill the user cannot see is not a pill. The "217+" heightExtension chip keeps its options in a
  // `display:none` span until tapped (the app builds them on click, so they are absent from ITS DOM)
  // — scraping them made every tall card look like it had 3 extra H pills.
  const visible = b => b.getClientRects().length > 0;

  function rowsOf(card) {
    return $$(card, '.row').map(r => ({
      l: ((r.querySelector('.rl') || {}).textContent || '').trim(),
      p: $$(r, '.cp').filter(visible).map(b => ({
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

  // ⚠️ ONE RUN AT A TIME. `run()` mutates the page-global `F` and then scrapes `#grid`, so two
  // concurrent runs interleave and each records the other's grid. This bit once: a `__Q.sweep(...)`
  // call hit the 45 s CDP timeout, the tool reported failure, but the page kept the loop alive — a
  // second sweep started on top of it and the first 45 keys of that leg came back holding a
  // NEIGHBOURING key's grid (37 fake MEMBER/SECT diffs, indices 0-44, everything after index 44
  // clean). A CDP timeout does NOT cancel the promise: always drive long sweeps through a
  // fire-and-forget starter plus a progress poll, never a single awaited call.
  let BUSY = false;
  async function run(filters, opts) {
    if (BUSY) throw new Error('dump-ours: a run is already in flight — refusing to interleave');
    BUSY = true;
    try { return await run_(filters, opts); } finally { BUSY = false; }
  }

  async function run_(filters, opts) {
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
    page = opts.page || 1;
    // `grey` is not a filter — the UI reads `window.__GREY` inside params() (the app's "Grey don't
    // hide" checkbox). A sweep normally pins it to false to measure the HIDE semantics, so a
    // grey=true state has to flip it around this one load and put it back after the scrape.
    const prevGrey = window.__GREY;
    if (opts.grey != null) window.__GREY = !!opts.grey;
    await load();
    // load() fires applyHeightPreselect / option-swaps async (per-card fetches). Wait for the
    // UI's own in-flight swap counter to drain, then a short tail for the re-render.
    const t0 = Date.now();
    await sleep(150);
    while ((window.__inflight || 0) > 0 && Date.now() - t0 < (opts.maxWait || 30000)) await sleep(120);
    await sleep(opts.settle || 300);
    const d = dump();
    if (opts.grey != null) window.__GREY = prevGrey;
    return d;
  }

  // ⚠️ `run()` RETURNS a dump, it does not record one. Only `sweep()` writes into RESULTS, and
  // `post()` sends RESULTS. So the fire-and-forget starter the comment above prescribes must keep
  // its OWN map and POST that — a hand-rolled `for (…) await __Q.run(…)` loop followed by
  // `__Q.post(name)` writes `{"data":{}}` and the diff then reports every key as "missing on ours"
  // after the full leg has already run. (Cost one 15-minute E3 leg on 2026-07-30.)
  //   window.__MY={}; …  __MY[st.key] = await __Q.run(st.filters, st.opts||{});  … POST {data:__MY}
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
