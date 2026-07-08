# design-book-api-ui-map.md

**API ↔ UI parameter map** — every `design-book` endpoint's parameters (request + response) mapped
side-by-side to the UI element it drives and where that element sits on screen.

- Base path: `/design-book` · all endpoints JWT-guarded (`Authorization: Bearer <token>`).
- **Dir**: `IN` = request param (query / path / body) · `OUT` = response field the UI renders.
- **UI location** uses the app vocabulary (see project `CLAUDE.md` → "UI vocabulary").
- Source: `D4K-backend/src/design-book/` (controller · service · `dto/query-items.dto.ts` · item schema)
  and the contract `docs/export-schema.ts`.

Endpoints: `POST ingest` · `GET items` · `GET items/:sku` · `GET programs` · `GET categories` ·
`GET functional-categories` · `GET meta` · `GET stats`.

---

## 1. `POST /design-book/ingest` — sync the catalog export (admin only)

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `file` (multipart) | IN | Catalog-export upload control | Admin · Catalog import (not customer UI) |
| `summary.items` / `programmes` / `categories` | OUT | Import result counts | Admin · import result toast/log |
| `summary.catalogVersion` / `schemaVersion` | OUT | Version line of the import | Admin · import result |

---

## 2. `GET /design-book/items` — grid / card list

### Request (filters → UI controls)

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `page`, `limit` | IN | Grid pager | Grid footer |
| `q` | IN | "Search by Code" box | Landing / top search |
| `category` | IN | Category pick | Left sidebar — type taxonomy (Base / Tall / Wall / Midway …) |
| `subcategory` | IN | Sub-category pick | Left sidebar — nested under category (Water / Cooling / …) |
| `section` | IN | On-page section header | Grid section divider |
| `familyId` | IN | Sibling-code group | (internal — client groups cards by family) |
| `leafId` | IN | "Design Tasks" **leaf** | Left "Design Tasks" sidebar (e.g. Water → Dishwasher Fronts) |
| `groupKey` | IN | "Design Tasks" **group** ("All Base Water") | Left "Design Tasks" sidebar — group row |
| `zone` | IN | "Design Tasks" **zone** | Left "Design Tasks" sidebar — zone header (Base/Tall/Wall/Midway) |
| `kind` | IN | Item-type filter (cabinet/alteration/accessory/part) | (filter) |
| `tier` | IN | FRONTS tier filter (P·P1·C·C1·A) | Top toolbar — "FRONTS" pill group |
| `widthMm`, `heightMm` | IN | W / H / D filter bar | Very top of app (grid filter bar) |
| `active` | IN | Active-only flag | Admin |
| `full` | IN | Include full detail blobs | (dev / debug flag) |

### Response (per-card fields → card slots)

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `sku` | OUT | Order code + Copy (⧉) button | Card — under title / bottom-left ⧉ |
| `name` | OUT | Card title | Card — title line |
| `cardLabel` | OUT | Small card label | Card — **top-left** ("Front" / "Built-in DW door") |
| `programmeBadge` | OUT | Programme summary chip | Card — **top-right** (P / ALL / P·A) |
| `availableTiers[]` | OUT | FRONTS tier badges | Card — **bottom-right** (P · P1 · C1) |
| `imageUrl` | OUT | Product image (built from `meta.imageUrlTemplate`) | Card — image area |
| `widthMm` / `heightMm` / `depthMm` | OUT | Dims line ("W 800 mm · H 792 mm") | Card — under title |
| `configure.width[]` | OUT | **W** pill row | Card — Configure rows |
| `configure.height[]` | OUT | **H** pill row (73 / 80 / 86) | Card — Configure rows |
| `configure.depth[]` | OUT | **D** pill row (incl. "63 cm alteration") | Card — Configure rows |
| `configure.programme[]` | OUT | Programme / tier pills (P · P1 · C1) | Card — **bottom-right** |
| `configure.optionRows[]` | OUT | Coded rows — **Ty** / Mode / Config (Z2XM · Z3M · ~~S2ZM~~) | Card — Configure rows |
| `configure.optionRows[].options[].crossedOut` | OUT | Struck-through pill (exists but not orderable here) | Card — pill state (e.g. ~~S2ZM~~) |
| `configure.*[].selected` / `.available` | OUT | Highlighted vs greyed pill | Card — pill state |
| `configure.*[].sku` | OUT | Pill target (click → opens that item) | Card — pill navigation |
| `appliance` | OUT | Appliances (fridge) icon | Card — **bottom-left** (appliance fronts only) |
| `pagination.total` / `page` / `pages` | OUT | Pager counts | Grid footer |

---

## 3. `GET /design-book/items/:sku` — detail panel (`openDetail`)

### Request

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `:sku` (path) | IN | Clicked card / "Search by Code" | Grid card / top search |
| `expand=refs,catalog,all` | IN | (enrichment flags) | Powers card labels/images + Catalog PDF — no visible control |

