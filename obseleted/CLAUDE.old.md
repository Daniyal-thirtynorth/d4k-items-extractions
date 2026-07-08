# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **single, self-contained HTML file** — `leicht_units__562_.html` (~38 MB, ~1.18M lines) — that is the **LEICHT "Designer Instrument"**: a browser app for exploring the LEICHT kitchen-furniture catalog (IDM 3.0.1, Collection 2026/2). It bundles the entire product database, all UI, all logic, and all styling into one file.

There is **no build system, no package manager, no tests, no git**. The whole repo is this one file.

- **Run it:** open `leicht_units__562_.html` in a browser. Reload to test changes.
- **External deps (CDN, loaded at runtime):** `pdf.js` (catalog/book PDF rendering), Google Fonts (Manrope/Poppins/Inter Tight).
- **Asset hosts:** product thumbnails `https://dash4data.s3.us-west-1.amazonaws.com/itemData/<code>.jpg`; finish swatches + PDF books `https://leicht-store.s3.us-west-1.amazonaws.com/...`.

### Working-with-a-huge-file practicalities
- Editors, full-file greps, and `Read` without offsets will be slow. Always work with **line ranges** (`sed -n 'A,Bp'`, `Read` with `offset`/`limit`).
- **Never hand-edit the embedded JSON** data block — see file map below.
- This file is *generated/curated*, evolved as an **append-only stack of versioned patches** (see "How the catalog is reshaped").

## File map (line ranges are current, approximate — re-grep landmarks if they drift)

| Lines | Block | Contents |
|------|-------|----------|
| 1–80 | `<head>` inline scripts | `toggleTheme()` (light/dark, `localStorage` `leicht-theme`), `setKelvin()`/`getSavedK()` (workspace warmth slider, `leicht-kelvin`). These run before render. |
| 81–4170 | `<style>` #1 | All main CSS. `:root` design tokens (`--bg/--ink/--accent/--leicht/--pl-*` programme colors/`--ln*` line colors/`--pc-*` price-badge colors); `html[data-theme="dark"]` overrides. Kelvin slider injects a runtime `<style id="kelvinStyle">` that retints only light-mode surfaces. |
| 4172–4507 | `<body>` | Static HTML skeleton — the 9 UI blocks (below). Everything inside is populated by JS. |
| 4508–~1140116 | `<script id="DATA" type="application/json">` | **The 38 MB embedded catalog JSON.** Parsed once into `DB`. Do not edit by hand. |
| ~1140117–1175938 | **MEGA `<script>`** | The whole app: DB load, ~74 catalog-reshaping patches, filters, selection, rendering, pricing, CSV, welcome/tutorial, instruction-book reorg. ~35k lines. |
| 1175963–1176200 | `<script>` | **Mix wizard** (`mixDraft`, `MIXCOL`) — assign a different programme per area (Base/Tall/Wall). |
| 1176207–1176603 | `<script>` | **Catalog spread viewer** (v337) — two-page price-cropped PDF book reader from S3. |
| 1176606–1177079 | `<script>` | **Dash4.AI copilot** ("d4" NL search bar) — deterministic intent tools; `Dash4AI.config.endpoint` is a drop-in for a real LLM. |
| 1177082–1177699 | `<style>` #2 | Styles for the book viewer / copilot / image-protection. |
| 1177717–1178216 | `<script>` | **Info / Instruction Book** (v465) — per-area selected catalog pages, range-loaded PDFs (`window.BOOK_CFG`). |

## Data model (`DB`, the parsed JSON)

`const DB = JSON.parse(document.getElementById("DATA").textContent)` → `FAMS = DB.families`, `PROGS = DB.programs`, `ALTN = DB.altnames`, `RULES = DB.rules`.

- **`DB.meta`** — `unit_count` (~23.5k), `widths`, `width_groups` (e.g. `60`↔`[60,61,65]`), `corner_widths`, `companions` (per-sub add-on suggestions). Prices are **account points at 2-decimal scale → divide by 100**.
- **`DB.programs`** (120) — kitchen lines: `{k:"201", n:"ROCCA 01", fam:"PRIMO"|"AVANCE"|"CONTINO", fld, fd}`. `k` = programme key referenced by `unit.x`.
- **`DB.families`** (≈1338) — the display unit. Key fields:
  - `id`, `cat`, `sub`, `sec` (3-level nav: zone → sub → on-page section), `label`.
  - `units[]` — the SKUs grouped into this family card.
  - `dim` (`"width"`), `vlbl`/`vsub`/`vfin`/`vfmt` (variant selector labels), `ord`/`pri` (sort), `byprog`, `cho`, plus `_`-prefixed precomputed flags (`_tiers`, `_progs`, `_hasP1`, `_anyC1`, …) added by patches.
