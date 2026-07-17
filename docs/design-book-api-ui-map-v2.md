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
| **Configure pills** | `configure.{width,height,depth,programme,optionRows}`, each pill froze `available`/`selected`/`crossedOut`/`value`/`unit` | **`parameters.{width,height,depth,programme,options}`** — each pill is just `{label\|tier, sku}` (+ `alteration?`/`opening?`/`swatch?`). **No stored state.** §2, §2c |
| **Pill grey/strike** | frozen per-pill `available` boolean | **`availableFromCaps(target.capabilities, toolbar)`** — the client evaluates the 8 gates against its own toolbar, exactly as the app does. §2c, §2d |
| **Whole-card grey** | `programmeAvailability.excluded` + `programmes[]` allow-list | the card's **own `capabilities`** run through the same `availableFromCaps`. `programmeAvailability` is **gone**. §2c |
| **Backend programme grey** | `annotateProgrammeExclusions` read `programmeAvailability` | same method, now reads **`capabilities.excludedPrograms`** — still the ONE gate computed server-side. §2c |
| **Rule inputs** | scattered / implicit | **NEW `capabilities` object** (17 fields) on every item — the pill-gate rule inputs. §2d |
| **Detail sections** | `configure`, `accessoryPanel`, `relatedGroups`, `specification`, `programmeBadge` | **removed.** Replaced by `parameters`, thin `alterations`/`accessories`/`companions` (hydrated via `refs`), `finishInterior`, `priceGroupRef`/`frontModifiers`/`carcaseLine`, `engineering:[{key,ok}]`, `catalogPage`. §3 |
| **`crossedOut`** | reserved-but-never-emitted field | **does not exist** in v2. A pill is only ever live / grey / dead. |
| **`depthClass` filter** | matched `configure.depth[].label` | matches **`parameters.depth[].label`**. §2 |

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
| `summary.catalogVersion` / `schemaVersion` | OUT | Version line of the import (`schemaVersion` = `"2.0.0"`) | Admin · import result | `POST …/ingest` → `summary.schemaVersion` |

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
| `depthClass` | IN | **D pill** — nominal depth CLASS in cm (36·48·58·63·68). Matches when the class is among the unit's available depths (**`parameters.depth[].label`** — native or a depth alteration, incl. the 63 cm alteration) OR (no depth options AND `depthMm == class×10−20`). Carcass = class×10−20. | Grid filter bar — D row | `…/items?depthClass=58` |
| `depthMm` / `heightMm` | IN | Exact carcass depth / height (mm) — precise, **not** the grid class rows | (precise filter) | `…/items?depthMm=560` |
| `line` / `tallHeight` | IN | **TALL** two-row height selector (carcase LINE 73/80/86 + dynamic HEIGHT cm). TALL only. Options from `GET tall-heights` (§6b) | Tall toolbar — top + second pill rows | `…/items?zone=Tall&line=80&tallHeight=204` |
| `suspended` | IN | **TOE-KICK "Suspended" toggle** — the `engineering` `suspended` flag (ok=true) | Top toolbar — TOE-KICK · Suspended | `…/items?suspended=true` |
| `active` | IN | Active-only flag | Admin | `…/items?active=true` |
| `groupBy=family` | IN | **Grid card grouping** — one card per family ("N types"); pages by family | Grid — the card grid itself | `…/items?leafId=b_cool%230&groupBy=family` |
| `full` | IN | Include the detail-only blobs (§3) that `LIST_OMIT` strips | (dev / when the card needs a detail field) | `…/items?q=T6073VE&full=true` |

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
| `parameters.depth[]` | OUT | **D** pill row (a pill may be `alteration:true` = 63 cm depth alteration). Its `label`s are the depth CLASSES the `depthClass` filter matches | Card — Configure rows | `…/items` → `items[].parameters.depth` |
| `parameters.programme[]` | OUT | Programme / tier pills — each `{tier, sku, opening?}` | Card — bottom-right | `…/items` → `items[].parameters.programme` |
| `parameters.options[]` | OUT | Coded rows flattened — each `{group, label, sku, swatch?}` (Ty / Mode / Config / Finish) | Card — Configure rows | `…/items` → `items[].parameters.options` |
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
> `parameters`, `finishInterior`, `sinkFitment`, `appliance`, `inspiration`, `priceGroupRef`,
> `frontModifiers`, `carcaseLine` — ships on every card**. `capabilities` and `parameters` are kept on
> purpose: the grid card is a live mini-configurator and needs both to render + gate its pills.

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
or **dead**. In v2 a pill stores **no state** — only `{label\|tier, sku, …}`. State is derived per read:

