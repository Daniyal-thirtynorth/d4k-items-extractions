# Grid-parity session handoff — 2026-07-31 (start here next)

Continues `parity-session-handoff-2026-07-30.md`. That day closed round 4 (§O), extended the sweep to
all 14 categories (§P) and cleared two more residuals (§Q). **This day measured what was left (§R),
then closed the last non-app-bug gap in either leg — the `Insert` row (§S) — across all five surfaces:
contract, data, backend, lite UI, admin UI and the React client.**

Findings: `docs/client-ui-parity-audit.md` **§R**, **§S**. This file is the operational state.

Everything below is **committed and pushed**. ⚠️ Unlike 07-30, this session is **NOT released to prd**:
the backend `dev` branch is 3 commits ahead of `origin/main`, and the React client's last two commits
are not in a PR. The **data** is on both clusters. See §3.

---

## 0. WHERE WE LANDED

| leg | states | at session start | now |
|---|---|---|---|
| E2 the other 10 categories | 298 | ROWSET 8 · MEMBER 1 · SECT 1 | **0 in all ten buckets** |
| E3 Base/Tall/Wall/Mid at skipped states | 200 | MEMBER 3 · SECT 1 · GNH 1 · (GREY 2 · ORDER 2 unconfirmed) | **1 state, and it is an APP BUG** (§R4) |
| Base · Tall · Wall+Midway (§O) | 720 | 0 | 0 — untouched |
| E1 · F1 | 354 | 0 | 0 — untouched |
| T1 the Design-Tasks sidebar | 252 | 144 diffs | unchanged — **still deferred** (§O5) |

**Five fixes shipped.** Two are backend logic (§R2/§R3, no data). Three are the `Insert` work (§S),
which **is the first contract change since 2.5.3** → `schemaVersion` **2.5.4**.

| § | what it was |
|---|---|
| R2 | `lineCardOk` read the STORED height where the app DERIVES it — `tallHC` was already ported and simply never called |
| R3 | a dup membership wore the PRIMARY's `category`, so `locateFamily`'s "prefer the current category" tie-break degraded to Map insertion order |
| S | ⭐ the **`Insert` row** — `unitFacts.insert` (2.5.4) + `kind:"insert"` + two card-state query params |
| S′ | the doc/authoring surfaces that field touches: contract, sample, map, CRUD guide, admin form, lite UI, client guide |

*(§R1 is not a fix — it is the 498-state re-measure that confirmed §Q1 and §Q3.)*

---

## 1. START HERE — first 20 minutes

```bash
# A. three servers  (⚠️ start the backend BEFORE any sweep, do not restart it mid-leg — trap 1)
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction/data-from-client && python3 -m http.server 8777
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction && node scripts/parity/sink.js scripts/parity/out
cd /Users/apple/Documents/thirtynorth/node-js/D4K-backend && npm run build && node dist/main.js

# B. sanity — today's fixes, all verified at log-off
curl -s localhost:8000/design-book/dev-token >/dev/null && echo backend-up
#    (⚠️ scope by familyId — an unfiltered category+sub page with gridRows takes minutes)
#  S   items?familyId=FP_16FRONT&groupBy=family&limit=1
#        → ZIGSUV90 · rows  W[…90*…] · Ty[Drawer*…] · Insert[L3/M3*, M8]
#  S   items?familyId=FP_16FRONT&insert=M8&widthMm=900&groupBy=family&limit=1
#        → ZIGSUV90U, and its W row targets the …U skus
#  S   items?familyId=FP_16FRONT&insert=M8&variantCode=Pullout&widthMm=200&groupBy=family&limit=1
#        → ZIGZUV20U
#  R2  items?category=Panels%20%26%20surround&subcategory=Pilasters&heightClass=73&line=73&groupBy=family
#        → 6 families, NO XAG_Pa_a989a3 (the 80-system parent now hides at line 73; its _B/_C/_D stay)
```

### TASK 1 — release the backend to prd

The only thing standing between prd and this session. Three commits, **all code-only** — the data is
already on prd (§3). Same two-PR shape as 07-30:

```
dev -> staging -> main       21a8ef87 · 66c0a3e3 · d1d87ccc
```

⚠️ Dry-run both merges in a throwaway worktree first and confirm the net effect on `main` is exactly
the design-book files. On 07-30 `src/project/room.service.ts` differed between branches but was
main-side only; check that shape again rather than assuming.

Confirm afterwards, against prd — all three must hold:

