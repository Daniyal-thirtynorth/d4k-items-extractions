/**
 * LEICHT Designer Instrument — canonical export schema (DRAFT v2)
 * ==============================================================
 * Modelled from the live v765 detail panel — every section inspected in-browser
 * and cross-checked against the source render code (`openDetail`, line 5111).
 *
 * HOW TO READ THIS FILE
 *   Each block below is one part of the app. The `// UI:` lines say, in simple words,
 *   what the user sees on screen for that part. The other `//` lines say what to put
 *   in the field. If you build the export, match these types exactly.
 *
 * ── MENTAL MODEL ────────────────────────────────────────────────────────────
 *   categories → subcategories → sections → cards. A grid CARD = a FAMILY of items (siblings
 *   that share `familyId`; the card's W/H/D/Programme pills switch between them, one is the "face").
 *   An ITEM is one orderable code (SKU). Everything the detail screen shows for an
 *   item hangs off the item: the W/H/D/Programme pills, description, the alterations
 *   & accessories tabs, engineering flags, specification, restrictions, modifications,
 *   planning notes, catalog binding, and the recommendation card groups.
 *
 * ── THE ONE BIG RULE: NORMALISE. EVERYTHING IS AN ITEM. ─────────────────────
 *   Every code the UI shows — a pill's target, an accessory/alteration card, a card
 *   variant, a modification code, a "compatible accessory", a companion — is a
 *   REFERENCE to another item (by its SKU). Store it as an `ItemRef { sku, … }`, never
 *   as a duplicated object.
 *
 *   WHY (measured on the current export):
 *     • 1,804 distinct card codes generate 220,367 card instances → ~122× duplication.
 *       One code (ANST) appears on 11,001 units. 94% of codes appear on >1 unit.
 *     • The card image is 100% derivable: `imageUrlTemplate` with the code. Storing it
 *       per instance is pure waste.
 *     • 1,453 of 1,804 card codes ARE already catalog SKUs, each with its own
 *       name / description / image. Embedding restates data we already hold.
 *     • Only 351 card codes + 457 variant codes are NOT catalog SKUs (mats, liners,
 *       bundle/set codes). Those still become items here — sourced from the panel —
 *       so `items[]` is the single home for EVERY code (`kind` tells them apart).
 *
 *   Net: one `Item` per code, keyed by `sku`. Every reference site carries only
 *   `{ sku, label?, variants? }` — `label` only when the context name differs from the
 *   item's own name (true for ~42% of codes: a short generic label vs a descriptive one).
 *   Name / image / rich description live once, on the item.
 *
 * ── UNITS ──────────────────────────────────────────────────────────────────
 *   Physical dimensions are MILLIMETRES unless a field says otherwise. Chip LABELS in
 *   the UI show cm; we store mm and keep the cm label. Prices are NOT in this export —
 *   they are programme-dependent; the backend computes them from the price matrix.
 *
 * ── VERSIONING ─────────────────────────────────────────────────────────────
 *   `meta.schemaVersion` gates ingests. The client can re-export new item data any time;
 *   the backend upserts by `sku` and marks missing codes inactive.
 *
 * ── NAMING (one rule per concept — kept consistent across EVERY field) ───────
 *   • `sku`      — ANY field that points at an item's order code: a ref, a pill target, a
 *                  variant button, a modification code. An Item's own primary key is `sku`.
 *   • `id`       — a NON-item entity's stable identifier (Category, Subcategory, Programme).
 *   • `key`      — a value from a FIXED set, used as a discriminator (EngineeringFlag.key,
 *                  RelatedGroup.key). NOT an entity id.
 *   • `name`     — an entity's canonical name (Category, Programme, Item).
 *   • `label`    — short text on a control / ref (a pill, tab, variant, mod code); on an
 *                  ItemRef it overrides `name` only when the shown text differs.
 *   • `heading`  — a section's on-screen heading; `notes[]` — the free lines above its cards.
 *   • `*Mm`      — a length in millimetres (number); chip `label`s keep the cm text.
 *   • `imageUrl` / `urlTemplate` — URLs. Card/item images are NOT stored — build them from
 *                  `meta.imageUrlTemplate`; only Swatch + Catalog carry literal URLs.
 */

/* ═══════════════════════════ Top level ═══════════════════════════ */
// UI: the whole app in one file — the sidebar tree (categories), the top-bar programme
// list, and every product card (items).

export interface CatalogExport {
  meta: ExportMeta;
  categories: Category[];      // the left sidebar tree (Base, Tall, Wall, …)
  programmes: Programme[];     // the 120 kitchen lines listed in the top-left SELECT DROPDOWN
                               // ("No programme · point range"); the P / P1 / C / C1 / A tiers live here
  ruleTables?: RuleTables;     // handle / opening / lighting / carcass-colour reference tables (passthrough)
  functionalCategories?: Sidebar; // the "Design Tasks" LEFT SIDEBAR, render-ready (Designer Inspiration +
                               //   All categories + zones→groups→leaves + More categories) — a SECOND nav,
                               //   distinct from `categories[]` (the type taxonomy). See below.
  items: Item[];               // EVERY code = one item (cabinets, alterations, accessories, parts)
}

