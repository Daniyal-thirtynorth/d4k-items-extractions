# What's in a product — a plain-English guide

Every product in the catalog (a cabinet, an add-on, a modification) is stored as one **item**. An item is
just a bundle of facts about that product. This guide explains **each fact in everyday words** — no code, no
jargon. Think of it as the label on the back of the box.

Quick idea first: **one item = one order code.** The order code (like `TK6080BZ2`) is the product's unique
ID, the way a barcode identifies a tin of beans. Everything else below describes that one product.

---

## 1. What it is and where you find it

| Field | In plain words |
|---|---|
| **sku** | The **order code** — the product's unique ID (e.g. `TK6080BZ2`). Everything else hangs off this. |
| **name** | The **title** shown on the product card and detail screen (e.g. "Cooktop Unit · Top Blender"). |
| **kind** | What **type** of thing it is: a *cabinet*, an *alteration* (a modification), an *accessory* (an add-on), or a *part*. |
| **category** | The **top menu group** it lives in: Base, Tall, Wall, Midway, and so on. |
| **subcategory** | The **finer group** under that: Sinks, Cooktops, Storage, Doors… |
| **section** | An optional **smaller heading** inside a sub-category on the page. |
| **familyId** | Which **product card** it belongs to. All the size/style versions of one product share this, so they show up as a single card in the grid. |
| **nameQualifier** | The small **amber note** next to the title, e.g. "Mid 45 cm deep" — a quick clarification. |
| **active** | Whether the product is **still current**. If a newer catalog drops the code, it's switched off (hidden) but kept for history. |

---

## 2. How big it is

Sizes are the cabinet **body** measurements, in **millimetres** (so 600 = 60 cm).

| Field | In plain words |
|---|---|
| **widthMm** | How **wide** it is. |
| **heightMm** | How **tall** it is. |
| **depthMm** | How **deep** it is. |
| **heightClass** | For tall units, which **height line** it belongs to — 73, 80, or 86. |

---

## 3. Front styles and the clickable options

