# LEICHT Catalog — extraction + test API

Extract the legacy single-file app's embedded catalog into a flat, MongoDB-ready
JSON, then browse/test it over REST with Swagger docs.

## 1. Extract data

```bash
python3 extract_catalog.py
```

Outputs (same folder):
- `leicht_catalog.json` — `{ extraction, programs, altnames, rules, items[] }`
- `leicht_items.json` — bare `items[]` array (for `mongoimport --jsonArray`)

~17,747 items, one per orderable code. See `CLAUDE.md` → "Data extraction" for the rules.

## 1b. Enrich with UI detail (optional but recommended)

```bash
npm install
node extract_details.js     # rewrites leicht_catalog.json + leicht_items.json, adding item.detail
```

Runs the **actual legacy app headless** (Chrome via puppeteer-core), calls its own
`openDetail()` renderer for every code, and serializes the panel into structured data so
each item carries the exact tabs/cards the source UI shows — `item.detail`:

```jsonc
"detail": {
  "available": true,
  "title": "Cooktop Unit · Top Blender · BZ2",
  "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/TK6080BZ2.jpg",
  "sections": [        // EVERY panel section in order — full parity with the legacy detail panel
    { "heading": "Specification", "kv": [{ "k": "Volume", "v": "0.29 m³" },
                                         { "k": "Catalog page", "v": "22.09 · PDF p.267" }] },
    { "heading": "Restrictions", "notes": ["No recessed handle vertical", "…"] },
    { "heading": "Possible alterations & accessories", "tabs": [
        { "label": "Visible Sides", "count": 3, "sections": [
          { "heading": "Recommended for selected unit",
            "cards": [{ "code": "FS8056", "name": "Visible Carcass Side — 56 cm" }] }]}]},
    { "heading": "Modifications — how to", "recipes": [
        { "text": "P1 — Primo, one handle on top — order P1TK6080BZ2 …", "codes": ["P1TK6080BZ2"] }]},
    { "heading": "Planning notes", "notes": ["Control panel on top."] }
    // also: Configure, Description, Programme availability, companions/Recommended Accessories
  ],
  "configure": [        // the CONFIGURE pills — each option resolves to a target order code
    { "axis": "Width",  "options": [{ "label": "70", "code": "TK7080BZ2" }, …] },
    { "axis": "Height", "options": [{ "label": "H86", "code": "TK6086BZ2" }, …] },
    { "axis": "Depth",  "options": [{ "label": "68", "depth": 68, "code": "TK608068BZ2" }, …] },
    { "axis": "Programme", "options": [{ "label": "A", "tier": "A", "code": "ATK6080BZ2" }, …] }
  ],
  "tabs": [ /* convenience copy of the alterations/accessories tabs */ ]
}
```

**Configure navigation (for the React UI):** render the `configure` pills; on click, `GET /api/codes/<option.code>` to load that variant's full `detail` (which carries its own `configure` reflecting the new selection). Width/Height/Programme codes are existing items; Depth yields a depth-encoded order code (carcass depth inserted).

- **List/grid card header** (the two pills the detail panel doesn't have) is added as two
  top-level item fields, scraped straight off the rendered grid for parity:
  `card_label` (top-left group label, e.g. `"Cooktop Unit"`) and `programme_badge`
  (top-right availability badge: `"ALL"` or a subset like `"P · A"` / `"C"`). Family-level;
  present in the slim list response so the grid renders headers without per-card fetches.
- Every card carries an `image` (S3 thumbnail URL) + `code/name/desc/options`; the panel's main
  `detail.image` too. `item.alterations` is rebuilt as the **merged general + unit-specific** list
  (each with `image` and a `group` = "Standard" | "Unit Specific").
- Driven by **code** through the app's own `goFam`/`codeLoc` resolver (handles post-patch
  family splits/merges), with `base_code` fallback for synthesized siblings.
- ~95% of items get a full panel; `available:false` means the source UI only shows that item
  as an option inside another card (non-standard widths, side-panel/worktop/cutlery variants).
- **Order matters:** `extract_catalog.py` first, then `extract_details.js` (it enriches the catalog file).

## 2. Run the API

```bash
npm install
npm start            # http://localhost:3000  (PORT env to change)
```

Open **http://localhost:3000/docs** for Swagger UI (root `/` redirects there).
OpenAPI spec: `http://localhost:3000/openapi.json`.

The server loads `leicht_catalog.json` into memory (override with `DATA_FILE=…`).

## Endpoints

| Method · Path | Purpose |
|---|---|
| `GET /health` | liveness + item count |
| `GET /api/items` | list/search, paginated — filters: `q, category, sub, section, family_id, programme_tier, programme_line, program_key, synthesized`; `sort, order, page, limit`. **Lists are slim** (no `raw`/`family_meta`/`detail` bodies) — pass `slim=false` for full docs |
| `GET /api/items/{id}` | one item by `_id` (`code__familyId__tier`) |
| `GET /api/codes/{code}` | all items sharing an order code |
| `GET /api/families/{familyId}` | all items in a family (e.g. `F805`) |
| `GET /api/categories` | distinct categories + counts |
| `GET /api/subs?category=` | distinct subs + counts |
| `GET /api/programs` | programme reference list |
| `GET /api/stats` | totals, per-category, per-tier, per-line |
| `GET /api/meta` | extraction metadata |

### Examples

```bash
curl "localhost:3000/api/items?category=Base&programme_line=PRIMO&limit=5"
curl "localhost:3000/api/items?q=floor%20unit&limit=3"
curl localhost:3000/api/codes/CT1573
curl localhost:3000/api/families/F805
curl localhost:3000/api/stats
```

> Notes: `finish_prices` are account points — divide by 100 for currency.
> `synthesized:true` items are programme siblings with no separate stored record.
> Read-only API; regenerate data by re-running the extractors (catalog → details).

## Project files

| File | Role |
|---|---|
| `leicht_units__562_.html` | the legacy single-file app (source of truth) |
| `extract_catalog.py` | embedded JSON → flat `items[]` (one per orderable code) |
| `extract_details.js` | headless render → adds `item.detail` (+ images, merged alterations, configure) |
| `leicht_catalog.json` | full output `{extraction, programs, altnames, rules, items[]}` (~228 MB) |
| `leicht_items.json` | bare `items[]` array for `mongoimport --jsonArray` |
| `server.js` / `openapi.js` | test REST API + Swagger spec |
| `shot_panel.js` | puppeteer helper to screenshot one legacy detail panel |
| `CLAUDE.md` | architecture notes for future work |

Pipeline order: **`extract_catalog.py` → `extract_details.js` → `npm start`.**
Re-running `extract_catalog.py` resets `item.alterations` to raw and drops `item.detail` — re-run `extract_details.js` after it.
