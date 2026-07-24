# design-book-api-ui-map-v2.md

**API ↔ UI parameter map (v2 — MINIMAL + CAPABILITIES model)** — every `design-book` endpoint's
parameters (request + response) mapped side-by-side to the UI element it drives and where that element
sits on screen. This is the reference for the team building the **admin** (create/edit catalog items)
and the **shopper** (grid + detail) UIs.

- Base path: `/design-book` · all endpoints JWT-guarded (`Authorization: Bearer <token>`).
- **Dir**: `IN` = request param (query / path / body) · `OUT` = response field the UI renders.
- **UI location** uses the app vocabulary (see project `CLAUDE.md` → "UI vocabulary").
- **Sample call**: a concrete request. `…` = `/design-book`; every call needs
  `-H "Authorization: Bearer <token>"` (omitted for brevity).
- Source of truth: the v2 contract `docs/export-schema-v2.ts` and the backend
  `D4K-backend/src/design-book/` (`design-book.controller.ts` · `design-book.service.ts` ·
  `design-book.detail.ts` · `dto/upsert-item.dto.ts` · `dto/query-items.dto.ts`).

Endpoints: `POST ingest` · **`POST items` · `PATCH items/:sku` · `DELETE items/:sku`** (NEW CRUD) ·
`GET items` · `GET items/by-section` · `GET items/:sku` · `GET programs` · `GET categories` ·
`GET functional-categories` · `GET tall-heights` · `GET home` · `GET meta` · `GET stats`.

---

## ⭐ v2 — what changed from v1 (read this first)

> The **API surface is almost identical**; the **data model underneath it changed**. v1 stored every
> rendered detail section verbatim, frozen at the app's default toolbar. v2 stores only **intrinsic
> facts + plain-array rules + thin sku refs**, and the client/backend DERIVE the rest. Same catalog
> (v781), ~45% smaller, and — the point of v2 — **hand-editable through CRUD**.

| Area | v1 | **v2** |
|---|---|---|
| **Author items** | ingest-only (extractor) | **NEW: `POST/PATCH/DELETE items`** — build/edit any item by hand, including its whole `capabilities` object. §1b |
| **Configure pills** | `configure.{width,height,depth,programme,optionRows}`, each pill froze `available`/`selected`/`crossedOut`/`value`/`unit` | **`parameters.{width,height,depth,programme,options}`** — each pill is just `{label\|tier, sku}` (+ `alteration?`/`opening?`/`swatch?`; depth rows also `code`). **No stored state.** §2, §2c, §2c-1 |
| **Pill grey/strike** | frozen per-pill `available` boolean | **`availableFromCaps(target.capabilities, toolbar)`** — the client evaluates the 8 gates against its own toolbar, exactly as the app does. §2c, §2d |
| **Whole-card grey** | `programmeAvailability.excluded` + `programmes[]` allow-list | the card's **own `capabilities`** run through the same `availableFromCaps`. `programmeAvailability` is **gone**. §2c |
| **Backend programme grey** | `annotateProgrammeExclusions` read `programmeAvailability` | same method, now reads **`capabilities.excludedPrograms`** — still the ONE gate computed server-side. §2c |
| **Rule inputs** | scattered / implicit | **NEW `capabilities` object** (17 fields) on every item — the pill-gate rule inputs. §2d |
| **Detail sections** | `configure`, `accessoryPanel`, `relatedGroups`, `specification`, `programmeBadge` | **removed.** Replaced by `parameters`, thin `alterations`/`accessories`/`companions` (hydrated via `refs`), `finishInterior`, `priceGroupRef`/`frontModifiers`/`carcaseLine`, `engineering:[{key,ok}]`, `catalogPage`. §3 |
| **`crossedOut`** | reserved-but-never-emitted field | **does not exist** in v2. A pill is only ever live / grey / dead. |
| **`depthClass` filter** | matched `configure.depth[].label` | matches **`capabilities.depthClasses`** — the app's own `depthOk`; 58 & 63 are pass-through. §2, §2c-2 |
| **Order codes that aren't the sku** | not modelled | **`parameters.depth[].code`** (2.1) + **`item.doorLineYCode`** and **`item.heightExtension`** (2.2) — the three code surfaces a client cannot derive. §2c-3 |

**One import to internalize:** in v2 a pill has **no state of its own**. Its target sku is a pointer;
the client looks up that target item's `capabilities`, runs `availableFromCaps` against the current
toolbar, and paints the pill live / grey / dead. That single rule replaces every frozen boolean v1 had.

---

## 1. `POST /design-book/ingest` — sync the whole catalog export (admin)

Unchanged endpoint. Upload the v2 export JSON (`export-v781.json`, `{ meta, categories, programmes,
ruleTables?, systems?, functionalCategories?, items[] }`) as multipart field `file`. Every item is
upserted by `sku` through **`normalizeItemDoc`** — **the same normalizer the CRUD endpoints use**, so a
hand-authored item and an extracted one are byte-identical. Anything absent from the upload → `active:false`.

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `file` (multipart) | IN | Catalog-export upload control | Admin · Catalog import | `curl -F file=@docs/export-v781.json …/ingest` |
| `summary.items` / `programmes` / `categories` | OUT | Import result counts | Admin · import result toast/log | `POST …/ingest` → `summary.items` |
| `summary.catalogVersion` / `schemaVersion` | OUT | Version line of the import (`schemaVersion` = `"2.2.0"`) | Admin · import result | `POST …/ingest` → `summary.schemaVersion` |

---

## 1b. ⭐ NEW — manual CRUD: build / edit / delete one item

The admin UI's whole reason for existing. Three endpoints let a person **author a catalog item by
hand**, field-for-field the same as the extractor writes. They all funnel through the same
`normalizeItemDoc` as `POST ingest`, so **a UI-created item and an ingested item are indistinguishable**.

> **EVERY rule and field is settable at creation** — including the whole `capabilities` object (all 17
> gate inputs), `parameters` (the pill rows), `finishInterior`, the thin ref lists
> (`alterations`/`accessories`/`companions`), and the programme rule `capabilities.excludedPrograms` /
> `excludedProgramsE`. This is how the admin UI controls exactly how a new item's pills grey under each
> toolbar state. Service-owned lifecycle fields (`ingestBatchId` / `lastSeenAt` / `deactivatedAt` /
> `catalogVersion`) are stripped if sent; only `active` is user-settable.

### The three endpoints

| Method / path | What it does | Not-found / conflict | Sample call |
|---|---|---|---|
| `POST /design-book/items` | **Create** one item from a JSON body. `sku` required. | **409** if the sku already exists (use PATCH to edit) | `POST …/items -d '{"sku":"TK6080BZ2", …}'` |
| `PATCH /design-book/items/:sku` | **Edit** — top-level `$set` **MERGE**: only the fields present in the body are replaced; omitted fields are left untouched. A body `sku` is ignored (comes from the URL). | **404** if the item does not exist | `PATCH …/items/TK6080BZ2 -d '{"name":"…"}'` |
| `DELETE /design-book/items/:sku?hard=` | **Delete** — SOFT by default (`active:false`, kept for history). `?hard=true` removes the document. | **404** if the item does not exist | `DELETE …/items/TK6080BZ2` (soft) · `…?hard=true` (hard) |

All three return the stored item with its **built `imageUrl`** (`meta.imageUrlTemplate ⊕ sku`; never
stored). Re-activating via `PATCH {active:true}` clears the `deactivatedAt` stamp. ⚠️ A manual item
absent from a later `POST ingest` upload is deactivated by the missing→inactive sweep (**the extractor
wins, by design**) — hand-authored items that must survive re-ingest need to be in the export too.

### The DTO field surface (`UpsertItemDto`) — the whole item is authorable

The global `ValidationPipe` runs `whitelist + forbidNonWhitelisted`, so **only these top-level keys are
accepted** (unknown keys 409/400). Rule + block fields are loose objects/arrays so their nested content
stays free ("customize anything" inside the known surface). `PatchItemDto` = `PartialType` (all optional).

