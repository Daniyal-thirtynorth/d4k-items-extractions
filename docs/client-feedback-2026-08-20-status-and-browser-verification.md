# Client feedback, 2026-08-20 — what was broken, what we fixed, and how to check it yourself

Written 2026-08-20.

The client sent us four complaints about the Design Book. This file explains,
in plain words, what each complaint meant, what we changed, and the exact steps
to see the fix working in a browser. You do not need to read any code to follow
the check steps.

Related files: `admin-panel-design-book-how-to.md` (step-by-step instructions for
the admin panel — merging cards, the three reference lists, hiding and restoring
items), `client-ui-parity-audit.md` (the long-running list of differences between
our app and the client's) and `design-book-api-ui-map-v2.md` (the technical
contract).

---

## 0. What the client actually said

Their message, word for word:

> First Card: Pricebook-63 deep units: when we need to do 63, we need to link
> two items. See what we did on the HTML you have. On the live site, it's not
> working. Also, the order we did is not showing on yours. The cabinets you
> have in the categories are not related to the order.

They also sent four screenshots. Together, the message and the screenshots are
really **four separate complaints**:

| # | What they meant, in plain words | Was it a real bug? |
|---|---|---|
| 1 | "When I pick the 63 cm depth, your app orders one item. It should order several." | Yes. Fixed. |
| 2 | "Your accessories are one big pile. Ours are sorted into groups." | Yes. Fixed. |
| 3 | "Our app shows which colours a mat comes in. Yours shows none." | Yes. Fixed. |
| 4 | "The cabinets in your categories don't match what I asked for." | The categories were fine. But it uncovered a real search bug. Fixed. See §4. |

They later sent six more screenshots asking separate questions — about merging
cards, about controlling the three reference lists, about the Active/Inactive
screen, and about two codes that search could not find. Those are answered in
§5.

They also named a reference file, `leicht_unit__781.html`. We have it here as
`data-from-client/leicht_units__781_.html`. That file is their own working
version of the app, and it is our source of truth. Every rule we added below is
copied from a function inside it, and we cite the line number each time.

---

## 1. Where each fix stands

| # | Fix | Repo | Merge commit | On the dev site? | On `main` (production)? |
|---|-----|------|--------------|------------------|-------------------------|
| 1 | Picking 63 cm orders all the linked codes | D4K-frontend | `bdce06d44` | ✅ yes | ✅ yes |
| 2 | Accessories split into tabs | D4K-frontend | `bdce06d44` | ✅ yes | ✅ yes |
| 3 | Mat colours shown | D4K-frontend | `bdce06d44` | ✅ yes | ✅ yes |
| 4 | Search puts the best match first | D4K-backend | `369b1c81` | ✅ yes | ✅ yes |
| 5 | Deactivated items no longer show in the Design Book | D4K-backend | `db7bb872` | ✅ yes | ✅ yes (merged 2026-08-21) |
| 6 | Searching an ORDER code finds its article (§5 D/E/F) | D4K-backend | `b417a178` | ✅ yes | ✅ yes (merged 2026-08-21) |
| — | Lio, the catalogue assistant | D4K-backend | `bdd686b7` | ✅ yes | ✅ yes (separate work, same session) |

Heroku deploys both apps automatically from the `dev` branch, so anything
merged into `dev` is live on the dev site within minutes. We did not take that
on trust — we checked:

- **Frontend.** We downloaded the JavaScript that `dev.dash4kitchen.com` is
  actually serving and searched it. It contains the words `ANTSP63US` and
  `L-Box walnut`. Those two strings exist nowhere except the two new files we
  wrote this round, so the new code is definitely live.
- **Backend.** We called the live search API and the results come back in
  ranked order. Old code could not produce that order, because old code had no
  ranking function.

**In short: all five fixes are live and you can check them right now.**

> ⚠️ **Read this before you decide the search fix is missing.**
>
> The obvious test is to call `GET /design-book/items?q=63` with nothing else.
> That test **looks broken but isn't**. The endpoint has two different code
> paths inside it:
>
> - With `groupBy=family` → it runs the ranking function. This is what the
>   website uses.
> - Without it → it sorts in the database by category, then subcategory, then
>   code. It never ranks, and it never will.
>
> So a bare `?q=63` still answers with `F7636` (a shelf) at the top. That is
> the unranked path, not a bug. You can tell the two apart by the response:
> the ranked one includes a `groupBy` key, the unranked one doesn't.
>
> **Real users are never affected.** The website builds every search request as
> `{ groupBy: "family", ... }` (`params.ts:73`), so the search box always uses
> the ranked path. §6 discusses whether the other path should rank too.

### Everything reached production

The first five merges landed on `main` on 2026-08-20, and the deactivated-items
fix followed on 2026-08-21. Each rode the normal release, which is a pair of pull
requests: `dev → staging`, then `staging → main`.

| Repo | What | dev → staging | staging → main | Merged (UTC) |
|---|---|---|---|---|
| D4K-backend | the first four fixes + Lio | #3036 | #3037 | 2026-08-20 10:50 |
| D4K-frontend | the three interface fixes | #2402 | #2403 | 2026-08-20 11:17 |
| D4K-backend | deactivated items (§5 C) | #3043 | #3044 | 2026-08-21 07:50 |

The deactivated-items fix went in as PR #3042 first, onto `dev`, then up the
chain. It carried one unrelated commit with it — `3661ce70`, another developer's
account-list change that was already sitting on `dev` — which the repo owner
confirmed was fine to promote.

