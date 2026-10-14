# smx_show.py: review/swing_mix.js outputs (seeds averaged) against the league's (season/swing_mix_real.json), one line a setting
import json, sys, glob
Q = json.load(open('/Users/joevonfischer/bsim-wt/review/season/swing_mix_real.json'))
rla = list(Q['laShares'].values()); rps = Q['perSwing']
print('%-10s %-26s %-20s %-20s %-20s | %s' % ('', 'all whiff/foul/play', 'FB', 'BR', 'OS', 'LA <-10 -10 0 10 20 30 40 50+'))
print('%-10s %-26s %-20s %-20s %-20s | %s' % ('REAL', *[str(tuple(round(rps[k][c], 3) for c in ('whiff', 'foul', 'play'))) for k in ('all', 'FB', 'BR', 'OS')], ' '.join('%.3f' % x for x in rla)))
for tag in sys.argv[1:]:
    R = [json.load(open(f)) for f in sorted(glob.glob('diag_out/smx_%s_[0-9].json' % tag))]
    if not R: continue
    ps = {k: tuple(round(sum(r['perSwing'][k][c] for r in R) / len(R), 3) for c in ('whiff', 'foul', 'play')) for k in ('all', 'FB', 'BR', 'OS')}
    la = [sum(list(r['laShares'].values())[i] for r in R) / len(R) for i in range(8)]
    dl = sum((a - b) ** 2 for a, b in zip(la, rla)) ** 0.5
    ds = sum((a - b) ** 2 for k in ('FB', 'BR', 'OS') for a, b in zip(ps[k], [rps[k][c] for c in ('whiff', 'foul', 'play')])) ** 0.5
    print('%-10s %-26s %-20s %-20s %-20s | %s  (LA %.3f, swings %.3f)' % (tag, ps['all'], ps['FB'], ps['BR'], ps['OS'], ' '.join('%.3f' % x for x in la), dl, ds))
