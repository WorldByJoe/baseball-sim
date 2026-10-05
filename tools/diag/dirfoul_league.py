# fastball tracked contact: foul rate by the bat's horizontal direction at contact (Statcast attack_direction, + = toward the opposite field per bat_direction.py) and by launch minus attack band
import csv, glob
R = []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in ('FF', 'SI', 'FC') or r['description'] not in ('foul', 'hit_into_play'): continue
        try: ad = float(r['attack_direction']); vm = float(r['launch_angle']) - float(r['attack_angle'])
        except ValueError: continue
        R.append((-ad, vm, r['description'] == 'foul'))   # flipped: + = toward the pull side, as the model's spray
n = len(R)
print('LEAGUE fastball contact by bat direction (deg, + pull): share / foul rate, and foul rate for contact 5-40 deg under')
for lo, hi in ((-90, -30), (-30, -15), (-15, 0), (0, 15), (15, 30), (30, 90)):
    S = [x for x in R if lo <= x[0] < hi]; S2 = [x for x in S if 5 <= x[1] < 40]
    print('  %4d..%-4d  %.3f / %.3f    5-40 under: %.3f' % (lo, hi, len(S) / n, sum(x[2] for x in S) / len(S), sum(x[2] for x in S2) / max(1, len(S2))))
