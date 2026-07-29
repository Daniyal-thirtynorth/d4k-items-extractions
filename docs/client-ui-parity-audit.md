# Client UI ↔ Our UI Parity Audit (v781)

Goal: make our backend + design-book UI reproduce **100%** of the client app's configurator
behaviour, driven by **stored per-item config flags** (settable via ingest / CRUD / admin) — never
by category-hardcoded hides.

Method (reproducible): the client app (`data-from-client/leicht_units__781_.html`, served on :8777) exposes
its whole model + logic as page globals (`FAMS`, `TASKS`, `setTask`/`setSub`, `visibleBlocks`,
`carcaseLine`, the render pipeline). We drove its OWN functions + scraped the rendered grid DOM across
**all 21 task groups** and compared to our backend API (`localhost:8000/design-book`). Raw dumps:
`scratchpad/client_default_pills.json` (868 cards, every pill row + selected/grey/crossed/disabled),
`scratchpad/client_depth_grey.json` (per-card grey at depth 36/48/58/63/68 for every group).

Status legend: ✅ verified · 🔶 partially verified · ⬜ not yet swept

---

## A. Discrepancy table (side-by-side)

| # | Scenario | Client app (correct) | Our UI today | Root cause | Fix surface | Status |
|---|----------|----------------------|--------------|------------|-------------|--------|
| 1 | **Per-card Height row when a Line is selected (carcase-LINE rows only)** | For cards whose H row is the carcase line (73/80/86): narrows to the selected line — `73`→`[73]`, `80`→`[80]`, `86`→**`[73,86]`** (86 = J-door on the 73 carcase, so 73 stays paired), All→`[73,80,86]`. **Verified general across Base water/cook/store/layout** — not sink-specific. | Always shows all line siblings (`H73 H80 H86`), regardless of the active line. | UI never filters `parameters.height` by toolbar line/heightClass (`renderCardConfig`/`cfgRow`, no `F.line`). | **UI**: filter line-based `p.height` pills by active line; keep 86 paired with 73. Pills carry the line in the `H73/H80/H86` label; add optional per-pill `lineGroup` for the 86↔73 pairing. | ✅ |
| 1b | **Height row for height-CLASS rows (Tall/Wall/Midway + tall-storage cards inside Base)** | Shows the full height-class set (e.g. `47,53,60,93` / `190,204,217`), moves selection only — **no collapse**. | Same (shows all). | — | **No change — parity.** | ✅ |
| 2 | **Depth filter greys vs hides; native depth** | Selecting D=68 keeps the family's native (58) face card **visible but greyed**. All sinks grey at 68; base cabinets grey at 36/48. Card's own D-row still offers `68` as an in-card alteration. | HIDES the native face and **surfaces the 660 mm `…68` units as available cards** (API `depthClass=68` → 709 sink units, 18 types). Nothing greyed. | Depth is a **server hard-filter (hide)**, not a client grey gate. "Grey, don't hide" toggle is **dead/unwired**. `availableFromCaps.depthOk` gate exists but depth never routes through it. | **UI + API behaviour**: route depth through the `availableFromCaps` grey gate (like Gates) instead of a server hide; keep native face as the (greyed) card. `depthClasses` already correct (face `[58]`, siblings `[68]`). | ✅ sinks; 🔶 other cats (grey-counts captured per group, per-family diff pending) |
| 3 | **"Ty" / "D" option pills crossed-out + disabled** | Crosses out **and disables** pills not orderable in this config — **95 Ty + 7 D pills** in default state (state-dependent, can grow). No other option-row type crosses by default. e.g. `GFVK8073Z2XM`→`S2ZM` struck+disabled. | Renders them **normal, clickable-looking** (navigate nowhere). | Export **drops** scraped `crossedOut`/`available` in `mapParameters` (only `{group,label,sku}` survive). UI `optState` deads only on `available===false && !sku` or `crossedOut===true` — a skuless pill with neither flag stays "normal". Skuless ⟺ crossed = 21/21 TP, 2 FP (implicit, not reliable). | **Data + schema + UI**: re-add explicit `crossedOut`/`available` on option pills; stop stripping in extractor (scrape the **grid** pill state, not the detail panel); expose in ingest/CRUD/admin. UI `.xed`/`.dead` already supported. | ✅ |
| 4 | **Width pills** | Toolbar W filters the grid but does **not** collapse the card W row (always shows all widths, selection marked). | Same (shows all widths). | — | **No change — parity.** | ✅ verified |
| 5 | **Tier (FRONTS P/P1/C/C1/A) + Gates (E-front/V-handle/Antoso/Opening/DoorLine)** | Card grey/hide via the 8-gate `availableFromCaps` (`tierOk`/`twinTiers`/`opening` + gate flags). Client keeps some cards visible-but-greyed. | Gates: our UI greys via `availableFromCaps`+`applyGateGrey` (wired). Tier: backend **hides** non-matching (`availableTiers`), same hide-vs-grey gap as #2. | Caps gates verified 99.997% (CLAUDE.md); the only gap is the recurring **hide-vs-grey behaviour** (see below). | Same behavioural fix as #2 (grey mode). | 🔶 caps OK; behaviour = #2 |

### Unifying insight
The single biggest behavioural gap is **hide vs grey**: the client keeps non-orderable cards **visible-but-greyed** ("not available in this configuration"), while our backend **hard-filters (hides)** on depth/tier/dimension and our "Grey, don't hide" toggle is dead. The per-item *data* (`capabilities`) is largely correct and gate-verified; fixing #2 (route filters through the `availableFromCaps` grey gate, wire the toggle) resolves depth **and** tier **and** width/height greying at once. #1 (height display collapse) and #3 (Ty/D crossed flags) are the two genuinely separate items.

---

## B. Where each behaviour lives (code map, from subagent investigation)

### Backend `D4K-backend/src/design-book/`
- Depth filter: `design-book.service.ts:1336-1348` — `depthClass` matches `capabilities.depthClasses`; **58 & 63 short-circuit to "match all"**, 68 must be explicitly present. It **hard-filters** (non-matches not returned).
- No stored/returned card-level `available`/`greyed`. Only per-pill **programme** annotation (`annotateProgrammeExclusions` `:1096-1132`) using `capabilities.excludedPrograms`.
- `capabilities` ships on every list card (NOT in `LIST_OMIT` `:90-101`) → client-side gating works.
- Item schema `design-book-item.schema.ts`: `capabilities` + `parameters` are loose `Object`s. Ingest `normalizeItemDoc` `:303-319` is a pass-through spread (any nested shape is stored verbatim). CRUD `UpsertItemDto` validates `capabilities`/`parameters` only as `@IsObject()` → **new nested fields are already storable** without DTO changes, but unknown TOP-LEVEL keys are rejected (whitelist).

### UI `D4K-backend/public/design-book-ui.html`
- Card grey = `availableFromCaps(it.capabilities, toolbarState())` only (`cardEl` `:846-851`, gate `:523-541`). `depthOk` `:534`.
- Depth pill → `setF('depthClass',..)` → server filter (`params()` `:542-553`) → **hide**. `#greyHide` checkbox `:346` has **no handler** (dead).
- Option pills: `optState` `:871-884` already supports `.xed` (`crossedOut===true`) and `.dead` (`available===false && !sku`); CSS `:192-196`. **Gap:** nothing sets those flags — export doesn't ship them, and the UI never computes them from the toolbar.
- Height row: `renderCardConfig:956` passes `p.height` straight through — **no line/heightClass filtering**.