We checked the actual code on `main`, not just that the commit is in the
history. A commit can be in a branch's history while a later change removes the
code again, so we looked at the files themselves:

```
D4K-backend   main:src/design-book/design-book.service.ts
                88:  export function searchRank(
              2123:        rel: term ? searchRank(c, term) : 0,
              2135:        a.rel - b.rel ||
              main:scripts/check-search-rank.js                     present

D4K-frontend  main:src/views/design-book/data/order-code.ts
                71:  export function depth63Mode(
               101:    ? ["ANTSP63US", "MPRU", "ANSVVO275"]
               132:  export function companionCodes(
              main:src/views/design-book/data/accessory-groups.ts
                12:  export function accessorySystem(
                47:  export function groupAccessories<
                86:  export function accessoryColours(
```

Both repos are now completely up to date — `dev`, `staging` and `main` hold the
same code, with nothing waiting in between. (At the time of writing on 2026-08-20
the backend still had one unrelated commit queued, `229e7e24 fix issue in add
room issue`; it has since gone out with a later release.)

---

## 2. How to open the Design Book

The Design Book needs a login. There are two ways in.

### Normal way

Go to `https://dev.dash4kitchen.com/login`, sign in, then click **Design Book**
in the navigation. Any account works — the page has no permission check.

### Quick way, no password (dev only)

The dev backend has an open endpoint that hands out a temporary token. Open the
dev site's login page, then paste this into the browser console:

```js
const r = await fetch("https://dev.api.dash4kitchen.com/design-book/dev-token").then(r => r.json());
document.cookie = `d4k_token=${encodeURIComponent(r.token)}; path=/; max-age=3600; samesite=lax; secure`;
document.cookie = `d4k_role=${encodeURIComponent("Master Admin")}; path=/; max-age=3600; samesite=lax; secure`;
```

Then go to `/design-book`. The token lasts one hour. This only exists on dev,
never on production.

### Running the site on your own machine

`.env.local` already points at the live dev API, so a local copy shows the same
real catalogue:

```bash
cd D4K-frontend
corepack pnpm install
corepack pnpm dev          # http://localhost:3000
```

The same cookie trick works, but drop the `; secure` part because localhost is
plain HTTP.

One thing to remember: a local frontend still talks to the **deployed** backend.
That is handy for testing frontend changes against real data, but it tells you
nothing about backend code you have not pushed yet.

---

## 3. The three fixes you can see in the interface

### 3.1 — Picking 63 cm now orders every linked code

**What was wrong, in plain words.** When you chose a depth of 63 cm and copied
the order code, our app gave you one code. The client's app gives you three or
four.

**Why.** In the LEICHT catalogue there is no such thing as a 63 cm deep
cabinet. What you really order is the **68 cm cabinet plus a factory
modification** that makes it 63 cm deep. That modification is a separate
article with its own code, and depending on the cabinet it may drag in another
part or two. Ordering only the cabinet means the customer receives the wrong
depth.

**The rule**, copied from `leicht_units__781_.html:6093-6101`:

```js
function d63Set(code, isDoor, mode){ var m = mode || 'sink';
  if (m === 'sink')    { var s = [code,'ANTSP63US','MPRU']; if (isDoor) s.push('ANSVVO275'); return s; }
  if (m === 'cooktop')   return [code,'ANTSP63US'];
  if (m === 'tall')      return [code,'ANHST63'];
                         return [code,'ANTST63'];
}
```

Which extra codes you get depends on what kind of cabinet it is (`:2340-2345`):

| Kind of cabinet | Extra codes added |
|---|---|
| Tall units | `ANHST63` |
| Base › Sinks | `ANTSP63US` and `MPRU` — plus `ANSVVO275` if it is a door version |
| Base › Cooktops & Downdrafts | `ANTSP63US` |
| Anything else | `ANTST63` |

Sink cabinets have one extra twist. There, clicking **63** does two jobs at
once: it swaps you to the 68 cm version of the card **and** adds the
modification codes. Both things are supposed to happen.

**Where the code lives.** `src/views/design-book/data/order-code.ts` —
`depth63Mode()`, `depth63Codes()`, `sinkNativeCodes()`, `companionCodes()`.
`orderCodeLines()` adds these extra codes to all three of the ways it can
return a code, so the special Y-line and height-extension cases pick them up
too. `unit-card.tsx` and `detail-panel.tsx` each remember your 63 choice per
cabinet, so it survives the swap to the 68 cm card.

**How to check it in the browser:**

1. Open the Design Book.
2. In the left menu click **BASE**, then **Water**, then **Sink Cabinets**.
3. Look at the first card, `TSP6080`, "Sink unit".
4. On that card find the row labelled **D** (for depth) and click **63**.
5. Watch the card change. The title becomes `TSP608068` and the size line reads
   `W 600 · H 795 · D 660`. That is the swap to the 68 cm version — expected.
6. Click the **copy** icon on the card. It is the two-squares icon, next to the
   heart.
7. Open the **Clipboard** panel at the bottom right.

**What you should see.** Four codes, not one:

```
TSP608068     the cabinet itself
ANTSP63US     the 63 cm modification for sinks
MPRU          the sink back panel
ANSVVO275     added because this version has doors
```

If you only see `TSP608068`, the fix is not running.

**Want to see the other cases?** A **Tall** cabinet at 63 adds `ANHST63`. A
**Base › Cooking** cabinet adds `ANTSP63US` on its own. Any other Base cabinet
adds `ANTST63`.

### 3.2 — Accessories are now sorted into tabs

