"""
swing_geometry.py · v0.3 · 2026-10-04

Measures, from pitch-level Statcast, the swing geometry and contact relations
the engine's swing (bb_engine v0.9) is built on: how contact depth moves the
bat's attack angle, speed and the ball's spray; how the swing's tilt depends
on pitch height; how much of the spread in contact depth is between batters;
squared-up contact and exit speed against the vertical miss (launch angle
minus attack angle), against contact depth, and against pitch location; and
the spray of fair balls by depth. Every table is printed with its n.

Reads statcast/raw/pitches/<year>/<dates>.csv, pulled by fetch_pitches.py:
  python3 statcast/fetch_pitches.py --dates 2025-07-01:2025-07-07
  python3 statcast/swing_geometry.py 2025-07-01:2025-07-07

Squared up is Statcast's rule: launch_speed >= 0.8 x (1.23 x bat_speed +
0.23 x effective_speed). Spray is from the hit coordinates (hc_x, hc_y) with
+ = pulled for either hand. "Away" is plate_x signed so that + is the far side
of the plate from the batter.

CHANGED
  v0.3  home plate in the hit coordinates fitted from fly-ball distances (126.0, 205.0; was 125.42, 198.27)
  v0.2  table 7: bat speed by pitch kind at a contact depth, and by count (bb_engine v1.1's adjusted swing)
  v0.1  first build (the measurements behind bb_engine v0.9)
"""
import csv, glob, math, os, statistics as st, sys, datetime

# Home plate in Statcast's hit coordinates (hc_x, hc_y): fitted 2026-10-04 from 2025 balls in the air,
# their projected distance against the hit coordinates (caught flies, with and without a catch offset,
# and home runs: x0 125.97-126.03, y0 203.1-207.3, 2.36-2.41 ft per unit). The usual (125.42, 198.27)
# sits about 7 units too shallow and inflated the spray of short balls - ground balls most.
HC_X0, HC_Y0 = 126.0, 205.0

HERE = os.path.dirname(os.path.abspath(__file__))
CONTACT = ('foul', 'hit_into_play', 'foul_tip')
SWING = CONTACT + ('swinging_strike', 'swinging_strike_blocked')


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def load(spec):
    a, _, b = spec.partition(':')
    d0 = datetime.date.fromisoformat(a); d1 = datetime.date.fromisoformat(b or a)
    rows = []
    d = d0
    while d <= d1:
        fn = os.path.join(HERE, 'raw', 'pitches', str(d.year), d.isoformat() + '.csv')
        if os.path.exists(fn):
            with open(fn, newline='') as f:
                r = csv.reader(f); hdr = next(r, None)
                if hdr:
                    idx = {h.strip().strip('"'): i for i, h in enumerate(hdr)}
                    for row in r:
                        if len(row) >= len(hdr):
                            rows.append({k: row[i] for k, i in idx.items()})
        d += datetime.timedelta(days=1)
    return rows


def reg(xs, ys):
    mx, my = st.mean(xs), st.mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs); syy = sum((y - my) ** 2 for y in ys); sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / sxx, sxy / math.sqrt(sxx * syy)


