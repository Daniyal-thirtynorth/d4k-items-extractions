# How to use the Design Book admin panel

Written 2026-08-20. Every screen, button and field named here was opened on the
live site and checked.

This is the guide for the person who edits the catalogue. You do not need to know
any code to follow it.

---

## 1. Opening the panel

1. Go to `https://dev.dash4kitchen.com/crm-management` and sign in.
   (On production it is the same path on the live address.)
2. The page is called **Manage CRM**. There is a menu down the left side.
3. Scroll that menu to the bottom. The last heading is **DESIGN BOOK**.
4. Click **Items**.

You are now on the Design Book item list. The catalogue holds 18,339 items, so
use the search box to get to the one you want.

---

## 2. What is on this screen

Top right of the list:

| Button | What it does |
|---|---|
| **Add item** | Creates a new item. §6. |
| **Active** / **Inactive** | Switches which items the list shows. §5. |
| **Search…** | Type a code or a name. The server does the searching, so it stays fast. |

The columns are **Image · SKU · Name · Category · Programme · Range · Price**.
At the left of every row:

- ✏️ **pencil** — open the item and edit it.
- 🗑️ **bin** — hide the item, or on the Inactive list, bring it back. §5.

At the bottom you can change **Rows per page** and move between pages.

---

## 3. The edit window

Click the pencil on a row. A window opens titled **Edit item · <the code>**,
split into eleven numbered parts:

| Part | What is in it |
|---|---|
| 1 · Identity and taxonomy | Code, name, category, **familyId**, and the **item is active** tick |
| 2 · Dimensions and tier badges | Width, height, depth, front-line badges |
| 3 · Capabilities | What the item is allowed to do |
| 4 · Parameters | The size options behind the pills |
| 5 · References | **Alterations, Companions, Accessories** — §4 |
| 6 · Vero finish interior | Interior finish swatches |
| 7 · Free text | Description, planning notes |
| 8 · Small blocks | Extra blocks such as "inspiration" |
| 9 · Pricing and catalog | Price group, catalogue page |
| 10 · Grid, ordering and row-builder inputs | Where the card sits in the grid |
| 11 · Engineering and nav | Technical settings |

**Save changes** and **Cancel** sit at the bottom of every part.

> **The code cannot be changed.** The first box reads **SKU (locked)**. If a code
> is wrong, add a new item with the right code and hide the old one.

---

## 4. Put two or more cards together into one card

### Why they are separate

Every item carries a **familyId**. All items with the same familyId become **one
card** in the Design Book. The extra items become the pills on that card.

Two things showing as two cards means they have two different family ids. Real
example from the live catalogue:

| Card | familyId | Items in it | Pills |
|---|---|---|---|
| `ZGRS419` | `XAG_Ha_ac0d14` | 5 | Ty 19 · 22 · 23 · 25 · 27 |
| `ZGRS430` | `XAG_Ha_ac0d14_B` | 4 | Ty 30 · 35 · 42 · 45 |
| `ZGRS422PZ2` | `HDL_ZGRS422PZ2` | 1 | none |

Searching `ZGRS4` here gives **10 rows**; the Design Book shows **3 cards**.
5 + 4 + 1 = 10. That is the family grouping at work.

### Do this

1. Search for the card you are keeping — `ZGRS419`.
2. Click its **pencil**. In part **1 · Identity and taxonomy**, select the
   **familyId** value and copy it: `XAG_Ha_ac0d14`. Close the window with the
   **×** in the corner.
3. Search for the code you are moving — `ZGRS430`.
4. Click its **pencil**. Clear the **familyId** box and paste the value in.
5. Click **Save changes**.
6. Repeat steps 3–5 for every other code that belongs on that card.
7. Open the Design Book and reload. The cards are now one card, and the codes
   you moved are extra pills on it.

### What happens as a result

- **The pills build themselves.** You never type them. They come from whichever
  items share the family id — move an item in, its pill appears; move it out, the
  pill goes.
- **The card takes its name and picture from one item**, the main item of the
  family. In this example `ZGRS422PZ2` is named "Handle screws for" while the
  other two are "Handle screws", so check the merged card reads correctly and fix
  the **Name** if it does not.
- **To split them again**, put the old family id back.

---

## 5. Decide what appears under Alterations, Accessories and Planned together

These are the three grey headings at the bottom of a cabinet's detail panel.
Each one is fed by a single box, and nothing else feeds it:

| Heading in the Design Book | Box in part **5 · References** |
|---|---|
| ALTERATIONS | **alterations** |
| ACCESSORIES | **accessories** |
| PLANNED TOGETHER | **companions** |

### Do this

1. Search for the cabinet — for example `AT6080SZIS2`.
2. Click the **pencil**.
3. Scroll to **5 · References**. Under the grey words "sku codes" are the three
   boxes.
4. Each code already there is a chip, e.g. `MPIGSU60 ⊗`.
   - **Add a code**: click into the box, type it, press **Enter**.
   - **Remove a code**: click the **⊗** on its chip.
5. Click **Save changes**.
6. Open that cabinet in the Design Book and reload. What is in each box is what
   appears under that heading.

