# CLAUDE.md

Guidance for Claude Code working in this repo. Written 2026-07-07 after a cleanup — obsolete files
were moved to `obseleted/` (see bottom). This file reflects the **current** state only.

## What this project is now

A **data + schema workspace** for the D4K "Design Book" — the LEICHT kitchen-furniture catalog
(IDM 3.0.1, Collection 2026/2). It is **not** an app. Its job:

1. Hold the **client-supplied JSON exports** of the catalog.
2. **Validate** those exports and define the **export schema (the contract)** the client exports to.
3. Feed the real backend: a NestJS module **`design-book`** in the separate repo
   **`/Users/apple/Documents/thirtynorth/node-js/D4K-backend`**, which ingests the JSON and serves
   the REST API. The **client builds the React UI** separately.

**Pivot (important):** we no longer scrape the catalog ourselves. The old HTML-scrape pipeline
(`extract_catalog.py` → `extract_details.js` → a test Express API) is **retired** in
`obseleted/old-extraction-pipeline/`. The client now generates JSON directly by a headless
"parity run" of their own app (`openDetail`), so the export matches the live UI exactly.

There is **no build/test here** — it is data files + docs (it IS a git repo now; raw `docs/export-*.json`
and `*.bak.json` are gitignored, the `.gz` is committed). Big JSON files: never `Read` them whole; use
`python3`/`node` or `Read` with offset/limit. Grep/analyze programmatically.

## ⭐⭐ v2 — MINIMAL + CAPABILITIES model (CURRENT; 2026-07-17, schemaVersion **2.3.0** since 2026-07-24). READ THIS FIRST.

The model was reworked from the fat "everything pre-computed, frozen at the default toolbar" export (v1,
`docs/export-schema.ts`) to a **minimal + capabilities** model (**schemaVersion 2.3.0** — 2.0.0 plus the
additive `DimPill.code` on depth pills (2.1), `Item.doorLineYCode` + `Item.heightExtension` (2.2), and
`DimPill.showUnderLine` on width/height pills (2.3); old readers ignore all four). Everything below
this block that describes `configure` / `programmeAvailability` / `accessoryPanel` / `relatedGroups` /
`specification` / `programmeBadge` and the frozen per-pill `available` boolean is **v1 — superseded**.
Current facts:

- **Contract = `docs/export-schema-v2.ts`.** An item stores INTRINSIC FACTS + plain-array RULES + THIN sku
  refs; the UI/backend DERIVE the rest. Key field changes: `configure`→**`parameters`** (thin pills
  `{label,sku}`, no stored `available`/`selected`; **depth pills add `code`** — see the depth note below); `programmeAvailability`→**`capabilities.excludedPrograms`**;
  `accessoryPanel`/`relatedGroups`→thin **`alterations`/`accessories`/`companions`** sku lists +
  **`finishInterior`** (Vero); `specification`→flat `priceGroupRef`/`frontModifiers`/`carcaseLine`/`weightKg`/
  `volumeM3`; `programmeBadge`/`cardLabel` dropped (derive); `engineering`→`[{key,ok}]`.
