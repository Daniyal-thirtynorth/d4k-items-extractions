# Dash4 Detail-Panel Export — full field schema

**Who reads this:** the Claude session that makes `Dash4_AccessoryPanel_Export.json` from the legacy
HTML (`leicht_units__765_.html`).

**Read this first.** This file lists **every field** the export must have, in simple words. Follow it
exactly. The goal: the export holds everything the product **detail screen** shows when a user opens a
unit — the **W / H / D / Programme pills**, and **all the tabs** (Compatible Accessories, Overview,
Installation, Visible Sides, Alterations with its two sub-tabs, Pullouts, and the rest).

Checked against the live v765 UI on 2026-07-07.

---

## 0. What changed since the last export (must fix)

The last export (v728) was very good, but three things were missing or wrong. Fix all three:

1. **Alterations sub-tabs are lost.** The UI splits Alterations into **"Standard"** and **"Unit Specific"**
   (for example: Standard 7, Unit Specific 15). The last export put all cards in **one flat list** with
   no heading. Keep the two groups — see §4 (Alterations).
2. **Tab label has HTML in it.** The **"Inspiration"** tab label came out as raw `<svg …>…</svg>Inspiration`.
   The label must be **plain text only** — `"Inspiration"`. Strip all HTML from every `label`.
3. **The Configure pills are missing.** The detail screen has **Width / Height / Depth / Programme**
   pills at the top. Clicking a pill opens another unit (another order code). The last export did not
   include this. Add the new **`configure`** field — see §3.

---

## 1. Top level

```json
{
  "meta": { … },      // info about the export
  "units": { … }      // one entry per unit, the key is the unit's code
}
```

### `meta` fields

| field | type | meaning |
|---|---|---|
| `generated` | string | when the export was made (ISO date-time). |
| `source` | string | which HTML build it came from, e.g. "leicht_units v765 (headless parity run of openDetail)". |
| `imageUrlTemplate` | string | `https://dash4data.s3.us-west-1.amazonaws.com/itemData/<CODE>.jpg` — how card images are built. |
| `unitCount` | number | how many units are in `units`. |
| `unitsWithPanel` | number | how many units have at least one panel tab. |
| `note` | string | any extra note (for example: prices are left out because they change per programme). |

---

## 2. Each unit (inside `units`)

The **key** is the unit's code (for example `"TK6080BZ2"`). The value is an object:

| field | type | meaning |
|---|---|---|
| `code` | string | the unit's order code. Same as the key. |
| `fid` | string | the family id inside the app (used to open the panel). |
| `label` | string | the unit's display name, e.g. "Cooktop Unit · Top Blender · BZ2". |
| `cat` | string | category, e.g. "Base". |
| `sub` | string | sub category, e.g. "Cooktops & Downdrafts". |
| `W` | number | width in **mm** (e.g. 600). |
| `H` | number | height in **mm** (e.g. 795). |
| `D` | number | carcass depth in **mm** (e.g. 560). |
| `hc` | number or null | height class: 73, 80, or 86. null if it has none. |
| `alterations` | string[] | the unit's own alteration codes (its `u.alt` list), copied as-is. |
| `accessories` | string[] | the unit's own accessory codes, copied as-is. |
| `configure` | object | the Width/Height/Depth/Programme pills. **NEW — see §3.** |
| `accessoryPanel` | object | the tabs panel. **See §4.** |

If a unit has no panel, still add it with `accessoryPanel: { "tabs": [] }`.

---

## 3. `configure` — the W / H / D / Programme pills (NEW)

The top of the detail screen has four rows of pills. Each pill, when clicked, opens **another unit**.
Capture the target code of each pill so the frontend can navigate.

```json
"configure": {
  "width":   [ { "label": "60", "code": "TK6080BZ2", "selected": true,  "available": true },
               { "label": "70", "code": "TK7080BZ2", "selected": false, "available": true } ],
  "height":  [ { "label": "H73", "code": "…", "selected": false, "available": true },
               { "label": "H80", "code": "TK6080BZ2", "selected": true, "available": true } ],
  "depth":   [ { "label": "58", "code": "TK6080BZ2", "selected": true,  "available": true },
               { "label": "63", "code": "…",         "selected": false, "available": true } ],
  "program": [ { "label": "P",  "code": "TK6080BZ2", "selected": true,  "available": true },
               { "label": "P1", "code": "P1TK6080BZ2", "selected": false, "available": true },
               { "label": "C",  "code": "…", "available": false } ]
}
```

Field meaning for each pill option:

| field | type | meaning |
|---|---|---|
| `label` | string | the text on the pill (e.g. "60", "H80", "58", "P"). |
| `code` | string | the order code that opens when you click this pill. Get it the same way the app does — clicking the pill re-opens the panel with a new code; read that new code. |
| `selected` | boolean | true if this is the current unit's value. |
| `available` | boolean | true if the pill can be clicked (not greyed out). |

