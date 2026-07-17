# Design-Book CRUD Guide (v2 — minimal + capabilities model)

How to **manually add, edit, and delete** design-book items through the API, and how to author them so
the configurator pills behave exactly like the live catalog app. Written for whoever builds the admin UI
and for anyone hand-authoring catalog data.

- Base path: `/design-book` · every endpoint is JWT-guarded (`Authorization: Bearer <token>`).
- Schema version: **2.0.0** (contract: `docs/export-schema-v2.ts`; field↔UI map: `docs/design-book-api-ui-map-v2.md`).
- The CRUD endpoints write the **exact same shape** as `POST /design-book/ingest`. A hand-authored item and
  an extractor-produced item are byte-identical — both go through one `normalizeItemDoc`.

---

## 0. The one mental model you must have

**An item = one orderable code (SKU). A "cabinet card" is NOT one item — it's a FAMILY of sibling items,
one per width/height/depth, linked to each other by pills.**

Example — the "Floor unit" card is really many items:

| Width pill on the card | links to item | = |
|---|---|---|
| 15 | `T1580` | the 15 cm floor unit |
| 20 | `T2080` | the 20 cm floor unit |
| **60** | `T6080` | **the 60 cm floor unit (the card you opened)** |
| 70 | `T7080` | the 70 cm floor unit |

So the "Width" row on `T6080` is a set of **shortcuts to its brothers.** Clicking "15" opens the separate
item `T1580`.

**Consequence for CRUD (remember this):** a pill's behaviour is a fact about the item it POINTS TO, not
about the card you're editing. "Disable width-15 in programme BOSSA" is stored on `T1580`, not on `T6080`.
See §5.

---

## 1. The endpoints

| Method | Path | Does | Notes |
|---|---|---|---|
| `POST` | `/design-book/items` | **Create** one item | `sku` required. **409** if the sku already exists (use PATCH to edit). |
| `PATCH` | `/design-book/items/:sku` | **Edit** one item (merge) | Only the top-level fields in the body are replaced; the rest are untouched. Body `sku` is ignored (the URL wins). **404** if not found. |
| `DELETE` | `/design-book/items/:sku` | **Delete** one item | **Soft by default** (`active:false`, kept for history). `?hard=true` removes the document. **404** if not found. |

All three return the stored item (with its built `imageUrl`). All are JWT-guarded — mint a dev token at
`GET /design-book/dev-token` (local/dev only) or pass a real Bearer.

`POST /design-book/ingest` (bulk upload of the whole export) uses the same write path — so ingest and CRUD
never disagree on shape.

---

## 2. What you can set — the field surface

The request body is one item. **Every field the extractor writes is settable** ("customize anything").
The global validation runs `whitelist + forbidNonWhitelisted`, so **unknown top-level fields are rejected
(400)** — only the fields below are accepted. Nested content inside `capabilities`, `parameters`,
`finishInterior`, etc. is free-form (not whitelisted).

**Identity / taxonomy:** `sku` (required), `kind` (`cabinet|alteration|accessory|part`), `familyId`,
`name`, `category`, `subcategory`, `section`, `active`, `nameQualifier`.
**Dimensions:** `widthMm`, `heightMm`, `depthMm`, `heightClass` (73|80|86|null).
**Programme / tier:** `availableTiers[]`, `faceForTiers[]`, **`capabilities`** (§3).
**Configurator:** `parameters` (§4).
**Thin refs:** `alterations[]`, `accessories[]` (sku string OR `{sku, variants:[{label,sku}]}`), `companions[]`.
**Vero:** `finishInterior` (`{swatches[], visibleSideCombos[], optionCodes[]}`).
**Free text:** `description` (`{title, bullets[]}`), `restrictions[]`, `planningNotes[]`, `didYouKnow`,
`modifications[]`.
**Small blocks:** `handedLR`, `sinkFitment`, `appliance`, `toeKick`, `inspiration`.
**Pricing / catalog:** `finishes[]`, `priceUnit` (`pts|HLP`), `catalogPage`, `priceGroupRef`,
`frontModifiers`, `carcaseLine`, `weightKg`, `volumeM3`.
**Capability flags / nav:** `engineering[]` (`[{key, ok}]`), `functionalGroups[]`.