- **⭐ `capabilities` (17 fields) is the pill-gate rule surface.** A configure pill greys when its TARGET
  item's capabilities fail a gate for the current toolbar: `available(u) = alwaysAvailable || (progOk &&
  tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk)`. The client reproduces all 8
  gates via the **`availableFromCaps(caps, toolbar)`** port (in the schema). Fields: `nativeTier, opening, twinTiers[],
  excludedPrograms[], excludedProgramsE[], isFrmatFamily, hasEFront, depthClasses[], handleFree, onePieceFront, openP1, openC1,
  singleHandle, antosoApproved, doorLineJ, doorLineY, alwaysAvailable`. **Verified 99.997%** vs the live app across 313,842
  combinations (16,518 pill targets × 19 toolbar states); FRMAT (1 unit) the only residual (layer `isFrmatFamily`).
- **⭐ A DEPTH row is a STATE row, not navigation (2026-07-21, schemaVersion 2.1.0).** `u.d=[36,48,68]` means
  *this* cabinet is orderable at those depths — there is NO sibling code, so **every depth pill repeats the
  item's own `sku` and that is correct**. What the app changes is the ORDER CODE, re-cut in `assemble()`:
  `parseCanon(c)=/^([A-Z]+)(\d+)([A-Z0-9]*)$/` → `pre+dig+<class>+fn` (`T6080IS2IZ` @36 → `T608036IS2IZ`).
  Those codes are **synthesized, never stored units** (like the P1/C1 prefixes), so the export now ships them
  **on the pill**: `depth:[{label,sku,code,alteration?}]` — 4,858 pills over 2,348 items; 58 and the 63
  alteration keep the base code (63 = base + `ANTSP63US`·`MPRU`… in the clipboard, per `d63Set`). Absent on
  real sibling-navigation depth rows and on width/height/programme/options, where the order code IS `sku`.
  **⚠️ `pill.code` is DISPLAY/COPY ONLY — never fetch, route or build an image from it.** Unlike the P1/C1
  prefixes (which the backend DOES synthesize on read), the re-cut depth codes resolve to nothing:
  `GET items/T6080IS2IZ` → 200 but `GET items/T608036IS2IZ` → **400**, while `GET items/P1T3080S` → 200.
  Same "synthesized, never stored" phrase, opposite API behaviour. So the frontend's depth-click condition
  is on **`pill.sku`**: `pill.sku !== item.sku` → FETCH the sibling; `pill.sku === item.sku` → NO fetch, set
  local depth state and show `pill.code ?? item.sku` (image stays on `sku`).
  **SELECTED on a depth row is picked by LABEL** (per-card depth → toolbar D → 58, the app's `cardDepth`),
  never by `sku===item.sku` — that lit up every pill. On a MIXED row honour the picked class only when that
  pill is a state pill for THIS item; if it maps to a sibling, fall back to the item's own NATIVE pill (else
  the sibling pill lights up "selected" and stops being clickable, blocking the navigation).
  **TWO depth models coexist (§2c-2), and the DISCRIMINATOR IS `pill.sku`, not the presence of `code`:**
  `pill.sku !== item.sku` → depth is a SEPARATE ITEM (navigate); `pill.sku === item.sku` → SAME item, order
  code = `pill.code ?? item.sku`. (`code` present ⟹ same item, but not the converse — a self pill needing
  no re-cut carries none.) Row shapes: **7,458 MIXED** (siblings + self native/63 pills — the commonest),
  2,348 all-self with re-cut codes, 1,745 all-self without. **`capabilities.depthClasses` unifies
  both** — it is simultaneously the pill-greying gate AND the `depthClass` grid filter (`GET items` now
  matches it, 58 & 63 pass-through; it used to match `parameters.depth[].label`, which put 3,792 wrong
  cabinets under D=68 and dropped 2,369/4,452 at 58/63).
  Full rule + code: `design-book-api-ui-map-v2.md` **§2c-1** (pill state) + **§2c-2** (the two models)
  + **§2c-4** (the dedicated depth-pill section: selection by label + the fetch / don't-fetch click handler,
  4 pill shapes, the `code`→400 warning). Codes were taken FROM the app (7,210 class→code
  pairs via `assemble`), not re-derived. Backfilled into D4K-dev with
  `D4K-backend/scripts/backfill-depth-pill-codes.js` (superseded by the general
  `D4K-backend/scripts/backfill-item-fields.js <export.json> [--fields a,b] [--apply]`, dry-run by default)
  — the HTTP `ingest` body cap is 10 MB so a 54 MB re-ingest can't go over the wire.
- **⭐ THE REST OF THE ORDER-CODE SURFACE — audited exhaustively 2026-07-21, schemaVersion 2.2.0.** Asked
  "does the depth pattern exist on width/height/anything else". Answer: **width, height, programme P/C/A and
  all 16 coded/option rows are plain navigation** — one shared helper `chip(label,code) → openDetail(f.id,code)`,
  target always a real `x.c`; there is **no `u.w`/`u.h` array** analogous to `u.d`, so they structurally can't.
  Measured over all 18,396 items: **0 rows with a duplicated sku, 0 rows with >1 self pill** outside `depth`,
  so `selected = pill.sku === item.sku` stays correct there. `assemble(u,ov)` has exactly 5 inputs / 6 code
  mutations — full table in **map §2c-3**. Three real gaps found and closed:
  1. **`options` group `Insert` (`L3/M3`·`M8`) was a mis-scrape, not a state row.** `pickInsert` sets
     `blockIns[fid]`, which `insPool()` uses to filter the family pool — the pill DOES land on a different
     **stored** unit (`ZIGSUV20` ↔ `ZIGSUV20U`), its onclick just carries no target, so `chipTarget()` fell
     through to `u.c` and stamped self on both pills (dead control, nothing ever selected). One family,
     `FP_16FRONT`, 92 units, 0 ambiguous. Extractor resolves the sibling now; export + D4K-dev backfilled.
  2. **`Item.doorLineYCode`** (11 units) — `V/E/J/P1/C1` are derivable prefixes/suffixes but **`Y` REPLACES
     the whole code** (`assemble` line 1: `if(dl==='Y'&&u.Yc) return u.Yc`), so the literal ships. Exactly
     the `capabilities.doorLineY` set — that flag is the GATE, this is the CODE.
  3. **`Item.heightExtension`** (2,046 units / 83 families) — the app's **`217+`** chip appended to the
     Height row (Tall, not `Appliance housing`, family holds an available `hc===217` unit): 230/244/250 cm
     open the 217 unit + `MPHVERL`, the height twin of the 63 cm depth alteration. `{sku,addCode,options[
     {label,heightMm}]}`. Missed before because the chips only exist after a tap AND use `b.onclick=fn`
     (a property, no attribute). **Deliberately NOT in `parameters.height`** — the HP20 panel families also
     have REAL 230/250 cm siblings, so the labels would collide (`GET items/HP20146` shows both).
  Also fixed: `design-book.service.ts` still queried the v1 name `'configure.programme.sku'`, which had
  silently killed the whole P1/C1 tier-sibling synthesis path (`GET items/P1T3080S` → 400).
- **Fresh full extraction (not a transform).** `docs/export-v781-extractor2.js` drives the app + inlines
  `scripts/compute-capabilities.js` → emits the v2 shape directly. Run it in Chrome (serve HTML, inject,
  `__H.processBatch(start,n)` in ~3000 chunks, `__H.finalize()`, `__H.post('http://localhost:8799/save')`
  with `scripts/extract-sink.js` running). Output **`docs/export-v781-fresh.json`** (18,396 items; committed
  as `.gz`; raw is gitignored). It recovers 21 units the app init deletes (see `meta.recoveredArtifactSkus`).
  `scripts/audit-excluded-programs.js` proved `excludedPrograms` == the app's `progOkFor` 100%.
- **Backend (D4K-backend) is migrated + ingested to D4K-dev.** Item schema reshaped; `annotateProgrammeExclusions`
  now reads `capabilities.excludedPrograms`; the other 7 gates are client-side. **Manual CRUD added:**
  `POST/PATCH/DELETE /design-book/items` (share `normalizeItemDoc` with ingest — same shape; every field incl.
  the whole `capabilities` object settable at creation; `UpsertItemDto`). Re-ingest = **extractor wins** (no
  merge layer). `.env` currently points at **D4K-dev** (was prod — flip back when done). Migration cleanup:
  `D4K-backend/scripts/strip-legacy-designbook-fields.js`.
- **Docs (all v2):** `docs/export-schema-v2.ts` (contract) · `docs/export-sample-v2.json` (13-item worked
  sample — `MGT601468` is the `doorLineYCode` + `heightExtension` example) ·
  `docs/design-book-api-ui-map-v2.md` (API↔UI, §2c the 8-gate model + per-gate GREY table +
  `availableFromCaps` + render spec; **§2c-4 DEPTH PILL — selection + when to call `/items/:sku`**;
  **§2c-1 SELECTED — navigation rows vs DEPTH state rows**;
  **§2c-2 the two depth models**; **§2c-3 the WHOLE order-code surface — every `assemble()` input, which
  rows are plain navigation, `doorLineYCode`, `heightExtension`**; §1b CRUD) ·
  **`docs/design-book-crud-guide.md`** (authoring guide: mental model = a card is a FAMILY of sibling items
  linked by pills, the rule lives on the pill TARGET; §3a depthClasses+58/63 quirk + gate-vs-pill-row warning,
  §3b nativeTier/opening/twinTiers, §3c the other 6 gates, §3d master greying table; §4/§4a the depth
  state-row warning, **§4b `heightExtension`**, **§4c `doorLineYCode`**; the BOSSA "disable 2 width pills"
  recipe) · `docs/design-book-greying-examples.md` (worked
  grey/live cases per gate) · `docs/design-book-item-fields-plain-guide.md` (plain-English field-by-field
  tour — hand this to a non-engineer). v1 docs (`export-schema.ts`, `design-book-api-ui-map.md`,
  `export-sample.json`) are kept for diffing but superseded. **Deliberately NOT annotated** (2026-07-21
  decision) — they still describe the v1 model verbatim (`configure.*`, a STORED `selected`/`available`
  boolean, `depthClass` matching pill labels). Don't "fix" them into v2 shape; that destroys their only
  purpose. Anything about pill state / depth belongs in the **v2** map §2c-1/§2c-2/§2c-3.
- **UIs (dev tools in D4K-backend/public/, local/dev only):** `GET /design-book/ui` = the lite BROWSE UI
  (rebuilt for v2 — cards from `parameters`, whole-card GREY via `availableFromCaps`); **`GET /design-book/admin`**
  = a full form-based CRUD authoring UI (every field a structured control, programme picker for
  `excludedPrograms`, dynamic pill rows, live `availableFromCaps` preview, open-by-code + `/admin#SKU`
  deep-link). Both auto-auth via `/design-book/dev-token`.
