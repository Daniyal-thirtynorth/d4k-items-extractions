# When does a button grey out? — plain-English guide

Real examples from the v781 catalog showing **why a product button (or whole card) greys out**.
Companion to `design-book-crud-guide.md` (how to author these) and `design-book-api-ui-map-v2.md`
(how the app renders them). A developer cheat-sheet is at the bottom.

## What "greying out" means

The app has a **toolbar** across the top — your current choices: which kitchen range, which front
style, depth, handle type, and so on. Every product button checks: *"do I work with these choices?"*

- **Yes** → the button is normal and clickable.
- **No** → the button **greys out**. It still shows (so you can see the option exists), but you can't click it.

Two things grey the same way:
- a **button** on a card (a width, a front style, …) greys based on the product it would take you to;
- a **whole card** greys based on its own product.

**Nothing greys until you change a setting.** Fresh toolbar (nothing picked) = everything clickable.
The neutral defaults are: no range picked, front style = ALL, depth 58, standard handle, not suspended,
no opening variant, no one-piece front, no door-line filter.

## The 8 questions every button asks

A button stays clickable only if the answer to **all** of these is "fine":

1. **Range** — is this product sold in the kitchen range you picked?
2. **Front style (P / A / C)** — does it come in the style you picked? (If a matching sibling exists, the app sends you there instead, so this one greys.)
3. **Opening style (P1 / C1)** — the "one handle on top" variants; only the exact opening version stays.
4. **Depth** — does it come in the depth you picked?
5. **Handle** — if you chose the handle-less look, does this have a handle-less front?
6. **One-piece front** — if you turned that mode on, does this support it?
7. **Suspended (wall-hung)** — if you turned that on, is this approved for wall-hanging?
8. **Door line (J / Y)** — if you filtered to a door line, is this in it?

Plus a shortcut: some products are marked **always available** and never grey, no matter what.

---

## 1. Range — "not sold in this range"

**`T1580`** (a 15 cm floor unit) is **not sold in the BOSSA range**. (`T2080` is its 20 cm sibling.)

| Toolbar | Button | Why |
|---|---|---|
| no range picked | ✅ clickable | nothing to check yet |
| **BOSSA** | ⬜ **greyed** | not sold in BOSSA |
| any other range it's sold in | ✅ clickable | it's available there |
| BOSSA **+** a range it's sold in | ✅ clickable | one allowed range is enough |

Real button example — on card `T6080`, the **Width 15** and **Width 20** buttons point to `T1580` / `T2080`,
so both grey out the moment you pick BOSSA.

---

## 2. Front style P / A / C — "comes in a different style"

**`T1573`** is a Primo (P) unit and it **also exists as a Contino (C)** version (`CT1573`).

| You pick (FRONTS) | Button | Why |
|---|---|---|
| ALL | ✅ clickable | no style filter |
| P (Primo) | ✅ clickable | this IS the Primo one |
| **C (Contino)** | ⬜ **greyed** | a real Contino version exists → app takes you to `CT1573` instead |
| A (Avance) | ✅ clickable | no Avance version exists, so this one stays |

The Contino twin `CT1573` behaves the mirror way: clickable under C, greys under P.

---

## 3. Opening style P1 / C1 — "one handle on top"

Some units ARE the special opening version. **`P1TSP457368B`** is a **P1** unit; **`C1T308036S2Z`** is a **C1** unit.