- **`unit`** (inside `family.units`) — key fields:
  - `c` = SKU code, `w` = width (cm), `W`/`H`/`D` = mm dims, `fam` = tier letter (`P`/`A`/`C`), `sib` = sibling-tier prefixes, `hc` = height class.
  - `f` = **finish→price map** (`{"31":23600,...}`), `cg` = calc group (drives pricing admin), `pp`/`vl`/`wt` = pricing/value/weight.
  - `x` = list of allowed programme keys (gates availability), `alt` = attached alteration codes, `acc` = accessories, `ld` = description lines, `vr` = variant value, `d`/`dd`/`dt`/`dv` = depth options/carcass mm.
- **`DB.rules`** — config consulted by the UI: `handle_systems`, `handle_positions`, `handleless_recipes`, `opening_systems`, `vertical_handle`, `antoso`, `lighting`, `lighting_control`, `programs_special`, `carcass_colors`.

**Category zones (`cat`):** Base, Tall, Wall, Midway, Closet & Wardrobe, Surround, Panels & surround, Countertops, Handles, Lighting, Service, Sink, Accessories & interior, Alteration.

## The 9 UI blocks (body skeleton → JS-driven)

1. **`#navToggle` (`.navtoggle`)** — hamburger; opens the Categories drawer on mobile (`openNav`/`toggleNav`).
2. **`#mast` (`.mast`)** — header: `LEICHT` title + `#subtitle`, `#meta` (collection + live unit/programme counts), **Kelvin warmth slider** `#kelvinSlider`, **theme toggle** `◐`, fold chevron `#foldch` (collapse the whole control stack).
3. **WORLD bar (`.bar`)** — `#setupChip` (toggle programme picker), **Programme family tabs** `#famTabs` (All/Primo/Contino/Avance → `setProgFam`), `#progSel` (`fillProgSel`/`setProg`), **`#mixBtn` Mix** (per-area programme), `#openSeg` (Opening systems), **`#antosoPill`** (floating/wall-mounted), **Handle** `#handleSeg` (Standard / Vertical V), **Front/line** `#tallFinishSeg` (Std / Full E / J 86 / Y 66).
4. **SIZE bar (`.bar.sizebar`)** — `#pinBtn` (lock filters open), collapsible `#sizePanel`: **Width** `#widthSel`, **Height** = line segment `#lineSeg` (All/73/80/86) + `#heightSel`, **Depth** `#depthSeg` (36/48/58/68, carcass mm), `#lineGreyChk` ("grey, don't hide" off-programme units via `setLineGrey`).
5. **Categories drawer (`.wrap > aside.side`)** — `#search` (+ `#searchClear`), `#catList` + `#subList` (rendered by `renderCats`).
6. **Main (`.wrap > main.main`)** — `.resbar`: `#resN`/`#greyN` counts, **♥ My list** `#favToggle`, **📖 Info** (`openBook`), **⚙ Pricing** (`openAdmin`), **↓/↑ CSV** (`exportCSV`/`handleCSVFile`); `#grid` (cards from `renderGrid`); `#loadMore` (pagination, `state.per`).
7. **Detail panel (`aside.panel#panel`)** — slide-over product detail (`openDetail`/`closeDetail`), backed by `#scrim`.
8. **My list (`aside.collpanel#collPanel`) + `#collBar`** — favorites tray; `collOpen`/`collClose`/`collCopyAll`/`collClear`; persisted in `localStorage` `leicht-coll`.
9. **Pricing Admin (`aside.pa-panel#paPanel`)** — calc conditions + permissions driven by calc groups (`cg`); `openAdmin`/`renderAdmin`/`adminExport`/`adminImport`.

Overlay scrims: `#navScrim #scrim #collScrim #paScrim`. Additional UIs are built dynamically by the tail scripts: **Mix wizard, catalog spread viewer, Instruction Book, Dash4.AI copilot bar, welcome screen + tutorial**.

## How the app works (logic in the MEGA script)

**Central state:** one `state` object (`prog, progMap, line, cat, sub, depth, handle, front, open, antoso, width, height, q, prices, page, per, fav, …`) drives every render. Per-card overrides live in two maps: **`blockSel`** (chosen width/variant/system per family id) and **`cardMod`** (per-card depth/opening). **`CODESET`** = set of all valid SKU codes; **`COLL`** = My-list array.

**Pipeline:** `DB` → **reshape patches mutate `FAMS`/`SUB_ORDER`/`SECTION_ORDER`/`CODESET`** → `render()` → `renderCats()` + `renderGrid()` → cards (`thumbHTML`/`itemCard`/`cardPriceSpan`) → `openDetail()` slide-over.

