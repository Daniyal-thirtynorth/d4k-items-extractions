# How to change many items at once with LIO

A step-by-step guide. Written for the person doing the work, not for a developer.

---

## What this does

Some changes to the Design Book touch hundreds of items at once — for example, giving every cabinet
that has the oak L-Box drawer sets the walnut ones as well. Doing that one item at a time is slow,
and every cabinet needs the drawer set in **its own size**.

With this screen you describe the change in plain words. LIO (the Design Book assistant) works out
which items are affected and **gives each one the right size automatically**. You see the full list
before anything happens, untick anything you don't want, and press **Save**.

**LIO never changes the catalogue by itself.** Nothing is saved until you press Save.

**What it can change:** the three lists in section **5 · References** of an item's edit form:

- **Accessories** — the cards under *Possible alterations & accessories*, such as drawer sets,
  inserts, mats and pullouts. These are the ones that come in sizes.
- **Alterations** — the modification codes, such as ANSH.
- **Companions** — the codes planned together with the item, such as MPRU (rear panel), the L24
  lighting set, or HFO3 (opening support).

It does not change names, prices, card groups or colours.

---

## Before you start

- You need to be a **Master Admin** or an **Admin**. The screen is not shown to other users.
- Know roughly **what** you want to add or remove (for example "the walnut L-Box drawer sets") and
  **which items** (for example "all Tall units", or a list of codes).

---

## Open the screen

1. Click the **people icon** in the top-right corner, then **Manage CRM**.
2. In the list on the left, scroll to **DESIGN BOOK** and click **LIO bulk edits**.

---

## Make a change

1. In the box **What should change?**, type what you want in plain words.
2. Click **Ask LIO**.
3. Wait while it says *"LIO is working out the changes…"*. This usually takes **20 seconds to 2
   minutes**, depending on how many items are involved.
4. Read LIO's short summary. It tells you what it will change, on how many items, and whether
   anything could not be matched.
5. Check the table **"N items to change"**. Every row shows the code, its name, its size, which list
   changes, and the codes it will **add** (green) or **remove** (red).
6. Every row starts ticked. **Click a row to untick it** if you don't want that one changed. The
   button updates, for example from *Save 3 changes* to *Save 2 changes*.
7. Click **Save N changes**, read the message, and click **Save** to confirm.
8. A message tells you how many items were saved. If any failed, their codes are listed.

---

## Examples

Each of these was tried on the real catalogue.

### 1. Add a drawer set to specific cabinets

> Add the walnut L-Box drawer sets to T3080, T6080 and T9080

LIO proposes:

| Code | Size (mm) | Adds |
|---|---|---|
| T3080 | 300 × 560 | LBNS30581, LBNS30582, LBNS30583, LBNS30584 |
| T6080 | 600 × 560 | LBNS60581, LBNS60582, LBNS60583, LBNS60584 |
| T9080 | 900 × 560 | LBNS90581, LBNS90582, LBNS90583, LBNS90584 |

You did not say any sizes. Each cabinet got the drawer sets that fit its own width.

### 2. Add something to every item that already has something else

> Give every unit that has the oak L-Box drawer sets the walnut ones too

LIO looks at all 1,315 items that carry the oak sets. Today every one of them already has the walnut
sets too, so LIO answers that there is **nothing to change**. When something is missing, those items
appear in the table with the right-size codes.

### 3. Remove something from a whole category

> Remove the walnut L-Box drawer sets from all Tall units

LIO proposes 302 Tall items, removing their walnut drawer sets.

### 4. Narrow the last request

After example 3, type in the same box (it now says **Refine the request**):

> Only the ones that are 600 mm wide

LIO keeps the first request and narrows it: 131 items instead of 302. You can keep refining this way.
Click **Start over** to begin a new, unrelated request.

### 5. Add the same code to every item

> Add the alteration ANSH to T6080 and T6073

Codes that are the same on every cabinet, such as alterations, are added as they are, without
sizing. In this case both cabinets already had ANSH, so LIO said there was nothing to change.

### 6. Add a companion

> Add MPRU as a companion to T6080 and T3080

LIO proposes both cabinets, each adding MPRU to its **Companions** list. Companions work like
alterations: the same code goes on every item you name.

### 7. When the request is too broad