**You do NOT set** (the service owns them; sent values are stripped): `ingestBatchId`, `lastSeenAt`,
`deactivatedAt`, `catalogVersion`, `_id`, `__v`, `createdAt`, `updatedAt`. Also NOT set (built at read):
`imageUrl`, `pts`, the catalog PDF url, the tier-sibling P1/C1 synthesis, and the query-time pill
`available`/`programmeExcluded` annotation.

---

## 3. `capabilities` — the pill-rule inputs (deep dive)

This is the **complete set of facts that decide when this unit's pill greys** — one fact per toolbar
control. When this unit is the TARGET of a pill on some card, these decide whether that pill greys.

The app's rule (which the client and backend reproduce):
```
available(unit) = alwaysAvailable ||
  ( progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk )
```
Each gate reads a toolbar control + one or more `capabilities` fields. A pill is **DEAD** when its `sku` is
null (no target), **GREY** when `available(target) === false`, else live.

### Every field → the gate it feeds

| Field | Type | Gate / toolbar control | Meaning |
|---|---|---|---|
| `alwaysAvailable` | bool | (bypass) | `true` ⇒ this unit **never** greys — skips all 8 gates. |
| `excludedPrograms` | string[] | **programme** | Programme ids this unit **cannot** be ordered in. Pick one of them ⇒ this unit's pill/card greys. **This is the headline rule** (see §5). |
| `excludedProgramsE` | string[] | programme (single-front) | Extra exclusions that bite **only** when the "Full-E / single-front" toggle is on. Ignored unless `hasE`. |
| `isFrmat` | bool | programme | The special FRMAT finish-format pseudo-unit (its programme rule also uses a size-table). Normal items: `false`. |
| `hasE` | bool | programme / front | Can be built as a single-piece (E) front — switches on the `excludedProgramsE` + Full-E paths. |
| `tier` | `P\|A\|C\|null` | **tier (FRONTS pill)** | This unit's native programme line. `null` = line-neutral (never greys by tier). |
| `tierTwins` | (`P\|A\|C`)[] | tier | The OTHER tiers where a **real sibling SKU** of this unit exists. Pick a tier that's a twin ⇒ greys (the app swaps to the twin). Pick a tier with no twin ⇒ stays. |
| `op` | `P1\|C1\|null` | tier (opening pill) | This unit **is** a premium opening variant (P1/C1). Used by the P1/C1 FRONTS pills. |
| `depthClasses` | number[] | **depth (D pill)** | Depth sizes (cm) this unit offers. Pick a depth **not** in the list ⇒ greys. **58 and 63 always pass.** |
| `handleFree` | bool | **handle = "V"** | Handle-less / interior module. `false` ⇒ greys under the Vertical-handle toggle. |
| `frontE` | bool | **Full-E front** | One-piece front. `false` ⇒ greys under the Full-E toggle. |
| `openP1` | bool | **OPENING = P1** | Supports the P1 "one handle on top" variant. |
| `openC1` | bool | **OPENING = C1** | Supports the C1 variant. |
| `singleHandle` | bool | opening | Has ≤1 stacked front. `true` ⇒ the **opening gate always passes** (a single front can always take P1/C1), even when openP1/openC1 are false. |
| `antosoOk` | bool | **Suspended (ANTOSO)** | Fits inside the suspended-install size envelope. `false` ⇒ greys under the Suspended toggle. |
| `doorJ` | bool | **doorline = J** | Belongs to door-line J. `false` ⇒ greys under a J filter. |
| `doorY` | bool | **doorline = Y** | Belongs to door-line Y. `false` ⇒ greys under a Y filter. |

In the lite UI's "PILL RULES (CAPABILITIES)" box, a **green dot = true**, **red dot = false**, and the
live `availableFromCaps(this item, current toolbar) → LIVE / GREY` line shows the combined verdict.

### 3a. `depthClasses` in detail (and the 58/63 quirk)

`depthClasses` = the depth sizes (cm) this unit can be built in. It feeds the **D-pill gate**. Checking a
box = "this unit offers that depth". The gate:
```
depthOk = (picked === 58) || (picked === 63) || depthClasses.includes(picked)
```
So the D pill greys this unit **only when the picked depth is NOT in the list — EXCEPT 58 and 63, which
ALWAYS pass** (whether or not they're checked). Why: **58** is the standard/default depth (the toolbar
sits on 58), and **63** is the depth-alteration class (the 68 cm cabinet + factory depth alteration) —
both are always orderable, so the app never greys on them.

**Consequences (and a gotcha):**
- Check a depth ⇒ its D pill keeps the unit live. Uncheck ⇒ picking that D pill **greys** the unit — unless
  it's 58 or 63.
