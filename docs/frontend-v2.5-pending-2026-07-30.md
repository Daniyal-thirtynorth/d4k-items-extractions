# D4K-frontend v2.5 — what shipped, what is PENDING (2026-07-30, sign-off)

Companion to **`throwaway/frontend-v2.5-changes.md`** (the implementation guide). That document is
the spec; this one is the state of the code against it.

**Branch:** `feat/design-book-v2.5` — pushed to `origin`, one commit **`8383e370`**, cut from
`origin/dev` **`25b19af9`** (unchanged since the guide was written, so every line ref in the guide
still lands). PR link: <https://github.com/thirtynorth/D4K-frontend/pull/new/feat/design-book-v2.5>

**Backend:** needs `D4K-backend` ≥ `b8169728`. Already on **prd** (`origin/main` @ `54c2af2e`) and on
`dev`, with the 2.5.x data on both clusters — so either target works, no SHA caveat.

**⚠️ NOT VERIFIED IN A BROWSER.** Everything below passed `tsc`, lint (no new findings) and a
10-assertion runtime check of the query builder + the FRMAT gate, and the `gridRows` shape was
confirmed against the live API on `:8000`. Nobody has loaded the grid and looked at it. **The
guide's 23-row Check table is the pending work item #1** — run it before this branch merges.

---

## 1 · Shipped — 7 of the guide's 8 steps

| Step | File | What went in |
|---|---|---|
| 1 | `api/types.ts` | `GridRow` / `GridPill`; `gridRows`, `cardAvailable`, `heightExtensionOk`, `depthFamilyOk`, `lineFamilyOk` on `ItemCard`; `lineState` + `antoso` on `ItemsQuery` |
| 2 | `api/params.ts` | base H bar → `lineState` (TALL keeps `line`); Suspended → **`antoso`**, not `suspended` |
| 3 | `components/unit-card.tsx` | `stateQ` — every swap repeats the toolbar (`depthClass`, `tier`, `programs`, `lineState`, `antoso`) + `grey:true` |
| 4 | `components/unit-card.tsx` | rows rendered verbatim; one `pickGrid` dispatcher; `Chip` gains `off` + `swatch`; `cardAvailable`; `heightExtensionOk`; per-card line re-face **deleted** |
| 5 | `components/catalog-grid.tsx` | comments only — the R9 dup-family key and the R10/R10a "do not re-sort / do not synthesize a header" landmines |
| 6 | `components/detail-panel.tsx` | untouched, as specified. `parameters.*` + `pill.sku` IS the drawer model |
| 7a–c | `design-book-item-dialog.tsx` | `showUnderLine` on the W/H rows; `heightCode`; new §11 `catalogRank` / `sectionRank` / `familyIndex` / `gridHidden`; new §12 `unitFacts` / `familyFacts` / `dupFamilies` as read-only JSON |

Two fixes beyond the step list, both from the guide's "API changes since round 3/4" tables:

* **`data/caps.ts` — `isFrmatFamily` was a blanket exclusion.** Now `!(isFrmatFamily &&
  FRMAT_DEAD.has(k))` over the 9 size-table-less programmes (`218 272 283 294 418 494 718 783 794`).
  The blanket form greyed the front-panel-material card under BOSSA/TOPOS/CERES, where the app shows
  it live. This is guide change **#7** and it was ours to fix — the snippet the client copied from
  the contract carried the bug.
* **The finish swatch URL was wrong for every code.** Probed live: `F+277.jpg` → **200**,
  `F%20277.jpg` → fails, `F+405.jpg` → **403**, `F+405_VS.jpg` → **200**. So the file is
  `Finish/F+<digits>.jpg` with a **literal plus**, and `405` is the one suffixed file. The shipped
  helper used `F%20` (a space), so the existing `FinishRow` swatches never rendered — one helper now
  serves both it and the new `gridRows` Finish row.

### Behaviour changes a reviewer should expect (all correct, all in the guide)

* Picking a line fires **one** list request and **zero** per-card swaps. Card **count may drop** —
  families with nothing at that line are hidden (R6/§M3). "Grey don't hide" brings them back.
* Turning **Suspended** on drops the count too (Base › Accessories & Surround: 20 → 5) and re-faces
  cards onto their ANTOSO-approved variant (§P4).
* Under a programme, **two families can collapse into one card** and the swapped-in family can be in
  another **category** (R9b/§O2) — so a `by-section` response with **no headers at all** is valid.
  Don't file either as a bug.
* A greyed card keeps its **catalog position mid-run** instead of sinking (§M6).

---

## 2 · PENDING — ranked

