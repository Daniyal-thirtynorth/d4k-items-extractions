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

## ⭐⭐ v2 — MINIMAL + CAPABILITIES model (CURRENT; 2026-07-17, schemaVersion **2.5.3** since 2026-07-29). READ THIS FIRST.

The model was reworked from the fat "everything pre-computed, frozen at the default toolbar" export (v1,
`docs/export-schema.ts`) to a **minimal + capabilities** model (**schemaVersion 2.4.0** — 2.0.0 plus the
additive `DimPill.code` on depth pills (2.1), `Item.doorLineYCode` + `Item.heightExtension` (2.2),
`DimPill.showUnderLine` on width/height pills (2.3), and `Item.heightCode` (2.4); old readers ignore all five). Everything below
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
  alteration keep the base code (63 = base + `ANTSP63US`·`MPRU`… in the clipboard, per `d63Set` — **which**
  set is decided by the cabinet's category, map §2c-4). Absent on
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
- **Docs (all v2, contract 2.5.4; click/route material refreshed 2026-08-06 for §U):** `docs/export-schema-v2.ts` (contract) ·
  `docs/export-sample-v2.json` (**15**-item worked sample — `MGT601468` = `doorLineYCode` +
  `heightExtension`; **every item now carries `unitFacts`/`familyFacts` incl. `rawSub` (was missed at
  2.5.3); `L24CD` = `gridHidden`; `ANTSPSAUS` = `dupFamilies`; `ZIGSUV90` = `unitFacts.insert`**) ·
  `docs/design-book-api-ui-map-v2.md` (API↔UI, §2c the 8-gate model + per-gate GREY table +
  `availableFromCaps` + render spec; **§2c-4 DEPTH PILL — selection + when to call `/items/:sku`**;
  **§2c-1 SELECTED — navigation rows vs DEPTH state rows**;
  **§2c-2 the two depth models**; **§2c-3 the WHOLE order-code surface — every `assemble()` input, which
  rows are plain navigation, `doorLineYCode`, `heightExtension`**; **§2c-8 the grid's pill ROUTES — Ty by
  `variantCode`, NEVER `variantCore`**; **§2c-13 the CARD-STATE rows — `cardLine`, the 63 chip,
  `d63NoClick`, the local depth pick, and (e) the Ty pick + the RANKED face pins**; §1b CRUD) ·
  **`docs/design-book-crud-guide.md`** (authoring guide: mental model = a card is a FAMILY of sibling items
  linked by pills, the rule lives on the pill TARGET; §3a depthClasses+58/63 quirk + gate-vs-pill-row warning,
  §3b nativeTier/opening/twinTiers, §3c the other 6 gates, §3d master greying table; §4/§4a the depth
  state-row warning, **§4b `heightExtension`**, **§4c `doorLineYCode`**, §4d `showUnderLine` (now
  DRAWER-only), §4e `heightCode`, **⭐§4f `unitFacts`/`familyFacts`/`gridHidden`/`dupFamilies`/card-order —
  what actually draws the GRID card**; the BOSSA "disable 2 width pills"
  recipe) · `docs/design-book-greying-examples.md` (worked
  grey/live cases per gate + **§14 the CARD rules a single unit can't answer — `cardAvailable`, isAccessory,
  hide-vs-grey**) · `docs/design-book-item-fields-plain-guide.md` (plain-English field-by-field
  tour + **§3b why the card's buttons ≠ the detail screen's** — hand this to a non-engineer) ·
  **`throwaway/frontend-v2.5-changes.md`** (the React client's `gridRows` implementation guide, against
  `D4K-frontend` `origin/dev` 25b19af9 — **rules R1–R16**, R16 being §U's variant route; v2.2/v2.3 guides in the same folder are already merged there) ·
  **`docs/lio-agent-requirements.md`** (⭐ LIO — the catalog assistant: the requirements R1–R9, the
  decisions D1–D12, the implementation status, the model comparison and the four defects driving it
  found; the client contract is map **§10** (the reason API) + **§11** (the one ask endpoint)).
  v1 docs (`export-schema.ts`, `design-book-api-ui-map.md`,
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
  `available:false`+`programmeExcluded`. **~~KNOWN GAP~~ CLOSED (verified 2026-08-06):** `resolveRefs` DOES
  project `capabilities` (`design-book.service.ts:2791`, alongside `variantCore`/`widthMm`/`heightClass`),
  so `?expand=refs` is fully self-sufficient and the drawer can gate pills on their TARGET's caps. The
  **client** half was the real gap and is now done too: the drawer sends `programs=` (its only toolbar
  input — without it the server resolves every pill against the no-programme baseline and NOTHING greys)
  and applies `availableFromCaps` against `refs[pill.sku].capabilities` for the other 7 gates. Landed on
  `D4K-frontend` `new-design-v2` @ `c9a3ce1f`.
  **⚠️ CORRECTED 2026-08-06 — that landing was verified against the WRONG expectation.** It recorded
  "`T6080` @BOSSA → W 15/20 `disabled`+struck" as the pass condition; both halves are the app's behaviour
  inverted. `openDetail`'s own chip builder is
  `code==null ? <button disabled style="opacity:.3"> : <button ${ok?'':'style="opacity:.4"'}
  onclick="openDetail(…)">` — so a chip dies on a MISSING TARGET, never on being unavailable, and an
  unavailable one dims to `.4` and **keeps its click**. That is the whole point of sending `programs=`:
  the greyed chip is the one a planner taps to go and look at the sibling the programme excludes.
  Two client bugs, both fixed: `CfgChip` disabled on `available===false` (`af03c2da`), and — the reason
  that first fix measured as a no-op — `gateOption` SYNTHESIZED `crossedOut` from `available`, so every
  greyed chip arrived already struck and the new `dead = !sku || crossedOut` re-killed exactly the chips
  it was meant to spare (`bb051c33`). `crossedOut` is a SERVER flag ("exists in this family, not orderable
  in this configuration") and is 0 occurrences in v781 — never derive it. The rule now lives in
  `chipIsDead` (`data/caps.ts`) with the app source quoted and tests. Confirmed against D4K-dev, not by
  reading: `items/T6080?expand=all&programs=244` → W 15 `T1580` and W 20 `T2080`, each
  `available:false` + `programmeExcluded:true` + **`crossedOut:null` with a real sku**.
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
- **⭐ GLOBAL HEIGHT ≠ FILTER + W/H pill skus are DETAIL-model (2026-07-27, audit §H).** Client report
  "same section, different SKUs" (grid showed 6073 faces vs app 6080). Three findings, all fixed UI-only in
  `design-book-ui.html` (no backend/data change): **(1)** the app has NO global 73/80/86 filter — its Height
  row is tall-heights-only (`availHeights`/`tallHC`, `renderHeightSel` resets anything else); `state.height`
  = family membership + face PRE-select (v329 `_gH`) + warn badge. Our `H 73/80/86` bar no longer sends
  `heightClass`; it per-card pre-selects (`applyHeightPreselect`): membership unchanged, swap to the height
  sibling where the family has one, else card stays. **(2)** stored `parameters.width/height` pill skus come
  from the DETAIL panel, where THE APP ITSELF targets the 68-depth sibling (family lists d68 first:
  `TSP6080B` detail has `H80→TSP608068B`, not self!) while the GRID's `pickHeight`/`pickHWidth` preserve
  depth — so grid card W/H pills now resolve via `swapCardTo` (`items?familyId&heightClass/widthMm&groupBy=
  family`; `depthMm` ASC face rank → native d58); detail drawer keeps pill skus (that IS app behaviour).
  **⚠️ SUPERSEDED 2026-07-28 (§K/map §2c-10): the key is `heightCode`, not `heightClass`** — the latter is
  null outside carcase-line families, so H picks 400'd there and W/Ty picks lost the height.
  The client React app must do the same — never grid-navigate by W/H `pill.sku`. **(3) CORRECTED same day:**
  the app's top "H All 73 80 86" bar DOES exist in Base — it is the LINE selector (`#lineSeg`→`state.line`),
  which re-faces cards AND collapses W/H rows via `lineHFilterB`; so `visibleByLine` DOES feed `F.heightClass`
  (then `F.line`) into the `showUnderLine` narrowing (H bar = no server filter + pre-select + row collapse).
  **(4) Ty/option pills — same detail-scrape disease:** targets are d68 codes incl. the SELF variant's own
  d68 twin (never marked selected). Fix: API `variantCore` query filter + refs project `variantCore/widthMm/
  heightClass`; UI option picks resolve `familyId+variantCore(target)+dims` via `swapCardTo`; selected =
  target variantCore == card's (`markVar`), W/H selection falls back to label==own-dim (`markDim`).
  **Swap queries pass `refs=true` and merge into the page refs map** — swapped-in cards otherwise lose
  variant selection + pill greying (the `TSP6073ZW` ZW case; map §2c-8 has the React-app rule).
  **(5) `showUnderLine` `0` = the "All/no-line" state** (additive): two-system tall H rows (97 fams,
  HP20…/HPEEW9…/GF46…) hide their 73-system pills (153/197/210/224) EVEN AT All — plain per-line lists
  couldn't express it and 0/97 had data. Render = `includes(line ?? 0)`; two-system pills stamped
  `[0,80]`/`[73,86]`, all pre-existing arrays got `0` prepended (`backfill-show-under-line-all0.js`,
  D4K-dev, 7,723 docs); extractor drives 'All'+Tall now. Single-system tall rows never collapse (stay
  bare). Verified HP20190: All → 80-system set, @73 → 73-system set; Base unchanged. Map §2c-5.
  **Export JSON synced with the DB** (2026-07-27): `export-v781-fresh.json`(+.gz) now carries ALL
  showUnderLine data (base W/H + the 0-convention) — it never had the base arrays (DB-backfill-only
  before), so a re-ingest would have wiped them. Re-ingest is now safe. Verified: Ty TZ → `TSPA9073TZ`, BTZ → `TSPQ10073BTZ`; cards at H73
  render `H:[73*] Ty:[TZW*,TZ,TZBS]` / `[BSZW†,BTZW*,BTBS,BTZ]` matching the client screenshot.
  Residual 2/18: heights existing only under another tier (`XTR_Z2/BZ2` h73 = C/C1-only —
  app's `ppool` hides the chip, we still show/swap it) — the §C2 per-tier pill-existence gap, deferred.
  **(6) ⚠️ STALE-HIGHLIGHT TRAP (later same day, audit §H-2, map §2c-7).** A screenshot seemed to show
  v781 at W45+H73+D58 rendering `TSP4580*` full-row faces — v781 can't produce that with line 73 applied
  (always `TSP4573` + collapsed `[73]`, every state/order). The grid was byte-for-byte v781's
  **W45 + H-All** grid with a STALE lit "73" chip: `#lineSeg` highlight is set only in its click handler,
  never re-synced from `state.line` on render (the tall LINE row drives the same state without touching
  the Base seg). Reproduced exactly, stale chip included. A brief "width beats line" UI change made from
  the wrong reading was REVERTED same day — our UI already matched v781 in every tested case (W45+H73 →
  `TSP4573*` collapsed; W45+H-All → `TSP4580*` full; W-All+H73 → `TSPA8073TZW` collapsed). Rule for all
  screenshot comparisons: **trust the cards (face sku + row shape), never the toolbar chip highlight.**
  **(7) ⭐ W FILTER = FAMILY MEMBERSHIP + TIER-POOL FACE (2026-07-27 evening, audit §I, map §2c-9).**
  Client report "W50 Sink Cabinets ≠ app": membership was already right (both sides 14 fams — v781's
  `unitsInWidth` counts ALL units incl. stored C/A siblings, our `$in:[w,null]` matched them) but our
  FACE hard-filtered `widthMm` and served the C-article W-match (`CTSP5073Z2`) where v781's `ppool`
  face falls back to the default width in the default line (`TSP6080Z2`, W60 under the W50 pill!).
  Fixed in `familyGroupStages` (D4K-dev): `widthMm` lifted out of `$match` → `_famFaceTiers`
  ($setWindowFields = the `faceForTiers`-flagged unit's `availableTiers` — the pool is the FLAGGED
  FACE's own tier set, NOT hardcoded 'P' (A/C-only fams keep width pref), computed BEFORE the
  heightClass post-match or swaps lose the pool) + `_widthRank` (W∩pool, sorts before `_faceRank`)
  + `_wHits>0` post-group membership (skipped when familyId-scoped: swap width = wish) +
  `WIDTH_BUCKETS` (60→610/650, 76→750, 80→820, 90→910/920) + `$ifNull` on `widthMm` (agg `$in`
  ≠ query `$in` for missing fields). Verified: 24-combo whole-catalog sweep vs `visibleBlocks`,
  12,240 faces: 937→883 mismatches (60 fixed incl. every reported case, 6 moved inside the
  already-broken GF-housing talls), membership deltas 0, Sink Cabinets 14/14 every tested state.
  Residual 883 = pre-existing tall/housing face-data + unmodeled `nowf` membership (deferred).
  **(8) ⭐ SECTION ORDER + single-card header-merge (2026-07-27 late, audit §J, map §2b).** Client
  "W50 Sink Cabinets: Trash Pullout shows 4 vs app 5". Not a data error — SNK8's `sec` IS "Instant Hot
  Sink Units"; it's the app's `renderGrid` rule ours didn't port: (a) sections ordered by
  `SECTION_ORDER[sub]` else catalog `pri` (ours was ALPHABETICAL); (b) a header emits only for a bucket
  of ≥2 cards OR `sec∈FORCE_SEC` — a lone non-forced card flows HEADERLESS into the previous section. At
  W50 only SNK8 (`TSPQ9073BTZW`) of the 5 Instant-Hot families has a W50 unit → its bucket=1 → no header
  → renders as the 5th card under "Sink Units with Trash Pullout". Fix (D4K-dev, data-driven): 3
  backfill-only denormalized fields (like faceHeightClass — RE-RUN after ingest) `catalogRank`(pri,
  null→999) + `familyIndex`(FAMS tiebreak) + `sectionRank`(index in `SECTION_ORDER[sub]`, 999=pri
  fallback); scripts `backfill-catalog-rank.js`/`backfill-section-rank.js`. `familyGroupStages`/
  `listItemFamilies`/`by-section` sort `(catalogRank,familyIndex,sku)`; new `bucketSections()` ports
  renderGrid verbatim (bucket by section, order by `(sectionRank,first-seen)`, header iff `len≥2 ||
  FORCE_SEC.has(sec)` — 111-name constant, else merge lone card into previous). Verified byte-exact:
  Sink W50 (`Units[4]·Drawers[3]·TrashPullout[5 incl TSPQ9073BTZW]·without-drill[2]`), Cooktop 8/8,
  Sinks&Faucets 27/27; face sweep unchanged (883). ⚠️ Grid list must NOT send `heightClass` (H bar =
  pre-select §2c-7) — with it, SNK4/XTR_BZ2 (W50 units H86-only) wrongly drop. Deferred: SECTION_ORDER
  as per-item rank (not stored map) — fine for pri-fallback/single-sub; revisit if a multi-sub leaf diverges.
  **Synced (2026-07-27): D4K-prd backfilled identical (18,366 each; only delta vs dev was these 3);
  export-v781-fresh.json(+.gz) now carries all 3 (extractor `buildItem` emits them from `f.pri`/FAMS
  index/SECTION_ORDER) → re-ingest safe, no post-ingest re-backfill needed (unlike faceHeightClass/
  faceVariantCore/variantCore, which are still backend-computed backfill-only and NOT in the export).**

- **⭐ `Item.heightCode` — the H-ROW KEY, 2026-07-28, schemaVersion 2.4.0 (audit §K, map §2c-10).** Client:
  "our UI disables lots of H pills, the app doesn't" (BOSSA · Tall→Water→Dishwasher · D58). The app has ONE
  per-unit height key, `u.hc`, and the grid H row is the FAMILY's set of them (`pickHeight(fid,hc)`). We
  stored it ONLY when it was 73/80/86 (`heightClass`), but outside carcase-line families `hc` is the unit's
  **cm HEIGHT** (29, 42, 103, 204, 217…). Two consequences, both fixed: (a) `?heightClass=29` is a 400
  (enum) → every H pill on a housing/support card was a silent no-op; (b) `parameters.height[].sku` is the
  DETAIL panel's VARIANT-scoped target, so it is **null** for every height the current variant lacks (2,560
  pills / 1,188 items — `HGA6029BK` is Ty `BK`, only 29+34 exist) and our `optState` read "no sku ⇒ dead"
  — the app renders them LIVE and `pickHeight` jumps the variant (`HGA6042`). **`heightCode` = raw `u.hc`
  on every unit** (12,048/18,396), dumped FROM the app (`docs/height-code-v781.json`) — NOT inferable from
  `heightMm` (`AT3037Z` is 367 mm, hc 37 not 40). Extractor emits it; `scripts/backfill-height-code.js`
  patched the export (+.gz, meta 2.4.0); D4K-dev backfilled via `backfill-item-fields.js --fields heightCode`.
  API `GET items?heightCode=<n>` — **exact, NOT null-inclusive** (a swap must land on a unit that HAS the
  height); `@Prop`+`UpsertItemDto`+admin field. UI: H picks resolve `familyId+heightCode` (was heightClass),
  grid W/H rows label-routed (`optState(o,caps,byLabel)` → a skuless pill is NOT dead), `markDim` on
  `heightCode ?? heightClass`. `heightClass` keeps its own job (H-bar/LINE pre-select §2c-7, showUnderLine).
  **Client rule: one H rule for all families — `items?familyId&heightCode=<label>&widthMm&groupBy=family`;
  never disable an H pill because `pill.sku` is null; `pill.sku` is DRAWER-only.** Same key fixes a SECOND
  bug found in the pass: W/Ty swaps carried only `heightClass` to "preserve the height" (null outside line
  families) → `T3027Z`+W50 gave `T5093S7` (h93); they now carry `heightCode`, and `swapCardTo` takes a
  RELAX ORDER (W pick relaxes height first and keeps the width; H/Ty relax width first). Verified: full live H rows
  on both reported cards, H42→`HGA6042`, H204→`HGSP552047Z`, line-family `TSP6080B`+H73→`TSP6073B` unchanged.
  **D4K-dev + D4K-prd both backfilled** (12,048 docs each; prd is a data-only write — the deployed prd
  code needs no release, the extra field is inert until the `dev` branch ships).

- **⭐⭐ GRID PARITY — `gridRows` + the membership rules (2026-07-28/29, schemaVersion 2.5.0 → 2.5.2,
  audit §L + §M, map §2c-11/§2c-12).** Client kept reporting the grid diverges from the app, so we built a
  differential harness (`scripts/parity/*` — drives BOTH UIs over a plan of toolbar states, scrapes each
  `#grid`, diffs into 9 buckets) and swept Base·Tall·Wall·Midway. 720 combos → 10 root causes (§L), then a
  second round (§M). **The one big idea: a card's W/H/D/Ty/Line rows come from the FAMILY POOL
  (`ppool`/`hvals`/`wsAtH`/`dAll`/`variantOpts`), NOT from the stored `parameters.*`, which is ONE unit's
  DETAIL panel.** So the backend now ships **`gridRows`** on every family card
  (`design-book.grid-rows.ts`, a line-by-line port of `renderGrid`) and the client RENDERS them —
  `parameters.*` stays the drawer model. Contract inputs, all dumped FROM the app, never re-derived:
  **`unitFacts`** (u.fam/op/_ag/sib/w/dv/vr/d + `heightCodeNull`) and **`familyFacts`** (dim, vlbl, slbl,
  vfmt, cho, byprog, _hasOp, _hasP, noline, _mem, isAccessory, isProgAgnostic, d63Cfg, label/labelGroup/
  isSpecial/variantLabels). Base diffs: ROWSET 402→8, STATE 305→27, PILLS 76→0, FACE 274→79, GREY 123→31.
  **Membership rules that are NOT per-unit filters (§M):** `Item.gridHidden` (57 items — the app's `b.hid`
  families + the 44 codes in no family: recovered artifacts and ItemRef-only stubs; dropped from LISTS,
  still fetchable by sku) · family-level `depthFamOk` (relevance is decided for the FAMILY —
  `if(!depthRelevant(b)) return true` — one depth-less member must not exempt it) · `lineCardOk` HIDES,
  not just greys · **`Item.dupFamilies[]`** (74 items / 79 entries / 40 families) = a code that belongs to
  several visible families gets a CARD IN EACH (`*__CKDUP`/`*__DRWDUP`/`*__SNKDUP`/`*__TRDUP`/`MRG_*` and
  a few shared families); each entry carries its own cat/sub/sec + catalog order + `familyFacts` (50 of 79
  differ), and the grid pipeline expands memberships into rows before the group.
  **Three render rules that cost real diffs:** `u.hc` compares with STRICT `===`, so a literal `null`
  never matches an absent one (4 ANBL units → `heightCodeNull`; it is why ANBL draws no W/D row) and the
  depth row reads `dv || 58` NOT `?? 58` · `dim==='none'` variant chips are a separate branch that emits
  no `wn`/`disabled`, so they stay LIVE on a greyed card · inside a section the app re-sorts by **raw
  `pri` alone**, so a greyed card keeps its catalog position (availability is only the tie-break).
  ⚠️ `catalogRank` is `null` for unnumbered families, NOT 999 — 294 families have a real `pri` above 999.
  Ops: export patched by `scripts/backfill-grid-facts.js` (facts dumped via
  `scripts/parity/extract-grid-facts.js` in the app tab), extractor emits all of it → **re-ingest safe**;
  D4K-dev backfilled (`backfill-item-fields.js --fields unitFacts,familyFacts,gridHidden,dupFamilies`) plus
  the backend-computed `faceWidthMm`. **(⭐ CLOSED 2026-07-30 — prd backfilled AND released; the para
  below is history.)** D4K-prd then owed `unitFacts`/`familyFacts`/`faceWidthMm`/
  `gridHidden`/`dupFamilies` (and, since 2026-07-29, a **STALE `sectionRank`** — it carries the old
  bad capture, so it is wrong rather than merely absent) — commands in
  **`docs/parity-session-handoff-2026-07-29.md` §3** (supersedes the 07-28 §3a).

- **⭐ SWEEP ROUND 3 — section order + the RAW SUB + the v98 sibling swap (2026-07-29 late,
  schemaVersion 2.5.3, audit §N).** Round 2's `grey=false` residue was Base MEMBER 1 · Tall MEMBER 3 /
  SECT 14 / ORDER 6 / PILLS 2 · Wall+Mid MEMBER 6. Four causes, plus two harness traps worth more than
  the fixes: **⚠️ never restart the backend mid-sweep** (Wall+Mid "MEMBER 33/SECT 33" was ~60 states
  hitting a dead server — the API was right all along) and **⚠️ a stale in-process `poolByFamily`
  cache survives an out-of-band backfill** (all 6 Tall ORDER diffs vanished on restart, no code
  change — any script that writes the collection outside ingest/CRUD needs a restart or
  `invalidatePool()`). Also one bad client sample: `Tall|…|progP_BOSSA` dumped with no section headers,
  a scrambled order and a family seen in no other state — re-dump, don't chase.
  **(1) `sectionRank` was captured with the WRONG KEY.** `renderGrid` reads
  `SECTION_ORDER[subDisp(f)]`; the stored rank came from `SECTION_ORDER[f.sub]` (RAW). On Tall those
  differ — `TALL_MERGE` folds `Accessory surround`/`Fillers`/`Back & Side Panels` into
  `Panels, Fillers & Surrounds`, which has its own v433 order — so ranks came off the wrong array
  (Tall End Panels 8 not 0, Rear Panels 10 not 6) and every classify-derived section fell to 999. All
  10 sections of that leaf rendered out of order. Data-only: 78 families / 1,130 items re-captured +
  backfilled (dev) + export patched. The **extractor's formula was already right** — the stale values
  came from the earlier `backfill-section-rank.js` capture. → Tall SECT 14 → 3.
  **(2) `bucketSections` applied the rank unconditionally.** The app consults SECTION_ORDER only when
  the visible set has ONE display sub (`_disp = _subs.size===1 ? … : ''`); a multi-sub task leaf ranks
  everything 999 → first-seen/`pri`. Ported.
  **(3) ⭐ `familyFacts.rawSub` (2.5.3).** `avanceExempt` (and the `sub!=='Modular Units'` arm of the
  v319 programme-tier hide) test the RAW sub; we matched `Item.subcategory` = `subDisp(f)`, so on Tall
  the escape list matched NOTHING and we hid Primo-only families the app keeps (F1730/F342/F343 under
  LAIKA/ROCCA). Matching the display name would over-exempt `Back & Side Panels` (NOT exempt), so the
  raw sub ships. Extractor emits it; export + D4K-dev done; D4K-prd backfilled 2026-07-30 (closed).
  **(4) ⭐ THE v98 SIBLING-FAMILY SWAP IS A MEMBERSHIP RULE.** `visibleBlocks`: with a zone programme,
  a card whose face is in another tier but whose `u.sib` contains the active letter resolves to
  `sibCode(u,fl)` — usually in a DIFFERENT family — and the `b.id` dedupe then collapses the pair into
  ONE card. We rendered both (F115 ⇄ F209 Tall, F93 ⇄ F106 Wall › Corner). Ported as
  `applySiblingFamilySwap`, run where the app runs it (after the face pick, before `av`): card keeps
  the SOURCE's position, takes the TARGET's identity, dedupe by familyId keeping first. **No new
  per-unit data** — `core(u)` is derivable from `sku` + `unitFacts.tier`; `codeLoc` = a sku→family
  index off the cached pool (so `category` joined the pool projection, and `invalidatePool` clears it).
  Verified vs the app: Tall Panels @LAIKA/@ROCCA 28 families each (app 28), Wall › Corner 6 (app 6).
  **Residue left on purpose:** Base MEMBER 1 (`ADD_KSSET_TILTPROTEC__CKDUP` — its unit's `u.fam` is
  the FAMILY ID, not a tier letter, so the app's `tierHas` hides it while our `capabilities.nativeTier`
  is a real `'P'`; fixing means re-touching the thrice-iterated tier gate for one card in one state)
  and Tall PILLS 2 (the app renders `217` TWICE on F1780/F1782 — looks like an app bug, confirm before
  matching it). **⚠️ ALL THREE of those residue diagnoses were WRONG — see round 4.**

- **⭐⭐ SWEEP ROUND 4 — ALL FOUR RESIDUALS FIXED, SWEEP IS ZERO (2026-07-30, audit §O; NO contract
  change, schemaVersion stays 2.5.3 — pure backend logic, nothing to backfill). 720 states ×
  10 buckets × 3 legs = 0 diffs** (`out/report-{Base,Tall,WallMidway}-O3.json`). ⚠️ Scope: the plans
  cover **4 of 14 categories** and never exercise `leafId`/`groupKey`/`zone` (the Design-Tasks sidebar —
  the app's PRIMARY nav, and the only path through `bucketSections`'s new `isTaskView` branch), `q`,
  **`grey=true`**, `opening`, `tallHeight`, `suspended`, `page>1`, or the detail drawer. **Three of
  round 3's four residual diagnoses were WRONG** — each had been written off as "an app quirk / a bad
  sample / not worth the risk" without being reduced to a mechanism, and each was ours. **Follow-up
  (same day, §O4b): the DETAIL endpoint was still serving the frozen `heightExtension`** — O4 derived
  it in `attachGridRows` only, so on those same two families the grid grew a `217+` row and the drawer
  did not. The stamp is now one shared `applyHeightExtension()` called from BOTH `attachGridRows` and
  `getItem` (drawer toolbar = the programme context alone; pool from the same cached `poolByFamily()`;
  face falls back to the item so synthesized P1/C1 siblings answer). All 332 Tall faces, grid vs
  drawer: 0 mismatches. **§O4c closed the field itself: `heightExtension` is ADVISORY.**
  `applyHeightExtension` is its ONLY source — it runs on every item on every read path (before the
  family check) and **DELETES** both fields when the gate fails, instead of serving the stale stored
  payload with `ok:false`. Response invariant: **present ⟺ the chip renders**; `heightExtensionOk` is
  `true` whenever the payload is there (kept only for the shipped `!== false` client test). No data
  change, no schemaVersion bump — the stored field keeps its `@Prop`/DTO/export slot and is simply
  never read; marked ADVISORY in the contract, the extractor's `heightExtensionOf`, crud-guide §4b and
  the admin form. Two leaks it closed: a stale payload + `ok:false` (the lite UI drawer rendered a
  `217+` row the card hid — `H60190GAIZ` @ROCCA 01), and items whose family can't be resolved
  (`gridHidden` artifacts, no `familyFacts`), which the old `continue` skipped entirely.
  Re-ran the Tall leg to measure round 3's un-swept `maxh` fix: **ORDER 6 → 0** confirmed over all 272
  states, every other bucket 0 except the two "residue" items — and re-checking those disproved both:
  1. **`Tall|Panels, Fillers & Surrounds|progP_BOSSA` was NOT a bad client sample.** Re-dumped, it
     reproduces byte-for-byte: 31 cards, ZERO section headers, flat order. MEMBER 1 + SECT 1 were ONE
     bug. `F102` (Tall › Fillers, three C-tier units `COP2027/40/53`, sib `'PC'`) resolves under BOSSA
     to `OP2027` — which lives in **`F224`, `cat:'Wall'`**. So **the v98 swap target can be outside the
     query's result set and in ANOTHER CATEGORY**; the app reads `FAM_BY_ID[loc.fid]` off the whole
     catalog. We skipped the swap when the target wasn't in the result set (a deliberate call), so F102
     survived. Fixed: `fetchSwapTargets` builds the missing target cards with ONE extra unfiltered
     `familyId`-only aggregation (the app takes the whole family), `repickFaces` them, then swap. Two
     details that cost a wrong answer first: the swapped card's face is **the sibling code itself**
     (`b2.units.find(x=>x.c===sc) || selectedUnit(b2)` → `OP2027`, not F224's own face `OP2080`), and
     only the ORIGINAL cards are swap SOURCES (a fetched target is never re-swapped, never enters the
     result on its own). Second half of the same bug: `bucketSections` treated multi-sub as "rank every
     section 999 and bucket anyway", but the app's gate is
     `(_subs.size===1 || state.cat==='__TASK__') && all.some(x=>x.b.sec)` and when it FAILS there is no
     bucketing at all — **no headers and no `pri` re-sort**. F224's unmerged `subDisp` is `'Fillers'`
     (TALL_MERGE is Tall-only), so one Wall card makes the set multi-sub. Ported, with
     `isTaskView(query)` = `leafId ?? groupKey ?? zone` for the `__TASK__` arm. That state now diffs
     **0 in every bucket**. Client rules in map §2b (a headerless `by-section` response is faithful;
     never assert `card.category` equals the filter you sent) + frontend guide R9b/R10a.
  2. **The Base MEMBER 1 patch sketched in the 07-29 handoff §5 is a NO-OP.** `unitFacts.tier` is never
     a family id — extractor and facts backfill both guard with `/^[PCA]$/`
     (`export-v781-extractor2.js:593`, `scripts/backfill-grid-facts.js:83`), as does
     `capabilities.nativeTier` (`:125`). `KSSET`: primary → `tier:"P"`, dup → **`tier:null`,
     `agnostic:false`** — and the proposed clause explicitly passes `tier ∈ [null,'']`. The real gate is
     `tierHas` itself (`tier === letter || agnostic`; tier-less accessories carry `agnostic:true` and
     still pass). The handoff's `$unwind` warning IS confirmed: `familyGroupStages`'s `$set` swaps
     familyId/category/subcategory/section/catalogRank/sectionRank/familyIndex/familyFacts but **not
     `unitFacts`**, and the primary membership object didn't carry it either. **FIXED** (no data change):
     the membership object gains `unitFacts: '$unitFacts'`, the `$set` gains
     `unitFacts: {$ifNull:['$_memberships.unitFacts','$unitFacts']}` (mirrors `poolByFamily`; only 34 of
     74 shared codes diverge; `LIST_OMIT` doesn't drop it), and the programme tier branch becomes
     `$and[capabilities.nativeTier==t, $or[unitFacts.tier==t, unitFacts.agnostic]]` — a no-op for every
     ordinary unit (same `u.fam`, same guard) and decisive only on a dup whose own record diverges,
     since `capabilities` is ALWAYS the primary family's. Verified Base Cooktops @BOSSA → 25 types
     (client 25), dup absent, primary intact.
  3. **The "duplicate `217`" was a HARNESS ARTIFACT over a 2-family data gap.** The app's 5th H pill on
     F1780/F1782 is **`217+`** — the `heightExtension` chip — not a second `217`; `diff.js` compares
     labels through `NUM()` (strip non-digits, `:24`/`:105`), which merged them. Nothing for the client
     to decide. **Ours is the defect:** `attachGridRows` only sets `heightExtensionOk` inside
     `if (c.heightExtension)`, and NO unit of F1780/F1782 carries the field, while their Primo twin
     F1784 has it on all 32. Not tier-scoped (331 A + 338 C units elsewhere have it) — these are the
     ONLY 2 families in 18,396 items that are Tall, hold a `heightCode 217` unit, aren't Appliance
     Housing, and have no `heightExtension`. **Root cause: the field is the wrong SHAPE.** The extractor
     never taps the chip — it reproduces the app's gate and hardcodes the options
     (`HEXT_MM=[[230,2304],[244,2436.5],[250,2500]]`, `extractor2.js:431`), and that gate's
     `available(m)` is TOOLBAR-DEPENDENT while extraction runs in the pristine default (P) toolbar — so
     an all-A/all-C family fails it and gets `null` on every unit. A per-unit frozen field for a
     family-level toolbar-dependent question is what v2's "intrinsic facts, derive the rest" rule exists
     to prevent. **FIXED by deriving** (no backfill / re-ingest / contract change): new
     `heightExtensionFor()` in `design-book.grid-rows.ts` returns the payload from the pool
     (`heightExtensionOk` delegates), and `attachGridRows` stamps both `heightExtension` +
     `heightExtensionOk` per request (it runs after `LIST_OMIT`, so list rows carry it). ⚠️ The
     Appliance-housing exclusion had to move to **`familyFacts.rawSub`** — `Item.subcategory` is
     `subDisp(f)` and spells it BOTH ways (**382 `Appliance housing` + 566 `Appliance Housing`**), so
     the old display-name test missed two thirds; `rawSub` is uniformly `Appliance housing` (946). Same
     rule as §N(3); `rawSub` joined `GridFamilyFacts`. Verified F1780→`AHWSP21756` @LAIKA only,
     F1782→`CHWSP21756` @ROCCA only, F1784 unchanged, Appliance Housing 0/50 → **PILLS 2 → 0**.
     ⚠️ Harness left as-is: prefer the RAW pill label, fall back to `NUM()` only when both sides are
     purely numeric (changing it re-baselines every stored report).

- **⭐ EXTENDED COVERAGE — the other 10 categories, the flags, the task view (2026-07-30, audit §P;
  again NO contract change, schemaVersion stays 2.5.3 — pure backend logic).** §O's zero covered 4 of
  14 categories, so the plans were extended: **1,104 states in five legs** (E1 accessories/alteration/
  handles 264 · E2 the remaining 10 cats 298 · E3 Base/Tall/Wall/Mid at skipped states 200 · F1 the
  toolbar flags 90 · T1 the Design-Tasks sidebar 252). ⚠️ **E1's 56 diffs were a dead backend again**
  (restarted mid-leg — the §N trap); `E1re` on the same plan/data/code = CLEAN. E2's **ROWSET 385** was
  TWO missing rows, both now ported: **(1) the app has two depth rows after the `dim` branch** —
  `dvRowFn(b,u)` (`:5040`/`:2696`, v537) *then* `dRow` (`:5041`), and only `dRow` existed. It fires on
  `dim==='width'` when the face has NO `u.d` (which is why it hid for 4 rounds: the two are mutually
  exclusive, so the families that expose it drew no D row at all), lists the distinct `u.dv` at the
  card's own `u.w` variant-scoped, ≥2, **every pill live and a real sibling** (`pickCardDv`→`blockDv`→
  `selectedUnit` re-faces). 237 diffs; verified `CBSET90581 → [58* 68]`, `CBU29058B → [36 48 58* 68]`.
  **(2) a `Finish` variant row renders with ONE pill** (`:3912` `b.vfin && variantOpts(b).length===1` →
  one chip, `sel`+`disabled`, because the row exists for the colour SWATCH). 140 diffs, 20 Handles
  families. `vfin` is a raw flag we deliberately still DON'T store: it is 1:1 with
  `variantLabel==='Finish'` (53 label-holders, 45 flagged, the only unflagged one `PNL_CLAD` has >1
  variant so it can't reach the branch) and label+single-variant = exactly the 20 in the diff. Re-swept
  the 21 Handles states → **0 in all ten buckets**. Lite UI needed no logic change (its depth handler
  already discriminates on `pill.sku !== it.sku`, `dead` pills already render unclickable) — only the
  swatch on a Finish row + `swatchUrl`'s one special file name (**`405` → `F+405_VS.jpg`**); admin got
  help text on `variantLabel`. **Residue (open):** E2 `Insert` row 8 (`FP_16FRONT` — needs per-unit
  `u.ins`, the one non-logic item) · E2 GREY 12/MEMBER 1/SECT 1 (Alteration @BOSSA/LAIKA/ROCCA) · E3
  ORDER 2 + GREY_NOT_HIDE 1 (E3 **FACE 6 FIXED, §P6: a HARDCODED per-family default width.**
  `_selUnit`'s width tail ends `mw=defaultWidthMin(b); if(mw) preferWidth(…) else sorted[0]` and
  `defaultWidthMin` reads `b.dwm` FIRST. `Panels & surround` matches no category arm → mw 0 → we faced
  the narrowest member `RE305336`; the app sets `f.dwm=90` at `:7583`, in the SAME IIFE that floats
  `RE905336` to `units[0]` — the unshift half we already had as `unitFacts.unitIndex` (why our face was
  53 cm at all), `dwm` is the other half → `preferWidth([30,60,90,120],90)` → `RE905336`. `\bdwm\b`
  occurs 3× in v781: 2 in the function, 1 in that IIFE, and it is init CODE not `<script id="DATA">`, so
  it ships as the `FAM_DWM={RE_SLIDEIN:90}` constant like FORCE_SEC/WIDTH_BUCKETS/ANTOSO_ALLOWC — NO
  data/backfill/contract change; `famFacts()` stamps `familyId` so it can be keyed, and the long-declared
  `familyFacts.defaultWidthMin` (loose Record, never emitted) still wins if an export ever ships it.
  `widthMm=600` still faces `RE605336` — an explicit W outranks the default. E3 re-sweep: FACE 6 → 0) · **F1 120 = our toolbar has filters the app hasn't**
  (**ALL THREE FLAGS NOW FIXED — F1 is 0/10 on every one of its 60 flag states.** **`q` FIXED, §P5: the
  SEARCH BOX IS GLOBAL** — `blockVisible` **returns** on `state.q`, so category/sub/leaf/W/H/D/FRONTS/
  line/ANTOSO are all skipped and a search in Base›Sinks can return a Tall card (app: same 31 families
  for `q=TSP` in all 12 sub states; ours AND-ed the category → 0). `buildItemFilter` now returns a
  REDUCED filter when `q` is set: the match + only what sits ABOVE the app's return — the v319 programme
  tier gate (hoisted to a local; the FRONTS-chip gate is below the line, dropped) and the byprog/ppool
  hide (post-group, unchanged) — plus the API-only active/kind/sku. Match = **sku OR
  `familyFacts.label`**, NOT unit `name` (a superset the app never searches), and `toe kick`/`toe-kick`
  → `plinth`. 24 q states → 0/10, SECT/ORDER included (the §O2 multi-sub gate already emits no headers).
  Backend not UI, deliberately: this is what the endpoint's `q` MEANS, so the React client gets it free ·
  **`suspended` FIXED, §P4: "no app counterpart" was WRONG. SUSPENDED **IS**
  ANTOSO (`setSusp(on){state.susp=!!on; state.antoso=!!on}` `:5059`; `toggleAntoso` calls it), and
  `state.susp` alone is display-only — the plan drove `susp` without `antoso`, so the client dumped a
  base grid and measured nothing (Base›Accessories&Surround: 20 cards → 5 with antoso). Three
  behaviours: the `antosoOk` GATE (already ported, just had no param), the Base/Tall-only HIDE
  (`blockVisible`'s clause + `ANTOSO_ALLOWC`/`ALLOWS` allow-list, Wall/Midway never hidden →
  `antosoFamOk`), and the v671 RE-FACE onto the approved variant (`faceUnit`, before the Fronts twin
  swap). ⚠️ TWO forms of the envelope: `capabilities.antosoApproved` is `antosoU(u,cat,'')` — EMPTY sub,
  so a sink's depth ceiling is 58 — while the hide/re-face pass the REAL sub (62 for sinks); stored flag
  = gate, live `antosoU` = the other two. New `antoso` bool param (the lite UI's Suspended switch sends
  it; `suspended` stays an API-only engineering-flag filter, no control sends it). 12 susp states →
  0/10 buckets** · **`opening` FIXED, §P3: it was `$and
  availableTiers`, which hid 17/17 Base›Accessories&Surround families at P1. `state.open` is a TOOLBAR
  input — `openOk` greys, `ppool` re-faces, `assemble` prefixes the CODE — and the only hide it owns is
  `blockVisible`'s `if(b.byprog && !ppool(b).length)`, ported as `openFamilyOk` OUTSIDE the grey
  early-return. Provable no-op without an opening (all 241 byProgramme families have an `opening:null`
  unit), so no re-sweep; 7-state control clean. ⚠️ `capabilities.openP1` is the WIDER `openOk` form
  (`!!u.P1 || sku.startsWith('P1')`) so it is true on the P1 ARTICLE too — the code prefix must guard on
  `unitFacts.opening` or you get `P1P1GFV6080SM`. All 24 open states → 0/10 buckets**) · **T1 144 = §O5's
  per-membership `functionalGroups`** (extractor+export+contract+backfill, deferred by decision).
  Still un-swept: `grey=true`, `page>1`, the detail drawer.

- **⭐ §Q — TWO MORE OFF THE §P RESIDUE (2026-07-30 late; pure backend logic, schemaVersion stays
  2.5.3).** **(1) `RE_SLIDEIN` FACE 6 (E3, all 6 states) — a HARDCODED per-family default width.**
  `_selUnit`'s width tail is `mw=defaultWidthMin(b); if(mw) preferWidth(…) else sorted[0]`, and
  `defaultWidthMin` reads `b.dwm` FIRST. `Panels & surround` matches no category arm → mw 0 → we faced
  the narrowest member `RE305336`; the app sets `f.dwm=90` at `:7583`, in the SAME IIFE that floats
  `RE905336` to `units[0]` — the unshift half we already had as `unitFacts.unitIndex`, `dwm` is the
  other half. `\bdwm\b` occurs 3× in v781 (2 in the function, 1 in that IIFE) and it is init CODE, not
  `<script id="DATA">`, so it ships as `FAM_DWM={RE_SLIDEIN:90}` like FORCE_SEC/WIDTH_BUCKETS;
  `famFacts()` stamps `familyId` so it can be keyed, and `familyFacts.defaultWidthMin` (declared since
  the port, never emitted) still wins if an export ships it. `widthMm=600` still faces `RE605336` — an
  explicit W outranks the default. E3 re-sweep: **FACE 6 → 0**, every other bucket byte-identical.
  **(2) `isFrmatFamily` was read as a BLANKET exclusion; it is a QUALIFIER (E3 GREY 2 + ORDER 2).**
  App: `if(u.c==='FRMAT' && !frmatKey(PROG_BY_KEY[pk].n)) return false` — FRMAT is dead only where the
  programme NAME has no row in `FRMAT_MAX` (ch.71.18). Ours (and the CONTRACT's reference port, which
  is where it came from) had `!c.excludedPrograms.includes(k) && !c.isFrmatFamily`, killing all 120.
  Measured: `excludedPrograms` already covers 111; **exactly 9** are size-table-only (SELVA 218,
  KYOTO 272, VALAIS 283, STONE 294, SELVA-A 418, STONE-A 494, SELVA-C 718, VALAIS-C 783, STONE-C 794),
  and 2 (BAHIA 250/750) are excluded for another reason WHILE having a row — so neither the flag nor
  the list can replace the other. Ported as `FRMAT_DEAD_PROGRAMS`; the clause is now
  `!(c.isFrmatFamily && FRMAT_DEAD_PROGRAMS.has(k))`. ⚠️ **The client's `availableFromCaps` has the
  same bug** — the snippets in `export-schema-v2.ts` and crud-guide §3 carried the blanket form (the
  contract's prose one line above said the right thing); both fixed, frontend guide row 7 tells the
  client to patch it. Verified: Surround @BOSSA → `F69·F124·F263` all live, the client's exact order
  (F124/F263 share catalogRank 7118, so the grey was the tie-break → the ORDER diff); @LAIKA live,
  @KYOTO dead, @ROCCA dead via excludedPrograms. **GREY 2 → 0, ORDER 2 → 0** (hand-verified; the
  confirming E3 re-sweep is task 1 in `docs/parity-session-handoff-2026-07-30.md`).
  **(3) `famOkB` exempts the whole `Alteration` CATEGORY (E2 GREY 12).** App:
  `famOkB(b,letter) = !letter || b.cat==='Alteration' || b._mem.includes(letter)` — the category escape
  is unconditional. Our port had only the `_mem` half plus a comment claiming `isAccessory` covered it;
  it does not — `MPOSKE`/`MPEKE`/`FRAUSR`/`FRAUSRH`/`MPOT`/`MPEZS`/`MPHVERLVE` are `isAccessory:false`,
  `isProgrammeAgnostic:false`, `memberTiers:'P'`, so all 12 greyed under LAIKA/ROCCA. `famOkU` was never
  the blocker (every one is `unitFacts.agnostic`). One clause added. Regression-checked: Base›Sinks
  @LAIKA still greys 8 cards (alteration codes whose CARD is a Base family — the app tests `b.cat`, the
  family's, which is what we read). **E2 GREY 12 → 0.**
  **Residue: E2** ROWSET 8 (`FP_16FRONT` `Insert`, needs per-unit `u.ins`) + MEMBER 1/SECT 1
  (`Side Panel Modifications`@BOSSA `PNL_ACC` vs `PS_WAUKS_RECESS` — a swap/split, not a gate);
  **E3** MEMBER 3 + GREY_NOT_HIDE 1, three single-family cases that look like variant-family splits
  (`XAG_Pa_a989a3`, `CURVED_*_M`, `PPM3234`).
  **⭐ FULLY RELEASED TO PRD 2026-07-30.** Two passes: PR #2973/#2974 landed at `f61942d8` and left the
  last three commits behind; PR #2975 (`dev`→`staging`) + #2976 (`staging`→`main`) closed it —
  `origin/main` @ `54c2af2e`, `git log origin/main..origin/dev` empty, both `f59ea0af` (§Q1) and
  `b8169728` (§Q3) ancestors of main. Both merges dry-run clean in a throwaway worktree first; net
  effect on main = 2 files (grid-rows.ts, service.ts); `src/project/room.service.ts` differs but is
  MAIN-side only (dev never touched it since the merge-base) so the merge preserved it. **Code and data
  now level on both clusters; nothing owed** — every fix from §O2 on is backend logic, so the ledger
  never moved. If prd deploys from main via CI, confirm the rollout with the two curls in
  `docs/parity-session-handoff-2026-07-30.md` §3. ~~Both §Q fixes are hand-verified, not swept~~ —
  **✅ both measured 2026-07-31, see §R.**

- **⭐⭐ §R — TASK 1 MEASURED; E2 IS NINE BUCKETS AT ZERO (2026-07-31, audit §R; pure backend logic,
  schemaVersion stays 2.5.3, nothing to backfill).** Re-ran both legs. **§Q1 confirmed** (E3
  `GREY 2→0`, `ORDER 2→0`, 200 states) and **§Q3 confirmed** (E2 `GREY 12→0`, 298 states). Two MORE
  causes surfaced in the same pass, both fixed (backend `dev` @ **`470c8003`**, rebased onto an
  unrelated `src/project/contract.*` push):
  **(1) `lineCardOk` read the STORED height where the app DERIVES it.** The app says so itself (v93):
  *"Many tall units carry no hc (height lives in the code/H mm) — derive the code from H mm"*, ±8 mm
  over `TALLC`. A family whose tall height exists only as `heightMm` yielded no system heights, fell
  through to the permissive `return true`, and was never hidden at a line it has nothing at —
  `PPM3234` (190, 80-system) and `XAG_Pa_a989a3` (146) survived at line 73 while their own 73-system
  siblings correctly stayed. **`tallHC` was already ported in `design-book.grid-rows.ts` and simply
  wasn't called** — the second time this session a helper existed and the call site read the raw
  field (cf. §O4-2). Pilasters 7→6, Wall Cladding 2→1. **E3 MEMBER 3 → 1.**
  **(2) a dup membership wore the PRIMARY's `category`.** `poolByFamily` already gives each dup its
  own `unitFacts` (§O4-2); `category` is the same bug and is load-bearing, because `locateFamily`
  (our `codeLoc`) breaks ties by *"the family in the CURRENT category"* — with both memberships
  reporting the same one, that degraded to **Map insertion order**. `WFAUKS` @BOSSA is tier `A`,
  sib `'PA'`, and its sku doesn't start with A/C, so the v98 sibling code is **itself**: the app
  resolves to its own family `PNL_ACC` and does NOT swap; we resolved to the dup `PS_WAUKS_RECESS`,
  swapped, dragged in a foreign sub, and lost the section header (§O2). **E2 MEMBER 1 + SECT 1 → 0.**
  **⚠️ §R4 — the LAST E3 diff is an APP BUG; do not match it.** `Side panels W|progP_BOSSA`: the init
  code runs `splitFam('CURVED_*')` then **splices `XCRV_WF5R`/`WF15R`/`WFI5R`/`WFI15R` out of `FAMS`**
  — but `CODE_INDEX` (byte 16,499,634) and `FAM_BY_ID` (16,604,814) are both built BEFORE the splice
  (16,675,665), so `codeLoc` still resolves `WF5R36` to a family `FAMS` no longer has and the app
  renders it. The codes rendered are identical on both sides and the two agree in every other state.
  Our export is post-init and correctly has no `XCRV_*` at all, so matching it would mean re-adding
  deleted families. Left alone, like §O4-3's duplicate `217`.
  **Where both legs stand: E2 = 9 buckets at ZERO** (298 states; only `ROWSET 8`, all `FP_16FRONT`,
  the one genuine DATA gap needing per-unit `u.ins` — **✅ CLOSED, see §S below**). **E3 = one state,
  and it is §R4.**
  **⚠️ NEW un-swept gap recorded, deliberately NOT patched:** `lineCardOk` is missing the app's
  **v376 Avance line-80 lock** (`if(state.progMap && (activeFamFor('Base')==='A'||activeFamFor('Tall')
  ==='A') && state.line==='80' && activeFamFor(b.cat)!=='A') return true;`) and **no plan state
  anywhere combines line 80 with a programme** — exactly one `line=80` state exists and it carries no
  programme. Add the state and MEASURE before porting.

- **⭐⭐ CURRENT HANDOFF: `docs/parity-session-handoff-2026-07-31.md`** — supersedes the 07-28/29/30
  files (kept as history). It carries the live task board, the data ledger for BOTH clusters, the
  **six** sanity curls (the last two are §U's; all of them are now also
  `D4K-backend/scripts/check-face-pins.js`), and eleven traps. **Board as of 2026-08-06: its top three
  items are CLOSED** — the backend release (`origin/main..dev` empty @ `1407f197` after §U), the
  frontend follow-up PRs (#2329 + #2330 merged), and the stale `schemaVersion` (both clusters
  `2.5.4`). **Top of the board now: open the last frontend PR** (`8016d2c7`, the Line row + force68
  63 — its backend half is already released), then task 4 (`functionalGroups` per membership) and
  task 5 (the un-swept v376 Avance line-80 lock).

- **⭐ §S — THE `Insert` ROW; E2 IS TEN BUCKETS AT ZERO (2026-07-31, audit §S, map §2c-11,
  schemaVersion **2.5.4** — the FIRST contract change since 2.5.3, additive).** The last non-app-bug
  diff in either leg: E2 `ROWSET 8`, all `FP_16FRONT`, client `[Insert, Ty, W]` vs our `[Ty, W]`.
  The app has **three** `u.ins` call sites, not one: `_selUnit` `:2673` (`pool=insPool(b,pool)` — the
  FACE is picked inside the chosen insert), `renderGrid` `:5006` (`_src` — so the **W row retargets**,
  `20 → ZIGSUV20U` under M8) and `:5042` (the row itself, LAST, after `Ty`). Chips carry neither `wn`
  nor `disabled` — every pill LIVE, only the picked one `sel` — and unlike the depth STATE row each
  lands on a **real stored sibling** (`ZIGSUV20` ↔ `ZIGSUV20U`), so a click is an ordinary sku swap.
  **Only `u.ins` ships (`UnitFacts.insert`); `insAx` is DERIVED** — in v781 the flag is 1:1 with "a
  member carries `ins`" (one family both ways: `FP_16FRONT`, 92 units, `L3/M3` vs `M8`), and
  `scripts/backfill-insert-axis.js` **asserts** that and exits non-zero if a future catalog breaks it
  (the moment to store `FamilyFacts.insertAxis`). Same call as `vfin` (§P). **Stateless `selIns`: the
  FACE answers it** — `_selUnit` pools by it, so the face's own `ins` IS the picked one; verified
  round-trip `GET items?sku=ZIGSUV90U` → `Insert: L3/M3, M8*` + a W row on the `…U` skus.
  **Data:** `u.ins` is a RAW per-unit field init never rewrites (`FP_16FRONT`'s only touch is
  `move()`), so the backfill reads `<script id="DATA">` directly — **no parity run, no browser**.
  Extractor emits it (`_unitFacts`), facts dumper + `backfill-grid-facts.js` carry it → re-extract and
  re-ingest safe. Export + `.gz` patched (meta 2.5.4); **D4K-dev backfilled** (92 docs, via
  `backfill-item-fields.js --fields unitFacts`). **D4K-prd backfilled too** (2026-07-31, same 92 docs,
  re-run reports 0 differ; data-only, inert until `dev` ships — the deployed prd code never reads it).
  ⚠️ Use `MONGO_URI_OVERRIDE=<uri> node scripts/backfill-item-fields.js …` for a prd write — `.env`
  stays on D4K-dev, so nothing is left pointing at prod afterwards.
  **⭐ THE ROW IS CARD STATE — two new query params, and only the browser found that.** The row got
  its own **`kind:"insert"`** (NOT `variant`: both pills share one `variantCore`, so that route
  returns the card you are on), plus **`insert`** (= the app's `blockIns`) and **`variantCode`**
  (= `blockVr`, the Ty pick as `u.vr`). Why each: (1) deriving `selIns` from the FACE works only for
  a fetch by sku — a family-scoped swap has no face until `_selUnit` has run, so
  `variantCore=ZIGSUVU&groupBy=family` came back `ZIGSUV90`; (2) the app keeps `blockIns` across
  `pickWidth`/`pickType`, so both params ride on EVERY swap of an insert-family card or the next pick
  resets it; (3) `variantCore` encodes the insert too (`ZIGZUV` = L3/M3 pullout, `ZIGZUVU` = M8), so
  pairing it with `insert` matches nothing and a Ty pick did nothing. Client scopes both to cards
  that HAVE an insert row → every other card's query is byte-identical (checked on the wire).
  **Verification:** the grid change is a strict no-op outside the 92 units (`insList().length` gates
  the row, `selIns()` is null elsewhere so `insPool` is identity), the app has exactly TWO row
  signatures for this family over all 8 states (7 × face `ZIGSUV90`, 1 × `ZIGSUV60` at `w60`) and the
  API reproduces both byte-for-byte with `cardAvailable` unchanged; the INTERACTION was then driven
  in the real React client — `ZIGSUV90 → M8 → W20 → Pullout → L3/M3 → M8 → W60 → Drawer` walks
  `ZIGSUV90U · ZIGSUV20U · ZIGZUV20U · ZIGZUV20 · ZIGZUV20U · ZIGZUV60U · ZIGSUV60U`, all 8 the app's
  answer. ⚠️ Traps hit: a stale `next dev` on :3000 served pre-fix code (the §N restart trap AGAIN),
  and FIVE buttons on that page read "M8" — four are `Ty` pills on other cards, so scope a pill
  lookup to its ROW (`span[title="Insert"]`), never to its label.

- **⭐⭐ §T — THE PILL CLICKS (2026-07-31 late, audit §T, map §2c-13, client guide R11–R15; three
  backend commits, NO contract change, schemaVersion stays 2.5.4, nothing to backfill).** The
  sweeps compare RENDERED GRIDS, so every one of these survived four zero-diff rounds: the rows were
  right and the CLICKS were wrong. Found by a client report ("depth pill clicks do nothing, on both
  the lite UI and the React client") and then by comparing pill taps one by one against the app.
  1. **`repickFaces` was discarding every unit-level PIN a swap query carries** (`66e47346`) — the
     worst of the three. The face is re-picked in JS from the WHOLE family pool against the
     `GridToolbar` alone, and that object carries `widthMm`/`depth`/`insert`/`variantCode` but **not
     `heightCode`, `variantCore` or `sku`** — so the pipeline matched the right sibling and the
     re-face put the family default straight back. **Every grid H pill and every Ty pill was inert.**
     It regressed the map's OWN §2c-10 examples (`familyId=SNK2&heightCode=73&widthMm=600` answered
     `TSP6080B` not `TSP6073B`; `familyId=F674&heightCode=42` answered `HGA6029BK` not `HGA6042`) and
     §S's round-trip (`sku=ZIGSUV90U&groupBy=family` → `ZIGSUV90`, so the wrong Insert pill read
     selected). Dates from **§L**, which introduced the re-face; §K had verified all of them working
     BEFORE it. `pinFacePool` now narrows the FACE pool only (the row builder still needs the whole
     family, §L) and falls back to it when nothing matches, so the client's relax chain is unchanged.
     `q` is deliberately NOT a pin (§P5). ⚠️ `widthMm` only ever escaped because `gridToolbar()`
     happens to carry it, and insert/variantCode because §S had added them for this exact reason.
  2. **The `63` chip is `pickDepth63`, not `pickCardDepth`** (`c82543fb`) — five of six taps matched
     on Base › Water › Sink Cabinets, `D 63` did not (app `TSP6073 → TSP607368`, we stayed put and the
     click looked dead). The chip is its OWN control (`:4926`/`:5000`), and `d63Cfg` returns
     `{mode:'sink',force68:true}` for Base › Sinks → `pickDepth63` sets `blockSel[id].d=68`, re-facing
     onto the d68 twin. **So 63 is NAVIGATION on a force68 family and STATE everywhere else.** Both of
     our depth-row builders targeted `face` unconditionally; the one that actually fires for these
     cards is the `hd`/`dAll`/`show63` branch, NOT the `dRow` alteration branch
     (`unitFacts.depthAlterations` is null on `TSP6073`), so both were fixed — the app applies the
     rule at both of its call sites too. Twin resolved the app's way (`:2812`). `familyFacts.depth63`
     was already stored and correct. Whole-grid signature for that state unchanged (18 cards, 5
     sections, len 1335) — only the pill's TARGET moved, not its label or selected state.
  3. **`d63NoClick`, the `Line` row, and the local depth pick** (`59a7e09f`). `d63NoClick`: a family
     whose label matches `/appliance door/i` renders its 63 chip as `.d63off` — greyed, no handler, no
     target — while `d63Cfg` still returns a config, so the chip EXISTS and is simply dead
     (`sku:null`/`off:true`/`dead:true`; 7 families / 68 units — `F1230`, `F1230_E`, `F1231__GF0..GF3`,
     `XGFRWINE`). The **`Line` row was rendered but inert**: it is CARD state, not navigation —
     `pickSys` writes `blockSel[id].sys` (73/80) + `cardMod[id].dl` (86→`J`, 66→`Y`) and `pickFE`
     toggles `cardMod[id].fe` (`E`) — so a new **`cardLine`** param (73|80|86|66) carries the app's
     effLine per card, `cardSys`/`effLine`/`cardDoorLine` derive the halves, `lineHFilter` collapses
     the H row, and `selected` follows the app's own rule (a TOOLBAR line 86 still marks `73`, a
     per-card J marks `86 · J`); a request `lineState`/`line` wins, as in the app. ⚠️ Only the 86/66
     chips clear `E` (`pickSys` writes `fe:0` in those two arms alone), so `73 → E → 80` keeps it.
     Third: **the D STATE row never re-rendered the local pick** in EITHER UI — both render the
     server's `pill.selected`, baked from the toolbar depth, so `pickCardDepth`/`setDepthPick` moved a
     value nothing drew (on `TSP6080` both `58` and `63` target self AND carry no re-cut `code`, so
     those two pills changed nothing at all on screen). The local pick now owns the SELF pills,
     sibling pills keep the server's answer, and the click guard reads the same overridden value so
     the previously-selected pill becomes clickable again. **No stored field, no backfill, no contract
     change** — `cardLine` is card state and `d63NoClick` reads `familyFacts.label` (which the admin
     form now documents). Verified on `F1230`: `73 → 86 → E → 80` walks `GF61204 → GF61210 →
     GF61210 → GF61210E → GF61204E`, H row `[204,217] ↔ [210,224]`, identical both sides.
  Lite UI got all three (it also applies `assemble()`'s Y-replaces/+E/+J to the displayed code, drops
  its stand-in door-line row when the server ships a real one, and sends `depthClass=63` on a force68
  swap so 63 stays lit). ⚠️ A third lite-UI bug in `66e47346`: it routed a `gridRows` Ty pill by
  `pill.sku`, which never preserves the card's H/W (`TSPA8073TZW`'s TZ pill points at `TSPA908068TZ`)
  — the legacy `parameters.options` path already resolved this through the target's `variantCore`, so
  that resolver is now a shared **`variantSwap()`** used by both row paths and they cannot drift again
  (cards with an Insert row keep the plain sku swap — the stem encodes the insert, §2c-11).
  **⭐ RELEASED: `git log origin/main..dev` is EMPTY, `origin/main` @ `7ca4bc44` (PR #2982 from
  staging).** Handoff task 1 is closed; both clusters are level on code AND data.

- **⭐⭐ §U — THE VARIANT PICK: `variantCore` IS NOT AN IDENTITY (2026-08-06, audit §U, map §2c-8 +
  §2c-13e, client guide R16; one backend commit + one client commit, NO contract change,
  schemaVersion stays 2.5.4, nothing to backfill).** Client report: "the handle colour swatch pills
  don't click in our frontend, they work in the v781 HTML" (More Categories › Handles, `ZGR533032`).
  Same shape as §T and invisible to the sweeps for the same reason — **the ROW was right, the CLICK
  was wrong.** Three causes, in the order they surfaced:
  1. **The client routed a `kind:"variant"` pick by `variantCore`, which is a code STEM and is
     DEGENERATE on whole families.** All 20 members of `HDL_MBH_533` (`ZGR533032`…`ZGR533307`) carry
     `variantCore:"ZGR"`, so `familyId+variantCore` resolved to the family FACE — the card already on
     screen — and because a family-scoped query never comes back empty the relax chain stopped there
     and the `sku:[…]` last resort never fired. Dead click, no error, nothing on the wire. **Not a
     handle quirk:** `XMOD_MU_80_Z` Ty `Z2`, `XMOD_MU_80_SZ` `SZ`/`SZ2`/`S2Z2`, `F67` Ty `2`,
     `F1102__N12` `DZ` and every Handles `Length`/`Orientation`/`Finish` row were inert too. Fix:
     route by **`variantCode`** = the app's own `u.vr`/`blockVr`, which `pill.value` already IS; the
     row's pills come from the same `variantOpts` the server faces on, so it always resolves, and
     `selected` comes off the face (the old `variantCore == card's` test is retired). A variant click
     no longer reads the `refs` map at all.
  2. **The backend's face pins were a FLAT filter chain, so the HEIGHT outranked the picked VARIANT.**
     `pinFacePool` filtered by the `heightCode` a swap carries to preserve the card's height (§K)
     before the variant was considered — the app's `_selUnit` order inverted, since it filters the
     pool by `blockVr` FIRST and only then treats the height as a preference (so a Ty pill whose
     variant lives at another height MOVES the height). `familyId=XAG_Sp_72ec18__N1&heightCode=154&
     variantCode=KSZIZ` answered `AHG601546SZ2`, the card the client was on, because h154 has no
     KSZIZ unit. Pins are now **RANKED `sku > variantCode > variantCore > heightCode`**, and one that
     would empty the pool is dropped **on its own** instead of taking the others with it (the old
     code fell back to the whole family and lost every pin at once). `variantCode` joined `FacePins`
     — it was already a toolbar input via `selVr`, but only a pin can outrank the height.
  3. **`variantCode` is CARD STATE and must ride on EVERY swap**, not only insert-family cards. It
     had been scoped there on the theory that `faceVariantCore` preserves the variant elsewhere; that
     rank is a tie-break and loses to the height pin. Driven in the app itself
     (`pickVariant('F344','FSUEL'); pickHeight('F344',73)` → **`FSUEL7334`**, both chips lit), ours
     answered `FS7334` — every H and W pick was silently dropping the Ty.
  **Verification:** `D4K-backend/scripts/check-face-pins.js` (NEW — 6 assertions: the ranked-pin case,
  map §2c-10's two examples, §S's sku round-trip, a Finish pick; exits non-zero on any miss) · **171
  old-route-vs-new-route comparisons** over Base/Tall/Wall/Handles → 112 answers changed, **every one
  onto the pill's own target or a dimension-preserving sibling, 0 regressions** · in the browser
  `ZGR533032→277`, `ZGR411405→418`, `ZGR306415→7415`, and `FS8034 → FSUEL → H73 → FSUEL7334` matching
  the app chip for chip. Lite UI needed nothing (§T's shared `variantSwap()` already covers it).
  **⭐ RELEASED:** backend `243df0c3` → PR #3000 (dev→staging) → PR #3001 (staging→main),
  `origin/main` @ **`1407f197`**, `origin/main..dev` empty; client `new-design-v2` @ **`28ac1192`**.
  ⚠️ **The lesson, twice in a week:** a key that only LOOKS like an identity (`variantCore` for a Ty
  pick, `pill.sku` for a depth pick) renders a perfect row and a dead click. When adding a row, write
  down which app variable the click WRITES (`blockVr`, `blockIns`, `blockSel[id].sys`,
  `blockSel[id].d`) and carry that value as card state on every later request — a value the app keeps
  and we drop is a bug no grid diff can see.

- **⭐⭐ LIO — the catalog ASSISTANT, first cut built + driven end to end (2026-08-10). NO contract
  change, schemaVersion stays 2.5.4, nothing to backfill; ONE new API filter (`sinkSizeInch`).**
  Spec + status: **`docs/lio-agent-requirements.md`**; client contract: **map §10 + §11**. Code is on
  D4K-backend branch **`feat/design-book-lio-agent`** (cut from `dev` @ `ff4f3b3f`), **not released**.
  **ONE endpoint answers every question** — `POST /design-book/lio/ask`; "show all cooktop units in
  80 cm" and "why is Avance unavailable?" are the same call and the agent classifies the question
  itself (no mode flag, no second endpoint). Async job + poll (Heroku's 30 s router), job state in
  Mongo, one document = the job + the R9 exchange record + the flag. Plain OpenAI SDK, Responses API,
  6 tools, terminal `answer` tool. New: `src/design-book/lio/*`, `GET items/:sku/availability`
  (the reason API, map §10), `unitGates()`/`cardGates()` in `design-book.grid-rows.ts`.
  **The catalog rules are NOT re-derived by the model** — availability comes from the gate functions,
  rows/membership from the grid; the model turns language into API calls and results into prose.
  **Two guarantees are enforced in CODE, not by the prompt** (`applyAnswer`): the agent's `filters`
  are validated against `QueryItemsDto` and **re-executed by us** (`resultSummary` is OUR run, never
  the model's claim; an invalid set bounces back with the validation errors for one repair round),
  and every code-shaped token in the answer is checked against the collection (non-negotiable 2).
  Read-only is structural: every tool routes to a `GET`-shaped service method, so no prompt can
  reach a write.
  **⭐ FOUR DEFECTS FOUND BY DRIVING IT — three were OURS, and none was visible from reading the
  code.** A benchmark that runs the real endpoint (`scripts/compare-lio-models.js`, the six canned
  panel prompts) found all of them:
  1. **A model that researches past its budget lost a turn it had already solved.** gpt-4.1 read the
     availability reason on round 0, then spent all 8 rounds hunting an alternative programme, and
     the loop turned that into a hard failure. The LAST round now forces
     `tool_choice: {type:'function', name:'answer'}`. 13/16 → 16/16.
  2. **A reasoning-only round was treated as fatal.** The gpt-5 family routinely returns a round
     carrying a reasoning item and NO call and NO text; the loop threw "the assistant returned
     nothing" on a turn whose search had already succeeded. It now carries that output forward and
     continues, bounded by the round budget + (1). gpt-5.4-mini 12/16 → 16/16.
  3. **⭐ "Find a sink cabinet for a 36 inch sink" — one of the six SHIPPED prompts — was
     CONFIDENTLY WRONG.** It answered "13 types at 900 mm, the closest standard width", because
     `sinkFitment` was on the item but there was no way to SEARCH it, so the model converted inches
     to millimetres. The catalog states fitment itself and it does not track width that way: a
     **900 mm sink cabinet takes a 33″ sink; 36″ starts at 1000 mm** (350 units / 11 types have
     `sinkFitment.maxSinkSizeInch >= 36`). Fixed at the root with **`GET items?sinkSizeInch=NN`**
     (`>= NN`, not null-inclusive; `QueryItemsDto` + `buildItemFilter`, additive) and the same
     warning in the tool schema. ⚠️ **The lesson: when the model has no tool for a question it will
     not say "I can't" — it will find a plausible substitute and state it as fact.** Every canned
     prompt needs a tool that answers it EXACTLY; a near-miss axis is worse than a missing one.
  4. **Prompt caching was defeated by our own prompt.** The volatile toolbar/focus/curated pairs were
     interpolated into `instructions`, so the prefix changed every request and a turn re-sends the
     whole conversation up to 8 times. `LIO_SYSTEM_PROMPT` is now a CONSTANT and the volatile half
     moved into the user message (`lioContextBlock`) — measured **50-90 % of input tokens served
     from cache**.
  **Model: `gpt-5.5`** (env `OPENAI_LIO_MODEL`, `OPENAI_LIO_REASONING_EFFORT` default `low`).
  Measured, not guessed: gpt-4o · gpt-4.1 · gpt-5.4-mini · gpt-5.5 · gpt-5.6-sol all scored 16/16
  once (1) and (2) were fixed, so the suite does not separate them; at ~10-13 k input tokens a turn,
  mostly cached, cost is of the order of a cent, so quality wins over a mini. `gpt-5.4-mini` is the
  switch if volume ever changes that. Every exchange stores the `model` that answered → A/B is a
  config flip. ⚠️ **`OPENAI_API_KEY` was already in `.env`** (unused by TS before this).
  **Verified live on D4K-dev:** all six panel prompts in the panel's own toolbar state (8 runs,
  26/26) · the R8/R9 teach loop end to end (flag → admin queue → correction → the SAME question now
  answers with the taught wording) · PDFs (the 1,033-page price book refused; a 13-page PDF read as
  PAGE IMAGES, and the code it found was looked up in the LIVE catalog rather than repeated).
  **Regression evidence that the grid is untouched:** `scripts/check-grid-gates.js` re-states the
  pre-refactor `unitAvailable`/`cardAvailable` as an oracle — **identical over 77,760 + 51,840
  combinations**; `scripts/check-lio.js` (filter whitelist · invented-code guard · PDF page count);
  `check-face-pins.js` 6/6. The `design-book.service.ts` diff is **302 insertions / 0 deletions**.
  ⚠️ **Traps for the next session:** `tier:"ALL"` is NOT an API value — FRONTS All / H All mean OMIT
  the axis, and the client's `context` must follow that · the accessories prompt answers with
  `itemSkus` + `filters:null` (R3's fixed-handful exception), so a client that only re-runs
  `filters` renders nothing for it · with `groupBy=family` a `sinkSizeInch` card FACES its default
  width (600 mm) while the fitting member is the 1000 mm sibling — membership-vs-face, §I ·
  **port 8000 already had a server on it** (someone else's), so the whole session ran on 8001 ·
  the comparison runner passes its label as `OPENAI_LIO_MODEL`, so a label that is not a model id
  scores 0/16 (that is the harness lying, not the agent) · a benchmark case must have ONE right
  answer — "find all TALL dishwasher fronts" was dropped because the catalog has BOTH `b_water#2`
  (Base › Dishwasher Fronts) and `t_water#0` (Tall › Dishwasher), so a model that asked to broaden
  was right and the test was wrong.
  **Not built (by decision):** streaming (D5 — poll ships first; keep generation behind the one
  service method so SSE is a controller change) and rate limits / budgets (D6 — per-turn token usage
  IS recorded on every exchange, so a limit can be set later from real numbers).

- **⭐⭐ Deactivated items still showed in the Design Book (2026-08-21) — REAL bug, shipped to `main`
  as `db7bb872` / PRs #3042→#3043→#3044.** Client deactivated `HSSCUS` (Sensor switch); it moved to the
  admin **Inactive** tab and its card stayed on the CONTROL & SWITCH shelf.
  `buildItemFilter` (`design-book.service.ts:2671`) read `if (query.active !== undefined) filter.active
  = query.active;` — filter applied ONLY when the caller named a state. The admin table always names one
  (that IS its Active/Inactive tabs, which is why that screen looked right); no catalogue caller does,
  and the frontend sends no `active` at all, so the grid ran unfiltered. Now `filter.active =
  query.active ?? true`. All three list paths share `buildItemFilter`, so one line covers `GET items`,
  `items/by-section` and the family pool.
  ⚠️ **One sibling does NOT route through it** — the "More categories" badge recount in
  `getFunctionalCategories()` was deliberately written to match the old unfiltered behaviour. Fixed in
  the same commit (`active: { $ne: false }`), else the badge counts what the shelf no longer shows.
  ⚠️ **`GET items` caps `limit` server-side.** The first version of `scripts/check-inactive-hidden.js`
  scanned pages with `limit=2000`, got 0 rows back, and printed **OK against the broken build**. Any
  check that pages is a check that can pass vacuously — the rewrite asserts one sku at a time.
  ⚠️ **An import switches deactivated items back ON** — `normalizeItemDoc` writes `active: item.active
  !== false` and clears `deactivatedAt`; export files carry no per-item `active`, so it resolves to
  `true`. A hand-made deactivation expires silently at the next import. NOT fixed: the right behaviour
  is a product call. Logged in the client feedback doc §6.
  Verified end to end against the dev DB in both directions: shelf 5→4, gone from category/by-section/
  search, Lighting badge 39→38, admin Inactive tab unaffected. `HSSCUS` restored afterwards — note the
  restore PATCH stamps `catalogVersion: manual` + a fresh `lastSeenAt`, which the next import overwrites.
  `dev-token` exists on dev ONLY; staging/prod return nothing, so those are verifiable by branch content
  only — read the file out of the branch, never trust commit-ancestry alone.
  ⚠️ **zsh ate the path, twice.** `git show "origin/$b:src/..."` inside a loop makes zsh read `:s` as a
  history modifier and silently strips everything after the colon — it reports code ABSENT from every
  branch. Build the ref in two steps: `ref="origin/$b"; ref="$ref:$path"`.

- **⭐⭐ A HAND EDIT NOW SURVIVES A CATALOGUE IMPORT (2026-09-02). NO contract change,
  schemaVersion stays 2.5.4, nothing to re-ingest — one new service-owned FIELD + one new route.**
  Ingest is extractor-wins (`$set` of the whole exported document per sku), so every manual edit was
  undone by the next import. Fine for a typo; not fine for the reason the bulk-merge feature exists —
  an afternoon arranging the book into the cards the client wants was gone the day the 2027 catalogue
  lands, with nothing on screen to say so. The analysis is `docs/manual-edits-vs-catalog-import-2026-08-27.md`
  (option A); this is that option built, with two deliberate departures from its sketch.
  **`Item.manualOverrides: Record<string, value>`** — `patchItem` and the soft delete record the fields
  they CHANGED; `reapplyManualOverrides` merges them back with `$mergeObjects` after the bulk upsert.
  1. **⭐ CHANGED, not SENT — the whole design rests on this.** The doc proposed recording "the keys
     `patchItem` is writing". The authoring form reads the item with `expand=all` and PATCHes the WHOLE
     record back, so that would pin ~40 fields on the first edit and freeze the item against every
     future catalogue — the opposite of the intent. `sameJson` compares each value against the stored
     one; key ORDER is ignored (a round-tripped block is not an edit), array order is NOT (a pill row's
     order is meaning).
  2. **Values, not just names**, so the re-apply is ONE `updateMany` instead of an `omit()` per op
     inside the ingest loop.
  3. **⭐ ORDER IS LOAD-BEARING: after the bulk upsert, BEFORE the missing→inactive sweep.** Late enough
     to beat the export, early enough that a pin cannot resurrect a code this catalogue drops.
  4. **The import reports the pins a human must then look at** — `summary.items.manualOverrides.staleSkus`
     (pinned item, code not in this upload) and `.staleFamilyIds` (a merge whose target family is gone),
     capped at 50. ⚠️ `staleFamilyIds` is computed BEFORE the pins go back on — afterwards a merged item
     carries its own target and every merge reads as live. ⚠️ **Nothing surfaces these in a UI** — there
     is no ingest screen at all, `POST ingest` is run by hand, so whoever runs the 2027 import must read
     the response.
  5. **The soft delete had the same bug alone** and is fixed by the same rule (CLAUDE.md's own note said
     "NOT fixed: the right behaviour is a product call" — it is answered: *the human wins for fields a
     human touched, the catalogue wins everywhere else*). ⚠️ And one correction to that note: export
     files DO carry `active: true`, on all 18,396 items — it is not an absent field defaulting to true,
     which matters because you cannot fix it by treating absent as "leave alone".
  6. **`DELETE /design-book/items/:sku/overrides?field=`** unpins, all or one. Values stay — unpinning
     hands the field back to the catalogue from the next import on, it does not undo the edit.
     `manualOverrides` is in `RESERVED_ITEM_FIELDS` and NOT in `UpsertItemDto`, so no body can set it.
  **⭐ THE WRINKLE NOTHING PREDICTED: a pin can only record a CHANGE, so a merge made BEFORE this
  existed cannot be pinned by re-asserting it.** Re-applying it — back to the catalogue's family, then
  forward again — is what pins it. **Both clusters were swept and repaired**: dev 1 hand merge, **prd 6**
  (`AHS` + five `ZGRS*` — the client had folded a whole "Handle screws" card into another), all pinned
  via `scripts/fix-hand-merges.js` (report-only without `--apply`, idempotent, writes through the real
  `patchItem`). Two of them had also left their family with **two default `faceForTiers` faces** —
  editing `familyId` by hand does not clear the joiner's face the way the merge tool does — and fixing
  that is what made the pending `faceWidthMm` backfill CORRECT rather than merely a write: with one
  face per family, the default width is the face's, not whichever unit sorted first. All three
  `backfill-face-*` then ran on both clusters (0 · 0 · 1 each) and re-run clean.
  ⚠️ **`backfill-face-height-class.js` and `-variant-core.js` did NOT honour `MONGO_URI_OVERRIDE`** —
  only `-width-mm.js` did — so running them "for prd" silently hit dev, or meant editing `.env`. All
  three carry the same line now.
  **Checks:** `scripts/check-manual-overrides.js` (pure — the whole-form PATCH pins one field, pins
  accumulate and replace, key order ignored / array order not) · `scripts/check-manual-overrides-e2e.js`
  (boots a Nest context on a SCRATCH database and drives the real `ingestCatalog()`: merge and
  deactivation survive · an unpinned field still takes the catalogue's value · a pin does not resurrect
  a dropped code · both stale reports fire · unpin releases). Verified live through the real admin UI on
  D4K-dev: merged `ZGR378306` → `HDL_MBH_375`, pin chip listed exactly the 4 fields that differed
  (category/section identical between the two, correctly NOT pinned), unpinned, restored — Handles back
  to 134 cards, `familyFacts` byte-identical to the export, 0 pins left.
  **⚠️ STILL OPEN — a hand-CREATED item is deactivated by the next import regardless.** That sweep is a
  separate write which never reads the document (`{ ingestBatchId: { $ne: batchId }, active: true }`) and
  `createItem` stamps no `ingestBatchId`, so a brand-new code has nothing pinned. One clause fixes it
  (`ingestBatchId: { $exists: true, $ne: batchId }`); nobody has hit it, left out on purpose. §2d of the
  analysis doc.
  **⚠️ NOT RELEASED as of writing** — backend branch `feat/design-book-manual-overrides`
  (**PR #3096 → `dev`**: `35a88a84` the layer · `d081fc22` the override guard · `8a81ef07`
  `fix-hand-merges.js` · `d330f804` its third pass), frontend `feat/design-book-manual-overrides`
  (**PR #2470 → `dev`**: `5c02969ca` — the `pinned` chip in the admin item list's Family column + the
  unpin confirm). **The pins are already written on both clusters and do nothing until the backend
  ships** — an import before that release ignores them. ⚠️ **dev and prd have diverged**: the `ZGRS*`
  merge exists only on prd (the client's call, accepted).

- **⭐⭐ THE LAYER RUN AGAINST A REAL IMPORT — and two beliefs it disproved (2026-09-04). No code
  change to the layer itself; one script fix (`d330f804`).** The override layer had only ever been
  driven against a 3-item catalogue, so the whole export was ingested into D4K-dev through the real
  `ingestCatalog()`. **18,396 seen / 18,396 updated / 0 inserted / 0 deactivated in 117 s**, with
  `manualOverrides: {items: 2, reapplied: 2, staleSkus: [], staleFamilyIds: []}` — the re-apply is an
  `updateMany` scoped to pinned docs, so it is size-independent in practice as well as on paper. The
  merge and its option row came out byte-intact. That closes the "never run against a real import"
  caveat.
  1. **⭐ A MERGE IS ONLY HALF A HAND EDIT, and `fix-hand-merges.js` pinned only the half it was named
     after.** The authoring guide's flow (`docs/guide-add-option-buttons-to-a-card.md`) is *merge, then
     give the card its option buttons* — `familyFacts.variantLabel`/`variantOrder`, each item's
     `unitFacts.variantCode`, and `dupFamilies`. On D4K-dev the `AHS`/`AHS2` card was pinned on
     `familyId`+`faceForTiers` and on nothing else, so an import would have kept the two items together
     and **stripped the `Set · 2 Rails / 3 Rails` row off the card** — half-undone, which is exactly the
     failure the merge pass re-applies both of its fields together to avoid. Same root cause as that
     one: *a pin can only record a CHANGE*, and the sweep only re-applied `familyId`. Third pass added —
     every other field on which a `catalogVersion: manual` item differs from the catalogue, re-applied
     through the real `patchItem`. Dev now pins 5 fields on `AHS`, 3 on `AHS2`.
  2. **⭐⭐ `$set` OF THE EXPORTED DOCUMENT ONLY OVERWRITES THE KEYS THE EXPORT HAS.** `normalizeItemDoc`
     is a passthrough — it adds no defaults — so **a field absent from the export survives an import
     untouched**, and needs no pin. Two long-standing notes in this file are wrong because of it:
     - **The face fields do NOT need re-backfilling after an ingest.** `variantCore`,
       `faceVariantCore`, `faceHeightClass` and `faceWidthMm` are backend-computed and appear on **0 of
       18,396** exported items, so the import cannot reach them. Measured across the run: 18,396 /
       18,313 / 7,605 / 17,407 before, identical after. Together with the earlier finding that
       `repickFaces()` decides the face in JS for 1,637 of 1,643 families, **the post-import backfill
       step does not exist** — the ops list for an import is: read the response.
     - Same for `parameters` and `functionalGroups` where the export omits them (11 items carry a
       `functionalGroups` the export lacks; all 11 survived).
  3. **⚠️ `catalogVersion: 'manual'` DOES NOT SURVIVE — `manualOverrides` is the durable marker.** The
     import re-stamps `catalogVersion` from the export, so after one run dev's "manual" count went 7 → 0
     while the 2 pinned items stayed pinned. Consequence: `fix-hand-merges.js`'s third pass is scoped to
     `catalogVersion: manual` and therefore **cannot find an unpinned hand edit after an import has run
     over it** — it is a one-off for edits made before the layer existed, which is all it is for. The
     admin chip reads `manualOverrides`, which is right.
  4. **⚠️ NEW, OPEN — the authoring form's PATCH round-trip is lossy, and pins make that permanent.**
     The form drops null and empty members and coerces scalars (`carcaseLine` `"80"` → `80`,
     `capabilities` minus its null keys, `description` minus an empty `bullets`, `gridHidden` absent →
     `false`). Before pins that was self-healing — the next import put the export's value back. Now a
     harmless edit can PIN the degraded value and freeze it against every future catalogue.
     `fix-hand-merges.js` skips those four (`ARTIFACT_FIELDS`, `--pin-all` overrides) so the one-off
     sweep does not freeze them, but **`patchItem` itself does not**, and the real fix is in the form.
     Seen on 4 of dev's 7 hand-touched items.
  5. **⚠️ The dev Atlas cluster reads at about 1 MB/s from here** — a full scan of the 82 MB collection
     takes **72 s**, so the first grid request after an ingest (cold `poolByFamily`) can sit for
     minutes, and several concurrent ones serialise behind each other. Not a bug; do not go hunting one.
     Verify post-ingest data with the raw driver, not by waiting on `GET items?groupBy=family`.
  Docs: map **§1** (the summary field) + **§1b** (the 4th endpoint, and "extractor wins" now has one
  exception) · crud-guide **§6a** · the analysis doc's UPDATE block · the client-feedback doc §6.

- **⭐ SEARCH NOW FINDS AN ORDER CODE (2026-08-21) — the client rejected the "not a bug" answer,
  and they were right to.** They re-sent the `T506636` screenshot ("No units match these filters")
  after §5 D of the feedback doc explained it was an order code. The explanation was correct and
  was not the deliverable. **`orderCodeBases()` in `design-book.service.ts`** peels the five
  mutations `assemble()` (v781 `:2419`) can apply — the depth class spliced INTO the digit run
  (`pre+dig+<36|48|68>+fn`), a trailing `E` or `J`, a leading `V`, `P1`/`C1` — in every combination,
  and `buildItemFilter`'s `q` branch matches the peeled codes as EXACT skus alongside the existing
  substring regex. Over-peeling is free (no such article exists, so it matches nothing); the only
  mutation not peeled is line-66, which REPLACES the code (`u.Yc`) — all 11 of those ARE stored
  skus, so the plain match already found them. `searchRank` scores a peeled article `1`, so it
  cannot arrive buried under the substring noise.
  **⭐ THE FACE PIN IS HALF THE FIX.** Finding the family is not finding the code: `q=T506636`
  returned the right card faced on **`T6047`** (the family default) — a designer who typed T506636
  and is shown "T6047 · Floor unit" files the same bug again. `pinFacePool` gained a `search`
  pin, ranked LAST and with **no fallback**. ⚠️ Plain `q` is still NOT a pin (§P5) and the two
  guards that keep it that way are the whole design: an ordinary term peels to an EMPTY list (every
  parity term — `TSP`, `HWS`, `63`, `toe kick` — does, asserted by name in the check), and a term
  the family HOLDS wins outright, so the d68 twin `TSP608068` keeps facing itself instead of the
  `TSP6080` it peels to.
  **⚠️ Deliberate divergence from v781, like the book exclusions.** The app's own search is
  `b.units.some(u => u.c.includes(q))` — `T506636` finds nothing there either. Invisible to the
  sweeps: the plans only ever drive `q: ''|'HWS'|'TSP'`.
  Verified against D4K-dev: `T506636`/`T506648` → the `T5066` card faced `T5066`; `H60146IZ4E` and
  `H6014636IZ4` → `H60146IZ4`; `P1T3080S` → `T3080S`; and unchanged — `q=TSP` **31 families** (the
  app's number), `q=HWS` 5, `q=63` top three still `CMU6063SZ · AMU6063T · AMO6063T`.
  `scripts/check-order-code-search.js` (NEW, pure function, no Mongo) + `check-search-rank.js` +
  `check-grid-gates.js` (77,760 + 51,840 combos identical) + `check-face-pins.js` 6/6.
  **⭐ RELEASED 2026-08-21:** `b417a178` → PR #3048 (`dev`, `e11fe46f`) → #3049 (`dev`→`staging`,
  `3203a3f1`) → #3050 (`staging`→`main`, **`3daa6300`**); `origin/main..origin/dev` empty, and both
  `orderCodeBases` and the check script were READ OUT OF `origin/main`, not trusted from history.
  ⚠️ #3050 also promoted `b0d2bfe4` (another developer's chat-unread change, already queued on
  `dev`) — confirmed with the user first, the same call as 2026-08-21's `3661ce70`.
  **⚠️ NOT A BUG — an ENHANCEMENT we chose.** The item genuinely does not exist and v781 finds
  nothing for it either; the feedback doc's original "not a bug" answer was correct. We diverged
  because OUR app is what handed the designer a code it could not then find. Rollback +
  the reasoning, so the call can be re-made without redoing the analysis:
  **`docs/order-code-search-rollback-2026-08-21.md`**.
  ⚠️ **The zsh `:s` trap bit AGAIN** while verifying — `git show "$ref:src/…"` inside a `&&` chain
  silently became `origin/maink-order-code-search.js` and grep found nothing, which reads as "the
  code never landed". Build the whole ref in ONE assignment (`p="origin/main:path"`), not `$var:path`.
  **Considered and REJECTED:** gating the depth peel on `capabilities.depthClasses`. `T506648`
  returns the `T5066` card whether or not 48 exists on it, and the card's own D row then shows which
  depths do — gating would return NOTHING for a near-miss, which is the behaviour being removed.
  **Still open (product call):** the card comes back on its NATIVE depth with no pill pre-selected,
  so an order code identifies the ARTICLE, not the CONFIGURATION. Restoring the pills (depth pick,
  the `E`/`J` line chips, `P1`/`C1`) is client card state — feedback doc §6.

- **⭐⭐ The client's "design book" report (2026-08-20) — three real defects, one false alarm. All
  fixed in the CLIENTS; no contract change, no re-ingest, schemaVersion stays 2.5.4.**
  Filed against `T6080ZISWH` / `C1TK6080BZ` with screenshots of the book beside the live site.
  1. **63 cm ordered one code.** The book has emitted the cabinet PLUS its alteration codes since
     v580; we shipped `alteration:true` on the pill and never acted on it, so a 63 pick produced an
     order the factory cannot build. The recipe was written down here three times and never said
     WHICH codes — that gap is now the mode table in **map §2c-4** (Tall→`ANHST63`, Base›Sinks→
     `ANTSP63US`·`MPRU`(+`ANSVVO275` on `variantCode:"Doors"`), Base›Cooktops→`ANTSP63US`, else
     `ANTST63`), plus the sink's NATIVE-depth set and the §2c-4 shape **4b**: on a `force68` sink the
     63 pill is a NAVIGATION and an alteration at once, so the pick must be held by sku or the swap
     onto the d68 twin eats it.
  2. **Accessories rendered as one pile.** v2 flattening dropped the tabs; the grouping is
     recoverable from the code prefix exactly as the book does it (`cutSys`). Rule + tab order now in
     map **"Appendix — Rebuilding the accessory TABS"**. **Do not add tabs back to the export** — the
     prefix is the source of truth there too.
  3. **Mat colours missing.** Not catalogue data and cannot be made into it here — `finishes[]` is a
     PRICE dimension and the book hardcodes 160/161/286 against two prefixes. Mirrored client-side,
     documented as deliberately absent (same appendix section).
  4. **"The cabinets in your categories are not related" — FALSE ALARM, do not re-investigate.**
     Live `leafId=b_store#2` returns 100 items, every one `Base / Function Cabinets`; the export
     agrees and every section name we ship is lifted from their own v781 HTML. The screenshot was the
     **`q=63` search**, misread as a category. What was real underneath: the search matched any sku
     SUBSTRING, so `FS8634` / `T3R308636` outranked `ANTSP63US`. Fixed in D4K-backend by RANKING
     rather than filtering (`searchRank`), so no partial-code hit is lost.
  ⚠️ **The live dev DB was NOT stale** — `schemaVersion 2.5.4`, 18,396 items, identical to
  `docs/export-v781-fresh.json`. Check that before blaming ingest: `GET /design-book/dev-token` is
  unguarded on dev and gives an hour's bearer token for exactly this kind of question.

- **⭐ `schemaVersion` on the catalog META doc (2026-08-05).** `GET /design-book/stats` had reported
  `2.2.0` since the 2026-07-17 ingest. The meta doc is written ONLY by ingest (`meta: catalog.meta`),
  so every contract bump that ships as a FIELD BACKFILL rather than a re-ingest leaves it behind.
  Nothing gates on it — two reads, both reporting (`design-book.service.ts:281` stats, `:3263` meta) —
  so it was cosmetic. **Fixed on BOTH clusters → `2.5.4`** (data-only, no release). Repeatable:
  `[MONGO_URI_OVERRIDE=<uri>] node scripts/backfill-meta-schema-version.js <x.y.z> [--apply]` in
  D4K-backend — dry-run by default, idempotent, one field. **Re-run it after every contract bump.**
  The stored `meta` block was otherwise byte-identical to the export's. ⚠️ The prd URI is line 3 of
  `D4K-backend/.env`, **commented out** — use `MONGO_URI_OVERRIDE` so `.env` is never left aimed at
  prod. ⚠️ macOS `sed` is BSD: `\s` does not match, use `[[:space:]]` (a `\s` pattern silently passed
  the whole `# MONGO_URI = "…"` line through as a URI).

- **⭐ FRONTEND v2.5 IMPLEMENTED (2026-07-31).** `D4K-frontend` branch **`feat/design-book-v2.5`**
  (3 commits @ `638de925`, cut from `origin/dev` `25b19af9`; **PR #2328 MERGED to `dev` 2026-07-31**,
  merge commit `34610156`) implements 7
  of the 8 steps in `throwaway/frontend-v2.5-changes.md`: `gridRows` rendered verbatim, one click
  dispatcher by `familyId`+`pill.value`, the toolbar carried on every swap, `lineState`, `antoso`
  (not `suspended`), `cardAvailable`, and the authoring dialog's missing fields. **Verified in a
  browser: 22 states / ~760 cards / 0 diffs**, plus `antoso`, the global `q`, the drawer, and a live
  dialog round-trip (10/10). Three fixes beyond the guide: the FRMAT blanket-exclusion bug in the
  client's `availableFromCaps`, a finish-swatch URL that 403'd for every code (`F+<digits>.jpg`, and
  `405` → `F+405_VS.jpg`), and a pill that is `selected` AND `off` rendering fully lit. **Status +
  the 4 deliberately-deferred items: `docs/frontend-v2.5-pending-2026-07-30.md`** — none of them is an
  integration gap. ⚠️ `npm install` in that repo needs `--legacy-peer-deps` (React 16/17-vs-18 peer
  conflict). ⚠️ **The repo is at `/Users/apple/Documents/thirtynorth/react-apps/D4K-frontend`, NOT
  under `node-js/`.**
  **⭐ A FOURTH client change is on `new-design-v2`, pushed 2026-08-06:** **`28ac1192`** — §U/R16,
  route a grid variant pick by `variantCode` and carry it on every swap. ⚠️ It sits on
  **`new-design-v2`**, not `feat/design-book-v2.5` (that branch had moved on; the rebase picked up
  `347e892b` "Show the handle on the finish card, not its colour" — someone else in the same file,
  no conflict).
  **⭐ THREE PRs are now merged to `dev`** (checked 2026-08-05): **#2328** (`34610156`) the v2.5 client ·
  **#2329** (`9eadd240`) the §S Insert row — `kind:"insert"` + the `insert`/`variantCode` card-state
  params · **#2330** (`1f303630`) `47577826` "render the local depth pick on the grid D row" (§T3).
  Handoff task 2 is closed. **⬜ ONE COMMIT STILL UNMERGED** on `feat/design-book-v2.5`: **`8016d2c7`**
  "wire the Line row and keep 63 lit on force68 cards" — the client half of backend `59a7e09f`, i.e.
  guide steps **R12** (the dispatcher had a literal `case "line": return;`; now sends `cardLine`, and
  `orderCodeLines` applies `assemble()`'s Y-replaces/+E/+J against the FACE's own capabilities) and
  **R13** (a force68 63 pick sends `depthClass=63` and every later swap keeps sending it while the row
  still reads 63). Its backend half IS released, so this PR is unblocked — open it.

- **⭐ THE BOOKS — the greying gates audited against the CLIENT'S OWN CATALOGS (2026-08-04).** The
  client supplied `data-from-client/items-pdfs/{primo,contino-avance}-2026.pdf` (1,033 + 1,010 pages,
  the LEICHT "Price- and Type list 2026", edition 1/2026) and said **the v781 app was built FROM
  them** — so they are UPSTREAM of the app, not a third opinion, and where they disagree with us the
  book is the authority. Harness + findings: **`scripts/book-audit/`** (README has the method and the
  traps). Results: **`excludedPrograms` 1,408/1,411** · **`excludedProgramsE` 668/683 tall fronts and
  609/609 on the ≥190.6 cm rule** · **`isFrmatFamily` an EXACT match — the book independently
  reproduces §Q2** (31 programmes FRMAT-dead, 0 uncovered; all 9 hardcoded `FRMAT_DEAD_PROGRAMS` have
  no size row AND aren't in `excludedPrograms`, and BAHIA/BAHIA-C are excluded while HAVING a row —
  both halves of that note confirmed, neither list can replace the other) · `doorLineY` 11/11 follow
  the legend's `8`→`Y` rule · `depthClasses` + `openP1` verified by RENDERING pages (`T2073GVZ` shows
  both the `36/48` and `68` icons = our `[36,48,58,68]`; `T3073SZF` has the `P1` badge, `T3073ZBR`
  doesn't). **`scripts/fix-book-exclusions.js`** applied the 17 fixable ones (export + `.gz` + **D4K-dev
  AND D4K-prd**, both verified `0 differ` on re-run — handoff §3; prd's dry run found exactly the same
  17, so its `capabilities` was otherwise already byte-identical to the export, and the write needed no
  release since it is inert until a Q programme or a Full-E state is chosen):
  `HAA30217ZR` += the 4 Q programmes (primo p569, a **NEW** 2026 type) and
  16 `GF76…`/`GF91…` += `VALAIS-C` on the single-front rule. **schemaVersion stays 2.5.4** — data
  correction, not a contract change.
  **⚠️ THREE THINGS TO KNOW.** (1) **This DELIBERATELY DIVERGES FROM v781** — the app renders these
  live. Provably invisible to the harness today (every plan under `scripts/parity/` uses only
  programmes 244/701/410 and never sets `front`, so neither a Q programme nor `excludedProgramsE`,
  which only bites at `s.front===1`, is exercised); if a plan ever adds a Q programme, VALAIS-C or a
  Full-E state, expect GREY diffs HERE and **treat ours as the correct side**. (2) **RE-RUN
  `fix-book-exclusions.js` AFTER EVERY EXTRACTION** — the extractor reads the app, and the app is the
  side that is wrong. It is idempotent and aborts if the finding set changes shape. (3) The P1 /
  suspended / depth markers are **vector drawings** — no glyphs, no image XObjects — so those gates
  can only be checked by rendering; and `antosoApproved` can't be read off its icon at all (it varies
  WITHIN one icon block by width, `T2073GVZ` false vs `T3073GVZ` true — the app's `antosoU(u,cat,sub)`
  size rule). **Left unfixed on purpose:** `TP2060`/`ANPB` (`isAccessory`) and `FRAUSR` (Alteration)
  are restricted by the book but the app's own `famOkB` escapes mean they are never greyed by
  programme — ours matches the app; 15 `RWF…` rear panels + 42 Wall/Ventilation items carry
  `hasEFront` but aren't the "tall unit fronts" the legend describes; and **215 items at width 55 cm
  are in our data but in NEITHER book**. Those four need the client, not a patch.

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