**What was wrong, in plain words.** We showed every accessory in one long list.
The client's app splits them into tabs, and groups the cutlery inserts by which
**system** they belong to.

**Why it matters.** A drawer might offer four different cutlery systems. You
cannot mix parts from two systems in one drawer. If a designer sees them as one
list, nothing tells them that — so they can pick a combination that cannot be
built.

**The rule**, copied from `leicht_units__781_.html:6002` (`cutSys`) and `:1235`
(`_SYSO`, which sets the order). The system is hidden in the first letters of
the code:

| Code starts with | System |
|---|---|
| `EBF…` | Q-Box |
| `BFA…` or `BFC…` | Plastic |
| `LBF…` | L-Box oak |
| `LBN…` | L-Box walnut |
| `CB…` | Combo |
| `HBF…` | Beech |

The tabs always appear in this order: **Compatible Accessories → Q-Box →
Plastic → L-Box oak → L-Box walnut → Combo → Beech → Other → Mats →
Alterations**. Tabs with nothing in them are hidden, which is why different
cabinets show different tabs.

**Where the code lives.** `src/views/design-book/data/accessory-groups.ts` —
`accessorySystem()`, `SYSTEM_ORDER`, `groupAccessories()`. Drawn on screen by
`RefAccessoryTabs` in `detail-panel.tsx`.

**How to check it in the browser:**

1. In the left menu click **BASE**, then **Storage**, then **Drawer Cabinets**.
2. Click any pull-out cabinet to open its detail panel — for example
   `T6080Z2IS`, "Pullout unit · Z2IS".
3. Scroll down to the section headed **POSSIBLE ALTERATIONS & ACCESSORIES**.

**What you should see.** A row of tabs, in this order, with these counts:

```
Q-Box 6 · Plastic 5 · L-Box oak 4 · L-Box walnut 4 · Combo 3 · Beech 3 · Other 7 · Mats 3 · Alterations 8
```

4. **Q-Box** opens first. Check its contents — every code starts with `EBF`:
   `EBF6058`, `EBF6048`, `EBFF6058`, `EBFF6048`, `EBFM6058`, `EBFM6048`.
   Nothing else is mixed in.

If you see one long unsorted list instead of tabs, the fix is not running.

**A sanity note.** Open a sink cabinet instead (step 1 of §3.1). It shows only
**Compatible Accessories 1 · Other 9 · Alterations 10**. That is correct — a
sink cabinet has no cutlery, so those tabs are hidden rather than shown empty.
Missing tabs are not a bug.

**What an admin can and cannot change here.** Worth knowing before someone adds
an accessory in the back office and wonders why it did not go into a tab.

An admin **can** decide which of the three reference lists an item sits in.
That is the "References" section of `public/design-book-admin.html`, the
`refAlt` / `refComp` / `refAcc` boxes, saved by
`PATCH /design-book/items/:sku` into `UpsertItemDto.alterations`,
`.accessories` and `.companions`. That controls three of the tabs:
**Compatible Accessories** (the companions list), **Alterations**, and whether
the item is in the accessory pool at all.

An admin **cannot** decide which tab an accessory goes into *within* that pool.
The six code prefixes, the tab order, the mat prefixes and the mat colours are
all written into the frontend source. Nothing comes from the server, because
the API carries no "system" field for an accessory. The client's own app works
the same way — `cutSys` hardcodes the same six prefixes. (`meta.systems` in the
database is a different thing entirely — SensoMatic, recessed lights — and it
is not editable in the panel either; `design-book-admin.html:724` strips it.)

**What that means in practice.** If an admin adds an accessory whose code does
not start with one of the six prefixes, it lands in the **Other** tab. Nothing
breaks; it is simply not grouped. Adding a genuinely new cutlery system, a new
mat prefix, or a new mat colour needs a small code change and a deploy. §6
explains why we left it that way and what the cheap alternative would be.

### 3.3 — Mats now show their colours

**What was wrong, in plain words.** Drawer mats appeared with no colour choice.
The client's app shows which colours each mat comes in.

**Important.** These colours are **not** catalogue data. The API sends no
colour for an accessory. (There is a `finishes` field on cabinets, but that is
about pricing, not swatches — different thing.) The client's own app writes
these colours directly into its code at `leicht_units__781_.html:5440`, and we
deliberately did the same rather than build a data pipeline for two constants:

| Code starts with | Colours shown |
|---|---|
| `ARE…` | `160`, `161` |
| `CBRM…` | `286` |
| anything else, including `WFA…` | none |

**Where the code lives.** `accessoryColours()` in `accessory-groups.ts`; the
swatches are drawn by `accessory-cards.tsx`; `swatchUrl()` moved to
`constants.ts`.

**How to check it in the browser:**

1. Open the same pull-out cabinet as in §3.2.
2. Click the **Mats** tab.

**What you should see:**

```
Anti slip mat        ARE6058    Colour  160  161
Combo Non-Slip Mat   CBRM6058   Colour  286
Wool felt cover      WFA6058    (no colour row)
```

`WFA6058` showing no colours is correct, not a miss — the client's app only
defines colours for `ARE` and `CBRM`.

---

## 4. The fourth complaint: "the cabinets in the categories are not related"

Read this one carefully, because **the categories were never broken**. The
screenshot was showing something else.

### What the screenshot was really showing

It looked like a category listing full of unrelated cabinets. It was not a
category — it was the **search results** for `63`.

We checked the categories directly against the live API anyway. The category
`leafId=b_store#2` returns 100 items and every single one is
`Base / Function Cabinets`. Nothing is filed in the wrong place. Every category
name we ship is taken straight from the client's own v781 file.

