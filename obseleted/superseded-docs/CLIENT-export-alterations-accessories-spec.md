# How to add the "Alterations & Accessories" panel to the export

**Who reads this:** the Claude session that makes the catalog JSON from the legacy HTML file
(`leicht_units__584_.html`).

**Simple goal:** The product page has a panel called **"Possible Alterations & Accessories"**.
Right now the export does not have the data for this panel. This file tells you what to add,
where to find it in the HTML, and how the result should look.

Read this slowly. Each step is small.

---

## 1. What is wrong now

Open any SKU in the current export. Look at two fields: `relatedSkus` and `accessories`.
They are **empty for all 16,393 SKUs**. So we cannot build the panel.

The panel is **not saved as a list**. The app **builds it live** from the unit's size (width,
height, depth) and its family. This building step was never saved into the JSON. We need you to
save it.

The panel has up to **5 tabs**:

1. **Overview** — short summary text.
2. **Installation** — standard depth vs deep depth.
3. **Visible Sides** — the side panel that fits this unit.
4. **Alterations** — the change codes (like depth/height/width changes).
5. **Pullouts** — inner drawers and pullouts.

Each tab has **cards**. Each card has: a **name**, a **description**, an **image**, and a **code (SKU)**.
Some cards also have small buttons called **variants** (for example `L3/M3` and `M8`).

---

## 2. Where to find the code in the HTML

All the logic is in the big script inside `leicht_units__584_.html`. Search for these words to
jump to the right place. (Line numbers are from an older build — they may move a little. Use search,
not the number.)

| What you want | Search for this text |
|---|---|
| How the image link is made — `IMG(c)` | `const IMG = (c) =>` |
| Depth in mm turned into code digits — `D2CODE` | `D2CODE = {` |
| **Pullouts** tab | `IGS` and `Fitted behind doors` |
| **Alterations** tab | `v283` and `v341` |
| **Installation** standard note + deep code | `no alteration code required` |
| **Visible Sides** panel | `Visible Carcass Side` |
| **Sink** units (special tabs) | `v281` |
| **Cooktop** units (special tabs) | `v285` |
| **Vero** units (special tabs) | `_veroTabs` |

You do **not** need to fully understand that code. Section 4 below writes out the rules in plain words.
Use the code only to check yourself.

---

## 3. The numbers you need for each unit

For each unit `u` inside a family `f`, read these:

- `u.w` = width in cm. (Used in pullout codes.)
- `u.hc` = height number. If it is `73`, `80`, or `86`, use it. If not, use `80`. Call this **H**.
- `u.D` = depth in **mm** (example: `560`). Then **depthCm = round(u.D / 10)** (560 → 56).
- **depthCode** = the digits used inside a code. Use this small table:
  `340 → 36`, `460 → 48`, `560 → 58`, `660 → 68`. If not in the table, use `58`.
- `f.cat` = category (`Base`, `Tall`, `Wall`, `Midway`, …).
- `f.sub` = sub category (`Doors`, `Sinks`, `Cooktops & Downdrafts`, …).
- `u.alt` = the unit's own change codes. (Used for "Unit Specific" alterations.)

**How to make the image link for any code** (always include this in the output):

```
https://dash4data.s3.us-west-1.amazonaws.com/itemData/<CODE>.jpg
```

Put the code where `<CODE>` is. Example: `FS8056` → `.../itemData/FS8056.jpg`.

**Important rule:** only make a card if the code really exists in the catalog. If the code is not
in the catalog, skip that card.

---

## 4. The rules for each tab (normal cupboard)

### Installation tab (based on depth)
- Always add this note: **"Standard carcass depth (56 cm) — no alteration code required."**
- Add one card for the deep option:
  - code = `ANTSP63US`
  - name = "Deep Countertop / Deep Carcass Installation Package"
  - description = "Cupboard depth altered to 63 cm. Includes offset back panel and the extra space
    needed for deep cooktops, downdraft systems, ventilation, and utility routing."

### Visible Sides tab (based on height + depth)
- Make the side code: `sideCode = "FS" + H + depthCm`. Example: H80 + 56 → **`FS8056`**.
- Add one card under the heading **"Recommended for selected unit"**:
  - note = "Matches this unit's carcass depth: {u.D} mm = {depthCm} cm."
  - card code = `sideCode`, name = "Visible Carcass Side — {depthCm} cm",
    description = "Carcase height H{H} · carcass depth {depthCm} cm ({u.D} mm). Matches the selected
    unit specification."
