# How to put option buttons on a product card

A step-by-step guide. Written for the person doing the work, not for a developer.

---

## What this does

Sometimes two or three items in the catalogue are really the same product in different versions —
a towel rail with 2 rails and one with 3 rails, a light set with 3 lights and one with 5.

By default each one gets its own card, so the same product appears two or three times in a row and
the person browsing has to work out that they're related.

This guide turns them into **one card with a row of buttons**, like this:

```
Before                                  After

┌──────────────┐  ┌──────────────┐      ┌──────────────┐
│ Towel rails  │  │ Towel rails  │      │ Towel rails  │
│ AHS2  W 104  │  │ AHS   W 145  │      │ AHS2  W 104  │
│              │  │              │      │ SET  [2 Rails] [3 Rails] │
└──────────────┘  └──────────────┘      └──────────────┘
   two cards                               one card, two buttons
```

Clicking a button switches the card to that version.

**Time needed:** about five minutes for two items.

---

## Before you start

You need three things:

1. **Which items go together.** Write down their codes. In our example: `AHS` and `AHS2`.
2. **What each button should say.** Keep it short — it has to fit on a button. "2 Rails",
   "3 Rails".
3. **What the row is called.** One word if possible: "Set", "Type", "Mode", "Finish".

One rule to know before you begin: **the buttons only appear once two items are set up.** With one
item done, nothing shows. That's normal — don't assume it hasn't worked until you've done both.

---

## Part 1 — Open the item list

**Step 1.** Log in as normal.

**Step 2.** Look at the icons in the **top-right corner** of the screen, next to your profile
picture. Click the **people icon**.

**Step 3.** A small menu opens with three choices. Click **Manage CRM**.

**Step 4.** You're now on a page headed *Manage CRM*, with a list down the left side —
Programmes, Handles, Handle positions, Glass doors, and so on.

**Step 5.** **Scroll that left list to the bottom.** Under a small heading that says
**DESIGN BOOK**, click **Items**.

You should now see a table headed *Design Book items*, with columns for Image, SKU, Name and
Category.

---

## Part 2 — Find your items

**Step 6.** Click the **Search** box at the top-right of the table.

**Step 7.** Type the item code — for our example, `AHS`.

Wait a second or two. The table searches the server, so it isn't instant. You should see the
matching items appear — `AHS`, `AHS2`, and anything else with those letters in the code.

> If it says "No rows match that search", wait another moment before retyping. It sometimes shows
> that briefly while it's still looking.

---

## Part 3 — Set up the first item

**Step 8.** Click the **pencil icon** at the left of the row for `AHS2`. A window opens titled
*Edit item · AHS2*.

Start with the version you want the card to show **first**. In our example that's `AHS2`, the
2-rail one.

**Step 9.** At the top, in the box headed **1 · Identity and taxonomy**, find the field called
**familyId**. Write down exactly what it says. In our example it says `AC_AHS2`.

> **familyId** is the invisible name of the group a card belongs to. Every version of the product
> has to have the same one. It's never shown to anyone browsing the catalogue — it's just a label
> the system uses to know they belong together.

**Step 10.** Scroll down the window to the box headed **10 · Grid, ordering and row-builder
inputs**. Inside it, find the part labelled **Option buttons on the card**.

**Step 11.** Fill in the three fields:

| Field | What to type | Our example |
|---|---|---|
| **Button group name** | The label shown before the buttons | `Set` |
| **This item's button text** | What this version is called | `2 Rails` |
| **Position** | The order, starting at 0 | `0` |

**Step 12.** Look at the **preview** just below those fields. It shows the actual row the card will
have. Right now it will say something like:

> *Only one version has button text so far. Open the other items in this family and give each its
> own — the row appears at two.*

**That message is expected.** You've only done one item. Carry on.

**Step 13.** Click **Save changes** at the bottom of the window.

---

## Part 4 — Set up the second item

**Step 14.** Click the **pencil icon** on the row for `AHS`.

**Step 15.** In **1 · Identity and taxonomy**, check the **familyId**. It must be **exactly the
same** as the one you wrote down in Step 9 — `AC_AHS2` in our example.

