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
`GET categories` · `GET functional-categories` · `GET home` · `GET meta` · `GET stats`.

---

## 1. `POST /design-book/ingest` — sync the catalog export (admin only)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `file` (multipart) | IN | Catalog-export upload control | Admin · Catalog import (not customer UI) | `curl -F file=@docs/export-v767.json …/ingest` |
| `summary.items` / `programmes` / `categories` | OUT | Import result counts | Admin · import result toast/log | `POST …/ingest` → `summary.items` |
| `summary.catalogVersion` / `schemaVersion` | OUT | Version line of the import | Admin · import result | `POST …/ingest` → `summary.catalogVersion` |

---

## 2. `GET /design-book/items` — grid / card list

### Request (filters → UI controls)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `page`, `limit` | IN | Grid pager | Grid footer | `…/items?page=2&limit=50` |
| `q` | IN | "Search by Code" box | Landing / top search | `…/items?q=TK6080` |
| `category` | IN | Category pick | Left sidebar — type taxonomy (Base / Tall / Wall / Midway …) | `…/items?category=Base` |
| `subcategory` | IN | Sub-category pick | Left sidebar — nested under category (Water / Cooling / …) | `…/items?category=Base&subcategory=Sinks` |
| `section` | IN | On-page section header | Grid section divider | `…/items?section=Cooktops` |
| `familyId` | IN | Sibling-code group | (internal — client groups cards by family) | `…/items?familyId=F333` |
| `leafId` | IN | "Design Tasks" **leaf** | Left "Design Tasks" sidebar (e.g. Water → Dishwasher Fronts) | `…/items?leafId=b_water%232` |
| `groupKey` | IN | "Design Tasks" **group** ("All Base Water") | Left "Design Tasks" sidebar — group row | `…/items?groupKey=b_water` |
| `zone` | IN | "Design Tasks" **zone** | Left "Design Tasks" sidebar — zone header (Base/Tall/Wall/Midway) | `…/items?zone=Base` |
| `kind` | IN | Item-type filter (cabinet/alteration/accessory/part) | (filter) | `…/items?kind=accessory` |
| `family` | IN | **PROGRAMME tab** (All / Primo / Avance / Contino) — maps to tiers (Primo→P/P1, Contino→C/C1, Avance→A) | Top toolbar — "PROGRAMME" tab group | `…/items?family=Contino` |
| `programs[]` | IN | **PROGRAMME picker multi-select** (array of programme ids/names; union of their tiers) | "Programme for Base units" modal (Step 1 of 4) — highlighted chips | `…/items?programs=AVENIDA&programs=BONDI-A` |
| `tier` | IN | **FRONTS pill** (P·P1·A·C·C1) | Top toolbar — "FRONTS" pill group | `…/items?tier=P1` |
| `widthMm` | IN | **W pill** (cm×10 → mm) | Grid filter bar — W row (15·20·30·…·Corner) | `…/items?widthMm=600` |
| `heightClass` | IN | **H pill** (73·80·86 — coarse bucket, not `heightMm`) | Grid filter bar — H row | `…/items?heightClass=80` |
| `depthMm` | IN | **D pill** (cm×10 → mm) | Grid filter bar — D row (36·48·58·63·68) | `…/items?depthMm=580` |
| `heightMm` | IN | Exact carcass height (mm) — not a bar pill | (precise filter) | `…/items?heightMm=792` |
| `suspended` | IN | **TOE-KICK "Suspended" toggle** (engineering `suspended`, ok=true) | Top toolbar — TOE-KICK H · Suspended | `…/items?suspended=true` |
| `active` | IN | Active-only flag | Admin | `…/items?active=true` |
| `groupBy=family` | IN | **Grid card grouping** — one card per family ("N types"); pages by family, not unit | Grid — the card grid itself (each card = a "type") | `…/items?leafId=b_cool%230&groupBy=family` |
| `full` | IN | Include full detail blobs | (dev / debug flag) | `…/items?q=T6073VE&full=true` |