### Export `d4k-items-extraction/`
- Extractor `docs/export-v781-extractor2.js`: **rich** scrape `scrapeConfigure` `:261-291` DOES read `chipAvail()` `:178-191` and `chipCrossed()` `:192-194`, but the **thin** mapper `mapParameters` `:445-469` emits only `{group,label,sku,swatch}` — dropping `available`/`crossedOut`. ⚠️ `chipCrossed` reads the DETAIL panel (`#pin`), which only greys; the real grid strike is in the grid renderer — so re-enabling the existing scrape is not enough, must scrape the grid pill state (as this audit's sweep did) or read the underlying unit flag.
- `capabilities.depthClasses` `scripts/compute-capabilities.js:109-117`: `D2CODE={340:36,460:48,560:58,660:68}` ∪ `u.dv` ∪ `u.d[]`. `depthOk` short-circuits 58 & 63. No native-vs-alteration provenance (not needed for the gate).
- Schema `docs/export-schema-v2.ts`: `OptionPill{group,label,sku,swatch}` `:286-291` and `DimPill` `:265-270` have **no** availability/crossed field (dropped in v2, "state is derived").

---

## C. Config-flag design — FULLY DATA-DRIVEN (nothing hardcoded in the UI)

**Design contract:** the UI is a generic renderer. It never encodes any category rule, any
"collapse", any "cross out", any pairing. It only reads per-pill / per-item flags and renders them.
Every flag below is stored on the item, emitted by the extractor, accepted by ingest + CRUD, and
editable in the admin. If the client changes a behaviour, we change **data**, not code.

### C0. PRIMARY source of truth = `capabilities`, DERIVED (not static per-state flags)
A static `crossedOut`/`available` records only ONE toolbar state; the client re-decides every pill on
every toolbar change. So the primary source of truth is each item's **`capabilities`**, run through the
shared **`availableFromCaps(caps, toolbar)`** port:
- **Card grey** = `availableFromCaps(item.capabilities, toolbar) === false`.
- **Pill grey/dead** = `sku == null` OR `availableFromCaps(targetItem.capabilities, toolbar) === false`
  (targetItem = the item `sku` points to).
- This is why the 95 crossed Ty pills need no flag: they are **skuless** → dead in every state
  (`sku == null`). Targeted-but-unorderable pills derive from their target's caps.

⭐ **Enabling fix (unlocks all per-pill greying):** the API must **project `capabilities` onto every
pill target** (list rows + `expand=refs`); today `resolveRefs` does not (the KNOWN GAP). Then the UI
derives every pill state from data — zero hardcoded checks. The static fields below are SECONDARY.

The model is: `capabilities` (derived, primary) + 3 optional per-pill fields for what gates can't express:

### C1. Per-pill state fields (apply to `DimPill` W/H/D and `OptionPill` Ty/etc.)
```ts
interface Pill {
  label: string;
  sku: string | null;          // null = no navigation target (dead)
  // --- config flags (all optional; absent = default/neutral) ---
  available?: boolean;         // false → greyed (kept visible, not clickable)
  crossedOut?: boolean;        // true  → struck-through + disabled
  showUnderLine?: number[];    // toolbar-LINE values under which this pill renders.
                               //   absent/null = always shown (height-CLASS rows, W, D, Ty…)
  // existing: alteration?, code?, swatch?, tier?/opening? (programme)
}
```
UI rendering rule (generic, the ONLY logic — reads flags, decides nothing itself):
- **visible** = `showUnderLine == null || toolbar.line == null || showUnderLine.includes(toolbar.line)`
- **crossed/disabled** = `crossedOut === true` (→ `.xed`) — already supported by `optState`
- **dead** = `available === false || sku == null` (→ `.dead`) — already supported
- **selected** = `sku === card.sku` (depth: by label) — already supported

### C2. How each scenario becomes pure data

- **#3 Ty/D crossed+disabled** → set `crossedOut:true` (and/or `available:false`) on those pills.
  Extractor already *scrapes* this (`chipCrossed`/`chipAvail`); stop stripping it in `mapParameters`
  and source it from the **grid** pill state. Admin: per-pill "crossed / disabled" toggle.

- **#1 Height collapse + 86↔73 pairing** → set `showUnderLine` on each height pill:
  `H73 → [73,86]` · `H80 → [80]` · `H86 → [86]` (a line-cabinet). Height-CLASS pills
  (`H47/H190/…`) and W/D/Ty pills simply omit `showUnderLine` → always shown (parity, no collapse).
  The 86↔73 pairing is DATA (73's list contains 86), never a UI special-case. Extractor computes
  `showUnderLine` per pill by driving the client at each line and recording where the pill appears.
  Admin: multi-select "show under lines" per height pill.

- **#2 / #5 Depth & tier grey-not-hide** → availability already lives in `capabilities`
  (`depthClasses`, `nativeTier`/`twinTiers`, gate flags). Two changes make it configurable + correct:
  1. DEPTH grey-not-hide — **DONE** (commit `69fa7042`): the client greys depth-mismatched cards **by
     default** (NOT behind the "Grey, don't hide" toggle — verified: toggle off, cards still grey). So the
     fix was UI-only: the grid stops sending `depthClass` as a server filter (`params()`); `cardEl` already
     greys via `availableFromCaps(depthOk)` using `F.depthClass`. Now the family's native face is returned
     and greyed, not hidden, and the 660 mm "…68" units no longer surface as cards. Verified: Sink Cabinets
     @ D=68 → 18 families returned, all 18 greyed, 0 surfaced as 660 mm. Tier/programme can follow the same
     pattern (drop the server filter, grey via caps) if their grid behaviour needs it.
  Optional per-item escape hatch `capabilities.forceAvailable?` / `hideWhenUnavailable?` for
  one-off overrides, editable in admin.

### C3. Storage / plumbing (no blocker)
- **API caps-projection — DONE** (commit `9195809f`, `feat/client-ui-parity-audit`): detail drawer already
  projected pill-target `capabilities` (`resolveRefs` + `collectRefSkus`); list/section/family now take opt-in
  `?refs=true` → page-level `refs` map { sku → { name, capabilities, imageUrl, … } } for every pill target.
  Default responses unchanged (non-breaking). Verified 8/8 targets resolve with caps. This unblocks all
  per-pill greying in the grid. (Still TODO: a `grey=true` list mode to return-and-grey instead of hiding.)
- Schema: add the 3 pill flags to `OptionPill`/`DimPill` in `export-schema-v2.ts`; `parameters` is a
  loose `Object` in Mongoose so **no migration** — new keys just persist.
- Ingest + CRUD: `parameters`/`capabilities` already accept arbitrary nested shape (`@IsObject()`),
  so the flags flow through today; we only document + surface them.
- Admin UI: add the per-pill controls (crossed / disabled / show-under-lines) to the option/dimension
  row editors so the client edits behaviour without a re-extract. **DONE** (commit `994b0479`): `makeRowList`
  gained a `list` column; height pills → `showUnderLine`, depth+option pills → `crossedOut`. All 17
  capabilities were already editable with a live `availableFromCaps` preview.
- Normal UI (design-book-ui.html): **DONE** (commit `994b0479`) — grid loads `?refs=true`, card + drawer pills
  derive greying from `availableFromCaps(target.caps, toolbar)` (GRIDREFS/REFS); `optState` fix `sku==null→dead`;
  height `showUnderLine` filter wired (inert until data). Verified: 54 caps loaded, pill greys `.off` under C1/depth68.
- Extractor: emit `available`/`crossedOut`/`showUnderLine` (already scraped or cheaply derivable by
  driving the client per line) instead of dropping them.

---

## D. Coverage / what remains
- ✅ All 21 task groups swept for: per-card pill rows (crossed/disabled/grey) and per-card greying at all 5 depth classes.
- ✅ Height/line behaviour: line-based rows collapse (73→[73], 86→[73,86]); height-class rows don't. General across Base water/cook/store/layout; Tall/Wall confirmed class-based.
- ✅ Width: confirmed parity (no collapse).
- ✅ Crossed/disabled: confined to Ty + D rows in default state (other option types clean by default).
- ✅ Tier/gates: caps-governed (verified elsewhere 99.997%); behaviour gap = hide-vs-grey (#2/#5).
- 🔶 Remaining (lower value — validation, not new classes): exact per-family tier/depth grey diff vs our `availableFromCaps` (a differential test running the port over the export); crossed/disabled under non-default toolbar states (tier/gate/depth combos) — the fix (per-pill flag or target-caps gate) covers these regardless; Midway height rows (inferred class-based).

## F. Differential harness (mechanical parity check — "stop missing cases")

Two independent availability mechanisms, so two parts.

### Part A — unit gate-availability (BUILT ✅)
Compares, for **every unit × a 21-state toolbar matrix**, the client's own
`available(u)` (= `progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk`,
reading the toolbar `state`) against OUR `availableFromCaps(capabilities, toolbar)` over the export.
- Ground truth: `scripts/client-avail-matrix.inpage.js` (run in the live page → sink `client_avail_matrix.json`; calls the client's real `available(u)`, no rendering).
- Comparator: `scripts/diff-availability.js` (our port verbatim from `export-schema-v2.ts`; reads `docs/export-v781-fresh.json`).
- Matrix: default, tier∈{P,A,C,P1,C1}, depth∈{36,48,63,68}, handle=V, front=1, open∈{P1,C1}, antoso, doorline∈{J,Y}, + interactions (tier×depth, front×door, tier×antoso).

**Result: 371,540 comparisons → 7 mismatches (0.0019%).** All 7 are one bug:
`compute-capabilities.js:140` `nativeTier: u.fam || null` leaks a **family id** (`"F1961__CKDUP"`,
`"F2010__DRWDUP"`) into `nativeTier` for 7 dup-family accessories (ANFLU/ANFLL/ANC1VFLL/ANFLR/ANC1VFLR/ANSZ/ANSZBL),
so our `tierOk` wrongly rejects them at tier=P (client shows them). **Fix:** `nativeTier: ['P','A','C'].includes(u.fam) ? u.fam : null`,
then re-emit caps + backfill. Everything else: **exact parity** on all 7 non-programme gates and their interactions.
**Programme-inclusive run** (`scripts/diff-availability.js scratchpad/client_avail_prog.json`, 32 states = BOSSA×{tier,depth,front} + 12-programme sample ×{front0,front1}): **587,264 comparisons → 11 mismatches, ALL the single `FRMAT` unit** (known residual: its max-size-table vs our blanket `isFrmatFamily`). `bossa@C1`, `bossa@d68`, `bossa@C1d68`, `bossa@f1`, and every `@f1` (E-front) state = 0 mismatches. Confirms `progOk (excludedPrograms/excludedProgramsE) && tierOk && depthOk` matches the client across the full parameter space.

**Combined: ~959k comparisons → 2 defect classes** — 7 units `nativeTier` leak (fix above) + 1 unit `FRMAT` (known). Top-filter card availability is proven data-driven and correct.

### Top-filter card disabling — CONFIRMED covered by Part A
Every top filter is a toolbar input to one gate, sourced from one capability field: depth→`depthClasses`,
tier→`nativeTier`/`twinTiers`/`opening`, front/handle/antoso/open/doorline→their flags, programme→`excludedPrograms`.
Worked example (image): DW fronts `GFV6086SZ2M`/`GFV6086Z2M` have `depthClasses:[58]` → client `available()`
= `{58:1, 68:0, 36:0}`, our `availableFromCaps` identical. So "why did these disable at depth 68" = `depthClasses`
lacks 68. Editable in admin, no code.

### MEMBERSHIP gap found (feeds Part B1)
`C1GFV6073S2ZM` is in the export but its base `GFV6073S2ZM` is **absent** (present in the client raw data).
This is the tier×option-existence pattern: the `S2ZM` variant exists at C1 but not the base tier, so the client
strikes it at other tiers. Part B must include a **membership check**: does the export contain every unit the
client can navigate to, per tier (base + P1/C1/C/A resolutions)?

### Part B1 — navigation-pill target existence (BUILT ✅ `scripts/diff-pill-targets.js`)
Scans all 256,937 pills: 188,506 navigation, 63,273 same-item state, 5,158 dead (skuless).
**8,239 navigation pills (all `programme` row) point to tier codes not stored in the export** (7,598 distinct,
every one has a stored tier-sibling). BUT these are **not 404s** — the backend **synthesizes** tier variants
(`GET items/T3086IS2IZ → 200`, even though absent from export AND client raw data; C/A/P1/C1 all synthesized).
So referential integrity holds. The real gap this exposes:
- **Programme/tier pills need per-pill availability derivation.** The client *greys* tier-mismatched pills
  (screenshot: "7 available · 3 greyed (not in BOSSA-C)"). Our UI can't reproduce that because the API does
  **not project pill-target `capabilities`** (the KNOWN GAP). Fix = project caps onto pill targets →
  `available = availableFromCaps(targetCaps, toolbar)` per pill. No new stored data; it's the enabling projection.
- Membership: no orderable unit is missing (synthesized codes resolve); the "missing base" appearance is just
  tier variants that are synthesized on read, not stored.

### Part B2 — same-item state-pill dependencies (BUILT ✅ — RESULT: none exist)
Empirical test (clean toolbar, sink card `TSP6080ZW`, toggle its own depth state pill):
`D=68` → code re-cuts `TSP6080ZW→TSP608068ZW`, **0 sibling changes** (H/W/Ty unchanged); `D=63` same.
Mechanism confirms it: a same-item state pill only re-cuts the ORDER CODE — the unit and its `capabilities`
are unchanged, so nothing derived from caps can change. The one historical candidate (Insert/`blockIns`) is a
fixed mis-scrape, now navigation.
**Conclusion: there are NO genuine intra-item state dependencies.** Every "changes availability" interaction is
NAVIGATION (different unit → B1) or a TOOLBAR gate (→ Part A). **`disabledWhen` config is NOT needed** — drop it
from §C1. The design simplifies to: caps-derived availability + per-pill target-caps projection + `showUnderLine`.

### Part B2 (superseded plan) — same-item state-pill dependencies
Distinct from gate availability: a Ty/option pill crosses when its target, **resolved for the current
tier** (C→`CTSP…`, P1→`P1…`), doesn't exist as an orderable unit — e.g. `BSZW` has no P-tier unit
(`TSP6073BSZW` absent) so it crosses at P, but `CTSP6073BSZW` exists so it lives at C. Our single-sku-per-pill
model can't tier-resolve. Harness: drive the client render/openDetail per card × tier, scrape each option
pill's crossed/dead state; compare to our tier-resolved target existence + `availableFromCaps`. Output the
per-pill mismatches → these define the missing pill-target data (per-tier sku, or an existence map).

## E. Repro
```
# serve client app
cd data-from-client && python3 -m http.server 8777   # open http://localhost:8777/leicht_units__781_.html
# backend running on :8000 (node dist/main.js from D4K-backend root); dev token via /design-book/dev-token
# client sweeps: drive page globals + scrape grid (see scratchpad/*.json for outputs)
```

## F. What SHIPPED (parity achieved — on `dev`)

Verified with the grid-parity differential harness (`scripts/diff-grid-parity.js`, 48 sink toolbar combos,
411 family comparisons, client rendered grid = ground truth):

| Dimension | Result |
|---|---|
| **FACE** (which variant renders per card) | **0 mismatches** ✅ |
| **GREY** (available vs disabled per card) | **0 mismatches** ✅ |
| **MEMBERSHIP** (which families render) | 9 combos differ (1 family, see §G) |

Backend fixes landed on `dev` (all data-driven, no hardcoded hides):
- **Depth grey-not-hide** — depth routes through the `availableFromCaps` grey gate (`?grey=true` skips the
  `depthClass` hard-filter, returns-and-greys); native face kept, greyed. `depthMm:1` face tiebreak so the
  base unit wins the face (not a 68 sibling).
- **Face default HEIGHT** — `faceHeightClass` + `_faceHeightRank` keep the family's default-line face when a
  width filter removes the exact default-face unit (H=ALL default face 80, not lowest 73).
- **Face default VARIANT (Ty)** — `variantCore`/`faceVariantCore` + `_faceVariantRank` keep the family's
  default variant across heights (XTR_Z default `TSP6080ZW` → at H73 shows `TSP6073ZW`, not `TSP6073ZBS`).
- **Per-pill target caps** — `resolveRefs` + list `?refs=true` project `capabilities` onto pill targets so
  per-pill greying uses `availableFromCaps(targetCaps, toolbar)`, not the parent's caps.
- **Height + Width `showUnderLine`** — per-family per-pill line-collapse data (extracted from the app),
  backfilled; UI narrows W/H rows to the active line (H86↔73 pairing preserved). Settable via admin.
- Extractor `nativeTier` guard (P/A/C only, was leaking family-id); emits `showUnderLine` for W+H.

Backfills applied to D4K-dev: `backfill-face-height-class.js`, `backfill-face-variant-core.js`,
`backfill-show-under-line.js`, `backfill-show-under-line-wh.js`.

## G. REMAINING WORK — family-level membership (SNK8-type, deferred)

**Symptom (client complaint "same filters showing different items"):** 9 toolbar combos, **all 1 family
(`SNK8`), all at H86** (W60/80/120 × D58/63/68) — client shows the family, our API hides it.

**Root cause (isolated):** the client's `selectedUnit` **pool logic** is family-level, ours is unit-level.
- Client: a family renders if it has a unit matching **each selected dimension INDEPENDENTLY** (a W60 unit
  in one variant AND an H86 unit in another). The face is the family's **default variant shown at its own
  width**, ignoring the toolbar width when that variant lacks it.
  - SNK8 @ W60/H86: face variant `…BTZW` ("40 cm blender") only exists at **W90/100**, so the client shows
    `TSPQ9086BTZW` (W900, h86, LIVE) and its width row reads `90,100` — the W60 filter is ignored for it.
- Ours: `buildItemFilter` matches `widthMm`/`heightClass` at the **unit** level → SNK8 needs one unit at
  600×86 (none) → hidden.

**Why NOT fixed yet (risk):** matching it needs (1) family-level W/H/D membership and (2) a
**width-preferring face** (default variant at the selected width if it exists, else the variant's native
width). Removing the unit-level width filter risks regressing the **width-respecting** face that is correct
for most families (SNK1 @ W45 → `TSP4580`, W45; must NOT become the W60 default). The grid-parity harness
only covers sinks (48 combos), so a broad change could regress Tall/Wall undetected.

**Proposed fix (when prioritised):**
1. `buildItemFilter` grey mode: drop unit-level W/H/D `$match`; add a post-`$group` `$match` requiring the
   family to have ≥1 unit per selected dim independently (`hasWidth`/`hasHeight`/`hasDepth` booleans).
2. Face sort: prefer `variantCore == faceVariantCore`, then `widthMm == selectedWidth` (if present in that
   variant), then the existing `_faceHeightRank`/`_faceVariantRank`/`depthMm` chain.
3. Re-run `diff-grid-parity.js` (FACE + GREY must stay 0, MEMBERSHIP → 0) AND spot-check Tall/Wall leaves
   for face regressions before merging.

**Recommendation:** confirm SNK8/H86 is an actual client-reported case before the broad rework — it is 1
family / 9 combos against a whole-catalog regression surface. FACE + GREY (the core complaints) are 100%.

## H. GLOBAL HEIGHT (73/80/86) IS NOT A FILTER — and the W/H pill skus are DETAIL-model (2026-07-27)

Client report: "same section, different SKUs" under Sink Cabinets (our grid showed `TSP6073…` faces where
the app shows `TSP6080…`). Root-caused by driving the app; **three separate findings**:

1. **The app has NO global carcase-height (73/80/86) filter.** Its toolbar Height row is the TALL
   selector: `availHeights()` offers only standard tall heights (`tallHC` — 146/190/204/217 @line80,
   153/197/210/224 @line73) present in the result set; `renderHeightSel` RESETS any other value to All
   (verified: `state.height=73; render()` → back to `'ALL'`). `state.height` does exactly three things:
   family-level membership `unitsInHeight` (some unit, tall-canonicalized), face PRE-SELECT in `_selUnit`
   (v329 `_gH` — only when the pool has that height, else face untouched), and an `hwarn` badge. Our lite
   UI offered `H 73/80/86` as a server `heightClass` hard-filter — producing grids the app can never render
   (membership dropped + face fell to the LOWEST width: SNK1 → `TSP4573`, not `TSP6073`).
   **Fixed (UI-only):** `params()` never sends `heightClass`; the pick is applied as a per-card pre-select
   (`applyHeightPreselect`): same membership, card swaps to its height sibling where the family has one,
   stays on its default face otherwise (SNK9 at 86 stays `CTSP6080BSZ`, not hidden). Verified 16/18 exact
   vs per-card `pickHeight(fid,73)` (the 2: see #3).

2. **Stored W/H pill skus are the DETAIL panel's, which the app itself points at the 68-DEPTH sibling.**
   Sibling-depth families (§2c-2 model A) list d68 units FIRST, and `openDetail`'s W/H chips resolve
   through that order: the app's own detail for `TSP6080B` (d58) has `H73→TSP607368B`, `60→TSP608068B` —
   **even H80 → `TSP608068B`, not self**. The GRID's `pickHeight`/`pickHWidth` instead preserve the other
   dims (d58). So navigating card pills by stored sku reproduced the app's *detail* behaviour in the *grid*.
   **Fixed (UI-only):** card W/H pill clicks + the pre-select route through `swapCardTo` — an
   `items?familyId=…&heightClass/widthMm=…&groupBy=family` query **(⚠️ superseded by §K: the height key is
   `heightCode`, which also exists outside carcase-line families; W/Ty swaps must carry it too)**;
   the face rank's `depthMm` ASC tiebreak
   lands the native-depth unit (`TSP6073B`). The detail drawer keeps pill-sku navigation (that IS app
   behaviour there). Verified: card `TSP6080B` → W45 → `TSP4580B` (was `TSP458068B`).
   ⚠️ The client React app must do the same: never navigate grid W/H pills by `pill.sku` directly —
   resolve through the family (or the API grows a "grid-target" pill field later).

3. **`visibleByLine` conflation removed:** the H pick was feeding the `showUnderLine` narrowing as if it
   were a LINE. The app collapses W/H rows ONLY under a selected LINE (`lineHFilterB`: 73→[73], 80→[80],
   86→[73,86] — our stored `showUnderLine` data matches it exactly); a height pick just moves the
   selection. Now only `F.line` narrows.

**Residual (2/18, new §G-class entry):** families whose requested height exists only under another
TIER/variant (`XTR_Z2`/`XTR_BZ2`: h73 units are C/C1-only, so the app's `ppool`-derived H row is [80,86]
— no 73 chip at base tier; our static pills still show H73 and the pre-select swaps into the C-tier face).
Needs per-tier pill existence (the §C2 tier-resolution gap). Deferred with SNK8.

### §H CORRECTION + Ty pills (same day, follow-up screenshot)

**Correction to #1:** the app DOES have a top toolbar "H All 73 80 86" bar in Base context — it is the
**LINE selector** (`#lineSeg` → `state.line`, a STRING). Clicking 73 both **re-faces** every card
(`_selUnit` lineH) and **collapses** its W/H rows via `lineHFilterB` (SNK1: H → `[73*]`, W loses 55) —
verified fresh-DOM (the earlier "no collapse" scrape was stale). Membership unchanged. So the earlier
change disconnecting the H pick from `showUnderLine` narrowing was wrong — **reverted**: `visibleByLine`
feeds `F.heightClass` (then `F.line`) again. Net model for our H bar = the app's line bar: no server
filter + per-card pre-select re-face + `showUnderLine` row collapse. All three now shipped together.

**Ty/option pills had the same detail-panel disease as W/H (#2)** — stored targets are the app detail's
68-depth codes (`TSPA8073TZW`: `TZW→TSPA807368TZW` (its own d68 twin!), `TZ→TSPA907368TZ`), so:
- clicks landed d68 cards, and the SELF variant never showed selected (sku equality can't match the twin).
- **Fix (API + UI):** new `QueryItemsDto.variantCore` filter (`buildItemFilter`) + `resolveRefs` projects
  `variantCore`/`widthMm`/`heightClass` onto refs. UI option-pill picks resolve
  `familyId + variantCore(target) + heightClass + widthMm` through `swapCardTo` (fallbacks drop width,
  then height); when the refs map lacks the target (a swapped-in card), the pick fetches the target once
  for its `variantCore`. Selected = target `variantCore` == card's (`markVar`); W/H rows also
  label-match selection (`markDim`) since the self pill's sku is the d68 twin.
- **Verified:** `TSPA8073TZW` card @H73 renders `H:[73*] W:[80*,90] Ty:[TZW*,TZ,TZBS]`,
  `TSPQ9073BTZW` renders `Ty:[BSZW†,BTZW*,BTBS,BTZ]` (struck BSZW dead) — pixel-matching the client
  screenshot; Ty TZ → `TSPA9073TZ`, BTZ → `TSPQ10073BTZ` (native depth, correct width switch).
- **Follow-up (same day):** swapped-in cards weren't covered by the page `refs` map → variant SELECTED
  mark + per-pill greying silently dropped on them (`TSP6073ZW` Ty ZW unselected vs client). Fix: the
  swap queries pass `refs=true` and merge the response refs into the page map. Rule for the React app:
  **whenever a card is replaced from a follow-up query, merge that response's `refs` too** (map §2c-8).
- **Follow-up 2 — `showUnderLine` completeness audit + the `0` convention (same day).** Question: can the
  W/H hide rule stay 100% admin data? Measured: Base ✅ (already shipped) · single-system tall rows never
  collapse (the app's filter would empty the row → falls back to full set; this is what #1b actually
  observed) · **two-system tall rows (97 families — `HP20146…`, `HPEEW9190…`, `GF46204…`) DO collapse AND
  hide the 73-system pills even at "All"** — inexpressible under "no line → show all", and NO
  showUnderLine data existed for them (0/97). Fix, still pure data: `0` = the All state as a valid array
  value (schema note, additive); render = `includes(line ?? 0)`; backfill
  `backfill-show-under-line-all0.js` (7,723 docs: two-system talls stamped `[0,80]`/`[73,86]`, all
  pre-existing arrays get `0` prepended); extractor drives 'All' + Tall groups. Verified: `HP20190` H row
  at All = `154/190/204/217/250`, at 73 = `153/197/210/224` (app-exact); Base rows unchanged.

### §H-2. THE STALE-HIGHLIGHT TRAP — a "W45 + H73" screenshot that was really W45 + H-All (2026-07-27, later same day)

Screenshot #3 appeared to show v781 at **Sink Cabinets + W45 + H73 + D58** rendering `TSP4580/…Z/…B/…BZ`
(default-line h80 faces, H row FULL `[73, 80*, 86]` with line underlines, W row incl. 55) while our UI
showed `TSP4573*` + collapsed `[73]` rows. First hypothesis ("width beats line", briefly shipped) was
WRONG and is reverted.

**Real cause — v781 seg-highlight desync.** Verified live:
- v781 with line 73 genuinely applied gives `TSP4573` + H `[73]` in EVERY state — real clicks, both
  click orders, filters-set-before-leaf, `lineGrey` on/off, `_selUnit`/`hvals` sims. No state produces
  the screenshot with `state.line='73'` (face h=80 requires line ALL; full H row requires
  `lineHFilterB` pass-through = line ALL).
- v781 at **W45 + H-All + D58** reproduces the screenshot EXACTLY — same 4 faces in the same order,
  same rows, same "6 types" — **including the stale lit "73" chip**: `#lineSeg` button classes are set
  only in the seg's own click handler and are never re-synced from `state.line` on render, and the tall
  selector's LINE row drives the same `state.line` without touching the Base seg. Set `state.line`
  programmatically (or via the other control) and the old highlight stays.

**Outcome: our UI was already correct** (it matches v781 for W45+H73 → `TSP4573*` collapsed, and for
W45+H-All → `TSP4580*` full rows). The temporary width-beats-line change in `design-book-ui.html`
(`applyHeightPreselect` skip + `visibleByLine` fallback on `F.widthMm`) is **reverted**. Lesson for all
future screenshot comparisons: **trust the cards (face sku + row shape), never the toolbar chip
highlight** — v781's chip can lie.

### §I. W FILTER = FAMILY MEMBERSHIP + TIER-POOL FACE — the "W50 Sink Cabinets" report (2026-07-27, evening)

Client report: Sink Cabinets + W50 + H73 + D58 — our grid showed different cards than the app
(screenshots: app cards `TSP6073BZ2`-type with W rows starting at 60; ours showed `CTSP50*` C-article
faces at the "right" width). Driven live against v781:

- **Membership was NEVER the gap** — both sides showed the same 14 families. v781's `unitsInWidth`
  counts ALL units (any tier/height): SNK3 passes W50 via its stored Contino sibling `CTSP5073Z2`.
- **The FACE was the gap.** v781's `_selUnit` picks the face from `ppool` — the default programme
  line — and falls back to the default width when the pool has no W match at the picked height:
  SNK3 @W50+line73 faces `TSP6073Z2` (W60, P), never the W50 C article. Our pipeline hard-filtered
  `widthMm` and face-ranked the surviving (all-C) units → `CTSP5073Z2` ✗.

**Fix (backend `familyGroupStages`, D4K-dev):** lift `widthMm` from `$match` into ranks —
`_famFaceTiers` (window: the `faceForTiers`-flagged unit's `availableTiers`, computed BEFORE the
heightClass post-match so a flagged face at another height still defines the pool), `_widthRank`
(W match ∩ face-tier-pool, sorted before `_faceRank`), `_wHits > 0` post-group membership (skipped
when `familyId`-scoped: swaps treat width as a wish — SNK4 H73 swap → `TSP6073BZ2` though its W50
units are C@86 only). Plus `WIDTH_BUCKETS` (app `width_groups`: 60→610/650, 76→750, 80→820,
90→910/920) and a `$ifNull` so missing `widthMm` still counts as a null match (agg `$in` doesn't
equate missing with null; the old query-side `$in` did).

**Dead ends kept for the record:** (1) global "pool = P" broke A/C-only families (F1304 `CT45*`,
F970 `AH45*`, SNK9) — the app's `_hasP` fallback pools ALL units there; (2) window AFTER the
heightClass match erased the pool on swaps (XTR_Z2 H73+W50 → wrongly `CTSP5073Z2W`). The pool is
per-family = the FLAGGED FACE's own tier set, computed pre-height-filter.

**Verification (24-combo × whole-catalog sweep, 12,240 face comparisons vs v781 `visibleBlocks`):**
faces 937 → **883** (fixed 60 — all client-visible sink/K cases; broke 6, all inside the GF-housing
tall families already wrong at baseline §H residue); **membership deltas 0**; Sink Cabinets leaf
14/14 exact at W50/W50+H73/W45+H73/W60/defaults. Residual 883 = pre-existing tall/appliance-housing
face-data defects (baseline-wrong at ALL|ALL too) + unmodeled `nowf`/hidden-family membership — not
touched by this change. Map §2c-9 has the contract + client rule.

### §J. SECTION ORDER + single-card header-suppression — "W50 Trash Pullout shows 4 vs client 5" (2026-07-27, late evening)

Client report: Sink Cabinets + W50 + H73 + D58 — under "Sink Units with Trash Pullout" the app shows 5
cards, ours 4. The 5th = `TSPQ9073BTZW` (family SNK8, "Instant Hot Sink Blender — 40 cm door").

Driven against v781: SNK8's `sec` is literally **"Instant Hot Sink Units"** (static family field) — so
this is NOT a data error (both sides agree SNK8 is Instant-Hot). It's the app's SECTION RENDER rule in
`renderGrid`, which ours didn't port:

- Bucket the (pri-sorted) blocks by `sec`; **emit a header only when the bucket has ≥2 cards OR the sec
  is in `FORCE_SEC`** (a fixed 111-name set). A single-card non-forced section gets NO header and its
  card flows into the previous section's run. At W50 the ONLY Instant-Hot family with a W50 unit is SNK8
  (SNK5/6/7 W80, ADD W100 drop) → "Instant Hot Sink Units" bucket = 1 card → header suppressed → SNK8
  renders as the 5th card under "Sink Units with Trash Pullout".
- Section order = **`SECTION_ORDER[sub]`** (curated), else catalog `pri` first-seen — NOT alphabetical.
  Our old by-section sorted `section` alphabetically, which also floated "Sink without drill fronts" to
  2nd (SNK1_ZV shares pri 1 with SNK1).

**Fix (backend, D4K-dev, all data-driven):**
- Backfilled 3 denormalized fields (backfill-only, like `faceHeightClass`; re-run after ingest):
  `catalogRank` (family `pri`, nulls→999), `familyIndex` (FAMS position tiebreak),
  `sectionRank` (index in the app's `SECTION_ORDER[sub]`, 999 = pri fallback). Scripts:
  `backfill-catalog-rank.js`, `backfill-section-rank.js`.
- `familyGroupStages`/`listItemFamilies`/`listItemsBySection` sort by `(catalogRank, familyIndex, sku)`.
- New `bucketSections()` ports `renderGrid` verbatim: bucket by `section`, order buckets by
  `(sectionRank, first-seen)`, emit a header only for `len≥2 || FORCE_SEC.has(sec)`, else append the
  lone card to the previous emitted section (headerless leading group → `section:""`). `FORCE_SEC`
  ported as a 111-entry constant.

**Verification (app `visibleBlocks`/`.sechead` vs our by-section):**
- Sink Cabinets W50: section order + card order + the 5-under-Trash-Pullout merge **byte-exact** (lite
  UI, after per-card H73 pre-select: `Sink Units[4] · with Drawers[3] · with Trash Pullout[5 incl.
  TSPQ9073BTZW] · without drill[2]`).
- Cross-leaf spot check: Cooktop Units headers+cards 8/8, Sinks & Faucets 27/27 — identical.
- Face parity sweep unchanged (883, no regression — the sort/bucket change doesn't touch face selection).

Deferred: `SECTION_ORDER` is modeled as a per-family `sectionRank` (not a stored sub→order map); this
matches every pri-fallback + single-sub view tested. A multi-sub leaf whose app order differs from
min-sectionRank would need the full map + `secOrderKey`/`disp` logic — add if one is ever reported.

---

### §K. H PILLS RENDERED DEAD — the missing per-unit height key `heightCode` (2026-07-28)

**Client report:** "our UI is disabling a lot of height pills under these filters, the client HTML is
not" — screenshots: Programme **BOSSA** · Design-Tasks leaf **Tall → Water → Dishwasher** · **D 58**.
Our grid: `HGA6029BK` renders `H29* H34` live and **H42 H47 H74 H79 H87 H92 H100 H105 H113 H118 grey**;
`HGSP55103Z` greys **H204 H217**. v781 renders every one of those chips live and clickable.

**Root cause — one missing field, two symptoms.** The app's per-unit H key is `u.hc`, and the grid H row
is the FAMILY's set of them (`pickHeight(fid,hc)`). We only stored `hc` when it was 73/80/86
(`heightClass`; extractor line `const hc=[73,80,86].includes(u.hc)?u.hc:null`). Outside carcase-line
families `hc` is the unit's **cm height** (29, 42, 103, 204, 217 …) — so for those families:

1. **Nothing to resolve a pill with.** `heightClass` is null and `?heightClass=29` is a 400 (enum
   73|80|86) → every H pill on those cards was a no-op even when it had a sku (silent 400 inside
   `swapCardTo`). Not visible in the screenshots, but broken.
2. **The pills that looked dead.** `parameters.height[].sku` is the DETAIL panel's target and the detail
   row is VARIANT-scoped: `HGA6029BK` is Ty `BK`, which exists only at 29 + 34 cm, so the export stores
   `{label:"H42"}` with **no sku** — 2,560 such pills over 1,188 items. Our UI's `optState` treats
   "no sku ⇒ dead" (correct in the drawer, wrong on the card): the app's grid chip is live and
   `pickHeight` JUMPS THE VARIANT (`alt = ppool(b).find(u=>u.hc===h)` → `HGA6042`).

Not a greying/capabilities bug at all — `availableFromCaps` was never consulted for those pills.

**Fix (schemaVersion 2.4.0, additive):**
- **`Item.heightCode`** = the app's raw `u.hc`, for every family. Dumped FROM the live app
  (`FAMS[].units[].hc`, 12,048 skus → `docs/height-code-v781.json`), never re-derived — nearest-cm
  inference is provably wrong (`AT3037Z` is 367 mm but `hc` 37, not 40). Extractor emits it now
  (`if(u.hc!=null) it.heightCode=+u.hc`); existing export patched by
  `scripts/backfill-height-code.js`; D4K-dev backfilled with `backfill-item-fields.js --fields heightCode`
  (12,048 docs) — **D4K-prd backfilled identically** (data-only, no prd release needed; re-verified: 0 differ).
  Invariant checked: `heightClass != null ⇒ heightClass === heightCode` (0 mismatches).
- **API:** `GET items?heightCode=<n>` (exact, NOT null-inclusive — a swap must land on a unit that has
  the height), also lifted into the width post-match, `@Prop` + `UpsertItemDto` + admin form field.
- **UI (`design-book-ui.html`):** H picks resolve `familyId + heightCode` (was `heightClass`);
  `optState(o, targetCaps, byLabel)` — the label-routed grid W/H rows no longer treat a missing pill sku
  as dead; `markDim` selects on `heightCode ?? heightClass`.

**Verified (lite UI, same filter state as the report):** `HGA6029BK` →
`H:[29* 34 42 47 74 79 87 92 100 105 113 118]` all live; `HGSP55103Z` → `H:[103* 109 116 122 204 217]`;
click H42 → `HGA6042` (not `HGAG6042` — matches the app's pool order), H204 → `HGSP552047Z`.
Line-family regression: `TSP6080B` + H73 → `TSP6073B` via either key, identical to §H.

**Client rule (React app):** one rule for every H pill — `GET items?familyId=…&heightCode=<label>&widthMm=
<card's>&groupBy=family&limit=1` (retry without `widthMm`); never disable an H pill because
`pill.sku` is null; keep `pill.sku` for the DETAIL drawer only. See map §2c-10.

**Second gap found by the same key (fixed in the same pass):** a **W** or **Ty** swap carries "the card's
height" so the other dimension survives — but it carried only `heightClass`, which is **null** outside line
families, so the constraint silently vanished: `T3027Z` + W50 → **`T5093S7` (h93)** instead of `T5027Z`.
Both picks now carry `heightCode` too, and `swapCardTo` takes a caller-supplied RELAX ORDER: a W pick
relaxes the HEIGHT first and keeps `widthMm` (the app's `pickHWidth` holds the width), while H/Ty picks
still relax the width first. Verified: `T3027Z` + W50 → `T5027Z` (H row `27*`).

**Residual (not part of the report, unchanged):** the Ty row on these cards renders unavailable variants
as dead-grey where v781 strikes them through (`7Z`/`7ZH`/`8Z`/`8ZH`), and a swapped-in tall card can mark
two Ty pills selected (`markVar` + `selMark` both firing). Cosmetic; no data change needed.

---

### §L. FULL CATEGORY SWEEP — Base · Tall · Wall · Midway, every toolbar state (2026-07-28)

Previous passes were report-driven (a client screenshot → one family → one fix). This pass is the
**mechanical version of that loop**: drive BOTH UIs over the same (category × sub-category × toolbar)
matrix and diff the rendered grids card-for-card, pill-for-pill. Same method as §F's harness, but the
truth side is now the app's own `renderGrid()` DOM (not a hand-built JSON) and the comparison side is our
lite UI's DOM (not the raw API) — so it measures what a user actually sees, end to end.

#### Harness (`d4k-items-extraction/scripts/parity/`)

| file | role |
|---|---|
| `sink.js` | CORS-open exfil + script server on **8799** (`POST /save?name=`, `GET /js?f=`) — the extension redacts big tool returns |
| `dump-client.js` | injected into v781: resets `state`/`cardMod`/`cardJump`, applies the combo, calls the app's own `renderGrid()`, scrapes `#grid` |
| `dump-ours.js` | injected into `/design-book/ui`: resets `F`, applies the combo, `await load()` + settle, scrapes `#grid` |
| `make-plan.js` | builds the combo matrix (both sides' driver input under one key) |
| `diff.js` | diffs the two dumps into 9 buckets |

Normalized card shape (identical both sides):
`{fid, sku, code, grey, rows:[{l, p:[{l, s, o}]}], tiers:[{l,s}]}` — `s`=selected, `o`=off/greyed.
`fid` = family id (the app's `openDetail` 1st arg / our `item.familyId`), so cards line up even when the
faces differ. Run: serve v781 on 8777, backend on 8000, `node scripts/parity/sink.js scripts/parity/out`,
inject both dumpers, `__P.sweep(plan)` / `await __Q.sweep(plan)`, then `node scripts/parity/diff.js`.

**Toolbar mapping** — `depth`↔`depthClass`, `width`(cm)↔`widthMm`, `line`↔`heightClass`+`line`,
`prog`(key)↔`programs`, `tier`↔`tier`. 16 states per sub-category: `base`, `d48/d63/d68`,
`line73/80/86`, `w60/w90`, `progP_BOSSA(244)/progA_LAIKA(410)/progC_ROCCA(701)`, `tierC/tierA`,
`w60_line73`, `progP_d68`.

#### Coverage + result (720 combos: Base 192 · Tall 272 · Wall+Midway 256)

| bucket | Base | Tall | Wall+Mid | total | meaning |
|---|---|---|---|---|---|
| `CODE` | 0 | 0 | 0 | **0** | displayed ORDER code — identical everywhere the face agrees ✅ |
| `ROWSET` | 402 | 285 | 63 | **750** | a card's pill-ROW set differs (580 = a row the app shows and we don't) |
| `FACE` | 274 | 32 | 76 | **382** | same family, different face sku |
| `STATE` | 305 | 34 | 20 | **359** | same pills, different selected/greyed flags |
| `PILLS` | 76 | 220 | 51 | **347** | same row, different pill VALUES (337 of them the H row) |
| `MEMBER` | 133 | 56 | 93 | **282** | family shown on one side only |
| `SECT` | 110 | 66 | 92 | **268** | section header list/order differs (mostly downstream of MEMBER) |
| `ORDER` | 7 | 43 | 20 | **70** | card order inside a section |
| `GREY_NOT_HIDE` | 34 | 17 | 46 | **97** | *deliberate*: we grey where the app hides (`?grey=true`, §F1) — normalized out |

#### Root causes (ranked; every one reproduced on a named family)

1. **⭐ Grid pill rows are UNIT-scoped for us, FAMILY-POOL-scoped in the app.** Explains ~all of
   `ROWSET`+`PILLS` and most of `STATE`. Our card rows come from the stored `parameters.*`, which were
   scraped from ONE unit's DETAIL panel; the app builds the grid rows from `ppool(b)`/`hvals(b)`/`wsAtH`
   — the whole family, variant-scoped, and "a height greys only if NO type has it". Evidence:
   `F1715` pool heights = 37/43/50/66, our `parameters.height` = 37/50/66 (43 missing);
   `F1716_A` pool = one height (80) and the app still renders a 1-pill H row, we render none;
   `GFVA_B` at line 80 → app H row `[80]`, ours `[73,80,86]` (no `showUnderLine` for that family);
   Closet talls → ours adds `230/244/250` (real sibling units the app keeps out of the H row).
2. **Tier chip must RE-FACE the card** (`visibleBlocks` v675: `state.tier` → the family's tier twin,
   preserving w/hc/vr). We filter but never swap the face: `tierC` → app `CTW58058`, ours `TW58058`.
   101+79 `FACE` diffs at `tierC`/`tierA`; 42 are pure prefix, the rest also lose the width/variant.
3. **Line/height pre-select doesn't re-face where the H row is wrong** (a consequence of #1):
   `line73` → app `TWS7358`, ours stays `TWS8058`; Closet `line73` → app `H60197GAIZ` (W60), ours
   `H45197GAIZ`. 114 `FACE` diffs across `line73/86` + `w60_line73`.
4. **Accessories/alterations must NEVER grey** (`isAccessory(b)` → `av` forced true, app v163).
   188 of 219 `GREY` diffs are ours-only, dominated by `AN*` alteration codes (`ANW5GSM`, `ANRWFU85`,
   `ANHDTVR3`…) and panel families we grey by `depthClasses` at d48/d68 or by programme.
   `isAccessory` is a family predicate (label regex + `ACC_SUBS` + `cat==='Alteration'` + `^[AC]?AN`
   codes) — capture it from the app like `faceForTiers`, don't re-derive.
5. **Depth 63 = family ELIGIBILITY, not a pass-through** (`d63Eligible(b)` = `d63Cfg(b)!=null`).
   Our gate treats 63 as "always OK" so nothing filters: Base/Accessories&Surround at d63 → app 0 cards,
   ours 20; Base/Fillers 0 vs 12. 30 `MEMBER` combos.
6. **Width membership needs a REAL unit at that width.** The app's `unitsInWidth` matches unit widths
   only; our `$ifNull` null-match keeps width-less families in (`F354`, `F64`, `ANW5*`… at w60/w90).
   33 `MEMBER` combos. (The `$ifNull` was added for the §I face pool — keep it there, drop it from the
   membership test.)
7. **No per-card LINE row.** The app renders a `Line` row (73/80/86 · `J`/`Y`/`E` suffix chips) on
   two-system tall cards; we render none — 119 `ROWSET` diffs, all Tall.
8. **Card order inside a section.** The app sorts `(available desc, pri, accessory last, label-group,
   special last, maxHeight desc, index)` BEFORE bucketing into sections; we sort
   `(catalogRank, familyIndex, sku)`. `XHTAF` before `XHTAL`, `F132` before `TABL` (Wine Units). 70 diffs.
9. **Row LABEL for depth-dimension families.** `b.dim==='depth'` families (`PNL_END`, `PNL_ISL_END`,
   `XTWSP`) show a **D** row in the app; our stored pills live in `parameters.width` so we print **W**
   (`WF68K45`: widths 10/36/48/58/68/80/90/100/120 = depths). Data-side (extractor) mislabel.
10. **Selected-pill grey inheritance** (cosmetic): when a card is greyed the app also marks its SELECTED
    chip `wn`; we leave it clean (and vice-versa on some programme states) — the tail of `STATE`.

#### Deliberate deviations (NOT bugs, normalized out of the diff)

- `GREY_NOT_HIDE` (97): our `?grey=true` shows the depth-mismatched family greyed where the app hides it
  (shipped in §F1 on purpose — the app has the same behaviour behind its "Grey don't hide" checkbox).
- Global H bar = per-card pre-select, no server filter (§H/§2c-7) — membership stays put by design.

#### Status

Harness + measurements committed; **no fixes applied yet** — the fix order is #1/#2/#3 (they carry the
`FACE`/`PILLS`/`ROWSET` mass and #1 is a contract-level change: grid rows would come from the family pool,
computed backend-side, instead of the detail-panel `parameters.*`), then the cheap data-driven ones
(#4/#5/#6), then #7/#8/#9/#10.

---

### §M. SWEEP ROUND 2 — the residue after the §L fixes (2026-07-29)

Continues `docs/parity-session-handoff-2026-07-28.md`. The §L fix pass was measured (task 1), then
every remaining task-board item was traced to a rule in v781 and closed. As in §L, nothing here is
re-derived: each rule was read out of `leicht_units__781_.html` and each input dumped from the
running app.

#### M0. Task 1 — the re-measure (Base, 192 combos, `report-Base7.json`)

| bucket | baseline | after §L (Base6) | **Base7** | note |
|---|---|---|---|---|
| ROWSET | 402 | 7 | **8** | all ANBL (M1) |
| STATE | 305 | 27 | **27** | all `dim:'none'` (M4) |
| PILLS | 76 | 8 | **0** | variant chip labels — the late §L fix, now confirmed |
| FACE | 274 | 134 | **79** | the face-rank reorder, now confirmed |
| GREY | 123 | 31 | **31** | UI-side (M5) |
| MEMBER | 133 | 107 | **107** | M2 + M3 |
| SECT | 110 | 77 | **77** | downstream of MEMBER |
| ORDER | 7 | 25 | **25** | M6 |
| CODE | 0 | 0 | **0** | order codes have never diverged |

The two late §L fixes that `report-Base6.json` under-reported are real: PILLS 8 → 0, FACE 134 → 79.

#### M1. `u.hc` is compared with STRICT `===` — `null` ≠ `undefined` (ROWSET, 8)

Every ROWSET diff was **ANBL** (`ANBLBO`): the app draws a Ty row only, we drew `D`, `Ty`, `W`.
`wsAtH` and `dAll` both filter `x.hc === selH`. In v781 exactly **4 units carry a literal `null` hc**
(all ANBL: `ANBLBO`, `ANBLBOCI`, `ANBLBOG`, `ANBLBOGL`) while the family's width variants
(`ANBLBO1/2/3`, `ANBLBOGL1/2/3`) have it **absent**. `undefined === null` is false, so the pool
collapses to the face alone: `wsAtH = []` → no W row, `dAll = [58]` → no D row. Our port normalised
both to `null` (the old `hc()` even documented the choice) and drew both rows.

Second bug in the same lines: the app writes `x.dv || 58`, we wrote `?? 58`. `ANBLBO` has `dv: 0`,
so the app reads 58 and we read 0 — the phantom `D [0, 58]` row.

Fixes — `unitFacts.heightCodeNull` (4 units, schemaVersion **2.5.1**), an `hc()` that keeps the two
states apart, and `|| 58` at all six sites.

#### M2. Hidden families and codes in no family at all → `Item.gridHidden` (MEMBER)

`visibleBlocks()` starts with `if (b.hid) return;` — 46 families never render (`F74`, `XHGT_FRIDGE`,
`F1102`, the `__DRWDUP` synthetics …). We had no `hid` flag, so `F74` showed in all 13 Base/Corners
combos. Separately, **44 exported codes belong to no app family**: the 23
`meta.recoveredArtifactSkus` the app's own init deletes (`GFV5580Z3M` → our phantom card `GFVB_B`,
a family id the app does not have) plus the extractor's ItemRef-only stubs (`760`, `761`, `SZIZ`,
`US`, `HW60GA2` …).

One flag covers both: **`Item.gridHidden`** (57 items) = "no NON-hidden family lists this code".
Excluded from every LIST in `buildItemFilter`; still fetchable by sku, so refs and the detail drawer
are untouched.

#### M3. `depthFamOk` is FAMILY-level, and `lineCardOk` HIDES (MEMBER)

Two `blockVisible` gates we had only partly:

* **`depthFamOk(b)`** — we tested `capabilities.depthClasses` per unit and let a member with an
  EMPTY list exempt its family. The app decides relevance for the FAMILY first:
  `if (!depthRelevant(b)) return true; return b.units.some(depthOk)`. So `F1455` (back panels
  `RW73/80/86`, `depthMm` 16) and `PNL_END` (45° end panels, `depthMm` 100…1200) are depth-RELEVANT,
  match no class, and are hidden at D48/D68 — we kept them.
* **`lineCardOk(b)`** — present, but only as a greying input. In the app it is also a membership
  gate (`state.line!=='ALL' && !lineGrey && !lineCardOk(b)` → hide). `F1571` (A-tier cooktops, hc 80)
  must vanish at line 73; 22/9/25 Base families are hidden at lines 73/80/86.

Both are family-wide, so neither can live in the unit-level `$match`: they are computed in
`annotateFamilyAvailability` and applied by the new `dropHiddenFamilies()`, which honours
`grey=true` exactly like the app's "Grey don't hide" checkbox.

Also confirmed while tracing: `b.lines` is set on **0** families in v781 — the `blockVisible` line
that reads it is dead code. Not ported.

#### M4. `dim === 'none'` variant chips NEVER grey (STATE, 27)

All 27 STATE diffs were `dim:'none'` families (`F1853`, `F14`, `F7300`, `F6`, `F47`, `F1970`, `F26`,
`XTWSP`), always `client "S,-"` vs `ours "SO,O"`. `dim==='none'` is a SEPARATE early branch in
`renderGrid` whose chips are emitted with `class="wchip ${sel}"` and nothing else — no `wn`, no
`disabled`. So `TE80KB` at D48 is a greyed CARD with fully live chips. Our shared variant-row
builder applied the `ok`/`exists` gates to it.

#### M5. The lite UI ignored the server's `cardAvailable` (GREY, 31)

Every GREY diff was `client=true, ours=false`, always under a programme. The BACKEND was already
right (`cardAvailable:false` for `FSUL`/`TWSP8058CH`, matching the app's `av`) — the lite UI
recomputed the flag locally from `availableFromCaps(it.capabilities, …)`, which only sees ONE unit
and therefore cannot apply `famOkB`/`famOkU` (does the FAMILY/model belong to the picked
programme's tier?). It now prefers the shipped `cardAvailable` and keeps the local computation as
the fallback for a bare toolbar.

#### M6. Sections re-sort by raw `pri`, so `av` does NOT demote inside a section (ORDER, 25)

`sortCards` reproduces `visibleBlocks`'s `(av, pri, acc, group, special, maxh, index)` — and that IS
the order the app uses when no section bucketing applies. But when a single sub is selected the app
re-sorts before bucketing:

```js
[...all].sort((a,b)=>((a.b.pri==null?9e9:a.b.pri)-(b.b.pri==null?9e9:b.b.pri))).forEach(...)
```

Raw family `pri` only — availability is **not** a key, so a greyed card keeps its catalog position.
Hence `Cooktop Units @D68` = `BZ2(.1) BSZ2(.2) BZ(.3) BSZ(.4) BZIZ(.5)` with BZ/BSZ greyed in the
middle, where we pushed them to the end. `bucketSections` now applies the same stable re-sort;
`sortCards`'s order survives as the tie-break, which is what the app's stable sort does with it.

(`catalogRank` is stored as `null` for unnumbered families, not `999` — verified; 294 families have
a `pri` above 999, so a 999 sentinel would have mis-sorted them.)

#### M7. Dup families — one code, several cards → `Item.dupFamilies` (MEMBER, the 275)

The `MEMBER.cliOnly` mass is families the app renders and we structurally cannot: `F1962__CKDUP`,
`*__DRWDUP`, `*__SNKDUP`, `F33__TRDUP`, `MRG_*` — 41 synthetic families that re-list an accessory
under a second task area, plus a few genuinely shared ones (`FS7334` is in both `F344` and `F2599`).
Our items collection stores ONE doc with ONE `familyId`.

Measured from the app: **74 items carry 79 extra memberships across 40 families**, and a dup family
normally sits in a DIFFERENT subcategory from its origin (`F1970` = Base/Sinks, `F1970__CKDUP` =
Base/Cooktops & Downdrafts) with its own catalog order — **50 of the 79 also have different
`familyFacts`**. So an entry has to carry a whole card identity:

```
dupFamilies: [{ familyId, category, subcategory, section,
                catalogRank, sectionRank, familyIndex, familyFacts }]
```

The grid pipeline expands memberships into rows before the group (`$match` on the indexed main
branch + the 74 dup docs → build `_memberships` = primary ++ dupFamilies → `$unwind` → `$set` the
membership's identity → re-apply the real `$match`). Everything downstream — face ranks, grouping,
`bucketSections`, `sortCards` — then treats a dup family like any other, with no special case.
`membersByFamily()` collects a family's pool from `familyId` OR `dupFamilies.familyId`, otherwise a
dup card would render with no rows.

schemaVersion **2.5.2**.

#### M8. Result of round 2 (`report-Base9.json`, `report-Tall2.json`)

| bucket | Base baseline | Base7 | **Base9** | Tall baseline | **Tall2** |
|---|---|---|---|---|---|
| ROWSET | 402 | 8 | **0** | 285 | 42 |
| STATE | 305 | 27 | **0** | — | **0** |
| PILLS | 76 | 0 | **0** | 220 | 286 → harness artifact, see below |
| GREY | 123 | 31 | **0** | — | **0** |
| ORDER | 7 | 25 | **0** | 43 | 7 |
| MEMBER | 133 | 107 | **57** | 56 | 19 |
| SECT | 110 | 77 | 65 | — | 59 |
| FACE | 274 | 79 | 79 | 32 | 5 |
| CODE | 0 | 0 | **0** | — | **0** |

Base9 predates the `dupFamilies` deploy: its MEMBER 57 is **entirely** `cliOnly` dup families
(`*__CKDUP` / `*__DRWDUP`, 12 combos each) plus a 5-entry `ourOnly` tail (`F1716_A`, `F1754_A`,
`XSPL_ARWF`).

**Tall PILLS 286 is a harness artifact, not a product bug.** Every diff is an H row where we report
three extra pills `230 / 244 / 250`. Those are the `heightExtension` options behind the **"217+"**
chip: our lite UI builds them into a `display:none` span that expands on click, while the app builds
its own on click and so has nothing in the DOM. `dump-ours.js` scraped every `.cp` regardless of
visibility. It now filters on `getClientRects().length > 0`. Re-measure before reading this number.

#### M9. Round 3 — `dupFamilies` deployed, and four more causes in the residue

`report-Base10` / `report-Tall3` / `report-WallMidway3`, with `dupFamilies` live and the dumper's
visibility fix in:

| bucket | Base base → B10 | Tall base → T3 | Wall+Mid base → WM3 |
|---|---|---|---|
| ROWSET | 402 → 24 | 285 → 42 | 63 → 40 |
| STATE | 305 → **0** | — → **0** | — → 1 |
| PILLS | 76 → **0** | 220 → 40 | 51 → **0** |
| GREY | 123 → **0** | — → **0** | — → **0** |
| ORDER | 7 → **0** | 43 → 7 | — → **0** |
| MEMBER | 133 → **10** | 56 → **7** | 93 → **6** |
| FACE | 274 → 79 | 32 → 5 | 76 → **2** |
| SECT | 110 → 60 | — → 61 | 92 → 48 |
| CODE | 0 → **0** | — → **0** | — → **0** |

`dupFamilies` alone took Base MEMBER 57 → 10 and Tall 19 → 7. What was left resolved to four more
rules:

1. **An empty `gridRows` is an ANSWER, not missing data.** The lite UI required
   `gridRows.length` before using them and otherwise fell through to the `parameters.*` path, which
   drew a **W** row on cards the app leaves bare — two-unit accessory families where only ONE unit
   has a width, so the app's `vsd.length > 1` fails (`F2013__DRWDUP`/`ANK45`, `F1965__DRWDUP`,
   `F12`, `F52`, `F804`). That was ALL of Base ROWSET 24 and Tall ROWSET 42. Only an ABSENT
   `gridRows` may use the legacy pills now. The dup cards did not cause this — they exposed it, by
   putting these accessory families into a swept subcategory for the first time.
2. **`cardSys(b)` is not the line.** `state.line!=='ALL' ? (line==='80' ? '80' : '73') : '80'` — 86
   is a 73-SYSTEM line. We read the raw line, so at line 86 the Line row offered `66 · Y` where the
   app offers `86 · J` + `E`.
3. **The `217+` chip needs an AVAILABLE 217 unit.** The app appends it only when the family has one;
   under a programme that excludes it the chip is absent (`F1091` @ROCCA). The H row in `gridRows`
   already answers that, so the UI asks it instead of rendering the chip unconditionally.
4. **The PROGRAMME tier filter read the wrong field.** `tierHas(b, letter)` is
   `u.fam === letter || u._ag` — i.e. `capabilities.nativeTier`, exactly what the FRONTS chip
   already used — but the programme branch tested `availableTiers`. An article whose only Contino
   representation is the **C1 opening variant** carries `['C1']` in `availableTiers` and `'C'` in
   `nativeTier`, and the app counts it as Contino. Base/Appliance housing under ROCCA: app 20
   families, ours 14 → now 20.

#### Still open — the FACE residue is one rule: `_selUnit`

79 Base / 5 Tall FACE diffs remain, and they are all the same class: our face is picked by
denormalized rank fields in the aggregation (`faceForTiers` -> `_faceRank`, `faceHeightClass`,
`faceVariantCore`, `faceWidthMm` -> `_widthRank`, `depthMm` ASC), the app's by `_selUnit(b)` — a
per-dim procedure over the family pool with its own precedence:

```
h = per-card pick -> global Height -> LINE -> 80 -> hs[0]
w = per-card pick -> the W filter's bucket -> defaultWidthMin(b)/preferWidth -> smallest
then the (h,w) candidates are narrowed by depth
```

Two worked cases:

* `F114` @line73 — app `CRWF6073`, ours `RWF6073`. Both are hc 73 / w 60; the app takes the one that
  comes FIRST in the family's own unit list (Contino), our tier rank prefers P -> A -> C.
* `THA` @line86 — app `TH6073B`, ours `TH6080B`. The LINE feeds the height choice (86 shares the
  73-system heights), which our `faceHeightClass` doesn't model; @w90 the app faces `TH9180B` and we
  keep `TH6080B`.

The fix is the same move that worked for the rows: **port `_selUnit` and pick the face in JS from the
family pool**, which would also retire `_faceRank` / `_widthRank` / `_famFaceTiers`. That is the
recommended next task.

**`GREY_NOT_HIDE` 38 → 76 is not a regression, and it hides a blind spot.** The lite UI sends
`grey=true` unconditionally (`params()`), i.e. it always runs in the app's "Grey don't hide" mode, and
`diff.js` strips our grey-only extras into this bucket. So the M3 family gates (`depthFamOk`,
`lineCardOk`) never fire during a sweep: the families they would HIDE come back GREYED instead, which
moves them out of `MEMBER.ourOnly` and into `GREY_NOT_HIDE` — most of the Base MEMBER 107 → 57 drop
and all of this bucket's growth. The hide path was verified by hand against the app instead
(`F1455` / `PNL_END` @D48 and @D68, `F1571` @line73 — absent; `F1571` @D68 and `PNL_END` with no
depth — present).

**Follow-up for the harness:** make `grey` a sweep parameter so one pass measures the HIDE semantics
the client's React app will actually use. Today it is hard-coded in `params()`.

Other open items: Wall/Midway not yet re-measured, the tall `Line` row click (§L #7) and the D4K-prd
backfills (handoff tasks 7 and 8).

---

### §N. SWEEP ROUND 3 — section order, the raw sub, and the v98 sibling swap (2026-07-29, late)

Round 2 (§M) left a `grey=false` residue of **Base MEMBER 1 · Tall MEMBER 3 / SECT 14 / ORDER 6 /
PILLS 2 · Wall+Midway MEMBER 6**, with FACE / CODE / GREY / ROWSET / STATE / GREY_NOT_HIDE already at
0 in all three legs. Round 3 took the three real causes behind that residue.

**⚠️ First, two HARNESS artifacts that looked like bugs.** Both cost time; both are re-runs, not fixes.

* **Wall+Midway MEMBER 33 / SECT 33 (report-WallMidway7).** Whole leaves came back EMPTY on our side
  (`Midway|Open shelf|base` — client 5 families, ours 0). The API returns the right 5. Cause: the
  backend was rebuilt and RESTARTED while that leg was still sweeping, so the last ~60 states hit a
  dead server. **Never restart the backend mid-sweep** — abort the sweep, restart, re-run.
* **`Tall|Panels, Fillers & Surrounds|progP_BOSSA`.** The client dump for that ONE state has no
  section headers at all, a scrambled card order, and a family (`F224`) that appears in no other
  state — a partial/mid-render DOM capture. It is the only Tall state still showing MEMBER + SECT
  diffs; treat it as a bad sample until re-dumped, not as a discrepancy.

**N1. `sectionRank` was captured with the wrong key — all 10 sections of a leaf in the wrong order.**
`renderGrid` looks up `SECTION_ORDER[subDisp(f)] || SECTION_ORDER[secOrderKey(subDisp(f))]`. The
stored rank had been captured with `SECTION_ORDER[f.sub]` — the RAW sub. On Tall those differ:
`TALL_MERGE` maps `Accessory surround` / `Fillers` / `Back & Side Panels` into the single display sub
`Panels, Fillers & Surrounds`, which has its own curated order built at v433. So the ranks came off
`SECTION_ORDER['Accessory surround']` instead: Tall End Panels **8** (should be 0), Rear Panels in
Front Finish **10** (6), Depth Extensions **11** (8), and every v433 classify-derived section (Tall
Fillers / Blenders / Corner Blenders / Angle Blenders / Wall Blenders, Support Panel with Plinth,
Carcase Side Extension) fell to **999**. Data-only: 78 families / 1,130 items re-captured from the
live app and backfilled. The EXTRACTOR's own formula was already correct — the stale values came from
the earlier `backfill-section-rank.js` capture, and the export had inherited them.
→ **Tall SECT 14 → 3**, and the 3 survivors are exactly the 3 states that still differ on MEMBERSHIP.

**N2. `bucketSections` applied the rank unconditionally.** The app consults SECTION_ORDER only when
the visible set has ONE display sub — `_disp = _subs.size===1 ? [..._subs][0] : ''`, and
`SECTION_ORDER['']` is undefined. A task leaf spanning several subs therefore ranks EVERY section 999
and falls back to pure first-seen/`pri` order. Ported that guard. (Inert in the sweep, which filters
by a single sub; it matters for the `leafId` task views.)

**N3. `avanceExempt` was tested against the DISPLAY sub.** The v319 programme-tier hide exempts
`isAccessory(b) || sub==='Accessory surround' || sub==='Fillers' || /^FRMAT/`, plus a
`sub!=='Modular Units'` arm — all on the RAW sub. Our escape list matched `Item.subcategory`, which is
`subDisp(f)`, so on Tall it exempted nothing and we HID Primo-only families the app keeps (`F1730`,
`F342`, `F343` under LAIKA / ROCCA). Matching the display name instead would over-exempt `Back & Side
Panels`, which is NOT exempt — so the raw sub now ships as **`familyFacts.rawSub`** (schemaVersion
2.5.3). Extractor emits it; export patched; D4K-dev backfilled; **D4K-prd still owes it**.

**N4. The v98 SIBLING-FAMILY SWAP is a MEMBERSHIP rule, and it was never ported.** From
`visibleBlocks`:

```js
const fl = activeFamFor(b.cat);
if (fl && u.fam && u.fam !== fl && String(u.sib||'').includes(fl)) {
  const sc = sibCode(u, fl), loc = sc ? codeLoc(sc) : null;
  if (loc && loc.fid !== b.id && FAM_BY_ID[loc.fid]) { b = FAM_BY_ID[loc.fid]; u = …; }
}
…
{ const seen=new Set(); … }   // v98: dedupe by b.id, KEEPING THE FIRST
```

"The card pre-selects the article of the zone's pricebook": under an Avance programme a Contino-faced
card resolves to its A-twin, which usually lives in a DIFFERENT family — and the dedupe then collapses
the pair into ONE card. We rendered both. `F115` (`CHP20154`, sib `AC`) → `F209` (`AHP20154`) under
LAIKA, and symmetrically `F93` ⇄ `F106` in Wall › Corner under LAIKA / ROCCA.

Ported as `applySiblingFamilySwap`, run where the app runs it — after the face pick, before `av`. The
card keeps the SOURCE's position (the app pushes at the source's index) and takes the TARGET's
identity, then dedupe by `familyId` keeping first. **No new per-unit data**: `sibCode(u,x) = x==='P' ?
core(u) : x+core(u)` and `core(u) = u.fam!=='P' && /^[AC]/ ? sku.slice(1) : sku`, so it is derivable
from `sku` + `unitFacts.tier`. `codeLoc`'s "prefer a family in the current category" is reproduced by
a sku→family index built off the cached pool (and cleared with it, so `category` joined the pool
projection). When the target family is not in the result set the swap is SKIPPED rather than
synthesised — rendering a card for a family the query excluded would be a bigger lie.

Verified against the app: Tall Panels under LAIKA and ROCCA return **28 families each, matching the
app's 28**, with F1730/F342/F343 present and the F115/F209 swap resolving per programme; Wall › Corner
returns the app's **6**.

**N5. A STALE IN-PROCESS POOL CACHE can survive a backfill.** All 6 Tall ORDER diffs (`Tall End
Panels`, `Rear Panels in Front Finish`, `Support Panel with Plinth` — adjacent-pair swaps among
unnumbered `XAG_*` families that sort on the `(b.maxh - a.maxh)` tiebreak) disappeared on restart with
no code change: `poolByFamily` had been cached before the `sectionRank` backfill. Anything that writes
to the collection outside the app's own ingest/CRUD path must be followed by a restart (or an
`invalidatePool()`), or the next sweep measures stale data.

**Known residue after round 3** (all deliberately left, all documented):

| # | Where | What |
|---|---|---|
| 1 | Base MEMBER 1 — `ADD_KSSET_TILTPROTEC__CKDUP` @BOSSA | The dup family's single unit carries `u.fam = "ADD_KSSET_TILTPROTEC__CKDUP"` (the family id, not a tier letter), so the app's `tierHas(b,'P')` is false and v319 HIDES it. Our tier gate reads `capabilities.nativeTier`, which is a real `'P'`, so we keep it. Fixing it means testing `unitFacts.tier` in the tier gate — the gate that already took three iterations to stabilise (`availableTiers` → `nativeTier`) — for one card in one state. Not worth the regression risk now. |
| 2 | Tall PILLS 2 — `F1780`/`F1782` @LAIKA/ROCCA | The app renders the H row as `154 190 204 217 217` — **two** 217 pills; we emit one. Porting it means deliberately emitting a duplicate pill. Looks like an app bug; confirm with the client before matching it. |
| 3 | Tall `progP_BOSSA` | Bad client sample (see the artifact note above). Re-dump that one state. |
| 4 | §G family-level MEMBERSHIP (SNK8-type) | Unchanged from round 1. |
