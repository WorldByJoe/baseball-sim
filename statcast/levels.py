"""
levels.py · v0.1 · 2026-10-03

The league line one level at a time, from the same pitch-level files, so the
majors and Triple-A are measured exactly alike - the targets for the engine's
LEVELS (bb_engine v2.0: the pro pool's k-th best of six plays at level k).
Triple-A is the out-of-sample test: nothing in the engine is fitted to it.

Per level: plate-appearance outcomes (K%, BB%, HBP%, HR%, AVG/OBP/SLG, BABIP;
intentional walks left out, as the engine has none), swings (whiff per swing,
zone rate, swing rates in and out of the zone, contact in the zone; bunts and
pitchouts left out; the zone is the engine's: the plate's 17 in plus a ball's
radius, the batter's sz_bot up to sz_bot + the majors' mean zone height, widened
by a ball's radius - one zone for both levels, because Triple-A records the
automated system's zone, whose top is lower), batted balls
pooled (mean exit velocity, hard-hit 95+, the hardest half's mean, batted-ball
types), and the players: four-seam speed per pitcher (20+ four-seamers; a
starter is anyone who threw his team's first pitch of a game in the sample),
arm angle per pitcher (20+ pitches), batter and pitcher ages, and bat speed
per hitter where it was tracked (100+ swings).

Triple-A caveats: the automated ball-strike challenge system is in use and its
zone tops out lower (53.5% of the batter's height: Triple-A's recorded sz_top
averaged 2.7 in below the majors' in 2025, sz_bot the same), so more takes are
balls; the Pacific Coast League's parks (several at altitude) carry the ball
farther, so HR% is also given for the International League alone.

Writes statcast/levels_<year>.json and levels_<year>.js (`var LEVELS = ...`).

  python3 statcast/levels.py 2025

CHANGED
  v0.1  first build (the majors and Triple-A, 2025)
"""
import csv, glob, json, math, os, statistics as st, sys

HERE = os.path.dirname(os.path.abspath(__file__))
IN_FT = 12.0
HALF = (8.5 + 1.45) / IN_FT
BALL_R = 1.45 / IN_FT
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
WHIFF = {'swinging_strike', 'swinging_strike_blocked'}
TAKE = {'ball', 'blocked_ball', 'called_strike'}
HITS = {'single': 1, 'double': 2, 'triple': 3, 'home_run': 4}
PCL = {'ABQ', 'ELP', 'LV', 'OKC', 'RNO', 'RR', 'SAC', 'SL', 'SUG', 'TAC'}
DIRS = {'MLB': 'pitches', 'AAA': 'pitches_aaa'}


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def in_zone(x, z, bot, span):
    return abs(x) <= HALF and bot - BALL_R <= z <= bot + span + BALL_R


def load(level, year):
    rows = []
    for fn in sorted(glob.glob(os.path.join(HERE, 'raw', DIRS[level], str(year), '*.csv'))):
        with open(fn, newline='', encoding='utf-8') as f:
            rows.extend(csv.DictReader(f))
    return rows


def msd(v):
    return [st.mean(v), st.pstdev(v)] if len(v) > 1 else [None, None]