| Field | In plain words |
|---|---|
| **availableTiers** | Which **front styles** the product comes in — the little **P · P1 · A · C · C1** badges (Primo, Avance, Contino, plus the "one handle on top" opening variants). |
| **parameters** | All the **option buttons** on the product: Width, Height, Depth, front style, and any coded rows. Most buttons jump you to a specific sibling product. **Depth is the exception** — see below. |
| **parameters.depth** | The Depth buttons usually **don't** change the product: the *same* cabinet can be built 36 / 48 / 58 / 68 cm deep, so every Depth button carries **this product's own code** — that repetition is correct, not a bug. What changes is the **order code**, which is stored on the button as **`code`** (`T6080IS2IZ` at 36 cm → `T608036IS2IZ`). 58 and the 63 cm alteration keep the plain code. Because the buttons share a code, the highlighted one is chosen by its **label**, never by matching codes. |
| **heightExtension** | Only on **tall** products that can be built **higher than 217 cm**. It's the small **"217+"** button beside the Height buttons; tapping it offers **230 / 244 / 250 cm**. Picking one doesn't open a new product — you order the **217 cm version plus one extra code** (`MPHVERL`), the same way the 63 cm depth works. It's kept separate from the Height buttons because a few families (tall panels) genuinely *do* sell a real 230 and 250 cm product, so both have to be shown side by side. |
| **doorLineYCode** | Only on a handful of products. Most front-line choices just tack a letter onto the code, so the app can work them out. **Door-line "Y" (line 66) uses a completely different code**, so it can't be worked out — the code is written down here (`MGT601468` → `MGT60146Y`). |
| **capabilities** | The **behind-the-scenes rules** that decide when a button **greys out** (shows but can't be clicked) because it doesn't fit your current choices. → See the plain guide `design-book-greying-examples.md`. |
| **faceForTiers** | Which front-style views show **this exact code** as the main card. (Housekeeping — it picks which sibling is the "face" of the card.) |

---

## 4. Things that go with it

| Field | In plain words |
|---|---|
| **alterations** | **Modification codes** you can apply — change the depth/height/width, deep-install, and so on. (The "Alterations" tab.) |
| **accessories** | **Add-ons** that fit in or with the cabinet — inner drawers, pullouts, cutlery inserts, mats, side panels. Some list size options too (e.g. runner lengths L3/M3 vs M8, or cable 1 m / 1.6 m / 2 m). |
| **companions** | Products **often planned together** with this one — "opening support", "complete this cabinet", "planned together". |

---

## 5. Colours and interior (Vero units)

| Field | In plain words |
|---|---|
| **finishInterior** | For Vero fronts: the **interior finish choices** — the colour/material swatches, which visible-side finishes are allowed together, and any extra-charge interior styles. |

---

## 6. The words on the detail screen

| Field | In plain words |
|---|---|
| **description** | The product's **write-up** — a title plus a few bullet points. |
| **restrictions** | Any **limits** on how it can be used or ordered. |
| **planningNotes** | Helpful **planning tips**. |
| **didYouKnow** | A **"Did you know?"** tip box — usually a cross-selling or handy hint. |
| **modifications** | **"How to" notes** for changing the product — e.g. moving the handle, or the P1/C1 opening variants — with the codes to use. |

---

## 7. Special badges and extras

| Field | In plain words |
|---|---|
| **handedLR** | Shows the **"L/R" badge** — the door/hinge can be fitted left- or right-handed. |
| **sinkFitment** | For sink cabinets: the **"Max Sink Size"** line and the **"+ Add Sink"** popup with its fitment rules. |
| **appliance** | For appliance-housing fronts: the **built-in appliance info** (fridge or dishwasher, brand, niche size) behind the card's **"Appliances"** button. |
| **toeKick** | The **plinth / kick-board** info under the cabinet (and the installed height that comes from it). |
| **inspiration** | A **lifestyle photo / lightbox** (the little camera icon) shown on some cards. |
| **engineering** | The **yes/no capability flags** in the Engineering section — suspended install, SensoMatic, tip-softclose, and the like. |

---

## 8. Price and catalog details

| Field | In plain words |
|---|---|
| **finishes** | The **finish → price** list — which finishes cost what. This drives the price shown. |
| **priceUnit** | Whether the price is shown in **points ("pts")** or **HLP**. |
| **catalogPage** | Which **printed-catalog page** the product is on (opens the PDF). |
| **priceGroupRef** | The catalog **price-group reference** (e.g. "22.09"). |
| **frontModifiers** | The **"Modifiers"** line in the spec — front-line codes like V / E / J / Y. |
| **carcaseLine** | Which **carcase build line** it uses (66 / 73 / 80 / 86), shown in the spec. |
| **weightKg** | The product's **weight**, in kilograms. |
| **volumeM3** | The product's **volume**, in cubic metres. |

---

## 9. Where it shows in the menus

| Field | In plain words |
|---|---|
| **functionalGroups** | Which **"Design Tasks"** menu entries this product appears under — the left sidebar grouping, e.g. Water → Sink Cabinets. |

---

## 10. The photo

| Field | In plain words |
|---|---|
| **imageUrl** | The **product photo**. You won't find it stored on the item — it's built automatically from the order code, so there's nothing to fill in. |

---

### A quick recap

- The **order code (sku)** is the product; everything else describes it.
- **Category → subcategory → section** decide **where you find it** in the menus.
- **Width / height / depth** are its **size**; **front styles** and **option buttons** are the **choices** you
  click; **capabilities** are the **rules** that grey those choices out.
- **Alterations / accessories / companions** are the **things that go with it**.
- The rest is **words, badges, price and catalog** detail shown around the product.

For the "what greys out and why" side, see `design-book-greying-examples.md` (also plain English).
