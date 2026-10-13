"""
calib34.py · v0.1 · 2026-10-13

Reads season/calib34.sh's settings (~/bsim-wt/cal/diag_out/cal_<send>_<vis>): per setting, how often a man on first alone
scores on a double, by outs (the league 2025-26: .270 / .327 / .500), the home side's hits on balls in play other than
home runs less the visitors' (each setting against the setting without the visitors' slower step: the same games and
seeds; the league's home edge there is about +0.004), and runs, home runs and hits per team-game (the new flight, with
the old traits).

  python3 season/calib34.py

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import glob, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import runs_audit as RA
TARGET = {0: 0.270, 1: 0.327, 2: 0.500}


def hits_bip(D, half):
    B = D[(D.half == half) & D.res.isin(['1B', '2B', '3B', 'OUT', 'E'])]
    return B.res.isin(['1B', '2B', '3B']).mean()


def main():
    rows = []
    for d in sorted(glob.glob(os.path.expanduser('~/bsim-wt/cal/diag_out/cal_*'))):
        if not glob.glob(os.path.join(d, '*.jsonl')): continue
        RA.AUD = d; E, ng = RA.engine()
        send, vis = os.path.basename(d)[4:].split('_')
        s = E[(E.res == '2B') & (E.bases == 1)]
        byo = {o: float((g.runs >= 1).mean()) for o, g in s.groupby('outs')}
        ha = hits_bip(E, 1) - hits_bip(E, 0)
        rg = E.groupby('halfkey').toEnd.first().sum() / (2 * ng)
        rows.append((send, float(vis), byo, ha, rg, (E.res == 'HR').sum() / (2 * ng), E.res.isin(['1B', '2B', '3B', 'HR']).sum() / (2 * ng), ng))
    base = {r[0]: r[3] for r in rows if r[1] == 0}
    b0 = [r[3] for r in rows if r[1] == 0]
    for send, vis, byo, ha, rg, hr, h, ng in rows:
        print('send %-12s vis %.2f | from first on a double: %s (league .270/.327/.500) | home minus visitors, hits per ball in play %+.4f (over vis 0: %+.4f) | runs %.2f  HR %.2f  H %.2f a team-game  (%d games)' % (
            send, vis, ' '.join('%d out %.3f' % (o, byo.get(o, float('nan'))) for o in (0, 1, 2)), ha, ha - (b0[0] if b0 else 0), rg, hr, h, ng))


if __name__ == '__main__':
    main()
