# D4K-frontend — design-book v2.2 implementation

Line refs are `origin/dev` = `fff0e05a`. Everything below is additive — no field was removed or renamed.

**Work list**

| Step | Task | Files |
|---|---|---|
| **5** | Types — **do this first**, Step 1 imports `HeightExtension` from it | `api/types.ts` |
| 1 | New helper module — depth row state + order-code lines | `data/order-code.ts` (new) |
| 2 | Stop stamping `selected` on the depth row | `api/hooks.ts` |
| 3 | Card: depth state row, `217+` chip, order code | `components/unit-card.tsx` |
| 4 | Drawer: same three | `components/detail-panel.tsx`, `index.tsx` |
| 6 | Three fields + a `Note` widget in the CRM authoring form | `design-book-item-dialog.tsx`, `widgets.tsx` |

Six steps, listed in build order — the numbers match the Implementation headings below, so Step 5
appears first here.

**Out of scope** — pre-existing gaps (v1→v2.0 leftovers in the drawer, per-pill greying, dead
`api/adapt.ts`). Don't touch them.

---

## 1. The rule you're implementing

Every pill row is navigation — click opens a sibling item — **except depth**. One cabinet can be *built*
at 36 / 48 / 58 / 68 cm: same product, no sibling sku. What changes is the **order code**, which the
backend now ships on the pill as `code`.

**Branch on `pill.sku`, not on the presence of `code`:**

```
pill.sku !== item.sku   →  a SEPARATE item   →  navigate (fetch the sibling), as today
pill.sku === item.sku   →  the SAME item     →  NO fetch. Set local depth state;
                                                 order code = pill.code ?? item.sku
```

`code` present ⟹ same item, **but not the converse** — a self pill needing no re-cut carries none.
Treat `code` as optional.

### ⚠️ `pill.code` is DISPLAY / COPY ONLY

Never fetch it, route to it, or build an image from it. Unlike the `P1`/`C1` tier prefixes (which the
backend *does* synthesize on read), re-cut depth codes resolve to nothing:

```
GET /design-book/items/T6080IS2IZ    → 200   ← the item
GET /design-book/items/T608036IS2IZ  → 400   ← its re-cut depth code
GET /design-book/items/P1T3080S      → 200   ← a tier prefix IS fetchable
```

The image stays on `item.sku`.

### The three row shapes (all 18,396 items measured)

**(a) MIXED — 7,415 rows, the commonest.** Item = `C1T308036S2Z`:

```json
"depth": [
  {"label":"36","sku":"C1T308036S2Z"},                     ← SELF, this item's native depth
  {"label":"48","sku":"C1T308048S2Z"},                     ← sibling → navigate
  {"label":"58","sku":"C1T3080S2Z"},                       ← sibling → navigate
  {"label":"63","sku":"C1T308036S2Z","alteration":true},   ← SELF, the 63 cm alteration
  {"label":"68","sku":"C1T308068S2Z"}                      ← sibling → navigate
]
```

**(b) ALL-SELF with re-cut codes — 2,348 rows.** Item = `T6080IS2IZ`:

```json
"depth": [
  {"label":"36","sku":"T6080IS2IZ","code":"T608036IS2IZ"},
  {"label":"48","sku":"T6080IS2IZ","code":"T608048IS2IZ"},
  {"label":"58","sku":"T6080IS2IZ","code":"T6080IS2IZ"},
  {"label":"63","sku":"T6080IS2IZ","alteration":true,"code":"T6080IS2IZ"},
  {"label":"68","sku":"T6080IS2IZ","code":"T608068IS2IZ"}
]
```

58 and 63 keep the base code on purpose — 58 is the standard depth, and 63 is an *alteration* (base
code **plus** a separate alteration code). Not a bug; don't "fix" it.

**(c) ALL-SELF without codes — 1,745 rows.** Item = `P1T1207368BS2ZTU`:

```json
"depth": [
  {"label":"63","sku":"P1T1207368BS2ZTU","alteration":true},
  {"label":"68","sku":"P1T1207368BS2ZTU"}
]
```

### Selection: by LABEL, with a native fallback

`api/hooks.ts:47-51` stamps `selected` by sku equality for every row. On an all-self depth row every
pill repeats `item.sku`, so **all five light up**.

