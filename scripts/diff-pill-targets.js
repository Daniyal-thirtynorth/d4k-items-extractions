#!/usr/bin/env node
/*
 * diff-pill-targets.js  —  PART B1: navigation-pill target existence / referential integrity.
 *
 * Every configurator pill (width/height/depth/programme/options) with a non-null `sku`
 * NAVIGATES to that item. If the target doesn't exist (and isn't a synthesizable P1/C1
 * tier variant of an existing base), our UI would open a 404 — a dangling pill.
 * This is the "per-tier target existence" gap (e.g. C1GFV6073S2ZM present but its base
 * GFV6073S2ZM absent → a pill pointing to the base dangles).
 *
 * Run: node --max-old-space-size=6144 scripts/diff-pill-targets.js [exportJson]
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const EXPORT = process.argv[2] || path.join(ROOT, 'docs', 'export-v781-fresh.json');

// synthesizable tier prefixes (backend builds P1/C1 from a base on read)
const SYNTH = /^(P1|C1)/;
function resolves(sku, set) {
  if (set.has(sku)) return 'stored';
  if (SYNTH.test(sku) && set.has(sku.replace(SYNTH, ''))) return 'synth';       // P1/C1 → base
  return null;
}

function main() {
  console.error('loading export…', EXPORT);
  const exp = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
  const items = exp.items || exp;
  const set = new Set(items.map(it => it.sku));
  const cat = new Map(items.map(it => [it.sku, it.category || '?']));

  const ROWS = ['width', 'height', 'depth', 'programme', 'options'];
  let totalPills = 0, nav = 0, state = 0, dead = 0, stored = 0, synth = 0;
  const dangling = [];                        // {from, group, label, sku, cat}
  const danglingByGroup = {}, danglingByCat = {};
  const skuKey = { width: 'sku', height: 'sku', depth: 'sku', programme: 'sku', options: 'sku' };

  for (const it of items) {
    const p = it.parameters || {};
    for (const row of ROWS) {
      for (const pill of (p[row] || [])) {
        totalPills++;
        const sku = pill[skuKey[row]];
        const group = row === 'options' ? ('opt:' + (pill.group || '?')) : row;
        if (sku == null) { dead++; continue; }               // intentional dead/crossed pill
        if (sku === it.sku) { state++; continue; }            // same-item state pill (depth etc.)
        nav++;
        const r = resolves(sku, set);
        if (r === 'stored') stored++;
        else if (r === 'synth') synth++;
        else {
          dangling.push({ from: it.sku, group, label: pill.label ?? pill.tier, sku, cat: cat.get(it.sku) || '?' });
          danglingByGroup[group] = (danglingByGroup[group] || 0) + 1;
          const c = cat.get(it.sku) || '?';
          danglingByCat[c] = (danglingByCat[c] || 0) + 1;
        }
      }
    }
  }

  // distinct dangling target skus (the actually-missing items), + whether a tier sibling exists
  const missTargets = new Map();   // missingSku → count of pills pointing at it
  for (const d of dangling) missTargets.set(d.sku, (missTargets.get(d.sku) || 0) + 1);
  // for a missing target, does ANY tier variant of it exist? (prefix C/A/P1/C1 or strip)
  function siblingExists(sku) {
    const bases = [sku, sku.replace(/^(P1|C1|C|A)/, '')];
    const variants = [];
    for (const b of bases) for (const pfx of ['', 'A', 'C', 'P1', 'C1']) variants.push(pfx + b);
    return variants.some(v => v !== sku && set.has(v));
  }
  let missWithSibling = 0;
  for (const sku of missTargets.keys()) if (siblingExists(sku)) missWithSibling++;

  const R = [];
  R.push('# PART B1 — pill target existence / referential integrity\n');
  R.push(`items: ${items.length} | total pills: ${totalPills}`);
  R.push(`  navigation pills: ${nav}  (resolved: stored=${stored}, synth P1/C1=${synth})`);
  R.push(`  same-item state pills: ${state} | dead (skuless, intentional): ${dead}`);
  R.push(`\n## DANGLING navigation pills (target missing & not synth-resolvable): ${dangling.length}`);
  R.push(`  distinct missing target skus: ${missTargets.size}  (of which a tier-sibling DOES exist: ${missWithSibling})`);
  R.push('\n### dangling by pill group');
  Object.entries(danglingByGroup).sort((a, b) => b[1] - a[1]).forEach(([g, n]) => R.push(`  ${g.padEnd(20)} ${n}`));
  R.push('\n### dangling by category');
  Object.entries(danglingByCat).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => R.push(`  ${c.padEnd(24)} ${n}`));
  R.push('\n### most-referenced missing targets (top 25)');
  [...missTargets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    .forEach(([sku, n]) => R.push(`  ${sku.padEnd(22)} referenced by ${n} pill(s)  ${siblingExists(sku) ? '(tier-sibling exists)' : ''}`));
  R.push('\n### examples (up to 30)');
  dangling.slice(0, 30).forEach(d => R.push(`  ${d.from} [${d.cat}] --${d.group}:${d.label}--> ${d.sku}`));

  const report = R.join('\n');
  console.log(report);
  const out = path.join(ROOT, 'scripts', '..', 'docs', '..');
  const outPath = '/private/tmp/claude-501/-Users-apple-Documents-thirtynorth-node-js-d4k-items-extraction/f010f785-c1d3-49b3-bcb6-3fd14da494df/scratchpad/diff-pill-targets-report.txt';
  fs.writeFileSync(outPath, report);
  fs.writeFileSync(outPath.replace('.txt', '.json'), JSON.stringify({ totalPills, nav, stored, synth, state, dead, dangling: dangling.length, missTargets: missTargets.size, missWithSibling, danglingByGroup, danglingByCat, missingSkus: [...missTargets.keys()] }));
  console.error('\nreport:', outPath);
}
main();
