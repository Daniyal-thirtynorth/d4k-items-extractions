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

## HOW TO USE THIS FILE (new session)

Open the session **with `/Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction` as the
working directory** — `CLAUDE.md` there is the standing brief and loads automatically; this file is
the state on top of it. Then:

> Read `docs/parity-session-handoff-2026-07-31.md`. Start with task 1 on the board.

That is enough — everything needed is either in this file or reachable from its Key-files table. Four
things it cannot do for you:

* **Sweeps and browser checks need the Chrome extension connected** and the three servers of COLD
  START running. Everything else (API checks, backfills, git) is shell-only.
* **`GET /design-book/dev-token` only exists when `ENVIRONMENT` is `local` or `dev`** — by design, it
  403s in stg/prd, so a deployed backend needs a real token instead.
* **The prd release (task 1) is a `gh` PR merge.** Expect to run the merge command yourself if the
  agent's is blocked — `! gh pr merge <n> --merge --repo thirtynorth/D4K-backend` runs it in-session.
* **Nothing here is time-sensitive.** No sweep is mid-flight, no branch is half-merged, no cluster is
  half-written. Picking it up in a week costs nothing.

---

## ⭐ COLD START — read this first if you have no context

**The project.** `d4k-items-extraction` is a data + schema workspace for the LEICHT "Design Book"
catalog. The goal of this whole line of work: make our **backend + React client render the product
grid byte-identically to the client's own app** (`leicht_units__781_.html`, 17.8 MB, ships its whole
catalog and renderer inline). We measure that with a differential harness — drive both UIs over a
plan of toolbar states, scrape each grid, diff into 10 buckets. `CLAUDE.md` in this repo is the
standing brief and is auto-loaded; this file is the operational state on top of it.

### The model, in six lines

* An **item** = one orderable code (sku). A **family** = the sibling set behind one grid CARD; the
  card shows one member (the **face**) plus pill rows that navigate to the others.
