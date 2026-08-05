/* Programme-exclusion corrections found by auditing the export against the client's own
 * 2026 price/type lists (`data-from-client/items-pdfs/`, see scripts/book-audit/).
 *
 * The client confirmed the v781 HTML app was built FROM those books, so the books are
 * UPSTREAM of the app, not a third opinion. The audit compared every exclusion the books
 * state in words against `capabilities` and found 1,407 of 1,411 codes already correct.
 * These are the two residuals that are unambiguous, verified against the rendered page,
 * and not explained by one of the app's own escape rules:
 *
 *   1. HAA30217ZR ("Pullout utility unit", primo p569, a NEW type in the 2026 list).
 *      The width-30 note reads "Not available in AVENIDA, CARRÉ-FS, CLASSIC-FF-Q,
 *      CLASSIC-FS-Q, IOS, IOS-M, TERMA-Q, TOPOS-Q, VERVE-FS, WAKUU, WAKUU-FS". We carry
 *      8 of the 11; the four Q programmes are missing. They ARE modelled elsewhere (806
 *      items exclude each), so this is a per-item gap, not an unmodelled rule.
 *
 *   2. GF76.. / GF91.. appliance-housing fronts (16 codes). Both legends say the single-front
 *      "E" variant is unavailable from carcase height 190.6 cm for IOS/IOS-M/IOS-C/IOS-M-C
 *      and — Contino book only — VALAIS-C. 593 of 609 tall E-front items exclude all five;
 *      these 16 miss VALAIS-C alone.
 *
 * ⚠️ THIS DELIBERATELY DIVERGES FROM v781. The app renders these live; the book says they
 * are not orderable. Verified safe against the parity harness: every plan under
 * scripts/parity/ uses only programmes 244 / 701 / 410 and never sets `front`, so neither
 * `excludedPrograms` on a Q programme nor `excludedProgramsE` (which only bites when
 * `s.front === 1`) is exercised by any sweep. If a future plan adds a Q programme, VALAIS-C
 * or a Full-E state, expect GREY diffs HERE and treat ours as the correct side.
 *
 * ⚠️ RE-RUN AFTER EVERY EXTRACTION. `export-v781-extractor2.js` reads the app, and the app
 * is the side that is wrong, so a fresh extract drops these again.
 *
 *   node scripts/fix-book-exclusions.js [--apply]
 *
 * Dry run without --apply. With it: rewrites docs/export-v781-fresh.json (+ .gz).
 * schemaVersion is NOT bumped — this is a data correction, not a contract change.
 * Push to a cluster with, from D4K-backend:
 *   node scripts/backfill-item-fields.js <export.json> --fields capabilities --apply
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const EXPORT = path.join(ROOT, 'docs', 'export-v781-fresh.json');
const APPLY = process.argv.includes('--apply');

// primo p3 / contino p3 legends + primo p569, as programme ids
const Q_PROGRAMMES = ['211', '214', '267', '270']; // CLASSIC-FF-Q, CLASSIC-FS-Q, TERMA-Q, TOPOS-Q
const VALAIS_C = '783';
const TALL_E_MIN_MM = 1906; // "from carcase height 190.6 cm"

const doc = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
const progName = new Map(doc.programmes.map((p) => [p.id, p.name]));
const changes = [];

function add(item, field, ids) {
  const cur = (item.capabilities[field] ||= []);
  const missing = ids.filter((id) => !cur.includes(id));
  if (!missing.length) return;
  cur.push(...missing);
  changes.push({ sku: item.sku, field, added: missing.map((id) => progName.get(id)) });
}

for (const item of doc.items) {
  const c = item.capabilities;
  if (!c) continue;

  if (item.sku === 'HAA30217ZR') add(item, 'excludedPrograms', Q_PROGRAMMES);

  // the VALAIS-C half of the >=190.6cm single-front rule, on the families that miss it
  const eff = new Set([...(c.excludedPrograms || []), ...(c.excludedProgramsE || [])]);
  if (c.hasEFront && item.category === 'Tall' && (item.heightMm || 0) >= TALL_E_MIN_MM
      && !eff.has(VALAIS_C)) {
    add(item, 'excludedProgramsE', [VALAIS_C]);
  }
}

// The book finding was exactly these; if a re-extract changes the shape, stop and re-audit
// rather than silently patching a different set.
const gf = changes.filter((c) => c.field === 'excludedProgramsE');
const haa = changes.filter((c) => c.field === 'excludedPrograms');
if (!changes.length) {
  console.log('already applied — nothing to do');
  process.exit(0);
}
if (gf.length !== 16 || haa.length !== 1) {
  console.error(`ABORT: expected 16 excludedProgramsE + 1 excludedPrograms corrections, ` +
                `got ${gf.length} + ${haa.length}. Re-run scripts/book-audit before applying.`);
  process.exit(1);
}

for (const c of changes) console.log(`  ${c.sku.padEnd(14)} ${c.field} += ${c.added.join(', ')}`);
console.log(`\n${changes.length} corrections (${haa.length} excludedPrograms, ${gf.length} excludedProgramsE)`);

if (!APPLY) {
  console.log('dry run — pass --apply to write');
  process.exit(0);
}
fs.writeFileSync(EXPORT, JSON.stringify(doc));
fs.writeFileSync(`${EXPORT}.gz`, zlib.gzipSync(fs.readFileSync(EXPORT), { level: 9 }));
console.log(`wrote ${EXPORT} (+ .gz)`);