Matching purely by label is wrong the other way: on a MIXED row it can mark a **sibling** selected, and
the selected style then makes it unclickable — blocking the navigation.

Correct:

1. `chosen` = first of `[localPick, toolbarDepth, 58]` that exists as a label in this row.
2. If the pill at `chosen` is a state pill for **this** item → select it.
3. Else (it maps to a sibling) → fall back to this item's own **native** pill = the self pill that is
   *not* the 63 alteration.

MIXED example above with toolbar D = 58: `chosen` = "58" → that's a sibling → fall back to the "36"
pill. Correct, because this item *is* the 36 cm one.

---

## 2. `heightExtension` — the `217+` chip

Tall cabinets top out at a real 217 cm unit; 230 / 244 / 250 cm are ordered as the **217 unit plus one
extra code**. Height twin of the 63 cm depth alteration: no new product, no fetch. 2,046 items.

Ships on **both** `GET /items` rows and `GET /items/:sku`:

```json
"heightExtension": {
  "sku": "MGT602178",
  "addCode": "MPHVERL",
  "options": [
    { "label": "230", "heightMm": 2304 },
    { "label": "244", "heightMm": 2436.5 },
    { "label": "250", "heightMm": 2500 }
  ]
}
```

**⚠️ The `217+` row NAVIGATES, then holds state.** It is *not* a pure state row like depth. Only the
217 cm unit can be extended, so on any shorter sibling the chips are plain navigation: clicking one
opens `heightExtension.sku` and carries the choice over. The selection lights up — and the clipboard
gains its second line — **only once you are on the 217 unit itself**. Two consequences:

- Never mark a chip `selected` while `item.sku !== heightExtension.sku`; the header would show the
  short unit's own code while a chip claimed 250 cm.
- Key the pick by `heightExtension.sku`, not by a bare label, so it survives the hop onto that unit
  instead of being wiped by the reset-on-navigate effect.

On the 217 unit, clicking the selected chip clears it — back to the plain 217 cm unit, no `MPHVERL`.
101 of the 2,046 items are the 217 units themselves, where `heightExtension.sku === sku`.

Picking one yields two clipboard lines: `MGT602178` then `MPHVERL`.

**⚠️ Do not merge these into `parameters.height`.** The HP20 panel families have **real** 230 and 250 cm
sibling products, so the labels would collide — a genuine `H230` sibling and a synthetic `230` extension
rendering as one chip with two meanings. Note the real Height row already carries the 217 sibling
(`{"label":"H217","sku":"MGT602178"}`), so `heightExtension.sku` usually equals it. Expected — the
`217+` chip is the *additional* affordance beside it.

---

# Implementation

## Step 1 — new `src/views/design-book/data/order-code.ts`

Both surfaces need identical logic. Sibling of `data/caps.ts`, same shape: pure functions, named
exports, doc-referenced JSDoc.