> **availableTiers precedence** (one filter, most-specific wins): `tier` (FRONTS pill) → `programs[]` (picker) → `family` (tab).
> Grid is **tier-granular**: item↔programme links only by tier, so two same-tier programmes collapse to one tier.
> Bar controls that are NOT item filters (world/display state, no param): PROGRAMME dropdown ("No programme · point range"),
> TOE-KICK slider (cm), the ⇄ mm/inch converter box, "GREY, DON'T HIDE" toggle, "Mix" button, "Corner" width pill.
> Combine freely: `…/items?category=Base&heightClass=80&depthMm=580&suspended=true&tier=P&page=1&limit=50`
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

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `sku` | OUT | Order code + Copy (⧉) button | Card — under title / bottom-left ⧉ | `…/items?limit=1` → `items[0].sku` |
| `name` | OUT | Card title | Card — title line | `…/items` → `items[].name` |
| `cardLabel` | OUT | Small card label | Card — **top-left** ("Front" / "Built-in DW door") | `…/items` → `items[].cardLabel` |
| `programmeBadge` | OUT | Programme summary chip | Card — **top-right** (P / ALL / P·A) | `…/items` → `items[].programmeBadge` |
| `availableTiers[]` | OUT | FRONTS tier badges | Card — **bottom-right** (P · P1 · C1) | `…/items` → `items[].availableTiers` |
| `imageUrl` | OUT | Product image (built from `meta.imageUrlTemplate`) | Card — image area | `…/items` → `items[].imageUrl` |
| `widthMm` / `heightMm` / `depthMm` | OUT | Dims line ("W 800 mm · H 792 mm") | Card — under title | `…/items` → `items[].widthMm` |
| `configure.width[]` | OUT | **W** pill row | Card — Configure rows | `…/items?full=true` → `items[].configure.width` |
| `configure.height[]` | OUT | **H** pill row (73 / 80 / 86) | Card — Configure rows | `…/items?full=true` → `items[].configure.height` |
| `configure.depth[]` | OUT | **D** pill row (incl. "63 cm alteration") | Card — Configure rows | `…/items?full=true` → `items[].configure.depth` |
| `configure.programme[]` | OUT | Programme / tier pills (P · P1 · C1) | Card — **bottom-right** | `…/items?full=true` → `items[].configure.programme` |
| `configure.optionRows[]` | OUT | Coded rows — **Ty** / Mode / Config (Z2XM · Z3M · ~~S2ZM~~) | Card — Configure rows | `…/items?full=true` → `items[].configure.optionRows` |
| `configure.optionRows[].options[].crossedOut` | OUT | Struck-through pill (exists but not orderable here) | Card — pill state (e.g. ~~S2ZM~~) | `…/items?full=true` → `…optionRows[].options[].crossedOut` |
| `configure.*[].selected` / `.available` | OUT | Highlighted vs greyed pill | Card — pill state | `…/items?full=true` → `…configure.width[].available` |
| `configure.*[].sku` | OUT | Pill target (click → opens that item) | Card — pill navigation | `…/items?full=true` → `…configure.width[].sku` |
| `appliance` | OUT | Appliances (fridge) icon | Card — **bottom-left** (appliance fronts only) | `…/items?full=true` → `items[].appliance` |
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
`category` / `subcategory` / `section` / `tier` / `family` / `programs[]` / `widthMm` / `heightClass` /
`depthMm` / `kind` / `q` / `full` / `page` / `limit`). Use it instead of `GET items?groupBy=family`
when you want the server to do the section bucketing.

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
> **Paging is by family (card), not by section**: the page's cards are section-sorted then bucketed, so a
> section straddling a page boundary appears (partially) on **both** pages — the client merges buckets by
> `section` on scroll. Same best-effort ordering caveat as §2 (v767 export didn't capture the app's
> section / card order). Verified: `leafId=b_water#2` → 19 families → 6 section buckets ("Appliance
> Fronts · DW (center handle)" = 5 cards, "Front for Dishwasher Appliances · Original handle D61" = 3).

---

## 3. `GET /design-book/items/:sku` — detail panel (`openDetail`)

### Request

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `:sku` (path) | IN | Clicked card / "Search by Code" | Grid card / top search | `…/items/TK6080BZ2` |
| `expand=refs,catalog,all` | IN | (enrichment flags) | Powers card labels/images + Catalog PDF — no visible control | `…/items/T6073VE?expand=all` |

### Response (detail sections → panel blocks, top→bottom)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `item.sku` / `name` | OUT | Header code + title | Detail — header | `…/items/TK6080BZ2` → `item.name` |
| `item.toeKick` | OUT | Toe-kick installed-height | Detail — header dims | `…/items/TK6080BZ2` → `item.toeKick` |
| `item.configure` | OUT | CONFIGURE box (W/H/D/Programme + coded rows) | Detail — Configure | `…/items/TK6080BZ2` → `item.configure` |
| `item.description` | OUT | DESCRIPTION block (title + bullets) | Detail — Description | `…/items/TK6080BZ2` → `item.description` |
| `item.accessoryPanel.tabs[]` | OUT | POSSIBLE ALTERATIONS & ACCESSORIES tabs | Detail — panel tabs | `…/items/T6073VE` → `item.accessoryPanel.tabs` |
| `item.accessoryPanel…swatches` / `visibleSideCombos` / `options` | OUT | Finish-interior grid · visible-side combos · option chips | Detail — Finish/Options tabs | `…/items/T6073VE` → `…accessoryPanel.tabs[].swatches` |
| `item.relatedGroups[]` | OUT | Compatible Accessories · Planned Together · Opening Support · Complete This Cabinet | Detail — related groups | `…/items/T3073Z2W?expand=refs` → `item.relatedGroups` |
| `item.engineering[]` | OUT | ENGINEERING capability flags (🟢/🔴) | Detail — Engineering | `…/items/TK6080BZ2` → `item.engineering` |
| `item.specification` | OUT | SPECIFICATION (W/H/D, carcase, weight, volume, page) | Detail — Specification | `…/items/TK6080BZ2` → `item.specification` |
| `item.restrictions[]` | OUT | RESTRICTIONS | Detail — Restrictions | `…/items/TK6080BZ2` → `item.restrictions` |
| `item.programmeAvailability` | OUT | PROGRAMME AVAILABILITY | Detail — Programme availability | `…/items/TK6080BZ2` → `item.programmeAvailability` |
| `item.modifications[]` | OUT | MODIFICATIONS — how to (handle 760/761, P1/C1) | Detail — Modifications | `…/items/TK6080BZ2` → `item.modifications` |
| `item.planningNotes[]` | OUT | PLANNING NOTES | Detail — Planning notes | `…/items/TK6080BZ2` → `item.planningNotes` |
| `item.didYouKnow` | OUT | 💡 Did you know? | Detail — footer tip | `…/items/TK6080BZ2` → `item.didYouKnow` |
| `item.appliance` | OUT | Appliances button metadata (brand / niche / category) | Detail — Appliances | `…/items/GFVO` → `item.appliance` |
| `item.finishes[]` | OUT | Finish → price | Detail — finish/pricing | `…/items/TK6080BZ2` → `item.finishes` |
| `item.imageUrl` | OUT | Main product image | Detail — header image | `…/items/TK6080BZ2` → `item.imageUrl` |
| `catalog` (expand) | OUT | CATALOG button → price-cropped PDF page | Detail — header CATALOG button | `…/items/TK6080BZ2?expand=catalog` → `catalog` |
| `refs` (expand) | OUT | Resolves each ItemRef sku → name/kind/image | Detail — all card labels/images | `…/items/T6073VE?expand=refs` → `refs` |

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
| `moreCategories[]` | OUT | Extra categories | Left sidebar — "more" | `…/functional-categories` → `functionalCategories.moreCategories` |

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
| `lastIngestSummary` | OUT | Last sync report | Admin · import history | `…/meta` → `lastIngestSummary` |

---

## 9. `GET /design-book/stats` — admin dashboard

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `totalItems` / `activeItems` / `inactiveItems` | OUT | Item-count tiles | Admin · dashboard | `…/stats` → `stats.totalItems` |
| `itemsByKind` | OUT | Per-kind breakdown (cabinet/alteration/accessory/part) | Admin · dashboard | `…/stats` → `stats.itemsByKind` |
| `programmes` / `categories` | OUT | Distinct counts | Admin · dashboard | `…/stats` → `stats.programmes` |
| `catalogVersion` / `schemaVersion` / `lastIngestAt` | OUT | Version / freshness line | Admin · dashboard | `…/stats` → `stats.catalogVersion` |
