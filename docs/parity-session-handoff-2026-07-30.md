# Grid-parity session handoff — 2026-07-30 (start here next)

Continues `parity-session-handoff-2026-07-29.md`. That day closed rounds 2 and 3 and left four
residuals. **This day fixed all four (round 4, audit §O), extended the sweep from 4 categories to all
14 plus the toolbar flags (§P), and cleared two more items out of that residue (§Q).**

Findings: `docs/client-ui-parity-audit.md` **§O**, **§P**, **§Q**. This file is the operational state.

Everything below is **committed and pushed** — backend `dev`, extraction `main` — and **released to
prd** (`origin/main` @ `54c2af2e`, §3). Nothing dangling, nothing owed.

---

## 0. WHERE WE LANDED

| leg | states | at session start | now |
|---|---|---|---|
| Base · Tall · Wall+Midway (§O) | 720 | 4 residuals | **0 in all ten buckets** |
| E1 accessories / alteration / handles | 264 | MEMBER 37 · SECT 19 | **0** (the diffs were a dead backend — see trap 1) |
| E2 the other 10 categories | 298 | ROWSET 385 · MEMBER 1 · GREY 12 · SECT 1 | ROWSET **8** · MEMBER 1 · SECT 1 (**GREY 12 → 0**) |
| E3 Base/Tall/Wall/Mid at skipped states | 200 | MEMBER 3 · FACE 6 · GREY 2 · SECT 1 · ORDER 2 · GNH 1 | MEMBER 3 · SECT 1 · GNH 1 (**FACE, GREY, ORDER → 0**) |
| F1 the toolbar flags | 90 | MEMBER 66 · SECT 54 | **0 on all 60 flag states** (30 `grey_on*`/`tallH*` un-swept) |
| T1 the Design-Tasks sidebar | 252 | 144 diffs | unchanged — **deferred by decision** (§O5) |

**Eleven fixes shipped today, every one of them pure backend logic.** No data change, no backfill, no
re-ingest, no contract change — `schemaVersion` is still **2.5.3** and the export is untouched.

| § | what it was |
|---|---|
| O1 | `maxh` sort tiebreak from the unfiltered pool — confirmed by a full Tall re-sweep (ORDER 6 → 0) |
| O2 | the v98 swap target can be **outside the result set and in another category**; `bucketSections` must not bucket a multi-sub set at all |
| O3 | dup memberships now carry their own `unitFacts`; the programme tier branch reads it |
| O4 | `heightExtension` DERIVED per request (grid + drawer + advisory) — was a frozen per-unit field |
| P1 | `dvRowFn` — the app's **second** depth row, all-sibling, never ported |
| P2 | a `Finish` variant row renders with ONE pill (`selected` + `dead`) — it exists for the swatch |
| P3 | `opening` is a toolbar INPUT, not a card filter |
| P4 | **SUSPENDED *is* ANTOSO** — new `antoso` param (hide + re-face + the existing gate) |
| P5 | the search box is **GLOBAL** — `q` now returns a reduced filter |
| P6 | `FAM_DWM` — the app's one-family `defaultWidthMin` override (`RE_SLIDEIN` = 90) |
| Q1 | `isFrmatFamily` is a QUALIFIER, not a blanket exclusion — 9 programme ids, not 120 |
| Q3 | `famOkB` exempts the whole **`Alteration` category**, not just accessories — 12 cards ungreyed |

*(§Q2 is not a fix — it is the full 200-state E3 re-measure that confirmed P6: FACE 6 → 0, every other
bucket byte-identical to the pre-fix baseline. `out/report-E3d.json`.)*

---

## 1. START HERE — first 20 minutes

```bash
# A. three servers  (⚠️ start the backend BEFORE any sweep and do not restart it mid-leg — trap 1)
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction/data-from-client && python3 -m http.server 8777
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction && node scripts/parity/sink.js scripts/parity/out
cd /Users/apple/Documents/thirtynorth/node-js/D4K-backend && npm run build && node dist/main.js

# B. sanity — today's fixes, all hand-verified at log-off.
#    Runs against localhost; the same five hold against PRD now (§3), so they double as a rollout check.
curl -s localhost:8000/design-book/dev-token >/dev/null && echo backend-up
#  P6  Panels & surround › Open Shelf Units, no W filter  → RE_SLIDEIN faces RE905336 (not RE305336)
#  Q1  Panels & surround › Surround @programs=244         → F69 · F124 · F263, all three LIVE, in that order
#      …@programs=272 (KYOTO)                             → F124 greyed  (the size table still bites)
#  P4  Base › Accessories & Surround @antoso=true         → 5 cards (20 without)
#  P5  ?q=TSP                                             → 31 families in EVERY category state
```

