/**
 * LEICHT Designer Instrument — canonical export schema **v2** (MINIMAL + CAPABILITIES)
 * =================================================================================
 * Supersedes v1 (`export-schema.ts`). v1 stored every rendered detail section
 * verbatim, frozen at the default toolbar; v2 stores only INTRINSIC FACTS +
 * plain-array RULES + THIN reference lists, and the UI/backend DERIVE the rest.
 * Same catalog (v781), ~45% smaller, and — crucially — hand-editable through the
 * design-book CRUD endpoints.
 *
 * ── THE TWO IDEAS THAT DEFINE v2 ────────────────────────────────────────────
 *  1. RULES ARE PLAIN ARRAYS + FLAGS, not frozen state. Every configure-pill gate
 *     the app applies (`available(u)` = progOk && tierOk && depthOk && handleOk &&
 *     frontOk && openOk && antosoOk && doorOk) is reproduced from a small
 *     `Capabilities` object stored ON EACH ITEM. A pill on ANY card greys when its
 *     TARGET item's capabilities fail the gate for the current toolbar state. The
 *     client evaluates the 8 gates against its own toolbar exactly as the original
 *     app does (see `availableFromCaps` below); the backend also runs the
 *     programme half server-side for convenience. This replaces v1's per-pill
 *     `available` boolean (which was only correct at the default toolbar).
 *  2. REFERENCES ARE THIN. Accessory/alteration/companion cards are stored as sku
 *     CODE LISTS (`alterations`/`accessories`/`companions`), not duplicated card
 *     blobs. The detail view hydrates them (name/image/kind) via one lookup.
 *
 * ── VERIFIED ────────────────────────────────────────────────────────────────
 *   `Capabilities` reproduce the app's own `available()` at **99.997%** across
 *   313,842 combinations (16,518 configure-pill targets × 19 toolbar states). The
 *   only residual is FRMAT (1 unit — layer the `FRMAT_MAX` size-table via `isFrmatFamily`).
 *
 * ── UNITS / NAMING / IMAGES ─────────────────────────────────────────────────
 *   Dimensions in MILLIMETRES unless a field says otherwise. `sku` = an item's
 *   order code (primary key + every ref). Prices excluded (programme-dependent;
 *   backend computes). Images are BUILT, never stored: `imageUrl =
 *   meta.imageUrlTemplate.replace("<CODE>", sku)`.
 *
 * ── VERSIONING ──────────────────────────────────────────────────────────────
 *   `meta.schemaVersion` = "2.2.0"  (2.1 added DimPill.code; 2.2 adds Item.doorLineYCode + Item.heightExtension — all additive).
 *   The extractor emits this shape directly
 *   (`docs/export-v781-extractor2.js`); ingest AND the CRUD endpoints write it
 *   through one `normalizeItemDoc`, so hand-authored and extracted items match.
 */

/* ═══════════════════════════ Top level ═══════════════════════════ */
export interface CatalogExport {
  meta: ExportMeta;
  categories: Category[];          // the TYPE-taxonomy sidebar (Base, Tall, Wall, …)
  programmes: Programme[];         // the 120 kitchen lines (top-left dropdown)
  ruleTables?: RuleTables;         // handle / opening / antoso / … reference tables (passthrough)
  systems?: EngineeredSystem[];    // "System Builder" bundles (SensoMatic, LLE-R) — attach by triggerSkus
  functionalCategories?: Sidebar;  // the "Design Tasks" sidebar (render-ready), distinct from categories[]
  items: Item[];                   // EVERY code = one item
}

export interface ExportMeta {
  generated: string;               // ISO datetime
  source: string;                  // e.g. "leicht_units v781 (headless DOM extraction via openDetail)"
  schemaVersion: string;           // "2.2.0" — 2.1 DimPill.code; 2.2 doorLineYCode + heightExtension
  imageUrlTemplate: string;        // ".../itemData/<CODE>.jpg" — build every image from this + sku
  counts: { items: number; cabinets: number; accessories: number; categories: number; programmes: number };
  recoveredArtifactSkus?: string[]; // codes the app's init deleted as artifacts but which are still real
                                    //   orderable units, recovered from the raw DOM. 9 are P1-prefixed /
                                    //   country-specific (CH/GB) — filter here if unwanted.
  note?: string;
}

