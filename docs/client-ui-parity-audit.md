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
