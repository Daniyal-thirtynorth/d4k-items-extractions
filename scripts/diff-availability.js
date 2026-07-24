#!/usr/bin/env node
/*
 * diff-availability.js  —  PART A of the client↔ours differential harness.
 *
 * Compares, for EVERY unit × a toolbar matrix, the client app's own
 * `available(u)` verdict (ground truth, dumped in-page) against OUR
 * `availableFromCaps(capabilities, toolbar)` port run over the export's caps.
 * Every mismatch = a hole in our `capabilities` data or the port.
 *
 * Ground truth : scratchpad/client_avail_matrix.json  (produced in the client page)
 * Our data     : docs/export-v781-fresh.json          (capabilities per item)
 *
 * Run: node --max-old-space-size=6144 scripts/diff-availability.js [matrixJson] [exportJson]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MATRIX = process.argv[2] || '/private/tmp/claude-501/-Users-apple-Documents-thirtynorth-node-js-d4k-items-extraction/f010f785-c1d3-49b3-bcb6-3fd14da494df/scratchpad/client_avail_matrix.json';
const EXPORT = process.argv[3] || path.join(ROOT, 'docs', 'export-v781-fresh.json');

// ── our availableFromCaps port (VERBATIM from docs/export-schema-v2.ts:211-227) ──
function availableFromCaps(c, s) {
  if (!c) return true;
  if (c.alwaysAvailable) return true;
  const pk = s.progKeys || [];
  const ex = c.excludedPrograms || [], exE = c.excludedProgramsE || [], tw = c.twinTiers || [], dc = c.depthClasses || [];
  const progOk = !pk.length || pk.some(k => !ex.includes(k) && !c.isFrmatFamily && !(s.front === 1 && c.hasEFront && exE.includes(k)));
  const tierOk = (!s.tier || s.tier === 'ALL') ? true
    : (s.tier === 'P1' || s.tier === 'C1') ? c.opening === s.tier
    : !c.nativeTier ? true : c.nativeTier === s.tier ? true : !tw.includes(s.tier);
  const depthOk = s.depth === 58 || s.depth === 63 || dc.includes(s.depth == null ? 58 : s.depth);
  const handleOk = s.handle !== 'V' || c.handleFree;
  const frontOk = s.front !== 1 || c.onePieceFront;
  const openOk = !s.open || (s.open === 'P1' ? c.openP1 : c.openC1) || c.singleHandle;
  const antosoOk = !s.antoso || c.antosoApproved;
  const doorOk = !s.doorline || (s.doorline === 'J' ? c.doorLineJ : c.doorLineY);
  return progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk;
  // per-gate attribution helper below recomputes these individually.
}
// map a matrix state {tier,depth,handle,front,open,antoso,doorline} → ToolbarState
function toolbarOf(st) {
  return {
    tier: st.tier || 'ALL', depth: st.depth == null ? 58 : st.depth,
    handle: st.handle || 'std', front: st.front || 0, open: st.open || '',
    antoso: !!st.antoso, doorline: st.doorline || '', progKeys: st.prog ? [String(st.prog)] : [],
  };
}
// which single gate flips a caps object between avail/unavail for this toolbar
function failingGate(c, s) {
  if (!c || c.alwaysAvailable) return 'none';
  const tw = c.twinTiers || [], dc = c.depthClasses || [];
  const pk = s.progKeys || [], ex = c.excludedPrograms || [], exE = c.excludedProgramsE || [];
  const gates = {
    prog: !pk.length || pk.some(k => !ex.includes(k) && !c.isFrmatFamily && !(s.front === 1 && c.hasEFront && exE.includes(k))),
    tier: (!s.tier || s.tier === 'ALL') ? true : (s.tier === 'P1' || s.tier === 'C1') ? c.opening === s.tier : !c.nativeTier ? true : c.nativeTier === s.tier ? true : !tw.includes(s.tier),
    depth: s.depth === 58 || s.depth === 63 || dc.includes(s.depth == null ? 58 : s.depth),
    handle: s.handle !== 'V' || c.handleFree,
    front: s.front !== 1 || c.onePieceFront,
    open: !s.open || (s.open === 'P1' ? c.openP1 : c.openC1) || c.singleHandle,
    antoso: !s.antoso || c.antosoApproved,
    door: !s.doorline || (s.doorline === 'J' ? c.doorLineJ : c.doorLineY),
  };
  return Object.entries(gates).filter(([, ok]) => !ok).map(([g]) => g).join('+') || 'none';
}

function main() {
  console.error('loading ground truth…');
  const gt = JSON.parse(fs.readFileSync(MATRIX, 'utf8'));
  console.error('loading export…', EXPORT);
  const exp = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
  const items = exp.items || exp;
  const caps = new Map(), cat = new Map();
  for (const it of items) { caps.set(it.sku, it.capabilities || null); cat.set(it.sku, it.category || '?'); }

  const states = gt.states;                 // [{id,...}]
  const skus = Object.keys(gt.avail);
  const inExport = skus.filter(s => caps.has(s));
  const clientOnly = skus.length - inExport.length;

  // per-state tallies + mismatch samples
  const perState = states.map(() => ({ compared: 0, mism: 0, gateFlip: {}, ex: [] }));
  const byCatMism = {};       // category → mismatch count
  const byGate = {};          // failing-gate signature → count
  let totalCompared = 0, totalMism = 0;

  for (const sku of inExport) {
    const bits = gt.avail[sku];
    const c = caps.get(sku);
    for (let i = 0; i < states.length; i++) {
      const cb = bits[i];
      if (cb === '?') continue;             // client error/unknown → skip
      const clientAvail = cb === '1';
      const tb = toolbarOf(states[i]);
      const ourAvail = availableFromCaps(c, tb);
      const ps = perState[i];
      ps.compared++; totalCompared++;
      if (clientAvail !== ourAvail) {
        ps.mism++; totalMism++;
        const g = failingGate(c, tb);
        ps.gateFlip[g] = (ps.gateFlip[g] || 0) + 1;
        byGate[g] = (byGate[g] || 0) + 1;
        const category = cat.get(sku) || '?';
        byCatMism[category] = (byCatMism[category] || 0) + 1;
        if (ps.ex.length < 8) ps.ex.push({ sku, category, client: clientAvail, ours: ourAvail, gate: g, caps: summCaps(c) });
      }
    }
  }

  const R = [];
  R.push('# PART A — unit gate-availability differential (client available(u) vs our availableFromCaps)\n');
  R.push(`units in ground truth: ${skus.length} | in export (compared): ${inExport.length} | client-only (skipped): ${clientOnly}`);
  R.push(`states: ${states.length} | total comparisons: ${totalCompared} | TOTAL MISMATCHES: ${totalMism} (${(100 * totalMism / Math.max(totalCompared, 1)).toFixed(4)}%)\n`);
  R.push('## Per-state');
  R.push('state'.padEnd(12) + 'compared'.padStart(10) + 'mismatch'.padStart(10) + '  top gate flips');
  states.forEach((st, i) => {
    const ps = perState[i];
    const gf = Object.entries(ps.gateFlip).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([g, n]) => `${g}:${n}`).join(' ');
    R.push(st.id.padEnd(12) + String(ps.compared).padStart(10) + String(ps.mism).padStart(10) + '  ' + gf);
  });
  R.push('\n## Mismatches by failing-gate signature');
  Object.entries(byGate).sort((a, b) => b[1] - a[1]).forEach(([g, n]) => R.push(`  ${g.padEnd(18)} ${n}`));
  R.push('\n## Mismatches by category');
  Object.entries(byCatMism).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => R.push(`  ${c.padEnd(24)} ${n}`));
  R.push('\n## Examples (up to 8 per state that has mismatches)');
  states.forEach((st, i) => {
    const ps = perState[i];
    if (!ps.mism) return;
    R.push(`\n### ${st.id}  (${ps.mism} mismatches)`);
    ps.ex.forEach(e => R.push(`  ${e.sku}  [${e.category}]  client=${e.client} ours=${e.ours}  gate=${e.gate}  ${e.caps}`));
  });

  const report = R.join('\n');
  console.log(report);
  const outPath = path.join(path.dirname(MATRIX), 'diff-availability-report.txt');
  fs.writeFileSync(outPath, report);
  console.error('\nreport written:', outPath);
  console.error(JSON.stringify({ totalCompared, totalMism, states: states.length, inExport: inExport.length, clientOnly }));
}
function summCaps(c) {
  if (!c) return 'caps=null';
  return `nT=${c.nativeTier || '-'} tw=[${(c.twinTiers || []).join('')}] dc=[${(c.depthClasses || []).join(',')}] op=${c.opening || '-'} hf=${+!!c.handleFree} 1f=${+!!c.onePieceFront} oP1=${+!!c.openP1} oC1=${+!!c.openC1} sh=${+!!c.singleHandle} ant=${+!!c.antosoApproved} dJ=${+!!c.doorLineJ} dY=${+!!c.doorLineY} aa=${+!!c.alwaysAvailable}`;
}
main();