export interface ExportMeta {
  // UI: not shown on screen — info about the file itself.
  generated: string;           // when the file was made (ISO datetime)
  source: string;              // which app build it came from, e.g. "leicht_units v765 (headless run)"
  schemaVersion: string;       // e.g. "1.0.0" — bump when this shape changes
  // HOW IMAGES WORK — images are NEVER stored per card/item, they are BUILT from the SKU.
  //   imageUrl = imageUrlTemplate.replace("<CODE>", sku)
  //   e.g. VSF135ADP -> ".../itemData/VSF135ADP.jpg"
  //   The card only carries { sku }; the picture needs no DB read and no join — sku alone
  //   plus this one template is enough. (This is WHY we don't duplicate an image field 18k×.)
  //   The OTHER card fields (name / dims / description) DO come from the item record: resolve
  //   ItemRef.sku -> items[] (Mongo $lookup on `sku`, or the backend `resolve`/ItemRef path).
  //   Only Swatch.image and Catalog.urlTemplate hold literal URLs (different hosts, not derivable).
  imageUrlTemplate: string;    // how to build any image link: ".../itemData/<CODE>.jpg"
  counts: {
    items: number;
    cabinets: number;          // kind === "cabinet"
    accessories: number;       // kind !== "cabinet"
    categories: number;
    programmes: number;
  };
  note?: string;
}

/* ═══════════════════════════ Category tree ═══════════════════════════ */
// UI: the LEFT SIDEBAR. Top items = categories (Base, Tall, Wall, Midway…). Click one
// to filter the grid. Under a category sit its sub-categories.

export interface Category {
  id: string;                  // stable slug, e.g. "base"
  name: string;                // the sidebar label, "Base"
  itemCount: number;           // the number shown next to it in the sidebar
  subcategories: Subcategory[];
}

export interface Subcategory {
  // UI: the smaller items nested under a category in the sidebar (the TYPE taxonomy —
  // Base → Doors / Sinks / Cooktops & Downdrafts / Appliance housing / …). NOT the
  // Water/Cooling/Cooking functional buckets — those are `functionalCategories` below.
  id: string;                  // "sinks"
  name: string;                // e.g. "Sinks", "Appliance housing", "Cooktops & Downdrafts"
  itemCount: number;
  sections?: string[];         // the on-grid section HEADERS for this sub, IN RENDER ORDER — the grid stacks
                               //   its cards under these (Item.section), e.g. Cooktops & Downdrafts → "Cooktop
                               //   Units" → "Cooktop Unit with Drawers" → "Downdraft & Cooktop Units - …".
}

