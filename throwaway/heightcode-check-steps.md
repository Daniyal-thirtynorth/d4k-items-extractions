# How to check the height-button fix — click-by-click

Written 2026-07-28. Everything here is done in the browser. No terminal, no code.

**Open these two pages:**

| Page | Address |
|---|---|
| Our grid (the lite UI) | http://localhost:8000/design-book/ui |
| The real LEICHT app (for comparing) | http://localhost:8777/leicht_units__781_.html |

If a page doesn't open, the local server isn't running — ask for it to be started, then come back.

---

## What was wrong (in one minute)

Every product card has a row of **height buttons**.

The real app keeps one number per cabinet that says *"this is my height button"*. For ordinary base and
tall cabinets that number is the carcase line — **73, 80 or 86**. For everything else (dishwasher
housings, supports, drawers) it's simply **how tall it is in centimetres** — 29, 42, 103, 204, 217.

We had only saved the first kind. So on all the other products we had no way to tell which button was
which, and three things went wrong:

1. **Most height buttons showed as greyed out**, because we couldn't find a product behind them.
2. **The buttons that weren't grey did nothing** when clicked — the request was rejected, silently.
3. **Clicking a width button lost the height** — you could click "50 cm" on a 27 cm drawer and get a
   93 cm one.

All three are fixed. The steps below let you see each one.

---

## Check 1 — the height buttons are no longer greyed out

*This is the exact screen from the report.*

1. Open our grid.
2. In the left sidebar click **TALL → Water → Dishwasher**.
3. At the top pick the programme **BOSSA**.
4. In the **D** row click **58**.

You should see **3 cards**. Look at the first one, **`HGA6029BK`** ("Dishwasher-Top cupboard").

**Its H row must look like this — twelve buttons, all normal, only 29 highlighted:**

```
H  [H29] H34  H42  H47  H74  H79  H87  H92  H100  H105  H113  H118
```

**Before the fix:** everything from **H42** onwards was pale grey and could not be clicked.

Now look at the second card, **`HGSP55103Z`** ("Tall unit for high-mounted appliance"):

```
H  [H103] H109  H116  H122  H204  H217
```

**Before the fix:** **H204** and **H217** were grey.

> Compare with the real app if you like: same filters, same card — the app shows all twelve buttons
> normal too. That's the point: we were disabling buttons the app never disabled.

---

## Check 2 — clicking a height button now opens the right product

Stay on the same screen.

1. On card **`HGA6029BK`**, click **H42**.
   → The card changes to **`HGA6042`**. The H row now highlights **H42**.

   *Note it also switched the type: this card was the "BK" version, which is only made at 29 and 34 cm,
   so the app moves you to the version that does come in 42 cm. That is exactly what the real app does.*

2. Click a few more — **H74**, **H113** — the card follows each time.

3. On card **`HGSP55103Z`**, click **H204**.
   → The card changes to **`HGSP552047Z`**.

**Before the fix:** clicking any of these did absolutely nothing. No error, no movement — which is why it
looked like only the greying was broken.

---

## Check 3 — clicking a width keeps the height

*This is the extra problem found while re-reading the work.*

1. Clear the filters (click **clear all** if the chips are still there).
2. Type **`T3027Z`** in the search box at the top.
3. One card appears — a 27 cm high drawer unit, 30 cm wide.
4. In the **W** row click **50**.

→ The card becomes **`T5027Z`**. Still 27 cm high — the H row still highlights **H27**. Only the width
changed.

**Before the fix:** it became **`T5093S7`** — a **93 cm** unit. The width was right, the height was
silently thrown away, and nothing on screen looked wrong.

---

## Check 4 — ordinary cabinets still behave (nothing was broken by the fix)

1. Search for **`TSP6080B`** (a sink base unit).
2. In the **H** row click **73**.
   → The card becomes **`TSP6073B`**.
3. Click **86**.
   → The card becomes **`TSP6086B`**.

These are the normal 73/80/86 line cabinets. They worked before, and they still work exactly the same.

---

## Check 5 — the type (Ty) buttons still work

1. Search for **`TSPA8073TZW`**.
2. In the **Ty** row click **`TZ`**.

→ The card becomes **`TSPA9073TZ`**, and **TZ** shows as the selected button.

---

## Check 6 — the "H 73 80 86" bar at the very top

That top bar is **not** a filter — it re-styles the cards you already have.

1. Search for **`TSP6080B`** (six cards appear).
2. Click **73** in the top H bar.
   → All six cards change to their 73 versions (`TSP6073B`, `TSP6073BZ`, …).
   → **The number of cards does not change.** That's the correct behaviour.

3. Now go back to **TALL → Water → Dishwasher** and click **73** in that same bar.
   → The three dishwasher cards stay exactly as they are.

   Correct: those products have no 73/80/86 lines, so the bar has nothing to do for them.

---

## Check 7 — the number is visible and editable in the admin screen

1. Open **http://localhost:8000/design-book/admin#HGA6029BK**
2. Look in the dimensions area:
   - **heightCode** = **29** ← the new field, this is the H-button number
   - **heightClass** = *empty* ← correct, this product has no carcase line

3. Try another one — change the address to `#HGSP552047Z` → **heightCode = 204**.
4. And a normal cabinet — `#TSP6080B` → **heightCode = 80** *and* **heightClass = 80** (for line
   cabinets the two are the same number).

**If you ever add a new product by hand:** fill in **heightCode** with the same number the other products
in that family use on their height buttons. Don't work it out from the millimetres — the app doesn't. For
example one unit is 367 mm tall but its button says **37**, and another is 1136 mm but says **113**. Copy
the number from a sibling product, never calculate it. If you leave it empty, the product still shows,
but no height button will ever reach it.

---

## Quick summary sheet

| # | Do this | You should see |
|---|---|---|
| 1 | BOSSA · Tall→Water→Dishwasher · D58 | `HGA6029BK` — all 12 height buttons normal, 29 selected |
| 2 | Click **H42** on that card | becomes **`HGA6042`** |
| 2b | Click **H204** on `HGSP55103Z` | becomes **`HGSP552047Z`** |
| 3 | Search `T3027Z`, click **W 50** | becomes **`T5027Z`** (not `T5093S7`) |
| 4 | Search `TSP6080B`, click **H73** | becomes **`TSP6073B`** |
| 5 | Search `TSPA8073TZW`, click Ty **`TZ`** | becomes **`TSPA9073TZ`** |
| 6 | Top H bar → 73 on a sink search | cards re-style, card count unchanged |
| 7 | Admin `#HGA6029BK` | heightCode **29**, heightClass empty |

---

## One warning when comparing screenshots with the real app

The real app sometimes leaves a button in its top toolbar **looking** selected when it isn't — its
highlight doesn't always refresh. So when you compare the two screens, judge by **the cards** (the
product code and the button rows on the card), never by which chip looks lit in the toolbar.
