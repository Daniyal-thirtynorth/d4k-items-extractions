# export-v767 — fresh full extraction (v767)

Fresh, self-made export of the whole catalog from `data-from-client/leicht_units__767_.html`,
matching the contract in `export-schema.ts` / `export-sample.json`. **All prior client exports were
discarded — this was built from scratch.**

## Files
- `export-v767.json` — full export (**18,375 items**, ~88 MB). Ingest this.
- `export-v767.json.gz` — gzipped (~3.2 MB).
- `export-v767-SAMPLE.json` — 10 items exercising every schema object (Vero 6-tab, sink, cooktop,
  appliance front, handle, alteration, accessory, variant `…U` parts, swatches, visible-side combos,
  options chips, inspiration, engineering, modifications, did-you-know, related groups).
- `export-v767-extractor.js` — the extractor that produced it (see method).

## Counts
- items 18,375 · cabinets 16,915 · accessories 1,306 · alterations 154
- categories 14 · programmes 120
- 18,352 real units (deduped from 18,823 unit records across 1,714 families) + 23 synthesized
  referenced accessory/part codes (e.g. `760`, `761`, Z-system pullouts, `…U` rail variants).
- **Reference integrity: 0 unresolved of 536,800** non-programme ItemRefs — every pill/card/variant
  `sku` resolves to an item in `items[]`.

## Method (why it is faithful)
The raw `<script id="DATA">` JSON is **not** the shipped model — the page runs a large
reclassify/split/merge transform on load (`classify`, `splitFam`, `mergeFams`, …); the final
`FAMS` (1,714 families) only exists post-init, and every rich section (configure pills, engineering,
the accessory-panel tabs, related groups, appliance metadata) is **computed by the app's own
`openDetail()` renderer**. So the export was produced by **driving the app's real code**, not by
re-implementing it (which is exactly what produced the earlier wrong exports):

1. Serve the HTML over http, open in Chrome.
2. `openDetail(familyId, code)` for every unit (state canonicalised to the unit's native depth first).
3. Scrape the rendered `#pin` DOM into the schema (chip targets from `onclick`, card codes from
   `.icode`, swatches/combos/options/inspiration from their elements, Standard/Unit-Specific
   alteration sub-tabs, `.mchip` variants → `…U` part codes).
4. Scalar/precision fields (dims, `finishes`, `appliance`, description, restrictions, planning notes)
   read straight from the source `f`/`u` records.
5. Dedupe by `sku`; synthesize only genuinely-referenced non-unit codes.
   Programme-tier siblings (P/C/A/P1/C1 prefixes) are **not** stored as items — the backend
   synthesizes them from a base code + featureFlags, so they remain pill targets only.

To re-run for a future build: serve the HTML, load `export-v767-extractor.js` in the page
(`fetch`+`eval`), then `__H.buildJobs()` → `__H.processBatch(start,n)` in chunks →
`__H.finalize()` → `__H.post(url)` to a POST sink.

---

## `functionalCategories` + per-item `functionalGroups` (added 2026-07-08)

Beyond the type taxonomy (`categories[]`), the app's PRIMARY left sidebar is a **"Design Tasks"
functional view**: zone (Base / Tall / Wall / Midway) → group (💧 Water · Cooling · Cooking · Storage ·
Layout · Design · Ventilation) → leaf (Water → Sink Cabinets · Trash Pullouts · Dishwasher Fronts ·
Sinks & Faucets · Sink Accessories). It is a SECOND classification of the same items — an item can appear
in several leaves.

**Source of truth:** `const TASKS` in the HTML (21 groups, 63 leaves). Each leaf is a set of MATCH RULES
`{c:category, s:subcategory, r:sectionInclude, x:sectionExclude, id:familyId, zn:zone}`; the app's
`famInTaskSub(f, leaf)` claims a family if ANY rule matches (regex tests the section; `id` short-circuits;
cross-category — Base→Water pulls `c:"Sink"`). Extracted by **driving the app's own `famInTaskSub` /
`taskCount`** over `FAMS` in-page (NOT re-implemented — preserves `subDisp`/`TALL_MERGE`/`zn`/`__DRWDUP`/
`MRG_` post-init values the raw JSON lacks; hidden `f.hid` families excluded exactly as the app does), then
mapping each matched non-hidden family's unit codes to export skus (12,622 codes, 100% joined).

**Render-ready + exact counts.** `functionalCategories` is the whole sidebar as an OBJECT (schema `Sidebar`):
`{ inspiration, allCategories, zones[], moreCategories[] }`. It reproduces the screenshot 1:1 including counts,
which come from TWO app formulas (all unfiltered): **zone header + moreCategories** = families by TYPE `f.cat`
(incl. hidden) → Base **234** · Tall **340** · Wall **69** · Midway 24; **group / allRow / leaf** = `taskCount`
= NON-hidden families matching → Water **87** (leaves 18/5/19/27/18) etc.; **allCategories** = FAMS.length
**1714**. Each group carries an `allRow` ("All Base Water", = group count). Leaf `count` is a FAMILY/card
count (matches the UI number).

- Top-level `functionalCategories: Sidebar` (object) — see `export-schema.ts`. Standalone copy:
  `functional-view-v767.json`.
- Per item: `functionalGroups: [{zone, group, groupKey, leaf, leafId}]` — **12,622** items tagged
  (801 multi-leaf; hidden-family units EXCLUDED). Omitted for items the app also excludes (non-zone
  categories; null-section edge units).
- Backend: `GET design-book/functional-categories` serves the sidebar object; `GET items?leafId=<leafId>`
  filters the grid to one leaf (returns UNITS — e.g. `b_water%232` → 145 Dishwasher Front units, 19 cards;
  client groups by `familyId`). Sidebar persisted on the catalog meta doc.

To re-run for a future build: the tree is static in the HTML — re-extract `const TASKS`, recompute counts +
membership in-page with `taskCount`/`famInTaskSub` over the new `FAMS` (skip `f.hid`), re-join by unit code.