Rules:
- `program` uses the five tiers: **P, P1, C, C1, A**.
- Some pills are greyed out (not available) — still list them, with `available: false`.
- The depth row now includes **63** (a real depth). Include every pill the UI shows.

> Note: the UI also shows a small line "Depth is carcass; full depth = carcass + front + 2 mm". You may
> put this in `configure.note` if easy; it is optional.

---

## 4. `accessoryPanel` — the tabs

```json
"accessoryPanel": { "tabs": [ … ] }
```

`tabs` is a list. Put the tabs **in the same order the UI shows them**. Not every unit has every tab.

### Each tab

| field | type | meaning |
|---|---|---|
| `label` | string | **plain text** tab name. No HTML. See the tab list below. |
| `count` | number | the small number next to the tab name (total cards in the tab). |
| `notes` | string[] | the lines shown **above** the cards (rules, hints). Empty list if none. |
| `sections` | array | the groups of cards inside the tab. See below. |

**Tab names you will see** (use these exact plain-text labels):
`Compatible Accessories`, `Overview`, `Installation`, `Visible Sides`, `Alterations`, `Pullouts`,
`Sink Compatibility`, `Accessories`, `Inspiration`, `Mats`, `Interior storage`, and the cutlery module
tabs `Q-Box`, `L-Box oak`, `L-Box walnut`, `Plastic`, `Beech`, `Combo`, `Other`.

> **Important:** `Inspiration` (and any tab with an icon) must have a **plain** label. Do not put the
> icon `<svg>` into the label.

### Each section (inside `sections`)

| field | type | meaning |
|---|---|---|
| `heading` | string or null | the sub-heading above this group of cards. null if the tab has no sub-heading. |
| `notes` | string[] | notes tied to this group only. |
| `cards` | array | the cards in this group. |

**Headings you must keep:**
- **Alterations** tab → two sections: `heading: "Standard"` and `heading: "Unit Specific"`.
  Put the general width/height/depth codes (the `ANS…` set) in **Standard**, and the unit's own
  `u.alt` codes in **Unit Specific**. The `count` = Standard cards + Unit Specific cards.
- **Visible Sides** tab → `heading: "Recommended for selected unit"` and, when it applies,
  `heading: "Alternative — deep installation"` (two cards to order together).
- **Installation** tab → `heading: "Standard installation"` and
  `heading: "Deep countertop / deep carcass installation"`.

### Each card (inside `cards`)

| field | type | meaning |
|---|---|---|
| `code` | string | the card's SKU / code. |
| `name` | string | the card title (e.g. "Inner drawer · metal front"). |
| `desc` | string | the short description. Use `""` if the card has none. |
| `image` | string | **always** the S3 image link: `https://dash4data.s3.us-west-1.amazonaws.com/itemData/<CODE>.jpg` (code in UPPERCASE). |
| `variants` | array | the small buttons on the card. `[]` when there are none. See below. |

### Card variants (buttons)

Only some cards have variant buttons — mostly in **Pullouts** and the cutlery module tabs. Each variant:

| field | type | meaning |
|---|---|---|
| `label` | string | the button text (e.g. "L3/M3", "M8"). |
| `code` | string | the code that button orders. |

Variant rules:
- **Pullouts:** `L3/M3` = the base code (e.g. `IGS6058`). `M8` = the same code **+ `U`** (`IGS6058U`).
- **Exchange 1.6 cm front panel** card: `L3/M3` = `MPIGSU<w>`, `M8` = `MPIGZU<w>` (here M8 is a
  different code, **not** base+U — copy what the UI shows).
- In every tab **except** Pullouts / cutlery modules, `variants` is `[]`.

---

## 5. Worked example (one Base cooktop unit)

