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
2.5.3). Extractor emits it; export patched; D4K-dev backfilled; D4K-prd backfilled 2026-07-30 (closed).

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
| 2 | Tall PILLS 2 — `F1780`/`F1782` @LAIKA/ROCCA | ⚠️ **Wrong — see §O4.** Not a duplicate `217` and not an app bug: the fifth pill is **`217+`**, the `heightExtension` chip, and `diff.js`'s `NUM()` strips the `+`. The real defect is ours — those two families carry no `heightExtension` at all. |
| 3 | Tall `progP_BOSSA` | ⚠️ **Wrong — see §O2.** Not a bad sample; it reproduces exactly and has a single root cause. |
| 4 | §G family-level MEMBERSHIP (SNK8-type) | Unchanged from round 1. |

⚠️ Row 1 of that table is also wrong — see **§O3**. `unitFacts.tier` never holds a family id (the
extractor guards it with `/^[PCA]$/`), so the fix sketched there is a no-op.

---

### §O. SWEEP ROUND 4 — the Tall re-measure, and both leftover diagnoses corrected (2026-07-30)

Round 3 signed off with four residual items, three of them on a *guess* about the cause. Re-running the
Tall leg confirmed the one real fix and disproved all three guesses. The lesson is uniform: **every one
of the three was written off as "an app quirk / a bad sample / not worth it" without being reduced to a
mechanism, and all three turned out to be ours.**

### Final sweep — 720 states, `grey=false`, ZERO diffs in every bucket

| bucket | Base (192) | Tall (272) | Wall+Midway (256) |
|---|---|---|---|
| MEMBER · FACE · CODE · GREY · SECT · ORDER · ROWSET · PILLS · STATE · GREY_NOT_HIDE | **0** | **0** | **0** |

Reports: `scripts/parity/out/report-{Base,Tall,WallMidway}-O3.json`. Round 3 ended at Base MEMBER 1 ·
Tall MEMBER 1 / SECT 1 / ORDER 6 / PILLS 2; for scale the §L baseline on Base alone was ROWSET 402 ·
STATE 305 · FACE 274 · MEMBER 133 · GREY 123 · SECT 110 · PILLS 76.

