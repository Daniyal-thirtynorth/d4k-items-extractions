/**
 * compute-capabilities.js
 * ------------------------------------------------------------------------
 * Ports the LEICHT app's configure-pill availability gates into a pure,
 * DOM-free "capability" object so a NestJS backend can evaluate every gate
 * for a pill's TARGET unit against a toolbar state WITHOUT re-deriving from
 * raw catalog data.
 *
 * Source of truth: data-from-client/leicht_units__781_.html  (script#DATA +
 * the app's own gate functions). The app's decision is:
 *
 *   available(u) = u._c ? true
 *                : progOk(u) && tierOk(u) && depthOk(u) && handleOk(u)
 *                  && frontOk(u) && openOk(u) && antosoOk(u) && doorOk(u)
 *
 * Toolbar state defaults (from `state={...}` + `state.tier='ALL'`):
 *   depth:58  handle:'std'  front:0  open:''  antoso:false  doorline:''
 *   tier:'ALL'  prog:null  progMap:null
 * With those defaults EVERY gate returns true (nothing is filtered until the
 * user picks a chip), so the capability inputs only matter once a chip is set.
 *
 * Fields are read from the RAW unit `u` (DB.families[].units[]) and family `f`
 * (DB.families[]).  Only three inputs are derived, not raw:
 *   - _cat  = f.cat                       (app: FAMS.forEach(u._cat=f.cat))
 *   - _hFree= 1 if /^Module/.test(f.label)(app: interior-module handle-agnostic)
 *   - dp    = never present in raw → antosoU falls back to u.D/10
 *
 * tierOk needs a CROSS-UNIT twin lookup (not reproducible from the target's own
 * tier alone) — pass a `codeIx` built by buildCodeIndex(families) to resolve it.
 * ------------------------------------------------------------------------
 */
'use strict';

/* ── carcass mm → depth code (verbatim from source) ─────────────────────── */
const D2CODE = { 340: 36, 460: 48, 560: 58, 660: 68 };

/* ── antosoU(u,cat,sub): the "book envelope p.2.03" approval rule ───────────
 * Verbatim port of  window.antosoU  in the HTML.  cat is the family category,
 * sub the family sub-category.  antosoOk(u) calls it as antosoU(u,u._cat,'')
 * — so for the available() gate sub is always '' (dmax always 58).           */
function antosoU(u, cat, sub) {
  const w = u.w != null ? u.w : (u.W > 0 ? u.W / 10 : null);
  const h = u.hc != null ? u.hc : (u.H > 0 ? u.H / 10 : null);
  const d = u.dp != null ? u.dp : (u.D > 0 ? u.D / 10 : null); // dp never in raw → uses D/10
  if (w == null || h == null) return false;
  if (cat === 'Tall') return w >= 30 && w <= 90 && h >= 36.5 && h <= 154 && (d == null || (d >= 36 && d <= 58));
  const dmax = /sink/i.test(sub || '') ? 62 : 58;
  return w >= 30 && w <= 120 && h >= 36.5 && h <= 93 && (d == null || (d >= 36 && d <= dmax));
}

/* ── singleHandleRow(u): P1/C1 "one visible handle row" test ────────────────
 * Verbatim port.  A single-front unit (0 or 1 stacked front) is valid under
 * the P1/C1 opening filter regardless of the P1/C1 flag.                     */
function singleHandleRow(u) {
  const lds = (u.ld || []).map((x) => (x || '').toLowerCase());
  if (!lds.length) return true;
  if (/sink|waste bin|front for|appliance/.test(lds.join(' '))) return true;
  let stack = 0;
  lds.forEach((line) => {
    if (/inner/.test(line)) return; // inner drawers/pullouts sit behind a front — no handle
    let m = line.match(/(\d+)\s+drawers?\b/); if (m) stack += (+m[1]);
    m = line.match(/(\d+)\s+pullouts?\b/); if (m) stack += (+m[1]);
  });
  return stack <= 1;
}

/* ── buildCodeIndex(families): ports window.__codeIx ────────────────────────
 * Map of UPPERCASE code → {f,u} across all families (also indexed by u.idmc).
 * Used only for the tierOk twin rule.  The app skips f.hid families; raw DB has
 * no hid flag (hidden dup-synthetics are created at init), so every raw family
 * is real and included.                                                       */
