# Manual edits vs the catalogue import — what is left, and what it would take to fix

**Written 2026-08-27**, after shipping the card option-row work (the client's "the buttons only
show in the detail panel" report). Two things live here: the loose ends on that job, and the
larger question it exposed — **a catalogue import silently destroys hand-authored data**, and the
client is already relying on hand-authored data in production.

Everything below was measured against the live databases and the code as it stands on
`origin/main` today. File:line references are `D4K-backend` unless said otherwise.

---

## ⭐ UPDATE 2026-09-02 — option A is BUILT. Read this before the rest.

Section 5's option A shipped, on backend branch `feat/design-book-manual-overrides`. The analysis
below stands; the recommendation at §6 is answered. **Two deliberate departures from the sketch in
§5A**, both of which turned out to matter more than the mechanism:

| §5A proposed | What shipped | Why |
|---|---|---|
| `manualFields: string[]` — the field NAMES a human wrote | **`manualOverrides: Record<string, value>`** — the names AND the values | The re-apply is then one `updateMany` with `$mergeObjects` after the bulk write, instead of an `omit()` per op inside the loop. The seam stops being in the hot path. |
| record "the keys `patchItem` is writing" | record only the keys whose value **DIFFERS from the stored one** | The authoring form reads the item with `expand=all` and PATCHes the whole record back. Recording what it *sends* would pin ~40 fields on the first edit and freeze that item against every future catalogue — the exact opposite of the intent. |

Order matters and is load-bearing: the re-apply runs **after** the bulk upsert and **before** the
missing→inactive sweep (§2d), so a pin cannot resurrect a code the new catalogue drops.

### ⭐ UPDATE 2026-09-04 — run against a real import, and two of this document's assumptions are wrong

The layer had only been driven against a 3-item catalogue. The whole 18,396-item export was then
ingested into D4K-dev through the real `ingestCatalog()`: **18,396 updated, 0 deactivated, 117 s**,
`manualOverrides: {items: 2, reapplied: 2, staleSkus: [], staleFamilyIds: []}`, and the hand-built
card came out byte-identical (`AHS2 · 2 units · Set → 2 Rails* / 3 Rails`, before and after).

Three things it settled:

1. **A merge is only half a hand edit.** §1's option-row job and the merge are the SAME edit — the
   authoring guide's flow is *merge, then give the card its option buttons*. On dev the `AHS`/`AHS2`
   card was pinned on `familyId` + `faceForTiers` and nothing else, so an import would have kept the
   two items together and stripped the `Set` row off the card. Same root cause as the merge case
   (*a pin can only record a CHANGE*), and `fix-hand-merges.js` now has a third pass for every other
   field a hand-touched item differs from the catalogue on.
2. **⭐ §2 is wrong about what an import overwrites.** `normalizeItemDoc` is a passthrough, so
   `$set` of the exported document touches **only the keys the export carries** — a field absent
   from the export survives untouched and needs no pin. Measured: `variantCore`, `faceVariantCore`,
   `faceHeightClass` and `faceWidthMm` are on 0 of 18,396 exported items and came through the
   import unchanged (18,396 / 18,313 / 7,605 / 17,407 both sides). **The "re-run the face backfills
   after an import" step does not exist.** Nor does the import strip `parameters` or
   `functionalGroups` where the export omits them.
3. **`catalogVersion: 'manual'` does not survive an import** — it is re-stamped from the export, so
   dev's manual count went 7 → 0 while the 2 pinned items stayed pinned. `manualOverrides` is the
   durable "a human touched this" marker, which is what the admin chip reads.

**⚠️ One new risk, open.** The authoring form's PATCH round-trip is lossy — it drops null and empty
members and coerces scalars (`carcaseLine` `"80"` → `80`, `capabilities` minus its null keys,
`description` minus an empty `bullets`, `gridHidden` absent → `false`). Before pins that healed
itself at the next import. Now a harmless edit can PIN the degraded value and freeze it against
every future catalogue. `fix-hand-merges.js` skips those four (`ARTIFACT_FIELDS`), but `patchItem`
does not, and the fix belongs in the form. Seen on 4 of dev's 7 hand-touched items.

**What this closes from the sections below:** §2a for touched fields · §2b (`catalogVersion` is still
overwritten, but `manualOverrides` now records what was changed, so nothing is unreconstructible any
more) · §2c (`active`/`deactivatedAt` are pinned like any other field, which also answers the open
decision in the other doc's §6) · the whole §3 risk table.

**What it does NOT close:** **§2d.** A hand-CREATED item is still deactivated by the next import. The
sweep is a separate write that never reads the document, and a new code has nothing pinned. One clause
would fix it — `ingestBatchId: { $exists: true, $ne: batchId }`, sparing only items that were never
ingested — but nobody has hit it yet, and it was left out of the same change on purpose.

**A wrinkle §5A did not anticipate: a pin can only record a CHANGE, so a merge made BEFORE this
existed cannot be pinned by re-asserting it.** Re-applying it — home, then forward again — is what
pins it. `scripts/fix-hand-merges.js` does that, report-only without `--apply`.

**Both clusters were repaired 2026-09-02** (§3's table is now history):

| | dev | prd |
|---|---|---|
| hand merges found | 1 (`AHS`) | 6 (`AHS` + the five `ZGRS*`) |
| pinned | all | all |
| families left with two default faces | 0 (was 1) | 0 (was 1) |
| `backfill-face-{height-class,variant-core,width-mm}` | 0 · 0 · 1 applied | 0 · 0 · 1 applied |

Two of the merges had left their family with **two default `faceForTiers` faces**, because editing
`familyId` by hand does not clear the joiner's face the way the merge tool does. That is also what
made the pending `faceWidthMm` backfill correct rather than merely a write: with one face per family
again, the family's default width is the face's, not whichever unit sorted first.

⚠️ **The pins do nothing until the backend is released.** They are written on both clusters, but
deployed production does not yet have the re-apply code — an import before that release ignores them
and loses the merges anyway.

⚠️ **dev and prd have diverged.** The `ZGRS*` handle-screws merge exists only on prd.

---

## 1. What shipped, and what is left on the option-row job

### Shipped

| | |
|---|---|
| Towel rails fixed on **dev and prd** | `AHS` + `AHS2` are one family (`AC_AHS2`) with `Set · 2 Rails / 3 Rails`; the click swaps the sku |
| Backend `dce06a37` → `main` | lite browse UI routed its variant pills by `variantCore`, a code stem that is identical on every member of these families, so the pill rendered and the click did nothing (§U's disease, one family further on) |
| Frontend `c48f8173` → `main` | the CRM item editor can now author the row: *button group name*, *this item's button text*, *position*, plus a live preview of the real row read from the rest of the family |

The three fields write `familyFacts.variantLabel`, `unitFacts.variantCode` and
`unitFacts.unitIndex` — the only inputs that put buttons on a **card**. `parameters.options`,
which is what the client had filled in, is the **drawer** model and never reaches the card.

### Left open

1. **`dupFamilies` still needs a developer.** An item that appears on two cards keeps a separate
   copy of `unitFacts`/`familyFacts` per membership. The editor shows the block read-only and
   says so, but there is no UI for it. We merged the towel rails' `__SNKDUP` copies by hand.
   Fixing this properly means a repeating sub-form; nobody has asked for it yet.

2. **The export still has the towel rails as two families.** `docs/export-v781-fresh.json` has
   `AHS → AC_AHS` and `AHS2 → AC_AHS2`, both with `variantLabel: null` and `variantCode: null`,
   because the extractor reads the v781 app and the app has them split. A fresh extraction
   reproduces the split. See §5 option B.

3. **One value to verify on prd.** `HSSCUS` carries `capabilities.alwaysAvailable: false` where
   the export says `true`. `alwaysAvailable` short-circuits all eight availability gates, so
   `false` means that item can now grey out where it previously never did. It is the only
   semantic capability difference among the eleven hand-edited items, and it looks like the
   side effect of a save rather than a decision — the same class as the `ARE10036` case already
   documented in the frontend form. Worth confirming with whoever deactivated that item.

4. **The import problem**, which is the rest of this document.

---

## 2. What an import actually does

`POST /design-book/ingest` → `ingestCatalog()` (`design-book.service.ts:353`) →
`upsertItems()` (`:449`). Per item it builds a document with `normalizeItemDoc()` (`:514`) and
pushes one op (`:464-470`):

```ts
ops.push({
  updateOne: {
    filter: { sku: doc.sku },
    update: { $set: doc },
    upsert: true,
  },
});
```

Then `bulkWrite(..., { ordered: false })` at `:477`.

Three consequences, in order of how much they hurt:

### 2a. Every field the export carries is overwritten

`$set` with the whole document. No merge, no comparison, no notion of who last touched a field.
This is deliberate and documented — "extractor wins" (`design-book.controller.ts:452-458`).

A field the export **omits** survives, because there is no `$unset`
(`scripts/strip-legacy-designbook-fields.js:3` relies on exactly this). So the damage is
per-field, not all-or-nothing.

### 2b. The "manual" marker is itself destroyed

`normalizeItemDoc` sets `catalogVersion` from the export's `meta.source` (`:528`, value minted at
`:375`). Hand-authored items are stamped `catalogVersion: 'manual'` by `createItem` (`:554`) and
`patchItem` (`:589`).

**So the first import after an edit both reverts the edit and erases the only evidence there ever
was one.** Nothing can be reconstructed afterwards, and no report can be run to find out what was
lost. The code says so plainly at `:190-195`:

> `// reader tell a hand-authored item apart; does NOT change re-ingest behaviour —`
> `// the extractor still wins`

### 2c. Two fields are forced regardless of the export

```ts
active: item.active !== false,   // :523
deactivatedAt: null,             // :525
```

An item switched off by an admin comes back **on**. This was already logged as an open decision
in `docs/client-feedback-2026-08-20-status-and-browser-verification.md` §6, with one detail
stated the wrong way round: that note says export files "carry no per-item `active`", implying
the field defaults to true because it is missing. It is not missing —
**`docs/export-v781-fresh.json` carries `active: true` on all 18,396 items.** The effect is the
same, but it matters to the fix: you cannot solve this by treating an absent field as "leave
alone", because the field is present and is asserting `true`. (The contract itself,
`docs/export-schema-v2.ts:86`, says `active` is "backend sets it" — the extractor should arguably
not emit it at all.)

### 2d. And a separate write deactivates anything the export does not mention

`design-book.service.ts:486-489`:

```ts
const deactivate = await this.itemModel.updateMany(
  { ingestBatchId: { $ne: batchId }, active: true },
  { $set: { active: false, deactivatedAt: now } },
);
```

Unscoped, and `createItem` never sets an `ingestBatchId` (`:527` is conditional). **Every item an
admin creates by hand is therefore deactivated by the next import**, whatever else happens. Nobody
has hit this yet only because all eleven hand-edited items today are edits to existing codes, not
new ones.

---

## 3. What is at risk right now

Both clusters, queried 2026-08-27. Last ingest on prd was **2026-07-17**, so none of this has been
tested against a real import yet.

| Cluster | Hand-authored items | Deactivated |
|---|---|---|
| D4K-dev | 5 | 0 |
| **D4K-prd** | **11** | 1 |

The prd eleven, diffed field-by-field against `docs/export-v781-fresh.json` (backend-computed
fields such as `variantCore`/`faceVariantCore`/`faceWidthMm` excluded, and null-vs-absent
excluded):

| Item(s) | What a human changed | Survives an import? |
|---|---|---|
| `ZGRS419`, `ZGRS422`, `ZGRS423`, `ZGRS425`, `ZGRS427` | `familyId` → `XAG_Ha_ac0d14_B` — a family the export does not have. Someone **split a handle family** | ❌ all five snap back, `_B` ceases to exist |
| `ZGRS430`, `ZGRS435` | `kind` `cabinet` → `part` | ❌ |
| `ZGRS430` | `availableTiers` `["P"]` → `["P","P1"]` | ❌ |
| `ZGRS422PZ2` | `name` `"Handle screws for"` → `"Handle screws for Handle"` (fixing a truncated name) | ❌ |
| `HSSCUS` | `active: false` + an edited `description` | ❌ both |
| `AHS`, `AHS2` | `familyId`, `unitFacts`, `familyFacts`, `dupFamilies` — the option row | ❌ card row dies |
| `AHS`, `AHS2` | `parameters.options` — the drawer row | ✅ survives, because the export has no `parameters` key for these two |

Dates: `HSSCUS` 2026-08-19, the eight `ZGRS*` on **2026-08-25**, the towel rails today. The client
is actively authoring, roughly weekly, and none of it is protected.

The `ZGRS*` work is the one to notice. Five codes moved into a family the catalogue has never
heard of. That is not a typo fix — it is a deliberate re-shaping of what the app shows, of the same
kind as the towel rails, and it is the whole reason the option-row editor was worth building.

---

## 4. Reproducing this

Nothing here needs a browser.

```bash
# The eleven, and when they were touched
cd D4K-backend
MONGO_URI_OVERRIDE=<prd-uri> node -e '...'   # or use the dev-token API on dev:
curl -s https://dev.api.dash4kitchen.com/design-book/dev-token   # unguarded on dev only

# What the export would write back over the top
python3 -c "import json; d=json.load(open('docs/export-v781-fresh.json')); \
  print([i for i in d['items'] if i['sku']=='AHS'][0]['familyId'])"     # AC_AHS
```

⚠️ Use `MONGO_URI_OVERRIDE=` on the command line for any prd read or write. `.env` must be left
pointing at D4K-dev. The prd URI is line 3 of `D4K-backend/.env`, commented out.

---

## 5. Options

### A. Remember which fields a human set, and skip them on import — *the real fix*

Add `manualFields: string[]` to the item (schema + `UpsertItemDto`, and add it to
`RESERVED_ITEM_FIELDS` at `:199` so an export body can never set it). `patchItem` already knows
exactly which keys it is writing (`:585-592`), so it appends them. Then at the seam — the op
literal, `:464-470` — omit those paths from the `$set`.

One extra query per ingest, not per item:

```ts
// once, before the loop
const held = new Map(
  (await this.itemModel.find({ manualFields: { $exists: true, $ne: [] } },
                             { sku: 1, manualFields: 1 }).lean())
    .map(d => [d.sku, d.manualFields]),
);
// in the loop, at :464
const keep = held.get(doc.sku);
const $set = keep?.length ? omit(doc, keep) : doc;
```

Eleven documents today, so the query is free. `manualFields` is not in the export, so it survives
its own import (§2a).

Two things sit **outside** that seam and need their own line each:

- `active` and `deactivatedAt` are forced inside `normalizeItemDoc` (`:523`, `:525`), before the
  seam is reached. Either move them out, or special-case them.
- The missing-item sweep (`:486-489`) is a second write that ignores the document entirely. Its
  filter needs to exclude hand-created items, or every one of them is deactivated regardless.

Rough size: one afternoon in `design-book.service.ts` plus tests, and a decision about the eleven
backfill scripts under `scripts/` (they write with the raw driver and bypass the service
completely — `backfill-item-fields.js` even `$unset`s fields absent from the export, by design).
Most of them are one-shot historical tools; the honest answer is probably to leave them alone and
document that they ignore manual edits.

**This also fixes the deactivation question in the other doc's §6**, at no extra cost — an admin
switching an item off simply records `active` as a manual field.

### B. Re-apply our own corrections to the export after every extraction — *cheap, partial, available today*

There is already a precedent: `scripts/fix-book-exclusions.js` patches the export with 17
corrections found in the client's price books, and its header says **"⚠️ RE-RUN AFTER EVERY
EXTRACTION"** because the extractor reads the app and the app is the side that is wrong.

The towel-rail merge is the same shape of divergence, and could be a second script in the same
style. That guarantees today's fix survives the next import with no code change and no product
decision.

What it does **not** cover: anything the client authors in the admin UI. They cannot run scripts,
and their edits live only in Mongo. So B protects our work and leaves theirs exposed — which,
given the `ZGRS*` family split, is now the larger half.

### C. Do nothing, and say so in the interface

Add a line to the item editor: *"Catalogue imports overwrite manual changes."* Honest, costs an
hour, and means the `ZGRS*` work has to be redone by hand after every import — and, because of
§2b, redone from memory, since nothing will record what was there.

---

## 6. Recommendation — ANSWERED 2026-09-02: A is built (see the update at the top)

**Do B now and A next.**

B is a one-file script with an existing template, and it makes the thing we just shipped durable
without waiting on a decision.

A is the fix worth making, and the case for it is no longer hypothetical: eleven items on
production, edited across three separate sessions, by someone who has not been told any of it is
temporary. The mechanism is about thirty lines at a seam that is already the single place every
ingested write is expressed. The part that needs a person, not a developer, is the policy:

> **When the catalogue and a human disagree about a field, who wins?**

**Answered: the human wins for fields a human touched, the catalogue wins everywhere else.**

A says the human wins for fields a human touched, and the catalogue wins everywhere else. That is
the behaviour most admin tools have, and it is what the client will assume is already true. The
alternative — catalogue always wins — is defensible too, but then C is the honest version of it and
the interface has to say so.

One thing not to do: leave it as it is *and* keep encouraging the client to author. That is the
current state, and it is the one that loses work silently.

---

## 7. Where things are

- Ingest write path: `D4K-backend/src/design-book/design-book.service.ts:353` → `:449` → `:464`
- The forced fields: `:514-530` (`normalizeItemDoc`)
- The missing-item sweep: `:486-489`
- Manual CRUD: `createItem` `:545`, `patchItem` `:578`, `MANUAL_SOURCE` `:195`
- The option-row editor: `D4K-frontend/src/views/crm-management/components/design-book-item-form.tsx`
  (section 10, `mergeFacts` / `optionRowState`)
- Prior art for option B: `scripts/fix-book-exclusions.js`
- The earlier note on deactivation: `docs/client-feedback-2026-08-20-status-and-browser-verification.md` §6