```ts
import { ConfigureOption, HeightExtension } from "../api/types";

/** A depth pill that changes THIS item's order code rather than opening a sibling. */
export const isDepthStatePill = (o: ConfigureOption, itemSku: string) =>
  o?.sku === itemSku || o?.code != null;

/**
 * Resolve the depth row for one item (api-ui-map-v2 §2c-1 / §2c-2).
 *
 * A depth row mixes two models: pills that OPEN A SIBLING (`sku !== itemSku`) and pills that are
 * STATE for this item (`sku === itemSku`). SELECTED is picked by LABEL — sku equality lights up
 * every self pill — falling back to the item's own native pill when the picked label maps to a
 * sibling (else that sibling renders "selected", stops being clickable, and blocks navigation).
 *
 * `orderCode` is the code to DISPLAY and COPY. Never fetch it: a re-cut depth code 400s.
 */
export function depthRowState(
  opts: ConfigureOption[] | undefined,
  itemSku: string,
  pick?: string | number | null,
  toolbarDepth?: number | null
): { options: ConfigureOption[]; orderCode: string } {
  if (!opts?.length) return { options: opts ?? [], orderCode: itemSku };

  const has = (v: unknown) =>
    v != null && opts.some((o) => String(o.label) === String(v));
  const chosen = [pick, toolbarDepth, 58].find(has);

  const at = opts.find((o) => String(o.label) === String(chosen));
  const own = opts.filter((o) => o.sku === itemSku);
  // The native pill is the self pill that is NOT the 63 cm alteration.
  const native = own.find((o) => !o.alteration) ?? own[0] ?? null;

  const selLabel =
    at && isDepthStatePill(at, itemSku) ? chosen : native?.label ?? null;

  const options = opts.map((o) => ({
    ...o,
    selected: selLabel != null && String(o.label) === String(selLabel),
  }));

  // `code` is absent on 58 and on the 63 alteration — both keep the base code.
  return { options, orderCode: options.find((o) => o.selected)?.code ?? itemSku };
}

/** A `217+` pick, keyed by the 217 unit it belongs to so it survives the hop onto that unit. */
export type HeightExtPick = { sku: string; label: string | number } | null;

/** The "217+" row as chips, so it renders through the existing ChipRow / CfgRow. */
export function heightExtOptions(
  hx: HeightExtension,
  itemSku: string,
  pick?: HeightExtPick
): ConfigureOption[] {
  // Only the 217 unit can BE extended. On a shorter sibling the row is pure navigation, so nothing
  // is selected there — a lit chip beside that unit's own unextended code reads as a lie.
  const here = itemSku === hx.sku;
  return hx.options.map((o) => ({
    label: o.label,
    sku: hx.sku,
    selected:
      here && pick?.sku === hx.sku && String(pick.label) === String(o.label),
  }));
}

/**
 * The order code as clipboard lines (api-ui-map-v2 §2c-3). A height extension orders the 217 cm
 * unit + `addCode`, but only once we are ON that unit; otherwise it's the depth-resolved code.
 * Line 0 is what the UI displays.
 */
export function orderCodeLines(a: {
  sku: string;
  depthCode?: string;
  heightExtension?: HeightExtension;
  heightExtPick?: HeightExtPick;
}): string[] {
  const hx = a.heightExtension;
  if (hx && a.sku === hx.sku && a.heightExtPick?.sku === hx.sku)
    return [hx.sku, hx.addCode];
  return [a.depthCode ?? a.sku];
}
```

## Step 2 — `api/hooks.ts`

> **`configure` here is NOT the dead v1 API field — don't "modernise" it to `parameters`.** The API
> sends only `parameters`; `withConfigure()` / `paramsToConfigure()` adapt it once into the internal
> `configure` shape every component reads. That adapter earns its keep: it groups the flat
> `parameters.options[]` into `optionRows` by `group`, and maps programme pills' `tier` onto `label`.
> Swapping the components to read `parameters` directly would break both and is out of scope.
> (The authoring form in Step 6 is the exception — it edits the raw API shape, so it uses
> `form.parameters.*`.)

Depth selection depends on runtime state the hook layer doesn't have. Leave the row raw.

```diff
 function paramsToConfigure(p: any, sku?: string): any {
   if (!p) return undefined;
   return {
     width: markSel(p.width, sku),
     height: markSel(p.height, sku),
-    depth: markSel(p.depth, sku),
+    // Depth is a STATE row — `selected` is resolved per-component by LABEL via
+    // `depthRowState()` (data/order-code.ts). Sku equality lights up every self pill.
+    depth: (p.depth ?? []).map((o: any) => ({ ...o })),
     // v2 programme pills carry `tier`; the card chip renders `label`.
     programme: markSel(p.programme, sku).map((o: any) => ({
       ...o,
       label: o?.label ?? o?.tier,
     })),
     optionRows: groupOptions(p.options, sku),
   };
 }
```

`markSel` stays correct for width / height / programme / options — the backend audit measured **0 rows
with a duplicated sku and 0 rows with more than one self pill** outside `depth`.

## Step 3 — `components/unit-card.tsx`

**3a. `Chip` / `ChipRow` must pass the option to the handler.** On an all-self row the sku alone can't
identify which pill was clicked. Widen the existing callback rather than adding a component — all four
current callers ignore the second arg, so nothing else changes.

`Chip` (`:58-104`) and `ChipRow` (`:106-138`) prop types:

```diff
-  onPick: (sku: string) => void;
+  onPick: (sku: string, opt: ConfigureOption) => void;
```

`Chip` `onClick` (`:81-84`):

