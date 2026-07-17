#!/usr/bin/env node
/**
 * build-sample-v2.js — assemble docs/export-sample-v2.json
 * =========================================================
 * Pulls REAL items out of the full v781 fresh export and trims them into a small,
 * readable worked sample that exercises EVERY object in docs/export-schema-v2.ts.
 * Mirrors the v1 sample style: every object carries a plain-English `_ui` doc-key
 * that the backend must STRIP on ingest (`_ui` is NOT part of the schema).
 *
 * Re-run:  node --max-old-space-size=6144 scripts/build-sample-v2.js
 * (Reads docs/export-v781-fresh.json — 55 MB — never loaded by Read; node only.)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'docs');
const SRC = path.join(DOCS, 'export-v781-fresh.json');
const OUT = path.join(DOCS, 'export-sample-v2.json');

const full = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const byS = Object.create(null);
for (const it of full.items) byS[it.sku] = it;

/* ── helpers ─────────────────────────────────────────────────────────── */
const clone = (o) => JSON.parse(JSON.stringify(o));
// put a `_ui` doc-key FIRST (like the v1 sample), preserving the rest of the order
const ui = (text, obj) => ({ _ui: text, ...obj });
// add a `_ui` FIRST onto a nested object that already lives on `parent[key]`
const uiOn = (parent, key, text) => { if (parent && parent[key] && typeof parent[key] === 'object' && !Array.isArray(parent[key])) parent[key] = { _ui: text, ...parent[key] }; };
const take = (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : arr);

// pull a real item, deep-clone it, and run a per-sku trim/annotate function
function pick(sku, fn) {
  const src = byS[sku];
  if (!src) throw new Error('missing sku in fresh export: ' + sku);
  const it = clone(src);
  return fn ? fn(it) : it;
}

// generic trims applied to keep the sample readable (long arrays only)
function trimCommon(it, { finishes = 3, restrictions = 3, planningNotes = 3, alterations = 4, companions = 3, accessories = 5 } = {}) {
  if (it.finishes) it.finishes = take(it.finishes, finishes);
  if (it.restrictions) it.restrictions = take(it.restrictions, restrictions);
  if (it.planningNotes) it.planningNotes = take(it.planningNotes, planningNotes);
  if (it.alterations) it.alterations = take(it.alterations, alterations);
  if (it.companions) it.companions = take(it.companions, companions);
  if (it.accessories) it.accessories = take(it.accessories, accessories);
  return it;
}
// trim the (sometimes 30+) programme-exclusion lists but keep them REAL
function trimExcluded(caps, n = 8) {
  if (caps.excludedPrograms && caps.excludedPrograms.length > n) caps.excludedPrograms = caps.excludedPrograms.slice(0, n);
  if (caps.excludedProgramsE && caps.excludedProgramsE.length > n) caps.excludedProgramsE = caps.excludedProgramsE.slice(0, n);
  return caps;
}

/* ══════════════════════════ ITEMS ══════════════════════════ */
const items = [];

/* 1 — rich cabinet: Capabilities (excludedPrograms non-empty → programme rule),
 *     Parameters (W/H/D/Programme with P1/C1 opening pills), AccessoryRef + VariantRef,
 *     alterations, companions, ToeKick, Description, FinishPrice, ItemFunctionalGroup. */