/* ═══════════════════════════ Item ═══════════════════════════ */
/**
 * UI: one ITEM = one orderable code (SKU). A grid product CARD is a whole FAMILY
 * (`familyId`); its W/H/D/Programme pills switch between the family's sibling items.
 * On the detail screen an item maps 1:1. Everything the detail screen needs is
 * stored on the item OR derivable from it + the ref index.
 */
export type ItemKind = "cabinet" | "alteration" | "accessory" | "part";

export interface Item {
  /* identity / taxonomy */
  sku: string;                     // PRIMARY KEY — order code (e.g. "TK6080BZ2")
  kind: ItemKind;
  familyId?: string;               // groups siblings of one product CARD (the grid card key)
  name: string;                    // card / detail title
  category?: string;               // Category.id (e.g. "Base")
  subcategory?: string;
  section?: string;                // on-grid section header
  active?: boolean;                // false once a later export drops this code (backend sets it)
  nameQualifier?: string;          // amber sub-label after the title ("Mid 45 cm deep"; from vsub[vr])

  /* dimensions (carcass, mm) */
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  heightClass?: 73 | 80 | 86 | null;

  /* programme / tier */
  availableTiers?: ProgrammeTier[]; // FRONTS tier badges the front comes in (P/P1/C/C1/A) — grid tier filter
  faceForTiers?: FaceTierKey[];     // tier contexts in which THIS unit is its family's FACE card (_/P/A/C).
                                    //   NOT derivable — captured from the app's visibleBlocks().
  capabilities?: Capabilities;      // ⭐ THE RULE INPUTS — drive every configure-pill gate (see below).
                                    //   Present on every REAL unit (18,375/18,396 in v781). Absent on the
                                    //   21 SYNTHESIZED stub items — codes that are only ever REFERENCED
                                    //   (760, 761, IS, SZ2, HW60GA2, …): they exist in no family, so there
                                    //   is nothing to compute a gate from. Treat missing as "never greys"
                                    //   (`availableFromCaps` returns true for a null caps object).
  doorLineYCode?: string;           // ORDER CODE when the toolbar picks door-line **Y** (line 66). Y is the
                                    //   one code modifier that is NOT derivable: V/E/J/P1/C1 are prefixes or
                                    //   suffixes on `sku`, but Y REPLACES the whole code (app `assemble()`
                                    //   first line: `if(dl==='Y' && u.Yc) return u.Yc`). 11 units in v781,
                                    //   exactly those with `capabilities.doorLineY` — that flag is the GATE,
                                    //   this is the code. Never a stored item of its own.

  /* configurator pills — thin: label + navigation target only. State is DERIVED. */
  parameters?: Parameters;
  heightExtension?: HeightExtension; // Tall only: the "217+" chip appended to the HEIGHT row.

  /* thin reference lists — sku CODES only; cards hydrated at read via the ref index */
  alterations?: string[];          // alteration-code refs (Standard + Unit-Specific)
  accessories?: AccessoryRef[];    // accessory / part refs — a sku string, or { sku, variants } when the
                                    //   card carries runner/length variants (L3/M3 · M8, 1m/1.6m/2m)
  companions?: string[];           // planned-together / opening-support / complete-this-cabinet refs

  /* Vero interior-finish sub-panel (Vero fronts only) — NOT sku refs */
  finishInterior?: FinishInterior;

