// platoon_k.js: a scratch overlay for platoon_check. Loaded after bb_engine.js, it sets the release-angle read factor
// PL.read (per degree) from arguments[3], PL.psi0 / PL.mean from arguments[4] and [5], and PL.speed / PL.over from
// arguments[6] and [7] when given, for the fit.
(function (A) {
  if (A[3] !== undefined) BB.PL.read = +A[3];
  if (A[4] !== undefined) BB.PL.psi0 = +A[4];
  if (A[5] !== undefined) BB.PL.mean = +A[5];
  if (A[6] !== undefined) BB.PL.speed = +A[6];
  if (A[7] !== undefined) BB.PL.over = +A[7];
  print('platoon_k: PL.read ' + BB.PL.read + ', PL.speed ' + BB.PL.speed + ', PL.over ' + BB.PL.over + ' per deg, psi0 ' + BB.PL.psi0 + ', mean ' + BB.PL.mean);
})(typeof arguments !== 'undefined' ? arguments : []);
