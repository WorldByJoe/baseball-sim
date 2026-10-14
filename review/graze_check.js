/* graze_check.js · v0.2 · 2026-10-14 (v0.2: the grazes' and the fair 10-40 deg balls' normal speed (m/s), friction and share that slid): the grazes (MU_BAT's own measurement, bb_engine): of fastball contact, the share that is a foul at
   10-70 deg, and those fouls' exit speed over the pitch's release speed (median); the league's: .33 and .817 (42 days of 2025).
   Run: tools/diag/run.sh bb_engine.js review/graze_check.js -- [PA] [seed] ['{tuneContact}'] */
(function (A) {
  var NPA = +A[0] || 30000, SEED = +A[1] || 1; if (A[2]) BB.tuneContact(JSON.parse(A[2]));
  var rng = BB.makeRng(SEED * 31 + 5), H = [], P = [], ump = BB.makeUmp(rng), nc = 0, ng = 0, r = [], gv = [], gm = [], gs = 0, sv = [], sm = [], ss = 0, RG = [], RS = [];
  for (var i = 0; i < 300; i++) H.push(BB.makeBatter(rng, {}));
  for (i = 0; i < 100; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (var k = 0; k < NPA; k++) {
    var B = H[k % H.length], Pk = P[Math.floor(rng.u() * P.length)], env = BB.mlbEnv(rng); Pk.load = rng.u() * 0.8 * Pk.stamina;
    BB.simPA(Pk, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
      if (!q.bb || !BB.PITCH_TYPES[q.pitch.type] || BB.PITCH_TYPES[q.pitch.type].kind !== 'FB') return; nc++;
      if (q.result === 'foul' && q.bb.la >= 10 && q.bb.la <= 70) { ng++; r.push(q.bb.ev / q.pitch.mph); gv.push(q.bb.vn); gm.push(q.bb.mu); if (q.bb.slid) gs++; RG.push([q.bb.ev, q.pitch.mph, q.swing.batAt]); }
      else if (q.result !== 'foul' && q.bb.la >= 10 && q.bb.la < 40) { sv.push(q.bb.vn); sm.push(q.bb.mu); if (q.bb.slid) ss++; RS.push([q.bb.ev, q.pitch.mph, q.swing.batAt]); } });
  }
  function ols(R) {   // EV on pitch speed and bat speed: the two slopes
    var n = R.length, m = [0, 0, 0]; R.forEach(function (x) { m[0] += x[0] / n; m[1] += x[1] / n; m[2] += x[2] / n; });
    var a = 0, b = 0, c = 0, d = 0, e = 0; R.forEach(function (x) { var y = x[0] - m[0], p = x[1] - m[1], q2 = x[2] - m[2]; a += p * p; b += p * q2; c += q2 * q2; d += p * y; e += q2 * y; });
    var det = a * c - b * b; return [+((c * d - b * e) / det).toFixed(3), +((a * e - b * d) / det).toFixed(3)];
  }
  var med = function (a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; };
  print(JSON.stringify({ grazeShare: +(ng / nc).toFixed(3), speedRatioMedian: +med(r).toFixed(3), ratioP10P90: (function () { var a = r.slice().sort(function (x, y) { return x - y; }); return [+a[Math.floor(a.length * 0.1)].toFixed(3), +a[Math.floor(a.length * 0.9)].toFixed(3)]; })(), league2026: { share: 0.386, ratio: 0.813, p10p90: [0.722, 0.944], slopesFoul: [0.277, 0.281], slopesFair: [0.053, 0.964] },
    grazes: { evSlopesPitchBat: ols(RG), vnMedian: +med(gv).toFixed(1), muMedian: +med(gm).toFixed(3), slidShare: +(gs / ng).toFixed(3) },
    fair10to40: { evSlopesPitchBat: ols(RS), vnMedian: +med(sv).toFixed(1), muMedian: +med(sm).toFixed(3), slidShare: +(ss / sv.length).toFixed(3) } }));
})(typeof arguments !== 'undefined' ? arguments : []);