- **Unchecking 63 (or 58) does nothing** — it still passes. This is the one thing that surprises people:
  a 63 you unchecked will never grey. If you want the 63 pill to visibly react, that's not depth greying —
  it's the depth-alteration behaviour (a `parameters.depth` pill with `alteration:true`), not this gate.
- A unit that lists every class (e.g. `36,48,58,68`, like the screenshot) **never greys by depth** — all
  five D pills (36/48/58/63/68) keep it live. To make depth greying visible, give the unit a NARROW list
  (e.g. only `[58]`) — then picking 36/48/68 greys it while 58/63 stay live.
- **As a pill target:** when this unit is the target of some card's depth pill, that pill greys by exactly
  this rule — so narrowing `depthClasses` here greys the matching D pill on every card that links to it.
- The **"add other depths"** input is for rare non-standard classes beyond 36/48/58/63/68 (e.g. 42, 55).

### 3b. `tier` / `op` / `tierTwins` in detail (the FRONTS gate)

Three fields drive the **tier gate** — how the FRONTS pill (P · P1 · A · C · C1) greys this unit:
- **`tier` (native line)** — the unit's home line: `P` | `A` | `C` | `null`. `null` = line-neutral
  (accessories, alterations, fillers) → **never greys by tier**.
- **`op` (opening variant)** — whether this unit **IS** a premium one-handle-on-top code (`P1`/`C1`).
  `none` for a normal front. Feeds the **P1 / C1** FRONTS pills (not the P/A/C ones).
- **`tierTwins`** — the OTHER tiers where a **real sibling SKU** of this unit exists. Picking one of those
  tiers greys this unit (the app swaps to the twin); picking a tier with no twin leaves it live.

The rule:
```
FRONTS = ALL           → always live
FRONTS = P1 | C1       → live only if op === that (this unit IS the opening variant); else greys
FRONTS = P | A | C:
   tier === null        → always live (line-neutral)
   picked === tier      → live (its own line)
   otherwise            → greys IF tierTwins.includes(picked); else stays live
```
Why "greys when a twin exists": if you pick Contino and this Primo unit has a real Contino sibling code,
the app renders **that twin** instead — so the Primo unit greys. No twin ⇒ nothing to swap to ⇒ it stays.

**Worked example** — `tier:"P"`, `op:none`, `tierTwins:["C"]` (a Primo front that also comes in Contino):
FRONTS ALL/P/A → live; FRONTS **C → greys** (Contino twin exists); FRONTS **P1/C1 → greys** (`op` isn't
P1/C1). A → live because there's no Avance twin.

**Editing guidance:**
- Set `tier` to the unit's own line; set `op` ONLY if the sku itself is a `P1…`/`C1…` opening code.
- Check a `tierTwin` for **each tier that has a real sibling code** (Primo `T6080` + `CT6080` exists →
  check **C**). That greys this Primo unit under FRONTS = C (the C code is the real orderable one there).
- Leave `tier: null` for line-neutral items (accessories/alterations/fillers) so tier never greys them.

### 3c. Every remaining gate in detail

The other six gates follow the same pattern: a toolbar control + one or more capability fields decide
whether the unit stays live. `alwaysAvailable:true` short-circuits ALL of them to live.

**Programme gate** (`excludedPrograms`, `excludedProgramsE`, `isFrmat`, `hasE`) — the toolbar programme
selector.
```
progOk = no programme selected
      || SOME selected programme is NOT in excludedPrograms      (and not blocked by FRMAT / Full-E below)
```
- Greys when EVERY selected programme is in `excludedPrograms`. Multi-select is a union — one allowed
  programme keeps it live.
- `isFrmat:true` (the single FRMAT finish-format unit) additionally uses a programme size-table; treat it
  as a special case.
- `excludedProgramsE` bites ONLY when the **Full-E / single-front** toggle is on AND `hasE:true`.
- **Edit:** add programme **ids** (not names — `"244"`, from `GET /programs`) to `excludedPrograms`. This
  is the headline rule (§5): it's what greys a card's width/height/… pill whose target is this unit.

**Handle gate** (`handleFree`) — the toolbar **handle = "V" (vertical handle)** toggle.
```
handleOk = handle !== 'V'  ||  handleFree
```
- Greys under handle = V unless `handleFree:true` (handle-less front or interior module).
- **Edit:** check `handleFree` for handle-less / Module* units; leave false for normal handled fronts.