- **Self-sufficiency for greying:** whole-card GREY = each list row ships its own `capabilities` (not in
  `LIST_OMIT`) → client-local, no extra call. Pill programme-grey = send `programs=` → backend stamps
  `available:false`+`programmeExcluded`. **KNOWN GAP:** per-pill greying by the other 7 gates in the DETAIL
  drawer needs the pill target's caps, but `resolveRefs` does NOT project `capabilities` yet — one-line fix
  (`capabilities:1` in the projection) makes `?expand=refs` fully self-sufficient.
- **BOSSA = programme id `244`** (PRIMO/P). "Disable width 15/20 in BOSSA" = put `"244"` in the 15/20 pill
  TARGETS' `capabilities.excludedPrograms` (NOT on the parent) — see crud-guide §5.
- **⭐ CLIENT-UI PARITY PASS (2026-07-24, schemaVersion 2.3.0).** Client kept reporting the grid diverges
  from the app. Built a differential harness (`scripts/diff-grid-parity.js`, client rendered grid = ground
  truth) + drove the app's own `visibleBlocks`/`selectedUnit`. Full audit + repro:
  **`docs/client-ui-parity-audit.md`** (§A discrepancy table, §F what shipped, **§G remaining work**).
  Shipped to D4K-dev, all data-driven (no hardcoded hides): **(1) depth grey-not-hide** — `GET items?grey=true`
  skips the `depthClass` hard-filter so the native face returns and the client greys it via `availableFromCaps`
  (map §2c-6); **(2) `showUnderLine`** — per-pill W/H carcase-line collapse (extractor emits it into
  `parameters.width/height[]`, backfilled, admin-editable; map §2c-5, crud §4d); **(3) face selection order**
  — `faceHeightClass` (keep default-line face) + `variantCore`/`faceVariantCore` (keep default variant) +
  `depthMm` ASC tiebreak (native depth wins the face), backend-computed denormalized fields, not contract
  (map §2 face-selection note); **(4) per-pill target caps** — list `?refs=true` projects a `refs{sku→caps}`
  map so pills gate on the TARGET's caps. **Harness result: FACE 0 / GREY 0 mismatches** over 411 family
  comparisons. **REMAINING (deferred, §G):** family-level MEMBERSHIP — SNK8-type families (9 combos, H86)
  where the client shows a family that has a unit per dimension INDEPENDENTLY + a width-preferring face; ours
  is unit-level. Broad/risky fix (could regress the width-respecting face for SNK1-type) — confirm it's
  client-reported before doing it. Backend branch `fix/parity-face-ty-and-membership` merged to `dev`.
  Backfills: `D4K-backend/scripts/backfill-{face-height-class,face-variant-core,show-under-line,show-under-line-wh}.js`.

## UI vocabulary — what each term means on screen (and where it maps)

Read this before the schema. It maps what the user sees in the app to the data model in
`docs/export-schema.ts`.

- **Category** — the top-level groups in the left sidebar: **Base, Tall, Wall, Midway** (+ more:
  Alteration, Handles, …). Picking one filters the grid. Data: `Category` (has an `itemCount`).
- **Sub-category** — the items nested under a category in the sidebar. In v765 the **Base** category
  splits into **Water / Cooling / Cooking / Storage / Layout / Design**. Data: `Subcategory` under a
  `Category`. (A `Section` is an optional finer on-page header inside a sub-category.)
- **Item** — one product **card** = **one orderable code (SKU)**, e.g. `TK6080BZ2`
  "Cooktop Unit · Top Blender · BZ2". This is the atomic unit. Everything the detail screen shows hangs
  off it. Data: `Item` (keyed by `sku`, `kind` = cabinet | alteration | accessory | part). **Every code
  the UI shows anywhere is an Item**; other places reference it by `sku` (`ItemRef`), never re-embed it.
- **Programme** — a kitchen product line (LEICHT has 120), e.g. "ROCCA 01". **It is the SELECT DROPDOWN
  at the top-left of the app** — it reads **"No programme · point range"** until you pick one. Each
  programme belongs to a **family** (**PRIMO / AVANCE / CONTINO**). Choosing one sets finishes/pricing and
  which items are orderable. Data: `Programme` (has `id`, `family`, `tier`). Don't confuse this dropdown
  with the FRONTS pills / card badges below — those are the tiers.
