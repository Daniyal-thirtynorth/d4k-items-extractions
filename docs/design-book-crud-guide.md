# Design-Book CRUD Guide (v2 — minimal + capabilities model)

How to **add, edit, and delete** catalog items via the API, authored so the configurator pills grey out
exactly like the live app. For whoever builds the admin UI or hand-authors data.

- Base path `/design-book` · JWT-guarded (`Authorization: Bearer <token>`; get a dev token at `GET /design-book/dev-token`).
- Schema **2.5.2** — contract `docs/export-schema-v2.ts`, field↔UI map `docs/design-book-api-ui-map-v2.md`.
  (2.1 = 2.0 + `code` on depth pills, §4a. 2.2 = + `heightExtension` §4b and `doorLineYCode` §4c.
  2.3 = + `showUnderLine` on width/height pills, §4d. 2.4 = + `heightCode` §4e.
  **2.5 = + `unitFacts` / `familyFacts`, 2.5.1 + `gridHidden`, 2.5.2 + `dupFamilies` — all §4f, and all
  about the GRID card rather than the detail screen.** All additive; older readers ignore them.)
- ⭐ **Read §4f before you author anything that shows a card.** Since 2.5 the grid card's W/H/D/Ty rows are
  **not** drawn from `parameters` — the server rebuilds them from the FAMILY (`gridRows`). `parameters` is
  now the DETAIL-screen model. Authoring only `parameters` gets you a correct drawer and an empty card.
- CRUD writes the **same shape** as `POST /design-book/ingest` (one shared `normalizeItemDoc`). A hand-authored
  item and an extractor-produced item are identical.
- **Easiest way to author:** the form-based admin UI at **`GET /design-book/admin`** — every field is a control,
  with a live grey-out preview. This guide is the API/data reference behind it.

---

## 0. The one idea you must get

**One item = one order code (SKU). A "card" is NOT one item — it's a FAMILY of sibling items (one per
width/height/depth), wired together by pills.**

The "Floor unit" card is really many items:

| Width pill | opens item | |
|---|---|---|
| 15 | `T1580` | the 15 cm unit |
| 20 | `T2080` | the 20 cm unit |
| **60** | `T6080` | **the 60 cm unit (the card you opened)** |
| 70 | `T7080` | the 70 cm unit |

So the Width row on `T6080` is just **shortcuts to its siblings**. Clicking "15" opens the separate item `T1580`.

**Why it matters for editing:** a pill's behaviour is a fact about the item it POINTS TO, not the card you're
on. "Disable width-15 in BOSSA" is stored on `T1580`, not on `T6080`. See §5.

**Two corollaries added in 2.5** (both §4f):

- The card's ROWS are a fact about the **family**, not about the item you happen to be editing. The server
  collects every member (`familyId`) and builds the rows from their `unitFacts`. So "add a 70 cm width to
  this card" = *create the 70 cm member with the right `unitFacts.widthCode`*, not "add a pill".
- One item can belong to **more than one family** — i.e. show up as two separate cards in two different
  sub-categories (`dupFamilies`). 74 items do.

---

## 1. The endpoints

| Method | Path | Does | Notes |
|---|---|---|---|
| `POST` | `/design-book/items` | **Create** one item | `sku` required. **409** if it already exists (use PATCH). |
| `PATCH` | `/design-book/items/:sku` | **Edit** one item | Replaces only the top-level fields you send; the rest stay. URL `sku` wins. **404** if missing. |
| `DELETE` | `/design-book/items/:sku` | **Delete** one item | Soft by default (`active:false`, kept for history). `?hard=true` removes it. **404** if missing. |

All return the stored item (with built `imageUrl`). `POST /design-book/ingest` (bulk) uses the same write
path, so bulk and manual never disagree on shape.

---

## 2. What you can set — the field surface

One item per request. **Every field the extractor writes is settable.** Unknown top-level fields are
**rejected (400)** — only the fields below are accepted. Content *inside* `capabilities`, `parameters`,
`finishInterior` is free-form.

- **Identity:** `sku` (required), `kind` (`cabinet|alteration|accessory|part`), `familyId`, `name`,
  `category`, `subcategory`, `section`, `active`, `nameQualifier`.
- **Dimensions:** `widthMm`, `heightMm`, `depthMm`, `heightClass` (73|80|86|null), `heightCode`.
  `heightCode` is the app's per-unit **H-row key** (`u.hc`): the same 73/80/86 on carcase-line families,
  the unit's **cm height** everywhere else (29, 42, 103, 204, 217 …). The grid resolves an H pill by it
  (`items?familyId&heightCode=…`), so a new unit without it has an unclickable H pill — set it whenever
  the card shows an H row. See map §2c-10.
- **Fronts / rules:** `availableTiers[]`, `faceForTiers[]`, **`capabilities`** (§3), `parameters` (§4;
  width/height pills may carry `showUnderLine` §4d), `heightExtension` (§4b), `doorLineYCode` (§4c).
