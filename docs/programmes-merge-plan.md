# Merging the two programme lists into `leadprograms`

Written 2026-09-25. Data checked on D4K-dev. Production was not checked.

## What we have today

The backend has **two separate lists of kitchen programmes**:

| List | Where it comes from | How many | Who uses it |
|---|---|---|---|
| `designbookprograms` | The Design Book import (the LEICHT app data) | 120 | Only the Design Book |
| `leadprograms` | Typed in by the team in the CRM | 102 active + 1 inactive | Leads, projects, rooms, orders |

The client wants **one list**, and wants it to be `leadprograms`.

This is the right choice. Projects and rooms already point to `leadprograms`, so we must keep it.
The Design Book only reads its own list in 6 places, all in one file
(`D4K-backend/src/design-book/design-book.service.ts`), so it is easy to move.

## How the two lists match

Each programme has a number, for example `244` = BOSSA.

- In `designbookprograms` the number is in the field `id`.
- In `leadprograms` the number is in the field `number`.

We match the two lists using this number.

## The problems we found

### Problem 1: Programmes that are only in the Design Book (18)

**ROCCA 02, 03, 04, 05 and ROCCA-C 02, 03, 04, 05 (8 programmes)**
The Design Book has ROCCA 01 to 05 as five separate programmes. `leadprograms` has only one
"Rocca" row (and one "Rocca-C" row).
The five ROCCA programmes have exactly the same product rules. They are only different in
**price**. The 2026 price book shows them as "price group 8 + 70%", "8 + 100%", "8 + 110%" and so on.
The extra cost seems to depend on the stone colour.

**SELVA, KYOTO, STONE, VALAIS and their -A and -C versions (10 programmes)**
The 2026 price book says these are **discontinued** ("all decors, can be ordered until 31.03.2026").
So it is correct that `leadprograms` does not have them. They can be dropped.

**CLASSIC-FF-Q (number 211)**
This is still sold (price group 3). Only one of its colours is discontinued.
It is really missing from `leadprograms`, and 1,287 products have rules for it.

### Problem 2: A programme that is only in `leadprograms` (1)

**"qwerty" (number 12)** is an inactive test row. It should be deleted.

### Problem 3: The price group is different (7 programmes)

| Programme | Design Book | 2026 price book | `leadprograms` |
|---|---|---|---|
| 247 BOSSA-FS | 7 | 7 | 4 |
| 747 BOSSA-FS-C | 7 | 7 | 4 |
| 253 F 45 | 4 | 4 | 3 |
| 453 F 45-A | 4 | 4 | 3 |
| 753 F 45-C | 4 | 4 | 3 |
| 267 TERMA-Q | 7 | 7 | 6 |
| 280 WAKUU | 6 | 6 | 5 |

The 2026 price book agrees with the Design Book every time, so `leadprograms` looks out of date.
**Changing these numbers will also change the CRM and lead screens**, so the client must confirm.

### Problem 4: The range is wrong for 4 programmes

These 4 programmes are Contino programmes, but `leadprograms` says "Primo":

- 684 ALURO-C12
- 613 CLASSIC-FS-C12
- 654 TOCCO-C12
- 669 TOPOS-C12

The Design Book uses the range to decide which products are available. If we leave this wrong,
these 4 programmes will show the wrong products.

### Problem 5: Different names

Most names are only spelled differently, for example "F 45" and "F 45 (Fenix)", or "WAKUU" and
"Wakuu H". This is fine.

One name is a real mistake: number 224 is **"GEO"** in the price book and in the Design Book, but
**"Gio"** in `leadprograms`. It should be fixed to "GEO".

After the merge, the Design Book dropdown and the LIO assistant will show the `leadprograms` names.

### Problem 6: `leadprograms` is missing two things the Design Book needs

| What the Design Book needs | Why | In `leadprograms`? |
|---|---|---|
| The programme number | Product rules say "not available in programme 244" | Yes (`number`) |
| The name | The programme dropdown and search | Yes (`name`) |
| The range (Primo / Avance / Contino) | Groups the dropdown | Yes (`rangeType`) |
| **The tier (P / A / C)** | Decides which products and which card picture to show | **No** (can mostly be worked out from `rangeType`, but see Problem 4) |
| **The price column (`priceField`)** | Works out the points price shown on each card | **No** |

The price column **cannot** be worked out from the price group in every case.
Normally it is the price group plus 20 (Avance) or plus 30 (Contino), but Contino-12 uses plus 31,
and KERA and ROCCA use special columns (50, 60, 70, 51–55, 71–75). So we must store it.

## How we can merge

### Step 1: Fix the data in `leadprograms` (needs the client's answers)

1. Add CLASSIC-FF-Q (211).
2. Delete "qwerty" (12).
3. Change "Gio" to "GEO".
4. Change the range of the 4 Contino-12 programmes from "Primo" to "Contino".
5. Fix the price group of the 7 programmes in Problem 3 (only if the client agrees).
6. Decide what to do with ROCCA 01 to 05 (see the questions below).

