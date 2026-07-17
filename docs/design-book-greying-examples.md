# Design-Book Greying — Worked Examples (real v781 items)

Concrete, verifiable examples of **when a configurator pill / card greys**, one per gate, using REAL items
from the v781 catalog (dev DB). Companion to `design-book-crud-guide.md` §3 (authoring) and
`design-book-api-ui-map-v2.md` §2c (rendering).

## How to read these

- A pill greys when its **TARGET item's** `capabilities` fail a gate for the current toolbar. A whole card
  greys when its **own** `capabilities` fail (GREY, DON'T HIDE). Both use the same function:
  `available = alwaysAvailable || (progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk)`.
- Each example shows: the real **item + the capability that matters**, a **toolbar state**, and the
  **LIVE / GREY** verdict (which gate fired).
- Verify any of these live: `GET /design-book/items/<sku>` returns `capabilities`; `GET /design-book/items/<parent>?programs=<id>`
  shows the programme-greyed pills. (Backend on :8010, dev.)

Reminder — **defaults never grey anything**: `depth=58, tier=ALL, open='', front=0, handle=std, antoso=false,
doorline='', progKeys=[]`. Greying only appears once a toolbar control moves off its default.

---

## 1. Programme gate — `excludedPrograms`

**Item `T1580`** ("Floor unit", Base › Doors) — `capabilities.excludedPrograms` includes **`244` (BOSSA)**
(among 20 programmes). Also `T2080` (the 20 cm sibling).

| Toolbar | Result | Why |
|---|---|---|
| no programme | **LIVE** | progOk passes when nothing is picked |
| `programs=[244]` (BOSSA) | **GREY** | 244 ∈ `excludedPrograms` → progOk fails |
| `programs=[201]`… any NOT in its list | LIVE | that programme is allowed |
| `programs=[244, <something-it-allows>]` | LIVE | union — one allowed programme keeps it live |

**As pills (verified end-to-end):** `T6080`'s Width row links 15→`T1580`, 20→`T2080`.
```bash
GET /design-book/items/T6080?programs=244
#  parameters.width[0] = {"label":"15","sku":"T1580","available":false,"programmeExcluded":true}
#  parameters.width[1] = {"label":"20","sku":"T2080","available":false,"programmeExcluded":true}
#  → the 15 and 20 pills render struck; all others live.
```
> **Authoring:** to disable a pill in a programme, put the programme id on the pill's TARGET (§5 of the guide).

---

## 2. Tier gate (FRONTS P/A/C) — `tier` + `tierTwins`

**Item `T1573`** ("Floor unit", Base › Doors) — `tier="P"` (native Primo), `tierTwins=["C"]` (a real Contino
twin `CT1573` exists), `op=null`.

| FRONTS pill | Result | Why |
|---|---|---|
| ALL | **LIVE** | tier gate off |
| P | **LIVE** | picked = native tier |
| **C** | **GREY** | picked ≠ native AND a C twin exists → app swaps to `CT1573` |
| A | **LIVE** | no Avance twin → nothing to swap to → stays |

> Flip side: `CT1573` (the Contino twin) has `tier="C"`, so it's LIVE under FRONTS=C and greys under P.

---

## 3. Tier gate (FRONTS P1/C1) — `op`

**`P1TSP457368B`** ("Sink unit · blender", Base › Sinks) — `op="P1"`: this unit **IS** the P1 opening
variant. **`C1T308036S2Z`** ("Pullout unit · S2Z") — `op="C1"`.

| FRONTS pill | `P1TSP457368B` (op=P1) | a normal unit (op=null) |
|---|---|---|
| P1 | **LIVE** (it IS the P1 variant) | **GREY** (op ≠ P1) |
| C1 | GREY (op ≠ C1) | GREY |

> The P1/C1 FRONTS pills use `op`, NOT `tierTwins`. Only the unit that *is* that opening variant survives.

---

## 4. Depth gate (D pill) — `depthClasses` (58 & 63 always pass)

**`C1T3080S2Z`** ("Pullout unit · S2Z", Base › Drawers & Pullouts) — `depthClasses=[58]` (offers ONLY 58).

| D pill | Result | Why |
|---|---|---|
| 58 | **LIVE** | 58 always passes |
| 63 | **LIVE** | 63 always passes (depth-alteration class) |
| 36 / 48 / 68 | **GREY** | not in `depthClasses` → depthOk fails |

**`C1T308036S2Z`** — `depthClasses=[36]`: LIVE under 36 (offered) + 58/63 (always pass); **GREY** under 48/68.

> Gotcha: a unit whose list already covers all classes (e.g. `36,48,58,68`) **never greys by depth** — every
> D pill passes. Unchecking 63 in the admin form does nothing (63 always passes).

---

## 5. Handle gate — `handleFree`

**`GF46204`** ("Appliance door for large Fridge/Freezer", Tall › Appliance Housing) — `handleFree=true`
(handle-less / module). A normal `CT1573` has `handleFree=false`.

| Handle toolbar | `GF46204` (handleFree=true) | `CT1573` (handleFree=false) |
|---|---|---|
| standard | LIVE | LIVE |
| **V** (vertical handle) | **LIVE** | **GREY** |

---

## 6. Front gate (Full-E) — `frontE`

**`GF46204`** — `frontE=true` (one-piece front). Most cabinets have `frontE=false`.

| Full-E toolbar | `frontE=true` | `frontE=false` |
|---|---|---|
| off (front=0) | LIVE | LIVE |
| **on (front=1)** | **LIVE** | **GREY** |

---

## 7. Opening gate — `openP1` / `openC1` / `singleHandle`

- **`T3073S`** ("Floor unit · S", Base › Doors) — `openP1=true`, `singleHandle=true`.
- **`CT1573`** ("Floor unit") — `openP1=false, openC1=false, singleHandle=true`.

| OPENING toggle | `T3073S` (openP1) | `CT1573` (singleHandle only) | a multi-front unit (all false) |
|---|---|---|---|
| none | LIVE | LIVE | LIVE |
| P1 | **LIVE** (supports P1) | **LIVE** (singleHandle passes) | **GREY** |
| C1 | LIVE (singleHandle passes) | **LIVE** (singleHandle passes) | GREY |

> `singleHandle=true` makes the opening gate pass regardless of `openP1`/`openC1` — a single front can always
> take an opening variant. A unit greys under OPENING only when it's multi-front AND lacks the variant.

---

## 8. ANTOSO gate (Suspended) — `antosoOk`

- **`CT3073`** ("Floor unit") — `antosoOk=true` (fits the suspended-install envelope).
- **`CT1573`** ("Floor unit") — `antosoOk=false`.

| Suspended toggle | `CT3073` (true) | `CT1573` (false) |
|---|---|---|
| off | LIVE | LIVE |
| **on** | **LIVE** | **GREY** |

---

## 9. Door gate (door-line) — `doorJ` / `doorY`

- **`HVG7019768`** ("Slide-away door housing unit", Tall › Appliance Housing) — `doorJ=true, doorY=false`.
- **`MGT601468`** ("Module Appliance niche with door · KL 80") — `doorY=true, doorJ=false`.

| doorline toolbar | `HVG7019768` (J) | `MGT601468` (Y) |
|---|---|---|
| none | LIVE | LIVE |
| **J** | **LIVE** | **GREY** |
| **Y** | **GREY** | **LIVE** |

---

## 10. Never greys — `alwaysAvailable` and line-neutral

**`AT301336S`** ("Drawer unit · Special Height", Base › Special Height) — `alwaysAvailable=true`, `tier=null`.

- `alwaysAvailable=true` → **LIVE under EVERY toolbar** (short-circuits all 8 gates). Use for
  always-shown units.
- `tier=null` (line-neutral: accessories, alterations, fillers, special-height) → **never greys by tier**
  (the tier gate returns true for null tier), regardless of the FRONTS pill.

---

## 11. Single-front / Full-E programme path — `hasE` + `excludedProgramsE`

**`GF46204`** — `hasE=true`, `excludedProgramsE=["226","228","283","613","654","669","684","726","728","783"]`.

These extra programme exclusions bite **only** when the **Full-E toggle is on**:

| Toolbar | Result |
|---|---|
| `programs=[226]`, front=0 | LIVE (226 not in normal `excludedPrograms`) |
| `programs=[226]`, **front=1** (Full-E) | **GREY** — 226 ∈ `excludedProgramsE` AND `hasE` |

> The backend's `annotateProgrammeExclusions` only reads normal `excludedPrograms`; the Full-E path is
> client-side (send the front state to `availableFromCaps`).

---

## 12. FRMAT — the one special case — `isFrmat`

**`FRMAT`** ("Front panel material", Panels & surround › Surround) — `isFrmat=true`. Its programme
availability additionally uses a size table (`FRMAT_MAX[programmeName]`), so `progOk` for FRMAT must layer
that rule on top of `excludedPrograms`. One unit catalog-wide — special-case it.

---

## 13. Multiple gates at once — `CTSS12073T2`

**`CTSS12073T2`** ("Floor unit with sliding doors", Base › Doors):
`excludedPrograms=[201,202,…,786]` (50 programmes), `tierTwins=["P"]`, `depthClasses=[58,68]`,
`handleFree=false`, `antosoOk=true`, `tier="C"`.

A pill pointing at this unit (or the card itself) greys when **any** of these fires:

| Toolbar | Verdict | Failing gate |
|---|---|---|
| default | **LIVE** | — |
| `programs=[201]` | GREY | progOk (201 excluded) |
| FRONTS = **P** | GREY | tierOk (P twin exists) |
| D pill = **36** or **48** | GREY | depthOk (offers only 58/68) |
| Handle = **V** | GREY | handleOk (`handleFree=false`) |
| Suspended = on | **LIVE** | passes (`antosoOk=true`) |
| FRONTS = **C** (its native) | LIVE | its own tier |
| D pill = **58 / 63 / 68** | LIVE | 58/63 always pass; 68 offered |

Only when it passes **every** gate is it LIVE. That is exactly `availableFromCaps(caps, toolbar)`.

---

## Quick verification recipe

```bash
# 1. read the capabilities of any example
GET /design-book/items/T1580        # → capabilities.excludedPrograms includes "244"

# 2. see the programme gate fire on a real card's pills
GET /design-book/items/T6080?programs=244   # width 15/20 → available:false, programmeExcluded:true

# 3. the other 7 gates: evaluate availableFromCaps(target.capabilities, toolbar) client-side
#    (the port is in export-schema-v2.ts / api-ui-map-v2.md §2c).
```
Programme ids come from `GET /design-book/programs` (BOSSA = `244`).