  /* free text / small blocks (kept as-is) */
  description?: Description;        // { title, bullets[] }
  restrictions?: string[];
  planningNotes?: string[];
  didYouKnow?: DidYouKnow;
  modifications?: Modification[];  // "Modifications — how to" (760/761/P1/C1)
  handedLR?: boolean;              // "L/R" left-or-right-hinge badge
  sinkFitment?: SinkFitment;       // Base/Sinks: "Max Sink Size" + "Add Sink" popup
  appliance?: ApplianceHousing;    // appliance-housing fronts only (8 families)
  toeKick?: ToeKick;
  inspiration?: InspirationBlock;  // DW-front / mat cards: camera-icon lightbox

  /* pricing / catalog */
  finishes?: FinishPrice[];        // finish → price (drives the point pill)
  priceUnit?: "pts" | "HLP";       // the point-pill unit (cg 15/38/61 → HLP, else pts)
  catalogPage?: number;            // printed-catalog page (PDF url BUILT at read)
  priceGroupRef?: string;          // catalog/spec price-group ref, e.g. "22.09"
  frontModifiers?: string;         // spec "Modifiers" line — V/E/J/Y front-line modifiers
  carcaseLine?: number;            // carcase line (66/73/80/86) shown in the spec
  weightKg?: number;
  volumeM3?: number;

  /* engineering + nav */
  engineering?: EngineeringFlag[]; // capability flags — [{ key, ok }] (drives the "suspended" filter)
  functionalGroups?: ItemFunctionalGroup[]; // "Design Tasks" leaves this item appears in
}

/* ─────────── ⭐ Capabilities — the pill-gate rule inputs ─────────── */
/**
 * UI: the raw per-unit facts that decide whether a configure PILL is clickable
 * under the current toolbar. There is one Capabilities per item; a pill greys when
 * its TARGET item's Capabilities fail a gate. Reproduces the app's `available(u)`:
 *   available = alwaysAvailable ||
 *     (progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk)
 * The client evaluates this against its toolbar (see `availableFromCaps`); the
 * backend evaluates only the programme half server-side (see `GET items/:sku?programs=`).
 * Every field is user-settable at creation via the CRUD endpoints.
 */
export interface Capabilities {
  alwaysAvailable: boolean;        // app `u._c` — short-circuits every gate to available:true
  // tierOk
  nativeTier: "P" | "A" | "C" | null; // native line (app `u.fam`; null = line-neutral, never greys by tier)
  opening: "P1" | "C1" | null;     // this unit IS a premium opening variant
  twinTiers: ("P" | "A" | "C")[];  // tiers (≠ native) for which a REAL sibling SKU exists → grey under that tier
  // progOk
  excludedPrograms: string[];      // programme ids the unit is NOT orderable in (app `u.x`) — THE programme rule
  excludedProgramsE: string[];     // extra exclusions active ONLY in single-front / "Full-E" mode (app `u.xE`)
  isFrmatFamily: boolean;          // FRMAT max-size-table family — layer FRMAT_MAX[programmeName] on top
  hasEFront: boolean;              // E-capable (needed for the excludedProgramsE path)
  // depthOk
  depthClasses: number[];          // nominal depth CLASSES the unit offers (cm). 58 & 63 always pass.
  // handleOk / frontOk / openOk
  handleFree: boolean;             // no-handle front OR interior module (app `u.V || _hFree`)
  onePieceFront: boolean;          // one-piece front (app `u.E || /\dE$/.test(code)`)
  openP1: boolean;                 // supports the P1 opening variant
  openC1: boolean;                 // supports the C1 opening variant
  singleHandle: boolean;           // ≤1 stacked front (opening rule always passes when true)
  // antosoOk / doorOk
  antosoApproved: boolean;         // inside the ANTOSO suspended-install approval envelope (precomputed)
  doorLineJ: boolean;              // door-line J
  doorLineY: boolean;              // door-line Y
}

/**
 * The toolbar state the client passes to `availableFromCaps`. Defaults (nothing
 * picked) leave every gate passing. `progKeys` = the selected programme ids
 * (empty = no programme). This is the app's `state`, minus the render-only bits.
 */