- **⭐ Grid card (2.5, §4f):** **`unitFacts`** (this unit's row VALUES + pool scoping), **`familyFacts`**
  (the family's row SHAPE, denormalized onto every member), `gridHidden` (never render as a card),
  `dupFamilies[]` (extra card memberships).
- **⭐ Card order (§4f):** `catalogRank` (the family's catalog `pri`; **`null` is meaningful** — unnumbered,
  sorts last), `sectionRank` (its section's index in the curated order, 999 = none), `familyIndex` (position
  in FAMS — the last sort tiebreak). These went in read-only at first; the write API accepts them now.
- **Thin refs:** `alterations[]`, `accessories[]` (sku, or `{sku, variants:[{label,sku}]}`), `companions[]`.
- **Vero:** `finishInterior` (`{swatches[], visibleSideCombos[], optionCodes[]}`).
- **Text:** `description` (`{title, bullets[]}`), `restrictions[]`, `planningNotes[]`, `didYouKnow`, `modifications[]`.
- **Blocks:** `handedLR`, `sinkFitment`, `appliance`, `toeKick`, `inspiration`.
- **Pricing / catalog:** `finishes[]`, `priceUnit` (`pts|HLP`), `catalogPage`, `priceGroupRef`, `frontModifiers`,
  `carcaseLine`, `weightKg`, `volumeM3`.
- **Nav:** `engineering[]` (`[{key, ok}]`), `functionalGroups[]`.

**Don't send** (service-owned or built at read): `ingestBatchId`, `lastSeenAt`, `deactivatedAt`,
`catalogVersion`, `_id`, `__v`, `createdAt`, `updatedAt`, `imageUrl`, `pts`, the catalog PDF url, the P1/C1
sibling synthesis, and the query-time `available`/`programmeExcluded` pill flags.

---

## 3. `capabilities` — the rules that grey a pill

One record per item = the facts that decide **when this unit's pill (or card) greys**, one per toolbar
control. The app's rule (client and backend both reproduce it):

```
available(unit) = alwaysAvailable || (progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk)
```

A pill is **DEAD** when its `sku` is null (no target), **GREY** when `available(target) === false`, else live.
`alwaysAvailable:true` forces LIVE and skips every gate.

> ⭐ **A whole CARD greys by a bigger rule than this** (2.5). `capabilities` answers "is this UNIT
> orderable"; a card also has to pass two FAMILY questions no single unit can answer — does the family
> belong to the picked programme's front line (`famOkB`/`famOkU`, from `familyFacts.memberTiers` +
> `unitFacts.tier`/`siblingTiers`), and does it have anything at the picked line/depth. The server ships the
> combined verdict as **`cardAvailable`** on every grid card, and an **accessory or alteration card NEVER
> greys** whatever its capabilities say (`familyFacts.isAccessory`). Author the unit rules here; do not try
> to reproduce the card verdict from them. See §4f and `design-book-greying-examples.md` §14.

### Every field, and what it does

| Field | Type | Greys the unit when… |
|---|---|---|
| `alwaysAvailable` | bool | never — `true` forces the unit LIVE (bypasses all gates). |
| `excludedPrograms` | string[] | **every** selected programme id is in this list. **The headline rule** (§5). IDs, not names. |
| `excludedProgramsE` | string[] | same, but only in **one-piece / Full-E** mode and only if `hasEFront`. |
| `isFrmatFamily` | bool | (FRMAT only) marks the one finish-format unit whose programme rule also uses a size table. Normal items `false`. |
| `hasEFront` | bool | (switch) enables the `excludedProgramsE` / Full-E path. |
| `nativeTier` | `P\|A\|C\|null` | it's the unit's own line; `null` = line-neutral → **never greys by tier**. |
| `twinTiers` | (`P\|A\|C`)[] | the picked FRONTS tier is in this list — a real sibling exists, so the app swaps to it (§3b). |
| `opening` | `P1\|C1\|null` | (P1/C1 FRONTS pills) it IS that opening variant; picking a different one greys it. |
| `depthClasses` | number[] | the picked depth isn't offered — **except 58 & 63, which always pass** (§3a). |
| `handleFree` | bool | it has a handle **and** you picked the handle-less look (`false` greys under handle = V). |
| `onePieceFront` | bool | it's not one-piece **and** you turned Full-E on (`false` greys under Full-E). |
| `openP1` / `openC1` | bool | it doesn't support that opening — unless `singleHandle` (below). |
| `singleHandle` | bool | never (for opening): `true` = the opening gate **always passes** (a single front always accepts P1/C1). |
| `antosoApproved` | bool | it's not approved for suspended install **and** you turned Suspended on. ⚠️ You are not editing the whole Suspended story: the flag is the GREY gate, but the toggle also **hides** off-envelope Base/Tall families and **re-faces** a card onto an approved sibling, both recomputed server-side from the unit's own W/H/D (audit §P4). Setting this `true` on a unit outside the envelope greys nothing but does not make its family reappear. |
| `doorLineJ` / `doorLineY` | bool | you filtered to that door line and the unit isn't in it. |

In the lite UI's capabilities box: **green dot = true, red dot = false**, and a live `LIVE / GREY` line shows
the combined verdict for the current toolbar.

### 3a. Depth — the 58/63 quirk

`depthClasses` = the depths (cm) this unit is built in. The gate:
```
depthOk = picked === 58 || picked === 63 || depthClasses.includes(picked)
```
- **58 and 63 always pass**, checked or not (58 = the default depth; 63 = the depth-alteration class). Unchecking
  them does nothing.
- A unit that lists **every** depth never greys on depth. To *see* depth greying, give it a narrow list (e.g.
  `[58]`) — then picking 36/48/68 greys it, 58/63 stay live.
- As a pill target: narrowing `depthClasses` here greys the matching D pill on every card that links to it.
- **Don't confuse `capabilities.depthClasses` with the `parameters.depth` pills.** `depthClasses` is the GATE
  — it alone decides what the D filter matches and what greys. The pills are only the ROW that gets DRAWN,
  and on a depth row some of them stay on the same item instead of opening a sibling. Editing one never
  changes the other. See **§4a**.

### 3b. Fronts — `nativeTier` / `opening` / `twinTiers`

The FRONTS pill (P · P1 · A · C · C1) greys the unit like this:
```
FRONTS = ALL       → live
FRONTS = P1 | C1   → live only if `opening` === that; else greys
FRONTS = P | A | C → live if nativeTier is null (line-neutral) or === picked;
                     else greys IF `twinTiers` includes picked, else stays live
```
**Why twins grey:** pick Contino on a Primo unit that has a real Contino sibling → the app shows **that twin**,
so the Primo greys. No sibling in that tier → nothing to swap to → it stays.

**Authoring:** set `nativeTier` to the unit's own line; add to `twinTiers` each tier that has a real sibling
code (Primo `T6080` + `CT6080` exists → add `C`); set `opening` only if the sku itself is a `P1…`/`C1…` code;
leave `nativeTier:null` for line-neutral items (accessories/alterations/fillers).

### 3c. The other six gates

Same pattern — a toolbar control + one or more fields. Exact logic is in the port below; here's the summary:

| Toolbar control | Gate | Fields | Grey / author note |
|---|---|---|---|
| Programme selector | progOk | `excludedPrograms` (+ `excludedProgramsE`/`hasEFront` in Full-E; `isFrmatFamily`) | greys when every picked programme is excluded. Add programme **ids** (§5). |
| Handle = V | handleOk | `handleFree` | check `handleFree` for handle-less / Module units. |
| Full-E (one-piece) | frontOk | `onePieceFront` | check for E-capable fronts. |
| OPENING = P1/C1 | openOk | `openP1`, `openC1`, `singleHandle` | check the variant it supports; check `singleHandle` for ≤1-stacked-front units (always pass). |
| Suspended | antosoOk | `antosoApproved` | check for units approved for wall-hung install. |
| Door-line J/Y | doorOk | `doorLineJ`, `doorLineY` | check the line(s) the unit belongs to. |

### 3d. Master table (all 8 gates)

| Toolbar control | Gate | Field(s) | GREYS when… |
|---|---|---|---|
| Programme | progOk | `excludedPrograms` (+`excludedProgramsE`/`hasEFront`; `isFrmatFamily`) | every picked programme ∈ `excludedPrograms` |
| FRONTS P/A/C | tierOk | `nativeTier`, `twinTiers` | picked ≠ `nativeTier` AND `twinTiers` includes it |
| FRONTS P1/C1 | tierOk | `opening` | picked is P1/C1 AND `opening` ≠ picked |
| D pill | depthOk | `depthClasses` | picked ∉ `depthClasses` AND ≠ 58 AND ≠ 63 |
| Handle = V | handleOk | `handleFree` | `handleFree` false |
| Full-E | frontOk | `onePieceFront` | `onePieceFront` false |
| OPENING P1/C1 | openOk | `openP1`/`openC1`, `singleHandle` | lacks the variant AND not `singleHandle` |
| Suspended | antosoOk | `antosoApproved` | `antosoApproved` false |
| Door-line J/Y | doorOk | `doorLineJ`/`doorLineY` | not in the picked line |
| (any) | bypass | `alwaysAvailable` | never — `true` forces LIVE |

### The reference evaluator (`availableFromCaps`)

The client runs all 8 gates itself (the backend does only the programme one — §5). Verbatim:
```js
// FRMAT_DEAD = the 9 programme ids that ONLY the FRMAT size table excludes (SELVA 218, KYOTO 272,
// VALAIS 283, STONE 294, SELVA-A 418, STONE-A 494, SELVA-C 718, VALAIS-C 783, STONE-C 794).
// ⚠️ `isFrmatFamily` is NOT "excluded everywhere" — FRMAT is LIVE under BOSSA, TOPOS, CERES …
// `excludedPrograms` already covers the other 111; these 9 are the app's extra `frmatKey` rule.
function availableFromCaps(c, s /* toolbar state */) {
  if (c.alwaysAvailable) return true;
  const pk = s.progKeys ?? [];
  const progOk  = !pk.length || pk.some(k =>
    !c.excludedPrograms.includes(k) && !(c.isFrmatFamily && FRMAT_DEAD.has(k)) &&
    !(s.front === 1 && c.hasEFront && c.excludedProgramsE.includes(k)));
  const tierOk  = !s.tier || s.tier === 'ALL' ? true
    : (s.tier === 'P1' || s.tier === 'C1') ? c.opening === s.tier
    : !c.nativeTier ? true : c.nativeTier === s.tier ? true : !c.twinTiers.includes(s.tier);
  const depthOk = s.depth === 58 || s.depth === 63 || c.depthClasses.includes(s.depth ?? 58);
  const handleOk= s.handle !== 'V' || c.handleFree;
  const frontOk = s.front !== 1 || c.onePieceFront;
  const openOk  = !s.open || (s.open === 'P1' ? c.openP1 : c.openC1) || c.singleHandle;
  const antosoOk= !s.antoso || c.antosoApproved;
  const doorOk  = !s.doorline || (s.doorline === 'J' ? c.doorLineJ : c.doorLineY);
  return progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk;
}
```
Verified 99.997% vs the live app (313,842 combinations = 16,518 pill targets × 19 toolbar states).

---

## 4. `parameters` — the pills (⚠️ the DETAIL screen's pills)

> ⭐ **Scope changed in 2.5.** `parameters` is what the **detail drawer** renders. The **grid card** does
> NOT render it any more: the server rebuilds the card's rows from the family pool and ships them as
> `gridRows` (§4f). They disagree on purpose — `parameters` was scraped from ONE unit's detail panel, so it
> misses heights that unit's variant lacks and offers rows the grid never draws. Everything in §4/§4a is
> still exactly right **for the drawer**; for the card, read §4f.

The W/H/D/Programme rows + coded rows. Each pill is thin — a **label + the SKU it opens**. No stored
`available`/`selected` — those are derived (selected = `pill.sku === item.sku`; grey = `availableFromCaps(target, toolbar)`).

> ⚠️ **Depth pills are the exception to "a pill opens a sibling"** — often they stay on the same item and
> only the ORDER CODE changes. Read **§4a** before authoring one; the repeated sku is correct, not a bug.

```jsonc
"parameters": {
  "width":     [ {"label":"15","sku":"T1580"}, {"label":"20","sku":"T2080"}, {"label":"60","sku":"T6080"} ],
  "height":    [ {"label":"H73","sku":"..."}, {"label":"H80","sku":"..."} ],
  "depth":     [ {"label":"58","sku":"..."}, {"label":"63","sku":"...","alteration":true} ], // alteration = 63cm depth-alteration pill
  "programme": [ {"tier":"P","sku":"T6080"}, {"tier":"C","sku":"CT6080"}, {"tier":"P1","sku":"...","opening":true} ],
  "options":   [ {"group":"Ty","label":"Z2X","sku":"..."}, {"group":"Ty","label":"S2Z","sku":"..."} ] // coded rows, grouped by `group`
}
```
`sku: null` on a pill = the option exists but has no target (renders dead/inert).

---

## 4a. ⭐ Depth rows — the one row that is NOT plain navigation

Every other row (W / H / Programme / coded) obeys one rule: **a pill opens a sibling item.** Depth doesn't,
because the catalog expresses "this cabinet at 68 cm" in **two** different ways — and one row can hold both.

| | **A · depth = an ALTERATION** | **B · depth = a SEPARATE ITEM** |
|---|---|---|
| Meaning | the *same* cabinet, built deeper | a different orderable unit |
| Clicking the pill | stays put, **re-cuts the order code** | **opens another sku** |
| Example | `T6080IS2IZ` @68 → code `T608068IS2IZ` | `C1T3080S2Z` @68 → item `C1T308068S2Z` |
| `pill.sku` | the item's own sku | the sibling's sku |
| `pill.code` | the re-cut code | omit |

### The discriminator you author against

```js
pill.sku !== item.sku   // B — a separate item. Navigate. No `code`.
pill.sku === item.sku   // A — the same item. Order code = pill.code ?? item.sku.
```

`code` present ⟹ same item — but **not the converse**. A self-pointing pill with no `code` is still the
same item; it just needs no re-cut (it is the native class, the 63 alteration, or a unit with no real
carcass depth). **So test `sku`, never the presence of `code`.**

### Authoring recipes

**A · same cabinet, deeper.** Every pill repeats the item's own sku; `code` is the code at that class —
`pre + digits + class + suffix` of the base sku. `58` and `63` keep the base code (63 cm is expressed as
base cabinet **+ alteration codes** — `ANTSP63US` · `MPRU`, plus `ANSVVO275` on door sinks, `ANHST63` tall,
`ANTST63` otherwise — not in the code):

```jsonc
// item T6080IS2IZ
"depth": [
  {"label":"36","sku":"T6080IS2IZ","code":"T608036IS2IZ"},
  {"label":"48","sku":"T6080IS2IZ","code":"T608048IS2IZ"},
  {"label":"58","sku":"T6080IS2IZ","code":"T6080IS2IZ"},
  {"label":"63","sku":"T6080IS2IZ","code":"T6080IS2IZ","alteration":true},
  {"label":"68","sku":"T6080IS2IZ","code":"T608068IS2IZ"}
]
```

**B · a real sibling per depth.** Point at the sibling skus and leave `code` blank:

```jsonc
// item C1T3080S2Z — each depth is its own unit
"depth": [
  {"label":"36","sku":"C1T308036S2Z"},
  {"label":"48","sku":"C1T308048S2Z"},
  {"label":"58","sku":"C1T3080S2Z"},
  {"label":"63","sku":"C1T3080S2Z","alteration":true},   // ← self: the 63 alteration is always type A
  {"label":"68","sku":"C1T308068S2Z"}
]
```

**Mixed is the normal case** — 7,458 of the 11,551 depth rows look like B above: siblings for the real
depths, self for the native class and the 63 alteration. (2,348 rows are pure A with re-cut codes;
1,745 are pure A with none, e.g. a bare `58 · 63` row.)

### ⚠️ The pills do NOT drive the D filter — `capabilities.depthClasses` does

The grid's D pill ports the app's `depthOk`:

```
depthOk = picked === 58 || picked === 63 || capabilities.depthClasses.includes(picked)
```

- **Adding a `68` pill does NOT make the card appear under D=68.** Add `68` to that item's
  `capabilities.depthClasses`.
- **Removing a pill does NOT hide it.** Remove the class from `depthClasses`.
- **58 and 63 are pass-through** — every item matches them, whatever you set (§3a).
- Empty `depthClasses` = no carcass depth (fronts, accessories) → the item rides **every** class.

This is deliberate: `depthClasses` = `D2CODE[u.D] ∪ u.dv ∪ u.d` answers "can this unit be *ordered* at N cm"
for BOTH models at once, so one field drives greying and filtering alike. Full detail:
`design-book-api-ui-map-v2.md` **§2c-1** (pill state) and **§2c-2** (the two models).

### Selection (which pill renders highlighted)

Never `sku === item.sku` — several depth pills share the sku, which highlights them all. Pick by **label**:
per-card depth → the toolbar D class → else `58` (the app's `cardDepth`). Zero highlighted pills is legal
when the row offers neither. On a **mixed** row, honour the picked class only when that pill is a state pill
for this item; if it maps to a sibling you are not on that item, so fall back to this item's own **native**
pill — otherwise the sibling pill lights up as "selected" and stops being clickable.

> **Every other row is plain navigation.** Width, height, programme and all 16 coded rows (Ty / Runner / Finish /
> Finish / Length / Runner / Insert / …) open a different stored product, `selected = pill.sku === item.sku`
> picks exactly one, and there is no `code`. Audited across all 18,396 items: 0 rows with a duplicated sku,
> 0 rows with more than one self-pointing pill. **On those rows a repeated sku IS a bug — fix it.**

---

## 4b. `heightExtension` — the "217+" chip on the Height row

> **⚠️ YOU CANNOT AUTHOR THIS ONE. It is derived on every read (audit §O4/§O4c).** The admin form still
> shows the block and the field still exists on the document, but the API recomputes the payload from the
> family pool for each request and strips whatever is stored — so **editing it changes nothing on screen**.
> To make the chip appear or disappear, fix the FAMILY: whether it holds a `heightCode 217` unit at all,
> and whether that unit is orderable in the programme you are looking at. Everything below describes the
> shape the API returns, not a field to fill in. (Why: the stored copy froze a family-level,
> toolbar-dependent question per unit, so all-A / all-C families — `F1780`, `F1782` — never got one.)

Tall products (never `Appliance housing`) whose family holds an orderable **217 cm** unit can be built
past 217. That is **not a separate product**: picking 230 / 244 / 250 orders the **217 cm unit plus an added
code** (`MPHVERL`). It is the height twin of the 63 cm depth alteration.

```jsonc
"heightExtension": {
  "sku": "HP20217",                 // the 217 cm unit the chip opens — the extension is ordered on THAT unit
  "addCode": "MPHVERL",             // ordered alongside it
  "options": [ {"label":"230","heightMm":2304},
               {"label":"244","heightMm":2436.5},
               {"label":"250","heightMm":2500} ]
}
```

Leave the whole block off anything that is not Tall, or whose family has no 217 cm unit. 2,046 units /
83 families in v781.

> **Why it is not just three more height pills.** Some families (the HP20 panels) also have **real**
> 230 / 250 cm sibling products. Put the extension in `parameters.height` and you get two pills labelled
> `230` — one that opens a different product, one that extends this one. Keeping it in its own field keeps
> both renderable: `GET items/HP20146` returns `Height: H146 … H230 H250` **and** `217+: 230 244 250`.

---

## 4c. `doorLineYCode` — the one order code you must type

The toolbar's front-line modifiers mostly decorate the sku, so a client can build them:
`V<sku>` · `<sku>E` · `<sku>J` · `P1<sku>` · `C1<sku>`. **Door-line `Y` (line 66) replaces the whole code**,
so it cannot be derived and has to be stored.

```jsonc
"sku": "MGT601468",
"doorLineYCode": "MGT60146Y",
"capabilities": { "doorLineY": true }
```

`capabilities.doorLineY` is the **gate** (does this unit exist in line 66) and `doorLineYCode` is the
**code**. Set both or neither — a flag with no code leaves the client unable to order it, a code with no
flag never gets reached. 11 units in v781. It is never a stored product of its own, so don't create one.

---

## 4d. `showUnderLine` — hide a Width/Height pill unless a carcase line is active

When the toolbar picks a carcase **LINE** (73 / 80 / 86), the client **removes** (not greys) the Width and
Height pills that don't belong to that line. Put the lines a pill shows under in `showUnderLine` on that
**width** or **height** pill (schemaVersion 2.3):

```jsonc
"parameters": {
  "height": [
    { "label": "H73", "sku": "…73…", "showUnderLine": [73] },
    { "label": "H80", "sku": "…80…", "showUnderLine": [80] },
    { "label": "H86", "sku": "…86…", "showUnderLine": [73, 86] }  // 86 = J-door on the 73 carcase → stays with 73
  ]
}
```

> ⚠️ **Drawer-only since 2.5.** The grid card no longer consults `showUnderLine` — the server collapses the
> card's H/W rows itself (`lineHFilter`, driven by the `lineState` query param), so the field does not appear
> anywhere in the grid-row builder. It is still stored, still exported, and still correct for the detail
> drawer. Don't delete it; just don't expect editing it to move a card's row.

- **Omit it ⟹ the pill always shows** (correct for height-CLASS rows on Tall/Wall that don't collapse).
- **Never on depth pills.** Width/Height only.
- Editable directly in the admin UI (a `showUnderLine` column on each width & height pill row).
- **You rarely author this by hand** — the extractor captures it per family from the app. Only set it when
  hand-building a family whose W/H row must narrow to the selected line.

> **Not authored at all: `faceHeightClass`, `variantCore`, `faceVariantCore`.** These pick which unit is the
> family's card FACE when a filter removes the default one (keep the default height / default variant). The
> backend **computes them** from `faceForTiers` + `heightClass` + sku on ingest/backfill — leave them out of
> your item; they are not part of the field surface you set.

---

## 4e. `heightCode` — the number a NEW item needs before its H pill works

**Nothing derives it. You type it, and it must equal the LABEL the H row uses for this unit.**

- On a **carcase-line** family (base/tall 73/80/86) it is the line: `heightCode = heightClass = 80`.
- On every other family it is the unit's **cm height as the app labels it**: `HGA6029BK → 29`,
  `HGA60113 → 113`, `HGSP552047Z → 204`.
- **Do NOT compute it from `heightMm`.** The label is not `round(heightMm/10)`: `HGA60113` is 1136 mm but
  113, `HGA6074` is 737 mm but 74, and `AT3037Z` is 367 mm but **37** (an A-tier sibling that shares the
  40 slot). Copy the number from the family's existing H pills (`parameters.height[].label`) — a new unit
  MUST reuse the sibling's label for the same slot, or it lands in a slot of its own.

What breaks if you leave it out: the item still renders, but it is **invisible to H navigation** —
`items?familyId&heightCode=<label>` can't find it, so no sibling's H pill can reach it, and its own H pill
never shows as selected (§2c-10). Symptom: an H row where one height does nothing.

Checklist for a new unit with an H row:
1. `heightCode` set, matching the sibling label for that height;
2. `heightClass` set **only** if that value is 73/80/86 (it is the LINE, and it drives `showUnderLine`);
3. the family's other units already list that label in `parameters.height[]` — add the pill there too if
   this is a brand-new height (a pill with no `sku` is fine: the grid resolves by label, §2c-10).

---

## 4f. ⭐⭐ `unitFacts` / `familyFacts` — what actually draws the GRID card (2.5)

**The one thing to understand:** the app never asks a *unit* what its rows are. It asks the **family** —
`ppool(b)` (the family's units under the current programme + opening) → `hvals(b)` (their distinct height
codes) → `wsAtH` (the widths at the selected height) → `dAll` (the depths there) → `variantOpts(b)` (the Ty
chips). The backend now does the same and ships the finished rows as **`gridRows`** on every card:

```jsonc
gridRows: [
  { label: "H", kind: "height", pills: [ { label:"73", value:73, sku:"TSP4573", selected:false, off:false } ] },
  { label: "W", kind: "width",  pills: [ … ] },
  { label: "D", kind: "depth",  pills: [ … ] },
  { label: "Ty", kind: "variant", pills: [ { label:"S2Z", value:"S2Z", sku:null, selected:false, off:true, dead:true } ] }
]
```

**`gridRows` is COMPUTED — never author it, never send it.** What you author are its two inputs.

### `unitFacts` — this unit's values (one per item)

| Field | App | What it decides |
|---|---|---|
| `widthCode` | `u.w` | the number this unit contributes to the **W row**, in cm. ⚠️ *not* `widthMm/10` on panels |
| `depthCode` | `u.dv` | its value on the **D row**, in cm. `0` means 58 (the app reads `dv \|\| 58`). ⚠️ On a `dim:'width'` family this field **creates** a D row of its own (app `dvRowFn`, v537): two or more units sharing a `widthCode` but differing in `depthCode` ⇒ one **live** pill each, every pill a **real sibling** the card re-faces onto. One such unit alone draws no row |
| `variantCode` | `u.vr` | its **Ty** key; pools are variant-scoped whenever `familyFacts.variantLabel` is set |
| `depthAlterations` | `u.d` | the depth classes this *same* cabinet can be built at → the D **state** row (§4a model A). ⚠️ Setting it **suppresses** the sibling D row `depthCode` would build above — the app's two D rows are mutually exclusive and this one wins |
| `tier` / `opening` / `agnostic` / `siblingTiers` | `u.fam` / `u.op` / `u._ag` / `u.sib` | pool scoping + the FRONTS twin rule. `agnostic:true` = belongs to every line, never filtered out |
| `heightCodeNull` | — | set it **only** when `u.hc` is literally `null` rather than absent. The app compares heights with strict `===`, so a null unit never matches an absent one — which is why ANBL's card draws no W and no D row. 4 units in v781; if you are unsure, leave it out |
| `insert` (2.5.4) | `u.ins` | its value on the **Insert** row — the last row, after `Ty`. ⚠️ Setting it on ONE member gives the whole family the row (there is no separate axis flag: the app's `insAx` is derived from "a member has it"), and it **re-pools the card** — the face and the W row narrow to the picked insert, so every unit that should stay reachable needs a twin at the same width with the other value. Live-only pills, no greying. One family in v781: `FP_16FRONT`, `L3/M3` vs `M8` (`ZIGSUV20` ↔ `ZIGSUV20U`) |

The **H row** value is not in here — it is the top-level `heightCode` (§4e).

### `familyFacts` — the family's shape (denormalized onto EVERY member)

Same object on every unit of a family; if you edit it, edit it on all of them (`dupFamilies` entries carry
their own copy, §below).

| Field | App | What it decides |
|---|---|---|
| `dim` | `b.dim` | **which numeric row exists**: `height` (H+W+D), `hd` (H+D), `width`, `depth`, `none`. A `depth` family labels its row **D** even though the values come from `widthCode`. `none` = variant chips only, and those chips **never grey** |
| `variantLabel` | `b.vlbl` | the Ty/Mode/Config row's on-screen label — and the switch that makes pools variant-scoped. The row needs **two** variants to render, with ONE exception: the literal `"Finish"` draws its row even for a single variant (one pill, selected, unclickable — the app's `b.vfin` handle case; the pill is there for the colour swatch, `Finish/F+<code>.jpg`, and `405` → `F+405_VS.jpg`). See audit §P |
| `variantLabels` / `variantOrder` / `variantFormat` | `_vrLbl` / `b.cho` / `b.vfmt` | the chip TEXT, the curated chip order, and "labels are lengths in cm" |
| `numericLabel` | `b.slbl` | overrides the numeric row's label ("Depth", "Length") |
| `byProgramme` | `b.byprog` | pool is scoped by the ZONE programme instead of by the unit's own line |
| `hasOpeningArticles` / `hasPrimo` / `noLine` | `b._hasOp` / `b._hasP` / `b.noline` | pool selection, and `noLine` skips the carcase-line H filter |
| `memberTiers` | `b._mem` | every line the FAMILY appears in ("PAC") — the `famOkB` half of the card grey |
| **`isAccessory`** | `isAccessory(b)` | ⭐ the CARD never greys. No programme, depth or height gate applies to it |
| `isProgrammeAgnostic` | `isProgAgnostic(b)` | cat/sub sits outside the programme system |
| `depth63` | `d63Cfg(b)` | `null` ⟹ the family **cannot** be ordered at 63, so a D=63 toolbar drops it |
| `label` / `labelGroup` / `isSpecial` | `b.label` / `rk(label)` | card title + the sort that keeps a variant next to its product |
| `defaultWidthMin` | `b.dwm` | **which width the card OPENS at** when no W pill is set (a `dim:'width'` family). Leave it `null` — the value is then derived from the family's cat/sub (Base/Tall/Midway/Appliance housing 60 · `Accessories & interior`/`Interior+` 90 · `Drawers & Pull-outs` 80 · **anything else 0 = the narrowest member**). Set it only to reproduce an app-side override; v781 has exactly one (`RE_SLIDEIN` = 90), which ships as a backend constant, so nothing in the export carries this field today. Audit §P6 |

### `gridHidden` — never render this code as a card

`true` = this code belongs to no visible family: the app's `visibleBlocks()` skips `b.hid` families
outright (detail-only, reached through "Planned together"), and some codes belong to no app family at all —
the units the app's own init deletes (`meta.recoveredArtifactSkus`) and ItemRef-only stubs (`760`, `761`,
`SZIZ`, `US`…). 57 items. They stay **fetchable by sku** and still resolve as refs; they are only dropped
from every LIST. Set it when you add a code that exists purely to be referenced.

### `dupFamilies[]` — one code, several cards

41 synthetic families (`*__CKDUP`, `*__DRWDUP`, `*__SNKDUP`, `*__TRDUP`, `MRG_*`) re-list an accessory under
a second task area, and a few families genuinely share units. `familyId` is the PRIMARY card; each entry
here is **another whole card identity**, because a dup normally sits in a different sub-category with its
own catalog order — and 50 of the 79 entries have different `familyFacts` too:

```jsonc
"familyId": "F1970",                      // Base / Sinks — the primary card
"dupFamilies": [{
  "familyId": "F1970__CKDUP",
  "category": "Base", "subcategory": "Cooktops & Downdrafts",
  "section": "Accessories & Modifications",
  "catalogRank": 58, "sectionRank": 5, "familyIndex": 1672,
  "familyFacts": { /* the DUP family's own facts */ }
}]
```

A dup family's member POOL is collected from `familyId` **OR** `dupFamilies.familyId`, so every member of
the dup family needs the entry — otherwise that card renders with no rows. Worked example in
`docs/export-sample-v2.json` (`ANTSPSAUS`).

### Card order — `catalogRank` / `sectionRank` / `familyIndex`

Cards inside a section are ordered by the raw catalog `pri` **alone** — availability is *not* a key, so a
greyed card keeps its catalog position instead of sinking. `catalogRank` is that `pri`; **store `null` for
an unnumbered family** (it sorts last — do not use `999`, 294 families have a `pri` above it).
`sectionRank` orders the sections themselves, `familyIndex` is the final tiebreak. All three are backfilled
from the app; author them only for a family the extractor doesn't emit.

---

## 5. ⭐ Recipe: grey two width pills in a programme

Goal: a floor-unit family where **width 15 and 20 grey out under BOSSA** (programme id **`244`**).

**Key fact:** the rule lives on the pill's **target**, not the parent. Width-15 → `Z1580`, width-20 → `Z2080`,
so `244` goes in **those two items'** `excludedPrograms`.

**Step 1 — create the two width members, flagged not-in-BOSSA** (unlisted capability flags default to
`false`/`[]`, but sending the full object is safest for copy-paste):
```json
POST /design-book/items
{ "sku":"Z1580", "kind":"cabinet", "name":"Floor unit", "category":"Base", "subcategory":"Doors",
  "widthMm":150, "heightMm":795, "depthMm":560, "heightClass":80,
  "capabilities": { "excludedPrograms":["244"], "nativeTier":"P", "twinTiers":[], "opening":null,
    "excludedProgramsE":[], "isFrmatFamily":false, "hasEFront":false, "depthClasses":[58],
    "alwaysAvailable":false, "handleFree":false, "onePieceFront":false, "openP1":false, "openC1":false,
    "singleHandle":true, "antosoApproved":true, "doorLineJ":false, "doorLineY":false } }
```
Repeat for `Z2080` (widthMm 200), also `"excludedPrograms":["244"]`. Other widths leave `excludedPrograms:[]`.

**Step 2 — create the parent whose width pills point at them:**
```json
POST /design-book/items
{ "sku":"Z6080", "kind":"cabinet", "name":"Floor unit", "category":"Base", "subcategory":"Doors",
  "widthMm":600, "heightClass":80,
  "capabilities": { "excludedPrograms":[], "nativeTier":"P", "twinTiers":[], "opening":null, "excludedProgramsE":[],
    "isFrmatFamily":false, "hasEFront":false, "depthClasses":[58], "alwaysAvailable":false, "handleFree":false,
    "onePieceFront":false, "openP1":false, "openC1":false, "singleHandle":true, "antosoApproved":true,
    "doorLineJ":false, "doorLineY":false },
  "parameters": { "width":[
      {"label":"15","sku":"Z1580"}, {"label":"20","sku":"Z2080"},
      {"label":"30","sku":"Z3080"}, {"label":"60","sku":"Z6080"} ] } }
```

**Step 3 — verify:** `GET /design-book/items/Z6080?programs=244` → width 15 & 20 come back
`available:false, programmeExcluded:true`; the rest stay live.

**Why author it this way:** you set the flag **once** on the 15 cm item. Then every card whose width-15 pill
points at it greys under BOSSA automatically. Remove `244` later → it un-greys everywhere.

---

## 6. Other common recipes

**Edit a rule** (PATCH merges — send only what changes, but a whole field at a time):
```json
PATCH /design-book/items/T1580
{ "capabilities": { "excludedPrograms": ["201","202","244"], "nativeTier":"P", "twinTiers":[], "opening":null,
  "excludedProgramsE":[], "isFrmatFamily":false, "hasEFront":false, "depthClasses":[58], "alwaysAvailable":false,
  "handleFree":false, "onePieceFront":false, "openP1":false, "openC1":false, "singleHandle":true,
  "antosoApproved":true, "doorLineJ":false, "doorLineY":false } }
```
> PATCH replaces a whole top-level field. `capabilities` is one field — send the **complete** object, or the
> omitted keys are lost. (Fields you don't send — name, dims — are untouched.)

**Rename / retag:** `PATCH /design-book/items/T6080 { "name":"Floor unit XL", "section":"Tall Door Cabinets" }`

**Accessory with runner variants:**
```json
"accessories": [ "FS8056", { "sku":"IGS6058", "variants":[ {"label":"L3/M3","sku":"IGS6058"}, {"label":"M8","sku":"IGS6058U"} ] } ]
```

**Add a width to an existing CARD (2.5):** create the member with the family's ids + facts. Adding a pill to
`parameters.width` only changes the drawer — the card's W row is built from the members' `unitFacts`.
```json
POST /design-book/items
{ "sku":"Z7080", "kind":"cabinet", "name":"Floor unit", "familyId":"ZFAM",
  "category":"Base", "subcategory":"Doors", "widthMm":700, "heightClass":80, "heightCode":80,
  "capabilities": { "...": "as the siblings" },
  "unitFacts":   { "tier":"P", "opening":null, "agnostic":false, "siblingTiers":null,
                   "widthCode":70, "depthCode":58, "variantCode":null, "depthAlterations":null },
  "familyFacts": { "...": "copy VERBATIM from a sibling — it must be identical on every member" } }
```

**Delete:** `DELETE /design-book/items/Z6080` (soft, `active:false`) · `…?hard=true` (remove).

---

## 7. Gotchas — read before authoring a lot

- **The rule lives on the pill TARGET, not the parent** (§0, §5).
- **Re-ingest overwrites manual edits — the extractor wins.** A fresh `POST ingest` upserts every item by sku
  and deactivates manual-only skus not in the export. Author on skus the extractor doesn't emit, or re-apply
  after each ingest.
- **Unknown fields → 400.** Only §2 fields at the top level; a typo fails the whole request.
- **`excludedPrograms` uses programme IDS, not names** (`"244"`, not `"BOSSA"`). Get ids from `GET /design-book/programs?q=<name>`.
- **Only the PROGRAMME gate greys server-side.** `GET items/:sku?programs=<ids>` sets `available:false` +
  `programmeExcluded` on affected pills. The **other 7 gates are the client's job** (`availableFromCaps` against
  the toolbar). Send `programs=` or nothing greys.
- **58 & 63 depth always pass**; **`singleHandle:true` always passes the opening gate.**
- **Depth pills ≠ the depth filter.** Editing `parameters.depth` changes what the row DRAWS; only
  `capabilities.depthClasses` changes what the D pill MATCHES and what greys (§4a).
- **A repeated sku down a depth row is correct** — that is depth-as-alteration, not a data bug (§4a).
  Test `pill.sku === item.sku`, not the presence of `code`, to tell the two models apart.
  **On any OTHER row a repeated sku is a bug** — width/height/programme/options all navigate (§4a).
- **Don't invent height pills for 230/244/250** — that is `heightExtension`, and some families have real
  230/250 cm siblings too, so both must coexist (§4b).
- **`doorLineY: true` without `doorLineYCode` is unusable** — Y replaces the whole code, so the client
  has nothing to order (§4c).
- **⭐ Editing `parameters` does NOT change the grid card.** Since 2.5 the card's rows come from the family
  (`gridRows`, built from `unitFacts`/`familyFacts`); `parameters` is the detail drawer. A pill you add
  shows in the drawer only, and a member you add shows on the card only (§4f).
- **`familyFacts` must be IDENTICAL on every member of a family.** It is denormalized, not joined — one
  member with a stale copy is a coin-flip, since the card reads whichever unit is the face.
- **A new member with no `unitFacts` is invisible on the card.** It will still open, still resolve as a ref,
  and still appear in the drawer's pills — it simply contributes nothing to any row (§4f).
- **`catalogRank: null` ≠ "leave unchanged".** Null is a real value (unnumbered family, sorts last), so a
  PATCH that clears it must send an explicit `null`.
- **Card grey ≠ `availableFromCaps`.** Use the server's `cardAvailable`; the local 8-gate port sees ONE unit
  and cannot answer the two family questions (§3, `design-book-greying-examples.md` §14).

---

## 8. Verify your work

```bash
GET    /design-book/items/Z6080                    # round-trips: capabilities + parameters + unitFacts intact
GET    /design-book/items/Z6080?programs=244        # programme rule: width 15/20 → available:false, programmeExcluded:true
GET    /design-book/items?category=Base&subcategory=Doors&q=Z6080   # shows in the grid

# ⭐ 2.5 — the CARD, not the item. This is the only check that proves your facts are right:
GET    /design-book/items?familyId=ZFAM&groupBy=family&limit=1      # → gridRows[] · cardAvailable
GET    /design-book/items?familyId=ZFAM&groupBy=family&limit=1&depthClass=68&programs=244&lineState=73
                                                    # rows collapse + pills go `off` under a real toolbar
DELETE /design-book/items/Z6080?hard=true           # clean up a test
```
Reading `gridRows`: `selected` = the card's own value · `off` = greyed but still clickable · `dead` =
disabled (no unit behind it) · `sku` = the unit it lands on (informational — a grid client resolves by
`value`). An **empty** `gridRows` means "this card has no rows", which is a legitimate answer for a
two-member accessory family; a **missing** row usually means a member is short a `unitFacts` value.
Fastest UI check — the **admin UI** at `http://localhost:8000/design-book/admin`: fill the form, watch the live
grey preview. Or the **lite UI** (`http://localhost:8000/design-book/ui`): pick BOSSA in the programme dropdown
to watch pills/cards grey.

---

## 9. Reference

- **Contract:** `docs/export-schema-v2.ts` (types + `availableFromCaps`; `UnitFacts` / `FamilyFacts` / `DupFamily`).
- **Field ↔ UI map:** `docs/design-book-api-ui-map-v2.md` — **§2c-11** (`gridRows`) and **§2c-12**
  (card membership: `gridHidden`, `dupFamilies`, the family gates, card order) are the §4f reference.
- **Why every 2.5 rule exists (measured):** `docs/client-ui-parity-audit.md` §L (the sweep that found
  `parameters` ≠ the grid) and §M1–M9 (the membership + grey + order rules).
- **Worked greying examples (plain English):** `docs/design-book-greying-examples.md`.
- **What each field means (plain English, for non-programmers):** `docs/design-book-item-fields-plain-guide.md`.
- **Worked sample:** `docs/export-sample-v2.json`.
- **Programme ids:** `GET /design-book/programs` (BOSSA = `244` / `247` FS / `744` Contino / `747` FS-C).
- **Backend:** `D4K-backend/src/design-book/` — `design-book.controller.ts`, `design-book.service.ts`
  (`createItem`/`patchItem`/`deleteItem`/`normalizeItemDoc`/`annotateProgrammeExclusions`), `dto/upsert-item.dto.ts`.
