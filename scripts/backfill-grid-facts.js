/*
 * Item.unitFacts + Item.familyFacts backfill (schemaVersion 2.5.0) — audit §L P0.
 *
 * WHY: every card row the app draws comes from the FAMILY POOL (`ppool(b)` → `hvals(b)` /
 * `wsAtH` / `dAll` / `variantOpts`), never from one unit's detail panel — which is where our
 * `parameters.*` pills were scraped from. The §L sweep measured the cost: 750 ROWSET + 347 PILLS
 * + most of 359 STATE diffs. To rebuild those rows exactly, the backend needs the same inputs the
 * app reads, and they were not in the export:
 *
 *   unitFacts   {tier, opening, agnostic, siblingTiers, widthCode, depthCode, variantCode}
 *               = u.fam / u.op / u._ag / u.sib / u.w / u.dv / u.vr
 *               → ppool() membership, the Fronts-chip TWIN swap (tierOk), W/D row values
 *   familyFacts {dim, variantLabel, numericLabel, variantFormat, variantOrder, byProgramme,
 *                hasOpeningArticles, hasPrimo, noLine, isAccessory, isProgrammeAgnostic, depth63}
 *               = b.dim / b.vlbl / b.slbl / b.vfmt / b.cho / b.byprog / b._hasOp / b._hasP /
 *                 b.noline / isAccessory(b) / isProgAgnostic(b) / d63Cfg(b)
 *               → which rows exist at all (dim), their labels, "accessories never grey" (app v163),
 *                 and depth-63 eligibility (d63Eligible = d63Cfg != null)
 *
 * Values are dumped FROM the running app by scripts/parity/extract-grid-facts.js — nothing here is
 * re-derived. The extractor emits both fields directly now; this patches an export that predates it.
 *
 *   node scripts/backfill-grid-facts.js [export.json]          # dry run
 *   node scripts/backfill-grid-facts.js [export.json] --apply  # write in place
 */
const fs = require('fs');
const path = require('path');

const EXPORT = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : path.join(__dirname, '..', 'docs', 'export-v781-fresh.json');
const APPLY = process.argv.includes('--apply');
const FACTS = path.join(__dirname, 'parity', 'out', 'grid-facts-v781.json');

const facts = JSON.parse(fs.readFileSync(FACTS, 'utf8'));
const data = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));

// app `renderGrid`: the label-ROOT used to keep variants next to their product in the card sort
// (`x.rk`), and the "special" demotion flag (`x.sp`). Verbatim.
function labelGroup(l) {
  return String(l || '').toLowerCase()
    .replace(/·\s*[a-z0-9]{1,5}\s*$/, '')
    .replace(/45°\s*(mitre|miter)\s*/g, '')
    .replace(/·\s*island/g, '')
    .replace(/·\s*special[^·]*/g, '')
    .replace(/special height|special usa[^·]*/g, '')
    .replace(/[^a-z]+/g, ' ').trim();
}
function familyFacts(f) {
  return {
    label: f.label || null,
    labelGroup: labelGroup(f.label),
    isSpecial: /special/i.test(f.label || ''),
    dim: f.dim || 'none',
    variantLabel: f.vlbl || null,
    numericLabel: f.slbl || null,
    variantFormat: f.vfmt || null,
    variantOrder: f.cho || null,
    variantLabels: f.vlabels || null,   // app `_vrLbl` — the chip's RENDERED text (vmap / Vero / cm)
    byProgramme: !!f.byprog,
    hasOpeningArticles: !!f.hasOp,
    hasPrimo: !!f.hasP,
    noLine: !!f.noline,
    memberTiers: f.mem || null,
    isAccessory: !!f.acc,
    isProgrammeAgnostic: !!f.agn,
    depth63: f.d63 ? { mode: f.d63.mode, force68: !!f.d63.force68 } : null,
  };
}
function unitFacts(u) {
  return {
    tier: u.fam && /^[PCA]$/.test(u.fam) ? u.fam : null,   // dup-synthetic families store a fid here
    opening: u.op || null,
    agnostic: !!u.ag,
    siblingTiers: u.sib || null,
    widthCode: u.w != null ? u.w : null,
    depthCode: u.dv != null ? u.dv : null,
    variantCode: u.vr != null ? u.vr : null,
    depthAlterations: Array.isArray(u.d) && u.d.length ? u.d : null,   // u.d — the card's D STATE row
  };
}

let setU = 0, setF = 0, noUnit = 0, noFamily = 0;
for (const it of data.items || []) {
  const u = facts.units[it.sku];
  if (u) { it.unitFacts = unitFacts(u); setU++; } else noUnit++;
  const fid = it.familyId || (u && u.fid);
  const f = fid && facts.families[fid];
  if (f) { it.familyFacts = familyFacts(f); setF++; } else noFamily++;
}
const prevVersion = data.meta && data.meta.schemaVersion;
if (data.meta) data.meta.schemaVersion = '2.5.0';

console.log({ export: EXPORT, items: (data.items || []).length, unitFacts: setU, familyFacts: setF, noUnit, noFamily, prevVersion, newVersion: '2.5.0', apply: APPLY });
if (APPLY) { fs.writeFileSync(EXPORT, JSON.stringify(data)); console.log('written'); }
else console.log('dry run — pass --apply to write');