export interface ToolbarState {
  depth?: number;                  // default 58
  tier?: "P" | "A" | "C" | "P1" | "C1" | "ALL"; // default "ALL"
  open?: "" | "P1" | "C1";         // default ""
  front?: 0 | 1;                   // default 0 (1 = single-front / Full-E)
  handle?: "std" | "V";            // default "std"
  antoso?: boolean;                // default false
  doorline?: "" | "J" | "Y";       // default ""
  progKeys?: string[];             // default []
}

/**
 * REFERENCE PORT of the app's `available()` — evaluate a pill's TARGET
 * capabilities against the toolbar. The client calls this for every pill; a pill
 * is DEAD when its `sku` is null (no target), GREY when this returns false, else
 * live. (FRMAT: also `&& !(caps.isFrmatFamily && frmatExcluded(prog))`.)
 *
 *   function availableFromCaps(c: Capabilities, s: ToolbarState): boolean {
 *     if (c.alwaysAvailable) return true;
 *     const pk = s.progKeys ?? [];
 *     const progOk  = !pk.length || pk.some(k =>
 *       !c.excludedPrograms.includes(k) && !c.isFrmatFamily &&
 *       !(s.front === 1 && c.hasEFront && c.excludedProgramsE.includes(k)));
 *     const tierOk  = !s.tier || s.tier === 'ALL' ? true
 *       : (s.tier === 'P1' || s.tier === 'C1') ? c.opening === s.tier
 *       : !c.nativeTier ? true : c.nativeTier === s.tier ? true : !c.twinTiers.includes(s.tier);
 *     const depthOk = s.depth === 58 || s.depth === 63 || c.depthClasses.includes(s.depth ?? 58);
 *     const handleOk= s.handle !== 'V' || c.handleFree;
 *     const frontOk = s.front !== 1 || c.onePieceFront;
 *     const openOk  = !s.open || (s.open === 'P1' ? c.openP1 : c.openC1) || c.singleHandle;
 *     const antosoOk= !s.antoso || c.antosoApproved;
 *     const doorOk  = !s.doorline || (s.doorline === 'J' ? c.doorLineJ : c.doorLineY);
 *     return progOk && tierOk && depthOk && handleOk && frontOk && openOk && antosoOk && doorOk;
 *   }
 */

/* ─────────── Configurator pills ─────────── */
/**
 * UI: the H / W / D / Programme rows on the card + detail "Configure" box, plus
 * any coded rows (Ty / Runner / Finish / Insert / …). Each pill just NAVIGATES to a
 * sibling item (`sku`); clicking it opens that item. Availability + selected state
 * are DERIVED at read — selected = (pill.sku === item.sku); dead = (sku == null);
 * grey = availableFromCaps(target.capabilities, toolbar) === false.
 * EXCEPTION: a `depth` row is a STATE row, not navigation — see DimPill below.
 */
export interface Parameters {
  width?: DimPill[];
  height?: DimPill[];
  depth?: DimPill[];               // a pill may be a 63 cm depth ALTERATION (alteration:true)
  programme?: ProgrammePill[];     // P / P1 / C / C1 / A
  options?: OptionPill[];          // coded rows, flattened (Ty/Runner/Finish/Insert/…); one entry per pill
}
/**
 * A W / H / D pill. `sku` is the ITEM you land on; `code` (depth rows only) is the ORDER CODE
 * at that setting.
 *
 * On a DEPTH row the pills are usually NOT navigation: `u.d = [36,48,68]` means *this* cabinet is
 * orderable at those depths, so every pill carries the item's own `sku` and only the order code
 * changes. The app re-cuts it in `assemble()`:
 *     parseCanon(c) = c.match(/^([A-Z]+)(\d+)([A-Z0-9]*)$/)          // pre · dig · fn
 *     if (depth !== 58 && u.d.includes(depth)) c = pre + dig + depth + fn
 *     // T6080IS2IZ @36 → T608036IS2IZ    @48 → T608048IS2IZ    @68 → T608068IS2IZ
 * Those codes are SYNTHESIZED — none of them exists as a stored unit (same status as the P1/C1
 * prefixes), which is why `sku` still points at the base item. `code` is present on every pill of a
 * re-cut depth row (4,858 pills over 2,348 items in v781) and absent everywhere else, where the
 * order code IS `sku`. Class 58 and the 63 ALTERATION pill keep the base code (`assemble` maps
 * depth 63 → 58; the app expresses 63 cm as base + ANTSP63US · MPRU · … in the clipboard).
 *
 * ⚠️ SELECTED on a depth row is picked by LABEL (per-card depth → toolbar D → 58), never by
 * `sku === item.sku` — several pills share the sku by design. See design-book-api-ui-map-v2.md §2c-1.
 */