items.push(pick('TK7080BZ2', (it) => {
  trimCommon(it, { accessories: 4 });
  // excludedPrograms (273=VERVE-FS, 561=CARRÉ-FS …) are kept REAL & whole — small (5) and
  // two of them (273/561) are in this sample's programmes[], so the gate is concretely demonstrable.
  uiOn(it, 'capabilities',
    '⭐ THE RULE INPUTS. The client feeds this + its toolbar to availableFromCaps() (see schema) to decide if a ' +
    'configure PILL that TARGETS this sku is live/grey/dead. Here: tier "P" native + tierTwins ["A"] → greys under an ' +
    'AVANCE-only toolbar; excludedPrograms ["273","280","281","295","561"] → greyed in those 5 programmes (273=VERVE-FS, ' +
    '561=CARRÉ-FS, both in this sample\'s programmes[]); openP1:true so the P1 opening pill resolves; depthClasses [58,68].');
  uiOn(it, 'parameters',
    'The H/W/D/Programme pill rows (card + Configure box). THIN in v2 — each pill is just {label, sku}; ' +
    'availability + selected state are DERIVED at read (selected = pill.sku===item.sku; grey = availableFromCaps(target.caps)===false; ' +
    'dead = sku null/absent). The "63" depth pill carries alteration:true; programme pills P1/C1 carry opening:true.');
  return ui('RICH CABINET — one orderable code + its detail screen. Exercises Capabilities (the pill-gate rule inputs), ' +
    'Parameters (W/H/D/Programme pills incl. P1/C1 opening), thin ref lists (alterations = sku codes; accessories = a mix of ' +
    'plain sku strings AND {sku,variants} for the L3/M3·M8 runner + 1m/1.6m/2m cable rows), companions, finishes (trimmed to 3), ' +
    'toeKick, and one functionalGroups leaf. Note accessories[] here shows BOTH AccessoryRef shapes.', it);
}));

/* 2 — Vero unit: FinishInterior (Swatch grid + VisibleSideCombo table + optionCodes chips),
 *     DidYouKnow, EngineeringFlag[]. */
items.push(pick('T4573VE', (it) => {
  trimCommon(it, { accessories: 3 });
  it.finishInterior.swatches = take(it.finishInterior.swatches, 3);
  it.finishInterior.visibleSideCombos = take(it.finishInterior.visibleSideCombos, 3);
  uiOn(it, 'finishInterior',
    'The Vero "Finish interior" sub-panel (NOT sku refs). swatches[] = the colour-square grid (trimmed 19→3; img built ' +
    'from the Finish host); visibleSideCombos[] = the "which visible-side finishes are allowed per interior finish" table ' +
    '(catalog ch.11, trimmed →3); optionCodes[] = extra-charge interior-style CHIPS — plain codes (MPK/KH/KG …), do NOT ' +
    'make cards/lookups from them.');
  uiOn(it, 'didYouKnow', 'The 💡 "Did you know?" cross-order tip. codes[] each carry a sibling sku the tip links to.');
  return ui('VERO FRONT — the only kind with finishInterior. Exercises FinishInterior/Swatch/VisibleSideCombo, ' +
    'DidYouKnow, and the engineering[] {key,ok} flags.', it);
}));

/* 3 — Base/Sinks unit: SinkFitment + nameQualifier + FaceTierKey via handedLR/modifications too. */
items.push(pick('CT2073', (it) => {
  trimCommon(it, { accessories: 4 });
  uiOn(it, 'parameters', 'accessories below carry the IGS2058 L3/M3·M8 variant pair — the canonical {sku,variants} AccessoryRef.');
  return ui('DOOR CABINET — carries handedLR:true (the "L/R" left/right-hinge badge), modifications[] ("Modifications — how to": ' +
    '760/761 handle-less recipes), didYouKnow, and accessories[] with the IGS2058 {sku,variants:[{label:"L3/M3"},{label:"M8"}]} pair. ' +
    'Exercises Modification + handedLR + the variant AccessoryRef.', it);
}));

/* 4 — Base/Sinks: SinkFitment + nameQualifier. */
items.push(pick('TSPA8073BTZW', (it) => {
  trimCommon(it, { accessories: 3 });
  uiOn(it, 'sinkFitment',
    'The Base/Sinks "Max Sink Size: NN″" line + "＋ Add Sink" popup + detail "Sink fitment" section. showOnCard:true drives the ' +
    'card ＋Add-Sink button; maxSinkSizeInch/cabinetWidthCm come from the width; customAboveInch:42 is the "needs a custom unit" cutoff.');
  return ui('TRASH/SINK PULLOUT (Base · Sinks) — exercises sinkFitment AND nameQualifier ("Trash Pullout", the amber sub-label ' +
    'after the title, from vsub[vr]). Also a good second handedLR/engineering example.', it);
}));

