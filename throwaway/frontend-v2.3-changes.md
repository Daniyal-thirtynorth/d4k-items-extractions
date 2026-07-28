# D4K-frontend — design-book v2.3 + v2.4 (client-UI parity) implementation

Line refs are `origin/dev` = `1f0aa8e0`. Everything below is additive — no field is removed or renamed.
The backend half of every rule here already SHIPPED (D4K-dev + D4K-prd data, `dev` branch code); this
document is only the frontend work to *consume* it. ⚠️ **`heightCode` (R7) is DATA in both DBs but the
`?heightCode=` query param lives on the backend `dev` branch** — point at a backend that has it before
switching the H picks over.

**v2.4 (2026-07-28) added here:** `Item.heightCode` — the H-row key for non-line families (R7, Step 1c/1e,
5, 6). It is the fix for "our grid disables most of the H pills, the app doesn't"; it changes the H row of
the R2 table (`heightCode`, not `heightClass`) and adds one rule: **a null `pill.sku` on an H pill is NOT a
dead chip.**

**This is independent of the v2.2 guide** (`frontend-v2.2-changes.md`, depth-state rows + `heightExtension`).
Neither v2.2 nor v2.3 is in `dev` yet. They overlap in exactly one spot — the `Chip`/`ChipRow` `onPick`
signature (both widen it). If v2.2 lands first, Step 3 here is a no-op; if this lands first, v2.2's Step 3a
is a no-op. Anywhere else they touch the same file they touch different lines.

**Work list**

| Step | Task | Files |
|---|---|---|
| **1** | Types — **do this first**; every later step imports from it (incl. `heightCode`, R7) | `api/types.ts` |
| 2 | New helper module — the 8-gate `availableFromCaps` port + `showUnderLine` visibility + `toolbar` adapter | `data/caps.ts` (new) |
| 3 | Query params — **stop sending `heightClass` for the LINE bar**; add `grey` / `refs` | `api/params.ts` |
| 4 | Page-level **pill-target refs map** (context) — seeded per list + merged per swap | `hooks/use-refs.tsx` (new), `index.tsx` |
| 5 | **Family swap** hook — swap a grid card by `familyId`+dims, never by `pill.sku` | `hooks/use-card-swap.ts` (new) |
| 6 | Grid card — W/H/Ty via family swap · `showUnderLine` collapse · whole-card + per-pill grey · selected markers | `components/unit-card.tsx` |
| 7 | Grid — switch to `items/by-section`, render `sections[]` **as-is** (no re-sort/re-bucket) | `components/catalog-grid.tsx`, `index.tsx` |
| 8 | Detail drawer — **leave `pill.sku` navigation alone**; optional `showUnderLine` collapse | `components/detail-panel.tsx` |