```diff
       onClick={(e) => {
         e.stopPropagation();
-        if (opt.sku && opt.available !== false) onPick(opt.sku);
+        if (opt.sku && opt.available !== false) onPick(opt.sku, opt);
       }}
```

`ChipRow` already forwards `onPick` unchanged. `FinishChip`/`FinishRow` (`:153-223`) share the type —
widen them the same way or leave them on the single-arg signature (structurally compatible).

**3b. Import** — add beside the existing `import { availableFromCaps } from "../data/caps";` (`:16`):

```ts
import {
  depthRowState,
  heightExtOptions,
  isDepthStatePill,
  orderCodeLines,
  type HeightExtPick,
} from "../data/order-code";
```

**3c. Local state**, next to `const [curSku, setCurSku] = useState(card.sku);` (`:297`):

```tsx
const [depthPick, setDepthPick] = useState<string | number | null>(null);
const [hextPick, setHextPick] = useState<HeightExtPick>(null);
// A sibling swap is a different product — the depth row starts fresh. The 217+ pick is NOT reset
// here: it carries the user onto the 217 unit, so wiping it on `curSku` would erase the choice
// mid-navigation. It is keyed by its own sku instead, which makes it self-invalidating elsewhere.
useEffect(() => {
  setDepthPick(null);
}, [curSku]);
```

**3d. Derive**, after the `cfg` block and `const cardOk = …` (`:349-365`):

```tsx
const depthState = depthRowState(cfg?.depth, active.sku, depthPick, toolbar.depth);
const codeLines = orderCodeLines({
  sku: active.sku,
  depthCode: depthState.orderCode,
  heightExtension: active.heightExtension,
  heightExtPick: hextPick,
});
const orderCode = codeLines[0]; // display + clipboard — NEVER fetch
```

**3e. Handlers**, next to `pickSku` (`:365`):

```tsx
const pickDepth = (sku: string, opt: ConfigureOption) => {
  if (!cardOk) return;
  // SAME item — no fetch, no route, the image does not change.
  if (isDepthStatePill(opt, active.sku)) return setDepthPick(opt.label);
  setCurSku(sku); // sibling → navigate, exactly as today
};
const pickHext = (_sku: string, opt: ConfigureOption) => {
  const hx = active.heightExtension;
  if (!cardOk || !hx) return;
  // Off the 217 unit the chip is navigation: remember the choice, then swap onto that unit.
  if (active.sku !== hx.sku) {
    setHextPick({ sku: hx.sku, label: opt.label });
    return setCurSku(hx.sku);
  }
  // On it, it is state — re-clicking the selected chip clears back to the plain 217 cm unit.
  setHextPick(opt.selected ? null : { sku: hx.sku, label: opt.label });
};
```

**3f. Rows.** Depth (`:586-591`):

```diff
 <ChipRow
   label="D"
-  opts={cfg?.depth}
-  onPick={pickSku}
+  opts={depthState.options}
+  onPick={pickDepth}
   accentFor={selectedAccent}
 />
```

`217+`, appended right after the H row (`:573-579`):

```tsx
{active.heightExtension && (
  <ChipRow
    label="217+"
    opts={heightExtOptions(active.heightExtension, active.sku, hextPick)}
    onPick={pickHext}
    accentFor={selectedAccent}
  />
)}
```

**3g. Order code** — `:545`, `:405`, `:616`:

```diff
-          <span className="font-mono text-xs text-gray-700">{active.sku}</span>
+          <span className="font-mono text-xs text-gray-700">{orderCode}</span>
```
```diff
   const copyCode = async () => {
     clip.add(itemKey); // clipboard collection stores the sku
     try {
-      await navigator.clipboard.writeText(active.sku); // OS clipboard gets the code
+      await navigator.clipboard.writeText(codeLines.join("\n")); // OS clipboard gets the ORDER code
```
```diff
-            <IconBtn title={`Copy ${active.sku}`} onClick={copyCode}>
+            <IconBtn title={`Copy ${orderCode}`} onClick={copyCode}>
```

`clip.add(itemKey)` stays on the **sku** — the clipboard *collection* is keyed by sku (what `GET /items`
resolves its rows by). Only the OS clipboard string changes.

**Do not touch `:481`** (`code={active.sku}` → the image).

