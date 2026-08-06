# The `NNN PTS` pill — backend has it, the client never wired it (2026-08-06)

**Status: OPEN, frontend-only.** No backend change, no data change, no contract change. Everything
below was measured against D4K-dev and against the v781 app on the same day; nothing here is inferred.

The app draws a points pill on every grid card once a programme is picked — bottom-right, beside the
FRONTS tier badge. Our React client draws nothing. The number is already on the wire and it is
already correct.

---

## 1. What the backend serves

| field | where | when |
|---|---|---|
| `pts` | `GET /design-book/items` (list + `groupBy=family`) on the card | only when **exactly one** programme is priced |
| `priceUnit` | same, and on every ref | always — it is a stored per-item field |
| `refs[sku].pts` | `GET /design-book/items/:sku?expand=all\|refs` | only when the request carries **`priceProgram=`** |

**`pts` is DISPLAY-READY.** `ptsAddFields` already applies the app's `unitField` + `ptsCeil` — the
÷100 book scale and the round-up — so the number you get is the number the app prints. Verified
against v781 @ BOSSA (programme id `244`, `priceField 7`):

```
GET items?sku=T6080&programs=244   → pts 573, priceUnit "pts"      app card: "573 PTS"
GET items?sku=FSUL&programs=244    → pts  84, priceUnit "pts"      app card: "84 PTS"
GET items/T6080?expand=all&priceProgram=244
                                   → refs.ANST.pts 137 · refs.IGS6058.pts 154
```

Two rules that decide whether the pill exists at all:

* **One priced programme.** `resolvePriceField` takes `priceProgram`, else `programs[0]` **only when
  `programs.length === 1`**. No programme, or several, → `pts: null`, and the app shows no pill
  either. This is not a bug to route around.
* **The unit is `priceUnit`, not the literal "pts".** Stored per item: `"pts"` for cabinets, `"HLP"`
  for handles (IDM calc groups 15/38/61). Print `{pts} {priceUnit}`.

`pts` is `null` for an item with no finish prices. Render nothing, not `—`.

---

## 2. What the client is missing

| # | gap | file |
|---|---|---|
| 1 | `itemCardSchema` has no `pts` / `priceUnit`, so the fields are dropped before any component sees them | `src/views/design-book/api/types.ts` (~`:455`) |
| 2 | no component renders a points pill on a grid card — `grep formatPoints src` hits **one** file, `accessory-cards.tsx` | `src/views/design-book/components/unit-card.tsx` |
| 3 | the drawer's accessory card CAN draw points, but reads `item.pricePoints` while the API sends `ref.pts` — the names never met, so it has always been blank | `accessory-cards.tsx:80`, `detail-panel.tsx` `refListItems` / `toAccessoryItems` |
| 4 | the detail query sends `programs=`, and the detail endpoint prices refs off **`priceProgram=`** — so `refs[*].pts` is null on every drawer request we make | `src/views/design-book/api/catalog.ts:310` `itemDetailQueryOptions` |

⚠️ **`formatPoints` would double-scale.** `data/constants.ts:86` divides by 100 ("account points
arrive at a 2-decimal scale") — that is the `memberSchema.pricePoints` convention, NOT `pts`. Passing
`pts` through it prints `6` where the app prints `573`. Either bypass it or give the card a
display-ready field; do not "fix" `formatPoints` without checking `members[]`.

---

## 3. The work

1. **`types.ts`** — add to `itemCardSchema`:
   ```ts
   /** The card's point value for the priced programme — DISPLAY-READY, never ÷100 (`pts`). */
   pts: num,
   /** "pts" | "HLP" — the unit that goes next to it, stored per item. */
   priceUnit: text,
   ```
   Do **not** add `pts` to `itemDetailSchema`: `getItem` never prices the item itself, only its refs.

2. **`unit-card.tsx`** — render the pill in the card's bottom-right row, beside the tier badges
   (`~:1370-1395`), from `active.pts`. Hide it when `pts == null`. The app's shape is a small grey
   pill, number bold, unit small-caps: `573 PTS`. It comes from the swapped-in card like everything
   else on the card, so read `active`, not `card`.

3. **List query** — nothing to do. `params.ts:90` already sends `programs`, and the backend prices
   when there is exactly one. Confirm by eye: pick one programme → pills appear; pick two → they
   vanish, which is also what the app does.

4. **Drawer refs** — teach `itemDetailQueryOptions` to send `priceProgram` when exactly one programme
   is selected (it already receives `programs?: string[]`; add `&priceProgram=` when
   `programs.length === 1`). Keep `programs=` as well — it is what greys the pills.

5. **Accessory rows** — map the ref's price through in BOTH builders in `detail-panel.tsx`
   (`refListItems`, and `toAccessoryItems` for the legacy path): `pricePoints: ref.pts`,
   `priceUnit: ref.priceUnit`. Then in `accessory-cards.tsx` print the number as-is with its unit
   instead of `formatPoints(...) pts` — see the double-scale warning above.

## 4. Check it

With BOSSA (`244`) selected:

* grid card `T6080` reads **573 PTS**, `FSUL` reads **84 PTS** — same as v781 with the same programme.
* clear the programme → both pills disappear (`pts: null`).
* select two programmes → pills disappear (one priced programme only).
* a Handles card prints **HLP**, not PTS.
* open `T6080`'s drawer → the Alterations rows carry points (`ANST` 137), which they do not today
  because of gap #4.
