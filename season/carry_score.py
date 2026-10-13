"""
carry_score.py · v0.1 · 2026-10-13

Each aerodynamic setting of review/carry_fit.js scored against 2026's carry: per exit-speed and launch-angle cell (90-95,
95-100, 100-105, 105+ mph by 10-45 deg in fives), the distance error (engine median minus real median) and the home-run
share error, each weighted by the real balls in the cell; the rms of each and their means.

  python3 season/carry_score.py diag_out/carry_fit.jsonl

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import json, os, sys
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
EVB = [(90, 95), (95, 100), (100, 105), (105, 120)]


def main(path):
    R = pd.read_json(os.path.join(HERE, 'carry_real_2026.json'))
    real = {}
    for e, (lo, hi) in enumerate(EVB):
        for a in range(7):
            S = R[(R.ev >= lo) & (R.ev < hi) & (R.la >= 10 + 5 * a) & (R.la < 15 + 5 * a)]
            if len(S) > 30: real['%d|%d' % (e, a)] = (S.dist.median(), S.hr.mean(), len(S))
    rows = []
    for l in open(path):
        if not l.startswith('{'): continue
        J = json.loads(l); de, dh, w = [], [], []
        for key, (dr, hr, n) in real.items():
            c = J['cells'].get(key)
            if not c or c[2] < 20: continue
            de.append(c[0] - dr); dh.append(c[1] - hr); w.append(n)
        de, dh, w = np.array(de), np.array(dh), np.array(w, float); w /= w.sum()
        rows.append((J['batCd'], J['slope'], J['k'], math.sqrt((w * de ** 2).sum()) if False else float(np.sqrt((w * de ** 2).sum())), float((w * de).sum()), float(np.sqrt((w * dh ** 2).sum())), float((w * dh).sum())))
    rows.sort(key=lambda r: r[3] + 100 * r[5])
    print('batCd  slope  spin k | rms ft  mean ft | HR rms  HR mean   (sorted by rms ft + 100 x HR rms)')
    for r in rows: print('%5.2f  %5.2f  %5.2f | %6.1f  %+6.1f | %6.3f  %+6.3f' % r)


if __name__ == '__main__':
    import math
    main(sys.argv[1])