**3h. Verify, don't change:** `:381-383` (`cfg?.height?.find((o) => o.selected)` → the carcase-line
underline) still relies on `markSel`. Height rows have exactly one self pill, so it stays correct after
the split — just confirm the accent still paints.

## Step 4 — `components/detail-panel.tsx` + `index.tsx`

**4a.** New prop, matching the existing `toeKick` pattern (`:34-45`):

```diff
 interface Props {
   sku: string | null;
   toeKick?: number; // cm — from the top toolbar
+  depth?: number;   // cm — the toolbar D class, seeds the depth row's selected pill
   onClose: () => void;
```

`index.tsx:403-412`:

```diff
         <DetailPanel
           sku={detailSku}
           toeKick={filters.toeKick}
+          depth={typeof filters.depth === "number" ? filters.depth : undefined}
           onClose={() => setDetailSku(null)}
```

...and destructure it in the component signature (`:603-612`):

```diff
 const DetailPanel = ({
   sku,
   toeKick,
+  depth,
   …
 }: Props) => {
```

**4b. Import** — add beside the other `../data/…` imports:

```ts
import {
  depthRowState,
  heightExtOptions,
  isDepthStatePill,
  orderCodeLines,
  type HeightExtPick,
} from "../data/order-code";
```

**4c.** `CfgChip` / `CfgRow` (`:155-201`) get an optional pick handler, so the other four `CfgRow` call
sites are untouched:

```diff
   opt: ConfigureOption;
   onOpen: (sku: string) => void;
+  onPick?: (opt: ConfigureOption) => void;
 }) => (
```
```diff
-    onClick={() => opt.sku && onOpen(opt.sku)}
+    onClick={() => {
+      if (onPick) return onPick(opt);
+      if (opt.sku) onOpen(opt.sku);
+    }}
```

`CfgRow` takes the same optional prop and forwards it.

**4d.** `Configure` (`:203-232`) — pass the resolved depth row and the extension row through:

```diff
-function Configure({ cfg, onOpen }: { cfg?: ItemConfigure; onOpen: (sku: string) => void }) {
+function Configure({
+  cfg,
+  depthOpts,
+  hextOpts,
+  onOpen,
+  onPickDepth,
+  onPickHext,
+}: {
+  cfg?: ItemConfigure;
+  depthOpts?: ConfigureOption[];
+  hextOpts?: ConfigureOption[];
+  onOpen: (sku: string) => void;
+  onPickDepth: (o: ConfigureOption) => void;
+  onPickHext: (o: ConfigureOption) => void;
+}) {
```
```diff
       <CfgRow label="Height" opts={cfg.height} onOpen={onOpen} />
+      {hextOpts?.length ? (
+        <CfgRow label="217+" opts={hextOpts} onOpen={onOpen} onPick={onPickHext} />
+      ) : null}
-      <CfgRow label="Depth" opts={cfg.depth} onOpen={onOpen} />
+      {/* onPick fires for EVERY depth pill; onPickDepth branches state vs navigate. */}
+      <CfgRow
+        label="Depth"
+        opts={depthOpts ?? cfg.depth}
+        onOpen={onOpen}
+        onPick={onPickDepth}
+      />
```

Depth can't use a blanket "don't navigate" handler — the row mixes both models — so `onPickDepth` takes
every click and falls through to `onOpen` for sibling pills (see 4d).

**4e.** Panel state + derivation, with the other derived blocks (`:663-675`):

```tsx
const [depthPick, setDepthPick] = useState<string | number | null>(null);
// Not reset on `sku` — a 217+ pick navigates to the 217 unit and must survive the trip (§2).
const [hextPick, setHextPick] = useState<HeightExtPick>(null);
useEffect(() => {
  setDepthPick(null);
}, [sku]);

const depthState = item
  ? depthRowState(cfg?.depth, item.sku, depthPick, depth)
  : null;
const codeLines = item
  ? orderCodeLines({
      sku: item.sku,
      depthCode: depthState?.orderCode,
      heightExtension: item.heightExtension,
      heightExtPick: hextPick,
    })
  : [];
const orderCode = codeLines[0] ?? "";

const onPickDepth = (o: ConfigureOption) => {
  if (item && isDepthStatePill(o, item.sku)) return setDepthPick(o.label);
  if (o.sku) onOpen(o.sku);
};
const onPickHext = (o: ConfigureOption) => {
  const hx = item?.heightExtension;
  if (!hx) return;
  if (item.sku !== hx.sku) {
    setHextPick({ sku: hx.sku, label: o.label });
    return onOpen(hx.sku); // the drawer's own navigation — same call the sibling pills use
  }
  setHextPick(o.selected ? null : { sku: hx.sku, label: o.label });
};
```