def main(spec):
    rows = load(spec)
    print('pitches %d (%s)' % (len(rows), spec))
    c = []
    for r in rows:
        if r['description'] not in SWING:
            continue
        g = {k: fl(r.get(k)) for k in ('bat_speed', 'attack_angle', 'attack_direction', 'swing_path_tilt', 'intercept_ball_minus_batter_pos_y_inches',
                                       'intercept_ball_minus_batter_pos_x_inches', 'launch_speed', 'launch_angle', 'effective_speed', 'plate_x', 'plate_z',
                                       'sz_top', 'sz_bot', 'hc_x', 'hc_y', 'strikes')}
        g['contact'] = r['description'] in CONTACT
        pt = r.get('pitch_type')
        g['kind'] = 'FB' if pt in ('FF', 'SI', 'FC') else 'BR' if pt in ('SL', 'CU', 'ST', 'KC', 'SV') else 'OS' if pt in ('CH', 'FS', 'FO') else None
        g['count'] = (r.get('balls') or '') + '-' + (r.get('strikes') or '')
        g['foul'] = r['description'] != 'hit_into_play'
        g['batter'] = r.get('batter')
        R = r['stand'] == 'R'
        g['away'] = (g['plate_x'] if R else -g['plate_x']) if g['plate_x'] is not None else None
        if g['hc_x'] is not None and g['hc_y'] is not None:
            a = math.degrees(math.atan2(g['hc_x'] - HC_X0, HC_Y0 - g['hc_y'])); g['pull'] = -a if R else a
        else:
            g['pull'] = None
        if g['launch_speed'] is not None and g['bat_speed'] and g['effective_speed']:
            g['rel'] = g['launch_speed'] / (1.23 * g['bat_speed'] + 0.23 * g['effective_speed']); g['sq'] = g['rel'] >= 0.8
        else:
            g['rel'] = None; g['sq'] = None
        g['miss'] = g['launch_angle'] - g['attack_angle'] if (g['launch_angle'] is not None and g['attack_angle'] is not None) else None
        if g['plate_z'] is not None and g['sz_top'] and g['sz_bot'] and g['sz_top'] > g['sz_bot']:
            g['h'] = (g['plate_z'] - g['sz_bot']) / (g['sz_top'] - g['sz_bot'])
        else:
            g['h'] = None
        c.append(g)
    con = [q for q in c if q['contact'] and q['intercept_ball_minus_batter_pos_y_inches'] is not None]
    Y = 'intercept_ball_minus_batter_pos_y_inches'
    ys = [q[Y] for q in con]
    print('\n1. CONTACT DEPTH (in in front of the batter): contacts %d, mean %.1f, sd %.1f' % (len(con), st.mean(ys), st.stdev(ys)))
    for k, lab in (('attack_angle', 'attack angle (deg)'), ('bat_speed', 'bat speed (mph)'), ('attack_direction', 'attack direction (deg, sign as recorded)'), ('swing_path_tilt', 'swing path tilt (deg)')):
        v = [(q[Y], q[k]) for q in con if q[k] is not None]
        b, rr = reg([p[0] for p in v], [p[1] for p in v])
        print('   %-42s mean %6.2f sd %5.2f | per inch of depth %+.3f (r %.2f), n %d' % (lab, st.mean(p[1] for p in v), st.stdev(p[1] for p in v), b, rr, len(v)))
    print('   full swings (60+ mph) by depth: n, bat speed, attack angle, vertical miss mean, its sd')
    for lo, hi in ((-20, 10), (10, 20), (20, 25), (25, 30), (30, 35), (35, 40), (40, 50), (50, 90)):
        s = [q for q in con if lo <= q[Y] < hi and q['bat_speed'] and q['bat_speed'] >= 60]
        m = [q['miss'] for q in s if q['miss'] is not None]
        if s:
            print('     %3d..%-3d  %5d  %5.1f  %+6.1f  %+6.1f  %5.1f' % (lo, hi, len(s), st.mean(q['bat_speed'] for q in s), st.mean(q['attack_angle'] for q in s if q['attack_angle'] is not None), st.mean(m) if m else float('nan'), st.stdev(m) if len(m) > 1 else float('nan')))
    by = {}
    for q in con:
        by.setdefault(q['batter'], []).append(q[Y])
    ok = [v for v in by.values() if len(v) >= 25]
    within = math.sqrt(st.mean([st.pvariance(v) for v in ok])); nbar = st.mean(len(v) for v in ok)
    between = math.sqrt(max(0, st.pvariance([st.mean(v) for v in ok]) - within ** 2 / nbar))
    print('   batters with 25+ contacts: %d; within-batter sd %.1f in; between-batter sd of usual depth %.1f in' % (len(ok), within, between))
    v = [(q['away'], q[Y]) for q in con if q['away'] is not None]
    b, rr = reg([p[0] for p in v], [p[1] for p in v])
    print('   depth against pitch location: %+.2f in per ft away (r %.2f)' % (b, rr))

    print('\n2. SWING TILT AGAINST PITCH HEIGHT (all swings with a tilt)')
    t = [q for q in c if q['swing_path_tilt'] is not None and q['h'] is not None]
    b, rr = reg([q['h'] for q in t], [q['swing_path_tilt'] for q in t])
    print('   swings %d: mean %.1f sd %.1f; per unit of zone height %+.1f deg (r %.2f)' % (len(t), st.mean(q['swing_path_tilt'] for q in t), st.stdev(q['swing_path_tilt'] for q in t), b, rr))
    for lo, hi in ((-9, -0.25), (-0.25, 0.15), (0.15, 0.5), (0.5, 0.85), (0.85, 1.25), (1.25, 9)):
        s = [q['swing_path_tilt'] for q in t if lo <= q['h'] < hi]
        if s:
            print('     height %5.2f..%-5.2f n %5d  tilt %.1f' % (lo, hi, len(s), st.mean(s)))

    print('\n3. BAT SPEED BY STRIKES (full swings, 60+ mph)')
    for s_ in (0, 1, 2):
        v = [q['bat_speed'] for q in c if q['strikes'] == s_ and q['bat_speed'] and q['bat_speed'] >= 60]
        print('   %d strikes: n %5d  mean %.1f' % (s_, len(v), st.mean(v)))

    tr = [q for q in c if q['contact'] and q['rel'] is not None and q['miss'] is not None]
    print('\n4. SQUARED UP AND EXIT SPEED AGAINST THE VERTICAL MISS (launch angle minus attack angle): tracked contacts %d, miss mean %.1f sd %.1f' % (len(tr), st.mean(q['miss'] for q in tr), st.stdev(q['miss'] for q in tr)))
    print('     band       n   share  squared  EV/max   foul')
    for lo, hi in ((-90, -60), (-60, -40), (-40, -25), (-25, -15), (-15, -5), (-5, 5), (5, 15), (15, 25), (25, 40), (40, 60), (60, 90)):
        s = [q for q in tr if lo <= q['miss'] < hi]
        if s:
            print('     %4d..%-4d %5d  %.3f   %.3f   %.3f   %.3f' % (lo, hi, len(s), len(s) / len(tr), sum(q['sq'] for q in s) / len(s), st.mean(q['rel'] for q in s), sum(q['foul'] for q in s) / len(s)))

    core = [q for q in tr if abs(q['miss'] - 10) < 15 and q['away'] is not None]
    print('\n5. CONTACT STRUCK SQUARE VERTICALLY (miss within 15 deg of +10), BY PITCH LOCATION: n %d' % len(core))
    for lo, hi in ((-9, -1.0), (-1.0, -0.5), (-0.5, 0), (0, 0.5), (0.5, 1.0), (1.0, 9)):
        s = [q for q in core if lo <= q['away'] < hi]
        if s:
            print('     away %5.1f..%-5.1f ft  n %4d  EV/max %.3f  squared %.3f' % (lo, hi, len(s), st.mean(q['rel'] for q in s), sum(q['sq'] for q in s) / len(s)))

    fair = [q for q in c if not q['foul'] and q['contact'] and q['pull'] is not None and abs(q['pull']) <= 45]
    print('\n6. SPRAY OF FAIR BALLS (+ = pulled): n %d, mean %+.1f, sd %.1f' % (len(fair), st.mean(q['pull'] for q in fair), st.stdev(q['pull'] for q in fair)))
    for lo, hi in ((-20, 22), (22, 28), (28, 34), (34, 40), (40, 90)):
        s = [q['pull'] for q in fair if q[Y] is not None and lo <= q[Y] < hi]
        if s:
            print('     depth %3d..%-3d n %4d  spray %+5.1f  sd %4.1f' % (lo, hi, len(s), st.mean(s), st.stdev(s)))
    bip = [q for q in c if not q['foul'] and q['contact'] and q['pull'] is not None and q[Y] is not None]
    b, rr = reg([q[Y] for q in bip], [q['pull'] for q in bip])
    print('   all balls in play (caught fouls included): spray per inch of depth %+.2f (r %.2f)' % (b, rr))
    v = [(q['away'], q['pull']) for q in bip if q['away'] is not None]
    b, rr = reg([p[0] for p in v], [p[1] for p in v])
    print('   spray against pitch location: %+.1f deg per ft away (r %.2f)' % (b, rr))

    print('\n7. BAT SPEED BY PITCH KIND AT A CONTACT DEPTH (contact swings), AND BY COUNT (all swings)')
    for lo, hi in ((10, 20), (20, 25), (25, 30), (30, 35), (35, 40), (40, 50)):
        cells = []
        for k in ('FB', 'BR', 'OS'):
            v = [q['bat_speed'] for q in con if q['kind'] == k and q['bat_speed'] and lo <= q[Y] < hi]
            cells.append('%s %.1f (n %d)' % (k, st.mean(v), len(v)) if v else '%s -' % k)
        print('     depth %3d..%-3d  %s' % (lo, hi, '   '.join(cells)))
    groups = (('ahead', ('1-0', '2-0', '3-0', '2-1', '3-1')), ('even or behind', ('0-0', '0-1', '1-1')), ('two strikes', ('0-2', '1-2', '2-2', '3-2')))
    for nm, cs in groups:
        cells = []
        for k in ('FB', 'BR', 'OS'):
            v = [q['bat_speed'] for q in c if q['kind'] == k and q['bat_speed'] and q['count'] in cs]
            cells.append('%s %.1f (n %d)' % (k, st.mean(v), len(v)) if v else '%s -' % k)
        print('     %-15s %s' % (nm, '   '.join(cells)))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-07-01:2025-07-07')
