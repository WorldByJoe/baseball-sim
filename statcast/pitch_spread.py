"""
pitch_spread.py · v0.1 · 2026-10-02

Measures, from pitch-level Statcast, how much pitches of one type differ:
between pitchers (the spread of each pitcher's usual pitch, pitchers with 30+
of the type) and from pitch to pitch within one pitcher's game (games with 10+
of the type). For each type: induced vertical break (pfx_z), horizontal break
toward the arm side (pfx_x signed by the throwing hand), spin rate and release
speed. The engine's pitch-shape spreads (PITCH_TYPES in bb_engine.js) are
fitted to these by tools/fit_pitch_spread.js.

The within-game spreads include Statcast's own tracking noise, of unknown size:
the steadiest 2% of pitcher-games sat at about two-thirds of the median spread,
which sampling alone gives, so the noise could not be separated here.

  python3 statcast/fetch_pitches.py --dates 2025-05-05:2025-05-18
  python3 statcast/pitch_spread.py 2025-05-05:2025-09-21

CHANGED
  v0.1  first build (the targets behind bb_engine v1.0's pitch-shape spreads)
"""
import math, os, statistics as st, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swing_geometry import load

TYPES = ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS')


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def spread(rows, key, j, minn):
    """sd of group means and pooled within-group sd of column j, groups with minn+ rows"""
    gr = {}
    for r in rows:
        gr.setdefault(key(r), []).append(r[j])
    ok = [v for v in gr.values() if len(v) >= minn]
    return st.pstdev([st.mean(v) for v in ok]), math.sqrt(st.mean([st.pvariance(v) for v in ok])), len(ok)


def main(spec):
    by = {}
    n = 0
    for r in load(spec):
        z, x, s, v = fl(r.get('pfx_z')), fl(r.get('pfx_x')), fl(r.get('release_spin_rate')), fl(r.get('release_speed'))
        if None in (z, x, s, v):
            continue
        n += 1
        x = -x if r.get('p_throws') == 'R' else x   # + = toward the pitcher's arm side
        by.setdefault(r.get('pitch_type'), []).append((r['pitcher'], r['game_pk'], z * 12, x * 12, s, v))
    print('pitches with movement, spin and speed: %d (%s)' % (n, spec))
    print('type      n   IVB mean  between  within-game |  HB mean  between  within-game |  spin mean  between  within-game | speed within-game | pitchers  games')
    for t in TYPES:
        L = by.get(t, [])
        if not L:
            continue
        pk = lambda r: r[0]
        gk = lambda r: (r[0], r[1])
        zb, _, npit = spread(L, pk, 2, 30)
        _, zw, ngam = spread(L, gk, 2, 10)
        xb, _, _ = spread(L, pk, 3, 30)
        _, xw, _ = spread(L, gk, 3, 10)
        sb, _, _ = spread(L, pk, 4, 30)
        _, sw, _ = spread(L, gk, 4, 10)
        _, vw, _ = spread(L, gk, 5, 10)
        print('  %s %7d   %6.1f   %6.2f   %6.2f      | %6.1f   %6.2f   %6.2f      | %7.0f   %6.0f   %6.0f      |   %5.2f           | %5d  %6d' % (
            t, len(L), st.mean(r[2] for r in L), zb, zw, st.mean(r[3] for r in L), xb, xw, st.mean(r[4] for r in L), sb, sw, vw, npit, ngam))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