function buildCodeIndex(families) {
  const m = {};
  (families || []).forEach((f) => {
    if (f.hid) return;
    (f.units || []).forEach((u) => {
      const key = String(u.c).toUpperCase();
      m[key] = { f, u };
      if (u.idmc) m[String(u.idmc).toUpperCase()] = m[key];
    });
  });
  return m;
}

/* ── tierTwins(u, codeIx): the TWIN rule extracted from tierOk ──────────────
 * For each non-native tier t in {P,A,C}, does a real sibling SKU exist?
 *   base = strip a leading A/C prefix when the unit's native fam is A/C
 *   cand = (t==='P') ? base : t + base
 *   twin exists  ⇔  codeIx[cand] is present
 * tierOk filters the unit OUT of tier t exactly when a twin exists.
 *   e.g. T6080 has CT6080 → 'C' is a twin → filtered under C
 *        FS8034 has no CFS8034 → no twin → stays (line-neutral)              */
function tierTwins(u, codeIx) {
  const out = [];
  const native = u.fam || null;
  if (!native || !codeIx) return out;
  const c = String(u.c);
  let base = c;
  if (native === 'C' && /^C/.test(c)) base = c.slice(1);
  else if (native === 'A' && /^A/.test(c)) base = c.slice(1);
  for (const t of ['P', 'A', 'C']) {
    if (t === native) continue;
    const cand = (t === 'P') ? base : (t + base);
    if (codeIx[cand.toUpperCase()]) out.push(t);
  }
  return out;
}

/* ── depthClasses(u): union of D2CODE[u.D], u.dv, u.d[] (cm) ─────────────── */
function depthClasses(u) {
  const out = [];
  const add = (v) => { if (v != null && !out.includes(v)) out.push(v); };
  if (u.D != null && D2CODE[u.D] != null) add(D2CODE[u.D]);
  if (u.dv != null) add(u.dv);
  (u.d || []).forEach(add);
  return out;
}

/**
 * computeCapabilities(u, f, codeIx)
 * @param {object} u      raw unit  (DB.families[].units[])
 * @param {object} f      its raw family (DB.families[])
 * @param {object} [codeIx] result of buildCodeIndex(families); required for
 *                         a correct `tierTwins` (else it comes back empty).
 * @returns {object} capability object — the minimal stored inputs for every gate.
 */
function computeCapabilities(u, f, codeIx) {
  const cat = f && f.cat != null ? f.cat : u._cat; // app: u._cat = f.cat
  const label = f && f.label != null ? f.label : '';
  const hFree = /^Module/.test(label) ? 1 : 0;     // app: _hFree for Module* families
  const code = String(u.c);

  return {
    sku: code,

    // available() short-circuit: _c truthy ⇒ always shown, bypasses all gates
    alwaysAvailable: !!u._c,

    // ── tierOk ──
    nativeTier: ['P', 'A', 'C'].includes(u.fam) ? u.fam : null, // 'P'|'A'|'C'|null; guard against dup-family ids (F1961__CKDUP…) leaking in as a "tier"
    opening: u.op || null,               // 'P1' | 'C1' | null (this unit IS a premium opening variant)
    twinTiers: tierTwins(u, codeIx),     // ('P'|'A'|'C')[] tiers with a real sibling SKU

    // ── progOk ──
    excludedPrograms: (u.x || []).slice(),   // "No fronts X" programme-key exclusions
    excludedProgramsE: (u.xE || []).slice(), // single-front programme-key exclusions
    isFrmatFamily: code === 'FRMAT',         // special max-size-table family (needs FRMAT_MAX lookup)
    hasEFront: !!u.E,                        // raw E flag (progOkFor single-front path)

    // ── depthOk ──
    depthClasses: depthClasses(u),           // cm classes the unit offers

    // ── handleOk ──
    handleFree: !!u.V || !!hFree,            // u.V (no-handle front) or interior module

    // ── frontOk ──
    onePieceFront: !!u.E || /\dE$/.test(code), // E-type OR code ends digit+E

    // ── openOk ──
    openP1: !!u.P1 || code.startsWith('P1'),
    openC1: !!u.C1 || code.startsWith('C1'),
    singleHandle: singleHandleRow(u),

    // ── antosoOk (static approval envelope; matches antosoU(u,u._cat,'')) ──
    antosoApproved: antosoU(u, cat, ''),

    // ── doorOk ──
    doorLineJ: !!u.J,
    doorLineY: !!u.Yc,
  };
}