### Response (detail sections → panel blocks, top→bottom)

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `item.sku` / `name` | OUT | Header code + title | Detail — header |
| `item.toeKick` | OUT | Toe-kick installed-height | Detail — header dims |
| `item.configure` | OUT | CONFIGURE box (W/H/D/Programme + coded rows) | Detail — Configure |
| `item.description` | OUT | DESCRIPTION block (title + bullets) | Detail — Description |
| `item.accessoryPanel.tabs[]` | OUT | POSSIBLE ALTERATIONS & ACCESSORIES tabs | Detail — panel tabs |
| `item.accessoryPanel…swatches` / `visibleSideCombos` / `options` | OUT | Finish-interior grid · visible-side combos · option chips | Detail — Finish/Options tabs |
| `item.relatedGroups[]` | OUT | Compatible Accessories · Planned Together · Opening Support · Complete This Cabinet | Detail — related groups |
| `item.engineering[]` | OUT | ENGINEERING capability flags (🟢/🔴) | Detail — Engineering |
| `item.specification` | OUT | SPECIFICATION (W/H/D, carcase, weight, volume, page) | Detail — Specification |
| `item.restrictions[]` | OUT | RESTRICTIONS | Detail — Restrictions |
| `item.programmeAvailability` | OUT | PROGRAMME AVAILABILITY | Detail — Programme availability |
| `item.modifications[]` | OUT | MODIFICATIONS — how to (handle 760/761, P1/C1) | Detail — Modifications |
| `item.planningNotes[]` | OUT | PLANNING NOTES | Detail — Planning notes |
| `item.didYouKnow` | OUT | 💡 Did you know? | Detail — footer tip |
| `item.appliance` | OUT | Appliances button metadata (brand / niche / category) | Detail — Appliances |
| `item.finishes[]` | OUT | Finish → price | Detail — finish/pricing |
| `item.imageUrl` | OUT | Main product image | Detail — header image |
| `catalog` (expand) | OUT | CATALOG button → price-cropped PDF page | Detail — header CATALOG button |
| `refs` (expand) | OUT | Resolves each ItemRef sku → name/kind/image | Detail — all card labels/images |

---

## 4. `GET /design-book/programs` — programme dropdown

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `active` (query) | IN | Include-inactive flag | Admin |
| `programmes[].id` / `name` | OUT | Programme option line | Top toolbar — **Programme SELECT DROPDOWN** ("No programme · point range") |
| `programmes[].family` | OUT | Family grouping (PRIMO / AVANCE / CONTINO) | Dropdown — group heading |
| `programmes[].tier` | OUT | Tier of the programme | Dropdown — line detail |
| `programmes[].priceField` | OUT | Price-column pointer | (drives item pricing) |

---

## 5. `GET /design-book/categories` — type-taxonomy sidebar

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `active` (query) | IN | Include-inactive flag | Admin |
| `categories[].name` | OUT | Category label | Left sidebar — top-level (Base / Tall / Wall / Midway …) |
| `categories[].itemCount` | OUT | Count badge | Left sidebar — beside category |
| `categories[].subcategories[]` | OUT | Nested sub-category rows | Left sidebar — under category |

---

## 6. `GET /design-book/functional-categories` — "Design Tasks" sidebar

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `inspiration` | OUT | ✨ Designer Inspiration row | Left "Design Tasks" sidebar — top |
| `allCategories` | OUT | "All categories" (count = 1714) | Left sidebar — All row |
| `zones[]` | OUT | Zone header + count (Base/Tall/Wall/Midway) | Left sidebar — zone header |
| `zones[].groups[]` | OUT | Group row (💧 Water / Cooling / Cooking / Storage / …) | Left sidebar — group + "All Base Water" allRow |
| `zones[].groups[].leaves[]` | OUT | Leaf row + count (Sink Cabinets · Trash Pullouts · Dishwasher Fronts …) | Left sidebar — leaves (click → `GET items?leafId=`) |
| `moreCategories[]` | OUT | Extra categories | Left sidebar — "more" |

---

## 7. `GET /design-book/meta` — catalog reference (mostly non-visible)

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `meta.imageUrlTemplate` | OUT | Builds every product/card image URL | (drives all `imageUrl`s) |
| `meta.schemaVersion` / `catalogVersion` | OUT | Version / about | Admin · about |
| `meta.counts` | OUT | Catalog totals | Admin · stats |
| `lastIngestSummary` | OUT | Last sync report | Admin · import history |

---

## 8. `GET /design-book/stats` — admin dashboard

| API parameter | Dir | UI parameter (element) | UI location |
|---|---|---|---|
| `totalItems` / `activeItems` / `inactiveItems` | OUT | Item-count tiles | Admin · dashboard |
| `itemsByKind` | OUT | Per-kind breakdown (cabinet/alteration/accessory/part) | Admin · dashboard |
| `programmes` / `categories` | OUT | Distinct counts | Admin · dashboard |
| `catalogVersion` / `schemaVersion` / `lastIngestAt` | OUT | Version / freshness line | Admin · dashboard |
