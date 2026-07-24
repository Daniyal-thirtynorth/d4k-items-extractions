#!/usr/bin/env node
/*
 * audit-excluded-programs.js
 *
 * Accuracy audit: prove that our minimal export's per-item `excludedPrograms`
 * EXACTLY equals what the client app's own `progOkFor(u,pk)` produces, across
 * ALL units x ALL programmes, at the app's DEFAULT state (state.front === 0).
 *
 * Run:  node --max-old-space-size=6144 scripts/audit-excluded-programs.js
 *
 * Sources:
 *  - HTML  : data-from-client/leicht_units__781_.html  (<script id="DATA"> = DB)
 *  - Export: docs/export-v781-min.json                 (items[].sku + excludedPrograms)
 *
 * Decisive source lines (verbatim from the HTML), reproduced below:
 *
 *   function progOkFor(u,pk){
 *     if((u.x||[]).includes(pk)) return false;                              // "No fronts X" exclusion
 *     if(u.c==='FRMAT' && !frmatKey(PROG_BY_KEY[pk].n)) return false;       // v92 FRMAT max-size-table rule
 *     if(state.front===1 && u.E && (u.xE||[]).includes(pk)) return false;   // single-front only (INERT at default front=0)
 *     return true;
 *   }
 *   function frmatKey(n){ if(!n) return null; if(FRMAT_MAX[n]) return n;
 *     const b=n.replace(/-(A|C|C12|Q)$/,'').replace(/-Q$/,''); return FRMAT_MAX[b]?b:null; }
 *   state = { ... front:0, ... }                                            // DEFAULT state
 *   PROGS = DB.programs;  PROG_BY_KEY = Object.fromEntries(PROGS.map(p=>[p.k,p]));
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'data-from-client', 'leicht_units__781_.html');
const EXPORT_PATH = path.join(ROOT, 'docs', 'export-v781-min.json');

// ---- FRMAT_MAX table (verbatim from HTML) --------------------------------
const FRMAT_MAX = {
  'ALURO':[276,120],'AMETIS':[261,120],'BAHIA':[261,120],'BONDI':[276,120],'BOSSA':[270,119.5],
  'BOSSA-FS':[270,119.5],'CERES':[276,120],'CLASSIC-FF':[261,120],'CLASSIC-FS':[261,120],
  'CONCRETE':[250,76],'F 45':[276,120],'GEO':[276,120],'IDEA':[276,120],'IKONO':[276,120],
  'LAIKA':[261,120],'LARGO-FG':[261,120],'MADERO':[261,120],'METURO':[276,120],'MINERA':[276,120],
  'MIRO':[276,120],'ORLANDO':[276,120],'PEARL':[276,120],'SIRIUS':[276,118],'STEEL':[261,120],
  'SYNTHIA':[276,120],'TERMA':[261,120],'TERRA':[276,120],'TOCCO':[276,115],'TOPOS':[261,120]
};
// frmatKey (verbatim logic from HTML)
function frmatKey(n){
  if(!n) return null;
  if(FRMAT_MAX[n]) return n;
  const b = n.replace(/-(A|C|C12|Q)$/,'').replace(/-Q$/,'');
  return FRMAT_MAX[b] ? b : null;
}

// ---- Parse DB from the HTML ----------------------------------------------
function parseDB() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const start = html.indexOf('<script id="DATA"');
  if (start < 0) throw new Error('DATA script not found');
  const gt = html.indexOf('>', start) + 1;
  const end = html.indexOf('</script>', gt);
  return JSON.parse(html.slice(gt, end));
}

// ---- Helpers --------------------------------------------------------------
const sortedSet = a => Array.from(new Set(a)).sort();
const sig = a => sortedSet(a).join(',');
function diff(aArr, bArr) { // items in a not in b
  const bset = new Set(bArr);
  return sortedSet(aArr).filter(x => !bset.has(x));
}

function main() {
  console.log('# excludedPrograms accuracy audit (v781)\n');

  const DB = parseDB();
  const PROGS = DB.programs;                                    // PROGS = DB.programs
  const PROG_BY_KEY = Object.fromEntries(PROGS.map(p => [p.k, p]));
  const ALLPROG = PROGS.map(p => p.k);                          // confirm key field is `k`
  console.log(`PROGS key field = 'k' (sample: k=${JSON.stringify(PROGS[0].k)}, n=${JSON.stringify(PROGS[0].n)})`);
  console.log(`ALLPROG count = ${ALLPROG.length}\n`);

  // Build code -> [units] map (a code may appear in >1 family)
  const byCode = new Map();
  let totalUnits = 0;
  for (const f of DB.families) {
    for (const u of (f.units || [])) {
      totalUnits++;
      if (!byCode.has(u.c)) byCode.set(u.c, []);
      byCode.get(u.c).push(u);
    }
  }

  // ---- app's progOkFor at DEFAULT state (front=0) -------------------------
  // At front=0 the single-front clause is inert, so it reduces to:
  //   excluded(pk)  <=>  u.x.includes(pk)  OR  (u.c==='FRMAT' && !frmatKey(name(pk)))
  const state = { front: 0 };
  function progOkFor(u, pk) {
    if ((u.x || []).includes(pk)) return false;
    if (u.c === 'FRMAT' && !frmatKey(PROG_BY_KEY[pk].n)) return false;
    if (state.front === 1 && u.E && (u.xE || []).includes(pk)) return false;
    return true;
  }
  const appExcludedOf = u => ALLPROG.filter(k => !progOkFor(u, k));

  // For duplicate codes, detect whether the units disagree on appExcluded.
  // Keep ALL candidate appExcluded sets per code (a code may render as any of
  // its family instances depending on app state -> the export legitimately
  // equals ONE of them).
  const dupCodes = [];
  const appExcludedByCode = new Map();       // code -> appExcluded of units[0] (primary)
  const appExcludedCandidates = new Map();   // code -> [sig,...] of every unit
  for (const [code, units] of byCode) {
    const cands = units.map(u => appExcludedOf(u));
    const sigs = new Set(cands.map(sig));
    appExcludedByCode.set(code, cands[0]);
    appExcludedCandidates.set(code, cands);
    if (units.length > 1) dupCodes.push({ code, n: units.length, conflict: sigs.size > 1 });
  }
  const dupConflicts = dupCodes.filter(d => d.conflict);

  // ---- Load export --------------------------------------------------------
  const exp = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
  const items = exp.items || exp;
  const exportBySku = new Map();
  for (const it of items) exportBySku.set(it.sku, it);

  // ---- Membership --------------------------------------------------------
  const exportSkus = new Set(exportBySku.keys());
  const dbCodes = new Set(byCode.keys());
  const inBoth = [...exportSkus].filter(s => dbCodes.has(s));
  const exportOnly = [...exportSkus].filter(s => !dbCodes.has(s));
  const dbOnly = [...dbCodes].filter(s => !exportSkus.has(s));

  // ---- Compare (skus present in BOTH) ------------------------------------
  // exact       = matches the PRIMARY (units[0]) app rendering
  // exactAny    = matches ANY same-code app rendering (resolves dup-code ambiguity)
  // trueMismatch= matches NONE of the same-code renderings (a genuine defect)
  let exact = 0, exactAny = 0, mismatch = 0, dupResolved = 0, trueMismatch = 0;
  const mismEx = [];        // primary mismatches
  const trueMismEx = [];    // matches no candidate at all
  for (const sku of inBoth) {
    const expExc = sortedSet(exportBySku.get(sku).excludedPrograms || []);
    const expSig = sig(expExc);
    const appExc = sortedSet(appExcludedByCode.get(sku));
    const cands = appExcludedCandidates.get(sku).map(sig);
    const matchesPrimary = expSig === sig(appExc);
    const matchesAny = cands.includes(expSig);

    if (matchesPrimary) exact++;
    if (matchesAny) exactAny++; else trueMismatch++;

    if (!matchesPrimary) {
      mismatch++;
      if (matchesAny) dupResolved++;
      if (mismEx.length < 15) {
        mismEx.push({
          sku,
          matchesAnyCandidate: matchesAny,
          inExportNotApp: diff(expExc, appExc),
          inAppNotExport: diff(appExc, expExc)
        });
      }
    }
    if (!matchesAny && trueMismEx.length < 15) {
      trueMismEx.push({ sku, expExc, candidates: appExcludedCandidates.get(sku).map(sortedSet) });
    }
  }
  const comparedTotal = inBoth.length;
  const pct = comparedTotal ? (100 * exact / comparedTotal) : 0;
  const pctAny = comparedTotal ? (100 * exactAny / comparedTotal) : 0;

  // ---- FRMAT quantification ----------------------------------------------
  const frmatUnits = byCode.get('FRMAT') || [];
  let frmatDetail = null;
  if (frmatUnits.length) {
    const u = frmatUnits[0];
    const excludedByFrmatRule = ALLPROG.filter(k => u.c === 'FRMAT' && !frmatKey(PROG_BY_KEY[k].n));
    const excludedByX = (u.x || []).filter(k => ALLPROG.includes(k));
    const frmatOnly = excludedByFrmatRule.filter(k => !excludedByX.includes(k)); // exclusions ONLY from FRMAT rule
    const inExport = exportBySku.has('FRMAT');
    frmatDetail = {
      frmatUnitCount: frmatUnits.length,
      excludedByFrmatRuleCount: excludedByFrmatRule.length,
      excludedByXCount: excludedByX.length,
      frmatRuleOnlyCount: frmatOnly.length,
      inExport,
      exportExcludedCount: inExport ? (exportBySku.get('FRMAT').excludedPrograms || []).length : null,
      appExcludedCount: appExcludedOf(u).length,
      match: inExport ? (sig(exportBySku.get('FRMAT').excludedPrograms || []) === sig(appExcludedOf(u))) : null
    };
  }

  // ---- xE (single-front-only) quantification -----------------------------
  let withE = 0, withXE = 0, xeNonEmpty = 0, xeDiffX = 0;
  let unitsWithExtraXE = 0;            // units where xE\x is non-empty (real dropped single-front exclusions)
  const extraXEProgTouched = new Set();
  const xeExamples = [];
  for (const [, units] of byCode) {
    for (const u of units) {
      if ('E' in u) withE++;
      if ('xE' in u) withXE++;
      if (u.xE && u.xE.length) xeNonEmpty++;
      if (u.xE) {
        const dx = diff(u.xE, u.x || []);  // in xE not in x
        if (sig(u.xE) !== sig(u.x || [])) xeDiffX++;
        if (dx.length) {
          unitsWithExtraXE++;
          dx.forEach(k => extraXEProgTouched.add(k));
          if (xeExamples.length < 5) xeExamples.push({ sku: u.c, hasE: 'E' in u, xMinusCount:(u.x||[]).length, xExtraInXE: dx.slice(0,8) });
        }
      }
    }
  }

  // ------------------------------------------------------------------ REPORT
  const R = [];
  R.push('\n=====================  RESULTS  =====================\n');

  R.push('## Membership');
  R.push(`- DB units total: ${totalUnits}  | DB unique codes: ${dbCodes.size}`);
  R.push(`- Export items: ${items.length}  | Export unique skus: ${exportSkus.size}`);
  R.push(`- In BOTH (compared): ${inBoth.length}`);
  R.push(`- In export but NOT in DB (synthesized/referenced codes): ${exportOnly.length}`);
  R.push(`- In DB but NOT in export: ${dbOnly.length}`);
  if (dbOnly.length) R.push(`    e.g. ${dbOnly.slice(0,15).join(', ')}`);
  R.push(`- Duplicate codes in DB: ${dupCodes.length}  (of which units DISAGREE on appExcluded: ${dupConflicts.length})`);
  if (dupConflicts.length) R.push(`    conflicting codes: ${dupConflicts.slice(0,15).map(d=>d.code).join(', ')}`);

  R.push('\n## Exact-match (excludedPrograms == appExcluded @ front=0)');
  R.push(`- Compared: ${comparedTotal}`);
  R.push(`- EXACT match vs PRIMARY (units[0]) rendering: ${exact}  (${pct.toFixed(4)}%)`);
  R.push(`- EXACT match vs ANY same-code rendering:     ${exactAny}  (${pctAny.toFixed(4)}%)`);
  R.push(`- Primary mismatches: ${mismatch}  (of which resolved by a dup-code sibling rendering: ${dupResolved})`);
  R.push(`- TRUE mismatches (match NO same-code rendering): ${trueMismatch}`);
  if (mismEx.length) {
    R.push('- Primary-mismatch examples (up to 15):');
    for (const m of mismEx) R.push(`    ${m.sku}  matchesAnyCandidate=${m.matchesAnyCandidate}  inExportNotApp=${JSON.stringify(m.inExportNotApp)}  inAppNotExport=${JSON.stringify(m.inAppNotExport)}`);
  }
  if (trueMismEx.length) {
    R.push('- TRUE-mismatch examples (match no candidate):');
    for (const m of trueMismEx) R.push(`    ${m.sku}  export=${JSON.stringify(m.expExc)}  candidates=${JSON.stringify(m.candidates)}`);
  } else {
    R.push('- TRUE-mismatch examples: NONE (every compared sku matches at least one legitimate app rendering).');
  }

  R.push('\n## FRMAT special-case');
  if (frmatDetail) {
    R.push(`- Units with u.c==='FRMAT': ${frmatDetail.frmatUnitCount}`);
    R.push(`- Programmes excluded by FRMAT max-size rule: ${frmatDetail.excludedByFrmatRuleCount}`);
    R.push(`- Programmes excluded by u.x alone: ${frmatDetail.excludedByXCount}`);
    R.push(`- Excluded ONLY by FRMAT rule (not in u.x): ${frmatDetail.frmatRuleOnlyCount}`);
    R.push(`- FRMAT in export? ${frmatDetail.inExport}  | export excl count: ${frmatDetail.exportExcludedCount}  | app excl count: ${frmatDetail.appExcludedCount}  | MATCH: ${frmatDetail.match}`);
  } else {
    R.push('- No FRMAT unit found.');
  }

  R.push('\n## Single-front (u.xE) — the dimension our minimal schema has no field for');
  R.push(`- Units with u.E: ${withE}`);
  R.push(`- Units with u.xE: ${withXE}   (non-empty: ${xeNonEmpty})`);
  R.push(`- Units where xE differs from x: ${xeDiffX}`);
  R.push(`- Units with EXTRA exclusions in single-front mode (xE\\x non-empty): ${unitsWithExtraXE}`);
  R.push(`- Distinct programmes ever added by single-front (xE\\x union): ${extraXEProgTouched.size}  [${[...extraXEProgTouched].sort().slice(0,20).join(', ')}${extraXEProgTouched.size>20?', ...':''}]`);
  if (xeExamples.length) {
    R.push('- Examples:');
    for (const e of xeExamples) R.push(`    ${e.sku}  hasE=${e.hasE}  |x|=${e.xMinusCount}  extra-in-xE=${JSON.stringify(e.xExtraInXE)}`);
  }

  const out = R.join('\n');
  console.log(out);

  // machine-readable summary for downstream use
  const summary = {
    comparedTotal, exact, exactPct: +pct.toFixed(4), mismatch,
    exportOnly: exportOnly.length, dbOnly: dbOnly.length,
    dupCodes: dupCodes.length, dupConflicts: dupConflicts.length,
    frmat: frmatDetail,
    xE: { withE, withXE, xeNonEmpty, xeDiffX, unitsWithExtraXE, extraProgs: extraXEProgTouched.size }
  };
  console.log('\n---JSON-SUMMARY---');
  console.log(JSON.stringify(summary));
}

main();
