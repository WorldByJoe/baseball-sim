"""
carry_compare.py · v0.1 · 2026-10-13

The engine's carry against the real: median distance (Statcast's hit distance, projected for a home run; the engine's
projected distance) and home-run share by exit speed and launch angle, the real from every 2026 regular-season ball in
play, the engine from review/carry_check.js (its hitters against its pitchers in MLB's parks and weather). Also the
engine's total spin and backspin by launch angle. Prints the table and the rms distance error over 95+ mph, 15-40 deg.

  python3 season/carry_compare.py diag_out/carry_*.jsonl

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import glob, json, os, sys
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
EVS = ((90, 95), (95, 100), (100, 105), (105, 120)); LAS = [(a, a + 5) for a in range(10, 45, 5)]


def real():
    f = os.path.join(HERE, 'carry_real_2026.json')
    if os.path.exists(f): return pd.read_json(f)
    R = pd.concat([pd.read_csv(x, usecols=['game_type', 'type', 'events', 'launch_speed', 'launch_angle', 'hit_distance_sc']) for x in glob.glob(os.path.join(HERE, '..', 'statcast', 'raw', 'pitches', '2026', '*.csv'))])
    R = R[(R.game_type == 'R') & (R.type == 'X') & R.launch_speed.notna() & R.launch_angle.notna() & R.hit_distance_sc.notna()]
    R = pd.DataFrame({'ev': R.launch_speed, 'la': R.launch_angle, 'dist': R.hit_distance_sc, 'hr': (R.events == 'home_run').astype(int)})
    R = R.reset_index(drop=True); R.to_json(f); return R


def main(files):
    E = pd.DataFrame([json.loads(l) for f in files for l in open(f) if l.startswith('[')], columns=['ev', 'la', 'spin', 'back', 'dist', 'hr', 'elev', 'temp'])
    R = real(); err = []
    print('median distance ft, engine / real (home-run share engine / real); %d engine, %d real balls in play' % (len(E), len(R)))
    for lo, hi in EVS:
        cells = []
        for a, b in LAS:
            e = E[(E.ev >= lo) & (E.ev < hi) & (E.la >= a) & (E.la < b)]; r = R[(R.ev >= lo) & (R.ev < hi) & (R.la >= a) & (R.la < b)]
            de, dr = (e.dist.median() if len(e) > 20 else np.nan), (r.dist.median() if len(r) > 20 else np.nan)
            if lo >= 95 and 15 <= a < 40 and np.isfinite(de) and np.isfinite(dr): err.append(de - dr)
            cells.append('%d-%d %3.0f/%3.0f (%.2f/%.2f)' % (a, b, de, dr, e.hr.mean() if len(e) else np.nan, r.hr.mean() if len(r) else np.nan))
        print('  %d-%d mph  ' % (lo, hi) + '  '.join(cells))
    print('rms distance error, 95+ mph, 15-40 deg: %.1f ft (mean %+.1f)' % (np.sqrt(np.mean(np.square(err))), np.mean(err)))
    print('engine spin by launch angle, 95+ mph: ' + '  '.join('%d-%d total %d back %d' % (a, b, E[(E.ev >= 95) & (E.la >= a) & (E.la < b)].spin.median(), E[(E.ev >= 95) & (E.la >= a) & (E.la < b)].back.median()) for a, b in LAS))
    print('home runs per ball in play: engine %.4f, real %.4f' % (E.hr.mean(), R.hr.mean()))


if __name__ == '__main__':
    main(sys.argv[1:])