If it's different, change it to match, letter for letter. This is the single most important field
in the whole process. If the two don't match, nothing else will work, and there'll be no error to
tell you why.

**Step 16.** Scroll to **10 · Grid, ordering and row-builder inputs** → **Option buttons on the
card**, and fill in the three fields:

| Field | What to type | Our example |
|---|---|---|
| **Button group name** | Exactly the same words as last time | `Set` |
| **This item's button text** | What **this** version is called | `3 Rails` |
| **Position** | The next number up | `1` |

**Step 17.** Check the preview again. It should now show both buttons and say:

> *This row will show on the card — 2 items in AC_AHS2.*

That's the confirmation. If it says anything else, see the table further down.

**Step 18.** Click **Save changes**.

---

## Part 5 — Check it worked

**Step 19.** Click the **book icon** in the top-right of the screen to open the **Design Book** —
the catalogue as a customer sees it.

**Step 20.** In the search box at the top, type your item code (`AHS`) and press Enter.

**Step 21.** You should see **one card** with your row of buttons under it, instead of two separate
cards.

**Step 22.** Click the other button — `3 Rails`. The card should change to the other version. Check
the code and the width underneath the title change too (`AHS2 · W 104` becomes `AHS · W 145`).

**Step 23.** Click the card's picture to open the panel on the right. The same row should appear
there under **CONFIGURE**.

If all of that happens, you're done.

---

## Adding a third version later

Exactly the same, once:

1. Open the item.
2. Set its **familyId** to match the others.
3. **Button group name** — the same words again.
4. **This item's button text** — its own name.
5. **Position** — the next number (`2`).
6. Save.

---

## What the preview messages mean

The preview box under the three fields tells you what's still wrong. Every message and what to do:

| The preview says | What it means | What to do |
|---|---|---|
| *This row will show on the card — N items in …* | Everything is right | Nothing. Save. |
| *Only one version has button text so far…* | You've done one item, not two | Open the other item and fill in its three fields |
| *Fill in the button group name…* | The first box is empty | Type the row label — the same one on every version |
| *Fill in this item's button text.* | The middle box is empty | Type what this version is called |
| *Two items share the same button text…* | Two versions have the same name | Change one of them. Every version needs its own |
| *This item has no Family ID…* | The familyId box in section 1 is empty | Fill it in — copy it from the other version |
| *Only the first N of M items … were checked* | A very large group | Rare. Tell a developer if you see it |

---

## Common mistakes

**The familyId doesn't match.** Nine times out of ten this is the problem. It's case-sensitive and
must match character for character. Copy and paste it rather than retyping.

**The group name is spelled differently on the two items.** "Set" and "set" are not the same
thing. Same words, same capitals, on every version.

**Both versions have the same button text.** Then there's nothing to choose between. The preview
warns you about this one.

**Filling in only one item and assuming it's broken.** The row genuinely does not appear until two
versions are set up. This is the most common false alarm.

---

## Two things worth knowing

**Section 4 is a different thing.** Further up the same window, in the box headed
**4 · Parameters**, there's a field called **options**. That one fills the row inside the **detail
panel** — the sliding panel that opens when you click a card. It does **not** put buttons on the
card itself.

If you want the row in both places, fill in both: section 4 for the panel, section 10 for the card.
They don't copy across.

**Catalogue imports overwrite this.** When the catalogue file from LEICHT is imported, it writes
over these settings and they go back to how the factory file describes them — two separate cards
again. This affects any change made by hand, not just this one.

Until that's fixed:

- **Tell the development team before any catalogue import**, so the changes can be saved and put
  back.
- **Keep a short note of what you change** — item code, what you set, why. A shared document is
  enough. If an import does wipe it, it can be redone in minutes instead of rediscovered.

---

## If something goes wrong

Send these three things and it can usually be sorted out quickly:

1. The item codes involved (for example `AHS` and `AHS2`).
2. The familyId you used.
3. A screenshot of the preview box showing what it says.
