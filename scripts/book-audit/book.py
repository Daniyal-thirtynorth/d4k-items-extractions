"""Coordinate parser for the LEICHT price/type lists (pdftotext -bbox-layout)."""
import re, pickle, os, html

WORD = re.compile(rb'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', re.S)

def pages_from_xml(path):
    data = open(path, 'rb').read()
    out = []
    for ch in data.split(b'<page width=')[1:]:
        words = []
        for m in WORD.finditer(ch):
            x0, y0, x1, _y1, t = m.groups()
            t = html.unescape(t.decode('utf-8', 'replace')).strip()
            if t:
                words.append((float(x0), float(x1), float(y0), t))
        words.sort(key=lambda w: (w[2], w[0]))
        rows, cur, cy = [], [], None
        for x0, x1, y, t in words:
            if cy is not None and abs(y - cy) <= 2.5:
                cur.append((x0, x1, t))
            else:
                if cur: rows.append((cy, cur))
                cur = [(x0, x1, t)]; cy = y
        if cur: rows.append((cy, cur))
        out.append(rows)
    return out

def cache(bookname):
    p = f'/tmp/audit/{bookname}.rows.pkl'
    if os.path.exists(p):
        return pickle.load(open(p, 'rb'))
    r = pages_from_xml(f'/tmp/audit/{bookname}.xml')
    pickle.dump(r, open(p, 'wb'))
    return r

CODE_RE = re.compile(r'^[A-Z][A-Z0-9]*$')
NUM = re.compile(r'^\d+(\.\d+)?$')

def headers(rows):
    """All type-table headers on a page -> [(y, typeX, widthX)]."""
    out = []
    for y, ws in rows:
        txt = [t for _, _, t in ws]
        if 'Type' in txt and 'Width' in txt and 'sketch' in txt:
            sk = min(x for x, _, t in ws if t == 'sketch')
            tx = [x for x, _, t in ws if t == 'Type' and x > sk]
            if not tx: continue
            wx = min(x for x, _, t in ws if t == 'Width')
            if wx <= min(tx): continue
            out.append((y, min(tx), wx))
    return out

def parse_page(rows):
    """-> list of table regions, each {'rows':[{kind,code|text,width,handed,y}]}"""
    hs = headers(rows)
    if not hs: return []
    regions = []
    for i, (hy, typeX, widthX) in enumerate(hs):
        ymax = hs[i + 1][0] if i + 1 < len(hs) else 1e9
        lo, hi = typeX - 4, widthX - 2
        recs = []
        for y, ws in rows:
            if not (hy < y < ymax): continue
            seg = [(x0, t) for x0, _, t in ws if lo <= x0 < hi]
            if not seg: continue
            handed = any(t == 'L/R' for _, t in seg)
            core = [t for _, t in seg if t != 'L/R']
            joined = re.sub(r'\s', '', ' '.join(core))
            tail = [t for x0, _, t in ws if x0 >= hi and t != 'L/R']
            if CODE_RE.match(joined) and len(joined) >= 3 and any(NUM.match(t) for t in tail):
                w = next((float(t) for t in tail if NUM.match(t)), None)
                recs.append({'kind': 'type', 'code': joined, 'width': w, 'handed': handed, 'y': y})
            else:
                full = ' '.join(t for x0, _, t in ws if x0 >= lo)
                if full.strip():
                    recs.append({'kind': 'note', 'text': full.strip(), 'y': y})
        if recs: regions.append(recs)
    return regions

def blocks(recs, factor=1.5):
    """A block is types-then-notes. New block when a type follows a note, or when the
    gap between consecutive type rows exceeds factor x the modal row spacing (a ruled
    separator). Modal spacing is computed per region so it adapts to the table."""
    from collections import Counter
    ys = [r['y'] for r in recs if r['kind'] == 'type']
    gaps = [round(b - a, 1) for a, b in zip(ys, ys[1:]) if 0 < b - a < 40]
    modal = Counter(gaps).most_common(1)[0][0] if gaps else 9.0
    thr = modal * factor
    out, cur, prev, prev_type_y = [], [], None, None
    for r in recs:
        brk = False
        if r['kind'] == 'type':
            if prev == 'note' and cur:
                brk = True
            elif prev_type_y is not None and r['y'] - prev_type_y > thr:
                brk = True
        if brk and cur:
            out.append(cur); cur = []
        cur.append(r); prev = r['kind']
        prev_type_y = r['y'] if r['kind'] == 'type' else prev_type_y
    if cur: out.append(cur)
    return out