export interface DimPill {
  label: string;
  sku: string | null;
  alteration?: boolean;            // the 63 cm depth-alteration pill
  code?: string;                   // depth rows: the order code at this class (may equal `sku`)
}
export interface ProgrammePill { tier: ProgrammeTier; sku: string | null; opening?: boolean; }
/**
 * The "217+" chip the app appends to the HEIGHT row on Tall units (never Appliance housing) whose
 * family has an orderable 217 cm unit. Collapsed it reads `217+`; tapping it expands to 230 / 244 /
 * 250 cm, and picking one lands on the 217 cm unit with `addCode` ordered alongside — i.e. the
 * height twin of the 63 cm depth alteration, and the reason it cannot live in `parameters.height`:
 * some families (the HP20 panels) ALSO have real 230/250 cm sibling units, so the labels collide.
 *
 * 2,046 units / 83 families in v781. NOT derivable — captured from the app's own gate.
 */
export interface HeightExtension {
  sku: string;                     // the 217 cm unit the chip opens (the extension is ordered on THAT unit)
  addCode: string;                 // companion code ordered alongside it — "MPHVERL"
  options: { label: string; heightMm: number }[]; // 230 / 244 / 250 cm → 2304 / 2436.5 / 2500 mm
}
export interface OptionPill {
  group: string;                   // the row label as shown ("Ty" | "Runner" | "Finish" | "Insert" | …)
  label: string;                   // the pill text
  sku: string | null;              // the sibling item it opens
  swatch?: string;                 // finish code when the pill shows a colour square (build img from Finish host)
}

/* ─────────── Thin refs / variants ─────────── */
export type AccessoryRef = string | { sku: string; variants: VariantRef[] };
export interface VariantRef { label: string; sku: string; } // "L3/M3" | "M8" | "1 m" | …

/* ─────────── Vero interior finish ─────────── */
export interface FinishInterior {
  swatches?: Swatch[];             // the colour/material square grid
  visibleSideCombos?: VisibleSideCombo[]; // per interior finish, the allowed visible-side finishes (ch.11)
  optionCodes?: string[];          // extra-charge interior-style codes shown as chips ("MPK/KH/KG", …) — NOT skus
}
export interface Swatch { code: string; label: string; imageUrl?: string; }
export interface VisibleSideCombo { interior: string; allowed: string[]; }

/* ═══════════════════════════ Tiers / programmes ═══════════════════════════ */
export type ProgrammeTier = "P" | "P1" | "C" | "C1" | "A";
export type FaceTierKey = "_" | "P" | "A" | "C";

export interface Programme {
  id: string;                      // programme key items refer to (in Capabilities.excludedPrograms)
  name: string;                    // "ROCCA 01"
  family: "PRIMO" | "AVANCE" | "CONTINO" | "CONTINO-12" | string;
  tier: ProgrammeTier;
  priceField?: number;             // index into an item's finish/price matrix
}

export type RuleTables = Record<string, unknown>;

/* ═══════════════════════════ Category tree ═══════════════════════════ */
export interface Category { id: string; name: string; itemCount: number; subcategories: Subcategory[]; }
export interface Subcategory { id: string; name: string; itemCount: number; sections?: string[]; }