We also tested a second theory — that the deployed database might be out of
date. It isn't. Live is `schemaVersion 2.5.4` with 18,396 items, matching
`export-v781-fresh.json` exactly. No re-import needed.

*Both checks are written down here so nobody spends a day repeating them.*

### The real bug hiding underneath

Search matched a code if the typed text appeared **anywhere inside it**. So
typing `63` also returned `F7636`, `FS8634` and `FSUE7363` — codes that merely
happen to contain those two digits. Worse, they appeared **above** the three
articles that are actually called 63.

**How we fixed it.** We added a ranking function, `searchRank()`, in
`src/design-book/design-book.service.ts`. The approach is **sort, don't
delete** — nothing is removed from the results, the good matches are simply
lifted to the top. Deleting results would make real codes impossible to find;
sorting them cannot.

| Rank | What it means | Best or worst |
|---|---|---|
| 0 | The code is exactly what you typed | best |
| 1 | The code starts with what you typed | |
| 2 | What you typed is a whole word in the product name | |
| 3 | What you typed appears in the code as a complete number | |
| 4 | Everything else | worst |

The card sorter now sorts on this rank first, then on the rules it already had.

One trap worth remembering: an earlier version treated `63` as a whole word if
the label contained it with any non-letter around it. That matched
*"Bar handle No. **63**5"* and pushed eight handle cards above `ANTSP63US`.
Numbers now have to be bounded on **both** sides. That exact case is locked in
as a named test in `scripts/check-search-rank.js`.

### How to check it in the browser

1. Open the Design Book.
2. Click the search box and type `63`.

**What you should see.** The first cards are the ones that are genuinely named
63:

```
CMU6063SZ   Module Below 63                  ← "63" is a whole word in the name
AMU6063T    Module Below 63
AMO6063T    Module Above 63
ANTSP63US   Sink base unit alteration        ← "63" is a whole number in the code
ANTST63     Cupboard depth alteration
ANHST63     Cupboard depth alteration
```

⚠️ **One catch when checking by eye.** The grid is a masonry layout, which
means cards flow *down* the columns, not across the rows. The top row on screen
is **not** the first six results. To judge the order properly, read the page's
HTML or read the API — the next section shows how.

### How to check it from a terminal

You must pass `groupBy=family`. That is what the website sends, and it is the
only path that ranks — see the warning box in §1.

```bash
T=$(curl -s https://dev.api.dash4kitchen.com/design-book/dev-token | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -H "Authorization: Bearer $T" \
  "https://dev.api.dash4kitchen.com/design-book/items?q=63&groupBy=family&limit=8" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print('keys:', list(d.keys()))          # must include groupBy — if not, you are on the unranked path
for i in d['items']:
    print(' ', i['sku'], '|', (i.get('familyFacts') or {}).get('label'))
"
```

Real output from the live site:

```
keys: ['items', 'types', 'groupBy', 'pagination']
  CMU6063SZ  | Module Below 63
  AMU6063T   | Module Below 63
  AMO6063T   | Module Above 63
  ANTSP63US  | Sink base unit alteration
  ANTST63    | Cupboard depth alteration for USA
  ANHST63    | Cupboard depth alteration for USA
```

### How to prove the server really ranked it

Eyeballing an order is weak evidence. This calculates the rank of every card
the server returned and checks the numbers never go backwards. If the server
had not ranked, its output would not be sorted by a function it never ran:

```bash
cd D4K-backend && npm run build
node -e "
const { searchRank } = require('./dist/design-book/design-book.service.js');
const items = require('./q63fam.json').data.items;     // the payload saved above
const ranks = items.map(i => searchRank(i, '63'));
console.log('ranks in returned order:', ranks.join(','));
console.log('non-decreasing:', ranks.every((r, i) => i === 0 || r >= ranks[i - 1]));
"
```

Expected:

```
ranks in returned order: 2,2,2,3,3,3,3,3
non-decreasing: true
```

Or simply run the test file: `node scripts/check-search-rank.js`. It should
report 4 of 4 groups passing, including the "Bar handle No. 635" case.

---

## 5. Six more questions the client asked

These came as six screenshots with notes written on them. Each answer below was
checked against the live dev system on 2026-08-20, not guessed.

Short version:

| Question | Short answer |
|---|---|
| A. "As admin I want to merge cards" | Already possible. Give the items the same `familyId`. |
| B. "As admin I want to decide what goes in Alterations / Accessories / Planned together" | Already possible. Those are three lists on the item in the admin panel. |
| C. The Active / Inactive screen | **Real bug — now fixed.** Deactivating an item hid it from the admin list but not from the Design Book. |
| D. Searching `T506636` finds nothing | **Now works.** It is an order code, not a catalogue code — search now finds the article it was built from, `T5066`. |
| E. Searching `H60146IZ4E` finds nothing | **Now works.** Same cause, same fix — it finds `H60146IZ4`. |
| F. "If we add the E it's not working" | The E always worked in the copied order code. What did not work was searching for it. Now it does. |

---

### A. "As admin, I want to be able to merge cards"

*(Screenshot: a search for `ZGRS4` showing three separate "Handle screws" cards
— `ZGRS419`, `ZGRS430` and `ZGRS422PZ2`.)*

**Yes, you can do this today. No new development needed.**

**How cards are built.** Every item has a field called `familyId`. All items
sharing one `familyId` become **one card**. The extra items turn into the small
pills on the card, so the designer clicks a pill instead of hunting for another
card.

