/*
 * In-page dumper for the CLIENT app (leicht_units__781_.html) — ground truth side.
 * Injected via fetch+eval into the served app page. Drives the app's OWN state + renderGrid(),
 * then scrapes #grid into the normalized parity shape (same shape as dump-ours.js):
 *
 *   { sections:[ { sec, cards:[ { fid, sku, code, grey, rows:[{l,p:[{l,s,o}]}], tiers:[{l,s}] } ] } ] }
 *     sku  = the family unit code (openDetail 2nd arg)   code = the DISPLAYED order code (assemble())
 *     grey = card greyed (.grey)                          s = selected, o = off/unavailable
 *
 * API:  __P.nav()            → [{cat, subs:[...]}]  (+ __P.progs())
 *       __P.run(stateOvr)    → one normalized dump
 *       __P.sweep(list)      → { key: dump } for [{key, state}]
 *       __P.post(name)       → POST the accumulated results to the sink
 */
(function () {
  const $$ = (r, s) => Array.prototype.slice.call(r.querySelectorAll(s));
  const RESULTS = {};

  const DEFAULT_STATE = {
    cat: 'Base', sub: null, task: null, tsub: null, q: '', prog: null, progMap: null,
    line: 'ALL', lineGrey: false, depth: 58, width: 'ALL', height: 'ALL', tier: 'ALL',
    handle: 'std', front: 0, open: '', antoso: false, doorline: '', page: 1, fav: false,
    prices: false, card63: null, tallVH: false,
  };

  function reset() {
    Object.assign(state, DEFAULT_STATE);
    Object.keys(cardMod).forEach(k => delete cardMod[k]);
    Object.keys(cardJump).forEach(k => delete cardJump[k]);
    try { Object.keys(cardDep).forEach(k => delete cardDep[k]); } catch (e) { /* not in this build */ }
  }

  function fidOf(card) {
    const h = card.querySelector('.chead') || card.querySelector('.thumb');
    const oc = h && h.getAttribute('onclick') || '';
    const m = oc.match(/openDetail\('([^']*)','([^']*)'\)/);
    return m ? { fid: m[1], sku: m[2] } : { fid: null, sku: null };
  }

  function rowsOf(card) {
    return $$(card, '.wchips').map(r => ({
      l: ((r.querySelector('.dlbl') || {}).textContent || '').trim(),
      p: $$(r, '.wchip').map(b => ({
        l: b.textContent.trim(),
        s: b.classList.contains('sel'),
        o: b.classList.contains('wn') || b.disabled || b.classList.contains('d63off'),
      })),
    }));
  }

  function tiersOf(card) {
    return $$(card, '.bandp, .band, .bpill').map(b => ({
      l: b.textContent.trim(), s: b.classList.contains('on'),
    }));
  }

  function dump() {
    const g = document.getElementById('grid');
    const out = []; let cur = { sec: '', cards: [] }; out.push(cur);
    Array.prototype.forEach.call(g.children, n => {
      if (!n.classList) return;
      if (n.classList.contains('sechead')) { cur = { sec: n.textContent.trim(), cards: [] }; out.push(cur); return; }
      if (!n.classList.contains('card')) return;
      const id = fidOf(n);
      cur.cards.push({
        fid: id.fid, sku: id.sku,
        code: ((n.querySelector('.code') || {}).textContent || '').trim(),
        grey: n.classList.contains('grey'),
        rows: rowsOf(n), tiers: tiersOf(n),
      });
    });
    return { sections: out.filter(s => s.cards.length || s.sec) };
  }

  function run(ovr) {
    reset();
    Object.assign(state, ovr || {});
    renderGrid();
    return dump();
  }

  function nav() {
    const m = {};
    FAMS.forEach(b => { if (b.hid) return; (m[b.cat] = m[b.cat] || new Set()).add(b.sub || ''); });
    return Object.keys(m).map(cat => ({ cat, subs: Array.from(m[cat]).filter(Boolean).sort() }));
  }

  function progs() { return PROGS.map(p => ({ k: p.k, n: p.n, fam: p.fam, id: p.id != null ? p.id : null })); }

  function sweep(list) {
    list.forEach(item => { RESULTS[item.key] = run(item.state); });
    return Object.keys(RESULTS).length;
  }

  async function post(name) {
    const r = await fetch('http://localhost:8799/save?name=' + encodeURIComponent(name), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side: 'client', data: RESULTS }),
    });
    return r.json();
  }

  function clear() { Object.keys(RESULTS).forEach(k => delete RESULTS[k]); }

  window.__P = { nav, progs, run, dump, sweep, post, clear, results: RESULTS };
  return 'ok';
})();