**Front gate** (`frontE`) — the **Full-E (one-piece front)** toggle.
```
frontOk = front !== 1  ||  frontE
```
- Greys under Full-E unless `frontE:true` (the unit can be a single-piece front, or its code ends in a
  digit+E).
- **Edit:** check `frontE` only for E-capable fronts.

**Opening gate** (`openP1`, `openC1`, `singleHandle`) — the **OPENING = P1 / C1** toggle.
```
openOk = no opening selected
      || (opening === 'P1' ? openP1 : openC1)     // supports that opening variant
      || singleHandle                              // a single stacked front always accepts an opening
```
- Greys under OPENING = P1/C1 unless the unit supports that variant OR is a single-front unit.
- **Edit:** check `openP1`/`openC1` if the front offers those variants; check `singleHandle` for units with
  ≤1 stacked front (they always pass this gate). Note: the FRONTS P1/C1 **pills** are a different control —
  those use `op` (§3b), not this gate.

**ANTOSO gate** (`antosoOk`) — the **Suspended** (wall-hang) toggle.
```
antosoOk_gate = !suspended  ||  antosoOk
```
- Greys under Suspended unless `antosoOk:true` (the unit fits the ANTOSO suspended-install size envelope).
- **Edit:** check `antosoOk` for units approved for suspended installation.

**Door gate** (`doorJ`, `doorY`) — the **door-line = J / Y** filter.
```
doorOk = no doorline selected  ||  (doorline === 'J' ? doorJ : doorY)
```
- Greys under a J or Y door-line filter unless the unit is in that line.
- **Edit:** check `doorJ` / `doorY` for units belonging to those door lines.

### 3d. Master greying table (all 8 gates)

| Toolbar control | Gate | Capability field(s) | Unit GREYS when… |
|---|---|---|---|
| Programme selector | progOk | `excludedPrograms` (+ `excludedProgramsE`/`hasE` in Full-E, `isFrmat`) | every selected programme id ∈ `excludedPrograms` |
| FRONTS P/A/C | tierOk | `tier`, `tierTwins` | picked tier ≠ `tier` AND `tierTwins` includes it (twin exists) |
| FRONTS P1/C1 | tierOk | `op` | picked is P1/C1 AND `op` ≠ picked |
| D pill (depth) | depthOk | `depthClasses` | picked depth ∉ `depthClasses` AND picked ≠ 58 AND ≠ 63 |
| Handle = V | handleOk | `handleFree` | `handleFree` is false |
| Full-E | frontOk | `frontE` | `frontE` is false |
| OPENING P1/C1 | openOk | `openP1`/`openC1`, `singleHandle` | doesn't support the variant AND not `singleHandle` |
| Suspended | antosoOk | `antosoOk` | `antosoOk` is false |
| Door-line J/Y | doorOk | `doorJ`/`doorY` | not in the picked line |
| (any) | bypass | `alwaysAvailable` | never — `true` forces LIVE |

A unit is LIVE only when it passes EVERY gate for the current toolbar (or `alwaysAvailable`). As a pill
target, the pill on the parent card greys exactly when the target unit is GREY. Compute it with
`availableFromCaps(caps, toolbar)` (§3, verbatim port).

### The reference evaluator (`availableFromCaps`)
The client evaluates all 8 gates itself (the backend only does the programme one — see §5). Verbatim port:
```js
function availableFromCaps(c, s /* toolbar state */) {
  if (c.alwaysAvailable) return true;
  const pk = s.progKeys ?? [];
  const progOk  = !pk.length || pk.some(k =>
    !c.excludedPrograms.includes(k) && !c.isFrmat &&
    !(s.front === 1 && c.hasE && c.excludedProgramsE.includes(k)));
  const tierOk  = !s.tier || s.tier === 'ALL' ? true
    : (s.tier === 'P1' || s.tier === 'C1') ? c.op === s.tier
    : !c.tier ? true : c.tier === s.tier ? true : !c.tierTwins.includes(s.tier);
  const depthOk = s.depth === 58 || s.depth === 63 || c.depthClasses.includes(s.depth ?? 58);
  const handleOk= s.handle !== 'V' || c.handleFree;
  const frontOk = s.front !== 1 || c.frontE;
  const openOk  = !s.open || (s.open === 'P1' ? c.openP1 : c.openC1) || c.singleHandle;
  const antosoOk= !s.antoso || c.antosoOk;
  const doorOk  = !s.doorline || (s.doorline === 'J' ? c.doorJ : c.doorY);
  return progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk;
}
```
Verified 99.997% vs the live app across 313,842 combinations (16,518 pill targets × 19 toolbar states).