⚠️ **What this does NOT cover.** The plans exercise `category` · `subcategory` · `tier` · `programs` ·
`line` · `heightClass` · `widthMm` · `depthClass` over **4 of the catalog's 14 categories**. Never swept:
the Design-Tasks sidebar (`leafId` / `groupKey` / `zone` — the app's PRIMARY navigation, and the only
path that exercises `bucketSections`'s new `isTaskView` branch), `q` search, **`grey=true`**, `opening`,
`tallHeight`, `suspended`, `page>1`, and the entire detail drawer. Zero here means the grid is exact on
the swept surface, not that the app is matched everywhere.

**O1. The `maxh` fix is confirmed — Tall ORDER 6 → 0, measured.** `9dc6a834` was the only round-3
change never put through a sweep. Full 272-state Tall leg at `grey=false` (`out/Tall10.json`,
`out/report-Tall10.json`): **ORDER 0 · FACE 0 · CODE 0 · GREY 0 · ROWSET 0 · STATE 0 ·
GREY_NOT_HIDE 0**, leaving only MEMBER 1 + SECT 1 (both §O2) and PILLS 2 (§O4). A 3-state pre-check on
just the ORDER keys agreed before the full run, so `diff.js` on a plan SUBSET is a valid fast signal —
it only compares keys present on both sides.

**O2. `Tall|Panels, Fillers & Surrounds|progP_BOSSA` is REAL, and MEMBER 1 + SECT 1 are ONE bug.**
Re-dumped from the app: 31 cards, **zero** `.sechead` nodes, order flat — byte-identical to the dump
round 3 wrote off as a mid-render capture. It is not an artifact. The chain:

* F102 is Tall › Fillers and every one of its 3 units is C-tier (`COP2027/40/53`, `u.sib = 'PC'`).
  Under BOSSA (a P zone) the **v98 sibling swap** resolves it to `sibCode(u,'P') = OP2027` — which
  lives in **F224, `cat:'Wall'`**. The card keeps F102's slot and takes F224's identity.
* F224's `subDisp` is **`'Fillers'`** — `TALL_MERGE` folds `Fillers` into `Panels, Fillers &
  Surrounds` only for Tall families, and F224 is Wall. So the visible set now spans TWO display subs.
* `renderGrid` gates its whole bucketing block on `(_subs.size===1 || state.cat==='__TASK__') &&
  all.some(x=>x.b.sec)`. With two subs the block is **skipped entirely**: `show = all` — no section
  headers at all, and **no `pri` re-sort**, so the cards stay in raw `visibleBlocks()` order.
  Verified live: `subsN:2`, `hasF224:true`, `hasF102:false`.

Two gaps on our side, and the first hides the second:

1. **`applySiblingFamilySwap` cannot reach a target outside the result set.** It resolves the target
   through `byFid`, built from the current cards (`design-book.service.ts:1523`) — F224 is Wall, so a
   Tall-scoped query never contains it and the swap silently no-ops. That was the deliberate call at
   `:1499-1502` ("building a card for a family the query excluded would be a bigger lie"). This state
   is the counter-example: the app really does render a **Wall** family inside a **Tall** subcategory
   view. The target family and its units ARE in the cached pool, so the card can be built — the fix
   is to fetch the target family through the family-scoped path and splice it in at the source's
   index (guarding against a second swap on the fetched card).
2. **`bucketSections` implements `!oneSub` as "rank every section 999 and bucket anyway"**
   (`:1733/:1743`). The app does not bucket at all in that case. Correct port: when the set spans more
   than one display sub (and this is not a task view), return ONE headerless group with the cards in
   their incoming order and skip the `pri` re-sort. Currently unreachable — F102's own subcategory is
   the merged name, so we always see one sub — which is why round 3's §M fix (rank 999) measured as
   good enough: every other one of the 272 states genuinely is single-sub.

Neither is shipped. Fixing (1) without (2) would move the diff from SECT to ORDER; they go together.

**O3. The Base MEMBER 1 fix sketched in the round-3 handoff is a no-op.** The claim was that the dup
family's unit carries `u.fam = 'ADD_KSSET_TILTPROTEC__CKDUP'`, so gating on `unitFacts.tier` would
reproduce the app's `tierHas` miss. The export says otherwise — both the extractor and the facts
backfill normalise a non-tier `u.fam` to `null` (`export-v781-extractor2.js:593`,
`scripts/backfill-grid-facts.js:83`, `/^[PCA]$/`), and `capabilities.nativeTier` has the same guard
(`:125`). For `KSSET`: primary `ADD_KSSET_TILTPROTEC` → `unitFacts.tier:"P"`, dup
`ADD_KSSET_TILTPROTEC__CKDUP` → `unitFacts.tier:**null**`, `agnostic:false`. The proposed clause
explicitly lets `tier ∈ [null,'']` through, so it would not hide the card.

The app-faithful gate is `tierHas` itself — `b.units.some(u => u.fam === letter || u._ag)`, called from
the v319 arm of `blockVisible`:

```js
if (anyProg() && TIER_CATS.has(b.cat) && b.sub!=='Modular Units' && !avanceExempt(b) && !state.lineGrey) {
  const _tier = tierForCat(b.cat);
  if (_tier && !tierHas(b,_tier)) return false;
}
```

This dup satisfies neither arm (`tier:null`, `agnostic:false`); ordinary tier-less accessories carry
`agnostic:true` and still pass. The round-3 warning about the `$unwind` was also right —
`familyGroupStages`'s `$set` swapped familyId/category/subcategory/section/catalogRank/sectionRank/
familyIndex/familyFacts but **not `unitFacts`**, and the primary membership object did not carry it.

**FIXED**, two edits, no data change:
* `familyGroupStages` — the primary membership object gains `unitFacts: '$unitFacts'` and the `$set`
  gains `unitFacts: {$ifNull: ['$_memberships.unitFacts', '$unitFacts']}`. The `$ifNull` mirrors
  `poolByFamily`'s `e.unitFacts ? {...m, unitFacts: e.unitFacts} : m` (only 34 of the 74 shared codes
  carry a divergent record). `LIST_OMIT` does not drop `unitFacts`, so this survives on list rows.
* the programme branch of the tier gate becomes
  `$and[ capabilities.nativeTier == tier, $or[ unitFacts.tier == tier, unitFacts.agnostic ] ]`.
  For every ordinary unit `unitFacts.tier === capabilities.nativeTier` — same `u.fam`, same `/^[PCA]$/`
  guard, computed off the same record — so the added clause is a no-op except on a dup membership whose
  own record diverges. That is the whole point: `capabilities` is ALWAYS the primary family's.

Verified: `Base|Cooktops & Downdrafts|progP_BOSSA` returns **25 types** (client: 25) with
`ADD_KSSET_TILTPROTEC__CKDUP` absent, and the primary `ADD_KSSET_TILTPROTEC` still resolves. Because
this is the tier gate that has broken twice before — and because swapping `unitFacts` also changes the
rank inputs on every dup row — all three legs were re-swept rather than hand-checked.

**O4. The "duplicate `217`" is a HARNESS ARTIFACT hiding a two-family data gap.** Round 3 read the app's
H row on `F1780` @LAIKA as `154 190 204 217 217` and filed it as an app bug to raise with the client.
The raw client dump says otherwise:

```
row 'H' [('154',sel), ('190'), ('204'), ('217'), ('217+')]
```

The fifth pill is **`217+`** — the `heightExtension` chip (230/244/250 cm via the 217 unit +
`MPHVERL`, §2c-3). `diff.js` compares pill labels through `NUM(s)` = strip every non-digit
(`diff.js:24`, used at `:105`), so `217+` normalises to `217` and the PILLS bucket printed a duplicate
that does not exist. **The app is correct and there is nothing for the client to decide.**

The real defect is ours: we render no `217+` chip on those cards, because `attachGridRows` only computes
the flag inside `if (c.heightExtension)` and the face carries none —
`F1780`/`AHWSP15456` → `heightExtension: null`, `heightExtensionOk: undefined`. Not one unit in either
family has the field, while their Primo twin `F1784` has it on all 32
(`{sku:"HWS21758", addCode:"MPHVERL", options:[230/2304, 244/2436.5, 250/2500]}`).

Scoped catalog-wide, it is **not** tier-scoped (331 A-tier and 338 C-tier units elsewhere do carry it) —
it is exactly two families out of 18,396 items:

```
Tall · has a heightCode 217 unit · not Appliance Housing · no heightExtension anywhere:
  F1780 | Panels, Fillers & Surrounds | 217-unit tier: A
  F1782 | Panels, Fillers & Surrounds | 217-unit tier: C
```

— the same two the sweep flagged.

**Why they were missed, and why the field itself was the wrong shape.** The extractor does NOT tap the
chip — it reproduces the app's own gate and hardcodes the option table
(`heightExtensionOf`, `HEXT_MM=[[230,2304],[244,2436.5],[250,2500]]`, `export-v781-extractor2.js:431`):

```js
const pool = f.byprog ? (f.vlbl ? ppool(f).filter(x=>x.vr===u.vr) : ppool(f)) : …;
const m = (pool||[]).find(x => x.hc === 217);
if (!m || !available(m)) return null;
```

`available(m)` is **toolbar-dependent** and extraction runs in the pristine DEFAULT toolbar (no
programme ⇒ a P context), so an all-A-tier or all-C-tier family fails it and gets `null` on **every**
unit. The option heights were never the unknown — the gate was. A per-unit frozen field for a
family-level, toolbar-dependent question is exactly what v2's "intrinsic facts, derive the rest" rule
exists to prevent.

**FIXED by deriving it** (no backfill, no re-ingest, no contract change):
* `design-book.grid-rows.ts` — new `heightExtensionFor(units, face, f, tb)` returns the payload
  (`{sku: <the family's own 217 unit>, addCode:'MPHVERL', options:[230/2304, 244/2436.5, 250/2500]}`);
  `heightExtensionOk` now delegates to it.
* `attachGridRows` stamps `heightExtension` + `heightExtensionOk` from the pool for the request's own
  toolbar instead of gating on the stored field. It runs after `LIST_OMIT`, so list rows carry it.
* ⚠️ The Appliance-housing exclusion had to move to **`familyFacts.rawSub`**. `Item.subcategory` is
  `subDisp(f)`, which spells it BOTH ways — **382 `Appliance housing` and 566 `Appliance Housing`** — so
  the old `c.subcategory !== 'Appliance housing'` test silently missed two thirds of them. Harmless
  while the stored field gated everything (no appliance unit carries one), a live bug the moment the
  payload is derived. `rawSub` is uniformly `Appliance housing` (946). Same rule as §N3, and `rawSub`
  joined `GridFamilyFacts`.

Verified: `F1780` → `heightExtension.sku = AHWSP21756`, `heightExtensionOk: true` under LAIKA (410) and
absent under ROCCA (701); `F1782` the exact mirror (`CHWSP21756`); `F1784` unchanged (`HWS21758`, both);
Tall › Appliance Housing 0 of 50 families get a chip. The harness now reads
`F1780 H = [154, 190, 204, 217, 217+]`, matching the client byte-for-byte — **PILLS 2 → 0**.

**O4b. The DRAWER was left on the frozen field — grid and drawer disagreed (fixed 2026-07-30).**
O4 derived the chip in `attachGridRows` only, so `GET items/:sku` still served whatever the extractor
had frozen on the document. On exactly the two families O4 was about, the grid grew a `217+` row and
the drawer did not (`GET items/AHWSP15456?programs=410` → `heightExtension: null`). Same class of bug
as O4 itself, one endpoint later.

Fix: the stamp is one shared method, `DesignBookService.applyHeightExtension(c, units, face, f, tb)`,
called from `attachGridRows` **and** from `getItem`. The drawer has no W/H/D/line state of its own, so
its toolbar is `gridToolbar({ programs }, resolveProgramTiers(programs))` — the programme context and
every other field at its 'ALL'/default. Pool comes from the same cached `poolByFamily()` (dup
memberships included), face is the pool member for the requested sku, falling back to the item itself
so a synthesized `P1`/`C1` sibling still answers. No data change; contract stays **2.5.3**.

Verified: `AHWSP15456?programs=410` → `AHWSP21756` / `ok:true`, no programme → `null` (matching the
grid, whose `unitAvailable` fails an all-A family in a P context); `CHWSP15456?programs=701` the
mirror; `HWS14658` (Primo twin) unchanged; `AHG6015411DZ` (Appliance Housing) still no chip;
`P1T3080S` (synthesized) fine. **Whole-catalog check: all 332 Tall family faces, grid card vs drawer
item, payload sku + flag — 0 mismatches.**

**O4c. `heightExtension` is now formally ADVISORY — the API is its only source (2026-07-30).**
O4 and O4b each fixed one reader. The field was still a per-unit STORED contract field whose value the
server no longer trusted, which left two ways for the frozen copy to reach a client:

1. **gate fails, stored copy present** → the response carried the payload with `heightExtensionOk:false`.
   The grid card checked the flag; the lite UI's drawer (`hextPills`) did not, so it rendered a `217+`
   row the card next to it hid (`H60190GAIZ` under ROCCA 01 — payload `H45217GAIZ`, `ok:false`).
2. **family unresolvable** — `attachGridRows` did `if (!units || !f) continue` before stamping, so a
   `gridHidden` artifact or an item with no `familyFacts` served its stored copy untouched, and
   `getItem` skipped the same way.

Both are the same mistake as O4/O4b one layer out: a field with two possible sources has a wrong one.

**Fix — one writer, always authoritative.** `applyHeightExtension` now runs on every item on every
read path, before the family check, and **deletes both fields** when the gate fails instead of leaving
a stale payload behind. Response invariant: **`heightExtension` present ⟺ the chip renders**;
`heightExtensionOk` is `true` whenever the payload is there and is retained only so the shipped client
test (`heightExtensionOk !== false`) keeps working.

**No data change and no schemaVersion bump** — the stored field keeps its `@Prop`, its DTO and its
export slot, and is simply never read. It is documented as ADVISORY at all four places someone might
trust it: the contract (`export-schema-v2.ts`), the extractor's own `heightExtensionOf` (whose
`available(m)` is the toolbar-dependent call that started this), the CRUD guide §4b ("you cannot author
this one"), and the admin form's note. Deleting it later needs no backfill.

Verified: invariant `present ⟺ ok===true` holds over the grid-family, ungrouped, `@ROCCA` and Base list
paths — **0 violations**; grid card vs drawer over every Tall face in two toolbars — **332 faces / 82
with a chip → 0 mismatches**, and **279 / 16 → 0** under ROCCA 01. `H60190GAIZ` at ROCCA 01 now returns
no `heightExtension` key at all.

**O5. THE DESIGN-TASKS SIDEBAR — `functionalGroups` is per-ITEM where it has to be per-MEMBERSHIP.**
Found by hand-driving both sidebars (never swept — see the scope caveat above). Base › 💧 Water:

| | sidebar count | grid header |
|---|---|---|
| app (v781) | 87 | **87 types** |
| ours | 87 | **91 types · 13 sections** |

Our own sidebar disagrees with our own grid. The leaf below it is fine — `Sink Cabinets` gives
**18 types · 5 sections**, header `Sink Units`, same four cards in the same order as the app — so
`leafId` is right and `groupKey` is not. Diffing the family sets (`out/app-b_water.json`, the app's own
`visibleBlocks()` with `state.cat='__TASK__'`, `task='b_water'`) gives **8 extra and 4 missing**, not 4:

```
OURS ONLY: AC_AHS · AC_AHS2 · AC_CMXABT · AC_PMK · ADD_CMXRM_ROLLMAT ·
           ADD_ZMFT_CLOTHFORFU · F1970__CKDUP · XAG_Ac_3cfce6
APP ONLY : F1917__SNKDUP · F1918__SNKDUP · F1955__SNKDUP · F1969__SNKDUP
```

`buildItemFilter` matches `functionalGroups.groupKey` / `.leafId` / `.zone` (`:2251-2253`) — ONE array
per ITEM, derived from the item's task-leaf membership. The §M dup expansion then emits several ROWS per
item, and that item-level array is evaluated identically on every one of them. Three failure modes, all
confirmed against D4K-dev:

* **primary + dup both returned** (6 of the 8 extras). `AC_AHS` is `Accessories & interior/Further
  accessories`, tagged `b_water|Sink Accessories` — correctly, because the app's leaf claims it through
  its `AC_AHS__SNKDUP` (`Base/Sinks`) membership. Expansion yields both rows; both match; the app shows
  only the dup.
* **wrong dup returned** (`F1970__CKDUP`). `F1970`'s primary IS `Base/Sinks` and tagged `b_water`, so
  its `Base/Cooktops & Downdrafts` dup rides in on the primary's tag — a Cooktop card under Water.
* **dup missing entirely** (all 4 APP ONLY). `F1917` is `Alteration/Accessory`, tagged `b_layout|
  Modifications` from its PRIMARY; the app claims its `F1917__SNKDUP` (`Base/Sinks`) for `b_water`, and
  nothing on the doc says so. Same for F1918 / F1955 / F1969.

Exactly the §O3 class of bug — an item-level field standing in for a per-membership one — and the fix
has the same shape but a bigger blast radius: each `dupFamilies[]` entry needs its OWN
`functionalGroups`, the primary's array must cover only the primary membership, and the filter must read
the membership's copy (the `$unwind` already swaps sibling fields, so that part is one line). That is an
**extractor + export + contract + backfill** change, unlike O1–O4 which were pure backend logic.
`XAG_Ac_3cfce6` is not explained by any of the three modes — diagnose separately, do not assume.

⚠️ Not fixed. And note what this says about the zero above: 720 states of the TYPE taxonomy passed
clean, and the very first hand-check of the TASK taxonomy failed. The sidebar is the app's primary
navigation; it needs its own plan.

⚠️ **Harness note (unfixed, deliberate):** `NUM()` exists so numeric labels compare across cm/mm
formatting, but it silently merges any two labels differing only in punctuation. `217` vs `217+` is the
first case found. Prefer the raw label and fall back to `NUM()` only when both sides are purely
numeric — left alone for now because changing it re-baselines every stored report, and the one concrete
case it hid is now fixed in the data path.

---

### §P. EXTENDED COVERAGE — the 10 un-swept categories, the flags, the task view (2026-07-30)

§O closed the sweep on 4 of 14 categories. This leg extends it to the rest and to the query surface the
plans never touched. **1,104 states in five legs**, `grey=false`, client grid = ground truth:

| leg | what it covers | states | first result | after the §P fixes |
|---|---|---|---|---|
| **E1** | Accessories & interior · Alteration · Handles (part) | 264 | MEMBER 37 · SECT 19 | **CLEAN** (`E1re` — the diffs were a dead backend, see below) |
| **E2** | the remaining 10 categories, 8 toolbar states each | 298 | ROWSET 385 · MEMBER 1 · GREY 12 · SECT 1 | ROWSET **8** · MEMBER 1 · GREY 12 · SECT 1 |
| **E3** | Base/Tall/Wall/Midway at states the O-plans skipped | 200 | MEMBER 3 · FACE 6 · GREY 2 · SECT 1 · ORDER 2 · GREY_NOT_HIDE 1 | unchanged (open items) |
| **F1** | the toolbar FLAGS — `opening`, `suspended`, `q` | 90 | MEMBER 66 · SECT 54 | **0 · 0** — all 60 flag states (24 `opening` P3 · 12 `susp` P4 · 24 `q` P5) diff **0 in all ten buckets**. The 30 `grey_on*` / `tallH*` states are un-swept, not clean |
| **T1** | the Design-Tasks sidebar (`leafId`/`groupKey`/`zone`) | 252 | MEMBER 68 · FACE 14 · SECT 31 · ORDER 2 · STATE 24 · GREY_NOT_HIDE 5 | unchanged (deferred, §O5) |

⚠️ **E1's 56 diffs were not real.** Same trap as §N: the backend had been restarted mid-leg. `E1re` on
the same plan, same data, same code → 0 in all ten buckets. **Re-run before diagnosing.**

⚠️ **Third harness trap, found in P6: `__Q.run()` does not RECORD.** It returns a dump; only
`__Q.sweep()` writes into `RESULTS`, and `__Q.post()` sends `RESULTS`. The fire-and-forget starter the
BUSY comment prescribes (needed because a CDP timeout does not cancel the page promise) therefore has to
keep its **own** map and POST that — a hand-rolled `for (…) await __Q.run(…)` loop plus `__Q.post(name)`
uploads `{"data":{}}`, and `diff.js` then reports *"missing on ours: 200"* with every bucket 0, i.e. a
clean-looking report over nothing, after the whole leg has already run. Now called out in `dump-ours.js`
next to `sweep`.

**Both ROWSET mechanisms were ONE missing row each, and both are pure backend logic** — no data change,
no backfill, no re-ingest, `schemaVersion` stays **2.5.3**.

**P1 — the app has TWO depth rows after the `dim` branch; we had ported one.** 237 of the 385
(`[D,Runner,W]` 134 · `[D,Ty,W]` 72 · `[D,W]` 31, all `Accessories & interior`). The card template calls
`dvRowFn(b,u)` (`:5040`, defined `:2696`, app v537) and *then* `dRow` (`:5041`); only `dRow` existed in
`design-book.grid-rows.ts`. `dvRowFn` fires on `b.dim==='width'` when the face has **no `u.d`** — which
is exactly why the gap survived four sweep rounds: the two rows are mutually exclusive, so every family
that could expose it renders no depth row at all. It lists the distinct `u.dv` at the card's own `u.w`
(variant-scoped when `b.vlbl`), needs ≥2, and every pill is **live and a real sibling** — `pickCardDv`
sets `blockDv[b.id]` and `selectedUnit` (`:2683`) re-faces the card. Ported verbatim before the `dRow`
block. Verified against the client dump on `Accessories & interior/Combo`:
`ADD_CBSET_COMBODRAWE1 · CBSET90581 → [58* 68]`, `CBU_DOUBLE · CBU29058B → [36 48 58* 68]`,
`CBU_SINGLE → [48 58* 68]`, `ADD_CBRM_COMBONONSL → [36 48 58* 68]`. ROWSET 385 → 148, every other
bucket unmoved (FACE/PILLS/STATE/ORDER all 0).

**P2 — a `Finish` row renders with ONE pill.** The other 140 (`Handles`: Bow 112 · Griprails 21 · Bar 7 =
20 families × 7 states), client `[Finish]` vs ours `[]`. `typeRow` has a branch before the ordinary one
(`:3912`): `if(b.vfin && variantOpts(b).length===1)` → the row still draws, one chip, `sel` +
`disabled`, because the row exists for the colour **swatch** (`finUrl(vr)`), not for the choice. Our port
started at `opts.length > 1`.
**`vfin` is a raw family flag we do not store — and deliberately still don't.** It is 1:1 with
`variantLabel === 'Finish'`: 53 families in the export carry that label, 45 are flagged in the app's
`DATA` (all `cat:'Handles'`), the one unflagged label-holder (`PNL_CLAD`, Standard/Bossa) has >1 variant
and so can never reach the branch, and post-init `hmerge` only ever ADDS the flag. Measured over the
whole export: families with `variantLabel:'Finish'` **and** a single `variantCode` = exactly **20**, and
exactly the 20 in the diff. So the branch gates on the label; a comment names the assumption and the
re-check. Verified: `HDL_MBH_405 → Finish [405*]`, `HDL_Bar_handle_670`, `HDL_MBH_520` all correct,
`PNL_CLAD` unchanged (still `H [190* 230 270]` + `Finish [Standard* Bossa]`). Re-sweeping the 21 Handles
states: **0 diffs in all ten buckets**.

**P3 — `opening` was a card FILTER; in the app it is a toolbar INPUT.** F1's 18 MEMBER + 18 SECT diffs,
every `open_P1` / `open_C1` state. `buildItemFilter` pushed `{ availableTiers: query.opening }`, so
Base › Accessories & Surround at P1 returned **0 of the app's 17 families** and Base › Appliance housing
12 of 23. `state.open` appears in exactly three places in the app, none of them a membership test:
`openOk(u)` — one of the eight `available(u)` gates, so it **greys** and re-sorts; `ppool(b)` — the P1/C1
pool, so it **re-faces**; and `assemble(u)` — `if(open==='P1' && u.P1) c='P1'+c`, so it **prefixes the
displayed order code**. All three were already ported (`design-book.grid-rows.ts:131/150/170`,
`gridToolbar`'s `open: query.opening`) — the hard filter was pure surplus. Deleted.

There IS one hide, and it is not the tier: `blockVisible`'s first line,
`if (b.byprog) { if (!ppool(b).length) return false; }` — a programme-driven family with nothing at this
opening/programme. Ported as `openFamilyOk` (`annotateFamilyAvailability`) + one clause in
`dropHiddenFamilies`, deliberately **outside** the `query.grey` early return because in the app this
test sits above every `state.lineGrey` check. Provably a no-op without an opening: all 241
`byProgramme` families have at least one `opening:null` unit, so the `hasOpeningArticles` branch is
non-empty at `op:''`, and the other branch's `openOkOnly` returns `true` when the toolbar has no
opening — which is why removing the filter needed no re-sweep of the 720 clean states. A 7-state
control on no-opening keys confirmed it: 0 in all ten buckets.

The lite UI then had to add the code prefix, and the first attempt was wrong in an instructive way:
`P1P1GFV6080SM`. **`capabilities.openP1` is not `u.P1`** — it is the whole `openOk` form
(`!!u.P1 || u.c.startsWith('P1')`), so it is *also* true on the P1 article itself, which is exactly the
unit `ppool` faces when the toggle is on. The guard is `unitFacts.opening`: a unit that IS an opening
variant never takes a prefix. Result over all 24 open states: **0 in all ten buckets** (was MEMBER 18 ·
SECT 18, and CODE 43 mid-fix).

**P4 — "`suspended` has no app counterpart" was wrong: SUSPENDED *IS* ANTOSO.** F1's 12 `susp` states
(9 MEMBER + 9 SECT diffs). The app has one function for both:

```js
window.setSusp = function (on) { state.susp = !!on; state.antoso = !!on; … }   // :5059
window.toggleAntoso = function () { setSusp(!state.susp); };                   // :8145
```

`state.susp` on its own is **display only** (the plinth read-out, "Suspended · 15 cm off the floor").
Everything that matters hangs off `state.antoso`. **The harness plan was measuring nothing:** it drove
`{susp: true}` and never set `antoso`, so the client dumped a plain base grid, which made our
`engineering.suspended` filter look like an invented control with no ground truth. It is an invented
control — but the app's real one exists, and we had not ported it. Driving `{susp:true, antoso:true}` on
Base › Accessories & Surround takes the app from **20 cards to 5**.

Three behaviours, none of them a tier/flag match:
* **the gate** — `antosoOk(u)` is one of the eight `available(u)` gates → greys. Already ported
  (`capabilities.antosoApproved`), and it was already correct; it just had no query param to switch it on.
* **the hide** — `blockVisible`'s ANTOSO clause, and it is **Base/Tall only**: a family passes on the
  allow-list (`ANTOSO_ALLOWC` = 3 codes, `ANTOSO_ALLOWS` = "Stainless Steel Sinks" / "Visible Carcase
  Sides" matched against `sec + label`), else Appliance housing is dropped outright and everything else
  must have one unit inside the envelope. Wall/Midway are never hidden. Ported as `antosoFamOk`.
* **the re-face** — v671/v672: a Base/Tall card SHOWS its approved variant rather than rendering dead.
  Ported into `faceUnit`, before the Fronts twin swap, in `visibleBlocks` order.

⚠️ **The envelope has two forms and the app uses both.** `capabilities.antosoApproved` is
`antosoU(u, cat, '')` — the gate's call, with an EMPTY sub, so a sink's depth ceiling is 58 cm. The hide
and the re-face pass the REAL sub, where `/sink/i` raises it to 62 cm. So the stored flag stays the gate
and `antosoU` was ported live for the other two. Reproduced, not unified.

Shipped as a new **`antoso`** boolean query param (`suspended` survives as an API-only engineering-flag
filter, documented as not-the-toolbar-toggle); the lite UI's Suspended switch now sends it, and the
Gates checkbox ORs into the same client-side gate. Inert without it — every new code path is behind
`tb.antoso`. **All 12 susp states: 0 in all ten buckets**, first run; 7-state no-flag control clean.

**P5 — the search box is GLOBAL.** F1's last 24 states (24 MEMBER + 13 SECT). `blockVisible`:

```js
if (state.q) { const q = state.q.toLowerCase().replace(/toe[\s-]?kick/g, 'plinth');
               return (b.label||'').toLowerCase().includes(q)
                   || b.units.some(u => u.c.toLowerCase().includes(q)); }
```

It **returns**. Every test below it — category, sub-category, the Design-Tasks leaf, W/H/D, the FRONTS
chip, line, ANTOSO — is skipped, so a search typed inside Base › Sinks can return a Tall card. The app's
`q=TSP` set is the same 31 families in all 12 sub-category states; ours AND-ed `q` with the category and
returned **0** in every one of them.

Fixed in `buildItemFilter`: when `q` is present it returns a REDUCED filter — the match plus only what
sits above the app's return, i.e. the v319 programme tier gate (hoisted into a local so it can be
re-applied; the FRONTS-chip gate is *below* the line and is dropped) and the `byprog`/empty-`ppool` hide,
which is post-group (`openFamilyOk`) and needed no change. The API-only `active` / `kind` / `sku`
narrowings are kept — they have no counterpart in the app's grid model and are nobody's search scope.
Two details taken from the app: `toe kick` / `toe-kick` -> `plinth` (USA/UK), and the match is **sku or
`familyFacts.label`**, NOT the unit's own `name`. `name` is a superset the app never searches; matching
it surfaces families the app hides. The face still comes from the pool, so a family matched through one
member fronts its normal unit.

Put it in the backend rather than the lite UI on purpose: unlike the H-bar (2c-7, a genuine display
pre-select), this is not a client-side interpretation of a filter — it is what the endpoint's `q` MEANS.
Fixing it once serves the React client too. **All 24 q states: 0 in all ten buckets**, SECT and ORDER
included — `bucketSections`'s multi-sub gate (O2) already handles a result set that spans categories,
with no headers and no `pri` re-sort, which is exactly what the app renders.

Lite UI: `renderGridRows` already routed both row kinds correctly (the depth handler discriminates on
`pill.sku !== it.sku`; a `dead` pill is rendered unclickable), so the only edits were cosmetic parity —
draw the swatch on a `Finish` variant row from `pill.value`, teach `swatchUrl` the app's one special file
name (**`405` → `F+405_VS.jpg`**), and stop titling a `dead`+`selected` chip "Not available". Admin UI:
help text on `variantLabel` (the "Finish" exception) — no new control, nothing new to author.

**P6 — one family's default width is hardcoded, and it lives in the app's CODE.** E3's FACE 6: all six
states of `Panels & surround › Open Shelf Units` (`base`, `line73`, `progP_BOSSA`, `progA_LAIKA`,
`progC_ROCCA`, `tierC` — state-INdependent, which is the tell). App faces `RE905336` (W90), we faced
`RE305336` (W30).

`_selUnit`'s `dim==='width'` tail:

```js
const mw=(b.dim!=='depth')?defaultWidthMin(b):0;
if(mw){ const pw=preferWidth(sorted.map(x=>x.w),mw); … }        // prefer a "real" size
else   u = sorted.find(x=>available(x)) || sorted[0];            // else the narrowest unit
```

and `defaultWidthMin(b)` consults a per-family override FIRST: `if(b.dwm!=null) return b.dwm`.
`Panels & surround` matches none of the category arms (`Base`/`Tall`/`Midway`/`Appliance housing` → 60,
`Accessories & interior`/`Interior+` → 90, `Drawers & Pull-outs` → 80), so without the override `mw` is 0
and the face is the narrowest member — W30. The override is set once, at `:7583`:

```js
// default RE905336 -> float to units[0]
(function(){ var f=F('RE_SLIDEIN'); if(!f) return; f.dwm=90;
  var i=(f.units||[]).findIndex(function(u){return u.c==='RE905336';});
  if(i>0){ var u=f.units.splice(i,1)[0]; f.units.unshift(u); } })();
```

Two halves and both matter. The **unshift** makes `variantOpts(b)[0]` the `"53 cm"` height, so the face is
a 53 cm unit — we already had that, because the export captures the family's own unit order as
`unitFacts.unitIndex` (it is why we faced `RE305336` and not `RE302736`). **`dwm=90`** is the other half:
it sends `preferWidth([30,60,90,120], 90)` down its `[90,80,60,100,120]` branch → W90 → `RE905336`.

`\bdwm\b` occurs exactly three times in v781 — twice inside `defaultWidthMin`, once in that IIFE. So it is
a **one-family constant assigned in the app's init CODE, not in `<script id="DATA">`**: the same class as
`FORCE_SEC`, `SECTION_ORDER`, `WIDTH_BUCKETS`, `ANTOSO_ALLOWC`, `HEXT_MM`, every one of which we port as
code. Ported the same way — `FAM_DWM = { RE_SLIDEIN: 90 }` in `design-book.grid-rows.ts`, read by
`defaultWidthMin()` after the (long-declared, never-populated) `familyFacts.defaultWidthMin` override and
before the category arms. `famFacts()` now stamps `familyId` onto the facts object so the constant can be
keyed; that is the only new input and nothing else reads it.

**No data change, no backfill, no contract change, and deliberately so.** `familyFacts` is a loose
`Record<string, any>`, so if a future export ever emits `dwm` as `defaultWidthMin` it wins over the
constant with no code change — the override path was already there, it just had nothing to read.

Verified: W-All → `RE905336` in all six states, and `widthMm=600` still faces `RE605336` (an explicit W
filter outranks the default — that state never diffed). Full E3 re-sweep: **FACE 6 → 0**.

**Residue after §P — 8 + 12 + 1 + 1 on E2, plus the E3/F1/T1 legs.** Ranked, with the mechanism where it
is known:

1. **`Insert` row, 8 diffs** (`FP_16FRONT` only — `ZIGSUV90`/`ZIGSUV60`). The app's `b.insAx` row from
   `insList(b)`/`selIns(b)`. Needs per-unit `u.ins` in the contract (extractor + export + backfill), so
   it is the one item in this leg that is NOT pure logic. One family, 92 units.
2. **GREY 12 + MEMBER 1 + SECT 1 on E2** — `Alteration|Side Panel Modifications|progP_BOSSA`
   (`PNL_ACC` vs `PS_WAUKS_RECESS`, and the section header) and `Alteration|Accessory` cards we grey and
   the app doesn't (`MPOSKE`, `MPEKE`, `MPOT` under LAIKA/ROCCA). Same neighbourhood as §N(3)'s
   `avanceExempt`; not yet reduced to a mechanism.
3. ~~**E3's FACE 6**~~ (`RE_SLIDEIN`) — **fixed, P6 above.** What is left on that leg is **ORDER 2**
   (a consequence of the GREY diffs — availability is the tie-break) and **GREY_NOT_HIDE 1**.
4. ~~**F1**~~ — **all three flags fixed** (P3 `opening` −36 · P4 ANTOSO −18 · P5 `q` −37). Every one
   turned out to be a PORT, not the product decision they looked like: each control exists in the app,
   and in all three cases we had modelled it as a membership filter when it is a toolbar input — or,
   for `q`, a filter that REPLACES the others. What is left in this leg is the un-swept part of the
   plan: the 15 `grey_on*` states (need the patched dumper) and the `tallH*` states.
5. **T1, 144 diffs — the Design-Tasks sidebar**, i.e. §O5's per-membership `functionalGroups` gap. Still
   an extractor + export + contract + backfill change. Deferred by decision, not by ignorance.

Also un-swept, and now a known gap: **`GET tall-heights` ignores `antoso`.** The app's `availHeights()`
polls `blockVisible(b)`, which includes the ANTOSO clause, so with Suspended on the tall LINE/HEIGHT
options should narrow; ours computes them from `buildItemFilter`, which (correctly) no longer holds
anything for `antoso`. No plan state combines `susp` with `tallH*`, so this has no measurement behind it
— don't fix it blind, add the combined state first.

Un-swept still: `grey=true` (the 15 `grey_on` states need re-running with the patched dumper),
`page>1`, and the detail drawer.

---

### §Q. TWO MORE FROM THE §P RESIDUE (2026-07-30, late) — the `dwm` face and the FRMAT gate

Both pure backend logic, no data change, no contract change, `schemaVersion` stays **2.5.3**.

**Q1 — `isFrmatFamily` was read as a blanket exclusion; it is a QUALIFIER.** E3's `GREY 2` + the
`ORDER 2` that followed from it: `Panels & surround|Surround` under BOSSA and under LAIKA, family
`F124` / `FRMAT`, client live, ours greyed. The app's rule is one line in `progOkFor`:

```js
if (u.c === 'FRMAT' && !frmatKey(PROG_BY_KEY[pk].n)) return false;
//  v92 (Shimon): no row in the max-size table = FRMAT does not exist in that programme
//  (covers KYOTO, VALAIS — missing from the IDM exclusions)
```

So FRMAT is dead only in programmes whose NAME has no row in `FRMAT_MAX` (book ch.71.18). Our port —
and the REFERENCE PORT in the contract, which is where it came from — had

```ts
!(c.excludedPrograms || []).includes(k) && !c.isFrmatFamily && …      // ← kills all 120 programmes
```

Measured against the app's own table: of 120 programmes, `excludedPrograms` already excludes 111 for
this unit; **exactly 9 are excluded only by the size table** (SELVA 218, KYOTO 272, VALAIS 283,
STONE 294, SELVA-A 418, STONE-A 494, SELVA-C 718, VALAIS-C 783, STONE-C 794), and 2 more (BAHIA 250,
BAHIA-C 750) are in `excludedPrograms` for a different reason while HAVING a size row — so neither the
flag nor the list can be dropped in favour of the other. Ported as `FRMAT_DEAD_PROGRAMS`, a derived
constant of those 9 ids (`FORCE_SEC` / `FAM_DWM` class), and the clause is now
`!(c.isFrmatFamily && FRMAT_DEAD_PROGRAMS.has(k))`.

**The same bug is in the client's copy.** `availableFromCaps` is the port the React app greys pills
with, and the snippet it was copied from — `export-schema-v2.ts` and `design-book-crud-guide.md` §3 —
carried the blanket form (the contract's own prose one line above said the right thing:
"also `&& !(caps.isFrmatFamily && frmatExcluded(prog))`"). Both snippets fixed, with the 9 ids inline.

Verified: `Panels & surround › Surround` @BOSSA → `F69 · F124 · F263`, all three live, which is the
client's card order byte-for-byte (F124 and F263 share `catalogRank` 7118, so availability was the
tie-break — that is why one grey caused the ORDER diff). @LAIKA live; @KYOTO correctly DEAD (the size
table still bites); @ROCCA dead via `excludedPrograms`. **E3 GREY 2 → 0, ORDER 2 → 0.**

**Q2 — the E3 leg re-measured clean.** Full 200-state re-run after P6: **FACE 6 → 0**, every other
bucket byte-identical to the pre-fix baseline (MEMBER 3 · GREY 2 · SECT 1 · ORDER 2 · GREY_NOT_HIDE 1,
`out/report-E3d.json`). Q1 then took GREY and ORDER to 0 by hand-verification against the client dump;
a confirming re-sweep of the leg is the first task in the next session.

**Q3 — `famOkB` exempts the whole `Alteration` CATEGORY, not just accessories.** E2's `GREY 12`, every
one of them category `Alteration` under an Avance or Contino programme (LAIKA 410 / ROCCA 701), never
under BOSSA. The app:

```js
function famOkB(b, letter) { return !letter || b.cat === 'Alteration' || b._mem.includes(letter); }
//  av: vertCatOk(b,u) && (isAccessory(b) || (available(u) &&
//        (isProgAgnostic(b) || (famOkB(b, activeFamFor(b.cat)) && famOkU(u, activeFamFor(b.cat)))) &&
//        lineCardOk(b)))                                                            // :2834
```

Our port had the `memberTiers` half and a comment asserting the category was covered by
`isAccessory` — it is not. `MPOSKE`, `MPEKE`, `FRAUSR`, `FRAUSRH` (Accessory), `MPOT` (Cabinet
Modifications), `MPEZS` (Drawers & Pull-outs) and `MPHVERLVE` (Glass unit) are all
`isAccessory:false` / `isProgrammeAgnostic:false` with `memberTiers:'P'`, so the tier gate greyed them
everywhere outside Primo. `famOkU` was never involved — all of them carry `unitFacts.agnostic`, which
passes it. One clause: `f.category === 'Alteration' || !mem || mem.includes(fl)`.

Verified: all four subs at both programmes, 12 cards, `cardAvailable` true. Regression: `Base › Sinks`
@LAIKA still greys 8 cards (`ANRWA`, `ANBLS`, `MPRU`, `ANTSP63US` …) — alteration CODES whose card sits
in a Base family, so the exemption correctly does not reach them; the app tests `b.cat`, the family's,
which is what we read. **E2 GREY 12 → 0.**

**E2 residue after §Q3 — ROWSET 8 (`FP_16FRONT`'s `Insert` row, needs per-unit `u.ins`) + MEMBER 1 /
SECT 1** (`Alteration|Side Panel Modifications|progP_BOSSA`: client shows `PNL_ACC`, we show
`PS_WAUKS_RECESS`, and the `Sink, Fillers & Panels` header goes with it — a swap/split case, not a
gate, and untouched by Q3).

**E3 residue after §Q — 3 MEMBER + 1 GREY_NOT_HIDE**, all unexplained and all single-family:
`Pilasters|line73` (`XAG_Pa_a989a3` ours-only), `Side panels W|progP_BOSSA` (client has `XCRV_WF5R`,
`XCRV_WFI5R`, `CURVED_IslandCurvedSidePanel`; we have the `_M` variants of two of them — looks like a
variant-family split, not a gate), `Wall Cladding|line73` (`PPM3234` ours-only).

---

## §R — TASK 1 MEASURED, AND TWO MORE OFF THE RESIDUE (2026-07-31)

Pure backend logic again — **no data change, no backfill, no contract change; schemaVersion stays
2.5.3.** Backend `dev` @ `470c8003` (rebased onto `c0f45d44`, an unrelated `src/project/contract.*`
change someone else pushed mid-session).

### R1 — §Q1 confirmed by sweep (task 1, the E3 half)

§Q1 and §Q3 shipped hand-verified. The E3 leg now measures them, 200/200 states, 0 missing keys:

| bucket | `report-E3d` (pre-§Q) | `report-E3e` (post-§Q) |
|---|---|---|
| GREY | 2 | **0** |
| ORDER | 2 | **0** |
| MEMBER · SECT · GREY_NOT_HIDE | 3 · 1 · 1 | 3 · 1 · 1 |

Everything else was 0 before and stayed 0. **§Q1 is measured, not just argued.**

### R2 — ⭐ `lineCardOk` read the STORED height where the app DERIVES it

The app's own comment (v93) says what we missed: *"Many tall units carry no hc (height lives in the
code/H mm) — derive the code from H mm"*.

```js
const th=[...new Set(b.units.map(tallHC).filter(h=>h!=null))];   // ← tallHC, not u.hc
if(th.length) return th.some(h=>sys.has(h));
return true;                                                     // non-line family (accessories etc.)
```
```js
function tallHC(u){ if(u.hc!=null&&(TALL_H80.has(u.hc)||TALL_H73.has(u.hc))) return u.hc;
  if(u.H==null) return null; for(const c of TALLC){ if(Math.abs(u.H-c*10)<=8) return c; } return null; }
const TALLC=[146,153,190,197,204,210,217,224];
```

Ours filtered the raw `hc` to the two system sets. A family whose tall height exists **only** as
`heightMm` therefore yielded an empty `tall`, fell through to the permissive `return true`, and was
never hidden at a line it has nothing at. **`tallHC` was already ported in `design-book.grid-rows.ts`
and simply was not called** — a one-line fix, the second time this session a helper existed and the
call site read the raw field instead (cf. §O4-2, §R3).

Measured against the client, exactly: `Pilasters` 7 → **6** (`XAG_Pa_a989a3`, tallHC `[146]`,
80-system only) · `Wall Cladding` 2 → **1** (`PPM3234`, `[190]`). Their own siblings — `_B` `[153…]`,
`_C` `[217,224]` — are 73-system and correctly stay. **E3 MEMBER 3 → 1.**

### R3 — ⭐ a dup membership was wearing the PRIMARY's category, and `codeLoc` picks by category

`poolByFamily` already gives each dup membership its own `unitFacts` (§O4-2). `category` is the same
bug and is load-bearing: `familyBySku` indexes the pool by sku, and `locateFamily` — our port of the
app's `codeLoc` — breaks a tie with *"the family in the CURRENT category"*. With both memberships of a
shared code reporting the primary's category, that tie-break degraded to **Map insertion order**.

`WFAUKS` @BOSSA: `unitFacts.tier 'A'`, `siblingTiers 'PA'`, and the sku does not start with `A`/`C`,
so `core(u) === sku` and the v98 **sibling code is `WFAUKS` itself**. The app resolves it to `PNL_ACC`
— the card's own family — so `target === card.familyId` and it does **not** swap. We resolved it to
the dup `PS_WAUKS_RECESS` (`Panels & surround`), swapped, and thereby dragged a foreign sub into the
set, made it multi-sub, and lost the section header (§O2). One field, two buckets:
**E2 MEMBER 1 + SECT 1**, both verified fixed (`WFAUKS` back under `PNL_ACC`, header restored).

### R4 — ⚠️ the last E3 diff is an APP BUG. Do not match it.

`Side panels W|progP_BOSSA` is the whole of E3's remaining residue (MEMBER 1 + SECT 1 +
GREY_NOT_HIDE 1). The client shows `XCRV_WF5R`, `XCRV_WFI5R`, `CURVED_IslandCurvedSidePanel`; we show
the `CURVED_*_M` families. **The codes rendered are identical on both sides** — only the family
attribution differs — and the two sides agree in *every other state* (base · d68 · line73 · LAIKA ·
ROCCA · tierC). It looked like §N's bad-sample trap; it is not, and it is not ours either:

```js
splitFam('CURVED_CurvedSidePanel',       'Curved Side Panel',        1);
splitFam('CURVED_IslandCurvedSidePanel', 'Island Curved Side Panel', 3);
['XCRV_WF5R','XCRV_WF15R','XCRV_WFI5R','XCRV_WFI15R'].forEach(function(id){
  var i=FAMS.findIndex(f=>f.id===id); if(i>=0) FAMS.splice(i,1); });   // ← REMOVED from FAMS
});
```

The app splits those families and then **deletes** the `XCRV_*` originals — but `CODE_INDEX` (byte
16,499,634) and `FAM_BY_ID` (16,604,814) are both built **before** the splice (16,675,665), so both
keep entries for the deleted families. Under a programme the v98 swap calls
`codeLoc('WF5R36') → XCRV_WF5R → FAM_BY_ID[...]` and renders a card for a family `FAMS` no longer
contains. Our export is taken post-init and correctly has no `XCRV_*` family at all
(`GET items?familyId=XCRV_WF5R` → 0 units), so matching this would mean **re-adding families the app
itself removed**. Left as-is deliberately, like §O4-3's duplicate `217`.

**E3 residue: 1 state / 3 buckets, all of it R4.** Everything else on E3 is 0.

### Open

* **E2** — measurement of §Q3 + R3 was still running at write-up; expect `GREY 12 → 0` and
  `MEMBER 1 / SECT 1 → 0`, leaving `ROWSET 8` (`FP_16FRONT`'s `Insert` row, the one genuine data gap).
* ⚠️ **`lineCardOk` is missing the app's v376 clause** and it is **completely un-swept** — no plan
  state anywhere combines line 80 with a programme (checked: exactly one `line=80` state, no
  programme). The app has
  `if(state.progMap && (activeFamFor('Base')==='A'||activeFamFor('Tall')==='A') && state.line==='80'
  && activeFamFor(b.cat)!=='A') return true;` — an Avance line-80 lock that exempts non-Avance zones.
  Ours would hide cards the app keeps. **Add a `line80 + progA_*` state to a plan and measure before
  porting it** — do not add unmeasured logic.
