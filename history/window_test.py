"""
window_test.py · v0.1 · 2026-10-13

Does a longer look at a player sharpen his hidden traits, and does it predict better? history/seasons.py's carry-over model
(phi from history/seasons_4yr.json), the hitters with a 2026 season:
  precision    each hidden trait's 2026 posterior sd, as a share of the population's spread, from 2026 alone, 2025-26,
               2024-26 and 2023-26 (the median over hitters who have every season of the window)
  prediction   each hitter's 2026 measures (strikeouts, walks, chase, zone swing, whiffs, fouls, exit speed, hard-hit and
               launch mix, pull) predicted from his seasons before 2026 only: none (his 2026 measured traits and the
               population), 2025, 2024-25, 2023-25; scored by the log predictive density of what he did in 2026 (higher is
               better) and the root mean square of the errors in standard deviations of his own sampling noise. Also with
               the seasons treated as unrelated (phi 0) and as one fixed trait (phi 1), to show what the carry-over does.

  python3 history/window_test.py        -> history/window_test.json

CHANGED
  v0.1  first build (Joe, 2026-10-12: with a three-year window, do we know the traits more precisely, and predict better?)
"""
import json, os, sys, math
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import seasons as SE
from seasons import FH, NH, NK

YEARS = (2023, 2024, 2025, 2026)


def main():
    E = FH.emulator(os.path.join(HERE, '..', 'diag_out', 'emu.jsonl'))
    phi4 = np.array([json.load(open(os.path.join(HERE, 'seasons_4yr.json')))['hidden'][h]['phi'] for h in SE.HIDDEN])
    recs = json.load(open(os.path.join(HERE, 'players_measured.json')))['players']
    hit = []
    for r in recs:
        if not (r['summaries'].get('hitting') or {}): continue
        P = {y: SE.pieces(SE.season_rec(r, y, YEARS), E) for y in YEARS}
        P = {y: p for y, p in P.items() if p}
        if 2026 in P: hit.append((r, P))
    out = {'hitters': len(hit), 'precision': {}, 'prediction': {}}
    # precision of the 2026 traits
    for win in ((2026,), (2025, 2026), (2024, 2025, 2026), (2023, 2024, 2025, 2026)):
        rat = []
        for r, P in hit:
            if not all(y in P for y in win): continue
            L = [P[y] for y in win]; S0h = SE.sqrtm(L[0]['S0'])
            _, C = SE.posterior_u(L, S0h, SE.stack(L, E), phi4)
            sl = slice(NH * (len(L) - 1), NH * len(L))
            rat.append(np.sqrt(np.clip(np.diag(C[sl, sl]), 0, None)) / 1.0)   # z units: the population's sd is 1
        rat = np.array(rat)
        out['precision']['-'.join(map(str, (win[0], win[-1])))] = {'hitters': len(rat), 'median sd / population sd': {h: round(float(np.median(rat[:, k])), 3) for k, h in enumerate(SE.HIDDEN)}}
    # prediction of 2026 from earlier seasons
    full = [(r, P) for r, P in hit if all(y in P for y in YEARS)]   # the same hitters for every window: those with all four seasons
    out['predictionHitters'] = len(full)
    def score(phi, win):
        lpd = []; byM = {}
        for r, P in full:
            L = [P[y] for y in win] + [P[2026]]; S0h = SE.sqrtm(L[0]['S0'])
            y, mean, B, R = SE.stack(L, E)
            C = B @ SE.ucov(S0h, phi, len(L)) @ B.T + R          # every measure of every season, jointly (the structural error shared)
            n26 = len(P[2026]['rows']); o = len(y) - n26
            if o:
                Coo, Con = C[:o, :o], C[:o, o:]
                mpred = mean[o:] + Con.T @ np.linalg.solve(Coo, y[:o] - mean[:o]); Cpred = C[o:, o:] - Con.T @ np.linalg.solve(Coo, Con)
            else:
                mpred, Cpred = mean, C
            d = y[o:] - mpred; Lc = np.linalg.cholesky((Cpred + Cpred.T) / 2); w = np.linalg.solve(Lc, d)
            lpd.append(-0.5 * (w @ w) - np.log(np.diag(Lc)).sum() - 0.5 * n26 * math.log(2 * math.pi))
            se = np.sqrt(P[2026]['se2'])
            for j, row in enumerate(P[2026]['rows']): byM.setdefault(FH.MEAS[row], []).append(d[j] / se[j])
        return len(lpd), float(np.mean(lpd)), {m: round(float(np.sqrt(np.mean(np.square(v)))), 3) for m, v in byM.items()}
    for lab, phi in (('carry-over (four seasons)', phi4), ('seasons unrelated (phi 0)', np.full(NH, 1e-4)), ('one fixed trait (phi 1)', np.full(NH, 0.9999))):
        res = {}
        for win in ((), (2025,), (2024, 2025), (2023, 2024, 2025)):
            n, l, m = score(phi, win)
            res['none' if not win else '%d-%d' % (win[0], win[-1])] = {'hitters': n, 'meanLogPredDensity': round(l, 3), 'rmsErrorInSamplingSd': m, 'rmsAll': round(float(np.sqrt(np.mean([v ** 2 for v in m.values()]))), 3)}
        out['prediction'][lab] = res
    json.dump(out, open(os.path.join(HERE, 'window_test.json'), 'w'), indent=1)
    for w, v in out['precision'].items(): print('precision %-10s %3d hitters  %s' % (w, v['hitters'], '  '.join('%s %.2f' % (h, x) for h, x in v['median sd / population sd'].items())))
    for lab, res in out['prediction'].items():
        for w, v in res.items(): print('%-28s from %-10s %3d hitters  mean log predictive density %8.3f   rms error %.3f' % (lab, w, v['hitters'], v['meanLogPredDensity'], v['rmsAll']))


if __name__ == '__main__':
    main()