/* ═══════════════════════════ Functional "Design Tasks" sidebar ═══════════════════════════ */
// UI: the app's PRIMARY left sidebar (the screenshot) — NOT the type taxonomy above. Top to bottom:
//   ✨ Designer Inspiration  ·  All categories (count 1714)  ·  then per ZONE
//   (Base / Tall / Wall / Midway) a header with a count, expanding into functional GROUPS
//   (💧 Water · ❄ Cooling · 🔥 Cooking · Storage · Layout · Design · Ventilation), each opening
//   an "All <zone> <group>" row + LEAVES (Water → Sink Cabinets · Trash Pullouts · Dishwasher
//   Fronts · Sinks & Faucets · Sink Accessories)  ·  then a "More categories" list (the non-zone
//   type categories: Alteration · Handles · Lighting · Service · Accessories & interior · … ).
// This `Sidebar` is render-ready and reproduces the app 1:1, including its COUNTS (see below).
//
// COUNTS come from TWO different app formulas (matched exactly, all UNFILTERED — no programme/width):
//   • zone header + moreCategories = families whose TYPE category f.cat === that name (includes hidden).
//   • group + "All X" + leaf        = `taskCount`: NON-hidden families matching (an item's family is
//     hidden ⇒ it never shows here). Group dedups a family across its leaves.
//   • allCategories.count           = total families (FAMS.length).
//
// A leaf claims an item if ANY of its MATCH RULES matches (source fn `famInTaskSub`):
//     category === rule.category           (required)
//     && (!rule.zone       || itemZone === rule.zone)           // zone defaults "Base"
//     && (!rule.subcategory|| item.subcategory === rule.subcategory)
//     && (!rule.sectionInclude || RegExp(sectionInclude).test(item.section))
//     && (!rule.sectionExclude || !RegExp(sectionExclude).test(item.section))
//     ── OR ── rule.familyId && item.familyId === rule.familyId   // short-circuits (ignores the rest)
//   NOTE cross-category leaves exist: Base→Water→"Sinks & Faucets" pulls category:"Sink".
//   Membership is MATERIALIZED per item in `Item.functionalGroups` (a consumer need not re-run the
//   regex engine, and hidden-family units are already excluded); this Sidebar is the definition + counts.
export interface Sidebar {
  inspiration: { key: "__INSP__"; label: string; emoji: string }; // the ✨ Designer Inspiration row (no count)
  allCategories: { key: "ALL"; label: string; count: number };    // the "All categories · 1714" row
  zones: SidebarZone[];                                            // Base / Tall / Wall / Midway
  moreCategories: { category: string; count: number }[];          // non-zone type categories below the zones
}
export interface SidebarZone {
  zone: string;                // "Base" | "Tall" | "Wall" | "Midway"
  label: string;               // header text as shown, e.g. "BASE"
  count: number;               // families with f.cat === zone (the number on the header)
  groups: SidebarGroup[];
}
export interface SidebarGroup {
  groupKey: string;            // stable key, e.g. "b_water"
  name: string;                // "Water", "Cooling", "Cooking", "Storage", "Layout", "Design", "Ventilation"
  emoji: string;               // sidebar glyph, e.g. "💧"
  count: number;               // taskCount — non-hidden families matching ANY leaf (deduped)
  allRow: { label: string; count: number }; // the "All <zone> <group>" show-all row (count === group count)
  leaves: SidebarLeaf[];
}
export interface SidebarLeaf {
  leafId: string;              // stable unique id = `${groupKey}#${index}` (leaf names repeat across zones!)
  name: string;                // "Sink Cabinets", "Dishwasher Fronts", …
  count: number;               // taskCount for this leaf — non-hidden families matching
  match: FunctionalMatchRule[];// the rule set (leaf claims an item if ANY rule matches)
}
export interface FunctionalMatchRule {
  category?: string;           // item.category must equal this (absent only when familyId is used)
  subcategory?: string;        // item.subcategory must equal this (in subDisp space — the export already stores that)
  sectionInclude?: string;     // RegExp source; item.section MUST match
  sectionExclude?: string;     // RegExp source; item.section must NOT match
  familyId?: string;           // exact family match; short-circuits (ignores category/section)
  zone?: string;               // item zone must equal this (used on category:"Alteration" rules; defaults "Base")
}

/* ═══════════════════════════ Programme reference ═══════════════════════════ */
// UI: a PROGRAMME is a kitchen product line (there are 120). You pick ONE from the
// SELECT DROPDOWN at the TOP-LEFT of the app — it reads "No programme · point range"
// until you choose one. Picking a programme sets the finishes, the price, and which
// items you can order. Each programme belongs to a family (PRIMO / AVANCE / CONTINO)
// and maps to one of the tier pills (P / A / C).
//   NOTE: don't confuse the DROPDOWN (pick one line) with the "FRONTS" pills and the
//   per-card P/P1/C/C1/A badges — those are the tiers/families, not the dropdown.

export interface Programme {
  id: string;                  // programme's stable identifier that items refer to (cf. Category.id)
  name: string;                // the option text in the dropdown, e.g. "ROCCA 01"
  family: "PRIMO" | "AVANCE" | "CONTINO" | string;
  tier: ProgrammeTier;         // which tier pill it maps to
  priceField?: number;         // index into an item's price matrix (used later for pricing)
}

// UI: two places show these — (1) the pill group labelled "FRONTS" in the TOP TOOLBAR,
// and (2) the small P/P1/C/C1/A badges at the BOTTOM of each product card. Both are the
// tiers/families (NOT the programme dropdown). P=Primo, A=Avance, C=Contino.
// P1 / C1 = "opening" variants (one handle on top) — not real stored codes, made from a flag.
export type ProgrammeTier = "P" | "P1" | "C" | "C1" | "A";

export type RuleTables = Record<string, unknown>; // handle_systems, opening_systems, vertical_handle, antoso, lighting, …

/* ═══════════════════════════ Reference primitive ═══════════════════════════ */
/**
 * UI: a POINTER to another item. Anywhere the app shows a code (a pill target, a card in
 * a tab, a variant button, a "compatible accessory"), store this small object — not a copy
 * of the whole item. The name/image/description live once on the target Item.
 */
export interface ItemRef {
  sku: string;                 // → Item.sku. IMAGE = imageUrlTemplate.replace("<CODE>", sku) (no join).
                               // NAME/DIMS/DESC = $lookup this sku into items[] (see meta.imageUrlTemplate).
  label?: string;              // the name shown HERE, only if it differs from the target Item.name
  variants?: VariantRef[];     // the small option buttons on this card (see below)
}

