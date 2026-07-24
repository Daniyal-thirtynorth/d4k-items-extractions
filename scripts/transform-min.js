#!/usr/bin/env node
/*
 * transform-min.js
 * Transforms the fat design-book export (docs/export-v781.json) into a MINIMAL shape
 * (docs/export-v781-min.json). Re-runnable.
 *
 * Run with a big heap:
 *   node --max-old-space-size=6144 scripts/transform-min.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IN_PATH = path.join(ROOT, 'docs', 'export-v781.json');
const OUT_PATH = path.join(ROOT, 'docs', 'export-v781-min.json');

// ---------- helpers ----------
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmptyStr = (v) => typeof v === 'string' && v.length > 0;
const nonEmptyArr = (v) => Array.isArray(v) && v.length > 0;
const present = (v) => v !== undefined && v !== null;

// set key only when value is present/non-empty
function put(obj, key, val) {
  if (val === undefined || val === null) return;
  if (typeof val === 'string' && val.length === 0) return;
  if (Array.isArray(val) && val.length === 0) return;
  if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return;
  obj[key] = val;
}

// ---------- load ----------
console.error('Reading', IN_PATH, '...');
const raw = fs.readFileSync(IN_PATH, 'utf8');
const inputSizeBytes = Buffer.byteLength(raw, 'utf8');
const data = JSON.parse(raw);

const items = data.items || [];
const programmes = data.programmes || [];
const ALLPROG = programmes.map((p) => p.id);

// sku -> kind map over ALL items (built first)
const kindBySku = Object.create(null);
for (const it of items) {
  if (it && it.sku) kindBySku[it.sku] = it.kind;
}
const skuSet = new Set(Object.keys(kindBySku));

// ---------- per-item ref harvesters ----------
function harvestCardSkus(cards, out) {
  if (!Array.isArray(cards)) return;
  for (const c of cards) {
    if (!c) continue;
    if (nonEmptyStr(c.sku)) out.push(c.sku);
    if (Array.isArray(c.variants)) {
      for (const v of c.variants) {
        if (v && nonEmptyStr(v.sku)) out.push(v.sku);
      }
    }
  }
}

function dedupExcludingSelf(arr, selfSku) {
  const seen = new Set();
  const res = [];
  for (const s of arr) {
    if (s === selfSku) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    res.push(s);
  }
  return res;
}

// ---------- transform one item ----------
function transformItem(it) {
  const out = {};

  // identity / classification (always emit sku+kind; others when present)
  put(out, 'sku', it.sku);
  put(out, 'kind', it.kind);
  put(out, 'familyId', it.familyId);
  put(out, 'name', it.name);
  put(out, 'category', it.category);
  put(out, 'subcategory', it.subcategory);
  put(out, 'section', it.section);
  out.active = it.active !== false; // always present boolean
  put(out, 'nameQualifier', it.nameQualifier);

  // dimensions
  if (isNum(it.widthMm)) out.widthMm = it.widthMm;
  if (isNum(it.heightMm)) out.heightMm = it.heightMm;
  if (isNum(it.depthMm)) out.depthMm = it.depthMm;
  if (isNum(it.heightClass)) out.heightClass = it.heightClass;

  // tiers (copy as-is)
  if (nonEmptyArr(it.availableTiers)) out.availableTiers = it.availableTiers;
  if (nonEmptyArr(it.faceForTiers)) out.faceForTiers = it.faceForTiers;

  // excludedPrograms — always present (complement of allowed list)
  let excludedPrograms = [];
  const pa = it.programmeAvailability;
  if (pa && pa.excluded === true) {
    const allowed = new Set(pa.programmes || []);
    excludedPrograms = ALLPROG.filter((k) => !allowed.has(k));
  }
  out.excludedPrograms = excludedPrograms;

  // parameters (from configure)
  if (it.configure) {
    const cfg = it.configure;
    const params = {};

    const mapWH = (arr) =>
      (arr || [])
        .map((o) => {
          const p = {};
          put(p, 'label', o.label);
          put(p, 'sku', o.sku);
          return p;
        })
        .filter((p) => Object.keys(p).length > 0);

    const width = mapWH(cfg.width);
    const height = mapWH(cfg.height);
    if (width.length) params.width = width;
    if (height.length) params.height = height;

    if (nonEmptyArr(cfg.depth)) {
      const depth = cfg.depth.map((o) => {
        const p = {};
        put(p, 'label', o.label);
        put(p, 'sku', o.sku);
        const lbl = typeof o.label === 'string' ? o.label : '';
        const noteStr = typeof o.note === 'string' ? o.note : '';
        const isAlt =
          o.alteration === true ||
          /63/.test(lbl) ||
          /alter/i.test(lbl) ||
          /alter/i.test(noteStr);
        if (isAlt) p.alteration = true;
        return p;
      });
      if (depth.length) params.depth = depth;
    }

    if (nonEmptyArr(cfg.programme)) {
      const programme = cfg.programme.map((o) => {
        const p = {};
        put(p, 'tier', o.tier);
        put(p, 'sku', o.sku);
        if (o.opening) p.opening = true;
        return p;
      });
      if (programme.length) params.programme = programme;
    }

    // FLATTEN optionRows
    if (nonEmptyArr(cfg.optionRows)) {
      const options = [];
      for (const row of cfg.optionRows) {
        if (!row || !Array.isArray(row.options)) continue;
        for (const opt of row.options) {
          if (!opt) continue;
          const o = {};
          put(o, 'group', row.label);
          put(o, 'label', opt.label);
          put(o, 'sku', opt.sku);
          put(o, 'swatch', opt.swatch);
          options.push(o);
        }
      }
      if (options.length) params.options = options;
    }

    if (Object.keys(params).length) out.parameters = params;
  }

  // ref-harvest: alterations / accessories / companions
  const accPanelSkus = [];
  const ap = it.accessoryPanel;
  if (ap && Array.isArray(ap.tabs)) {
    for (const tab of ap.tabs) {
      if (!tab || !Array.isArray(tab.sections)) continue;
      for (const sec of tab.sections) {
        if (!sec) continue;
        harvestCardSkus(sec.cards, accPanelSkus);
      }
    }
  }
  const accDedup = dedupExcludingSelf(accPanelSkus, it.sku);
  const alterations = [];
  const accessories = [];
  for (const s of accDedup) {
    if (kindBySku[s] === 'alteration') alterations.push(s);
    else accessories.push(s);
  }
  if (alterations.length) out.alterations = alterations;
  if (accessories.length) out.accessories = accessories;

  const companionSkus = [];
  if (Array.isArray(it.relatedGroups)) {
    for (const g of it.relatedGroups) {
      if (!g) continue;
      harvestCardSkus(g.cards, companionSkus);
    }
  }
  const companions = dedupExcludingSelf(companionSkus, it.sku);
  if (companions.length) out.companions = companions;

  // copy-as-is authored / structured blocks
  put(out, 'description', it.description);
  if (nonEmptyArr(it.restrictions)) out.restrictions = it.restrictions;
  if (nonEmptyArr(it.planningNotes)) out.planningNotes = it.planningNotes;
  put(out, 'didYouKnow', it.didYouKnow);
  if (nonEmptyArr(it.modifications)) out.modifications = it.modifications;
  if (it.handedLR === true) out.handedLR = true; // bool badge, only when set
  put(out, 'sinkFitment', it.sinkFitment);
  put(out, 'appliance', it.appliance);
  put(out, 'toeKick', it.toeKick);
  put(out, 'inspiration', it.inspiration);
  if (nonEmptyArr(it.finishes)) out.finishes = it.finishes;
  put(out, 'priceUnit', it.priceUnit);

  // catalog page (number only)
  if (it.catalog && isNum(it.catalog.page)) out.catalogPage = it.catalog.page;

  // lifted spec scalars
  if (it.specification) {
    if (isNum(it.specification.weightKg)) out.weightKg = it.specification.weightKg;
    if (isNum(it.specification.volumeM3)) out.volumeM3 = it.specification.volumeM3;
  }

  // engineering -> key + ok only
  if (nonEmptyArr(it.engineering)) {
    const eng = it.engineering
      .map((e) => {
        if (!e) return null;
        const o = {};
        put(o, 'key', e.key);
        if (typeof e.ok === 'boolean') o.ok = e.ok;
        return Object.keys(o).length ? o : null;
      })
      .filter(Boolean);
    if (eng.length) out.engineering = eng;
  }

  // functionalGroups (copy as-is)
  if (nonEmptyArr(it.functionalGroups)) out.functionalGroups = it.functionalGroups;

  return out;
}

// ---------- build output ----------
console.error('Transforming', items.length, 'items ...');
const outItems = new Array(items.length);
for (let i = 0; i < items.length; i++) {
  outItems[i] = transformItem(items[i]);
}

const outMeta = Object.assign({}, data.meta, {
  schemaVersion: '2.0.0-min',
  note:
    'MINIMAL transform of the v781 export. Each item reduced to a thin shape: ' +
    'configure -> parameters (label+sku pills), programmeAvailability -> excludedPrograms ' +
    '(complement of allowed list), accessoryPanel -> alterations/accessories (split by ref kind), ' +
    'relatedGroups -> companions, specification -> weightKg/volumeM3 only, catalog -> catalogPage, ' +
    'engineering -> key+ok. Bulky/derivable fields dropped. Generated by scripts/transform-min.js.',
});

const outDoc = {
  meta: outMeta,
  categories: data.categories,
  programmes: data.programmes,
  ruleTables: data.ruleTables,
  systems: data.systems,
  functionalCategories: data.functionalCategories,
  items: outItems,
};

console.error('Serializing ...');
const outStr = JSON.stringify(outDoc);
fs.writeFileSync(OUT_PATH, outStr, 'utf8');
const outputSizeBytes = Buffer.byteLength(outStr, 'utf8');

// ---------- validation + stats ----------
const MB = (b) => (b / (1024 * 1024)).toFixed(2);
const reductionPct = (((inputSizeBytes - outputSizeBytes) / inputSizeBytes) * 100).toFixed(1);

// excludedPrograms stats
let exclNonEmpty = 0;
let exclTotal = 0;
let exclMax = 0;
// parameters coverage
let withParams = 0;
let paramPillTotal = 0;
// ref arrays
let withAlt = 0,
  altTotal = 0;
let withAcc = 0,
  accTotal = 0;
let withComp = 0,
  compTotal = 0;
// dup + dangling
const outSkus = new Set();
let dupCount = 0;
const danglingSkus = new Set();

function checkRefs(arr) {
  if (!arr) return;
  for (const s of arr) if (!skuSet.has(s)) danglingSkus.add(s);
}
function countPills(params) {
  if (!params) return 0;
  let n = 0;
  for (const k of ['width', 'height', 'depth', 'programme', 'options']) {
    if (Array.isArray(params[k])) n += params[k].length;
  }
  return n;
}

for (const o of outItems) {
  if (outSkus.has(o.sku)) dupCount++;
  else outSkus.add(o.sku);

  const ep = o.excludedPrograms || [];
  if (ep.length) {
    exclNonEmpty++;
    exclTotal += ep.length;
    if (ep.length > exclMax) exclMax = ep.length;
  }

  if (o.parameters) {
    withParams++;
    paramPillTotal += countPills(o.parameters);
  }

  if (o.alterations) {
    withAlt++;
    altTotal += o.alterations.length;
  }
  if (o.accessories) {
    withAcc++;
    accTotal += o.accessories.length;
  }
  if (o.companions) {
    withComp++;
    compTotal += o.companions.length;
  }

  checkRefs(o.alterations);
  checkRefs(o.accessories);
  checkRefs(o.companions);
  if (o.parameters) {
    for (const k of ['width', 'height', 'depth', 'programme', 'options']) {
      const arr = o.parameters[k];
      if (Array.isArray(arr)) {
        for (const p of arr) if (nonEmptyStr(p.sku) && !skuSet.has(p.sku)) danglingSkus.add(p.sku);
      }
    }
  }
}

const avg = (t, n) => (n ? (t / n).toFixed(2) : '0');

const report = [];
report.push('# Minimal transform — validation report (v781)');
report.push('');
report.push('## 1. Size');
report.push(`- input:  ${MB(inputSizeBytes)} MB (${inputSizeBytes.toLocaleString()} bytes)`);
report.push(`- output: ${MB(outputSizeBytes)} MB (${outputSizeBytes.toLocaleString()} bytes)`);
report.push(`- reduction: ${reductionPct}%`);
report.push('');
report.push('## 2. Item count');
report.push(`- in:  ${items.length}`);
report.push(`- out: ${outItems.length}`);
report.push(`- equal: ${items.length === outItems.length ? 'YES' : 'NO — MISMATCH'}`);
report.push('');
report.push('## 3. excludedPrograms');
report.push(`- ALLPROG size: ${ALLPROG.length}`);
report.push(`- items with non-empty: ${exclNonEmpty} (${((exclNonEmpty / outItems.length) * 100).toFixed(1)}%)`);
report.push(`- avg length (over non-empty): ${avg(exclTotal, exclNonEmpty)}`);
report.push(`- avg length (over ALL items): ${avg(exclTotal, outItems.length)}`);
report.push(`- max length: ${exclMax}`);
report.push('');
report.push('## 4. parameters coverage');
report.push(`- items with parameters: ${withParams} (${((withParams / outItems.length) * 100).toFixed(1)}%)`);
report.push(`- avg pill count (over items w/ parameters): ${avg(paramPillTotal, withParams)}`);
report.push('');
report.push('## 5. alterations / accessories / companions coverage');
report.push(`- alterations: ${withAlt} items non-empty, avg len ${avg(altTotal, withAlt)}`);
report.push(`- accessories: ${withAcc} items non-empty, avg len ${avg(accTotal, withAcc)}`);
report.push(`- companions:  ${withComp} items non-empty, avg len ${avg(compTotal, withComp)}`);
report.push('');
report.push('## 6. integrity');
report.push(`- duplicate skus in output: ${dupCount}`);
report.push(`- distinct dangling ref skus (not in item set): ${danglingSkus.size}`);
report.push(`  (expected some — e.g. tier-sibling P/A/C targets, 760/761 handle codes)`);
report.push(`  sample: ${Array.from(danglingSkus).slice(0, 25).join(', ')}`);
report.push('');
report.push('## Top-level keys note');
report.push(`- output keys: ${Object.keys(outDoc).join(', ')}`);
report.push(`- DROPPED from source top-level: functionalCategories (per-item functionalGroups is retained)`);

const reportStr = report.join('\n');
console.log(reportStr);

// ---------- sample prints ----------
const bySkuOut = Object.create(null);
for (const o of outItems) bySkuOut[o.sku] = o;

console.log('\n\n## 7. Full transformed item — TK6080BZ2');
console.log(JSON.stringify(bySkuOut['TK6080BZ2'], null, 2));

// first accessory item
const accSample = outItems.find((o) => o.kind === 'accessory');
console.log('\n## 7b. One accessory item —', accSample && accSample.sku);
console.log(JSON.stringify(accSample, null, 2));

console.log('\n\nOUTPUT WRITTEN:', OUT_PATH);
console.log('OUTPUT SIZE:', MB(outputSizeBytes), 'MB');
