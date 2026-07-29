# Grid-parity session handoff — 2026-07-28 (start here tomorrow)

Goal of the session: open our grid category by category (Base → Tall → Wall → Midway), try every
toolbar combination against the client app (`leicht_units__781_.html`), and remove every difference
that makes sense. Full findings live in **`docs/client-ui-parity-audit.md` §L**. This file is the
operational state: what runs where, what is already applied, what is left.

---

## 0. START HERE — first 30 minutes tomorrow

```bash
# A. three servers (three terminals, or background them)
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction/data-from-client && python3 -m http.server 8777
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction && node scripts/parity/sink.js scripts/parity/out
cd /Users/apple/Documents/thirtynorth/node-js/D4K-backend && npm run build && node dist/main.js

# B. sanity check — the three fixes verified by hand at log-off
curl -s localhost:8000/design-book/dev-token >/dev/null && echo backend-up
#   Fronts C on F1751 must face CTW58058, Fronts A must face TW58058,
#   ANBL's Ty row must read Front · CI-KERA · G-Rocca · GL-Glass   (see §5)
```

Then open two Chrome tabs (app on 8777, our UI on `localhost:8000/design-book/ui`), inject the two
dumpers (§1), and run **TASK 1 below** — the re-measure. Everything else waits on those numbers.

**Nothing is committed in either repo.** Review + commit first if you want a clean base
(`git status` in both; file lists in §4).

### Task board

