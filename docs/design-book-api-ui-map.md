# design-book-api-ui-map.md

**API ↔ UI parameter map** — every `design-book` endpoint's parameters (request + response) mapped
side-by-side to the UI element it drives and where that element sits on screen.

- Base path: `/design-book` · all endpoints JWT-guarded (`Authorization: Bearer <token>`).
- **Dir**: `IN` = request param (query / path / body) · `OUT` = response field the UI renders.
- **UI location** uses the app vocabulary (see project `CLAUDE.md` → "UI vocabulary").
- **Sample call**: a concrete request exercising that row. `…` = `/design-book`; every call needs
  `-H "Authorization: Bearer <token>"` (omitted for brevity). IN rows show the param in use;
  OUT rows show the call whose response carries that field.
- Source: `D4K-backend/src/design-book/` (controller · service · `dto/query-items.dto.ts` · item schema)
  and the contract `docs/export-schema.ts`.

Endpoints: `POST ingest` · `GET items` · `GET items/by-section` · `GET items/:sku` · `GET programs` ·
`GET categories` · `GET functional-categories` · `GET tall-heights` · `GET home` · `GET meta` · `GET stats`.

---

## 1. `POST /design-book/ingest` — sync the catalog export (admin only)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `file` (multipart) | IN | Catalog-export upload control | Admin · Catalog import (not customer UI) | `curl -F file=@docs/export-v767.json …/ingest` |
| `summary.items` / `programmes` / `categories` | OUT | Import result counts | Admin · import result toast/log | `POST …/ingest` → `summary.items` |
| `summary.catalogVersion` / `schemaVersion` | OUT | Version line of the import | Admin · import result | `POST …/ingest` → `summary.catalogVersion` |

---

## 2. `GET /design-book/items` — grid / card list

*The grid filter bar (all in `GET items` request table below). Left→right: **PROGRAMME dropdown**
("No programme · point range" — sets the card **`pts`** price via `priceProgram`, not a grid filter) ·
**Mix** button (UI-only) · **W** row
(`widthMm`, cm×10) · **H** row (`heightClass` 73/80/86) · **GREY, DON'T HIDE** toggle (UI-only) ·
**D** row (`depthClass` — nominal cm class 36/48/58/63/68, NOT `depthMm`).*

### Request (filters → UI controls)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `page`, `limit` | IN | Grid pager | Grid footer | `…/items?page=2&limit=50` |
| `q` | IN | "Search by Code" box (free-text **partial** match on sku / name) | Landing / top search | `…/items?q=TK6080` |
| `sku[]` | IN | **Exact SKU** filter — one or more order codes (repeat or comma-separate; upper-cased; `$in`) | (precise lookup — copied ⧉ code, deep link, "my list" batch) | `…/items?sku=TK6080BZ2,TK7080BZ2` |
| `category` | IN | Category pick | Left sidebar — type taxonomy (Base / Tall / Wall / Midway …) | `…/items?category=Base` |
| `subcategory` | IN | Sub-category pick | Left sidebar — nested under category (Water / Cooling / …) | `…/items?category=Base&subcategory=Sinks` |
| `section` | IN | On-page section header | Grid section divider | `…/items?section=Cooktops` |
| `familyId` | IN | Sibling-code group | (internal — client groups cards by family) | `…/items?familyId=F333` |
| `leafId` | IN | "Design Tasks" **leaf** | Left "Design Tasks" sidebar (e.g. Water → Dishwasher Fronts) | `…/items?leafId=b_water%232` |
| `groupKey` | IN | "Design Tasks" **group** ("All Base Water") | Left "Design Tasks" sidebar — group row | `…/items?groupKey=b_water` |
| `zone` | IN | "Design Tasks" **zone** | Left "Design Tasks" sidebar — zone header (Base/Tall/Wall/Midway) | `…/items?zone=Base` |
| `kind` | IN | Item-type filter (cabinet/alteration/accessory/part) | (filter) | `…/items?kind=accessory` |
| `family` | IN | **PROGRAMME tab** (All / Primo / Avance / Contino) — maps to tiers (Primo→P/P1, Contino→C/C1, Avance→A) | Top toolbar — "PROGRAMME" tab group | `…/items?family=Contino` |
| `programs[]` | IN | **PROGRAMME picker multi-select** (array of programme ids/names; union of their tiers). **Also drives configure PILL STATE** — without it every pill returns `available:true` and nothing strikes (§2c) | "Programme for Base units" modal (Step 1 of 4) — highlighted chips | `…/items?programs=AVENIDA&programs=BONDI-A` |
| `priceProgram` | IN | **PROGRAMME dropdown** (single id/name) — the programme to **PRICE** cards in; each item's `pts` (the "951 pts" / "290 HLP" pill number) is computed for it. **Not a grid filter** (doesn't change which cards return). Falls back to the sole `programs` entry when exactly one is selected; no programme → no `pts` ("point range") | Top toolbar — Programme SELECT DROPDOWN | `…/items?priceProgram=BOSSA` |
| `tier` | IN | **FRONTS pill** (P·P1·A·C·C1) | Top toolbar — "FRONTS" pill group | `…/items?tier=P1` |
| `opening` | IN | **OPENING toggle** (P1 \| C1) — the "one handle on top" opening variant (P1=Primo, C1=Contino). Keeps fronts orderable in that variant (`availableTiers ∋ P1/C1`). AND-composes with `tier`/`family` | Top toolbar — "OPENING" pill (right of the programme tiers) | `…/items?opening=P1` |
| `widthMm` | IN | **W pill** (cm×10 → mm) | Grid filter bar — W row (15·20·30·…·Corner) | `…/items?widthMm=600` |
| `heightClass` | IN | **H pill** (73·80·86 — coarse bucket, not `heightMm`) | Grid filter bar — H row | `…/items?heightClass=80` |
| `depthClass` | IN | **D pill** — nominal depth CLASS in cm (36·48·58·63·68), NOT exact mm. Matches a unit when the class is among its available depths (`configure.depth[].label` — native OR a depth alteration, incl. the 63 cm alteration). Carcass = class×10−20 (58 ⇒ 560 mm). Mirror of `heightClass`. | Grid filter bar — D row | `…/items?depthClass=58` |
| `depthMm` | IN | Exact carcass depth (mm) — precise match, **not** the grid D row (that row is a class → use `depthClass`) | (precise filter) | `…/items?depthMm=560` |
| `heightMm` | IN | Exact carcass height (mm) — not a bar pill | (precise filter) | `…/items?heightMm=792` |
| `line` | IN | **TALL LINE pill** (73·80·86) — carcase LINE / height-system. **TALL only.** Picks which system the HEIGHT row draws from (80 → {146,190,204,217}; 73 & 86 → {153,197,210,224}) and filters the grid to it. Distinct from `heightClass` (also 73/80/86 but the coarse BASE bucket). Options + system from `GET tall-heights` (§6b) | Tall toolbar — **top pill row** | `…/items?zone=Tall&line=80` |
| `tallHeight` | IN | **TALL HEIGHT pill** — the chosen carcase height in cm (146·153·190·197·204·210·217·224). **TALL only.** Matches units whose height snaps to it (from `heightMm`, ±8 mm). Offered values are dynamic per leaf+line → get them from `GET tall-heights` (§6b) | Tall toolbar — **second (dynamic) pill row** | `…/items?leafId=t_water%230&tallHeight=204` |
| `suspended` | IN | **TOE-KICK "Suspended" toggle** (engineering `suspended`, ok=true) | Top toolbar — TOE-KICK H · Suspended | `…/items?suspended=true` |
| `active` | IN | Active-only flag | Admin | `…/items?active=true` |
| `groupBy=family` | IN | **Grid card grouping** — one card per family ("N types"); pages by family, not unit | Grid — the card grid itself (each card = a "type") | `…/items?leafId=b_cool%230&groupBy=family` |
| `full` | IN | Include full detail blobs | (dev / debug flag) | `…/items?q=T6073VE&full=true` |

