// one pass: launch-minus-attack by height, whiffs by kind and height, 3+ in misses, contact depth spread within batter by kind
(function (A) {
  var rng = BB.makeRng(+A[0] || 106), env = BB.mlbEnv(rng), ump = BB.makeUmp(rng), P = [], IN = BB.units.IN, BALL_R = BB.geometry.BALL_R;
  var KIND = { FF: 'FB', SI: 'FB', FC: 'FB', SL: 'BR', CU: 'BR', ST: 'BR', CH: 'OS', FS: 'OS' }, HB = [[-9, 0], [0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1], [1, 9]];
  var L = {}, W = {}, K = {}, all = [0, 0], dep = { FB: [], BR: [], OS: [] }, LK = {};
  function gap(s) { var r = BB.batRadius(s.bat, BB.SWEET_IN - s.dLong / IN), half = s.bat.lenIn / 2 - BB.SWEET_IN;
    var a = Math.max(0, s.dLong - BB.SWEET_IN * IN, -half * IN - s.dLong), gp = Math.max(0, Math.abs(s.D) - r); return Math.max(0, Math.sqrt(gp * gp + a * a) - BALL_R) / IN; }
  for (var i = 0; i < 120; i++) P.push(BB.makePitcher(rng, { role: i % 12 < 7 ? 'SP' : 'RP' }));
  for (i = 0; i < (+A[1] || 600); i++) { var B = BB.makeBatter(rng, {}), mine = [];
    for (var k = 0; k < 40; k++) { var Pi = P[(i * 40 + k) % P.length]; Pi.load = rng.u() * Pi.stamina;
      BB.simPA(Pi, B, { env: env, ump: ump, framing: 0, seen: 40 * rng.u() * rng.u(), rec: false }, rng).pitches.forEach(function (q) {
        var s = q.swing; if (!s) return; var h = (q.pitch.plate.z - B.zone.bot) / (B.zone.top - B.zone.bot), b = 0; for (var j = 0; j < 6; j++) if (h >= HB[j][0] && h < HB[j][1]) b = j;
        var kd = KIND[q.pitch.type], w = W[kd + b] = W[kd + b] || [0, 0], kk = K[kd] = K[kd] || [0, 0, 0]; w[0]++; kk[0]++;
        if (!s.contact) { w[1]++; kk[1]++; if (gap(s) >= 3) kk[2]++; }
        else if (q.bb) { var l = L[b] = L[b] || [0, 0], lk = LK[kd + b] = LK[kd + b] || [0, 0]; lk[0]++; lk[1] += q.bb.la - s.attackAt; l[0]++; l[1] += q.bb.la - s.attackAt; all[0]++; all[1] += q.bb.la - s.attackAt; mine.push([kd, s.depth / IN]); }
      }); }
    var m = mine.reduce(function (a, r) { return a + r[1]; }, 0) / (mine.length || 1); mine.forEach(function (r) { dep[r[0]].push(r[1] - m); }); }
  function sd(v) { var m = v.reduce(function (a, b) { return a + b; }, 0) / v.length; return Math.sqrt(v.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / v.length); }
  var s = 'vm by height '; for (var b = 0; b < 6; b++) s += (L[b][1] / L[b][0]).toFixed(1) + ' '; print(s + '| mean ' + (all[1] / all[0]).toFixed(1) + '     (lg -14.8 -3.5 7.0 18.4 25.9 30.4 | 10.3)');
  var u = 'vm FB-BR gap by height '; for (b = 1; b < 5; b++) u += ((LK['FB' + b][1] / LK['FB' + b][0]) - (LK['BR' + b][1] / LK['BR' + b][0])).toFixed(1) + ' '; u += '| FB-OS '; for (b = 1; b < 5; b++) u += ((LK['FB' + b][1] / LK['FB' + b][0]) - (LK['OS' + b][1] / LK['OS' + b][0])).toFixed(1) + ' '; print(u + '   (lg FB-BR 8.7 8.9 7.7 6.7 | FB-OS 11.5 15.4 13.5 14.2)');
  ['FB', 'BR', 'OS'].forEach(function (kd) { var t = 'whiff ' + kd + ' ' + (K[kd][1] / K[kd][0]).toFixed(3) + ' 3+in ' + (K[kd][2] / K[kd][0]).toFixed(3) + ' depth sd ' + sd(dep[kd]).toFixed(1) + ' | by height '; for (var b = 0; b < 6; b++) { var x = W[kd + b] || [1, 0]; t += (x[1] / x[0]).toFixed(3) + ' '; } print(t); });
  print('   league whiff/3+in/depth sd: FB .174 .014 7.4 | .345 .122 .102 .131 .198 .366;  BR .310 .155 8.3 | .602 .271 .147 .129 .181 .317;  OS .301 .135 8.2 | .538 .262 .165 .132 .108 .167');
})(arguments);