/* 5 — Refrigerator appliance front: ApplianceHousing (Refrigerators shape) + frontE/hasE/excludedProgramsE
 *     (the single-front "Full-E" exclusion path) + handleFree/singleHandle + InspirationBlock + frontModifiers +
 *     a DEAD DimPill (depth "63" alteration with no sku). */
items.push(pick('GF46204', (it) => {
  trimCommon(it, { restrictions: 2, planningNotes: 2 });
  trimExcluded(it.capabilities, 8);
  uiOn(it, 'capabilities',
    'E-MODE example. hasE:true + frontE:true (one-piece front) + a NON-empty excludedProgramsE[] — those extra exclusions apply ' +
    'ONLY when the toolbar is in single-front / "Full-E" mode (state.front===1). handleFree:true + singleHandle:true (no-handle ' +
    'appliance door). excludedPrograms/excludedProgramsE trimmed to 8 each (real, but the full lists are 27/10).');
  uiOn(it, 'appliance',
    'APPLIANCES popup (card button, tooltip "Appliances"). Refrigerators shape = brand·category·nicheSize ONLY (no subcategory/note — ' +
    'those are Dishwashers-only). category "Refrigerators" picks the fridge glyph; nicheSize "18\"" derives from width 460 mm.');
  uiOn(it, 'inspiration',
    'The camera-icon lightbox photo (top-level card mirror so the list API returns it). heading = code/dims line; imageUrl on the ' +
    'inspiration host; fullScreen → "View full screen".');
  uiOn(it, 'parameters',
    'Note the depth "63" pill: {label:"63", alteration:true} with NO sku → a DEAD pill (renders grey + inert, nowhere to navigate).');
  return ui('REFRIGERATOR appliance front. Exercises ApplianceHousing (Refrigerators variant), the E-mode capability path ' +
    '(hasE/frontE/excludedProgramsE), handleFree/singleHandle, InspirationBlock, frontModifiers (spec "Modifiers" line), and a ' +
    'dead alteration DimPill.', it);
}));

/* 6 — Dishwasher appliance-housing front: ApplianceHousing (Dishwashers shape, subcategory + note) + FaceTierKey. */
items.push(pick('CGFV608061S2Z', (it) => {
  trimCommon(it, { restrictions: 2, planningNotes: 2 });
  if (it.capabilities) trimExcluded(it.capabilities, 8);
  uiOn(it, 'appliance',
    'DISHWASHER shape of the popup — adds subcategory ("Built-In"; "Built-In ADA" when heightClass 73) AND a note (leg/cross-brand ' +
    'fitment). Popup reads "Gaggenau · Dishwashers · Built-In · 24\"" then the note line.');
  return ui('DISHWASHER FRONT (Base · Appliance housing) — the DW ApplianceHousing shape (subcategory + note), plus faceForTiers ' +
    '["_","C"] (the tier contexts in which this unit is its family\'s FACE card — NOT derivable, captured from the app).', it);
}));

/* 7 — premium opening variant: Capabilities.op set. */
items.push(pick('P1TSP4573B', (it) => {
  trimCommon(it, { accessories: 3 });
  trimExcluded(it.capabilities, 8);
  uiOn(it, 'capabilities',
    'op:"P1" — THIS unit IS the premium P1 opening variant ("one handle on top"). availableTiers is ["P1"], so under any tier ≠ P1 ' +
    'the tierOk gate fails. (P1/C1 codes are a prefix on a base; most are synthesized, but recovered/real ones like this are stored.)');
  return ui('P1 OPENING VARIANT — exercises Capabilities.op ("P1"). The one item shape where op is non-null.', it);
}));

