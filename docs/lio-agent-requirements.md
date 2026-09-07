# LIO — "Leicht Intelligent Opus" · requirements

Requirements capture only. No design decisions locked yet; open questions are listed at the bottom
and need answers before implementation starts.

Doc lives here (`d4k-items-extraction/docs/`, the spec workspace); the code lives in **D4K-backend**
on branch `feat/design-book-lio-agent` (cut from `origin/dev` @ `6f24d574`, fast-forwarded to
`ff4f3b3f` on 2026-08-10).

## ⭐ IMPLEMENTATION STATUS — first cut built 2026-08-10, verified end to end

Everything below is implemented and driven against D4K-dev. **Additive only** — no existing
endpoint, response shape or grid behaviour changed (see "the one refactor" below).

**ONE endpoint answers every question** (R1/R2/R5): `POST /design-book/lio/ask`. There is no mode
flag, no search endpoint and no separate "why is this unavailable" endpoint — "show all cooktop
units in 80 cm" and "why is Avance unavailable?" are the same call and the agent classifies the
question itself. It returns a job id (D5); `GET /design-book/lio/exchanges/:id` polls it.

| File (D4K-backend `src/design-book/`) | What it is |
|---|---|
| `lio/lio.controller.ts` | `POST lio/ask` (multipart-capable) · `GET lio/exchanges/:id` · `GET lio/threads/:threadId` · `POST lio/exchanges/:id/flag` · ADMIN `GET lio/flags`, `PATCH lio/flags/:id`, `GET/POST/PATCH/DELETE lio/knowledge` (RolesGuard, Master Admin + Admin — D10) |
| `lio/lio.service.ts` | The agent loop (plain OpenAI SDK, Responses API — D2), the job lifecycle, PDF upload, the R9 flag/correction flow, the stale-job `@Cron` reaper |
| `lio/lio.tools.ts` | The 6 tools. **Read-only by construction** (non-negotiable 4): every one routes to a `GET`-shaped `DesignBookService` method, so no prompt can reach a write |
| `lio/lio.prompt.ts` | The system prompt (screen vocabulary, "never invent a code", "never derive a rule") |
| `lio/schema/lio-exchange.schema.ts` | ONE doc = the job + the R9 exchange record + the flag |
| `lio/schema/lio-knowledge.schema.ts` | The curated Q&A store + a Mongo text index (D8 retrieval) |
| `design-book.grid-rows.ts` | **The one refactor:** `unitAvailable`/`cardAvailable` now derive from new `unitGates()`/`cardGates()`, which report each gate separately. Same booleans — a second copy of the rules is exactly how the FRMAT bug shipped (§Q2), so there is only ever one |
| `design-book.service.ts` | `explainAvailability()` (R6, both layers in one call) + `existingSkus()` (the invented-code check) |
| `design-book.controller.ts` | `GET items/:sku/availability` — the reason API. **Not a second question endpoint**: it is structured data, and the agent calls it as a tool |

**Tools:** `search_items` · `get_item` · `explain_availability` · `list_programmes` ·
`browse_navigation` · `answer` (terminal — every turn ends with exactly one call to it).

**The two guarantees are enforced in code, not by the prompt** (`applyAnswer`):
- the agent's `filters` are validated against `QueryItemsDto` and then **re-executed by us**;
  `resultSummary` is written from OUR run, never from what the model claims it saw (R3/D1). An
  invalid filter set is bounced back to the model with the validation errors for one repair round.
- every code-shaped token in the answer text is checked against the collection; an unknown one
  bounces the answer (non-negotiable 2).

**Verified live** (D4K-dev, real model, real catalog):
- search mode — "Show all cooktop units in 80 cm" → `browse_navigation` → `search_items` →
  `mode:"query"`, `filters {category:Base, leafId:"b_cook#0", widthMm:800, groupBy:family}`,
  `resultSummary {total:7, types:7, skus:[TK8080BZ2 …]}`. No cards on the wire.
- prose mode — "Why is this cabinet unavailable?" with `context {sku:T1580, programs:[244]}` →
  called `explain_availability` → "not available in the selected programme … pick a different
  programme in the PROGRAMME picker". Matches the documented BOSSA case exactly.
- the R8/R9 loop, end to end — flag → admin queue → admin correction → curated pair → the SAME
  question re-asked now answers **"T1580 is not available in the BOSSA programme"**, naming the
  programme as taught, with `knowledgeIds` recording which pair it used.
- PDF (R4) — the 1,033-page price book is refused with a clear message; a 13-page PDF is read as
  PAGE IMAGES, and the code it found (`TK6080BZ2`) was **looked up in the live catalog** and
  answered with live dimensions rather than repeated from the document.

**Regression evidence:** `scripts/check-grid-gates.js` re-states the pre-refactor `unitAvailable` /
`cardAvailable` as an oracle and sweeps them — **identical over 77,760 + 51,840 combinations**;
`scripts/check-lio.js` covers the filter whitelist, the invented-code guard and the PDF page count;
the existing `scripts/check-face-pins.js` is **6/6**.

**Config:** `OPENAI_API_KEY` (already present in `.env`), optional `OPENAI_LIO_MODEL` (default
**`gpt-5.5`** — must stay vision-capable, R4) and optional `OPENAI_LIO_REASONING_EFFORT` (default
`low`, sent only to the gpt-5 / o-series models). `openai@^7` is the one new dependency.

### The model pick, and prompt caching (2026-08-10)

