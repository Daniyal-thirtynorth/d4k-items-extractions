#!/usr/bin/env python3
"""
Extract the LEICHT catalog embedded in the legacy single-file app
(leicht_units__562_.html) into one flat, MongoDB-ready JSON file.

Granularity: one document per (raw unit x programme/tier sibling).
  - Programme siblings (Primo/Contino/Avance) ARE exploded into separate docs,
    because each is a distinct orderable code (CT1573 -> T1573 Primo + CT1573 Contino).
  - Every other variant axis (width-group alternates, finishes, depths,
    front/handle/line/opening flags) is kept as a NESTED FIELD -> nothing is dropped.

Pure-Python, deterministic. Replicates the app's sibCode/unitTiers logic
(MEGA script ~lines 3254-3312) without running the browser.

Usage:
    python3 extract_catalog.py [SOURCE_HTML] [OUTPUT_JSON]
Defaults: leicht_units__562_.html -> leicht_catalog.json
Also writes leicht_items.json (the bare items[] array, for `mongoimport --jsonArray`).
"""

import sys
import json
import datetime
from collections import Counter

SRC = sys.argv[1] if len(sys.argv) > 1 else "leicht_units__562_.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "leicht_catalog.json"
OUT_ITEMS = "leicht_items.json"

DATA_START = '<script id="DATA" type="application/json">'
SCRIPT_END = "</script>"

LINE_NAME = {"P": "PRIMO", "A": "AVANCE", "C": "CONTINO",
             "P1": "PRIMO", "C1": "CONTINO"}

FIELD_LEGEND = {
    "code": "materialized orderable code (programme sibling applied)",
    "base_code": "raw stored unit code (u.c)",
    "programme_tier": "P/A/C base tier, or P1/C1 opening-system code tier",
    "programme_line": "PRIMO / AVANCE / CONTINO",
    "finish_prices": "finish code -> account points; divide by 100 for currency",
    "width_cm": "unit width in cm (already a distinct code per width)",
    "width_alternates": "widths this code also covers (meta.width_groups)",
    "dim_mm": "W x H x D in millimetres",
    "depths / carcass_depths_mm / depth_default": "available depth codes / carcass mm / default",
    "variants": "non-exploded config flags kept as fields (E/V/J/Yc/P1/C1)",
    "valid_program_keys": "programme keys (u.x) this unit is valid in",
    "raw": "verbatim original unit object (zero-loss guarantee)",
    "family_meta": "owning family object minus its units list",
}


def load_db(path):
    """Slice the embedded DATA JSON by marker and parse it."""
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    i = html.find(DATA_START)
    if i < 0:
        raise SystemExit("Could not find DATA script block in " + path)
    start = i + len(DATA_START)
    end = html.find(SCRIPT_END, start)
    if end < 0:
        raise SystemExit("Could not find closing </script> for DATA block")
    return json.loads(html[start:end])


# ---- materialization rule (replicates app sibCode/unitTiers) ----
def core(c, fam):
    return c[1:] if (fam != "P" and c[:1] in "AC") else c


def sibcode(c, fam, x):
    cr = core(c, fam)
    return cr if x == "P" else x + cr


def real_tier(u):
    """The tier label for a unit's OWN stored code."""
    c = u["c"]
    if c.startswith("P1"):
        return "P1"
    if c.startswith("C1"):
        return "C1"
    return u.get("fam") or "P"


def sib_tiers(u):
    """Programmes this model serves (from sib / fam) — basis for synthesis."""
    c = u["c"]
    if c.startswith("P1"):
        return ["P1"]
    if c.startswith("C1"):
        return ["C1"]
    sib = str(u.get("sib") or "")
    if len(sib) > 1:
        return [ch for ch in sib if ch in "PCA"]
    return [u.get("fam") or "P"]


def resolve_codes(codes, altn):
    return [{"code": c, "name": altn.get(c, "")} for c in (codes or [])]


