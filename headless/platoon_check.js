/* ============================================================================
   platoon_check.js · v0.1 · 2026-10-05

   The model's platoon split taken apart the way statcast/platoon.py takes
   the league's apart: same side against opposite, right- and left-handed
   batters separately, by component (the outcome line, the plate discipline),
   by pitch type and by location, with the pitch mix and the aim; and the
   model's reads by platoon (what no league table can show). The design is
   mirror_check's: the same men drawn with both hands, each mirror pair on
   the same dice, so every split here is within batter AND within pitcher by
   construction (a right-handed batter's same-side line is the very same man
   against the very same pitchers drawn right-handed). The league's numbers
   (statcast/platoon_2025.js) print beside the model's: the raw split, the
   split within batter, within pitcher, and the two-way estimate (which the
   league identifies only as the two hands' average).

   Each pitch is valued in runs with the league's run values by count
   (statcast/discipline_2025.js: a ball, a called strike, a foul, a whiff) and
   its ball-in-play value by exit speed and launch angle with the count's
   average added back; xwOBA on contact is the league's grid by exit speed
   and launch angle (statcast/bip_2025.js). Locations are in the batter's
   frame: `away` in feet, + away from him; `h` the share of his own zone.
   Movement is the deviation from the straight line out of the hand, scaled
   to the last 40 ft as Statcast's pfx is (approximate).

   Run:  tools/diag/run.sh bb_engine.js bb_field.js statcast/discipline_2025.js statcast/bip_2025.js statcast/platoon_2025.js headless/platoon_check.js -- [batters] [PA each] [seed]

   CHANGED
     v0.1  first build (the platoon brief, docs/briefs/2026-10-05_platoon.md)
============================================================================ */
(function (A) {
  var NB = +A[0] || 300, NPA = +A[1] || 40, SEED = +A[2] || 3, NP = 60, IN = BB.units.IN, FT = BB.units.FT, Y_PLATE = BB.geometry.Y_PLATE, G = 9.80665;
  var HBP_RV = 0.366;   // runs: the league's mean delta_run_exp on a hit-by-pitch (2025, 42 days)
  var L = typeof PLATOON !== 'undefined' ? PLATOON : null, DISC = typeof DISCIPLINE !== 'undefined' ? DISCIPLINE : null, BIPL = typeof BIP !== 'undefined' ? BIP : null;
  var env = BB.makeEnv({}), ump = BB.makeUmp(BB.makeRng(99)), W = { BB: 0.69, HBP: 0.72, '1B': 0.89, '2B': 1.27, '3B': 1.62, HR: 2.10 };
  var rngD = BB.makeRng(5), POSN = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  var fielders = POSN.map(function (pos) { return BB.makeBatter(rngD, { pos: pos }); }), Pf = BB.makePitcher(rngD, { role: 'SP' }); Pf.pos = 'P';
  var D = BBField.makeDefense(fielders.concat([Pf]));
  function batter(i, hand) { return BB.makeBatter(BB.makeRng(100000 + SEED * 1000 + i), { bats: hand, pos: 'LF' }); }
  function pitcher(j, hand) { return BB.makePitcher(BB.makeRng(200000 + SEED * 1000 + j), { throws: hand, role: j % 3 ? 'SP' : 'RP' }); }
  var BAT = { R: [], L: [] }, PIT = { R: [], L: [] };
  for (var i = 0; i < NB; i++) { BAT.R.push(batter(i, 'R')); BAT.L.push(batter(i, 'L')); }
  for (var j = 0; j < NP; j++) { PIT.R.push(pitcher(j, 'R')); PIT.L.push(pitcher(j, 'L')); }
  var TYPES = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS'], KINDS = ['FB', 'BR', 'OS'];
  var AWAY_EDGES = [-9, -0.95, -0.28, 0.28, 0.95, 9], AWAY_NAMES = ['in, off', 'in', 'middle', 'away', 'away, off'];
  var H_EDGES = [-9, -0.12, 0.33, 0.67, 1.12, 9], H_NAMES = ['below', 'low', 'mid', 'high', 'above'];
  var PSI_EDGES = [-9, -4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 9], PK;
  function band(v, e) { for (var i = 0; i < e.length - 1; i++) if (v >= e[i] && v < e[i + 1]) return i; return e.length - 2; }
  function bandOf(v, e) { for (var i = 0; i < e.length - 1; i++) if (v >= e[i] && v < e[i + 1]) return i; return v < e[0] ? 0 : e.length - 2; }
  // the league's run value of a pitch by its result and count, and of a ball in play by exit speed and launch angle
  function rvOf(count, res, bb) {
    if (!DISC) return null;
    var c = DISC.by_count[count];
    if (res === 'ball') return c.rv_ball;
    if (res === 'hbp') return HBP_RV;
    if (res === 'called_strike') return c.rv_called_strike;
    if (res === 'foul') return c.rv_foul;
    if (res === 'swinging_strike') return c.rv_whiff;
    var V = DISC.bip_value, g = V.grid[bandOf(bb.la, V.la_edges)][bandOf(bb.ev, V.ev_edges)];   // the grid is [launch angle][exit speed]
    return (g && g[1] ? g[0] : V.mean) + V.count_mean[count] - V.mean;   // the grid holds each ball's value with the count's mean swapped for the overall mean
  }
  function xwOf(bb) {
    if (!BIPL) return null;
    var X = BIPL.xwoba, v = X.grid[bandOf(bb.ev, X.ev_edges)][bandOf(bb.la, X.la_edges)];
    return v === null || v === undefined ? X.mean : v;
  }
  // accumulators: {n, s, ss} per cell key
  var ACC = {};
  function add(key, v) { if (v === null || v === undefined || v !== v) return; var a = ACC[key] = ACC[key] || { n: 0, s: 0, ss: 0 }; a.n++; a.s += v; a.ss += v * v; }
  function get(key) { var a = ACC[key]; return a && a.n ? { n: a.n, m: a.s / a.n, v: Math.max(0, a.ss / a.n - (a.s / a.n) * (a.s / a.n)) } : null; }
  var COMBOS = ['RvR', 'RvL', 'LvR', 'LvL'], NPITCH = {};
  COMBOS.forEach(function (c) {
    var bh = c[0], ph = c[2], sameS = bh === ph ? 'same' : 'opp', K = bh + ':' + sameS + ':';
    NPITCH[K] = 0;
    for (var i = 0; i < NB; i++) {
      var B = BAT[bh][i], sb = BB.batterSide(B, null);
      for (var k = 0; k < NPA; k++) {
        var P = PIT[ph][(i * 7 + k) % NP], rng = BB.makeRng(300000 + SEED * 100000 + i * 100 + k);
        P.load = 0;
        var res = BB.simPA(P, B, { env: env, ump: ump, framing: 0, seen: 10, rec: false }, rng);
        if (res.result === 'END') continue;
        // the pitches
        res.pitches.forEach(function (q) {
          var p = q.pitch, x = p.plate.x, z = p.plate.z, inz = BB.inZone(B, x, z) ? 1 : 0, away = -sb * x / FT, h = (z - B.zone.bot) / (B.zone.top - B.zone.bot);
          var t = p.type, kd = BB.PITCH_TYPES[t].kind, keys = ['all', 't:' + t, 'k:' + kd, 'a:' + AWAY_NAMES[band(away, AWAY_EDGES)], 'h:' + H_NAMES[band(h, H_EDGES)]];
          var sw = q.result === 'hbp' ? null : (q.swing ? 1 : 0), whiff = q.swing ? (q.swing.contact ? 0 : 1) : null, contact = q.swing ? (q.swing.contact ? 1 : 0) : null;
          var called = q.call ? (q.call.strike ? 1 : 0) : null, rv = rvOf(q.count, q.result, q.bb), xw = q.bb && q.bb.fair ? xwOf(q.bb) : null;
          NPITCH[K]++;
          add(K + 'all:res_' + (q.result === 'hr' || q.result === 'in_play' ? 'in_play' : q.result), 1);
          // the movement: deviation from the straight line out of the hand, scaled to the last 40 ft
          var dist = p.rel[1] - Y_PLATE, sx = p.rel[0] + p.v0[0] * dist / (-p.v0[1]), sz = p.rel[2] + p.v0[2] * dist / (-p.v0[1]) - 0.5 * G * p.plate.t * p.plate.t;
          var sc = Math.pow(40 * FT / dist, 2), mvAway = -sb * (x - sx) * sc / IN, mvUp = (z - sz) * sc / IN;
          var psi = q.read.psi !== undefined ? q.read.psi : null, pb = psi === null ? null : band(psi, PSI_EDGES);
          if (pb !== null) { add(K + 'all:psi', psi); PK = ['psi:' + pb + ':' + t + ':']; } else PK = [];
          keys.forEach(function (kk) {
            var key = K + kk + ':';
            add(key + 'n', 1); add(key + 'inz', inz); add(key + 'swing', sw); add(key + 'whiff', whiff); add(key + 'rv', rv === null ? null : 100 * rv); add(key + 'xw', xw);
            if (q.bb && q.bb.fair) { add(key + 'ev', q.bb.ev); add(key + 'la', q.bb.la); add(key + 'hr_bip', q.bb.hr ? 1 : 0); }
            if (sw !== null) { if (inz) add(key + 'zswing', sw); else add(key + 'chase', sw); }
            if (q.swing && inz) add(key + 'zcontact', contact);
            if (called !== null) { add(key + 'called', called); add(key + (inz ? 'called_iz' : 'called_oz'), called); }
            add(key + 'away', away * 12); add(key + 'h', h); add(key + 'mv_away', mvAway); add(key + 'mv_up', mvUp);
            // the reads
            var rf = q.read;
            add(key + 'detected', rf.detectedD ? 1 : 0); add(key + 'late', rf.late ? 1 : 0); add(key + 'fooled', !rf.detected && !rf.late ? 1 : 0);
            add(key + 'pfooled', rf.pFooled); add(key + 'sep', rf.sep / IN);
            add(key + 'err_x', Math.abs(rf.err[0]) / IN); add(key + 'err_z', Math.abs(rf.err[1]) / IN); add(key + 'err_t', Math.abs(rf.err[2]) * 1000);
            if (q.decide) add(key + 'pin', q.decide.pin);
          });
          PK.forEach(function (key) {   // by release angle and type, both hands pooled (for the band table)
            add(key + 'n', 1); add(key + 'swing', sw); add(key + 'whiff', whiff); add(key + 'rv', rv === null ? null : 100 * rv); add(key + 'xw', xw);
            if (q.bb && q.bb.fair) add(key + 'ev', q.bb.ev);
            if (sw !== null) { if (inz) add(key + 'zswing', sw); else add(key + 'chase', sw); }
            if (q.swing && inz) add(key + 'zcontact', contact);
          });
        });
        // the plate appearance
        var key = K + 'pa:';
        add(key + 'n', 1);
        var kk = res.result === 'K' ? 1 : 0, bb = res.result === 'BB' ? 1 : 0, hbp = res.result === 'HBP' ? 1 : 0, woba = 0, hr = 0, bip = 0, hit = null;
        if (bb) woba = W.BB; else if (hbp) woba = W.HBP;
        else if (res.result !== 'K') {
          var b = res.bb;
          if (b.hr) { hr = 1; woba = W.HR; }
          else {
            bip = 1;
            BBField.positionDefense(D, B, sb);
            var o = BBField.resolve(b, B, [null, null, null, null], 0, D, env, BB.makeRng(400000 + i * 100 + k), { side: sb, going: 0, foulCaught: !!res.foulCaught });
            if (o.hit === 'HR') { hr = 1; bip = 0; woba = W.HR; }
            else if (o.hit === '1B' || o.hit === '2B' || o.hit === '3B') { hit = 1; woba = W[o.hit]; }
            else hit = 0;   // 'OUT', 'SF', 'E', 'FC' or '': an out, or on base without a hit
          }
        }
        add(key + 'woba', woba); add(key + 'k', kk); add(key + 'bb', bb); add(key + 'hbp', hbp); add(key + 'hr', hr); add(key + 'bip', bip); add(key + 'hit', hit);
      }
    }
  });
  // ---- printing
  function f(v, d, sign) { if (v === null || v === undefined || v !== v) return '-'; var s = v.toFixed(d === undefined ? 3 : d); return sign && v >= 0 ? '+' + s : s; }
  function pad(s, w) { s = String(s); while (s.length < w) s = ' ' + s; return s; }
  function cell(hand, sub, stat) { return get(hand + ':same:' + sub + ':' + stat) ? { s: get(hand + ':same:' + sub + ':' + stat), o: get(hand + ':opp:' + sub + ':' + stat) } : null; }
  function diffOf(c) { if (!c || !c.s || !c.o) return null; return { d: c.s.m - c.o.m, se: Math.sqrt(c.s.v / c.s.n + c.o.v / c.o.n), n: c.s.n + c.o.n }; }
  function lg(hand, path) {   // the league's split object at a path like ['outcome', 'woba']
    if (!L || !L[hand]) return null; var o = L[hand]; for (var i = 0; i < path.length; i++) { if (!o) return null; o = o[path[i]]; } return o || null;
  }
  function lgRow(o, d) { return o ? pad(f(o.same, d), 8) + pad(f(o.opp, d), 8) + pad(f(o.raw, d, true), 8) + pad(f(o.bat, d, true), 8) + pad(f(o.pit, d, true), 8) + pad(f(o.both, d, true), 8) + ' (' + f(o.both_se, d) + ')' : pad('-', 50); }
  function line(lab, hand, sub, stat, d, path) {
    var c = cell(hand, sub, stat), df = diffOf(c), o = path ? lg(hand, path) : null;
    return pad(lab, 30) + (c && c.s ? pad(c.s.n + c.o.n, 8) + pad(f(c.s.m, d), 8) + pad(f(c.o.m, d), 8) + pad(f(df.d, d, true), 8) + ' (' + f(df.se, d) + ')' : pad('-', 40)) + '   |' + lgRow(o, d);
  }
  var HEAD = pad('', 30) + pad('n', 8) + pad('same', 8) + pad('opp', 8) + pad('diff', 8) + pad('(se)', 8) + '   |' + pad('same', 8) + pad('opp', 8) + pad('raw', 8) + pad('w/bat', 8) + pad('w/pit', 8) + pad('2-way', 8) + ' (se)';
  print('platoon_check v0.1 · ' + NB + ' batters x ' + NPA + ' PA x 4 hand combinations · ' + NP + ' pitchers · seed ' + SEED + ' · the same men with both hands; every model split is within batter and within pitcher');
  print('model: same side, opposite side, same minus opposite (se)   |   league 2025 (statcast/platoon.py): raw, within batter, within pitcher, two-way (the two hands\' average)');
  // 7. the model by the release angle (both hands pooled; each band's mean standardised to the overall pitch-type mix,
  //    so the bands' different repertoires do not stand in for the read), against the -4.5..-3.5 band, beside the league's
  //    type-controlled two-way estimates
  (function () {
    var ref = 1, wT = {}, nAll = 0;
    TYPES.forEach(function (t) { var n = 0; for (var b = 0; b < PSI_EDGES.length - 1; b++) { var a = get('psi:' + b + ':' + t + ':n'); if (a) n += a.n; } wT[t] = n; nAll += n; });
    function stdMean(b, stat) {   // the band's mean, standardised to the overall type mix over the types it has 30+ of
      var s = 0, w = 0; TYPES.forEach(function (t) { var a = get('psi:' + b + ':' + t + ':' + stat), n = get('psi:' + b + ':' + t + ':n'); if (a && n && n.n >= 30) { s += wT[t] * a.m; w += wT[t]; } }); return w ? s / w : null;
    }
    var mS = get('R:same:all:psi'), mO = get('R:opp:all:psi'), lp = L ? L.psi : null;
    print('\n7. THE MODEL BY THE RELEASE ANGLE (deg, + toward the batter\'s side; both hands; type-standardised; against the -4.5..-3.5 band)   | league, type-controlled two-way');
    print('   same-side releases ' + f(mS ? mS.m : null, 2, true) + ' deg (sd ' + f(mS ? Math.sqrt(mS.v) : null, 2) + '), opposite ' + f(mO ? mO.m : null, 2, true) + ' (sd ' + f(mO ? Math.sqrt(mO.v) : null, 2) + ')' + (lp ? '   | league ' + f(lp.mean_same, 2, true) + ' (' + f(lp.sd_same, 2) + '), ' + f(lp.mean_opp, 2, true) + ' (' + f(lp.sd_opp, 2) + ')' : ''));
    var hdr = pad('', 18); for (var b = 0; b < PSI_EDGES.length - 1; b++) hdr += pad(PSI_EDGES[b] + '..' + PSI_EDGES[b + 1], 11); print(hdr + '   | ' + hdr.slice(18));
    hdr = pad('pitches', 18); for (b = 0; b < PSI_EDGES.length - 1; b++) { var n = 0; TYPES.forEach(function (t) { var a = get('psi:' + b + ':' + t + ':n'); if (a) n += a.n; }); hdr += pad(n, 11); } print(hdr);
    [['whiff', 3], ['chase', 3], ['zswing', 3], ['zcontact', 3], ['xw', 3], ['ev', 1], ['rv', 2]].forEach(function (st) {
      var out = pad(st[0], 18), r0 = stdMean(ref, st[0]), lg = '';
      for (var b = 0; b < PSI_EDGES.length - 1; b++) { var m = stdMean(b, st[0]); out += pad(m === null || r0 === null ? '-' : (b === ref ? '0' : f(m - r0, st[1], true)), 11); }
      if (lp && lp.bands_type && lp.bands_type[st[0]]) { for (b = 0; b < PSI_EDGES.length - 1; b++) { var c = lp.bands_type[st[0]][String(b)]; lg += pad(b === ref ? '0' : (c ? f(c[0], st[1], true) : '-'), 11); } }
      print(out + '   | ' + lg);
    });
  })();
  ['R', 'L'].forEach(function (hand) {
    var nS = NPITCH[hand + ':same:'], nO = NPITCH[hand + ':opp:'];
    print('\n==== ' + (hand === 'R' ? 'RIGHT' : 'LEFT') + '-HANDED BATTERS: ' + NPITCH[hand + ':same:'] + ' pitches same side, ' + NPITCH[hand + ':opp:'] + ' opposite' + (L ? ' (league: ' + L[hand].pitches + ' pitches, ' + L[hand].pa + ' PA)' : ''));
    print('\n1. THE OUTCOME LINE\n' + HEAD);
    [['wOBA', 'woba', 3, ['outcome', 'woba']], ['K per PA', 'k', 3, ['outcome', 'k']], ['BB per PA', 'bb', 3, ['outcome', 'bb']], ['HBP per PA', 'hbp', 3, ['outcome', 'hbp']], ['HR per PA', 'hr', 3, ['outcome', 'hr']],
     ['in play per PA', 'bip', 3, ['outcome', 'bip']], ['BABIP', 'hit', 3, ['outcome', 'hit']]].forEach(function (r) { print(line(r[0], hand, 'pa', r[1], r[2], r[3])); });
    [['xwOBA on contact', 'xw', 3, ['outcome', 'xw_bip']], ['exit speed (mph)', 'ev', 1, ['outcome', 'ev_bip']], ['launch angle (deg)', 'la', 1, ['outcome', 'la_bip']], ['HR per ball in play', 'hr_bip', 3, ['outcome', 'hr_bip']]].forEach(function (r) { print(line(r[0], hand, 'all', r[1], r[2], r[3])); });
    print('\n2. PLATE DISCIPLINE\n' + HEAD);
    [['in zone (per pitch)', 'inz', 3], ['swing (per pitch)', 'swing', 3], ['zone swing', 'zswing', 3], ['chase', 'chase', 3], ['zone contact', 'zcontact', 3], ['whiff (per swing)', 'whiff', 3],
     ['called strike (per take)', 'called', 3], ['called strike, out of zone', 'called_oz', 3], ['called strike, in zone', 'called_iz', 3], ['run value per 100 pitches', 'rv', 2]].forEach(function (r) { print(line(r[0], hand, 'all', r[1], r[2], ['discipline', r[1]])); });
    var RES = ['ball', 'called_strike', 'foul', 'swinging_strike', 'in_play', 'hbp'], rs = pad('results, share of pitches', 30);
    RES.forEach(function (r) { var a = get(hand + ':same:all:res_' + r), b = get(hand + ':opp:all:res_' + r); rs += '  ' + r + ' ' + f(a ? a.n / nS : 0) + '/' + f(b ? b.n / nO : 0); });
    print(rs);
    print('\n3a. THE PITCH MIX (share of pitches)' + pad('model same', 16) + pad('opp', 8) + pad('diff', 8) + '   |' + pad('league same', 14) + pad('opp', 8) + pad('diff', 8));
    var mix = {};
    TYPES.concat(KINDS).forEach(function (t) {
      var a = get(hand + ':same:' + (t.length === 2 && KINDS.indexOf(t) >= 0 ? 'k:' : 't:') + t + ':n'), b = get(hand + ':opp:' + (KINDS.indexOf(t) >= 0 ? 'k:' : 't:') + t + ':n');
      mix[t] = [a ? a.n / nS : 0, b ? b.n / nO : 0];
      var l = L ? L[hand].mix[t] : null;
      print(pad(t, 30) + pad(f(mix[t][0]), 16) + pad(f(mix[t][1]), 8) + pad(f(mix[t][0] - mix[t][1], 3, true), 8) + '   |' + (l ? pad(f(l[0]), 14) + pad(f(l[1]), 8) + pad(f(l[0] - l[1], 3, true), 8) : ''));
    });
    [['run value per 100 pitches', 'rv', 2], ['swing', 'swing', 3], ['chase', 'chase', 3], ['whiff per swing', 'whiff', 3], ['zone contact', 'zcontact', 3], ['called strike, out of zone', 'called_oz', 3], ['xwOBA on contact', 'xw', 3], ['exit speed', 'ev', 1]].forEach(function (r) {
      print('\n3b. BY PITCH TYPE: ' + r[0] + '\n' + HEAD);
      TYPES.concat(KINDS).forEach(function (t) { print(line(t, hand, (KINDS.indexOf(t) >= 0 ? 'k:' : 't:') + t, r[1], r[2], ['by_type', t, r[1]])); });
    });
    // the decomposition of the run-value split
    var mixT = 0, withinT = 0;
    TYPES.forEach(function (t) { var c = cell(hand, 't:' + t, 'rv'); if (!c || !c.s || !c.o) return; mixT += (mix[t][0] - mix[t][1]) * (c.s.m + c.o.m) / 2; withinT += (mix[t][0] + mix[t][1]) / 2 * (c.s.m - c.o.m); });
    var tot = diffOf(cell(hand, 'all', 'rv')), ld = L ? L[hand].decomp : null;
    print('\n3c. WHERE THE RUN-VALUE SPLIT COMES FROM (runs per 100 pitches): total ' + f(tot ? tot.d : null, 2, true) + ' = the mix ' + f(mixT, 2, true) + ' + the within-type value ' + f(withinT, 2, true) +
          (ld ? '   | league raw: total ' + f(ld.total, 2, true) + ' = mix ' + f(ld.mix, 2, true) + ' + within-type ' + f(ld.within, 2, true) + ' (within-type, two-way: ' + f(ld.within_both, 2, true) + ')' : ''));
    [['across (away +)', 'a:', AWAY_NAMES, 'away'], ['height (share of his zone)', 'h:', H_NAMES, 'h']].forEach(function (g) {
      print('\n4. BY LOCATION, ' + g[0] + ': model same / opp (league same / opp)' + pad('share', 20) + pad('swing', 22) + pad('whiff', 22) + pad('xwOBA', 22) + pad('run value', 24));
      g[2].forEach(function (nm) {
        var a = get(hand + ':same:' + g[1] + nm + ':n'), b = get(hand + ':opp:' + g[1] + nm + ':n'), l = L ? L[hand].loc[g[3] + ':' + nm] : null;
        var out = pad(nm, 12) + pad(f(a ? a.n / nS : 0) + '/' + f(b ? b.n / nO : 0), 14) + (l ? ' (' + f(l.share[0]) + '/' + f(l.share[1]) + ')' : pad('', 16));
        [['swing', 3], ['whiff', 3], ['xw', 3], ['rv', 2]].forEach(function (st) {
          var c = cell(hand, g[1] + nm, st[0]), lo = l ? l[st[0]] : null;
          out += pad((c && c.s ? f(c.s.m, st[1]) + '/' + f(c.o.m, st[1]) : '-'), 14) + (lo ? ' (' + f(lo.same, st[1]) + '/' + f(lo.opp, st[1]) + ')' : pad('', 16));
        });
        print(out);
      });
    });
    print('\n5. WHERE EACH TYPE GOES AND HOW IT MOVES, in the batter\'s frame: away (in), height (share of zone), in zone, movement away / up (in); model (league)');
    TYPES.forEach(function (t) {
      var out = pad(t, 6);
      ['same', 'opp'].forEach(function (sd) {
        var K = hand + ':' + sd + ':t:' + t + ':', n = get(K + 'n'), l = L && L[hand].aim[t] ? L[hand].aim[t][sd] : null;
        if (!n) { out += pad(sd + ': -', 60); return; }
        out += '  ' + sd + ': ' + pad(f(get(K + 'away').m, 1, true), 6) + (l ? ' (' + f(l.away_in, 1, true) + ')' : '') + pad(f(get(K + 'h').m, 2), 6) + (l ? ' (' + f(l.h, 2) + ')' : '') + pad(f(get(K + 'inz').m), 7) + (l ? ' (' + f(l.zone) + ')' : '') +
               pad(f(get(K + 'mv_away').m, 1, true) + '/' + f(get(K + 'mv_up').m, 1, true), 12) + (l ? ' (' + f(l.pfx_away, 1, true) + '/' + f(l.pfx_z, 1, true) + ')' : '') + '  ';
      });
      print(out);
    });
    print('\n6. THE MODEL\'S READS BY PLATOON (no league table): picked up at the commit point, late, fooled; mean pFooled, separation at the commit point (in); the judgement\'s error |x| |z| (in) |t| (ms); mean strike judgement');
    print(pad('', 10) + pad('n', 8) + pad('picked up', 10) + pad('late', 8) + pad('fooled', 8) + pad('pFooled', 9) + pad('sep', 7) + pad('|x|', 7) + pad('|z|', 7) + pad('|t|', 7) + pad('pin', 7));
    ['all'].concat(KINDS.map(function (k) { return 'k:' + k; })).concat(TYPES.map(function (t) { return 't:' + t; })).forEach(function (sub) {
      ['same', 'opp'].forEach(function (sd) {
        var K = hand + ':' + sd + ':' + sub + ':', n = get(K + 'n'); if (!n) return;
        print(pad(sub.replace(/^[kt]:/, '') + ' ' + sd, 10) + pad(n.n, 8) + pad(f(get(K + 'detected').m), 10) + pad(f(get(K + 'late').m), 8) + pad(f(get(K + 'fooled').m), 8) + pad(f(get(K + 'pfooled').m), 9) + pad(f(get(K + 'sep').m, 1), 7) +
              pad(f(get(K + 'err_x').m, 2), 7) + pad(f(get(K + 'err_z').m, 2), 7) + pad(f(get(K + 'err_t').m, 1), 7) + pad(f(get(K + 'pin') ? get(K + 'pin').m : null), 7));
      });
    });
  });
})(typeof arguments !== 'undefined' ? arguments : []);
