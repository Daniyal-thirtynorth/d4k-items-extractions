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

// client nav (cat → subs), dumped from __P.nav() — ALL 14 categories (v781).
// Base/Tall/Wall/Midway are the four swept in rounds 1-4; the other ten were the §O scope gap.
const NAV = {
  Base: ['Accessories & Surround', 'Appliance housing', 'Cooktops & Downdrafts', 'Corners', 'Doors', 'Drawers & Pullouts', 'Fillers', 'Function Cabinets', 'Open & Lights', 'Sinks', 'Special Height', 'Trash Pullout'],
  Tall: ['Accessory surround', 'Appliance housing', 'Back & Side Panels', 'Closet & Wardrobe', 'Corner', 'Drawers & Accessories', 'Fillers', 'Glass unit', 'Modular Units', 'Open shelf', 'Panels, Fillers & Surrounds', 'Passage doors', 'Slide-away', 'Sliding Systems', 'Sliding doors', 'Tall storage', 'Top Cupboard'],
  Wall: ['Corner', 'Fillers', 'Glass unit', 'Interior+', 'Lift-Up', 'Open shelf', 'Ventilation & Micro', 'Wall unit'],
  Midway: ['Accessory surround', 'Appliances', 'Cabinets & Slide Away', 'Drawers & Pull-outs', 'Glass unit', 'Lighting', 'Open shelf', 'Roller Shutter'],
  Lighting: ['Budget lights', 'Control & Switch', 'LED', 'Light Bridge', 'Lights Service', 'Niche Shelf'],
  'Closet & Wardrobe': ['Shelf units'],
  'Panels & surround': ['Benches & Tables', 'Ceiling Blenders', 'FIOS Frame Shelves', 'Open Shelf Units', 'Pilasters', 'Plinth', 'Plinth Accessories', 'Shelves B', 'Side panels W', 'Surround', 'Wall Cladding'],
  'Wall cladding': ['Niche panels'],
  'Accessories & interior': ['Anti slip mats', 'Beech equipment', 'Cable management', 'Combo', 'Domo Rail', 'Further accessories', 'Inner drawers & pullouts', 'Interior+', 'L-Box in oak', 'L-Box in walnut', 'Plastic equipment', 'Q-Box / Q-Vario', 'Shelves', 'Slicer / Folding steps', 'Wire accessories / Drop-in trays', 'Worktop socket'],
  Alteration: ['Accessory', 'Cabinet Modifications', 'Drawers & Pull-outs', 'Fillers', 'Front Combination', 'Glass unit', 'Open shelf', 'Side Panel Modifications', 'Sink', 'Slide-Away', 'Ventilation'],
  Handles: ['Bar Handles', 'Bow Handles', 'Extra Charges', 'Griprails', 'Handle Screws', 'Handle-Less & Electric', 'Inset Handles', 'Knobs', 'LED Handle Profiles', 'Recessed · Avance & Contino', 'Vertical Recessed'],
  Service: ['Care & Consumables', 'Drawer Systems', 'Hinges & Hardware', 'Legacy Lighting', 'Storage Accessories', 'Waste Systems'],
  Sink: ['Accessories & Modifications', 'Faucets'],
  Countertops: ['Compact Material · Niche Panels', 'Compact Material · Processing', 'Compact Material · Processing (KPK)', 'Compact Material · Processing (KPS)', 'Compact Material · Side Panels', 'Compact Material · Worktops', 'Glass · Backsplash', 'Glass · Niche Panels', 'Glass · Processing', 'Glass · Side Panels', 'Glass · Worktops', 'Laminate · Accessories', 'Laminate · Processing', 'Laminate · Worktops & Edge Styles', 'Natural Stone · Accessories', 'Natural Stone · Niche Panels', 'Natural Stone · Processing', 'Natural Stone · Side Panels', 'Natural Stone · Worktops', 'Porcelain Ceramic · Accessories', 'Porcelain Ceramic · Niche Panels', 'Porcelain Ceramic · Processing', 'Porcelain Ceramic · Processing (KPK)', 'Porcelain Ceramic · Processing (KPS)', 'Porcelain Ceramic · Side Panels', 'Porcelain Ceramic · Worktops', 'Solid Wood · Accessories', 'Solid Wood · Processing', 'Solid Wood · Worktops', 'Stainless Steel · Processing', 'Stainless Steel · Worktops'],
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

/*
 * LITE — the 8 states worth running on the ten non-core categories (task 2 / §P). They are
 * accessory / countertop / handle taxonomies with no carcase-line or depth axis of their own, so the
 * full 16 would spend most of its budget re-proving that a depth pill nobody renders changes nothing.
 * Kept: one no-op baseline, the depth and line axes that DO hide families, one width, all three
 * programme tiers (the gate surface), and one Fronts chip.
 */
const LITE = new Set(['base', 'd68', 'line73', 'w60', 'progP_BOSSA', 'progA_LAIKA', 'progC_ROCCA', 'tierC']);

/*
 * FLAGS — the toolbar inputs no leg has ever driven (§O scope gap). `grey` is NOT a filter on our
 * side: the lite UI reads `window.__GREY`, so the dumper takes it via opts (`__Q.sweep(list, {grey:true})`),
 * which is why these entries carry a `greyMode` marker instead of a filter key.
 */
const FLAG_STATES = [
  ['grey_on', { lineGrey: true, depth: 68 }, { depthClass: 68 }, { grey: true }],
  ['grey_on_line73', { lineGrey: true, line: '73' }, { heightClass: '73', line: '73' }, { grey: true }],
  ['open_P1', { open: 'P1' }, { opening: 'P1' }],
  ['open_C1', { open: 'C1' }, { opening: 'C1' }],
  // ⚠️ SUSPENDED **IS** ANTOSO. The app's toggle is one function — `setSusp(on){ state.susp=!!on;
  // state.antoso=!!on; }` (v781 `:5059`, and `toggleAntoso` just calls it) — and `state.susp` alone
  // is DISPLAY ONLY (the plinth text). Driving `susp` without `antoso` dumped a plain base grid,
  // which made our `suspended` engineering filter look like an invented control. It isn't: the app's
  // counterpart is `state.antoso` (membership + the `antosoOk` gate + a re-face). See audit §P4.
  ['susp', { susp: true, antoso: true }, { antoso: true }],
  ['tallH204', { height: 204 }, { tallHeight: 204 }],
  ['tallH217_line80', { height: 217, line: '80' }, { tallHeight: 217, heightClass: '80', line: '80' }],
  ['q_TSP', { q: 'TSP' }, { q: 'TSP' }],
  ['q_HWS', { q: 'HWS' }, { q: 'HWS' }],
];
/*
 * ⚠️ NO `page2` STATE, deliberately. v781's `renderGrid` does not paginate — `state.per` is 30 but
 * nothing slices by it and there is no `#pager` element, so `Base` (no sub) renders all 232 cards and
 * `state.page = 2` is byte-identical to page 1 (measured). `page` is therefore an OURS-ONLY API
 * feature with no ground truth to diff against; testing it here would manufacture a fake mismatch.
 * The related risk — our `limit` silently truncating a state the app renders whole — is real but not
 * live: the widest state in any dump is 56 cards against `limit: 200`.
 */

/*
 * TASK STATES — the Design-Tasks sidebar leg (§O scope gap: `leafId` / `groupKey` were never swept,
 * and `bucketSections`'s `isTaskView` arm has never executed under the harness). Three states only:
 * the leg's value is in the 84 nav targets, not in re-running the toolbar over each of them.
 */
const TASK_STATES = ['base', 'progP_BOSSA', 'd68'];

const argv = process.argv.slice(2);
const opt = (n, d) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const setName = opt('states', 'core');
const outName = opt('out', 'plan.json');
const cats = argv.filter((x) => !x.startsWith('--'));

// --tasks: build the plan from the app's own TASKS tree (dumped to out/tasks-v781.json). The client
// drives {cat:'__TASK__', task:k, tsub:name|null}; we drive groupKey (the "All <zone> <group>" row)
// and leafId = `<task.k>#<index in subs>` (the id the backend materialized into functionalGroups).
if (argv.includes('--tasks')) {
  const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'tasks-v781.json'), 'utf8')).data;
  const states = STATES.filter(([n]) => TASK_STATES.includes(n));
  const plan = [];
  for (const t of tasks) {
    const targets = [[`grp`, { tsub: null }, { groupKey: t.k }]].concat(
      t.subs.map((n, i) => [`leaf${i}`, { tsub: n }, { leafId: `${t.k}#${i}` }]),
    );
    for (const [tag, cs, os] of targets) {
      for (const [name, scs, sos] of states) {
        plan.push({
          key: `TASK|${t.k}|${tag}|${name}`,
          state: Object.assign({ cat: '__TASK__', task: t.k }, cs, scs),
          filters: Object.assign({}, os, sos),
        });
      }
    }
  }
  const out = path.join(__dirname, outName);
  fs.writeFileSync(out, JSON.stringify(plan));
  console.log(`plan: ${plan.length} combos (tasks: ${tasks.length} groups + ${plan.length / states.length - tasks.length} leaves × ${states.length} states) -> ${out}`);
  process.exit(0);
}

