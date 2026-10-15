/* level_means.js · v0.1 · 2026-10-14: the mean traits of the farm's k-th pick (BB.makeBatter level k), for the prior of a
   call-up with no major-league data (history/fit_through.py; the model review). One JSON line: level -> {trait: mean}. */
(function (A) {
  var N = +A[0] || 4000, rng = BB.makeRng(+A[1] || 5), KEYS = ['heightIn', 'weightLb', 'swingLenFt', 'batSpeed', 'attack', 'swingTilt', 'motorIn', 'faceSD', 'undercut', 'timingSD', 'longSD', 'spotIn', 'eyeSD', 'aggr', 'commit', 'fbLean', 'pullBias', 'learn', 'coverage'];
  var LIN = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'], out = {};
  [1, 2, 3, 4].forEach(function (lv) {
    var s = {}; KEYS.forEach(function (k) { s[k] = 0; });
    for (var i = 0; i < N; i++) { var B = BB.makeBatter(rng, { pos: LIN[i % 9], level: lv }); KEYS.forEach(function (k) { s[k] += +B[k] / N; }); }
    out[lv] = {}; KEYS.forEach(function (k) { out[lv][k] = +s[k].toFixed(4); });
  });
  print(JSON.stringify(out));
})(typeof arguments !== 'undefined' ? arguments : []);