Real content of `AT6080SZIS2` today:

```
alterations   MPIGSU60 · ANST · ANSH · ANSHT · ANSB · ANSBH · ANSBT · ANSBHT
companions    BFA6058 · BFC6058 · BFCG6058 · EBF6058 · EBFF6058 · EBFM6058 ·
              HBF6058 · HBFF6058 · HBFM6058 · FSUE8058
accessories   the same list plus the drawer inserts, mats and light strips
```

### Two limits

- **The accessory tab is decided for you.** Inside ACCESSORIES the Design Book
  splits items into tabs — Q-Box, Plastic, L-Box oak and so on — worked out from
  the first letters of the code. An accessory whose code does not start with one
  of the known prefixes goes into the **Other** tab.
- **Accessory variants are not editable here** — the box says so. Some
  accessories carry runner or length options underneath them. You can add and
  remove the accessory; its options need a developer.

---

## 6. Hide an item, or bring it back

Nothing here deletes an item. Hiding is called **deactivating**, and it is
reversible.

### Hide it

1. Make sure **Active** is selected.
2. Search for the item.
3. Click the **bin** icon on its row.
4. A box asks **"Deactivate this item?"**. Click **Deactivate**.

It disappears from the Design Book immediately. The data stays.

Until 2026-08-21 that was not true. Deactivating moved an item to the **Inactive**
list, and its card carried on showing to designers anyway — the Design Book was
never told to leave deactivated items out. That is fixed and live. If you tried
this before and thought it had not worked, try it again.

### Bring it back

1. Click **Inactive**.
2. Search for the item.
3. Click the same icon on its row — here it means **Restore**.

### The other way

In the edit window, part **1 · Identity and taxonomy**, right-hand side, there is
a tick box **item is active**. Untick it and save; that does the same thing.

### Items can go inactive on their own

Every catalogue import deactivates anything **not in the new file**, and records
the date. That is deliberate — discontinued articles stop showing without the
record being lost.

So when an item you expect is missing, look on the **Inactive** list.

### An import undoes your hiding

This one is worth knowing before you rely on hiding something. An import switches
**on** every item that is in the new file — including one you hid by hand. Your
change is not kept, and nothing tells you it was undone.

So hiding an item is reliable until the next catalogue import, and after that you
have to hide it again. If an item needs to stay hidden for good, say so and it
can be made to stick; that needs a decision and a small change, and neither has
been made yet.

---

## 7. Add a new item

1. Click **Add item**, top right.
2. A window opens titled **Add Design Book item**, with the same eleven parts.
3. Fill in:
   - **SKU** — required, marked with a star. The code, e.g. `TK6080BZ2`. It
     cannot be changed later.
   - **Name** — what a designer reads on the card.
   - **Category** and **Subcategory** — where it sits in the left menu.
   - **familyId** — leave blank for a card of its own, or type an existing family
     id to join that card (§4).
4. Click **Add item** at the bottom.

> ⚠️ **A hand-added item does not survive the next catalogue import.** The import
> file wins: anything added by hand that is not in the next file gets deactivated
> automatically, the same as a discontinued article. Use this for something
> urgent, and tell whoever prepares the catalogue file to add it properly.

---

## 8. What this panel cannot do

- **Change an item's picture.** The photo on the list and the card comes from the
  catalogue import, and the edit window has no field for it. (Part 8 has an
  `imageUrl` box, but that belongs to the "inspiration" block — a different
  thing.) A developer has to change a product photo.
- **Change the code of an existing item.** SKU is locked. Add a new item, hide
  the old one.
- **Choose which accessory tab something appears in.** §5.
- **Edit accessory variants** — runner and length options. §5.
- **Reorder the pills** on a card. That comes from the catalogue.
- **Make a hidden item stay hidden through a catalogue import.** The import
  switches it back on. §6.

---

## 9. Working notes

- **Change one thing, then look.** Save, open the Design Book, reload, check.
  Five changes at once make a wrong result impossible to trace.
- **Keep a note of any familyId you overwrite.** It is the only way to put a card
  back exactly as it was.
- **Family ids are exact.** Spelling, capitals and underscores all count —
  `XAG_Ha_ac0d14` and `XAG_Ha_ac0d14_B` are different ids.
- **The Design Book caches.** After saving, reload the page; the change does not
  appear on a page that is already open.

---

## 10. If something looks wrong afterwards

- **The cards did not merge.** The two family ids are not identical. Reopen both
  and compare them character by character.
- **An accessory went into the "Other" tab.** Its code does not start with one of
  the known prefixes. §5.
- **An item vanished.** Check the **Inactive** list — an import may have
  deactivated it.
- **A code cannot be found in the Design Book search.** It is probably an *order
  code*, not a catalogue code. The app builds order codes when a designer clicks
  the depth or front pills: `T5066` at 36 cm deep produces `T506636`, and that
  longer code is not stored anywhere. Search the shorter base code. Full
  explanation in `client-feedback-2026-08-20-status-and-browser-verification.md`
  §5 D and §5 E.
