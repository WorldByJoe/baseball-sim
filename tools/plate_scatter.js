/* ============================================================================
   plate_scatter.js · v0.1 · 2026-10-02

   How much of a pitch's scatter at the plate its pitch-to-pitch variation
   makes on its own: speed, spin rate, spin direction and efficiency, seam
   break and release point, each as the engine varies them, with the release
   angle held exact. The engine takes this out of the pitcher's command, so
   that command stays his WHOLE scatter about the target (the measured
   quantity) and only the rest becomes release-angle error. Prints the
   plateW literal per type, [across, up and down] in inches, about each
   pitcher's own mean.

   Run:  jsc bb_engine.js tools/plate_scatter.js -- [pitchers] [pitches each] [seed]

   CHANGED
     v0.1  first build (plateW for the two-axis command, engine v1.4)
============================================================================ */
(function (A) {
  var NP = +A[0] || 300, NT = +A[1] || 40, SEED = +A[2] || 5, IN = BB.units.IN;
  var rng = BB.makeRng(SEED), acc = {};
  for (var i = 0; i < NP; i++) {
    var env = BB.mlbEnv(rng), P = BB.makePitcher(rng, { role: i % 2 ? 'RP' : 'SP' });
    P.cmd = [0, 0]; P.load = 0;
    P.pitches.forEach(function (pt, k) {
      var xs = [], zs = [];
      for (var n = 0; n < NT; n++) {
        var p = BB.throwPitch(P, { pick: k, target: [0, 0.75] }, env, rng);
        xs.push(p.plate.x / IN); zs.push(p.plate.z / IN);
      }
      var a = acc[pt.type] = acc[pt.type] || [0, 0, 0];
      [xs, zs].forEach(function (v, j) {
        var m = v.reduce(function (s, q) { return s + q; }, 0) / v.length;
        a[j] += v.reduce(function (s, q) { return s + (q - m) * (q - m); }, 0);
      });
      a[2] += NT - 1;
    });
  }
  var out = [];
  Object.keys(BB.PITCH_TYPES).forEach(function (t) {
    var a = acc[t]; if (!a) return;
    var w = [Math.sqrt(a[0] / a[2]), Math.sqrt(a[1] / a[2])];
    out.push(t + ' plateW: [' + w[0].toFixed(2) + ', ' + w[1].toFixed(2) + ']   (df ' + a[2] + ')');
  });
  print('plate_scatter v0.1 · ' + NP + ' pitchers x ' + NT + ' per pitch type · seed ' + SEED);
  print(out.join('\n'));
})(typeof arguments !== 'undefined' ? arguments : []);
