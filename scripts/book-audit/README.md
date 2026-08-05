# Book audit — greying gates vs the LEICHT 2026 price/type lists

Cross-checks `capabilities.*` in `docs/export-v781-fresh.json` against the client's two
catalogs in `data-from-client/items-pdfs/` (`primo-2026.pdf`, `contino-avance-2026.pdf`).

The client says the v781 HTML app was built FROM these books, so they are upstream of the
app, not a third opinion. Where they disagree with us, the book is the authority.

## Prereqs

```sh
pdftotext -bbox-layout data-from-client/items-pdfs/primo-2026.pdf          /tmp/audit/primo.xml
pdftotext -bbox-layout data-from-client/items-pdfs/contino-avance-2026.pdf /tmp/audit/contino.xml
```

`book.py` caches parsed rows to `/tmp/audit/<book>.rows.pkl` on first use.

## What each file does

- `book.py` — coordinate parser. Words → rows → table regions → **blocks**. A block is
  types-then-notes; a new block starts when a type row follows a note row, or when the gap
  between consecutive type rows exceeds 1.5x the region's modal row spacing (that gap is a
  ruled separator — the rules themselves live in form XObjects and aren't worth extracting).
- `excl.py` — pulls per-type programme exclusions, honouring `Cupboard width NN cm:` scoping.
  Any other qualifier (`Cupboard type HEER 135 ...:`) makes the assertion **conditional** and
  it is skipped rather than asserted — those are combination restrictions, not blanket ones.
- `result_*.txt` — the run output per gate.
- `findings-excludedPrograms.json` — the surviving mismatches, with book page + note text.

## Three traps that cost real false positives

1. **Block segmentation is everything.** With blocks merged, a width-scoped note leaks onto
   neighbouring products: the first run reported 493 failures, all artifacts. Verify any new
   parse against a rendered crop before believing a number.
2. **A note ending in `:` is a scope line, not an exclusion.** `Cupboard width 76.2 cm:` means
   the following exclusion applies to the 76.2 variant only, not to its 60 cm sibling.
3. **`excludedProgramsE` is additive.** It holds only what the E variant adds; test it as
   `excludedPrograms | excludedProgramsE` or every item "fails".

## Not auditable from text

The per-row **P1**, **suspended**, and **depth 36/48/68** markers are vector drawings — no
glyphs, no image XObjects. Verify those by rendering the page:

```sh
pdftoppm -f 215 -l 215 -r 160 -png -x 0 -y 120 -W 1330 -H 480 \
  data-from-client/items-pdfs/primo-2026.pdf /tmp/p215
```

`antosoApproved` can't be read off its icon alone — it varies *within* a single icon block by
width (see `T2073GVZ` false vs `T3073GVZ` true on primo p215), matching the app's
`antosoU(u,cat,sub)` size rule.
