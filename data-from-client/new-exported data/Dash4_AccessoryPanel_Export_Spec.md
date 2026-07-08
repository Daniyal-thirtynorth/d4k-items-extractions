# Dash4 — "Possible Alterations & Accessories" Panel Export

**Generated from:** `leicht_units` v728, by a headless parity run of the live `openDetail()` panel logic (Playwright/Chromium). Every card, tab, count, note, variant, and image URL in this export is exactly what the detail panel renders — not a re-implementation.

**Files**
- `Dash4_AccessoryPanel_Export.json` — all units, keyed by SKU (~59 MB).
- `Dash4_AccessoryPanel_Export.json.gz` — same, gzipped (~1.1 MB; serve this).
- `Dash4_AccessoryPanel_SAMPLE.json` — 3 representative units, pretty-printed, to eyeball the shape.

**Coverage:** 18,405 units. 12,315 carry a computed `accessoryPanel`. The remainder (accessories, fillers, fixed-mechanism units, dishwasher/appliance fronts with no inserts) legitimately have no panel and export `"tabs": []`. 220,367 cards total, **every one with an image URL**; 63,439 variant options.

---

## Top-level shape

```json
{
  "meta": {
    "generated": "…Z",
    "source": "leicht_units v728 (headless parity run of openDetail)",
    "imageUrlTemplate": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/<CODE>.jpg",
    "unitCount": 18405,
    "unitsWithPanel": 12315,
    "note": "captured under the pristine default state; card prices omitted (programme-dependent)"
  },
  "units": {
    "T6080S": {
      "code": "T6080S",
      "fid": "XSPL_TS",
      "label": "Floor unit …",
      "cat": "Base", "sub": "Function Cabinets",
      "W": 600, "H": 730, "D": 560, "hc": null,
      "alterations": ["ANST","ANSH", …],     // the unit's own u.alt list, verbatim
      "accessories":  ["…"],                  // the unit's own accessory/x list, verbatim
      "accessoryPanel": {
        "tabs": [
          { "label": "…", "count": N, "notes": ["…"],
            "sections": [
              { "heading": "…", "notes": ["…"],
                "cards": [
                  { "code": "IGS6058",
                    "name": "Inner drawer · metal front",
                    "desc": "…",
                    "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/IGS6058.jpg",
                    "variants": [ { "label": "L3/M3", "code": "IGS6058" },
                                  { "label": "M8",    "code": "IGS6058U" } ] }
                ] }
            ] }
        ]
      }
    }
  }
}
```

This is the exact shape the IT email requested: `accessoryPanel.tabs[].sections[].cards[]`, each card with `code / name / desc / image / variants`, plus per-tab `notes` and per-section `notes`.

---

## Tabs and how each is built

Tabs are emitted **in the order the UI shows them**, per unit. Not every unit has every tab — the panel logic adds/removes tabs based on the unit's type. `count` is the badge number the UI displays.

### Overview
Summary of the unit — the `ld` bullet list or a short descriptive note. `count` 0 (no cards). Present on sink and appliance-front panels.

### Installation
Standard vs deep. **Standard** = no code (fits as-is). **Deep** = the deep-installation package, depth-driven, e.g. `ANTSP63US` (63 cm cupboard depth with offset back panel), `ANTSPZAUS`, plus fitting hardware like `MPRU`. Cards carry the package codes.

### Visible Sides
The finished carcass side panel matched to the unit's carcass height + depth:
- **Recommended for selected unit** — a single `FS<H><D>` code, e.g. **H80 + 56 cm → `FS8056`**, **H73 + 66 → `FS7366`**.
- **Alternative — deep installation** — a two-card pairing: the 61 cm side **plus** the deep package, meant to be ordered **together**, e.g. `FS7361` + `ANTSP63US`. The section heading and its note carry the "use both codes together" rule.

### Alterations
Split into what the UI shows:
- **Standard** — the general width/height/depth alteration codes (depth `ANST`/`ANSH`, height, width, etc.). These are the same set across comparable units.
- **Unit-Specific** — codes drawn from the unit's own `u.alt`.
- `count` is the number of alteration cards shown. The tab-level note carries the FS-programme rule ("FS programmes … cannot be altered").
- The tab is **absent** on fixed-mechanism cabinets, fillers/blenders, and fixed/special units — matching the UI (v292/304/306).

### Pullouts
Inner drawers / inner pullouts matched to the unit's **width + depth**, e.g. `IGS6058` (inner drawer), `IGZ6058` (inner pullout). Each card's **variant chips** are captured:
- **`L3/M3`** → the base code (`IGS6058`)
- **`M8`** → the same code **+ `U`** (`IGS6058U`) — the runner variant.

The tab/section note carries the fitment rule.

### Other tabs seen
Sink panels also emit **Sink Compatibility** and **Accessories**; drawer-storage families emit named module tabs (**Q-Box, L-Box oak, L-Box walnut, Plastic, Beech, Other**); dishwasher fronts emit **Inspiration**; many units lead with **Compatible Accessories**. All follow the same card shape.

---

## Card fields

| field | source |
|---|---|
| `code` | the `.icode` shown on the card |
| `name` | the `.iname` display name |
| `desc` | the `.idesc` short description (may be empty where the source has none) |
| `image` | **always** `https://dash4data.s3.us-west-1.amazonaws.com/itemData/<CODE>.jpg` (uppercased code) |
| `variants` | each `.mchip` → `{ label, code }`; `code` parsed from the chip's `mcPick(...)` handler. `M8` variants resolve to `code + "U"`. |

## Notes fields
- `tab.notes[]` — the lines rendered **above** the cards (depth-match line, FS-programme rule, etc.).
- `section.notes[]` — notes tied to a specific section (e.g. the "order both codes together" line under *Alternative — deep installation*).

---

## Generation method (for regenerating with parity)

1. Instrument the app: a one-line hook inside `openDetail`, right where the panel's `_accTabs` array is finished, calls `window.__capTabs(fid, code, _accTabs)`. This captures the fully-built tab HTML — the same HTML the panel paints — with zero change to app behavior. (Hook is fenced `// EXPORT HARNESS ONLY` in `export_harness.html`.)
2. Headless loop (Playwright): for every non-hidden family × unit, call `openDetail(fid, code)`, read the captured tabs, and parse each tab's HTML into `sections[]`/`cards[]` by walking the DOM (`.sub2` → section heading; `.itemcards .icard` → cards; `.note`/`.bul` → notes; `.mchip` → variants). Because the HTML is the real panel output, the result is guaranteed parity.
3. Stream one JSON record per unit to disk (NDJSON), then assemble the keyed JSON above.

**Baseline state:** the export is captured under the app's **pristine default** — no programme selected, depth 58, no Fronts filter. That's the neutral panel every unit shows on first open. Card **prices are intentionally omitted** because they resolve per selected programme (Points/HLP columns); the panel *structure* — which this export is about — is programme-independent. If per-programme pricing is needed later, the same harness can loop programmes and add a price per card.

**Codes without full data:** a handful of recently-added codes have no priced/desc row in the current `web_data` (e.g. `L24CFFB4`, `SMVK100/160/200`, `SMNT`, EU `SMNK200`). They still export with `code` + `image`; `desc`/`variants` fill in on the next IDM data pass. This does not affect the panel links or the FS/IGS/ANTSP matching.
