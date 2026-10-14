// fl_model.js: where the model's fastball contact lands, by how far under or over the ball it was struck (FL),
// measured as tools/diag/fl_league.py measures the league's: (A) by launch minus attack ("vm") band, share of
// contact, foul rate, and for balls in play the launch angle, exit speed, pop-up share (50+ deg) and spray (pull
// frame) - mean, sd, share beyond 30 deg; for fouls the exit speed, launch angle and distance; (B) foul rate by launch
// angle x exit speed; (C) the model only: where its fouls and its pop-ups in play go - the share leaving within the
// fair wedge (|spray| < 45), sideways (45-90) and back (90+), by vm band; (D) the grazes, as the league's: exit speed
// over release speed at 10-70 deg, and the exit speed of the fouls at .70-.95 of it fitted on the pitch's speed and the
// bat's. Arguments: seed, hitters, the pitch kind (FB default, BR, OS or ALL).
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], C = [], KIND = A[2] || 'FB';
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 600); i++) { var Bt = BB.makeBatter(rng, {});
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, Bt, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        if ((KIND !== 'ALL' && BB.PITCH_TYPES[q.pitch.type].kind !== KIND) || !q.swing || !q.swing.contact || !q.bb) return;
        var s = q.swing, sb = q.side || s.side, bat = s.batAt || s.batMph; if (bat < 50) return;
        C.push({ foul: !q.bb.fair || q.result === 'foul', ev: q.bb.ev, la: q.bb.la, vm: q.bb.la - s.attackAt, spray: q.bb.spray * sb, dist: q.bb.dist, rel: q.pitch.mph, bs: bat }); }); } }
  function mean(v) { return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : NaN; }
  function sd(v) { var m = mean(v); return Math.sqrt(mean(v.map(function (x) { return (x - m) * (x - m); }))); }
  function f3(x) { return isNaN(x) ? '  -  ' : x.toFixed(3); }
  function f1(x, w) { var t = isNaN(x) ? '-' : x.toFixed(1); while (t.length < (w || 5)) t = ' ' + t; return t; }
  function pad(t, w) { t = String(t); while (t.length < w) t = ' ' + t; return t; }
  var n = C.length;
  var ip = C.filter(function (x) { return !x.foul; });
  print('MODEL ' + KIND + ' contact (bat 50+ mph): ' + n + ', foul ' + f3(C.filter(function (x) { return x.foul; }).length / n) + '; pop-ups in play (50+ deg) per contact ' + (ip.filter(function (x) { return x.la >= 50; }).length / n).toFixed(4) + '; in play GB/LD/FB/PU ' +
        [[-99, 10], [10, 25], [25, 50], [50, 99]].map(function (b) { return Math.round(100 * ip.filter(function (x) { return x.la >= b[0] && x.la < b[1]; }).length / ip.length); }).join('/'));
  print('(A) by vm band: share, foul | in play: LA, EV, pop 50+, spray mean / sd / |>30| | fouls: EV, LA, dist');
  var VB = [[-90, -40], [-40, -25], [-25, -15], [-15, -5], [-5, 5], [5, 15], [15, 25], [25, 40], [40, 50], [50, 60], [60, 99]];
  VB.forEach(function (bd) {
    var S = C.filter(function (x) { return x.vm >= bd[0] && x.vm < bd[1]; }), f = S.filter(function (x) { return x.foul; }), b = S.filter(function (x) { return !x.foul; });
    if (!S.length) return; var sp = b.map(function (x) { return x.spray; });
    print('  ' + pad(bd[0], 4) + '..' + (bd[1] + '   ').slice(0, 3) + ' ' + f3(S.length / n) + '  foul ' + f3(f.length / S.length) + ' | LA ' + f1(mean(b.map(function (x) { return x.la; }))) + ' EV ' + f1(mean(b.map(function (x) { return x.ev; }))) +
          ' pop ' + f3(b.filter(function (x) { return x.la >= 50; }).length / Math.max(1, b.length)) + ' spray ' + f1(mean(sp)) + ' / ' + f1(sd(sp), 4) + ' / ' + f3(sp.filter(function (s) { return Math.abs(s) > 30; }).length / Math.max(1, sp.length)) +
          ' | foul EV ' + f1(mean(f.map(function (x) { return x.ev; }))) + ' LA ' + f1(mean(f.map(function (x) { return x.la; }))) + ' dist ' + f1(mean(f.map(function (x) { return x.dist; }))));
  });
  print('(B) foul rate by launch angle (rows) x exit speed (columns); n below');
  var EVB = [[0, 60], [60, 70], [70, 80], [80, 90], [90, 200]], LAB = [[-90, -10], [-10, 10], [10, 25], [25, 40], [40, 50], [50, 60], [60, 70], [70, 91]];
  print('            ' + EVB.map(function (e) { return '  ' + pad(e[0], 3) + '-' + (Math.min(e[1], 999) + '   ').slice(0, 3); }).join(''));
  LAB.forEach(function (l) {
    var row = '', cnt = '';
    EVB.forEach(function (e) { var S = C.filter(function (x) { return x.la >= l[0] && x.la < l[1] && x.ev >= e[0] && x.ev < e[1]; });
      row += S.length >= 20 ? '   ' + f3(S.filter(function (x) { return x.foul; }).length / S.length) + ' ' : '     -   '; cnt += '  ' + pad(S.length, 6) + ' '; });
    print('  LA ' + pad(l[0], 4) + '..' + (l[1] + '   ').slice(0, 3) + row); print('            ' + cnt);
  });
  print('(C) direction of fouls and of pop-ups in play (LA 50+): share |spray| < 45 / 45-90 / 90+, by vm band');
  VB.forEach(function (bd) {
    var S = C.filter(function (x) { return x.vm >= bd[0] && x.vm < bd[1]; }), f = S.filter(function (x) { return x.foul; }), pu = S.filter(function (x) { return !x.foul && x.la >= 50; });
    function dirs(v) { return v.length ? [45, 90, 999].map(function (h, j) { var lo = [0, 45, 90][j]; return f3(v.filter(function (x) { var a = Math.abs(x.spray); return a >= lo && a < h; }).length / v.length); }).join(' / ') : '-'; }
    if (S.length) print('  ' + pad(bd[0], 4) + '..' + (bd[1] + '   ').slice(0, 3) + '  fouls (' + pad(f.length, 5) + ') ' + dirs(f) + '   pop-ups in play (' + pad(pu.length, 4) + ') ' + dirs(pu) + '  pop spray ' + f1(mean(pu.map(function (x) { return x.spray; }))));
  });
  print('(D) exit speed / release speed at 10-70 deg: fouls / in play (share of all contact)');
  [[0, .6], [.6, .7], [.7, .75], [.75, .8], [.8, .85], [.85, .9], [.9, .95], [.95, 1], [1, 1.05], [1.05, 1.1], [1.1, 9]].forEach(function (b) {
    var S = C.filter(function (x) { return x.la >= 10 && x.la < 70 && x.ev / x.rel >= b[0] && x.ev / x.rel < b[1]; });
    print('  ' + b[0].toFixed(2) + '-' + Math.min(b[1], 9).toFixed(2) + '  ' + f3(S.filter(function (x) { return x.foul; }).length / n) + ' / ' + f3(S.filter(function (x) { return !x.foul; }).length / n)); });
  function fit(V) {   // least squares EV = a + b pitch + c bat
    var s = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], t = [0, 0, 0];
    V.forEach(function (x) { var r = [1, x.rel, x.bs]; for (var i = 0; i < 3; i++) { t[i] += r[i] * x.ev; for (var j = 0; j < 3; j++) s[i][j] += r[i] * r[j]; } });
    for (var i = 0; i < 3; i++) { var p = s[i][i]; for (var j = 0; j < 3; j++) s[i][j] /= p; t[i] /= p; for (var k = 0; k < 3; k++) if (k !== i) { var f = s[k][i]; for (j = 0; j < 3; j++) s[k][j] -= f * s[i][j]; t[k] -= f * t[i]; } }
    return t; }
  [['grazes: fouls 10-70 deg at .70-.95', C.filter(function (x) { return x.foul && x.la >= 10 && x.la < 70 && x.ev / x.rel >= .7 && x.ev / x.rel < .95; })], ['balls in play 10-70 deg', C.filter(function (x) { return !x.foul && x.la >= 10 && x.la < 70; })]].forEach(function (p) {
    var b = fit(p[1]); print('  ' + (p[0] + '                                    ').slice(0, 36) + ' share ' + f3(p[1].length / n) + '  EV ' + f1(mean(p[1].map(function (x) { return x.ev; }))) + ' = ' + b[0].toFixed(1) + ' + ' + b[1].toFixed(3) + ' x pitch + ' + b[2].toFixed(3) + ' x bat'); });
})(arguments);
