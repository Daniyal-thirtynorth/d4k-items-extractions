# LIO — leftovers

Started 2026-09-14, the day the bulk-edit screen and the question box reached `main` (backend
`1239e6bd`, frontend `e569ef7da`). This is the list of what LIO still cannot do, written as
requirements. It sits next to `docs/lio-agent-requirements.md` (R1–R9, D1–D13), which describes what
was built. Numbers here are **L1, L2 …** so they don't collide with those.

---

## L1 — Any question about items must get a right answer

**Requirement.** A designer can ask LIO anything about catalogue items in the Design Book search box.
That includes questions that search by what an item *carries*:

- "find items with these compatible accessories"
- "find me items with Drawer Set 1 in L-Box walnut"
- "which cabinets can take LBNS60581?"
- "which units have the ANSH alteration?"
- "which units are planned together with MPRU?"

LIO answers with a grid of the matching cards, or plainly says it can't. It must never answer a
nearby question instead.

This is R5 ("anything the user types must be handled") made concrete. R5 is not met today.

> **✅ BUILT 2026-09-15 — merged to `dev`** as D4K-backend PR #3125 (`caaa2bd4`). Not yet on
> staging / main. No contract change, nothing to backfill. **The LIO benchmark is
> 41/41** (all 12 cases: the doc's four below plus the eight that were there, so nothing got worse).
>
> - **`GET items?references=`** (exact codes, OR, ≤ 200) over `accessories` / `accessories.sku` /
>   **`accessories.variants.sku`** / `alterations` / `companions`, one shared `$or` builder
>   (`referenceMatch`) that the bulk-edit `targets.referencing` now uses too. API = raw driver on
>   D4K-dev: `LBNS60581` 274 · `LBNS60581U` 245 (only ever a variant — so yes, the M8 code matches)
>   · `ANSH` 10,867 (the raw 10,874 minus `gridHidden`) · `MPRU` 1,628. ANDs with `q` too.
> - **Three departures from "what to build", each forced by a measurement:**
>   1. **`referencesFamily=<familyId>`** instead of "LIO reads the codes off the card": Drawer Set 1
>      walnut is **42 codes** (counting the M8 twins) and `search_items` shows 25, so the model
>      would have handed back a list missing 17 and called it complete. The server expands the card
>      from the cached pool; an unknown family matches nothing. → 1,315 units.
>   2. **`referencesIn` is required, not optional.** `MPRU` is an ACCESSORY on 1,626 units and a
>      COMPANION on 1,596, so "planned together with MPRU" without it is a mix of two answers —
>      the nearby-answer failure again. (For ANSH it is moot: only ever an alteration.)
>   3. **No index.** Measured first, as step 4 says: unindexed, the query examines all 18,396 docs
>      in **~400 ms** on D4K-dev. Left as a `ponytail:` note naming the upgrade (one multikey index
>      per path — Mongo can't compound two array fields).
> - **The face pin was half the fix, again (the `sinkSizeInch` lesson).** With `groupBy=family`,
>   **42 of the 48** `LBNS30581` families would front their default 60 cm cabinet, which carries
>   `LBNS60581` instead. Pinned to the group stage's `memberSkus` (already the matched members, so no
>   new query): 0 of 48 now.
> - **LIO:** the three params + `depthMm` are in `FILTER_PROPERTIES`; prompt rule 9 says "items WITH
>   X" means `references`, never X's own card, and to name the reading when it could be either.
> - **The drawer-set case failed first (2/5), and not because of the filter.** LIO couldn't FIND the
>   card: its label is "Drawer Set 1" and "L-Box in walnut" is its SUBCATEGORY, which `q` does not
>   search (§P5); it also narrowed by `kind:accessory`, and the sets are stored as `kind:"cabinet"`.
>   It said so honestly rather than guessing. Fixed in the `q` and `kind` tool descriptions (search
>   the shortest label phrase, pick by `subcategory`; don't narrow a name search by `kind`) → 5/5.
> - Also: `DEFAULT_MODEL` pinned to `gpt-5.5-2026-04-23` (smaller items, below).
> - Checks: `check-lio.js` (new: the whitelist keeps the four keys; `referenceMatch`'s arms),
>   `check-lio-edits.js` OK, `check-grid-gates.js` identical over 77,760 + 51,840,
>   `check-face-pins.js` 6/6.

### What happens today (tested on dev, 2026-09-14, `gpt-5.5-2026-04-23`)

| Question | What LIO did | Verdict |
|---|---|---|
| *find me items with drawer set 1 in L-box walnut* | Filtered the grid to the Drawer Set 1 card itself (`familyId=ADD_LBNS_LBOXINWALN2`, 1 type) | Right if the user meant the drawer set. **Wrong** if they meant the cabinets that carry it — and nothing in the answer says which reading it took |
| *which cabinets can take LBNS60581?* | "I don't have a live compatibility list of cabinets that reference it" — no grid | Honest, but it does not answer |

**Why.** LIO's search (`search_items`) runs the grid's own `GET /design-book/items`, and that endpoint
has no filter for "items whose accessories / alterations / companions include X". The reverse lookup
exists only inside the admin bulk-edit mode (`targets.referencing` in `src/design-book/lio/lio-edits.ts`),
which the question box doesn't use.

The forward direction already works: `get_item` with `withAccessories` returns what ONE item carries,
so "what accessories fit T6080?" is answerable today.

⚠️ The sink lesson from `lio-agent-requirements.md` applies here: when LIO has no tool that answers a
question exactly, it finds a plausible substitute and states it as fact ("13 types at 900 mm" for a
36″ sink). The first row above is that failure in a milder form. Every kind of question needs a filter
that answers it EXACTLY.

### What to build (backend only)

1. **A `references` filter on `GET /design-book/items`**, for example
   `?references=LBNS30581,LBNS40581,LBNS60581`. It matches items whose `accessories`, `alterations` or
   `companions` include ANY of the codes. Reuse the `$or` that `resolveOperation` in `lio-edits.ts`
   already builds, over `accessories`, `accessories.sku`, `alterations` and `companions`.
   - It **must be a `GET items` query parameter** (in `QueryItemsDto` and `buildItemFilter`), not a
     tool that only LIO can use. Under R3, LIO hands back *filters* and the client re-runs them to
     draw the grid, so a lookup the grid can't run can't be shown.
   - Exact codes, comma-separated, with OR between them and a cap on how many (about 200). No prefix
     matching: "Drawer Set 1" is one set across every width (`LBNS30581`, `LBNS40581`, …) and not a
     prefix, so LIO first reads the codes off the card (`search_items familyId=…`) and then passes
     the list.
   - Decide whether an M8 runner code (`LBNS60581U`) should match the card it sits inside as a variant
     (`accessories[].variants[].sku`). Probably yes: a designer who types the M8 code means that set.
   - Optional: `referencesIn=accessories|alterations|companions` to narrow which list is searched, for
     questions like "which units have ANSH *as an alteration*".
2. **Give LIO the filter.** Add it to `FILTER_PROPERTIES` in `lio.tools.ts`, with a description that
   says when to use it. Add one line to `LIO_SYSTEM_PROMPT`: "items with X / which items take X" means
   filter by `references`, and never answer with the accessory's own card.
3. **When a question could mean two things** (the drawer set itself, or the cabinets that carry it),
   LIO says which one it answered, in one sentence.
4. Measure the query on the real collection (18,396 items). If it's slow, add a multikey index on
   `accessories.sku`, `alterations` and `companions`.

### Other item facts nobody can search yet

The same gap exists for other item fields. They're readable one item at a time (`get_item`), but they
can't be searched across the catalogue. Build these only when a real question needs them. The list is
here so that the next "can LIO answer X?" is a lookup and not a new investigation.

| Item field | Example question | Today |
|---|---|---|
| `appliance` (brand, category, niche size) | "fronts for a 24″ Gaggenau dishwasher" | no filter |
| `handedLR` | "which units come left or right hinged?" | no filter |
| `engineering` (SensoMatic, Tip-Softclose …) | "units that support SensoMatic" | no filter (only `suspended` exists) |
| `depthMm` (exact depth) | "units 460 mm deep" | a filter already exists in `QueryItemsDto` but isn't in LIO's `FILTER_PROPERTIES`. It only needs to be exposed |
| `name` / `description` text | "units with LED lighting" | `q` matches only the sku and the card label (app behaviour, §P5), not names or descriptions. This needs a separate parameter; don't change what `q` does |
| `sinkFitment` | "sink cabinet for a 36 inch sink" | ✅ done (`sinkSizeInch`) |
| `finishes`, prices | "cheapest front in BOSSA" | out of scope (pricing, `lio-agent-requirements.md` §5) |

### How to know it's done

Add these to the benchmark (`D4K-backend/scripts/compare-lio-models.js`). Each case must have **one**
right answer:

- *which cabinets can take LBNS60581?* → grid with `references` including `LBNS60581`, and a count
  that matches a direct database query.
- *find me items with drawer set 1 in L-box walnut* → grid of the cabinets. The answer names that
  reading, and the filter lists every width's Set 1 code.
- *which units have the ANSH alteration?* → `references=ANSH` (plus `referencesIn=alterations` if
  built).
- *what accessories fit T6080?* → still answered from `get_item` (a check that nothing got worse).
- Every code in every answer is still checked against the catalogue (non-negotiable 2).

---

## L2 — A follow-up question must continue the conversation

**Requirement.** After LIO answers in the Design Book search box, the designer can type a follow-up
(*"and in 80 cm?"*, *"why is 68 hidden on the third one?"*) and LIO answers it knowing the previous
question and answer.

### What happened before the fix (was live on prod until 2026-09-15)

The frontend's hook is written for follow-ups: the thread id "survives each answer — a follow-up
typed into the box continues the conversation" (`src/views/design-book/hooks/use-lio.ts:21`). The page
discards it before the question is sent:

1. Each letter typed in the box is a filter change: `onChange={(event) => update({ query: … })}`
   (`src/views/design-book/components/result-bar.tsx:93`).
2. Any filter change that isn't the ask itself calls `resetLio()`, which clears the answer **and**
   the thread id (`src/views/design-book/components/design-book-view.tsx:206`).

So the first letter of a follow-up closes the previous answer, and when Enter is pressed the question
is sent with no `threadId`. It starts a new conversation. The backend handles threads correctly; this
is frontend only. It came in with commit `37e5de26b` (2026-09-07) and reached prod in #2494.

> **✅ FIXED AND LIVE 2026-09-15.** D4K-frontend PR #2496 (`5b33e9f49`) → #2497 (`dev`→`staging`)
> → #2498 (`staging`→`main`, `1a907fad4`); backend #3125 rode #3127 → #3128 (`main` @ `4ed677fd`).
> Checked on the DEPLOYED sites, not by git history: the `/design-book` chunks served by
> `dev.`, `staging.` and `www.dash4kitchen.com` all contain "Ask a follow-up", "Follow-up to" and
> "Answering", strings that exist only after #2496. The text below says what the first cut did; the
> UX paragraph after it is what shipped.
>
> `useLio` gained `hide()` (answer + pending question off screen, thread kept) next to
> `reset()`; the view's effect calls `hide` when **only `query`** changed (`startsOver(prev, next)`,
> exported and tested) and `reset` for anything else. Plus the indicator: a "Follow-up to: *…*" chip
> with a ✕ in the search box while a thread is open and no answer is showing. Two small guards rode
> along: an ask still in flight cannot re-open a thread `reset` just closed (a generation counter),
> and `gridQuery` is `null` unless the panel is active, so a late answer can't take the grid over
> from the substring being typed.
>
> **Verified.** `use-lio.test.ts` (4 tests: ask → hide → ask sends the same `threadId`; ask → reset →
> ask sends none; `startsOver` both ways), the design-book suite 90/90, `tsc` + eslint clean. In
> the real client against a local backend on D4K-dev, with every `lio/ask` body recorded in-page:
> *find a sink cabinet for a 36 inch sink* → sent no thread, got `…59c3` · typed *which of those
> are 80 cm high?* (the chip appeared, the old answer hid) → **sent `…59c3`**, and the answer KEPT
> `sinkSizeInch:36` and added `heightClass:80` · clicked Base › Water → the chip went → *show all
> cooktop units in 80 cm* → **sent no thread**, got a new one.
>
> ⚠️ Testing trap, not a bug: an automation tab reports `visibilityState:"hidden"`, and TanStack
> Query pauses `refetchInterval` on a hidden page, so the answer sits on "Reading the catalogue…"
> though the job finished in 9 s. Firing `visibilitychange` on **`window`** (v5 listens there, not on
> `document`) after overriding `document.visibilityState` releases it. A real, visible tab polls.
>
> **Then made self-explaining (same day, same branch).** The first fix left two problems. Nothing
> said a follow-up was possible until you started typing. And the first keystroke hid the answer and
> substring-searched the sentence ("0 units · 0 types"). Now, while a conversation is open:
> - The box is a **chat box**: typing neither hides the answer nor filters the grid (`gridFilters`
>   in the view). `hide()` is gone.
> - It explains itself: the placeholder reads "Ask a follow-up, or ✕ to start a new search", the
>   button reads "Follow up", and the answer carries "Ask a follow-up in the search box, or ✕ to
>   start over."
> - The cards stay on the conversation's last result while the next answer loads, and when that
>   answer is prose ("why are some greyed?"), because they are what it is about.
>
> **One question at a time**, after two races found in the browser. A follow-up sent before the
> previous ask returned had no thread id, so it began a new conversation. One sent in the second
> between the ask returning and the first poll coming back dropped the earlier answer. `busy` now
> covers both. Enter waits: the button reads "Answering…" and the text stays in the box.
> **Verified in the real client:** sink cabinets → "and in 90 cm?" (13 types) → "why are some of
> them greyed?" (prose; the 13 cards stayed) → "and in 60 cm?" typed mid-answer was held, then sent
> on the same thread → 14 types. 93/93 tests, including both races.
>
> **A Search | Ask LIO switch in the box (2026-09-15, D4K-frontend PR #2501 → #2502 (`dev`→`staging`)
> → #2503 (`staging`→`main`, `e2081395b`)).** Outside a
> conversation the box was still a live search, so a question typed into it emptied the grid a
> letter at a time before Enter. Reported on Base › Storage › Drawer Cabinets @BOSSA · FRONTS P,
> asking "why are these disabled". The box now has a two-way switch, owned by `useLio.asking`:
> - In **Ask** mode the text never filters the grid (`gridFilters`). The placeholder reads "Ask
>   LIO — e.g. why are some of these greyed?" and the button reads "Ask".
> - Asking a question turns Ask mode on. Switching back to Search ends the conversation, because
>   its answer owns the grid. A ✕ or a grid move ends the conversation but keeps the mode.
> - Enter still asks LIO from Search mode.
> - The Welcome "Ask LIO" tile and quick-start chip open the box in Ask mode (the chip used to open
>   Ask the Expert). "Search by Code" opens it in Search mode. The tour switches modes for its
>   two steps.
>
> 95/95 tests (2 new). Verified in the real client: the 24 cards stayed while the question was
> typed, and it was sent and answered on the same grid.
>
> **The answer to that question was wrong: fixed in the prompt (D4K-backend PR #3131 → #3132
> (`dev`→`staging`) → #3133 (`staging`→`main`, `f249628e`)).**
> - **Cause.** With no card open, "these" pointed at nothing. Dev's only curated note ("Why is this
>   cabinet unavailable?" → "T1580 is excluded from BOSSA") matched the words, so LIO explained T1580
>   and blamed it for Storage cards it has nothing to do with. This is the same "BOSSA case from the
>   note" leak seen earlier.
> - **Fix.** Rule 4 now says that "these" with no card open means the greyed cards on screen: find
>   them with `search_items` + `available: false`, then run `explain_availability` on one or two.
>   The curated block says a pair's codes are never the subject of an answer unless a tool returned
>   them.
> - **Verified.** Re-asked on the same screen, LIO found the 4 greyed types (`CT6080ZIS2`,
>   `CT6080ZIZ`, `AT6080SZIS2`, `C1T6080S2Z`) and answered that BOSSA is PRIMO and those are
>   Contino/Avance articles. Benchmark: **60/60 over 19 cases**, including the new `these-greyed`.

**Workaround before the fix (no longer needed):** write each question so it stands on its own. Name the code (*"why is
68 hidden on CTSP10080BZ?"*), or open the card's detail drawer first, which makes "this cabinet" mean
that card.

### What to build (frontend only, about one file)

- In the effect in `design-book-view.tsx`: when the **only** thing that changed is `query` (the text
  in the box), hide the old answer but **keep the thread id**. `useLio` needs a second action next to
  `reset` that clears the exchange and pending question but leaves `threadId` set.
- Everything else stays as it is: a category click, a toolbar pill or the ✕ on the answer panel still
  starts a new conversation. Typing still searches by substring as before.
- Consider showing that a conversation is open (for example "Follow-up to: *find a sink cabinet…*"
  above the box, with a ✕), so the designer knows Enter will continue it rather than start over.

### How to know it's done

- A vitest for the view: ask → type a letter → Enter sends the same `threadId`. Then ask → click a
  category → Enter sends no `threadId`.
- In the browser on dev: *"find a sink cabinet for a 36 inch sink"* then *"which of those are 80 cm
  high?"*. The second answer narrows the first result, and the `POST /design-book/lio/ask` payload
  carries the first answer's `threadId`.

---

## L3 — The other kinds of question (2026-09-15)

**Requirement.** Same as L1, for every other kind of question a designer asks: answer it exactly or
say plainly that LIO can't. Never answer a nearby question instead.

**How it was measured.** Real usage is still thin (prd: 4 exchanges, all bulk edits; dev: ~35
distinct questions, mostly tests), so the question types came from the domain, with those as
seeds. A 40-question probe covering every type went through the real `POST lio/ask`, and each
answer was graded against the catalogue. **First pass: 23 right · 5 honest "can't" · 11 wrong** (1
question was ambiguous). The wrong ones were all the same failure: no tool answered the question
exactly, so LIO found a plausible stand-in and stated it as fact.

| Kind of question | Example | Before | Now | What answers it |
|---|---|---|---|---|
| Handed L/R | "which base units come left or right hinged?" | ❌ the 7 door-cabinet types | ✅ **25** | `handedLR` |
| Appliance niche | "fronts for a 24″ dishwasher" / "a 36″ fridge" | ❌ 15 / 6, found by converting inches to a W pill | ✅ **5 / 1** | `applianceCategory` + `applianceNicheInch` |
| A feature in the description | "cabinets with 2 adjustable shelves in 60 cm" | ❌ 1 type | ✅ **78** | `text` (whole-word, over name + description) |
| "Cannot" in the engineering table | "units that cannot take Tip-Softclose" | ⚪ can't | ✅ **20** | `engineeringNo` |
| NOT available in a programme | "tall units not available in ROCCA 01" | ❌ "53" — a plain count includes greyed cards | ✅ **161** (of 279) | `available:false` |
| Orderable in a toolbar state | "base units that can have the P1 opening" | ❌ 218 (every card, greyed ones included), then 28 (the printed table) | ✅ **212** | `opening:P1` + `available:true` |
| A programme by its bare name | "can I order T6080 in ROCCA?" | ❌ "yes" — "ROCCA" matches no programme (they are "ROCCA 01"…), so it meant *no programme* | ✅ "no", checked in ROCCA 01 and ROCCA-C 01 | unknown names bounce back to LIO with "call list_programmes" |
| Planning notes | "any planning notes for T3080?" | ❌ read the RESTRICTIONS out as planning notes | ✅ "none" (correct) | `get_item` |
| Weight · volume · toe-kick height | "how heavy is T6080?" | ⚪ can't | ✅ 29.4 kg · 0.29 m³ · 945 mm | `get_item` |
| The sizes a card comes in | "what widths does T6080 come in?" | ❌ "just 60 cm" | ✅ 15 – 120 | `get_item` → `sizes` |
| A depth order code, both ways | "code for T6080IS2IZ at 36 cm deep" / "what is T608036IS2IZ?" | ❌ "no separate code" / "not found" | ✅ `T608036IS2IZ` | `sizes.depthCm` + order-code lookup |
| How to order a variant | "how do I order T6080 with P1?" | ⚠️ right, but no code | ✅ "switch OPENING to P1 — no P1 prefix" (single-handle unit) | `get_item` + `buildsCode` |
| System Builder | "what do I need to plan SensoMatic?" | ✅ but 8 lookups, 36 s | ✅ 21 s | `get_item` → `systems` |

Already right before, unchanged after: find by kind/leaf, width, tall height, programme, sink size,
references (L1), counts, programme facts, compare two codes, what an alteration does, app how-to,
a vague request ("something for a corner"), price (correctly declined), off-topic (declined).

**What shipped** (D4K-backend `feat/lio-references`, same branch as L1; no contract change):
- `GET items` filters, each documented in map §2: `handedLR`, `applianceCategory`,
  `applianceNicheInch`, `text`, `engineeringYes` / `engineeringNo`, `available`. All but
  `available` are API narrowing and carry through `q`; `available` filters the grid's own
  `cardAvailable` before the total is taken (`dropHiddenFamilies`), so it is exact, and it is
  ignored without `groupBy=family`.
- `get_item` now carries sizes (and each depth's order code), planning notes, "Modifications — how
  to", weight, volume, toe kick, the variant and any System Builder set. It also resolves an order
  code that isn't stored and says what it was built from.
- Prompt rules 10 (a count includes greyed cards; one unit's orderability is the gate, not the
  printed table) and 11 (a feature, fitting or size must be a filter, never a stand-in).

**⚠️ A regression I caused, caught by the re-probe and fixed.** The first order-code lookup peeled
any P1/C1/V/E/J/depth mutation off a code, and "order it as **P1T6080**" came back confirmed.
T6080 is single-handle, so the app never builds that code. Peeling too far is harmless in a search
(a wrong guess matches nothing) but not in a lookup, which asserts the code exists. `buildsCode()`
now replays `assemble()`'s mutations in its own order, each only where the base item allows it.
When nothing builds the code, the result names the nearest article and never echoes the code, so
the invented-code guard still stops it. Pinned in `check-lio.js`.

**⚠️ The printed Engineering table and the gates disagree, and LIO took the table.** "Opening P1:
yes" is on 3,457 items, the P1 gate (`capabilities.openP1`) is true on 1,501, and they agree on
only 1,091. Given an `engineeringYes: openingP1` filter, LIO answered the P1 question with the
table (28 types; the grid allows 212). So LIO's engineering filters accept **only `tipSoftclose`**,
the one row with no gate behind it; P1/C1 go through `opening` and suspended through `antoso`, both
with `available:true`. The API keeps all three keys. **Which source is right for P1 is a data
question for the client**; the grid follows the gate.

**Left out on purpose:**
- **Catalogue page.** One `catalogPage` number serves two PDFs (the open item below), so LIO would
  be confidently wrong for C/A-tier codes. It says it doesn't have the page.
- **Handle finish names.** The data carries finish codes (032, 100, 277 …), not names. LIO says so.
- **Search by restriction text** ("units that can't take handle 605"). 196 distinct phrases, and
  nobody has asked yet. Build it when someone does, as a separate filter (it means "can NOT").
- **Price.** Out of scope (`lio-agent-requirements.md` §5). LIO declines correctly.

**Verification:** the filters vs the export's own counts, 13/13 (handed 25 · 36″ fridge 1 · DW 5 ·
"3 drawers" 1 · LED 63 · no Tip-Softclose 20 · `available` live + greyed = all). The failed and
declined questions were re-probed and every one is now right (plus "which tall units can be installed
suspended?" → 16, via `antoso` + `available`). The benchmark grew 12 → 18 cases (handed, fridge niche,
a feature, not-available-in, a depth order code, can-have-P1) and scores **57/57**.
`check-lio.js` covers the new keys and `buildsCode`; `check-grid-gates.js` is still identical over
77,760 + 51,840.

---

## Smaller open items from the bulk-edit release

Not requirements yet. They're written down so they don't get lost.

- **A real Save has never been pressed** on the bulk-edit screen, on any environment. It was driven up
  to the confirm dialog and cancelled. Do the first one on dev with one item, then check the item's
  **pinned** chip in the Items tab.
- **"Only Drawer Set 1" can't be added in bulk.** A `series` operation adds every set in the series
  (Set 1–4) at each item's size. The client guide says so. Removing works per code; adding per set
  does not.
- **React #418 (hydration mismatch) on `/crm-management`.** It appears on the deployed dev build on
  every tab, including Programmes, but not on `/dashboard`, and not in a local `next dev` of the same
  code. Probably not LIO: the role gate renders the same on the server and on the first client render.
  One guess, not checked: a date or time rendered on a server that runs in UTC.
- **The catalogue page link can open the wrong book.** One `catalogPage` number serves two PDFs with
  different page numbers. `T6080` (tiers P and C) opens Avance·Contino page 259, which is a different
  product. Deliberately left for later (2026-09-14).
- **Ask LIO from inside the item form**, for changing one item with automatic sizing. Today a single
  item goes through the bulk-edit screen with its code named.
- ~~**The model is pinned only by env**~~ ✅ 2026-09-15: `DEFAULT_MODEL` is `gpt-5.5-2026-04-23` in
  code too (`lio.service.ts`, on `feat/lio-references`), so an environment without
  `OPENAI_LIO_MODEL` no longer follows the `gpt-5.5` alias.
- **Two jobs failed with "server restarted mid-answer"** on the first live bulk-edit run on dev
  (2026-09-14). They didn't happen again and the clocks agreed. Unexplained. If it shows up again,
  check the job reaper's timing before anything else.
- **The client guide `docs/guide-lio-bulk-edits.md` is written but not committed.** It describes the
  screen now on prod.
