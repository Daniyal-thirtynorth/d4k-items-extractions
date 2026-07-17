/* ============================================================================
 * LEICHT v781 → "minimal + capabilities" export extractor (v2)
 * ----------------------------------------------------------------------------
 * A FRESH browser run emits the NEW thin item shape DIRECTLY — no post-transform
 * (this replaces export-v781-extractor.js + scripts/transform-min.js in one pass).
 *
 * Same driver contract as v1: inject once (sets window.__H), then the main thread
 * calls H.buildJobs() → H.processBatch(start,n) in chunks → H.finalize() → H.post(url).
 * It drives the app's OWN openDetail(f.id,u.c) and scrapes #pin, and now ALSO:
 *   • emits per-item `capabilities` (inlined scripts/compute-capabilities.js) that
 *     REPLACES the old programmeAvailability (raw u.x + tier/depth/handle/open gates);
 *   • maps configure → thin `parameters`, accessoryPanel → alterations/accessories/
 *     finishInterior, relatedGroups → companions, engineering → key+ok;
 *   • materializes per-item `functionalGroups` + a top-level `functionalCategories`
 *     sidebar (driving the app's own TASKS / famInTaskSub / taskCount);
 *   • RECOVERS the ~21 non-hidden units the app's init deletes as "not-in-pricelist"
 *     artifacts (re-parsed from the still-present <script id="DATA"> JSON).
 *
 * Output top level: { meta, categories, programmes, ruleTables, systems,
 *                     functionalCategories, items }  (meta.schemaVersion '2.0.0').
 * ==========================================================================*/
