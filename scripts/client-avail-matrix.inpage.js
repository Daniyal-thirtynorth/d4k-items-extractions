/*
 * client-avail-matrix.inpage.js  —  GROUND TRUTH extractor for the availability
 * differential harness (PART A). Paste/run in the live client page
 * (http://localhost:8777/leicht_units__781_.html) with the local sink on :8799.
 *
 * It sets the client toolbar `state` for each matrix combo and calls the client's
 * OWN `available(u)` (= progOk && tierOk && depthOk && handleOk && frontOk &&
 * openOk && antosoOk && doorOk) for every unique unit, emitting a per-unit
 * bitstring over the states. Then `scripts/diff-availability.js` compares it to
 * our `availableFromCaps` over docs/export-v781-fresh.json.
 *
 * Output → POST http://localhost:8799/client_avail_matrix  (see scripts/extract-sink.js / scratchpad sink)
 */
(async () => {
  const SAVE = { tier: state.tier, depth: state.depth, handle: state.handle, front: state.front, open: state.open, antoso: state.antoso, doorline: state.doorline, prog: state.prog };
  const setTB = t => { state.prog = null; state.tier = t.tier ?? null; state.depth = t.depth ?? 58; state.handle = t.handle ?? null; state.front = t.front ?? 0; state.open = t.open ?? ''; state.antoso = t.antoso ?? false; state.doorline = t.doorline ?? ''; };
  const M = [
    { id: 'default' },
    { id: 'tier=P', tier: 'P' }, { id: 'tier=A', tier: 'A' }, { id: 'tier=C', tier: 'C' }, { id: 'tier=P1', tier: 'P1' }, { id: 'tier=C1', tier: 'C1' },
    { id: 'depth=36', depth: 36 }, { id: 'depth=48', depth: 48 }, { id: 'depth=63', depth: 63 }, { id: 'depth=68', depth: 68 },
    { id: 'handle=V', handle: 'V' }, { id: 'front=1', front: 1 },
    { id: 'open=P1', open: 'P1' }, { id: 'open=C1', open: 'C1' }, { id: 'antoso=1', antoso: true },
    { id: 'door=J', doorline: 'J' }, { id: 'door=Y', doorline: 'Y' },
    { id: 'tC+d68', tier: 'C', depth: 68 }, { id: 'tP1+d68', tier: 'P1', depth: 68 }, { id: 'f1+dJ', front: 1, doorline: 'J' }, { id: 'tA+ant', tier: 'A', antoso: true },
  ];
  const byCode = new Map(); let dup = 0;
  for (const f of FAMS) for (const u of (f.units || [])) { if (!byCode.has(u.c)) byCode.set(u.c, u); else dup++; }
  const codes = [...byCode.keys()]; const avail = {}; codes.forEach(c => avail[c] = '');
  for (const st of M) { setTB(st); for (const c of codes) { let a; try { a = available(byCode.get(c)); } catch (e) { a = null; } avail[c] += (a === true ? '1' : a === false ? '0' : '?'); } }
  setTB(SAVE);
  const payload = { version: 'partA', states: M, units: codes.length, dupSkipped: dup, avail };
  return fetch('http://localhost:8799/client_avail_matrix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json());
})();
