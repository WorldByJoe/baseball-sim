# vmh_league.py: launch minus attack ("vm") and exit-speed efficiency (exit speed over 1.23 x bat + .23 x pitch) by
# pitch height in fine bands, beyond the zone too (share of the batter's zone: 0 bottom, 1 top), fastballs and all
# kinds (42 days of 2025, bat 50+ mph, tracked fouls and balls in play). Model twin: vmh_model.js.
import csv, glob, statistics as st
HB = ((-9, -.5), (-.5, -.25), (-.25, 0), (0, .25), (.25, .5), (.5, .75), (.75, 1), (1, 1.25), (1.25, 1.5), (1.5, 9))
R = {'FB': [], 'ALL': []}
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['description'] not in ('foul', 'hit_into_play'): continue
        try: bs, ev, la, aa, pz, top, bot, rs = (float(r[k]) for k in ('bat_speed', 'launch_speed', 'launch_angle', 'attack_angle', 'plate_z', 'sz_top', 'sz_bot', 'release_speed'))
        except ValueError: continue
        if bs < 50: continue
        x = ((pz - bot) / (top - bot), la - aa, ev / (1.23 * bs + 0.23 * rs), r['description'] == 'foul')
        R['ALL'].append(x)
        if r['pitch_type'] in ('FF', 'SI', 'FC'): R['FB'].append(x)
for k in ('FB', 'ALL'):
    print('LEAGUE %s: by height band - n, vm mean, vm sd, efficiency (all tracked contact), efficiency in play, foul share' % k)
    for lo, hi in HB:
        S = [x for x in R[k] if lo <= x[0] < hi]; B = [x for x in S if not x[3]]
        if len(S) < 30: continue
        print('  %5.2f..%-5.2f n %5d  vm %+5.1f sd %4.1f  eff %.3f  in play %.3f  foul %.3f' % (lo, hi, len(S), st.mean(x[1] for x in S), st.pstdev([x[1] for x in S]), st.mean(x[2] for x in S), st.mean(x[2] for x in B) if B else 0, sum(x[3] for x in S) / len(S)))
