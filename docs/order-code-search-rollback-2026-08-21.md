# Order-code search — what it is, and how to undo it

Written 2026-08-21. Covers D4K-backend commit **`b417a178`**, branch
`feat/design-book-order-code-search`.

**Released to production the same day.** PR **#3048** → `dev` (`e11fe46f`),
**#3049** `dev` → `staging` (`3203a3f1`), **#3050** `staging` → `main`
(**`3daa6300`**). `git log origin/main..origin/dev` is empty, and both
`orderCodeBases` and `scripts/check-order-code-search.js` were read out of
`origin/main` rather than trusted from the commit history.

⚠️ #3050 also promoted `b0d2bfe4` "Count a chat as unread only for the people it
was sent to" — another developer's change that was already queued on `dev`.
Reverting the search change does **not** touch it.

Read this if someone wants the change gone, or wants to know what it touched
before deciding.

---

## 1. What it does, in one paragraph

Pasting an **order code** into the Design Book search used to return "No units
match these filters." An order code is the string the app *builds* when you
click pills and hit copy — `T506636` is the article `T5066` with the 36 cm depth
spliced into the middle of its code. It is stored nowhere, so search could not
find it. Search now peels the mutations back off and looks for the article
underneath as well, and faces the card on it.

**It is an enhancement, not a bug fix.** The item genuinely does not exist. The
client's own `leicht_units__781_.html` returns nothing for `T506636` either —
its search is `b.units.some(u => u.c.includes(q))`. We diverged from that file
on purpose, because our app is the thing that handed the designer a code it
could not then find.

---

## 2. What changed

Two files, both in **D4K-backend**. Nothing else — no data, no schema, no
contract, no re-ingest. `schemaVersion` stays 2.5.4.

| File | What |
|---|---|
| `src/design-book/design-book.service.ts` | `orderCodeBases()` + `peelOrderCode()` + `searchPin()`; one extra `$or` clause in `buildItemFilter`; one extra clause in `searchRank`; the `search` pin in `pinFacePool` and its field on `FacePins` |
| `scripts/check-order-code-search.js` | new — 7 groups of assertions, pure function, no Mongo and no network |

The five mutations it peels, all from `assemble()` (`leicht_units__781_.html:2419`):

| Typed | Peels to | Mutation |
|---|---|---|
| `T506636` | `T5066` | depth class spliced into the digit run |
| `H60146IZ4E` | `H60146IZ4` | trailing `E`, one-piece front |
| `T6080J` | `T6080` | trailing `J`, line-86 joint |
| `P1T3080S` | `T3080S` | `P1` / `C1` opening prefix |
| `VT6080` | `T6080` | `V` vertical grip prefix |

Line-66 is deliberately **not** peeled: it replaces the whole code (`u.Yc`), and
all 11 of those are stored articles the ordinary match already finds.

---

## 3. Undoing it

### 3.1 The whole thing, cleanly

`b417a178` is self-contained. Reverting it restores the previous behaviour
exactly — there is no data to unwind and nothing else depends on it.

```bash
cd D4K-backend
git checkout dev && git pull
git checkout -b revert/order-code-search
git revert b417a178          # or the squash-merge commit, if it was squashed
npm run build
node scripts/check-search-rank.js      # must still pass — it predates this work
node scripts/check-face-pins.js        # needs a local server on :8000
git push -u origin revert/order-code-search
```

Then the usual chain: PR into `dev`, then `dev` → `staging`, then
`staging` → `main`.

⚠️ **Find the right sha first.** If the PR was squash-merged, `b417a178` is not
on `dev` — the merge produced a new commit. Locate it with:

```bash
git log --oneline dev --grep "order code was built from"
```

### 3.2 Just switching the behaviour off, keeping the code

If the peeling itself is fine but you want the search back to exactly what it
was, one line does it. In `design-book.service.ts`, in `orderCodeBases`:

```ts
export function orderCodeBases(term: string): string[] {
  return [];        // ← order-code search disabled
  ...
}
```

Everything downstream is guarded on `bases.length`, so an empty list turns off
the extra `$or` clause, the `searchRank` bump and the face pin together. The
check script will fail loudly, which is correct — it is asserting the feature.

### 3.3 Undoing only the face pin

The pin is the half that makes the card show the code you typed rather than the
family's default. If searching should find the article but face it normally,
delete the `pins.search?.bases.length` block at the end of `pinFacePool` and the
`search: searchPin(query.q)` line in `facePins()`. Search still finds
`T506636` — it just answers with `T6047 · Floor unit`, the family face.

---

## 4. What to check after undoing

```bash
cd D4K-backend && npm run build
node scripts/check-search-rank.js       # 4 groups — the 2026-08-20 ranking work
node scripts/check-grid-gates.js        # 77,760 + 51,840 combinations
node scripts/check-face-pins.js         # 6 assertions, needs a server on :8000
```

Then, against a running backend:

```
q=T506636   -> empty            (the old behaviour, restored)
q=TSP       -> 31 families      (must NOT change — this is the app's own number)
q=63        -> CMU6063SZ, AMU6063T, AMO6063T first
```

`q=TSP` returning 31 is the load-bearing one. If it moves, something other than
this feature moved with it.

---

## 5. Why you might want to undo it

Written down honestly, so the decision can be re-made later without redoing the
analysis:

- **It is a divergence from v781**, and v781 is what the parity harness treats as
  the source of truth. Today it is invisible to that harness — every term the
  sweeps drive (`''`, `HWS`, `TSP`) peels to an empty list, asserted by name in
  the check. If a future plan adds a search term that *is* an order code, expect
  a diff there and treat **ours** as the correct side.
- **It cannot be exact, in principle.** `assemble()` destroys information: a
  trailing `E` might be a one-piece front or the last letter of the article's own
  name. This is a heuristic with exact sku matching as its safety net, not an
  inverse function.
- **The `V` prefix rule is the loosest of the five** — any code starting with `V`
  plus a letter peels. It produced only correct results on this catalogue; it is
  the first rule to re-check after a catalogue update.

### Measured, so nobody has to re-measure

Over all 18,396 stored codes, 3,987 peel onto another stored sku:

- **3,727 are same-family** — the same card either way, invisible
- **260 cross a family**, and reading them they are *correct* peels landing on
  the real base article (`VHFR13520458FHE` → `HFR13520458FH` strips the grip and
  the front; the base is simply filed in its own family)

---

## 6. Deliberate behaviour, not gaps

Two things it does not do, both on purpose. Do not "fix" either without reading
this first.

- **The card arrives on its native depth with no pill pre-selected.** An order
  code identifies the *article*, not the *configuration*. Restoring the pills —
  the depth pick, the `E`/`J` line chips, `P1`/`C1` — is client-side card state
  and a product call about how much of a pasted code should be replayed.
- **The depth peel does not check the article offers that depth.** `T506648`
  returns the `T5066` card whether or not 48 cm exists on it, and the card's own
  D row then shows which depths do. Gating this on
  `capabilities.depthClasses` was considered and rejected: it would return
  *nothing* for a near-miss, which is the behaviour this whole change exists to
  remove.
