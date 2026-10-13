"""
trait_dist.py · v0.1 · 2026-10-13

The frequency distribution of traits among 2026's major leaguers (season fold A's fits: 2025 and 2026's first half), against
the model's own population of major leaguers (the emulator's hitters: the farm's best, as the model generates them).
  hidden hitter traits   each hitter's posterior mean is pulled toward the average by how little his data say, so the
                         spread of the means understates the league's; the league's spread is estimated as the spread of the
                         means plus the average posterior variance (the law of total variance). Hitters with 200+ PA.
  measured traits        bat speed, swing length, attack angle, swing tilt as measured (2026 first half, 100+ swings),
                         against the emulator's population
  pitchers               fitted deception, command scale and mishit (fold A), and measured fastball speed and extension
Writes season/trait_dist.json and a figure (small multiples: the league's histogram of estimates, its estimated distribution
as a curve, and the model's population as a second curve) to the path given.

  python3 season/trait_dist.py ~/path/figure.png

CHANGED
  v0.1  first build (Joe, 2026-10-12: the frequency distribution of traits among MLB players)
"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'review'))
import fit_hitters as FH
WT = os.path.expanduser('~/bsim-wt/hist26A')
WHAT = {'motorIn': 'vertical bat-to-ball scatter (in)', 'faceSD': 'bat-face scatter (deg)', 'undercut': 'aim below centre (in)', 'timingSD': 'timing scatter (ms)',
        'longSD': 'along-barrel scatter (in)', 'spotIn': 'pickup distance (in)', 'eyeSD': 'zone-judgement scatter (in)', 'aggr': 'swing aggression',
        'commit': 'sits on his guess', 'fbLean': 'fastball lean', 'pullBias': 'contact point (deg, + out front)', 'learn': 'in-game learning', 'coverage': 'reach (in)',
        'batSpeed': 'bat speed (mph)', 'swingLenFt': 'swing length (ft)', 'attack': 'attack angle (deg)', 'swingTilt': 'swing tilt (deg)'}


def main(fig):
    E = FH.emulator(os.path.join(HERE, '..', 'diag_out', 'emu.jsonl')); NK = len(FH.KNOWN)
    H = json.load(open(os.path.join(WT, 'review', 'hitters_fit.json')))
    M = {str(r['id']): r for r in json.load(open(os.path.join(WT, 'playoffs', 'players_measured.json')))['players']}
    def pa(k):
        ss = (M.get(k) or {}).get('seasonStats') or {}
        return ((ss.get('hitting_2026') or {}).get('PA') or 0) + ((ss.get('hitting_2025') or {}).get('PA') or 0)
    Q = [k for k, f in H.items() if pa(k) >= 200 and f.get('seasons')]
    out = {'hitters': len(Q), 'hidden': {}, 'measured': {}, 'pitchers': {}}
    for j, h in enumerate(FH.HIDDEN):
        m = np.array([H[k].get('refined', H[k]['mean'])[h] for k in Q]); v = np.array([H[k]['sd'][h] ** 2 for k in Q])
        pop = E['X'][:, NK + j]
        out['hidden'][h] = {'leagueMean': float(m.mean()), 'leagueSd': float(np.sqrt(m.var() + v.mean())), 'sdOfEstimates': float(m.std()), 'meanPosteriorSd': float(np.sqrt(v.mean())),
                            'modelMean': float(pop.mean()), 'modelSd': float(pop.std()), 'est': m.round(4).tolist(), 'model': pop[::3].round(4).tolist(),
                            'p10': float(np.percentile(m, 10)), 'p90': float(np.percentile(m, 90))}
    for j, k_ in enumerate(FH.KNOWN):
        if k_ in ('heightIn', 'weightLb'): vals = np.array([float(H[k]['known'][k_]) for k in Q])
        else:
            vals = np.array([((M[k]['traits'].get(k_) or {}).get('2026') or {}).get('mean') for k in Q if (((M.get(k) or {}).get('traits') or {}).get(k_) or {}).get('2026')], float)
        pop = E['X'][:, j]
        out['measured'][k_] = {'n': int(len(vals)), 'leagueMean': float(np.nanmean(vals)), 'leagueSd': float(np.nanstd(vals)), 'modelMean': float(pop.mean()), 'modelSd': float(pop.std()),
                               'est': np.round(vals[~np.isnan(vals)], 3).tolist(), 'model': pop[::3].round(3).tolist()}
    P = json.load(open(os.path.join(WT, 'review', 'pitchers_fit.json')))['pitchers']
    for k_ in ('deception', 'cmdScale', 'mishit'):
        vals = np.array([p[k_] for p in P.values() if p.get(k_) is not None])
        out['pitchers'][k_] = {'n': int(len(vals)), 'mean': float(vals.mean()), 'sd': float(vals.std()), 'p10': float(np.percentile(vals, 10)), 'p90': float(np.percentile(vals, 90)), 'est': vals.round(3).tolist()}
    json.dump(out, open(os.path.join(HERE, 'trait_dist.json'), 'w'))
    print('%d hitters (200+ PA)' % len(Q))
    print('%-10s %-34s %9s %9s | %9s %9s | %s' % ('trait', '', 'league', 'sd', 'model', 'sd', 'league sd / model sd'))
    for h, d in list(out['hidden'].items()) + list(out['measured'].items()):
        print('%-10s %-34s %9.3f %9.3f | %9.3f %9.3f | %.2f' % (h, WHAT.get(h, h)[:34], d['leagueMean'], d['leagueSd'], d['modelMean'], d['modelSd'], d['leagueSd'] / d['modelSd'] if d['modelSd'] else float('nan')))
    for k_, d in out['pitchers'].items(): print('pitchers %-10s n %d mean %.3f sd %.3f (p10 %.2f, p90 %.2f)' % (k_, d['n'], d['mean'], d['sd'], d['p10'], d['p90']))
    if fig:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        keys = [k for k in FH.KNOWN if k not in ('heightIn', 'weightLb')] + FH.HIDDEN
        fig_, axes = plt.subplots(4, 5, figsize=(17, 12.5)); axes = axes.ravel()
        for ax, k in zip(axes, keys):
            d = out['measured'].get(k) or out['hidden'][k]; est = np.array(d['est']); pop = np.array(d['model'])
            lo, hi = np.percentile(np.concatenate([est, pop]), [0.5, 99.5]); bins = np.linspace(lo, hi, 32)
            ax.hist(est, bins=bins, density=True, color='#2a78d6', alpha=0.45, label='2026 hitters (estimates)')
            xs = np.linspace(lo, hi, 200)
            g = lambda mu, sd: np.exp(-0.5 * ((xs - mu) / sd) ** 2) / (sd * np.sqrt(2 * np.pi))
            ax.plot(xs, g(d['leagueMean'], d['leagueSd']), color='#0d366b', lw=2, label='league, corrected for shrinkage')
            ax.plot(xs, g(d['modelMean'], d['modelSd']), color='#e8a33d', lw=2, ls='--', label="the model's major leaguers")
            ax.set_title(WHAT.get(k, k), fontsize=10); ax.set_yticks([]); ax.tick_params(labelsize=8)
        for ax in axes[len(keys):]: ax.axis('off')
        axes[0].legend(fontsize=8, loc='upper left', frameon=False)
        fig_.suptitle('Traits of 2026 major-league hitters (200+ PA) against the model\'s population of major leaguers', fontsize=13)
        fig_.tight_layout(rect=[0, 0, 1, 0.97]); fig_.savefig(os.path.expanduser(fig), dpi=110)
        print('figure', fig)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
