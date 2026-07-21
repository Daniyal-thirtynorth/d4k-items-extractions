# Design-Book CRUD Guide (v2 — minimal + capabilities model)

How to **add, edit, and delete** catalog items via the API, authored so the configurator pills grey out
exactly like the live app. For whoever builds the admin UI or hand-authors data.

- Base path `/design-book` · JWT-guarded (`Authorization: Bearer <token>`; get a dev token at `GET /design-book/dev-token`).
- Schema **2.2.0** — contract `docs/export-schema-v2.ts`, field↔UI map `docs/design-book-api-ui-map-v2.md`.
  (2.1 = 2.0 + `code` on depth pills, §4a. 2.2 = + `heightExtension` §4b and `doorLineYCode` §4c.
  All additive; older readers ignore them.)
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
- **Dimensions:** `widthMm`, `heightMm`, `depthMm`, `heightClass` (73|80|86|null).
- **Fronts / rules:** `availableTiers[]`, `faceForTiers[]`, **`capabilities`** (§3), `parameters` (§4),
  `heightExtension` (§4b), `doorLineYCode` (§4c).
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
| `antosoApproved` | bool | it's not approved for suspended install **and** you turned Suspended on. |
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
function availableFromCaps(c, s /* toolbar state */) {
  if (c.alwaysAvailable) return true;
  const pk = s.progKeys ?? [];
  const progOk  = !pk.length || pk.some(k =>
    !c.excludedPrograms.includes(k) && !c.isFrmatFamily &&
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

## 4. `parameters` — the pills

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

---

## 8. Verify your work

```bash
GET    /design-book/items/Z6080                    # round-trips: capabilities + parameters intact
GET    /design-book/items/Z6080?programs=244        # programme rule: width 15/20 → available:false, programmeExcluded:true
GET    /design-book/items?category=Base&subcategory=Doors&q=Z6080   # shows in the grid
DELETE /design-book/items/Z6080?hard=true           # clean up a test
```
Fastest UI check — the **admin UI** at `http://localhost:8000/design-book/admin`: fill the form, watch the live
grey preview. Or the **lite UI** (`http://localhost:8000/design-book/ui`): pick BOSSA in the programme dropdown
to watch pills/cards grey.

---

## 9. Reference

- **Contract:** `docs/export-schema-v2.ts` (types + `availableFromCaps`).
- **Field ↔ UI map:** `docs/design-book-api-ui-map-v2.md`.
- **Worked greying examples (plain English):** `docs/design-book-greying-examples.md`.
- **What each field means (plain English, for non-programmers):** `docs/design-book-item-fields-plain-guide.md`.
- **Worked sample:** `docs/export-sample-v2.json`.
- **Programme ids:** `GET /design-book/programs` (BOSSA = `244` / `247` FS / `744` Contino / `747` FS-C).
- **Backend:** `D4K-backend/src/design-book/` — `design-book.controller.ts`, `design-book.service.ts`
  (`createItem`/`patchItem`/`deleteItem`/`normalizeItemDoc`/`annotateProgrammeExclusions`), `dto/upsert-item.dto.ts`.
