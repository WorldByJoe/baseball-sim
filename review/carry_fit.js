/* ============================================================================
   carry_fit.js · v0.1 · 2026-10-13

   The same batted balls flown again under other aerodynamics, to fit the engine's carry to 2026's (season/carry_compare.py
   holds the real table). The model's hitters against its pitchers in MLB's parks and weather give the contacts once (each
   ball's launch point, velocity and spin: battedBall's p0, v0, w0); then each setting re-flies every ball in the air
   (5-50 deg) and prints its median distance and home-run share by exit speed (90-95, 95-100, 100-105, 105+) and launch
   angle (5-degree bins, 10-45). Settings: the batted-ball drag scale (AERO.batCd), the drag-per-spin slope over Nathan's
   (AERO.batCdSpin), and a scale on the spin the collision gives (k: the hypothesis that the collision spins the ball too
   fast).

   Run:  tools/diag/run.sh bb_engine.js review/carry_fit.js -- [PA] [seed] ['[[batCd, slope, k], ...]'] > out.jsonl
   CHANGED
     v0.1  first build (Joe, 2026-10-13: flight first)
============================================================================ */
(function (A) {
  var NPA = +A[0] || 40000, SEED = +A[1] || 1, FT = BB.units.FT, MPH = BB.units.MPH, DEG = Math.PI / 180;
  var rng = BB.makeRng(SEED), H = [], P = [], C = [];
  for (var i = 0; i < 300; i++) H.push(BB.makeBatter(rng, {}));
  for (i = 0; i < 80; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  var ump = BB.makeUmp(rng);
  for (var k = 0; k < NPA; k++) {
    var B = H[k % H.length], Pk = P[(k * 7) % P.length], env = BB.mlbEnv(rng);
    Pk.load = rng.u() * 0.8 * Pk.stamina;
    var bb = BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).bb;
    if (bb && bb.v0 && bb.la >= 5 && bb.la < 50 && bb.ev >= 90) C.push({ p0: bb.p0, v0: bb.v0, w0: bb.w0, env: env, ev: bb.ev, la: bb.la });
  }
  function fly(cd, slope, ks) {
    BB.AERO.batCd = cd; BB.AERO.batCdSpin = slope;
    var cells = {};
    C.forEach(function (c) {
      var w = [c.w0[0] * ks, c.w0[1] * ks, c.w0[2] * ks], fl = BB.flyBatted(c.p0, c.v0, w, c.env, false), L = fl.land || fl;
      var e = c.ev < 95 ? 0 : c.ev < 100 ? 1 : c.ev < 105 ? 2 : 3, a = Math.floor((c.la - 10) / 5);
      if (a < 0 || a > 6) return;
      var key = e + '|' + a; (cells[key] = cells[key] || []).push([Math.sqrt(L.x * L.x + L.y * L.y) / FT, fl.kind === 'over' ? 1 : 0]);
    });
    var out = {};
    Object.keys(cells).forEach(function (key) { var d = cells[key].map(function (x) { return x[0]; }).sort(function (a, b) { return a - b; });
      out[key] = [d[Math.floor(d.length / 2)], cells[key].reduce(function (s, x) { return s + x[1]; }, 0) / d.length, d.length]; });
    print(JSON.stringify({ batCd: cd, slope: slope, k: ks, cells: out }));
  }
  (A[2] ? JSON.parse(A[2]) : [[1.08, 1, 1]].concat(
    [0.9, 0.95, 1.0, 1.08, 1.15].map(function (cd) { return [[cd, 1, 0.85], [cd, 1, 0.7], [cd, 1, 0.55]]; }).reduce(function (a, b) { return a.concat(b); }, []),
    [1.0, 1.08, 1.15, 1.25, 1.35].map(function (cd) { return [[cd, 0.6, 1], [cd, 0.3, 1], [cd, 0, 1]]; }).reduce(function (a, b) { return a.concat(b); }, [])
  )).forEach(function (s) { fly(s[0], s[1], s[2]); });   // A[2]: a JSON list of [batCd, slope, k] settings in place of the default grid
})(typeof arguments !== 'undefined' ? arguments : []);
