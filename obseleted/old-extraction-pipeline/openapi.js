// OpenAPI 3.0 spec for the LEICHT catalog API. Served at /docs (Swagger UI) and /openapi.json.
module.exports = function buildSpec(stats) {
  return {
    openapi: "3.0.3",
    info: {
      title: "LEICHT Catalog API",
      version: "1.0.0",
      description:
        "Read-only REST API over the extracted LEICHT catalog " +
        "(`leicht_catalog.json`). " +
        `Loaded ${stats.itemCount} items across ${stats.categoryCount} categories. ` +
        "Items are flat, denormalized, Mongo-ready documents — one per orderable code.",
    },
    servers: [{ url: "/", description: "this server" }],
    tags: [
      { name: "items", description: "Catalog items (one per orderable code)" },
      { name: "reference", description: "Programmes, categories, stats, meta" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["reference"],
          summary: "Liveness check",
          responses: { 200: { description: "OK" } },
        },
      },
      "/api/items": {
        get: {
          tags: ["items"],
          summary: "List / search items (paginated)",
          parameters: [
            qp("page", "integer", "1-based page number", 1),
            qp("limit", "integer", "page size (max 200)", 20),
            qp("q", "string", "substring match on code / base_code / family_label / description"),
            qp("category", "string", "exact category (e.g. Base, Tall, Wall)"),
            qp("sub", "string", "exact sub-category"),
            qp("section", "string", "exact section"),
            qp("family_id", "string", "exact family id (e.g. F805)"),
            qp("programme_tier", "string", "P | A | C | P1 | C1"),
            qp("programme_line", "string", "PRIMO | AVANCE | CONTINO"),
            qp("program_key", "string", "items valid in this programme key (e.g. 201)"),
            qp("synthesized", "boolean", "true = only synthesized siblings, false = only real records"),
            qp("sort", "string", "field to sort by (code, width_cm, category…)", "code"),
            qp("order", "string", "asc | desc", "asc"),
            qp("slim", "boolean", "default true: list omits raw/family_meta/detail bodies. slim=false for full docs", true),
          ],
          responses: {
            200: {
              description: "Page of items",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      page: { type: "integer" },
                      limit: { type: "integer" },
                      count: { type: "integer" },
                      items: { type: "array", items: { $ref: "#/components/schemas/Item" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/items/{id}": {
        get: {
          tags: ["items"],
          summary: "Get one item by _id (code__familyId__tier)",
          parameters: [pp("id", "the item _id, e.g. CT1573__F805__C")],
          responses: {
            200: { description: "Item", content: { "application/json": { schema: { $ref: "#/components/schemas/Item" } } } },
            404: { description: "Not found" },
          },
        },
      },
      "/api/codes/{code}": {
        get: {
          tags: ["items"],
          summary: "All items sharing a code (across tiers / families)",
          parameters: [pp("code", "orderable code, e.g. T1573")],
          responses: {
            200: { description: "Matching items", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Item" } } } } },
            404: { description: "No items for code" },
          },
        },
      },
      "/api/families/{familyId}": {
        get: {
          tags: ["items"],
          summary: "All items in a family",
          parameters: [pp("familyId", "family id, e.g. F805")],
          responses: {
            200: { description: "Items in family", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Item" } } } } },
            404: { description: "No such family" },
          },
        },
      },
      "/api/categories": {
        get: {
          tags: ["reference"],
          summary: "Distinct categories with item counts",
          responses: { 200: { description: "Categories", content: { "application/json": { schema: { type: "array", items: { type: "object", properties: { category: { type: "string" }, count: { type: "integer" } } } } } } } },
        },
      },
      "/api/subs": {
        get: {
          tags: ["reference"],
          summary: "Distinct subs (optionally within a category)",
          parameters: [qp("category", "string", "limit to one category")],
          responses: { 200: { description: "Subs", content: { "application/json": { schema: { type: "array", items: { type: "object", properties: { sub: { type: "string" }, count: { type: "integer" } } } } } } } },
        },
      },
      "/api/programs": {
        get: {
          tags: ["reference"],
          summary: "Programme reference list",
          responses: { 200: { description: "Programmes" } },
        },
      },
      "/api/stats": {
        get: {
          tags: ["reference"],
          summary: "Aggregate counts (totals, per-category, per-tier)",
          responses: { 200: { description: "Stats" } },
        },
      },
      "/api/meta": {
        get: {
          tags: ["reference"],
          summary: "Extraction metadata (source, rule, counts)",
          responses: { 200: { description: "Meta" } },
        },
      },
    },
    components: {
      schemas: {
        Item: {
          type: "object",
          properties: {
            _id: { type: "string", example: "CT1573__F805__C" },
            code: { type: "string", example: "CT1573" },
            base_code: { type: "string", example: "CT1573" },
            synthesized: { type: "boolean" },
            programme_tier: { type: "string", example: "C" },
            programme_line: { type: "string", example: "CONTINO" },
            category: { type: "string", example: "Base" },
            sub: { type: "string", example: "Doors" },
            section: { type: "string", nullable: true },
            family_id: { type: "string", example: "F805" },
            family_label: { type: "string", example: "Floor unit" },
            width_cm: { type: "number", example: 15 },
            width_alternates: { type: "array", items: { type: "number" }, nullable: true },
            dim_mm: { type: "object", properties: { W: { type: "number" }, H: { type: "number" }, D: { type: "number" } } },
            finish_prices: { type: "object", additionalProperties: { type: "number" }, description: "finish code → account points (÷100 for currency)" },
            depths: { type: "array", items: { type: "number" }, nullable: true },
            variants: { type: "object" },
            valid_program_keys: { type: "array", items: { type: "string" } },
            alterations: { type: "array", description: "merged general + unit-specific alterations, each with code/name/desc/image/group", items: { type: "object" } },
            card_label: { type: "string", nullable: true, example: "Cooktop Unit", description: "list/grid card header — top-left group label (= legacy fdesc); family-level" },
            programme_badge: { type: "string", nullable: true, example: "ALL", description: "list/grid card header — top-right programme badge (= legacy progBadge): ALL | a subset like 'P · A' / 'C'; family-level" },
            image: { type: "string", nullable: true, description: "main product thumbnail (S3 URL)" },
            description: { type: "array", items: { type: "string" }, nullable: true },
            raw: { type: "object", description: "verbatim original unit (zero-loss)" },
            detail: { $ref: "#/components/schemas/Detail" },
          },
        },
        Detail: {
          type: "object",
          description:
            "Mirrors the legacy openDetail() panel (the tabs/cards in the source UI). " +
            "available=false ⇒ shown only as an option inside another card.",
          properties: {
            available: { type: "boolean" },
            fid: { type: "string", nullable: true, description: "runtime (post-patch) family id this code resolves to" },
            card_label: { type: "string", nullable: true, example: "Cooktop Unit", description: "list/grid card header — top-left group label (mirror of item.card_label)" },
            programme_badge: { type: "string", nullable: true, example: "ALL", description: "list/grid card header — top-right programme badge (mirror of item.programme_badge)" },
            title: { type: "string", example: "Cooktop Unit · Top Blender · BZ2" },
            subtitle: { type: "string", example: "Base · Cooktops & Downdrafts" },
            panel_code: { type: "string" },
            description: { type: "array", items: { type: "string" } },
            tab_count: { type: "integer" },
            card_count: { type: "integer" },
            configure: {
              type: "array",
              description:
                "The CONFIGURE pills (Width / Height / Depth / Programme). Each option carries the " +
                "target order `code` it resolves to — the frontend navigates by fetching /api/codes/<code>. " +
                "Width/Height/Programme resolve to existing items; Depth yields a depth-encoded order code.",
              items: {
                type: "object",
                properties: {
                  axis: { type: "string", example: "Width" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", example: "70" },
                        selected: { type: "boolean" },
                        available: { type: "boolean" },
                        code: { type: "string", nullable: true, example: "TK7080BZ2", description: "resulting order code" },
                        depth: { type: "integer", nullable: true, description: "for Depth options" },
                        tier: { type: "string", nullable: true, description: "for Programme options (P/P1/C/C1/A)" },
                      },
                    },
                  },
                },
              },
            },
            sections: {
              type: "array",
              description:
                "Every panel section in order — full parity with the legacy detail panel: " +
                "Configure, Description, Specification, Programme availability, Restrictions, " +
                "Possible alterations & accessories (tabs), Modifications — how to, Planning notes, companions.",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", nullable: true, example: "Specification" },
                  kv: {
                    type: "array",
                    description: "label/value rows (Specification)",
                    items: { type: "object", properties: { k: { type: "string", example: "Volume" }, v: { type: "string", example: "0.29 m³" } } },
                  },
                  recipes: {
                    type: "array",
                    description: "Modifications — how to (P1/C1/760/761)",
                    items: { type: "object", properties: { text: { type: "string" }, codes: { type: "array", items: { type: "string" }, example: ["P1TK6080BZ2"] } } },
                  },
                  chips: {
                    type: "array",
                    description: "Programme availability / configure",
                    items: { type: "object", properties: { text: { type: "string" }, ok: { type: "boolean", nullable: true } } },
                  },
                  notes: { type: "array", items: { type: "string" }, description: "Restrictions / Planning notes / free text" },
                  list: { type: "array", items: { type: "string" }, description: "Description bullets" },
                  cards: { type: "array", items: { type: "object" }, description: "companions / recommended accessories" },
                  tabs: { type: "array", items: { type: "object" }, description: "present on the alterations section" },
                },
              },
            },
            tabs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", example: "Visible Sides" },
                  count: { type: "integer", nullable: true },
                  sections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        heading: { type: "string", nullable: true, example: "Recommended for selected unit" },
                        notes: { type: "array", items: { type: "string" } },
                        cards: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              code: { type: "string", example: "FS8056" },
                              name: { type: "string", example: "Visible Carcass Side — 56 cm" },
                              desc: { type: "string" },
                              image: { type: "string", nullable: true, description: "S3 thumbnail URL", example: "https://dash4data.s3.us-west-1.amazonaws.com/itemData/FS8056.jpg" },
                              options: {
                                type: "array",
                                description: "alternative codes packed in one card (length/depth/type)",
                                items: { type: "object", properties: { code: { type: "string" }, label: { type: "string" } } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            reason: { type: "string", nullable: true, description: "present when available=false" },
          },
        },
      },
    },
  };
};

function qp(name, type, description, def) {
  const p = { name, in: "query", description, required: false, schema: { type } };
  if (def !== undefined) p.schema.default = def;
  return p;
}
function pp(name, description) {
  return { name, in: "path", required: true, description, schema: { type: "string" } };
}