/* 8 — options row: Parameters.options (OptionPill — the coded "Ty" row). */
items.push(pick('T3027Z', (it) => {
  trimCommon(it, { accessories: 4, restrictions: 2, planningNotes: 2 });
  trimExcluded(it.capabilities, 8);
  uiOn(it, 'parameters',
    'options[] = the flattened coded selector row(s) beyond W/H/D/Programme — here "Ty" (S7 · Z · SZ). Each OptionPill is ' +
    '{group,label,sku}; clicking opens that sibling. (swatch is set only on the handle "Finish" row — none in this sample; 0 in the real export.)');
  return ui('STORAGE Z UNIT — exercises Parameters.options (the "Ty" OptionPill row) plus a second Modification[] example.', it);
}));

/* 9 — FRMAT: Capabilities.isFrmat true. */
items.push(pick('FRMAT', (it) => {
  trimCommon(it, { finishes: 3, restrictions: 3, planningNotes: 2 });
  trimExcluded(it.capabilities, 8);
  uiOn(it, 'capabilities',
    'isFrmat:true — the 1-unit FRMAT max-size-table family. The backend layers FRMAT_MAX[programmeName] ON TOP of the normal gate ' +
    '(the sole residual in the 99.997% capabilities verification). Also shows faceForTiers ["_","P","A","C"] (face in every tier context).');
  return ui('FRMAT front-panel material — the isFrmat:true special case.', it);
}));

/* 10 — recovered artifact + alwaysAvailable + tier:null. */
items.push(pick('L24CD', (it) => {
  trimCommon(it, { planningNotes: 2 });
  uiOn(it, 'capabilities',
    'alwaysAvailable:true (app u._c) short-circuits EVERY gate → the pill never greys. tier:null = line-neutral (never greys by tier). ' +
    'This is one of meta.recoveredArtifactSkus — a code the app\'s init deleted as an artifact but which is a real orderable unit, ' +
    'recovered from the raw <script id="DATA">.');
  return ui('RECOVERED ARTIFACT (LED control) — from meta.recoveredArtifactSkus. Exercises Capabilities.alwaysAvailable:true + tier:null.', it);
}));

/* 11 — alteration kind. */
items.push(pick('ANST', (it) => {
  trimCommon(it, { finishes: 2, planningNotes: 2 });
  return ui('ALTERATION item (kind:"alteration") — the target of every cabinet\'s alterations[] sku list (e.g. TK7080BZ2 above lists "ANST"). ' +
    'One code, referenced by thousands of units, stored ONCE.', it);
}));

/* 12 — accessory kind + FaceTierKey. */
items.push(pick('VSF135ADP', (it) => {
  trimCommon(it, { finishes: 2, planningNotes: 2 });
  return ui('ACCESSORY item (kind:"accessory") — a plinth cover. The target of an accessories[] / companions[] ref, stored once. ' +
    'Also carries faceForTiers. (kind "part" has ZERO instances in v781 — the fourth ItemKind value is valid but unused here.)', it);
}));

/* ══════════════════════════ TOP LEVEL ══════════════════════════ */

// meta — real, with an added _ui note (schemaVersion 2.0.0, real recoveredArtifactSkus kept).
const meta = ui(
  'Illustrative sample of the v2 (MINIMAL + CAPABILITIES) contract. The items below between them exercise EVERY object in ' +
  'export-schema-v2.ts. Some refs (alterations/accessories/companions sku codes, pill targets) point at items outside this small ' +
  'slice; in a real export every referenced sku exists in items[]. Any key starting with `_ui` is plain-English DOCUMENTATION ONLY — ' +
  'the backend MUST strip every `_ui` key on ingest; `_ui` is NOT part of the schema. counts here describe THIS sample, not the full catalog.',
  {
    generated: full.meta.generated,
    source: full.meta.source + ' — SAMPLE',
    schemaVersion: full.meta.schemaVersion,
    imageUrlTemplate: full.meta.imageUrlTemplate,
    counts: {
      items: items.length,
      cabinets: items.filter((i) => i.kind === 'cabinet').length,
      accessories: items.filter((i) => i.kind === 'accessory').length,
      categories: 3,
      programmes: 6,
    },
    // keep a few real recovered skus (L24CD is used above) so the field's shape is visible
    recoveredArtifactSkus: full.meta.recoveredArtifactSkus.slice(0, 6),
    note: full.meta.note,
  }
);