| State | Rule | Render | Clickable? |
|---|---|---|---|
| **DEAD** | `pill.sku == null` (no target code exists) | greyed, `grayscale`, `not-allowed` | **no** |
| **SELECTED** | `pill.sku === item.sku` (this pill IS the current unit) | filled accent | inert (already here) |
| **GREY** | `availableFromCaps(targetItem.capabilities, toolbarState) === false` | grid card: **struck** · detail drawer: **greyed** | **yes** → still opens the sibling sku |
| **LIVE** | otherwise | normal | **yes** → opens `pill.sku` |

To resolve a pill the client:
1. reads `pill.sku` → **DEAD** if null;
2. compares to the current unit's `sku` → **SELECTED** if equal;
3. looks up the **TARGET item's `capabilities`** (already on the card / in `refs`) and runs
   `availableFromCaps(caps, toolbar)` → **GREY** if false, else **LIVE**.

> **The pill's own item does NOT carry the answer** — the answer lives on the item the pill points at.
> Grid cards ship `capabilities` on every row (so same-family sibling targets are already present); the
> detail drawer gets sibling capabilities via `refs` (§3). Strike-vs-grey is a **surface**, not a field:
> the grid renderer strikes (`line-through`), the detail renderer greys (`opacity`). Same GREY state.

### The 8 gates — toolbar control → `capabilities` field(s)

`available(u) = alwaysAvailable || (progOk && tierOk && depthOk && handleOk && frontOk && openOk &&
antosoOk && doorOk)`. Each gate reads the toolbar on one side and the **target's** `capabilities` on the
other. Only `progOk` is also computed server-side (§ below); the other seven are **client-only** (there
is no grid-filter param for handle / front / doorline — they are pure toolbar state used to gate pills).

| Gate | Toolbar control (`ToolbarState`) | Grid-filter param? | `capabilities.*` field(s) read |
|---|---|---|---|
| **progOk** | PROGRAMME picker → `progKeys[]` | `programs[]` (also greys server-side) | `excludedPrograms[]` · `excludedProgramsE[]` (only when `front=1` & `hasE`) · `isFrmat` |
| **tierOk** | FRONTS pill → `tier` (P/A/C/P1/C1/ALL) | `tier` (grid) | `tier` (native line) · `op` (P1/C1 variant) · `tierTwins[]` (tiers with a real sibling) |
| **depthOk** | D pill → `depth` (default 58) | `depthClass` (grid) | `depthClasses[]` (**58 & 63 always pass**) |
| **handleOk** | handle-free selector → `handle` (std/V) | — (client only) | `handleFree` |
| **frontOk** | single-front / Full-E → `front` (0/1) | — (client only) | `frontE` |
| **openOk** | OPENING toggle → `open` (''/P1/C1) | `opening` (grid) | `openP1` · `openC1` · `singleHandle` (passes when true) |
| **antosoOk** | ANTOSO suspended-install → `antoso` | `suspended`* (grid, via `engineering`) | `antosoOk` |
| **doorOk** | door-line → `doorline` (''/J/Y) | — (client only) | `doorJ` · `doorY` |

`alwaysAvailable` (`u._c`) short-circuits ALL gates to live. *The grid `suspended` filter is the
`engineering` `suspended` flag, a related-but-separate signal from the `capabilities.antosoOk` pill gate.

### The reference port — `availableFromCaps` (copy verbatim from the schema)

The client evaluates this for every pill (a pill is DEAD when `sku` is null before this even runs):

