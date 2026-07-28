#!/usr/bin/env node
/*
 * Build the parity sweep plan: (category, subcategory) × toolbar state.
 * Each entry carries BOTH sides' driver input so the keys line up:
 *   {key, state}   → client app  (window.state fields)
 *   {key, filters} → our lite UI (the F filter object)
 *
 *   node scripts/parity/make-plan.js <Category> [more...]   # writes scripts/parity/plan.json
 *
 * Toolbar mapping (audit §H/§2c-7): the app's top "H All 73 80 86" bar IS its LINE selector
 * (state.line); ours mirrors it with F.heightClass (base context) + F.line (tall context).
 */
const fs = require('fs');
const path = require('path');

// client nav (cat → subs), dumped from __P.nav()
const NAV = {
  Base: ['Accessories & Surround', 'Appliance housing', 'Cooktops & Downdrafts', 'Corners', 'Doors', 'Drawers & Pullouts', 'Fillers', 'Function Cabinets', 'Open & Lights', 'Sinks', 'Special Height', 'Trash Pullout'],
  Tall: ['Accessory surround', 'Appliance housing', 'Back & Side Panels', 'Closet & Wardrobe', 'Corner', 'Drawers & Accessories', 'Fillers', 'Glass unit', 'Modular Units', 'Open shelf', 'Panels, Fillers & Surrounds', 'Passage doors', 'Slide-away', 'Sliding Systems', 'Sliding doors', 'Tall storage', 'Top Cupboard'],
  Wall: ['Corner', 'Fillers', 'Glass unit', 'Interior+', 'Lift-Up', 'Open shelf', 'Ventilation & Micro', 'Wall unit'],
  Midway: ['Accessory surround', 'Appliances', 'Cabinets & Slide Away', 'Drawers & Pull-outs', 'Glass unit', 'Lighting', 'Open shelf', 'Roller Shutter'],
};

// state name → [client state override, our F filters]
const STATES = [
  ['base', {}, {}],
  ['d48', { depth: 48 }, { depthClass: 48 }],
  ['d63', { depth: 63 }, { depthClass: 63 }],
  ['d68', { depth: 68 }, { depthClass: 68 }],
  ['line73', { line: '73' }, { heightClass: '73', line: '73' }],
  ['line80', { line: '80' }, { heightClass: '80', line: '80' }],
  ['line86', { line: '86' }, { heightClass: '86', line: '86' }],
  ['w60', { width: 60 }, { widthMm: 600 }],
  ['w90', { width: 90 }, { widthMm: 900 }],
  ['progP_BOSSA', { prog: '244' }, { programs: '244' }],
  ['progA_LAIKA', { prog: '410' }, { programs: '410' }],
  ['progC_ROCCA', { prog: '701' }, { programs: '701' }],
  ['tierC', { tier: 'C' }, { tier: 'C' }],
  ['tierA', { tier: 'A' }, { tier: 'A' }],
  ['w60_line73', { width: 60, line: '73' }, { widthMm: 600, heightClass: '73', line: '73' }],
  ['progP_d68', { prog: '244', depth: 68 }, { programs: '244', depthClass: 68 }],
];

const cats = process.argv.slice(2);
if (!cats.length) { console.error('usage: make-plan.js <Category> [...]  (' + Object.keys(NAV).join(', ') + ')'); process.exit(1); }

const plan = [];
for (const cat of cats) {
  const subs = NAV[cat];
  if (!subs) { console.error('unknown category: ' + cat); process.exit(1); }
  for (const sub of subs) {
    for (const [name, cs, os] of STATES) {
      plan.push({
        key: `${cat}|${sub}|${name}`,
        state: Object.assign({ cat, sub }, cs),
        filters: Object.assign({ category: cat, subcategory: sub }, os),
      });
    }
  }
}
const out = path.join(__dirname, 'plan.json');
fs.writeFileSync(out, JSON.stringify(plan));
console.log(`plan: ${plan.length} combos (${cats.join(', ')}) -> ${out}`);
