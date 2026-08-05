"""Extract per-type programme exclusions from the books, honouring width scoping."""
import book, re, json
BOOKS=('primo','contino')
SCOPE=re.compile(r'Cupboard width ([\d./ ]+?) cm\s*:', re.I)
NAV=re.compile(r'Not available in (.+)$', re.I)

def load_programmes(export):
    d=json.load(open(export))
    return {p['name']:p['id'] for p in d['programmes']}, d

def merge_wrapped(notes):
    """Join continuation lines: a note ending in ',' or '-' absorbs the next."""
    out=[]
    for n in notes:
        if out and (out[-1]['text'].rstrip().endswith((',','-'))):
            sep='' if out[-1]['text'].rstrip().endswith('-') else ' '
            out[-1]={'y':out[-1]['y'],'text':out[-1]['text'].rstrip()+sep+n['text'].strip()}
        else:
            out.append({'y':n['y'],'text':n['text']})
    return out

def names_from(s, byname):
    """Greedy: take comma-separated tokens while they resolve to programme names."""
    ids=[]
    for tok in re.split(r',', s):
        tok=tok.strip().rstrip('.').strip()
        # a trailing sentence may follow the last name, e.g. 'WAKUU-FS Cupboard width 70 cm:'
        if tok in byname: ids.append(byname[tok]); continue
        m=re.match(r'([A-ZÉ0-9][A-ZÉ0-9 \-]*?)(?=\s{2,}|\s+[A-Z][a-z]|$)', tok)
        cand=m.group(1).strip() if m else tok
        if cand in byname: ids.append(byname[cand]); continue
        # try shrinking word by word
        w=cand.split()
        hit=None
        for k in range(len(w),0,-1):
            if ' '.join(w[:k]) in byname: hit=' '.join(w[:k]); break
        if hit: ids.append(byname[hit])
        else: break     # stop at first non-name -> rest is a new sentence
    return ids

SKIPPED=[]
def assertions(export):
    byname,_=load_programmes(export)
    out=[]; skipped=SKIPPED; skipped.clear()
    for b in BOOKS:
        for pn,pg in enumerate(book.cache(b),1):
            for reg in book.parse_page(pg):
                for blk in book.blocks(reg):
                    ts=[r for r in blk if r['kind']=='type']
                    if not ts: continue
                    ns=merge_wrapped([r for r in blk if r['kind']=='note'])
                    scope=None; cond=None
                    for n in ns:
                        txt=n['text'].strip()
                        if 'ot available' not in txt and txt.endswith(':'):
                            sm=SCOPE.search(txt)
                            if sm:
                                scope=[float(x) for x in re.findall(r'\d+(?:\.\d+)?', sm.group(1))]
                                cond=None
                            else:
                                # a qualifier we cannot evaluate (e.g. "Cupboard type HEER 135 ...:")
                                cond=txt; scope=None
                            continue
                        am=NAV.search(txt)
                        if am:
                            if cond:            # conditional -> not a blanket exclusion, skip
                                skipped.append({'book':b,'page':pn,'cond':cond,'note':txt[:100],
                                                'codes':[t['code'] for t in ts]})
                                cond=None; scope=None; continue
                            ids=names_from(am.group(1), byname)
                            tgt=[t for t in ts if scope is None or t['width'] in scope]
                            for t in tgt:
                                out.append({'book':b,'page':pn,'code':t['code'],
                                            'width':t['width'],'scope':scope,'progs':ids,
                                            'note':txt[:120]})
                            scope=None
    return out
