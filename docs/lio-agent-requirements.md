# LIO — "Leicht Intelligent Opus" · requirements

Requirements capture only. No design decisions locked yet; open questions are listed at the bottom
and need answers before implementation starts.

Doc lives here (`d4k-items-extraction/docs/`, the spec workspace); the code lands in **D4K-backend**
on branch `feat/design-book-lio-agent` (cut from `origin/dev` @ `6f24d574`).

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
- **Query mode** — a machine-readable payload the **frontend intercepts and uses to call the backend
  itself**, then renders the result with its normal grid. The agent does not render or paginate
  items.

A single answer may carry both (a sentence + a query payload).

### R3 — What query mode returns — **FILTERS** (decided)
Query mode returns the **`GET /design-book/items` filter set** (category, subcategory, leafId,
widthMm, heightCode, depthClass, programs, tier, q, …) for the client to execute — not a list of
SKUs.

Why: grid membership, face selection, section bucketing, greying and paging all live in the API
(`gridRows`, `bucketSections`, `availableFromCaps`), and a raw id list bypasses every one of them —
the client would render cards the app would not, in the wrong order.

The one exception is an answer that genuinely *is* a fixed handful and has no filter that expresses
it (e.g. "the accessories on this SKU" → the refs on `items/:sku`). Those may ship as ids.

The agent must emit filters the API actually accepts — the payload is validated against
`QueryItemsDto` before it goes out, and an invalid filter set is a failed turn, not a 400 for the
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
thumbnails) or move off OpenAI — see §3a for the constraint that applies then.

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
   retrieval over *those* is expected (D4, D8).
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
3. **No system packages.** If we ever do render PDF pages ourselves, it must be a pure-JS/WASM
   renderer (`pdf-to-img` = pdfjs-dist + `@napi-rs/canvas` prebuilds, or `mupdf` WASM) — a plain
   `npm install`. `pdf2pic` / `pdf-poppler` / `gm` need Ghostscript / ImageMagick / poppler via the
   apt buildpack, which means a new buildpack, a bigger slug and a stack-upgrade liability. Also
   note a standard-1x dyno is 512 MB: rasterizing 30 pages in-process is an OOM candidate. Passing
   the PDF straight to OpenAI (R4) avoids all of this.

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
  The job record and R9's exchange record are the same thing — one document, written once.

Upgrade path if durability ever matters (a job must survive a deploy): move execution to a worker
dyno + BullMQ + a Key-Value addon. The API contract does not change — that is the point of putting
the state in Mongo now.

## 4. Decisions (all answered 2026-08-05)

| # | Decision |
|---|---|
| D1 | **Query mode returns FILTERS**, not ids — the `GET items` filter set for the client to execute. Ids only where no filter expresses the answer. See R3. |
| D2 | **Plain OpenAI SDK.** No agent framework. |
| D3 | **Threaded conversations**, persisted in Mongo. Follow-ups ("find a replacement for *this* SKU") need it, and R9 has to store the exchange anyway. |
| D4 | **PDFs ≤ 30 pages, seen as page IMAGES** by a vision model — layout is the content. **We do not rasterize; the PDF goes to OpenAI as an `input_file` and it does the conversion.** Price books out of scope. See R4 + §3a.3. |
| D5 | **Async job + poll.** `POST` returns a job id, the client polls for the answer. Forced by Heroku's 30 s router timeout; job state in Mongo, work in-process, no worker dyno and no Redis. See §3a. JSON, not streaming — SSE stays a later option. |
| D6 | **No rate limits or per-dealer budget yet.** Same caveat. |
| D7 | **Read-only over items.** No item create/update/delete, no ingest, no backfill. Non-negotiable 4. |
| D8 | **Learning = retrieval over curated Q&A pairs**, not a growing system prompt (which re-costs every token on every question and dies past a few dozen pairs). |
| D9 | **On a conflict, the live API wins** and the curated pair is flagged to the admin as stale. Non-negotiable 5. |
| D10 | **Teaching and flag review are admin-only.** Every other user can only mark an answer wrong. R8/R9. |
| D11 | **Corrections apply forward only.** Past exchanges are not re-answered or re-notified. |
| D12 | **A flagged answer is served unchanged** until an admin corrects it — no suppression, no warning banner. |

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