/**
 * UI: a small BUTTON on a card that swaps the option — e.g. "L3/M3" vs "M8" on a pullout,
 * or cable lengths "1 m / 1.6 m / 2 m". Each button orders a different code.
 */
export interface VariantRef {
  label: string;               // the button text: "L3/M3" | "M8" | "1 m" | "1.6 m" | "2 m"
  sku: string;                 // the code that button orders (e.g. IGS6058 / IGS6058U)
}

/* ═══════════════════════════ Item ═══════════════════════════ */
// UI: one ITEM = one orderable code (SKU). NOTE a grid product CARD is a whole FAMILY (see
// `familyId`) — many sibling items collapse to ONE card, and its W/H/D/Programme pills switch
// between them; the card "face" is one representative item. Cards are grouped under `section`
// headers in the grid. On the DETAIL screen an item maps 1:1. This item is still the main thing —
// everything the detail screen shows for a product is stored on it.

export type ItemKind =
  | "cabinet"     // a full unit / card (has Configure, Specification, Engineering, …)
  | "alteration"  // a change code like ANST / ANTSP63US
  | "accessory"   // inner drawer, pullout, mat, cutlery insert, side panel, …
  | "part";       // cable / transformer / bundle / set code

export interface Item {
  /* identity */
  sku: string;                 // PRIMARY KEY — the order code (e.g. "TK6080BZ2")
  kind: ItemKind;              // what type of thing this code is (see above)
  familyId?: string;           // groups sibling codes of the same product. THE GRID CARD KEY: one product
                               //   CARD = one family (NOT one item). The card's face + W/H/D/Programme pills
                               //   navigate this family's sibling SKUs; the grid collapses a family to a single
                               //   card and stacks cards under `section` headers. "N types" = the family count.
  familyFace?: boolean;        // OPTIONAL (app-exact rendering): true on the ONE sibling that is the family's
                               //   default CARD FACE (the unit shown + its preselected pills). When absent, the
                               //   backend picks a face heuristically (base tier P>P1>C>C1>A, then smallest dims).
  gridOrder?: number;          // OPTIONAL: the item's position in the app's grid order — gives card order WITHIN
                               //   a section (and, via each family's first unit, the section order). When absent
                               //   the backend orders best-effort (section then sku). Captured only on re-extract.
  name: string;                // the title on the card / detail, "Cooktop Unit · Top Blender · BZ2"
  cardLabel?: string;          // small label at the card's top-left, "Cooktop Unit"
  programmeBadge?: string;     // the card's TOP-RIGHT summary badge (a circle / rounded chip), e.g. "P" or "P · A"
  availableTiers?: ProgrammeTier[]; // the FRONTS tier badges at the card's BOTTOM-RIGHT — which tiers this front comes
                               //   in (P/P1/C/C1/A). Usually derivable from configure.programme[] (its `available` ones);
                               //   store it for cards that show the badges without a full configure.
  category?: string;           // which sidebar category it lives in (Category.id)
  subcategory?: string;
  section?: string;
  functionalGroups?: ItemFunctionalGroup[]; // which "Design Tasks" leaves this item appears in (see
                               //   FunctionalZone). Materialized from the match rules; OMITTED for items
                               //   the app also excludes (non-zone categories, null-section edge units).
  active?: boolean;            // false when a later export dropped this code (backend sets this)

  /* dimensions (carcass, in mm) — cabinets have these; accessory codes may not */
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  heightClass?: 73 | 80 | 86 | null;
  toeKick?: ToeKick;
  appliance?: ApplianceHousing;          // set ONLY on appliance-housing fronts — powers the card "Appliances" button (see below)

  /* ── the detail-screen sections, in the order they appear. All optional — a code only
        carries the sections it actually shows. ── */
  configure?: Configure;                 // the W / H / D / Programme pills at the top
  description?: Description;              // the "Hob unit · 1 blender · 2 pullouts" block
  specification?: Specification;         // the Width/Height/Depth/Weight/… table
  restrictions?: string[];               // the "Restrictions" bullet list
  programmeAvailability?: ProgrammeAvailability; // which programmes it can be ordered in
  engineering?: EngineeringFlag[];       // the green/red Yes/No capability list
  modifications?: Modification[];        // "Modifications — how to" (handle 760/761, P1/C1, opening)
  planningNotes?: string[];              // the "Planning notes" list
  didYouKnow?: DidYouKnow;               // the "💡 Did you know?" tip
  catalog?: Catalog;                     // what the header "Catalog" button opens (a PDF page)

  accessoryPanel?: AccessoryPanel;       // the "Possible alterations & accessories" tabs block
  relatedGroups?: RelatedGroup[];        // other card lists that are not in the tabs (see below)

  /* extra data carried over from the main catalog so nothing is lost */
  finishes?: FinishPrice[];              // finish → price map
  raw?: Record<string, unknown>;         // the original source record — spare copy
}