**Filtering:** `blockVisible(b)` / `visibleBlocks()` apply the active filters via predicates — `available`, `progOk`/`progOkFor`, `depthOk`/`depthFamOk`, `handleOk`, `frontOk`, `openOk`, `antosoOk`, `lineHFilter` (line↔height 73/80/86), tier checks (`tierOf`/`tierHas`/`famOkU`). `effLine(b)` resolves the effective line from selected system + `cardMod`.

**Selection helpers:** `selectedUnit`/`_selUnit`, `variantOpts`, `hvals`/`hvalsV`, `dvalsFor`/`dvalsAll`, and the `pick*` window functions (`pickWidth/pickHeight/pickDepth/pickVariant/pickInsert/pickCardFam/…`) write into `blockSel`/`cardMod` then re-render.

**Pricing:** `retailPrice(u)`, `money2`/`money0`, `cardPriceSpan`, `detailPriceHTML`; admin config (`pcfgDefault`/`loadPCFG`/`savePCFG`), currency/FX (`eurUsd`/`fxLoad`), and calc-group counts (`cgCounts`). Price badges colored by finish via `--pc-*` tokens.

**CSV round-trip:** `exportCSV` ⇄ `handleCSVFile`/`importCSV` lets the catalog be edited externally and re-imported (overrides prices/images at runtime).

### How the catalog is reshaped — the patch stack (the bulk of the code)

After `DB` loads, the MEGA script runs **~74 versioned IIFEs** (`/* v93 (Shimon) … */` … `/* v562 (Shimon) … */`). Each one **mutates the in-memory `FAMS`** (and `SUB_ORDER`/`SECTION_ORDER`) to turn the raw IDM catalog into the curated display model: splitting one family into per-variant cards, merging siblings into one card with a selector, relabeling, moving items between `cat`/`sub`/`sec`, attaching alterations/accessories, fixing nav order. This is **append-only**: new behavior was added as a *new* patch at the end rather than editing earlier ones.

**Convention when changing catalog behavior:** add a new versioned IIFE (next `v###`, comment with rationale) rather than mutating an existing patch — matches the established history and keeps each change auditable. Each comment documents the version, author, and *why*; grep `/\* v` to trace.

## Data extraction (`extract_catalog.py` → `leicht_catalog.json`)

Pure-Python extractor that pulls the embedded `<script id="DATA">` JSON and flattens it to **one MongoDB-ready document per orderable code**. No browser; replicates the app's `sibCode`/`real_tier` logic only.

- **Run:** `python3 extract_catalog.py` → writes `leicht_catalog.json` (`{extraction, programs, altnames, rules, items[]}`) **and** `leicht_items.json` (bare `items[]` array for `mongoimport --jsonArray`).
- **Granularity (two-phase, lossless):** (1) emit **every raw unit at its own code** (16,393 — guarantees zero loss); (2) add only **genuinely-new programme siblings** (~1,354) that have no real record — i.e. one stored model with `sib:"PC"` but no separate Primo/Contino code. **~17,747 items.** Real sibling records (e.g. `T1573` + `CT1573` both in source) are kept as-is with their own distinct prices — never cross-stamped.
- **Not exploded (kept as fields):** finishes (`finish_prices` map), depths, width-group alternates, and front/handle/line/opening flags (`E`/`V`/`J`/`Yc`/`P1`/`C1`). Each item also carries a verbatim `raw` unit object + `family_meta`, so no field is ever dropped.
- **Note:** `meta.unit_count` (23,511) is an upstream IDM provenance figure, **not** reproducible from this file — it depends on how many variant axes you explode. Completeness is instead proven by: every raw code present as a `base_code` (set-difference empty) and unique `_id` = `code__family_id__tier`.

### UI detail enrichment (`extract_details.js` → `item.detail`)

Adds, to each item, the **exact detail panel the legacy UI shows** (the `openDetail` tabs: Overview / Installation / Visible Sides / Alterations / Pullouts / accessory systems, with recommended depth-matched side panels etc.). Run **after** `extract_catalog.py` — it reads and rewrites `leicht_catalog.json` (+ `leicht_items.json`).