(function(){
const H = window.__H = {};
H.warnings=[];
const warn=(m)=>{ H.warnings.push(m); try{ console.warn('[extractor2] '+m); }catch(e){} };

const T = (el)=> el? (el.textContent||'').replace(/\s+/g,' ').trim() : '';
const num = (s)=>{ const m=String(s).match(/-?\d+(\.\d+)?/); return m?Number(m[0]):null; };
// coerce a dimension to mm-number. numbers pass through unchanged (already mm); strings like
// "30 cm"/"58 cm" (some source u.W/u.H/u.D) -> mm, "NN mm" -> NN.
const mm = (v)=>{ if(typeof v!=='string') return v; const m=v.match(/-?\d+(\.\d+)?/); if(!m) return v; const n=Number(m[0]); return /mm/i.test(v)?Math.round(n):Math.round(n*10); };
const slug = (s)=> String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const IMGT = (typeof IMG==='function') ? IMG('__CODE__').replace('__CODE__','<CODE>') : '<CODE>';
const FAMLET = (typeof window.FAMLET!=='undefined')?window.FAMLET:{PRIMO:'P',AVANCE:'A',CONTINO:'C'};
// set key only when value is present/non-empty (mirrors transform-min `put`)
function put(o,k,v){ if(v===undefined||v===null) return; if(typeof v==='string'&&!v.length) return; if(Array.isArray(v)&&!v.length) return; if(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length) return; o[k]=v; }
// PRISTINE toolbar defaults, snapshotted ONCE at injection (inject on a FRESH page load —
// touching the toolbar first would bake that state into DEF). buildItem() restores these
// before every openDetail so each unit is scraped through the app's OWN unfiltered view.
const DEF = (function(){ try{ return JSON.parse(JSON.stringify(state)); }catch(e){ return null; } })();
const famTier = (fam)=>{ const F=String(fam||''); if(F.indexOf('PRIMO')===0)return 'P'; if(F.indexOf('AVANCE')===0)return 'A'; if(F.indexOf('CONTINO')===0)return 'C'; return (FAMLET&&FAMLET[fam])||'P'; };

/* ============================================================================
 * INLINED capability logic — verbatim from scripts/compute-capabilities.js
 * (module.exports / require / self-test stripped; runs in-page from FAMS).
 * ==========================================================================*/
const D2CODE = { 340: 36, 460: 48, 560: 58, 660: 68 };

function antosoU(u, cat, sub){
  const w = u.w != null ? u.w : (u.W > 0 ? u.W / 10 : null);
  const h = u.hc != null ? u.hc : (u.H > 0 ? u.H / 10 : null);
  const d = u.dp != null ? u.dp : (u.D > 0 ? u.D / 10 : null); // dp never in raw → uses D/10
  if (w == null || h == null) return false;
  if (cat === 'Tall') return w >= 30 && w <= 90 && h >= 36.5 && h <= 154 && (d == null || (d >= 36 && d <= 58));
  const dmax = /sink/i.test(sub || '') ? 62 : 58;
  return w >= 30 && w <= 120 && h >= 36.5 && h <= 93 && (d == null || (d >= 36 && d <= dmax));
}

function singleHandleRow(u){
  const lds = (u.ld || []).map((x) => (x || '').toLowerCase());
  if (!lds.length) return true;
  if (/sink|waste bin|front for|appliance/.test(lds.join(' '))) return true;
  let stack = 0;
  lds.forEach((line) => {
    if (/inner/.test(line)) return; // inner drawers/pullouts sit behind a front — no handle
    let m = line.match(/(\d+)\s+drawers?\b/); if (m) stack += (+m[1]);
    m = line.match(/(\d+)\s+pullouts?\b/); if (m) stack += (+m[1]);
  });
  return stack <= 1;
}

// Map of UPPERCASE code → {f,u} across all NON-hidden families (also indexed by u.idmc).
function buildCodeIndex(families){
  const m = {};
  (families || []).forEach((f) => {
    if (f.hid) return;
    (f.units || []).forEach((u) => {
      const key = String(u.c).toUpperCase();
      m[key] = { f, u };
      if (u.idmc) m[String(u.idmc).toUpperCase()] = m[key];
    });
  });
  return m;
}

// For each non-native tier t in {P,A,C}, does a real sibling SKU exist?
function tierTwins(u, codeIx){
  const out = [];
  const native = u.fam || null;
  if (!native || !codeIx) return out;
  const c = String(u.c);
  let base = c;
  if (native === 'C' && /^C/.test(c)) base = c.slice(1);
  else if (native === 'A' && /^A/.test(c)) base = c.slice(1);
  for (const t of ['P', 'A', 'C']) {
    if (t === native) continue;
    const cand = (t === 'P') ? base : (t + base);
    if (codeIx[cand.toUpperCase()]) out.push(t);
  }
  return out;
}

function depthClasses(u){
  const out = [];
  const add = (v) => { if (v != null && !out.includes(v)) out.push(v); };
  if (u.D != null && D2CODE[u.D] != null) add(D2CODE[u.D]);
  if (u.dv != null) add(u.dv);
  (u.d || []).forEach(add);
  return out;
}

function computeCapabilities(u, f, codeIx){
  const cat = f && f.cat != null ? f.cat : u._cat; // app: u._cat = f.cat
  const label = f && f.label != null ? f.label : '';
  // Prefer the app's INIT-frozen u._hFree (post-init f.label gets renamed away
  // from "Module …", so recomputing the regex here would wrongly read false).
  const hFree = (u._hFree != null) ? (u._hFree ? 1 : 0)
                                   : (/^Module/.test(label) ? 1 : 0); // app: _hFree for Module* families
  const code = String(u.c);
  return {
    alwaysAvailable: !!u._c,                 // available() short-circuit
    // ── tierOk ──
    tier: u.fam || null,                     // 'P'|'A'|'C'|null (native line; null = line-neutral)
    op: u.op || null,                        // 'P1'|'C1'|null (this unit IS a premium opening variant)
    tierTwins: tierTwins(u, codeIx),         // tiers with a real sibling SKU
    // ── progOk ──  excludedPrograms = RAW u.x (backend layers the FRMAT-table rule via isFrmat)
    excludedPrograms: (u.x || []).slice(),
    excludedProgramsE: (u.xE || []).slice(), // single-front programme-key exclusions
    isFrmat: code === 'FRMAT',
    hasE: !!u.E,
    // ── depthOk ──
    depthClasses: depthClasses(u),
    // ── handleOk ──
    handleFree: !!u.V || !!hFree,
    // ── frontOk ──
    frontE: !!u.E || /\dE$/.test(code),
    // ── openOk ──
    openP1: !!u.P1 || code.startsWith('P1'),
    openC1: !!u.C1 || code.startsWith('C1'),
    singleHandle: singleHandleRow(u),
    // ── antosoOk ──
    antosoOk: antosoU(u, cat, ''),
    // ── doorOk ──
    doorJ: !!u.J,
    doorY: !!u.Yc,
  };
}
// build the code index ONCE at injection over post-init FAMS
const CODEIX = buildCodeIndex(typeof FAMS!=='undefined'?FAMS:[]);

/* ============================================================================
 * DOM scrapers (reused from v1 — produce the rich intermediate structures that
 * the thin mappers below reduce). Kept verbatim so the capture stays faithful.
 * ==========================================================================*/
function chipTarget(onclick, u){
  if(!onclick) return null;
  let m;
  if(m=onclick.match(/openDetail\('[^']*','([^']*)'\)/)) return m[1];
  if(m=onclick.match(/goFam\('([^']*)'\)/)) return m[1];
  if(m=onclick.match(/setDepth63\('([^']*)'/)) return m[1];
  if(m=onclick.match(/goBandDetail\('[^']*','[^']*','([^']*)'\)/)){ try{ return sibCode(u,m[1])||null; }catch(e){ return null; } }
  if(m=onclick.match(/setDetailOpen\('([^']*)'\)/)){ try{ return sibCode(u,m[1])||null; }catch(e){ return null; } }
  if(/setDepth\(/.test(onclick)) return u.c;
  if(/pickInsert\(/.test(onclick)) return u.c;
  return null;
}
function chipAvail(chip){
  const sel=/(^|\s)good(\s|$)/.test(chip.className||'');
  try{
    const cs=getComputedStyle(chip);
    if(parseFloat(cs.opacity)<0.9) return false;
    if(/not-allowed/.test(cs.cursor)) return false;
    if(cs.filter && cs.filter!=='none') return false;
  }catch(e){}
  const st=chip.getAttribute('style')||'';
  const m=st.match(/opacity\s*:\s*([0-9]*\.?[0-9]+)/);
  if(m && parseFloat(m[1])<0.9) return false;
  if(chip.disabled && !sel) return false;
  return true;
}
function chipCrossed(chip){
  try{ const cs=getComputedStyle(chip); if(/line-through/.test(cs.textDecorationLine||cs.textDecoration||'')) return true; }catch(e){}
  const st=chip.getAttribute('style')||''; return /line-through/.test(st);
}
function cardFrom(icard){
  const codeEl=icard.querySelector('.icode');
  let sku = T(codeEl);
  const codes=[];
  icard.querySelectorAll('[onclick]').forEach(el=>{
    const oc=el.getAttribute('onclick')||''; let m;
    if(m=oc.match(/copyCode\(this,'([^']*)'\)/)) codes.push({sku:m[1],lbl:T(el)});
    else if(m=oc.match(/openDetail\('[^']*','([^']*)'\)/)) codes.push({sku:m[1],lbl:T(el)});
  });
  if(!sku && codes.length) sku=codes[0].sku;
  const name = T(icard.querySelector('.iname'));
  const ref={ sku };
  if(name && name!==sku) ref.label=name;
  const variants=[];
  icard.querySelectorAll('.mchip').forEach(ch=>{
    const oc=ch.getAttribute('onclick')||''; const m=oc.match(/mcPick\('[^']*','([^']*)'/);
    const vc=m?m[1]:null; const vl=T(ch);
    if(vc && vl) variants.push({label:vl,sku:vc});
  });
  if(variants.length){ ref.variants=variants; if(!ref.label && name) ref.label=name; }
  return ref;
}
function scrapePanel(panel){
  const res={ notes:[], sections:[] };
  const sw=[...panel.querySelectorAll('.swgrid figure')];
  if(sw.length){ res.swatches=sw.map(fig=>{ const code=T(fig.querySelector('figcaption')); const img=fig.querySelector('img'); return {code,label:code, imageUrl: img?img.getAttribute('src'):undefined}; }); }
  const vt=[...panel.querySelectorAll('.vtbl tbody tr')];
  if(vt.length){ res.visibleSideCombos=vt.map(tr=>{ const td=tr.querySelectorAll('td'); return { interior:T(td[0]), allowed:T(td[1]).split(/,\s*/).filter(Boolean) }; }); }
  const oc=[...panel.querySelectorAll('.ochip')];
  if(oc.length){ res.options=oc.map(x=>T(x)); }
  const insp=panel.querySelector('.inspshot');
  if(insp){ const img=insp.querySelector('img'); const b={ imageUrl: img?img.getAttribute('src'):'', fullScreen:true };
    const capNote=[...panel.querySelectorAll('.note')].find(n=>n.querySelector('.lbx-cap-sub'));
    if(capNote){ const sub=capNote.querySelector('.lbx-cap-sub'); const tail=T(sub);
      const head=T(capNote).slice(0, T(capNote).length-tail.length).trim();
      if(head) b.heading=head; if(tail) b.caption=tail; }
    res.inspiration=b; }
  const subs=[...panel.querySelectorAll('.altsub')];
  const subPanels=[...panel.querySelectorAll('.altsub-panel')];
  if(subs.length && subPanels.length){
    subPanels.forEach((sp,i)=>{
      const heading = subs[i]? T(subs[i]).replace(/\s*\d+\s*$/,'') : null;
      const cards=[...sp.querySelectorAll('.icard')].map(ic=>cardFrom(ic));
      res.sections.push({ heading, notes:[], cards });
    });
    return res;
  }
  const nodes=[...panel.querySelectorAll('.ihdr,.sub2,.icard')];
  if(nodes.length){
    let cur={heading:null,notes:[],cards:[]}; let started=false;
    nodes.forEach(nd=>{
      if(nd.classList.contains('ihdr')||nd.classList.contains('sub2')){
        if(started && (cur.cards.length||cur.heading!=null)) res.sections.push(cur);
        cur={heading:T(nd),notes:[],cards:[]}; started=true;
      } else { cur.cards.push(cardFrom(nd)); started=true; }
    });
    if(cur.cards.length||cur.heading!=null) res.sections.push(cur);
  }
  [...panel.querySelectorAll('.note')].forEach(n=>{
    if(n.closest('.icard')||n.closest('.idesc')) return;
    if(n.querySelector('.lbx-cap-sub')) return;
    const t=T(n); if(t) res.notes.push(t);
  });
  return res;
}
function scrapeConfigure(pin,u){
  const cfg=[...pin.querySelectorAll('.cfgsec .cfgrow')];
  if(!cfg.length) return null;
  const C={ width:[], height:[], depth:[], programme:[], optionRows:[] };
  cfg.forEach(row=>{
    const k=T(row.querySelector('.cfgk'));
    const chips=[...row.querySelectorAll('.chip')];
    if(k==='Width'||k==='Height'||k==='Depth'){
      const arr=chips.map(ch=>{ const lbl=T(ch); const oc=ch.getAttribute('onclick'); const o={ label:lbl, value:(num(lbl)!=null?num(lbl)*10:null), unit:'mm', sku:chipTarget(oc,u), selected:/(^|\s)good(\s|$)/.test(ch.className), available:chipAvail(ch) }; if(k==='Depth'&&/63/.test(lbl)) o.note='63 cm depth (alteration)'; if(chipCrossed(ch)) o.crossedOut=true; return o; });
      C[k.toLowerCase()]=arr;
    } else if(k==='Programme'){
      C.programme=chips.map(ch=>{ const lbl=T(ch); const tier=lbl; const oc=ch.getAttribute('onclick'); let sku=null; try{ sku=sibCode(u,tier)||chipTarget(oc,u);}catch(e){ sku=chipTarget(oc,u);} return { label:lbl, tier, opening:/1$/.test(tier), sku:(sku&&CODESET&&CODESET.has(sku))?sku:(sku||null), selected:/(^|\s)good(\s|$)/.test(ch.className), available:chipAvail(ch) }; });
    } else {
      const options=chips.map(ch=>{ const lbl=T(ch); const oc=ch.getAttribute('onclick'); const o={ label:lbl, sku:chipTarget(oc,u), selected:/(^|\s)good|(^|\s)sel/.test(ch.className), available:chipAvail(ch) }; if(chipCrossed(ch)) o.crossedOut=true; const img=ch.querySelector('img.fsw'); if(img) o.swatch=lbl; return o; });
      C.optionRows.push({ label:k, options });
    }
  });
  if(!C.optionRows.length) delete C.optionRows;
  return C;
}
function scrapeEngineering(pin){
  const sec=[...pin.querySelectorAll(':scope > .sec')].find(s=>/^Engineering/.test(T(s.querySelector('h4'))));
  if(!sec) return null;
  const out=[];
  sec.querySelectorAll('.kv').forEach(kv=>{
    const kEl=kv.querySelector('.k'); const ktext=T(kEl); const ok=/🟢/.test(ktext);
    const label=ktext.replace(/^[^A-Za-z0-9(]+/,'').trim();
    let key='flag'; const L=label.toLowerCase();
    if(/suspended/.test(L))key='suspended'; else if(/sensomatic/.test(L))key='sensomatic'; else if(/tip-?softclose|tip-on/.test(L))key='tipSoftclose'; else if(/opening system p1|opening p1/.test(L))key='openingP1'; else if(/68\s*cm/.test(L))key='depth68';
    out.push({ key, ok });
  });
  return out.length?out:null;
}
function scrapeAccessoryPanel(pin){
  const sec=[...pin.querySelectorAll(':scope > .sec')].find(s=>/Possible alterations/.test(T(s.querySelector('h4'))));
  if(!sec) return null;
  const wrap=sec.querySelector('[id^="alt"]'); if(!wrap) return null;
  const tabBtns=[...wrap.querySelectorAll(':scope > .alttabs > .alttab, :scope .alttabs > .alttab')];
  const panels=[...wrap.querySelectorAll(':scope > .alttab-panel')];
  if(!panels.length) return null;
  const tabs=[];
  panels.forEach((panel,i)=>{
    const btn=tabBtns[i];
    let label = btn? T(btn) : ('Tab'+i);
    const cntEl=btn?btn.querySelector('.altcount'):null;
    if(cntEl) label=label.replace(/\s*\d+\s*$/,'').trim();
    const p=scrapePanel(panel);
    const tab={ label, notes:p.notes||[], sections:p.sections||[] };
    if(p.swatches) tab.swatches=p.swatches;
    if(p.visibleSideCombos) tab.visibleSideCombos=p.visibleSideCombos;
    if(p.options) tab.options=p.options;
    if(p.inspiration){ tab.inspiration=p.inspiration; tab.sections=[]; }
    tabs.push(tab);
  });
  return { tabs };
}
const REL_MAP={ 'Planned together':'plannedTogether', 'Often planned with':'oftenPlannedWith', 'Opening support':'openingSupport', 'Complete this cabinet':'completeThisCabinet' };
function scrapeRelated(pin,u){
  const out=[];
  try{
    const rr=(window.REFS&&(REFS[u.c]||REFS[u.idmc]))||'';
    const codes=rr?rr.split(',').map(s=>s.trim()).filter(c=>c && c.toUpperCase()!=='ANTOSO' && window.CODE2FAM && window.CODE2FAM[c]):[];
    if(codes.length) out.push({ key:'compatibleAccessories', cards:codes.map(c=>({sku:c})) });
  }catch(e){}
  [...pin.querySelectorAll(':scope > .sec')].forEach(s=>{
    const h=T(s.querySelector('h4')).replace(/\s*—.*$/,'').trim();
    const key=REL_MAP[h]||REL_MAP[Object.keys(REL_MAP).find(k=>h.indexOf(k)===0)];
    if(!key) return;
    const cards=[...s.querySelectorAll('.icard')].map(ic=>cardFrom(ic));
    if(cards.length) out.push({ key, cards });
  });
  return out.length?out:null;
}
function scrapeModifications(pin){
  const sec=[...pin.querySelectorAll(':scope > .sec')].find(s=>/^Modifications/.test(T(s.querySelector('h4'))));
  if(!sec) return null;
  const out=[];
  const codeTok=(s)=>{ const cleaned=String(s).replace(/\([^)]*\)/g,' '); const m=cleaned.match(/[A-Z]{2,}[A-Z0-9]*|\b\d{3}\b/g); return m?m[m.length-1]:null; };
  sec.querySelectorAll('.recipe').forEach(r=>{
    const title=T(r.querySelector('b'));
    const codes=[...r.querySelectorAll('code')].map(c=>{ const lbl=T(c); const sku=codeTok(lbl); return sku?{label:lbl,sku}:null; }).filter(Boolean);
    const warnTxt=T(r.querySelector('.muted'));
    let text=T(r); if(title&&text.indexOf(title)===0) text=text.slice(title.length).replace(/^[\s—\-]+/,'');
    if(warnTxt&&text.indexOf(warnTxt)>=0) text=text.replace(warnTxt,'').trim();
    const o={ title, text, codes }; if(warnTxt) o.warn=warnTxt;
    out.push(o);
  });
  return out.length?out:null;
}
function scrapeDidYouKnow(pin){
  const sec=[...pin.querySelectorAll(':scope > .sec.dyk, :scope > .sec')].find(s=>/Did you know/.test(T(s.querySelector('h4'))));
  if(!sec) return null;
  const text=T(sec.querySelector('.note'));
  const codes=[];
  sec.querySelectorAll('[onclick]').forEach(b=>{ const m=(b.getAttribute('onclick')||'').match(/openDetail\('[^']*','([^']*)'\)/); if(m) codes.push({label:T(b)||m[1],sku:m[1]}); });
  const o={ text }; if(codes.length) o.codes=codes;
  return text?o:null;
}

/* ============================================================================
 * RAW (non-scraped) field helpers — read straight off source f/u records.
 * ==========================================================================*/
function descOf(f,u){
  let db;
  try{ const sp=(typeof stonePanelInfo==='function')?stonePanelInfo(u.c):null;
    db = sp?['Natural stone side panel','Thickness: '+sp.thickMm+' mm','Finish: '+sp.finish,'Depth: '+sp.depthMm+' mm']
          : ((u.ld&&u.ld.length)?u.ld.slice():((typeof descBody==='function')?descBody(f):[]));
  }catch(e){ db=(u.ld&&u.ld.length)?u.ld.slice():[]; }
  db=(db||[]).map(s=>String(s).trim()).filter(Boolean);
  if(!db.length) return null;
  return { title:db[0], bullets:db.slice(1) };
}
function planningOf(f,u){
  const parts=[];
  if(u.note) parts.push(u.note);
  try{ if(u.pa&&u.pa.length&&typeof paUSA==='function') paUSA(u.pa).forEach(x=>parts.push(x)); }catch(e){ if(u.pa) u.pa.forEach(x=>parts.push(String(x))); }
  if(f.plan) (Array.isArray(f.plan)?f.plan:[f.plan]).forEach(x=>parts.push(String(x)));
  return parts.length?parts:null;
}
function restrictionsOf(u){ const rs=(u.rs&&u.rs.length)?u.rs.slice():[]; return rs.length?rs:null; }
function toeKickOf(u,f){
  try{ if(typeof plinthLine!=='function') return null; const html=plinthLine(u,f.cat); if(!html) return null;
    const add=(html.match(/\+\s*(\d+)\s*cm/)||[])[1]; const inst=(html.match(/=\s*<b>(\d+)\s*mm/)||html.match(/(\d+)\s*mm/)||[])[1];
    const o={}; if(add!=null)o.addCm=Number(add); if(inst!=null)o.installedHeightMm=Number(inst);
    if(/suspend/i.test(html)) o.suspended=true;
    return (o.addCm!=null||o.installedHeightMm!=null)?o:null;
  }catch(e){ return null; }
}
function applianceOf(f,u){
  try{ if(!isApplHousing(f.id)) return null;
    const o={ category:applCat(f.id), brand:'Gaggenau', nicheSize:applSize(f.id,u) };
    if(o.category==='Dishwashers'){ o.subcategory=applSub(u); const n=applNote(f.id,u)||f.plan; if(n) o.note=n; }
    return o;
  }catch(e){ return null; }
}
function finishesOf(u){ if(!u.f) return null; const out=[]; for(const k in u.f){ out.push({ finishCode:k, price:u.f[k] }); } return out.length?out:null; }
function frontModifiersOf(u){
  const mods=[u.V?'Vertical handle (V)':'',u.E?'One-piece front (E)':'',u.J?'Line-86 (J)':'',u.Yc?'Line-66 (Y) → '+u.Yc:''].filter(Boolean).join(' · ');
  return mods||null;   // '—' equivalent → null (omit)
}
function kindOf(f,u){
  if(f.cat==='Alteration') return 'alteration';
  try{ if(isAccessory(f)) return 'accessory'; }catch(e){}
  if(f.dim==='none' && /^AN/.test(u.c)) return 'alteration';
  return 'cabinet';
}
// classify a REFERENCED code (card target) as alteration vs accessory
function isAlterationSku(sku){ const cf=window.CODE2FAM&&window.CODE2FAM[sku]; if(cf&&cf.cat==='Alteration') return true; return /^AN/.test(String(sku||'')); }

/* ============================================================================
 * THIN MAPPERS — reduce the rich scraped structures to the minimal shape.
 * ==========================================================================*/
function mapParameters(cfg){
  if(!cfg) return null;
  const P={};
  const wh=arr=>(arr||[]).map(o=>{ const p={}; put(p,'label',o.label); put(p,'sku',o.sku); return p; }).filter(p=>Object.keys(p).length);
  const w=wh(cfg.width), hgt=wh(cfg.height);
  if(w.length)P.width=w; if(hgt.length)P.height=hgt;
  if(cfg.depth&&cfg.depth.length){
    const d=cfg.depth.map(o=>{ const p={}; put(p,'label',o.label); put(p,'sku',o.sku);
      const lbl=typeof o.label==='string'?o.label:''; const note=typeof o.note==='string'?o.note:'';
      if(o.alteration===true||/63/.test(lbl)||/alter/i.test(lbl)||/alter/i.test(note)) p.alteration=true; return p; });
    if(d.length)P.depth=d;
  }
  if(cfg.programme&&cfg.programme.length){
    const pr=cfg.programme.map(o=>{ const p={}; const tier=o.tier||o.label; put(p,'tier',tier); put(p,'sku',o.sku);
      if(o.opening||/1$/.test(tier||'')) p.opening=true; return p; });
    if(pr.length)P.programme=pr;
  }
  if(cfg.optionRows&&cfg.optionRows.length){
    const opts=[];
    cfg.optionRows.forEach(row=>{ (row.options||[]).forEach(opt=>{ const o={}; put(o,'group',row.label); put(o,'label',opt.label); put(o,'sku',opt.sku); put(o,'swatch',opt.swatch); opts.push(o); }); });
    if(opts.length)P.options=opts;
  }
  return Object.keys(P).length?P:null;
}
function mapAccPanel(acc,selfSku){
  const altOrder=[], altSet=new Set();
  const accMap=new Map();   // sku -> string(bare) | {sku,variants}
  if(acc&&acc.tabs) acc.tabs.forEach(tab=>{ (tab.sections||[]).forEach(sec=>{ (sec.cards||[]).forEach(card=>{
    const sku=card&&card.sku; if(!sku||sku===selfSku) return;
    if(isAlterationSku(sku)){ if(!altSet.has(sku)){ altSet.add(sku); altOrder.push(sku); } return; }
    const hasVar=card.variants&&card.variants.length;
    if(accMap.has(sku)){ const ex=accMap.get(sku); if(hasVar && (typeof ex==='string'||!ex.variants)) accMap.set(sku,{sku,variants:card.variants.slice()}); }
    else accMap.set(sku, hasVar?{sku,variants:card.variants.slice()}:sku);
  }); }); });
  return { alterations:altOrder, accessories:[...accMap.values()] };
}
function mapCompanions(rel,selfSku){
  const seen=new Set(), out=[];
  (rel||[]).forEach(g=>(g.cards||[]).forEach(c=>{
    const s=c&&c.sku; if(s&&s!==selfSku&&!seen.has(s)){ seen.add(s); out.push(s); }
    (c&&c.variants||[]).forEach(v=>{ if(v.sku&&v.sku!==selfSku&&!seen.has(v.sku)){ seen.add(v.sku); out.push(v.sku); } });
  }));
  return out;
}
function mapFinishInterior(acc){
  if(!acc||!acc.tabs) return null;
  const sw=[],swSeen=new Set(), combos=[],cbSeen=new Set(), opts=[],opSeen=new Set();
  acc.tabs.forEach(tab=>{
    (tab.swatches||[]).forEach(x=>{ const k=x.code||x.label; if(k&&!swSeen.has(k)){ swSeen.add(k); const o={code:x.code,label:x.label}; if(x.imageUrl) o.imageUrl=x.imageUrl; sw.push(o); } });
    (tab.visibleSideCombos||[]).forEach(x=>{ const k=x.interior; if(k&&!cbSeen.has(k)){ cbSeen.add(k); combos.push({interior:x.interior,allowed:(x.allowed||[]).slice()}); } });
    (tab.options||[]).forEach(s=>{ if(s&&!opSeen.has(s)){ opSeen.add(s); opts.push(s); } });
  });
  const o={}; if(sw.length)o.swatches=sw; if(combos.length)o.visibleSideCombos=combos; if(opts.length)o.optionCodes=opts;
  return Object.keys(o).length?o:null;
}

/* ============================================================================
 * FUNCTIONAL VIEW — per-item functionalGroups + the sidebar object, driving the
 * app's OWN TASKS / famInTaskSub / taskCount (never re-implemented).
 * ==========================================================================*/
H.functionalOk = (typeof TASKS!=='undefined' && typeof famInTaskSub==='function');
if(!H.functionalOk) warn('TASKS / famInTaskSub not reachable — functionalGroups + functionalCategories omitted.');
const _fgCache={};
function famFunctionalGroups(f){
  if(!H.functionalOk || !f) return [];
  const id=f.id||('anon:'+(f.label||''));
  if(_fgCache[id]) return _fgCache[id];
  const out=[];
  try{
    if(!f.hid){ TASKS.forEach(t=>{ (t.subs||[]).forEach((ts,i)=>{ let hit=false; try{ hit=famInTaskSub(f,ts); }catch(e){}
      if(hit) out.push({ zone:t.zone, group:t.n, groupKey:t.k, leaf:ts.n, leafId:t.k+'#'+i }); }); }); }
  }catch(e){}
  _fgCache[id]=out; return out;
}
function matchRule(m){
  const o={};
  if(m.c!=null) o.category=m.c;
  if(m.s!=null) o.subcategory=m.s;
  if(m.r) o.sectionInclude=m.r.source!==undefined?m.r.source:String(m.r);
  if(m.x) o.sectionExclude=m.x.source!==undefined?m.x.source:String(m.x);
  if(m.id!=null) o.familyId=m.id;
  if(m.zn!=null) o.zone=m.zn;
  return o;
}
// Render-ready sidebar (schema `Sidebar`): { inspiration, allCategories, zones[], moreCategories[] }.
// Counts EXACTLY mirror the app: zone-header/moreCategory = families by TYPE f.cat (incl. hidden,
// renderCats `counts`); group/allRow/leaf = taskCount (NON-hidden families matching).
H.buildFunctionalCategories=function(){
  if(!H.functionalOk){ return null; }
  const zonesList = (typeof TASK_ZONES!=='undefined'?TASK_ZONES:['Base','Tall','Wall','Midway']);
  const cats = (typeof CATS!=='undefined'?CATS:[]);
  const counts={}; FAMS.forEach(f=>{ counts[f.cat]=(counts[f.cat]||0)+1; });
  const disp = (typeof subDisp==='function')? subDisp : (f=>f&&f.sub);
  const tc = (typeof taskCount==='function')? taskCount : (()=>0);

  const zones=[];
  zonesList.forEach(z=>{
    const groupsSrc=TASKS.filter(t=>t.zone===z);
    if(!groupsSrc.length) return;
    const groups=groupsSrc.map(t=>{
      const gc=tc(t);
      const leaves=(t.subs||[]).map((ts,i)=>({
        leafId: t.k+'#'+i,
        name: ts.n,
        count: tc(t,ts),
        match: (ts.m||[]).map(matchRule)
      }));
      return { groupKey:t.k, name:t.n, emoji:t.e, count:gc, allRow:{ label:'All '+z+' '+t.n, count:gc }, leaves };
    });
    zones.push({ zone:z, label:String(z).toUpperCase(), count:(counts[z]||0), groups });
  });

  const subRankFn=(typeof subRank==='function')?subRank:null;   // app's own SUB_ORDER ranking (parity)
  const moreCategories=cats.filter(c=>zonesList.indexOf(c)<0).map(c=>{
    const sc={}; const order=[];
    FAMS.filter(f=>f.cat===c).forEach(f=>{ const k=disp(f); if(!(k in sc)){ sc[k]=0; order.push(k); } sc[k]++; });
    // match the app: sort subs by subRank(cat,sub), then count DESC (renderCats generic path).
    let names=order;
    if(subRankFn){ names=order.slice().sort((a,b)=>{ const ra=subRankFn(c,a), rb=subRankFn(c,b); return ra!==rb?ra-rb:sc[b]-sc[a]; }); }
    return { category:c, count:(counts[c]||0), subs: names.map(k=>({ name:k, count:sc[k], filter:{ category:c, subcategory:k } })) };
  });

  return {
    inspiration:{ key:'__INSP__', label:'Designer Inspiration', emoji:'✨' },
    allCategories:{ key:'ALL', label:'All categories', count:FAMS.length },
    zones,
    moreCategories
  };
};

/* ============================================================================
 * buildItem — emit ONE item in the minimal + capabilities shape.
 * `recovered` units (dropped from FAMS by the app's init) skip the DOM scrape
 * (openDetail can't render them) — they carry raw scalars + capabilities only.
 * ==========================================================================*/
function buildItem(f,u,recovered){
  let pin=null;
  if(!recovered){
    // FULL per-unit reset to the app's PRISTINE defaults so every unit is scraped through the app's
    // own unfiltered view (D=58 renders every configure chip live; other D values dim off-depth chips).
    try{ if(DEF) Object.assign(state, JSON.parse(JSON.stringify(DEF))); state.d63=null; }catch(e){}
    try{ openDetail(f.id, u.c); }catch(e){}
    pin=document.getElementById('pin');
  }

  const name = u.sd||u.ul||f.label||u.c;
  const it={ sku:u.c, kind:kindOf(f,u), familyId:f.id, name };
  it.category=f.cat;
  it.subcategory=(typeof subDisp==='function'?subDisp(f):f.sub);
  if(f.sec) it.section=f.sec;
  it.active=true;
  // amber sub-label = family vsub[vr] (hidden when a special display name exists)
  try{ if(!u.sd && f.vsub && f.vsub[u.vr]) it.nameQualifier=f.vsub[u.vr]; }catch(e){}

  // dimensions
  if(u.W!=null) it.widthMm=mm(u.W); if(u.H!=null) it.heightMm=mm(u.H); if(u.D!=null) it.depthMm=mm(u.D);
  const hc=[73,80,86].includes(u.hc)?u.hc:null; if(hc!=null) it.heightClass=hc;

  // tiers
  try{ const tiers=unitTiers(u); if(tiers&&tiers.length) it.availableTiers=tiers; }catch(e){}
  // "L/R" hinge badge
  try{ if(typeof handed==='function' && handed(u)) it.handedLR=true; }catch(e){}

  // capabilities — REPLACES the old programmeAvailability
  try{ it.capabilities=computeCapabilities(u,f,CODEIX); }catch(e){ warn('computeCapabilities failed for '+u.c+': '+(e&&e.message)); }

  // raw structured blocks
  const desc=descOf(f,u); if(desc) it.description=desc;
  const rs=restrictionsOf(u); if(rs) it.restrictions=rs;
  const pn=planningOf(f,u); if(pn) it.planningNotes=pn;
  const tk=toeKickOf(u,f); if(tk) it.toeKick=tk;
  const ap=applianceOf(f,u); if(ap) it.appliance=ap;
  // sink fitment (Base/Sinks, width set) — uses the app's own sinkMaxSize/sinkIsDoor
  try{
    if(f.cat==='Base' && f.sub==='Sinks' && u.w!=null){
      const mx=(typeof sinkMaxSize==='function')?sinkMaxSize(u):null;
      const door=(typeof sinkIsDoor==='function')?!!sinkIsDoor(u):false;
      const above=(typeof SINK_CUSTOM_ABOVE!=='undefined')?SINK_CUSTOM_ABOVE:42;
      const notes=[];
      notes.push(mx!=null?`Cabinet width ${u.w} cm → fits sink bowls up to ${mx}″.`
                         :`Compact sink base (${u.w} cm) — confirm sink-bowl size against the cabinet width.`);
      notes.push(`Sinks over ${above}″ (or wider than 120 cm base) require a custom sink unit.`);
      if(door){ notes.push(`Deep-basin door rule: if basin depth exceeds 8″ (203 mm), add ANSVVO275 (top hinge dropped 27.5 cm for clearance). Not needed for basins ≤ 8″.`); }
      else{ notes.push(`Drawer/pullout sink — no hinge modification (ANSVVO275 does not apply).`);
            if(u.c==='TSP8080Z2') notes.push(`Note: with TSP8080Z2 plan a drawer blender (ANBLS) — the top drawer cannot operate within 26 cm of the top.`); }
      it.sinkFitment={ maxSinkSizeInch:mx, cabinetWidthCm:u.w, customAboveInch:above, isDoor:door,
        showOnCard:/^(Sink Unit|Sink without|Instant)/.test(f.sec||''), notes };
    }
  }catch(e){}

  // finishes / price-unit / spec scalars / catalog page / carcase line / front modifiers
  const fin=finishesOf(u); if(fin) it.finishes=fin;
  try{ it.priceUnit = (typeof priceClass==='function') ? priceClass(u) : ((u.cg===15||u.cg===38||u.cg===61)?'HLP':'pts'); }catch(e){ it.priceUnit='pts'; }
  if(u.pg!=null) it.priceGroupRef=u.pg;
  if(u.pp!=null) it.catalogPage=u.pp;
  try{ const carc=(typeof carcaseLine==='function')?carcaseLine(u):null; if(carc!=null) it.carcaseLine=String(carc); }catch(e){}
  const fm=frontModifiersOf(u); if(fm) it.frontModifiers=fm;
  if(u.wt) it.weightKg=Number((u.wt/10).toFixed(1));
  if(u.vl) it.volumeM3=Number((u.vl/1000).toFixed(2));

  // functional groups (family-level; hidden families excluded)
  const fg=famFunctionalGroups(f); if(fg&&fg.length) it.functionalGroups=fg;

  // ── scraped sections (skip entirely for recovered units) ──
  if(!recovered && pin){
    const params=mapParameters(scrapeConfigure(pin,u)); if(params) it.parameters=params;
    const acc=scrapeAccessoryPanel(pin);
    const split=mapAccPanel(acc,u.c);
    if(split.alterations.length) it.alterations=split.alterations;
    if(split.accessories.length) it.accessories=split.accessories;
    const fi=mapFinishInterior(acc); if(fi) it.finishInterior=fi;
    const rel=scrapeRelated(pin,u);
    const comps=mapCompanions(rel,u.c); if(comps.length) it.companions=comps;
    const eng=mapEngineering(scrapeEngineering(pin)); if(eng) it.engineering=eng;
    const mod=scrapeModifications(pin); if(mod) it.modifications=mod;
    const dyk=scrapeDidYouKnow(pin); if(dyk) it.didYouKnow=dyk;
    // lift the Inspiration tab photo to a top-level card field (drives the card camera button)
    try{ const insTab=(acc&&acc.tabs||[]).find(t=>t.inspiration); if(insTab){ const b=insTab.inspiration;
      const insp={ imageUrl:b.imageUrl, caption:b.caption, fullScreen:b.fullScreen };
      if(b.heading!=null) insp.heading=b.heading;
      it.inspiration=insp; } }catch(e){}
  }
  return it;
}
function mapEngineering(eng){ if(!eng) return null; const out=eng.map(e=>{ const o={}; put(o,'key',e.key); if(typeof e.ok==='boolean') o.ok=e.ok; return Object.keys(o).length?o:null; }).filter(Boolean); return out.length?out:null; }

/* ============================================================================
 * DRIVER
 * ==========================================================================*/
H.IMGT=IMGT;
H.jobs=null;
H.recovered=[];
H.buildJobs=function(){
  // flat list of [f,u,recovered?]; dedupe by sku at finalize (FIRST wins).
  // VISIBLE families first (a sku can live in both a hidden __DRWDUP/MRG_ synthetic AND the real
  // family — the app never renders hidden, so visible-first keeps the family the app shows).
  const jobs=[];
  FAMS.forEach(f=>{ if(f.hid) return; (f.units||[]).forEach(u=>{ jobs.push([f,u,false]); }); });
  FAMS.forEach(f=>{ if(!f.hid) return; (f.units||[]).forEach(u=>{ jobs.push([f,u,false]); }); });
  // CODE2FAM (openDetail builds it lazily; force now — the ref-kind classifier needs it)
  if(!window.CODE2FAM){ window.CODE2FAM={}; FAMS.forEach(function(ff){ if(ff.hid) return; (ff.units||[]).forEach(function(x){ if(!window.CODE2FAM[x.c]) window.CODE2FAM[x.c]=ff; }); }); }

  // ── COVERAGE FIX ──────────────────────────────────────────────────────────
  // The app's OWN init (v171/v172/v175 reclassify) DELETES ~21 non-hidden units from
  // FAMS[].units as "not-in-pricelist" artifacts (GFV has no 55 cm → GFV5580*; F1571
  // width-unparsed cooktops → TK5580*; XW_OHD/XW_OHS/XW_O width-55/27 wall artifacts →
  // OHD/OHS/O..CH; plus country-specific CH/GB variants → AVNTCH/AVNTGB/SMNK200CH/GB/L24CD;
  // and 4 P1-prefixed twins of the above). They are GONE from FAMS, so iterating FAMS can
  // never see them. The pristine JSON is still in the DOM (<script id="DATA">) — re-parse it
  // and enqueue any raw non-hidden unit whose sku is ABSENT from post-init FAMS.
  // These are emitted WITHOUT a DOM scrape (openDetail can't render a unit not in FAMS):
  // identity + dims + capabilities + functionalGroups from the raw record only.
  const post=new Set(); FAMS.forEach(f=>(f.units||[]).forEach(u=>post.add(u.c)));
  H.recovered=[];
  try{
    const el=document.getElementById('DATA');
    const RAW=el?JSON.parse(el.textContent):null;
    if(RAW&&RAW.families){
      const added=new Set();
      RAW.families.forEach(rf=>{ if(rf.hid) return; (rf.units||[]).forEach(ru=>{ const c=ru&&ru.c; if(!c||post.has(c)||added.has(c)) return;
        added.add(c); jobs.push([rf,ru,true]); H.recovered.push({ sku:c, familyId:rf.id }); }); });
    } else { warn('coverage: could not re-parse <script id="DATA"> — recovery skipped.'); }
  }catch(e){ warn('coverage recovery failed: '+(e&&e.message)); }

  H.jobs=jobs; window.__ITEMS=window.__ITEMS||[]; return jobs.length;
};
H.processBatch=function(start,n){
  if(!H.jobs) H.buildJobs();
  const end=Math.min(start+n, H.jobs.length); let errs=0;
  for(let i=start;i<end;i++){ const job=H.jobs[i]; const f=job[0],u=job[1],rec=job[2];
    try{ window.__ITEMS.push(buildItem(f,u,rec)); }
    catch(e){ errs++; window.__ITEMS.push({sku:(u&&u.c)||('ERR'+i),kind:'cabinet',familyId:(f&&f.id),name:(u&&u.c)||'ERR',active:true,_err:String(e&&e.message)}); }
  }
  return { processed:end, total:H.jobs.length, batchErrs:errs, items:window.__ITEMS.length };
};
H.buildCategories=function(){
  const map=new Map();
  FAMS.forEach(f=>{ if(f.hid) return; const cat=f.cat; if(!map.has(cat)) map.set(cat,{name:cat, subs:new Map(), count:0});
    const C=map.get(cat); const subN=(typeof subDisp==='function'?subDisp(f):f.sub)||'—';
    if(!C.subs.has(subN)) C.subs.set(subN,{name:subN, count:0, sections:new Set()});
    const S=C.subs.get(subN); const nU=(f.units||[]).length; C.count+=nU; S.count+=nU; if(f.sec) S.sections.add(f.sec);
  });
  const cats=[]; map.forEach(C=>{ const subs=[]; C.subs.forEach(S=>{ const o={ id:slug(S.name), name:S.name, itemCount:S.count }; if(S.sections.size) o.sections=[...S.sections]; subs.push(o); });
    cats.push({ id:slug(C.name), name:C.name, itemCount:C.count, subcategories:subs }); });
  return cats;
};
H.buildProgrammes=function(){
  return (typeof PROGS!=='undefined'?PROGS:[]).map(p=>{ const o={ id:p.k, name:p.n, family:p.fam, tier:famTier(p.fam) }; if(p.fld!=null)o.priceField=p.fld; return o; });
};
H.buildSystems=function(){
  const S=((typeof SYSTEMS!=='undefined'&&SYSTEMS)||window.SYSTEMS)||[];
  const slot=g=>{ const o={ role:g.n, options:(g.c||[]).map((c,i)=>{ const r={sku:c}; if(g.lbl&&g.lbl[i]) r.label=g.lbl[i]; return r; }) };
    if((g.c||[]).length>1 && g.def) o.default=g.def; return o; };
  return S.map(sys=>{ const o={ id:sys.id, name:sys.name }; if(sys.note) o.note=sys.note;
    o.triggerSkus=(sys.trigger||[]).slice(); o.required=(sys.required||[]).map(slot);
    if(sys.optional&&sys.optional.length) o.optional=sys.optional.map(slot); return o; });
};
// FACE CARD per family, per tier context (driving the app's own visibleBlocks() in DEFAULT state).
H.buildFaces=function(){
  const face={};
  if(typeof visibleBlocks!=='function' || typeof FAMS==='undefined' || typeof state==='undefined') return face;
  const byFam={}; (typeof PROGS!=='undefined'?PROGS:[]).forEach(p=>{ (byFam[p.fam]=byFam[p.fam]||[]).push(p.k); });
  const first=(f)=>(byFam[f]&&byFam[f][0])||null;
  const CTX=[['_',null],['P',first('PRIMO')],['A',first('AVANCE')],['C',first('CONTINO')]];
  const cats=[...new Set(FAMS.filter(f=>!f.hid).map(f=>f.cat))];
  const s={prog:state.prog,cat:state.cat,sub:state.sub};
  CTX.forEach(([key,pk])=>{ if(key!=='_' && !pk) return;
    cats.forEach(cat=>{
      state.prog=pk; state.cat=cat; state.sub='';
      let vb=[]; try{ vb=visibleBlocks(); }catch(e){ return; }
      vb.forEach(x=>{ if(!x||!x.b||!x.u||!x.u.c) return;
        const o=(face[x.b.id]=face[x.b.id]||{});
        if(o[key]==null) o[key]=x.u.c; });
    }); });
  state.prog=s.prog; state.cat=s.cat; state.sub=s.sub;
  return face;
};

H.finalize=function(){
  const items=window.__ITEMS||[];
  // dedupe by sku (first wins; prefer non-error)
  const bySku=new Map();
  items.forEach(it=>{ const k=it.sku; if(!bySku.has(k)){ bySku.set(k,it); } else { const ex=bySku.get(k); if(ex._err && !it._err) bySku.set(k,it); } });
  const uniq=[...bySku.values()];

  // synthesize missing referenced skus (minimal stubs). NOTE: parameters.programme targets are
  // tier-prefix siblings (P/C/A/P1/C1) synthesized by the backend — NOT stored → excluded here.
  const present=new Set(uniq.map(i=>i.sku));
  const referenced=new Set();
  const addRef=(s)=>{ if(s&&typeof s==='string') referenced.add(s); };
  uniq.forEach(it=>{
    if(it.parameters){ ['width','height','depth','options'].forEach(r=>(it.parameters[r]||[]).forEach(o=>addRef(o.sku))); }
    (it.alterations||[]).forEach(addRef);
    (it.accessories||[]).forEach(a=>{ if(typeof a==='string') addRef(a); else if(a){ addRef(a.sku); (a.variants||[]).forEach(v=>addRef(v.sku)); } });
    (it.companions||[]).forEach(addRef);
    (it.modifications||[]).forEach(m=>(m.codes||[]).forEach(c=>addRef(c.sku)));
    (it.didYouKnow&&it.didYouKnow.codes||[]).forEach(c=>addRef(c.sku));
  });
  (((typeof SYSTEMS!=='undefined'&&SYSTEMS)||window.SYSTEMS)||[]).forEach(sys=>{
    (sys.trigger||[]).forEach(addRef);
    (sys.required||[]).concat(sys.optional||[]).forEach(g=>(g.c||[]).forEach(addRef));
  });
  const synth=[];
  const validCode=(s)=> typeof s==='string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{1,40}$/.test(s) && !/\s/.test(s);
  referenced.forEach(sku=>{ if(present.has(sku)) return; if(!validCode(sku)) return;
    let kind='accessory', name=sku, cat, sub;
    if(typeof ALTN!=='undefined' && ALTN[sku]) name=ALTN[sku];
    if(/^AN/.test(sku)) kind='alteration';
    else if(/U$/.test(sku) && present.has(sku.replace(/U$/,''))) kind='part';
    const cf=window.CODE2FAM&&window.CODE2FAM[sku];
    if(cf){ cat=cf.cat; sub=(typeof subDisp==='function'?subDisp(cf):cf.sub); if(!ALTN||!ALTN[sku]) name=cf.label||sku; if(cf.cat==='Alteration')kind='alteration'; }
    const o={ sku, kind, name, active:true }; if(cat)o.category=cat; if(sub)o.subcategory=sub;
    synth.push(o);
  });
  const all=uniq.concat(synth);
  all.forEach(it=>{ delete it._err; });

  // Tag each family's face unit with the tier contexts it fronts (key by familyId|sku).
  const faces=H.buildFaces(); const faceOf={};
  Object.keys(faces).forEach(fid=>{ const o=faces[fid];
    Object.keys(o).forEach(k=>{ const key=fid+'|'+o[k]; (faceOf[key]=faceOf[key]||[]); if(faceOf[key].indexOf(k)<0) faceOf[key].push(k); }); });
  const FORD={'_':0,P:1,A:2,C:3};
  all.forEach(it=>{ const fc=faceOf[it.familyId+'|'+it.sku]; if(fc&&fc.length) it.faceForTiers=fc.slice().sort((a,b)=>FORD[a]-FORD[b]); });

  const cabinets=all.filter(i=>i.kind==='cabinet').length;
  const cats=H.buildCategories(); const progs=H.buildProgrammes();
  const funcCats=H.buildFunctionalCategories();
  const recoveredSkus=(H.recovered||[]).map(r=>r.sku);
  const exp={
    meta:{
      generated:new Date().toISOString(),
      source:'leicht_units v781 (headless DOM extraction via openDetail)',
      schemaVersion:'2.0.0',
      imageUrlTemplate:IMGT,
      counts:{ items:all.length, cabinets, accessories:all.length-cabinets, categories:cats.length, programmes:progs.length, recovered:recoveredSkus.length },
      recoveredArtifactSkus:recoveredSkus,   // app-suppressed "not-in-pricelist" units re-included by the coverage fix
      note:'Minimal + capabilities export of v781. Each item is the THIN shape: '+
        'capabilities REPLACES programmeAvailability (raw u.x excludedPrograms + tier/depth/handle/open/antoso/door gate inputs, '+
        'isFrmat kept so the backend layers the FRMAT max-size rule); configure→parameters (label+sku pills only); '+
        'accessoryPanel→alterations/accessories(+variants)/finishInterior; relatedGroups→companions; engineering→{key,ok}. '+
        'Built by driving the app\'s own openDetail()/visibleBlocks()/famInTaskSub(); '+recoveredSkus.length+' app-deleted '+
        'artifact units recovered from the raw <script id="DATA"> (see meta.recoveredArtifactSkus); '+synth.length+
        ' referenced non-unit codes synthesized as minimal accessory/part/alteration stubs.'
    },
    categories:cats,
    programmes:progs,
    ruleTables:(typeof RULES!=='undefined'?RULES:{}),
    systems:H.buildSystems(),
    functionalCategories:funcCats,
    items:all
  };
  window.__EXPORT=exp;
  return { items:all.length, cabinets, synth:synth.length, uniq:uniq.length, cats:cats.length, progs:progs.length,
           recovered:recoveredSkus.length, functionalCategories: funcCats?true:false, warnings:H.warnings.length };
};
H.post=async function(url){
  const body=JSON.stringify(window.__EXPORT);
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});
  return { status:r.status, len:body.length, resp:await r.text() };
};
return 'H ready (extractor2 — minimal+capabilities, functional view, coverage recovery)';
})();
