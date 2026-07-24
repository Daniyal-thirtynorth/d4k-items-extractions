#!/usr/bin/env node
/*
 * diff-grid-parity.js — grid parity: client rendered face+grey per family vs our API.
 * Client truth (scratchpad/client_grid_truth.json) = per (W|H|D) combo, per sink family:
 *   { f: face code (selectedUnit), w: face width mm, g: greyed (1/0) }.
 * Ours = GET /items?leafId=b_water#0&groupBy=family&grey=true&widthMm&heightClass&depthClass
 *   → per family: face sku + greyByCaps (availableFromCaps(face.caps, {depth})).
 *
 * Run: node scripts/diff-grid-parity.js
 */
const fs = require('fs');
const http = require('http');
const SP = '/private/tmp/claude-501/-Users-apple-Documents-thirtynorth-node-js-d4k-items-extraction/f010f785-c1d3-49b3-bcb6-3fd14da494df/scratchpad/';
const truth = JSON.parse(fs.readFileSync(SP + 'client_grid_truth.json', 'utf8'));

// availableFromCaps port (depth/tier only; sweep uses tier=ALL, no gates/programme)
function afc(c, s) {
  if (!c) return true; if (c.alwaysAvailable) return true;
  const dc = c.depthClasses || [];
  const depthOk = s.depth === 58 || s.depth === 63 || dc.includes(s.depth);
  return depthOk; // tier ALL, no gates, no programme
}
function tok() {
  return new Promise((res, rej) => {
    http.get('http://localhost:8000/design-book/dev-token', (r) => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b).token)); }).on('error', rej);
  });
}
function api(path, t) {
  return new Promise((res, rej) => {
    http.get('http://localhost:8000/design-book/' + path, { headers: { Authorization: 'Bearer ' + t } }, (r) => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}

(async () => {
  const t = await tok();
  const combos = Object.keys(truth.data);
  let faceMism = [], greyMism = [], memberMism = [];
  let compared = 0;
  for (const key of combos) {
    const [W, H, D] = key.split('|');
    const cli = truth.data[key];
    let p = `items?leafId=b_water%230&groupBy=family&grey=true&limit=80&widthMm=${+W * 10}&depthClass=${D}`;
    if (H !== 'ALL') p += `&heightClass=${H}`;
    const d = (await api(p, t)).data;
    const ours = {}; // familyId -> {face, grey}
    for (const it of (d.items || [])) ours[it.familyId] = { face: it.sku, grey: afc(it.capabilities, { depth: +D }) === false };
    // client families SHOWN at this width = face width matches W (family has a W unit)
    const cliShown = Object.keys(cli).filter(fid => cli[fid].w === +W * 10);
    const oursShown = Object.keys(ours);
    // membership diff
    const cliSet = new Set(cliShown), ourSet = new Set(oursShown);
    const cliOnly = cliShown.filter(f => !ourSet.has(f));
    const ourOnly = oursShown.filter(f => !cliSet.has(f));
    if (cliOnly.length || ourOnly.length) memberMism.push({ key, cliOnly, ourOnly });
    // face + grey diff for families in BOTH
    for (const fid of cliShown) {
      if (!ours[fid]) continue;
      compared++;
      if (cli[fid].f !== ours[fid].face) faceMism.push({ key, fid, client: cli[fid].f, ours: ours[fid].face });
      const cg = !!cli[fid].g, og = !!ours[fid].grey;
      if (cg !== og) greyMism.push({ key, fid, clientGrey: cg, oursGrey: og, face: ours[fid].face });
    }
  }
  console.log(`combos: ${combos.length} | family-comparisons: ${compared}`);
  console.log(`\nFACE mismatches: ${faceMism.length}`);
  faceMism.slice(0, 20).forEach(m => console.log(`  ${m.key}  ${m.fid}  client=${m.client}  ours=${m.ours}`));
  console.log(`\nGREY mismatches: ${greyMism.length}`);
  greyMism.slice(0, 20).forEach(m => console.log(`  ${m.key}  ${m.fid}  clientGrey=${m.clientGrey}  oursGrey=${m.oursGrey}  (${m.face})`));
  console.log(`\nMEMBERSHIP mismatches (combos): ${memberMism.length}`);
  memberMism.slice(0, 12).forEach(m => console.log(`  ${m.key}  cliOnly=[${m.cliOnly}]  ourOnly=[${m.ourOnly}]`));
  fs.writeFileSync(SP + 'diff-grid-parity-report.json', JSON.stringify({ compared, faceMism, greyMism, memberMism }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
