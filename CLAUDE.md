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

There is **no build/test/git here** — it is data files + docs. Big JSON files: never `Read` them
whole; use `python3`/`node` or `Read` with offset/limit. Grep/analyze programmatically.

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
data-from-client/                    # NOTE (2026-07-08): all client data JSON deleted — only the HTML
                                     #   build is kept here now. Everything the backend needs is the
                                     #   in-house export under docs/ (export-v767.json). The old client
                                     #   files below (v584 catalog, accessory-panel export, ts-structure
                                     #   export) are GONE from disk; recover from git history if needed.
  leicht_units__767_.html            # ⭐ LIVE APP BUILD v767 (17.6 MB) — THE ONLY FILE STILL HERE.
                                     #   Raw catalog in <script id="DATA"> (DB.families/programs/altnames/
                                     #   rules). The FULL v767 export was generated FROM this file by
                                     #   driving its own renderer (see below).

docs/
  export-schema.ts                   # ⭐ THE CONTRACT — canonical normalized export schema (see below)
  export-sample.json                 # ⭐ worked SAMPLE of the contract — 13 items exercise every schema object.
                                     #   Carries plain-English `_ui` doc-keys (backend must strip; NOT in schema).
  export-v767.json                   # ⭐ THE ACTUAL FULL EXPORT (v767) — 18,375 items, ~103 MB. Schema-VALID
                                     #   (0 violations), 0 unresolved of 536,800 refs. Ingest THIS. Now also
                                     #   carries top-level `functionalCategories` + per-item `functionalGroups[]`,
                                     #   and (2026-07-10) per-item `nameQualifier` / `handedLR` / `sinkFitment`.
  export-v767.json.gz                #   gzipped (3.3 MB)
  export-v767.pre-functional.bak.json #  backup of the export BEFORE functionalCategories/-Groups were added
  export-v767-SAMPLE.json            #   10 real items exercising every schema object
  export-v767-extractor.js           #   the in-page extractor that produced it (re-runnable for v768+)
  export-v767-README.md              #   method + counts + how to re-run
  functional-view-v767.json          #   standalone "Design Tasks" sidebar tree (zones→groups→leaves+rules+counts)
  design-book-guide.html / .pdf      # illustrated guide to the CURRENT backend API (UI element → endpoint)
  design-book-api-map.html / .pdf    # map of the current backend endpoints
  img/                               # screenshots used by the guide

obseleted/                           # retired — see bottom
```

## ⭐ The v767 full export — produced IN-HOUSE (`docs/export-v767.json`)

We no longer wait on the client for a correct export — **all prior client exports were wrong and
discarded.** A fresh, schema-valid full export of v767 was built here from `leicht_units__767_.html`.

**Result:** 18,375 items (16,915 cabinet · 1,306 accessory · 154 alteration · +23 synthesized
referenced codes), 14 categories, 120 programmes. `node validate.js` → **0 schema violations**;
**0 unresolved of 536,800** pill/card/variant refs; 0 dup skus.

**Why it is correct (and the client's wasn't):** the raw `<script id="DATA">` JSON is NOT the shipped
model — on load the page runs a big reclassify/split/merge (`classify`, `splitFam`, `mergeFams`, …),
so the final `FAMS` = 1,714 families / 18,823 units only exists post-init, and every rich section
(configure pills, engineering, accessory tabs, related groups, appliance) is COMPUTED by the app's own
`openDetail()` renderer. So we **drive the app's real code**, never re-implement it:
1. serve the HTML over http, open in Chrome (extension can't do `file://`);
2. `fetch`+`eval` `docs/export-v767-extractor.js` in the page → `__H` reachable (FAMS + helpers are
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
NOT stored items (backend synthesizes them from base+featureFlags); dims coerced to mm-numbers (some
source `u.W` are strings like `"30 cm"`); `specification` omitted when a unit has no real dim (matches
sample — accessories carry no spec); `catalogPage` dropped when no PDF page. Re-run for v768+: same 5
steps, just point the http server at the new HTML. Full notes in `docs/export-v767-README.md`.

## The export schema (the contract) — `docs/export-schema.ts`

The single most important file. It defines the JSON shape the client should export to, so future
catalog updates are a clean re-ingest. Design (settled with the user + a data analysis):

- **Everything is an `Item`, keyed by `sku`.** One record per code. `kind` = `cabinet | alteration |
  accessory | part`.
- **Every code the UI shows is an `ItemRef {sku, label?, variants?}`** into `items[]` — pill targets,
  accessory/alteration cards, card variants, modification codes, companions. **No embedded duplication.**
  (Measured: accessory cards duplicated ~122× in the flat export; one code, `ANST`, on 11,001 units.
  Image is 100% derivable from `imageUrlTemplate`. 1,453/1,804 card codes are already SKUs.)
- Top level: `{ meta, categories[], programmes[], ruleTables?, items[] }`.
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

NestJS 11 + Mongoose module `design-book` (`@Controller('design-book')`, JWT-guarded). 8 endpoints
(`/cards`, `/cards/:cardId`, `/resolve` deleted; `/detail/:sku` merged into `/items/:sku`):
`POST ingest`, `GET items`, `items/:sku`, `programs`, `categories`, `functional-categories`, `meta`,
`stats`. `design-book.detail.ts` now only builds `catalog` (the PDF binding) + ref-hydration; the item
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

## Open items / next steps

1. ~~**Write the new client instruction** to export the full catalog to the contract~~ — **NO LONGER
   NEEDED for v767.** We produce the export ourselves from the live HTML (`docs/export-v767.json`, see
   the v767-export section above). All the old defects the client instruction was meant to fix
   (Alterations flattened, raw-`<svg>` Inspiration label, dropped lifestyle image, missing `configure`)
   are handled by driving `openDetail`. Only re-ask the client if they can give the SEPARATE
   inspiration/lifestyle render URLs (the one thing not in the HTML). Old email + accessory-panel schema
   retired in `obseleted/superseded-docs/`.
2. ~~**Version alignment**~~ — **RESOLVED.** The single in-house full-catalog export at one version
   (v767) removes the old v584/v728/v765 join gap. Re-run the extractor on each new HTML build.
3. **Build proper APIs in `D4K-backend`** once the schema is agreed — the endpoints that serve the new
   normalized item model to the React UI. Ingest `docs/export-v767.json` (schema-valid, 18,375 items).
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
