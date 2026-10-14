/* graze_check.js · v0.1 · 2026-10-13: the grazes (MU_BAT's own measurement, bb_engine): of fastball contact, the share that is a foul at
   10-70 deg, and those fouls' exit speed over the pitch's release speed (median); the league's: .33 and .817 (42 days of 2025).
   Run: tools/diag/run.sh bb_engine.js review/graze_check.js -- [PA] [seed] ['{tuneContact}'] */
(function (A) {
  var NPA = +A[0] || 30000, SEED = +A[1] || 1; if (A[2]) BB.tuneContact(JSON.parse(A[2]));
  var rng = BB.makeRng(SEED * 31 + 5), H = [], P = [], ump = BB.makeUmp(rng), nc = 0, ng = 0, r = [];
  for (var i = 0; i < 300; i++) H.push(BB.makeBatter(rng, {}));
  for (i = 0; i < 100; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (var k = 0; k < NPA; k++) {
    var B = H[k % H.length], Pk = P[Math.floor(rng.u() * P.length)], env = BB.mlbEnv(rng); Pk.load = rng.u() * 0.8 * Pk.stamina;
    BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
      if (!q.bb || !BB.PITCH_TYPES[q.pitch.type] || BB.PITCH_TYPES[q.pitch.type].kind !== 'FB') return; nc++;
      if (q.result === 'foul' && q.bb.la >= 10 && q.bb.la <= 70) { ng++; r.push(q.bb.ev / q.pitch.mph); } });
  }
  r.sort(function (a, b) { return a - b; });
  print(JSON.stringify({ grazeShare: +(ng / nc).toFixed(3), speedRatioMedian: +r[Math.floor(r.length / 2)].toFixed(3), league: [0.33, 0.817] }));
})(typeof arguments !== 'undefined' ? arguments : []);