| You pick (FRONTS) | the P1 unit | a normal unit |
|---|---|---|
| P1 | ✅ clickable (it IS P1) | ⬜ greyed |
| C1 | ⬜ greyed (it's P1, not C1) | ⬜ greyed |

Only the unit that **is** that exact opening version stays clickable.

---

## 4. Depth — "not offered in this depth"

**`C1T3080S2Z`** is offered **only at depth 58**.

| You pick (depth) | Button | Why |
|---|---|---|
| 58 | ✅ clickable | offered |
| 63 | ✅ clickable | 63 always passes (it's a depth tweak) |
| 36 / 48 / 68 | ⬜ **greyed** | not offered at those depths |

Sibling **`C1T308036S2Z`** is only 36 cm: clickable at 36 (and 58/63, which always pass), greys at 48/68.

> Note: a unit offered in every depth never greys on depth — every depth button passes. 58 and 63 always pass for everyone.

---

## 5. Handle — "no handle-less version"

**`GF46204`** is handle-less. A normal unit like `CT1573` has a handle.

| You pick (handle) | `GF46204` (handle-less) | `CT1573` (has handle) |
|---|---|---|
| standard | ✅ clickable | ✅ clickable |
| **handle-less** | ✅ clickable | ⬜ **greyed** |

---

## 6. One-piece front — "doesn't support it"

**`GF46204`** has a one-piece front. Most cabinets don't.

| One-piece mode | `GF46204` (supports it) | a normal cabinet |
|---|---|---|
| off | ✅ clickable | ✅ clickable |
| **on** | ✅ clickable | ⬜ **greyed** |

---

## 7. Opening support — single fronts always pass

- **`T3073S`** supports the P1 opening.
- **`CT1573`** is a **single front**, so opening always works for it.
- A **multi-front** unit that supports neither greys.

| You pick (opening) | `T3073S` | `CT1573` (single front) | a multi-front unit |
|---|---|---|---|
| none | ✅ | ✅ | ✅ |
| P1 | ✅ supports P1 | ✅ single front | ⬜ **greyed** |
| C1 | ✅ single front | ✅ single front | ⬜ **greyed** |

> A single front can always take an opening variant. A unit only greys here if it's multi-front **and** lacks the variant.

---

## 8. Suspended (wall-hung) — "not approved"

- **`CT3073`** is approved for suspended (wall-hung) install.
- **`CT1573`** is not.

| Suspended toggle | `CT3073` (approved) | `CT1573` (not) |
|---|---|---|
| off | ✅ clickable | ✅ clickable |
| **on** | ✅ clickable | ⬜ **greyed** |

---

## 9. Door line J / Y — "not in this line"

- **`HVG7019768`** belongs to door line **J**.
- **`MGT601468`** belongs to door line **Y**.

| Door-line filter | `HVG7019768` (J) | `MGT601468` (Y) |
|---|---|---|
| none | ✅ | ✅ |
| **J** | ✅ clickable | ⬜ **greyed** |
| **Y** | ⬜ **greyed** | ✅ clickable |

---

## 10. Never greys

**`AT301336S`** is marked **always available** and is **line-neutral**.

- **Always available** → clickable under every toolbar, full stop.
- **Line-neutral** (accessories, alterations, fillers, special-height) → never greys on front style, whatever you pick.

---

## 11. Extra range rules in one-piece mode

**`GF46204`** has extra range exclusions that only apply **when one-piece front mode is on**.

| Toolbar | Button |
|---|---|
| range 226, one-piece **off** | ✅ clickable (fine normally) |
| range 226, one-piece **on** | ⬜ **greyed** (excluded only in one-piece mode) |

---

## 12. FRMAT — the one odd case

**`FRMAT`** (front panel material) uses an extra size table on top of the normal range rule. It's the only
product like this in the whole catalog — handle it as a special case.

---

## 13. All rules at once — `CTSS12073T2`

A Contino floor unit with sliding doors. It offers depths 58 & 68, has a handle, is approved for suspended,
and comes as a Primo twin too.

| Toolbar | Button | Which rule greyed it |
|---|---|---|
| default | ✅ clickable | — |
| range 201 | ⬜ greyed | not sold in range 201 |
| FRONTS = **P** | ⬜ greyed | a Primo version exists |
| depth **36** or **48** | ⬜ greyed | only offered at 58 / 68 |
| handle-less | ⬜ greyed | it has a handle |
| suspended = on | ✅ clickable | it's approved |
| FRONTS = **C** (its own style) | ✅ clickable | this IS the Contino one |
| depth **58 / 63 / 68** | ✅ clickable | 58/63 always pass, 68 offered |

It's clickable only when it passes **every** rule.

---

## Check any example yourself

The app is on `http://localhost:8000` (dev). Programme (range) ids come from `GET /design-book/programs`
— **BOSSA = `244`**.

```bash
# read one product's rules
GET /design-book/items/T1580          # → its excludedPrograms include "244" (BOSSA)

# watch the range rule fire on a real card's buttons
GET /design-book/items/T6080?programs=244   # width 15 & 20 come back greyed
```

The range rule is checked on the server; the other 7 are checked in the app from each product's rules.

---

## Developer cheat-sheet

Plain name ↔ the toolbar control ↔ the stored `capabilities` field(s):

| # | Plain name | Toolbar control | Gate | `capabilities` field(s) |
|---|---|---|---|---|
| 1 | Range | programme picker | progOk | `excludedPrograms` (+ `excludedProgramsE` & `hasEFront` in one-piece mode; `isFrmatFamily`) |
| 2 | Front style | FRONTS P/A/C | tierOk | `nativeTier`, `twinTiers` |
| 3 | Opening style | FRONTS P1/C1 | tierOk | `opening` |
| 4 | Depth | D pill | depthOk | `depthClasses` (58 & 63 always pass) |
| 5 | Handle | handle selector | handleOk | `handleFree` |
| 6 | One-piece front | Full-E toggle | frontOk | `onePieceFront` |
| 7 | Opening support | OPENING toggle | openOk | `openP1`, `openC1`, `singleHandle` |
| 8 | Suspended | Suspended toggle | antosoOk | `antosoApproved` |
| 9 | Door line | door-line filter | doorOk | `doorLineJ`, `doorLineY` |
| — | Never greys | — | short-circuit | `alwaysAvailable`, `nativeTier=null` |

Full logic:
`available = alwaysAvailable || (progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk)`
— see `availableFromCaps()` in `export-schema-v2.ts` / `design-book-api-ui-map-v2.md` §2c.
