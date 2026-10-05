// a quick scorer for the fastball-foul work: one line of the targets the league gives (42 days of 2025, fastball swings
// with tracking, bat 50+ mph): fouls and whiffs per fastball swing (all swings, as the brief counts them); on contact
// the mean launch minus attack ("vm") deep (< -4 in about his mean), middle (-4..4) and out front (4+); the share of
// contact struck 25+ deg under; bat speed about his mean per inch of depth; the bat's direction sd on contact; foul
// rate by depth (deep / middle / front); and over all kinds: whiffs and fouls per swing, K and BB per plate
// appearance. Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, DEG = Math.PI / 180, R = [], sw = { FB: [0, 0, 0], BR: [0, 0, 0], OS: [0, 0, 0] }, pa = [0, 0, 0];
  var KIND = { FF: 'FB', SI: 'FB', FC: 'FB', SL: 'BR', CU: 'BR', ST: 'BR', CH: 'OS', FS: 'OS' };
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 300); i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      var res = BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng);
      pa[0]++; if (res.result === 'K') pa[1]++; if (res.result === 'BB') pa[2]++;
      res.pitches.forEach(function (q) {
        if (!q.swing) return; var s = q.swing, kd = KIND[q.pitch.type], t = sw[kd]; t[0]++;
        var foul = s.contact && (!q.bb || !q.bb.fair || q.result === 'foul');
        if (!s.contact) t[1]++; else if (foul) t[2]++;
        if (kd !== 'FB' || !s.contact || !q.bb) return; var sb = q.side || s.side, bat = s.batAt || s.batMph; if (bat < 50) return;
        mine.push({ foul: foul, bs: bat, vm: q.bb.la - s.attackAt, dir: s.theta * sb / DEG, dep: s.depth / IN }); }); }
    var md = 0, mb = 0; mine.forEach(function (r) { md += r.dep; mb += r.bs; }); md /= mine.length || 1; mb /= mine.length || 1;
    mine.forEach(function (r) { r.dd = r.dep - md; r.dbs = r.bs - mb; R.push(r); }); }
  function mean(v, k) { return v.reduce(function (a, r) { return a + r[k]; }, 0) / (v.length || 1); }
  function sd(v, k) { var m = mean(v, k); return Math.sqrt(v.reduce(function (a, r) { return a + (r[k] - m) * (r[k] - m); }, 0) / (v.length || 1)); }
  function slope(v, x, y) { var mx = mean(v, x), my = mean(v, y), sxy = 0, sxx = 0; v.forEach(function (r) { sxy += (r[x] - mx) * (r[y] - my); sxx += (r[x] - mx) * (r[x] - mx); }); return sxx ? sxy / sxx : 0; }
  var deep = R.filter(function (r) { return r.dd < -4; }), mid = R.filter(function (r) { return r.dd >= -4 && r.dd < 4; }), front = R.filter(function (r) { return r.dd >= 4; });
  function fr(v) { return (v.filter(function (r) { return r.foul; }).length / (v.length || 1)).toFixed(3); }
  var f = sw.FB;
  print('FB per swing: foul ' + (f[2] / f[0]).toFixed(3) + ' whiff ' + (f[1] / f[0]).toFixed(3) + ' | vm deep/mid/front ' + mean(deep, 'vm').toFixed(1) + ' ' + mean(mid, 'vm').toFixed(1) + ' ' + mean(front, 'vm').toFixed(1) +
        ' | 25+ under ' + (R.filter(function (r) { return r.vm >= 25; }).length / R.length).toFixed(3) + ' | bat/in ' + slope(R, 'dd', 'dbs').toFixed(2) + ' dir sd ' + sd(R, 'dir').toFixed(1) + ' depth sd ' + sd(R, 'dd').toFixed(1) +
        ' | foul deep/mid/front ' + fr(deep) + ' ' + fr(mid) + ' ' + fr(front) + ' | BR whiff/foul ' + (sw.BR[1] / sw.BR[0]).toFixed(3) + ' ' + (sw.BR[2] / sw.BR[0]).toFixed(3) + ' OS ' + (sw.OS[1] / sw.OS[0]).toFixed(3) + ' ' + (sw.OS[2] / sw.OS[0]).toFixed(3) +
        ' | K ' + (pa[1] / pa[0]).toFixed(3) + ' BB ' + (pa[2] / pa[0]).toFixed(3));
  print('   league: foul .453 whiff .174 | vm 22.6 20.5 7.5 | 25+ under .457 | bat/in 0.39 dir sd 13.9 depth sd 7.4 | foul .66 .45 .40 | BR .310 .337 OS .301 .330 | K .222 BB .084');
})(arguments);
