/* End-to-end check of the authoring-dialog paths added in v2.5 (Check rows 19-21).
   Creates a throwaway item, round-trips it through the dialog's OWN transforms, and
   deletes it. Touches no real catalog data. */
const BASE = 'http://localhost:8000/design-book';
const SKU = 'ZZ_V25_DIALOG_TEST';

// ---- verbatim from design-book-item-dialog.tsx ----------------------------
const SUL_ROWS = ['width', 'height'];
const sulToForm = (p) => {
  if (!p) return p;
  const out = { ...p };
  for (const k of SUL_ROWS) {
    if (!Array.isArray(out[k])) continue;
    out[k] = out[k].map((o) =>
      Array.isArray(o?.showUnderLine) ? { ...o, showUnderLine: o.showUnderLine.join(',') } : o);
  }
  return out;
};
const sulFromForm = (p) => {
  if (!p) return p;
  const out = { ...p };
  for (const k of SUL_ROWS) {
    if (!Array.isArray(out[k])) continue;
    out[k] = out[k].map((o) => {
      if (o?.showUnderLine == null || o.showUnderLine === '') {
        const { showUnderLine, ...rest } = o || {}; return rest;
      }
      const nums = String(o.showUnderLine).split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n));
      const { showUnderLine, ...rest } = o;
      return nums.length ? { ...rest, showUnderLine: nums } : rest;
    });
  }
  return out;
};
const NULLABLE_SCALARS = ['heightCode', 'catalogRank', 'sectionRank', 'familyIndex'];
function prune(v) {
  if (Array.isArray(v)) { const a = v.map(prune).filter((x) => x !== undefined); return a.length ? a : undefined; }
  if (v && typeof v === 'object') {
    const o = {}; for (const k of Object.keys(v)) { const p = prune(v[k]); if (p !== undefined) o[k] = p; }
    return Object.keys(o).length ? o : undefined;
  }
  return v === '' || v == null ? undefined : v;
}
// --------------------------------------------------------------------------

const ck = (n, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  ' + extra : '')); return ok; };
let fails = 0;

(async () => {
  const tok = (await (await fetch(BASE + '/dev-token')).json()).token;
  const H = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
  const del = () => fetch(`${BASE}/items/${SKU}`, { method: 'DELETE', headers: H }).catch(() => {});
  await del(); // clean any leftover

  // 1 ── CREATE with the shape the dialog's onSave builds
  const form = {
    sku: SKU, kind: 'cabinet', name: 'v2.5 dialog round-trip test', active: true,
    heightCode: 80, catalogRank: 7118, sectionRank: 3, familyIndex: 42, gridHidden: false,
    parameters: {
      height: [
        { label: 'H73', sku: 'X73', showUnderLine: '0,73,86' },   // as the form holds it (string)
        { label: 'H80', sku: 'X80', showUnderLine: '0,80' },
        { label: 'H86', sku: 'X86', showUnderLine: '' },          // blank ⇒ key must be OMITTED
      ],
      width: [{ label: '45', sku: 'W45', showUnderLine: '0, 73 80' }], // mixed separators
    },
  };
  const payload = prune({ ...form, parameters: sulFromForm(form.parameters) }) || {};
  payload.sku = SKU; payload.active = true;
  for (const k of NULLABLE_SCALARS) { const v = form[k]; payload[k] = v === '' || v == null ? null : Number(v); }
  payload.gridHidden = !!form.gridHidden;

  const c = await fetch(`${BASE}/items`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
  if (!ck('POST accepts the dialog payload', c.status < 300, 'status ' + c.status)) {
    console.log((await c.text()).slice(0, 400)); fails++;
  }

  // 2 ── READ BACK: showUnderLine must be number[], and the blank one absent
  let it = (await (await fetch(`${BASE}/items/${SKU}?expand=all`, { headers: H })).json()).data.item;
  const h = it.parameters?.height || [], w = it.parameters?.width || [];
  fails += !ck('#19 H73 showUnderLine -> [0,73,86]', JSON.stringify(h[0]?.showUnderLine) === '[0,73,86]', JSON.stringify(h[0]?.showUnderLine));
  fails += !ck('#19 H80 showUnderLine -> [0,80]',    JSON.stringify(h[1]?.showUnderLine) === '[0,80]',    JSON.stringify(h[1]?.showUnderLine));
  fails += !ck('#19 H86 blank -> key OMITTED (not [])', !('showUnderLine' in (h[2] || {})), JSON.stringify(h[2]));
  fails += !ck('#19 W45 mixed separators -> [0,73,80]', JSON.stringify(w[0]?.showUnderLine) === '[0,73,80]', JSON.stringify(w[0]?.showUnderLine));
  fails += !ck('#20 scalars stored', it.heightCode === 80 && it.catalogRank === 7118 && it.sectionRank === 3 && it.familyIndex === 42,
    `hc=${it.heightCode} cr=${it.catalogRank} sr=${it.sectionRank} fi=${it.familyIndex}`);

  // 3 ── LOAD into the form, SAVE UNCHANGED: showUnderLine must survive
  const loaded = sulToForm(it.parameters);
  fails += !ck('load turns number[] into the form string', loaded.height[0].showUnderLine === '0,73,86', String(loaded.height[0].showUnderLine));
  const p2 = prune({ sku: SKU, parameters: sulFromForm(loaded) }) || {};
  await fetch(`${BASE}/items/${SKU}`, { method: 'PATCH', headers: H, body: JSON.stringify(p2) });
  it = (await (await fetch(`${BASE}/items/${SKU}?expand=all`, { headers: H })).json()).data.item;
  fails += !ck('#19 no-edit save PRESERVES showUnderLine',
    JSON.stringify(it.parameters.height.map((o) => o.showUnderLine)) === '[[0,73,86],[0,80],null]'.replace('null', 'null'),
    JSON.stringify(it.parameters.height.map((o) => o.showUnderLine)));

  // 4 ── CLEAR catalogRank: must become null, not 0 and not "unchanged"
  const cleared = { ...form, catalogRank: '' };
  const p3 = prune({ sku: SKU }) || {};
  for (const k of NULLABLE_SCALARS) { const v = cleared[k]; p3[k] = v === '' || v == null ? null : Number(v); }
  await fetch(`${BASE}/items/${SKU}`, { method: 'PATCH', headers: H, body: JSON.stringify(p3) });
  it = (await (await fetch(`${BASE}/items/${SKU}?expand=all`, { headers: H })).json()).data.item;
  fails += !ck('#21 cleared catalogRank -> null (not 0, not stale 7118)', it.catalogRank === null, 'got ' + JSON.stringify(it.catalogRank));
  fails += !ck('#21 the other scalars survive the clear', it.heightCode === 80 && it.familyIndex === 42,
    `hc=${it.heightCode} fi=${it.familyIndex}`);

  await del();
  const gone = (await fetch(`${BASE}/items/${SKU}`, { headers: H })).status;
  fails += !ck('cleanup: test item deleted', gone >= 400, 'status ' + gone);

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
