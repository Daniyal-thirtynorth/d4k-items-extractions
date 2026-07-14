/* ============================================================================
 * LEICHT v767 → export-schema.ts extractor (in-page, drives the app's own openDetail)
 * Injected once; then main thread calls H.processBatch(start,n) and H.finalize().
 * ==========================================================================*/
(function(){
const H = window.__H = {};
const T = (el)=> el? (el.textContent||'').replace(/\s+/g,' ').trim() : '';
const num = (s)=>{ const m=String(s).match(/-?\d+(\.\d+)?/); return m?Number(m[0]):null; };
const slug = (s)=> String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const IMGT = (typeof IMG==='function') ? IMG('__CODE__').replace('__CODE__','<CODE>') : '<CODE>';
const FAMLET = (typeof window.FAMLET!=='undefined')?window.FAMLET:{PRIMO:'P',AVANCE:'A',CONTINO:'C'};
const famTier = (fam)=>{ const F=String(fam||''); if(F.indexOf('PRIMO')===0)return 'P'; if(F.indexOf('AVANCE')===0)return 'A'; if(F.indexOf('CONTINO')===0)return 'C'; return (FAMLET&&FAMLET[fam])||'P'; };

// ---- target parse from a chip onclick ----
function chipTarget(onclick, u){
  if(!onclick) return null;
  let m;
  if(m=onclick.match(/openDetail\('[^']*','([^']*)'\)/)) return m[1];
  if(m=onclick.match(/goFam\('([^']*)'\)/)) return m[1];
  if(m=onclick.match(/setDepth63\('([^']*)'/)) return m[1];
  if(m=onclick.match(/goBandDetail\('[^']*','[^']*','([^']*)'\)/)){ try{ return sibCode(u,m[1])||null; }catch(e){ return null; } }
  if(m=onclick.match(/setDetailOpen\('([^']*)'\)/)){ try{ return sibCode(u,m[1])||null; }catch(e){ return null; } }
  if(/setDepth\(/.test(onclick)) return u.c;   // carcass-depth toggle on same article
  if(/pickInsert\(/.test(onclick)) return u.c;
  return null;
}
function chipAvail(chip){
  if(chip.disabled) return false;
  const st=chip.getAttribute('style')||'';
  if(/opacity\s*:\s*\.?[0-3]/.test(st)) return false;  // opacity .3/.4 = greyed
  return true;
}
function chipCrossed(chip){
  const cls=chip.className||''; const st=chip.getAttribute('style')||'';
  return /d63off/.test(cls) || /line-through/.test(st);
}

// ---- card extraction ----
function cardFrom(icard, ownName){
  const codeEl=icard.querySelector('.icode');
  let sku = T(codeEl);
  // collect all codes referenced in the card (copyCode / openDetail)
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
  // variants: itemCardMulti renders .mchip buttons -> mcPick('id','CODE',this)
  const variants=[];
  icard.querySelectorAll('.mchip').forEach(ch=>{
    const oc=ch.getAttribute('onclick')||''; const m=oc.match(/mcPick\('[^']*','([^']*)'/);
    const vc=m?m[1]:null; const vl=T(ch);
    if(vc && vl) variants.push({label:vl,sku:vc});
  });
  if(variants.length){ ref.variants=variants; if(!ref.label && name) ref.label=name; }
  return ref;
}

// walk a panel and split into {notes, sections, swatches, visibleSideCombos, options, inspiration}
function scrapePanel(panel){
  const res={ notes:[], sections:[] };
  // swatches
  const sw=[...panel.querySelectorAll('.swgrid figure')];
  if(sw.length){ res.swatches=sw.map(fig=>{ const code=T(fig.querySelector('figcaption')); const img=fig.querySelector('img'); return {code,label:code, imageUrl: img?img.getAttribute('src'):undefined}; }); }
  // visible-side combos
  const vt=[...panel.querySelectorAll('.vtbl tbody tr')];
  if(vt.length){ res.visibleSideCombos=vt.map(tr=>{ const td=tr.querySelectorAll('td'); return { interior:T(td[0]), allowed:T(td[1]).split(/,\s*/).filter(Boolean) }; }); }
  // options chips
  const oc=[...panel.querySelectorAll('.ochip')];
  if(oc.length){ res.options=oc.map(x=>T(x)); }
  // inspiration
  const insp=panel.querySelector('.inspshot');
  if(insp){ const img=insp.querySelector('img'); const b={ imageUrl: img?img.getAttribute('src'):'', fullScreen:true };
    // caption note (dwInspoCap): `<b>code</b> — label · dims<span class="lbx-cap-sub">TAIL</span>` — split heading vs sub-line
    const capNote=[...panel.querySelectorAll('.note')].find(n=>n.querySelector('.lbx-cap-sub'));
    if(capNote){ const sub=capNote.querySelector('.lbx-cap-sub'); const tail=T(sub);
      const head=T(capNote).slice(0, T(capNote).length-tail.length).trim();
      if(head) b.heading=head; if(tail) b.caption=tail; }
    res.inspiration=b; }
  // sub-tabs (Alterations: Standard / Unit Specific)
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
  // generic: walk headings (.ihdr / .sub2) and cards in document order
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
  // panel-level notes (direct .note not inside a card/desc)
  [...panel.querySelectorAll('.note')].forEach(n=>{
    if(n.closest('.icard')||n.closest('.idesc')) return;
    if(n.querySelector('.lbx-cap-sub')) return;  // inspiration caption note — captured in res.inspiration, not notes[]
    const t=T(n); if(t) res.notes.push(t);
  });
  return res;
}

// ---- section scrapers on the current #pin ----
function scrapeConfigure(pin,u){
  const cfg=[...pin.querySelectorAll('.cfgsec .cfgrow')];
  if(!cfg.length) return null;
  const C={ width:[], height:[], depth:[], programme:[], optionRows:[] };
  cfg.forEach(row=>{
    const k=T(row.querySelector('.cfgk'));
    const chips=[...row.querySelectorAll('.chip')];
    if(k==='Width'||k==='Height'||k==='Depth'){
      const arr=chips.map(ch=>{ const lbl=T(ch); const oc=ch.getAttribute('onclick'); const o={ label:lbl, value:(num(lbl)!=null?num(lbl)*10:null), unit:'mm', sku:chipTarget(oc,u), selected:/(^|\s)good(\s|$)/.test(ch.className), available:chipAvail(ch) }; if(k==='Depth'&&/63/.test(lbl)) o.note='63 cm depth (alteration)'; return o; });
      C[k.toLowerCase()]=arr;
    } else if(k==='Programme'){
      C.programme=chips.map(ch=>{ const lbl=T(ch); const tier=lbl; const oc=ch.getAttribute('onclick'); let sku=null; try{ sku=sibCode(u,tier)||chipTarget(oc,u);}catch(e){ sku=chipTarget(oc,u);} return { label:lbl, tier, opening:/1$/.test(tier), sku:(sku&&CODESET&&CODESET.has(sku))?sku:(sku||null), selected:/(^|\s)good(\s|$)/.test(ch.className), available:chipAvail(ch) }; });
    } else {
      const options=chips.map(ch=>{ const lbl=T(ch); const oc=ch.getAttribute('onclick'); const o={ label:lbl, sku:chipTarget(oc,u), selected:/(^|\s)good|(^|\s)sel/.test(ch.className), available:chipAvail(ch) }; if(chipCrossed(ch)) o.crossedOut=true; const img=ch.querySelector('img.fsw'); if(img) o.swatch=lbl; return o; });
      C.optionRows.push({ label:k, options });
    }
  });
  if(!C.optionRows.length) delete C.optionRows;
  const muted=pin.querySelector('.cfgsec .muted'); if(muted){ const t=T(muted); if(t) C.note=t; }
  return C;
}
function scrapeEngineering(pin){
  const sec=[...pin.querySelectorAll(':scope > .sec')].find(s=>/^Engineering/.test(T(s.querySelector('h4'))));
  if(!sec) return null;
  const out=[];
  sec.querySelectorAll('.kv').forEach(kv=>{
    const kEl=kv.querySelector('.k'); const vEl=kv.children[1];
    const ktext=T(kEl); const ok=/🟢/.test(ktext); const label=ktext.replace(/^[^A-Za-z0-9(]+/,'').trim();
    const value=T(vEl);
    let key='flag'; const L=label.toLowerCase();
    if(/suspended/.test(L))key='suspended'; else if(/sensomatic/.test(L))key='sensomatic'; else if(/tip-?softclose|tip-on/.test(L))key='tipSoftclose'; else if(/opening system p1|opening p1/.test(L))key='openingP1'; else if(/68\s*cm/.test(L))key='depth68';
    const o={ key, label, ok, value }; out.push(o);
  });
  return out.length?out:null;
}
function scrapeAccessoryPanel(pin,u){
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
    const count=cntEl?(num(T(cntEl))||0):0;
    if(cntEl) label=label.replace(/\s*\d+\s*$/,'').trim();
    const p=scrapePanel(panel);
    const tab={ label, count, notes:p.notes||[], sections:p.sections||[] };
    if(p.swatches) tab.swatches=p.swatches;
    if(p.visibleSideCombos) tab.visibleSideCombos=p.visibleSideCombos;
    if(p.options) tab.options=p.options;
    if(p.inspiration){ p.inspiration.item={sku:u.c}; tab.inspiration=p.inspiration; tab.sections=[]; }
    if(tab.label==='Alterations' && tab.sections.length===1 && tab.sections[0].heading==null) tab.sections[0].heading='Standard';
    tabs.push(tab);
  });
  return { tabs };
}
const REL_MAP={ 'Planned together':'plannedTogether', 'Often planned with':'oftenPlannedWith', 'Opening support':'openingSupport', 'Complete this cabinet':'completeThisCabinet' };
function scrapeRelated(pin,u){
  const out=[];
  // compatible accessories from REFS graph (also shown as a tab)
  try{
    const rr=(window.REFS&&(REFS[u.c]||REFS[u.idmc]))||'';
    const codes=rr?rr.split(',').map(s=>s.trim()).filter(c=>c && c.toUpperCase()!=='ANTOSO' && window.CODE2FAM && window.CODE2FAM[c]):[];
    if(codes.length) out.push({ key:'compatibleAccessories', heading:'Compatible Accessories', notes:[], cards:codes.map(c=>({sku:c})) });
  }catch(e){}
  [...pin.querySelectorAll(':scope > .sec')].forEach(s=>{
    const h=T(s.querySelector('h4')).replace(/\s*—.*$/,'').trim();
    const key=REL_MAP[h]||REL_MAP[Object.keys(REL_MAP).find(k=>h.indexOf(k)===0)];
    if(!key) return;
    const cards=[...s.querySelectorAll('.icard')].map(ic=>cardFrom(ic));
    const notes=[...s.querySelectorAll('.note')].filter(n=>!n.closest('.icard')).map(n=>T(n)).filter(Boolean);
    if(cards.length) out.push({ key, heading:h, notes, cards });
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
    const warn=T(r.querySelector('.muted'));
    let text=T(r); if(title&&text.indexOf(title)===0) text=text.slice(title.length).replace(/^[\s—\-]+/,'');
    if(warn&&text.indexOf(warn)>=0) text=text.replace(warn,'').trim();
    const o={ title, text, codes }; if(warn) o.warn=warn;
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

// ---- non-scraped (raw) fields ----
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
function specOf(f,u,pin){
  const carc = (typeof carcaseLine==='function')?carcaseLine(u):null;
  const mods=[u.V?'Vertical handle (V)':'',u.E?'One-piece front (E)':'',u.J?'Line-86 (J)':'',u.Yc?'Line-66 (Y) → '+u.Yc:''].filter(Boolean).join(' · ')||'—';
  const s={ widthMm:(u.W!=null?u.W:null), heightMm:(u.H!=null?u.H:(f.h!=null?f.h:null)), depthMm:(u.D!=null?u.D:null) };
  if(u.D!=null){ s.depthKind='carcass'; }
  s.modifiers=mods;
  if(carc!=null) s.carcaseLine=String(carc);
  if(u.wt) s.weightKg=Number((u.wt/10).toFixed(1));
  if(u.vl) s.volumeM3=Number((u.vl/1000).toFixed(2));
  if(u.pg) s.catalogPage={ priceGroupRef:u.pg, pdfPage:(u.pp!=null?u.pp:null) };
  return s;
}
function progAvailOf(f,u){
  let pks=[]; try{ pks=progKeysFor(u)||[]; }catch(e){}
  const availIds=[];
  try{ pks.forEach(pk=>{ const okp=(typeof progOkFor==='function')?progOkFor(u,pk):true; if(okp) availIds.push(pk); }); }catch(e){}
  const excl=(u.x||[]);
  return { excluded: excl.length>0, programmes: availIds, note: excl.length? ('Excluded from '+excl.length+' programme(s).') : 'No programme exclusions.' };
}
function planningOf(f,u){
  const parts=[];
  if(u.note) parts.push(u.note);
  try{ if(u.pa&&u.pa.length&&typeof paUSA==='function') paUSA(u.pa).forEach(x=>parts.push(x)); }catch(e){ if(u.pa) u.pa.forEach(x=>parts.push(String(x))); }
  if(f.plan) (Array.isArray(f.plan)?f.plan:[f.plan]).forEach(x=>parts.push(String(x)));
  return parts.length?parts:null;
}
function restrictionsOf(u){
  const rs=(u.rs&&u.rs.length)?u.rs.slice():[];
  return rs.length?rs:null;
}
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
    if(o.category==='Dishwashers'){ o.subcategory=applSub(u); const n=applNote(f.id,u)||f.plan; if(n) o.note=n; }  // subcategory + note are DW-only (mirror the app payload)
    return o;
  }catch(e){ return null; }
}
function finishesOf(u){
  if(!u.f) return null; const out=[];
  for(const k in u.f){ out.push({ finishCode:k, price:u.f[k] }); }
  return out.length?out:null;
}
function catalogOf(u){
  if(!u.pg) return null;
  const o={ available:true, page:(u.pp!=null?u.pp:null), priceGroupRef:u.pg };
  return o;
}
function badgeText(u){ try{ const h=progBadge(u); const d=document.createElement('div'); d.innerHTML=h; return T(d)||null; }catch(e){ return null; } }
function kindOf(f,u){
  if(f.cat==='Alteration') return 'alteration';
  try{ if(isAccessory(f)) return 'accessory'; }catch(e){}
  if(f.dim==='none' && /^AN/.test(u.c)) return 'alteration';
  return 'cabinet';
}

// ---- build one item ----
function buildItem(f,u){
  try{ state.depth = (D2CODE[u.D]!=null?D2CODE[u.D]:58); state.open=''; state.d63=null; }catch(e){}
  try{ openDetail(f.id, u.c); }catch(e){}
  const pin=document.getElementById('pin');
  const name = u.sd||u.ul||f.label||u.c;
  const it={ sku:u.c, kind:kindOf(f,u), familyId:f.id, name };
  if(f.label && f.label!==name) it.cardLabel=f.label;
  // amber sub-label next to the card title = family vsub[vr] (hidden when a special display name exists)
  try{ if(!u.sd && f.vsub && f.vsub[u.vr]) it.nameQualifier=f.vsub[u.vr]; }catch(e){}
  // "L/R" badge — available left OR right hinged (app's own handed(); state hinge side on order)
  try{ if(typeof handed==='function' && handed(u)) it.handedLR=true; }catch(e){}
  const bt=badgeText(u); if(bt) it.programmeBadge=bt;
  try{ const tiers=unitTiers(u); if(tiers&&tiers.length) it.availableTiers=tiers; }catch(e){}
  it.category=f.cat; it.subcategory=(typeof subDisp==='function'?subDisp(f):f.sub); if(f.sec) it.section=f.sec;
  it.active=true;
  if(u.W!=null) it.widthMm=u.W; if(u.H!=null) it.heightMm=u.H; if(u.D!=null) it.depthMm=u.D;
  it.heightClass = [73,80,86].includes(u.hc)?u.hc:null;
  const tk=toeKickOf(u,f); if(tk) it.toeKick=tk;
  const ap=applianceOf(f,u); if(ap) it.appliance=ap;
  const cfg=scrapeConfigure(pin,u); if(cfg) it.configure=cfg;
  const desc=descOf(f,u); if(desc) it.description=desc;
  it.specification=specOf(f,u,pin);
  // Sink fitment — "Max Sink Size" card line + "Add Sink" popup + detail "Sink fitment" section.
  // Uses the app's own sinkMaxSize/sinkIsDoor so the value matches the UI exactly (Base/Sinks, width set).
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
  const rs=restrictionsOf(u); if(rs) it.restrictions=rs;
  it.programmeAvailability=progAvailOf(f,u);
  const eng=scrapeEngineering(pin); if(eng) it.engineering=eng;
  const mod=scrapeModifications(pin); if(mod) it.modifications=mod;
  const pn=planningOf(f,u); if(pn) it.planningNotes=pn;
  const dyk=scrapeDidYouKnow(pin); if(dyk) it.didYouKnow=dyk;
  const cat=catalogOf(u); if(cat) it.catalog=cat;
  const acc=scrapeAccessoryPanel(pin,u); if(acc) it.accessoryPanel=acc;
  // lift the Inspiration tab's photo to a TOP-LEVEL card field so the grid list API returns it
  // (accessoryPanel is omitted from list rows) — drives the card camera button → lightbox popup.
  try{ const insTab=(acc&&acc.tabs||[]).find(t=>t.inspiration); if(insTab){ const b=insTab.inspiration;
    it.inspiration={ imageUrl:b.imageUrl, caption:b.caption, heading:b.heading, fullScreen:b.fullScreen };
    if(it.inspiration.heading==null) delete it.inspiration.heading; } }catch(e){}
  const rel=scrapeRelated(pin,u); if(rel) it.relatedGroups=rel;
  const fin=finishesOf(u); if(fin) it.finishes=fin;
  // pts-pill unit — HLP dealer-list calc groups (cg 15/38/61) show "HLP"; everything else "pts".
  // Ports the app's own priceClass(u); per-item (some accessories are HLP → their cards read "NNN HLP").
  try{ it.priceUnit = (typeof priceClass==='function') ? priceClass(u) : ((u.cg===15||u.cg===38||u.cg===61)?'HLP':'pts'); }catch(e){ it.priceUnit='pts'; }
  return it;
}

// ---- driver ----
H.IMGT=IMGT;
H.jobs=null;
H.buildJobs=function(){
  // flat list of {f,u}; keep all families (dedupe by sku at finalize)
  const jobs=[]; FAMS.forEach(f=>{ (f.units||[]).forEach(u=>{ jobs.push([f,u]); }); });
  // ensure CODE2FAM built (openDetail builds it lazily; force now)
  if(!window.CODE2FAM){ window.CODE2FAM={}; FAMS.forEach(function(ff){ if(ff.hid) return; ff.units.forEach(function(x){ if(!window.CODE2FAM[x.c]) window.CODE2FAM[x.c]=ff; }); }); }
  H.jobs=jobs; window.__ITEMS=window.__ITEMS||[]; return jobs.length;
};
H.processBatch=function(start,n){
  if(!H.jobs) H.buildJobs();
  const end=Math.min(start+n, H.jobs.length); let errs=0;
  for(let i=start;i<end;i++){ const [f,u]=H.jobs[i]; try{ window.__ITEMS.push(buildItem(f,u)); }catch(e){ errs++; window.__ITEMS.push({sku:(u&&u.c)||('ERR'+i),kind:'cabinet',familyId:(f&&f.id),name:(u&&u.c)||'ERR',_err:String(e&&e.message)}); } }
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
// System Builder registry (window.SYSTEMS) -> EngineeredSystem[] (see export-schema.ts).
// A slot's pill labels come from the source `lbl[]`; `default` only when >1 option.
H.buildSystems=function(){
  const S=((typeof SYSTEMS!=='undefined'&&SYSTEMS)||window.SYSTEMS)||[];
  const slot=g=>{ const o={ role:g.n, options:(g.c||[]).map((c,i)=>{ const r={sku:c}; if(g.lbl&&g.lbl[i]) r.label=g.lbl[i]; return r; }) };
    if((g.c||[]).length>1 && g.def) o.default=g.def; return o; };
  return S.map(sys=>{ const o={ id:sys.id, name:sys.name }; if(sys.note) o.note=sys.note;
    o.triggerSkus=(sys.trigger||[]).slice(); o.required=(sys.required||[]).map(slot);
    if(sys.optional&&sys.optional.length) o.optional=sys.optional.map(slot); return o; });
};
H.finalize=function(){
  const items=window.__ITEMS||[];
  // dedupe by sku (first wins; prefer non-error)
  const bySku=new Map();
  items.forEach(it=>{ const k=it.sku; if(!bySku.has(k)){ bySku.set(k,it); } else { const ex=bySku.get(k); if(ex._err && !it._err) bySku.set(k,it); } });
  const uniq=[...bySku.values()];
  // synthesize missing referenced skus
  const present=new Set(uniq.map(i=>i.sku));
  const referenced=new Set();
  const addRef=(s)=>{ if(s&&typeof s==='string') referenced.add(s); };
  uniq.forEach(it=>{
    // NOTE: configure.programme targets are tier-prefix siblings (P/C/A/P1/C1) derived on the fly
    //   by the app (byprog families) and synthesized by the backend from a base code + featureFlags —
    //   they are NOT stored item records, so they are intentionally excluded from synthesis.
    if(it.configure){ ['width','height','depth'].forEach(r=>(it.configure[r]||[]).forEach(o=>addRef(o.sku))); (it.configure.optionRows||[]).forEach(row=>row.options.forEach(o=>addRef(o.sku))); }
    (it.accessoryPanel&&it.accessoryPanel.tabs||[]).forEach(t=>(t.sections||[]).forEach(s=>(s.cards||[]).forEach(c=>{ addRef(c.sku); (c.variants||[]).forEach(v=>addRef(v.sku)); })));
    (it.relatedGroups||[]).forEach(g=>(g.cards||[]).forEach(c=>{ addRef(c.sku); (c.variants||[]).forEach(v=>addRef(v.sku)); }));
    (it.modifications||[]).forEach(m=>(m.codes||[]).forEach(c=>addRef(c.sku)));
    (it.didYouKnow&&it.didYouKnow.codes||[]).forEach(c=>addRef(c.sku));
  });
  // System Builder trigger + component codes are ItemRefs too — synthesize any non-unit one
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
  const cabinets=all.filter(i=>i.kind==='cabinet').length;
  const cats=H.buildCategories(); const progs=H.buildProgrammes();
  const exp={
    meta:{
      generated:new Date().toISOString(),
      source:'leicht_units v767 (headless DOM extraction via openDetail)',
      schemaVersion:'1.0.0',
      imageUrlTemplate:IMGT,
      counts:{ items:all.length, cabinets, accessories:all.length-cabinets, categories:cats.length, programmes:progs.length },
      note:'Fresh extraction of v767. Each item built by driving the app\'s own openDetail() renderer and scraping the detail panel; scalar fields (dims, finishes, appliance) read from source records. References are ItemRefs by sku; '+synth.length+' referenced non-unit codes synthesized as accessory/part/alteration items.'
    },
    categories:cats,
    programmes:progs,
    ruleTables:(typeof RULES!=='undefined'?RULES:{}),
    systems:H.buildSystems(),
    items:all
  };
  window.__EXPORT=exp;
  return { items:all.length, cabinets, synth:synth.length, uniq:uniq.length, cats:cats.length, progs:progs.length };
};
H.post=async function(url){
  const body=JSON.stringify(window.__EXPORT);
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});
  return { status:r.status, len:body.length, resp:await r.text() };
};
return 'H ready';
})();