### Step 2: Add two fields to `leadprograms`

- `tier`: P, A or C
- `priceField`: the price column number

A one-time script fills these two fields for every row, copying the values from
`designbookprograms` using the programme number.

### Step 3: Change the Design Book code to read `leadprograms`

- Change the 6 places in `design-book.service.ts` to read `leadprograms` and match on `number`.
- Keep `GET /design-book/programs` returning the same shape as today, so the React app does not
  need any change.

### Step 4: Change the Design Book import

Today the import writes the programme list into `designbookprograms`.
After the merge it must **not create new rows** in `leadprograms`, because a lead programme also
needs things the import does not have (colours, surface code, type, user).
Instead the import will:

- update `tier` and `priceField` on rows that already exist (matched by number), and
- report any programme numbers it could not find, so a person can add them by hand.

### Step 5: Clean up

- Delete the `designbookprograms` collection.
- Delete the old name-matching code (`backfillProgramFamilyName` and its 13 name overrides).
  It is not needed when there is only one list.

### Step 6: Check

- The programme dropdown shows the right programmes, grouped by range.
- Picking a programme greys the same products as before (for example BOSSA 244 on `T6080`).
- The points price on the cards is the same as before.
- LIO still understands programme names.

**Time needed:** about one day of work once the client has answered the questions below.

## Questions for the client

1. **ROCCA 01 to 05:** do you want five separate rows in `leadprograms` (one for each price
   surcharge), or one "Rocca" row where the surcharge is stored on each stone colour?
2. **Price groups:** the 2026 price book says BOSSA-FS = 7, F 45 = 4, TERMA-Q = 7, WAKUU = 6.
   `leadprograms` has 4, 3, 6 and 5. Can we update `leadprograms` to match the book?
   This also changes the CRM side.
3. **Contino-12:** can we change ALURO-C12, CLASSIC-FS-C12, TOCCO-C12 and TOPOS-C12 from "Primo"
   to "Contino"?
4. **CLASSIC-FF-Q (211):** can we add it to `leadprograms`?
5. **Discontinued programmes:** are you happy for SELVA, KYOTO, STONE and VALAIS (and their -A and
   -C versions) to disappear from the Design Book?
6. **"Gio":** can we rename it to "GEO" to match the price book?
7. **"qwerty":** can we delete this test row?

## Status (2026-09-25)

The code is done on the backend branch **`feat/design-book-programmes-from-leadprograms`**
(commit `a53a5439`). It is pushed to GitHub but **not merged and not released**.

What the branch does:

- Adds three fields to `leadprograms`: `tier`, `priceField` and `family`.
  (`family` was added because the React app groups Contino-12 separately, and `rangeType` has no
  Contino-12.)
- The Design Book reads its programmes from `leadprograms`. A lead row only shows in the Design
  Book once it has a `tier`, so CRM-only rows like "qwerty" stay out.
- `GET /design-book/programs` returns the same shape as before, so the React app needs no change.
- The import now only fills the three fields on lead rows that already exist, and lists the
  programmes it could not find.
- The old name-matching code is removed.
- `designbookprograms` is **not deleted**. It stays in the database as a backup.
- It does **not** change any existing value in `leadprograms` (price groups, names, ranges).

How to switch over, after the client answers:

1. Merge the branch.
2. Run `node scripts/backfill-leadprogram-design-fields.js` (dry run), check the report, then
   run it again with `--apply`.
3. Only after checking the Design Book works, delete `designbookprograms`.

Tested on a copy of the D4K-dev data: 102 programmes filled, 18 with no lead row (the same 18 as
in Problem 1). `scripts/check-leadprogram-merge-e2e.js` checks the import, the list and the lookups.

## Released (28 September 2026)

The change is live on all three branches: PR #3178 (into `dev`), #3179 (`dev` into `staging`) and
#3180 (`staging` into `main`, merge commit `1311a4a1`).

The one-time script was run on both databases before the release reached them:

- **D4K-dev:** 110 programmes filled.
- **D4K-prd:** 110 programmes filled.

The client had already fixed the ROCCA numbers (201 to 205 and 701 to 705) on both databases, so
all ten ROCCA programmes are in the Design Book.

Ten programmes are not in the Design Book, because they have no active row in `leadprograms`:

- **CLASSIC-FF-Q (211).** The client still needs to add it. After they add it, run the script again
  (it is safe to run many times), or it will appear after the next catalog import.
- **SELVA, KYOTO, STONE, VALAIS and their -A and -C versions.** These are discontinued, so this is
  expected.

Still to do, when it is safe:

- Delete the old `designbookprograms` collection. It is no longer read by any code.
- The client can still fix the price groups (question 4) and the Contino-12 ranges (question 5) in
  the CRM. These do not affect the Design Book.
