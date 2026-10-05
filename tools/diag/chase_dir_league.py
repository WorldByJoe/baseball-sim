# swings at pitches outside the zone (42 days of 2025), by pitch kind, by how far outside the zone's edge (the
# ball's edge counted; in) and by the direction out of the zone (below / away from the batter / in toward him /
# above): the swing rate and the whiff rate of those swings; overall and with two strikes. Bunts and pitchouts out.
import csv, glob, math
HALF, R = 8.5 + 1.45, 1.45
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
SW = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
T = {}
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        k = KIND.get(r['pitch_type']); d = r['description']
        if not k or 'bunt' in d or d == 'pitchout': continue
        try: x, z, bot, top = (float(r[c]) for c in ('plate_x', 'plate_z', 'sz_bot', 'sz_top'))
        except ValueError: continue
        dx = abs(x) * 12 - HALF; dlo = (bot - z) * 12 - R; dhi = (z - top) * 12 - R
        out = max(dx, dlo, dhi)
        if out <= 0: continue
        dist = math.hypot(max(dx, 0), max(dlo, dhi, 0))
        if dlo >= dx and dlo >= dhi: way = 'below'
        elif dhi >= dx: way = 'above'
        else: way = 'away' if (x > 0) == (r['stand'] == 'R') else 'in'
        band = '0-3' if dist < 3 else '3-6' if dist < 6 else '6-9' if dist < 9 else '9-12' if dist < 12 else '12+'
        two = r['strikes'] == '2'
        for key in ((k, band, way, 'all'), (k, band, way, 'two')) if two else ((k, band, way, 'all'),):
            t = T.setdefault(key, [0, 0, 0]); t[0] += 1
            if d in SW: t[1] += 1; t[2] += d.startswith('swinging')
print('LEAGUE: swing rate at pitches outside the zone by kind x distance x direction (n in brackets; whiff per swing after the slash)')
for k in ('FB', 'BR', 'OS'):
    for cnt in ('all', 'two'):
        print(' %s %-4s' % (k, cnt), end='')
        for band in ('0-3', '3-6', '6-9', '9-12', '12+'):
            print('  | %-4s' % band, end='')
            for way in ('below', 'away', 'in', 'above'):
                t = T.get((k, band, way, cnt), [0, 0, 0])
                print(' %s %.2f/%.2f(%d)' % (way[:2], t[1] / t[0] if t[0] else 0, t[2] / t[1] if t[1] else 0, t[0]), end='')
        print()