Here is why the client sees three cards. We checked the live data:

| Card in the screenshot | Its `familyId` | Items in that family | Pills shown |
|---|---|---|---|
| `ZGRS419` | `XAG_Ha_ac0d14` | 5 | Ty 19 · 22 · 23 · 25 · 27 |
| `ZGRS430` | `XAG_Ha_ac0d14_B` | 4 | Ty 30 · 35 · 42 · 45 |
| `ZGRS422PZ2` | `HDL_ZGRS422PZ2` | 1 | none — a family of one has nothing to switch between |

Three different family ids, so three cards. That is the system working
correctly; the catalogue import simply put them in three families.

**How to merge them:**

1. Open `https://dev.dash4kitchen.com/crm-management`. In the left sidebar,
   scroll to the bottom — under the heading **DESIGN BOOK**, click **Items**.
2. Search for the code you want to move, for example `ZGRS430`.
3. Click the **pencil** (edit) icon on that row.
4. Find the box labelled **familyId**.
5. Replace what is in it with the family id you want to merge *into* — here
   `XAG_Ha_ac0d14`.
6. Save.
7. Repeat for every code that should join the same card.
8. Reload the Design Book. The separate cards are now one card, and the codes
   you moved appear as extra pills.

**Two useful things to know:**

- **You do not have to type the pills.** The server builds them from whichever
  items share the family id. Move an item in and its pill appears; move it out
  and the pill disappears.
- **The card takes its name and picture from the face item** — the main item of
  the family. In this example `ZGRS422PZ2` is called "Handle screws for" while
  the other two are "Handle screws". After merging, one of those names is used
  for the whole card, so check the result looks right.

**Where the field is.** Two admin screens can edit it, and both write the same
value:

- The CRM admin at `/crm-management` → sidebar **DESIGN BOOK → Items** → pencil
  icon → the dialog **Edit item · <code>**, section **1 · Identity and
  taxonomy**, third box on the top row: **familyId**
  (`design-book-item-form.tsx:455`). Opened and confirmed on the live dev site
  on 2026-08-20 — `ZGRS430` shows `XAG_Ha_ac0d14_B` in that box, matching the
  API exactly. The same dialog carries the **item is active** checkbox from
  question C.
- The standalone panel `public/design-book-admin.html`, section 1, the
  **familyId** box (line 267).

---

### B. "As admin, I want to decide what goes in these sections"

*(Screenshot: the detail panel of `AT6080SZIS2`, with arrows pointing at
**ALTERATIONS**, **ACCESSORIES** and **PLANNED TOGETHER**.)*

**Yes, you can already control all three. No new development needed.**

Each of those three headings is fed by one list on the item. Nothing else
decides what appears there:

| Heading on the detail panel | Field on the item in admin |
|---|---|
| ALTERATIONS | `alterations` |
| ACCESSORIES | `accessories` |
| PLANNED TOGETHER | `companions` |

**How to change them:**

1. `/crm-management` → sidebar **DESIGN BOOK → Items** → search for the
   cabinet, e.g. `AT6080SZIS2`.
2. Click the pencil icon.
3. Scroll to the **References** section — three boxes, one per heading above.
4. Type a code and press Enter to add it. Click the × on a chip to remove it.
5. Save, then reload the Design Book and open that cabinet.

Whatever codes you leave in each box are exactly what the designer sees under
that heading.

**One limit worth repeating.** You control *which items* appear under
ACCESSORIES. You do **not** control *which tab* inside ACCESSORIES an item lands
in — that is worked out from the first letters of the code. §3.2 explains this,
and §6 says what it would take to change it.

---

### C. The Active / Inactive screen

*(Screenshot: the admin item list, filtered to **Inactive**, searched for
`HSSCUS` — "Sensor switch", Lighting, $0. Two arrows: one at the row's picture,
one at the Inactive button. No note was written on this one, so the two answers
below cover both things the arrows point at.)*

**What the Active / Inactive buttons do.** They are a filter for the list, and
they change what the delete button means:

- **Active** — items the Design Book is showing to designers right now.
- **Inactive** — items that are hidden but not deleted. Their data is still
  there, and one click brings them back.
- On the **Active** list the bin icon says **Deactivate** — it hides the item.
  Nothing is erased.
- On the **Inactive** list the same icon says **Restore** — it makes the item
  visible again.

**Items can also go inactive on their own.** Every time a new catalogue file is
imported, anything that is not in the new file is marked inactive automatically,
and the date is stored. That is deliberate: discontinued articles stop appearing
in the Design Book without anyone losing the record of them.

**About `HSSCUS` specifically.** We looked it up on the live system on
2026-08-20:

```
sku            HSSCUS
name           Sensor switch
category       Lighting / Control & Switch
active         true
deactivatedAt  null
lastSeenAt     2026-07-17
```

It is **active**, and asking the API for inactive items does not return it — so
we could not reproduce the fault from this item's data.

**That was the wrong conclusion, and we have corrected it.** The client then sent
a second pair of screenshots: `HSSCUS` sitting under **Inactive** in the admin
list, and the very same "Sensor switch" card still on the Design Book shelf under
**CONTROL & SWITCH**. We went back into the code, and the client is right. There
are two separate faults.

**Fault 1 — the Design Book never hid deactivated items.** One line built the
filter for every catalogue list:

```ts
if (query.active !== undefined) filter.active = query.active;
```