- **Approach:** runs the *real* app headless (puppeteer-core + installed Chrome), drives it by **code** via the app's own `goFam(code)` → `codeLoc` → `openDetail` (so runtime post-patch family splits/merges resolve correctly; `base_code` fallback for synthesized siblings), then serializes the `#pin` DOM into structured data. This guarantees parity with the source UI without re-implementing the ~1,500-line rule engine. Multi-option cards (`itemCardMulti` `.mchip`) are captured via their `mcPick('id','CODE')` onclick so no codes are lost.
- **`detail.sections[]`** = every `.sec` panel block in order (full parity): Configure, Description, **Specification** (`kv` rows), **Programme availability** (`chips`), **Restrictions** (`notes`), **Possible alterations & accessories** (`tabs`), **Modifications — how to** (`recipes` with `codes` incl. P1/C1/760/761), **Planning notes** (`notes`), companions/Recommended (`cards`). `detail.tabs` is a convenience copy of the alterations tabs.
- **Coverage:** ~16,795/17,747 items get a full `detail`; the rest are `{available:false}` — codes the source UI shows only as options inside merged/multi cards (non-standard widths, side-panel/worktop/cutlery/cutout variants), not as standalone cards.
- `detail.tabs[].count` is the legacy's own displayed count; `cards[].options[]` holds the extra packed codes. **Rendered at default state (no programme, depth 58)** — other depths yield slightly different organizer sets.
- Every card has `image` (S3 thumbnail URL from `.ithumb img` src, captured even though images are network-blocked during render) + `detail.image` (main product image). `item.alterations` is rebuilt by `extract_details.js` as the **merged general + unit-specific** list (each `{code,name,desc,image,group}`); raw `u.alt` stays in `item.raw.alt`.
- **`detail.configure`** = the CONFIGURE pills (Width/Height/Depth/Programme). Each option is resolved to its **target order `code`** by replaying the pill's click in-page (`openDetail` for width/height — direct; `setDepth`+re-render for depth — depth-encoded code; `goBandDetail` for programme — sibling code). The frontend navigates by `GET /api/codes/<code>`. Reset depth to 58 before each programme sim to avoid state leakage. This per-chip simulation is why the detail pass runs ~18/s (vs ~250/s without it). **The grid card's own W/H/D/P pills (`pickWidth/pickHeight/pickDepth/pickCardFam`) resolve to the same codes — the list view reuses `detail.configure`; no extra data.**
- **List/grid card header pills** (`item.card_label`, `item.programme_badge`, both **top-level**) = the legacy grid card head the detail panel lacks: top-left group label (`fdesc(b,u)` → "Cooktop Unit") + top-right programme badge (`progBadge(b)` → "ALL" / "P · A" / "C"). Family-level. `extract_details.js` scrapes them straight off the rendered grid (`GRID_BADGES()` walks every category — v92 = no pagination so one `setCat()` per category shows all `.card`s — keyed by the runtime `fid` in each `.chead` `openDetail('<fid>','<code>')` onclick; matched back via `detail.fid = codeLoc(code).fid`). Because they're top-level, the **slim list keeps them** — grid renders headers with no per-card fetch.

## Test REST API (`server.js` + `openapi.js` → Swagger)

Small read-only Express API over `leicht_catalog.json` for browsing/testing the extracted data (the client builds the real React UI separately). `npm install` then `npm start` → `http://localhost:3000/docs` (Swagger UI; `/` redirects there). Loads the whole catalog into memory (override file with `DATA_FILE=…`, port with `PORT=…`).

- **Endpoints:** `/health`; `/api/items` (search/paginate — filters `q,category,sub,section,family_id,programme_tier,programme_line,program_key,synthesized` + `sort,order,page,limit`); `/api/items/{id}` (by `_id`); `/api/codes/{code}`; `/api/families/{familyId}`; `/api/categories`; `/api/subs`; `/api/programs`; `/api/stats`; `/api/meta`; `/openapi.json`.
- **Slim lists:** `/api/items` strips `raw`/`family_meta`/`detail` bodies by default (detail → `{available,tab_count}`); pass `slim=false` for full docs. Detail-bearing endpoints (`/api/items/{id}`, `/api/codes`, `/api/families`) always return full docs.
- `openapi.js` is a hand-written OpenAPI 3.0 spec (`Item` + `Detail` schemas); served at `/openapi.json` and rendered by `swagger-ui-express`. Keep it in sync when item/detail shape changes.
- `shot_panel.js` — puppeteer helper to screenshot a single legacy detail panel (debugging/parity checks).

**Pipeline order:** `extract_catalog.py` → `extract_details.js` (enriches in place) → `npm start`. Re-running `extract_catalog.py` resets `item.alterations` to raw and drops `item.detail`; re-run `extract_details.js` after it. Output files are large (~228 MB) — Node loads fine; `git` should ignore them if ever versioned.

## Finding things

- Grep **within the MEGA script range** and rely on the `v### (Shimon)` comment tags + descriptive function names.
- Function landmarks: filters near the middle, `renderGrid`/`openDetail` for cards/detail, `openAdmin`/`renderAdmin` for pricing, `buildWelcome`/`startTutorial` for onboarding, the large `reorg`/`chap` block + v561/v562 IIFEs for instruction-book/nav structure.
- Persistence keys: `leicht-theme`, `leicht-kelvin`, `leicht-coll` (+ pricing config / FX in `localStorage`).