```json
"TK6080BZ2": {
  "code": "TK6080BZ2",
  "fid": "…",
  "label": "Cooktop Unit · Top Blender · BZ2",
  "cat": "Base", "sub": "Cooktops & Downdrafts",
  "W": 600, "H": 795, "D": 560, "hc": 80,
  "alterations": ["ANST","ANSH","ANSHT", "…"],
  "accessories": ["…"],
  "configure": {
    "width":  [ {"label":"60","code":"TK6080BZ2","selected":true,"available":true},
                {"label":"70","code":"TK7080BZ2","selected":false,"available":true} ],
    "height": [ {"label":"H73","code":"…","selected":false,"available":true},
                {"label":"H80","code":"TK6080BZ2","selected":true,"available":true},
                {"label":"H86","code":"…","selected":false,"available":true} ],
    "depth":  [ {"label":"58","code":"TK6080BZ2","selected":true,"available":true},
                {"label":"63","code":"…","selected":false,"available":true},
                {"label":"68","code":"…","selected":false,"available":true} ],
    "program":[ {"label":"P","code":"TK6080BZ2","selected":true,"available":true},
                {"label":"P1","code":"P1TK6080BZ2","selected":false,"available":true},
                {"label":"C","code":"…","available":false},
                {"label":"C1","code":"…","available":false},
                {"label":"A","code":"…","available":true} ]
  },
  "accessoryPanel": {
    "tabs": [
      { "label": "Compatible Accessories", "count": 7,
        "notes": ["Everything compatible with this cabinet, wherever it lives in the catalog. Click a card to open it."],
        "sections": [ { "heading": "Base · Cooktops & Downdrafts", "notes": [],
          "cards": [ { "code": "…", "name": "Blender factory drilled", "desc": "…",
                       "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/….jpg", "variants": [] } ] } ] },

      { "label": "Overview", "count": 0, "notes": [],
        "sections": [ { "heading": null,
          "notes": ["Cooktop Unit · Top Blender · BZ2. This cooktop / downdraft unit can be set up for standard or deep installation…"],
          "cards": [] } ] },

      { "label": "Installation", "count": 1, "notes": [],
        "sections": [
          { "heading": "Standard installation", "notes": ["Standard carcass depth (56 cm) — no alteration code required."], "cards": [] },
          { "heading": "Deep countertop / deep carcass installation", "notes": [],
            "cards": [ { "code": "ANTSP63US", "name": "Deep Countertop / Deep Carcass Installation Package",
                         "desc": "Cupboard depth altered to 63 cm. Includes offset back panel …",
                         "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/ANTSP63US.jpg", "variants": [] } ] } ] },

      { "label": "Visible Sides", "count": 3, "notes": [],
        "sections": [
          { "heading": "Recommended for selected unit", "notes": ["Matches this unit's carcass depth: 560 mm = 56 cm."],
            "cards": [ { "code": "FS8056", "name": "Visible Carcass Side — 56 cm",
                         "desc": "Carcase height H80 · carcass depth 56 cm (560 mm). Matches the selected unit specification.",
                         "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/FS8056.jpg", "variants": [] } ] },
          { "heading": "Alternative — deep installation", "notes": ["Same deep result from a standard carcass with the deep package. Use both codes together."],
            "cards": [ { "code": "FS8061", "name": "Visible Carcass Side — 61 cm", "desc": "…", "image": "…/FS8061.jpg", "variants": [] },
                       { "code": "ANTSP63US", "name": "Deep Installation Package", "desc": "…", "image": "…/ANTSP63US.jpg", "variants": [] } ] } ] },

      { "label": "Alterations", "count": 22, "notes": ["Showing all alterations. Select a programme — FS programmes (VERVE-FS, WAKUU-FS, AVENIDA, CARRÉ-FS) cannot be altered."],
        "sections": [
          { "heading": "Standard", "notes": [],
            "cards": [ { "code": "ANST", "name": "Cupboard Depth Alteration", "desc": "Carcase depth altered to a non-standard size.", "image": "…/ANST.jpg", "variants": [] } ] },
          { "heading": "Unit Specific", "notes": [],
            "cards": [ { "code": "…", "name": "…", "desc": "…", "image": "…", "variants": [] } ] } ] },

      { "label": "Pullouts", "count": 4,
        "notes": ["Fitted behind doors or pullouts. Behind doors the actual width is ≈2.5 cm below nominal (spacer at hinge side) and wide-angle hinges MP..SCH155 are required. M8 variant = type + U."],
        "sections": [ { "heading": null, "notes": [],
          "cards": [ { "code": "IGS6058", "name": "Inner drawer · metal front", "desc": "",
                       "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/IGS6058.jpg",
                       "variants": [ {"label":"L3/M3","code":"IGS6058"}, {"label":"M8","code":"IGS6058U"} ] } ] } ] }
    ]
  }
}
```

---

## 6. Other detail-screen sections (NOT in this export)

The detail screen also shows these. They already come from the **main catalog** (the v584/v728 product
JSON) and the backend builds them — so **do NOT add them to this export** (to avoid duplicate data).
Listed here only so you know they are handled elsewhere:

- **Specification** (Width / Height / Depth / Modifiers / Carcase line / Weight / Volume / Catalog page).
- **Restrictions** (the bullet list).
- **Programme availability**, **Pricing**.
- **Catalog** button → the catalog PDF page (backend `detail.catalog`).
- **Engineering** flags (Suspended install, SensoMatic, Tip-Softclose, Opening system P1, 68 cm depth →
  Yes/No). *New in v765* — if the backend does not already build these, tell the team; they come from
  the unit's own flags, not from this panel export.
- **Toe-kick installed height** line, **My Note** box, **Ask the Expert** button — UI features, no data
  needed from this export.

---

## 7. Final checklist before sending

- [ ] Every `label` is plain text (no `<svg>` / HTML). Check **Inspiration** especially.
- [ ] **Alterations** has two sections: **Standard** and **Unit Specific**, with the right cards and count.
- [ ] Each unit has a **`configure`** object with width / height / depth / program pill codes.
- [ ] Every card has `code`, `name`, `desc`, `image`, `variants`.
- [ ] Pullout cards have `L3/M3` + `M8` variants (when the `…U` code exists).
- [ ] Tabs are in the same order as the UI.
- [ ] Codes that do not exist in the catalog are skipped, not added.
- [ ] Open a few image links in a browser — they must load.
