# re_league.py: the quality of reaching contact (RE), fastballs with bat tracking (42 days of 2025, bat 50+ mph,
# fouls and balls in play with tracking): by distance from the zone's edge (the ball's edge counted; inside the zone
# negative) and, beyond the edge, by direction out of it - n, bat speed, exit speed (mean and 90th percentile), the
# squared-up share (exit speed at least .8 of 1.23 x bat + .23 x pitch, Statcast's rule), the mean of exit speed over
# that ceiling (the collision's efficiency), launch angle and launch minus attack mean and spread, foul share; and
# for the balls in play alone, exit speed and efficiency.
# Model twin: re_model.js.
import csv, glob, math, statistics as st
FB = ('FF', 'SI', 'FC')
HALF, R = 8.5 + 1.45, 1.45
C = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in FB or r['description'] not in ('foul', 'hit_into_play'): continue
        try: bs, ev, la, aa, px, pz, top, bot, rs = (float(r[k]) for k in ('bat_speed', 'launch_speed', 'launch_angle', 'attack_angle', 'plate_x', 'plate_z', 'sz_top', 'sz_bot', 'release_speed'))
        except ValueError: continue
        if bs < 50: continue
        x, z = px * 12, pz * 12; lo, hi = bot * 12 - R, top * 12 + R
        dx, dlo, dhi = abs(x) - HALF, lo - z, z - hi
        out = max(dx, dlo, dhi)
        d = out if out <= 0 else math.hypot(max(dx, 0), max(dlo, dhi, 0))
        inside = (x < 0) if r['stand'] == 'R' else (x > 0)   # toward the batter
        way = 'zone' if out <= 0 else ('below' if dlo >= max(dx, dhi) else 'above' if dhi >= dx else 'in' if inside else 'away')
        ceil = 1.23 * bs + 0.23 * rs
        C.append({'d': d, 'way': way, 'bs': bs, 'ev': ev, 'la': la, 'vm': la - aa, 'sq': ev >= 0.8 * ceil, 'eff': ev / ceil, 'foul': r['description'] == 'foul'})
def row(nm, S):
    if len(S) < 30: return
    evs = sorted(x['ev'] for x in S)
    B = [x for x in S if not x['foul']] or S
    print('  %-14s n %5d  bat %5.1f  EV %5.1f p90 %5.1f  squared %.3f  eff %.3f  LA %5.1f sd %4.1f  vm %5.1f sd %4.1f  foul %.3f  | in play EV %5.1f eff %.3f' % (nm, len(S), st.mean(x['bs'] for x in S), st.mean(evs), evs[int(.9 * len(evs))],
          sum(x['sq'] for x in S) / len(S), st.mean(x['eff'] for x in S), st.mean(x['la'] for x in S), st.pstdev([x['la'] for x in S]), st.mean(x['vm'] for x in S), st.pstdev([x['vm'] for x in S]), sum(x['foul'] for x in S) / len(S), st.mean(x['ev'] for x in B), st.mean(x['eff'] for x in B)))
print('LEAGUE fastball contact (bat 50+ mph, tracked): by distance from the zone edge (in)')
for lo, hi, nm in ((-99, -4, 'heart (4+ in)'), (-4, 0, 'edge in 0-4'), (0, 4, 'edge out 0-4'), (4, 8, 'out 4-8'), (8, 99, 'out 8+')):
    row(nm, [x for x in C if lo <= x['d'] < hi])
print('  beyond the edge, by direction:')
for w in ('below', 'away', 'in', 'above'):
    for lo, hi in ((0, 4), (4, 99)):
        row('%s %d-%s' % (w, lo, '' if hi == 99 else hi), [x for x in C if x['way'] == w and lo <= x['d'] < hi])
