# fric_show.py: the friction grid (review/fric_grid.sh) scored: grazes (share, speed ratio and spread, slopes on pitch and bat speed)
# and swing_mix (launch-angle and swing-outcome distances) against the league's 2026
import json, glob, sys, re
Q = json.load(open('/Users/joevonfischer/bsim-wt/review/season/swing_mix_real.json')); rla = list(Q['laShares'].values()); rps = Q['perSwing']
rows = []
for f in sorted(glob.glob('diag_out/fric_*_graze.json')):
    m = re.match(r'diag_out/fric_([\d.]+)_([\d.]+)_graze.json', f); ref, g = m.group(1), m.group(2)
    try: G = json.loads(open(f).read().strip().splitlines()[-1])
    except Exception: continue
    S = [json.load(open(x)) for x in glob.glob('diag_out/smx_fric_%s_%s_[12].json' % (ref, g))]
    if not S: continue
    la = [sum(list(r['laShares'].values())[i] for r in S) / len(S) for i in range(8)]
    ps = {k: [sum(r['perSwing'][k][c] for r in S) / len(S) for c in ('whiff', 'foul', 'play')] for k in ('all', 'FB', 'BR', 'OS')}
    dl = sum((a - b) ** 2 for a, b in zip(la, rla)) ** 0.5
    ds = sum((a - b) ** 2 for k in ('FB', 'BR', 'OS') for a, b in zip(ps[k], [rps[k][c] for c in ('whiff', 'foul', 'play')])) ** 0.5
    gz = G['grazes']; fa = G['fair10to40']
    dg = ((G['grazeShare'] - .386) / .03) ** 2 + ((G['speedRatioMedian'] - .813) / .02) ** 2 + ((gz['evSlopesPitchBat'][0] - .277) / .1) ** 2 + ((gz['evSlopesPitchBat'][1] - .281) / .1) ** 2
    rows.append((dl / 0.01 + ds / 0.02 + dg ** 0.5, ref, g, G['grazeShare'], G['speedRatioMedian'], G['ratioP10P90'], gz['evSlopesPitchBat'], fa['evSlopesPitchBat'], gz['muMedian'], fa['muMedian'], dl, ds, la, ps['all']))
print('score  muRef gamma | graze share ratio (p10,p90) slopes foul / fair | mu graze/fair | LA dist swing dist | all w/f/p | LA shares')
print('league            | .386 .813 (.722,.944) [.277,.281] / [.053,.964]')
for r in sorted(rows):
    print('%5.1f  %5s %5s | %.3f %.3f %s %s / %s | %.3f/%.3f | %.3f %.3f | %s | %s' % (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], ' '.join('%.3f' % x for x in r[13]), ' '.join('%.3f' % x for x in r[12])))