It only filtered when the caller *asked* for a particular state. The admin table
always asks (that is what its **Active** / **Inactive** buttons do, which is why
that screen looked right). The Design Book never asks — it sends no `active` at
all — so no filter was applied and every deactivated item kept its card. The
line now reads:

```ts
filter.active = query.active ?? true;
```

Ask for a state and you get it; say nothing and you get active items only. All
three catalogue list paths share this one function, so the single line covers the
grid, the section grid and the family pool. The "More categories" badge counts
were deliberately written to match the old unfiltered behaviour, so they were
corrected in the same change — otherwise the badge would say 24 and the shelf
would show 23.

**Fault 2 — a catalogue import switches deactivated items back on.** Every
imported item is written with `active: item.active !== false`. Catalogue export
files carry no `active` field per item, so that reads as "not false" and comes
out **true**, and `deactivatedAt` is cleared at the same time. An item an admin
deactivated by hand is therefore live again after the next import, with no record
that it was ever switched off. This is why `HSSCUS` reads `active: true` today.
This one is **not fixed** — see §6, because what *should* happen is a decision,
not a bug fix: either a hand-made deactivation outranks the catalogue, or the
catalogue is the source of truth and admins should be told their change is
temporary.

**We reproduced it.** Dev holds test data, so we deactivated `HSSCUS` there
ourselves and asked the live dev system for the same shelf the client
photographed. Then we ran a build of the fix against that same database and asked
again:

| What we asked for | Live dev, before the fix | With the fix |
|---|---|---|
| The CONTROL & SWITCH shelf | **5 cards**, Sensor switch among them | **4 cards**, gone |
| The whole Lighting category | 38, still there | 37, gone |
| Searching for `HSSCUS` | 1 result | no results |
| The "Lighting" badge number | 39 | 38 |
| The admin **Inactive** tab | shows it | **still shows it** |

Five cards before, four after — the same five in the client's screenshot. The
last row is the one that matters as much as the rest: the admin screen carries on
working exactly as it did, because it asks for a state explicitly. Only the
Design Book was blind.

`HSSCUS` has been switched back on. One mark is left on it: switching an item
back on through the admin panel stamps it as hand-edited and stamps today's date
on it, so its record now says `manual` where it used to name the July catalogue
file. That is what the panel does for anybody who clicks Restore, and the next
catalogue import writes both back.

