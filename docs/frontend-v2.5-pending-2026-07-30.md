# D4K-frontend v2.5 — what shipped, what is PENDING (2026-07-30, sign-off)

Companion to **`throwaway/frontend-v2.5-changes.md`** (the implementation guide). That document is
the spec; this one is the state of the code against it.

**Branch:** `feat/design-book-v2.5` — pushed to `origin`, two commits **`8383e370`** (the v2.5 work)
and **`a4bfadeb`** (a pre-commit-hook fix), cut from `origin/dev` **`25b19af9`** (unchanged since the
guide was written, so every line ref in the guide still lands).
PR link: <https://github.com/thirtynorth/D4K-frontend/pull/new/feat/design-book-v2.5>

**Backend:** needs `D4K-backend` ≥ `b8169728`. Already on **prd** (`origin/main` @ `54c2af2e`) and on
`dev`, with the 2.5.x data on both clusters — so either target works, no SHA caveat.

## ⭐ VERIFIED IN A BROWSER — 22 states, ~760 cards, 0 diffs

Ran `next dev` against the local backend, injected a `/design-book/dev-token` into `localStorage`
(the app reads `localStorage.token`, so no login is needed), and diffed **what the client renders**
against **what the server sent** for the app's own list request — card for card, row for row, pill
for pill, including `selected` / `off` / `dead` and the whole-card grey.

| State | Cards | Diffs |
|---|---|---|
| Base › Water › Dishwasher Fronts | 19 | 0 |
| …same at **line 73** | 14 | 0 |
| …same at line 73 + **grey don't hide** | 19 (5 greyed) | 0 |
| Sink Cabinets · Trash Pullouts · Sinks & Faucets · Sink Accessories · Cooking · Storage | 162 | 0 |
| Tall · Wall · Midway · Handles · Alteration | 264 | 0 |
| Lighting · Service · Accessories & interior · Countertops · Panels & surround | 278 | 0 |
| `ZGR405405` · `ANK45` · `CBSET90581` (targeted) | 4 | 0 |

Check-table rows confirmed individually:

* **#3** `ANK45` renders **bare** — 0 rows. The `Array.isArray` vs `.length` branch is right.
* **#13/R9** **two** `ANK45` cards render side by side (the dup family), no React key collision.
* **#4/#5** a W pill click fires **one** request, by `familyId` + `widthMm=600` — **never** by
  `pill.sku` — carrying `grey=true`, `refs=true` and `depthClass`. Card re-faced correctly.
* **#7** a line pick fires **exactly one** `by-section` request and **zero** per-card swaps; it sends
  `lineState=73` and **no** `heightClass`; faces move (`GFV6080SM` → `GFV6073SM`) and the H row
  collapses to `[73*]` — all server-side.
* **#8** the count drops 19 → 14 at line 73, and "grey don't hide" brings back exactly those 5, greyed.
* **#16a** `CBSET90581` draws `D [58* 68]`, every pill live; clicking `68` re-faces to `CBSET90681`.
* **#16c** `ZGR405405` draws a `Finish` row with ONE pill, selected + unclickable, **and its swatch
  loads** (`F+405_VS.jpg`, `naturalWidth > 0`) — the URL fix confirmed end-to-end.

Two apparent diff classes were **scraper artifacts, not defects**, and are worth knowing if anyone
re-runs this: a pill that is `off` *and* `dead` renders through the disabled branch (correct — a dead
pill is already greyed), and a `Radius` pill's label legitimately carries a leading space
(`" = 5 cm cm"`), which a `.trim()` in the scraper removed.

