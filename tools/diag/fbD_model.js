// the model's fastball contact: by depth band, the barrel's vertical offset D and its parts (the misread -m[1], the
// timing term s(tan descent - tan attackPlan), the height pull, the aim and random scatter), the mean vm, and the
// slope of vm on D within the band; the spray against the bat's direction within depth bands (balls in play);
// and the same by pitch height band. Arguments: seed, hitters.
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, DEG = Math.PI / 180, R = [];
  var VM = BB.VERT_MISS !== undefined ? BB.VERT_MISS : 0.065;
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 500); i++) { var Bt = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if (['FF', 'SI', 'FC'].indexOf(q.pitch.type) < 0 || !q.swing || !q.swing.contact || !q.bb) return; var s = q.swing, sb = q.side || s.side, bat = s.batAt || s.batMph;
        if (bat < 50) return;
        var desc = Math.atan2(-q.pitch.plate.v[2], -q.pitch.plate.v[1]), aPlan = s.attack + (s.attackAt - s.attack) * 0;   // attackPlan is not kept; the timing term is reconstructed from sFwd
        var h = (q.pitch.plate.z - Bt.zone.bot) / (Bt.zone.top - Bt.zone.bot);
        mine.push({ foul: !q.bb.fair || q.result === 'foul', D: s.D / IN, m: -q.read.err[1] / IN, tt: s.sFwd * (Math.tan(desc) - Math.tan(s.attack * DEG)) / IN, hp: VM * (q.pitch.plate.z - (Bt.zone.bot + Bt.zone.top) / 2) / IN,
                    uc: Bt.undercut, vm: q.bb.la - s.attackAt, dir: s.theta * sb / DEG, spray: q.bb.spray * sb, dep: s.depth / IN, h: h, desc: desc / DEG, aa: s.attackAt, e: s.e * 1000, det: q.read.detected, same: q.read.same }); }); }
    var md = 0; mine.forEach(function (r) { md += r.dep; }); md /= mine.length || 1; mine.forEach(function (r) { r.dd = r.dep - md; R.push(r); }); }
  function mean(v, k) { return v.reduce(function (a, r) { return a + r[k]; }, 0) / (v.length || 1); }
  function sd(v, k) { var m = mean(v, k); return Math.sqrt(v.reduce(function (a, r) { return a + (r[k] - m) * (r[k] - m); }, 0) / (v.length || 1)); }
  function slope(v, x, y) { var mx = mean(v, x), my = mean(v, y), sxy = 0, sxx = 0; v.forEach(function (r) { sxy += (r[x] - mx) * (r[y] - my); sxx += (r[x] - mx) * (r[x] - mx); }); return sxx ? sxy / sxx : 0; }
  var n = R.length;
  print('MODEL fastball contact n ' + n + ': D and its parts by depth band (in): share, D, misread, timing term, height pull, aim(undercut), rest; vm; vm per inch of D within the band; descent, timing e; read');
  [[-99, -12], [-12, -8], [-8, -4], [-4, 0], [0, 4], [4, 8], [8, 12], [12, 99]].forEach(function (b) { var S = R.filter(function (r) { return r.dd >= b[0] && r.dd < b[1]; }); if (S.length < 30) return;
    var rest = mean(S, 'D') - mean(S, 'm') - mean(S, 'tt') - mean(S, 'hp') - mean(S, 'uc');
    print('   ' + (b[0] + '..' + b[1] + '        ').slice(0, 10) + (S.length / n).toFixed(3) + '  D ' + mean(S, 'D').toFixed(2) + ' = m ' + mean(S, 'm').toFixed(2) + ' + t ' + mean(S, 'tt').toFixed(2) + ' + h ' + mean(S, 'hp').toFixed(2) + ' + aim ' + mean(S, 'uc').toFixed(2) + ' + rest ' + rest.toFixed(2) + '   sdD ' + sd(S, 'D').toFixed(2) + '   vm ' + mean(S, 'vm').toFixed(1) + '  vm/D ' + slope(S, 'D', 'vm').toFixed(1) + '   desc ' + mean(S, 'desc').toFixed(1) + ' e ' + mean(S, 'e').toFixed(0) + ' ms  detected ' + (S.filter(function (r) { return r.det; }).length / S.length).toFixed(2) + ' same ' + (S.filter(function (r) { return r.same; }).length / S.length).toFixed(2) + '  foul ' + (S.filter(function (r) { return r.foul; }).length / S.length).toFixed(3)); });
  print('  overall: D mean ' + mean(R, 'D').toFixed(2) + ' sd ' + sd(R, 'D').toFixed(2) + '; parts sd: misread ' + sd(R, 'm').toFixed(2) + ' timing ' + sd(R, 'tt').toFixed(2) + ' height ' + sd(R, 'hp').toFixed(2) + '; vm per inch of D ' + slope(R, 'D', 'vm').toFixed(1) + '; D per inch of depth ' + slope(R, 'dd', 'D').toFixed(3));
  print('  by pitch height (share of zone): D, vm, attack, foul');
  [[-9, 0], [0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1], [1, 9]].forEach(function (b) { var S = R.filter(function (r) { return r.h >= b[0] && r.h < b[1]; }); if (S.length < 30) return;
    print('   ' + (b[0] + '..' + b[1] + '        ').slice(0, 10) + (S.length / n).toFixed(3) + '  D ' + mean(S, 'D').toFixed(2) + '  vm ' + mean(S, 'vm').toFixed(1) + '  attack ' + mean(S, 'aa').toFixed(1) + '  foul ' + (S.filter(function (r) { return r.foul; }).length / S.length).toFixed(3) + '  depth ' + mean(S, 'dd').toFixed(1)); });
  var Bp = R.filter(function (r) { return !r.foul; });
  print('  balls in play: spray per degree of bat direction, within depth bands (and the mean spray, direction):');
  [[-99, -8], [-8, -4], [-4, 0], [0, 4], [4, 8], [8, 99]].forEach(function (b) { var S = Bp.filter(function (r) { return r.dd >= b[0] && r.dd < b[1]; });
    print('   ' + (b[0] + '..' + b[1] + '        ').slice(0, 10) + ' slope ' + slope(S, 'dir', 'spray').toFixed(2) + '   spray ' + mean(S, 'spray').toFixed(1) + '  dir ' + mean(S, 'dir').toFixed(1) + '  spray - 1.5 dir ' + (mean(S, 'spray') - 1.5 * mean(S, 'dir')).toFixed(1) + '   n ' + S.length); });
  print('  balls in play, all: spray per degree of direction ' + slope(Bp, 'dir', 'spray').toFixed(2) + '; spray per inch of depth ' + slope(Bp, 'dd', 'spray').toFixed(2) + '; direction per inch ' + slope(Bp, 'dd', 'dir').toFixed(2));
})(arguments);