def measure(rows, level, span):
    out = {'level': level, 'pitches': len(rows), 'days': len({r['game_date'] for r in rows}), 'games': len({r['game_pk'] for r in rows})}
    # ---- plate appearances
    pa = {'all': {}, 'IL': {}}
    def add(d, k, n=1): d[k] = d.get(k, 0) + n
    for r in rows:
        ev = r['events']
        if not ev or ev in ('intent_walk', 'truncated_pa'):
            continue
        for key in ('all',) + (('IL',) if r['home_team'] not in PCL else ()):
            d = pa[key]; add(d, 'pa')
            if ev in ('strikeout', 'strikeout_double_play'): add(d, 'k')
            elif ev == 'walk': add(d, 'bb')
            elif ev == 'hit_by_pitch': add(d, 'hbp')
            elif ev in ('sac_fly', 'sac_fly_double_play'): add(d, 'sf')
            elif ev in ('sac_bunt', 'sac_bunt_double_play'): add(d, 'sh')
            elif ev == 'catcher_interf': add(d, 'ci')
            if ev in HITS:
                add(d, 'h'); add(d, 'tb', HITS[ev]); add(d, ev)
    def line(d):
        g = lambda k: d.get(k, 0)
        ab = g('pa') - g('bb') - g('hbp') - g('sf') - g('sh') - g('ci')
        return {'pa': g('pa'), 'k': g('k') / g('pa'), 'bb': g('bb') / g('pa'), 'hbp': g('hbp') / g('pa'), 'hr': g('home_run') / g('pa'),
                'd2': g('double') / g('pa'), 'd3': g('triple') / g('pa'),
                'avg': g('h') / ab, 'obp': (g('h') + g('bb') + g('hbp')) / (ab + g('bb') + g('hbp') + g('sf')), 'slg': g('tb') / ab,
                'babip': (g('h') - g('home_run')) / (ab - g('k') - g('home_run') + g('sf'))}
    out['pa'] = line(pa['all']); out['pa_IL'] = line(pa['IL'])
    # ---- swings and the zone
    n = zn = sw = wh = zsw = osw = zcon = 0; on = 0
    for r in rows:
        d = r['description']
        if d not in SWING and d not in TAKE: continue
        if 'bunt' in (r.get('des') or '').lower() and d == 'hit_into_play': continue
        x, z, bot = fl(r['plate_x']), fl(r['plate_z']), fl(r['sz_bot'])
        if None in (x, z, bot): continue
        iz = in_zone(x, z, bot, span); s = d in SWING
        n += 1; zn += iz; sw += s; wh += d in WHIFF
        if iz: zsw += s; zcon += s and d not in WHIFF
        else: on += 1; osw += s
    tops = [fl(r['sz_top']) for r in rows if fl(r['sz_top'])]; bots = [fl(r['sz_bot']) for r in rows if fl(r['sz_bot'])]
    out['sz'] = {'top': st.mean(tops), 'bot': st.mean(bots), 'span_used': span}
    out['swing'] = {'pitches': n, 'zone': zn / n, 'swing': sw / n, 'whiff_per_swing': wh / sw, 'z_swing': zsw / zn, 'chase': osw / on, 'z_contact': zcon / zsw}
    # ---- batted balls, pooled
    E = []; T = {}
    for r in rows:
        if r['description'] != 'hit_into_play' or 'bunt' in (r.get('des') or '').lower(): continue
        ls = fl(r['launch_speed'])
        if ls is not None: E.append(ls)
        if r['bb_type']: T[r['bb_type']] = T.get(r['bb_type'], 0) + 1
    E.sort(reverse=True); nt = sum(T.values())
    out['bbe'] = {'n': len(E), 'ev': st.mean(E), 'hard95': sum(e >= 95 for e in E) / len(E), 'top_half': st.mean(E[:len(E) // 2]),
                  'p90': E[len(E) // 10], 'types': {k: v / nt for k, v in sorted(T.items())}}
    # ---- the players
    first = {}
    for r in rows:
        key = (r['game_pk'], r['inning_topbot']); o = (int(r['at_bat_number']), int(r['pitch_number']))
        if key not in first or o < first[key][0]: first[key] = (o, r['pitcher'])
    starters = {p for _, p in first.values()}
    ff = {}; arm = {}; ext = {}
    for r in rows:
        p = r['pitcher']
        a = fl(r.get('arm_angle'))
        if a is not None: arm.setdefault(p, []).append(a)
        if r['pitch_type'] == 'FF':
            v = fl(r['release_speed']); e = fl(r['release_extension'])
            if v: ff.setdefault(p, []).append(v)
            if e: ext.setdefault(p, []).append(e)
    sp = [st.mean(v) for p, v in ff.items() if len(v) >= 20 and p in starters]
    rp = [st.mean(v) for p, v in ff.items() if len(v) >= 20 and p not in starters]
    am = [st.mean(v) for v in arm.values() if len(v) >= 20]
    out['pitchers'] = {'ff_sp': msd(sp) + [len(sp)], 'ff_rp': msd(rp) + [len(rp)], 'arm_angle': msd(am) + [len(am)],
                       'ext': msd([st.mean(v) for v in ext.values() if len(v) >= 20])}
    # ages: one per player, weighted by his plate appearances / pitches
    def ages(idk, agek, w):
        A = {}
        for r in rows:
            a = fl(r.get(agek))
            if a is None or not w(r): continue
            A.setdefault(r[idk], [a, 0])[1] += 1
        tot = sum(c for _, c in A.values())
        m = sum(a * c for a, c in A.values()) / tot
        return [m, math.sqrt(sum(c * (a - m) ** 2 for a, c in A.values()) / tot), len(A)]
    out['age_bat'] = ages('batter', 'age_bat', lambda r: bool(r['events']))
    out['age_pit'] = ages('pitcher', 'age_pit', lambda r: True)
    # bat speed per hitter where tracked
    bs = {}
    for r in rows:
        b = fl(r.get('bat_speed'))
        if b is not None and b > 0: bs.setdefault(r['batter'], []).append(b)
    bm = [st.mean(v) for v in bs.values() if len(v) >= 100]
    out['bat_speed'] = msd(bm) + [len(bm)] if bm else None
    return out


def show(o):
    p, s, b, q = o['pa'], o['swing'], o['bbe'], o['pitchers']
    print('%s: %d days, %d games, %d pitches, %d PA' % (o['level'], o['days'], o['games'], o['pitches'], p['pa']))
    print('  K%% %.1f  BB%% %.1f  HBP%% %.2f  HR%% %.2f (IL %.2f)  2B%% %.2f  3B%% %.2f   %.3f/%.3f/%.3f  BABIP %.3f' % (
        100 * p['k'], 100 * p['bb'], 100 * p['hbp'], 100 * p['hr'], 100 * o['pa_IL']['hr'], 100 * p['d2'], 100 * p['d3'], p['avg'], p['obp'], p['slg'], p['babip']))
    print('  recorded zone %.3f-%.3f ft (measured on sz_bot + %.3f)' % (o['sz']['bot'], o['sz']['top'], o['sz']['span_used']))
    print('  zone %.3f  swing %.3f  z-swing %.3f  chase %.3f  whiff/swing %.3f  z-contact %.3f' % (s['zone'], s['swing'], s['z_swing'], s['chase'], s['whiff_per_swing'], s['z_contact']))
    print('  batted balls %d: EV %.1f  hard-hit %.3f  hardest half %.1f  90th pct %.1f  types %s' % (b['n'], b['ev'], b['hard95'], b['top_half'], b['p90'], ' '.join('%s %.3f' % kv for kv in b['types'].items())))
    print('  four-seam SP %.2f ± %.2f (n %d)  RP %.2f ± %.2f (n %d)  arm angle %.1f ± %.1f (n %d)  extension %.2f' % (
        q['ff_sp'][0], q['ff_sp'][1], q['ff_sp'][2], q['ff_rp'][0], q['ff_rp'][1], q['ff_rp'][2], q['arm_angle'][0], q['arm_angle'][1], q['arm_angle'][2], q['ext'][0]))
    print('  age: batters %.1f ± %.1f (n %d), pitchers %.1f ± %.1f (n %d)' % tuple(o['age_bat'] + o['age_pit']))
    if o['bat_speed']: print('  bat speed per hitter (100+ swings) %.2f ± %.2f (n %d)' % tuple(o['bat_speed']))


def main(year):
    res = {}; span = None
    for lv in ('MLB', 'AAA'):
        rows = load(lv, year)
        if not rows: print(lv, 'no files'); continue
        if span is None:   # the majors' mean zone height, used for both levels
            span = st.mean([fl(r['sz_top']) - fl(r['sz_bot']) for r in rows if fl(r['sz_top']) and fl(r['sz_bot'])])
        res[lv] = measure(rows, lv, span); show(res[lv])
    base = os.path.join(HERE, 'levels_%s' % year)
    json.dump(res, open(base + '.json', 'w'), indent=1)
    with open(base + '.js', 'w') as f:
        f.write('// written by statcast/levels.py from pitch-level %s (the majors and Triple-A measured alike); load before headless/level_check.js\n' % year)
        f.write('var LEVELS = ' + json.dumps(res) + ';\n')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025')