> Add the oak L-Box drawer sets to every Base unit that has the IGZ inner drawers

This matches more than 2,000 items, which is more than one request may change. LIO does not propose
anything; it asks you to narrow it down, for example to one section, one width or one programme.

---

## Tips for writing a request

- **Say what, and to which items.** "Add the walnut L-Box drawer sets to all Base drawer units" works
  better than "walnut".
- **Use the product's name as it appears on the card**, or the code if you know it.
- **Ways to pick items that work well:** a list of codes; a category ("all Tall units"); a width
  ("600 mm wide"); or "every item that already has X".
- **Never type sizes for the parts.** Say *which* part; LIO and the system pick the size.
- **Say which list when it could be either**, for example "as a companion" or "as an alteration".
  Drawer sets, inserts and mats are always accessories.
- **If the table isn't what you meant, refine it** instead of saving. Nothing has been written yet.

---

## How the right size is chosen

Sizing applies to **accessories that come in a series of sizes**, such as the L-Box drawer sets.
Alterations and companions are single codes and are added exactly as named.

You never choose the size of a part. The system picks it for each item, in this order:

1. **The size the catalogue already uses for an item of that size.** A 300 × 560 cabinet gets the
   300 × 580 drawer set. A 1050 × 650 corner cabinet gets the 400 × 580 set, because that is the size
   the catalogue already fits in corner cabinets.
2. **If the catalogue has never paired that size**, the part with the same width and the matching
   depth is used (a 560 mm cabinet takes the 580 mm part).
3. **If nothing fits**, the item is **not guessed**. It appears in a second table, **"items nothing
   fits — add by hand"**, with the reason. Add those in the item's edit form.

Only **width and depth** are matched. The drawer sets and inserts this is meant for do not vary by
height.

---

## Things to know

- **Nothing happens until you press Save.** Asking LIO, reading the table and refining are all safe.
- **Saved changes survive the next catalogue import.** When the new catalogue (for example the 2027
  one) is loaded, items you changed here keep the lists you saved. The item shows as **pinned** in
  the Items tab.
- **The other side of that:** while an item is pinned, a new catalogue will **not** update that
  list on that item. To hand it back to the catalogue, open the item in the **Items** tab and unpin it.
- **A series means every set in it.** "The walnut L-Box drawer sets" adds all four drawer sets
  (Set 1 to Set 4) in each item's size. Choosing only one of them (for example only "Drawer Set 1")
  is not possible yet.
- **At most 2,000 items per request.** If LIO asks you to narrow the request, split it, for example
  by category or width.
- **Items LIO leaves alone:** an item that already has the part is not listed, and nothing is added
  twice.
- **One person at a time.** If someone else edits the same item between your proposal and your Save,
  your Save wins. For a large change, ask LIO again just before saving.
- **After a Save the table clears**, because it no longer matches the catalogue. Ask again for the
  next change.
- **Every code LIO writes is checked** against the catalogue before you see it. It cannot propose a
  code that does not exist.

---

## Changing a single item

Two ways:

1. **On this screen**, name just that code: *"Add the walnut L-Box drawer sets to T6080"*. You get the
   right size automatically, the same as for many items.
2. **In the item's edit form** (Manage CRM → Items → pencil icon, section **5 · References**), edit
   the **alterations**, **companions** or **accessories** field yourself. There is no automatic sizing there, and a part added in that form
   appears without its **L3/M3 · M8** buttons. Use this screen when the part has those buttons.

---

## What the messages mean

| You see | What it means | What to do |
|---|---|---|
| *"…there is nothing to change"* | Every matching item already has it (or doesn't have what you asked to remove) | Nothing. Check the request if you expected changes |
| A question from LIO and no table | The request was unclear or too broad | Answer it in the same box |
| **"items nothing fits — add by hand"** | No part in that series fits those items' size | Add them in the item's edit form, or leave them |
| *"LIO could not finish this request."* | It ran out of time or steps | Ask again, more narrowly |
| *"N saved, M failed: …"* | Some items did not save | Ask again for just those codes |

---

## If something goes wrong

Send these three things and it can usually be sorted out quickly:

1. The exact request you typed.
2. A screenshot of LIO's summary and the table.
3. The codes that looked wrong, and what you expected instead.