/** UI: one "Design Tasks" sidebar leaf this item shows up under (Base → Water → Dishwasher Fronts).
 *  An item may carry several (it can appear in multiple leaves). `leafId` keys back into
 *  `functionalCategories[].groups[].leaves[]`; the other fields are denormalized for direct display. */
export interface ItemFunctionalGroup {
  zone: string;                // "Base"
  group: string;               // "Water"
  groupKey: string;            // "b_water"
  leaf: string;                // "Dishwasher Fronts"
  leafId: string;              // "b_water#2"
}

/**
 * UI: the small grey line under the size, e.g. "+ 15 cm toe-kick = 945 mm installed height"
 * (or "Suspended · N cm off the floor → top at X mm"). It adds the plinth to the height.
 */
export interface ToeKick {
  addCm: number;               // 15
  installedHeightMm: number;   // 945
  suspended?: boolean;         // true when the unit hangs off the floor (suspended mode)
}

/* ─────────── Appliance housing ─────────── */
/**
 * UI: some fronts ARE built-in-appliance housings (dishwasher doors, fridge / wine fronts).
 * Their product CARD shows a THIRD icon in the bottom action row (a fridge / appliance glyph,
 * next to ♥ "Add to my list" and ⧉ "Copy"), with the hover TOOLTIP "Appliances". Clicking it
 * (`addAppliances`) hands the front to the appliance schedule as a payload.
 *   Set this field ONLY when the item is an appliance-housing front (button shown); OMIT it on
 *   every other item. Everything here is FIXED per-front data derived from the catalog — the
 *   appliance schedule / picker UI that consumes it is a UI tool and is NOT exported.
 *   In v765 exactly 8 families are housings: Refrigerators (F1230, F1231, XGFRWINE) and
 *   Dishwashers (GFVK80_SM, GFVO, GFVO_AS, GFVO_B, GFVO_G).
 */
export interface ApplianceHousing {
  category: "Refrigerators" | "Dishwashers" | string; // appliance category; also picks the icon (Refrigerators → fridge glyph, else generic)
  brand: string;              // default appliance brand shown on the card, e.g. "Gaggenau"
  nicheSize: string;          // niche size as an inch label: dishwashers always "24"; fridge fronts derive from width (18" / 24" / 30" / 36")
  subcategory?: string;       // DISHWASHERS only: "Built-In ADA" when heightClass === 73, else "Built-In"
  note?: string;              // per-front fitment note (legs / cross-brand); e.g. "Can work with Miele, <sku> + 100 legs - BSH <sku> with 12 cm legs." (original-handle GFVO* fronts)
}

/* ─────────── Configure pills ─────────── */
/**
 * UI: the pills that belong to ONE item — the H / W / D rows and P/P1/C/C1/A on the
 * PRODUCT CARD, and the same rows in the "CONFIGURE" box of the detail screen. Some products
 * add EXTRA coded rows — "Mode" (sinks: 700-IF/A · 500-U), "Ty" (Type: TU/TV/TW; Z/S2Z/Z2X),
 * "Config" (2 Shelves · Shelf + Railing · LED) — all collected in `optionRows`.
 * Clicking a pill OPENS A DIFFERENT ITEM (another code). Example: on TK6080BZ2, Width 70
 * opens TK7080BZ2. So each pill option points to a target item by its `sku` (null when greyed).
 *   DO NOT confuse these with the W / H / D pill bar at the VERY TOP of the app — that top
 *   bar FILTERS the grid (shows/hides cards) and belongs to no item. This `Configure` is
 *   only the per-item pills.
 */
export interface Configure {
  width: DimensionOption[];    // the Width row (numeric)
  height: DimensionOption[];   // the Height row (numeric)
  depth: DimensionOption[];    // the Depth row (numeric; includes a "63 cm alteration" option)
  programme: ProgrammeOption[];// the Programme row (Primo / P1 / Contino / C1 / Avance)
  optionRows?: OptionRow[];    // EVERY extra selector row beyond W/H/D/Programme — coded ("Mode" 700-IF/A · 500-U,
                               //   "Ty"/Type TU/TV/TW · Z/S2Z/Z2X, "Config" 2 Shelves · Shelf + Railing · LED,
                               //   "Finish" on handles = colour swatch per pill → sibling SKU e.g. ZGR529032/ZGR529100)
                               //   AND product-specific ones like "Insert" / "Variant". One entry per row (its
                               //   on-screen label + pills); every pill → a sibling SKU.
                               //   NOTE: replaces the old numeric `insert`/`variant` fields — they were redundant with
                               //   this (identical shape, and their pills are sibling-SKU selectors, not real dimensions).
  note?: string;               // grey line "Depth is carcass; full depth = carcass + front + 2 mm …"
}