def build_item(u, fam, code, tier, synthesized, prog_by_key, altn, width_groups):
    line = LINE_NAME.get(tier, "PRIMO")
    keys = u.get("x") or []
    return {
        "_id": "{}__{}__{}".format(code, fam.get("id"), tier),
        "code": code,
        "base_code": u["c"],
        "synthesized": synthesized,
        "programme_tier": tier,
        "programme_line": line,
        # taxonomy (denormalized)
        "category": fam.get("cat"),
        "sub": fam.get("sub"),
        "section": fam.get("sec"),
        "family_id": fam.get("id"),
        "family_label": fam.get("label"),
        # dimensions
        "width_cm": u.get("w"),
        "width_alternates": width_groups.get(str(u.get("w"))),
        "dim_mm": {"W": u.get("W"), "H": u.get("H"), "D": u.get("D")},
        "height_class": u.get("hc"),
        "depths": u.get("d"),
        "carcass_depths_mm": u.get("dd"),
        "depth_default": u.get("dv"),
        "depth_table": u.get("dt"),
        # commercial
        "finish_prices": u.get("f"),
        "calc_group": u.get("cg"),
        "pp": u.get("pp"),
        "value": u.get("vl"),
        "weight": u.get("wt"),
        "page": u.get("pg"),
        # config kept as fields (not exploded)
        "variants": {
            "full_front_E": bool(u.get("E")),
            "vertical_handle_V": bool(u.get("V")),
            "line_J86": bool(u.get("J")),
            "line_Y66": u.get("Yc") or False,
            "P1": bool(u.get("P1")),
            "C1": bool(u.get("C1")),
        },
        "opening": u.get("op"),
        "mech": u.get("mech"),
        # programmes
        "valid_program_keys": keys,
        "valid_programs": [prog_by_key[k] for k in keys if k in prog_by_key],
        # relations
        "alterations": resolve_codes(u.get("alt"), altn),
        "accessories": resolve_codes(u.get("acc"), altn),
        # text
        "description": u.get("ld"),
        "rules_notes": u.get("rs"),
        "processing_notes": u.get("pa"),
        "note": u.get("note"),
        # zero-loss
        "raw": u,
        "family_meta": {k: v for k, v in fam.items() if k != "units"},
    }


def main():
    db = load_db(SRC)
    meta = db.get("meta", {})
    programs = db.get("programs", [])
    families = db.get("families", [])
    altn = db.get("altnames", {})
    rules = db.get("rules", {})
    width_groups = meta.get("width_groups", {})

    prog_by_key = {p["k"]: p for p in programs}
    prog_by_fam = {}
    for p in programs:
        prog_by_fam.setdefault(p.get("fam"), []).append(p["k"])

    items = []
    raw_units = 0
    raw_codes = set()
    n_synth = 0
    for fam in families:
        units = fam.get("units", [])
        fam_codes = {u["c"] for u in units}      # real codes in THIS family
        synth_seen = set()                        # dedupe synthesized within family
        # phase 1: every raw unit at its own code (zero-loss, guaranteed)
        for u in units:
            raw_units += 1
            raw_codes.add(u["c"])
            items.append(build_item(u, fam, u["c"], real_tier(u), False,
                                    prog_by_key, altn, width_groups))
        # phase 2: add ONLY genuinely-new programme siblings (no real record exists)
        for u in units:
            own = real_tier(u)
            for t in sib_tiers(u):
                if t not in ("P", "A", "C") or t == own:
                    continue
                code = sibcode(u["c"], u.get("fam"), t)
                if code in fam_codes or (code, t) in synth_seen:
                    continue
                synth_seen.add((code, t))
                n_synth += 1
                items.append(build_item(u, fam, code, t, True,
                                        prog_by_key, altn, width_groups))

    # ---- completeness checks (fail loud) ----
    ids = [it["_id"] for it in items]
    dup_ids = [k for k, n in Counter(ids).items() if n > 1]
    base_codes = {it["base_code"] for it in items}
    missing = raw_codes - base_codes
    assert not missing, "DROPPED raw codes: %s" % list(missing)[:10]
    assert not dup_ids, "DUPLICATE _id: %s" % dup_ids[:10]
    for it in items:
        assert it["code"] and it["category"] and it["programme_tier"] and "raw" in it

    unique_codes = {it["code"] for it in items}
    per_cat = Counter(it["category"] for it in items)

    doc = {
        "extraction": {
            "source_file": SRC,
            "generated_at": datetime.datetime.now().astimezone().isoformat(),
            "source_meta": meta,
            "raw_unit_count": raw_units,
            "synthesized_sibling_count": n_synth,
            "item_count": len(items),
            "unique_code_count": len(unique_codes),
            "explosion": "programme/tier siblings only; "
                         "width-groups/finishes/depths/front/handle/opening kept as fields",
            "materialization_rule": "code = u.c for Primo(core)/P1/C1; "
                                    "tier-prefixed (A/C + core) for siblings via u.sib/u.fam",
            "field_legend": FIELD_LEGEND,
        },
        "programs": programs,
        "altnames": altn,
        "rules": rules,
        "items": items,
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_ITEMS, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, separators=(",", ":"))

    print("raw unit records:   %d" % raw_units)
    print("synth siblings:     %d (genuinely new, no real record)" % n_synth)
    print("items emitted:      %d" % len(items))
    print("unique codes:       %d" % len(unique_codes))
    print("raw codes covered:  %d/%d (missing %d)" %
          (len(raw_codes & base_codes), len(raw_codes), len(missing)))
    print("wrote %s  and  %s" % (OUT, OUT_ITEMS))
    print("\nper-category item tally:")
    for c, n in per_cat.most_common():
        print("  %-26s %d" % (c, n))


if __name__ == "__main__":
    main()
