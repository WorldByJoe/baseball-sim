// platoon_sym.js: a scratch overlay for platoon_check. Loaded after bb_engine.js, it makes the pitcher's PLAN blind to the
// batter's side: arguments[3] names what to symmetrise ('aim', 'mix' or 'aim+mix'). The same-side and opposite-side
// entries of PLAN_LOC are replaced by their average, so the model's platoon split can be read with that piece removed.
(function (A) {
  var what = String(A[3] || ''), L = BB.PLAN_LOC;
  function avg(a, b) { return a.map(function (v, i) { return (v + b[i]) / 2; }); }
  if (what.indexOf('aim') >= 0) {
    Object.keys(L.aim).forEach(function (t) { var m = avg(L.aim[t].same, L.aim[t].opp); L.aim[t].same = m; L.aim[t].opp = m.slice(); });
    Object.keys(L.shift).forEach(function (k) { Object.keys(L.shift[k].same).forEach(function (c) { var m = avg(L.shift[k].same[c], L.shift[k].opp[c]); L.shift[k].same[c] = m; L.shift[k].opp[c] = m.slice(); }); });
  }
  if (what.indexOf('mix') >= 0) {
    Object.keys(L.sideUse).forEach(function (t) { var m = (L.sideUse[t][0] + L.sideUse[t][1]) / 2; L.sideUse[t] = [m, m]; });
    Object.keys(L.countUse.same).forEach(function (c) { var m = avg(L.countUse.same[c], L.countUse.opp[c]); L.countUse.same[c] = m; L.countUse.opp[c] = m.slice(); });
  }
  print('platoon_sym: symmetrised ' + (what || 'nothing'));
})(typeof arguments !== 'undefined' ? arguments : []);