**Out of scope** — pre-existing gaps, don't touch: the dead `api/adapt.ts` + `data/filter.ts`
(`cardToFamily`/`FilteredFamily` — imported nowhere in the render path); the `handle` / `front` /
`open` / `doorline` toolbar controls (they don't exist yet, so those four gates are inert — see Step 2);
v2.2's depth `code` / `heightExtension` / `doorLineYCode`.

---

## The rules you're implementing

Six parity findings, all captured from the live v781 app and already reproduced server-side. Ground truth
is `d4k-items-extraction/docs/design-book-api-ui-map-v2.md` — the `§` refs below point into it.

### R1 · The "H 73 80 86" bar is a LINE selector, **never a filter** (§2c-7)

The grid toolbar's `H · All 73 80 86` seg is **not a height filter, in any category.** It is the app's
`state.line`. Clicking `73` does three things and **none of them is a server filter**:

1. **re-faces every card** to its 73-line sibling, *width and depth preserved* (`TSP6080 → TSP6073`),
2. **collapses each card's W/H rows** to the pills that show under line 73 (`showUnderLine`, R4),
3. **changes membership not at all** — same families, same sections, same counts.

A family with no unit at that line **keeps its default face** (not hidden, not greyed).

> **Today `api/params.ts:38` sends `heightClass = f.line`.** That hard-filters membership *and* collapses
> the face to the LOWEST width (`TSP4573` instead of `TSP6073`). **Delete it.** The line pick drives
> client-side re-facing (R2 swap) + row collapse (R4) only.

Don't conflate it with the **exact-height popover** (`filters.height`, `HeightPopover` in `size-bar.tsx`):
that one — the tall *dynamic* height row (190/204/217…) — **is** a real filter and stays (`heightClassExact`).

**⚠️ Stale-highlight trap (§2c-7).** The app's own `#lineSeg` highlight doesn't re-sync from `state.line`
on render, so a screenshot can show a lit "73" chip over an `H-All` grid. **When comparing to the app,
trust the CARDS (face sku + row shape), not the toolbar chip.**

### R2 · Grid W/H/Ty pills **never navigate by `pill.sku`** (§2c-8)

The stored `parameters.width/height/options[]` skus were scraped from the app's **DETAIL panel**, where the
app itself targets the **d68 sibling** (`TSP6080B` detail: `H80 → TSP608068B`, *not itself*; `TSPA8073TZW`
Ty `TZW → TSPA807368TZW`, its own d68 twin). The app's **GRID** chips instead re-face **preserving the
other dims**. So a grid card that fetches `pill.sku` reproduces the *detail* behaviour in the *grid* —
wrong `…68…` codes and a self pill that never lights selected.

**Today `unit-card.tsx` does exactly that** — every row is `onPick={setCurSku}` → `useItems({sku:[curSku]})`.
Correct grid resolution (family-scoped, `groupBy=family&limit=1&refs=true`):

| Row | Grid click resolves via | Selected pill |
|---|---|---|
| **W** | `items?familyId&widthMm=label×10&heightCode=card's` (+`heightClass` if set) `&groupBy=family&limit=1` — **retry dropping the HEIGHT, not the width** | sku match, else numeric label == card's `widthMm/10` |
| **H** | `items?familyId&heightCode=label&widthMm=card's&groupBy=family&limit=1` (retry w/o `widthMm`) — **`heightCode`, see R7** | sku match, else numeric label == card's `heightCode` |
| **Ty / options** | `items?familyId&variantCore=<target's>&heightCode=card's` (+`heightClass`) `&widthMm=card's&groupBy=family&limit=1` (retry w/o width, then w/o height) | target `variantCore` == card's `variantCore` |
| **Depth** | v2.2 §2c-4 — state pill vs sibling by `pill.sku` (until v2.2 lands: `setCurSku(pill.sku)`) | by label |
| **Programme** | unchanged — `pill.sku` (tier codes are backend-synthesized, fetchable) | `pill.sku === card.sku` |

The `variantCore` of a Ty target comes from the **refs map** (R3). The face-rank `depthMm`-ASC tiebreak
makes the family query land the native-depth unit, so there is **no depth math in the client**.

**The DETAIL drawer keeps `pill.sku`** — the d68 targets ARE the app's detail behaviour there (Step 8).

### R3 · Keep a page-level pill-target caps/refs map, and merge swapped-in cards into it (§2c-8)

`GET items?...&refs=true` returns `refs: { [targetSku]: { capabilities, variantCore, widthMm, heightClass, … } }`
covering every pill target on the page. Pills grey on their **target's** caps (R5); Ty selection compares
the target's `variantCore`. A card swapped in *after* page load (R2) brings pill targets the map has never
seen — without them the variant-selected mark and per-pill greying silently stop working. So **every swap
query itself passes `refs=true`** and its response's `refs` are merged into the page map
(`Object.assign(pageRefs, resp.refs)`). Last resort for one missing target: `items?sku=<pill.sku>&limit=1`.

### R4 · `showUnderLine` — collapse the W/H rows to the active line (§2c-5)

Per-pill `number[]` on `parameters.width/height[]` = the carcase lines that pill shows under.
**Render: `visible = !p.showUnderLine || p.showUnderLine.includes(line ?? 0)`** where `line` = the toolbar
LINE pick as a number, or **`0` when All**. `0` is the "All / no-line" state: two-system tall H rows hide
their 73-system pills even at All (80-system → `[0,80]`, 73-system → `[73,86]`); base pills are `[0,…]`.
Absent ⟹ always show. Depth rows never carry it. Applies to the **W and H rows only.**

### R5 · Grey, don't hide + per-pill greying via the 8-gate rule (§2c-6, §2c per-gate table)

`GET items?...&grey=true` makes the backend **skip the `depthClass` hard-filter**, so a family's native face
comes back as a card even when it's not orderable at the toolbar depth; the client renders it
**visible-but-greyed** via `availableFromCaps(card.capabilities, toolbar)`. `capabilities` ships on every
list card (it is NOT in the backend's `LIST_OMIT`). The same rule greys individual pills on their target's
caps (from the R3 refs map). W filter membership + face (§2c-9) is entirely server-side — **keep sending
`widthMm`, add no client-side width filter**; a card whose face width ≠ the W pick is correct.

### R6 · Sections come pre-ordered and pre-merged — render them verbatim (§2b)

`GET items/by-section` reproduces the app's `renderGrid`: catalog order (not alphabetical) + the
single-card header-suppression rule (a lone non-`FORCE_SEC` card gets no header and flows into the previous
section — this is why W50 Sink Cabinets shows 5 cards under "Sink Units with Trash Pullout"). **Render
`sections[]` in the given order; DON'T re-sort or re-bucket.** The current grid builds section headers
itself from a flat `items[]` — switch it to the section endpoint.

### R7 · `heightCode` — the H-row key for EVERY family, and H pills are never dead (§2c-10, v2.4)

*(client report 2026-07-28: "our UI disables a lot of height pills, the client HTML is not" — BOSSA ·
Tall→Water→Dishwasher · D58.)*

The app has ONE per-unit height key, `u.hc`, and the grid H row is the FAMILY's set of them
(`pickHeight(fid,hc)`). What it MEANS depends on the family:

| Family kind | `hc` | Example |
|---|---|---|
| base / tall **carcase-line** families | the LINE 73 \| 80 \| 86 (= the old `heightClass`) | `TSP6080B` → 80 |
| **everything else** (appliance housings, supports, drawers, tall specials) | the unit's **cm HEIGHT** | `HGA6029BK` → 29, `HGSP552047Z` → 204 |

Only the first case used to be stored, so on every other family an H pill was unresolvable
(`heightClass` is null there and `?heightClass=29` is a **400** — that param is the 73|80|86 enum).
`Item.heightCode` now ships on every unit that has one (12,048/18,396) and IS the query key:

```
GET items?familyId=F674&heightCode=42&widthMm=600&groupBy=family&limit=1   → HGA6042
GET items?familyId=SNK2&heightCode=73&widthMm=600&groupBy=family&limit=1   → TSP6073B   (same answer heightClass gave)
```

`heightCode` is **exact** (not null-inclusive like `heightClass`) and returns the identical unit on line
families — so **use one rule for every H pick: `familyId + heightCode` (+ `widthMm`, retry without it).**
`heightClass` keeps its own jobs: the LINE bar pre-select (R1) and `showUnderLine` (R4).

**⚠️ A null `parameters.height[].sku` does NOT mean a dead pill.** Those skus come from the DETAIL panel,
which is variant-scoped: `HGA6029BK` is Ty `BK`, a variant that only exists at 29 + 34 cm, so the export
stores `{label:"H42"}` with **no sku** — 2,560 pills over 1,188 items. The app renders every one of them
**live on the CARD** and `pickHeight` jumps the variant (`alt = ppool(b).find(u => u.hc === h)` → `HGA6042`).
A client that renders "no sku ⇒ disabled" greys most of the H row on every housing card — the reported bug.

* **Grid card:** an H pill is **never disabled**. Route the click by LABEL through `heightCode`; ignore
  `pill.sku` entirely (R2).
* **Detail drawer:** unchanged — `pill.sku === null` IS the app's dead chip there; keep it disabled.
* **Greying:** no target sku ⟹ no target caps ⟹ the pill renders LIVE (the app greys a height only when NO
  unit at it passes `available()`; not modelled — it over-shows, never over-greys).

**⚠️ The same key is what makes a W / Ty pick preserve the height.** Those swaps carry "the card's height"
so the other dimension survives — but `heightClass` is **null** outside line families, so carrying only it
silently drops the constraint: `T3027Z` + W50 returned **`T5093S7`** (height 93!) instead of `T5027Z`.
Carry `heightCode` on **every** swap that means "keep the height", and relax it **before** the width on a W
pick (the app's `pickHWidth` keeps the width and lets the height move, not the reverse).

---

# Implementation

## Step 1 — `api/types.ts`

**1a. `Capabilities` — the 8-gate rule surface** (17 fields; add near `ConfigureOption`, `:122`):

```ts
/** The pill-gate rule surface (api-ui-map-v2 §2c). Ships on every list card AND every refs entry. */
export interface Capabilities {
  nativeTier?: string;            // P | A | C — the unit's native front line
  opening?: string;               // "" | P1 | C1 — the opening variant it IS
  twinTiers?: string[];           // tiers with a real sibling
  excludedPrograms?: string[];    // programme ids this unit is NOT orderable in
  excludedProgramsE?: string[];   // …in Full-E mode
  isFrmatFamily?: boolean;
  hasEFront?: boolean;
  depthClasses?: number[];        // orderable depth classes (58 & 63 always pass)
  handleFree?: boolean;
  onePieceFront?: boolean;
  openP1?: boolean;
  openC1?: boolean;
  singleHandle?: boolean;
  antosoApproved?: boolean;
  doorLineJ?: boolean;
  doorLineY?: boolean;
  alwaysAvailable?: boolean;      // short-circuits ALL gates to live
}
```

**1b. `ConfigureOption`** (`:123-129`) — `showUnderLine` (R4) + `capabilities` (a pill may carry its own):

```diff
 export interface ConfigureOption {
   label: string | number;
   sku?: string;
   selected?: boolean;
   available?: boolean;
   crossedOut?: boolean;
+  showUnderLine?: number[];   // W/H pills only — lines this pill renders under (0 = "All"). R4
+  capabilities?: Capabilities; // present on some pills; otherwise gate on the refs-map target
 }
```

**1c. `ItemCard`** (`:172-193`) — the card's own caps (whole-card grey) + `variantCore` (Ty selection):

```diff
 export interface ItemCard {
   …
   familyId?: string;
   section?: string;
+  capabilities?: Capabilities; // whole-card GREY (R5)
+  variantCore?: string;        // Ty/option identity for the selected-pill test (R2)
+  heightClass?: number;        // face height class (73|80|86) — Ty/W swaps + LINE pre-select
+  heightCode?: number;         // R7 — the H-ROW key (73/80/86 on line families, cm height elsewhere)
 }
```

**1d. The refs row + attach `refs` to both list responses** (`:200-218`):

```diff
+/** A pill target resolved by ?refs=true (api-ui-map-v2 §2c-8). */
+export interface RefRow {
+  sku: string;
+  name?: string;
+  imageUrl?: string;
+  capabilities?: Capabilities;
+  variantCore?: string;
+  widthMm?: number;
+  heightClass?: number;
+  heightCode?: number;
+}
+
 export interface ItemsResponse {
   items: ItemCard[];
   types: number;
   unitTotal?: number;
   facets?: Facets;
+  refs?: Record<string, RefRow>;   // present when the query set refs=true
   pagination: Pagination;
 }
```
```diff
 export interface ItemsBySectionResponse {
   sections: SectionBucket[];
   types: number;
   unitTotal?: number;
   facets?: Facets;
+  refs?: Record<string, RefRow>;
   pagination: Pagination;
 }
```

**1e. `ItemsQuery`** (`:291-317`) — the parity params (backend already accepts all of these):

```diff
   depthClass?: number;
   heightMm?: number;
+  line?: string;          // TALL LINE filter (tall selector only) — NOT the "H 73/80/86" bar
+  tallHeight?: number;    // TALL dynamic-height filter (§6b)
+  variantCore?: string;   // Ty/option family swap (§2c-8)
+  heightCode?: number;    // R7 — H-pill family swap key (§2c-10). Exact, NOT null-inclusive.
+  grey?: boolean;         // grey-don't-hide: skip the depthClass hard-filter (§2c-6)
+  refs?: boolean;         // return the pill-target refs map (§2c-8)
   suspended?: boolean;
```

## Step 2 — new `src/views/design-book/data/caps.ts`

Pure functions, named exports — sibling of the (dead) `data/filter.ts`. Ports the app's `availableFromCaps`
verbatim from the §2c per-gate GREY table, plus the `showUnderLine` visibility and a `FilterState → toolbar`
adapter.

```ts
import { Capabilities } from "../api/types";
import { FilterState } from "../types";

/** The toolbar state the gates read. Only the controls this UI actually has are populated; the rest
 *  (handle / front / open / doorline) have no control yet, so those four gates stay inert. */
export interface Toolbar {
  progKeys: string[];              // selected programme ids
  tier: string;                    // ALL | P | A | C | P1 | C1
  depth: number | null;           // cm class, null = All
  antoso: boolean;                 // "Suspended"
  handle?: "std" | "V";
  front?: 0 | 1;
  open?: "" | "P1" | "C1";
  doorline?: "" | "J" | "Y";
}

export function toolbarFromFilters(f: FilterState): Toolbar {
  return {
    progKeys: f.prog ? [f.prog] : [],
    tier: f.tier,
    depth: typeof f.depth === "number" ? f.depth : null,
    antoso: f.susp,
    // handle / front / open / doorline: no control in this UI yet (out of scope).
  };
}

/** The line the toolbar's "H 73/80/86" seg selects, as a number — 0 == All (R4). */
export const lineNum = (line: FilterState["line"]): number =>
  line && line !== "ALL" ? Number(line) : 0;

/** R4 — is this W/H pill visible under the active line? */
export const showsUnderLine = (
  showUnderLine: number[] | undefined,
  line: number
): boolean => !showUnderLine || showUnderLine.includes(line);

/**
 * The 8-gate availability rule (api-ui-map-v2 §2c). `false` ⟹ render GREY.
 * available = alwaysAvailable || (progOk && tierOk && depthOk && handleOk && frontOk && openOk &&
 *             antosoOk && doorOk). Each gate reads the TARGET's caps + the toolbar.
 */
export function availableFromCaps(c: Capabilities | undefined, s: Toolbar): boolean {
  if (!c) return true;              // no caps → nothing to gate on
  if (c.alwaysAvailable) return true;

  // progOk — grey when a programme is picked and it's excluded (Full-E adds excludedProgramsE).
  const progOk =
    !s.progKeys.length ||
    s.progKeys.some((p) => !(c.excludedPrograms || []).includes(p));

  // tierOk — P/A/C: grey when the pick isn't the native tier but a real twin exists (app swaps to it).
  //          P1/C1: grey when this unit's opening variant isn't the pick.
  const tier = s.tier;
  let tierOk = true;
  if (tier && tier !== "ALL") {
    if (tier === "P1" || tier === "C1") tierOk = c.opening === tier;
    else if (tier !== c.nativeTier)
      tierOk = !(c.twinTiers || []).includes(tier);
  }

  // depthOk — 58 & 63 always pass; else the class must be in depthClasses.
  const d = s.depth;
  const depthOk =
    d == null || d === 58 || d === 63 || (c.depthClasses || []).includes(d);

  const handleOk = s.handle !== "V" || !!c.handleFree;
  const frontOk = s.front !== 1 || !!c.onePieceFront;
  const openOk =
    !s.open || !!c.singleHandle || (s.open === "P1" ? !!c.openP1 : !!c.openC1);
  const antosoOk = !s.antoso || !!c.antosoApproved;
  const doorOk =
    !s.doorline || (s.doorline === "J" ? !!c.doorLineJ : !!c.doorLineY);

  return (
    progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk
  );
}
```

**Self-check** (drop a `caps.test.ts` or a `__DEV__` assert): depth 68 with `depthClasses:[58]` →
`available:false`; depth 63 with the same → `true` (63 always passes); `alwaysAvailable:true` → `true`
regardless.

## Step 3 — `api/params.ts`

**The one deletion that fixes the "same section, different SKUs" bug (R1).**

```diff
   // Size pills.
   if (typeof f.width === "number") q.widthMm = f.width * 10;
-  if (f.line && f.line !== "ALL") q.heightClass = f.line;
+  // ⚠️ The "H 73/80/86" seg is the LINE selector — PRE-SELECT, never a server filter (§2c-7).
+  //    Sending heightClass here hard-filters membership AND collapses the face to the lowest width.
+  //    The line pick is consumed client-side: per-card re-face (use-card-swap) + row collapse (R4).
   // Exact height-class popover — the TALL dynamic-height row, a REAL filter (§6b).
   if (typeof f.height === "number") q.heightClassExact = f.height;
   if (typeof f.depth === "number") q.depthClass = f.depth;

   // Engineering — TOE-KICK "Suspended" toggle.
   if (f.susp) q.suspended = true;

+  // Grey-don't-hide: keep non-orderable depth faces visible; client greys via availableFromCaps (§2c-6).
+  if (f.greyDontHide) q.grey = true;
+  // Always ask for the pill-target caps/refs map so pills gate on their target (§2c-8).
+  q.refs = true;
+
   return q;
```

`toSearchParams` already serialises booleans (`grey=true`, `refs=true`) and repeats arrays, so no change
there.

## Step 4 — page refs map: `hooks/use-refs.tsx` (new) + wire in `index.tsx`

A tiny mutable context (not React state — merges must not re-render the tree; cards read it lazily on click).

```tsx
import React, { createContext, useContext, useRef } from "react";
import { RefRow } from "../api/types";

type RefsMap = Record<string, RefRow>;
const RefsCtx = createContext<{ get: () => RefsMap; merge: (r?: RefsMap) => void } | null>(null);

export const RefsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<RefsMap>({});
  const api = {
    get: () => ref.current,
    merge: (r?: RefsMap) => { if (r) Object.assign(ref.current, r); },
  };
  return <RefsCtx.Provider value={api}>{children}</RefsCtx.Provider>;
};

export const usePageRefs = () => {
  const ctx = useContext(RefsCtx);
  if (!ctx) throw new Error("usePageRefs outside RefsProvider");
  return ctx;
};
```

`index.tsx` — wrap the view (beside the existing `ClipboardProvider`, `:96`) and seed the map from each
list response (`:74`):

```diff
   const cards = itemsData?.items ?? [];
+  const pageRefs = usePageRefs();
+  useEffect(() => { pageRefs.merge(itemsData?.refs); }, [itemsData, pageRefs]);
```

(Move `DesignBookView`'s body into an inner component wrapped by `<RefsProvider>`, or add the provider in
the parent that renders `DesignBookView` — same pattern as `ClipboardProvider`.)

## Step 5 — family swap: `hooks/use-card-swap.ts` (new)

One hook the card uses instead of the raw `useItems({sku:[curSku]})`. It builds the **family-scoped** query
(R2), always requests `refs=true`, and merges the response's refs into the page map (R3).

```ts
import { useQuery } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import { validatedApi } from "@/services/api-request";
import { Envelope, ItemCard, ItemsResponse } from "../api/types";
import { toSearchParams } from "../api/params";
import { usePageRefs } from "./use-refs";

/** The face-defining query for a grid pill click. `null` = no swap (show the card as-is). */
export type SwapSpec =
  | { familyId: string; widthMm?: number; heightClass?: number; heightCode?: number; variantCore?: string }
  | null;

export function useCardSwap(spec: SwapSpec) {
  const pageRefs = usePageRefs();
  const qs =
    spec &&
    toSearchParams({
      familyId: spec.familyId,
      widthMm: spec.widthMm,
      heightClass: spec.heightClass,   // W/Ty swaps only — preserve the face's line
      heightCode: spec.heightCode,     // H pick (R7) — the H-row key, works on every family
      variantCore: spec.variantCore,
      groupBy: "family",
      limit: 1,
      refs: true,
    } as any);

  return useQuery<AxiosResponse<Envelope<ItemsResponse>>, unknown, ItemCard | undefined>({
    queryKey: ["design-book/swap", qs],
    queryFn: () => validatedApi.get(`/design-book/items?${qs}`),
    // Merge the swapped-in card's pill targets so its variant/greying keeps working (R3).
    select: (res) => {
      const data = res.data.data;
      pageRefs.merge(data.refs);
      return data.items?.[0];
    },
    enabled: !!spec,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
```

> **The retry order is per-row** — relax the dimension the user did NOT pick:
> * **H pick** → drop `widthMm`, then the height keys (the app switches width when the height exists only
>   at another one);
> * **W pick** → drop `heightCode`/`heightClass` FIRST, keep `widthMm` (the app's `pickHWidth` holds the
>   width); dropping the width instead just re-returns the card you were standing on;
> * **Ty pick** → drop `widthMm`, then the height keys.
>
> Encode it as a fallback chain in the click handler (build `SwapSpec`, on an empty result set a looser
> one), or give the hook an ordered list of key-sets to drop and take the first non-empty result.

## Step 6 — `components/unit-card.tsx`

**6a. `Chip` / `ChipRow` pass the option to the handler** (`:24-94`) — an all-self / detail-model row can't
be identified by sku alone. Widen; the programme row and any other callers keep working (extra arg ignored):

```diff
-  onPick: (sku: string) => void;
+  onPick: (sku: string, opt: ConfigureOption) => void;
```
```diff
       onClick={(e) => {
         e.stopPropagation();
-        if (opt.sku && opt.available !== false) onPick(opt.sku);
+        if (opt.sku && opt.available !== false) onPick(opt.sku, opt);
       }}
```

**6b. Imports** (`:1-7`):

```ts
import { useCardSwap, type SwapSpec } from "../hooks/use-card-swap";
import { usePageRefs } from "../hooks/use-refs";
import { availableFromCaps, showsUnderLine, lineNum, toolbarFromFilters } from "../data/caps";
```

The card needs the toolbar. `UnitCard` currently takes only `{card, isFav, toggleFav, onOpen}` (`:9-14`) —
**thread `filters` (or a prebuilt `toolbar` + `line`) down from `index.tsx` → `CatalogGrid` → `UnitCard`.**
Add `filters: FilterState` to `Props`.

**6c. Replace the sku-keyed swap with a spec-keyed family swap** (`:127-153`):

```diff
-  const [curSku, setCurSku] = useState(card.sku);
+  const [swap, setSwap] = useState<SwapSpec>(null); // null = showing the family's default face
   …
-  const { data: swap, isFetching } = useItems(
-    { sku: [curSku], full: true } as ItemsQuery,
-    curSku !== card.sku
-  );
-  useEffect(() => {
-    if (curSku === card.sku) { setDisplayed(card); return; }
-    const f = swap?.items?.[0];
-    if (f) setDisplayed({ ...card, ...f });
-  }, [swap, curSku, card]);
-  const loading = curSku !== card.sku && isFetching && swap?.items?.[0]?.sku !== curSku;
+  const { data: swapped, isFetching } = useCardSwap(swap);
+  useEffect(() => {
+    if (!swap) { setDisplayed(card); return; }
+    if (swapped) setDisplayed({ ...card, ...swapped });
+  }, [swap, swapped, card]);
+  useEffect(() => { setSwap(null); }, [card]); // new grid card → back to default face
+  const loading = !!swap && isFetching;
```

**6d. Toolbar + refs + click handlers** (after `const active = displayed`, `:153`):

```tsx
const toolbar = toolbarFromFilters(filters);
const line = lineNum(filters.line);
const pageRefs = usePageRefs();
const famId = card.familyId || card.sku;

// A pill greys on its TARGET's caps (from the page refs map), or its own if it carries them.
const pillAvail = (o: ConfigureOption) =>
  availableFromCaps(o.capabilities ?? pageRefs.get()[o.sku ?? ""]?.capabilities, toolbar);

// Keep the height by the card's OWN key — heightClass is null outside line families (R7), so carrying
// only it drops the constraint (T3027Z + W50 → T5093S7). Relax the HEIGHT first if nothing matches.
const pickWidth = (_sku: string, o: ConfigureOption) =>
  setSwap({ familyId: famId, widthMm: Number(o.label) * 10,
            heightCode: active.heightCode, heightClass: active.heightClass });
// R7: resolve by heightCode (73/80/86 on line families, cm height elsewhere), never heightClass —
// and never by o.sku, which is null whenever the current variant lacks that height.
const pickHeight = (_sku: string, o: ConfigureOption) =>
  setSwap({ familyId: famId, heightCode: Number(String(o.label).replace(/\D/g, "")), widthMm: active.widthMm });
const pickTy = (sku: string, o: ConfigureOption) => {
  const vc = pageRefs.get()[sku]?.variantCore;
  setSwap({ familyId: famId, variantCore: vc, heightCode: active.heightCode,
            heightClass: active.heightClass, widthMm: active.widthMm });
};
// Programme = fetchable tier codes; depth = v2.2 §2c-4 (for now, navigate).
const pickSku = (sku: string) => setSwap({ familyId: famId }); // …then re-face; or keep detail-open onOpen
```

> `pickWidth`/`pickHeight` set the **other** dimension from the current face so the swap preserves it
> (§2c-8). If the H swap comes back empty, re-issue without `widthMm` (see Step 5 note).

**6e. `showUnderLine` collapse + selected markers on the W/H/Ty rows** (`:277-292`):

```diff
-        <ChipRow label="H" opts={cfg?.height} onPick={setCurSku}
-          underlineFor={(o) => lineColor(Number(o.label))} />
-        <ChipRow label="W" opts={cfg?.width} onPick={setCurSku} />
-        <ChipRow label="D" opts={cfg?.depth} onPick={setCurSku} />
-        {(cfg?.optionRows || []).map((r, i) => (
-          <ChipRow key={`ty-${i}`} label={r.label || "Ty"} opts={r.options} onPick={setCurSku} />
-        ))}
+        <ChipRow
+          label="H"
+          opts={collapse(cfg?.height, line).map((o) => mark(o, o.selected ?? (hNum(o.label) === (active.heightCode ?? active.heightClass))))}
+          onPick={pickHeight}
+          underlineFor={(o) => lineColor(Number(o.label))}
+        />
+        <ChipRow
+          label="W"
+          opts={collapse(cfg?.width, line).map((o) => mark(o, o.selected ?? (Number(o.label) === (active.widthMm ?? 0) / 10)))}
+          onPick={pickWidth}
+        />
+        <ChipRow label="D" opts={cfg?.depth} onPick={pickSku /* v2.2 §2c-4 */} />
+        {(cfg?.optionRows || []).map((r, i) => (
+          <ChipRow key={`ty-${i}`} label={r.label || "Ty"}
+            opts={r.options.map((o) => mark(o, pageRefs.get()[o.sku ?? ""]?.variantCore === active.variantCore))}
+            onPick={pickTy} />
+        ))}
```

with two small local helpers (module scope):

```tsx
/** R7 — pill labels are "H42" / "42"; compare against heightCode. */
const hNum = (l: string | number) => Number(String(l).replace(/\D/g, ""));
/** R4 — keep only pills that render under the active line. */
const collapse = (opts: ConfigureOption[] | undefined, line: number) =>
  (opts ?? []).filter((o) => showsUnderLine(o.showUnderLine, line));
/** re-stamp `selected` and fold caps-greying into `available` for the Chip. */
const mark = (o: ConfigureOption, selected: boolean): ConfigureOption => ({ ...o, selected });
```

**6f. Per-pill grey — fold caps into the `Chip` disabled test** (`:37`):

```diff
-  const disabled = !opt.sku || opt.available === false;
+  const disabled = !opt.sku || opt.available === false || opt.available === undefined && opt.__grey === true;
```

Simpler and cleaner: precompute in the row map — `mark(o, sel)` above becomes
`{ ...o, selected: sel, available: o.available !== false && pillAvail(o) }`, and `Chip` needs no change
(it already greys on `available === false`). Use whichever reads better in your codebase; **the rule is
`available && !crossedOut && availableFromCaps(target.caps)`**.

⚠️ **On the W/H rows a missing `opt.sku` must NOT disable the chip** (R7) — those rows are resolved by
LABEL through the family. `Chip`'s `disabled = !opt.sku || …` (`:37`) is correct for the programme/options
rows and for the drawer, so pass a flag (or use a `ChipRow` variant) that drops the `!opt.sku` term for
W and H. Same for the click guard at `:44-48`: `if (opt.available !== false) onPick(opt.sku ?? "", opt)`.

**6g. Whole-card grey (R5).** When `grey=true` brought back a non-orderable card, dim it (still openable):

```diff
-    <div className="relative mb-3.5 flex break-inside-avoid flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white …">
+    <div className={clsx(
+      "relative mb-3.5 flex break-inside-avoid flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white …",
+      !availableFromCaps(active.capabilities, toolbar) && "opacity-40 grayscale"
+    )}>
```

**Do NOT touch `:265`** (`{active.sku}` code display) or `:179`/`:304` (copy of `active.sku`) — that's
v2.2's order-code territory; here the sku is still the code.

**6h. Programme row** (`:318-330`) stays `onPick={setCurSku}` → in the new world `onPick={pickSku}` (tier
codes are fetchable). Its selected test is unchanged (`pill.sku === card.sku`).

## Step 7 — sections: `components/catalog-grid.tsx` + `index.tsx`

Switch the grid data source from flat `useItems` to `useItemsBySection` and render `sections[]` **verbatim**
(R6). `catalog-grid.tsx` currently rebuilds section headers from a flat `items[]` (`:35-61`) — replace that
with a straight map over pre-bucketed, pre-ordered sections.

`index.tsx` (`:60-78`):

```diff
-  const { data: itemsData, isLoading: itemsLoading, error: itemsError } = useItems(itemsQuery, gridEnabled);
-  const cards = itemsData?.items ?? [];
+  const { data: itemsData, isLoading: itemsLoading, error: itemsError } =
+    useItemsBySection(itemsQuery, gridEnabled);
+  const sections = itemsData?.sections ?? [];
   const heights = itemsData?.facets?.heightClasses ?? [];
   const unitTotal = itemsData?.unitTotal ?? 0;
   const typeCount = itemsData?.types ?? itemsData?.pagination?.total ?? 0;
-  const hasMore = (itemsData?.pagination?.total ?? 0) > cards.length;
+  const shown = sections.reduce((n, s) => n + s.cards.length, 0);
+  const hasMore = (itemsData?.pagination?.total ?? 0) > shown;
```
```diff
-                  <CatalogGrid cards={cards} … />
+                  <CatalogGrid sections={sections} filters={filters} … />
```

`catalog-grid.tsx` — take `sections: SectionBucket[]` + `filters`, render each bucket's header (skip a
leading `section:""` — it's a header-suppressed lone card that already belongs to the prior page's run) then
its cards, **in order, no client sort/bucket**:

```tsx
{sections.map((s) => (
  <React.Fragment key={s.section || "_"}>
    {s.section && <SectionHeader label={s.section} count={s.count} />}
    {s.cards.map((card) => (
      <UnitCard key={card.familyId || card.sku} card={card} filters={filters}
                isFav={isFav} toggleFav={toggleFav} onOpen={onOpen} />
    ))}
  </React.Fragment>
))}
```

Infinite scroll: on "show more", merge the next page's `sections[]` into the current list **by `section`**
(a lone card can arrive `section:""` at a page edge and gain a header next page — R6).

## Step 8 — `components/detail-panel.tsx`

**Leave the drawer's pill navigation on `pill.sku`** — the stored d68 targets ARE the app's detail
behaviour there (§2c-8). `CfgChip`'s `onClick={() => opt.sku && onOpen(opt.sku)}` (`:28`) is correct;
**do not** family-swap it.

Optional (drawer parity, not required for the grid fix): apply the same `showUnderLine` collapse (R4) and
per-pill caps greying (R5, via `?expand=all`'s `refs`) to the drawer's Width/Height rows. The detail
response already projects `capabilities` on the item and `refs` on expand. Ship it only if the drawer's W/H
rows visibly diverge from the app; otherwise defer.

---

# Check

| # | Do | Expect |
|---|---|---|
| 1 | Sink Cabinets, no filters | grid loads via `items/by-section`; sections in catalog order (Units → …Drawers → …Trash Pullout → Instant Hot → without-drill), **not alphabetical** |
| 2 | W = 50, Sink Cabinets | 14 families; **5** cards under "Sink Units with Trash Pullout" (the lone `TSPQ9073BTZW` merged in, no "Instant Hot" header) |
| 3 | Devtools on the W50 grid request | query has **`widthMm=500`**, **no** `heightClass`, **`refs=true`** |
| 4 | H bar → 73 (Base) | cards re-face to `…73…` (via family swap), W/H rows collapse (`showUnderLine`), **membership unchanged** — same card count as All |
| 5 | Devtools on the H-73 grid request | **no `heightClass` / `line`** param on the grid list; re-facing is per-card `familyId&heightCode=73&groupBy=family` swaps |
| 6 | Click a W pill on a d58 card | swaps to the **native-depth** width sibling (`TSP6073`), **not** the `…68…` detail target; other dims preserved |
| 7 | Click a Ty pill (`TSPA8073TZW` → `TZ`) | swaps to `TSPA9073TZ` (native depth); the picked Ty shows **selected** (variantCore match) |
| 8 | `Grey, don't hide` ON, D = 68 on a 58-only family | the card stays **visible + greyed** (opacity), face still the 58 unit; toggle OFF → it disappears |
| 9 | Pick a programme that excludes some pills | those pills grey (target-caps `excludedPrograms`); no extra network call (refs already on the page) |
| 10 | Open the detail drawer, click a W pill | navigates by `pill.sku` (unchanged) — drawer is exempt from the grid swap rule |
| 11 | Screenshot diff vs the app | compare **card face sku + row shape**, ignore the toolbar chip highlight (stale-highlight trap) |
| 12 | BOSSA · Tall→Water→Dishwasher · D58 (R7) | `HGA6029BK` shows `H 29* 34 42 47 74 79 87 92 100 105 113 118` — **all live, none greyed/disabled**; `HGSP55103Z` shows `103* 109 116 122 204 217` |
| 13 | Click `H42` on that card | swaps to **`HGA6042`** via `familyId&heightCode=42` (not `HGAG6042`, not a 400); `H204` on the tall card → `HGSP552047Z` |
| 14 | Line family regression (`TSP6080B`, H73) | still `TSP6073B` — `heightCode` returns the same unit `heightClass` did |
| 15 | W pick on a cm-height family (`T3027Z` → W 50) | **`T5027Z`** — height 27 preserved. `T5093S7` means the swap carried only `heightClass` (null there) and lost the height (R7) |

Ground truth: `d4k-items-extraction/docs/design-book-api-ui-map-v2.md` — **§2c-5** (`showUnderLine`),
**§2c-6** (grey-don't-hide), **§2c-7** (LINE bar = pre-select), **§2c-8** (grid W/H/Ty swap + refs map),
**§2c-9** (W membership + face tier-pool), **§2c-10** (`heightCode` + H pills are never dead),
**§2b** (section order + header merge), and the **§2c per-gate GREY table** (the 8 gates ported in
`data/caps.ts`).