// categories — 3 real, trimmed. Base keeps only the subcats this sample uses; sections trimmed to 2.
const fullCatByName = Object.create(null);
for (const c of full.categories) fullCatByName[c.name] = c;
function trimCat(name, keepSubs) {
  const c = clone(fullCatByName[name]);
  if (keepSubs) c.subcategories = c.subcategories.filter((s) => keepSubs.includes(s.name));
  for (const s of c.subcategories) if (s.sections) s.sections = take(s.sections, 2);
  return c;
}
const categories = [
  ui('LEFT SIDEBAR TYPE taxonomy (distinct from functionalCategories). Trimmed: only 3 of the real 14 categories, and Base keeps ' +
    'only the sub-categories this sample\'s items live in. On each item: category/subcategory/section.',
    trimCat('Base', ['Cooktops & Downdrafts', 'Sinks', 'Appliance housing', 'Doors'])),
  trimCat('Lighting', ['LED', 'Niche Shelf']),
  trimCat('Alteration', ['Cabinet Modifications', 'Sink', 'Accessory']),
];

// programmes — 6 real covering PRIMO / AVANCE / CONTINO / CONTINO-12; 273 & 561 are in
// TK7080BZ2.excludedPrograms so the programme rule is concretely resolvable.
const progById = Object.create(null);
for (const p of full.programmes) progById[p.id] = p;
const programmes = ['201', '273', '561', '410', '701', '613'].map((id, i) =>
  i === 0
    ? ui('TOP-LEFT dropdown kitchen lines. Items refer to these ids in Capabilities.excludedPrograms. 6 shown (real export = 120), ' +
        'covering PRIMO/AVANCE/CONTINO/CONTINO-12. "273" (VERVE-FS) and "561" (CARRÉ-FS) appear in TK7080BZ2.capabilities.excludedPrograms ' +
        'above — so that item greys in exactly those programmes.', clone(progById[id]))
    : clone(progById[id])
);

// ruleTables — trimmed real passthrough (2 of 10 tables), like the v1 sample.
const ruleTables = ui(
  'Passthrough reference tables (handle/opening/antoso/lighting/…). Trimmed to 2 of the real 10 for readability — the backend passes ' +
  'the whole object through unchanged (RuleTables = Record<string, unknown>). Omit entirely or send {} if unused.',
  {
    handle_systems: full.ruleTables.handle_systems,
    opening_systems: full.ruleTables.opening_systems,
  }
);

// systems — both real System Builder bundles, unchanged, + one _ui note on the first.
const systems = clone(full.systems);
systems[0] = ui(
  'SYSTEM BUILDER bundle. Attaches to an item\'s detail screen when its sku ∈ triggerSkus. required[]/optional[] are SystemSlots; ' +
  'each slot lists SlotOption skus with an optional default (e.g. the 100/160/200 cm connecting-cable pick). Only the runtime ' +
  'clipboard + status ticks are UI-only; this COMPOSITION is exported.',
  systems[0]
);

// functionalCategories — trimmed to inspiration + allCategories + ONE zone (Base) w/ ONE group
// (Water, leaves trimmed to 2) + ONE moreCategory (Alteration, subs trimmed to 2).
const fc0 = full.functionalCategories;
const zoneBase = clone(fc0.zones[0]);
zoneBase.groups = [clone(zoneBase.groups[0])];
zoneBase.groups[0].leaves = take(zoneBase.groups[0].leaves, 2);
const moreAlt = clone(fc0.moreCategories.find((m) => m.category === 'Alteration'));
moreAlt.subs = take(moreAlt.subs, 2);
const functionalCategories = ui(
  'The "Design Tasks" SECOND sidebar (render-ready; distinct from categories[]). Trimmed to show shape: inspiration + allCategories + ' +
  'ONE zone (Base) with ONE group (Water) and 2 of its leaves + ONE moreCategory (Alteration, 2 subs). A leaf claims an item when ANY ' +
  'of its match[] rules hits the item\'s cat/sub/section/familyId; membership is materialized per item in Item.functionalGroups[]. ' +
  'Real export has 4 zones + 7 moreCategories.',
  {
    inspiration: fc0.inspiration,
    allCategories: fc0.allCategories,
    zones: [zoneBase],
    moreCategories: [moreAlt],
  }
);

