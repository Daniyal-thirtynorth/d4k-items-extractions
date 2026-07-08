# LEICHT Catalog — JSON Export Schema

**Source:** LEICHT IDM 3.0.1 — Collection 2026/2 · Collection 2026/2
**Exported:** 2026-07-01T05:29:07.176905Z
**Generator:** Dash4.AI catalog export — from leicht_units__584_.html

## Contents of this export

| File | Purpose |
|---|---|
| `leicht-catalog-v584-full.json` | Complete structured export — `meta`, `programs`, `priceFieldLegend`, `ruleTables`, `categories`, `products`. |
| `leicht-products.ndjson` | One product document per line — ready for `mongoimport` into a `products` collection. |
| `leicht-catalog-v584-SCHEMA.md` | This document. |
| `leicht-catalog-v584-report.html` | Visual hierarchy + sample items. |
| `leicht-catalog-v584-QA.md` | QA report — proof nothing is missing. |

## Totals

- **Products (configurable cards):** 1,338
- **SKUs (child products):** 16,393
- **Programs:** 120
- **Categories:** 15
- **Rule tables:** 10
- **Alteration types (separate):** 1458

## Import into MongoDB

```bash
# Option A — products collection from NDJSON (recommended)
mongoimport --uri "$MONGO_URI" --db leicht --collection products \
  --file leicht-products.ndjson

# Option B — from the full JSON, importing just the products array
jq -c '.products[]' leicht-catalog-v584-full.json > products.ndjson
mongoimport --uri "$MONGO_URI" --db leicht --collection products --file products.ndjson

# Reference collections (from the full file)
jq -c '.programs[]'   leicht-catalog-v584-full.json | mongoimport --uri "$MONGO_URI" --db leicht --collection programs
jq -c '.categories[]' leicht-catalog-v584-full.json | mongoimport --uri "$MONGO_URI" --db leicht --collection categories
```

Suggested indexes: `products.cardId` (unique), `products.category`, `products.subcategory`, `products.skus.sku`, `products.skus.priceClass`, `products.skus.availableProgramKeys`.

## Top-level structure (full JSON)

```
{
  meta:              { source, collection, exportedAt, counts, widths, widthGroups, cornerWidths, companions, imageBaseUrl, note },
  programs:          [ { k, n, fam, fld, fd } ],          // 120 programs
  priceFieldLegend:  { …, programToField, howToRead },     // how price columns work
  ruleTables:        { handle_systems, handle_positions, handleless_recipes, opening_systems,
                       vertical_handle, antoso, lighting, lighting_control, programs_special, carcass_colors },
  categories:        [ { category, productCount, subcategories:[ { subcategory, productCount, sections:[…] } ] } ],
  products:          [ Product ]                            // 1,338 cards
}
```

## Product (configurable card)

| Field | Type | Meaning |
|---|---|---|
| `cardId` | string | Unique card / product-family ID (e.g. F805). Groups all child SKUs of one configurable product. |
| `cardName` | string | Display name of the configurable card (e.g. "Floor unit"). |
| `category` | string | Top category — Base, Tall, Wall, Midway, Countertops, Surround, Panels & surround, Alteration, Wall cladding, Accessories & interior. |
| `subcategory` | string | Functional subcategory (Doors, Sinks, Trash Pullout, Corners, Appliance housing, …). |
| `section` | string? | Higher grouping shown as a section header (e.g. "Standard Door Cabinets"). |
| `dimensionAxis` | string | Primary axis used to lay the card out: height | width | hd | depth. |
| `description` | array|string? | Detail-view description lines (material / spec text shown when clicking into the item). |
| `material` | string? | Material (e.g. "Stainless steel"). |
| `badge` | string? | Display badge (e.g. "2 DOORS"). |
| `planningNote` | string? | Card-level planning constraint (e.g. "Cannot work with Connection to dishwasher."). |
| `secondaryLabel` | string? | Short secondary label. |
| `programDependent` | bool | true if the card content / availability changes with the selected program. |
| `hidden` | bool? | Card hidden in the UI. |
| `legacy` | bool? | Legacy item. |
| `usaAvailable` | bool | Always true — the export is the USA-filtered catalog. |
| `discontinued` | bool | Always false for included items (discontinued/non-USA SKUs are excluded upstream). |
| `compatibleWith` | array? | Compatible SKUs / cards. |
| `options` | object | Merged-card option structure — see “Merged cards & options”. |
| `programBadges` | array | Names of every program any SKU in this card is orderable in. |
| `extraFields` | object? | Any remaining raw catalog fields preserved verbatim (ord = sort order, nag, pri = priority, vfin, noHL, noline, insAx, vsub, …). Nothing is dropped. |
| `skuCount` | int | Number of child SKUs. |
| `skus` | array | Child SKUs (see next table). |

## SKU (child product inside `skus[]`)

