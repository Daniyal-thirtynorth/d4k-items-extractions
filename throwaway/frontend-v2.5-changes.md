# D4K-frontend — design-book v2.5 (`gridRows`, card membership) implementation

## Before you start — what to point at

Everything in this document needs the backend from **`D4K-backend` branch `dev`, commit `9dc6a834`
or later**, running against the **D4K-dev** database. Neither half is optional:

* The code is only on `dev` — it has **not** been released to prd.
* **D4K-prd is missing the data** (`unitFacts`, `familyFacts`, `gridHidden`, `dupFamilies`,
  `faceWidthMm`) and its `sectionRank` is **stale** — wrong values, not absent. A grid built against
  prd will look plausible and be subtly wrong.

```bash
cd D4K-backend && git checkout dev && git pull && npm run build && node dist/main.js   # :8000
#   .env → MONGO_URI must be the D4K-dev cluster (it is line 2 by default)
```

`NEXT_PUBLIC_API_URL=http://localhost:8000/` is already the default in the frontend `.env`.

**30-second smoke test** — if this returns what is shown, you have the right backend and DB:

```
GET /design-book/items/by-section?category=Base&subcategory=Sinks&programs=244
      &depthClass=58&lineState=73&groupBy=family&grey=false&refs=true&limit=5

→ sections: [ { "section": "Sink Units", "count": 5 } ]
  first card: TSP6073   ← re-faced to the 73 line by lineState
  cardAvailable: true
  gridRows[0]: { "label":"H", "kind":"height",
                 "pills":[ { "label":"73","value":73,"sku":"TSP4573","selected":true,"off":false } ] }
  refs: 45 entries
```

Note that H pill: the card is a **60 cm** unit and the pill's sku is a **45 cm** one. That is correct
and is the whole point of R3 — never click a grid pill by `pill.sku`.

---

Line refs are `origin/dev` = `25b19af9`. Everything below is additive on the API side — no field is
removed or renamed — but it **deletes** a large slice of client logic that v2.3 asked you to write.
The backend half already shipped (D4K-dev; `dev` branch code, `design-book.grid-rows.ts`); this
document is only the frontend work to *consume* it.

> **Re-checked 2026-07-29 (late).** `origin/dev` is **still `25b19af9`** — no frontend commits since
> this document was written, so every line ref below is still accurate (spot-verified:
> `useCardSwap` `hooks.ts:239`, `key={card.familyId || card.sku}` `catalog-grid.tsx:63`,
> `params.ts:87`, `unit-card.tsx:422`/`:464`, `caps.ts:11`, `detail-panel.tsx:177`).
> **The API moved, though** — see the next section. None of it changes the work list; one item
> (R9b) changes what you should EXPECT on screen under a programme.

## ⭐ v2.2 and v2.3 HAVE landed — this composes with them