- If `depthCm` is **not 61**, also add a second heading **"Alternative — deep installation"**:
  - note = "Same deep result from a standard carcass with the deep package. Use both codes together."
  - two cards: `FS{H}61` and `ANTSP63US`.

### Alterations tab (change codes)
Only do this tab when `f.cat` is `Base`, `Tall`, `Wall`, or `Midway`, and the unit is a normal
cupboard. Skip it for special units (fillers, fixed-size units, mitre end panels, waste-bin floor
units, large-appliance fronts — the code checks these with `isMechNoAlter`, `isMitreEndPanel`,
`isWasteBinFloor`, `isApplianceFront`, `isNoGenericAlt`).

**Important:** the FS programmes **VERVE-FS, WAKUU-FS, AVENIDA, CARRÉ-FS cannot be changed.**
For these, do not add the Alterations tab at all.

This tab has **two sub-tabs**:

- **Standard** — these 7 cards (skip any code not in the catalog, and skip an axis the programme
  does not allow):

  | Code | Name | Description |
  |---|---|---|
  | `ANST` | Cupboard Depth Alteration | Carcase depth altered to a non-standard size. |
  | `ANSH` | Cupboard Height Alteration | Carcase height altered to a non-standard size. |
  | `ANSHT` | Cupboard Height & Depth Alteration | Height and depth both altered. |
  | `ANSB` | Cupboard Width Alteration | Carcase width altered outside the standard grid. |
  | `ANSBH` | Cupboard Width & Height Alteration | Width and height both altered. |
  | `ANSBT` | Cupboard Width & Depth Alteration | Width and depth both altered. |
  | `ANSBHT` | Cupboard Width, Height & Depth Alteration | Width, height and depth all altered. |

- **Unit Specific** — cards made from this unit's own `u.alt` codes. Get name and description from
  the altnames table. (Shelf, open-shelf, sink, and cooktop units use their own codes instead — for
  example `ANRH`, `ANRT`, `ANRHT`, `ORA4080`. See the source rows.)

### Pullouts tab (based on width + depth) — this is the ONLY tab with variants
Only do this tab when `f.cat` is `Base`, `f.sub` is not `Sinks`, and it is not an accessory,
waste-bin, niche, or carousel unit. Let `dn = depthCode`.

For each code below, make a card **only if the code exists**. **Each pullout card has variant buttons**
(this is the only tab that uses them):

- `IGS{w}{dn}` — "Inner drawer · metal front" — variants: `L3/M3` = `IGS{w}{dn}`, `M8` = `IGS{w}{dn}U`.
- `IGZ{w}{dn}` — "Inner pullout · metal front" — variants: `L3/M3` and `M8` (add `U`).
- `IGZU{w}{dn}` — "Inner pullout · Front finish matching cabinet front" — variants: `L3/M3` and `M8`.
- "Exchange 1.6 cm front panel — inner drawers" — variants: `L3/M3` = `MPIGSU{w}`, `M8` = `MPIGZU{w}`.
- Door units only: spacer card — `L3/M3 + Spac` = `IGZEU{w}{dn}`, `M8 + Spac` = `IGZEU{w}{dn}U`.
  Also add card `ANIGE` (wide-angle hinge + spacer).
- Tab note (copy it exactly): "Fitted behind doors or pullouts. Behind doors the actual width is
  ≈2.5 cm below nominal (spacer at hinge side) and wide-angle hinges MP..SCH155 are required.
  M8 variant = type + U."

**Simple rule for M8:** `M8` code = the `L3/M3` code + the letter `U` at the end. Only add the `M8`
button if that `...U` code exists.

> **Remember:** variants are used **only in the Pullouts tab.** In every other tab, `variants` is an
> empty list `[]`.

---

## 5. How the output should look

For each unit, add one new object. Copy the group headings shown here — the frontend uses them.