export interface DimensionOption {
  // UI: one pill in a Width / Height / Depth row.
  label: string;               // the pill text (shown in cm), e.g. "60" / "H80" / "58"
  value: number;               // the number, in `unit`
  unit: "mm" | "cm";
  sku: string | null;          // the item this pill opens (its order code); null when it is greyed out
  selected: boolean;           // true = this is the current item's value (the highlighted pill)
  available: boolean;          // true = you can click it; false = greyed out
  note?: string;               // extra label, e.g. "63 cm depth (alteration)"
}

export interface ProgrammeOption {
  // UI: one pill in the Programme row.
  label: string;               // "Primo" | "Opening P1 — Primo, one handle on top" | …
  tier: ProgrammeTier;         // P | P1 | C | C1 | A
  opening: boolean;            // true for P1 / C1 (the one-handle-on-top opening variants)
  sku: string | null;          // the sibling item it opens (its order code, e.g. P1<base> / C1<base>); null when greyed
  selected: boolean;
  available: boolean;
}

/**
 * UI: one EXTRA coded configure row — the rows beyond W/H/D/Programme that only some products show:
 * "Mode" (sinks), "Ty" (Type), "Config" (shelf layout), "Finish" (handles — each pill shows a colour
 * SWATCH square, see ConfigOption.swatch), etc. `label` is the row's on-screen name; `options` are its
 * pills. Backend can switch on `label` when a row needs special handling.
 */
export interface OptionRow {
  label: string;              // the row label as shown: "Mode" | "Ty" | "Config" | "Finish" | …
  options: ConfigOption[];    // the pills in this row
}

/**
 * UI: one pill in a coded configure row (see OptionRow) — e.g. "Mode" (700-IF/A, 500-U), "Ty"
 * (TU/TV/TW; Z, S2Z, Z2X), "Config" (2 Shelves, Shelf + Railing · LED). Unlike W/H/D these are NOT
 * numbers — the pill text is a code/phrase — but they behave the same: clicking one opens a sibling item.
 */
export interface ConfigOption {
  label: string;              // the pill text: "700-IF/A" | "TU" | "Z2X" | "2 Shelves" | "032" (a finish code)
  sku: string | null;         // the item this pill opens (its order code); null when it has no target
  selected: boolean;          // true = the current item's value (the highlighted pill)
  available: boolean;         // true = clickable; false = greyed out
  crossedOut?: boolean;       // true = shown STRUCK-THROUGH: the option exists in the family but can't be
                              //   ordered in THIS configuration. A distinct state from greyed `available:false`.
  swatch?: string;            // set when the pill shows a little COLOUR SQUARE — the handle "Finish" row
                              //   (032 / 100 / 103 / …). Value = the finish code driving that square. Build the
                              //   image from the Finish host, exactly like Swatch.imageUrl:
                              //   "https://leicht-store.s3.us-west-1.amazonaws.com/Finish/F+<swatch>.jpg".
                              //   Usually equals `label`; OMIT on plain (non-swatch) pills.
}

/* ─────────── Description ─────────── */
// UI: the "DESCRIPTION" block — a title and a few bullet points.
export interface Description {
  title: string;               // "Hob unit"
  bullets: string[];           // ["1 blender", "2 pullouts"]
}

/* ─────────── Possible alterations & accessories ─────────── */
/**
 * UI: the "POSSIBLE ALTERATIONS & ACCESSORIES" block — a row of TABS. Each tab holds groups
 * (sections) of cards. Every card points to another item.
 */
export interface AccessoryPanel {
  tabs: PanelTab[];            // the tabs, in the same left-to-right order as the app
}

export interface PanelTab {
  // UI: one tab button. `label` = the tab text (PLAIN TEXT — never HTML/<svg>).
  // `count` = the little number next to the tab name.
  label: string;              // "Compatible Accessories" | "Overview" | "Installation" | "Visible Sides"
                              // | "Alterations" | "Pullouts" | "Sink Compatibility" | "Accessories"
                              // | "Inspiration" | "Mats" | "Interior storage"
                              // | cutlery modules: "Q-Box" | "L-Box oak" | "L-Box walnut" | "Plastic" | "Beech" | "Combo" | "Other"
                              // | Vero: "Finish interior" | "Options" | "Electrical" | "Shelves"
  count: number;              // the badge number the tab shows
  notes: string[];            // the lines of text shown above the cards
  sections: PanelSection[];   // the groups of cards inside this tab (EMPTY for the "Inspiration" tab)
  swatches?: Swatch[];        // only the "Finish interior" tab: the colour/material swatch GRID (top half)
  visibleSideCombos?: VisibleSideCombo[]; // only the "Finish interior" tab: the "Visible-side combinations"
                              //   TABLE below the swatch grid (catalog ch.11) — for each interior finish, the
                              //   visible-side finishes allowed with it. Reference data, NOT cards. (Was missing.)
  options?: string[];         // only the "Options" tab: the small chips shown under the note.
                              //   Each chip is a CODE shown as-is — e.g. "MPK/KH/KG", "MPFF/PF/VM", "MPH"
                              //   (the Vero "extra-charge interior styles"). Store each chip's TEXT as a plain string.
                              //   ⚠ These are NOT items / SKUs: do NOT turn them into cards or ItemRefs, and do NOT
                              //   $lookup them in items[]. The line above the chips ("Extra-charge interior styles —
                              //   state on the order:") is an ordinary note → put it in this tab's `notes[]`.
  inspiration?: InspirationBlock; // ONLY the "Inspiration" tab: one big lifestyle photo, not cards
}