/* ═══════════════════════════ Functional "Design Tasks" sidebar ═══════════════════════════ */
// Render-ready SECOND nav (distinct from categories[]). Unchanged from v1 — see the v1 schema
// (`export-schema.ts`) for the full count-formula documentation. Membership is materialized per item
// in `Item.functionalGroups`.
export interface Sidebar {
  inspiration: { key: "__INSP__"; label: string; emoji: string };
  allCategories: { key: "ALL"; label: string; count: number };
  zones: SidebarZone[];
  moreCategories: MoreCategory[];
}
export interface SidebarZone { zone: string; label: string; count: number; groups: SidebarGroup[]; }
export interface SidebarGroup {
  groupKey: string; name: string; emoji: string; count: number;
  allRow: { label: string; count: number }; leaves: SidebarLeaf[];
}
export interface SidebarLeaf { leafId: string; name: string; count: number; match: FunctionalMatchRule[]; }
export interface FunctionalMatchRule {
  category?: string; subcategory?: string; sectionInclude?: string; sectionExclude?: string;
  familyId?: string; zone?: string;
}
export interface MoreCategory { category: string; count: number; subs: MoreCategoryLeaf[]; }
export interface MoreCategoryLeaf { name: string; count: number; filter: { category: string; subcategory: string }; }
export interface ItemFunctionalGroup { zone: string; group: string; groupKey: string; leaf: string; leafId: string; }

/* ═══════════════════════════ System Builder ═══════════════════════════ */
export interface EngineeredSystem {
  id: string; name: string; note?: string;
  triggerSkus: string[];           // item SKUs whose detail screen shows this panel
  required: SystemSlot[]; optional?: SystemSlot[];
}
export interface SystemSlot { role: string; options: SlotOption[]; default?: string; }
export interface SlotOption { sku: string; label?: string; }

/* ═══════════════════════════ Small typed blocks ═══════════════════════════ */
export interface Description { title: string; bullets: string[]; }
export interface DidYouKnow { text: string; codes?: { label: string; sku: string }[]; }
export interface Modification { title: string; text: string; codes: { label: string; sku: string }[]; warn?: string; }
export interface EngineeringFlag {
  key: "suspended" | "sensomatic" | "tipSoftclose" | "openingP1" | "depth68" | string;
  ok: boolean;                     // 🟢 true / 🔴 false. (v1's label/value/ref are derived at read.)
}
export interface ToeKick { addCm: number; installedHeightMm: number; suspended?: boolean; }
export interface ApplianceHousing {
  category: "Refrigerators" | "Dishwashers" | string;
  brand: string;                   // "Gaggenau"
  nicheSize: string;               // '24"' (DW) | 18/24/30/36" (fridge, from width)
  subcategory?: string;            // DW only: "Built-In" | "Built-In ADA" (hc 73)
  note?: string;                   // DW only: leg/brand fitment note
}
export interface SinkFitment {
  maxSinkSizeInch: number | null; cabinetWidthCm: number; customAboveInch: number;
  isDoor: boolean; showOnCard: boolean; notes: string[];
}
export interface InspirationBlock {
  item?: { sku: string }; heading?: string; caption?: string; imageUrl: string; fullScreen?: boolean;
}
export interface FinishPrice { finishCode: string; price: number; }

/* ════════════════════════════════════════════════════════════════════════════
 * NOT in this export (built at read / device-side):
 *   • imageUrl (from meta.imageUrlTemplate), catalog PDF url (from catalogPage),
 *     programmeBadge (from availableTiers), pill available/selected (from capabilities + toolbar),
 *     toeKick installedHeight when omitted (heightMm + plinth), tier-sibling P1/C1 items (synthesized).
 *   • Pricing (programme-dependent). System Builder clipboard + status ticks. My Note, Ask-the-Expert,
 *     the appliance schedule, panel-sizer, LIO assistant — interactive tools, not data.
 * ════════════════════════════════════════════════════════════════════════════ */