/* ── server-side evaluator mirroring available(u) ───────────────────────────
 * toolbar = { depth, handle, front, open, antoso, doorline, tier, prog, progMap }
 * with the app defaults noted at the top of this file.  progOk here covers the
 * common case (no Mix): pass the selected programme keys as toolbar.progKeys
 * ([] = no programme picked ⇒ progOk true). FRMAT still needs its own table.  */
function availableFromCaps(caps, toolbar) {
  const t = toolbar || {};
  if (caps.alwaysAvailable) return true;

  // progOk: no programme selected ⇒ true; else pass under ANY selected key
  const keys = t.progKeys || [];
  const progOk = !keys.length || keys.some((pk) => {
    if (caps.excludedPrograms.includes(pk)) return false;
    if (caps.isFrmatFamily) return false; // real app: FRMAT_MAX[programmeName] lookup — special-case elsewhere
    if (t.front === 1 && caps.hasEFront && caps.excludedProgramsE.includes(pk)) return false;
    return true;
  });

  // tierOk
  const tier = t.tier;
  let tierOk;
  if (!tier || tier === 'ALL') tierOk = true;
  else if (tier === 'P1' || tier === 'C1') tierOk = caps.opening === tier;
  else if (!caps.nativeTier) tierOk = true;           // line-neutral
  else if (caps.nativeTier === tier) tierOk = true;   // native line
  else tierOk = !caps.twinTiers.includes(tier);       // no real sibling ⇒ stays

  const depthOk = t.depth === 58 || t.depth === 63 || caps.depthClasses.includes(t.depth);
  const handleOk = t.handle !== 'V' || caps.handleFree;
  const frontOk = t.front !== 1 || caps.onePieceFront;
  const openOk = !t.open || (t.open === 'P1' ? caps.openP1 : caps.openC1) || caps.singleHandle;
  const antosoOk = !t.antoso || caps.antosoApproved;
  const doorOk = !t.doorline || (t.doorline === 'J' ? caps.doorLineJ : caps.doorLineY);

  return progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk;
}

module.exports = {
  computeCapabilities,
  availableFromCaps,
  buildCodeIndex,
  D2CODE,
  antosoU,
  singleHandleRow,
  tierTwins,
  depthClasses,
};

/* ── self-test ──────────────────────────────────────────────────────────── */
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const HTML = path.join(__dirname, '..', 'data-from-client', 'leicht_units__781_.html');
  const h = fs.readFileSync(HTML, 'utf8');
  const i = h.indexOf('id="DATA"');
  const gt = h.indexOf('>', i) + 1;
  const end = h.indexOf('</script>', gt);
  const DB = JSON.parse(h.slice(gt, end));
  const codeIx = buildCodeIndex(DB.families);

  const find = (pred) => {
    for (const f of DB.families) for (const u of f.units) if (pred(u, f)) return { u, f };
    return null;
  };
  const picks = [
    ['Base door unit', find((u, f) => f.cat === 'Base' && f.sub === 'Doors' && u.D != null)],
    ['Vero-glass unit', find((u, f) => /VE/.test(u.c) && f.cat === 'Base')],
    ['Sink cabinet', find((u, f) => f.cat === 'Base' && f.sub === 'Sinks' && u.W > 0)],
    ['P1-capable unit', find((u) => u.P1 || u.op === 'P1')],
    ['E-capable unit', find((u) => u.E)],
    ['Twin-check T6080', (codeIx['T6080'] || null) && { u: codeIx['T6080'].u, f: codeIx['T6080'].f }],
  ];

  for (const [name, hit] of picks) {
    if (!hit) { console.log(`\n### ${name}: NOT FOUND`); continue; }
    const caps = computeCapabilities(hit.u, hit.f, codeIx);
    console.log(`\n### ${name}  (${hit.f.cat} · ${hit.f.sub} · "${hit.f.label}")`);
    console.log(JSON.stringify(caps, null, 2));
  }

  // spot-assert the documented twin behaviour
  const t6080 = computeCapabilities(codeIx['T6080'].u, codeIx['T6080'].f, codeIx);
  console.log('\n[assert] T6080.twinTiers includes "C":', t6080.twinTiers.includes('C'),
    '| excludes "A":', !t6080.twinTiers.includes('A'));
}