* ⭐ **A card's rows come from the FAMILY POOL, not from the item.** The backend ships them
  pre-built as **`gridRows`** (a line-by-line port of the app's `renderGrid`) and the client renders
  them verbatim. `parameters.*` is the DETAIL-drawer model — one unit's own pill list — and using it
  for the grid was the root of the long parity gap.
* **`capabilities`** (17 fields) is the pill/card GREY rule surface — 8 gates, evaluated by
  `availableFromCaps(caps, toolbar)`, ported identically in the contract, the backend and the client.
* **`unitFacts` / `familyFacts`** are the pool inputs, dumped FROM the app (never re-derived).
* Anything the app keeps as **per-card state** (`blockIns`, `blockVr`, `blockSel`) has no server
  memory, so it must travel in the query — that is exactly what §S is about.
* The app is the spec. Where it has a bug we **match nothing** and write it down (see the two below).

### The three repos

| repo | path | branch | role |
|---|---|---|---|
| extraction | `/Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction` | `main` | contract, export, docs, the parity harness |
| backend | `/Users/apple/Documents/thirtynorth/node-js/D4K-backend` | `dev` | NestJS `design-book` module + the lite/admin dev UIs |
| client | `/Users/apple/Documents/thirtynorth/react-apps/D4K-frontend` | `feat/design-book-v2.5` | the real React app |

### Servers, URLs, auth

```bash
# the CLIENT APP (ground truth) — the extension cannot open file://, so serve it
cd <extraction>/data-from-client && python3 -m http.server 8777
#   → http://localhost:8777/leicht_units__781_.html      openDetail('<famId>','<sku>') opens a panel

# the SINK (both in-page dumpers POST here; the extension redacts big tool returns)
cd <extraction> && node scripts/parity/sink.js scripts/parity/out
#   POST :8799/save?name=<file>   ·   GET :8799/js?f=<file in scripts/parity/>

# the BACKEND — run from the repo ROOT (it sendFile()s public/ via process.cwd())
cd <backend> && npm run build && node dist/main.js          # :8000, Swagger /api
#   lite UI    http://localhost:8000/design-book/ui         ← what the harness scrapes
#   admin UI   http://localhost:8000/design-book/admin      ← form-based CRUD, /admin#SKU deep-links
#   token      GET /design-book/dev-token → 1 h masteradmin JWT (both UIs self-auth; ENVIRONMENT
#              must be local|dev, and those two routes 403 in stg/prd by design)
```

⚠️ **`.env` `MONGO_URI` points at D4K-dev.** Leave it there. For a prd write use
`MONGO_URI_OVERRIDE=<uri> node scripts/...` so nothing is left aimed at production (§3).

⚠️ **Check the port before trusting any local result** — `lsof -ti :8000 -sTCP:LISTEN`. A stale
server holds the port, your new one dies with `EADDRINUSE` in the scrollback, and you measure old
code. This happened twice on 07-31 (see trap 8).

⚠️ **Some list queries are slow.** An unfiltered `category`+`subcategory` page with `gridRows` can
take minutes. Scope by `familyId` when you are checking one card.

### Running the React client

```bash
cd /Users/apple/Documents/thirtynorth/react-apps/D4K-frontend
npm install --legacy-peer-deps      # ⚠️ required — react-toast-notifications peer-wants React 16/17
npm run dev                         # :3000  (⚠️ if it says "Port 3000 is in use" it silently moves
                                    #         to :3001 and you are testing a DIFFERENT server)
```

`.env` already points `NEXT_PUBLIC_API_URL` at `http://localhost:8000/`. **Logging in is not
possible unattended** — the form wants a password plus a secret code. Skip it: the app reads
`localStorage.token`, and `middleware.ts` gates routes on a `loggedIn` cookie, so paste this in the
tab's console (or run it from the browser tool) and reload `/design-book`:

```js
const r = await fetch('http://localhost:8000/design-book/dev-token').then(r => r.json());
localStorage.setItem('token', r.token);      // the app's own auth key
document.cookie = 'loggedIn=1; path=/';      // middleware.ts route gate
```

### The harness, end to end

Two Chrome tabs: **A** = the served client app (:8777), **B** = our lite UI (:8000). Inject the
matching dumper into each, drive the plan, POST both dumps to the sink, diff.

```js
// ── tab A · CLIENT (ground truth). Only needed when the PLAN changes — the app never does,
//    so the existing out/client-*.json stay valid and you normally re-dump OUR side only.
(0,eval)(await fetch('http://localhost:8799/js?f=dump-client.js').then(r=>r.text()));
const plan = await fetch('http://localhost:8799/js?f=plan-E2.json').then(r=>r.json());
window.__MY = {}; window.__PROG = {done:0,total:plan.length};
(async () => { for (const st of plan) { window.__MY[st.key] = await __P.run(st.state);
    window.__PROG.done++; }
  await fetch('http://localhost:8799/save?name=client-E2', {method:'POST',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({side:'client',data:window.__MY})});
})();

// ── tab B · OURS (the lite UI). Same plan, `filters` instead of `state`.
(0,eval)(await fetch('http://localhost:8799/js?f=dump-ours.js').then(r=>r.text()));
const plan = await fetch('http://localhost:8799/js?f=plan-E2.json').then(r=>r.json());
window.__MY = {}; window.__PROG = {done:0,total:plan.length};
(async () => { for (const st of plan) {
    window.__MY[st.key] = await __Q.run(st.filters, {grey:false});   // ⭐ pin grey — trap 5
    window.__PROG.done++; }
  await fetch('http://localhost:8799/save?name=ours-E2', {method:'POST',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({side:'ours',data:window.__MY})});
})();
// poll:  JSON.stringify(window.__PROG)     ⚠️ never `await` a whole leg in one call — trap 7
```

```bash
node scripts/parity/diff.js scripts/parity/out/client-E2.json \
     scripts/parity/out/ours-E2.json  scripts/parity/out/report-E2.json
# buckets: GREY_NOT_HIDE · MEMBER · FACE · CODE · GREY · SECT · ORDER · ROWSET · PILLS · STATE
node scripts/parity/check-faces.js report-E2 plan-E2      # replay FACE diffs against the API, no browser
node scripts/parity/make-plan.js <Category> [...]         # regenerate a plan
```

A leg is ~15 min (200 states) to ~25 min (Tall / Wall+Midway).

### Key files

| file | what |
|---|---|
| `docs/export-schema-v2.ts` | ⭐ **the contract** (2.5.4) + the `availableFromCaps` reference port |
| `docs/export-sample-v2.json` | the 15-item worked sample |
| `docs/export-v781-fresh.json` (+ `.gz`) | the full export, 18,396 items — raw is gitignored, the `.gz` is committed |
| `docs/design-book-api-ui-map-v2.md` | ⭐ API ↔ UI, per-endpoint params, `gridRows` (§2c-11) |
| `docs/design-book-crud-guide.md` | authoring guide — what each field does to a card |
| `docs/client-ui-parity-audit.md` | ⭐ every round's findings, §L → §S |
| `docs/export-v781-extractor2.js` | the in-page extractor that produces the export |
| `scripts/backfill-*.js` | export/DB patchers; `D4K-backend/scripts/backfill-item-fields.js` pushes export → cluster |

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

## 5. ⚠️ ELEVEN TRAPS — every one of them cost real time

1–7 carry over from `parity-session-handoff-2026-07-30.md` §4 and are inlined here so this file
stands alone; 8–11 are new today.

1. **Never restart the backend mid-sweep.** Cost two whole legs: "MEMBER 33 / SECT 33" and
   "MEMBER 37 / SECT 19" were both ~60 states hitting a dead server. The API was right the whole
   time. Abort, restart, re-run.
2. **A stale in-process pool cache survives an out-of-band backfill.** `poolByFamily()` is cached for
   the process lifetime; only `invalidatePool()` (ingest / item CRUD) clears it. Six ORDER diffs once
   vanished on restart with no code change. Any script that writes the collection ⇒ restart first.
3. **Reproduce a sweep diff with the plan's EXACT filters.** `lineState=80` passes where `line=80`
   fails — `lineState` applies no per-unit `$match`. That hid one bug for three sweeps.
4. **"It's a bad client sample" is usually wrong.** Three of round 3's four residual diagnoses were
   wrong for exactly this reason: written off without a mechanism. Re-dump and reproduce first.
5. **`grey=true` and `grey=false` are different products.** The app's default is **`grey=false`** and
   that is the mode that matters. Pin it: `__Q.run(filters, {grey:false})`.
6. **`__Q.run()` returns a dump; it does not record one.** Only `__Q.sweep()` writes `RESULTS`, and
   `post()` sends `RESULTS`. A hand-rolled loop + `__Q.post()` uploads `{"data":{}}`, and the diff
   then reports *"missing on ours: 200"* with all ten buckets 0 — a clean-looking report over
   nothing, after the leg has already run. Keep your own map (the snippets above do).
7. **A CDP timeout does NOT cancel the page promise.** Drive long sweeps fire-and-forget and poll
   `window.__PROG`; never `await` a whole leg in one `javascript_tool` call. Two concurrent sweeps
   interleave and each records the other's grid.

8. **A stale dev server serves pre-fix code, and says nothing.** Hit TWICE: a `node dist/main.js` from
   10:36 held :8000 (the newly started one died with `EADDRINUSE`, which scrolled past), and a
   `next dev` held :3000 so the new one silently moved to :3001. The first verification of the
   whole Insert row was run
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

## 6. The harness — notes beyond the recipe

The commands are in **COLD START › The harness, end to end**. Files: `make-plan.js`,
`dump-client.js` / `dump-ours.js`, `diff.js` (10 buckets, `--keep-grey` disables the grey-only
normalization), `check-faces.js`, `sink.js`, and the plans
`plan-{Base,Tall,WallMidway,E1,E2,E3,F1,T1}.json` (192 / 272 / 256 · 264 / 298 / 200 / 90 / 252).
Client dumps in `out/client-*.json` stay valid: **the app never changes, so only our side needs
re-dumping.**

⚠️ `diff.js` compares pill labels through `NUM()` (digits only), so `217` and the `217+`
`heightExtension` chip look identical. That merged a real 2-diff into "a duplicate 217" for a whole
round (§O4). Prefer the raw label when a PILLS diff looks like a duplicate. Left as-is on purpose:
changing it re-baselines every stored report.

**§S needed no sweep, and the reasoning is worth reusing:** the change is a strict no-op outside the
92 units that carry `insert` (`insList().length` gates the row; `selIns()` returns null everywhere
else, so `insPool` is the identity), so only one family's cards could move. The app has exactly TWO
row signatures for that family across all 8 states it appears in (7 × face `ZIGSUV90`, 1 × `ZIGSUV60`
at `w60`) — both reproduced byte-for-byte from the stored client dump, `cardAvailable` unchanged.
A 298-state re-sweep would have proved less, slower.

A leg is ~15 min (200 states) to ~25 min (Tall / Wall+Midway).

---

## 7. Read these first

* **`docs/client-ui-parity-audit.md`** — every finding, in order. The file is long; this is the map,
  so you can jump straight to the section a task names:

  | § | what it covers |
  |---|---|
  | A–K | the pre-`gridRows` era: the first discrepancy tables, depth/`showUnderLine`/face selection, the global-height and W-filter findings, section order, `heightCode` |
  | **L** | ⭐ **`gridRows`** — a card's rows come from the FAMILY POOL, not `parameters.*`. The single biggest idea here |
  | **M** | the membership rules that are not per-unit filters: `gridHidden`, `depthFamOk`, `lineCardOk` hides, `dupFamilies` |
  | **N** | round 3 — section order, the RAW sub, the v98 sibling-family swap. **Also the two harness traps** (dead backend, stale pool cache) |
  | **O** | round 4 — all four residuals; the sweep hits ZERO on Base/Tall/Wall/Midway. §O4 is `heightExtension` becoming derived + ADVISORY; §O5 is the deferred sidebar task |
  | **P** | extended coverage — the other 10 categories and the toolbar flags. `dvRowFn`, the single-pill `Finish` row, `opening`, ANTOSO, global `q`, `FAM_DWM` |
  | **Q** | the FRMAT qualifier and the `Alteration`-category escape |
  | **R** | 07-31 — the E2/E3 re-measure, `lineCardOk`'s derived height, dup `category`, and the `XCRV` **app bug** |
  | **S** | ⭐ 07-31 — **the `Insert` row**, and why it is card state. Read with map §2c-11 |
* `docs/design-book-api-ui-map-v2.md` **§2c-11** — the `gridRows` contract, now including the `Insert`
  row and both card-state params; §2's query-param table and the pill-navigation table carry them too.
* **`throwaway/frontend-v2.5-changes.md`** — the client's implementation guide, current.
* **`docs/frontend-v2.5-pending-2026-07-30.md`** — client status: four commits, what PR #2328 covered,
  and the ⚠️ that the Insert commits need backend `dev` ≥ `66c0a3e3`.
* `docs/export-schema-v2.ts` — the contract at 2.5.4. `docs/export-sample-v2.json` is the 15-item
  worked sample (`ZIGSUV90` = the insert axis).
* `docs/design-book-crud-guide.md` §4f — the authoring view of `unitFacts`, including `insert`.