A turn makes up to 8 model calls, each re-sending the conversation so far, so the request PREFIX
is most of the bill. It is now stable by construction: `LIO_SYSTEM_PROMPT` is a **constant** and
the volatile half — toolbar, focused sku, curated pairs — moved into the user message
(`lioContextBlock`). Measured cache hit on a 5-question suite: **50-90 % of input tokens**.

`scripts/compare-lio-models.js` runs a fixed 5-question suite through the REAL `lio/ask` endpoint
and scores the two things a model can actually get wrong here — which tool it reaches for and
which filters it builds (the facts are re-executed and re-checked server-side either way). Results
(`out/lio-model-comparison.json`, one server boot per model):

| model | checks | input tok | cached | out | reasoning |
|---|---|---|---|---|---|
| gpt-4o | 16/16 | 56,404 | 74 % | 469 | 0 |
| gpt-4.1 | 16/16 | 93,261 | 90 % | 1,362 | 0 |
| gpt-5.4-mini | 16/16 | 52,582 | 69 % | 1,245 | 668 |
| **gpt-5.5 (default)** | **16/16** | 63,623 | 50 % | 733 | 109 |
| gpt-5.6-sol | 16/16 | 68,576 | 78 % | 1,047 | 444 |

**The headline is that the suite does not separate them — because the two failures it did find
were OURS, not the models'.** Both are fixed:

1. **A model that researches past its budget lost a turn it had already solved.** gpt-4.1 read the
   availability reason on round 0, then spent all 8 rounds hunting for an alternative programme and
   the user got a failure. The LAST round now forces `tool_choice: answer`. 13/16 → 16/16.
2. **A reasoning-only round was treated as fatal.** The gpt-5 family routinely returns a round with
   a reasoning item and no call and no text; the loop threw "the assistant returned nothing" on a
   turn whose search had already succeeded. It now carries that output forward and continues,
   bounded by the round budget and (1). gpt-5.4-mini 12/16 → 16/16.

So the pick is on cost, and **cost does not bite**: ~10-13 k input tokens a turn with most of it
cached is of the order of a cent even at flagship pricing, so quality wins over a mini model.
`gpt-5.4-mini` is the switch to make if volume ever changes that — same 16/16 for fewer tokens —
and the `gpt-5.6-*` models on the account also passed and are worth re-measuring with the same
script. One env var, no code change. Every exchange records the `model` that answered, so an A/B
is a config flip.

⚠️ One test case had to be rewritten mid-run: "find all TALL dishwasher fronts" was a bad
discriminator, because the catalog has BOTH `b_water#2` (Base › Water › Dishwasher Fronts) and
`t_water#0` (Tall › Water › Dishwasher) — a model that answered "there are no tall dishwasher
FRONTS, shall I broaden?" was being reasonable, not wrong.

### The suite is now the SIX CANNED PROMPTS — and one of them was answered wrong

The benchmark cases were replaced with the six prompts the "Ask LIO" panel actually offers, run in
the toolbar state of the panel screenshot (FRONTS All, H All, D 58, Suspended off → `{depthClass:
58, antoso:false}`). Three of them say "this cabinet" / "this SKU", so they carry a focused sku
(R7); two are run twice — once with no programme (where the honest answer is "it IS available")
and once under BOSSA, where there is a real reason. **8 runs, 26/26 checks.**

**"Find a sink cabinet for a 36 inch sink" was CONFIDENTLY WRONG, and it was our gap, not the
model's.** It answered "13 sink-cabinet types at 900 mm — the closest standard width for a 36 inch
sink". But the catalog states sink fitment itself, and it does not track width the way the
conversion assumes: a **900 mm sink cabinet takes a 33″ sink; 36″ starts at 1000 mm** (350 units /
11 types carry `sinkFitment.maxSinkSizeInch >= 36`). The model had NO WAY to answer correctly —
`sinkFitment` was on the item but there was no filter for it — so instead of saying so it
converted inches to millimetres. Exactly the failure class the design exists to prevent, and the
kind that ends in a wrong order.

