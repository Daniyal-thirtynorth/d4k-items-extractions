# Grid-parity session handoff — 2026-07-29 (start here tomorrow)

Continues `parity-session-handoff-2026-07-28.md`. That day built the harness, found the 10 root
causes (audit §L) and shipped `gridRows`. **This day closed round 2 (§M) and round 3 (§N) and got the
sweep to essentially zero.** Findings live in `docs/client-ui-parity-audit.md` **§M** and **§N**; this
file is the operational state.

Everything below is **committed and pushed** — backend `dev`, extraction `main`. Nothing is dangling.

---

## 0. WHERE WE LANDED — the numbers

Final sweep, **720 toolbar states**, `grey=false` (the app's DEFAULT mode — see the trap in §4):

| bucket | Base (192) | Tall (272) | Wall+Midway (256) |
|---|---|---|---|
| MEMBER | **1** | **1** | **0** |
| FACE | 0 | 0 | 0 |
| CODE | 0 | 0 | 0 |
| GREY | 0 | 0 | 0 |
| SECT | 0 | **1** | 0 |
| ORDER | 0 | **6** → *fixed after the sweep, verified by hand* | 0 |
| ROWSET | 0 | 0 | 0 |
| PILLS | 0 | **2** | 0 |
| STATE | 0 | 0 | 0 |
| GREY_NOT_HIDE | 0 | 0 | 0 |

Reports: `scripts/parity/out/report-{Base15,Tall9,WallMidway9}.json`.

For scale, the §L baseline on Base alone was ROWSET 402 · STATE 305 · FACE 274 · MEMBER 133 · GREY 123
· SECT 110 · PILLS 76.

### The four remaining items, and why each is left

| # | where | what | why not fixed |
|---|---|---|---|
| 1 | Base MEMBER 1 | `ADD_KSSET_TILTPROTEC__CKDUP` shows for us under BOSSA, not in the app | That dup family's single unit carries `u.fam = "ADD_KSSET_TILTPROTEC__CKDUP"` — the FAMILY ID, not a tier letter — so the app's `tierHas(b,'P')` is false and the v319 gate hides it. Our gate reads `capabilities.nativeTier`, a real `'P'`. The fix is to test `unitFacts.tier` in the tier gate, which is the gate that already took three iterations to stabilise (`availableTiers` → `nativeTier`, which itself fixed 6 Appliance-housing families). One card in one state — not worth the regression risk at the end of a session. **See §5 for the exact change if you want it.** |
| 2 | Tall MEMBER 1 + SECT 1 | `Tall\|Panels, Fillers & Surrounds\|progP_BOSSA` | **Bad client sample, not a discrepancy.** That one dump has NO section headers at all, a scrambled card order, and a family (`F224`) that appears in no other state — a partial/mid-render DOM capture. Re-dump just that state to clear it. |
| 3 | Tall PILLS 2 | `F1780`/`F1782` @LAIKA/ROCCA — the app's H row reads `154 190 204 217 217`, **two** 217 pills; we emit one | Matching it means deliberately emitting a duplicate pill. Looks like an app bug. **Ask the client before porting it.** |
| 4 | Tall ORDER 6 | the `maxh` sort tiebreak | **FIXED after the sweep** (`9dc6a834`) and verified by hand on all six cases — but not re-measured by a sweep. First thing tomorrow: re-run the Tall leg and confirm 6 → 0. |

Plus the two carried over from earlier: the tall `Line` row CLICK (renders, not wired — do only if the
client asks) and the §G family-level membership gap (SNK8-type, deferred since round 1).

---

## 1. START HERE — first 20 minutes

```bash
# A. three servers
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction/data-from-client && python3 -m http.server 8777
cd /Users/apple/Documents/thirtynorth/node-js/d4k-items-extraction && node scripts/parity/sink.js scripts/parity/out
cd /Users/apple/Documents/thirtynorth/node-js/D4K-backend && npm run build && node dist/main.js

# B. sanity — the round-3 fixes, all verified by hand at log-off
curl -s localhost:8000/design-book/dev-token >/dev/null && echo backend-up
#  Tall Panels @LAIKA (programs=410) and @ROCCA (701) → 28 families EACH (app: 28)
#  Wall › Corner @LAIKA → F93 present, F106 absent;  @ROCCA → the reverse   (6 cards either way)
#  Tall Panels section order @line80 → Tall End Panels · Tall Fillers · Tall Blenders ·
#     Tall Corner Blenders · Tall Angle Blenders · Wall Blenders · Rear Panels in Front Finish ·
#     Carcase Side Extension · Tall Visible Carcase Side · Support Panel with Plinth
```

**Then: TASK 1 — re-run the Tall leg** to confirm the `maxh` fix took ORDER 6 → 0. That is the only
unmeasured change. Wall+Midway and Base do not need re-running (the fix only moves families with no
`pri`, and both legs were already 0 on ORDER).

### Task board

| # | task | state |
|---|---|---|
| — | harness · §L baseline · `gridRows` · 2.5.0 facts | ✅ done 07-28 |
| — | round 2 (§M) — `gridHidden`, `dupFamilies`, family gates, `cardAvailable`, `_selUnit` face | ✅ done 07-29 |
| — | round 3 (§N) — sectionRank key, single-sub guard, `rawSub`, v98 sibling swap, `maxh` | ✅ done 07-29 |
| — | full `grey=false` sweep, all three legs | ✅ done 07-29 |
| — | docs: audit §M+§N · map §2c-12 · contract 2.5.3 · CLAUDE.md · frontend guide | ✅ done 07-29 |
| — | commit + push both repos | ✅ done 07-29 |
| **1** | re-run the **Tall** leg → confirm ORDER 6 → 0 | ⬜ **next** |
| **2** | re-dump the single `Tall\|Panels…\|progP_BOSSA` client state, clear the MEMBER 1 / SECT 1 | ⬜ open |
| **3** | **D4K-prd backfills** — data-only, safe before deploy. Now also `sectionRank` + `familyFacts.rawSub` | ⬜ open — see §3 |
| **4** | Base MEMBER 1 — the `u.fam`-is-a-family-id dup (§5) | ⬜ open, low value |
| **5** | Tall PILLS 2 — duplicate `217`; **ask the client first** | ⬜ blocked on client |
| **6** | tall `Line` row click | ⬜ open — only if the client asks |
| **7** | perf pass — member scans + the membership `$unwind` + the pool cache | ⬜ open |
| **8** | frontend work — `throwaway/frontend-v2.5-changes.md` is current, incl. the authoring-dialog gaps | ⬜ handed off |

---

## 2. What shipped today (all committed)

### `D4K-backend` — branch `dev`, pushed

| commit | what |
|---|---|
| `53fbbc25` | card membership + the last grid-row rules (`gridHidden`, `dupFamilies`, `heightCodeNull`, `dv \|\| 58`) |
| `603fd853` | `tierHas` reads `nativeTier`; `cardSys`; an empty `gridRows` is an answer |
| `973f800b` | lite UI: grey-don't-hide switchable (`window.__GREY`) — this is what exposed the whole `grey=false` blind spot |
| `2d9a8bb7` | `heightExtensionOk` — the "217+" chip is a FAMILY question |
| `829f6c6a`, `8c30f923` | admin UI: author the 2.5.x + card-order fields |
| `57ac250e` | `catalogRank`/`sectionRank`/`familyIndex` need `@Prop`s |
| `eeaf2da9` | pick the card FACE with the app's `_selUnit` |
| `ed492da8` | per-family `unitFacts`, pool order (`unitIndex`), and two ref/row gaps |
| `1b630eee` | depth membership is FAMILY-level; no phantom `—` section header |
| `8c760e22` | section order — `sectionRank` keyed by `subDisp`, + the app's single-sub guard |
| `7182a04b` | raw-sub tier exemption + the **v98 sibling-family swap** |
| `ab36b485` | admin: `familyFacts.rawSub` |
| `9dc6a834` | `familyMaxHeightMm` from the unfiltered pool |

### `d4k-items-extraction` — branch `main`, pushed

Export patched to **schemaVersion 2.5.3** (`.gz` committed, raw `.json` gitignored); extractor emits
everything so a **re-ingest is safe**; harness gained `check-faces.js`; audit §M + §N; contract,
map, CLAUDE.md, the three client guides and `throwaway/frontend-v2.5-changes.md` all updated.

---

## 3. DATA LEDGER — what each store owes

Contract **2.5.3**. Collection `designbookitems`, 18,396 items everywhere.

| field | export | D4K-dev | D4K-prd | source |
|---|---|---|---|---|
| `unitFacts` (incl. `unitIndex`, `heightCodeNull`) | ✅ | ✅ | ❌ **owed** | export (extractor) |
| `familyFacts` (incl. **`rawSub`**, 2.5.3) | ✅ | ✅ | ❌ **owed** | export (extractor) |
| `gridHidden` (57) | ✅ | ✅ | ❌ **owed** | export |
| `dupFamilies` (74 items / 79 entries) | ✅ | ✅ | ❌ **owed** | export |
| `sectionRank` — **re-captured today, 78 families changed** | ✅ | ✅ | ⚠️ **STALE — owed** | export |
| `faceWidthMm` | — | ✅ | ❌ **owed** | backend backfill only |
| `faceHeightClass` · `faceVariantCore` · `variantCore` | — | ✅ | ✅ | backend backfill only |
| `heightCode` · `catalogRank` · `familyIndex` · `capabilities` · `faceForTiers` · `doorLineYCode` · `heightExtension` · `parameters.*.showUnderLine` | ✅ | ✅ | ✅ | export |

⚠️ **`sectionRank` on prd is now WRONG, not merely absent** — it carries the old bad capture. It was
correct-looking before, which is exactly why it needs saying out loud.

```bash
# CLOSE THE PRD GAP (data-only; the deployed prd code ignores these fields, so this is safe pre-deploy)
cd /Users/apple/Documents/thirtynorth/node-js/D4K-backend
#   .env line 2 = D4K-dev, line 3 = the commented D4K-prd URI. Swap, run, swap back.
node scripts/backfill-item-fields.js ../d4k-items-extraction/docs/export-v781-fresh.json \
     --fields unitFacts,familyFacts,gridHidden,dupFamilies,sectionRank            # dry run first
node scripts/backfill-item-fields.js ../d4k-items-extraction/docs/export-v781-fresh.json \
     --fields unitFacts,familyFacts,gridHidden,dupFamilies,sectionRank --apply
node scripts/backfill-face-width-mm.js ../d4k-items-extraction/docs/export-v781-fresh.json --apply
#   the raw export is gitignored — `gunzip -k docs/export-v781-fresh.json.gz` first if it isn't on disk
```

**After ANY re-ingest** (either cluster) re-run the four backend-computed fields the export does NOT
carry: `backfill-face-height-class.js`, `backfill-face-variant-core.js`, `backfill-face-width-mm.js`,
and whatever writes `variantCore`. Everything else is in the export.

---

## 4. ⚠️ FIVE TRAPS — every one of these cost real time today

1. **Never restart the backend mid-sweep.** A rebuild+restart during the Wall+Midway leg made ~60
   states hit a dead server and produced a spectacular-looking "MEMBER 33 / SECT 33" regression. The
   API was right the whole time. Abort the sweep, restart, re-run.
2. **A stale in-process pool cache survives an out-of-band backfill.** `poolByFamily()` is cached for
   the process lifetime and only `invalidatePool()` (ingest / item CRUD) clears it. Six ORDER diffs
   vanished on restart with no code change because the pool predated a backfill. **Any script that
   writes the collection directly ⇒ restart the backend before measuring.**
3. **Reproduce a sweep diff with the plan's EXACT filters.** A hand-check with `lineState=80` passed
   while the sweep's `line=80` failed — `lineState` applies no per-unit `$match` and `line` does. That
   difference hid the `maxh` bug for three sweeps.
4. **A client dump can be a bad sample.** No section headers + scrambled order + a family seen in no
   other state = a mid-render capture, not a discrepancy. Sanity-check the state against its neighbours
   before chasing it.
5. **`grey=true` vs `grey=false` are different products.** The lite UI hard-coded `grey=true` for
   weeks, so the family HIDE gates never fired in any sweep and `SECT`/`GREY_NOT_HIDE` had never been
   honestly measured. `window.__GREY=false` before `__Q.sweep(...)`. **The app's default is
   `grey=false`** — that is the mode that matters.

---

## 5. The Base MEMBER 1 fix, if you want it

`ADD_KSSET_TILTPROTEC__CKDUP` under BOSSA. Root cause confirmed in the app:

```js
// v781, in the app tab:
tierHas(FAMS.find(f => f.id === 'ADD_KSSET_TILTPROTEC__CKDUP'), 'P')   // → false
//   because its one unit has  u.fam === 'ADD_KSSET_TILTPROTEC__CKDUP'  (the family id!)
//   so `u.fam === 'P' || u._ag` fails and blockVisible's v319 gate hides the card.
```

Our programme-tier gate (`buildItemFilter`, the `else if (programTiers.length)` branch) matches
`capabilities.nativeTier`, which for this unit is a normal `'P'`. To follow the app exactly, the
programme branch should ALSO require `unitFacts.tier` to be the letter, null, or absent:

```ts
tierMatch = { $and: [
  { 'capabilities.nativeTier': programTiers.length === 1 ? programTiers[0] : { $in: programTiers } },
  { $or: [
      { 'unitFacts.tier': programTiers.length === 1 ? programTiers[0] : { $in: programTiers } },
      { 'unitFacts.tier': { $in: [null, ''] } },
      { 'unitFacts.tier': { $exists: false } },
  ]},
]};
```

For every real unit `unitFacts.tier === capabilities.nativeTier`, so the extra clause is a no-op; it
only bites where `u.fam` is junk. **Verify first** that the dup membership's `$unwind` swaps
`unitFacts` to the dup's own record BEFORE the final `$match` in `familyGroupStages` — if it does not,
this reads the PRIMARY family's `unitFacts` and the clause does nothing. Then re-run the **Base** leg;
do not ship it on a hand-check, this gate has broken things twice before.

---

## 6. Environment + harness (unchanged from yesterday)

Servers, dumper injection and the file table are in `parity-session-handoff-2026-07-28.md` §1–§2 —
still accurate. Two additions from today:

* `scripts/parity/check-faces.js` — replays a report's FACE diffs straight against the API and counts
  `match app` / `still off` / `card gone`. `node scripts/parity/check-faces.js report-Base11 plan-Base`.
* the plans are `scripts/parity/plan-{Base,Tall,WallMidway}.json` (192 / 272 / 256 states) and the
  client dumps `out/client-{Base,Tall,WallMidway}.json` are still valid — **the app never changes**, so
  only our side needs re-dumping.

Running a leg, current form (tab B = our lite UI):

```js
(0,eval)(await fetch('http://localhost:8799/js?f=dump-ours.js').then(r=>r.text()));
window.__GREY = false;                                   // ⭐ the app's default mode
const plan = await fetch('http://localhost:8799/js?f=plan-Tall.json').then(r=>r.json());
__Q.clear(); __Q.sweep(plan).then(() => __Q.post('Tall10'));
```
```bash
node scripts/parity/diff.js scripts/parity/out/client-Tall.json \
     scripts/parity/out/Tall10.json scripts/parity/out/report-Tall10.json
```

A leg is ~15–20 min (Base) to ~20–25 min (Tall/Wall+Midway).

---

## 7. Read these first tomorrow

* **`docs/client-ui-parity-audit.md` §N** — today's round 3: the four causes, the two harness traps,
  the residue table. §M is round 2.
* **`throwaway/frontend-v2.5-changes.md`** — the client's implementation guide, current as of tonight.
  Re-verified against frontend `origin/dev` (`25b19af9`, unchanged) and updated for every backend
  change since: R9b (the v98 collapse), the retired `gridRows`/refs caveats, and Step 7 — the
  authoring dialog is missing **every** contract field from 2.3 onward, including `showUnderLine` on
  the W/H rows, which means an edit through it silently drops that field today.
* `docs/design-book-api-ui-map-v2.md` **§2c-11/§2c-12** — the `gridRows` + membership contract.
* `scripts/parity/out/report-{Base15,Tall9,WallMidway9}.json` — the final diffs.