---

## 4. `parameters` — the configurator pills

The W/H/D/Programme rows + coded rows. Each pill is thin — a **label + the SKU it navigates to**. There is
**no** stored `available`/`selected` — those are derived (selected = `pill.sku === item.sku`; grey =
`availableFromCaps(target, toolbar)`).

```jsonc
"parameters": {
  "width":     [ {"label":"15","sku":"T1580"}, {"label":"20","sku":"T2080"}, {"label":"60","sku":"T6080"} ],
  "height":    [ {"label":"H73","sku":"..."}, {"label":"H80","sku":"..."} ],
  "depth":     [ {"label":"58","sku":"..."}, {"label":"63","sku":"...","alteration":true} ], // alteration = the 63cm depth-alteration pill
  "programme": [ {"tier":"P","sku":"T6080"}, {"tier":"C","sku":"CT6080"}, {"tier":"P1","sku":"...","opening":true} ],
  "options":   [ {"group":"Ty","label":"Z2X","sku":"..."}, {"group":"Ty","label":"S2Z","sku":"..."} ] // coded rows, grouped by `group`
}
```
`sku: null` on a pill = the option exists but has no target code (renders dead/inert).

---

## 5. ⭐ Recipe: add an item with two width pills disabled in a programme

Goal (the common ask): a new floor-unit family where **width 15 and 20 grey out under BOSSA**.

**Key fact:** the "disabled in BOSSA" rule lives on the **pill's target**, not on the parent. BOSSA's
programme id is **`244`**. Width-15 links to (say) `Z1580`; width-20 links to `Z2080`. So put `244` in
**those two items'** `capabilities.excludedPrograms`.

**Step 1 — create the two width-member items, flagged not-in-BOSSA:**
```json
POST /design-book/items
{ "sku":"Z1580", "kind":"cabinet", "name":"Floor unit", "category":"Base", "subcategory":"Doors",
  "widthMm":150, "heightMm":795, "depthMm":560, "heightClass":80,
  "capabilities": { "excludedPrograms":["244"], "tier":"P", "tierTwins":[], "op":null,
    "excludedProgramsE":[], "isFrmat":false, "hasE":false, "depthClasses":[58],
    "alwaysAvailable":false, "handleFree":false, "frontE":false, "openP1":false, "openC1":false,
    "singleHandle":true, "antosoOk":true, "doorJ":false, "doorY":false } }
```
Repeat for `Z2080` (widthMm 200), also `"excludedPrograms":["244"]`. The other widths (`Z3080`, `Z6080`, …)
leave `excludedPrograms:[]`.

**Step 2 — create the parent whose width pills point at them:**
```json
POST /design-book/items
{ "sku":"Z6080", "kind":"cabinet", "name":"Floor unit", "category":"Base", "subcategory":"Doors",
  "widthMm":600, "heightClass":80,
  "capabilities": { "excludedPrograms":[], "tier":"P", "tierTwins":[], "op":null, "excludedProgramsE":[],
    "isFrmat":false, "hasE":false, "depthClasses":[58], "alwaysAvailable":false, "handleFree":false,
    "frontE":false, "openP1":false, "openC1":false, "singleHandle":true, "antosoOk":true,
    "doorJ":false, "doorY":false },
  "parameters": { "width":[
      {"label":"15","sku":"Z1580"}, {"label":"20","sku":"Z2080"},
      {"label":"30","sku":"Z3080"}, {"label":"60","sku":"Z6080"} ] } }
```

**Step 3 — verify:** `GET /design-book/items/Z6080?programs=244` → the width 15 and 20 pills come back
`available:false, programmeExcluded:true`; the rest stay live.

**Why it's authored this way:** you set the flag **once** on the 15 cm item. Then EVERY card whose width-15
pill points at it greys under BOSSA automatically — you never repeat the rule per card. Remove `244` later
and it un-greys everywhere.

> Prefer to write the exclusion **directly on the pill** (`"disabledPrograms":["244"]` inside the parent's
> width pill) instead of on the target? That override isn't wired yet — ask and it can be added to the
> backend; then the pill's own list wins and you skip flagging the target.

---