Fixed at the root: **`GET /design-book/items?sinkSizeInch=NN`** (new, additive, in `QueryItemsDto`)
matches `sinkFitment.maxSinkSizeInch >= NN` — `$gte`, because a bigger cabinet still takes a
smaller sink; not null-inclusive, because an item with no fitment data is not an answer to "what
fits my sink". The LIO tool schema carries the warning in the same words. Re-run: `sinkSizeInch:
36` → **11 types**, matching the API's own count, and the answer now says it applied the Max Sink
Size filter "rather than converting inches to cabinet width".

⚠️ Note for the client on that answer: with `groupBy=family` the matching cards FACE their default
width (`TSP6080`, 600 mm) even though the member that fits the sink is the 1000 mm sibling — the
usual membership-vs-face rule (audit §I). The W pill on the card swaps to it.

Also worth knowing: the accessories prompt answers with **`itemSkus` (76 codes) and `filters:
null`** — R3's explicit exception, an answer that is a fixed handful with no filter that expresses
it. A client that only re-runs `filters` will render nothing for it, so it must handle `itemSkus`
too.

**⭐ R8a IS BUILT (2026-09-07)** — a curated pair may carry a PDF; see the block under R8a below
for what shipped and the two defects driving it found. Backend branch
`feat/design-book-lio-knowledge-files`, cut from `dev` @ `b63110e8`, **not released**.

⚠️ Correction to the header above: the first cut is **not** "on branch `feat/design-book-lio-agent`,
not released" any more — it was merged and is on `origin/dev` AND `origin/main` (commit `6b81a3d7`).

**Not built yet:** streaming (D5 — poll ships first); rate limits / budgets (D6 — per-turn token
usage IS recorded on every exchange so a limit can be set later).

## 0. What it is

A conversational assistant sitting above the design-book catalog. In the UI it is the "Ask LIO about
the catalog…" box under the toolbar, with quick-chips (Find Units · Appliance Check · Cabinet Rules ·
Design Help · Order Check) and canned prompts:

- Find a sink cabinet for a 36 inch sink
- Show all cooktop units in 80 cm
- Show compatible accessories for TK6080SZ2
- Why is this cabinet unavailable?
- Why is Avance unavailable?
- Find a replacement for this SKU

An unanswered question already has an escape hatch: "Not answered? Ask the Expert →" — that is the
existing `POST /design-book/queries` human-escalation flow, not part of the agent.

## 1. Functional requirements

### R1 — Intent classification
The agent must decide what kind of question it was asked. Two families:

- **ITEM SEARCH / LISTING** — "find me all sink cabinets under Base", "show all cooktop units in
  80 cm". Answer is a *set of catalog items*.
- **GENERAL / EXPLANATORY** — "why is this cabinet unavailable?", "why is Avance unavailable?", "is
  SKU xyz a drawer?", "is SKU xyz available under opening P?". Answer is *prose*.

The classification is the agent's own job — the client does not tell it which mode to use, and there
is no separate "search mode" toggle. The quick-chips are hints at most.

### R2 — Two response modes, one endpoint
The response envelope must let the frontend tell the two apart and react differently:

- **Prose mode** — plain-English answer, rendered in the chat panel. Used for every explanatory
  question. Must be readable by a dealer/designer, not an engineer: name the actual toolbar control
  to change ("Avance is greyed because this family is excluded from the AVANCE programmes — switch
  FRONTS to P or pick a PRIMO programme"), not a gate name.
- **Query mode** — the answer carries a **filter set** plus a small **result summary**. The backend
  ran the query itself (it has to — see R3), but it ships what it *learned*, not the page of cards:
  the frontend re-executes those filters through its **existing grid path** and renders from that.
  The agent never renders or paginates.

A single answer may carry both (a sentence + a query payload).

### R3 — What query mode returns — **FILTERS + a result summary; the client re-executes** (decided)
Two separate questions got conflated here, and they have different answers:

- **Does the backend run the query?** **Yes, always.** The agent cannot write an honest sentence
  otherwise — non-negotiable 1 says every factual claim traces to a tool result and non-negotiable 2
  forbids a SKU that did not come back from the API. It cannot say "12 sink cabinets at 80 cm", nor
  notice the answer is empty and broaden the search, without having run it. `GET items` is one of
  its tools and it calls it in-process, through the **endpoint's own service path** — never a private
  query, or the agent's answer and the client's grid drift apart.
- **Do the resulting cards ride back on the answer?** **No.** The client re-executes the filters
  through the grid code it already has.

So the query-mode payload is:

- `filters` — the `GET /design-book/items` filter set the agent chose (category, subcategory,
  leafId, widthMm, heightCode, depthClass, programs, tier, q, …), never a list of SKUs,
- `resultSummary` — what the agent saw: the total count, and the specific SKUs its prose names (so
  the sentence and the grid cannot disagree).

Why filters and not ids: grid membership, face selection, section bucketing, greying and paging all
live in the API (`gridRows`, `bucketSections`, `availableFromCaps`), and a raw id list bypasses every
one of them — the client would render cards the app would not, in the wrong order.

**Why the cards do not ride back**, even though the backend already has them:

1. **Staleness.** This is an async job (D5). Seconds pass before the client polls a finished answer —
   more with a PDF. If the user touched the toolbar meanwhile, an embedded page is a grid built for a
   state they have left. Filters re-executed by the client always match what is on screen.
2. **It would be a second grid path.** The client has exactly one route from `GET items` to rendered
   cards, and it carries the refs map, card state (`cardLine` / `insert` / `variantCode` /
   `depthClass`), the click dispatcher and section bucketing. Cards arriving instead through the job
   poll need every one of those. §T and §U were both "the row rendered right and the click was dead",
   caused by a path that dropped card state — that is the bug class this would re-open.
3. **The seam.** Page 1 from the job and page 2 from the API is a boundary between two sources of the
   same list, and boundaries are where this codebase has produced its bugs.

The cost of the client re-running it is one aggregation it already runs on every toolbar click.

The one exception is an answer that genuinely *is* a fixed handful and has no filter that expresses
it (e.g. "the accessories on this SKU" → the refs on `items/:sku`). Those may ship as ids.

The agent must emit filters the API actually accepts — the payload is validated against
`QueryItemsDto` before it is executed, and an invalid filter set is a failed turn, not a 400 for the
client to discover.

### R4 — PDF input — **≤ 30 pages, passed to OpenAI as a file** (decided)
The user can attach PDFs to a question and the agent answers from their content, e.g. "list all the
items discussed in this PDF".

- **Limit: 30 pages.** Larger uploads are rejected with a clear message. The 1,000-page LEICHT price
  books are explicitly out of scope (they need chunking + retrieval — a separate project).
- **The model must see page IMAGES, not extracted text.** The catalog pages are laid out — type
  tables, dimension icons, the P1 / suspended / depth markers are *vector drawings with no glyphs*
  (proven in the book audit) — so text extraction loses exactly the information the question is
  about. Layout is the content.
- **We do not render the images ourselves.** The OpenAI API takes the PDF directly as an
  `input_file` and, per its docs, "extracts both text and page images and sends both to the model";
  page-image parsing "requires models with vision capabilities, such as `gpt-4o` and later models".
  Limits are "each file must be under 50 MB. The combined limit across all files in the request is
  50 MB" — no page-count limit is documented, and 30 pages is far inside the size cap. An optional
  `detail: auto | low | high` on the `input_file` item trades visual fidelity against tokens.
  This removes the whole rasterization problem from our side (see §3a for why that matters on
  Heroku).
- Accept multipart on the ask endpoint or a pre-uploaded reference (`POST
  /design-book/upload-query-files` already does multipart for the expert-query flow).
- When the PDF names item codes, **resolve them against the real catalog** and answer with live data
  (availability, name, dimensions) rather than repeating the PDF.

Cost note: a 30-page PDF is a large per-question payload. Upload it to the OpenAI Files API once and
reuse the file id across the turns of a thread, keyed by file hash, so a follow-up question about
the same PDF does not re-send it. `detail: low` is the first lever if cost bites.

Rendering pages ourselves is only warranted if we later need to *show* them (page citations, crops,
thumbnails) or move off OpenAI. The package for that day is already picked — **`pdf-to-img`**, §3b —
along with the two Heroku traps that come with it.

### R5 — Open-ended questions
Anything the user types must be handled, not only the six canned prompts. "Is SKU xyz available
under opening P?" is a legitimate question and the agent decides on its own whether the answer is
prose or a query payload.

### R6 — Availability explanations
"Why is this unavailable?" is the hardest and most valuable case, and it is the one thing the
backend cannot answer today. It needs a reason API, since availability has two independent layers:

- **unit gates** — the eight in `unitAvailable()` (`src/design-book/design-book.grid-rows.ts`):
  progOk · tierOk · depthOk · handleOk · frontOk · openOk · antosoOk · doorOk. The function already
  computes all eight and then `&&`s them; it must be able to report *which* one failed.
- **family / membership hides** — a card can be absent for reasons no unit-level gate knows:
  `gridHidden`, `depthFamOk`, `lineCardOk`, `antosoFamOk`, `famOkB`, the byprog/`ppool` hide, the
  v98 sibling-family swap.

Both layers must be reachable from one call, and the answer must name the offending toolbar input.

### R7 — Context on every turn
A question like "why is **this** cabinet unavailable?" is meaningless without state. Every request
must carry:
- the focused SKU / family (what "this" refers to),
- the full toolbar: programme, FRONTS tier, W / H / D, line, opening, handle, front, doorline,
  antoso/suspended, grey-don't-hide,
- the active navigation leaf (category / subcategory / leafId).

The toolbar is not optional — the same SKU is available in one toolbar state and greyed in another.
It is also the **execution** context on both sides of R3: the agent runs its query against the
toolbar it was handed, and every axis it does not set explicitly stays as the toolbar has it, so the
count in the prose matches the grid the client draws. A LIO query is the client's own grid call with
some filters replaced, never a fresh unscoped one.

### R8 — A teaching area for the client
The client needs a screen where they can **teach the agent**: submit a question together with its
correct answer, and have the agent use it from then on. **Teaching is admin-only** — no dealer,
designer or end user can write to this store, ever. So:

- an admin-guarded authoring surface (list / add / edit / delete) over a store of curated
  **Q&A pairs**,
- each pair is retrievable by the agent at answer time and takes part in its reply,
- pairs are versioned/audited enough to know who added what and when.

"Learn" here does **not** mean fine-tuning a model. The practical shape is a curated knowledge store
the agent searches on every question and injects into context (D8), and note
this is the one corpus where retrieval/embeddings genuinely earn their place (it is small,
free-text, and has no API to query it with, unlike the catalog).

### R8a — a curated pair may carry a PDF — **the document rides with its pair** (new 2026-08-19)
The client asked for "LIO should learn from the PDFs I provide". What they described is **not a
document corpus**: in the R8 authoring screen they want to **upload a PDF alongside the text of the
question**, and then write, in the answer field, **how LIO should answer** when that question comes
up. The PDF is the pair's evidence; the answer is the instruction for using it.

That distinction is the whole design. A corpus ("index these documents and let the agent search
them") is a different and much larger feature, and is deliberately not what this is — §3c records
the route we costed and rejected, so it does not get re-researched.

The shape, all of it reuse:

- `LioKnowledge` gains `files[]` — the sub-document already defined on `LioExchange.files`
  (`schema/lio-exchange.schema.ts`): `{fileId, name, pages, bytes, hash}`.
- Upload goes through **R4's existing path, unchanged**: same 30-page and 25 MB caps, same page
  count, same sha256 dedupe. `uploadPdfs()` is private on `LioService` today
  (`lio.service.ts:550`) and moves to a shared `lio-files.ts`; `lio.service.ts` re-exports
  `countPdfPages` so `scripts/check-lio.js:23` keeps its import and the check keeps passing.
- `POST/PATCH lio/knowledge` become multipart — `FilesInterceptor` and `@UploadedFiles` are already
  imported in the controller for `ask` (`lio.controller.ts:15,83`), and `lio.dto.ts` already has the
  `parseJsonObject` transform a multipart body needs.
- At answer time the pairs are already retrieved (`lio.service.ts:232`); their files join the
  `input_file` list built two lines further down at `:253`. That is the entire wiring — two lines.
- `lioContextBlock` labels which document belongs to which pair, so the model can tie an instruction
  to its evidence rather than seeing a pile of unattributed pages.

Two things decide whether it works:

- ⚠️ **The admin must still type real text in the question field.** Retrieval is Mongo `$text`
  (`schema/lio-knowledge.schema.ts`) and a PDF contributes no indexed words — a pair whose question
  is only a file name is never retrieved, and its document is never seen. This matches what the
  client described doing, but it is load-bearing and the authoring screen should say so.
- ⚠️ **Cap the pages across retrieved pairs.** `retrieve()` returns up to 5 pairs (`RETRIEVE_LIMIT`),
  and 5 × 30 pages of vision on every question is the one real cost risk. Walk the pairs in rank
  order and attach until a running total reaches `MAX_PDF_PAGES` — reuse that number rather than
  inventing a second limit.

### ⭐ R8a — WHAT SHIPPED (2026-09-07), and the two defects that only appeared when it was driven

Built as specified above, all reuse, no new dependency, and **no change to any existing response
shape**. What the spec did not predict is below it.

| File (D4K-backend `src/design-book/lio/`) | Change |
|---|---|
| `lio-files.ts` | **NEW.** `uploadPdfs` / `countPdfPages` / the three caps / `LioFile` / `LIO_FILES_PROP` / `lioOpenAI()`, moved out of `lio.service.ts` so a question and a pair share ONE upload path. `lio.service.ts` re-exports `countPdfPages` for `scripts/check-lio.js`. |
| `schema/lio-knowledge.schema.ts` | `files[]`, the same sub-document the exchange uses — both now take it from `LIO_FILES_PROP`, so they cannot drift. |
| `dto/lio-knowledge.dto.ts` | Multipart-safe: `tags` accepts `a,b` or a JSON array; `removeFileIds` takes a document off a pair. |
| `lio.controller.ts` | `POST`/`PATCH knowledge` gain `FilesInterceptor` + `@ApiConsumes`, same 4-file cap as `ask`. |
| `lio-knowledge.service.ts` | Uploads on create; on update an upload ADDS and `removeFileIds` takes away, resolved against the stored list so replacing a PDF is one atomic write and a text-only edit never disturbs the documents. |
| `lio.service.ts` | The wiring: retrieved pairs' files join the `input_file` list, `dedupeFiles` sends a document once if the user attached it too. |
| `lio.prompt.ts` | Names each attached document under its pair, so an instruction ties to its evidence. |

**⭐ DEFECT 1 — a document rode on questions that matched NOTHING.** `retrieve()` falls back to the
whole store when the text search misses and the store is small ("so a small store is always in
play"). That is right for the TEXT and wrong for a PDF: measured, a question about the price book
was handed the showroom-handover PDF and answered about it. A fallback pair costs a few hundred
tokens; attaching its document costs a vision pass over up to 30 pages, on every unrelated
question. `retrieve()` now stamps **`matched`**, and only a genuine text hit contributes its
document — the fallback still injects the pair's TEXT. This is the same cost risk the spec flagged
for `RETRIEVE_LIMIT`, arriving from a direction the spec did not look at.

**⭐ DEFECT 2 — the invented-code guard could be defeated by looking the code up.** The spec says
"the invented-code guard already covers the new input for free". It did not. `collectSeenSkus`
walked the whole stored tool call — `{name, args, resultSummary}` — so `get_item("ZZQQ9911XX")`
returning `{error: "No item found"}` still left the code in `args`, where it counted as *proven
real*, and the answer printed it. **A model could launder any invented code by asking about it
first.** Pre-existing (R4), but R8a is what makes a PDF full of code-shaped strings an everyday
input. The proof set is now tool RESULTS only, plus the client's focused sku. Reproduced, fixed,
re-driven: the same question now answers "the sheet's Phantom unit line is not in the live
catalog" without printing the code, and a REAL code read out of a PDF (`T6080ZISWH`) is still named
with the catalog's dimensions beating the sheet's.

**Checks:** `scripts/check-lio.js` grew two — `filesWithinPageBudget` (rank order wins, an
unreadable page count is never free, the same document on two pairs is sent once) and
`collectSeenSkus` (args never prove a code, results do). 6/6. `check-grid-gates.js` identical over
77,760 + 51,840 combinations; `check-face-pins.js` 6/6.

**⭐ The page budget was then driven LIVE, with a control** — it is the spec's "one real cost risk"
and a pure check cannot show that the cap is what does the dropping. Two pairs both matching one
question, each carrying a manual whose only distinguishing fact sits on **page 7**, asked for both
facts in one question:

| Pages across the two pairs | Answer |
|---|---|
| 20 + 20 = 40 (over the 30 budget) | "The ALPHA transport code is QX-7741. I don't see a BETA transport code in the attached pages." |
| 10 + 10 = 20 (inside it) | "The ALPHA transport code is QX-7741. The BETA transport code is RM-2298." |

Same pairs, same question, same build — so the cap is what drops the second document, not some
"only the first pair ever attaches" bug, and the fact being on page 7 of 20 also shows the vision
pass reads the whole document rather than its first page. Both pairs are retrieved and inject their
TEXT in both runs; only the document is budgeted.

**Verified live on D4K-dev**, real model, real catalog: a pair carrying a one-page checklist made
the answer state four points and a revision number **that appear nowhere but inside the PDF** while
the exchange itself carried no files · an unrelated question got the pair's text and NOT its
document · both caps refuse a PDF on a pair in the same words they refuse one on a question (the
1,033-page price book on size, a 42-page file on pages) · a text-only edit left the document alone,
a second upload appended, `removeFileIds` removed · non-negotiable 5 held with a document written
to contradict the catalog · query mode unchanged (7 cooktop cards at 80 cm). Test pairs and the
three uploaded files were deleted afterwards; the store is back to its one pre-existing pair.

**⚠️ Known gap, left out by decision:** deleting a pair — or detaching a document with
`removeFileIds` — does NOT delete the PDF from the OpenAI Files API. Pairs are deleted rarely and
the files are a few MB, so the orphans are cheap, and a remote call in the delete path is a failure
mode the local delete does not need. ⚠️ They ARE real though: the account already holds 7 orphaned
`user_data` files from earlier LIO sessions (`o1.pdf` ×4, `design-book-guide.pdf` ×2). Add the
cleanup if the authoring screen ever makes deletion routine; sweep the account by hand until then.

**Attach the PDF; do not extract its text** — the same reasoning as D4. The pages are laid out, and
the P1 / suspended / depth markers are vector drawings with no glyphs, so extraction loses exactly
what a taught answer is most likely to be about. Extracting once at authoring time would be cheaper
forever, but it adds `pdfjs-dist` and throws the drawings away.

Non-negotiable 5 is unchanged and still binds: whatever the document says, the live API wins on
availability, dimensions and membership. The invented-code guard already covers the new input for
free — `unknownCodes()` (`lio.service.ts:494`) checks every code-shaped token in the answer against
the collection, so a code the model reads out of an attached PDF is validated like any other.

### R9 — End-user feedback loop
The person who receives an answer must be able to **mark it wrong** — that is the only write any
non-admin user has. It flags the exchange for the **admin**, who can then **submit the correct
answer** — which feeds back into R8's store so the same question is answered correctly next time.
Flagging is a request for review, never a direct edit: a marked-wrong answer changes nothing until
an admin acts on it.

The loop, end to end:

1. user asks → agent answers,
2. user marks the answer wrong (optionally with a comment on what was wrong),
3. the flagged item lands in a review queue for the client,
4. the client writes the correct answer,
5. that correction becomes a curated Q&A pair (R8) and is used on subsequent questions,
6. the flag is resolved / closed.

Requirements that fall out of it: the full exchange must be **persisted** (question, answer, the
tool calls and results behind it, the toolbar context, the user, the timestamp) or a correction
cannot be judged; and the review queue needs states (open / answered / dismissed).

## 2. Non-negotiables (carried over from the parity work)

1. **The model never re-derives catalog rules.** Availability, membership, face selection, section
   order and order codes took four zero-diff sweep rounds to port and are not inferable from an item
   record. The model turns natural language into API calls and API results into prose — nothing
   else. Every factual claim traces to a tool result.
2. **No SKU may appear in an answer unless it came back from the API.** Model-invented codes look
   exactly like real ones.
3. **No vector store / RAG over the catalog.** It is 18,396 structured records behind an API with
   filters for every axis the UI exposes. Retrieval is the API. This says nothing about the other
   two corpora — the curated Q&A store (R8) and PDFs (R4) are free text with no query API, and
   retrieval over *those* is expected (D4, D8). R8a's PDFs are not a third corpus: they ride along
   with the pair that was retrieved and are never searched on their own (§3c).
4. **The agent is READ-ONLY over the catalog.** It never creates, updates or deletes an item — no
   `POST/PATCH/DELETE /design-book/items`, no ingest, no backfill. Its catalog tools are `GET`
   only, and that should be enforced by what it is handed, not by prompt instructions. Item
   authoring stays with the admin CRUD UI. This does not restrict the two stores the agent's own
   features own (curated Q&A pairs R8, exchanges and flags R9) — those are separate collections and
   are written normally.
5. **A taught answer must never contradict live catalog data.** Availability, dimensions and
   membership come from the API on every question; curated Q&A supplies domain knowledge, policy and
   phrasing, not facts the catalog already owns. If the two disagree the API wins and the pair is
   surfaced to the admin as stale (D9).
6. **Where our data deliberately differs from the v781 app, ours is correct** (the 17 book-audit
   exclusion fixes). The agent answers from the API, never from the app.

## 3. Platform

- Code lives in **D4K-backend** (NestJS 11), as part of / alongside the `design-book` module.
- **Plain OpenAI SDK, no agent framework** (D2). No AI SDK is a dependency today (`openai`,
  `@anthropic-ai/*`, `langchain`, `ai` — none present), so `openai` is the one addition. The tool
  surface is ~5 functions and the loop is a `while` over tool calls; LangChain / Vercel AI / Mastra
  would be more moving parts than the thing they wrap.
- The model must be **vision-capable** — R4 sends PDFs and the API turns them into page images.
- JWT-guarded like the rest of the module.

## 3a. Heroku constraints (this is what shapes the endpoint)

The server runs on Heroku, one Node buildpack, **no Aptfile**, `Procfile` = `release` + `web` only.
Three facts drive the design:

1. **The router kills any request with no response within 30 s (H12).** An agent turn — tool calls,
   plus a vision pass over up to 30 PDF pages — will exceed that. This, not the PDF, is the real
   constraint. **Decided: async job + poll** (D5).
2. **The filesystem is ephemeral** and there is no Redis / queue addon today (`@nestjs/schedule` is
   the only scheduling dependency; no `bull`, `bullmq`, `agenda`, `ioredis`). S3 is already wired
   (`@aws-sdk/client-s3`, `lib-storage`, `s3-request-presigner`), so any artifact we keep goes to
   S3, never `/tmp`.
3. **No system packages.** If we ever do render PDF pages ourselves it must be a plain
   `npm install` — see §3b for the package. `pdf2pic` / `pdf-poppler` / `gm` need Ghostscript /
   ImageMagick / poppler via the apt buildpack, which means a new buildpack, a bigger slug and a
   stack-upgrade liability. Also note a standard-1x dyno is 512 MB: rasterizing 30 pages in-process
   is an OOM candidate. Passing the PDF straight to OpenAI (R4) avoids all of this.

## 3b. PDF → images: the package, if we ever need it

**We do not rasterize today** (D4 — OpenAI takes the PDF as an `input_file` and does the page-image
conversion itself). This section exists so the fallback is a decision already made, not a research
task: if we need our own images (page citations, crops, thumbnails, or a move off OpenAI), it is
`pdf-to-img`. Versions checked 2026-08-10.

**Pick: [`pdf-to-img`](https://www.npmjs.com/package/pdf-to-img) v6.2.0** — MIT.

```
npm i pdf-to-img
```

```ts
import { pdf } from 'pdf-to-img';
const doc = await pdf(buffer, { scale: 2 });           // ~150 DPI at A4
for await (const page of doc) { /* page is a PNG Buffer */ }
```

Why it is the out-of-the-box answer on Heroku:

- **No system packages, no buildpack, no Aptfile.** Its only dependency is `pdfjs-dist` (Apache-2.0),
  which pulls `@napi-rs/canvas` (MIT) as an **optional** dependency. That ships **prebuilt** native
  binaries per platform — `@napi-rs/canvas-linux-x64-gnu` and `-musl` are both published — so the
  install is a download, never a compile. Nothing to add to `Procfile`.
- **It is an async iterator, one page at a time**, which is what the 512 MB dyno needs — render,
  upload the buffer to S3, drop it. Never hold 30 decoded pages at once, and keep `scale` at 2
  (higher is mostly tokens, not information).
- Streams/`Buffer` in, `Buffer` out — no temp files, so nothing touches the ephemeral filesystem.

Two things that will bite if ignored:

- ⚠️ **Node ≥ 20.19 is required** (`pdf-to-img@6` and `pdfjs-dist@5` both declare
  `>=20.19.0 || >=22.13.0 || >=24`). `D4K-backend/package.json` has **no `engines` field**, so the
  runtime Node version is whatever the platform defaults to, and `buildspec.yml` pins `nodejs: 18`.
  **Pin `engines.node` before installing this** — on Node 18 the install resolves nothing usable, and
  the older `pdf-to-img@4` is not the escape hatch: it depends on `canvas` (node-canvas), which is
  exactly the cairo/pango/libjpeg compile we are avoiding.
- ⚠️ **Do not install with `--omit=optional`**, and do not restore a `node_modules` cache built on
  another platform (`buildspec.yml` caches `node_modules/`). Both defeat the per-platform optional
  dependency and you get "canvas is not available" at runtime, not at build. `package-lock.json`
  records every platform variant, so a normal `npm ci` on a Linux builder resolves the right one.

**Rejected: [`mupdf`](https://www.npmjs.com/package/mupdf) v1.28.0** — technically the cleanest fit
(pure WASM, zero native binaries, immune to the optional-dependency trap above) but it is
**AGPL-3.0-or-later**. Using it in a hosted commercial product means the AGPL network clause or
buying Artifex's commercial licence. Not worth it when an MIT/Apache stack does the same job.

**Rejected: `pdf2pic`, `pdf-poppler`, `gm`, bare `canvas`** — system libraries via the apt
buildpack (§3a.3), or a compile at install time.

## 3c. A searchable document corpus — the route we did NOT take

R8a attaches a PDF to a curated pair. It does **not** let the agent search documents it was never
taught a question for ("what does the installation manual say about X?"). That is a corpus feature.
This section records what it would cost, so the next session does not re-research it — the same job
§3b does for rasterizing. Costed 2026-08-19.

**It would be cheap.** `openai@7.4.0` already ships everything it needs, verified in `node_modules`:
`vectorStores.files.uploadAndPoll()` (`resources/vector-stores/files.d.ts:58`) does parse + chunk +
embed + index server-side, and `{type:'file_search', vector_store_ids:[…]}` is a first-class
Responses-API tool type (`resources/responses/responses.d.ts:519`). So: no new dependency, no
chunker, no embedding call of our own — a store id in `.env`, an admin upload route, and one more
entry in the `tools` array next to `LIO_TOOLS`. The bulk of the work would be the admin CRUD, which
is `lio-knowledge.service.ts` copied.

**It would also fit.** Measured on the client's own books (20-page `pdftotext` sample × page count):
**~1.8 M tokens each** — `primo-2026.pdf` 1,033 pp, `contino-avance-2026.pdf` 1,010 pp — both
comfortably inside OpenAI's 5 M-token per-file cap, so neither needs splitting. Extraction quality
is good: `pdftotext -layout` returns the type codes, widths, price columns and the
`Not available in BOSSA, …` notes cleanly.

**Why it is still not the answer today:**

1. **`file_search` is text-only.** It never sees a page image, so the vector-drawn P1 / suspended /
   depth 36-48-68 markers are invisible to it (book audit, "Not auditable from text"). A text index
   and the vision path in R4/R8a are different modalities — a corpus would be an addition to them,
   never a replacement.
2. **The price books collide with non-negotiable 5.** They are *upstream* of the catalog: their
   content is already encoded in `capabilities.*`, including the 17 places where we deliberately
   diverge from them (non-negotiable 6, the book audit). An agent free to quote book prose about
   availability contradicts the API by construction. Any corpus containing them needs the "API wins"
   rule enforced harder than one prompt line.
3. **Nobody asked for it.** The requirement on the table is R8a.

If it is ever built, the alternatives to OpenAI-hosted are Atlas `$vectorSearch` (~150 lines: a
chunker, embed-on-upload, the aggregation, a `search_documents` tool — worth it only if the corpus
must live in the client's own Mongo) or a plain Mongo `$text` index over extracted page text (~60
lines, `LioKnowledgeService.retrieve()` reused verbatim; fine for code and term lookup, which is
most of what a price book is, and it misses paraphrases). ⚠️ Both self-hosted routes need a text
extractor, and the book audit's `pdftotext` is poppler — a **system package, forbidden on Heroku**
(§3a.3). The pure-npm route is `pdfjs-dist`'s `getTextContent()`.

Cost if OpenAI-hosted: vector-store storage is free under 1 GB (14 MB of extracted text is nowhere
near it), plus a per-search fee and the retrieved chunks' tokens in context. Confirm current OpenAI
pricing before quoting the client a number.

### The job model (D5)

`POST` the question → returns a **job id** immediately. The client polls until the job is done, then
reads the answer.

- **Job state lives in Mongo, not in memory.** With more than one web dyno, a poll can land on a
  dyno that never saw the job — in-memory state answers "unknown" and the feature breaks under the
  scaling it will eventually get. Mongo is already the store; this needs no new addon.
- **The work runs in-process on the dyno that accepted it.** No worker dyno, no Redis, no queue
  library — the extra dyno and the Key-Value addon buy durability we do not need yet, and the poll
  only ever *reads* Mongo, so any dyno can serve it.
- **Stale jobs must be reaped.** A dyno restart or a deploy mid-turn leaves a job stuck `running`
  forever. Time it out (a `@nestjs/schedule` sweep, or lazily on read) and mark it `failed` so the
  client stops polling.
- States: `queued → running → done | failed`, with the answer (or the error) on the same document.
  The job record and R9's exchange record are the same thing — one document, written once. It stays
  small: query mode stores the filters and a result summary, never the page of cards (R3), so nothing
  here goes near Mongo's 16 MB document cap.

Upgrade path if durability ever matters (a job must survive a deploy): move execution to a worker
dyno + BullMQ + a Key-Value addon. The API contract does not change — that is the point of putting
the state in Mongo now.

## 4. Decisions (all answered 2026-08-05)

| # | Decision |
|---|---|
| D1 | **Query mode returns FILTERS + a result summary**, never ids and never the cards. The agent **does** run `GET items` server-side — through the endpoint's own service path, because it cannot write a grounded sentence otherwise — but ships the filter set and what it saw (count + the SKUs it names); the **client re-executes those filters through its existing grid path**. Keeps one route from query to cards, and keeps the answer from going stale against a toolbar the user has since changed. Ids only where no filter expresses the answer. See R3. |
| D2 | **Plain OpenAI SDK.** No agent framework. |
| D3 | **Threaded conversations**, persisted in Mongo. Follow-ups ("find a replacement for *this* SKU") need it, and R9 has to store the exchange anyway. |
| D4 | **PDFs ≤ 30 pages, seen as page IMAGES** by a vision model — layout is the content. **We do not rasterize; the PDF goes to OpenAI as an `input_file` and it does the conversion.** Price books out of scope. See R4 + §3a.3. If we ever do rasterize: `pdf-to-img`, §3b. |
| D5 | **Async job + poll.** `POST` returns a job id, the client polls for the answer. Forced by Heroku's 30 s router timeout; job state in Mongo, work in-process, no worker dyno and no Redis. See §3a. JSON, not streaming — SSE stays a later option. |
| D6 | **No rate limits or per-dealer budget yet.** Same caveat. |
| D7 | **Read-only over items.** No item create/update/delete, no ingest, no backfill. Non-negotiable 4. |
| D8 | **Learning = retrieval over curated Q&A pairs**, not a growing system prompt (which re-costs every token on every question and dies past a few dozen pairs). |
| D9 | **On a conflict, the live API wins** and the curated pair is flagged to the admin as stale. Non-negotiable 5. |
| D10 | **Teaching and flag review are admin-only.** Every other user can only mark an answer wrong. R8/R9. |
| D11 | **Corrections apply forward only.** Past exchanges are not re-answered or re-notified. |
| D12 | **A flagged answer is served unchanged** until an admin corrects it — no suppression, no warning banner. |
| D13 | **A curated Q&A pair may carry PDFs on its QUESTION side (R8a, 2026-08-19).** Attached as `input_file` — reusing R4's upload path, caps and dedupe — and injected whenever that pair is retrieved, capped at `MAX_PDF_PAGES` across all pairs in a turn. It is **not** a document corpus and must not quietly become one: no vector store, no `file_search`, no chunking (§3c). |

### Built for, not built yet

Two decisions were taken as "not now", and both get cheaper if the first version does not paint over
them:

- **Streaming (D5).** Poll-for-a-finished-answer ships first. Keep answer generation behind one
  service method whose transport is the controller's business, so adding SSE later is a controller
  change, not a rewrite — and note SSE would also satisfy Heroku's 30 s rule on its own (the timeout
  applies to the first byte, then 55 s between bytes), so it is a genuine alternative to polling, not
  just a nicety.
- **Rate limiting / budget (D6).** Persist per-turn token usage on the exchange record from day one
  (R9 stores the exchange anyway). Without those numbers there is no basis to set a limit when one
  is wanted, and backfilling usage after the fact is impossible.

## 5. Out of scope (for now)

- Pricing / quoting (prices are programme-dependent and not in the export).
- Anything the expert-query flow already covers (`POST /design-book/queries`).
- Rendering item cards — the frontend does that with its existing grid.