- **Programme tier / FRONTS pills** — `P · P1 · C · C1 · A`, shown in **two places: the pill group
  labelled "FRONTS" in the top toolbar, and the small badges at the bottom of each product card**.
  `P`=Primo, `A`=Avance, `C`=Contino; **`P1`/`C1` are "opening" variants ("one handle on top")** — NOT
  stored SKUs but a code prefix (`P1<base>`/`C1<base>`) synthesised from a feature flag. Data:
  `ProgrammeTier`; on an item the `configure.programme[]` pills (each → a sibling SKU), the bottom-of-card
  tier group = `Item.availableTiers`, and the card's top-right summary chip = `Item.programmeBadge`.
- **Configure pills (W / H / D / Programme)** — the Width / Height / Depth / Programme selectors that
  belong to **one item**: the H/W/D rows + P/P1/C/C1/A **on the product card**, and the same rows in the
  **"Configure" box of the detail screen**. **Clicking a pill opens a different item** (another SKU):
  e.g. on `TK6080BZ2`, Width 70 → `TK7080BZ2`. Data: `Configure` → `DimensionOption` / `ProgrammeOption`,
  each pointing at its target item by `sku` (null when greyed). (Depth includes a "63 cm alteration" option.)
  Some products add **coded rows** (non-numeric pills, still → sibling SKUs): **"Mode"** (sinks:
  `700-IF/A · 500-U`), **"Ty" (Type)** (`TU/TV/TW`; storage `Z · S2Z · Z2X`), **"Config"** (shelf layout:
  `2 Shelves · Shelf + Railing · LED`). All collected in `Configure.optionRows` (`OptionRow {label, options}`
  → `ConfigOption`), one entry per row keyed by its on-screen label. A `ConfigOption` can be shown
  **struck-through** (`crossedOut:true`) = exists in the family but not orderable in this config (distinct
  from greyed `available:false`). **Not** the **W / H / D filter bar at the very top of the app** — that top bar filters
  the grid (shows/hides cards) and belongs to no item.
- **Variant** — small buttons on an accessory/pullout card that swap the runner/length, e.g.
  **`L3/M3` vs `M8`** (M8 = base code + `U`) or cable lengths `1 m / 1.6 m / 2 m`. Data: `VariantRef`
  inside an `ItemRef`.