/**
 * UI: the "Inspiration" tab (image-icon tab). It has NO cards — it shows a bold heading line,
 * a note, and ONE big full-width lifestyle render of the front in a room, with a
 * "View full screen" button. Currently the client DROPS the image (exports empty `sections`);
 * this block is what must be exported instead.
 *   The `imageUrl` is a SEPARATE render (a styled room photo) — it is NOT the itemData card
 *   template, so it is NOT derivable from the sku and MUST be given explicitly.
 */
export interface InspirationBlock {
  item?: ItemRef;             // the featured front the scene shows, e.g. { sku: "GFVK8080SM" }
  heading?: string;           // the bold line above the note:
                              // "GFVK8080SM — Front · 80 cm DW + 20 cm open · SM · W 800 × H 792 × D 20 mm"
  imageUrl: string;           // the big lifestyle photo (full-width, has "View full screen").
                              // A separate render — NOT imageUrlTemplate(sku).
  fullScreen?: boolean;       // true = the "View full screen" button is shown
}

export interface PanelSection {
  // UI: a group of cards inside a tab, with a sub-heading.
  heading: string | null;     // the sub-heading. Alterations MUST use "Standard" / "Unit Specific".
                              // Visible Sides: "Recommended for selected unit" / "Alternative — deep installation".
                              // Installation: "Standard installation" / "Deep countertop / deep carcass installation".
                              // Compatible Accessories groups cards by "CATEGORY · SUBCATEGORY" (e.g. "BASE · SINKS")
                              //   — this is DERIVABLE from each card item's own category+subcategory, so the backend
                              //   can rebuild it from the refs; heading may be null if you let it derive.
  notes: string[];            // notes shown above just this group
  cards: ItemRef[];           // the cards — POINTERS to items, not copies
}

export interface Swatch {
  // UI: one colour/material sample square in the "Finish interior" tab's swatch grid.
  code: string;               // finish / material code (also the figcaption shown under the square, e.g. "032")
  label: string;              // display label; equals `code` when the square shows only the code
  imageUrl?: string;          // sample image URL — finish swatches live on a DIFFERENT host, e.g.
                              //   "https://leicht-store.s3.us-west-1.amazonaws.com/Finish/F+<code>.jpg"
}

/**
 * UI: one row of the "Visible-side combinations" table shown UNDER the swatch grid on the Finish
 * interior tab (catalog ch.11). For a given interior finish, the visible-side finishes allowed with
 * it. Pure reference data (no cards, no SKUs).
 */
export interface VisibleSideCombo {
  interior: string;           // the interior-finish label in col 1, e.g. "K 273 / K 284" | "K" | "KH"
  allowed: string[];          // the visible-side finishes in col 2, e.g.
                              //   ["K","KH","KG","FF","FS","FG","H","MC","ME","PF","VM 152","VM 284","VM 286"]
}

/* ─────────── Other card lists (not in the tabs) ─────────── */
/**
 * UI: card lists that appear as their OWN section on the detail screen (not inside the
 * tabs). Same card shape, different place.
 */
export type RelatedGroupKey =
  | "compatibleAccessories" // "everything compatible with this cabinet" (cards are clickable)
  | "plannedTogether"       // "Planned together"
  | "oftenPlannedWith"      // "Often planned with"
  | "openingSupport"        // "Opening support" — note + one card (HFO3, sink/trash pullout units)
  | "completeThisCabinet";  // "Complete this cabinet" — a side-panel/shelf card

export interface RelatedGroup {
  key: RelatedGroupKey;
  heading: string;            // the section heading exactly as shown ("Planned together", …)
  notes: string[];
  cards: ItemRef[];
}

/* ─────────── Engineering ─────────── */
/**
 * UI: the "ENGINEERING" list — capability lines with a green dot (Yes) or red dot (No),
 * e.g. "Suspended installation approved", "SensoMatic possible", "Opening system P1".
 */
export interface EngineeringFlag {
  key: "suspended" | "sensomatic" | "tipSoftclose" | "openingP1" | "depth68" | string;
  label: string;              // the line text: "Suspended installation approved (ANTOSO, book envelope p.2.03)"
  ok: boolean;                // 🟢 true (Yes) / 🔴 false (No)
  value?: string;             // the exact text shown: "Yes" | "No" | "760 only"
  ref?: string;               // a page/reference note, e.g. "book envelope p.2.03"
}