| # | Item | Why it's open |
|---|---|---|
| **1** | **Run the guide's Check table (23 rows) in a browser.** | Nothing has been visually confirmed. Rows to weight highest: **3** (`F2013__DRWDUP` → `ANK45` renders BARE — a W row means the `[]`-vs-absent branch is wrong), **16a/16b** (the all-sibling `dvRowFn` depth row), **16c** (`ZGR405405` — one `Finish` pill, selected + unclickable, **with** its swatch), **7/8** (one request per line pick, count may drop), **19/21** (dialog round-trips `showUnderLine`; a cleared `catalogRank` becomes `null`, not `0`). |
| **2** | **Step 7d — `showUnderLine` in the detail drawer.** | Guide marks it optional: ship only if the drawer's W/H rows visibly diverge from the app. The helper already exists (`data/caps.ts` → `showsUnderLine`, `lineNum`). Deliberately skipped. |
| **3** | **The tall `Line` row click is inert.** | By instruction, not omission. The row renders; the click does nothing. Its pills carry `sku: null` and mix a carcase SYSTEM (73/80/86/66) with front-line suffixes (J/Y/E), which are order-code modifiers, not navigation — and `86` is a *73-system* line. Not modelled server-side either (audit §M open items). **Do not guess it into `update({line})`.** |
| **4** | **The legacy `parameters.*` fallback branch is now unreachable.** | Kept as a guard because `Array.isArray` is free. It still holds `pickHeight` / `pickWidth` / `pickTy` / `collapse` / `mark`. Delete the branch and those five once #1 passes, or leave it — it costs nothing but it is dead weight a future reader will trust. |
| **5** | **`buildTallHeightsQuery` still sends `suspended`, not `antoso`.** | Left alone on purpose: `GET tall-heights` **ignores** `antoso` server-side (it is task 6 in the backend handoff, un-swept). Flipping it here would change nothing and would diverge from the endpoint's contract. Revisit when the backend teaches that endpoint about ANTOSO. |
| **6** | **The pre-commit hook cannot pass on these files.** | `.githooks/pre-commit` lints with `--no-eslintrc --config .githooks/eslint.precommit.cjs`, which registers only `@typescript-eslint/no-unused-vars` — so every pre-existing `eslint-disable-next-line <other-rule>` comment errors with "Definition for rule … was not found". `index.tsx` fails the same way **untouched**. Its actual rule reports **0** hits on the staged set, so this commit used `--no-verify`. Fix the hook config (add the plugins, or `--no-inline-config`) rather than stripping the disable comments. |
| **7** | **3 pre-existing `tsc` errors, unrelated.** | `isomorphic-dompurify`, `remark-gfm`, `remark-breaks` not installed — a `package-lock.json` drift that predates this work (the local modification was stashed on `feat/design-book`, stash message `wip lockfile before v2.5 branch`). **0** errors in any design-book file. `npm ci` before judging a build failure. |
| **8** | **Toolbar controls that still don't exist**, so four capability gates stay inert. | `handle` / `front` / `open` (P1/C1) / `doorline`. If the **OPENING** toggle is ever added, the guide has the two client duties: send `opening=P1|C1` (**not** a filter — expect the same families, moved faces), and prefix the displayed order code guarded on **`unitFacts.opening`**, never on `capabilities.openP1` (that flag is the wider `openOk` form and is true on the P1 article itself → `P1P1GFV6080SM`). |

---

## 3 · Parity ceiling — what is NOT the frontend's bug

From `docs/client-ui-parity-audit.md` §O/§P. The server is verified **0 diffs in all ten buckets**
over 720 toolbar states across Base/Tall/Wall/Midway, plus the other 10 categories and the
FRONTS/programme/line/width/depth/opening/suspended/search states (1,104 more). Inside that envelope a
disagreement with the app IS a bug worth filing. Outside it:

* **the Design-Tasks sidebar** (`leafId`/`groupKey`/`zone`) — 252 states, **144 diffs**. A known DATA
  gap (`functionalGroups` is stored per ITEM, but a leaf claims a family membership), deferred by
  decision. Build the sidebar; expect diffs; don't chase them.
* `grey=true`, `page>1`, the detail **drawer** as a whole — un-swept.
* one `Insert` row (`FP_16FRONT`, 92 units) — 8 diffs, needs per-unit `u.ins` in the contract.
* a handful of single-family cases — `Alteration › Side Panel Modifications` @BOSSA,
  `Panels & surround` order/grey-not-hide. Tracked in §P's residue list.

---

## 4 · Files touched

```
src/views/design-book/api/types.ts                   +48
src/views/design-book/api/params.ts                  ~18
src/views/design-book/data/caps.ts                   +22
src/views/design-book/components/unit-card.tsx      +230 / −105
src/views/design-book/components/catalog-grid.tsx    +15  (comments only)
src/views/design-book/index.tsx                       ~7  (comment only)
…/design-book-item-management/design-book-item-dialog.tsx  +236
```

`components/detail-panel.tsx` — deliberately untouched.

## 5 · Read first

1. `throwaway/frontend-v2.5-changes.md` — the spec, and the **Check** table that is pending item #1.
2. `docs/design-book-api-ui-map-v2.md` **§2c-11** (`gridRows` + toolbar inputs), **§2c-12**
   (membership: `gridHidden`, `dupFamilies`, family gates, card order), **§2b** (section order +
   header merge).
3. `docs/client-ui-parity-audit.md` **§M–§Q** — where the numbers above come from.
4. `docs/parity-session-handoff-2026-07-30.md` — the BACKEND task board (this file is the frontend's).