**4f. The `<Configure>` call site** (`:859`) — the only place it is rendered:

```diff
-              <Configure cfg={item.configure} onOpen={onOpen} />
+              <Configure
+                cfg={item.configure}
+                depthOpts={depthState?.options}
+                hextOpts={
+                  item.heightExtension
+                    ? heightExtOptions(item.heightExtension, item.sku, hextPick)
+                    : undefined
+                }
+                onOpen={onOpen}
+                onPickDepth={onPickDepth}
+                onPickHext={onPickHext}
+              />
```

**4g.** Header + copy — `:793-795` and `:647`:

```diff
                 <span className="font-mono text-sm font-semibold text-gray-800">
-                  {item.sku}
+                  {orderCode}
                 </span>
```
```diff
     clip.add(itemKey);
     try {
-      await navigator.clipboard.writeText(item.sku);
+      await navigator.clipboard.writeText(codeLines.join("\n"));
```

## Step 5 — `api/types.ts`

```diff
 export interface ConfigureOption {
   label: string | number;
   sku?: string;
   selected?: boolean;
   available?: boolean;
   crossedOut?: boolean;
   capabilities?: Capabilities;
+  /** DEPTH pills only: the re-cut ORDER CODE. DISPLAY/COPY ONLY — it 400s if fetched. */
+  code?: string;
+  /** The 63 cm depth pill (base code + a separate alteration code), not a real depth. */
+  alteration?: boolean;
 }
```
```diff
 export interface ParameterOption {
   …
   alteration?: boolean;
+  code?: string;
 }
```
```diff
+/** The "217+" chip: order the 217 cm unit + `addCode` — no sibling product. */
+export interface HeightExtension {
+  sku: string;
+  addCode: string; // "MPHVERL"
+  options: { label: string; heightMm: number }[];
+}
+
 export interface ItemCard {
   …
+  doorLineYCode?: string;
+  heightExtension?: HeightExtension;
 }

 export interface ItemDetail {
   …
+  doorLineYCode?: string;
+  heightExtension?: HeightExtension;
 }
```

`doorLineYCode` (11 items) is typed but **not rendered** — `data/caps.ts:53-65` hard-codes
`doorline: ""`, so this frontend has no control that can trigger it. It exists for the authoring form
below. (If a door-line control is ever added: when line Y is active `orderCode = item.doorLineYCode`,
and it **outranks** the depth re-cut.)

## Step 6 — CRM authoring form

`src/views/lead-management-view/modules/design-book-item-management/design-book-item-dialog.tsx`.

> **This form already exists as a reference implementation** in the backend admin UI
> (`D4K-backend/public/design-book-admin.html`, served at `GET /design-book/admin`), built alongside
> today's backend change. **Port it — labels, placeholders, and the explanatory notes verbatim.** The
> notes are the point: without them an author "fixes" the repeated depth sku and silently breaks the row.
> Open the admin UI side by side while doing this.

**6a. `Note` widget** — `widgets.tsx` has `Section` (title + subtitle), `Field` (label + one-line
`hint`), `CheckGroup`, `TagInput`, `ToggleCard`, `RowList`. There is no multi-line callout, and the
blocks below need one. Add it next to `Field` (`:30-44`), matching the file's style:

```tsx
/** Multi-line authoring guidance. `tone="warn"` for "don't "fix" this" hazards. */
export const Note: React.FC<{
  tone?: "info" | "warn";
  children: React.ReactNode;
}> = ({ tone = "info", children }) => (
  <div
    className={
      "mb-2 rounded-md border-l-2 px-3 py-2 text-xs leading-relaxed " +
      (tone === "warn"
        ? "border-amber-500 bg-amber-50 text-amber-900"
        : "border-gray-300 bg-gray-50 text-gray-600")
    }
  >
    {children}
  </div>
);
```

**6b. Depth `code` column + the two notes** (`:500-510`). The column is one line; the notes are the
reason the column is understandable.