| DTO field | Type | UI element it feeds |
|---|---|---|
| `sku` **(required)** | string | Order code — primary key |
| `kind` | `cabinet\|alteration\|accessory\|part` | item-type |
| `familyId` · `name` · `category` · `subcategory` · `section` · `nameQualifier` | string | taxonomy + card/detail title + amber sub-label |
| `widthMm` · `heightMm` · `depthMm` · `heightClass` | number | carcass dims + H bucket |
| `availableTiers[]` · `faceForTiers[]` | string[] | FRONTS tier badges · which tiers this unit is the family FACE card |
| **`capabilities`** | object (17 fields — §2d) | **the pill-gate rule inputs** — how every configure pill greys |
| **`parameters`** | `{ width[], height[], depth[], programme[], options[] }` | the W/H/D/Programme + coded pill rows (§2) |
| **`heightExtension`** (2.2) | `{sku, addCode, options:[{label, heightMm}]}` | the **`217+`** chip on the Height row — 230/244/250 cm via the 217 cm unit + `MPHVERL`. **Not** three more `parameters.height` pills (the HP20 panels have REAL 230/250 siblings — the labels would collide) — §2c-3 |
| **`doorLineYCode`** (2.2) | string | the literal order code when the toolbar picks door-line **Y** (Y REPLACES the whole code, so it can't be derived). Set it on the same units that carry `capabilities.doorLineY` — that flag is the gate, this is the code — §2c-3 |
| `alterations[]` | string[] (sku codes) | Alterations tab cards (hydrated via `refs`) |
| `accessories[]` | `(string \| {sku, variants:[{label,sku}]})[]` | accessory / pullout cards (+ runner/length variants) |
| `companions[]` | string[] (sku codes) | Planned-together / Opening-support / Complete-this-cabinet cards |
| `finishInterior` | `{ swatches[], visibleSideCombos[], optionCodes[] }` | Vero interior-finish sub-panel |
| `description` · `restrictions[]` · `planningNotes[]` · `didYouKnow` · `modifications[]` | text blocks | the free-text detail sections |
| `handedLR` | boolean | "L/R" hinge badge |
| `sinkFitment` · `appliance` · `toeKick` · `inspiration` | object | "+ Add Sink" popup · Appliances popup · toe-kick height · camera-icon lightbox |
| `finishes[]` · `priceUnit` · `catalogPage` · `priceGroupRef` · `frontModifiers` · `carcaseLine` · `weightKg` · `volumeM3` | pricing / catalog / spec | point pill unit, PDF page, spec lines |
| `engineering[]` | `[{key,ok}]` | Engineering 🟢/🔴 flags (+ drives the `suspended` grid filter) |
| `functionalGroups[]` | object[] | which "Design Tasks" leaves this item appears in |
| `active` | boolean | deactivate (the only settable lifecycle field) |

---

## 2. `GET /design-book/items` — grid / card list

*The grid filter bar. Left→right: **PROGRAMME dropdown** ("No programme · point range" — sets the card
`pts` price via `priceProgram`, not a grid filter) · **Mix** button (UI-only) · **W** row (`widthMm`,
cm×10) · **H** row (`heightClass` 73/80/86) · **GREY, DON'T HIDE** toggle (UI-only) · **D** row
(`depthClass` — nominal cm class 36/48/58/63/68, NOT `depthMm`).*

### Request (filters → UI controls) — unchanged names from v1

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `page`, `limit` | IN | Grid pager | Grid footer | `…/items?page=2&limit=50` |
| `q` | IN | "Search by Code" box (partial match on sku / name) | Landing / top search | `…/items?q=TK6080` |
| `sku[]` | IN | **Exact SKU** filter (repeat or comma-separate; upper-cased; `$in`) | precise lookup / deep link / My-List batch | `…/items?sku=TK6080BZ2,TK7080BZ2` |
| `category` / `subcategory` / `section` | IN | Type-taxonomy sidebar picks | Left sidebar | `…/items?category=Base&subcategory=Sinks` |
| `familyId` | IN | Sibling-code group (client groups cards by family) | (internal) | `…/items?familyId=F333` |
| `leafId` / `groupKey` / `zone` | IN | "Design Tasks" leaf / group / zone | Left "Design Tasks" sidebar | `…/items?leafId=b_water%232` |
| `kind` | IN | Item-type filter (cabinet/alteration/accessory/part) | (filter) | `…/items?kind=accessory` |
| `family` | IN | **PROGRAMME tab** (Primo→P/P1, Contino→C/C1, Avance→A) | Top toolbar — "PROGRAMME" tab group | `…/items?family=Contino` |
| `programs[]` | IN | **PROGRAMME picker multi-select** (ids/names; union of tiers). **Also drives the PROGRAMME half of pill greying** server-side (§2c) | "Programme for … units" modal — highlighted chips | `…/items?programs=AVENIDA&programs=BONDI-A` |
| `priceProgram` | IN | **PROGRAMME dropdown** — the programme to **PRICE** cards in (`pts`). NOT a grid filter | Top toolbar — Programme SELECT DROPDOWN | `…/items?priceProgram=BOSSA` |
| `tier` | IN | **FRONTS pill** (P·P1·A·C·C1) | Top toolbar — "FRONTS" pill group | `…/items?tier=P1` |
| `opening` | IN | **OPENING toggle** (P1 \| C1). AND-composes with `tier`/`family` | Top toolbar — "OPENING" pill | `…/items?opening=P1` |
| `widthMm` | IN | **W pill** (cm×10 → mm) | Grid filter bar — W row | `…/items?widthMm=600` |
| `heightClass` | IN | **H pill** (73·80·86 coarse bucket, not `heightMm`) | Grid filter bar — H row | `…/items?heightClass=80` |
| `depthClass` | IN | **D pill** — nominal depth CLASS in cm (36·48·58·63·68). Ports the app's `depthOk`: matches when the class is in the unit's **`capabilities.depthClasses`** (however the catalog expresses depth — see §2c-2), or the unit has no carcass depth at all (empty/absent → rides every class). **58 and 63 are pass-through** (the app short-circuits them). Carcass = class×10−20. | Grid filter bar — D row | `…/items?depthClass=68` |
| `depthMm` / `heightMm` | IN | Exact carcass depth / height (mm) — precise, **not** the grid class rows | (precise filter) | `…/items?depthMm=560` |
| `line` / `tallHeight` | IN | **TALL** two-row height selector (carcase LINE 73/80/86 + dynamic HEIGHT cm). TALL only. Options from `GET tall-heights` (§6b) | Tall toolbar — top + second pill rows | `…/items?zone=Tall&line=80&tallHeight=204` |
| `suspended` | IN | **TOE-KICK "Suspended" toggle** — the `engineering` `suspended` flag (ok=true) | Top toolbar — TOE-KICK · Suspended | `…/items?suspended=true` |
| `active` | IN | Active-only flag | Admin | `…/items?active=true` |
| `groupBy=family` | IN | **Grid card grouping** — one card per family ("N types"); pages by family | Grid — the card grid itself | `…/items?leafId=b_cool%230&groupBy=family` |
| `full` | IN | Include the detail-only blobs (§3) that `LIST_OMIT` strips | (dev / when the card needs a detail field) | `…/items?q=T6073VE&full=true` |
| `grey` | IN | **GREY, DON'T HIDE** — skips the `depthClass` HARD-filter so the family's native face returns as a (greyable) card instead of being hidden; the client then greys it via `availableFromCaps` (§2c-6). Depth is the one gate the backend hid rather than greyed; this routes it through the grey path. | Top toolbar — "Grey don't hide" toggle | `…/items?depthClass=68&grey=true` |
| `refs` | IN | **Pill-target caps map** — attaches a page-level `refs{ sku → {capabilities,…} }` covering every pill's TARGET sku on the returned cards, so the grid can gate pills by the TARGET's caps (not the parent's) without a per-pill detail fetch (§2c). The list analogue of detail `expand=refs`. | (no visible control — enables per-pill greying) | `…/items?leafId=b_water%232&refs=true` |

> **`availableTiers` precedence** (one filter, most-specific wins): `tier` (FRONTS pill) → `programs[]`
> (picker) → `family` (tab). The tier gate narrows ONLY design-zone cabinet families (Base/Tall/Wall);
> Alteration / Accessories / Handles / Lighting / … always ride through (null-inclusive). `opening`
> (P1/C1) is an INDEPENDENT `$and` toggle. Dimension filters are null-inclusive (a dimensionless
> accessory/part is never hidden by a W/H/D pill). All compose freely.
>
> **The tier/depth/opening/suspended grid FILTERS (which cards return) are separate from the pill-GATE
> model of §2c (which pills inside a card grey).** The grid filters are computed server-side in
> `buildItemFilter`; the pill gates are computed client-side from each pill target's `capabilities`.
>
> **Card = family, not unit** (unchanged from v1). Default (no `groupBy`) returns one row per UNIT (sku);
> the grid shows one card per FAMILY. Use `groupBy=family` so pagination lines up with the card grid.
> Grouped cards carry `unitCount`, `memberSkus[]`, `familyId`, family-wide `availableTiers`, and a
> `section` header. The face (card) unit follows the active `tier` filter; `faceForTiers` records which
> tier contexts a unit is the family face in.
>
> **⭐ Face-selection order (which unit represents the family card — reproduces the app's `selectedUnit`).**
> When a filter removes the exact default-face unit, the face falls back so it keeps the family's DEFAULT
> look, not the lowest/first unit. The `familyGroupStages` sort is, in order:
> `faceForTiers` match (`_faceRank`) → tier (`_tierRank`) → `widthMm` ASC → **`faceHeightClass` match**
> (`_faceHeightRank`: prefer the default-face HEIGHT, so H=ALL keeps the 80-line face, not 73) →
> **`faceVariantCore` match** (`_faceVariantRank`: keep the default VARIANT — XTR_Z stays `…ZW`, not `…ZBS`)
> → `heightMm` → `depthMm` ASC (base depth wins the face, so D=68 greys the native 58 face rather than
> swapping to a 68 sibling) → `sku`. `faceHeightClass` / `variantCore` / `faceVariantCore` are
> per-unit denormalized fields (backend-computed from `faceForTiers`+`heightClass`+sku, backfilled;
> not part of the export contract). **KNOWN GAP: membership + width-preferring face are still unit-level**
> — see `client-ui-parity-audit.md` §G (SNK8-type families).

### Response (per-card fields → card slots) — v2 names

*One card (`TK6080BZ2`). Image = built `imageUrl` · title = `name` (+ amber `nameQualifier`, `handedLR`
"L/R") · `sku` + dims (`widthMm`/`heightMm`/`depthMm`) · **H/W/D + Programme** pill rows =
`parameters.*` (state DERIVED — §2c) · bottom-right tier badges = `availableTiers` · price pill = `pts`
(+ `priceUnit`).*

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `sku` | OUT | Order code + Copy (⧉) | Card — under title / ⧉ | `…/items?limit=1` → `items[0].sku` |
| `name` | OUT | Card title | Card — title line | `…/items` → `items[].name` |
| `nameQualifier` | OUT | Amber sub-label after the title ("Mid 45 cm deep") | Card — right of title | `…/items?q=TSP6080BZ2` → `items[].nameQualifier` |
| `handedLR` | OUT | **"L/R" badge** (available left OR right hinged) | Card — right of title | `…/items?q=TSP6080` → `items[].handedLR` |
| `familyId` | OUT | The family the card represents | Card — grouping key | `…/items` → `items[].familyId` |
| `availableTiers[]` | OUT | **FRONTS tier badges** (bottom-right). The client derives the top-right **programme summary chip** from this (v2 has no stored `programmeBadge`) | Card — bottom-right | `…/items` → `items[].availableTiers` |
| `faceForTiers[]` | OUT | Which tier contexts this unit is the family FACE card in (`_`/`P`/`A`/`C`) | (grouping / face selection) | `…/items?full=true` → `items[].faceForTiers` |
| **`capabilities`** | OUT | **The pill-gate rule inputs** — the client reads a pill TARGET's capabilities to decide grey/live (§2c/§2d). Ships on **every** list row (NOT in `LIST_OMIT`) so the grid can gate pills without a detail fetch | Card — (drives pill state) | `…/items?limit=1` → `items[0].capabilities` |
| `parameters.width[]` | OUT | **W** pill row | Card — Configure rows | `…/items` → `items[].parameters.width` |
| `parameters.height[]` | OUT | **H** pill row (73/80/86) | Card — Configure rows | `…/items` → `items[].parameters.height` |
| `parameters.depth[]` | OUT | **D** pill row (a pill may be `alteration:true` = 63 cm depth alteration; depth pills also carry `code`, §2c-1). These are the classes the ROW draws — **not** what the `depthClass` filter matches (that reads `capabilities.depthClasses`, §2c-2) | Card — Configure rows | `…/items` → `items[].parameters.depth` |
| `parameters.programme[]` | OUT | Programme / tier pills — each `{tier, sku, opening?}` | Card — bottom-right | `…/items` → `items[].parameters.programme` |
| `parameters.options[]` | OUT | Coded rows flattened — each `{group, label, sku, swatch?}` (Ty / Runner / Finish / Insert / …) | Card — Configure rows | `…/items` → `items[].parameters.options` |
| `heightExtension` | OUT | **"217+" chip** appended to the H row → 230/244/250 cm (Tall only; opens the 217 cm unit + `MPHVERL`). Its own field, NOT part of `parameters.height` — §2c-3 | Card — Configure H row | `…/items?q=HP20146` → `items[].heightExtension` |
| `doorLineYCode` | OUT | Not rendered — the ORDER CODE the ⧉ Copy button must emit when the toolbar picks door-line **Y** (Y replaces the whole code) — §2c-3 | Card — ⧉ Copy | `…/items?q=MGT601468` → `items[].doorLineYCode` |
| `imageUrl` | OUT | Product image (built from `meta.imageUrlTemplate ⊕ sku`) | Card — image area | `…/items` → `items[].imageUrl` |
| `widthMm` / `heightMm` / `depthMm` | OUT | Dims line ("W 800 mm · H 792 mm") | Card — under title | `…/items` → `items[].widthMm` |
| `pts` | OUT | **Price pill NUMBER** for the priced programme (`priceProgram`, or a sole `programs`). Absent when no programme is priced | Card — bottom-right pill | `…/items?sku=GFVK8080SZ2M&priceProgram=BOSSA` → `items[].pts` |
| `priceUnit` | OUT | **Price-pill UNIT** — "pts" vs "HLP" (dealer-list calc groups 15/38/61). Per-item, always present | Card — inside the pill | `…/items?q=EBF10058` → `items[].priceUnit` (= "HLP") |
| `sinkFitment` | OUT | **"Max Sink Size: NN″"** line + **"+ Add Sink"** popup (Base/Sinks, `showOnCard`) | Card — bottom row / button | `…/items?q=TSP6080BZ2` → `items[].sinkFitment` |
| `appliance` | OUT | **Appliances popup** (brand · category · subcategory · nicheSize) | Card — bottom-left (housing fronts) | `…/items?full=true&q=GFVK8080` → `items[].appliance` |
| `inspiration` | OUT | **Inspiration lightbox** (imageUrl · caption · heading) | Card — camera icon top-left | `…/items?q=AGFV6080` → `items[].inspiration` |
| `types` | OUT | **"N types" count** (distinct families in the filtered set) | Grid — header | `…/items?leafId=b_cool%230` → `types` |
| `unitCount` / `memberSkus[]` | OUT | Units collapsed into the card / every code in the family (grouped mode) | Card — variant count / pill targets | `…?groupBy=family` → `items[].unitCount` |
| `section` | OUT | **Grid section header** (cards stacked under it) | Grid — section divider | `…?groupBy=family` → `items[].section` |
| `pagination.total` / `page` / `pages` | OUT | Pager (grouped: total = family count) | Grid footer | `…/items` → `pagination.total` |

> **What `LIST_OMIT` strips from list rows** (add `full=true` to get them): `description`,
> `restrictions`, `planningNotes`, `didYouKnow`, `modifications`, `engineering`, `finishes`,
> `alterations`, `accessories`, `companions`. Everything else — including **`capabilities`,
> `parameters`, `heightExtension`, `doorLineYCode`, `finishInterior`, `sinkFitment`, `appliance`,
> `inspiration`, `priceGroupRef`, `frontModifiers`, `carcaseLine` — ships on every card**.
> `capabilities` and `parameters` are kept on purpose: the grid card is a live mini-configurator and
> needs both to render + gate its pills; `heightExtension` and `doorLineYCode` for the same reason —
> the card draws the `217+` chip and its ⧉ Copy must emit the right order code without a second call.

---

## 2b. `GET /design-book/items/by-section` — grid, PRE-grouped by section header

Same grid as `GET items`, but the response is already bucketed into the on-screen **section headers**.
Cards are **families** (same collapse as `groupBy=family`). Accepts **every** `GET items` filter.

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `sections[].section` | OUT | Section header text | Grid — section divider | `…/items/by-section?leafId=b_water%232` → `sections[].section` |
| `sections[].count` | OUT | Cards in that section | Grid — per-section count | `…` → `sections[].count` |
| `sections[].cards[]` | OUT | The family cards under that header (same shape as §2 `items[]`) | Grid — cards below the header | `…` → `sections[].cards` |
| `types` | OUT | "N types" (total families across sections) | Grid — header | `…` → `types` |
| `pagination.total` / `page` / `pages` | OUT | Pager (total = family/card count) | Grid footer | `…` → `pagination.total` |

> Each `cards[]` entry carries `familyId` / `unitCount` / `memberSkus[]` / family-wide `availableTiers`,
> and the card annotations flow through (`nameQualifier`, `handedLR`, `sinkFitment`, `appliance`,
> `inspiration`, `pts`/`priceUnit`, **`capabilities`**, **`parameters`**). Paging is by family (card),
> not by section — a section straddling a page boundary appears on both pages; merge buckets by
> `section` on scroll. **Send `programs`** here so the backend greys the PROGRAMME half of each card's
> pills (§2c) — this is the endpoint the grid actually calls.

---

## 2c. ⭐ Pill state — the CAPABILITIES gate model (replaces v1 §2c–§2e)

How the client decides that a W / H / D / Programme / coded-row pill is **live**, **selected**, **grey**,
or **dead**. In v2 a pill stores **no state** — only `{label\|tier, sku, …}` (a depth pill adds `code`,
the order code at that class — data, not state; §2c-1). State is derived per read:

| State | Rule | Render | Clickable? |
|---|---|---|---|
| **DEAD** | `pill.sku == null` (no target code exists) | greyed, `grayscale`, `not-allowed` | **no** |
| **SELECTED** | `pill.sku === item.sku` — **except on a `depth` row**, see §2c-1 | filled accent | inert (already here) |
| **GREY** | `availableFromCaps(targetItem.capabilities, toolbarState) === false` | grid card: **struck** · detail drawer: **greyed** | **yes** → still opens the sibling sku |
| **LIVE** | otherwise | normal | **yes** → opens `pill.sku` |

To resolve a pill the client:
1. reads `pill.sku` → **DEAD** if null;
2. compares to the current unit's `sku` → **SELECTED** if equal (`depth` rows: select by LABEL, §2c-1);
3. looks up the **TARGET item's `capabilities`** (already on the card / in `refs`) and runs
   `availableFromCaps(caps, toolbar)` → **GREY** if false, else **LIVE**.

On CLICK every row navigates (`GET items/{pill.sku}`) — **except a `depth` pill that points at the item
itself, which must NOT fetch**. Full handler: **§2c-4**.


### 2c-1. ⭐ SELECTED — navigation rows vs DEPTH (state) rows

The `pill.sku === item.sku` test above holds only where every pill in the row points at a **different**
sibling unit — `width`, `height`, `programme`, and most `options` groups. A **`depth` row is different**
and must be rendered by the rule below, or several pills light up at once.

**Why.** In the app a depth chip is `setDepth(cc)` / `pickDepth(id,cc)` — it changes depth state and
**stays on the same unit**. There is no sibling code to go to: `u.d = [36,48,68]` says *this* cabinet is
orderable at those depths. What changes is the **order code**, which `assemble()` re-cuts:

```js
parseCanon(c) = c.match(/^([A-Z]+)(\d+)([A-Z0-9]*)$/)          // pre · dig · fn
if (depth !== 58 && u.d.includes(depth)) c = pre + dig + depth + fn
// T6080IS2IZ @ 36 → T608036IS2IZ    @ 48 → T608048IS2IZ    @ 68 → T608068IS2IZ
```

So the pill keeping the unit's OWN sku is **correct** — that is the item you stay on. The depth-cut
codes are **synthesized, never stored as units** (same status as the `P1`/`C1` prefixes), so the export
ships them **on the pill** as **`code`**:

```jsonc
"depth": [
  {"label":"36","sku":"T6080IS2IZ","code":"T608036IS2IZ"},
  {"label":"48","sku":"T6080IS2IZ","code":"T608048IS2IZ"},
  {"label":"58","sku":"T6080IS2IZ","code":"T6080IS2IZ"},
  {"label":"63","sku":"T6080IS2IZ","code":"T6080IS2IZ","alteration":true},
  {"label":"68","sku":"T6080IS2IZ","code":"T608068IS2IZ"}
]
```

`code` is written on **every pill of a re-cut depth row** (9,390 pills over 2,348 items; 4,858 of them
differ from `sku`) and is **absent everywhere else** — where the order code simply IS `sku`. So read
**`pill.code ?? pill.sku`** and never re-derive. Absence of `code` does NOT mean "different item" — see
§2c-2 for the actual discriminator (`pill.sku`).

**Render rule for a `depth` row:**

```js
// 1. Which pills are state pills (stay here) vs real siblings (navigate).
const isStatePill = p => p.sku === item.sku || p.code != null;   // → set the depth, re-render in place
                                                                 // else → open p.sku (a real sibling)
// 2. Which class is chosen — the app's cardDepth(id,u): per-card pick → top D bar → 58.
const chosen = [cardPick[item.sku], toolbarDepthClass, 58]
  .find(v => v != null && pills.some(p => String(p.label) === String(v)));

// 3. ⚠️ Rows are commonly MIXED (siblings + self pills — 7,458 of 11,551, §2c-2). Honour `chosen`
//    ONLY when that pill is a state of THIS item. If it maps to a sibling we are not on that item,
//    so fall back to this item's own NATIVE pill (the self pill that is not the 63 alteration).
//    Skip this and the sibling pill renders "selected", stops being clickable, and BLOCKS the
//    navigation — and plain sku-equality instead lights up several pills (63 alteration + native).
const at     = pills.find(p => String(p.label) === String(chosen));
const own    = pills.filter(p => p.sku === item.sku);
const native = own.find(p => !p.alteration) ?? own[0] ?? null;
const selLabel = (at && isStatePill(at)) ? chosen : native?.label ?? null;
const isSelected = p => selLabel != null && String(p.label) === String(selLabel);  // by LABEL, never by sku

// 4. The ORDER code to display / copy at the chosen class — stored, not computed.
const orderCode = pills.find(p => String(p.label) === String(selLabel))?.code ?? item.sku;
// carcass mm at that class = chosen × 10 − 20
```

Worked example of step 3. `C1T3080S2Z` (mixed: 36/48/68 are siblings, 58/63 are self) with the toolbar at
D=68 → `at` is the 68 **sibling** pill → fall back to `native` = the 58 self pill → 58 renders selected and
68 stays clickable. Click it → you are now on `C1T308068S2Z`, whose row is `36 48 58 63* 68` with 63 and 68
both self; `chosen`=58 maps to a sibling again → `native` = 68 (63 is the alteration) → exactly one lit.

Notes:
- **58 and 63 carry the BASE code.** `assemble()` maps depth 63 → 58; the app expresses 63 cm as base
  cabinet **+ alteration codes** in the clipboard (`d63Set` → `ANTSP63US` · `MPRU` · `ANSVVO275` for
  door sinks / `ANHST63` tall / `ANTST63`), not in the code itself.
- **Zero selected pills is legal** — when the row offers neither the chosen class nor 58, the app draws
  no highlighted chip either. Never fall back to "select the first pill".
- **Group `options` by `.group` before counting** — `options` is one flat array, so a row is everything
  sharing a `.group`. Every option row is plain navigation (incl. `Insert`, see §2c-3), so
  `selected = pill.sku === item.sku` picks exactly one there. Depth is the only exception on this page.
- **Guard against a duplicated sku anyway.** If two pills in a non-depth row ever share the item's sku
  that is bad data, not a model — mark **none** rather than all, so nothing renders wrongly selected.
- Reference implementation: `depthOptsForCard()` / `depthCodeFor()` / `cardDepthOf()` / `selMark()` in
  `D4K-backend/public/design-book-ui.html`.
- **Writing the click handler? → §2c-4** — selection + the fetch / don't-fetch decision as one
  copy-paste function.

> **The pill's own item does NOT carry the answer** — the answer lives on the item the pill points at.
> Grid cards ship `capabilities` on every row (so same-family sibling targets are already present); the
> detail drawer gets sibling capabilities via `refs` (§3). Strike-vs-grey is a **surface**, not a field:
> the grid renderer strikes (`line-through`), the detail renderer greys (`opacity`). Same GREY state.

### 2c-2. ⭐ The TWO depth models — how to tell them apart, and why one rule covers both

The catalog expresses "this cabinet at 68 cm" in two different ways, and a single row can contain both.

| | **A · depth is an ALTERATION** | **B · depth is a SEPARATE ITEM** |
|---|---|---|
| Source | `u.d = [36,48,68]` on the unit | an `f.dim === 'depth'` family |
| Clicking the pill | stays on the **same item**, re-cuts the ORDER CODE | **opens a different sku** |
| Example | `T6080IS2IZ` @68 → code `T608068IS2IZ` | `C1T3080S2Z` @68 → item `C1T308068S2Z` |
| `pill.sku` | the item's own | the sibling's |
| `depthMm` | native carcass only; effective = class×10−20 | the sibling's real carcass mm |

#### The discriminator is `pill.sku` — NOT the presence of `code`

```js
pill.sku !== item.sku   // → B: a SEPARATE ITEM. Navigate to it.
pill.sku === item.sku   // → A: the SAME item. Order code = pill.code ?? item.sku.
```

`pill.sku !== item.sku` is therefore also the **fetch** condition — the click handler is in **§2c-4**.

`code` is written on **every pill of a re-cut row** — including the `58` and `63` pills where it equals
`sku` — so *`code` present ⟹ same item*, but **the converse does not hold**: a self-pointing pill with no
`code` is still the same item, it simply needs no re-cut (it is the native class, the 63 alteration, or a
unit with no real carcass depth). Always read `pill.code ?? pill.sku` for the order code, and `pill.sku`
for navigation; both are safe on every row.

#### The real row taxonomy (11,551 depth rows in v781)

| shape | rows | what it looks like |
|---|---|---|
| **Mixed — siblings + self pills** | **7,458** | most common. Sibling pills navigate; the native-class and 63 pills point at self |
| A — all self, with re-cut codes | 2,348 | `u.d` non-empty → 4,858 pills whose `code` differs from `sku` |
| A — all self, no re-cut | 1,745 | e.g. a bare `58 · 63` row: same item at both, code = sku |

So "depth is a separate item" is the **majority** case at row level, while "depth is an alteration" is what
makes 4,858 pills carry a distinct order code. Neither is the general rule — which is why the gate below,
not the row shape, decides filtering.

#### One gate covers both

`capabilities.depthClasses` = `D2CODE[u.D] ∪ u.dv ∪ u.d` — every class the unit can be *ordered* in, no
matter which mechanism gets it there:

```js
depthOk = picked === 58 || picked === 63 || caps.depthClasses.includes(picked)
```

This is simultaneously the **pill/card greying** rule (§2c) and the **`depthClass` grid filter** (§2).
Type A `T6080IS2IZ` has `[58,36,48,68]` → returned at D 36/48/68. Type B `C1T308068S2Z` has `[68]` →
returned at 68 only. A depthless accessory has `[]` → rides every class.

> ⚠️ **Never filter the grid on `parameters.depth[].label`.** That asks "does this unit's row *draw* a 68
> pill", not "can this unit *be* 68 deep". `C1T308036S2Z` is a 340 mm cabinet whose row draws a 68 pill;
> label-matching put 3,792 wrong cabinets under D=68 and dropped 2,369 / 4,452 units at 58 / 63 even though
> the app passes those through unconditionally.

---

### 2c-3. ⭐ The rest of the order-code surface — every input that is NOT a pill target

Depth is the loudest case but not the only one. The app builds the order code in **`assemble(u, ov)`**
(`leicht_units__781_.html:2419`) from five inputs, and only one of them is a configure-pill row. Audited
exhaustively 2026-07-21; this table is the whole surface.

| input | driven by | code mutation | in the export as |
|---|---|---|---|
| depth `u.d` | **Depth pill row** | `pre + dig + <class> + fn` | `parameters.depth[].code` (§2c-2) |
| depth 63 | Depth pill row | none — clipboard set `[code, ANTSP63US, MPRU, …]` | `alteration:true` on the pill; recipe documented |
| open `P1` / `C1` | Programme pill row **and** toolbar | `c = 'P1'+c` / `'C1'+c` | the pill's `sku` already holds the synthesized code; gate = `capabilities.openP1/openC1` |
| handle `V` | card band + toolbar (**no pill row**) | `c = 'V'+c` | derive from `capabilities.handleFree` |
| front `E` | card band + toolbar (**no pill row**) | `c = c+'E'` | derive from `capabilities.onePieceFront` |
| door-line `J` | card band + toolbar (**no pill row**) | `c = c+'J'` | derive from `capabilities.doorLineJ` |
| **door-line `Y`** | card band + toolbar (**no pill row**) | **`return u.Yc`** — replaces the WHOLE code | **`item.doorLineYCode`** — see below |
| **height `217+`** | chip appended to the **Height row** | none — opens the 217 cm unit, clipboard `[code217, MPHVERL]` | **`item.heightExtension`** — see below |
| sinks (implicit) | no control at all | none — clipboard `[code, MPRU, (ANSVVO275)]` | recipe documented; fires for every Base/Sinks unit |

**Width, Height and all 16 coded/option rows are plain navigation** — the full v781 set is
`Ty · Runner · Unit depth · Set · Length · Insert · Thickness · Finish · Lighting · Variant · Edge finish ·
Visible side · Edge · Operation · Configuration · Radius`. (v1's `Mode` / `Config` row labels no longer
appear in the data.) They all go through one helper —
`chip = (label, code) => code == null ? disabled : onclick="openDetail(f.id, code)"` — whose target is
always a real `x.c` off `f.units`. There is **no `u.w` or `u.h` array** anywhere in the source data, so
width and height structurally cannot have the depth problem. Measured over all 18,396 items: 0 rows with
a duplicated sku and 0 rows with more than one self-pointing pill on any of those rows, so
`selected = pill.sku === item.sku` stays correct everywhere except `depth`.

> The `Insert` (`L3/M3` · `M8`) row used to look like an exception — both pills carried the item's own sku.
> That was an extraction bug, not a model: `pickInsert` sets `blockIns[fid]`, which `insPool()` uses to
> filter the family pool, so the pill *does* land on a different **stored** unit (`ZIGSUV20` ↔ `ZIGSUV20U`)
> — its onclick just carries no target. Fixed in the extractor and backfilled; all 92 rows now navigate.

#### `item.doorLineYCode` — the one code that cannot be derived

`V` / `E` / `J` / `P1` / `C1` are prefixes or suffixes on the sku, so a client can build them from the
capability flags. **`Y` replaces the whole code** (`assemble` line 1: `if (dl==='Y' && u.Yc) return u.Yc`),
so the literal string has to ship. 11 units in v781 — exactly those with `capabilities.doorLineY`.

```js
// order code for the current toolbar
if (toolbar.doorline === 'Y' && item.doorLineYCode) code = item.doorLineYCode;   // MGT601468 → MGT60146Y
```

`capabilities.doorLineY` is the **gate** (does this unit exist in line 66); `doorLineYCode` is the **code**.
Set both or neither.

#### `item.heightExtension` — the "217+" chip

Tall products (never `Appliance housing`) whose family holds an orderable 217 cm unit can be built past
217 cm. The app appends a collapsed `217+` chip to the **Height row**; tapping expands it to 230 / 244 /
250 cm, and picking one opens the **217 cm unit** with `MPHVERL` ordered alongside — the height twin of the
63 cm depth alteration. 2,046 units / 83 families in v781.

```jsonc
"heightExtension": {
  "sku": "HP20217",                 // the unit the chip opens — the extension is ordered on THAT unit
  "addCode": "MPHVERL",             // ordered alongside it
  "options": [ {"label":"230","heightMm":2304},
               {"label":"244","heightMm":2436.5},
               {"label":"250","heightMm":2500} ]
}
```

Render it as its own row appended after `Height`. **It is deliberately not part of `parameters.height`:**
families like the HP20 panels also have **real** 230 / 250 cm sibling units, so the labels would collide —
one `230` that opens a different product, another that extends this one. `GET items/HP20146` shows both at
once (`Height: H146 … H230 H250` plus `217+: 230 244 250`).

**⚠️ The `217+` row NAVIGATES first, then holds state — it is not a pure state row like depth.** Only the
217 cm unit can BE extended, so where you are decides what a chip means:

| you are on | a `217+` chip is | `selected` | order code |
|---|---|---|---|
| a **shorter sibling** (`HP20146`, `item.sku !== heightExtension.sku`) | plain **navigation** — opens `heightExtension.sku`, carrying the choice | **never** — nothing is lit | the unit's own code, untouched |
| the **217 unit** (`HP20217`, `item.sku === heightExtension.sku`) | **state** — re-clicking the lit chip clears it | the picked label | `[heightExtension.sku, heightExtension.addCode]` |

101 of the 2,046 units are the 217 units themselves, and they carry a self-referential
`heightExtension.sku === sku` — which is what makes the pick land somewhere it can render.

Two things this forces on a client:

- **Never mark a chip `selected` while `item.sku !== heightExtension.sku`.** The header would show the
  short unit's own unextended code while a chip claimed 250 cm.
- **Key the pick by `heightExtension.sku`, not by a bare label**, so it survives the hop onto that unit.
  A reset-on-navigate effect keyed on the current sku (the right thing for the depth pick) otherwise
  wipes the choice in the same commit that acts on it.

```js
// one handler, both halves
function pickHeightExt(item, opt) {
  const hx = item.heightExtension; if (!hx) return;
  if (item.sku !== hx.sku) { setPick({sku: hx.sku, label: opt.label}); return open(hx.sku); }
  setPick(isSelected(opt) ? null : {sku: hx.sku, label: opt.label});   // on it → toggle
}
// selected, and the clipboard's second line, only ON the 217 unit
const here = item.sku === hx.sku;
const lines = here && pick?.sku === hx.sku ? [hx.sku, hx.addCode] : [depthResolvedCode];
```

Reference implementation + the live trace it was verified against: `D4K-backend/public/design-book-ui.html`
(`hextPills` / `pickDrawerHext`).

##### Does clicking the `217+` chip call the server?

Only when it navigates — there is **no dedicated `217+` endpoint**. In plain terms, three outcomes:

- **Expanding `217+` to reveal 230 / 244 / 250** → **no call.** The options ship inside
  `item.heightExtension.options`, so opening the collapsed chip is entirely client-local.
- **Picking a value while on a shorter sibling** (`item.sku !== heightExtension.sku`) → **one call:**
  `GET items/<heightExtension.sku>` — the `open(hx.sku)` above. This is the *only* network hit the chip
  ever makes, and it is the ordinary sibling-navigation fetch every other navigating pill makes.
- **Picking / re-clicking while already on the 217 unit** (`item.sku === heightExtension.sku`) → **no call.**
  Pure local state — the order code just becomes `[hx.sku, hx.addCode]`, the image stays on `hx.sku`.

`MPHVERL` is never fetched, routed, or imaged — it is an order/clipboard code only.

---

### 2c-4. ⭐⭐ DEPTH PILL — which one is selected, and when a click must call `GET items/:sku`

The one row on the whole page where a click is **sometimes an API call and sometimes not**. Everything
here is a restatement of §2c-1 (selection) + §2c-2 (the two models) as one copy-paste handler; read those
for the *why*, this section for the *what to write*.

**The rule in one line:** the fetch decision is `pill.sku !== item.sku`, and the selection decision is by
**label**, never by sku.

#### The 4 things a depth pill can be

| # | Pill shape | Meaning | Click → | API call? |
|---|---|---|---|---|
| 1 | `pill.sku !== item.sku` | **sibling unit** — depth is a separate product (model B) | navigate to that unit | ✅ **YES** — `GET items/{pill.sku}?expand=all` |
| 2 | `pill.sku === item.sku` + `pill.code` ≠ sku | **same unit, re-cut order code** (model A, `u.d`) | set local depth state | ❌ **NO** |
| 3 | `pill.sku === item.sku`, no `code` / `code === sku` | same unit, native class or a code-less class | set local depth state | ❌ **NO** |
| 4 | `pill.alteration === true` (the `63`) | same unit + alteration codes in the clipboard | set local depth state, add `d63Set` codes | ❌ **NO** |

Shapes 2–4 change **nothing on the server**. The item, its `capabilities`, its image, its price group and
every other row are unchanged — only the displayed/copied order code and the effective carcass mm move.
Re-fetching there is a wasted round-trip **and** re-renders the row from scratch, losing the local depth
pick.

#### ⚠️ NEVER fetch `pill.code`. It is DISPLAY / COPY only.

The depth-cut codes are synthesized and **never stored as units**, and — unlike the `P1`/`C1` prefixes,
which the backend *does* synthesize on read — nothing resolves them:

```bash
GET /design-book/items/T6080IS2IZ      → 200   # the stored unit          (pill.sku)
GET /design-book/items/T608036IS2IZ    → 400   # the depth-cut order code (pill.code)  ← never call this
GET /design-book/items/P1T3080S        → 200   # tier prefix IS synthesized on read
```

Same "synthesized, never stored" phrase, opposite API behaviour. So: **route, fetch and build the image
from `pill.sku`; show and copy `pill.code ?? item.sku`.** `imageUrl` stays on `item.sku` at every depth.

#### The complete handler

```js
// ── SELECTION (which pill is lit) ────────────────────────────────────────────
// by LABEL, never by sku — several pills share item.sku on a depth row.
function selectedDepthLabel(item, pills, cardPick, toolbarDepthClass) {
  const isStatePill = p => p.sku === item.sku;               // stays here (shapes 2-4)
  const chosen = [cardPick, toolbarDepthClass, 58]           // the app's cardDepth(id,u)
    .find(v => v != null && pills.some(p => String(p.label) === String(v)));
  const at     = pills.find(p => String(p.label) === String(chosen));
  const own    = pills.filter(isStatePill);
  const native = own.find(p => !p.alteration) ?? own[0] ?? null;
  // MIXED row (7,458 of 11,551): honour `chosen` only if that pill is a state of THIS item,
  // else fall back to this item's own native pill — otherwise the sibling pill renders
  // "selected", goes inert, and BLOCKS the navigation.
  return (at && isStatePill(at)) ? String(chosen) : (native ? String(native.label) : null);
  // null is legal — the app draws no lit chip either. Never "select the first pill".
}

// ── CLICK ────────────────────────────────────────────────────────────────────
function onDepthPillClick(item, pill) {
  if (pill.sku == null) return;                              // DEAD — not clickable
  if (pill.sku !== item.sku) {                               // shape 1 → REAL navigation
    return openItem(pill.sku);                               // GET items/{pill.sku}?expand=all
  }
  setCardDepth(item.sku, pill.label);                        // shapes 2-4 → NO fetch
  setOrderCode(pill.code ?? item.sku);                       // display / Copy button only
  setEffectiveDepthMm(Number(pill.label) * 10 - 20);         // carcass mm at that class
  if (pill.alteration) addClipboardCodes(d63Set(item));      // 63 → ANTSP63US · MPRU · …
}
```

`openItem(sku)` is the same call the grid makes for any other pill — pass the toolbar's `programs=` and
`priceProgram=` through so the new unit comes back with its programme greying already stamped (§3).

Note a **GREY** depth pill is still clickable (§2c) — greying gates *availability*, not navigation, so a
grey shape-1 pill still fetches.

#### Checklist — the four bugs this prevents

1. **Selecting by `sku === item.sku`** → every self pill lights up (native **and** the 63 alteration).
2. **Honouring the toolbar class on a mixed row** → a *sibling* pill renders selected, goes inert, and the
   user can never leave the current unit.
3. **Fetching on every depth click** → `GET items/T608036IS2IZ` **400s**, or (at best) a pointless
   round-trip that resets the local depth pick.
4. **Filtering / routing / image-building on `code`** → nothing resolves; use `capabilities.depthClasses`
   for filtering (§2c-2) and `sku` for everything addressable.

---

### 2c-5. ⭐ `showUnderLine` — the WIDTH/HEIGHT row collapses to the active carcase LINE

Distinct from greying. When the toolbar selects a carcase **LINE** (73 / 80 / 86), the client **narrows
the card's Width and Height rows** to the pills that render under that line — it does not grey the others,
it removes them. `parameters.width[].showUnderLine` / `parameters.height[].showUnderLine` is a per-pill
`number[]` of the lines that pill shows under (schemaVersion 2.3).

- **DATA, not a rule** — the mapping is family-dependent (captured from the app, backfilled), so it ships
  on the pill, not as a formula.
- **H86 stays paired with 73** — 86 is the J-door on the 73 carcase, so `H86.showUnderLine = [73, 86]`;
  picking line 73 keeps both 73 and 86.
- **Absent ⟹ always show** (height-CLASS rows on Tall/Wall/Midway don't collapse — §A #1b). **Depth rows
  never carry it.** No line selected ⟹ show every pill.
- **Render:** `visibleByLine(pills)` = `pills.filter(p => !p.showUnderLine || p.showUnderLine.includes(line))`
  where `line` = the active toolbar line (or the card's `heightClass` when the toolbar has none). Applies to
  the W and H rows only.
- **Editable** in admin (per-pill `showUnderLine` column on the width & height pill rows).

### 2c-6. ⭐ GREY, DON'T HIDE — depth routes through the grey gate (`?grey=true`)

The client keeps non-orderable cards **visible-but-greyed**; the backend historically **hard-filtered**
(hid) on `depthClass`. `GET items?...&grey=true` **skips the `depthClass` `$match`** so the family's native
face returns as a card, and the client greys it via `availableFromCaps(card.capabilities, toolbar)` (the
whole-card rule below). The face stays the NATIVE unit (the `depthMm` ASC tiebreak, §face-selection above) —
D=68 greys the 58 face, it does NOT swap to a 68 sibling. `depthClasses` is unchanged (the gate input); only
the hide-vs-grey behaviour moves. Tier/width/height greying rides the same whole-card rule once the card is
returned.

---

### The 8 gates — toolbar control → `capabilities` field(s)

`available(u) = alwaysAvailable || (progOk && tierOk && depthOk && handleOk && frontOk && openOk &&
antosoOk && doorOk)`. Each gate reads the toolbar on one side and the **target's** `capabilities` on the
other. Only `progOk` is also computed server-side (§ below); the other seven are **client-only** (there
is no grid-filter param for handle / front / doorline — they are pure toolbar state used to gate pills).

| Gate | Toolbar control (`ToolbarState`) | Grid-filter param? | `capabilities.*` field(s) read |
|---|---|---|---|
| **progOk** | PROGRAMME picker → `progKeys[]` | `programs[]` (also greys server-side) | `excludedPrograms[]` · `excludedProgramsE[]` (only when `front=1` & `hasEFront`) · `isFrmatFamily` |
| **tierOk** | FRONTS pill → `tier` (P/A/C/P1/C1/ALL) | `tier` (grid) | `nativeTier` (native line) · `opening` (P1/C1 variant) · `twinTiers[]` (tiers with a real sibling) |
| **depthOk** | D pill → `depth` (default 58) | `depthClass` (grid) | `depthClasses[]` (**58 & 63 always pass**) |
| **handleOk** | handle-free selector → `handle` (std/V) | — (client only) | `handleFree` |
| **frontOk** | single-front / Full-E → `front` (0/1) | — (client only) | `onePieceFront` |
| **openOk** | OPENING toggle → `open` (''/P1/C1) | `opening` (grid) | `openP1` · `openC1` · `singleHandle` (passes when true) |
| **antosoOk** | ANTOSO suspended-install → `antoso` | `suspended`* (grid, via `engineering`) | `antosoApproved` |
| **doorOk** | door-line → `doorline` (''/J/Y) | — (client only) | `doorLineJ` · `doorLineY` |

`alwaysAvailable` (`u._c`) short-circuits ALL gates to live. *The grid `suspended` filter is the
`engineering` `suspended` flag, a related-but-separate signal from the `capabilities.antosoApproved` pill gate.

#### Per-gate GREY condition (render reference)

For a pill whose TARGET has `capabilities` `c` and the current `ToolbarState` `s`, the pill (or whole card,
on the card's own caps) renders **GREY** when the target FAILS any gate below. `alwaysAvailable` = never grey.

| Gate | GREY when (target caps `c` vs toolbar `s`) |
|---|---|
| progOk | `s.progKeys` non-empty AND every one ∈ `c.excludedPrograms` (in Full-E, also `c.hasEFront` & ∈ `c.excludedProgramsE`; `c.isFrmatFamily` special) |
| tierOk (P/A/C) | `s.tier` ∉ {ALL, `c.nativeTier`} AND `c.twinTiers` includes `s.tier` (a real twin exists → app swaps to it) |
| tierOk (P1/C1) | `s.tier` ∈ {P1, C1} AND `c.opening !== s.tier` |
| depthOk | `s.depth` ∉ `c.depthClasses` AND `s.depth !== 58` AND `s.depth !== 63` (58 & 63 always pass) |
| handleOk | `s.handle === 'V'` AND `!c.handleFree` |
| frontOk | `s.front === 1` AND `!c.onePieceFront` |
| openOk | `s.open` set AND NOT (`s.open==='P1'?c.openP1:c.openC1`) AND `!c.singleHandle` |
| antosoOk | `s.antoso` AND `!c.antosoApproved` |
| doorOk | `s.doorline` set AND NOT (`s.doorline==='J'?c.doorLineJ:c.doorLineY`) |

> **Frontend mapping:** the client evaluates all 8 gates with `availableFromCaps(c, s)` below (single source
> of truth) and renders per the four-state spec further down. The table above is the human-readable
> per-gate breakdown for building/debugging. For the **authoring** side — what each field means and how to
> SET it so a pill greys — see the CRUD guide `docs/design-book-crud-guide.md` §3a (depthClasses + the
> 58/63 quirk), §3b (nativeTier/opening/twinTiers — the FRONTS twin-swap), §3c (the remaining six gates), §3d (master
> greying table).

### The reference port — `availableFromCaps` (copy verbatim from the schema)

The client evaluates this for every pill (a pill is DEAD when `sku` is null before this even runs):

```ts
function availableFromCaps(c: Capabilities, s: ToolbarState): boolean {
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

`ToolbarState` (the app's `state`, minus render-only bits): `{ depth=58, tier='ALL', open='', front=0,
handle='std', antoso=false, doorline='', progKeys=[] }`. **Defaults (nothing picked) leave every gate
passing** — so with a fresh toolbar every pill with a target is LIVE. FRMAT is the one layered residual:
also `&& !(caps.isFrmatFamily && frmatExcluded(prog))` (layer `FRMAT_MAX[programmeName]` — 1 unit).

> **This RESOLVES v1's "coverage gap."** In v1 only `progOk` was live (resolved server-side); the other
> **seven** gates were frozen at extraction in the app's DEFAULT toolbar, so pills did **not** re-strike
> as the FRONTS tier / depth / handle / front / opening / antoso / door toolbar controls changed. v2
> re-evaluates **all 8 gates live** from each target's `capabilities`, so shipping those toolbar controls
> as live controls now works. (Same family of fix as `faceForTiers` capturing the FRONTS face.)

### The whole-card GREY (GREY, DON'T HIDE) — same rule, on the card's own capabilities

**The app never removes a card because of the toolbar** — an unorderable card stays in its grid slot,
rendered dead (greyed image/title/badges, struck pills, "not available" where the action icons sit). In
v2 the client computes this with the **same** `availableFromCaps`, run on the **card's OWN**
`capabilities` (which ships on every list row) — no `programmeAvailability`, no `full=true`, no separate
predicate. `availableFromCaps(card.capabilities, toolbar) === false` → grey the whole card. A frontend
that filters those cards out client-side will show fewer cards than the app in the same section.

### The backend still greys the PROGRAMME half server-side

`progOk` is the one gate the backend computes for you. When you pass **`programs=<ids/names>`** to
`GET items`, `GET items/by-section`, or `GET items/:sku`, the service runs **`annotateProgrammeExclusions`**:
it collects every pill target sku on the page, looks up each target's **`capabilities.excludedPrograms`**,
and — for a target excluded by **every** selected programme — stamps `available:false` +
`programmeExcluded:true` on that pill in the response. The client can honor that stamp directly instead
of (or as well as) evaluating the progOk gate itself; the other 7 gates it always evaluates locally.

- **Multi-select is a UNION** — a pill dies only when *no* selected programme allows it
  (`programIds.every(p => target.excludedPrograms.includes(p))`). Accepts ids or names.
- **No `programs` → no programme stamps.** Pills carry no `available` field at baseline (§ schema:
  "with no programme selected, pills carry no `available` flag"). The client shows the neutral baseline
  and the other 7 gates decide grey. If you want the programme half greyed too, **you must send
  `programs`** — this was the real bug in the v1 lite UI (correct API, grid sent no `programs`).
- Cost: one extra query per page (the union of the page's pill target skus).

Worked example — `T6080` "Floor unit" under **BOSSA**, in the v2 `parameters` shape:

```bash
# Baseline — no programme. Width pill 15 → T1580 is LIVE (no available field emitted).
…/items/T6080?expand=all
#   → parameters.width[0] = {"label":"15","sku":"T1580"}

# With the programme. T1580 / T2080 list BOSSA in their capabilities.excludedPrograms:
…/items/T6080?expand=all&programs=BOSSA
#   → parameters.width[0] = {"label":"15","sku":"T1580","available":false,"programmeExcluded":true}
#   → parameters.width[1] = {"label":"20","sku":"T2080","available":false,"programmeExcluded":true}
#   → the grid renders both STRUCK, matching the app.
```

### Rendering spec — one function, four visual states

Derive the state once, render per surface. Only DEAD and SELECTED are unclickable; a GREY pill still
navigates to its sibling (the app's struck chip keeps its handler).

| State | Grid CSS (card) | Detail CSS (drawer) | Tooltip | Click |
|---|---|---|---|---|
| LIVE | full opacity | full opacity | — | → opens `sku` |
| SELECTED | filled accent | filled accent | — | inert |
| GREY (`availableFromCaps`=false, sku set) | `opacity:.32; text-decoration:line-through` | `opacity:.4` | `programmeExcluded` → "Not available with the selected programme"; else "Not orderable in this configuration — opens the sibling unit" | **→ still opens `sku`** |
| DEAD (`sku:null`) | `opacity:.3; filter:grayscale(1); cursor:not-allowed` | same | "Not available for this unit — no separate code" | inert |

**Wiring the click** — GREY does NOT mean unclickable; only DEAD (and SELECTED) is. Bind the handler on
`!dead && !selected && sku` (grid → swap card in place; drawer → `openDetail(sku)`). This mirrors the
app's own struck chip, which keeps its `pickHeight(...)` handler. **Reference implementation:**
`D4K-backend/public/design-book-ui.html` (the lite UI) — the shared pill-state helper + the
`availableFromCaps` port; CSS classes `.cp.off`/`.pill.off` (grid strike / drawer grey) · `.dead` · `.sel`.

> **No stored-pill distribution table in v2** (v1 §2c had one). In v1, pills stored an `available`
> boolean, so it was meaningful to count "251,968 true / 4,969 dead / 0 crossedOut" across the export. In
> v2 a pill stores **only** `{label\|tier, sku}` (+ `code` on depth rows) — the sole persisted signal is `sku` (present = has a
> target, `null` = DEAD); everything else is derived at read. `crossedOut` **does not exist** in v2 (it
> was 0/256,937 catalog-wide in v1, produced by no path — dropped from the model entirely).

### Verified parity

`Capabilities` reproduce the app's own `available()` at **99.997%** across **313,842** combinations
(16,518 configure-pill targets × 19 toolbar states). The only residual is **FRMAT** (1 unit), layered
back via `isFrmatFamily` + the `FRMAT_MAX[programmeName]` size table. This is the v2 replacement for v1's
frozen-`available` boolean, which was only correct at the default toolbar.

---

## 2d. ⭐ The `capabilities` object — all 17 fields

One `Capabilities` per item; a pill greys when its TARGET item's capabilities fail a gate (§2c). Every
field is settable at creation via CRUD (`UpsertItemDto.capabilities`).

| Field | Type | Gate it drives | Meaning (app source) |
|---|---|---|---|
| `alwaysAvailable` | bool | **all** (short-circuit) | `u._c` — forces `available:true`, skips every gate |
| `nativeTier` | `"P"\|"A"\|"C"\|null` | tierOk | native line (`u.fam`; null = line-neutral, never greys by tier) |
| `opening` | `"P1"\|"C1"\|null` | tierOk | this unit IS a premium opening variant |
| `twinTiers` | `("P"\|"A"\|"C")[]` | tierOk | non-native tiers that have a REAL sibling sku → grey under that tier |
| `excludedPrograms` | `string[]` | progOk | programme ids the unit is NOT orderable in (`u.x`) — **THE programme rule** (what the backend reads) |
| `excludedProgramsE` | `string[]` | progOk | extra exclusions active only in single-front / "Full-E" mode (`u.xE`) |
| `isFrmatFamily` | bool | progOk | FRMAT max-size-table family — layer `FRMAT_MAX[programmeName]` on top |
| `hasEFront` | bool | progOk | E-capable (needed for the `excludedProgramsE` path) |
| `depthClasses` | `number[]` | depthOk | nominal depth CLASSES (cm) the unit offers. **58 & 63 always pass** |
| `handleFree` | bool | handleOk | no-handle front OR interior module (`u.V \|\| _hFree`) |
| `onePieceFront` | bool | frontOk | one-piece front (`u.E \|\| /\dE$/.test(code)`) |
| `openP1` | bool | openOk | supports the P1 opening variant |
| `openC1` | bool | openOk | supports the C1 opening variant |
| `singleHandle` | bool | openOk | ≤1 stacked front (opening rule always passes when true) |
| `antosoApproved` | bool | antosoOk | inside the ANTOSO suspended-install approval envelope (precomputed) |
| `doorLineJ` | bool | doorOk | door-line J |
| `doorLineY` | bool | doorOk | door-line Y |

---

## 2e. ⚠️ OPEN — section bucketing may not match the app (unverified, carried from v1)

Still open in v2 (the `section` field is unchanged — stored per item straight from the app's family data
`f.sec`, not invented by us). In the client's WAKUU screenshot 5 cards sit under one **"DOOR + DRAWER
COMBINATIONS"** header, but our data gives those families four *different* `section` values, so
`by-section` returns 7 families / 5 sections and buckets only 2 under that header. Either the app's grid
does not bucket by `f.sec` the way we assume, or the screenshot is cropped. **Not yet checked against the
live app** — do that (serve the v781 HTML, pick WAKUU, dump the rendered headers + card codes) before
changing anything. Do **not** "fix" the `section` values: they are the app's own data.

---

## 3. `GET /design-book/items/:sku` — detail panel (`openDetail`)

*Detail panel, top→bottom: header (code, title, `nameQualifier`, `handedLR`, Copy/Catalog) →
**CONFIGURE** (`parameters`) → **DESCRIPTION** → **ALTERATIONS & ACCESSORIES** (`alterations` /
`accessories` / `companions`, hydrated via `refs`) → **FINISH INTERIOR** (`finishInterior`, Vero) →
**ENGINEERING** (`engineering`) → **SPEC** (`priceGroupRef` / `frontModifiers` / `carcaseLine` /
`weightKg` / `volumeM3` / dims / `catalogPage`) → **RESTRICTIONS** → **MODIFICATIONS** → **PLANNING
NOTES** → **System Builder** (top-level `systems[]`).*

### Request

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `:sku` (path) | IN | Clicked card / "Search by Code" | Grid card / top search | `…/items/TK6080BZ2` |
| `expand=refs,catalog,all` | IN | Enrichment flags — `refs` hydrates every ItemRef sku → name/kind/image (+ `capabilities` for sibling pill gating); `catalog` builds the PDF url | (no visible control) | `…/items/T6073VE?expand=all` |
| `priceProgram` | IN | Programme to **PRICE the resolved ref cards** (with `expand=refs`) — each `refs[sku]` gains `pts` + `priceUnit` | (mirrors the grid's active programme) | `…/items/CT10073IS2IZ?expand=refs&priceProgram=BOSSA` |
| `programs[]` | IN | Active PROGRAMME selection — greys the CONFIGURE pills whose target excludes it (`available:false` + `programmeExcluded`; §2c). **Pass the grid's programme through** | (mirrors the grid's programme) | `…/items/T6080?expand=all&programs=BOSSA` |

### Response (detail sections → panel blocks) — v2 shape

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `item.sku` / `name` / `nameQualifier` / `handedLR` | OUT | Header code, title, amber sub-label, "L/R" badge | Detail — header | `…/items/TK6080BZ2` → `item.name` |
| `item.toeKick` | OUT | Toe-kick installed-height | Detail — header dims | `…/items/TK6080BZ2` → `item.toeKick` |
| **`item.capabilities`** | OUT | The pill-gate rule inputs for THIS unit (and, via `refs`, its siblings) — drives Configure pill state (§2c) | Detail — (drives Configure) | `…/items/TK6080BZ2` → `item.capabilities` |
| **`item.parameters`** | OUT | **CONFIGURE box** — `{ width[], height[], depth[], programme[], options[] }`; each pill `{label\|tier, sku, alteration?/opening?/swatch?}`, depth pills also `code` (the order code at that class, §2c-1). State derived (§2c) | Detail — Configure | `…/items/TK6080BZ2` → `item.parameters` |
| `item.description` | OUT | DESCRIPTION block (`{title, bullets[]}`) | Detail — Description | `…/items/TK6080BZ2` → `item.description` |
| **`item.alterations[]`** | OUT | Alterations tab — **sku codes**, hydrated to cards via `refs` (Standard + Unit-Specific) | Detail — Alterations tab | `…/items/T6073VE?expand=refs` → `item.alterations` |
| **`item.accessories[]`** | OUT | Accessory / pullout cards — a sku string, or `{sku, variants:[{label,sku}]}` for runner/length variants (L3/M3 · M8, 1m/1.6m/2m). Hydrated via `refs` | Detail — accessory tabs | `…/items/T6073VE?expand=refs` → `item.accessories` |
| **`item.companions[]`** | OUT | Planned-together / Opening-support / Complete-this-cabinet cards — sku codes, hydrated via `refs` | Detail — related groups | `…/items/T3073Z2W?expand=refs` → `item.companions` |
| **`item.finishInterior`** | OUT | Vero interior-finish sub-panel — `swatches[]` (colour grid) · `visibleSideCombos[]` (allowed visible-side finishes) · `optionCodes[]` (extra-charge style chips, plain codes, NOT skus) | Detail — Finish interior / Options tabs | `…/items/T6073VE` → `item.finishInterior` |
| `item.engineering[]` | OUT | ENGINEERING flags — `[{ key, ok }]` (🟢/🔴). Keys: suspended · sensomatic · tipSoftclose · openingP1 · depth68 · … | Detail — Engineering | `…/items/TK6080BZ2?full=true` → `item.engineering` |
| `item.priceGroupRef` / `frontModifiers` / `carcaseLine` | OUT | SPECIFICATION lines — price-group ref ("22.09") · V/E/J/Y front-line modifiers · carcase line (66/73/80/86) | Detail — Specification | `…/items/TK6080BZ2` → `item.priceGroupRef` |
| `item.weightKg` / `volumeM3` | OUT | Specification weight / volume | Detail — Specification | `…/items/TK6080BZ2` → `item.weightKg` |
| `item.catalogPage` | OUT | Printed-catalog page number (PDF url BUILT via `expand=catalog`) | Detail — (feeds Catalog button) | `…/items/TK6080BZ2` → `item.catalogPage` |
| `item.restrictions[]` | OUT | RESTRICTIONS | Detail — Restrictions | `…/items/TK6080BZ2?full=true` → `item.restrictions` |
| `item.modifications[]` | OUT | MODIFICATIONS — how to (handle 760/761, P1/C1; codes hydrated via `refs`) | Detail — Modifications | `…/items/TK6080BZ2?full=true` → `item.modifications` |
| `item.planningNotes[]` | OUT | PLANNING NOTES | Detail — Planning notes | `…/items/TK6080BZ2?full=true` → `item.planningNotes` |
| `item.didYouKnow` | OUT | 💡 Did you know? (codes hydrated via `refs`) | Detail — footer tip | `…/items/TK6080BZ2?full=true` → `item.didYouKnow` |
| `item.heightExtension` | OUT | **"217+" chip** appended to the Height row → 230/244/250 cm (opens the 217 cm unit + `MPHVERL`) | Detail / Card — Height row | `…/items/HP20146` → `item.heightExtension` · §2c-3 |
| `item.doorLineYCode` | OUT | not rendered — the ORDER CODE when the toolbar picks door-line **Y** (Y replaces the whole code) | Copy button / clipboard | `…/items/MGT601468` → `item.doorLineYCode` · §2c-3 |
| `item.appliance` | OUT | **Appliances popup** (brand · category · subcategory · nicheSize) | Detail / Card — Appliances popup | `…/items/GFVK8080SM` → `item.appliance` |
| `item.sinkFitment` | OUT | **Sink fitment** section + **"+ Add Sink"** popup | Detail — Sink fitment (Base/Sinks) | `…/items/TSP6080BZ2` → `item.sinkFitment` |
| `item.inspiration` | OUT | **Inspiration lightbox** (imageUrl · caption · heading) | Detail / Card — camera-icon lightbox | `…/items/AGFV6080` → `item.inspiration` |
| `item.finishes[]` / `priceUnit` | OUT | Finish → price (drives the point pill) · point-pill unit ("pts" \| "HLP") | Detail — finish/pricing | `…/items/TK6080BZ2?full=true` → `item.finishes` |
| `item.imageUrl` | OUT | Main product image (built from `meta.imageUrlTemplate`) | Detail — header image | `…/items/TK6080BZ2` → `item.imageUrl` |
| `systems[]` | OUT | **System Builder** panel (top-level, sibling of `item`; only on trigger skus) — Required/Optional slots + "Add Complete … System" | Detail — System Builder box | `…/items/LLERUS` → `systems` |
| `catalog` (expand) | OUT | CATALOG button → price-cropped PDF page (built from `catalogPage` + tier→book) | Detail — header CATALOG button | `…/items/TK6080BZ2?expand=catalog` → `catalog` |
| `refs` (expand) | OUT | Resolves each ItemRef sku → `{name, kind, category, subcategory, active, imageUrl}` (+ `priceUnit`; + `pts` when `priceProgram` set). Hydrates every alteration/accessory/companion/modification/system card AND supplies sibling `capabilities` for pill gating | Detail — all card labels/images | `…/items/CT10073IS2IZ?expand=refs&priceProgram=BOSSA` → `refs.EBF10058` |

> **REMOVED from the detail response vs v1** (do not look for these): `configure` (→ `parameters`),
> `accessoryPanel.tabs[]` (→ thin `alterations`/`accessories`/`companions` + `finishInterior`),
> `relatedGroups[]` (→ `companions`), `specification` (→ the flat `priceGroupRef`/`frontModifiers`/
> `carcaseLine`/`weightKg`/`volumeM3` + dims), `programmeBadge` (→ derived from `availableTiers`),
> `programmeAvailability` (→ `capabilities.excludedPrograms`).
>
> **`LIST_OMIT` note:** `description`, `restrictions`, `planningNotes`, `didYouKnow`, `modifications`,
> `engineering`, `finishes`, `alterations`, `accessories`, `companions` are detail-only — they come back
> on `GET items/:sku` always, but on `GET items` only with `full=true`.
>
> **Tier-sibling synthesis** (unchanged behavior): a programme pill can target a P/C/A/P1/C1 code that
> is not its own stored record. `GET items/:sku` on such a code reverse-finds the stored sibling that
> lists it as a `parameters.programme` pill and synthesizes the tier (same physical unit; flagged
> `synthesized`, P1/C1 flagged premium). `catalog`/spec follow that sibling.
>
> **Appliances popup** (`item.appliance`, unchanged from v1; set only on the 8 housing families). Rows
> map 1:1 to the app's `addAppliances` payload: `brand` · `category` (Refrigerators \| Dishwashers — also
> picks the icon) · `subcategory` (**DW only**: Built-In \| Built-In ADA at hc 73) · `nicheSize` (24" DW;
> 18/24/30/36" fridge, from width) · `note` (**DW only**, original-handle GFVO* leg/brand fitment).
> Example: `GFVK8080SM` → "Gaggenau · Dishwashers · Built-In · 24"".
>
> **Sink fitment** (`item.sinkFitment`, unchanged; Base/Sinks with a width). Powers the card
> "Max Sink Size: NN″" line + "+ Add Sink" popup + detail Sink-fitment section. All DERIVED from cabinet
> width + whether the front is a hinged door: `maxSinkSizeInch` (null = compact base <45 cm → confirm
> manually) · `cabinetWidthCm` · `customAboveInch` (always 42) · `isDoor` (true → deep-basin mod
> ANSVVO275 may apply) · `showOnCard` · `notes[]`. Example: `TSP6080BZ2` (60 cm) → 21″; 45 cm → 12″.
>
> **Inspiration** (`item.inspiration`, unchanged; DW-front / mat cards mapping to an S3 render). Camera
> icon (card top-left) + detail Inspiration tab open a lightbox: `imageUrl` (a SEPARATE S3 render, NOT
> `meta.imageUrlTemplate ⊕ sku`) · `caption` · `heading` (bold code · family · dims) · `fullScreen`. Ships
> on list rows too (NOT in `LIST_OMIT`).
>
> **"L/R" badge** (`item.handedLR`, unchanged; `true` only on hinge-side-optional units — 2,605 items,
> general not sink-only). Tooltip: "Available left or right hinged — state the hinge side on order."
>
> **System Builder** (`systems[]`, a TOP-LEVEL response field alongside `item`, present only on trigger
> skus). The panel COMPOSITION + labels + defaults — `id` · `name` · `note` · `triggerSkus[]` ·
> `required[]`/`optional[]` (each a slot `{role, options:[{sku,label?}], default?}`). Two systems today
> (SENSO · LLER), served by reverse-lookup on `triggerSkus` from the catalog meta doc. Component codes are
> ItemRefs → `expand=refs` hydrates them. Every on-screen element (unchanged from v1):

| Panel element (on screen) | Rendered from | Condition / note |
|---|---|---|
| Panel title + grey sub-line | `name` · `note` | always |
| **REQUIRED COMPONENTS** heading | static label | shown when `required[].length > 0` |
| Component row label (bold) | `slot.role` | e.g. "Drill hole (by position)", "Power Supply (USA)" |
| Single-code row: code + **Add** | `slot.options[0].sku` | when `options.length === 1` |
| **Pill group** (shown code flips BO78→BO78U→BO78O) | one pill per `options[]` (text = `option.label`, falls back to sku); starts at `default`, then user pick | when `options.length > 1` |
| **OPTIONAL** heading + rows | `optional[]` (each a slot, same shape) | shown when `optional[].length > 0` |
| **Add** button (per row) | `clipboard.add(selectedSku)` | selectedSku = that row's chosen option |
| **Add Complete … System** (black) | label = `"Add Complete " + name`; adds trigger sku + each required row's selected sku | uses `name` · `triggerSkus` · `required[].selected` |
| **SYSTEM STATUS** checklist | title = `name` − " System"; one row per `required[].role`; ✔ Ready to Order when every required sku is in the clipboard | trigger + required only — **optional excluded** |
| **Design Clipboard** popup rows (thumb · name · ⧉ · ✕) | codes from `systems[]`; image = `meta.imageUrlTemplate ⊕ sku`, name = item-resolve | membership / order / "N" badge = device state |

> **Two things NOT in `systems[]` (device-side, like ♥ My List):** (1) clipboard membership / order /
> the "N" count badge; (2) each code's image + name in a clipboard row (image built from the template,
> name from item-resolve). `systems[]` carries only the fixed composition + labels + defaults.

---

## 4. `GET /design-book/programs` — programme picker (dropdown + "pick a programme" modal)

Unchanged from v1. Powers the PROGRAMME select dropdown and the family-grouped picker. The programme
`id`s returned here are exactly the ids stored in each item's **`capabilities.excludedPrograms`** and
passed back as **`programs[]`** to drive pill/card greying (§2c) and as **`priceProgram`** to price cards.

### Request (all optional)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `page`, `limit` | IN | Paging of the flat list (`limit` defaults high → one call = all) | (picker rarely pages) | `…/programs?limit=200` |
| `family` | IN | **Family tab** (Primo / Avance / Contino; "Contino" also covers CONTINO-12) | Picker modal — top tabs | `…/programs?family=Contino` |
| `tier` | IN | Tier letter (P / A / C) — alt to `family` | (when client has the letter) | `…/programs?tier=A` |
| `q` | IN | Free-text on programme name / id | Picker — search | `…/programs?q=rocca` |
| `active` | IN | Include-inactive flag | Admin | `…/programs?active=true` |

### Response

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `groups[]` (`key` / `label` / `count` / `programmes[]`) | OUT | Family section header + chips (render-ready) | Picker modal — PRIMO / AVANCE / CONTINO headers | `…/programs` → `groups[]` |
| `programmes[]` | OUT | Flat paged list (PRIMO→AVANCE→CONTINO, A→Z) | Top toolbar — Programme SELECT DROPDOWN | `…/programs` → `programmes[]` |
| `programmes[].id` / `name` / `family` / `familyGroup` / `tier` / `pg` | OUT | Programme chip / dropdown line + family grouping + tier + "· PG {n}" (price column pointer) | Picker chip · dropdown line | `…/programs` → `programmes[].id` |
| `pagination.total` / `page` / `limit` / `pages` | OUT | Paging meta | (picker footer / dev) | `…/programs` → `pagination.total` |

---

## 5. `GET /design-book/categories` — type-taxonomy sidebar

Unchanged from v1. The left type-taxonomy sidebar (Base / Tall / Wall / Midway / Alteration / Handles / …).

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `page`, `limit`, `q`, `active` | IN | Paging / free-text / include-inactive | Nav / admin | `…/categories?q=base` |
| `categories[].name` / `.itemCount` | OUT | Category label + count badge | Left sidebar — top-level | `…/categories` → `categories[].name` |
| `categories[].subcategories[]` | OUT | Nested sub-category rows | Left sidebar — under category | `…/categories` → `categories[].subcategories` |
| `pagination.*` | OUT | Paging meta | (dev) | `…/categories` → `pagination.total` |

---

## 6. `GET /design-book/functional-categories` — "Design Tasks" sidebar

Unchanged from v1. Render-ready SECOND nav (distinct from `categories`). Membership materialized per item
in `item.functionalGroups[]`; filter the grid with `GET items?leafId=` / `?groupKey=` / `?zone=`.

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `inspiration` | OUT | ✨ Designer Inspiration row | Left sidebar — top | `…/functional-categories` → `functionalCategories.inspiration` |
| `allCategories` | OUT | "All categories" (count = families) | Left sidebar — All row | `…` → `functionalCategories.allCategories` |
| `zones[]` (`.groups[]` · `.leaves[]`) | OUT | Zone header + count → Group row (💧 Water / Cooling / …) → Leaf row + count (click → `?leafId=`) | Left sidebar — zones | `…` → `functionalCategories.zones` |
| `moreCategories[]` (`.subs[]` · `.subs[].filter`) | OUT | "More categories" list (Alteration · Handles · Lighting · …) → TYPE-subcategory leaves; each leaf click → `?category=&subcategory=` | Left sidebar — below the zones | `…` → `functionalCategories.moreCategories` |

---

## 6b. `GET /design-book/tall-heights` — TALL dynamic height selector (line + height rows)

Unchanged from v1. Powers the TALL toolbar's two stacked pill rows (LINE 73/80/86 + dynamic HEIGHT).
Reproduces the app's `availHeights()` over the visible set (heights DERIVED by snapping `heightMm` to a
tall height ±8 mm — no export/schema change). Accepts the same context filters as `GET items`; feed the
picked `line` + `tallHeight` back to `GET items` (§2).

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `leafId` / `groupKey` / `zone` / `category` / `subcategory` / `tier` / `family` / `programs[]` / `suspended` / `active` | IN | Context filters — which units are visible (Avance locks LINE to 80) | Left sidebar / top toolbar | `…/tall-heights?leafId=t_water%230` |
| `line` | IN | The selected LINE (73/80/86) — sets `selectedLine` + which `heights` return | Tall toolbar — top pill row | `…/tall-heights?leafId=t_water%230&line=80` |
| `lineOptions[]` (`value` · `available` · `heights[]`) | OUT | LINE row pills (`available:false` = Avance-locked); each carries its own `heights` for instant repaint | Tall toolbar — top pill row | `…` → `lineOptions` |
| `selectedLine` / `heights[]` / `heightsByLine` | OUT | Active LINE / the HEIGHT row for it / the HEIGHT set per line | Tall toolbar — second (dynamic) row | `…?line=80` → `heights` |

---

## 7. `GET /design-book/home` — landing screen

Unchanged from v1. The home screen in one call (no params): **START BY DESIGN TASK** (`designTasks` —
one card per zone with its groups) + **OR BROWSE BY CABINET TYPE** (`cabinetTypes` chips). Every
card/group carries a `filter` object = the exact `GET items` query to run when clicked.

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `designTasks[]` (`.zone`/`label`/`count`/`groups[]`/`filter`) | OUT | Zone cards + group rows; header→`{zone}`, group→`{groupKey}` | Landing — top card row | `…/home` → `designTasks` |
| `cabinetTypes[]` (`.key`/`label`/`count`/`filter`) | OUT | "Browse by cabinet type" chips; click→`{zone}` or `{category}` | Landing — bottom chip row | `…/home` → `cabinetTypes` |

---

## 8. `GET /design-book/meta` — catalog reference (mostly non-visible)

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `meta.imageUrlTemplate` | OUT | Builds every product/card image URL (`⊕ sku`) | (drives all `imageUrl`s) | `…/meta` → `meta.imageUrlTemplate` |
| `meta.schemaVersion` / `catalogVersion` | OUT | Version / about (`schemaVersion` = `"2.2.0"`) | Admin · about | `…/meta` → `meta.schemaVersion` |
| `meta.counts` | OUT | Catalog totals (`items` / `cabinets` / `accessories` / `categories` / `programmes`) | Admin · stats | `…/meta` → `meta.counts` |
| `meta.recoveredArtifactSkus[]` | OUT | Codes the app's init deleted as artifacts but which are still real orderable units (recovered from the raw DOM). 9 are P1-prefixed / country-specific (CH/GB) — **filter here if unwanted** | Admin · data-hygiene note | `…/meta` → `meta.recoveredArtifactSkus` |
| `systems[]` | OUT | Full **System Builder** registry (SENSO · LLER); per-item slice served by `GET items/:sku` (§3) | (drives the detail System Builder panel) | `…/meta` → `systems` |
| `lastIngestSummary` | OUT | Last sync report | Admin · import history | `…/meta` → `lastIngestSummary` |

---

## 9. `GET /design-book/stats` — admin dashboard

Unchanged from v1.

| API parameter | Dir | UI parameter (element) | UI location | Sample call |
|---|---|---|---|---|
| `totalItems` / `activeItems` / `inactiveItems` | OUT | Item-count tiles | Admin · dashboard | `…/stats` → `stats.totalItems` |
| `itemsByKind` | OUT | Per-kind breakdown (cabinet/alteration/accessory/part) | Admin · dashboard | `…/stats` → `stats.itemsByKind` |
| `programmes` / `categories` | OUT | Distinct counts | Admin · dashboard | `…/stats` → `stats.programmes` |
| `catalogVersion` / `schemaVersion` / `lastIngestAt` | OUT | Version / freshness line | Admin · dashboard | `…/stats` → `stats.catalogVersion` |

---

### Appendix — v1 → v2 field rename cheat-sheet

| v1 field | v2 field | Notes |
|---|---|---|
| `configure.width/height/depth/programme` | `parameters.width/height/depth/programme` | pills are thin (`{label\|tier, sku, …}`); depth pills carry `code` (§2c-1) |
| `configure.optionRows[]` (`{label, options[]}`) | `parameters.options[]` (flattened `{group, label, sku, swatch?}`) | one entry per pill, `group` = row label |
| `configure.*[].available/selected/crossedOut/value/unit` | — (derived) | selected = `sku===item.sku` **except on `depth`, where it is by LABEL** (§2c-1); dead = `sku==null`; grey = `availableFromCaps(...)` |
| `programmeAvailability {excluded, programmes[]}` | `capabilities.excludedPrograms[]` | the programme rule; backend reads it in `annotateProgrammeExclusions` |
| `accessoryPanel.tabs[].cards[]` | `alterations[]` · `accessories[]` · `companions[]` (sku codes) | hydrated to cards via `refs` |
| `accessoryPanel.tabs[].swatches/visibleSideCombos/options` | `finishInterior.swatches/visibleSideCombos/optionCodes` | Vero interior finish |
| `relatedGroups[]` | `companions[]` | planned-together / opening-support / complete-this-cabinet |
| `specification {…}` | `priceGroupRef` · `frontModifiers` · `carcaseLine` · `weightKg` · `volumeM3` · dims | flattened onto the item |
| `programmeBadge` | — (derive from `availableTiers`) | top-right summary chip |
| `engineering[]` (`{key, label, value, ref, ok}`) | `engineering[]` (`{key, ok}`) | label/value/ref derived at read |
| `catalog {page, priceGroupRef}` | `catalogPage` (+ `priceGroupRef` on the item) | PDF url built at read via `expand=catalog` |
| (new) | **`capabilities` (17 fields)** | the pill-gate rule inputs — §2d |
| (new) | **`POST/PATCH/DELETE items`** | manual authoring — §1b |
| (new, 2.1) | **`parameters.depth[].code`** | the re-cut ORDER CODE at that depth class — §2c-1 |
| (new, 2.2) | **`doorLineYCode`** | order code for door-line Y — the one modifier that replaces the whole code — §2c-3 |
| (new, 2.2) | **`heightExtension`** | the `217+` chip on the Height row (230/244/250 cm via the 217 unit + `MPHVERL`) — §2c-3 |

---

## v1 → v2 coverage table (proof nothing was dropped)

One row per v1 section / feature → where it lives in v2 (or why it is gone). `✅` carried,
`♻️` carried with rename/rework, `❌` removed (reason given), `➕` new in v2.

| v1 section / feature | v2 location | Status |
|---|---|---|
| Intro conventions (Base path, Dir, UI location, Sample call, Source) | Header | ✅ updated source list (adds `upsert-item.dto.ts`) |
| §1 `POST ingest` (request + summary fields) | §1 | ✅ note: shares `normalizeItemDoc` with CRUD; `schemaVersion` = "2.2.0" |
| §2 `GET items` — request filter rows | §2 request table | ✅ same param names; `depthClass` matches `capabilities.depthClasses` ♻️ |
| §2 `GET items` — response per-card rows | §2 response table | ♻️ `configure.*` → `parameters.*`; `programmeBadge`/`cardLabel` → derive from `availableTiers`; adds `capabilities` |
| §2 note — `availableTiers` precedence | §2 note block | ✅ unchanged |
| §2 note — D pill = depth CLASS (not mm) | §2 `depthClass` row + §2c-2 | ♻️ matches **`capabilities.depthClasses`** (58/63 pass-through) — NOT `parameters.depth[].label` |
| §2 note — tall two-row selector | §2 `line`/`tallHeight` row + §6b | ✅ unchanged |
| §2 note — card = family / face unit / `groupBy` | §2 note block | ✅ unchanged; adds `faceForTiers` |
| §2 note — two grouping levels (section headers) | §2b + §2e | ✅ carried (by-section endpoint + open note) |
| §2b `GET items/by-section` | §2b | ✅ unchanged; annotations + `capabilities`/`parameters` flow through |
| §2c pill states (`available`/`sku`/`programmeExcluded`, 3 states) | §2c state table | ♻️ replaced by the DEAD/SELECTED/GREY/LIVE derivation from `capabilities` |
| §2c strike-vs-grey is a surface, not a field | §2c (state table + rendering spec) | ✅ carried (grid strikes, drawer greys — same GREY) |
| §2c `crossedOut` reserved | §2c distribution note | ❌ removed — field does not exist in v2 (was 0/256,937 in v1) |
| §2c "client MUST send `programs`" warning | §2c "backend greys the PROGRAMME half" | ✅ carried, restated for `excludedPrograms` |
| §2c worked example (T6080 / BOSSA) | §2c worked example | ♻️ updated to the `parameters` shape |
| §2c tooltips table | §2c rendering-spec tooltips | ✅ carried (minus the `crossedOut` row) |
| §2c multi-select union rule | §2c bullet | ✅ unchanged (`programIds.every(...)`) |
| §2c endpoints that annotate | §2c backend section | ✅ carried (`GET items` / `by-section` / `items/:sku`) |
| §2c coverage gap (7 gates frozen, only progOk live) | §2c "RESOLVES v1's coverage gap" | ✅ **resolved** — all 8 gates evaluated live from `capabilities` |
| §2c reference implementation (`optState`) | §2c "Wiring the click" | ♻️ now the `availableFromCaps` port + lite-UI pointer |
| §2c stored-pill distribution table | §2c distribution note | ❌ N/A — v2 pills store no state; only `sku` persists |
| §2c pill-state parity table | §2c "Verified parity" | ♻️ 99.997% across 313,842 combos (FRMAT residual) |
| §2d rendering spec (visual states, CSS, click wiring) | §2c rendering-spec table + "Wiring the click" | ✅ carried (folded into §2c) |
| §2e whole-card GREY, DON'T HIDE | §2c "whole-card GREY" | ♻️ now `availableFromCaps(card.capabilities, toolbar)` on the card's OWN caps |
| §2e `programmeAvailability` + `cardExcluded` predicate | §2c + rename cheat-sheet | ❌ `programmeAvailability` removed → `capabilities.excludedPrograms` (client runs `availableFromCaps`; no `full=true` needed) |
| §2e recommended backend change (annotate the card) | §2c whole-card note | ♻️ moot — client computes card grey from `capabilities` it already has |
| §2f section-bucketing OPEN note | §2e | ✅ carried verbatim (still open; `section` unchanged) |
| §3 `GET items/:sku` — request (`expand`/`priceProgram`/`programs`) | §3 request table | ✅ unchanged; `expand=refs` now also supplies sibling `capabilities` |
| §3 detail response rows | §3 response table | ♻️ `configure`→`parameters`, `accessoryPanel`→`alterations`/`accessories`/`companions`+`finishInterior`, `relatedGroups`→`companions`, `specification`→`priceGroupRef`/`frontModifiers`/`carcaseLine`/`weightKg`/`volumeM3`, `programmeBadge`/`programmeAvailability` removed |
| §3 appliance popup / sink fitment / inspiration / L/R notes | §3 note blocks | ✅ carried (fields unchanged in v2) |
| §3 System Builder element map + "not in systems[]" | §3 System Builder table | ✅ carried verbatim (unchanged) |
| §3 tier-sibling synthesis | §3 synthesis note | ✅ carried (reverse-finds the `parameters.programme` owner) |
| §4 `GET programs` | §4 | ✅ unchanged; note ids feed `excludedPrograms`/`programs`/`priceProgram` |
| §5 `GET categories` | §5 | ✅ unchanged |
| §6 `GET functional-categories` (+ moreCategories subs) | §6 | ✅ unchanged |
| §6b `GET tall-heights` (two-axis derivation note) | §6b | ✅ unchanged (no schema change) |
| §7 `GET home` | §7 | ✅ unchanged |
| §8 `GET meta` | §8 | ✅ unchanged; **adds `meta.recoveredArtifactSkus[]`** ➕ |
| §9 `GET stats` | §9 | ✅ unchanged |
| — | §1b `POST/PATCH/DELETE items` (CRUD + DTO surface) | ➕ new in v2 |
| — | §2d `capabilities` object (17 fields) | ➕ new in v2 |
| — | §2c-1 / §2c-2 / §2c-4 depth as a STATE row (`parameters.depth[].code`, the two models, the fetch / don't-fetch click handler) | ➕ new in 2.1 |
| — | §2c-3 the rest of the order-code surface (`assemble()` inputs; `doorLineYCode`, `heightExtension`; `Insert` is plain navigation) | ➕ new in 2.2 |