- **Alteration** — a modification code that changes a cabinet (depth/height/width, deep-install, etc.),
  e.g. `ANST` "Cupboard Depth Alteration", `ANTSP63US`. Shown in the **Alterations** tab (split into
  **Standard** = the general set, and **Unit-Specific** = the unit's own). Data: an `Item` with
  `kind:"alteration"`, referenced from the panel.
- **Accessory** — an add-on fitted into/with a cabinet: inner drawer, pullout, cutlery insert, mat,
  side panel, etc. (`IGS6058`, `FS8056`, …). Shown across the panel tabs. Data: `Item` with
  `kind:"accessory"`. One accessory is shared by many cabinets → always referenced, never copied.
- **Finish** — the surface/colour of a programme; drives the item price. Data: `FinishPrice` (finish
  code → price), passthrough from the main catalog.
- **Card action icons** — three small buttons at the **bottom-left of a product card**: **♥** "Add to
  my list" (`toggleFav` → My List, device-side), **⧉** "Copy `<sku>`" (`copyUnit` → clipboard), and —
  **only on appliance-housing fronts** — a **third fridge/appliance icon**, tooltip **"Appliances"**
  (`addAppliances`). ♥ and ⧉ are UI-only. The Appliances button IS data-backed: the front's
  built-in-appliance metadata. Data: `Item.appliance` (`ApplianceHousing`) — `category`
  (Refrigerators / Dishwashers, also picks fridge vs generic icon), `brand` ("Gaggenau"), `nicheSize`
  (DW `24"`; fridge fronts 18/24/30/36" from width), DW `subcategory` (Built-In / Built-In ADA when
  hc 73), `note` (GFVO* leg/brand fitment). v765: 8 housing families — `F1230 F1231 XGFRWINE` (fridge),
  `GFVK80_SM GFVO GFVO_AS GFVO_B GFVO_G` (DW). The appliance **schedule/picker** UI it feeds is NOT exported.
- **The detail panel / tabs** — see the section map below for the full list (Configure, Description,
  Possible Alterations & Accessories tabs, Engineering, Specification, etc.).

## Current files (the working set)

```
data-from-client/                    # NOTE: all client data JSON deleted — only the HTML builds kept.
                                     #   Everything the backend needs is the in-house export under docs/
                                     #   (export-v781.json). Old client files (v584 catalog, accessory-panel
                                     #   export, ts-structure export) are GONE from disk; recover from git.
  leicht_units__781_.html            # ⭐ CURRENT LIVE APP BUILD v781 (17.8 MB) — THE ONE TO EXTRACT FROM.
                                     #   Raw catalog in <script id="DATA"> (DB.families/programs/altnames/
                                     #   rules). The FULL v781 export was generated FROM this file by
                                     #   driving its own renderer (see below).
  leicht_units__767_.html            #   prior build v767 (17.6 MB) — kept for diffing; superseded by v781.

docs/                                # NOTE: raw *.json exports (v767/v781) are gitignored (>50MB); the .gz
                                     #   is committed — gunzip to use. All *.bak.json are local-only.
  export-schema.ts                   # ⭐ THE CONTRACT — canonical normalized export schema (see below)
  export-sample.json                 # ⭐ worked SAMPLE of the contract — 13 items exercise every schema object.
                                     #   Carries plain-English `_ui` doc-keys (backend must strip; NOT in schema).
  export-v781.json                   # ⭐ THE ACTUAL FULL EXPORT (v781) — 18,375 items (16,847 cabinet ·
                                     #   1,381 accessory · 147 alteration + synthesized), 14 categories,
                                     #   120 programmes, ~101 MB. Ingest THIS. Carries top-level
                                     #   functionalCategories + systems[], and per-item functionalGroups[] /
                                     #   nameQualifier / handedLR / sinkFitment / faceForTiers.
  export-v781.json.gz                #   gzipped (3.4 MB) — the committed form
  export-v781-extractor.js           #   the in-page extractor that produced it (re-runnable for v782+)
  export-v781.pre-functional.bak.json #  local backup before functionalCategories/-Groups (gitignored)
  export-v767.json / .gz / -extractor.js / -README.md / -SAMPLE.json / functional-view-v767.json
                                     #   ⭐ prior v767 export + its extractor/README/sample — superseded by
                                     #   v781 but kept; README has the full method + how-to-re-run notes.
  design-book-api-ui-map.md          # ⭐ CURRENT canonical API↔UI map (endpoints ↔ screen elements)
  design-book-guide.html / .pdf      # older illustrated guide to the backend API (UI element → endpoint)
  design-book-api-map.html / .pdf    # older map of the backend endpoints (superseded by the .md above)
  img/                               # screenshots used by the guide

obseleted/                           # retired — see bottom
```

## ⭐ The v781 full export — produced IN-HOUSE (`docs/export-v781.json`)

We no longer wait on the client for a correct export — **all prior client exports were wrong and
discarded.** A fresh, schema-valid full export of v781 was built here from `leicht_units__781_.html`
(current). The prior v767 export + extractor are kept for diffing.

**Result:** 18,375 items (16,847 cabinet · 1,381 accessory · 147 alteration + synthesized referenced
codes), 14 categories, 120 programmes. Ingest THIS.

**Why it is correct (and the client's wasn't):** the raw `<script id="DATA">` JSON is NOT the shipped
model — on load the page runs a big reclassify/split/merge (`classify`, `splitFam`, `mergeFams`, …),
so the final `FAMS` = 1,714 families / 18,823 units only exists post-init, and every rich section
(configure pills, engineering, accessory tabs, related groups, appliance) is COMPUTED by the app's own
`openDetail()` renderer. So we **drive the app's real code**, never re-implement it:
1. serve the HTML over http, open in Chrome (extension can't do `file://`);
2. `fetch`+`eval` `docs/export-v781-extractor.js` in the page → `__H` reachable (FAMS + helpers are
   page-scope globals, callable from injected JS);
3. `__H.processBatch(start,n)` in chunks → for each unit: canonicalize `state.depth`, call
   `openDetail(fid,code)`, scrape `#pin` DOM into the schema (chip targets from `onclick`, card codes
   from `.icode`, `.mchip`→variant `…U` codes, swatches/combos/options/inspiration, Standard/Unit-
   Specific alteration sub-tabs); scalars (dims, `finishes`, `appliance`, description, restrictions)
   read straight from `f`/`u`;
4. `__H.finalize()` → dedupe by sku, synthesize only genuinely-referenced non-unit codes;
5. `__H.post(url)` POSTs the whole JSON to a tiny local node sink (exfil; the extension redacts big
   tool returns, and a `fetch` POST sidesteps it). **Tool `javascript_tool` returns must be strings**
   (`JSON.stringify`) and **must NOT be wrapped in an async IIFE** (returns a Promise → serializes `{}`;
   use top-level `await` + a trailing bare expression).

Gotchas baked into the extractor: programme-tier siblings (P/C/A/P1/C1 prefixes) are pill targets only,
NOT stored items (backend synthesizes them from base+featureFlags); dims coerced to mm-numbers via `mm()`
(some source `u.W` are strings like `"30 cm"`); `specification` omitted when a unit has no real dim
(matches sample — accessories carry no spec); `catalogPage` dropped when no PDF page. **v781 extractor
fixes (2026-07-16):** `chipAvail()` reads the COMPUTED style (`opacity:.4` is the real greying — the old
inline-only regex exported ~11k greyed chips as `available:true`); `disabled` alone no longer marks a chip
dead (the Programme row disables the selected chip while rendering normally); `chipCrossed()` reports only
genuine line-through (`.d63off` is greyed not struck → `available:false`); `progAvailOf()` sources
programme ids from `progOkFor()` over the full `PROGS` list (`state.prog` is null during extraction, so
the old `progKeysFor()` returned empty every item); pristine toolbar defaults snapshotted once at injection
and restored before every `openDetail`. New: `Item.faceForTiers` (see schema). Re-run for v782+: same 5
steps, just point the http server at the new HTML. Full method notes in `docs/export-v767-README.md`.

## The export schema (the contract) — `docs/export-schema.ts`

The single most important file. It defines the JSON shape the client should export to, so future
catalog updates are a clean re-ingest. Design (settled with the user + a data analysis):

- **Everything is an `Item`, keyed by `sku`.** One record per code. `kind` = `cabinet | alteration |
  accessory | part`.
- **Every code the UI shows is an `ItemRef {sku, label?, variants?}`** into `items[]` — pill targets,
  accessory/alteration cards, card variants, modification codes, companions. **No embedded duplication.**
  (Measured: accessory cards duplicated ~122× in the flat export; one code, `ANST`, on 11,001 units.
  Image is 100% derivable from `imageUrlTemplate`. 1,453/1,804 card codes are already SKUs.)
- Top level: `{ meta, categories[], programmes[], ruleTables?, functionalCategories, systems[], items[] }`.
- An item carries every detail-screen section it shows (all optional): `configure` (W/H/D/Programme
  pills → target SKUs), `description`, `accessoryPanel` (tabs→sections→card refs), `relatedGroups`
  (Compatible Accessories, Planned Together, Often Planned With, **Opening Support**, Complete This
  Cabinet), `engineering` flags, `specification`, `restrictions`, `programmeAvailability`,
  `modifications`, `planningNotes`, `didYouKnow`, `catalog`, `toeKick`, `appliance` (built-in-appliance
  housing metadata, only on appliance fronts), `finishes`. Plus three card/title annotations added
  2026-07-10: `nameQualifier` (amber sub-label after the title, e.g. "Mid 45 cm deep" — from `vsub[vr]`;
  1,026 items), `handedLR` (bool — the "L/R" left-or-right-hinge badge; 2,605 items, general not sink-only),
  and `sinkFitment` (the "Max Sink Size: NN″" line + "+ Add Sink" popup + detail "Sink fitment" section —
  `{maxSinkSizeInch, cabinetWidthCm, customAboveInch:42, isDoor, showOnCard, notes[]}`, Base/Sinks with a
  width; 1,420 items). All three are IN the export, ingested (schema `@Prop`s), and served by `GET items` +
  `items/:sku`. Extractor computes them via the app's own `vsub`/`handed()`/`sinkMaxSize()`.
  Plus (2026-07-16) **`faceForTiers`** (`FaceTierKey[]` where key = `"_" | "P" | "A" | "C"`) — the tier
  contexts in which a unit is its family's FACE card; 1,848 items. NOT derivable — the app picks the face
  in `selectedUnit()`/`ppool()` from per-family defaults, so it's captured by driving the app's own
  `visibleBlocks()` in default toolbar state.
- Dimensions in **mm** (chip labels keep cm). Prices excluded (programme-dependent; backend computes).
- **Images are built, not stored.** `imageUrl = meta.imageUrlTemplate.replace("<CODE>", sku)` — a card/
  ItemRef only carries `{sku}`, so the picture needs no DB read and no join. The card's **other** fields
  (name/dims/description) resolve `ItemRef.sku → items[]` via Mongo **`$lookup` on `sku`** (or the backend
  `resolve`/ItemRef path). Only `Swatch.image` + `Catalog.urlTemplate` hold literal URLs (other hosts).
- `meta.schemaVersion` gates ingests; backend upserts by `sku`, marks missing codes inactive.

**Schema refinements (2026-07-08 session, verified in-browser):**
- **`Configure.optionRows[]` is the ONE home for every extra selector row** beyond W/H/D/Programme —
  coded (Mode / Ty / Config) AND product-specific (Insert / Variant). The old numeric `insert`/`variant`
  fields were **removed** (redundant — their pills are sibling-SKU selectors, not real dimensions).
- **Finish-interior tab has TWO parts.** `PanelTab.swatches[]` = the colour-square grid; new
  **`PanelTab.visibleSideCombos[]`** ({interior, allowed[]}) = the "Visible-side combinations" table
  below it (catalog ch.11). The table was missing before; now added.
- **`PanelTab.options[]` chips are plain CODES, not SKUs** (Vero "extra-charge interior styles":
  `MPK/KH/KG`, `MPFF/PF/VM`, `MPH`). Store as strings — do NOT make cards / ItemRefs / `$lookup`. The
  "state on the order" line above them is a normal `notes[]` entry.
- Vero units expose 5–7 tabs (Finish interior · Options · Accessories · Electrical · Shelves ·
  Interior storage[tall]) — all fit existing fields (`swatches`/`visibleSideCombos`/`options`/`notes`/
  `sections[].cards`). No new field needed beyond `visibleSideCombos`.
- **`ConfigOption.swatch`** — an `optionRows` pill can carry a colour SWATCH. The handle **"Finish"** row
  (`HDL_MBH_529` → `ZGR529032/100/277/307`, `vlbl:"Finish"`, unit `vr`=finish code) shows a colour square
  per pill; `swatch` = the finish code, image built from the Finish host (same as `Swatch.imageUrl`).
- Opening-support card code is **`HFO3`** (letter O, not zero `HF03`).

## Detail-panel section map (domain reference, v765 UI)

The product detail panel (`openDetail`) renders, in order: **Header** (code, breadcrumb, title, Copy,
**Catalog** button → price-cropped PDF page, dims, toe-kick installed-height) → **Configure** (Width/
Height/Depth/Programme pills, each navigates to a target SKU; depth includes "63 cm alteration";
Programme = Primo/P1/Contino/C1/Avance; some products add coded rows collected in `optionRows` —
**Mode** [700-IF/A · 500-U], **Ty/Type** [TU/TV/TW; Z · S2Z · Z2X], **Config** [2 Shelves · Shelf + Railing · LED];
options can render **struck-through** = `crossedOut`) → **Description** → **Possible Alterations & Accessories** tabs
(Compatible Accessories, Overview, Installation, Visible Sides, **Alterations** [Standard / Unit-Specific
sub-tabs], Pullouts; the **cutlery-insert family** = Q-Box / Plastic / L-Box oak / L-Box walnut / Combo /
Beech / Other tabs; special families add Sink/Cooktop/Vero/Mats tabs; cards carry variants like
L3/M3·M8 [M8 = base code + `U`, e.g. `LBFS60581U`] and cable lengths 1m/1.6m/2m. **Compatible Accessories**
groups its cards under a **"CATEGORY · SUBCATEGORY"** heading, e.g. "BASE · SINKS" [derivable from each card
item's own cat·sub — client currently flattens it to `heading:""`]) → **Engineering** capability flags (Suspended install, SensoMatic,
Tip-Softclose, Opening P1, 68cm depth → Yes/No 🟢🔴) → **Specification** (W/H/D, carcase line, weight,
volume, catalog page) → **Restrictions** → **Programme availability** → **Modifications — how to**
(handle 760/761, P1/C1 opening, with codes) → **Planning notes** → **💡 Did you know?** (cross-order tip).
UI-only (not export data): My Note, Ask-the-Expert, the **System Builder's Design Clipboard + System-Status
ticks** (device-side runtime state), the appliance schedule/picker, panel-sizer. (But the per-front
**appliance-housing** metadata behind the card "Appliances" button IS exported — `Item.appliance`; see Card
action icons above. And the **"+ Add Sink"** popup on sink cards — "Max Sink Size: NN″" + fitment rules —
IS exported too, `Item.sinkFitment`; NOT UI-only. The card's **"L/R"** badge = `Item.handedLR`; the amber
title sub-label = `Item.nameQualifier`. And the **System Builder** panel's COMPOSITION — engineered SKU
bundles (SensoMatic, LLE-R recessed light): trigger items, Required/Optional component rows + pill options —
IS exported too, top-level `systems[]` [2026-07-10]; only its Design Clipboard / System-Status stay UI-only.)

## The backend (`D4K-backend`, separate repo)

NestJS 11 + Mongoose module `design-book` (`@Controller('design-book')`, JWT-guarded). 9 endpoints
(`/cards`, `/cards/:cardId`, `/resolve` deleted; `/detail/:sku` merged into `/items/:sku`):
`POST ingest`, `GET items`, `items/:sku`, `programs`, `categories`, `functional-categories`,
`tall-heights`, `meta`, `stats`. **`GET tall-heights`** (2026-07-14) = the TALL two-row height selector
(carcase LINE 73/80/86 + the DYNAMIC carcase-HEIGHT row); reproduces the app's `availHeights()` from the
leaf-visible set (heights DERIVED by snapping `heightMm` to a tall height ±8 mm — no export change), plus
`GET items` gains `line`/`tallHeight` filters. See `docs/design-book-api-ui-map.md` §6b.
`design-book.detail.ts` now only builds `catalog` (the PDF binding) + ref-hydration; the item
stores every detail section verbatim. Premium **P1/C1** = code prefix on a base, synthesized via
reverse-lookup (not stored). `GET items/:sku` also builds `imageUrl` from `meta.imageUrlTemplate`.
Details and history in the memory file `design-book-module.md`.

**Two navigation trees (don't conflate):** (1) `GET categories` = the TYPE taxonomy (Base → Doors /
Sinks / Cooktops / Appliance housing …), stored in `categories[]`, on each item as `category`/`subcategory`/
`section`. (2) `GET functional-categories` = the app's PRIMARY "Design Tasks" LEFT SIDEBAR (the screenshot)
— a render-ready OBJECT (`Sidebar` in `export-schema.ts`): `{ inspiration (✨ Designer Inspiration),
allCategories (count = FAMS.length 1714), zones[], moreCategories[] }`. Each zone (Base/Tall/Wall/Midway)
has a header `count` + groups (💧 Water / Cooling / Cooking / Storage / Layout / Design / Ventilation),
each group an `allRow` ("All Base Water") + leaves (Water → Sink Cabinets · Trash Pullouts · Dishwasher
Fronts · …). Built from the HTML's `const TASKS` via the app's own `famInTaskSub`/`taskCount`; each leaf =
match rules over item cat/sub/section/familyId (leaf claims item if ANY rule matches; cross-category —
Base→Water pulls category:"Sink"). **Counts match the app EXACTLY, two formulas:** zone header +
moreCategories = families by TYPE `f.cat` (incl. hidden); group/allRow/leaf = `taskCount` = NON-hidden
families matching (`f.hid` families never render — they're the `__DRWDUP`/`MRG_` dup synthetics). Leaf
`count` = FAMILY/card count (matches the UI number, e.g. Water→Sink Cabinets 18). Materialized per item as
`item.functionalGroups[]` (12,622 items tagged, hidden-family units EXCLUDED; 801 multi-leaf). Filter the
grid with `GET items?leafId=<leafId>` (e.g. `b_water%232` → 145 Dishwasher Fronts UNITS — client groups by
`familyId` for the 19 cards). Sidebar stored on the catalog meta doc; standalone `docs/functional-view-v767.json`.

Local testing: `node dist/main.js` (PORT 8000, Swagger `/api`). The user's Bearer is signed with the
**deployed** secret → 401 on localhost; mint a local token with the local `.env` `JWT_SECRET` for
`masteradmin` (userId `651f8eb9c4710268e5a06947`). Token expires — re-mint on 401.

## The lite browser UI (lives in `D4K-backend`, NOT here)

A single-file, no-build reference frontend that browses the ingested catalog against the real
design-book API. **It lives ONLY in the backend repo** — `D4K-backend/public/design-book-ui.html`
(vanilla HTML/CSS/JS, ~50 KB, zero deps). Built 2026-07-10 in this session; do not re-create a copy in
this repo. Open it at **`http://localhost:8000/design-book/ui`**.

**Served + auth'd by two DEV-ONLY routes** (`D4K-backend/src/design-book/design-book-dev.controller.ts`,
`@ApiExcludeController`, wired in `design-book.module.ts` which also registers a local `JwtModule` with
the same `JWT_SECRET`):
- `GET /design-book/ui` → `res.sendFile(<repo>/public/design-book-ui.html)` (path via `process.cwd()`,
  so run `node dist/main.js` from the repo root).
- `GET /design-book/dev-token` → mints a 1 h masteradmin JWT (`{userId:651f…6947, email:masteradmin@…}`)
  via `JwtService`. Returns `{token, tokenType:"Bearer", expiresInSeconds:3600}`.
- **Both gated to `ENVIRONMENT ∈ {local, dev}`** (mirrors `main.ts`); they **403 in stg/prd/demo** so the
  unauthenticated token-minter never ships to prod. Guards are per-method in this module, so these routes
  are simply not `@UseGuards`'d. ⚠️ Never set `ENVIRONMENT=local`/`dev` on a public host — it would expose
  an admin-token endpoint. The minted user must exist in the connected Mongo or guarded routes still 401.

**Token auto-renews — no paste needed.** The page auto-detects same-origin base (`location.origin +
/design-book`, so no CORS since it's served by the backend), fetches `/dev-token` on boot, renews ~1 min
before expiry (a 30 s `setInterval`), and retries once on any 401. Badge shows `🔑 auto · NNm left`. A
manual token can still be pasted in the **⚙ connection** panel (sets `manual`, disables auto) — the fallback
when `/dev-token` is absent (e.g. pointing at a deployed prod backend).

**What it renders (all from the API, images built from `meta.imageUrlTemplate`):**
- Faithful clone of the LEICHT top toolbar — brand bar (live `GET stats` counts), **PROGRAMME** family
  pills → `family`, programme dropdown → `programs`, **FRONTS** tier pills `P/P1/A/C/C1` → `tier`,
  **W/H/D** pill bars → `widthMm`/`heightClass`/`depthClass` (D is a nominal cm CLASS 36/48/58/63/68 matched via
  `configure.depth[].label`, NOT exact `depthMm`; carcass = class×10−20), **Suspended** → `suspended`, **group by family**
  → `groupBy`, plus a **TALL two-row height selector** (`#tallRow`, shown only in tall context via `isTallContext()`):
  **LINE** pills 73/80/86 → `line` + a **dynamic HEIGHT** row → `tallHeight`, both fed by `GET tall-heights`
  (`refreshTallRow()` caches `heightsByLine`/`lineOptions`; line-switch repaints the height row from cache;
  Avance-locked lines greyed). All AND-compose, shown as removable chips. Cosmetic-only controls (Mix, toe-kick slider,
  colour-temp, unit box, pin, "Grey don't hide", Corner width) are marked `title="display only"` — no
  backend param exists (device-side render state per the section map above). Working light/dark theme toggle.
- Left **Design-Tasks sidebar** from `GET functional-categories` (zones→groups→leaves + All + More) →
  filters via `leafId`/`groupKey`/`zone`/`category`.
- **Card grid** (`GET items`, paginated) where each card is a mini-configurator: clickable **H/W/D + Ty
  option rows + programme tier pills** from the item's `configure` (in list rows). Clicking a pill **swaps
  the card in place** to that sibling SKU (incl. backend-synthesized `P1/C1`). Card action buttons: **⧉ Copy**,
  **＋ Add Sink** (from `sinkFitment.showOnCard`, opens a popup), **🍽️ Appliances** (only on housing fronts
  that have `appliance` metadata — enriched via a follow-up `items?sku=…&full=true` call since `appliance`
  is omitted from default list rows; opens a popup). ♥ favourite is intentionally skipped (device-side, UI-only).
- **Detail drawer** (`GET items/:sku?expand=all`) — every section: Configure (clickable pills → sibling),
  Appliance housing, Sink fitment, Description, Specification, Engineering flags, Restrictions, Programme
  availability, Modifications, Planning notes, accessory-panel tabs (ref-cards resolved via the `refs` map),
  Related groups, Finishes, Catalog PDF link, System Builder.

To re-verify after backend changes: `npm run build` in `D4K-backend`, `node dist/main.js` from repo root,
open `http://localhost:8000/design-book/ui` (no token step). It's a dev tool / API reference, not the
product UI (the client builds the real React app).

## Open items / next steps

1. ~~**Write the new client instruction** to export the full catalog to the contract~~ — **NO LONGER
   NEEDED.** We produce the export ourselves from the live HTML (`docs/export-v781.json`, see
   the v781-export section above). All the old defects the client instruction was meant to fix
   (Alterations flattened, raw-`<svg>` Inspiration label, dropped lifestyle image, missing `configure`)
   are handled by driving `openDetail`. Only re-ask the client if they can give the SEPARATE
   inspiration/lifestyle render URLs (the one thing not in the HTML). Old email + accessory-panel schema
   retired in `obseleted/superseded-docs/`.
2. ~~**Version alignment**~~ — **RESOLVED.** The single in-house full-catalog export at one version
   (v767) removes the old v584/v728/v765 join gap. Re-run the extractor on each new HTML build.
3. **Build proper APIs in `D4K-backend`** once the schema is agreed — the endpoints that serve the new
   normalized item model to the React UI. Ingest `docs/export-v781.json` (schema-valid, 18,375 items).
4. **Two v765 app bugs to raise with the client** (found while verifying `relatedGroups` in-browser):
   - **`oftenPlannedWith` never renders** — the render does `meta.companions[f.sub]`, but `companions`
     keys are `"Sink"`/`"Cooktop"` while family `sub` values are `"Sinks"`/`"Cooktops & Downdrafts"` →
     always `undefined`. Fix the keys or drop the block. Verified live: `completeThisCabinet` (Vero unit
     `T6073VE` → shelf `FW3WVE6058`), `openingSupport` (trash-pullout `T3073Z2W` → `HFO3`), and
     `compatibleAccessories` (a tab) DO render.
   - **`plannedTogether` is computed at render** from the `REFS`/`f.comp` companion graph (not a stored
     field), so the export must materialize it — it can't be read straight off the source.

## Practical notes

- **Browser inspection of the app:** the Chrome extension can't open `file://`. Serve the HTML over
  http (`cd <dir> && python3 -m http.server 8777`) then open `http://localhost:8777/<file>.html`.
  The current UI build is the client's `leicht_units__765_.html` (kept by the user in `~/Downloads`,
  not in this repo). To open a detail panel directly: **`openDetail('<familyId>','<sku>')`** (global fn,
  2 args, e.g. `openDetail('F333','T6073VE')`) — famId = the family's `"id":"Fxxx"` in the embedded data;
  or use the landing **"Search by Code"** box. Detail sections = `document.querySelectorAll('h4')`. The
  families/units data is closured (not a `window.*` global) — grep the HTML file for codes/famIds.
- **Memory:** see `~/.claude/.../memory/` — `design-book-module.md` (backend module + all decisions),
  `project-location.md`. Update them as work progresses.
- When a task spans many large files, launch subagents (Explore / general-purpose) to analyze in
  parallel rather than loading everything into context.

## `obseleted/` — retired, kept for reference only

- `old-extraction-pipeline/` — the old HTML-scrape flow: `extract_catalog.py`, `extract_details.js`
  (still a good reference for how to headlessly scrape the panel), `server.js`/`openapi.js`/`shot_panel.js`
  (old test API), `leicht_units__562_.html` (old build), `leicht_catalog.json`/`leicht_items.json`
  (old 240 MB outputs), `package*.json`, `node_modules`, `README.md`.
- `superseded-docs/` — all four earlier client-facing docs, replaced by `docs/export-schema.ts` (the
  contract): `email.txt` + `CLIENT-export-alterations-accessories-spec.md` (first ask), and
  `email-reply.txt` + `Dash4_AccessoryPanel_SCHEMA.md` (the accessory-panel-only reply). Next client
  instruction will point at `export-schema.ts` instead.
- `duplicate-data/` — a Finder duplicate of the export.
- `CLAUDE.old.md` — the previous CLAUDE.md (described the retired single-HTML-file pipeline).