| # | task | state |
|---|---|---|
| — | harness built (drive both UIs, diff grids) | ✅ done |
| — | baseline measured, 720 combos, 10 root causes → audit §L | ✅ done |
| — | schemaVersion 2.5.0 `unitFacts` + `familyFacts` (export + extractor + DTO + schema) | ✅ done |
| — | D4K-dev backfilled (`unitFacts`, `familyFacts`, `faceWidthMm`) | ✅ done |
| — | `gridRows` — family-pool card rows, server-computed (§L #1) | ✅ done |
| — | accessories never grey (#4) · D63 family eligibility (#5) · W membership (#6) | ✅ done |
| — | Fronts chip = `tierOk` twin rule + tier re-face (#2) | ✅ done |
| — | line collapse via `lineState` (#3, #7 render) | ✅ done |
| — | app card ORDER (#8) · depth-row label (#9) · variant chip labels | ✅ done |
| **1** | re-sweep Base, diff, record numbers → `report-Base7.json` (§M0) | ✅ **done 07-29** |
| **2** | dup-family cards → **`Item.dupFamilies`** (2.5.2, §M7) | ✅ **done 07-29** |
| **3** | `ourOnly` residue → **`Item.gridHidden`** (2.5.1) + family-level `depthFamOk` + `lineCardOk` hides (§M2/§M3) | ✅ **done 07-29** |
| **4** | GREY residue — lite UI now uses the server's `cardAvailable` (§M5) | ✅ **done 07-29** |
| **5** | `ANBL`-type extra W/D rows — strict `===` on `u.hc` + `dv \|\| 58` (§M1) | ✅ **done 07-29** |
| **6** | selected-pill grey nuance — `dim==='none'` chips never grey (§M4) | ✅ **done 07-29** |
| **7** | wire the tall `Line` row click (render already matches) | ⬜ open — do only if the client asks |
| **8** | D4K-**prd** backfills (data-only, safe before deploy) — now also `gridHidden` + `dupFamilies` | ⬜ open |
| **9** | perf pass on the extra member scans + the membership `$unwind` | ⬜ open |
| **10** | commit both repos (docs are written: audit §M, map §2c-12, contract, CLAUDE.md) | ⬜ open |
| **11** | re-sweep Base + Tall + Wall/Midway with everything deployed | ⏳ running |
| **12** | ⭐ **sweep with `grey=false`** — the lite UI hard-coded `grey=true`, so every sweep so far ran in the app's "Grey don't hide" mode and the family gates (`depthFamOk`/`lineCardOk`) never fired. `window.__GREY=false` before `__Q.sweep(...)` now switches it. Expect `GREY_NOT_HIDE` → ~0 and most of `SECT` with it. | ⬜ next |
| **13** | FACE residue — port the app's `_selUnit` and pick the face in JS (audit §M "Still open") | ⬜ open |

**Round 2 (2026-07-29) is written up in `docs/client-ui-parity-audit.md` §M** — six more root causes,
all closed. Contract is now **2.5.2** (`unitFacts.heightCodeNull`, `Item.gridHidden`,
`Item.dupFamilies`). Tall and Wall/Midway have still not been re-measured since the §L baseline.

---

## 1. Environment — how to bring it back up

```bash
# 1. client app (ground truth) — serve over http, the extension can't open file://
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction/data-from-client
python3 -m http.server 8777          # → http://localhost:8777/leicht_units__781_.html

# 2. parity sink + script server (POST dumps / GET the in-page scripts, CORS-open)
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction
node scripts/parity/sink.js scripts/parity/out          # port 8799

# 3. backend (branch `dev`, .env → MONGO D4K-dev, ENVIRONMENT=local)
cd /Users/apple/Documents/thirtynorth/node-js/D4K-backend
npm run build && node dist/main.js                       # port 8000, UI at /design-book/ui
```

Two Chrome tabs: the app on 8777 and our lite UI on `http://localhost:8000/design-book/ui`.
Inject the dumpers (they fetch from the sink, so no CORS problem):

```js
// tab A — the client app
(0,eval)(await fetch('http://localhost:8799/js?f=dump-client.js').then(r=>r.text()));
// tab B — our lite UI
(0,eval)(await fetch('http://localhost:8799/js?f=dump-ours.js').then(r=>r.text()));
```

---

## 2. The harness (all new this session, in `scripts/parity/`)

| file | what it does |
|---|---|
| `sink.js` | `POST /save?name=x` writes `out/x.json`; `GET /js?f=y` serves the in-page scripts |
| `dump-client.js` | drives v781's own `state` + `renderGrid()`, scrapes `#grid` → normalized JSON (`__P.sweep(plan)`, `__P.post('client-Base')`) |
| `dump-ours.js` | drives our `F` filter + `load()`, waits on `window.__inflight` (in-flight card swaps), scrapes `#grid` (`await __Q.sweep(plan)`, `__Q.post('ours-Base')`) |
| `extract-grid-facts.js` | dumps the app's family/unit facts (`__G.post('grid-facts-v781')`) → `out/grid-facts-v781.json`; **source for the 2.5.0 fields** |
| `make-plan.js` | `node scripts/parity/make-plan.js Base` → `plan.json` (16 toolbar states × every sub-category) |
| `diff.js` | `node scripts/parity/diff.js out/client-X.json out/ours-X.json out/report-X.json` → 9 buckets |

Normalized card shape (both sides): `{fid, sku, code, grey, rows:[{l,p:[{l,s,o}]}], tiers}`.
`out/` and `plan*.json` are gitignored; `client-Base/Tall/WallMidway.json` are still on disk and can be
reused (the app doesn't change) — only the `ours-*` side needs re-dumping after a fix.

Typical loop (one category ≈ 20–50 min for our side, ~2 s for the client side):

```js
// tab B
const plan = JSON.parse(await fetch('http://localhost:8799/js?f=plan-Base.json').then(r=>r.text()));
__Q.clear(); window.__RUN = __Q.sweep(plan).then(()=>__Q.post('ours-Base7'));
```
```bash
node scripts/parity/diff.js scripts/parity/out/client-Base.json \
     scripts/parity/out/ours-Base7.json scripts/parity/out/report-Base7.json
```

---

## 3. Data / contract — schemaVersion **2.5.0**

Two new item objects, both captured FROM the app (nothing re-derived):

* **`unitFacts`** = `{tier, opening, agnostic, siblingTiers, widthCode, depthCode, variantCode, depthAlterations}`
  (`u.fam / u.op / u._ag / u.sib / u.w / u.dv / u.vr / u.d`)
* **`familyFacts`** = `{label, labelGroup, isSpecial, dim, variantLabel, numericLabel, variantFormat,
  variantOrder, variantLabels, byProgramme, hasOpeningArticles, hasPrimo, noLine, memberTiers,
  isAccessory, isProgrammeAgnostic, depth63}`

Documented in `docs/export-schema-v2.ts` (interfaces `UnitFacts` / `FamilyFacts`) and
`docs/design-book-api-ui-map-v2.md` **§2c-11**.

### Applied already (D4K-dev + the export)

| step | command | state |
|---|---|---|
| facts dump from the app | `__G.post('grid-facts-v781')` in tab A | ✅ `scripts/parity/out/grid-facts-v781.json` |
| patch the export | `node scripts/backfill-grid-facts.js --apply` | ✅ (`docs/export-v781-fresh.json`, meta 2.5.0) |
| re-gzip | `gzip -kf docs/export-v781-fresh.json` | ✅ |
| DB fields | `cd D4K-backend && node scripts/backfill-item-fields.js ../d4k-items-extraction/docs/export-v781-fresh.json --fields unitFacts,familyFacts --apply` | ✅ D4K-dev (18,366 docs) |
| face width | `node scripts/backfill-face-width-mm.js ../d4k-items-extraction/docs/export-v781-fresh.json --apply` | ✅ D4K-dev (17,407 docs) |

The extractor (`docs/export-v781-extractor2.js`) emits all of it now, so a **re-ingest is safe** for
these fields.

### 3a. DATA LEDGER — every field, every store, verified 2026-07-28 18:55

Counts are live `countDocuments({field: {$exists, $ne: null}})` on both clusters and a scan of the
export. Collection `designbookitems`, **18,396 items in all three**. Export
`docs/export-v781-fresh.json` (+`.gz`, 69 MB / 2.6 MB), `meta.schemaVersion` **2.5.0**.

| field | export JSON | D4K-dev | D4K-prd | source of truth |
|---|---|---|---|---|
| `unitFacts` | **18,352** ✅ | **18,352** ✅ | **0** ❌ **owed** | export (extractor) |
| `familyFacts` | **18,366** ✅ | **18,366** ✅ | **0** ❌ **owed** | export (extractor) |
| ↳ `familyFacts.memberTiers` | 18,366 ✅ | 18,366 ✅ | 0 ❌ | export |
| ↳ `familyFacts.variantLabels` | 615 ✅ | 615 ✅ | 0 ❌ | export |
| ↳ `unitFacts.depthAlterations` | 2,350 ✅ | 2,350 ✅ | 0 ❌ | export |
| `faceWidthMm` | — (n/a) | **17,407** ✅ | **0** ❌ **owed** | backend backfill only |
| `faceHeightClass` | — (n/a) | 7,605 ✅ | 7,605 ✅ | backend backfill only |
| `faceVariantCore` | — (n/a) | 18,313 ✅ | 18,313 ✅ | backend backfill only |
| `variantCore` | — (n/a) | 18,396 ✅ | 18,396 ✅ | backend backfill only |
| `heightCode` | 12,048 ✅ | 12,048 ✅ | 12,048 ✅ | export |
| `catalogRank` | 11,203 ✅ | 11,203 ✅ | 11,203 ✅ | export |
| `sectionRank` / `familyIndex` | 18,366 ✅ | 18,366 ✅ | 18,366 ✅ | export |
| `capabilities` | 18,375 ✅ | 18,375 ✅ | 18,375 ✅ | export |
| `faceForTiers` | 1,848 ✅ | (in items) ✅ | ✅ | export |
| `doorLineYCode` | 11 ✅ | 11 ✅ | 11 ✅ | export |
| `heightExtension` | 2,046 ✅ | 2,046 ✅ | 2,046 ✅ | export |
| `parameters.*.showUnderLine` | 986 items ✅ | 986 ✅ | 986 ✅ | export |

**Read that table as two rules.** (1) Anything marked *"export (extractor)"* survives a re-ingest —
`docs/export-v781-extractor2.js` writes it, so a fresh extraction + ingest needs no follow-up.
(2) The four *"backend backfill only"* fields (`faceWidthMm`, `faceHeightClass`, `faceVariantCore`,
`variantCore`) are computed FROM the export after ingest and are **wiped by every re-ingest** —
re-run their scripts each time.

**The only gap right now: D4K-prd is missing `unitFacts`, `familyFacts`, `faceWidthMm` and (since
2026-07-29) `gridHidden` + `dupFamilies`.** Everything else is identical on both clusters. That gap is inert — the deployed prd code never
reads those fields — but the `dev` branch must NOT be released to prd before it is closed.

```bash
# CLOSE THE PRD GAP (data-only writes; do this before the dev branch ships)
cd /Users/apple/Documents/thirtynorth/node-js/D4K-backend
#   .env currently points at D4K-dev — point it at D4K-prd for these three commands, then flip back.
#   (`env.dev.bak` in the old scratchpad has the dev value; MONGO_URI is the only line to swap.)
node scripts/backfill-item-fields.js ../d4k-items-extraction/docs/export-v781-fresh.json \
     --fields unitFacts,familyFacts,gridHidden,dupFamilies       # dry run — prints how many differ
node scripts/backfill-item-fields.js ../d4k-items-extraction/docs/export-v781-fresh.json \
     --fields unitFacts,familyFacts,gridHidden,dupFamilies --apply
#   expect: unitFacts/familyFacts ≈ 18,366 · gridHidden 57 · dupFamilies 74   (2026-07-29, schema 2.5.2)
node scripts/backfill-face-width-mm.js ../d4k-items-extraction/docs/export-v781-fresh.json --apply
#                                                   # expect ≈ 17,407
# verify: re-run the counts (scripts/backfill-item-fields.js dry run reports 0 differing when done)
```

### ⚠️ Backfills still owed

1. **D4K-prd: `unitFacts`, `familyFacts`, `faceWidthMm`** — commands + expected counts in §3a. Nothing
   else differs between the clusters.
2. **After ANY re-ingest** (dev or prd) re-run the four backend-computed fields, which the export does
   NOT carry: `backfill-face-height-class.js`, `backfill-face-variant-core.js`,
   **`backfill-face-width-mm.js`**, and whatever writes `variantCore`. Everything else
   (`unitFacts`, `familyFacts`, `heightCode`, `catalogRank`, `sectionRank`, `familyIndex`,
   `capabilities`, `showUnderLine`, `doorLineYCode`, `heightExtension`, `faceForTiers`) is in the
   export → no post-ingest step.
3. **Re-running the export patch** (only needed if the facts dump changes): re-dump
   `__G.post('grid-facts-v781')` in the app tab, then
   `node scripts/backfill-grid-facts.js --apply && gzip -kf docs/export-v781-fresh.json`,
   then push to a DB with `backfill-item-fields.js … --fields unitFacts,familyFacts --apply`.
4. Commit the regenerated `docs/export-v781-fresh.json.gz` (the raw .json is gitignored).

---

## 3b. THE 10 ROOT CAUSES — the §L list, with the fix status of each

The baseline sweep (720 combos, before any fix) produced these, ranked by how many diffs they caused.
Every one is reproduced on a named family. Full write-up + evidence: `docs/client-ui-parity-audit.md` §L.

| # | root cause | evidence | status | where the fix lives |
|---|---|---|---|---|
| **1** | **Grid rows are UNIT-scoped for us, FAMILY-POOL-scoped in the app.** Our rows came from stored `parameters.*` (ONE unit's detail panel); the app builds them from `ppool(b)`/`hvals(b)`/`wsAtH`/`dAll`/`variantOpts(b)`. Caused ROWSET + PILLS + most of STATE. | `F1715` pool H = 37,43,50,66 → ours 37,50,66. `F1716_A` app draws a 1-pill H row, ours none. `GFVA_B` @line80 app `[80]`, ours `[73,80,86]`. | ✅ **fixed** | `design-book.grid-rows.ts` (`buildGridRows`) + `attachGridRows()` → **`gridRows`** on every card; lite UI `renderGridRows()`; contract in map §2c-11 |
| **2** | **Fronts chip must RE-FACE the card to the tier twin** (`x.w===u.w && x.hc===u.hc && x.vr===u.vr`), and its filter is `tierOk` (twin rule), not `availableTiers` membership — that hid 415 families. | Fronts C on `F1751`: app `CTW58058`, ours `TW58058`. `GFVB` C: app `CGFV6080M`, ours `CGFV4580M`. | ✅ **fixed** | service: caps-based `tierMatch`, `faceWidthMm` + `_faceWidthRank`, `_tierPickRank` ordered AFTER the face width/height/variant ranks; `backfill-face-width-mm.js` |
| **3** | **Line pre-select didn't re-face** where the H row was wrong (a consequence of #1) + the H bar never reached the row builder. | @line73: app `TWS7358`, ours `TWS8058`. | ✅ **fixed** | new **`lineState`** query param (display state, never a filter) → `lineHFilter`; UI sends it, `toolbarParams()` carries it on every swap; H pre-select reads the `gridRows` H row |
| **4** | **Accessories / alterations NEVER grey** in the app (`isAccessory(b)` forces `av` true, app v163). | 188 of 219 GREY diffs were ours-only, all `AN*` codes + panels (`ANW5GSM`, `ANRWFU85`, `ANHDTVR3`). | ✅ **fixed** | `familyFacts.isAccessory` + `cardAvailable()` (backend + lite UI) |
| **5** | **D63 is FAMILY eligibility** (`d63Eligible` = `d63Cfg(b) != null`), not a per-unit pass-through. | Base/Accessories & Surround @D63: app 0 cards, ours 20. Base/Fillers: app 0, ours 12. | ✅ **fixed** | `familyFacts.depth63`; hard filter when `grey=false`, `depthFamilyOk` flag + grey when `grey=true` |
| **6** | **Width membership needs a REAL unit at that width** — our `$ifNull` null-match kept width-less families in. | `F354`, `F64`, `ANW5*` surviving W60/W90. | ✅ **fixed** | `_widthHit` now keys on `unitFacts.widthCode` (the app's `u.w`) + the app's `Alteration` exemption |
| **7** | **No per-card `Line` row** (73/80/86 · J/Y/E) on two-system tall cards. | 119 ROWSET diffs, all Tall. | ⚠️ **renders, click not wired** | `buildGridRows` emits `kind:'line'`; the app's `pickSys` is per-card display state → task 7 |
| **8** | **Card ORDER** — the app sorts `(available desc, pri, accessory last, label-group, special last, family max height desc, FAMS index)` BEFORE bucketing; we sorted `(catalogRank, familyIndex, sku)`. | `XHTAF` before `XHTAL`; `F132` before `TABL` (Wine Units). | ✅ **fixed** | `sortCards()` + `cardAvailable` + `familyFacts.labelGroup/isSpecial` + `familyMaxHeightMm`; paging moved into JS so the sort sees the whole set |
| **9** | **`dim==='depth'` families labelled W, not D** — their numeric pills live in `parameters.width` but the row IS a depth row. | `PNL_END` (`WF68K45`): app `D 36 48 58 68`, ours `W …`. | ✅ **fixed** | `familyFacts.dim` / `numericLabel` drive the row label (backend rows + lite UI fallback) |
| **10** | **Selected-pill grey inheritance** (cosmetic) — the app marks the SELECTED chip `wn` when the card is greyed; we don't, and vice-versa in a few programme states. | `XTWSP` D row: app `S,-`, ours `SO,O`. | ⬜ **open** | task 6 — the `STATE` tail (27 on Base) |

### Nothing dropped — every finding maps to a task

We chose to start with **#1** (the family-pool rows) because it carried the most diffs and unblocked
#3; the rest were NOT parked — they were worked through in the same pass, and whatever is still open
has a task number:

| finding | status | task in §0 board |
|---|---|---|
| #1 family-pool rows | ✅ fixed | — |
| #2 Fronts re-face / `tierOk` | ✅ fixed | — |
| #3 line pre-select re-face | ✅ fixed | — |
| #4 accessories never grey | ✅ fixed | — |
| #5 D63 family eligibility | ✅ fixed | — |
| #6 width membership | ✅ fixed | — |
| #8 card order | ✅ fixed | — |
| #9 depth-row label | ✅ fixed | — |
| #7 `Line` row click | ⚠️ renders, not wired | **task 7** |
| #10 selected-pill grey | ⬜ open | **task 6** |
| dup-family cards (found DURING the fix pass, 275 of 284 missing cards) | ⬜ open | **task 2** |
| `ourOnly` residue (`F74`, `GFVB_B`, `F1571`, `PNL_END`, `ANBL`) | ⬜ open | **task 3** |
| GREY residue (31 on Base) | ⬜ open | **task 4** |
| `ANBL`-type extra W/D rows | ⬜ open | **task 5** |
| re-measure Base/Tall/Wall+Midway | ⬜ open | **task 1** |
| D4K-prd backfills · perf · commits/CLAUDE.md | ⬜ open | **tasks 8 · 9 · 10** |

**Two decisions taken this session (keep them):**

1. **Precision over speed** — the fix for #1 is not a re-derivation. Every rule input was DUMPED FROM
   THE APP (`scripts/parity/extract-grid-facts.js` → `unitFacts` / `familyFacts`) and the row builders
   are a line-by-line port of `renderGrid`, with the app's own function names quoted in the comments.
   Keep doing it that way: if a rule is missing, capture it from v781, don't infer it.
2. **No sweeps beyond Base / Tall / Wall / Midway for now** — the other 10 app categories (Lighting,
   Handles, Countertops, Accessories & interior, Alteration, Service, Sink, Panels & surround,
   Closet & Wardrobe, Wall cladding) are mostly accessory families governed by the same root causes.
   `make-plan.js` only knows the four; add entries to its `NAV` map if that changes.

---

## 4. What shipped (code)

### `D4K-backend` (branch `dev`, uncommitted at log-off — review + commit)

* **NEW `src/design-book/design-book.grid-rows.ts`** — the app's card rows, ported function by
  function: `ppool` · `lineHFilter` (`lineHFilterB`) · `variantOpts` · `buildGridRows` (H/W/D/Line/Ty,
  the `dim` branches, the depth-state row, the 63 chip) · `unitAvailable` (`available(u)`) ·
  `cardAvailable` (`av`) · `lineCardOk`.
* `design-book.service.ts`
  * `attachGridRows()` → ships **`gridRows`** on every family card (one member query per page).
  * `annotateFamilyAvailability()` → **`depthFamilyOk`** + **`cardAvailable`** for the whole result
    (skipped when the toolbar is bare); runs before the sort.
  * `sortCards()` → the app's `visibleBlocks` order (`av, pri, acc, label-group, special, maxh, i`);
    paging moved out of the aggregation into JS so the sort sees the whole set.
  * FRONTS chip filter = the app's `tierOk` (`capabilities.nativeTier` / `twinTiers`), no longer
    `availableTiers`, and no design-zone exemption list (that belongs to the PROGRAMME gate only).
  * W membership on `unitFacts.widthCode` (+ `Alteration` exemption) instead of the null-inclusive
    `widthMm`.
  * `depthClass=63` → family filter `familyFacts.depth63 != null` (the app's `d63Eligible`).
  * new face ranks `_faceWidthRank` (keep the default face's width) and `_tierPickRank` (prefer the
    picked line) — ordered AFTER the face width/height/variant ranks, which is what makes the Fronts
    swap land on the face's twin.
  * new query param **`lineState`** (73/80/86) — display state, never a filter; collapses the rows.
* `dto/query-items.dto.ts` — `lineState`; `dto/upsert-item.dto.ts` + item schema — `unitFacts` /
  `familyFacts`.
* **NEW `scripts/backfill-face-width-mm.js`**.

### `D4K-backend/public/design-book-ui.html` (lite UI)

* renders `gridRows` when present (`renderGridRows`), `parameters.*` stays the DRAWER model;
* `cardAvailable()` — accessories never grey, `depthFamilyOk` greys;
* `toolbarParams()` on every card swap (so a swapped-in card's rows match the grid);
* `window.__inflight` swap counter (harness waits on it);
* H pre-select reads the `gridRows` H row; W row label from `familyFacts`.

### `d4k-items-extraction`

* `scripts/backfill-grid-facts.js` (new), `scripts/parity/*` (new), extractor emits 2.5.0 fields,
  `docs/export-schema-v2.ts` + map §2c-11 + audit §L updated, `.gitignore` for the sweep dumps.

---

## 5. Measured progress (Base, 192 combos — client dump is fixed, only our side changed)

| bucket | baseline | after | note |
|---|---|---|---|
| ROWSET (row set differs) | 402 | **7** | family-pool rows |
| STATE (pill selected/grey) | 305 | **27** | |
| PILLS (pill values) | 76 | **8** | |
| FACE (wrong card shown) | 274 | 134 → *expected ≪ after the last build* | tier ranks fixed post-measurement |
| GREY | 123 | **31** | accessories never grey |
| MEMBER | 133 | 107 | **275 of 284 remaining = app dup-families** (see §6) |
| SECT | 110 | 77 | mostly downstream of MEMBER |
| ORDER | 7 | 25 → *fix landed post-measurement* | label-group index now from `familyIndex` |
| CODE | 0 | **0** | order codes never diverged |

The last three fixes (variant chip labels, face-rank reorder, group index) landed AFTER sweep 6, so
`report-Base6.json` under-reports them. Verified by hand: `F1751` Fronts C → `CTW58058` ✓, Fronts A →
`TW58058` ✓, `ANBL` Ty row → `Front · CI-KERA · G-Rocca · GL-Glass` ✓.

---

## 6. What's left (ranked — same numbering as the task board in §0)

1. **Re-measure (TASK 1 — do this first).** Exact steps:
   ```bash
   node scripts/parity/make-plan.js Base   && mv scripts/parity/plan.json scripts/parity/plan-Base.json
   node scripts/parity/make-plan.js Tall   && mv scripts/parity/plan.json scripts/parity/plan-Tall.json
   node scripts/parity/make-plan.js Wall Midway && mv scripts/parity/plan.json scripts/parity/plan-WallMidway.json
   ```
   In tab B (our UI), per plan: `__Q.clear(); window.__RUN = __Q.sweep(plan).then(()=>__Q.post('ours-Base7'))`
   — poll `Object.keys(__Q.results).length`; ~8–16 s per combo. The client side does NOT need
   re-dumping (`client-Base.json` / `client-Tall.json` / `client-WallMidway.json` are on disk; the app
   never changed). Then:
   ```bash
   node scripts/parity/diff.js scripts/parity/out/client-Base.json \
        scripts/parity/out/ours-Base7.json scripts/parity/out/report-Base7.json
   ```
   Compare the 9 bucket counts against §5. Tall and Wall+Midway have NOT been re-run since the
   baseline (Tall: MEMBER 56 · FACE 32 · ROWSET 285 · PILLS 220 · ORDER 43; Wall+Midway: MEMBER 93 ·
   FACE 76 · SECT 92 · ROWSET 63 · PILLS 51) — expect the same collapse Base saw, plus Tall-only
   findings (the `Line` row, tall H systems).
2. **Dup families (structural, 275 of the 284 missing cards).** The app renders the same accessory as a
   card in several families (`F1962__CKDUP`, `*__DRWDUP`, `MRG_*`); our items collection stores one doc
   with ONE `familyId`, so those cards cannot exist. Fix = carry the extra family ids (e.g.
   `dupFamilies[]` from the facts dump) and emit a card per membership. Same class as the deferred §G
   membership gap.
3. **`ourOnly` residue** (small): `F74` (13 combos), `GFVB_B` (8), `F1571` (5), `PNL_END`/`PNL_ISL_END`,
   `ANBL`… — families we show that the app hides. Check each against `blockVisible`.
4. **GREY 31** — remaining card-grey mismatches after the accessory rule.
5. **`ANBL`-type rows**: we still draw W/D rows where the app draws none (its `dvalue()` is null for
   those units, so `vsd.length <= 1`). One family in Base; check the `dim==='width'` branch.
6. **Selected-pill grey nuance** (`STATE` tail): the app marks the SELECTED chip `wn` when the card is
   greyed; we don't (and vice-versa in a few programme states).
7. **Line row interaction** — `gridRows` now renders the tall `Line` row, but clicking it is a no-op
   (the app's `pickSys` is per-card display state). Wire it if the client asks.
8. **Performance** — a whole-catalog grid now does an extra light member scan (skipped on a bare
   toolbar) plus the page's member fetch; sweeps run ~8–16 s/combo. Fine for dev; profile before prd.
9. **Commit + docs**: nothing is committed yet in either repo. CLAUDE.md still says schemaVersion 2.4.0
   — add the §L / 2.5.0 paragraph when the numbers are final.

---

## 7. Files to read first tomorrow

* `docs/client-ui-parity-audit.md` **§L** — the measurement, the 10 root causes, the harness.
* `docs/design-book-api-ui-map-v2.md` **§2c-11** — the `gridRows` contract (what the React client renders).
* `D4K-backend/src/design-book/design-book.grid-rows.ts` — the ported row builders.
* `scripts/parity/out/report-Base6.json` — the last full diff (buckets + every case).