### TASK 1 — re-sweep E3 **and E2** to confirm §Q1 + §Q3

Q1's GREY 2 / ORDER 2 and Q3's GREY 12 were verified against the client dump by hand, not by a sweep.
E3 is otherwise measured (`out/report-E3d.json`, taken after P6): expect **MEMBER 3 · SECT 1 ·
GREY_NOT_HIDE 1** and zero elsewhere. Then run `plan-E2.json` the same way: expect **ROWSET 8 ·
MEMBER 1 · SECT 1** and zero elsewhere (GREY 12 should be gone).

```js
// tab B = our lite UI (http://localhost:8000/design-book/ui)
(0,eval)(await fetch('http://localhost:8799/js?f=dump-ours.js').then(r=>r.text()));
const plan = await fetch('http://localhost:8799/js?f=plan-E3.json').then(r=>r.json());
window.__MY = {}; window.__PROG = {done:0,total:plan.length};
(async () => { for (const st of plan) {
    window.__MY[st.key] = await __Q.run(st.filters, {grey:false});   // ⭐ pin grey — trap 5
    window.__PROG.done++; }
  await fetch('http://localhost:8799/save?name=ours-E3e', {method:'POST',
    headers:{'Content-Type':'application/json'}, body:JSON.stringify({side:'ours',data:window.__MY})});
})();
// poll:  JSON.stringify(window.__PROG)      — ~15 min for 200 states
```
```bash
node scripts/parity/diff.js scripts/parity/out/client-E3.json \
     scripts/parity/out/ours-E3e.json scripts/parity/out/report-E3e.json
```

### Task board

