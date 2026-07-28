/*
 * Item.heightCode backfill for an existing export (schemaVersion 2.4.0).
 *
 * WHY: the app's per-unit H key is `u.hc` — for base/tall LINE families that is the
 * carcase line (73/80/86, which we already stored as `heightClass`), but for every
 * other family it is the unit's CM HEIGHT (29, 42, 103, 204, 217 …). The grid's H row
 * is built from the family's hc set (`pickHeight(fid,hc)`), so without hc a client
 * cannot resolve an H pill on a non-line family at all — and the detail-scraped
 * `parameters.height[].sku` is null for every height the current variant lacks
 * (2,560 pills), which made those pills render dead/grey while the app shows them live.
 *
 * The extractor emits `heightCode` directly now; this script patches an export that
 * predates it, from the values dumped out of the live app (docs/height-code-v781.json).
 *
 *   node scripts/backfill-height-code.js [export.json]          # dry run
 *   node scripts/backfill-height-code.js [export.json] --apply  # write in place
 */
const fs = require('fs');
const path = require('path');

const EXPORT = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : path.join(__dirname, '..', 'docs', 'export-v781-fresh.json');
const APPLY = process.argv.includes('--apply');
const MAP = path.join(__dirname, '..', 'docs', 'height-code-v781.json');

const hc = JSON.parse(fs.readFileSync(MAP, 'utf8')).hc;
const data = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));

let set = 0, unchanged = 0, missing = 0, mismatch = 0;
for (const it of data.items || []) {
  const v = hc[it.sku];
  if (v == null) { missing++; continue; }
  if (it.heightClass != null && it.heightClass !== v) mismatch++;   // must never happen: heightClass ⊂ hc
  if (it.heightCode === v) { unchanged++; continue; }
  it.heightCode = v;
  set++;
}
const prevVersion = data.meta && data.meta.schemaVersion;
if (data.meta) data.meta.schemaVersion = '2.4.0';

console.log({ export: EXPORT, items: (data.items || []).length, set, unchanged, noHcInApp: missing, mismatch, prevVersion, newVersion: '2.4.0', apply: APPLY });
if (mismatch) throw new Error('heightClass/heightCode mismatch — refusing to write');
if (APPLY) {
  fs.writeFileSync(EXPORT, JSON.stringify(data));
  console.log('written');
} else {
  console.log('dry run — pass --apply to write');
}