if (!cats.length) {
  console.error('usage: make-plan.js [--states=core|lite|flags] [--out=plan-X.json] <Category> [...]');
  console.error('  categories: ' + Object.keys(NAV).join(' | '));
  process.exit(1);
}

const states =
  setName === 'flags' ? FLAG_STATES
  : setName === 'lite' ? STATES.filter(([n]) => LITE.has(n))
  : STATES;
if (!states.length) { console.error('unknown state set: ' + setName); process.exit(1); }

// `--subs=N` caps the subs per category (the flags leg only needs a representative slice, and the
// tall-height states are meaningless outside Tall — `F.tallHeight` never leaves a non-tall grid).
const subCap = Number(opt('subs', 0)) || 0;

const plan = [];
for (const cat of cats) {
  let subs = NAV[cat];
  if (!subs) { console.error('unknown category: ' + cat); process.exit(1); }
  if (subCap) subs = subs.slice(0, subCap);
  for (const sub of subs) {
    for (const [name, cs, os, extra] of states) {
      if (name.startsWith('tallH') && cat !== 'Tall') continue;   // tall-only toolbar row
      const e = {
        key: `${cat}|${sub}|${name}`,
        state: Object.assign({ cat, sub }, cs),
        filters: Object.assign({ category: cat, subcategory: sub }, os),
      };
      if (extra) e.opts = extra;
      plan.push(e);
    }
  }
}
const out = path.join(__dirname, outName);
fs.writeFileSync(out, JSON.stringify(plan));
console.log(`plan: ${plan.length} combos (${setName}: ${states.length} states × ${plan.length / states.length} subs) -> ${out}`);
