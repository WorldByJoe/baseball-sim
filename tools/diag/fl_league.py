# fl_league.py: where the league's fastball contact lands, by how far under or over the ball it was struck (FL).
# Fastball swings with bat tracking (42 days of 2025, bat 50+ mph; fouls and balls in play, foul tips have no
# tracking). (A) By launch minus attack ("vm") band: share of contact, foul rate, and for balls in play the launch
# angle, exit speed, pop-up share (50+ deg) and spray (pull frame: + pulled) - mean, sd, share beyond 30 deg; for
# fouls the exit speed, launch angle and Statcast's distance. (B) The same flight, a different fate: foul rate by
# launch angle x exit speed (a ball's flight is set by those two; what is left is its direction). Model twin:
# fl_model.js. (D) The grazes: exit speed over the pitch's release speed for contact at 10-70 deg, fouls against balls in
# play, and the exit speed of the fouls at .70-.95 of it fitted on the pitch's speed and the bat's. Argument: the pitch
# kind, FB (default), BR, OS or ALL.
import csv, glob, math, statistics as st
import numpy as np, sys
KINDS = {'FB': ('FF', 'SI', 'FC'), 'BR': ('SL', 'CU', 'ST', 'KC', 'SV'), 'OS': ('CH', 'FS', 'FO')}
KIND = sys.argv[1] if len(sys.argv) > 1 else 'FB'
FB = KINDS[KIND] if KIND in KINDS else sum(KINDS.values(), ())
HC_X0, HC_Y0 = 126.0, 205.0
C = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in FB or r['description'] not in ('foul', 'hit_into_play'): continue
        try:
            bs = float(r['bat_speed']); ev = float(r['launch_speed']); la = float(r['launch_angle']); aa = float(r['attack_angle'])
        except ValueError: continue
        if bs < 50: continue
        x = {'foul': r['description'] == 'foul', 'ev': ev, 'la': la, 'vm': la - aa, 'bs': bs, 'rel': float(r['release_speed'] or 0) or 93.0}
        try: x['dist'] = float(r['hit_distance_sc'])
        except ValueError: pass
        if not x['foul'] and r['hc_x'] and r['hc_y']:
            sp = math.degrees(math.atan2(float(r['hc_x']) - HC_X0, HC_Y0 - float(r['hc_y'])))
            x['spray'] = -sp if r['stand'] == 'R' else sp
        C.append(x)
n = len(C)
def mean(v): return st.mean(v) if v else float('nan')
def sd(v): return st.pstdev(v) if len(v) > 1 else float('nan')
print('LEAGUE %s contact with tracking (bat 50+ mph): %d, foul %.3f; pop-ups in play (50+ deg) per contact %.4f; in play GB/LD/FB/PU %s' % (KIND, n, sum(x['foul'] for x in C) / n, sum(1 for x in C if not x['foul'] and x['la'] >= 50) / n,
      '/'.join('%.0f' % (100 * sum(1 for x in C if not x['foul'] and a <= x['la'] < b) / sum(1 for x in C if not x['foul'])) for a, b in ((-99, 10), (10, 25), (25, 50), (50, 99)))))
print('(A) by vm band: share, foul | in play: LA, EV, pop 50+, spray mean / sd / |>30| | fouls: EV, LA, dist')
for lo, hi in ((-90, -40), (-40, -25), (-25, -15), (-15, -5), (-5, 5), (5, 15), (15, 25), (25, 40), (40, 50), (50, 60), (60, 99)):
    S = [x for x in C if lo <= x['vm'] < hi]; f = [x for x in S if x['foul']]; b = [x for x in S if not x['foul']]
    if not S: continue
    sp = [x['spray'] for x in b if 'spray' in x]
    print('  %4d..%-3d %.3f  foul %.3f | LA %5.1f EV %5.1f pop %.3f spray %+5.1f / %4.1f / %.3f | foul EV %5.1f LA %5.1f dist %5.0f' % (
        lo, hi, len(S) / n, len(f) / len(S), mean([x['la'] for x in b]), mean([x['ev'] for x in b]), sum(x['la'] >= 50 for x in b) / max(1, len(b)),
        mean(sp), sd(sp), sum(abs(s) > 30 for s in sp) / max(1, len(sp)), mean([x['ev'] for x in f]), mean([x['la'] for x in f]), mean([x['dist'] for x in f if 'dist' in x])))
print('(B) foul rate by launch angle (rows) x exit speed (columns); n below')
EVB = ((0, 60), (60, 70), (70, 80), (80, 90), (90, 200))
LAB = ((-90, -10), (-10, 10), (10, 25), (25, 40), (40, 50), (50, 60), (60, 70), (70, 91))
print('            ' + ''.join('  %3d-%-3d' % (a, min(b, 999)) for a, b in EVB))
for lo, hi in LAB:
    row = []; cnt = []
    for a, b in EVB:
        S = [x for x in C if lo <= x['la'] < hi and a <= x['ev'] < b]
        row.append('   %.3f ' % (sum(x['foul'] for x in S) / len(S)) if len(S) >= 20 else '     -   '); cnt.append('  %6d ' % len(S))
    print('  LA %4d..%-3d' % (lo, hi) + ''.join(row)); print('            ' + ''.join(cnt))
print('(D) exit speed / release speed at 10-70 deg: fouls / in play (share of all contact)')
for lo, hi in ((0, .6), (.6, .7), (.7, .75), (.75, .8), (.8, .85), (.85, .9), (.9, .95), (.95, 1.0), (1.0, 1.05), (1.05, 1.1), (1.1, 9)):
    S = [x for x in C if 10 <= x['la'] < 70 and lo <= x['ev'] / x['rel'] < hi]
    print('  %.2f-%.2f  %.3f / %.3f' % (lo, min(hi, 9), sum(x['foul'] for x in S) / n, sum(not x['foul'] for x in S) / n))
for nm, V in (('grazes: fouls 10-70 deg at .70-.95', [x for x in C if x['foul'] and 10 <= x['la'] < 70 and .7 <= x['ev'] / x['rel'] < .95]), ('balls in play 10-70 deg', [x for x in C if not x['foul'] and 10 <= x['la'] < 70])):
    X = np.column_stack([np.ones(len(V)), [x['rel'] for x in V], [x['bs'] for x in V]]); b = np.linalg.lstsq(X, np.array([x['ev'] for x in V]), rcond=None)[0]
    print('  %-36s share %.3f  EV %.1f = %.1f + %.3f x pitch + %.3f x bat' % (nm, len(V) / n, st.mean(x['ev'] for x in V), b[0], b[1], b[2]))