**It is shipped.** The fix went out on 2026-08-21 as PR #3042 onto `dev`, then up
the normal chain (#3043, #3044) to `main`. Once the dev site had redeployed we
deactivated `HSSCUS` one more time and asked the live system again:

- the CONTROL & SWITCH shelf came back with **4 cards**, not 5
- the item was gone from the category grid, from `by-section`, and from search
- the admin **Inactive** tab still listed it
- the standalone check `scripts/check-inactive-hidden.js` printed
  `OK — 1 inactive sku(s), none leaked into the grid`, where the same command had
  printed `FAIL` against the old build an hour earlier

`HSSCUS` was then restored, and dev holds no inactive items again.

We can prove the code is on `main` — we read the file out of the branch rather
than trusting that the commit is in the history — but we cannot see whether the
production servers have restarted onto it, because production does not offer the
read-only login we use for checks and we will not use real credentials against
it. The honest acceptance test is for the client to deactivate an item on their
own system and watch the card go.

**About the picture.** Every item stores its own image address in a field called
`imageUrl`, and that is what the list shows. For this item it is
`https://dash4data.s3.us-west-1.amazonaws.com/itemData/HSSCUS.jpg`. Note that
the picture **cannot be changed from the admin panel** — the edit window has no
field for it, and the address comes from the catalogue import. (There is an
`imageUrl` box in part 8 of the edit window, but that belongs to the
"inspiration" block, which is a different thing.) Changing a product photo needs
a developer.

---

### D. Searching for `T506636` finds nothing

*(Screenshot: `T506636` typed into the Design Book search, "No units match these
filters.")*

**Nothing is missing from the catalogue — but the client is right that the
search box should have found it, and now it does.**

There are two different kinds of code in this system, and they are easy to mix
up:

- **A catalogue code.** A real item stored in the database. Search can find it.
- **An order code.** What you copy and send to the factory. The app *builds* it
  when you click the pills. It is never stored anywhere, so a plain search
  could not find it.

`T506636` is an **order code**. The real item is `T5066`, "Floor unit · Special
Height". Here is its depth row, straight from the live system:

| Depth you click | Order code you get |
|---|---|
| 36 | `T506636` |
| 48 | `T506648` |
| 58 | `T5066` |
| 63 | `T5066` plus the depth alteration code |
| 68 | `T506668` |

So `T506636` simply means "`T5066` at 36 cm deep". The digits are inserted into
the middle of the code when you click the pill.

**What changed.** Search now works backwards from the typed code. Before looking
for a stored article it peels off everything `assemble()` can add — the depth
digits spliced into the middle, a trailing `E` or `J`, a leading `V`, `P1` or
`C1` — and looks for the article underneath as well. Typing `T506636` now
returns the `T5066` card, and the card is **faced on `T5066`** rather than on
the family's default `T6047`, so you see the code you typed.

The peeled code is only ever used as an exact match, so peeling too far costs
nothing: no such article exists, so it matches nothing extra. Nothing is
removed from the results either — this only ever adds the article the search was
missing.

**How to check it in the browser:**

1. Open the Design Book.
2. Type `T506636` into the search box.
3. One card comes back: **`T5066` · Floor unit · Special Height**.
4. `T506648` and `T506668` do the same. So does `H6014636IZ4` → `H60146IZ4`.

**One thing this does not do.** The card comes back on its native 58 cm depth —
the **36** pill is not pre-selected for you. Clicking it still gives you
`T506636` in the copy box. Pre-selecting the pills from a searched order code is
card state in the client and was left for a separate change.

⚠️ **This is a deliberate difference from the client's own v781 file.** Its
search is `b.units.some(u => u.c.includes(q))`, so `T506636` finds nothing there
either. We are answering the complaint, not copying the file. It is invisible to
the parity harness — every search term those sweeps drive (`TSP`, `HWS`, `63`,
`toe kick`) peels to nothing, which is locked in as a named case in
`scripts/check-order-code-search.js`.

---

### E and F. Searching for `H60146IZ4E` finds nothing, and "if we add the E it's not working"

*(Two screenshots: `H60146IZ4E` in the search box with no results, and the
`H60146IZ4` card with an arrow at the **E** pill in the LINE row.)*

**Same cause as question D, and the E itself is working.**

**What the E is.** `E` is the one-piece front — a front with no handle. It is
not a different cabinet. It is the same cabinet with a different front, so the
catalogue keeps **one** item and simply adds the letter `E` to the end of the
order code.

The code that does it is one line
(`src/views/design-book/data/order-code.ts:218`):

```ts
if (argument.frontE && argument.caps?.hasEFront) code += "E";
```

We checked `H60146IZ4` on the live system. It has `hasEFront: true`, so the E
pill is switched on for it and clicking E does add the letter.

**So why did search find nothing?** Because `H60146IZ4E` is an order code, not a
catalogue code. The stored item is still `H60146IZ4`, and search only looks at
stored items.

**That is now fixed** — see §5 D. Searching `H60146IZ4E` returns the
`H60146IZ4` card, and so does `H6014636IZ4`, the same card at 36 cm deep. The
`E` pill itself was never broken; only finding it was.

**How to check the E is working, in the browser:**

1. Search for `H60146IZ4` — **without** the E. The "Tall storage unit" card
   appears.
2. On the card, find the row labelled **LINE**. Click the **E** pill.
3. The E pill turns on.
4. Click the **copy** icon on the card and open the **Clipboard**.
5. The code there ends in `E` — `H60146IZ4E`.

If step 5 gives you a code ending in `E`, the feature is working exactly as
intended. Only the search box cannot find it.

**Still true.** The search box finds the **card**, not the exact configuration.
It cannot tell you that the `E` was on, because the E is not part of any stored
article — it is a pill state. If a designer needs to get back to the exact
configuration behind an order code, that is a bigger piece of work: read the
code, then set every pill it implies. §6 keeps it as an open decision.

---

## 6. What is still open

The original four complaints are all fixed and live on dev **and on production**
(§1). The later batch of six questions turned up one genuine bug — the Design
Book ignoring deactivated items (§5 C) — and that is now fixed, merged to `main`
and confirmed running on the dev site. What follows is the decision it left
behind, and the loose ends around everything else.

### Decisions someone should make

- **~~Should a hand-made deactivation survive the next catalogue import?~~
  ANSWERED AND BUILT (2026-09-02).** It does now. The question was put as a
  product call and the answer turned out to be forced by a bigger one: the client
  had by then hand-merged cards on production — including all five members of one
  "Handle screws" card folded into another — and none of it survived an import
  either. Deactivation was the same bug wearing a smaller hat, so both are fixed
  by one rule: **a manual write records the fields it CHANGED on the item, and the
  import puts them back.** The chosen policy is *the human wins for fields a human
  touched, the catalogue wins everywhere else* — what most admin tools do, and
  what the client already assumed was true.

  One correction to the paragraph this replaces: it said export files "carry no
  per-item `active`". They do — `docs/export-v781-fresh.json` asserts `active:
  true` on all 18,396 items. The effect was the same, but it matters to the fix,
  because you cannot solve it by treating an absent field as "leave alone".

  Full behaviour: CRUD guide §6a. Analysis it came from:
  `docs/manual-edits-vs-catalog-import-2026-08-27.md`. **Still open in that
  document:** an item an admin CREATES by hand is deactivated by the next import
  regardless — that sweep is a separate write which never reads the document, and
  a brand-new code has nothing pinned (§2d there).

- **The unranked search path.** As explained in §1, only requests with
  `groupBy=family` get ranked. The other path sorts in the database by category,
  subcategory and code, and never ranks. **No user is affected** — the website
  always sends `groupBy: "family"` (`params.ts:73`). So this is not a bug
  report, it is an open question: should a plain `?q=` rank as well, for anyone
  else who might call the API directly? Doing it means either sorting in
  JavaScript after the database query (easy, but it breaks the paging that path
  was built around) or rewriting the ranking as database stages. We left it
  alone on purpose until somebody actually needs it.

- **Accessory grouping is not editable by an admin, and that was deliberate.**
  The six code prefixes, the tab order, the mat prefixes and the mat colours all
  live in `accessory-groups.ts` (§3.2). A brand-new cutlery system needs a code
  change and a deploy; until then its items sit in the **Other** tab. LEICHT
  reissues the book roughly once a year, so six lines of code are less to
  maintain than a database field plus an API field plus an admin form plus the
  frontend work to read it. If it ever does need to move, the cheap version is a
  single optional override, not a whole registry:

  ```ts
  // backend — UpsertItemDto + design-book-item.schema.ts
  accessorySystem?: string;   // leave blank to work it out from the code prefix

  // frontend — accessory-groups.ts:64
  const system = item.accessorySystem ?? accessorySystem(item.code) ?? "Other";
  ```

  plus one text box in the admin panel's References section. Tab *order* would
  stay in code — an unknown system would sort after the known ones and before
  "Other". Not built. Nobody has asked for it.

- **~~Search cannot find an order code.~~ BUILT — the client came back on it.**
  They re-sent the `T506636` screenshot after reading the "not a bug" answer, so
  the explanation was not the deliverable; finding the card was. `orderCodeBases`
  in `design-book.service.ts` peels the mutations `assemble()` applies and matches
  the article underneath. See §5 D. **What is still open is the second half:** the
  card comes back on its native depth with no pill pre-selected, so an order code
  identifies the ARTICLE but not the CONFIGURATION. Doing that properly means the
  client reading the peeled mutations back out and setting card state (depth pick,
  the `E`/`J` line chips, the `P1`/`C1` opening) — a frontend change, and a
  product call about how much of a pasted code should be restored.

### Not merged anywhere

- **`d4k-items-extraction`, branch `docs/client-report-2026-08-20`** — pushed to
  GitHub but not merged. Documentation only: this file, the additions to
  `design-book-api-ui-map-v2.md`, and the `CLAUDE.md` log entry. Merging was
  never asked for; the instruction covered the frontend and backend only.
- **A client PDF is sitting untracked** in `data-from-client/`
  (`11262025-Pazit-Kitchen-MEP-1765389830914.pdf`). Left alone on purpose — it
  was swept into a commit by a stray `git add -A` and then backed out. Somebody
  should decide whether it belongs in the repo.

### Already broken before this work

- **The backend test suite does not compile.** 45 of 46 files fail with
  `TS2593: Cannot find name 'describe'`. The cause is one line,
  `tsconfig.json:15`, `"types": ["multer"]` — naming any type package there
  switches off the automatic loading of all the others, so the Jest globals
  disappear. The fix is one line, `"types": ["multer", "jest", "node"]`, but we
  did not touch it: it predates this work, and changing how types resolve
  globally deserves its own change and its own test run. In the meantime the
  Design Book logic is covered by the standalone `scripts/check-*.js` files,
  which do run.
- **`scripts/check-face-pins.js` needs a local server** on port 8000 to run at
  all. It is an integration smoke test, and it covers `pinFacePool`, which none
  of this work touches.
- **`send-to-service-dialog.test.tsx` is a flaky test** in the frontend suite,
  and it fails depending on machine load. We proved it is a flake and not a
  regression: it passes on its own both before and after our merge, the full
  suite passes at the commit before our merge, and a second full run after the
  merge was completely green — 242 files, 2565 tests. It may still fail in CI
  now and then.

---

## 7. Where the code lives

**D4K-frontend** — merge `bdce06d44`, 9 files, +503 / −30:

| File | What it does |
|---|---|
| `src/views/design-book/data/order-code.ts` | `depth63Mode`, `depth63Codes`, `sinkNativeCodes`, `companionCodes` |
| `src/views/design-book/data/order-code.test.ts` | tests for the 63 cm rules, all four cases |
| `src/views/design-book/data/accessory-groups.ts` | `accessorySystem` (the `cutSys` port), `groupAccessories`, `accessoryColours` |
| `src/views/design-book/data/accessory-groups.test.ts` | tests for tab order, hidden empty tabs, colour lookup |
| `src/views/design-book/components/unit-card.tsx` | `depth63Pick`, and the extra codes going into `copyCode` |
| `src/views/design-book/components/detail-panel.tsx` | `RefAccessoryTabs` |
| `src/views/design-book/components/accessory-cards.tsx` | colour swatches |
| `src/views/design-book/api/types.ts` | `category`, `subcategory`, `unitFacts` added to the card and detail types |
| `src/views/design-book/data/constants.ts` | `swatchUrl` |

**D4K-backend** — merge `369b1c81`, 2 files, +136 / −3:

| File | What it does |
|---|---|
| `src/design-book/design-book.service.ts` | `searchRank`, and `sortCards` sorting on it |
| `scripts/check-search-rank.js` | 4 groups of checks, including the "Bar handle No. 635" regression |

**D4K-backend** — merge `db7bb872` (PR #3042), 2 files, +57 / −4:

| File | What it does |
|---|---|
| `src/design-book/design-book.service.ts` | `buildItemFilter` defaults to active-only; the "More categories" badge recount stops counting deactivated items |
| `scripts/check-inactive-hidden.js` | one single-sku assertion per inactive item — fails against the old build, passes against this one |

**D4K-backend** — order-code search, merge `b417a178` (PRs #3048 → #3049 → #3050), 2 files:

| File | What it does |
|---|---|
| `src/design-book/design-book.service.ts` | `orderCodeBases` (peels `assemble()`'s five mutations), the extra `$or` clause in `buildItemFilter`, the face pin in `pinFacePool`, and `searchRank` scoring a peeled article like a named hit |
| `scripts/check-order-code-search.js` | 7 groups of checks — the three reported codes, every mutation singly and combined, the parity terms that must peel to nothing |

**d4k-items-extraction** — branch `docs/client-report-2026-08-20`:

| File | What it does |
|---|---|
| `docs/design-book-api-ui-map-v2.md` | §2c-4 shape 4b (the sink 63 case); the `d63Set` table; the accessory tab rebuild; the mat colour note |
| `CLAUDE.md` | session log — the four complaints, the false alarm, the dev-token trick |
| `docs/client-feedback-2026-08-20-status-and-browser-verification.md` | this file |