## 6. Other common recipes

**Edit a rule on an existing item** (PATCH merges — send only what changes):
```json
PATCH /design-book/items/T1580
{ "capabilities": { "excludedPrograms": ["201","202","244"], "tier":"P", "tierTwins":[], "op":null,
  "excludedProgramsE":[], "isFrmat":false, "hasE":false, "depthClasses":[58], "alwaysAvailable":false,
  "handleFree":false, "frontE":false, "openP1":false, "openC1":false, "singleHandle":true,
  "antosoOk":true, "doorJ":false, "doorY":false } }
```
> PATCH replaces a whole top-level field. `capabilities` is one field — send the **complete** object, not
> just the changed key, or the omitted keys are lost. (Dimensions/name/etc. you didn't send are untouched.)

**Rename / retag an item:** `PATCH /design-book/items/T6080 { "name":"Floor unit XL", "section":"Tall Door Cabinets" }`.

**Add an accessory with runner variants:**
```json
"accessories": [ "FS8056", { "sku":"IGS6058", "variants":[ {"label":"L3/M3","sku":"IGS6058"}, {"label":"M8","sku":"IGS6058U"} ] } ]
```

**Soft delete** (hide, keep history): `DELETE /design-book/items/Z6080` → `active:false`.
**Hard delete** (remove): `DELETE /design-book/items/Z6080?hard=true`.

---

## 7. Gotchas — read before you author a lot of data

- **The rule lives on the pill TARGET, not the parent** (§0, §5). Programme/tier/depth greying is decided by
  the item a pill points to.
- **Re-ingest overwrites manual edits — the extractor wins.** If someone re-uploads a fresh export (`POST
  ingest`), every item is upserted by sku; your manual edits to those skus are replaced, and a manual-only
  item that isn't in the new export is deactivated (`active:false`) by the missing→inactive sweep. Author
  manual data you want to keep on skus the extractor doesn't emit, or re-apply after each ingest.
- **Unknown fields are rejected (400).** Only the §2 fields are accepted at the top level. Typos in a field
  name fail the whole request.
- **`capabilities.excludedPrograms` uses programme IDS, not names** (`"244"`, not `"BOSSA"`). Get ids from
  `GET /design-book/programs?q=<name>`.
- **The backend only greys the PROGRAMME gate server-side.** `GET items/:sku?programs=<ids>` (and
  `GET items?programs=`) sets `available:false` + `programmeExcluded` on pills whose target excludes the
  programme. The **other 7 gates are the client's job** — evaluate `availableFromCaps` in the UI against the
  toolbar. (This is how the lite UI greys the whole card; see `public/design-book-ui.html`.)
- **Send `programs` or nothing greys.** With no `programs` param the programme gate passes everything.
- **58 and 63 depth always pass** the depth gate; only other depths can grey by depth.
- **`singleHandle:true` makes the opening gate pass** regardless of openP1/openC1.

---

## 8. Verify your work

```bash
# 1. it round-trips
GET  /design-book/items/Z6080                     # → the stored item, capabilities + parameters intact
# 2. the programme rule fires
GET  /design-book/items/Z6080?programs=244         # → width 15/20 available:false, programmeExcluded:true
# 3. it shows in the grid
GET  /design-book/items?category=Base&subcategory=Doors&q=Z6080
# 4. clean up a test
DELETE /design-book/items/Z6080?hard=true
```
In the **lite UI** (`http://localhost:8010/design-book/ui`): `＋ New` (paste JSON) · open a card → `✎ Edit`
(raw-JSON PATCH) / `🗑 Delete`. Pick BOSSA in the programme dropdown to watch the pills/cards grey.

---

## 9. Reference

- **Contract:** `docs/export-schema-v2.ts` (types + `availableFromCaps`).
- **Field ↔ UI map:** `docs/design-book-api-ui-map-v2.md` (§1b CRUD, §2c/§2d capabilities).
- **Worked sample:** `docs/export-sample-v2.json` (12 real items exercising every object).
- **Programme ids:** `GET /design-book/programs` (BOSSA = `244` / `247` FS / `744` Contino / `747` FS-C).
- **Backend:** `D4K-backend/src/design-book/` — `design-book.controller.ts` (routes),
  `design-book.service.ts` (`createItem`/`patchItem`/`deleteItem`/`normalizeItemDoc`/
  `annotateProgrammeExclusions`), `dto/upsert-item.dto.ts` (the field surface).
