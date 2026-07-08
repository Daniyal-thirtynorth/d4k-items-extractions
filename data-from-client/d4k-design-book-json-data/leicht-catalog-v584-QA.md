# LEICHT Catalog Export — QA Report

**Result: 16 / 16 checks passed.**
Generated 2026-07-01T05:30:50.656570Z from `leicht-catalog-v584-full.json` against the source DATA in `leicht_units__584_.html`.

| ✓ | Check | Detail |
|---|---|---|
| ✅ | product count | `1338 == 1338` |
| ✅ | SKU count | `16393 == 16393` |
| ✅ | SKU count matches sum of skus arrays | `16393` |
| ✅ | all family fields preserved | `uncovered=[]` |
| ✅ | all SKU fields preserved | `uncovered=[]` |
| ✅ | no runtime _ fields leaked | `clean` |
| ✅ | every SKU has code | `missing=0` |
| ✅ | every SKU has image URLs | `missing=0` |
| ✅ | HLP SKU count matches calc-group rule | `1770 == 1770` |
| ✅ | spot: CT1573 present w/ priceClass+image | `Points | img=CT1573.jpg` |
| ✅ | spot: TH6080Z present w/ priceClass+image | `Points | img=TH6080Z.jpg` |
| ✅ | spot: ZCC present w/ priceClass+image | `HLP | img=ZCC.jpg` |
| ✅ | programs exported | `120` |
| ✅ | rule tables exported | `10` |
| ✅ | category hierarchy exported | `15 categories` |
| ✅ | price field legend present | `yes` |

## Method

1. **Counts** — product count and SKU count in the export are compared to the source families/units, and to the sum of the emitted `skus[]` arrays.
2. **Field completeness** — the full set of raw field names on every family and every unit (excluding internal `_`-prefixed render fields) is compared against the mapped-field set plus each level's `extraFields` catch-all. `uncovered = []` means **no field was dropped**.
3. **No leakage** — the export is scanned to confirm no internal `_`-prefixed field leaked through.
4. **Integrity** — every SKU has a code and image URLs; the HLP/Points split is re-derived from calc groups and matched to the export.
5. **Reference data** — programs (120), rule tables (10), the category hierarchy, and the price-field legend are all confirmed present.

## Notes

- **USA catalog.** Discontinued / European-only SKUs are excluded upstream (e.g. L24CD, ZSM, BZS, FZS, L24, NT40; L24NT75 → L24NT75US). Every SKU in this file is USA-orderable, so `usaAvailable=true` / `discontinued=false` on all products.
- **Cross-listed SKUs are intentional** and preserved (a code may appear in more than one card).
- **Alterations** (1458 types, incl. the 63 cm depth conversions ANTST63/ANHST63/ANTSP63US) are ordering add-ons, not standalone SKUs, and are represented via each SKU's depth options and notes rather than as separate products.
