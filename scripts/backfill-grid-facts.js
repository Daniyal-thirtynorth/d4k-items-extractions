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
    // the app matches heights with STRICT === (`x.hc===selH` in wsAtH / dAll), so a unit whose hc is
    // literally `null` never matches one whose hc is `undefined`. 4 units in v781 (all ANBL) are
    // null — that is exactly what keeps ANBL's W and D rows off the card.
    heightCodeNull: u.hcNull ? true : undefined,
  };
}

// The app renders a card only for a family in `visibleBlocks()`, which skips `b.hid` outright
// (v127: detail-only families, shown via "Planned together"). Two item groups must therefore never
// become a grid card, while staying fetchable by sku for refs/detail:
//   1. members of a hidden family (F74, XHGT_FRIDGE, …)
//   2. codes that are in NO app family at all — the 23 `meta.recoveredArtifactSkus` the app's init
//      deletes, plus the extractor's synthesized ItemRef-only codes (760, 761, SZIZ, US, …).
const visibleOwners = new Map();   // sku -> the NON-hidden families listing it, in FAMS order
for (const [fid, f] of Object.entries(facts.families)) {
  if (f.hid) continue;
  for (const c of f.codes || []) {
    if (!visibleOwners.has(c)) visibleOwners.set(c, []);
    visibleOwners.get(c).push(fid);
  }
}

// A code can be a member of SEVERAL visible families, and the app renders a CARD for each of them:
// the `*__CKDUP` / `*__DRWDUP` / `*__SNKDUP` / `*__TRDUP` / `MRG_*` synthetics that re-list an
// accessory under a second task area, plus a few genuinely shared families (FS7334 is in both F344
// and F2599). Our items collection stores ONE doc with ONE familyId, so those extra cards could not
// exist — 275 of the 284 cards missing from the §L sweep. Each extra membership carries its own
// cat/sub/sec, catalog order AND familyFacts (50 of 79 differ from the primary's), so the whole
// card identity travels with the entry.
const DUP_FAMILY = /__(?:CK|DRW|SNK|TR)DUP$|^MRG_/;
function dupEntry(fid) {
  const f = facts.families[fid];
  return {
    familyId: fid,
    category: f.cat || null,
    subcategory: f.subDisp || f.sub || null,
    section: f.sec || null,
    catalogRank: f.pri != null ? f.pri : null,
    sectionRank: f.secRank != null ? f.secRank : 999,
    familyIndex: f.i,
    familyFacts: familyFacts(f),
  };
}

// `facts.units` is keyed FAMILY|CODE: a unit record belongs to one family, and a code that is a
// member of several has a separate record in each (`TR90LL3` is w:90 in L32345, null in its other
// family). Fall back to a code-only scan for the handful of items whose stored familyId is not the
// dump's owner, and for dumps produced before the re-key.
const unitsByCode = new Map();
for (const [k, v] of Object.entries(facts.units)) {
  const code = k.includes('|') ? k.slice(k.indexOf('|') + 1) : k;
  if (!unitsByCode.has(code)) unitsByCode.set(code, v);
}
const unitFactsFor = (it) => facts.units[it.familyId + '|' + it.sku] || unitsByCode.get(it.sku);

let setU = 0, setF = 0, noUnit = 0, noFamily = 0, hidden = 0, dupItems = 0, dupEntries = 0;
for (const it of data.items || []) {
  const u = unitFactsFor(it);
  if (u) { it.unitFacts = unitFacts(u); setU++; } else noUnit++;
  const fid = it.familyId || (u && u.fid);
  const f = fid && facts.families[fid];
  if (f) { it.familyFacts = familyFacts(f); setF++; } else noFamily++;

  const owners = visibleOwners.get(it.sku);
  if (!owners) { it.gridHidden = true; hidden++; delete it.dupFamilies; continue; }
  delete it.gridHidden;
  // The stored familyId wins when it is one of the owners (it is, for all but 1 item in v781);
  // otherwise fall back to the first non-synthetic owner, as the extractor does.
  const primary = owners.includes(it.familyId)
    ? it.familyId
    : (owners.find((x) => !DUP_FAMILY.test(x)) || owners[0]);
  const dups = owners.filter((x) => x !== primary);
  if (dups.length) { it.dupFamilies = dups.map(dupEntry); dupItems++; dupEntries += dups.length; }
  else delete it.dupFamilies;
}
const prevVersion = data.meta && data.meta.schemaVersion;
if (data.meta) data.meta.schemaVersion = '2.5.2';

console.log({ export: EXPORT, items: (data.items || []).length, unitFacts: setU, familyFacts: setF, noUnit, noFamily, gridHidden: hidden, dupItems, dupEntries, prevVersion, newVersion: '2.5.2', apply: APPLY });
if (APPLY) { fs.writeFileSync(EXPORT, JSON.stringify(data)); console.log('written'); }
else console.log('dry run — pass --apply to write');
