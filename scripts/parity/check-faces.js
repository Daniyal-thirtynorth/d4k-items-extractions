/*
 * FACE checker — replays every FACE diff from a sweep report straight against the API, so the
 * `_selUnit` port can be measured without a browser or a 40-minute sweep.
 *
 * Each FACE entry is `{key, fid, client, ours}`: for the toolbar state `key`, the app faces the
 * family with `client` and we faced it with `ours`. This script re-asks the API for that state and
 * reports whether the face is the app's now.
 *
 *   node scripts/parity/check-faces.js report-Base11 plan-Base            # one report
 *   node scripts/parity/check-faces.js report-Base11 plan-Base --verbose  # list every case
 *
 * Requires the backend on :8000 (it mints its own dev token).
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const API = 'http://localhost:8000/design-book';
const [reportArg, planArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const VERBOSE = process.argv.includes('--verbose');
if (!reportArg || !planArg) {
  console.error('usage: node scripts/parity/check-faces.js <report-name> <plan-name> [--verbose]');
  process.exit(1);
}
const rd = (dir, name) => JSON.parse(fs.readFileSync(path.join(HERE, dir, name.replace(/\.json$/, '') + '.json'), 'utf8'));
const report = rd('out', reportArg);
const plan = rd('', planArg);
const filtersByKey = new Map(plan.map((p) => [p.key, p.filters]));

async function token() {
  const r = await fetch(`${API}/dev-token`);
  return (await r.json()).token;
}

// The lite UI's own grid call, minus the display-only extras: same params the sweep sent.
async function faceOf(tok, filters, fid) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== '') p.set(k, String(v));
  p.set('groupBy', 'family');
  p.set('limit', '300');
  p.set('grey', 'true');
  const r = await fetch(`${API}/items?${p}`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) return { err: `${r.status}` };
  const body = await r.json();
  const rows = Array.isArray(body) ? body : (body.data?.items ?? body.items ?? body.data ?? []);
  const hit = (Array.isArray(rows) ? rows : []).find((i) => i.familyId === fid);
  return { face: hit ? hit.sku : null, absent: !hit };
}

(async () => {
  const tok = await token();
  const cases = report.out.FACE ?? [];
  let pass = 0, fail = 0, gone = 0, err = 0;
  const failures = [];
  for (const c of cases) {
    const filters = filtersByKey.get(c.key);
    if (!filters) { err++; continue; }
    const got = await faceOf(tok, filters, c.fid);
    if (got.err) { err++; continue; }
    if (got.absent) { gone++; failures.push({ ...c, got: 'CARD ABSENT' }); continue; }
    if (got.face === c.client) { pass++; if (VERBOSE) console.log(`  ok   ${c.key} ${c.fid} -> ${got.face}`); }
    else { fail++; failures.push({ ...c, got: got.face }); }
  }
  console.log(`\n${reportArg}: ${cases.length} FACE cases`);
  console.log(`  match app : ${pass}`);
  console.log(`  still off : ${fail}`);
  console.log(`  card gone : ${gone}   (a face fix must not drop the card)`);
  if (err) console.log(`  errors    : ${err}`);
  if (failures.length) {
    console.log('\nremaining:');
    for (const f of failures.slice(0, VERBOSE ? 999 : 25)) {
      console.log(`  ${f.key}  ${f.fid}  app=${f.client}  ours=${f.got}`);
    }
    if (!VERBOSE && failures.length > 25) console.log(`  … ${failures.length - 25} more (--verbose)`);
  }
  process.exitCode = fail + gone ? 1 : 0;
})();