/* ══════════════════════════ WRITE ══════════════════════════ */
const sample = { meta, categories, programmes, ruleTables, systems, functionalCategories, items };
fs.writeFileSync(OUT, JSON.stringify(sample, null, 2) + '\n', 'utf8');

/* ── validate + coverage checklist ─────────────────────────────────────── */
JSON.parse(fs.readFileSync(OUT, 'utf8')); // throws if invalid JSON
console.log('WROTE', OUT, '(' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB)\n');
console.log('Top-level objects: meta, categories(' + categories.length + '), programmes(' + programmes.length +
  '), ruleTables, systems(' + systems.length + '), functionalCategories, items(' + items.length + ')\n');

const rows = [
  ['TK7080BZ2', 'cabinet', 'Item, Capabilities(excludedPrograms,tierTwins,openP1,depthClasses), Parameters(W/H/D/Programme+opening), DimPill(alteration), ProgrammePill(opening), AccessoryRef(string+{sku,variants}), VariantRef, alterations, companions, ToeKick, Description, FinishPrice, ItemFunctionalGroup'],
  ['T4573VE', 'cabinet', 'FinishInterior, Swatch, VisibleSideCombo, optionCodes, DidYouKnow, EngineeringFlag'],
  ['CT2073', 'cabinet', 'handedLR, Modification, didYouKnow, accessories{sku,variants} (IGS2058 L3/M3·M8)'],
  ['TSPA8073BTZW', 'cabinet', 'SinkFitment, nameQualifier'],
  ['GF46204', 'cabinet', 'ApplianceHousing(Refrigerators), Capabilities.hasE/frontE/excludedProgramsE, handleFree/singleHandle, InspirationBlock, frontModifiers, dead DimPill'],
  ['CGFV608061S2Z', 'cabinet', 'ApplianceHousing(Dishwashers: subcategory+note), faceForTiers'],
  ['P1TSP4573B', 'cabinet', 'Capabilities.op="P1"'],
  ['T3027Z', 'cabinet', 'Parameters.options / OptionPill (Ty row), Modification'],
  ['FRMAT', 'cabinet', 'Capabilities.isFrmat=true, faceForTiers'],
  ['L24CD', 'cabinet', 'Capabilities.alwaysAvailable=true + tier:null, recoveredArtifactSkus member'],
  ['ANST', 'alteration', 'ItemKind "alteration"'],
  ['VSF135ADP', 'accessory', 'ItemKind "accessory", faceForTiers'],
];
console.log('Per-item schema coverage:');
for (const [sku, kind, cov] of rows) console.log('  • ' + sku + ' [' + kind + '] → ' + cov);
console.log('\nTop-level: ExportMeta(+recoveredArtifactSkus), Category/Subcategory, Programme(PRIMO/AVANCE/CONTINO/CONTINO-12),');
console.log('           RuleTables, EngineeredSystem/SystemSlot/SlotOption (SENSO+LLER), Sidebar/SidebarZone/SidebarGroup/');
console.log('           SidebarLeaf/FunctionalMatchRule/MoreCategory/MoreCategoryLeaf, ItemFunctionalGroup.');
console.log('\nNOTE: ItemKind "part" has 0 instances in v781 — valid enum value, no real item to sample.');
console.log('      OptionPill.swatch set 0× in the real export — shape documented on T3027Z, no real value to sample.');