**Still unverified:** a programme pick (same `cardAvailable` path as the 5 greys above, so covered by
inference, not by observation), the detail drawer, `page > 1`, and the Design-Tasks sidebar's result
set (a known backend data gap — §3).

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
| **1** | ✅ **DONE — the grid half.** 22 states / ~760 cards / 0 diffs (table above), with rows 3, 4, 5, 7, 8, 13, 16a and 16c confirmed individually. **What is left of it: the DIALOG rows, 19–21** — open `TSP6080` in the authoring dialog, save with no edits, re-fetch, and confirm its W/H pills still carry `showUnderLine` (`H73 → [0,73,86]`); then clear `catalogRank` and confirm it comes back **`null`**, not `0` and not 999. Those paths are written and typed but were never exercised against the API. |
| **2** | **Step 7d — `showUnderLine` in the detail drawer.** | Guide marks it optional: ship only if the drawer's W/H rows visibly diverge from the app. The helper already exists (`data/caps.ts` → `showsUnderLine`, `lineNum`). Deliberately skipped. |
| **3** | **The tall `Line` row click is inert.** | By instruction, not omission. The row renders; the click does nothing. Its pills carry `sku: null` and mix a carcase SYSTEM (73/80/86/66) with front-line suffixes (J/Y/E), which are order-code modifiers, not navigation — and `86` is a *73-system* line. Not modelled server-side either (audit §M open items). **Do not guess it into `update({line})`.** |
| **4** | **The legacy `parameters.*` fallback branch is now unreachable.** | Kept as a guard because `Array.isArray` is free. It still holds `pickHeight` / `pickWidth` / `pickTy` / `collapse` / `mark`. Delete the branch and those five once #1 passes, or leave it — it costs nothing but it is dead weight a future reader will trust. |
| **5** | **`buildTallHeightsQuery` still sends `suspended`, not `antoso`.** | Left alone on purpose: `GET tall-heights` **ignores** `antoso` server-side (it is task 6 in the backend handoff, un-swept). Flipping it here would change nothing and would diverge from the endpoint's contract. Revisit when the backend teaches that endpoint about ANTOSO. |
| **6** | ✅ **FIXED — `a4bfadeb`.** | `.githooks/pre-commit` lints with `--no-eslintrc --config .githooks/eslint.precommit.cjs`, which registers only `@typescript-eslint/no-unused-vars` — so every pre-existing `eslint-disable-next-line <other-rule>` comment errored with "Definition for rule … was not found", and the hook rejected a commit over something it was never asked to check (`index.tsx` failed the same way **untouched**; `8383e370` needed `--no-verify`). Now `noInlineConfig: true`, which also makes it stricter: the escape hatch for a deliberately-unused binding is the `_` prefix, not a disable comment. `a4bfadeb` itself committed with the hook **enabled**. |
| **7** | ✅ **RESOLVED — `tsc` is now clean repo-wide.** | `isomorphic-dompurify`, `remark-gfm`, `remark-breaks` were declared in `package.json` but absent from `node_modules`. ⚠️ **Plain `npm install` fails** — `react-toast-notifications@2.5.1` peer-wants React 16/17 against the repo's React 18 (ERESOLVE). Use **`npm install --legacy-peer-deps`**. That is also what the stray `package-lock.json` modification is; it is deliberately **not** committed on this branch. |
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

## 4b · How to re-run the browser verification

```bash
cd D4K-backend && node dist/main.js            # :8000 — from the repo root
cd D4K-frontend && npx next dev                # :3000
```

Open `http://localhost:3000/design-book`, then in the console:

```js
// the app reads localStorage.token — no login needed
const r = await (await fetch('http://localhost:8000/design-book/dev-token')).json();
localStorage.setItem('token', r.data?.token ?? r.token);   // 1 h; re-mint on 401
location.reload();
```

⚠️ **Two traps, both cost time here.** (1) The backend **died mid-session** and the grid sat on
"Loading catalog…" forever — React Query is configured `retry: false`, so one failed fetch is
permanent until reload. If the grid is empty, `curl localhost:8000/design-book/stats` **before**
believing anything (this is the same dead-server trap as audit §N). (2) Minting the token from the
page is blocked by CORS — mint it with `curl` and paste the string in.

The differ itself was ad-hoc console JS: patch `XMLHttpRequest.prototype.open` to record the app's
`items/by-section` URL, re-fetch that exact URL, then walk `[data-card]` and compare each card's
rendered rows to the response's `gridRows`. Worth re-writing into `scripts/parity/` if the client
keeps reporting grid differences — it is the frontend twin of the backend harness and it found the
two `off`+`dead` and whitespace artifacts immediately.

## 5 · Read first

1. `throwaway/frontend-v2.5-changes.md` — the spec, and the **Check** table that is pending item #1.
2. `docs/design-book-api-ui-map-v2.md` **§2c-11** (`gridRows` + toolbar inputs), **§2c-12**
   (membership: `gridHidden`, `dupFamilies`, family gates, card order), **§2b** (section order +
   header merge).
3. `docs/client-ui-parity-audit.md` **§M–§Q** — where the numbers above come from.
4. `docs/parity-session-handoff-2026-07-30.md` — the BACKEND task board (this file is the frontend's).