> **availableTiers precedence** (one filter, most-specific wins): `tier` (FRONTS pill) → `programs[]` (picker) → `family` (tab).
> Grid is **tier-granular**: item↔programme links only by tier, so two same-tier programmes collapse to one tier.
> The toolbar's **P · A · C · C-12** group (right of the programme name) = the PROGRAMME-family tabs → `family`
> (Primo/Avance/Contino; **Contino-12 folds into Contino** — same tiers C/C1, no separate grid filter).
> **OPENING** (P1/C1) is an INDEPENDENT toggle → `opening`, ANDed on top of the above (own `$and` clause), since
> P1/C1 fronts are their own tier records (`availableTiers:["P1"]`) — so `opening=P1` and `tier=P1` select the same
> 1091 fronts, and `tier=C & opening=P1` = ∅ (C and P1 fronts are disjoint records — as in the app).
> Bar controls that are NOT grid filters: PROGRAMME dropdown (sets the card `pts` price via **`priceProgram`** — a
> pricing param, not a filter; "No programme" → no `pts`). Pure UI/display state (no param at all): TOE-KICK
> slider (cm), the ⇄ mm/inch converter box, "GREY, DON'T HIDE" toggle, "Mix" button, "Corner" width pill.
> Combine freely: `…/items?category=Base&heightClass=80&depthClass=58&suspended=true&tier=P&page=1&limit=50`
>
> **D pill = depth CLASS, not mm.** The D row (36·48·58·63·68) is a NOMINAL cm class, not the exact carcass
> `depthMm` (class = carcass_cm + 2, so 58 ⇒ 560 mm carcass). Filter with **`depthClass`** — it matches a unit
> whose available depths (`configure.depth[].label`, native OR alteration incl. the 63 cm alteration) contain the
> class; `depthMm` stays an exact-mm filter. Raw `depthMm` is NOT a class signal (a "68" shelf can store
> `depthMm` 610). Backend: `depthClass=C` → `configure.depth.label == String(C)` **OR** (no depth options AND
> `depthMm == C*10−20`). Direct mirror of `heightClass` (the H pill). The old `depthMm=cm×10` sent by the D row
> matched almost nothing (carcass is 20 mm shallower) — fixed 2026-07-10.
>
> **Tall two-row height selector (`line` + `tallHeight`).** TALL units show TWO stacked pill rows the other
> zones don't: a static **LINE** row (73·80·86) and a **dynamic HEIGHT** row (e.g. 190·204·217). LINE picks the
> carcase-height SYSTEM (80 → {146,190,204,217}; 73 & 86 → {153,197,210,224}; Avance locks to 80); HEIGHT lists
> only the carcase heights actually present in the visible leaf, narrowed to the line — so **every leaf shows its
> own set** (Dishwasher → {204,217}; Washing Machine → {190,204,217}). The values are NOT stored: a unit's tall
> carcase height is derived by snapping `heightMm` to the nearest known height (±8 mm) — the app's `tallHC`. Get the
> two rows from **`GET tall-heights` (§6b)**, then feed the picks back here as **`line`** / **`tallHeight`**. NOT the
> same as the BASE H pill `heightClass` (also 73/80/86 but a stored coarse bucket, base only). Added 2026-07-14.
>
> **Grid is card = family, not unit.** Default (no `groupBy`) returns one row per UNIT (sku); the grid
> shows one card per FAMILY ("type"). Leaf `b_cool#0` = **75 units → 4 cards**; Base zone = 7208 units /
> 351 types. Use `groupBy=family` so pagination lines up with the card grid. The face (card) unit = the
> family's base-tier match (P > P1 > C > C1 > A, then smallest dims); it **follows the active `tier`
> filter** (e.g. `tier=C` → the C-tier face). `availableTiers` on a grouped card is the family-wide union
> (drives "Compatible: P · C").
>
> **Two grouping levels.** Cards (families) are additionally grouped under `section` headers ("COOKTOP
> UNITS", "COOKTOP UNIT WITH DRAWERS"). Grouped `items` come section-sorted and each carries `section` →
> the client renders a header whenever it changes. Verified: leaf `b_cook#0` = 8 families → 5 cards under
> "Cooktop Units" + 3 under "Cooktop Unit with Drawers". Caveat: **section order, card order within a
> section, and the exact face unit are best-effort** — the v767 export didn't capture the app's
> presentation order or each family's default unit (would need a re-extract; see `familyFace` / `gridOrder`
> in `export-schema.ts`).

### Response (per-card fields → card slots)

*One card (`TK6080BZ2`). Top-left = `cardLabel` ("Cooktop Unit") · top-right = `programmeBadge`
("ALL") · image area = `imageUrl` · title = `name` · `sku` + dims line (`widthMm`/`heightMm`) ·
**H/W/D** pill rows = `configure.height`/`.width`/`.depth` (filled = `selected`) · bottom-left ♥/⧉
= UI-only fav/copy · bottom-right `P · P1 · C · C1 · A` = `availableTiers` (filled = orderable) ·
**bottom-right price pill "951 pts" / "290 HLP"** = `pts` (number, present only when a programme is
priced) + `priceUnit` (the pts/HLP unit label).*

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `sku` | OUT | Order code + Copy (⧉) button | Card — under title / bottom-left ⧉ | `…/items?limit=1` → `items[0].sku` |
| `name` | OUT | Card title | Card — title line | `…/items` → `items[].name` |
| `nameQualifier` | OUT | **Amber sub-label after the title** ("Mid 45 cm deep" · "Top 45 cm deep" · "Mid drawer 30 cm deep" · "loose without drill holes") | Card — right of title | `…/items?q=TSP6080BZ2` → `items[].nameQualifier` |
| `handedLR` | OUT | **"L/R" badge** (available left OR right hinged — state hinge side on order; drawing shows Left) | Card — right of title | `…/items?q=TSP6080` → `items[].handedLR` |
| `cardLabel` | OUT | Small card label | Card — **top-left** ("Front" / "Built-in DW door") | `…/items` → `items[].cardLabel` |
| `programmeBadge` | OUT | Programme summary chip | Card — **top-right** (P / ALL / P·A) | `…/items` → `items[].programmeBadge` |
| `availableTiers[]` | OUT | FRONTS tier badges | Card — **bottom-right** (P · P1 · C1) | `…/items` → `items[].availableTiers` |
| `pts` | OUT | **Price pill NUMBER "951"** — the card point value for the priced programme (`priceProgram`, or a sole `programs`). `ceil(book/100)` over the programme's finish column. **Absent** when no programme is priced (app shows "point range"). Its UNIT label = `priceUnit` (next row) | Card — **bottom-right**, grey/green pill | `…/items?sku=GFVK8080SZ2M&priceProgram=BOSSA` → `items[].pts` (= 1134) |
| `priceUnit` | OUT | **Price-pill UNIT label** — "pts" (account points) vs **"HLP"** (dealer-list, IDM calc groups 15/38/61; the book number is already a currency list price). Per-item, **always present** (independent of `pts`/programme). Ports the app's `priceClass` | Card — **bottom-right**, the small unit inside the pill | `…/items?q=EBF10058` → `items[].priceUnit` (= "HLP") |
| `imageUrl` | OUT | Product image (built from `meta.imageUrlTemplate`) | Card — image area | `…/items` → `items[].imageUrl` |
| `widthMm` / `heightMm` / `depthMm` | OUT | Dims line ("W 800 mm · H 792 mm") | Card — under title | `…/items` → `items[].widthMm` |
| `configure.width[]` | OUT | **W** pill row | Card — Configure rows | `…/items?full=true` → `items[].configure.width` |
| `configure.height[]` | OUT | **H** pill row (73 / 80 / 86) | Card — Configure rows | `…/items?full=true` → `items[].configure.height` |
| `configure.depth[]` | OUT | **D** pill row (incl. "63 cm alteration"). Its `label`s are the nominal depth **classes** (58/63/68…) the top-bar `depthClass` filter matches against | Card — Configure rows | `…/items?full=true` → `items[].configure.depth` |
| `configure.programme[]` | OUT | Programme / tier pills (P · P1 · C1) | Card — **bottom-right** | `…/items?full=true` → `items[].configure.programme` |
| `configure.optionRows[]` | OUT | Coded rows — **Ty** / Mode / Config (Z2XM · Z3M · ~~S2ZM~~) | Card — Configure rows | `…/items?full=true` → `items[].configure.optionRows` |
| `configure.*[].selected` / `.available` | OUT | Highlighted vs **struck/greyed** pill — `available:false` = not orderable here. **Full state rules → §2c** | Card — pill state | `…/items?full=true` → `…configure.width[].available` |
| `configure.*[].programmeExcluded` | OUT | **Response-only** (never stored) — set with `available:false` when the pill's target unit is not orderable in the sent `programs`. Drives the "Not available with the selected programme" tooltip. **Absent unless `programs` is sent** → §2c | Card — pill state (struck) | `…/items?sku=T6080&full=true&programs=BOSSA` → `configure.width[0].programmeExcluded` (= true) |
| `configure.*[].crossedOut` | OUT | **RESERVED — never emitted** (0 / 256,937 pills; the extractor reads the detail panel, which greys rather than strikes). Treat a struck pill as `available:false`; handle defensively only. → §2c | Card — pill state | *(no live example — field is never present)* |
| `configure.*[].sku` | OUT | Pill target (click → opens that item). `null` = no target code → pill is inert (§2c) | Card — pill navigation | `…/items?full=true` → `…configure.width[].sku` |
| `appliance` | OUT | Appliances icon → **Appliances popup** (brand · category · subcategory · nicheSize) | Card — **bottom-left** (appliance fronts only) | `…/items?full=true` → `items[].appliance` |
| `sinkFitment.maxSinkSizeInch` | OUT | **"Max Sink Size: NN″" line** | Card — bottom row (Base/Sinks cards, `showOnCard`) | `…/items?q=TSP6080BZ2` → `items[].sinkFitment.maxSinkSizeInch` |
| `sinkFitment` (`cabinetWidthCm` · `customAboveInch` · `isDoor` · `notes[]`) | OUT | **"+ Add Sink" popup** — width, max bowl size, fitment rules | Card — **bottom-right** "+ Add Sink" button → popup | `…/items?full=true&q=TSP6080BZ2` → `items[].sinkFitment` |
| `inspiration.imageUrl` | OUT | **Inspiration-photo lightbox** — the full lifestyle render loaded on click | Card — **camera icon top-left** → popup image | `…/items?q=AGFV6080` → `items[].inspiration.imageUrl` |
| `inspiration` (`caption` · `heading` · `fullScreen`) | OUT | Popup caption sentence (`caption`) + bold code/dims line (`heading`) + "View full screen" flag | Card — camera-icon → **lightbox popup** caption | `…/items?q=AGFV6080` → `items[].inspiration.caption` |
| `types` | OUT | **"N types" count** (distinct families in the filtered set) | Grid — header ("4 types") | `…/items?leafId=b_cool%230` → `types` |
| `unitCount` | OUT | Units collapsed into the card (grouped mode only) | Card — (variant count) | `…/items?leafId=b_cool%230&groupBy=family` → `items[].unitCount` |
| `memberSkus[]` | OUT | Every code in the family (grouped mode) — resolves the card's pills | Card — Configure pill targets | `…?groupBy=family` → `items[].memberSkus` |
| `familyId` | OUT | The family the card represents (grouped mode) | Card — (grouping key) | `…?groupBy=family` → `items[].familyId` |
| `section` | OUT | **Grid section header** (cards are stacked under it) | Grid — section divider ("COOKTOP UNITS" · "COOKTOP UNIT WITH DRAWERS") | `…/items?leafId=b_cook%230&groupBy=family` → `items[].section` |
| `pagination.total` / `page` / `pages` | OUT | Pager counts (grouped: **total = family count**) | Grid footer | `…/items` → `pagination.total` |

