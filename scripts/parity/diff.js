#!/usr/bin/env node
/*
 * Diff a CLIENT dump against an OURS dump (both produced by scripts/parity/dump-*.js, same keys).
 *   node scripts/parity/diff.js <client.json> <ours.json> [report.json]
 *
 * Reports, per combo key:
 *   MEMBER  families shown on one side only
 *   FACE    same family, different face sku
 *   CODE    same face, different DISPLAYED order code
 *   GREY    card greyed on one side only
 *   SECT    section header list / order differs
 *   ORDER   card order within a section differs (families equal)
 *   ROWSET  a card's pill-row label set differs
 *   PILLS   same row, different pill labels
 *   STATE   same row+pills, different selected / off flags
 */
const fs = require('fs');

const [, , cliPath, oursPath, reportPath] = process.argv;
if (!cliPath || !oursPath) { console.error('usage: diff.js <client.json> <ours.json> [report.json]'); process.exit(1); }
const cli = JSON.parse(fs.readFileSync(cliPath, 'utf8')).data;
const ours = JSON.parse(fs.readFileSync(oursPath, 'utf8')).data;

const NUM = s => String(s == null ? '' : s).replace(/[^0-9]/g, '');
// row-label aliases: the app labels some rows with the family's own `slbl`/`vlbl`
const ALIAS = { Depth: 'D', Width: 'W', Height: 'H', Type: 'Ty' };
const norm = l => { const s = String(l || '').trim(); return ALIAS[s] || s; };

// Our UI greys where the app HIDES (deliberate: `?grey=true`, audit §F(1) depth grey-not-hide).
// A family we show GREY that the app doesn't show at all is that known deviation, not a membership
// bug — bucket it separately so real gaps stay visible. `--keep-grey` disables the normalization.
const KEEP_GREY = process.argv.includes('--keep-grey');

function byFid(dump) {
  const m = {};
  (dump.sections || []).forEach((s, si) => (s.cards || []).forEach((c, ci) => {
    if (c.fid) m[c.fid] = Object.assign({ _sec: s.sec, _si: si, _ci: ci }, c);
  }));
  return m;
}
function rowMap(card) {
  const m = {};
  (card.rows || []).forEach(r => { if (!m[norm(r.l)]) m[norm(r.l)] = r.p || []; });
  return m;
}

const out = { MEMBER: [], FACE: [], CODE: [], GREY: [], SECT: [], ORDER: [], ROWSET: [], PILLS: [], STATE: [], GREY_NOT_HIDE: [] };
const keys = Object.keys(cli).filter(k => ours[k]);
const missing = Object.keys(cli).filter(k => !ours[k]);

for (const key of keys) {
  const C = cli[key];
  let O = ours[key];
  if (!KEEP_GREY) {   // strip OUR grey-only extras (the app hides them) → bucket GREY_NOT_HIDE
    const shown = new Set(); (C.sections || []).forEach(s => (s.cards || []).forEach(c => shown.add(c.fid)));
    const dropped = [];
    O = {
      sections: (O.sections || []).map(s => ({
        sec: s.sec,
        cards: (s.cards || []).filter(c => {
          if (c.grey && !shown.has(c.fid)) { dropped.push(c.fid); return false; }
          return true;
        }),
      })).filter(s => s.cards.length || (C.sections || []).some(cs => cs.sec === s.sec)),
    };
    if (dropped.length) out.GREY_NOT_HIDE.push({ key, fids: dropped });
  }
  const cf = byFid(C), of = byFid(O);
  const cFids = Object.keys(cf), oFids = Object.keys(of);
  const cSet = new Set(cFids), oSet = new Set(oFids);

  const cliOnly = cFids.filter(f => !oSet.has(f));
  const ourOnly = oFids.filter(f => !cSet.has(f));
  if (cliOnly.length || ourOnly.length) out.MEMBER.push({ key, cliOnly, ourOnly, cliN: cFids.length, ourN: oFids.length });

  // sections
  const cSecs = (C.sections || []).filter(s => s.sec).map(s => s.sec);
  const oSecs = (O.sections || []).filter(s => s.sec).map(s => s.sec);
  if (JSON.stringify(cSecs) !== JSON.stringify(oSecs)) out.SECT.push({ key, client: cSecs, ours: oSecs });

  // card order within each shared section (compare the sequence of fids present on both sides)
  const cBySec = {}, oBySec = {};
  (C.sections || []).forEach(s => { cBySec[s.sec] = (s.cards || []).map(c => c.fid); });
  (O.sections || []).forEach(s => { oBySec[s.sec] = (s.cards || []).map(c => c.fid); });
  Object.keys(cBySec).forEach(sec => {
    if (!(sec in oBySec)) return;
    const a = cBySec[sec].filter(f => oSet.has(f) && oBySec[sec].includes(f));
    const b = oBySec[sec].filter(f => cSet.has(f) && cBySec[sec].includes(f));
    if (JSON.stringify(a) !== JSON.stringify(b)) out.ORDER.push({ key, sec, client: a, ours: b });
  });

  for (const fid of cFids) {
    const c = cf[fid], o = of[fid];
    if (!o) continue;
    if (c.sku !== o.sku) { out.FACE.push({ key, fid, client: c.sku, ours: o.sku }); continue; }
    if (c.code !== o.code) out.CODE.push({ key, fid, client: c.code, ours: o.code });
    if (!!c.grey !== !!o.grey) out.GREY.push({ key, fid, sku: c.sku, client: !!c.grey, ours: !!o.grey });

    const cr = rowMap(c), or = rowMap(o);
    const cl = Object.keys(cr).sort(), ol = Object.keys(or).sort();
    if (JSON.stringify(cl) !== JSON.stringify(ol)) out.ROWSET.push({ key, fid, sku: c.sku, client: cl, ours: ol });
    for (const lbl of cl) {
      if (!or[lbl]) continue;
      const a = cr[lbl], b = or[lbl];
      const al = a.map(p => NUM(p.l) || p.l), bl = b.map(p => NUM(p.l) || p.l);
      if (JSON.stringify(al) !== JSON.stringify(bl)) { out.PILLS.push({ key, fid, sku: c.sku, row: lbl, client: al, ours: bl }); continue; }
      const as = a.map(p => (p.s ? 'S' : '') + (p.o ? 'O' : '') || '-').join(',');
      const bs = b.map(p => (p.s ? 'S' : '') + (p.o ? 'O' : '') || '-').join(',');
      if (as !== bs) out.STATE.push({ key, fid, sku: c.sku, row: lbl, labels: al, client: as, ours: bs });
    }
  }
}

const order = ['GREY_NOT_HIDE', 'MEMBER', 'FACE', 'CODE', 'GREY', 'SECT', 'ORDER', 'ROWSET', 'PILLS', 'STATE'];
console.log(`combos compared: ${keys.length}${missing.length ? ` (missing on ours: ${missing.length})` : ''}`);
for (const k of order) {
  console.log(`\n${k}: ${out[k].length}`);
  out[k].slice(0, 8).forEach(m => console.log('  ' + JSON.stringify(m).slice(0, 300)));
}
if (reportPath) { fs.writeFileSync(reportPath, JSON.stringify({ keys: keys.length, missing, out }, null, 1)); console.log('\nreport -> ' + reportPath); }