| Field | Type | Meaning |
|---|---|---|
| `sku` | string | Orderable product code. |
| `altName` | string? | Alternate catalog name (from the altnames table). |
| `unitLabel` | string? | Alternate unit label. |
| `idmCode` | string? | Raw IDM article code. |
| `descriptionLines` | array | Left-panel description bullets (e.g. ["Floor unit","1 door","2 adjustable shelves"]). |
| `variantKey` | string? | Which value of options.variantAxis this SKU belongs to (the merged-card mapping). |
| `premiumTier` | string? | Premium option tier (P1 / C1). |
| `tier / tierCode` | string? | Price-tier name / code — Primo (P), Contino (C), Avance (A), Primo Plus (P1), Contino Plus (C1). |
| `siblingTiers` | string? | Tiers this SKU spans (e.g. "PC"). |
| `dimensions` | object | { width:{cm,mm}, height:{cm,mm}, depth:{nominalCm, carcassMm, defaultMm, alternatesCm[], alternatesMm[]} }. |
| `mechanism` | string? | Hinge / mechanism code. |
| `featureFlags` | object? | Raw feature flags kept verbatim (V, E, J, P1, C1, sinkDoor). |
| `calcGroup` | int | IDM calc group — the pricing identity. |
| `priceClass` | string | Derived: "HLP" when calcGroup ∈ {15,38,61}, else "Points". |
| `priceGroupRef` | string? | Pricelist location reference (chapter.section). |
| `priceMatrix` | object | Price columns keyed by IDM price-field number. VALUES are the printed catalog number (already ÷100). |
| `bookPriceByProgram` | object? | Convenience map: program key → book price = priceMatrix[ program.priceField ]. |
| `vl, pp, wt` | number? | Raw IDM numeric fields preserved verbatim (point/value fields). Kept for completeness. |
| `insertCode` | string? | Insert / interior code. |
| `availablePrograms / …Extended` | array | [{key,name}] — programs this SKU is orderable in (resolved from the program table). |
| `availableProgramKeys / …Extended` | array | Raw program-key lists (x / xE). |
| `technicalNotes` | array? | Recessed-handle & programme constraints (rs). |
| `planningNotes` | array? | Planning advisories shown on the unit (pa). |
| `clickNote` | string? | Note shown on click (e.g. "Requires ADA dishwasher."). |
| `accessories` | array? | Related accessory SKUs (acc). |
| `relatedSkus` | array? | Related / alternate SKUs (alt). |
| `companionSku` | string? | Companion SKU (Yc). |
| `images` | object | { thumbnail, detail } — S3 image URLs built from the SKU code. |
| `extraFields` | object? | Any remaining raw SKU fields preserved verbatim. |

## Merged cards & options

One **card** = one configurable product family; its `skus[]` are the individual orderable codes. The mapping between an option combination and a SKU is direct and already materialised:

- `options.variantAxis` is the named selector (label + each value's SKU count). Each SKU carries `variantKey` = the value it belongs to.
- `options.widthsCm`, `options.heightsCm`, `options.depthsCm` list the dimensional axes; each SKU's `dimensions` give its exact point on those axes.
- **To find the SKU for a chosen combination:** match on `variantKey` + `dimensions.width.cm` + `dimensions.height.cm` + `dimensions.depth.nominalCm`. Cross-listed SKUs (a code appearing in more than one card) are intentional and preserved.

## Pricing model

- Every SKU has a **`calcGroup`** → **`priceClass`** ("HLP" for calc groups 15/38/61, otherwise "Points").
- **`priceMatrix`** holds the printed book numbers, keyed by IDM price-field. **Values are already the catalog number** (raw IDM value ÷ 100).
- For a program *P*, book price = `priceMatrix[ programs[P].priceField ]`. The `bookPriceByProgram` map pre-computes this for the programs each SKU supports.
- Final selling / net conversion (point-value × discount, HLP × (1 − discount)) is a downstream layer and is **not** baked into these numbers.

### Price-field legend

| Field(s) | Meaning |
|---|---|
| `1-8` | HLP / net dealer-list finish columns (sinks, commodity, surround net items; calc groups 15/38/61) |
| `21-29` | Points tier price columns (finish set A) |
| `31-39` | Points tier price columns (finish set B) |
| `39/41/42` | Surround price fields MR1 / MR3 / MR4 (side panels & surround) |
| `50-55` | Points tier price columns (finish set C) |
| `60` | Points column (finish set D) |
| `70-75` | Points tier price columns (finish set E) |

*How to read:* For a given program P, book price = SKU.priceMatrix[ programs[P].priceField ]  (values already divided by 100 = printed catalog number). priceClass Points vs HLP per SKU.calcGroup.

## Images

Every SKU gets `images.thumbnail` / `images.detail` built as
`https://dash4data.s3.us-west-1.amazonaws.com/itemData/<SKU>.jpg`.
Use a placeholder fallback where an object doesn't yet exist in the bucket.

## Completeness guarantee

Both the product and SKU transforms carry an `extraFields` catch-all: any raw catalog field not explicitly renamed is preserved there verbatim. Only internal runtime-render fields (prefixed `_`) are stripped. The QA report proves `uncovered = []` for both levels.
