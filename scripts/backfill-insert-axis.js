/* UnitFacts.insert backfill (schemaVersion 2.5.4) — audit §S, the last non-app-bug parity diff.
 *
 * The app draws an "Insert" row on a card whose family carries `b.insAx`, from the distinct `u.ins`
 * of its units, and `insPool` narrows the face pick and the W row to the picked one. Neither field
 * was exported, so 8 ROWSET diffs survived every sweep (`FP_16FRONT`, the only such family in v781:
 * 92 units, 'L3/M3' vs 'M8'). Only `u.ins` ships — `insAx` is 1:1 with "a member carries it", so
 * readers derive the axis (see `UnitFacts.insert` in docs/export-schema-v2.ts).
 *
 * Reads `u.ins` straight from the app's `<script id="DATA">` rather than a browser dump: it is a
 * RAW per-unit field the init pass never rewrites (`FP_16FRONT`'s only init touch is `move()`,
 * which changes cat/sub/sec), so the HTML is the source of truth and no parity run is needed.
 * The extractor emits it from now on, so this is a one-off for the existing export.
 *
 *   node scripts/backfill-insert-axis.js [--apply]
 *
 * Without --apply it is a dry run. With it: rewrites docs/export-v781-fresh.json (+ .gz) and bumps
 * meta.schemaVersion to 2.5.4. Push it to a cluster with, from D4K-backend:
 *   node scripts/backfill-item-fields.js <export.json> --fields unitFacts --apply
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'data-from-client', 'leicht_units__781_.html');
const EXPORT = path.join(ROOT, 'docs', 'export-v781-fresh.json');
const APPLY = process.argv.includes('--apply');
const VERSION = '2.5.4';

// ── the app's raw catalog: familyId|code -> u.ins ────────────────────────────
const html = fs.readFileSync(HTML, 'utf8');
const i = html.indexOf('<script id="DATA"');
const s = html.indexOf('>', i) + 1;
const DB = JSON.parse(html.slice(s, html.indexOf('</script>', s)));

const insBy = new Map();          // 'fid|sku' -> ins
const axisFams = new Set();       // families the app flags `insAx`
for (const f of DB.families) {
  if (f.insAx) axisFams.add(f.id);
  for (const u of f.units || []) if (u.ins != null) insBy.set(f.id + '|' + u.c, u.ins);
}
// the derivation the readers rely on — assert it here so a new catalog build fails loudly
const withIns = new Set([...insBy.keys()].map((k) => k.split('|')[0]));
const mismatch = [...new Set([...axisFams, ...withIns])].filter((id) => axisFams.has(id) !== withIns.has(id));
if (mismatch.length) {
  console.error(`insAx is NOT 1:1 with "a member has u.ins" any more: ${mismatch.join(', ')}`);
  console.error('Store the family flag (FamilyFacts.insertAxis) before shipping this export.');
  process.exit(1);
}

// ── stamp the export ────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
const stamp = (facts, fid, sku) => {
  const v = insBy.get(fid + '|' + sku);
  if (v == null || !facts) return false;
  if (facts.insert === v) return false;
  facts.insert = v;
  return true;
};

let set = 0;
let noFacts = 0;
for (const it of data.items) {
  if (insBy.has(it.familyId + '|' + it.sku)) {
    if (it.unitFacts) { if (stamp(it.unitFacts, it.familyId, it.sku)) set++; } else noFacts++;
  }
  // a shared code carries its own record per family — stamp each membership on its own terms
  for (const d of it.dupFamilies || []) if (stamp(d.unitFacts, d.familyId, it.sku)) set++;
}

const prev = data.meta.schemaVersion;
data.meta.schemaVersion = VERSION;

console.log({
  export: path.basename(EXPORT),
  items: data.items.length,
  axisFamilies: [...axisFams],
  unitsWithIns: insBy.size,
  stamped: set,
  missingUnitFacts: noFacts,
  prevVersion: prev,
  newVersion: VERSION,
  apply: APPLY,
});

if (!APPLY) { console.log('dry run — pass --apply to write'); process.exit(0); }
fs.writeFileSync(EXPORT, JSON.stringify(data));
fs.writeFileSync(EXPORT + '.gz', zlib.gzipSync(fs.readFileSync(EXPORT), { level: 9 }));
console.log('written:', EXPORT, '+ .gz');