/* ─────────── Specification ─────────── */
// UI: the "SPECIFICATION" table — the item's measured facts.
export interface Specification {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  depthKind?: "carcass" | "full";
  fullDepthMm?: number;       // full depth once a programme is picked (carcass + front + 2)
  modifiers?: string;         // "—" when none (V / E / J / Y front-line modifiers)
  carcaseLine?: string;       // "80"
  weightKg?: number;          // 46.4
  volumeM3?: number;          // 0.29
  catalogPage?: CatalogPageRef;
}

export interface CatalogPageRef {
  // UI: the "Catalog page" row, e.g. "22.09 · PDF p.267".
  priceGroupRef: string;      // "22.09"
  pdfPage: number;            // 267
}

/* ─────────── Programme availability ─────────── */
// UI: the "PROGRAMME AVAILABILITY" line — which programmes this item can be ordered in.
export interface ProgrammeAvailability {
  excluded: boolean;          // false = can be ordered in ALL programmes
  programmes: string[];       // the programme ids (Programme.id) it is limited to (empty when not limited)
  note: string;               // "No programme exclusions." | "Orderable in N programmes only"
}

/* ─────────── Modifications — how to ─────────── */
/**
 * UI: the "MODIFICATIONS — HOW TO" block — short recipes telling you which code to add to
 * change the handle/opening (handle-less 760/761, one-handle-on-top P1/C1, etc.).
 */
export interface Modification {
  title: string;              // "P1 — Primo, one handle on top" | "Handle-less mechanical (760)"
  text: string;               // the recipe sentence
  codes: ModCode[];           // the codes the recipe tells you to order
  warn?: string;              // a warning, e.g. "761 electric ALWAYS needs the SMNT transformer …"
}

export interface ModCode {
  // UI: one code inside a recipe (or a "did you know" tip).
  label: string;              // "set handle 760" | "+SMNT (transformer)"
  sku: string;                // the code to order: P1TK6080BZ2 / SMNK200US / SMVK200 / SMNT …
}

/* ─────────── Did you know? ─────────── */
// UI: the "💡 Did you know?" tip — a note plus a link to a related code (e.g. a deeper version).
export interface DidYouKnow {
  text: string;               // "This cabinet can also be ordered — same front, deeper carcase."
  codes?: ModCode[];          // the related codes, e.g. 63 / 68 cm deep versions
}

/* ─────────── Catalog binding ─────────── */
/**
 * UI: what the "Catalog" button (top of the detail screen) opens — the printed catalog page
 * for this item, shown as a price-cropped PDF (right price column hidden).
 */
export interface Catalog {
  available: boolean;         // false when this item has no catalog page
  page: number | null;        // the catalog page number
  bookId?: "primo" | "ac";    // which book (primo vs avance/contino)
  url?: string;               // ready-to-open PDF for this item's tier
  urlTemplate?: string;       // "{host}{prefix}{page}.pdf" (swap the page number for prev/next)
  priceGroupRef?: string;     // "22.09"
  pricesHidden?: boolean;     // true — the price column is cropped off
  priceCrop?: number;         // 0.585 — keep the left 58.5% of the page
}

/* ─────────── Finishes ─────────── */
// UI: not a screen section — the price of the item in each finish (used for pricing later).
export interface FinishPrice {
  finishCode: string;         // "31"
  price: number;              // account points (divide by 100 downstream)
}

/* ════════════════════════════════════════════════════════════════════════════
 * NOT in this export (the backend builds these from the main catalog + rules):
 *   • Pricing (changes per programme — points/HLP or selling/margin).
 *   • The System Builder panel (SensoMatic — an interactive component picker).
 *   • Handing note, "Add Sink", the appliance SCHEDULE / picker, the panel-sizer form
 *     (these are interactive tools, not fixed data). NOTE: the per-front appliance-housing
 *     metadata that powers the card "Appliances" button IS exported — see `Item.appliance`
 *     (`ApplianceHousing`); only the schedule UI that consumes it stays out.
 *   • My Note (saved on the user's device), Ask-the-Expert (opens an email).
 *   • The LIO assistant ("Ask LIO about the catalog", the mic + context chip) and the
 *     "✨ Designer Inspiration" generator — interactive AI tools, not data. (The "Designer
 *     Inspiration" SIDEBAR entry is still a Category; only its generator behaviour is UI-only.)
 *   • The TOP filter bar — the W / H / D / height-class value pills + the "GREY, DON'T HIDE"
 *     toggle. It only shows/hides grid cards; its allowed values are derivable from items[].
 * Listed here only so both sides know the full detail screen and nothing looks missing.
 * ════════════════════════════════════════════════════════════════════════════ */