```json
"accessoryPanel": {
  "tabs": [
    {
      "label": "Installation",
      "count": 1,
      "sections": [
        { "heading": "Standard installation",
          "notes": ["Standard carcass depth (56 cm) — no alteration code required."],
          "cards": [] },
        { "heading": "Deep countertop / deep carcass installation", "notes": [],
          "cards": [
            { "code": "ANTSP63US",
              "name": "Deep Countertop / Deep Carcass Installation Package",
              "desc": "Cupboard depth altered to 63 cm. Includes offset back panel …",
              "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/ANTSP63US.jpg",
              "variants": [] } ] }
      ]
    },
    {
      "label": "Visible Sides", "count": 1,
      "sections": [
        { "heading": "Recommended for selected unit",
          "notes": ["Matches this unit's carcass depth: 560 mm = 56 cm."],
          "cards": [
            { "code": "FS8056", "name": "Visible Carcass Side — 56 cm",
              "desc": "Carcase height H80 · carcass depth 56 cm (560 mm). Matches the selected unit specification.",
              "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/FS8056.jpg",
              "variants": [] } ] }
      ]
    },
    {
      "label": "Alterations", "count": 22,
      "sections": [
        { "heading": "Standard", "notes": [],
          "cards": [
            { "code": "ANST", "name": "Cupboard Depth Alteration",
              "desc": "Carcase depth altered to a non-standard size.",
              "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/ANST.jpg",
              "variants": [] } ] },
        { "heading": "Unit Specific", "notes": [], "cards": [ /* from u.alt */ ] }
      ]
    },
    {
      "label": "Pullouts", "count": 4,
      "notes": ["Fitted behind doors or pullouts. Behind doors the actual width is ≈2.5 cm below nominal (spacer at hinge side) and wide-angle hinges MP..SCH155 are required. M8 variant = type + U."],
      "sections": [
        { "heading": null, "notes": [],
          "cards": [
            { "code": "IGS6058", "name": "Inner drawer · metal front", "desc": "",
              "image": "https://dash4data.s3.us-west-1.amazonaws.com/itemData/IGS6058.jpg",
              "variants": [
                { "label": "L3/M3", "code": "IGS6058" },
                { "label": "M8", "code": "IGS6058U" } ] } ] }
      ]
    }
  ]
}
```

Simple field rules:
- `count` = the number shown next to the tab name. It is the total number of cards in that tab.
  For Alterations, add Standard + Unit Specific together.
- If a tab has no cards for this unit, do not add that tab.
- `variants` = `[]` when the card has no buttons (all tabs except Pullouts).
- **Every card must have an `image` link.**

---

## 6. Special units (different tabs)

Some unit types show a different set of tabs. If you can, add these too:

- **Sink units** (`f.id` starts with `SNK` or `XTR_`): tabs = Overview, Installation, Visible Sides,
  Sink Compatibility, Accessories. Door sinks also show hinge code `ANSVVO275`, waste bins (`EA`, `EA5`),
  cleaning pullouts (`PMZ`, `PMK`), towel rails (`AHS`, `AHS2`). Drawer/pullout sinks do not.
- **Cooktop / Downdraft units** (`f.sub` = `Cooktops & Downdrafts`): Overview, Installation, Visible
  Sides, using `ANTSP63US` and `FS{H}61` / `FS{H}56`.
- **Vero units**: Overview, Installation, Visible Sides, Interior storage, using `VE{w}...` codes.

If these are too hard, first do the normal tabs (Installation, Visible Sides, Alterations, Pullouts)
for normal cupboards. Then mark the special units so we can do them in a second step.

---

## 7. Faster and safer way (if you can run Node)

We already have a script called `extract_details.js`. It opens the real app in a headless browser and
reads this exact panel into clean data (with cards, images, and tabs). If you can run Node and Chrome,
this is the **safest** way — it copies the panel exactly.

```
node extract_details.js   # set FILE to leicht_units__584_.html
```

Use this if you can. Use the steps above only when you must build the export from Claude + the HTML
without a browser.

---

## 8. Check before you send the export

- [ ] Every unit that shows these tabs in the live app has a filled `accessoryPanel`.
- [ ] Every card has `code`, `name`, `desc`, `image`, `variants`.
- [ ] Pullout cards have the `L3/M3` and `M8` variants (when the `...U` code exists).
- [ ] Alterations tab is split into Standard and Unit Specific, with correct counts.
- [ ] FS programmes (VERVE-FS, WAKUU-FS, AVENIDA, CARRÉ-FS) have no Alterations tab.
- [ ] Codes not in the catalog are skipped, not added.
- [ ] Open a few image links in a browser to make sure they work.