---

## 2b. `GET /design-book/items/by-section` — grid, PRE-grouped by section header

Same grid as `GET items`, but the response is already bucketed into the on-screen **section headers**
the app stacks cards under ("APPLIANCE FRONTS · DW (CENTER HANDLE)", "FRONT FOR DISHWASHER APPLIANCES ·
ORIGINAL HANDLE D61"). Cards are **families** (same collapse as `groupBy=family`). It accepts **every**
`GET items` filter (row-for-row identical to §2 request table: `leafId` / `groupKey` / `zone` /
`category` / `subcategory` / `section` / `tier` / `opening` / `family` / `programs[]` / `priceProgram` /
`widthMm` / `heightClass` / `depthClass` / `line` / `tallHeight` / `kind` / `q` / `full` / `page` / `limit`). Use it
instead of `GET items?groupBy=family` when you want the server to do the section bucketing.

### Response (envelope → UI)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `sections[].section` | OUT | **Section header** text | Grid — section divider | `…/items/by-section?leafId=b_water%232` → `sections[].section` |
| `sections[].count` | OUT | Cards in that section | Grid — (per-section count) | `…/items/by-section?leafId=b_water%232` → `sections[].count` |
| `sections[].cards[]` | OUT | The family cards under that header (same shape as §2 `items[]`) | Grid — cards stacked below the header | `…/items/by-section?leafId=b_water%232` → `sections[].cards` |
| `types` | OUT | **"N types" count** (total families across all sections) | Grid — header | `…/items/by-section?leafId=b_water%232` → `types` |
| `pagination.total` / `page` / `pages` | OUT | Pager (**total = family/card count**) | Grid footer | `…/items/by-section?leafId=b_water%232` → `pagination.total` |

> **Cards are families**, identical to `groupBy=family` (see §2's "card = family" + face-unit notes) —
> each `cards[]` entry carries `familyId` / `unitCount` / `memberSkus[]` / family-wide `availableTiers`.
> **Card/popup annotations flow through** (from the face unit's own item doc): `nameQualifier`,
> `handedLR`, `sinkFitment` (Max Sink Size / + Add Sink), `appliance` (Appliances popup),
> `inspiration` (camera-icon lightbox), and the **`pts` price pill** (number when `priceProgram` / a sole
> `programs` is set; unit `priceUnit` always) all appear on `cards[]` where set — same shape as §2 `items[]`.
> **Configure PILL STATE flows through too** — send `programs` and each card's `configure` pills come back
> `available:false` + `programmeExcluded` where the target is not orderable (§2c). This is the endpoint the
> grid calls, so **it is the one that must carry `programs`** or no card pill will ever strike.
> **The WHOLE-CARD grey is a separate thing (§2e)** — a programme-excluded card is never dropped from the
> grid, it renders greyed + "not available". It needs `programmeAvailability`, which is **not** in the
> default card projection: pass `full=true`.
> Verified on `subcategory=Sinks` (18/25 cards carry
> `sinkFitment`) and `subcategory=Appliance housing` (`GFVK8073SM` → Gaggenau · Dishwashers · Built-In ADA · 24").
> **Paging is by family (card), not by section**: the page's cards are section-sorted then bucketed, so a
> section straddling a page boundary appears (partially) on **both** pages — the client merges buckets by
> `section` on scroll. Same best-effort ordering caveat as §2 (v767 export didn't capture the app's
> section / card order). Verified: `leafId=b_water#2` → 19 families → 6 section buckets ("Appliance
> Fronts · DW (center handle)" = 5 cards, "Front for Dishwasher Appliances · Original handle D61" = 3).

---

## 2c. Pill state — rendering DISABLED / STRUCK configure pills

How the client decides that a W / H / D / Programme / coded-row pill is greyed, struck, or dead.
Applies identically to every configure option in **§2** (`items[].configure`), **§2b**
(`sections[].cards[].configure`) and **§3** (`item.configure`) — same three fields everywhere:

- `available` — **stored** (export). The pill's baseline state.
- `sku` — **stored**. The pill's target unit; `null` = no target code exists.
- `programmeExcluded` — **response-only annotation**, added by the backend when `programs` is sent.
  Never stored, never in the export.

### The three states

| `available` | `sku` | Meaning | Render | Clickable? |
|---|---|---|---|---|
| `true` | set | Orderable | normal | **yes** → opens that sku |
| `false` | set | Not orderable in the selected programme (**always** carries `programmeExcluded`) | **grid: struck** · **detail: greyed** | **yes** → still opens the sibling |
| `false` | `null` | No target code at all | greyed / dead | no |

> **The middle state is QUERY-TIME ONLY.** In the stored export it does not occur: every pill with a
> `sku` is `available:true` and every `available:false` pill has `sku:null` (verified against the live
> app 2026-07-15 — at the app's default toolbar state, every chip with a target renders live and every
> not-live chip has no target). So `available:false && sku` can only mean *"the backend turned this off
> for the programme you sent"*. Distribution in v781 below.
>
> This was **not** true before 2026-07-15: the export carried 11,013 fabricated `available:false`+sku
> pills from an extractor bug that froze the D toolbar filter into the data. If you see that state
> without `programmeExcluded`, the ingested export predates the fix.

> **Struck ≠ disabled.** The app's greyed-out chip keeps its handler —
> `<button class="wchip ${ok?'':'wn'}" … onclick="…;pickHeight('${b.id}',${hh})">`. Clicking a struck
> pill navigates to the sibling unit. Only the `sku:null` state is inert.

### Strike vs grey is a SURFACE, not a field

Both come from the app's single `available(u)` gate, rendered by two different renderers:

| Surface | App markup | Result |
|---|---|---|
| Grid card (`renderGrid`) | `.wchip.wn { opacity:.32; text-decoration:line-through }` | **struck** |
| Detail panel (`openDetail` → `.cfgsec`) | `.chip` + inline `style="opacity:.4"` | **greyed** |

So the client picks strike-or-grey **by which surface it is drawing**, never by a data field. The
user-reported "struck W pills on the floor-unit card" and a greyed W chip in that same unit's detail
panel are *the same `available:false`*.

### ⚠️ `crossedOut` is RESERVED — never emitted

`ConfigOption.crossedOut` is defined in `export-schema.ts` but is set **0 times out of 256,937
pills** in both v767 and v781. This is structural, not an oversight: the extractor's `chipCrossed()`
scrapes `#pin` — the **detail panel** — and the detail panel only ever greys (`opacity:.4`). The
strike exists solely in the grid renderer, which the extractor never reads. `crossedOut` therefore
cannot be produced by the current pipeline.

**Do not branch on it.** Treat a struck pill as `available:false`. Handle `crossedOut` defensively
(if truthy → struck + inert) only so a future export can't break the client. Open decision: either
drop the field from the schema or teach the extractor to read the grid — it is dead weight today.

### ⚠️ The client MUST send `programs` — or nothing strikes

The export's `available` is the **no-programme baseline**: extraction runs with `state.prog = null`,
where the app's `progOk` half passes everything. The programme half is resolved **at query time** by
`annotateProgrammeExclusions` (`design-book.service.ts`), which reads each pill target's own
`programmeAvailability` — exactly what the app's `progOk` does. It only ever turns a pill **off**,
never back on.

**No `programs` param → every pill comes back `available:true` → no strikes.** This was a real bug in
the lite reference UI: the API was correct, the grid sent no `programs`, and the card rendered clean.

Worked example — the reported case, `T6080` "Floor unit" under **BOSSA**:

```bash
# Baseline — no programme. ALL 12 width pills come back available:true (15 and 20 included).
…/items?sku=T6080&full=true
#   → configure.width[0] = {"label":"15","sku":"T1580","available":true}

# With the programme. T1580 / T2080 list 100 of 120 programmes and BOSSA is not among them:
…/items?sku=T6080&full=true&programs=BOSSA
#   → configure.width[0] = {"label":"15","sku":"T1580","available":false,"programmeExcluded":true}
#   → configure.width[1] = {"label":"20","sku":"T2080","available":false,"programmeExcluded":true}
#   → the grid renders both STRUCK — matching the client app exactly.
```

`programmeExcluded` exists so the client can tell *"not in the selected programme"* apart from a
baseline grey — useful for the tooltip, not for the strike decision itself:

| Condition | Tooltip |
|---|---|
| `crossedOut` | "Exists in this family — not orderable in this configuration" |
| `available:false`, `sku:null` | "Not available for this unit — no separate code" |
| `available:false`, `programmeExcluded` | **"Not available with the selected programme"** |
| `available:false`, sku, no annotation | "Not orderable in this configuration — opens the sibling unit" |

Multi-select is a **union** (`programs=BOSSA&programs=AVENIDA` → a pill dies only if *no* selected
programme allows it), matching the app's `ks.some(pk => progOkFor(u, pk))`. Accepts ids or names.

Endpoints that annotate — send `programs` to all three:

```bash
…/items?leafId=b_store%231&groupBy=family&programs=BOSSA
…/items/by-section?leafId=b_store%231&programs=BOSSA     # ← the endpoint the grid actually calls
…/items/T6080?expand=all&programs=BOSSA
```

Cost: one extra query per page (the union of the page's pill target skus).

### Not every pill state is baked in — coverage gap

The app's real gate is
`progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk`, reading
`state.prog/.tier/.depth/.handle/.front/.open/.antoso/.doorline`. The backend resolves **`progOk`
only**; the other seven were frozen at extraction in the app's DEFAULT toolbar state. Consequence: if
the real frontend ships the **FRONTS tier pills** or the depth / handle / front / opening toggles as
live controls, pills will **not** re-strike as those change. Same family of gap as the
`faceForTiers` FRONTS limitation (§2 "card = family").

### Reference implementation

`D4K-backend/public/design-book-ui.html` → **`optState(o)`** — 12 lines, returns
`{cls, title, dead, sku}`, shared by the card rows (`cfgRow`, `cardProgRow`) and the detail drawer
(`pillTargets`). CSS: `.cp.off` (grid, struck) · `.pill.off` (drawer, grey) · `.dead` · `.xed`.

Real distribution across v781's 256,937 **stored** configure pills (post-fix):

| State | Count | |
|---|---|---|
| `available:true` (all have a sku) | 251,968 | clickable |
| `available:false` + `sku:null` | 4,969 | dead — no target code |
| `available:false` + sku | **0** | query-time only (see above) |
| `crossedOut:true` | **0** | reserved, never emitted |

Measured pill-state parity against the live app's rendered grid (1,634 cards, chip-by-chip):

| Context | Pills | Match | | |
|---|---|---|---|---|
| baseline | 3,284 | 3,278 | **99.82%** | 6 = the app's own grid/detail split on the 63 cm-alteration chip (its detail greys it `d63off`, its grid does not; we follow the detail) |
| BOSSA | 2,347 | 2,321 | **98.89%** | those 6 + 20 where the unit is genuinely programme-excluded (`u.x` contains the key) and the app greys the **whole card** while we strike the individual pill — the "Grey, don't hide" presentation split, not a data disagreement |

---

## 2d. How to DISPLAY a struck / greyed / dead pill (rendering spec)

§2c says *which* state a pill is in. This says *what to draw* for it. Copy-paste target for the real
frontend; the lite UI (`D4K-backend/public/design-book-ui.html`) implements exactly this.

### One function decides everything

Never branch on `available` alone — three fields interact (`available`, `sku`, `crossedOut`), and the
answer differs per surface. Derive a state once, render from it:

```js
// D4K-backend/public/design-book-ui.html → optState() — the reference implementation, verbatim.
function optState(o){
  const sku   = o ? (o.sku || o.target || null) : null;
  const cross = !!(o && o.crossedOut === true);
  const na    = !!(o && o.available === false);
  const dead  = cross || (na && !sku);          // ← the ONLY unclickable states
  let cls = '', title = '';
  if(cross)      { cls=' xed';  title='Exists in this family — not orderable in this configuration'; }
  else if(dead)  { cls=' dead'; title=(o&&o.note)||'Not available for this unit — no separate code'; }
  else if(na)    { cls=' off';  title=(o&&o.programmeExcluded)
                                  ? 'Not available with the selected programme'
                                  : ((o&&o.note)||'Not orderable in this configuration — opens the sibling unit'); }
  else if(o&&o.note) title=o.note;
  return {cls,title,dead,na,sku};
}
```

### The four visual states

| State | Class | Grid CSS (card) | Detail CSS (drawer) | Tooltip | Click |
|---|---|---|---|---|---|
| normal | *(none)* | full opacity | full opacity | `note` if any | → opens `sku` |
| selected | `.sel` | filled accent | filled accent | — | inert (already here) |
| `available:false` + `sku` | `.off` | `opacity:.32; text-decoration:line-through` → **struck** | `opacity:.4` → **greyed** | "Not available with the selected programme" | **→ still opens `sku`** |
| `available:false` + `sku:null` | `.dead` | `opacity:.3; filter:grayscale(1); cursor:not-allowed` | same | "Not available for this unit — no separate code" | **inert** |
| `crossedOut:true` *(reserved, 0 today)* | `.xed` | `text-decoration:line-through; opacity:.55; cursor:not-allowed` | same | "Exists in this family — not orderable in this configuration" | **inert** |

```css
/* grid card — .off STRIKES */          /* detail drawer — .off GREYS */
.cp.off  {opacity:.32;text-decoration:line-through}    .pill.off {opacity:.4}
.cp.dead {opacity:.3;filter:grayscale(1);cursor:not-allowed}  .pill.dead{opacity:.3;filter:grayscale(1);cursor:not-allowed}
.cp.xed  {text-decoration:line-through;opacity:.55;cursor:not-allowed}  .pill.xed{text-decoration:line-through;opacity:.55;cursor:not-allowed}
```

### Wiring the click — the one rule people get wrong

`available:false` does **not** mean unclickable. Only `dead` does. Bind the handler on `!dead && sku`:

```js
const st = optState(o);
const p  = el('span', 'cp' + (o.selected ? ' sel' : '') + st.cls, o.label);
if (st.title) p.title = st.title;
if (!st.dead && !o.selected && st.sku) p.onclick = () => swapCard(card, st.sku);  // grid: swap in place
// detail drawer: p.onclick = () => openDetail(st.sku)
```

This mirrors the app's own chip builder — its struck `.wchip.wn` keeps its `pickHeight(...)` handler
(§2c "Struck ≠ disabled"). A frontend that disables struck pills breaks navigation the app allows.

---

## 2e. Card state — GREY, DON'T HIDE (whole-card programme exclusion)

§2c/§2d cover the **pills inside** a card. This covers the **card itself**. Both are needed to match the
client app; they are computed from different fields and the backend currently annotates only the pills.

### The rule

**The app never removes a card because of the programme.** Pick a programme and an unorderable card
stays in the grid, rendered dead: greyed image + title, greyed tier badge, struck W/H/D chips, the
literal text **"not available"** where the action icons would be, and a greyed points pill. The card
keeps its slot in its section. A frontend that filters those cards out client-side will show fewer
cards than the client app in the same section — that is the single biggest source of grid mismatch.

Verified live on `leafId=b_store#1` (Base › Doors, "Door Cabinets") under **WAKUU** (`programs=280`),
which is the screenshot the client sent — exactly one of the 7 cards greys, `TSS12080T2`:

| Card | `programmeAvailability.excluded` | allowed `programmes[]` | `280` in list | Render |
|---|---|---|---|---|
| `T6080IS2IZ` | true | 107 | yes | live |
| `T6086ISIZ2` | true | 82 | yes | live |
| `T6080N` | true | 110 | yes | live |
| `T6080` / `T6080S` | true | 110 | yes | live |
| `ATQ608068S` | **false** | 0 | — | live (no restriction at all) |
| `TSS12080T2` | true | 89 | **no** | **GREY + "not available"** |

### The predicate — identical to the backend's pill test

`excluded:true` means *"this item HAS a programme allow-list"*; `programmes[]` **is** that allow-list.
`excluded:false` means *no restriction* — always live. Do not read `excluded` alone as "is excluded".

```js
// Same test as design-book.service.ts → annotateProgrammeExclusions(), applied to the CARD's own sku.
function cardExcluded(card, programs /* the selected programme ids, e.g. ["280"] */) {
  const pa = card.programmeAvailability;
  if (!pa?.excluded) return false;                 // no allow-list → never grey
  if (!programs?.length) return false;             // no programme picked → never grey
  const allowed = pa.programmes || [];
  return !programs.some(p => allowed.includes(p)); // none of the picked progs allowed → grey the card
}
```

### ⚠️ `programmeAvailability` is NOT in the default card projection — send `full=true`

Today `GET items` / `GET items/by-section` omit `programmeAvailability` from card rows (they return
`availableTiers` / `programmeBadge` / `familyId` but not this). **Verified: without `full=true` the
field is absent on all 7 cards above, so the grid cannot compute the grey state at all.** Two options:

```bash
# Works today — costs the full item doc per card:
GET /design-book/items/by-section?leafId=b_store%231&programs=280&full=true

# Without it, every card row comes back with programmeAvailability ABSENT → nothing can grey.
GET /design-book/items/by-section?leafId=b_store%231&programs=280
```

> **Recommended backend change (not done):** have the backend annotate the **card** the same way it
> already annotates the pills — reuse `annotateProgrammeExclusions`, set `card.programmeExcluded=true`
> on the row, and the frontend needs neither `full=true` nor the predicate above. The current split
> (pills annotated server-side, card left to the client) is an asymmetry, not a design decision.

### Known parity split — card-grey vs pill-strike

The ~20 pill mismatches logged in §2c's parity table are this same issue seen from the other side: the
app greys the **whole card** for a programme-excluded unit, where we strike the **individual pill**. Both
carry the same information; they are different presentations. Settle which one the real frontend uses.

---

## 2f. ⚠️ OPEN — section bucketing may not match the app (unverified)

In the client's WAKUU screenshot all 5 visible cards sit under one **"DOOR + DRAWER COMBINATIONS"**
header. Our export gives those families four *different* `section` values, straight from the app's own
family data (`item.section = f.sec` in the extractor — not invented by us):

| Card | our `section` |
|---|---|
| `T6080IS2IZ`, `T6086ISIZ2` | Door + Drawer Combinations |
| `TSS12080T2` | Specialty Door Solutions |
| `T6080N` | Niche & Decorative Applications |
| `ATQ608068S` | Hot Water Units |

So `by-section` returns **7 families / 5 sections** and buckets 2 under that header where the client's
screenshot shows 5. Either the app's grid does not bucket by `f.sec` the way we assume, or the screenshot
is cropped and the remaining headers are simply off-frame. **Not yet checked against the live app** — do
that (serve the v781 HTML, pick WAKUU, dump the grid's rendered headers + card codes) before changing
anything. Do not "fix" the section values: they are the app's own data.

---

## 3. `GET /design-book/items/:sku` — detail panel (`openDetail`)

*Detail panel for `TK6080BZ2`, top→bottom = the response table below: breadcrumb + title +
**Copy**/**Catalog** buttons (header) · **CONFIGURE** (`configure`) · **DESCRIPTION**
(`description`) · **POSSIBLE ALTERATIONS & ACCESSORIES** tabs (`accessoryPanel.tabs`) ·
**SPECIFICATION** (`specification`) · **RESTRICTIONS** (`restrictions`) · **PROGRAMME
AVAILABILITY** (`programmeAvailability`) · **MODIFICATIONS — HOW TO** (`modifications`) ·
**PLANNING NOTES** (`planningNotes`).*

### Request

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `:sku` (path) | IN | Clicked card / "Search by Code" | Grid card / top search | `…/items/TK6080BZ2` |
| `expand=refs,catalog,all` | IN | (enrichment flags) | Powers card labels/images + Catalog PDF — no visible control | `…/items/T6073VE?expand=all` |
| `priceProgram` | IN | Programme to **PRICE the resolved ref cards** in (with `expand=refs`). Each `refs[sku]` then carries `pts` (point value) + `priceUnit` — so the accessory / alteration / related cards in the panel show their "NNN pts"/"NNN HLP" pill, same as the grid. Omit → refs have no `pts` | (mirrors the grid's active programme; no own control) | `…/items/CT10073IS2IZ?expand=refs&priceProgram=BOSSA` → `refs.EBF10058.pts` |
| `programs[]` | IN | Active PROGRAMME selection — greys the CONFIGURE pills whose target is not orderable in it (adds `available:false` + `programmeExcluded`). **Pass the grid's programme through**, or the detail panel shows every pill as available (§2c). Ids or names; multi = union | (mirrors the grid's active programme; no own control) | `…/items/T6080?expand=all&programs=BOSSA` → `item.configure.width[0].available` (= false) |

### Response (detail sections → panel blocks, top→bottom)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `item.sku` / `name` | OUT | Header code + title | Detail — header | `…/items/TK6080BZ2` → `item.name` |
| `item.nameQualifier` | OUT | Amber sub-label after the title ("Mid 45 cm deep") | Detail — header, right of title | `…/items/TSP6080BZ2` → `item.nameQualifier` |
| `item.handedLR` | OUT | "L/R" badge (left OR right hinged — state hinge side on order) | Detail — header, right of title | `…/items/TSP6080` → `item.handedLR` |
| `item.toeKick` | OUT | Toe-kick installed-height | Detail — header dims | `…/items/TK6080BZ2` → `item.toeKick` |
| `item.configure` | OUT | CONFIGURE box (W/H/D/Programme + coded rows) | Detail — Configure | `…/items/TK6080BZ2` → `item.configure` |
| `item.description` | OUT | DESCRIPTION block (title + bullets) | Detail — Description | `…/items/TK6080BZ2` → `item.description` |
| `item.accessoryPanel.tabs[]` | OUT | POSSIBLE ALTERATIONS & ACCESSORIES tabs | Detail — panel tabs | `…/items/T6073VE` → `item.accessoryPanel.tabs` |
| `item.accessoryPanel…swatches` / `visibleSideCombos` / `options` | OUT | Finish-interior grid · visible-side combos · option chips | Detail — Finish/Options tabs | `…/items/T6073VE` → `…accessoryPanel.tabs[].swatches` |
| `item.relatedGroups[]` | OUT | Compatible Accessories · Planned Together · Opening Support · Complete This Cabinet | Detail — related groups | `…/items/T3073Z2W?expand=refs` → `item.relatedGroups` |
| `systems[]` | OUT | **System Builder** panel — Required/Optional component rows + "Add Complete … System" (top-level, sibling of `item`; only on trigger skus) | Detail — System Builder box | `…/items/LLERUS` → `systems` |
| `item.engineering[]` | OUT | ENGINEERING capability flags (🟢/🔴) | Detail — Engineering | `…/items/TK6080BZ2` → `item.engineering` |
| `item.specification` | OUT | SPECIFICATION (W/H/D, carcase, weight, volume, page) | Detail — Specification | `…/items/TK6080BZ2` → `item.specification` |
| `item.restrictions[]` | OUT | RESTRICTIONS | Detail — Restrictions | `…/items/TK6080BZ2` → `item.restrictions` |
| `item.programmeAvailability` | OUT | PROGRAMME AVAILABILITY | Detail — Programme availability | `…/items/TK6080BZ2` → `item.programmeAvailability` |
| `item.modifications[]` | OUT | MODIFICATIONS — how to (handle 760/761, P1/C1) | Detail — Modifications | `…/items/TK6080BZ2` → `item.modifications` |
| `item.planningNotes[]` | OUT | PLANNING NOTES | Detail — Planning notes | `…/items/TK6080BZ2` → `item.planningNotes` |
| `item.didYouKnow` | OUT | 💡 Did you know? | Detail — footer tip | `…/items/TK6080BZ2` → `item.didYouKnow` |
| `item.appliance` | OUT | **Appliances popup** — click the Appliances button; rows built from these fields | Detail / Card — Appliances popup | `…/items/GFVK8080SM` → `item.appliance` |
| `item.sinkFitment` | OUT | **Sink fitment** section + **"+ Add Sink" popup** (max bowl size · width · rules) | Detail — Sink fitment (Base/Sinks only) | `…/items/TSP6080BZ2` → `item.sinkFitment` |
| `item.inspiration` | OUT | **Inspiration lightbox** (imageUrl · caption · heading) — same photo as the panel's Inspiration tab, also as a top-level card field | Detail / Card — camera-icon → lightbox popup | `…/items/AGFV6080` → `item.inspiration` |
| `item.priceUnit` | OUT | Price-pill UNIT ("pts" \| "HLP") for this item's point pill — HLP = dealer-list calc groups 15/38/61 | Detail / Card — inside the point pill | `…/items/EBF10058` → `item.priceUnit` (= "HLP") |
| `item.finishes[]` | OUT | Finish → price | Detail — finish/pricing | `…/items/TK6080BZ2` → `item.finishes` |
| `item.imageUrl` | OUT | Main product image | Detail — header image | `…/items/TK6080BZ2` → `item.imageUrl` |
| `catalog` (expand) | OUT | CATALOG button → price-cropped PDF page | Detail — header CATALOG button | `…/items/TK6080BZ2?expand=catalog` → `catalog` |
| `refs` (expand) | OUT | Resolves each ItemRef sku → name/kind/image (+ `priceUnit`; + `pts` when `priceProgram` set) so accessory/alteration/related **ref cards show their point pill** | Detail — all card labels/images + their pills | `…/items/CT10073IS2IZ?expand=refs&priceProgram=BOSSA` → `refs.EBF10058` (`{name, priceUnit:"HLP", pts}`) |

> **Appliances popup** (`item.appliance`, set only on the 8 housing families). The card/detail
> **Appliances** button (fridge/appliance glyph, tooltip "Appliances") opens a popup whose rows map
> **1:1** to the app's `addAppliances` payload:
> `brand` (company) · `category` (Refrigerators \| Dishwashers — also picks the icon) ·
> `subcategory` (**DW only**: Built-In \| Built-In ADA when heightClass 73) ·
> `nicheSize` (24" for DW; 18/24/30/36" for fridge, from width) ·
> `note` (**DW only**, original-handle GFVO* fronts: leg/brand fitment).
> `subcategory` + `note` are present **only** when `category === "Dishwashers"`; a fridge front carries
> just brand/category/nicheSize. Example: `GFVK8080SM` → **"Gaggenau · Dishwashers · Built-In · 24"".**
>
> **Sink fitment** (`item.sinkFitment`, set only on **Base/Sinks** cabinets with a width). Powers the card
> **"Max Sink Size: NN″"** line and the **"+ Add Sink"** popup, plus the detail **Sink fitment** section.
> All DERIVED from the cabinet width (`SINK_FIT` lookup) + whether the front is a hinged door — no separate
> record:
> `maxSinkSizeInch` (largest bowl for this width; **null** = compact base <45 cm → confirm manually) ·
> `cabinetWidthCm` (the width it was derived from) ·
> `customAboveInch` (always **42** — larger, or wider than a 120 cm base, needs a custom sink unit) ·
> `isDoor` (true = hinged door → deep-basin mod **ANSVVO275** may apply; false = drawer/pullout, no hinge mod) ·
> `showOnCard` (true = the "Max Sink Size" line + Add Sink button render on the CARD; the detail section always shows) ·
> `notes[]` (the exact popup / "Sink fitment" lines).
> Example: `TSP6080BZ2` (60 cm) → **"Max Sink Size: 21″"**; `TSP457368ZV` (45 cm) → **12″**.
>
> **Inspiration photo** (`item.inspiration`, set only on the **518** DW-front / mat cards that map to an
> S3 render). The small **camera icon** at the card's top-left (and the detail panel's **Inspiration tab**)
> opens a **lightbox** showing the full lifestyle photo + caption. Fields:
> `imageUrl` (the S3 lifestyle render — a SEPARATE image, NOT `meta.imageUrlTemplate ⊕ sku`) ·
> `caption` (the finish-note sentence under the photo — one of 3 fixed variants: integrated-DW-front /
> drawer-mat / generic inspiration reference) · `heading` (**368/518**: the bold code · family · dims line,
> e.g. "AGFV6080 — Front for Built-in Appliances · Special Height · W 600 × H 806 × D 20 mm"; omitted when
> the code has no family match) · `fullScreen` (true = "View full screen" button).
> It is a **top-level card mirror** of `accessoryPanel.tabs[Inspiration]` — materialized so the LIST api
> returns it even though `accessoryPanel` is stripped from list rows (it is NOT in `LIST_OMIT`, so it ships
> on every card and detail without `full=true`). Example: `AGFV6080` → integrated-DW-front photo + caption.
>
> **"L/R" badge** (`item.handedLR`, present & `true` only on hinge-side-optional units; omitted otherwise).
> The card/detail title shows a small **"L/R"** tag with tooltip *"Available left or right hinged — state the
> hinge side on order. The drawing shows the Left version."* The app COMPUTES it (single-door, or
> door+pullout, whose code doesn't already fix a side) — it is not a stored field, so the export materializes
> it. **General, not sink-only**: 2,605 items carry it (270 of them Base/Sinks). Example: `TSP6080` /
> `TSP6080B` → **true** ("Sink unit L/R"); `TSP6080Z` / `TSP6080BZ` (pull-outs) → omitted.
>
> **System Builder** (`systems[]`, a **top-level** response field alongside `item` — NOT under `item`).
> Present only when the sku is a *trigger* of an engineered system; absent otherwise. The panel presents an
> engineered product as a complete **system** (a bundle of SKUs) rather than scattered accessories:
> **Required Components** rows + **Optional** rows (each an "Add" button), an **"Add Complete … System"**
> button, and a live **System Status** checklist. Two systems today, both served by reverse-lookup on
> `triggerSkus` (composition stored on the catalog meta doc):
> `id` (SENSO \| LLER) · `name` (panel title) · `note` (grey sub-line) · `triggerSkus[]` (which items show it) ·
> `required[]` / `optional[]` — each a **slot** `{ role (bold row label), options: ItemRef[] (each `{sku,label?}`;
> `label` = the pill text), default? (pre-selected sku, only when >1 option) }`.
> A slot with one option renders a single code + Add; several options render a **pill group** (the chosen
> pill sets the code). Component codes are ItemRefs → `?expand=refs` hydrates them (name/kind/image), same
> as card refs. Example: `LLERUS` → **LLE-R Recessed Light System** — Required *Drill hole (by position)*
> [Shelf `BO78` (default) · Lower wall shelf + conduit `BO78U` · Upper shelf `BO78O`] + *Power Supply (USA)*
> `L24NT75US`; Optional *Switch / Control* `L24CB`. `MPEZS` (+ `MPC1EZS`/`MPP1EZS`/`MPEHAA`) → **SensoMatic System**.
> **UI-only, NOT in the payload:** the **Design Clipboard** the "Add" buttons feed + the **System Status**
> ticks — device-side runtime state (like ♥ My List); the client renders the panel + clipboard from
> `systems[]`, the clipboard *contents* stay on the device.

#### System Builder — every panel element → `systems[]` field

`GET items/LLERUS` returns `systems[0]` = the LLE-R object; the **whole panel and all its popups** render
from it (plus per-code image/name via item-resolve, plus the device clipboard for runtime state). One row
per on-screen element:

| Panel element (on screen) | Rendered from | Condition / note |
|---|---|---|
| Panel title + grey sub-line | `name` · `note` | always |
| **REQUIRED COMPONENTS** heading | — (static label) | shown when `required[].length > 0` |
| Component row label (bold) | `slot.role` | e.g. "Drill hole (by position)", "Power Supply (USA)" |
| Single-code row: code + **Add** | `slot.options[0].sku` | when `options.length === 1` (Power Supply, Switch/Control) |
| **Pill group** — shown code flips BO78→BO78U→BO78O | one pill per `options[]` (pill text = `option.label`, falls back to sku); selected pill starts at `default`, then user pick; the code shown beside = the **selected** `option.sku` | when `options.length > 1` (Drill hole) |
| **OPTIONAL** heading + rows | `optional[]` (each a slot, same shape) | shown when `optional[].length > 0` |
| **Add** button (per row) | `clipboard.add(selectedSku)` | selectedSku = that row's chosen option |
| **Add Complete … System** (black) | label = `"Add Complete " + name`; click adds the trigger sku + each required row's selected sku | uses `name` · `triggerSkus` (current sku) · `required[].`selected |
| **SYSTEM STATUS** checklist | title tick = `name` − " System"; one row per `required[].role`; **✔ Ready to Order** when every required sku is in the clipboard (else "Missing N required") | trigger + required only — **optional excluded** |
| **Design Clipboard** popup rows (thumb · name · ⧉ copy · ✕) | the codes come from `systems[]` (trigger + option skus); each row's **image** = `meta.imageUrlTemplate` ⊕ sku, **name** = item-resolve (`GET items/:sku` or `?expand=refs`) | list membership / order / "N" count badge = device state |

**Two things NOT in `systems[]` (by design):**
1. **Clipboard membership** — which codes the user added, their order, the "N" count badge → device-side
   runtime state (like ♥ My List / ⧉ Copy).
2. **Each code's image + name** shown in a clipboard row → not duplicated here; the image is built from
   `meta.imageUrlTemplate`, the name comes from the item (`GET items/:sku` or `?expand=refs`). `systems[]`
   carries only the sku per option.

So `systems[]` carries the fixed **composition + labels + defaults**; the client + item-resolve + device
clipboard supply the **runtime state + visuals**. Every element of the panel and all its popups
(Required/Optional rows, the drill-hole pill popup, each Add, Add Complete, System Status, Design
Clipboard) is covered.

---

## 4. `GET /design-book/programs` — programme picker (dropdown + "pick a programme" modal)

### Request (all optional)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `page`, `limit` | IN | Paging of the flat list (`limit` defaults high → one call = all) | (picker rarely pages) | `…/programs?page=2&limit=10` |
| `family` | IN | **Family tab** (case-insensitive): Primo / Avance / Contino — "Contino" also covers CONTINO-12 | Picker modal — top tab group (All / Primo / Avance / Contino / Contino-12) | `…/programs?family=Contino` |
| `tier` | IN | Tier letter (P / A / C) — alt to `family` | (when client has the letter) | `…/programs?tier=A` |
| `q` | IN | Free-text on programme name / id | Picker — search | `…/programs?q=rocca` |
| `active` | IN | Include-inactive flag | Admin | `…/programs?active=true` |

### Response

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `groups[]` (`key` / `label` / `count` / `programmes[]`) | OUT | Family **section** with header + chips (complete, render-ready) | Picker modal — PRIMO / AVANCE / CONTINO headers | `…/programs` → `groups[]` |
| `programmes[]` | OUT | Flat paged list (PRIMO→AVANCE→CONTINO, A→Z) | Top toolbar — **Programme SELECT DROPDOWN** ("No programme · point range") | `…/programs` → `programmes[]` |
| `programmes[].id` / `name` | OUT | Programme chip / option line | Picker chip · dropdown line | `…/programs` → `programmes[].name` |
| `programmes[].family` / `familyGroup` | OUT | Family grouping (PRIMO / AVANCE / CONTINO) | Group heading | `…/programs` → `programmes[].family` |
| `programmes[].tier` | OUT | Tier of the programme | Chip / line detail | `…/programs` → `programmes[].tier` |
| `programmes[].priceField` (`pg`) | OUT | Chip suffix "· PG {n}" + price-column pointer | Picker chip suffix (drives item pricing) | `…/programs` → `programmes[].pg` |
| `pagination.total` / `page` / `limit` / `pages` | OUT | Paging meta | (picker footer / dev) | `…/programs` → `pagination.total` |

---

## 5. `GET /design-book/categories` — type-taxonomy sidebar

*The left type-taxonomy sidebar. Search box = `q` · "All categories" 1614 = full tree · top-level
rows (Base/Tall/Wall/Midway/Alteration/Handles/…) = `categories[].name` with `.itemCount` badge ·
indented rows under **Base** (Sinks/Cooktops/…) = `categories[].subcategories[]`.*

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `page`, `limit` | IN | Paging (`limit` defaults high → one call = whole small tree) | (nav rarely pages) | `…/categories?page=2&limit=5` |
| `q` | IN | Free-text on category name / id | (filter) | `…/categories?q=base` |
| `active` (query) | IN | Include-inactive flag | Admin | `…/categories?active=true` |
| `categories[].name` | OUT | Category label | Left sidebar — top-level (Base / Tall / Wall / Midway …) | `…/categories` → `categories[].name` |
| `categories[].itemCount` | OUT | Count badge | Left sidebar — beside category | `…/categories` → `categories[].itemCount` |
| `categories[].subcategories[]` | OUT | Nested sub-category rows | Left sidebar — under category | `…/categories` → `categories[].subcategories` |
| `pagination.total` / `page` / `limit` / `pages` | OUT | Paging meta | (dev) | `…/categories` → `pagination.total` |

---

## 6. `GET /design-book/functional-categories` — "Design Tasks" sidebar

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `inspiration` | OUT | ✨ Designer Inspiration row | Left "Design Tasks" sidebar — top | `…/functional-categories` → `functionalCategories.inspiration` |
| `allCategories` | OUT | "All categories" (count = 1714) | Left sidebar — All row | `…/functional-categories` → `functionalCategories.allCategories` |
| `zones[]` | OUT | Zone header + count (Base/Tall/Wall/Midway) | Left sidebar — zone header | `…/functional-categories` → `functionalCategories.zones` |
| `zones[].groups[]` | OUT | Group row (💧 Water / Cooling / Cooking / Storage / …) | Left sidebar — group + "All Base Water" allRow | `…/functional-categories` → `…zones[].groups` |
| `zones[].groups[].leaves[]` | OUT | Leaf row + count (Sink Cabinets · Trash Pullouts · Dishwasher Fronts …) | Left sidebar — leaves (click → `GET items?leafId=`) | `…/functional-categories` → `…groups[].leaves` |
| `moreCategories[]` | OUT | "More categories" list — non-zone type categories (Alteration · Handles · Lighting · Service · Accessories & interior · Countertops · Panels & surround) | Left "Design Tasks" sidebar — below the zones | `…/functional-categories` → `functionalCategories.moreCategories` |
| `moreCategories[].category` / `.count` | OUT | "More" row header + family-count badge (incl. hidden families → `sum(subs.count) === count`) | Left sidebar — "more" row ("Alteration · 98") | `…` → `moreCategories[].count` |
| `moreCategories[].subs[]` | OUT | The row's TYPE-subcategory **leaves** — expands like a zone but with **no functional groups** (renders via app `subButtons(c)`, ordered `subRank` then count desc) | Left sidebar — under a "more" row | `…` → `moreCategories[].subs` |
| `moreCategories[].subs[].name` / `.count` | OUT | Leaf label + family count (unfiltered) | Left sidebar — leaf row ("Cabinet Modifications · 23") | `…` → `moreCategories[].subs[].name` |
| `moreCategories[].subs[].filter` (`{category, subcategory}`) | OUT | Leaf click → grid query. **NOT `leafId`** — filters by `category` + `subcategory` directly (both stored on every Item), so no `functionalGroups` materialization needed | Left sidebar — leaf click | `…` → `moreCategories[].subs[].filter` (→ `…/items?category=Alteration&subcategory=Cabinet%20Modifications`) |

> **`moreCategories[]` shape (2026-07-14):** each entry now carries a `subs[]` array of type-subcategory
> **leaves** (`{name, count, filter:{category, subcategory}}`) — previously it was a flat
> `{category, count}` header only. A "more" row is NOT a zone: it has no 💧/🔥 functional groups and no
> `leafId` leaves; it drops straight into its TYPE subcategories (mirrors §5 `GET categories`, but served
> from this one endpoint). Click a leaf → `GET items?category=<cat>&subcategory=<sub>` (the `filter`
> object, ready to pass through). Counts are FAMILY counts over `FAMS` with `f.cat === category`
> **including hidden families**, so `sum(subs[].count) === category count`. Contract: `MoreCategory` /
> `MoreCategoryLeaf` in `export-schema.ts`.

---

## 6b. `GET /design-book/tall-heights` — TALL dynamic height selector (line + height rows)

Powers the TALL toolbar's **two stacked pill rows** — the static **LINE** row (73·80·86) and the
**dynamic HEIGHT** row (190·204·217…). **TALL units only.** Reproduces the app's `availHeights()`: over
the currently-visible set (the SAME context filters as `GET items`, but *before* the line/height picks
narrow it), collect the distinct tall carcase heights (snapped from `heightMm`, ±8 mm) and, per line,
keep only that line's system (80 → {146,190,204,217}; 73 & 86 → {153,197,210,224}; ALL & both present →
default to 80). Every Design-Tasks leaf therefore returns its **own** set. Feed the picked `line` +
`tallHeight` back to `GET items` (§2).

### Request (context filters — same names as `GET items`)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `leafId` / `groupKey` / `zone` | IN | The active "Design Tasks" leaf / group / zone (which units are visible) | Left "Design Tasks" sidebar | `…/tall-heights?leafId=t_water%230` |
| `category` / `subcategory` / `section` / `familyId` | IN | Type-taxonomy narrowing (if the grid is in a category view) | Left type sidebar | `…/tall-heights?category=Tall` |
| `tier` / `family` / `programs[]` | IN | Active FRONTS tier / PROGRAMME tab / programme picker — narrows the visible set, and Avance locks LINE to 80 | Top toolbar | `…/tall-heights?zone=Tall&family=Avance` |
| `suspended` / `active` | IN | Same toggles as `GET items` | Top toolbar / admin | `…/tall-heights?zone=Tall&suspended=true` |
| `line` | IN | The **selected** LINE (73·80·86) — sets `selectedLine` + which `heights` come back (default ALL). Does NOT change `heightsByLine` (all four always returned) | Tall toolbar — top pill row | `…/tall-heights?leafId=t_water%230&line=80` |

### Response

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `lineOptions[]` (`value` · `available` · `heights[]`) | OUT | The **LINE row** pills (73·80·86); `available:false` = Avance-locked (only 80); each carries its own `heights` so switching line needs no round-trip | Tall toolbar — **top pill row** | `…/tall-heights?leafId=t_water%230` → `lineOptions` |
| `selectedLine` | OUT | Which LINE pill is active (the `line` param, else `"ALL"`) | Tall toolbar — top row selection | `…?line=80` → `selectedLine` (= 80) |
| `heights[]` | OUT | The **HEIGHT row** pills for `selectedLine` (e.g. `[204,217]`) | Tall toolbar — **second (dynamic) pill row** | `…/tall-heights?leafId=t_water%230&line=80` → `heights` |
| `heightsByLine` (`ALL` · `73` · `80` · `86`) | OUT | The HEIGHT set for **every** line — lets the client repaint the second row instantly on a LINE click | Tall toolbar — second row (per line) | `…/tall-heights?leafId=t_water%230` → `heightsByLine` |

> **Two-axis model.** `line` (73/80/86) is the carcase LINE = height SYSTEM; `tallHeight` (146…224) is the
> chosen carcase height. A unit's carcase height is **derived**, not stored — snap `heightMm` to the nearest of
> {146,153,190,197,204,210,217,224} within ±8 mm (the app's `tallHC`). This is a different axis from the BASE H
> pill `heightClass` (also 73/80/86, but a stored coarse bucket set only on the ~311 base-line tall families).
> No export/schema change — pure query-param + backend derivation (like `depthClass`). Verified 2026-07-14: all
> 20 tall leaves × 4 lines match the live app's `availHeights()` exactly. Flow: render `lineOptions` →
> user picks LINE → repaint HEIGHT row from `heightsByLine[line]` → user picks height →
> `GET items?leafId=<leaf>&line=<line>&tallHeight=<cm>`.

---

## 7. `GET /design-book/home` — landing screen

The home screen in one call — no request params. A trimmed reshape of the functional tree (§6)
into its two card rows: **START BY DESIGN TASK** (`designTasks`) + **OR BROWSE BY CABINET TYPE**
(`cabinetTypes`). Every card/group carries a `filter` object = the exact query to pass to
`GET items` when it is clicked. Counts are the stored family counts (match the app's numbers).

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `designTasks[]` | OUT | "START BY DESIGN TASK" cards — one per zone | Landing — top card row (BASE / TALL / WALL / MIDWAY) | `…/home` → `designTasks` |
| `designTasks[].zone` / `label` / `count` | OUT | Card header + zone count | Landing — card header ("BASE" · 234) | `…/home` → `designTasks[].count` |
| `designTasks[].groups[]` (`name` / `emoji` / `count`) | OUT | Group row inside the card | Landing — card body (💧 Water · 87) | `…/home` → `designTasks[].groups` |
| `designTasks[].groups[].filter` (`{groupKey}`) | OUT | Group-row click → grid query | Landing — group row click | `…/home` → `…groups[].filter` (→ `…/items?groupKey=b_water`) |
| `designTasks[].filter` (`{zone}`) | OUT | Card-header click → grid query | Landing — card header click | `…/home` → `designTasks[].filter` (→ `…/items?zone=Base`) |
| `cabinetTypes[]` (`key` / `label` / `count`) | OUT | "OR BROWSE BY CABINET TYPE" chips | Landing — bottom chip row (Base 234 … Panels 186) | `…/home` → `cabinetTypes` |
| `cabinetTypes[].filter` (`{zone}` or `{category}`) | OUT | Chip click → grid query | Landing — chip click | `…/home` → `cabinetTypes[].filter` (→ `…/items?category=Alteration`) |

> Zones (Base/Tall/Wall/Midway) filter the grid by **zone**; the rest (Alteration · Handles ·
> Lighting · Service · Accessories · Countertops · Panels) filter by **category** — the `filter`
> object says which. Chip label uses the full category name ("Accessories & interior"); the app
> shortens it for display. The card icons (line glyphs) are UI-only, not in the payload.

---

## 8. `GET /design-book/meta` — catalog reference (mostly non-visible)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `meta.imageUrlTemplate` | OUT | Builds every product/card image URL | (drives all `imageUrl`s) | `…/meta` → `meta.imageUrlTemplate` |
| `meta.schemaVersion` / `catalogVersion` | OUT | Version / about | Admin · about | `…/meta` → `meta.schemaVersion` |
| `meta.counts` | OUT | Catalog totals | Admin · stats | `…/meta` → `meta.counts` |
| `systems[]` | OUT | Full **System Builder** registry (SENSO · LLER) — the whole engineered-system table; per-item slice served by `GET items/:sku` (§3) | (drives the detail System Builder panel) | `…/meta` → `systems` |
| `lastIngestSummary` | OUT | Last sync report | Admin · import history | `…/meta` → `lastIngestSummary` |

---

## 9. `GET /design-book/stats` — admin dashboard

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `totalItems` / `activeItems` / `inactiveItems` | OUT | Item-count tiles | Admin · dashboard | `…/stats` → `stats.totalItems` |
| `itemsByKind` | OUT | Per-kind breakdown (cabinet/alteration/accessory/part) | Admin · dashboard | `…/stats` → `stats.itemsByKind` |
| `programmes` / `categories` | OUT | Distinct counts | Admin · dashboard | `…/stats` → `stats.programmes` |
| `catalogVersion` / `schemaVersion` / `lastIngestAt` | OUT | Version / freshness line | Admin · dashboard | `…/stats` → `stats.catalogVersion` |
