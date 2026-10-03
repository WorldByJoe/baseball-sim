"""
baserunning.py · v0.1 · 2026-10-02

How far runners went on a single or a double in the league, from pitch-level
Statcast: where each runner was when the next batter came up (on_1b, on_2b,
on_3b carry player ids), how many runs scored on the play, and how many outs
were made. These are the base-running layer's targets (bb_field.js decides how
far a runner goes against the throw).

Only plays with the bases in one of three states are used, and only when the
next batter came up in the same half-inning (a play that ended the inning
cannot show where the runners stopped, unless its outs show the runner out):
  runner on 2nd only, single:  scored / held at third / out
  runner on 1st only, single:  to third or home / held at second / out
  runner on 1st only, double:  scored / held at third / out

Writes statcast/baserunning_<year>.json.

  python3 statcast/baserunning.py 2025-05-05:2025-09-21

CHANGED
  v0.1  first build
"""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swing_geometry import load


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def main(spec):
    rows = [r for r in load(spec) if (r.get('game_type') or 'R') == 'R']
    # one row per plate appearance: its last pitch
    pa = {}
    for r in rows:
        k = (r['game_pk'], int(fl(r['at_bat_number']) or 0))
        if k not in pa or int(fl(r['pitch_number']) or 0) > int(fl(pa[k]['pitch_number']) or 0):
            pa[k] = r
    keys = sorted(pa)
    C = collections.defaultdict(lambda: collections.Counter())
    for i, k in enumerate(keys):
        r = pa[k]
        ev = r.get('events')
        if ev not in ('single', 'double'):
            continue
        b1, b2, b3 = r.get('on_1b') or '', r.get('on_2b') or '', r.get('on_3b') or ''
        b1, b2, b3 = ('' if x in ('', 'NA', 'nan') else x for x in (b1, b2, b3))
        if ev == 'single' and b2 and not b1 and not b3:
            case, runner = 'R2 on a single', b2
        elif ev == 'single' and b1 and not b2 and not b3:
            case, runner = 'R1 on a single', b1
        elif ev == 'double' and b1 and not b2 and not b3:
            case, runner = 'R1 on a double', b1
        else:
            continue
        outs = int(fl(r.get('outs_when_up')) or 0)
        runs = (fl(r.get('post_bat_score')) or 0) - (fl(r.get('bat_score')) or 0)
        nxt = pa.get(keys[i + 1]) if i + 1 < len(keys) and keys[i + 1][0] == k[0] else None
        same = nxt is not None and nxt.get('inning') == r.get('inning') and nxt.get('inning_topbot') == r.get('inning_topbot')
        if same:
            n1, n2, n3 = (nxt.get(x) or '' for x in ('on_1b', 'on_2b', 'on_3b'))
            nouts = int(fl(nxt.get('outs_when_up')) or 0)
            if runs >= 1 and runner not in (n1, n2, n3):
                res = 'scored'
            elif runner == n3:
                res = 'third'
            elif runner == n2:
                res = 'second'
            elif nouts > outs:
                res = 'out'
            else:
                res = 'other'
        else:
            res = 'out' if runs < 1 else 'scored'       # the inning ended on the play: if no run scored, an out was made on the bases
        C[(case, outs)][res] += 1
        C[(case, 'all')][res] += 1
    J, out = {}, []
    out.append('%-16s %5s %6s   %s' % ('case', 'outs', 'n', 'shares'))
    for case in ('R2 on a single', 'R1 on a single', 'R1 on a double'):
        for o in (0, 1, 2, 'all'):
            c = C[(case, o)]; n = sum(c.values())
            if not n:
                continue
            sh = {k: v / n for k, v in c.items()}
            J['%s|%s' % (case, o)] = {'n': n, **sh}
            out.append('%-16s %5s %6d   ' % (case, o, n) + '  '.join('%s %.3f' % (k, sh[k]) for k in ('scored', 'third', 'second', 'out', 'other') if k in sh))
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'baserunning_2025.json'), 'w') as f:
        json.dump(J, f, indent=1)
    print('\n'.join(out))
    print('wrote statcast/baserunning_2025.json')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