I diffed `origin/dev` against both earlier guides. Unlike when v2.3 was written ("Neither v2.2 nor
v2.3 is in `dev` yet"), **both are now in `origin/dev` in full**:

| Guide | Step | Status on `origin/dev` |
|---|---|---|
| v2.2 | 1 `data/order-code.ts` | ✅ landed (`isDepthStatePill` `:4`, `depthRowState` `:17`, `orderCodeLines` `:71`) |
| v2.2 | 2 stop stamping depth `selected` | ✅ landed (`api/hooks.ts:74`) |
| v2.2 | 3 card: depth state row · `217+` · order code | ✅ landed (`unit-card.tsx:464-489`, `:713-720`, `:673`) |
| v2.2 | 4 drawer | ✅ landed |
| v2.2 | 5 types | ✅ landed (`ConfigureOption.code`/`alteration` `:180-183`, `HeightExtension` `:266`) |
| v2.2 | 6 CRM authoring form | ⚠️ **partly** — `design-book-item-dialog.tsx` exists and covers everything up to 2.2, but **nothing from 2.3 onward**. See Step 7 |
| v2.3 | 1 types | ✅ landed (`Capabilities` `:141`, `RefRow` `:308`, `heightCode` `:298`, query keys `:464-477`) |
| v2.3 | 2 `data/caps.ts` | ✅ landed (75 lines, `availableFromCaps` `:11`) |
| v2.3 | 3 stop sending `heightClass` for the line bar | ✅ landed — **and improved**: `params.ts:87` still sends `line` in TALL context only |
| v2.3 | 4 page refs map | ✅ landed (`hooks/use-refs.tsx`, provider `index.tsx:466-470`) |
| v2.3 | 5 family swap | ✅ landed — as **`useCardSwap` in `api/hooks.ts:239`**, not `hooks/use-card-swap.ts`, and with an ordered **candidate chain** instead of one spec (better than the guide) |
| v2.3 | 6 card W/H/Ty swaps · collapse · grey · selected | ✅ landed (`unit-card.tsx:394-462`, `:700-754`) |
| v2.3 | 7 `items/by-section`, sections verbatim | ✅ landed (`index.tsx:217-221`, `catalog-grid.tsx:51-74`) |
| v2.3 | 8 drawer keeps `pill.sku` | ✅ landed (`detail-panel.tsx:177`) |

So nothing here is "also do v2.3 first". **v2.5 mostly REMOVES v2.3 code.** Which parts are now dead
is spelled out in the supersession table below — do not implement them twice, and do not "restore"
them when you see the deletions.

**Work list**

| Step | Task | Files |
|---|---|---|
| **1** | Types — `GridRow`/`GridPill` + the five new card fields + `lineState`. Do this first | `api/types.ts` |
| 2 | Query params — send **`lineState`**; note what `grey` now means | `api/params.ts` |
| 3 | Swap queries must carry the **toolbar** (else the swapped card's rows come back uncollapsed) | `components/unit-card.tsx` (+ nothing in `api/hooks.ts`) |
| 4 | Grid card — render `gridRows` verbatim; one click dispatcher; `cardAvailable`; `heightExtensionOk`; **delete** the per-card line re-face | `components/unit-card.tsx` |
| 5 | Grid — nothing to do, but do not "fix" the React key to `sku` (dup families) | `components/catalog-grid.tsx` |
| 6 | Drawer — nothing to do. `parameters.*` IS the drawer model | `components/detail-panel.tsx` |
| 7 | Item authoring dialog — `showUnderLine` on the W/H rows, five scalar fields, the structured blocks read-only | `design-book-item-dialog.tsx` |

**Out of scope** — the dead `api/adapt.ts` + `data/filter.ts`; the
`handle`/`front`/`open`/`doorline` toolbar controls (they still don't exist, so those four gates stay
inert); the detail drawer's pill model.

⚠️ **Step 7 is not optional any more.** It was listed as a nice-to-have before; a field-by-field
audit of the authoring dialog against `origin/dev` found that **every contract field added from 2.3
onward is missing from it** — including `showUnderLine` on the W/H pill rows, which means any item
edited through that dialog today silently loses its per-line pill visibility. Details in Step 7.

---

## ⭐ API changes since this document was written (2026-07-29, sweep round 3 — audit §N)

Backend `dev` branch + D4K-dev data. **schemaVersion 2.5.2 → 2.5.3.** Four server-side fixes; the
only one with a visible consequence for you is the first.

| # | Change | What it means for the frontend |
|---|---|---|
| **1** | **The v98 sibling-family swap is now applied** (`applySiblingFamilySwap`). Under a zone programme, a card whose face is in another tier but whose model has a twin in the active one resolves to that twin — which usually lives in a **different family** — and the app's own dedupe then collapses the pair into ONE card. | **Card COUNT drops under a programme, and a familyId can vanish.** `F115` and `F209` are two cards with no programme and **one** card (`F209`) under an Avance programme; same for `F93` ⇄ `F106` in Wall › Corner. This is correct — it is what the app does. See **R9b**. |
| 2 | **Section ORDER fixed.** `sectionRank` had been captured with the wrong key (`SECTION_ORDER[f.sub]` instead of `SECTION_ORDER[subDisp(f)]`), so on Tall every section of a merged sub came out in the wrong order. Re-captured, 78 families / 1,130 items. Plus the app's `_subs.size===1` guard: a task leaf spanning several subs falls back to first-seen/`pri` order. | Nothing to do — **reinforces R10**. Render `sections[]` in the order given; never sort them client-side. |
| 3 | **Card ORDER inside a section fixed.** The `maxh` sort tiebreak was computed over the *filtered* group, not the family's whole member list, so any unit-level filter (`line=80`, `tier=C`) reshuffled sections whose families have no `pri`. Now taken from the unfiltered pool. | Nothing to do — **reinforces R10**. Do not re-sort cards. |
| 4 | **`familyFacts.rawSub`** added (2.5.3) — the app's raw `f.sub`. `Item.subcategory` is the DISPLAY name and `TALL_MERGE` folds three Tall subs into one, so the raw one is needed for the programme-tier hide. | Client does **not** need it (same as `unitFacts`/`familyFacts` — don't type it). Authoring only — see Step 7. |
| **5** | **`gridRows` now ships on UNGROUPED lists**, and the **refs map now covers `gridRows` pill targets**. | **Two caveats in this document are retired.** A `sku:[…]` navigation (tier badge, finish chip, depth sibling) keeps full rows instead of falling back to `parameters.*`, and a Ty click can rely on `refs[pill.sku].variantCore`. See R2 and R3's notes; open items 2 and 3 are struck through. |

Not yet on D4K-prd: the 2.5.x data backfills (`unitFacts`, `familyFacts` incl. `rawSub`, `gridHidden`,
`dupFamilies`, `faceWidthMm`, `sectionRank`). Point at D4K-dev while building against this document.

---

## What v2.5 supersedes in v2.3

| v2.3 rule | v2.5 status |
|---|---|
| **R1** "the H bar changes membership **not at all**" | ❌ **WRONG, corrected here (R6).** `lineCardOk(b)` is also a membership gate in the app's `blockVisible` — 22/9/25 Base families vanish at line 73/80/86 (audit §M3). The bar is still not a *unit* filter, but it does hide families. |
| **R1** per-card client-side re-face on a line pick | ❌ dead — the server re-faces (`lineState`, R6). Delete the effect at `unit-card.tsx:374-384`. |
| **R2** grid W/H/Ty resolve by `familyId`+dims, never `pill.sku` | ✅ **still true and now stronger** (R3) — but the pill now comes from `gridRows`, and the swap must also carry the toolbar (R4). |
| **R3** page-level refs map | ⚠️ **mostly dead.** Per-pill greying and Ty selection are server-computed now. The map survives only as the `variantCore` lookup for a Ty click — and it does **not** cover every `gridRows` target (measured below). |
| **R4** `showUnderLine` client-side collapse | ❌ **dead on grid cards** — the server collapses (`lineState`). Keep the helper only for the legacy fallback branch. |
| **R5** whole-card grey via local `availableFromCaps` | ⚠️ **downgraded to a fallback** (R5 here) — a local computation sees one unit and cannot apply `famOkB`/`famOkU`; that left 31 Base cards ungreyed (audit §M5). |
| **R5** per-pill grey via target caps | ❌ dead on grid cards — `pill.off` / `pill.dead` ship computed. Still needed for the **FRONTS tier badges**, which are NOT part of `gridRows`. |
| **R6** render `sections[]` verbatim | ✅ unchanged, reinforced (R10). |
| **R7** `heightCode` is the H-row key; a null pill sku is not dead | ✅ unchanged — and now moot on the grid, because `gridRows` pills carry their own `value`. Still the query key for an H swap. |

---

## The rules you're implementing

Ten findings, all measured against the live v781 app and already reproduced server-side. Ground truth
is `d4k-items-extraction/docs/design-book-api-ui-map-v2.md` (**§**) and
`docs/client-ui-parity-audit.md` (**§M**); every rule below cites the one it comes from.

### R1 · `gridRows` — the card's rows are computed server-side; render them VERBATIM (§2c-11)

In the app a grid card's **Line / H / W / D / Ty** rows are built from the FAMILY POOL —
`ppool(b)` → `hvals(b)` → `wsAtH` → `dAll` → `variantOpts(b)`. `parameters.*` is a *different
question*: it is ONE unit's DETAIL-panel pill list, so it misses heights the current variant lacks and
offers rows the grid never draws. That mismatch was ~all of the measured `ROWSET` + `PILLS` diffs
(audit §L root cause #1: 750 + 347).

`GET items?groupBy=family` and `GET items/by-section` now ship the built rows:

```jsonc
gridRows: [
  { label: "H",  kind: "height",  pills: [ { label: "73", value: 73, sku: "TSP4573", selected: false, off: false } ] },
  { label: "W",  kind: "width",   pills: [ … ] },
  { label: "D",  kind: "depth",   pills: [ { label: "63", value: 63, sku: "TSP6080", selected: false, off: false } ] },
  { label: "Ty", kind: "variant", pills: [ { label: "S2Z", value: "S2Z", sku: null, selected: false, off: true, dead: true } ] },
  { label: "Line", kind: "line",  pills: [ { label: "86 · J", value: "86", sku: null, … } ] }
]
```

* `selected` — the card's own value on that row. **Do not compute it.**
* `off` — greyed (the app's `wn`) but **still clickable**.
* `dead` — `disabled`, no unit behind it. Not clickable.
* `sku` — the unit the pill lands on. **Informational only on the grid** (R3).
* Row order is the app's: `Line → H → W → D → Ty`; the `217+` chip hangs off the H row (R8).

**No deriving rows from `parameters.*`, no `showUnderLine` filtering, no computing `selected`, no
per-pill greying** on a grid card. The DRAWER keeps `parameters.*` — that IS the app's detail model
(§2c-4, §2c-10).

### R2 · An EMPTY `gridRows` is an ANSWER, not missing data (§M9-1)

The lite UI required `gridRows.length` before using them and otherwise fell through to the
`parameters.*` path. That drew a **W row on cards the app leaves bare** — two-unit accessory families
where only ONE unit has a width, so the app's `vsd.length > 1` test fails. It was **all of Base
ROWSET 24 and Tall ROWSET 42** in round 3.

Verified live just now:

```
GET items?familyId=F2013__DRWDUP&groupBy=family&limit=3
  → ANK45 · "gridRows" present · length 0     ← renders with NO chip rows
```

**Only an ABSENT `gridRows` may use the legacy `parameters.*` path.** Branch on
`Array.isArray(card.gridRows)`, never on `card.gridRows?.length`.

> **Updated 2026-07-29 — `gridRows` now ships on UNGROUPED lists too.** The doc previously said a
> `sku:[…]` navigation carries no rows; that gap is closed. Verified:
>
> ```
> items?sku=CTSP6080&full=true&limit=1
>   → CTSP6080 (its own sku, NOT re-faced) · gridRows 3
>     H [73 80* 86] · W [45 50 55 60* 70 80 90 100 120] · D [58* 63 68]
> ```
>
> So the tier-badge / finish / depth-sibling navigations keep full rows, correctly selected, and the
> legacy branch is effectively unreachable. **Keep the `Array.isArray` guard anyway** — it costs
> nothing and `[]` still means "no rows" — but do not build the fallback out as a real feature.
>
> ⚠️ Still true, and now the *only* reason ungrouped differs: an ungrouped row carries **no
> `cardAvailable` and no `heightExtensionOk`** (both are attached on the grouped path). R5's `??`
> fallback and R8's `!== false` test are what cover that — do not tighten either to `=== true`.
>
> ⚠️ Also unchanged: `groupBy=family` still RE-FACES. `items?sku=CTSP6080&groupBy=family` returns
> `TSP6080`, the family face. A sku navigation must stay ungrouped.

### R3 · Never click a grid pill by `pill.sku` (§2c-11, §2c-8)

Straight out of `list-grouped.json` in the sample set:

```
card  TSP6080         (SNK1, widthMm 600)
H row 73 → TSP4573    80 → TSP4580 (selected)    86 → TSP4586      ← all W45 units
```

The card is a **60 cm** sink unit and its H pills point at **45 cm** ones. That mirrors the app: the
grid chip's unit is only the tooltip/`sel` source, and the click is `pickHeight(fid, hc)` — a
re-pick over the family. Same shape in `tall-line73.json`: card `H60197GAIZ` (W60), H pills
`H45210GAIZ` / `H45224GAIZ`.

Route **every** grid pill click by `familyId` + the pill's **`value`** (v2.3 R2's swap queries and
retry order still apply, restated in the quick reference below). `pill.sku` is correct **only** in
the DETAIL drawer, and on the DEPTH row where it is the state-vs-sibling discriminator (v2.2 §2c-2 —
a depth pill with `pill.sku === card.sku` is state, no fetch).

> **Updated 2026-07-29 — the refs map now DOES cover `gridRows` targets.** The ref collector walks
> `gridRows[].pills[].sku` as well as `parameters.*`, so the 6 missing H-row targets this document
> originally listed are gone. Verified on SNK1: 15 pill targets, 12 in `refs`, and the only 3 absent
> are `TSP6080` — **the card's own sku** (the D row's self/state pills), which needs no ref entry.
>
> A Ty click can therefore rely on `refs[pill.sku].variantCore` in practice. **Keep the `sku:[…]`
> fallback anyway** as a cheap last resort — it is one line and it covers a card swapped in from a
> page whose refs you never merged.

### R4 · A swap query must carry the TOOLBAR, or the rows come back uncollapsed (§2c-11 "Toolbar inputs")

Rows are computed **for the request's toolbar**. A card fetched by a pill click with only
`familyId`+dims gets full, ungreyed rows and then replaces a collapsed card — the row set flickers and
then diverges.

| param | what it does to the rows |
|---|---|
| `lineState=73\|80\|86` | collapses H (and W) to that line; `line` and `heightClass` are accepted aliases |
| `depthClass` | greys the D/W/H pills whose unit isn't orderable at that depth; drives `depthFamilyOk` |
| `tier`, `opening`, `programs` | the pool (`ppool`) + every per-pill `off` gate |

Verified live:

```
GET items?familyId=SNK1&heightCode=73&widthMm=600&groupBy=family&limit=1
        &depthClass=68&grey=true&lineState=73&programs=244&refs=true
  → TSP6073 · cardAvailable false
    H [73*]   W [45o 50o 60*o 70o 80o 90o 100o 120o]   D [58* 63 68]
```

versus the same query without the toolbar, which returns the uncollapsed `H [73 80 86]`.

Also **pass `grey=true` on swap queries** regardless of the user's checkbox: a swap is "show me this
family's card at X", not a membership decision, and without it a `depthClass` mismatch returns an
empty page and the click does nothing.

### R5 · `cardAvailable` — use the server's whole-card grey, don't recompute it (§M5)

Every GREY diff in the round-2 sweep (31, Base) was `client=true, ours=false` and always under a
programme. The BACKEND was already right; the **UI** was recomputing the flag locally from
`availableFromCaps(card.capabilities, toolbar)`, which sees ONE unit and therefore cannot apply
`famOkB`/`famOkU` — *does the FAMILY/model belong to the picked programme's tier?*

The server now ships the app's own `av`:

```
av = vertCatOk(b,u) && (isAccessory(b)
      || (available(u) && (isProgAgnostic(b) || (famOkB(b,fl) && famOkU(u,fl))) && lineCardOk(b)))
```

as **`cardAvailable`**, and it already folds in `isAccessory` (accessories/alterations NEVER grey —
app v163, audit §L #4) and `depthFamilyOk`. Client rule:

```ts
const cardOk = active.cardAvailable ?? availableFromCaps(active.capabilities, toolbar);
```

**`cardAvailable` is only computed when the toolbar is non-bare.** `annotateFamilyAvailability`
returns early when depth is 58, line is ALL, and there is no tier / programme / opening — nothing to
gate on, so every card is available. That is why it is absent from `list-grouped.json` and
`by-section.json` (bare toolbar) and present in `tall-line73.json`. **Absent ⇒ available**, which the
`??` above already gives you. Keep the local computation as the fallback only.

`depthFamilyOk` / `lineFamilyOk` ride along on the same condition; the client does not need them
(they are already inside `cardAvailable` and inside the hide decision) — type them, ignore them.

### R6 · The "H 73 80 86" bar is `lineState`, and it DOES change family membership (§2c-11, §M3)

**This corrects v2.3 R1.** The bar is still not a unit-level filter, but the app's `blockVisible`
has a family-level gate the earlier reading missed:

```js
state.line !== 'ALL' && !lineGrey && !lineCardOk(b)   → hide the family
```

`F1571` (A-tier cooktops, hc 80) must vanish at line 73; 22/9/25 Base families are hidden at
73/80/86. The backend reproduces it (`lineFamilyOk` → `dropHiddenFamilies`, honouring `grey`).

So the client sends **`lineState=<line>`** on the grid list and the server does all three jobs:

1. collapses each card's H/W rows to that line (what v2.3 R4 did client-side with `showUnderLine`),
2. re-faces each card to its sibling at that line (what v2.3 R1 did with a per-card swap),
3. applies the family hide.

Verified live: `items?familyId=SNK1&groupBy=family&limit=1&lineState=73` → face **`TSP6073`**, rows
`H [73*] · W [45 50 60* 70 80 90 100 120] · D [58* 63 68]`.

**Do NOT send `heightClass` or `line` for the base bar** — those are real filters (v2.3 R1 stands on
that). `line` stays for the TALL two-row selector (`params.ts:87`), which is a genuine filter (§6b).

⚠️ **Stale-highlight trap (§2c-7) still applies** when comparing to the app: `#lineSeg`'s highlight is
never re-synced from `state.line`, so a screenshot can show a lit "73" over an H-All grid. Trust the
CARDS (face sku + row shape), never the toolbar chip.

### R7 · `grey=true` now controls FAMILY-level hides, not just the depth face (§M3, §2c-12)

`grey` used to mean one thing: skip the `depthClass` hard-filter so a family's native face comes back
and the client greys it (§2c-6). It now also decides the two family gates:

```
grey=false  →  depthFamilyOk===false or lineFamilyOk===false families DISAPPEAR   ← the app's default
grey=true   →  they come back, greyed (the app's "Grey don't hide" checkbox)
```

**What the React app should send: exactly what the user's checkbox says** — `f.greyDontHide`, which
defaults to `false` (`data/constants.ts:107`). That is the app's default behaviour, so the grid
matches out of the box, and the toggle (`size-bar.tsx:232`) now genuinely reproduces the app's
checkbox instead of only affecting depth.

> Harness caveat worth knowing (§M, "GREY_NOT_HIDE 38 → 76"): the lite UI hard-codes `grey=true`, so
> the HIDE path is **not** covered by the sweep numbers. It was verified by hand instead (`F1455` /
> `PNL_END` @D48 and @D68, `F1571` @line73 — absent; `F1571` @D68 — present). If the React app's grid
> membership diverges with the checkbox OFF, that is the first place to look.

### R8 · `heightExtensionOk` — whether the "217+" chip renders (§2c-11, §M9-3)

The `217+` chip is a **family** question, not a row question: the app appends it only when the
family's variant-scoped pool holds an **available** unit at height 217 (`_u217For`), and under a
programme that excludes it the chip is absent (`F1091` @ROCCA). It does **not** depend on the line —
at line 73 the H row shows 197/210/224 and the chip is still there. So it **cannot be derived from the
rendered H row**; the server answers it outright.

```ts
{active.heightExtension && active.heightExtensionOk !== false && <ChipRow label="217+" … />}
```

The field ships whenever the card has a `heightExtension` at all (it is computed in `attachGridRows`,
*not* behind R5's bare-toolbar early return) — so `!== false` is the right test, and absence means the
card has no extension to show. Everything else about the chip (v2.2 §2 — the pick is state on
the 217 unit, navigation off it, and `orderCodeLines` emits `[sku, addCode]`) is unchanged.

### R9 · `dupFamilies` — the same sku can be TWO cards (§2c-12, §M7)

41 synthetic families (`*__CKDUP`, `*__DRWDUP`, `*__SNKDUP`, `*__TRDUP`, `MRG_*`) re-list an
accessory under a second task area, and a few families genuinely share units. **74 items carry 79
extra memberships across 40 families.** The grid pipeline expands them into their own rows before the
family group, so a dup card arrives as a completely normal card carrying the DUP family's identity —
usually a different subcategory:

```
GET items/ANTSPSAUS?expand=all → dupFamilies[0] = { familyId: "F1970__CKDUP",
                                  subcategory: "Cooktops & Downdrafts", section: "Accessories & Modifications", … }
GET items?familyId=F1970__CKDUP&groupBy=family
  → ANTSPSAUS | F1970__CKDUP | Base / Cooktops & Downdrafts | Accessories & Modifications | Ty [Drawer, Pullout]
```

while the item's own record is `F1970` / Base / **Sinks**.

**Any React `key` or client-side dedupe keyed on `sku` will drop or collide those cards.** Key on
`familyId` (or `familyId + sku`). `catalog-grid.tsx:63` is already `card.familyId || card.sku` —
**correct as-is; do not "simplify" it to `card.sku`.** The rule is a landmine warning, not a task.

### R9b · Under a programme, TWO families can collapse into ONE card (§N4)

Added 2026-07-29. The mirror image of R9: R9 says one sku can be two cards, R9b says two families can
be one card.

`visibleBlocks` runs a swap the earlier port missed — "the card pre-selects the article of the zone's
pricebook":

```js
const fl = activeFamFor(b.cat);                    // the programme's tier letter
if (fl && u.fam && u.fam !== fl && String(u.sib||'').includes(fl)) {
  const sc = sibCode(u, fl), loc = sc ? codeLoc(sc) : null;
  if (loc && loc.fid !== b.id) { b = FAM_BY_ID[loc.fid]; u = …; }   // → ANOTHER family
}
…
{ const seen = new Set(); … }                      // then dedupe by b.id, keeping the FIRST
```

So a Contino-faced card under an Avance programme becomes its Avance twin, that twin usually lives in
a different family, and the pair collapses. Measured: Tall › Panels, Fillers & Surrounds returns
**28 families under LAIKA and under ROCCA** (the app: 28), where an unswapped list returns 29 —
`F115` (`CHP20154`) becomes `F209` (`AHP20154`) under Avance and vice-versa. Wall › Corner: `F93` ⇄
`F106`, 6 cards either way.

**Nothing to implement — this is a warning about expectations.** But three things follow:

* **The card count legitimately changes when the programme changes**, beyond greying. Do not treat a
  drop as a lost-data bug.
* **`familyId` is not stable across toolbar states.** If anything keys client state (open drawer,
  scroll anchor, selection) on `familyId`, it can point at a family that is not in the next response.
  Key on it for React identity (R9 still stands) but re-resolve it after a programme change.
* **Do not re-add any client-side "prefer the programme's article" logic.** The server already did it,
  and doing it twice would swap a card that was already swapped.

### R10 · The FACE, the card ORDER and the section ORDER are all server-final (§2c-12, §M2, §M6)

Three things the client must not re-do:

* **FACE.** Picked by a port of the app's `_selUnit` over the family pool. Two consequences that
  surprise people, both correct: a card's face width can differ from the W filter (the app faces a
  W90 filter with a 50 cm cabinet when the tier pool says so — §2c-9), and the face is often a
  Contino/`C…` or Avance/`A…` article. **Do not re-pick or re-sort cards.**
* **ORDER inside a section.** The app re-sorts by raw catalog `pri` alone before bucketing, so a
  **greyed card keeps its catalog position instead of sinking**: `Cooktop Units @D68` =
  `BZ2 BSZ2 BZ BSZ BZIZ` with BZ/BSZ greyed *in the middle* (§M6). Availability survives only as the
  stable tie-break. Render `sections[].cards` in the given order (v2.3 R6 — reinforced).
* **`gridHidden`** (57 items). 46 detail-only families (`b.hid`) plus 44 codes that belong to no app
  family — the units the app's own init deletes (`meta.recoveredArtifactSkus`) and the extractor's
  ItemRef-only stubs (`760`, `761`, `SZIZ`, `US`, …). They are dropped from every LIST but stay
  fetchable by sku. Nothing to implement — it just explains why `GET items/:sku` can 200 on a code
  that never appears in any grid (and why refs and the drawer are unaffected).

---

# How the frontend calls the API — quick reference

Every request below was run against the local backend while writing this; the arrows show the real answer.

## 1. The grid list

```
GET /design-book/items/by-section
      ?leafId=b_water%230 &programs=244 &depthClass=58
      &lineState=73                    ← NEW: the H bar (R6). NOT heightClass, NOT line
      &groupBy=family &grey=false &refs=true &page=1 &limit=60
```

`grey` follows the user's "Grey don't hide" checkbox (R7). Response: `sections[]` (ordered +
header-merged, unchanged), each card carrying **`gridRows`**, `cardAvailable`, `heightExtensionOk`,
plus its own `capabilities`, `heightCode`, `variantCore`, and the page `refs` map.

## 2. Drawing a card's rows — no request at all, and no logic

```js
card.gridRows.map(row => row.pills.map(p => ({
  text:     p.label,
  selected: p.selected,      // computed server-side — do not derive
  greyed:   p.off,           // still clickable
  disabled: p.dead === true, // not clickable
})))
```

`Array.isArray(card.gridRows) && card.gridRows.length === 0` ⇒ **render no rows** (R2).

## 3. The click handlers — by `familyId` + `pill.value`, never `pill.sku`

Every candidate also carries `groupBy=family&limit=1&grey=true&refs=true` **and the toolbar**
(`lineState`, `depthClass`, `tier`, `programs` — R4).

| Pill kind | Request | Retry when empty |
|---|---|---|
| **height** | `items?familyId=…&heightCode=<value>&widthMm=<card's>` | drop `widthMm` |
| **width** | `items?familyId=…&widthMm=<value×10>&heightCode=<card's>` | drop `heightCode` (**keep the width**) |
| **variant** | `items?familyId=…&variantCore=<refs[pill.sku].variantCore>&widthMm&heightCode` | drop `widthMm`, then `heightCode`, then fall back to `items?sku=<pill.sku>` |
| **depth** | `pill.sku === card.sku` ⇒ **no request** (state pill, v2.2 §2c-2); else `items?sku=<pill.sku>` **+ the toolbar, ungrouped** | — |
| **line** | not modelled — see "unverified" | — |

Real answers (all verified):

```
familyId=SNK1 &heightCode=73 &widthMm=600 &lineState=73&depthClass=68&programs=244&grey=true  → TSP6073, H [73*]
familyId=SNK1 &lineState=73                                                                   → TSP6073 (face re-picked)
familyId=F2013__DRWDUP                                                                        → ANK45, gridRows []
familyId=F1970__CKDUP                                                                         → ANTSPSAUS under Cooktops & Downdrafts
sku=CTSP6080  &groupBy=family                                                                 → TSP6080  ← ⚠️ groupBy re-faces to the FAMILY face
```

That last one is why a **sku navigation cannot be `groupBy=family`**: it returns the family's face,
not the sku you asked for. So the tier-badge / finish / depth-sibling navigations stay ungrouped —
but as of 2026-07-29 they **do** come back with `gridRows` (R2), so add the toolbar to them:

```
items?sku=CTSP6080&full=true&limit=1                 → CTSP6080 · H [73 80* 86] · W […] · D [58* 63 68]
items?sku=CTSP6080&full=true&limit=1&lineState=73    → CTSP6080 · H [73]        ← toolbar honoured
```

Without the toolbar the swapped-in card's rows come back UNCOLLAPSED and visibly change shape, the
same failure R4 describes for family-scoped swaps. The one thing an ungrouped row still lacks is
`cardAvailable` / `heightExtensionOk`.

## 4. The top "H 73 80 86" bar

One parameter on the list request: `lineState=73`. **No per-card swaps, no client-side row
collapsing.** Card membership may shrink (R6) — that is correct — and comes back greyed with
`grey=true`.

## 5. The detail drawer — untouched

No `gridRows` there, by design. Keep navigating by `pill.sku`, keep a null `pill.sku` disabled
(§2c-4, §2c-10). The grid is the only place the rule differs.

---

## The same thing in plain English

**The idea in one line.** The card's buttons are no longer something the app works out from the
product it is showing — the server sends the finished buttons, already knowing which one is on,
which are dimmed, and which are dead.

**What used to happen.** Every card took the button list off the product it displayed, then filtered
it, then decided which button was highlighted, then greyed the ones that were not orderable. Four
guesses in a row. The trouble is that the button list belongs to the *detail page*, and the detail
page only knows the version you happen to be looking at. A cabinet that comes in six heights but only
four of them in the colour you are on would show four buttons on the card, where the real app shows
six.

**What happens now.** The server looks at the whole family — every version of that cabinet — works
out the rows exactly the way the original app does, and sends them. The card draws them and nothing
else. If the server sends an empty list, the card has no buttons; that is an answer, not a gap, and
the old "well, let me work it out myself then" fallback is what put a width row on cards that are
supposed to be bare.

**Clicking a button** is unchanged in spirit: a click is a question about the family — "which product
in this family is 42 cm, keeping the width I'm on?" — never "open the product this button points at".
The button *does* carry a product code, and it is usually the wrong one: on a 60 cm sink card the
height buttons point at 45 cm units, because in the original app that code is only used for the
tooltip.

**One new detail about the question.** Whatever the toolbar is set to — the line, the depth, the
programme — has to be repeated in the question. The server builds the buttons *for a toolbar*, so
asking without one gets you a card whose buttons are drawn for a blank toolbar, and the row visibly
changes shape the moment it swaps in.

**The greyed-out card.** There is now one flag that says whether a card is orderable at all, and it is
the app's own. It is worth more than anything the front end can work out, because it knows things a
single product does not — most importantly whether the *family* belongs to the programme you picked.
Working it out locally missed 31 cards.

**The "H 73 80 86" bar.** Send it as a display setting, not a filter. The server then does three
things at once: re-picks which product each card shows, shortens the height and width rows to that
line, and — this is the part we had wrong before — removes families that have nothing at that line at
all. That last one surprised us, but it is what the original app does; the "grey, don't hide" tick box
is what brings them back.

**One product can be two cards.** A handful of accessories are deliberately listed under two different
areas of the catalog — a sink alteration also appears under cooktops. They arrive as two ordinary
cards with the same code and different families. Anything in the front end that assumes "one code, one
card" will silently drop one of them.

---

# Implementation

## Step 1 — `api/types.ts`

**1a. The row contract** (add after `ItemConfigure`, `:195`):

```ts
/** One pill in a server-computed grid row (api-ui-map-v2 §2c-11). */
export interface GridPill {
  label: string;
  value: number | string | null; // ⭐ the CLICK key — heightCode / width cm / variantCode
  sku: string | null;            // the unit it lands on. INFORMATIONAL on the grid (R3)
  selected: boolean;             // computed server-side — never derive it
  off: boolean;                  // greyed (`wn`) — STILL CLICKABLE
  dead?: boolean;                // `disabled` — no unit behind it
}
/** A grid card's row, already built from the family pool and toolbar-narrowed. */
export interface GridRow {
  label: string;                 // 'H' | 'W' | 'D' | 'Line' | the family's own Ty/Var label
  kind: "height" | "width" | "depth" | "line" | "variant";
  pills: GridPill[];
}
```

**1b. `ItemCard`** (`:272-301`) — five fields. `familyFacts` / `unitFacts` are the row-builder's
inputs and the client does **not** need them (§2c-11: "needed only if a client rebuilds rows itself");
don't type them.

```diff
   variantCore?: string; // R2 — Ty/option identity for the selected-pill test
   heightClass?: number; // face height class (73|80|86) — W/Ty swaps + LINE pre-select
   heightCode?: number;  // R7 — the H-ROW key (73/80/86 on line families, cm height elsewhere)
   doorLineYCode?: string;
   heightExtension?: HeightExtension;
+  /** ⭐ v2.5 — the card's rows, built from the FAMILY pool for the request's toolbar (§2c-11).
+   *  Render VERBATIM. `[]` is an ANSWER ("no rows"); only an ABSENT value may fall back to
+   *  `parameters.*` (R2). Present on groupBy=family lists and items/by-section only. */
+  gridRows?: GridRow[];
+  /** ⭐ the app's own whole-card `av` (§M5). Absent ⇒ nothing to gate on ⇒ available. */
+  cardAvailable?: boolean;
+  /** ⭐ does the "217+" chip render? A FAMILY question the H row cannot answer (R8). */
+  heightExtensionOk?: boolean;
+  /** family gates — already folded into cardAvailable + the hide decision. Informational. */
+  depthFamilyOk?: boolean;
+  lineFamilyOk?: boolean;
```

**1c. `ItemsQuery`** (`:445-483`) — one param:

```diff
   /** TALL — carcase LINE / height-system (73·80·86). A REAL filter (§6b). */
   line?: string;
+  /** ⭐ v2.5 — the "H 73/80/86" BAR (§2c-11). DISPLAY STATE: collapses each card's H/W rows and
+   *  re-picks its face. NOT a unit filter — but it DOES hide families with nothing at that line
+   *  unless grey=true (R6/§M3). Never send heightClass for this. */
+  lineState?: string;
```

*(`opening` — the app's P1/C1 toolbar toggle — is also a `gridRows` input, but this UI has no such
control, so it stays out. Same call v2.3 made for handle/front/doorline.)*

## Step 2 — `api/params.ts`

`buildItemsQuery` (`:58-106`). One line added, plus a comment correction — v2.3's "membership stays
put" claim is now known to be wrong (R6).

```diff
   // Size pills.
   if (typeof f.width === "number") q.widthMm = f.width * 10;
-  // The "H 73/80/86" seg. In TALL it's a real carcase-LINE filter → `line`.
-  // In base zones it is the LINE SELECTOR — a pre-select, NEVER a server filter
-  // (R1 §2c-7): sending `heightClass` here hard-filters membership AND collapses
-  // the face to the lowest width. It is consumed client-side instead (per-card
-  // re-face in unit-card + row collapse R4). So send NOTHING for base.
-  if (f.line && f.line !== "ALL" && isTallContext(f)) q.line = f.line;
+  // The "H 73/80/86" seg. In TALL it's a real carcase-LINE filter → `line`.
+  // Everywhere else it is DISPLAY STATE → `lineState` (§2c-11): the server collapses each
+  // card's H/W rows to that line AND re-picks its face. Still never `heightClass` (that one
+  // hard-filters membership and collapses the face to the lowest width). NOTE: `lineState`
+  // is not a unit filter but it DOES hide families with nothing at that line unless
+  // grey=true — the app does the same (§M3). v2.3's "membership unchanged" was wrong.
+  if (f.line && f.line !== "ALL")
+    (isTallContext(f) ? (q.line = f.line) : (q.lineState = f.line));
```

The `grey` line below it (`:100`) is already right — leave it:

```ts
  if (f.greyDontHide) q.grey = true;   // now ALSO the family-level hide gate (R7)
```

`refs=true` (`:103`) stays: the Ty click still reads `variantCore` out of the map (R3's note).

`toSearchParams` already serialises everything — no change.

## Step 3 — the toolbar on every swap

`useCardSwap` (`api/hooks.ts:239-260`) needs **no change** — it already takes an ordered candidate
chain and stamps `refs: true` on each. The toolbar goes in at the call site, where it is known.

In `unit-card.tsx`, after `const active: ItemCard = displayed;` (`:387`):

```ts
// R4 — rows are computed FOR A TOOLBAR, so every swap has to repeat it or the swapped-in card
// comes back with full, ungreyed rows. `grey` is forced on: a swap asks for THIS family's card,
// it is not a membership decision, and a depthClass mismatch would otherwise return nothing.
const stateQ: ItemsQuery = {
  groupBy: "family",
  limit: 1,
  grey: true,
  depthClass: toolbar.depth,
  tier: toolbar.tier && toolbar.tier !== "ALL" ? toolbar.tier : undefined,
  programs: toolbar.progKeys?.length ? toolbar.progKeys : undefined,
  lineState: line ? String(line) : undefined,
};
```

`programs` is safe here: it never hard-filters the list, it only feeds the pool + the `off` gates
(verified — `programs=244` returns SNK1 with `cardAvailable:false`, not an empty page).

## Step 4 — `components/unit-card.tsx`

### 4a. Imports + the `off` state on `Chip`

```diff
-import { ConfigureOption, ItemCard, ItemsQuery, ToolbarState } from "../api/types";
+import {
+  ConfigureOption, GridPill, GridRow, ItemCard, ItemsQuery, ToolbarState,
+} from "../api/types";
```

`Chip` (`:80-130`) has one state today (`disabled`). `gridRows` needs two — `off` (greyed, still
clickable) and `dead` (disabled). Add the prop:

```diff
   small?: boolean;
   title?: string;
+  /** Greyed but STILL CLICKABLE (the app's `wn`). Distinct from `disabled` (`dead`). R1 */
+  off?: boolean;
   byLabel?: boolean;
 }) => {
   const disabled = byLabel ? opt.available === false : !opt.sku || opt.available === false;
```
```diff
         opt.selected
           ? "border border-[#3E7FA8] bg-[#3E7FA8] text-white"
           : disabled
           ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400 opacity-60"
+          : off
+          ? "border border-gray-200 bg-white text-gray-400 opacity-50 hover:border-[#3E7FA8]"
           : "border border-gray-300 bg-white text-gray-600 hover:border-[#3E7FA8] hover:text-[#3E7FA8]"
```

### 4b. A `GridRowChips` renderer (module scope, beside `ChipRow` at `:168`)

```tsx
/** A GridPill through the existing Chip. `byLabel` because grid rows resolve by VALUE, never
 *  by pill.sku (R3) — a null sku must not disable the chip. */
const toOpt = (p: GridPill): ConfigureOption => ({
  label: p.label,
  sku: p.sku ?? undefined,
  selected: p.selected,
  available: p.dead !== true,   // `dead` = disabled; `off` is handled separately
});

const GridRowChips = ({
  row,
  onPick,
  accentFor,
}: {
  row: GridRow;
  onPick: (row: GridRow, pill: GridPill) => void;
  accentFor?: (p: GridPill) => string | null;
}) => {
  if (!row.pills.length) return null;
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-1 w-[22px] shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {row.label}
      </span>
      <div className="flex flex-wrap gap-1">
        {row.pills.map((p, i) => (
          <Chip
            key={`${row.kind}-${p.label}-${i}`}
            opt={toOpt(p)}
            off={p.off}
            byLabel
            accent={accentFor?.(p)}
            onPick={() => onPick(row, p)}
          />
        ))}
      </div>
    </div>
  );
};
```

### 4c. One click dispatcher — replaces `pickHeight` / `pickWidth` / `pickTy` (`:435-462`)

Keep those three only if you keep the fallback branch; the grid path uses one function.
(Since `gridRows` now ships on ungrouped lists too, that branch is effectively unreachable — R2.)

```ts
// R3 — route by familyId + pill.VALUE. R4 — every candidate carries the toolbar (stateQ).
// The retry chain relaxes the dimension the user did NOT pick (v2.3 R2, unchanged).
const pickGrid = (row: GridRow, p: GridPill) => {
  if (!cardOk) return;
  const n = typeof p.value === "number" ? p.value : Number(p.value);
  switch (row.kind) {
    case "height":
      return setSwap([
        { ...stateQ, familyId: famId, heightCode: n, widthMm: active.widthMm },
        { ...stateQ, familyId: famId, heightCode: n },
      ]);
    case "width":
      return setSwap([
        { ...stateQ, familyId: famId, widthMm: n * 10, heightCode: active.heightCode },
        { ...stateQ, familyId: famId, widthMm: n * 10 },
      ]);
    case "variant": {
      // `p.value` is the app's variantCode; the API filters on variantCore, which only the refs
      // map knows — and it does NOT cover every gridRows target (R3). Fall back to the sku.
      const vc = pageRefs.get()[p.sku ?? ""]?.variantCore;
      return setSwap([
        ...(vc
          ? [
              { ...stateQ, familyId: famId, variantCore: vc, widthMm: active.widthMm, heightCode: active.heightCode },
              { ...stateQ, familyId: famId, variantCore: vc, heightCode: active.heightCode },
              { ...stateQ, familyId: famId, variantCore: vc },
            ]
          : []),
        // ⚠️ ungrouped, so it is NOT re-faced — but it DOES get gridRows now, and those rows are
        // built for whatever toolbar the request carries, so the toolbar has to ride along (R4).
        ...(p.sku
          ? [{ ...stateQ, groupBy: undefined, sku: [p.sku], full: true, limit: 1 } as ItemsQuery]
          : []),
      ]);
    }
    case "depth":
      // v2.2 §2c-2: a self pill is STATE (no fetch, no route, image unchanged); else a sibling.
      if (!p.sku || p.sku === active.sku) return setDepthPick(p.label);
      return navSku(p.sku);
    case "line":
      return; // ⚠️ not modelled server-side — audit §M "open items". See the note at the end.
  }
};
```

### 4d. The order code still comes from `parameters.depth[].code`

`gridRows` depth pills carry **no `code`** (verified in every sample), so v2.2's rule is unchanged —
only its input moves. Replace `depthState` (`:464-471`) on the gridRows path:

```diff
-  const depthState = depthRowState(cfg?.depth, active.sku, depthPick, toolbar.depth);
-  const codeLines = orderCodeLines({
-    sku: active.sku,
-    depthCode: depthState.orderCode,
-    heightExtension: active.heightExtension,
-    heightExtPick: hextPick,
-  });
+  const rows = active.gridRows;                       // ⚠️ [] is an ANSWER (R2)
+  const useRows = Array.isArray(rows);
+  // The D row's SELECTED comes from the server (it already reads the toolbar depth); a local
+  // click overrides it. The re-cut ORDER CODE still lives on parameters.depth[].code (v2.2 §2c-1).
+  const depthLabel = useRows
+    ? depthPick ?? rows!.find((r) => r.kind === "depth")?.pills.find((p) => p.selected)?.label
+    : null;
+  const depthState = useRows
+    ? { options: [] as ConfigureOption[],
+        orderCode:
+          (cfg?.depth ?? []).find((o) => String(o.label) === String(depthLabel))?.code ?? active.sku }
+    : depthRowState(cfg?.depth, active.sku, depthPick, toolbar.depth);
+  const codeLines = orderCodeLines({
+    sku: active.sku,
+    depthCode: depthState.orderCode,
+    heightExtension: active.heightExtension,
+    heightExtPick: hextPick,
+  });
```

`depthPick` already resets on every swap (`:341-343`) — keep that.

### 4e. Whole-card grey — prefer the server's flag (`:422`)

```diff
-  const cardOk = availableFromCaps(active.capabilities, toolbar);
+  // R5/§M5 — the server ships the app's own `av`, which knows famOkB/famOkU and isAccessory;
+  // the local port sees ONE unit and cannot. Absent (bare toolbar) ⇒ available.
+  const cardOk = active.cardAvailable ?? availableFromCaps(active.capabilities, toolbar);
```

### 4f. DELETE the per-card line re-face (`:368-384`)

The server does it (R6). This effect fires one extra request per card on every line pick and now
fights the server's face.

```diff
-  // The "H 73/80/86" bar is a per-card re-face, not a filter (R1). On a base
-  // line pick (or a new card while a line is active), swap to that line's
-  // sibling, width preserved; All (0) → default face. In TALL the line is a
-  // server filter, so `line` is 0 here and this stays inert.
-  // ponytail: re-faces from the family's default width, so a manual W pick made
-  // before flipping the line bar resets to default — rare; add width-carry if it bites.
-  useEffect(() => {
-    if (!line) {
-      setSwap(null);
-      return;
-    }
-    setSwap([
-      { familyId: famId, heightCode: line, widthMm: card.widthMm, groupBy: "family", limit: 1 },
-      { familyId: famId, heightCode: line, groupBy: "family", limit: 1 },
-    ]);
-    // eslint-disable-next-line react-hooks/exhaustive-deps
-  }, [card, line]);
+  // The line is a LIST parameter now (`lineState`, R6) — the server re-faces the card and
+  // collapses its rows. A new grid card just clears any local swap.
+  useEffect(() => { setSwap(null); }, [card]);
```

`line` stays a prop: the legacy fallback branch still uses it for `collapse()`.

### 4g. The rows themselves (`:700-754`)

```diff
-        {/* Configure chip rows (H · W · D · TY). H/W collapse to the active line
-            (R4) and re-mark selected by dimension, and route by LABEL through the
-            family (byLabel) so a null pill.sku never disables the chip (R2/R7). */}
-        <ChipRow label="H" byLabel opts={collapse(cfg?.height, line).map(…)} onPick={pickHeight} … />
-        {active.heightExtension && (<ChipRow label="217+" … />)}
-        <ChipRow label="W" byLabel opts={collapse(cfg?.width, line).map(…)} onPick={pickWidth} … />
-        <ChipRow label="D" opts={depthState.options} onPick={pickDepth} … />
-        {(cfg?.optionRows || []).map((r, i) => …)}
+        {/* ⭐ v2.5 — the server built these rows from the FAMILY pool for this toolbar (§2c-11).
+            Render them VERBATIM: no collapsing, no selected-marking, no per-pill greying.
+            An EMPTY array means "this card has no rows" — only an ABSENT one falls back (R2). */}
+        {useRows ? (
+          rows!.map((r, i) => (
+            <React.Fragment key={`${r.kind}-${i}`}>
+              <GridRowChips
+                row={r}
+                onPick={pickGrid}
+                accentFor={(p) =>
+                  r.kind === "height"
+                    ? lineColor(typeof p.value === "number" ? p.value : NaN)
+                    : p.selected
+                    ? barColor
+                    : null
+                }
+              />
+              {/* the app appends the 217+ chip to the HEIGHT row — and it is a FAMILY question
+                  the row cannot answer, so gate on the server's flag (R8). */}
+              {r.kind === "height" &&
+                active.heightExtension &&
+                active.heightExtensionOk !== false && (
+                  <ChipRow
+                    label="217+"
+                    opts={heightExtOptions(active.heightExtension, active.sku, hextPick)}
+                    onPick={pickHext}
+                    accentFor={selectedAccent}
+                  />
+                )}
+            </React.Fragment>
+          ))
+        ) : (
+          /* legacy: gridRows ABSENT. Effectively unreachable now — the server attaches rows to
+             ungrouped lists too (R2) — but harmless to keep as a guard. */
+          <>
+            <ChipRow label="H" byLabel opts={collapse(cfg?.height, line).map(…)} onPick={pickHeight} … />
+            {active.heightExtension && <ChipRow label="217+" … />}
+            <ChipRow label="W" byLabel opts={collapse(cfg?.width, line).map(…)} onPick={pickWidth} … />
+            <ChipRow label="D" opts={depthState.options} onPick={pickDepth} … />
+            {(cfg?.optionRows || []).map((r, i) => …)}
+          </>
+        )}
```

**The FRONTS tier badges (`:780-800`) are NOT part of `gridRows`** — they come from
`cfg.programme` + `availableTiers`, and their per-pill greying still runs through `gateOpt`
(`:394-406`) and the refs map. Leave that block alone; it is the one surviving consumer of v2.3 R5's
per-pill path on the card.

`barColor` (`:508-511`) can now read the selected H pill straight off `gridRows` instead of the
normalized config — optional tidy, not required.

## Step 5 — `components/catalog-grid.tsx`

**No change.** `key={card.familyId || card.sku}` (`:63`) is already dup-safe (R9). Add a comment if
you want the next reader to leave it alone; do not switch it to `card.sku`, and do not add any
sku-keyed de-duplication when merging pages.

## Step 6 — `components/detail-panel.tsx`

**No change.** `gridRows` is a grid contract; the drawer's model is `parameters.*` and `pill.sku`
navigation (§2c-4, §2c-10), which is what `CfgChip` (`:163-177`) already does.

## Step 7 — the item authoring dialog

`src/views/lead-management-view/modules/design-book-item-management/design-book-item-dialog.tsx`
(980 lines on `origin/dev`).

**What it already covers** — don't redo any of this: SKU · kind · familyId · name · category ·
subcategory · section · nameQualifier · active · the dimension block · `heightClass` ·
`availableTiers` · `faceForTiers` · `doorLineYCode` · **all 17 `capabilities`** · `parameters` W/H/D
+ programme + options (including the depth row's `code` and `alteration` columns) ·
`heightExtension` · `alterations`/`companions`/`accessories` · `swatches` ·
`visibleSideCombos` · `optionCodes` · `description`.

**What is missing.** Every field added to the contract from 2.3 onward. All of them are already
accepted by `POST`/`PATCH /design-book/items` (`upsert-item.dto.ts`) — verified live, they round-trip
today — so this is purely form work.

### 7a. `showUnderLine` on the W and H pill rows

The one authoring gap that is not new: the **depth** row grew extra columns but **width** and
**height** never did, so their `showUnderLine` is unauthorable and any edit through this dialog
silently drops it.

It is a `number[]` — the carcase lines that pill renders under, with **`0` meaning the "All / no
line" state** (two-system tall H rows hide their 73-system pills even at All, which a plain per-line
list cannot express). Absent ⇒ always visible. W/H only; depth rows never carry it.

Verified live — `GET items/TSP6080?expand=all`:

```jsonc
height: [ { "label": "H73", "sku": "TSP6073", "showUnderLine": [0, 73, 86] },
          { "label": "H80", "sku": "TSP6080", "showUnderLine": [0, 80] },
          { "label": "H86", "sku": "TSP6086", "showUnderLine": [0, 86] } ]
width:  [ { "label": "45",  "sku": "TSP4580", "showUnderLine": [0, 73, 80, 86] },
          { "label": "55",  "sku": "TSP5580", "showUnderLine": [0, 80] } ]
```

Add a third column to both rows, same `RowList` shape the depth row uses — a comma-separated
`number[]` is fine:

```diff
   <Field label="width (W)" hint="label + target sku">
     <RowList
       addLabel="width pill"
       cols={[
         { key: "label", placeholder: "label (15)" },
         { key: "sku", placeholder: "target sku — blank = dead pill" },
+        { key: "showUnderLine", placeholder: "lines: 0,73,80,86 — 0 = All. blank = always" },
       ]}
```

…and the same extra column on the `height (H)` row. Parse to `number[]` on save, join on load; blank
⇒ omit the key entirely (**not** `[]`, which would mean "never visible").

### 7b. The scalar fields

| Field | What it does |
|---|---|
| `heightCode` | the H-ROW key — 73/80/86 on carcase-line families, the unit's **cm height** everywhere else (29, 42, 204 …). Not derivable from `heightMm` (`AT3037Z` is 367 mm but `heightCode` 37). A number input |
| `catalogRank` | the family's `pri` — its position in the catalog order. **`null` is meaningful** (unnumbered family) and is *not* "leave unchanged"; it is also **not** 999 — 294 families have a real `pri` above 999. Needs an explicit empty-vs-zero distinction in the form |
| `sectionRank` | its section's index in the curated per-subcategory section order (999 = that subcategory has no curated order) |
| `familyIndex` | its position in the app's family list — the last sort tiebreak |
| `gridHidden` | a checkbox. Never render this code as a grid card; it stays fetchable by sku (R10) |

### 7c. The structured blocks — expose as read-only JSON, not as forms

`unitFacts`, `familyFacts` and `dupFamilies` are settable, but they are **dumped from the app** and
owned by the backfill scripts. Hand-editing them is how a card silently loses its rows. Render them
as pretty-printed, **read-only** JSON so an author can *see* what a card is made of, and only make
them writable behind an explicit "advanced / synthetic family" affordance.

Two traps if you do make them editable:

* **`familyFacts.rawSub`** (the 18th key) is the app's raw sub and is **not** the item's own
  `subcategory` — that one is a display name, and three Tall subs (`Accessory surround`, `Fillers`,
  `Back & Side Panels`) are folded into `Panels, Fillers & Surrounds`. The programme-tier hide tests
  the raw one, and it is not uniform across the fold: Fillers and Accessory surround are exempt from
  the hide, `Back & Side Panels` is not. Getting it wrong hides or shows whole families under a
  non-Primo programme.
* **`dupFamilies`** entries carry their own cat/sub/section/order **and their own `familyFacts`** —
  50 of the 79 entries differ from the item's primary ones. Copying the primary block into a dup is
  not a no-op.

The backend's own authoring UI at `/design-book/admin` has all of these as structured controls; use
it as the reference for field semantics and validation.

### 7d. *(optional)* the detail drawer's W/H rows

The drawer does **not** apply `showUnderLine` (0 occurrences in `detail-panel.tsx`). The grid no
longer needs it — the server collapses grid rows — but the drawer still renders every pill for every
line. Ship this only if the drawer's W/H rows visibly diverge from the app; the helper already
exists (`data/caps.ts` exports `showsUnderLine` and `lineNum`). Everything else about the drawer
stays as it is: `pill.sku` navigation, and a null `pill.sku` IS a dead chip there.

Skip this step entirely if the item-management tab isn't in scope this sprint; nothing in the grid
depends on it.

---

# Check

| # | Do | Expect |
|---|---|---|
| 1 | Any grid, devtools on the list request | `groupBy=family`, and every card in the response carries a `gridRows` array |
| 2 | A Sinks card (`TSP6080`) | rows exactly `H [73 80* 86] · W [45 50 55 60* 70 80 90 100 120] · D [58* 63 68]` — **no client-side marking**; unplug `selected` in devtools and the highlight follows the server |
| 3 | `items?familyId=F2013__DRWDUP` in the grid (Base → drawer accessories) | the `ANK45` card renders **bare** — no W row. A W row means the empty-array fallback bug (R2) |
| 4 | Click H `73` on `TSP6080` | request is `familyId=SNK1&heightCode=73&widthMm=600…`, **never** `sku=TSP4573` (R3) |
| 5 | Devtools on any pill-click request | carries `lineState` / `depthClass` / `programs` / `tier` + `grey=true` (R4) |
| 6 | Click a pill while the H bar is on 73 | the swapped-in card's H row is still `[73]` — if it comes back `[73 80 86]`, the toolbar wasn't carried |
| 7 | H bar → 73 | ONE list request with `lineState=73`; **zero** per-card swaps; faces move to `…73…`; rows collapse |
| 8 | Same, count the cards | the count MAY drop (families with nothing at that line are hidden — R6). Tick "Grey don't hide" → they come back greyed |
| 9 | Pick BOSSA (244) + D68, Base/Sinks | `TSP6080` renders **greyed** — from `cardAvailable:false`, not from a local computation (R5) |
| 10 | Any alteration/accessory card under a programme that excludes it | **not** greyed (`isAccessory`, folded into `cardAvailable`) |
| 11 | Tall → Closet, card `H60197GAIZ` | a `Line` row (`86 · J`, `E`) renders above H; H `[197* 210 224]`; the `217+` chip present |
| 12 | Same card under a programme with no available 217 unit | the `217+` chip **disappears** (`heightExtensionOk:false`) while the H row is unchanged (R8) |
| 13 | Base → Cooktops & Downdrafts → Accessories & Modifications | `ANTSPSAUS` appears there **and** under Base → Sinks; both render; no React key warning (R9) |
| 14 | Cooktop Units @ D68 | greyed `BZ`/`BSZ` sit **in the middle** of `BZ2 BSZ2 BZ BSZ BZIZ`, not pushed to the end (R10/§M6) |
| 14a | Tall → Panels, Fillers & Surrounds, no programme → then LAIKA (410) → then ROCCA (701) | 29 cards → **28** → **28**. Under LAIKA `F115` is gone and `F209` is present; under ROCCA the reverse. A count drop here is CORRECT (R9b), not a lost card |
| 14b | Wall → Corner under LAIKA vs ROCCA | 6 cards either way; `F93` under LAIKA, `F106` under ROCCA — never both (R9b) |
| 14c | Tall → Panels, Fillers & Surrounds, line 80 | sections read `Tall End Panels · Tall Fillers · Tall Blenders · Tall Corner Blenders · Tall Angle Blenders · Wall Blenders · Rear Panels in Front Finish · Carcase Side Extension · Tall Visible Carcase Side · Support Panel with Plinth` — in that order, from the server (§N2). Do not sort them |
| 15 | A W=90 filter on a family whose face is 50 cm | the card is correct — do not "fix" the face (R10/§2c-9) |
| 16 | Click D `63` on `TSP6080` | **no network request**; the displayed order code changes via `parameters.depth[].code`; the image does not change (v2.2 §2c-2 / Step 4d) |
| 17 | Open the detail drawer, click a W pill | still navigates by `pill.sku` (drawer exempt) |
| 18 | Screenshot diff vs the app | compare **card face sku + row shape**, ignore the toolbar chip highlight (stale-highlight trap, R6) |
| 19 | Open `TSP6080` in the authoring dialog, save with no edits, re-fetch it | its W/H pills still carry `showUnderLine` (`H73 → [0,73,86]`, `H80 → [0,80]`). If they came back without it, the form is dropping the field on save (Step 7a) |
| 20 | Same dialog | `heightCode`, `catalogRank`, `sectionRank`, `familyIndex`, `gridHidden` are all present and editable (Step 7b); `unitFacts` / `familyFacts` / `dupFamilies` are visible but read-only (Step 7c) |
| 21 | Clear `catalogRank` on a family and save | it becomes `null` (unnumbered → sorts last), **not** `0` and not 999. If the form cannot express "empty", that field is not done |
| 22 | Click a FRONTS tier badge (`CTSP6080`) with the H bar on 73 | the card keeps full rows (`gridRows` ships on ungrouped lists now) **and** the H row stays `[73]`. A row that springs back to `[73 80 86]` means the sku navigation dropped the toolbar |
| 23 | Click a Ty pill whose target is off-page | resolves from `refs[pill.sku].variantCore` without the `sku:[…]` last resort firing — the refs map covers `gridRows` targets now |

Ground truth: `d4k-items-extraction/docs/design-book-api-ui-map-v2.md` — **§2c-11** (`gridRows` +
toolbar inputs), **§2c-12** (membership: `gridHidden`, `dupFamilies`, the family gates, card order),
**§2c-5/6/7/8/9/10** (unchanged v2.3 material), **§2b** (section order + header merge) — and
`docs/client-ui-parity-audit.md` **§M1–M9** and **§N** (the round-3 fixes above).

---

## Unverified / needs checking — do not invent behaviour here

1. **The `Line` row's CLICK is not modelled.** The row itself is built and shipped (verified:
   `H60197GAIZ` → `Line [86 · J, E]`), and audit §M's closing paragraph lists "the tall `Line` row
   click (§L #7)" as still open. Its pills carry `sku: null` and values that mix a carcase SYSTEM
   (`73`/`80`/`86`/`66`) with front-line suffixes (`J`/`Y`/`E`), and §2c-3 says `J`/`Y`/`E` are
   ORDER-CODE modifiers, not navigation. **Render the row; leave the click inert** until the app's
   handler is read out. Do not guess it into `update({line})` — `86` is a 73-*system* line
   (§M9-2) and the mapping is not one-to-one.
2. ~~A `sku:[…]` navigation returns a card with NO `gridRows`.~~ **RESOLVED server-side 2026-07-29**
   — the backend now attaches `gridRows` to ungrouped rows. `items?sku=CTSP6080&full=true&limit=1`
   returns `CTSP6080` itself with all three rows, correctly selected. The FRONTS tier badges, the
   finish chips and a depth *sibling* pill therefore keep full rows. `groupBy=family` still re-faces,
   so a sku navigation must still be **ungrouped** — and an ungrouped row still has no
   `cardAvailable` / `heightExtensionOk` (see R2).
3. ~~`refs` coverage of `gridRows` targets is partial.~~ **RESOLVED server-side 2026-07-29** — the
   ref collector walks `gridRows[].pills[].sku` too. Measured on SNK1: 12/15 targets in `refs`, the
   3 absent being the card's own sku. Keep the `sku:[…]` Ty fallback as a cheap last resort.
4. **`cardAvailable` on a bare toolbar** is absent, not `true` — confirmed by reading
   `annotateFamilyAvailability`'s early return and by its absence from `list-grouped.json` /
   `by-section.json`. The `??` fallback covers it, but do not write `=== true` anywhere.
5. **`familyFacts.dim === 'depth'` families label their numeric row `D`** even though the pills come
   from `parameters.width` (§2c-11). With `gridRows` this is already correct in `row.label` — but if
   you ever hit the legacy fallback branch on such a family, the label will read `W`. Not worth fixing
   in the fallback.