```diff
-              <Field label="depth (D)">
+              <Field
+                label="depth (D)"
+                hint="the one row where a pill may NOT open another product"
+              >
+                <Note tone="warn">
+                  <b>⚠ A repeated sku down this row is CORRECT — don’t “fix” it.</b> Depth works two
+                  ways, and one row can hold both:
+                  <br />• <b>Same product, built deeper</b> — the pill stays on this item and only the{" "}
+                  <b>order code</b> changes (<code>T6080IS2IZ</code> at 36 → <code>T608036IS2IZ</code>).
+                  Put <b>this item’s own sku</b> in <i>target sku</i> and the re-cut code in <b>code</b>.
+                  Those codes are not separate products, so there is nothing to link to.
+                  <br />• <b>A separate product per depth</b> — the pill opens a different unit
+                  (<code>C1T3080S2Z</code> at 68 → <code>C1T308068S2Z</code>). Put the{" "}
+                  <b>sibling’s sku</b> in <i>target sku</i> and leave <b>code</b> blank.
+                  <br />
+                  Rule of thumb: <b>target sku = this item ⇒ same product</b> (order code = <i>code</i>,
+                  or the sku if blank); <b>target sku = another code ⇒ separate product</b>. The <b>63</b>
+                  pill is always “same product” — 63 cm is the base cabinet plus alteration codes
+                  (ANTSP63US · MPRU …), never a different code.
+                </Note>
+                <Note>
+                  ⚠ These pills do <b>not</b> control the D filter or greying — <b>capabilities ·
+                  depthClasses</b> does. Adding a “68” pill here will <b>not</b> make this product show
+                  under D 68; tick 68 in depthClasses. Removing a pill will not hide it.
+                </Note>
                 <RowList
                   addLabel="depth pill"
                   cols={[
                     { key: "label", placeholder: "label (63)" },
                     { key: "sku", placeholder: "target sku" },
+                    { key: "code", placeholder: "order code @ this depth" },
                     { key: "alteration", placeholder: "63cm alteration", type: "checkbox" },
                   ]}
                   value={form.parameters?.depth || []}
                   onChange={(v) => setParam("depth", v)}
                 />
               </Field>
```

**6c. `doorLineYCode`** — beside `faceForTiers` (`:382-389`). Keep the admin's tooltip as the `title`:

```tsx
<Field label="doorLineYCode" hint="Y replaces the whole code">
  <input
    className={inputCls}
    placeholder="e.g. MGT60146Y"
    title={
      "Order code when door-line Y is picked. Y REPLACES the whole code (unlike V/E/J/P1/C1, " +
      "which are prefixes/suffixes on the sku), so it cannot be derived — type it. Set " +
      "capabilities · doorLineY too: that flag is the gate, this is the code."
    }
    value={form.doorLineYCode || ""}
    onChange={(e) => set("doorLineYCode", e.target.value)}
  />
</Field>
```

**6d. `heightExtension`** — place it between the height and depth rows, as in the admin UI (the chip
belongs to the Height row). Screenshot of the reference implementation is in the ticket.

```tsx
<Field
  label="heightExtension"
  hint="the &quot;217+&quot; chip appended to the height row (Tall only)"
>
  <Note>
    Tall products whose family has an orderable <b>217 cm</b> unit can be built{" "}
    <b>taller than 217</b>. That is not a separate product: picking 230 / 244 / 250 orders the{" "}
    <b>217 cm unit plus an added code</b> (<code>MPHVERL</code>) — the height twin of the 63 cm depth
    alteration. Put the <b>217 cm unit’s sku</b> in <i>217 cm sku</i> and the added code in{" "}
    <i>addCode</i>.
    <br />
    Leave the whole block empty on anything that is not Tall, or whose family has no 217 cm unit.
    <br />
    <b>Why it is not just three more height pills:</b> some families (the HP20 panels) ALSO have{" "}
    <b>real</b> 230 / 250 cm sibling products, so the labels would collide — one “230” that opens a
    product, another that extends this one.
  </Note>
  <div className="mb-2 grid grid-cols-1 gap-3 md:grid-cols-2">
    <Field label="217 cm sku">
      <input
        className={inputCls}
        placeholder="e.g. HP20217"
        value={form.heightExtension?.sku || ""}
        onChange={(e) => setNested("heightExtension", "sku", e.target.value)}
      />
    </Field>
    <Field label="addCode">
      <input
        className={inputCls}
        placeholder="MPHVERL"
        value={form.heightExtension?.addCode || ""}
        onChange={(e) => setNested("heightExtension", "addCode", e.target.value)}
      />
    </Field>
  </div>
  <RowList
    addLabel="extension height"
    cols={[
      { key: "label", placeholder: "label (230)", width: "basis-24 grow-0" },
      { key: "heightMm", placeholder: "height in mm (2304)", type: "number" },
    ]}
    value={form.heightExtension?.options || []}
    onChange={(v) => setNested("heightExtension", "options", v)}
  />
</Field>
```

