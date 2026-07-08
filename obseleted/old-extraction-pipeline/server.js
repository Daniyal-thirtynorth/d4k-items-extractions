"use strict";
// Small read-only REST API + Swagger UI over the extracted LEICHT catalog.
// Loads leicht_catalog.json into memory once at startup.

const fs = require("fs");
const path = require("path");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const buildSpec = require("./openapi");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, process.env.DATA_FILE || "leicht_catalog.json");

// ---- load data ----
if (!fs.existsSync(DATA_FILE)) {
  console.error("Data file not found: " + DATA_FILE + "\nRun:  python3 extract_catalog.py");
  process.exit(1);
}
console.log("Loading " + DATA_FILE + " …");
const DB = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const ITEMS = DB.items || [];
const PROGRAMS = DB.programs || [];
const META = DB.extraction || {};

// indexes for O(1) lookups
const byId = new Map();
const byCode = new Map();
const byFamily = new Map();
for (const it of ITEMS) {
  byId.set(it._id, it);
  push(byCode, it.code, it);
  push(byFamily, it.family_id, it);
}
function push(map, key, val) {
  let a = map.get(key);
  if (!a) map.set(key, (a = []));
  a.push(val);
}

const STATS = {
  itemCount: ITEMS.length,
  categoryCount: new Set(ITEMS.map((i) => i.category)).size,
};

// ---- app ----
const app = express();
app.use((req, _res, next) => { console.log(req.method + " " + req.url); next(); });

app.get("/health", (_req, res) =>
  res.json({ status: "ok", items: ITEMS.length, source: META.source_file })
);

// list / search
app.get("/api/items", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const eq = {
    category: req.query.category,
    sub: req.query.sub,
    section: req.query.section,
    family_id: req.query.family_id,
    programme_tier: req.query.programme_tier,
    programme_line: req.query.programme_line,
  };
  const synthesized = parseBool(req.query.synthesized);
  const programKey = req.query.program_key;

  let out = ITEMS.filter((it) => {
    for (const k in eq) if (eq[k] != null && String(it[k]) !== String(eq[k])) return false;
    if (synthesized != null && it.synthesized !== synthesized) return false;
    if (programKey && !(it.valid_program_keys || []).includes(programKey)) return false;
    if (q) {
      const hay = (
        it.code + " " + it.base_code + " " + (it.family_label || "") + " " +
        ((it.description || []).join(" "))
      ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // sort
  const sort = req.query.sort || "code";
  const dir = (req.query.order || "asc") === "desc" ? -1 : 1;
  out = out.slice().sort((a, b) => cmp(a[sort], b[sort]) * dir);

  // paginate
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const start = (page - 1) * limit;
  let slice = out.slice(start, start + limit);

  // slim (default for lists): drop heavy blocks; pass slim=false for full docs
  if (req.query.slim !== "false") {
    slice = slice.map(({ raw, family_meta, detail, ...rest }) => ({
      ...rest,
      detail: detail ? { available: detail.available, tab_count: detail.tab_count } : undefined,
    }));
  }

  res.json({ total: out.length, page, limit, count: slice.length, items: slice });
});

app.get("/api/items/:id", (req, res) => {
  const it = byId.get(req.params.id);
  if (!it) return res.status(404).json({ error: "not found", id: req.params.id });
  res.json(it);
});

app.get("/api/codes/:code", (req, res) => {
  const a = byCode.get(req.params.code);
  if (!a) return res.status(404).json({ error: "no items for code", code: req.params.code });
  res.json(a);
});

app.get("/api/families/:familyId", (req, res) => {
  const a = byFamily.get(req.params.familyId);
  if (!a) return res.status(404).json({ error: "no such family", family_id: req.params.familyId });
  res.json(a);
});

app.get("/api/categories", (_req, res) => res.json(countBy("category")));

app.get("/api/subs", (req, res) => {
  const cat = req.query.category;
  const counts = new Map();
  for (const it of ITEMS) {
    if (cat && it.category !== cat) continue;
    counts.set(it.sub, (counts.get(it.sub) || 0) + 1);
  }
  res.json([...counts].map(([sub, count]) => ({ sub, count })).sort((a, b) => b.count - a.count));
});

app.get("/api/programs", (_req, res) => res.json(PROGRAMS));

app.get("/api/stats", (_req, res) =>
  res.json({
    item_count: ITEMS.length,
    synthesized: ITEMS.filter((i) => i.synthesized).length,
    by_category: countBy("category"),
    by_tier: countBy("programme_tier"),
    by_line: countBy("programme_line"),
  })
);

app.get("/api/meta", (_req, res) => res.json(META));

// ---- swagger ----
const spec = buildSpec(STATS);
app.get("/openapi.json", (_req, res) => res.json(spec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: "LEICHT Catalog API" }));

app.get("/", (_req, res) => res.redirect("/docs"));

app.use((req, res) => res.status(404).json({ error: "unknown route", path: req.path }));

app.listen(PORT, () => {
  console.log(`\nLEICHT Catalog API  ·  ${ITEMS.length} items`);
  console.log(`  Swagger UI : http://localhost:${PORT}/docs`);
  console.log(`  OpenAPI    : http://localhost:${PORT}/openapi.json`);
  console.log(`  Items      : http://localhost:${PORT}/api/items?limit=5`);
});

// ---- helpers ----
function countBy(field) {
  const m = new Map();
  for (const it of ITEMS) m.set(it[field], (m.get(it[field]) || 0) + 1);
  return [...m].map(([k, count]) => ({ [field]: k, count })).sort((a, b) => b.count - a.count);
}
function parseBool(v) {
  if (v === undefined) return null;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return null;
}
function cmp(a, b) {
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
