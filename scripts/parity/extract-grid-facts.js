/*
 * P0 of the §L parity fix: dump the FAMILY + UNIT facts the app's grid-row builders read and our
 * export never carried. Injected into v781 (served on 8777), POSTs to the sink.
 *
 * Why these fields: the app's card rows come from the FAMILY POOL, not from one unit's detail panel —
 *   ppool(b)      needs  b.byprog, b._hasOp, b._hasP  + u.fam, u.op, u._ag
 *   hvals(b)      needs  u.hc  + lineHFilterB → b.noline
 *   wsAtH / dAll  needs  u.w, u.dv, u.vr
 *   the row SET   needs  b.dim ('height'|'width'|'depth'|'hd'|'none') + b.vlbl/b.slbl labels
 *   never-grey    needs  isAccessory(b) / isProgAgnostic(b)     (app v163)
 *   depth 63      needs  d63Cfg(b) → {mode, force68}            (d63Eligible = cfg != null)
 *   tierOk twin   needs  u.sib, u.fam, u.op
 *   Line row      needs  u.J, u.Yc, u.E, u.V
 *
 *   __G.run()  → {families, units}     __G.post('grid-facts-v781')
 */
(function () {
  function run() {
    const families = {}, units = {};
    FAMS.forEach((b, i) => {
      const c63 = (typeof d63Cfg === 'function') ? d63Cfg(b) : null;
      families[b.id] = {
        i, cat: b.cat, sub: b.sub, sec: b.sec || null, pri: b.pri != null ? b.pri : null,
        // the DISPLAY sub (what the sidebar filters on and the export stores) + the family's rank
        // inside its sub's curated SECTION_ORDER. Both are needed to render a card for a family
        // that is NOT the item's primary one — a `*__CKDUP` / `MRG_*` duplicate sits in its own
        // cat/sub/sec with its own order.
        subDisp: (typeof subDisp === 'function') ? subDisp(b) : b.sub,
        secRank: (function () {
          const d = (typeof subDisp === 'function') ? subDisp(b) : b.sub;
          const so = (typeof SECTION_ORDER !== 'undefined' && SECTION_ORDER)
            ? (SECTION_ORDER[d] || (typeof secOrderKey === 'function' ? SECTION_ORDER[secOrderKey(d)] : null) || [])
            : [];
          const i2 = so.indexOf(b.sec || '');
          return i2 < 0 ? 999 : i2;
        })(),
        label: b.label || null, hid: !!b.hid,
        dim: b.dim || null,                       // which numeric row the card renders
        vlbl: b.vlbl || null, slbl: b.slbl || null, vfmt: b.vfmt || null,
        cho: b.cho || null, vfin: !!b.vfin,
        // the RENDERED variant-chip labels (app `_vrLbl`): vmap → Vero type name → the XIG_*_B
        // L3/M3 · M8 pair → "<n> cm" for vfmt:'cm' → the raw code.
        vlabels: (function () {
          const out = {}; const xig = b.id && b.id.startsWith('XIG_') && b.id.endsWith('_B');
          const seen = [];
          b.units.forEach(u => { if (u.vr != null && !seen.includes(u.vr)) seen.push(u.vr); });
          seen.forEach(vv => {
            const l = (b.vmap && b.vmap[vv])
              || (typeof veroTypeLabel === 'function' ? veroTypeLabel(vv) : null)
              || (xig ? ({ D: 'L3/M3', DU: 'M8' })[vv] : null)
              || (b.vfmt === 'cm' ? String(vv).replace(/^[A-Za-z]+/, '') + ' cm' : null);
            if (l && l !== vv) out[vv] = l;
          });
          return Object.keys(out).length ? out : null;
        })(),
        // the family's member codes, in the app's own order. Needed because `units` below is keyed
        // by code and a DUP family (`*__CKDUP` / `*__DRWDUP` / `*__SNKDUP` / `*__TRDUP` / `MRG_*`)
        // re-uses the SAME codes as its origin family — the map can only remember one owner.
        codes: b.units.map((u) => u.c),
        byprog: !!b.byprog, hasOp: !!b._hasOp, hasP: !!b._hasP, noline: !!b.noline,
        tiers: b._tiers || null, anyP1: !!b._anyP1, anyC1: !!b._anyC1, mem: b._mem || null,
        acc: !!(typeof isAccessory === 'function' && isAccessory(b)),
        agn: !!(typeof isProgAgnostic === 'function' && isProgAgnostic(b)),
        d63: c63 ? { mode: c63.mode, force68: !!c63.force68 } : null,
      };
      b.units.forEach(u => {
        // KEYED BY FAMILY + CODE. A unit record belongs to ONE family, and a code that is a member
        // of several families has a SEPARATE record in each — `TR90LL3` is `w: 90` in L32345 and
        // `w: null` in its other family. Keying by code alone let the last family written win,
        // which stripped the width off that unit and killed L32345's whole W row.
        units[b.id + '|' + u.c] = {
          fid: b.id,
          fam: u.fam || null, op: u.op || null, ag: !!u._ag, sib: u.sib || null,
          hc: u.hc != null ? u.hc : null, w: u.w != null ? u.w : null,
          // the app compares heights with STRICT === (`x.hc===selH` in wsAtH / dAll), so a unit
          // whose hc is literally `null` never matches one whose hc is `undefined`. 4 units in
          // v781 (all ANBL) are null — that is what keeps ANBL's W and D rows off the card.
          hcNull: u.hc === null,
          dv: u.dv != null ? u.dv : null, vr: u.vr != null ? u.vr : null,
          // u.ins — the "Insert" row key; its presence is the family flag `b.insAx` (1:1 in v781).
          ins: u.ins != null ? u.ins : null,
          d: u.d || null,
          V: !!u.V, E: !!u.E, J: !!u.J, Yc: u.Yc || null, P1: !!u.P1, C1: !!u.C1,
        };
      });
    });
    return { meta: { build: 'v781', families: Object.keys(families).length, units: Object.keys(units).length }, families, units };
  }
  async function post(name) {
    const r = await fetch('http://localhost:8799/save?name=' + encodeURIComponent(name), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run()),
    });
    return r.json();
  }
  window.__G = { run, post };
  return 'ok';
})();