**6e. Submit rule for `heightExtension`.** `prune()` (`:71-86`) drops empty strings and empty objects,
but a half-filled extension (a sku with no options, or options with no sku) is not usable and must not
reach the API. The admin UI enforces this in `collectHeightExtension()`; mirror it — in the submit
path, before `prune`:

```ts
// The "217+" chip is only meaningful as a whole: require a sku AND at least one option,
// else drop the block. `addCode` defaults to MPHVERL (the only value in the catalog).
const hx = form.heightExtension;
const hxOpts = (hx?.options || []).filter((o: any) => o?.label !== "" && o?.label != null);
body.heightExtension =
  hx?.sku && hxOpts.length
    ? {
        sku: hx.sku,
        addCode: hx.addCode || "MPHVERL",
        options: hxOpts.map((o: any) => ({
          label: String(o.label),
          heightMm: Number(o.heightMm),
        })),
      }
    : undefined;
```

`doorLineYCode` and the depth `code` need no special handling — `prune()` covers them. The backend
`UpsertItemDto` already accepts all three.

---

# Check

| # | Do | Expect |
|---|---|---|
| 1 | Open `T6080IS2IZ` (all-self, 5 depth pills) | **exactly one** pill selected (58) — five today |
| 2 | Click depth **36** | **no network request**; code line + Copy tooltip show `T608036IS2IZ`; image unchanged |
| 3 | Click depth **63** | code stays `T6080IS2IZ` (alteration keeps the base code) |
| 4 | Open `C1T308036S2Z` (MIXED) with toolbar D = 58 | the **36** pill is selected (58 → sibling → native fallback) |
| 5 | On it, click depth **48** | fetch fires, swaps to `C1T308048S2Z` — not stuck "selected" |
| 6 | Open `P1T1207368BS2ZTU` (all-self, no codes) | 68 selected; code stays the sku |
| 7 | Devtools: `GET /design-book/items/T608036IS2IZ` | **400** — why `code` is never fetched |
| 8 | Open `MGT601468` | `217+` row under Height → 230 / 244 / 250, **none selected** (not the 217 unit) |
| 9 | Pick 244 | navigates to `MGT602178`; there 244 is selected; Copy = `MGT602178\nMPHVERL` |
| 10 | Re-click 244 (on `MGT602178`) | deselects, code back to `MGT602178` alone |
| 10b | From `MGT602178` open `MGT601468` again | still nothing selected on the source row |
| 11 | CRM → Design Book Item → edit `MGT601468` | `doorLineYCode` = `MGT60146Y`; `217 cm sku` = `MGT602178`, `addCode` = `MPHVERL`, 3 option rows; save round-trips unchanged |
| 12 | Edit `T6080IS2IZ`, depth row | 5 rows, all with the item's own sku, `code` filled on 36/48/68; both depth notes render |
| 13 | Clear `217 cm sku`, leave the option rows, save | `heightExtension` is omitted from the request, not sent half-filled |

Two backend fixes shipped today need **no code** — retest only: clicking Insert `M8` on `ZIGSUV20`
should now swap to `ZIGSUV20U` (was a dead control), and the `P1`/`C1` tier badges should now resolve
(the backend's synthesis lookup was querying a dead field name and 400'd).

Ground truth: `d4k-items-extraction/docs/design-book-api-ui-map-v2.md` **§2c-1** (selected state),
**§2c-2** (the two depth models), **§2c-3** (the whole order-code surface), **§2c-4** (the depth-pill
click handler).
