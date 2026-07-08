// Enrich each catalog item with a `detail` block that mirrors the legacy
// openDetail() panel EXACTLY — by running the real renderer headless and
// serializing the #pin DOM into structured data (tabs, cards, sections).
//
// Renders once per unique (family_id, base_code); attaches the result to every
// item sharing it (synthesized siblings reuse their base record's detail).
//
//   node extract_details.js            # full run, rewrites leicht_catalog.json + leicht_items.json
//   SAMPLE=30 node extract_details.js  # validation run, writes leicht_catalog.sample.json only

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FILE = "file://" + path.join(__dirname, "leicht_units__562_.html");
const SAMPLE = parseInt(process.env.SAMPLE || "0", 10);

// ---- in-page serializer (runs in browser context) ----
// Returns a structured representation of the openDetail panel for (fid, code).
function PAGE_SERIALIZE(code, baseCode) {
  const pin = document.getElementById("pin");
  if (!pin) return { error: "no #pin" };
  // Drive the REAL renderer via goFam(code) -> codeLoc -> openDetail, so the runtime
  // (post-patch) family is resolved correctly. Fall back to base_code for synthesized siblings.
  let resolved_by = null;
  try {
    pin.innerHTML = "";
    window.goFam(code);
    if (pin.innerHTML) resolved_by = "code";
    else if (baseCode && baseCode !== code) {
      window.goFam(baseCode);
      if (pin.innerHTML) resolved_by = "base_code";
    }
  } catch (e) {
    return { error: "goFam threw: " + e.message };
  }
  if (!pin.innerHTML)
    return {
      available: false,
      reason: "No standalone detail panel in the source UI — rendered as a variant/option inside a merged or multi-option card.",
    };
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const imgSrc = (el) => (el ? el.getAttribute("src") || null : null); // src is set even though images are blocked
  const cardOf = (c) => {
    // multi-option cards (itemCardMulti): each .mchip carries its code in mcPick('id','CODE',…)
    const options = [...c.querySelectorAll(".mchip")]
      .map((b) => {
        const m = (b.getAttribute("onclick") || "").match(/mcPick\('[^']*','([^']+)'/);
        return { code: m ? m[1] : null, label: (b.textContent || "").trim() };
      })
      .filter((o) => o.code);
    return {
      code: txt(c.querySelector(".icode")),
      name: txt(c.querySelector(".iname")),
      desc: txt(c.querySelector(".idesc")),
      image: imgSrc(c.querySelector(".ithumb img")), // S3 thumbnail URL
      options, // alternative codes (length / depth / type) packed in one card
    };
  };
  // split a panel element into sections by sub-headings (.sub2 / h*), collecting notes + cards
  const sectionsOf = (panel) => {
    const out = [];
    let cur = { heading: null, notes: [], cards: [] };
    const push = () => {
      if (cur.heading || cur.notes.length || cur.cards.length) out.push(cur);
    };
    // sub-tabs (Standard / Unit Specific) inside Alterations
    const subs = panel.querySelectorAll(":scope > .altsubwrap, .altsubwrap");
    if (subs.length) {
      const res = [];
      subs.forEach((w) => {
        const labels = [...w.querySelectorAll(".altsub")].map(txt);
        const panels = [...w.querySelectorAll(".altsub-panel")];
        panels.forEach((p, i) => {
          res.push({
            heading: (labels[i] || "").replace(/\d+$/, "").trim() || null,
            notes: [...p.querySelectorAll(".note")].map(txt).filter(Boolean),
            cards: [...p.querySelectorAll(".icard")].map(cardOf),
          });
        });
      });
      return res;
    }
    // walk children in order
    const walk = (node) => {
      for (const el of node.children) {
        if (el.classList.contains("sub2") || /^H[1-6]$/.test(el.tagName)) {
          push();
          cur = { heading: txt(el), notes: [], cards: [] };
        } else if (el.classList.contains("note")) {
          cur.notes.push(txt(el));
        } else if (el.classList.contains("icard")) {
          cur.cards.push(cardOf(el));
        } else if (el.classList.contains("itemcards") || el.classList.contains("icards")) {
          el.querySelectorAll(".icard").forEach((c) => cur.cards.push(cardOf(c)));
        } else if (el.children && el.children.length) {
          walk(el);
        }
      }
    };
    walk(panel);
    push();
    return out;
  };

  // serialize the alteration/accessory tab block (.alttabs bar + .alttab-panel siblings)
  const serTabs = (wrap) => {
    const bar = wrap.querySelector(".alttabs");
    const btns = bar ? [...bar.querySelectorAll(".alttab")] : [];
    const panels = [...wrap.querySelectorAll(":scope > .alttab-panel")];
    return btns.map((b, i) => {
      const cnt = b.querySelector(".altcount");
      return {
        label: txt(b).replace(/\d+$/, "").trim(),
        count: cnt ? parseInt(txt(cnt), 10) || 0 : null,
        sections: panels[i] ? sectionsOf(panels[i]) : [],
      };
    });
  };

  // serialize one panel section (.sec) — captures every section type the UI renders
  const kvVal = (r) => [...r.children].filter((c) => !c.classList.contains("k")).map(txt).join(" ").trim();
  const serSec = (sec) => {
    const h = sec.querySelector("h4");
    const o = { heading: h ? txt(h) : null };
    const kv = [...sec.querySelectorAll(".kv")].map((r) => ({ k: txt(r.querySelector(".k")), v: kvVal(r) }));
    if (kv.length) o.kv = kv; // Specification (Width/Height/Depth/Volume/Catalog page…)
    const recipes = [...sec.querySelectorAll(".recipe")].map((r) => ({
      text: txt(r),
      codes: [...r.querySelectorAll("code")].map(txt),
    }));
    if (recipes.length) o.recipes = recipes; // Modifications — how to (P1/C1/760/761)
    const chips = [...sec.querySelectorAll(".chip")].map((c) => ({
      text: txt(c),
      ok: c.classList.contains("good") ? true : c.classList.contains("warn") ? false : null,
    }));
    if (chips.length) o.chips = chips; // Programme availability / Configure
    const altBar = sec.querySelector(".alttabs");
    if (altBar) o.tabs = serTabs(altBar.parentElement); // Possible alterations & accessories
    else {
      const cards = [...sec.querySelectorAll(".icard")].map(cardOf);
      if (cards.length) o.cards = cards; // companions / recommended accessories
    }
    const lis = [...sec.querySelectorAll("li")].map(txt).filter(Boolean);
    if (lis.length) o.list = lis; // Description bullets
    // notes: split on <br> so bulleted lists (Restrictions) become array entries
    const splitNote = (n) =>
      n.innerHTML
        .split(/<br\s*\/?>/i)
        .map((s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/^•\s*/, "").trim())
        .filter(Boolean);
    const notes = [...sec.querySelectorAll(".note")]
      .filter((n) => !n.closest(".alttab-panel") && !n.closest(".icard"))
      .flatMap(splitNote);
    if (notes.length) o.notes = notes; // Restrictions / Planning notes / free text
    return o;
  };

  const renderedCode = txt(pin.querySelector(".codebox .c"));
  const title = txt(pin.querySelector(".ptitle"));
  const subtitle = txt(pin.querySelector(".psub"));
  const image = imgSrc(pin.querySelector(".pimg img"));
  const priceText = txt(pin.querySelector(".pprice, .detailprice, .priceline")) || null;
  const cardCount = pin.querySelectorAll(".icard").length;

  const sections = [...pin.querySelectorAll(":scope > .sec")].map(serSec);
  const tabsSec = sections.find((s) => s.tabs);
  const tabs = tabsSec ? tabsSec.tabs : [];
  const descSec = sections.find((s) => /description/i.test(s.heading || ""));

  // ---- CONFIGURE: resolve every Width/Height/Depth/Programme pill to its target order code ----
  // Clicking a pill re-renders openDetail with a new code; we replay each click and read the result
  // so the frontend can navigate the same way (fetch /api/codes/<code>).
  let configure = [];
  const confEl = [...pin.querySelectorAll(":scope > .sec")].find((s) => /configure/i.test(txt(s.querySelector("h4"))));
  if (confEl) {
    // snapshot chip data FIRST — the simulation below re-renders and destroys these DOM nodes
    const rowsData = [...confEl.querySelectorAll(".cfgrow")].map((row) => ({
      axis: txt(row.querySelector(".cfgk")) || null,
      chips: [...row.querySelectorAll("button.chip")].map((c) => ({
        label: txt(c),
        onclick: c.getAttribute("onclick") || "",
        selected: c.classList.contains("good"),
        available: !(c.style.opacity || c.classList.contains("dis")),
      })),
    }));
    const readCode = () => txt(pin.querySelector(".codebox .c"));
    // openDetail/goBandDetail take explicit (fid, code) args, so they don't need a base re-render —
    // only the global depth must be reset to 58 (default) before each sim to avoid leakage.
    configure = rowsData.map((r) => ({
      axis: r.axis,
      options: r.chips.map((ch) => {
        const o = { label: ch.label, selected: ch.selected, available: ch.available };
        let m;
        if ((m = ch.onclick.match(/openDetail\('[^']*','([^']+)'\)/))) {
          o.code = m[1]; // width / height — direct target code (an existing item)
        } else if ((m = ch.onclick.match(/setDepth\((\d+)\)/))) {
          o.depth = +m[1]; // depth — order code gets depth digits inserted (assemble-generated)
          try { window.setDepth(o.depth); pin.innerHTML = ""; window.goFam(renderedCode); o.code = readCode(); } catch (e) {}
        } else if ((m = ch.onclick.match(/goBandDetail\('([^']*)','([^']+)','([^']+)'\)/))) {
          o.tier = m[3]; // programme / opening — resolves to a sibling item
          try { window.setDepth(58); window.goBandDetail(m[1], m[2], m[3]); o.code = readCode(); } catch (e) {}
        }
        return o;
      }),
    }));
    try { window.setDepth(58); pin.innerHTML = ""; window.goFam(renderedCode); } catch (e) {} // restore
  }

  // runtime family id for this code (post-patch) — used to attach the grid card header
  // (top-left label chip + programme badge) which are family-level, not per-unit.
  const _loc = typeof window.codeLoc === "function" ? window.codeLoc(renderedCode) : null;

  return {
    available: true,
    resolved_by,
    fid: _loc ? _loc.fid : null,
    title,
    subtitle,
    panel_code: renderedCode,
    image, // main product image (S3 URL)
    price_text: priceText,
    description: descSec ? descSec.list || descSec.notes || [] : [],
    configure, // Width/Height/Depth/Programme pills → target order code per option
    sections, // EVERY panel section in order — full parity with the legacy detail panel
    tabs, // convenience: the alterations/accessories tabs (also inside sections)
    tab_count: tabs.length,
    card_count: cardCount,
  };
}

// ---- in-page grid-header scraper (runs in browser context) ----
// The list/grid card header carries two pills the detail panel does NOT:
//   • top-left  = fdesc(b,u)   → group label, e.g. "Cooktop Unit"
//   • top-right = progBadge(b) → programme availability, e.g. "ALL" / "P · A" / "C"
// Both are FAMILY-level. We render every category's grid (v92 = no pagination, so one
// pass per category shows all family cards) and read them straight off the DOM, keyed
// by the runtime family id in the card's openDetail('<fid>','<code>') onclick.
function GRID_BADGES() {
  const out = {};
  let cats = [...document.querySelectorAll("#catList button")]
    .map((b) => {
      const m = (b.getAttribute("onclick") || "").match(/setCat\('([^']+)'\)/);
      return m ? m[1] : null;
    })
    .filter((c) => c && c !== "ALL");
  // fallback if the nav wasn't built for some reason
  if (!cats.length)
    cats = ["Base","Tall","Wall","Midway","Closet & Wardrobe","Surround","Panels & surround","Countertops","Handles","Lighting","Service","Sink","Accessories & interior","Alteration"];
  const seen = new Set();
  for (const c of cats) {
    if (seen.has(c)) continue;
    seen.add(c);
    try { window.setCat(c); } catch (e) { continue; }
    for (const card of document.querySelectorAll("#grid .card")) {
      const ch = card.querySelector(".chead");
      const m = ch && (ch.getAttribute("onclick") || "").match(/openDetail\('([^']+)','([^']+)'\)/);
      if (!m) continue;
      const fid = m[1];
      if (fid in out) continue;
      const tag = card.querySelector(".tag");
      const bad = card.querySelector(".pbadge");
      out[fid] = {
        card_label: tag ? tag.textContent.trim() : null,
        programme_badge: bad ? bad.textContent.trim() : null,
      };
    }
  }
  try { window.setCat("ALL"); } catch (e) {} // back to welcome (no grid)
  return out;
}

(async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "leicht_catalog.json"), "utf8"));
  const items = catalog.items;

  // unique render keys: drive by code (goFam resolves the runtime family), keep base_code for fallback
  const keyOf = (it) => it.code + "||" + it.base_code;
  const byKey = new Map();
  for (let i = 0; i < items.length; i++) {
    const k = keyOf(items[i]);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(i);
  }
  let keys = [...byKey.keys()];
  if (SAMPLE) keys = keys.slice(0, SAMPLE);
  console.log(`items=${items.length}  unique (code,base_code)=${byKey.size}  rendering=${keys.length}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const t = r.resourceType();
    if (t === "image" || t === "font" || t === "media" || t === "stylesheet") r.abort();
    else r.continue();
  });
  console.log("loading app …");
  await page.goto(FILE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(
    () => typeof window.openDetail === "function" && document.getElementById("pin") != null,
    { timeout: 180000 }
  );
  await page.evaluate(`window.__ser = ${PAGE_SERIALIZE.toString()}`);
  await page.evaluate(`window.__gridBadges = ${GRID_BADGES.toString()}`);
  console.log("app ready");

  // grid card headers (label chip + programme badge) — one pass over every category
  console.log("scraping grid headers …");
  let gridByFid = {};
  try {
    gridByFid = await page.evaluate(() => window.__gridBadges());
  } catch (e) {
    console.error("grid scrape failed:", e.message);
  }
  console.log(`  captured headers for ${Object.keys(gridByFid).length} families`);
  console.log("rendering details …");

  const detailByKey = {};
  let done = 0, errors = 0;
  const t0 = Date.now();
  for (const k of keys) {
    const [code, base] = k.split("||");
    let d;
    try {
      d = await page.evaluate((c, b) => window.__ser(c, b), code, base);
    } catch (e) {
      d = { error: "evaluate failed: " + e.message };
    }
    if (d && (d.error || d.available === false)) errors++;
    detailByKey[k] = d;
    if (++done % 500 === 0) {
      const rate = done / ((Date.now() - t0) / 1000);
      console.log(`  ${done}/${keys.length}  (${rate.toFixed(0)}/s, ${errors} errors)`);
    }
  }
  await browser.close();
  console.log(`rendered ${done} details, ${errors} errors, ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  // merge the Alterations tab (Standard + Unit Specific) into one flat list with images
  const flattenAlterations = (d) => {
    if (!d || !d.tabs) return null;
    const tab = d.tabs.find((t) => t.label === "Alterations");
    if (!tab) return null;
    const out = [], seen = new Set();
    for (const s of tab.sections) {
      for (const c of s.cards || []) {
        if (c.code && !seen.has(c.code)) {
          seen.add(c.code);
          out.push({ code: c.code, name: c.name, desc: c.desc, image: c.image, group: s.heading || null });
        }
        for (const o of c.options || []) {
          if (o.code && !seen.has(o.code)) {
            seen.add(o.code);
            out.push({ code: o.code, name: c.name, desc: c.desc, image: c.image, group: s.heading || null });
          }
        }
      }
    }
    return out;
  };

  // attach
  const headHead = (s) => (s ? String(s).split("·")[0].trim() : null); // "Cooktop Unit · …" → "Cooktop Unit"
  let attached = 0, altMerged = 0, headed = 0, badged = 0;
  for (const [k, idxs] of byKey) {
    const d = detailByKey[k];
    if (!d) continue;
    const gh = d.fid ? gridByFid[d.fid] : null; // family-level grid card header
    const merged = flattenAlterations(d); // general + unit-specific, with images
    // grid card header pills (list view): top-left group label + top-right programme badge.
    // Family-level; scraped straight off the rendered grid for parity. Fall back to the
    // detail title head when the family never rendered as a standalone card.
    const cardLabel = (gh && gh.card_label) || headHead(d.title) || null;
    const progBadge = gh ? gh.programme_badge : null;
    // mirror onto the shared detail object too, so detail-returning endpoints carry them
    if (cardLabel) d.card_label = cardLabel;
    if (progBadge) d.programme_badge = progBadge;
    for (const i of idxs) {
      const it = items[i];
      it.detail = d;
      attached++;
      if (merged && merged.length) { it.alterations = merged; altMerged++; }
      it.card_label = cardLabel || headHead(it.family_label) || null;
      it.programme_badge = progBadge;
      if (it.card_label) headed++;
      if (it.programme_badge) badged++;
    }
  }
  console.log("attached detail to", attached, "items;", altMerged, "merged alterations;", headed, "card_label;", badged, "programme_badge");

  if (SAMPLE) {
    fs.writeFileSync(
      path.join(__dirname, "leicht_catalog.sample.json"),
      JSON.stringify(keys.map((k) => ({ key: k, detail: detailByKey[k] })), null, 2)
    );
    console.log("wrote leicht_catalog.sample.json");
  } else {
    catalog.extraction.detail_enriched = true;
    catalog.extraction.detail_errors = errors;
    catalog.extraction.detail_note =
      "Each item.detail mirrors the legacy openDetail() panel (tabs/cards/sections), " +
      "rendered headless from the source app with default state (no programme, depth 58).";
    fs.writeFileSync(path.join(__dirname, "leicht_catalog.json"), JSON.stringify(catalog));
    fs.writeFileSync(path.join(__dirname, "leicht_items.json"), JSON.stringify(items));
    console.log("wrote leicht_catalog.json + leicht_items.json (enriched)");
  }
})().catch((e) => { console.error(e); process.exit(1); });
