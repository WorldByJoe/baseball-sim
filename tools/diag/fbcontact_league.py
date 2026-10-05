# fastball swings with bat tracking (42 days of 2025): what a foul looks like against a ball in play, and the
# vertical offset behind the contact. For tracked contact: the bat's speed against the hitter's own mean, swing
# length, contact depth about his mean, launch minus attack ("vm"), exit speed, squared-up (Statcast's rule), by
# foul / in play and by vm band; the vm distribution itself (and the offset D it implies at 23 deg per inch, the
# engine's collision slope); exit speed by launch-angle band for fouls and balls in play; the count.
import csv, glob, math, statistics as st, sys
FB = ('FF', 'SI', 'FC')
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in FB or r['description'] not in ('foul', 'hit_into_play', 'swinging_strike', 'swinging_strike_blocked', 'foul_tip'): continue
        try: bs, sl = float(r['bat_speed']), float(r['swing_length'])
        except ValueError: continue
        if bs < 50: continue   # checked swings and bunts out, as the bat-speed measurements were
        rec = {'b': r['batter'], 'd': r['description'], 'bs': bs, 'sl': sl, 'strikes': int(r['strikes']), 'balls': int(r['balls'])}
        try: rec['ev'], rec['la'], rec['aa'], rec['ad'], rec['dep'] = (float(r[k]) for k in ('launch_speed', 'launch_angle', 'attack_angle', 'attack_direction', 'intercept_ball_minus_batter_pos_y_inches'))
        except ValueError: pass
        try: rec['mph'] = float(r['effective_speed'] or r['release_speed'])
        except ValueError: rec['mph'] = 93
        R.append(rec)
by = {}
for x in R: by.setdefault(x['b'], []).append(x)
mu_bs = {b: st.mean(x['bs'] for x in v) for b, v in by.items()}
mu_sl = {b: st.mean(x['sl'] for x in v) for b, v in by.items()}
mu_dep = {b: st.mean(x['dep'] for x in v if 'dep' in x) for b, v in by.items() if any('dep' in x for x in v)}
C = [x for x in R if 'ev' in x and x['d'] in ('foul', 'hit_into_play')]
for x in C:
    x['vm'] = x['la'] - x['aa']; x['sq'] = x['ev'] >= 0.8 * (1.23 * x['bs'] + 0.23 * x['mph'])
    x['dbs'] = x['bs'] - mu_bs[x['b']]; x['dsl'] = x['sl'] - mu_sl[x['b']]; x['ddep'] = x['dep'] - mu_dep[x['b']] if x['b'] in mu_dep else 0
n = len(C); F = [x for x in C if x['d'] == 'foul']; B = [x for x in C if x['d'] != 'foul']
print('LEAGUE fastball swings 50+ mph with tracking: %d; tracked contact %d, foul %.3f' % (len(R), n, len(F) / n))
def m(v, k): return st.mean(x[k] for x in v)
print('                       n     bat-mean   swlen-mean  depth-mean    vm      EV    squared')
for nm, V in (('fouls', F), ('balls in play', B)):
    print('  %-18s %6d   %+6.2f     %+6.3f      %+6.2f    %+6.1f  %6.1f   %.3f' % (nm, len(V), m(V, 'dbs'), m(V, 'dsl'), m(V, 'ddep'), m(V, 'vm'), m(V, 'ev'), sum(x['sq'] for x in V) / len(V)))
print('  by vm band: share, foul rate, bat speed about his mean (foul / in play), EV (foul / in play), squared-up (foul / in play)')
for lo, hi in ((-90, -40), (-40, -25), (-25, -15), (-15, -5), (-5, 5), (5, 15), (15, 25), (25, 40), (40, 60), (60, 99)):
    S = [x for x in C if lo <= x['vm'] < hi]; f = [x for x in S if x['d'] == 'foul']; b = [x for x in S if x['d'] != 'foul']
    if not f or not b: continue
    print('   %4d..%-3d  %.3f  foul %.3f   bat %+5.2f / %+5.2f   EV %5.1f / %5.1f   sq %.3f / %.3f' % (lo, hi, len(S) / n, len(f) / len(S), m(f, 'dbs'), m(b, 'dbs'), m(f, 'ev'), m(b, 'ev'), sum(x['sq'] for x in f) / len(f), sum(x['sq'] for x in b) / len(b)))
print('  vm distribution of tracked contact: mean %+.1f sd %.1f; p10 %+.0f p25 %+.0f p50 %+.0f p75 %+.0f p90 %+.0f' % ((m(C, 'vm'), st.pstdev(x['vm'] for x in C)) + tuple(sorted(x['vm'] for x in C)[int(q * n)] for q in (.1, .25, .5, .75, .9))))
print('  bat speed about his mean, all tracked swings: whiffs %+.2f, fouls %+.2f, in play %+.2f (n %d / %d / %d)' % (
    st.mean(x['bs'] - mu_bs[x['b']] for x in R if x['d'].startswith('swinging')), m(F, 'dbs'), m(B, 'dbs'), sum(1 for x in R if x['d'].startswith('swinging')), len(F), len(B)))
print('  EV by launch band, fouls / balls in play (mean EV, n):')
for lo, hi in ((-90, -10), (-10, 10), (10, 30), (30, 50), (50, 70), (70, 99)):
    f = [x for x in F if lo <= x['la'] < hi]; b = [x for x in B if lo <= x['la'] < hi]
    print('   LA %4d..%-3d  foul EV %5.1f (n %5d, bat %+5.2f)   in play EV %5.1f (n %5d, bat %+5.2f)' % (lo, hi, m(f, 'ev') if f else 0, len(f), m(f, 'dbs') if f else 0, m(b, 'ev') if b else 0, len(b), m(b, 'dbs') if b else 0))
print('  two-strike share: fouls %.3f, in play %.3f; foul rate by strikes 0/1/2: %s' % (sum(x['strikes'] == 2 for x in F) / len(F), sum(x['strikes'] == 2 for x in B) / len(B),
      ' '.join('%.3f' % (sum(1 for x in C if x['strikes'] == s and x['d'] == 'foul') / max(1, sum(1 for x in C if x['strikes'] == s))) for s in (0, 1, 2))))
# the bat's direction (+ pull) and depth for fouls against balls in play at the same vm
print('  by vm band: bat direction (+ pull) and depth about his mean, fouls / in play')
for lo, hi in ((-90, -15), (-15, 5), (5, 25), (25, 40), (40, 99)):
    f = [x for x in F if lo <= x['vm'] < hi]; b = [x for x in B if lo <= x['vm'] < hi]
    print('   %4d..%-3d  dir %+5.1f / %+5.1f   depth %+5.1f / %+5.1f   n %d / %d' % (lo, hi, -m(f, 'ad'), -m(b, 'ad'), m(f, 'ddep'), m(b, 'ddep'), len(f), len(b)))
