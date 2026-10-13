/* look_probe.js · v0.1 · 2026-10-13: each ball in play with its launch angle, exit speed, whether the last look corrected the swing, the vertical offset D (in) and the attack angle at contact; for step 2 of the run audit (contact) */
(function () {
  var rng = BB.makeRng(9), H = [], P = [], ump = BB.makeUmp(rng), rows = [];
  for (var i = 0; i < 300; i++) H.push(BB.makeBatter(rng, {}));
  for (i = 0; i < 100; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (var k = 0; k < 60000; k++) {
    var B = H[k % H.length], Pk = P[Math.floor(rng.u() * P.length)], env = BB.mlbEnv(rng); Pk.load = rng.u() * 0.8 * Pk.stamina;
    var r = BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: true }, rng);
    if (!r.bb) continue;
    var last = r.pitches[r.pitches.length - 1], sw = last.swing || {};
    var s = sw.D / (0.121 / 3.28084 * 12 / 12 + 0);   // placeholder
    var att = sw.attackAt !== undefined ? sw.attackAt : (sw.attack || 0);
    rows.push([+r.bb.la.toFixed(1), +r.bb.ev.toFixed(1), sw.look ? 1 : 0, +(sw.D / BB.units.IN).toFixed(2), +att.toFixed(1)]);
  }
  rows.forEach(function (x) { print(JSON.stringify(x)); });
})();