```ts
function availableFromCaps(c: Capabilities, s: ToolbarState): boolean {
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

`ToolbarState` (the app's `state`, minus render-only bits): `{ depth=58, tier='ALL', open='', front=0,
handle='std', antoso=false, doorline='', progKeys=[] }`. **Defaults (nothing picked) leave every gate
passing** — so with a fresh toolbar every pill with a target is LIVE. FRMAT is the one layered residual:
also `&& !(caps.isFrmat && frmatExcluded(prog))` (layer `FRMAT_MAX[programmeName]` — 1 unit).

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
> v2 a pill stores **only** `{label\|tier, sku}` — the sole persisted signal is `sku` (present = has a
> target, `null` = DEAD); everything else is derived at read. `crossedOut` **does not exist** in v2 (it
> was 0/256,937 catalog-wide in v1, produced by no path — dropped from the model entirely).

### Verified parity

`Capabilities` reproduce the app's own `available()` at **99.997%** across **313,842** combinations
(16,518 configure-pill targets × 19 toolbar states). The only residual is **FRMAT** (1 unit), layered
back via `isFrmat` + the `FRMAT_MAX[programmeName]` size table. This is the v2 replacement for v1's
frozen-`available` boolean, which was only correct at the default toolbar.

---

## 2d. ⭐ The `capabilities` object — all 17 fields

One `Capabilities` per item; a pill greys when its TARGET item's capabilities fail a gate (§2c). Every
field is settable at creation via CRUD (`UpsertItemDto.capabilities`).

| Field | Type | Gate it drives | Meaning (app source) |
|---|---|---|---|
| `alwaysAvailable` | bool | **all** (short-circuit) | `u._c` — forces `available:true`, skips every gate |
| `tier` | `"P"\|"A"\|"C"\|null` | tierOk | native line (`u.fam`; null = line-neutral, never greys by tier) |
| `op` | `"P1"\|"C1"\|null` | tierOk | this unit IS a premium opening variant |
| `tierTwins` | `("P"\|"A"\|"C")[]` | tierOk | non-native tiers that have a REAL sibling sku → grey under that tier |
| `excludedPrograms` | `string[]` | progOk | programme ids the unit is NOT orderable in (`u.x`) — **THE programme rule** (what the backend reads) |
| `excludedProgramsE` | `string[]` | progOk | extra exclusions active only in single-front / "Full-E" mode (`u.xE`) |
| `isFrmat` | bool | progOk | FRMAT max-size-table family — layer `FRMAT_MAX[programmeName]` on top |
| `hasE` | bool | progOk | E-capable (needed for the `excludedProgramsE` path) |
| `depthClasses` | `number[]` | depthOk | nominal depth CLASSES (cm) the unit offers. **58 & 63 always pass** |
| `handleFree` | bool | handleOk | no-handle front OR interior module (`u.V \|\| _hFree`) |
| `frontE` | bool | frontOk | one-piece front (`u.E \|\| /\dE$/.test(code)`) |
| `openP1` | bool | openOk | supports the P1 opening variant |
| `openC1` | bool | openOk | supports the C1 opening variant |
| `singleHandle` | bool | openOk | ≤1 stacked front (opening rule always passes when true) |
| `antosoOk` | bool | antosoOk | inside the ANTOSO suspended-install approval envelope (precomputed) |
| `doorJ` | bool | doorOk | door-line J |
| `doorY` | bool | doorOk | door-line Y |

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
| **`item.parameters`** | OUT | **CONFIGURE box** — `{ width[], height[], depth[], programme[], options[] }`; each pill `{label\|tier, sku, alteration?/opening?/swatch?}`. State derived (§2c) | Detail — Configure | `…/items/TK6080BZ2` → `item.parameters` |
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
| `meta.schemaVersion` / `catalogVersion` | OUT | Version / about (`schemaVersion` = `"2.0.0"`) | Admin · about | `…/meta` → `meta.schemaVersion` |
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
| `configure.width/height/depth/programme` | `parameters.width/height/depth/programme` | pills are thin (`{label\|tier, sku, …}`) |
| `configure.optionRows[]` (`{label, options[]}`) | `parameters.options[]` (flattened `{group, label, sku, swatch?}`) | one entry per pill, `group` = row label |
| `configure.*[].available/selected/crossedOut/value/unit` | — (derived) | selected = `sku===item.sku`; dead = `sku==null`; grey = `availableFromCaps(...)` |
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

---

## v1 → v2 coverage table (proof nothing was dropped)

One row per v1 section / feature → where it lives in v2 (or why it is gone). `✅` carried,
`♻️` carried with rename/rework, `❌` removed (reason given), `➕` new in v2.

| v1 section / feature | v2 location | Status |
|---|---|---|
| Intro conventions (Base path, Dir, UI location, Sample call, Source) | Header | ✅ updated source list (adds `upsert-item.dto.ts`) |
| §1 `POST ingest` (request + summary fields) | §1 | ✅ note: shares `normalizeItemDoc` with CRUD; `schemaVersion` = "2.0.0" |
| §2 `GET items` — request filter rows | §2 request table | ✅ same param names; `depthClass` now matches `parameters.depth[].label` ♻️ |
| §2 `GET items` — response per-card rows | §2 response table | ♻️ `configure.*` → `parameters.*`; `programmeBadge`/`cardLabel` → derive from `availableTiers`; adds `capabilities` |
| §2 note — `availableTiers` precedence | §2 note block | ✅ unchanged |
| §2 note — D pill = depth CLASS (not mm) | §2 `depthClass` row + note | ♻️ label source now `parameters.depth` |
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