| # | task | state |
|---|---|---|
| — | rounds 1–3 · harness · `gridRows` · 2.5.3 facts | ✅ 07-28 / 07-29 |
| — | round 4 — all four §O residuals + the `heightExtension` follow-ups | ✅ 07-30 |
| — | extended coverage §P — 1,104 states, six fixes | ✅ 07-30 |
| — | §Q — FRMAT gate + the `dwm` face | ✅ 07-30 |
| — | D4K-prd data ledger | ✅ closed 07-30 (see §3) |
| — | the prd RELEASE | ✅ **complete** — two passes, `origin/main` @ `54c2af2e` (see §3) |
| **0** | ~~ship §Q to prd~~ | ✅ **done 07-30** — PR #2975 + #2976, `origin/main` @ `54c2af2e`, `dev` no longer ahead. If prd deploys via CI, run the two curls in §3 to confirm the rollout |
| **1** | re-sweep **E3 + E2** → confirm §Q1 and §Q3 (above) | ⬜ next |
| **2** | ~~E2 GREY 12~~ | ✅ **fixed — §Q3.** `famOkB`'s `Alteration` category escape. What is LEFT on E2 is `MEMBER 1 + SECT 1`: `Alteration › Side Panel Modifications` @BOSSA, client `PNL_ACC` vs our `PS_WAUKS_RECESS` (+ the `Sink, Fillers & Panels` header). Looks like a swap/split, not a gate |
| **3** | **E3 MEMBER 3** — `Pilasters\|line73` (`XAG_Pa_a989a3`), `Side panels W\|progP_BOSSA` (`CURVED_*_M` vs the plain codes), `Wall Cladding\|line73` (`PPM3234`) | ⬜ open — three single-family cases, look like variant-family splits rather than gates |
| **4** | the `Insert` row, 8 ROWSET diffs (`FP_16FRONT`, 92 units) | ⬜ open — **needs per-unit `u.ins`**: extractor + export + contract + backfill. The ONLY known grid gap that is not pure logic |
| **5** | ⭐ **Design-Tasks sidebar — `functionalGroups` per MEMBERSHIP** (§O5, T1's 144 diffs) | ⬜ deferred by decision. Sidebar says 87, grid returns 91 (app 87/87). `leafId` is fine, `groupKey` is not. Extractor + export + contract + backfill, and the taxonomy has NEVER been swept |
| **6** | un-swept surfaces: `grey=true` (15 states), `page>1`, the detail drawer, `tallH*`+`antoso` together | ⬜ open — `GET tall-heights` ignores `antoso`; **add the combined state before fixing it**, there is no measurement behind that one |
| **7** | tall `Line` row click | ⬜ open — only if the client asks |
| **8** | perf pass — member scans, the membership `$unwind`, the pool cache | ⬜ open |
| **9** | frontend — `throwaway/frontend-v2.5-changes.md` is current, with a new parity-status section | ⬜ handed off |

---

## 2. What shipped today (all committed + pushed)

### `D4K-backend` — branch `dev`

| commit | what |
|---|---|
| `0a86b06f` · `145ef37b` · `0508587f` | `heightExtension` — derive on the drawer too, then make the field ADVISORY (§O4b/§O4c) |
| `f61942d8` | **the six §P rules** — `dvRowFn`, the single-pill `Finish` row, `opening`, `antoso`, global `q`, `FAM_DWM` |
| `6a84bba3` | comment: the opening hide is §P3 |
| `f59ea0af` | **§Q1** — `FRMAT_DEAD_PROGRAMS`: `isFrmatFamily` is a qualifier, not a blanket exclusion |
| `b8169728` | **§Q3** — `famOkB` exempts the whole `Alteration` category |
| `16de7ebb` | release: PR #2975 `dev` → `staging` |
| `54c2af2e` | release: PR #2976 `staging` → `main` — **prd HEAD** |

### `d4k-items-extraction` — branch `main`

| commit | what |
|---|---|
| `f935e3c` | the extended sweep plans (E1/E2/E3/F1/T1) |
| `bed6da3` | audit §P + map + CRUD guide + `make-plan.js` + `dump-ours.js` + CLAUDE.md |
| `33e34ec` · `e7124a3` | frontend guide: §P3 ref, then the **parity-status** section |
| `d7ef321` | audit §Q, the contract + CRUD reference-port fix, the frontend guide's row 7, this handoff |
| `c880dfe` | pin the handoff's own sha |
| `61d034e` · `0bafa02` | retarget the handover docs onto prd, then record that the first release pass came up 3 commits short |
| `ba5b7b9` | §Q is on prd — the second pass, and the SHA caveat removed again |

---

## 3. DATA LEDGER — nothing owed; prd FULLY RELEASED

Contract **2.5.3**, collection `designbookitems`, **18,396 items on both clusters**, verified identical
on every tracked field (`unitFacts` 18,352 · `familyFacts` 18,366 · `familyFacts.rawSub` 18,366 ·
`gridHidden` 57 · `dupFamilies` 74 · `sectionRank` 18,366 · `faceWidthMm` 17,407 · `faceHeightClass`
7,605 · `variantCore` 18,396).

**Every fix from §O onward is backend logic, so this ledger did not move today.** Two consequences:

* the export (`docs/export-v781-fresh.json` + `.gz`) is unchanged and a **re-ingest is safe**;
* **after ANY re-ingest**, re-run the four backend-computed fields the export does not carry:
  `backfill-face-height-class.js`, `backfill-face-variant-core.js`, `backfill-face-width-mm.js`, and
  whatever writes `variantCore`. Everything else is in the export.

### ⭐ FULLY RELEASED TO PRD — 2026-07-30

Two passes. The first (PR #2973 `dev`→`staging`, #2974 `staging`→`main`) landed at `f61942d8` and left
the session's last three commits behind; the second closed the gap:

```
PR #2975  dev     -> staging     16de7ebb
PR #2976  staging -> main        54c2af2e   <- origin/main
git log origin/main..origin/dev            <- empty
f59ea0af (§Q1) · b8169728 (§Q3)            <- both ancestors of origin/main
```

Both merges were dry-run in a throwaway worktree first: clean, and the net effect on `main` was exactly
two files (`design-book.grid-rows.ts`, `design-book.service.ts`). `src/project/room.service.ts` differs
between the branches but is **main-side only** (dev never touched it since the merge-base), so the merge
preserved it — worth remembering as the shape of check to run before any prd merge from this repo.

**Code and data are now level on both clusters.** Nothing owed: every fix from §O2 onward is backend
logic, so the data ledger never moved. If prd deploys from `main` through CI rather than directly,
confirm the rollout with these two — both must be `true`:

```bash
GET /design-book/items?category=Panels%20%26%20surround&subcategory=Surround&groupBy=family&programs=244
      → F124 · cardAvailable true                    # §Q1 live
GET /design-book/items?category=Alteration&subcategory=Accessory&groupBy=family&programs=410
      → MPOSKE · cardAvailable true                  # §Q3 live
```

---|---|
| `f59ea0af` (§Q1) | `Front panel material` (`F124` / `FRMAT`) greys under BOSSA and LAIKA — the app renders it live |
| `b8169728` (§Q3) | 12 `Alteration` cards grey under any Avance / Contino programme (`MPOSKE`, `MPEKE`, `FRAUSR`, `FRAUSRH`, `MPOT`, `MPEZS`, `MPHVERLVE`) |

**Remedy: one more `dev` → `staging` → `main` pass.** Both commits are code-only — no data, no
backfill, no contract change, nothing to re-ingest. The DATA ledger is closed and unaffected.

Confirm afterwards, against prd:

```bash
#  expect BOTH true
GET /design-book/items?category=Panels%20%26%20surround&subcategory=Surround&groupBy=family&programs=244
      → F124 · cardAvailable true                                     # §Q1 landed
GET /design-book/items?category=Alteration&subcategory=Accessory&groupBy=family&programs=410
      → MPOSKE · cardAvailable true                                   # §Q3 landed
```

---

## 4. ⚠️ SEVEN TRAPS — every one cost real time

1. **Never restart the backend mid-sweep.** Cost twice today: Wall+Midway "MEMBER 33 / SECT 33" in
   round 3, and E1's "MEMBER 37 / SECT 19" in §P. Both were ~60 states hitting a dead server; the API
   was right the whole time. Abort, restart, re-run.
2. **A stale in-process pool cache survives an out-of-band backfill.** `poolByFamily()` is cached for
   the process lifetime; only `invalidatePool()` (ingest / item CRUD) clears it. Six ORDER diffs
   vanished on restart with no code change. Any script that writes the collection ⇒ restart first.
3. **Reproduce a sweep diff with the plan's EXACT filters.** `lineState=80` passes where `line=80`
   fails — `lineState` applies no per-unit `$match`. That hid the `maxh` bug for three sweeps.
4. **"It's a bad client sample" is usually wrong.** Round 3 wrote off `Tall|Panels…|progP_BOSSA` that
   way; §O2 re-dumped it and it reproduced byte-for-byte — one real bug with two halves. Three of round
   3's four residual diagnoses were wrong for the same reason: written off without a mechanism.
5. **`grey=true` and `grey=false` are different products.** The app's default is **`grey=false`** and
   that is the mode that matters. Pin it: `__Q.run(filters, {grey:false})`.
6. **`__Q.run()` returns a dump; it does not record one.** Only `__Q.sweep()` writes `RESULTS`, and
   `post()` sends `RESULTS`. A hand-rolled loop + `__Q.post()` uploads `{"data":{}}` and the diff then
   says *"missing on ours: 200"* with all ten buckets 0 — a clean-looking report over nothing, after
   the leg has already run. Keep your own map (the snippet in §1 does).
7. **A CDP timeout does NOT cancel the page promise.** Drive long sweeps fire-and-forget and poll
   `window.__PROG`; never `await` a whole leg in one `javascript_tool` call. Two concurrent sweeps
   interleave and each records the other's grid (`BUSY` now throws, but the first 45 keys of a leg were
   silently wrong once).

---

## 5. The harness, current form

| file | what |
|---|---|
| `scripts/parity/make-plan.js` | writes the plans. `FLAG_STATES` drives `antoso` alongside `susp` (§P4) |
| `scripts/parity/dump-client.js` · `dump-ours.js` | in-page dumpers, same normalized shape |
| `scripts/parity/diff.js` | 10 buckets. `--keep-grey` disables the grey-only normalization |
| `scripts/parity/check-faces.js` | replays a report's FACE diffs against the API |
| `scripts/parity/sink.js` | :8799 — `POST /save?name=` and `GET /js?f=` (CORS-open source server) |
| `plan-{Base,Tall,WallMidway}.json` | 192 / 272 / 256 — the §O legs |
| `plan-{E1,E2,E3,F1,T1}.json` | 264 / 298 / 200 / 90 / 252 — the §P legs |
| `out/client-*.json` | client dumps — **the app never changes, so only our side needs re-dumping** |

⚠️ `diff.js` compares pill labels through `NUM()` (digits only), so `217` and the `217+`
`heightExtension` chip look identical. That merged a real 2-diff into "a duplicate 217" for a whole
round (§O4). Prefer the raw label when a PILLS diff looks like a duplicate.

A leg is ~15 min (200 states) to ~25 min (Tall / Wall+Midway).

---

## 6. Read these first

* **`docs/client-ui-parity-audit.md` §O · §P · §Q** — today. §L/§M/§N are rounds 1–3.
* **`throwaway/frontend-v2.5-changes.md`** — the client's implementation guide. Current, and now opens
  with a **parity-status** section: what is verified 0-diff vs. the sidebar / `grey=true` / `page>1` /
  drawer / `FP_16FRONT` gaps. Hand this over as-is; it names D4K-dev and backend `f61942d8` as the
  required target.
* `docs/design-book-api-ui-map-v2.md` **§2b · §2c-9 · §2c-11 · §2c-12** — sections, the width/face
  rules, the `gridRows` + membership contract.
* `docs/export-schema-v2.ts` — the contract. Its `availableFromCaps` reference port had the FRMAT bug
  the backend inherited (§Q1); it is fixed, and `heightExtension` is marked ADVISORY (§O4c).