```bash
GET /design-book/items?familyId=FP_16FRONT&groupBy=family&limit=1
      → ZIGSUV90, rows W · Ty · Insert[L3/M3*, M8]           # §S grid
GET /design-book/items?familyId=FP_16FRONT&insert=M8&widthMm=900&groupBy=family&limit=1
      → ZIGSUV90U   (without `insert` it returns ZIGSUV90)    # §S card state
GET /design-book/items?category=Panels%20%26%20surround&subcategory=Pilasters&heightClass=73&line=73&groupBy=family
      → 6 families, no XAG_Pa_a989a3                           # §R2
```

### TASK 2 — open the frontend follow-up PR

`feat/design-book-v2.5` has **two commits not in `dev`** (`54456308`, `05706e6b` — the Insert wiring).
PR #2328 merged the first three on 07-31 (merge commit `34610156`); these landed after it.

⚠️ **Do not merge the client before the backend release above.** The wiring sends `insert` and
`variantCode`, which prd does not serve yet — against prd the row renders but does not swap.

### Task board

| # | task | state |
|---|---|---|
| — | rounds 1–4 · §P extended coverage · §Q | ✅ 07-28 → 07-30 |
| — | §R — E2/E3 re-measure + two more fixes | ✅ 07-31 |
| — | §S — the `Insert` row, all surfaces | ✅ 07-31 |
| — | D4K-prd **data** ledger | ✅ level — `unitFacts.insert` written 07-31 (§3) |
| **1** | ⭐ **release backend `dev` → prd** (3 commits) | ⬜ **open — the top item.** See TASK 1 |
| **2** | ⭐ open the frontend follow-up PR (2 commits) | ⬜ open — **after** task 1 |
| **3** | `GET /design-book/stats` reports `schemaVersion "2.2.0"` | ⬜ open — **both clusters**; the meta doc is from the 2026-07-17 ingest and no backfill has ever touched it. One-field write to `designbookmetas`, or re-ingest. Cosmetic today, misleading forever |
| **4** | ⭐ **Design-Tasks sidebar — `functionalGroups` per MEMBERSHIP** (§O5, T1's 144 diffs) | ⬜ deferred by decision. Sidebar says 87, grid returns 91 (app 87/87). Extractor + export + contract + backfill; the taxonomy has NEVER been swept |
| **5** | ⚠️ `lineCardOk` is missing the app's **v376 Avance line-80 lock** | ⬜ open and **UN-SWEPT** — no plan state anywhere combines line 80 with a programme. **Add the state and MEASURE before porting** |
| **6** | un-swept surfaces: `grey=true` (15 states), `page>1`, the detail drawer, `tallH*`+`antoso` together | ⬜ open — `GET tall-heights` ignores `antoso`; add the combined state before fixing it |
| **7** | prd holds four `*_bak_20260727` collections | ⬜ open — `designbookitems/metas/programs/categories`. Harmless, but decide whether they are still wanted |
| **8** | tall `Line` row click | ⬜ open — only if the client asks |
| **9** | perf pass — member scans, the membership `$unwind`, the pool cache | ⬜ open |
| **10** | the 4 deferred client items in `docs/frontend-v2.5-pending-2026-07-30.md` | ⬜ open — none is an integration gap |

**Not tasks — app bugs, deliberately unmatched.** `§R4` the `XCRV` / `FAMS` splice (the app renders
codes from families it deleted, because `CODE_INDEX` is built before the splice) and `§O4-3`'s
"duplicate 217" (a harness `NUM()` artifact over the `217+` chip).

---

## 2. What shipped today (all committed + pushed)

### `D4K-backend` — branch `dev` @ **`d1d87ccc`** ⚠️ 3 ahead of `origin/main` (`54c2af2e`)

| commit | what |
|---|---|
| `470c8003` | **§R2 + §R3** — `lineCardOk` derives the tall height; dup memberships carry their own `category` |
| `21a8ef87` | **§S** — port the app's `Insert` row (`insList` / `selIns` / `insPool`, three call sites) |
| `66c0a3e3` | **§S** — the row is CARD STATE: `insert` + `variantCode` query params, `kind:"insert"`, lite-UI handler |
| `d1d87ccc` | **§S** — admin: expose `unitFacts.insert` as a field |

### `D4K-frontend` — branch `feat/design-book-v2.5` @ **`05706e6b`** ⚠️ 2 ahead of `dev`

| commit | what |
|---|---|
| `8383e370` · `a4bfadeb` · `638de925` | the v2.5 client — **merged** via PR #2328 (`34610156`) |
| `54456308` | first attempt at the Insert route (superseded by the next commit, kept for the reasoning) |
| `05706e6b` | **§S** — `kind:"insert"` + `insert`/`variantCode` carried in `stateQ` |

### `d4k-items-extraction` — branch `main` @ **`61e70f7`**

| commit | what |
|---|---|
| `6b88c39` · `404e6fa` · `9a7639b` | audit §R + the task-1 outcome + CLAUDE.md |
| `aaaa350` | **contract 2.5.4** — `UnitFacts.insert`, extractor, facts dumper, backfill scripts, export + `.gz` |
| `dbf816f` | §S — the card-state rewrite of map §2c-11, audit §S, the client guide |
| `1c2a0f4` | prd backfilled |
| `3cafc80` | the 2.5.4 doc gaps — sample item, the param tables, and **2.5.3's `rawSub`, which the sample never got** |
| `61e70f7` | two live docs that were stale on the Insert work |

---

## 3. DATA LEDGER — level on both clusters; only CODE is owed

Contract **2.5.4**, collection `designbookitems`. Verified today by direct read of both clusters:

| | D4K-dev | D4K-prd |
|---|---|---|
| items | 18,396 | 18,396 |
| `unitFacts.insert` | 92 | 92 |
| inactive | 0 | 0 |
| `designbookmetas.meta.schemaVersion` | `2.2.0` ⚠️ | `2.2.0` ⚠️ |
| `*_bak_20260727` collections | none | 4 ⚠️ |

**The 2.5.4 write is done on both.** It was data-only and is **inert until the backend ships** — the
deployed prd code never reads `unitFacts.insert`.

```bash
# how it was done — .env stays on D4K-dev, so nothing is left pointing at production
MONGO_URI_OVERRIDE="<prd uri>" node scripts/backfill-item-fields.js \
  ../d4k-items-extraction/docs/export-v781-fresh.json --fields unitFacts        # dry run first
#   → 18,396 scanned, 92 differ · matched 92, modified 92 · re-run reports 0 differ
```

* The export (`docs/export-v781-fresh.json` + `.gz`) **carries `insert`**, so a re-ingest is safe.
* **After ANY re-ingest**, re-run the backend-computed fields the export does not carry:
  `backfill-face-height-class.js`, `backfill-face-variant-core.js`, `backfill-face-width-mm.js`, and
  whatever writes `variantCore`.
* `meta.schemaVersion` is **not validated** anywhere — ingest stores and reports it, never gates on
  it. So the 2.5.4 bump cannot break a re-ingest, and task 3 is safe to do whenever.

---

## 4. §S — WHAT THE `Insert` ROW ACTUALLY COST, PER SURFACE

The row itself was an afternoon. Everything below it was the work, and **only the browser found the
last two**. Full write-up: audit §S; the client contract: map §2c-11.

| surface | change |
|---|---|
| **contract** | `UnitFacts.insert` (2.5.4, additive). Only `u.ins` ships — the family flag `insAx` is **derived** ("a member carries it"), 1:1 in v781. `scripts/backfill-insert-axis.js` **asserts** that and exits non-zero if a future catalog breaks it |
| **data** | 92 units, one family (`FP_16FRONT`). Read straight from the app's `<script id="DATA">` — `u.ins` is raw and init never rewrites it — so **no parity run and no browser** were needed for the data |
| **extractor** | `_unitFacts` emits it; the facts dumper and `backfill-grid-facts.js` carry it → re-extract and re-ingest both safe |
| **backend** | `insList`/`selIns`/`insPool` at the app's **three** call sites: the face pick (`_selUnit`), the W row's source (`_src`), and the row itself (last, after `Ty`) |
| **backend API** | `insert` + `variantCode` query params — the stateless twins of the app's `blockIns` / `blockVr` |
| **lite UI** | routes `kind:"insert"` by sku — enough for a dev tool, and it is what the parity harness scrapes |
| **admin UI** | `unitFacts` is a set of *structured controls*, so a field it does not render **cannot be authored at all**. Added, with the two things that surprise an author |
| **React client** | `kind:"insert"` handler + both params carried in `stateQ`, scoped to cards that have the row |
| **docs** | contract · sample (`ZIGSUV90`) · map §2c-11 + both param tables · CRUD guide · greying examples · client guide · pending doc · CLAUDE.md |

### The three traps this row sets for anyone touching it

1. **It is not a variant row.** Both pills share one `variantCore` (`ZIGSUV90` and `ZIGSUV90U` are
   each `Drawer`), so routing it that way asks for the card you are already on.
2. **Deriving the pick from the FACE only works for a fetch BY SKU.** A family-scoped swap has no
   face until `_selUnit` has run, so `variantCore=ZIGSUVU&groupBy=family` came back `ZIGSUV90` — the
   first insert. That is why `insert` had to become a query param.
3. **On these cards a Ty pick must use `variantCode`, not `variantCore`** — the stem encodes the
   insert too (`ZIGZUV` = L3/M3 pullout, `ZIGZUVU` = M8), so pairing it with `insert` matches nothing
   and the pick silently does nothing.

Both params are scoped client-side to cards that HAVE an insert row, so every other card's query is
byte-identical — confirmed on the wire (a Base Ty swap still sends
`familyId=F344&variantCore=FSUEL&widthMm=16&heightCode=80`).

**Interaction proof** (React client, eight picks, all three axes both ways):

```
ZIGSUV90 [90 · Drawer · L3/M3]
  M8 → ZIGSUV90U    W20 → ZIGSUV20U    Pullout → ZIGZUV20U   L3/M3 → ZIGZUV20
  M8 → ZIGZUV20U    W60 → ZIGZUV60U    Drawer  → ZIGSUV60U   L3/M3 → ZIGSUV60
```

---

## 5. ⚠️ TRAPS — the 07-30 seven still apply; four more

The seven in `parity-session-handoff-2026-07-30.md` §4 are unchanged and still the highest-value list.
Added today:

8. **A stale dev server serves pre-fix code, and says nothing.** Hit TWICE: a `node dist/main.js` from
   10:36 held :8000 (my new one died with `EADDRINUSE`, which scrolled past), and a `next dev` held
   :3000 so mine silently moved to :3001. The first verification of the whole Insert row was run
   against pre-fix code. **`lsof -ti :PORT -sTCP:LISTEN` before trusting any local result.** This is
   the same family as trap 1 and is now the most expensive recurring mistake in this project.
9. **Scope a DOM pill lookup to its ROW, never to its label.** Five buttons on that page read `M8` —
   four are `Ty` pills on other cards. Every synthetic click went to the wrong one, which looked
   exactly like "the handler is broken". Use `span[title="Insert"]` and walk from there.
10. **The extension's `javascript_tool` can read `__reactProps$…` off a DOM node.** That is how the
    handler was finally isolated: read the button's React props and call `p.onClick(…)` directly.
    Console capture and `fetch`/XHR monkey-patching both came back empty; the network tool
    (`read_network_requests`) is the reliable observer.
11. **`DELETE /design-book/items/:sku` is a SOFT delete.** A CRUD round-trip left `ZZ_INSERT_RT_TEST`
    as `active:false` in D4K-dev and `stats` read `18397 / 1 inactive` until it was hard-deleted.
    Use `?hard=true` for throwaway test items, and check `inactiveItems` after any CRUD test.

---

## 6. The harness, current form

Unchanged from 07-30 §5 — `make-plan.js`, `dump-client.js` / `dump-ours.js`, `diff.js` (10 buckets),
`check-faces.js`, `sink.js`, and the plans `plan-{Base,Tall,WallMidway,E1,E2,E3,F1,T1}.json`. Client
dumps in `out/client-*.json` stay valid: **the app never changes, so only our side needs re-dumping.**

⚠️ `diff.js` still compares pill labels through `NUM()` (digits only), so `217` and the `217+` chip
look identical. Prefer the raw label when a PILLS diff looks like a duplicate.

**§S needed no sweep, and the reasoning is worth reusing:** the change is a strict no-op outside the
92 units that carry `insert` (`insList().length` gates the row; `selIns()` returns null everywhere
else, so `insPool` is the identity), so only one family's cards could move. The app has exactly TWO
row signatures for that family across all 8 states it appears in (7 × face `ZIGSUV90`, 1 × `ZIGSUV60`
at `w60`) — both reproduced byte-for-byte from the stored client dump, `cardAvailable` unchanged.
A 298-state re-sweep would have proved less, slower.

A leg is ~15 min (200 states) to ~25 min (Tall / Wall+Midway).

---

## 7. Read these first

* **`docs/client-ui-parity-audit.md` §R · §S** — today. §L–§Q are rounds 1–4 plus the extended sweep.
* `docs/design-book-api-ui-map-v2.md` **§2c-11** — the `gridRows` contract, now including the `Insert`
  row and both card-state params; §2's query-param table and the pill-navigation table carry them too.
* **`throwaway/frontend-v2.5-changes.md`** — the client's implementation guide, current.
* **`docs/frontend-v2.5-pending-2026-07-30.md`** — client status: four commits, what PR #2328 covered,
  and the ⚠️ that the Insert commits need backend `dev` ≥ `66c0a3e3`.
* `docs/export-schema-v2.ts` — the contract at 2.5.4. `docs/export-sample-v2.json` is the 15-item
  worked sample (`ZIGSUV90` = the insert axis).
* `docs/design-book-crud-guide.md` §4f — the authoring view of `unitFacts`, including `insert`.
