"""
platoon.py · v0.1 · 2026-10-05

The league's platoon split, taken apart: same-side against opposite-side
(a right-handed batter against a right-handed pitcher is 'same'), right- and
left-handed batters separately, by component (the outcome line, the plate
discipline), by pitch type and by location, with the pitch mix and the aim by
platoon. Each split is given raw and controlled for who was batting and who
was pitching: within batter, within pitcher, and both at once (two-way fixed
effects on the plate appearances or the pitches, the dummy's coefficient
with its standard error). Run values are Statcast's delta_run_exp (the
batting side's), reported per 100 pitches. Locations are in the batter's
frame: `away` is feet from the middle of the plate, + away from him; `h` is
the share of his own zone (0 at sz_bot, 1 at sz_top). Switch hitters are left
out (they always bat opposite). Bunts and pitchouts are left out of the
pitch-level tables.

Reads statcast/raw/pitches/<year>/*.csv (fetch_pitches.py). Prints the
tables, writes statcast/platoon_<year>.json and statcast/platoon_<year>.js
(`var PLATOON = ...`, for headless/platoon_check.js to print beside the model).

  python3 statcast/platoon.py 2025-05-05:2025-09-21

CHANGED
  v0.1  first build (the platoon brief, docs/briefs/2026-10-05_platoon.md)
"""
import csv, datetime, json, math, os, sys, collections, warnings
import numpy as np
warnings.filterwarnings('ignore'); np.seterr(all='ignore')

HERE = os.path.dirname(os.path.abspath(__file__))
TYPE = {'FF': 'FF', 'SI': 'SI', 'FC': 'FC', 'SL': 'SL', 'ST': 'ST', 'CU': 'CU', 'KC': 'CU', 'SV': 'SL', 'CH': 'CH', 'FS': 'FS', 'FO': 'FS'}
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'CH': 'OS', 'FS': 'OS'}
TYPES = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS']
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
TAKE = {'ball', 'blocked_ball', 'called_strike'}
CONTACT = {'foul', 'foul_tip', 'hit_into_play'}
WHIFF = {'swinging_strike', 'swinging_strike_blocked'}
HALF = (8.5 + 1.45) / 12.0           # ft: half the zone's width, ball included (the engine's inZone)
BALL_R = 1.45 / 12.0
K_EV = {'strikeout', 'strikeout_double_play'}
COLS = ['pitch_type', 'game_date', 'game_type', 'batter', 'pitcher', 'stand', 'p_throws', 'description', 'des', 'events', 'balls', 'strikes',
        'plate_x', 'plate_z', 'sz_top', 'sz_bot', 'pfx_x', 'pfx_z', 'launch_speed', 'launch_angle', 'estimated_woba_using_speedangle',
        'woba_value', 'woba_denom', 'delta_run_exp', 'game_pk', 'at_bat_number', 'pitch_number', 'release_pos_z', 'arm_angle', 'release_speed', 'release_pos_x', 'release_extension', 'bat_speed', 'swing_length', 'attack_angle', 'attack_direction', 'swing_path_tilt', 'intercept_ball_minus_batter_pos_x_inches', 'intercept_ball_minus_batter_pos_y_inches', 'effective_speed']
EYE_X, EYE_Y = 1.8, 0.7                 # ft: the batter's eye from the plate's centre line toward him, and in front of the plate's point
PSI_EDGES = [-9, -4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 9]
AWAY_EDGES = [-9, -0.95, -0.28, 0.28, 0.95, 9]; AWAY_NAMES = ['in, off', 'in', 'middle', 'away', 'away, off']
H_EDGES = [-9, -0.12, 0.33, 0.67, 1.12, 9]; H_NAMES = ['below', 'low', 'mid', 'high', 'above']


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def load(spec):
    a, _, b = spec.partition(':')
    d0 = datetime.date.fromisoformat(a); d1 = datetime.date.fromisoformat(b or a)
    rows, d = [], d0
    while d <= d1:
        fn = os.path.join(HERE, 'raw', 'pitches', str(d.year), d.isoformat() + '.csv')
        if os.path.exists(fn):
            with open(fn, newline='', encoding='utf-8') as f:
                r = csv.reader(f); hdr = next(r, None)
                if hdr:
                    idx = {h.strip().strip('"'): i for i, h in enumerate(hdr)}
                    want = [(c, idx[c]) for c in COLS if c in idx]
                    for row in r:
                        if len(row) >= len(hdr):
                            rows.append({c: row[i] for c, i in want})
        d += datetime.timedelta(days=1)
    return rows


def band(v, edges):
    for i in range(len(edges) - 1):
        if edges[i] <= v < edges[i + 1]:
            return i
    return len(edges) - 2


def fe(y, X, groups, iters=300):
    """y on the columns of X with fixed effects for each group list (alternating demeaning); the slopes, their se, n"""
    y = np.asarray(y, float).copy(); X = np.asarray(X, float).copy()
    if X.ndim == 1:
        X = X[:, None]
    k = X.shape[1]
    if len(y) < 10:
        return [None] * k, [None] * k, len(y)
    codes = [np.unique(np.asarray(g), return_inverse=True)[1] for g in groups]
    counts = [np.bincount(c).astype(float) for c in codes]
    cols = [y] + [X[:, j] for j in range(k)]
    for v in cols:
        for _ in range(iters):
            mx = 0.0
            for c, n in zip(codes, counts):
                m = np.bincount(c, v) / n; v -= m[c]; mx = max(mx, float(np.abs(m).max()))
            if mx < 1e-10:
                break
    X = np.column_stack(cols[1:]); y = cols[0]
    XtX = X.T.dot(X)
    if np.linalg.matrix_rank(XtX) < k:
        return [None] * k, [None] * k, len(y)
    inv = np.linalg.inv(XtX); b = inv.dot(X.T.dot(y)); r = y - X.dot(b)
    dof = max(1, len(y) - (sum(len(n) for n in counts) - (len(counts) - 1)) - k)
    s2 = float((r * r).sum()) / dof
    se = np.sqrt(np.maximum(np.diag(inv) * s2, 0))
    return [float(v) for v in b], [float(v) for v in se], len(y)


def fmt(v, d=3, sign=False):
    if v is None:
        return '-'
    return ('%+.*f' if sign else '%.*f') % (d, v)


def split_line(recs, key, scale=1.0, d=3):
    """for each batter hand: raw same, raw opposite, their diff, and the diff within batter, within pitcher, and the
    two-way estimate; n. With batter and pitcher effects both in, the two hands' platoon dummies are collinear (one is
    the other plus terms the effects absorb), so a two-way regression identifies only the SUM of the two hands' splits:
    'both' is their average, the same number on both hands' lines. The one-way splits are per hand, but each carries the
    other pool's quality: within batter, the right-handed split takes +(RHP - LHP quality) and the left-handed -; within
    pitcher, +/-(RHB - LHB quality). Their sums are clean."""
    v = [r for r in recs if r.get(key) is not None]
    out = {}
    if len(v) < 10:
        return {'R': None, 'L': None}
    y = np.array([r[key] for r in v], float) * scale; s = np.array([r['same'] for r in v], float)
    hand = np.array([r['hand'] for r in v]); bat = np.array([r['bat'] for r in v]); pit = np.array([r['pit'] for r in v])
    X = np.column_stack([s * (hand == 'R'), s * (hand == 'L')])
    bp, bp_se, _ = fe(y, X, [pit]); bb, bb_se, _ = fe(y, s, [bat, pit])
    for j, hd in enumerate('RL'):
        m = hand == hd
        if m.sum() < 10:
            out[hd] = None; continue
        same = y[m & (s == 1)]; opp = y[m & (s == 0)]
        o = {'n': int(m.sum()), 'n_same': int(len(same)), 'same': float(same.mean()) if len(same) else None, 'opp': float(opp.mean()) if len(opp) else None}
        o['raw'] = o['same'] - o['opp'] if o['same'] is not None and o['opp'] is not None else None
        g, se, _ = fe(y[m], s[m], [bat[m]]); o['bat'] = g[0]; o['bat_se'] = se[0]
        o['pit'] = bp[j]; o['pit_se'] = bp_se[j]; o['both'] = bb[0]; o['both_se'] = bb_se[0]
        out[hd] = o
    return out


def row_of(lab, o, d=3):
    if o is None:
        return '| %s | - |' % lab
    return '| %s | %d | %s | %s | %s | %s | %s | %s (%s) |' % (lab, o['n'], fmt(o['same'], d), fmt(o['opp'], d), fmt(o['raw'], d, True),
                                                            fmt(o['bat'], d, True), fmt(o['pit'], d, True), fmt(o['both'], d, True), fmt(o['both_se'], d))


def table(head, rows):
    return ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + rows


HEAD = ('', 'n', 'same', 'opposite', 'raw', 'within batter', 'within pitcher', 'two-way, avg of both hands (se)')


def main(spec):
    rows = load(spec)
    # switch hitters: a batter seen batting from both sides
    sides = collections.defaultdict(set)
    for r in rows:
        if r.get('stand') in ('R', 'L'):
            sides[r['batter']].add(r['stand'])
    switch = {b for b, s in sides.items() if len(s) > 1}
    P, days = [], set()
    for r in rows:
        if (r.get('game_type') or 'R') != 'R' or r.get('stand') not in ('R', 'L') or r.get('p_throws') not in ('R', 'L') or r['batter'] in switch:
            continue
        d = r.get('description', '')
        if d == 'pitchout' or 'bunt' in d or (d == 'hit_into_play' and 'bunt' in (r.get('des') or '').lower()):
            continue
        x, z, bot, top = fl(r.get('plate_x')), fl(r.get('plate_z')), fl(r.get('sz_bot')), fl(r.get('sz_top'))
        b, s = fl(r.get('balls')), fl(r.get('strikes'))
        if None in (x, z, bot, top, b, s) or top <= bot or b > 3 or s > 2:
            continue
        R = r['stand'] == 'R'; sgn = 1 if R else -1
        t = TYPE.get(r.get('pitch_type'))
        swing, take = d in SWING, d in TAKE
        inz = abs(x) <= HALF and bot - BALL_R <= z <= top + BALL_R
        px, pz = fl(r.get('pfx_x')), fl(r.get('pfx_z'))
        ev = r.get('events') or ''
        p = {'bat': r['batter'], 'pit': r['pitcher'], 'hand': r['stand'], 'same': 1 if r['stand'] == r['p_throws'] else 0,
             'type': t, 'kind': KIND.get(t), 'count': '%d-%d' % (b, s), 'desc': d, 'events': ev,
             'away': x * sgn, 'h': (z - bot) / (top - bot), 'inz': inz, 'x': x, 'z': z,
             'pfx_away': px * sgn * 12 if px is not None else None, 'pfx_z': pz * 12 if pz is not None else None,
             'rel_z': fl(r.get('release_pos_z')), 'arm': fl(r.get('arm_angle')), 'mph': fl(r.get('release_speed')),
             'rel_x': fl(r.get('release_pos_x')), 'ext': fl(r.get('release_extension')),
             'swing': 1 if swing else (0 if take else None), 'rv': fl(r.get('delta_run_exp'))}
        # the release seen from the batter: how far to his own side of his line of sight it is (ft, + behind his front
        # shoulder), and the angle it makes with straight ahead (deg, + toward his side); his eye EYE_X ft from the
        # plate's centre line, EYE_Y ft in front of the plate's point; Statcast release_pos_x is + toward first base
        if p['rel_x'] is not None:
            toward = p['rel_x'] * (-1 if R else 1) - EYE_X
            p['rel_toward'] = toward; p['psi'] = math.degrees(math.atan2(toward, 60.5 - (p['ext'] if p['ext'] is not None else 6.3) - EYE_Y))
        else:
            p['rel_toward'] = p['psi'] = None
        p['chase'] = p['swing'] if (not inz and p['swing'] is not None) else None
        p['zswing'] = p['swing'] if (inz and p['swing'] is not None) else None
        p['whiff'] = (1 if d in WHIFF else 0) if swing else None
        p['zcontact'] = (1 if d in CONTACT else 0) if (swing and inz) else None
        p['called'] = (1 if d == 'called_strike' else 0) if take else None
        p['called_oz'] = p['called'] if (take and not inz) else None
        p['called_iz'] = p['called'] if (take and inz) else None
        bs = fl(r.get('bat_speed'))
        if swing and bs is not None and bs >= 50:
            p['bat'] = p['bat']; p['bs'] = bs; p['aa'] = fl(r.get('attack_angle')); p['tilt'] = fl(r.get('swing_path_tilt')); p['slen'] = fl(r.get('swing_length'))
            ad = fl(r.get('attack_direction')); p['adir'] = -ad if (ad is not None and R) else ad   # + toward his pull side
            if d in CONTACT:
                p['depth'] = fl(r.get('intercept_ball_minus_batter_pos_y_inches')); ix = fl(r.get('intercept_ball_minus_batter_pos_x_inches')); p['ix'] = ix
                ls, la, es = fl(r.get('launch_speed')), fl(r.get('launch_angle')), fl(r.get('effective_speed'))
                p['vm'] = la - p['aa'] if (la is not None and p['aa'] is not None) else None
                p['sq'] = (1 if ls / (1.23 * bs + 0.23 * es) >= 0.8 else 0) if (ls is not None and es) else None
                p['rel_ev'] = ls / (1.23 * bs + 0.23 * es) if (ls is not None and es) else None
                p['topped'] = (1 if p['vm'] < -5 else 0) if p['vm'] is not None else None
                p['under'] = (1 if p['vm'] > 25 else 0) if p['vm'] is not None else None
        if d == 'hit_into_play':
            p['xw'] = fl(r.get('estimated_woba_using_speedangle')); p['ev'] = fl(r.get('launch_speed')); p['la'] = fl(r.get('launch_angle'))
            p['hr'] = 1 if ev == 'home_run' else 0
            p['hit'] = 1 if ev in ('single', 'double', 'triple') else (0 if ev not in ('home_run', 'sac_fly', 'sac_fly_double_play') else None)
        else:
            p['xw'] = p['ev'] = p['la'] = p['hr'] = p['hit'] = None
        if ev:   # the plate appearance ends here
            den = fl(r.get('woba_denom')); val = fl(r.get('woba_value'))
            p['pa'] = {'bat': p['bat'], 'pit': p['pit'], 'hand': p['hand'], 'same': p['same'],
                       'woba': val if den == 1 else None, 'k': 1 if ev in K_EV else 0, 'bb': 1 if ev == 'walk' else 0, 'ibb': 1 if ev == 'intent_walk' else 0,
                       'hbp': 1 if ev == 'hit_by_pitch' else 0, 'hr': 1 if ev == 'home_run' else 0,
                       'bip': 1 if d == 'hit_into_play' and ev != 'home_run' else 0, 'hit': p['hit'] if d == 'hit_into_play' else None}
        P.append(p)
        days.add(r.get('game_date'))
    PA = [p['pa'] for p in P if 'pa' in p]
    J, md = {'pitches': len(P), 'pa': len(PA), 'switch_hitters': len(switch), 'dates': sorted(days)}, []
    md += ['Pitches %d, plate appearances %d (%d days); %d switch hitters left out. Same = the batter and the pitcher share a hand. Diffs are same minus opposite; '
           '"within batter" and "within pitcher" hold one of them fixed (each per hand, but carrying the other pool\'s quality with opposite signs on the two hands); '
           '"two-way" holds both and identifies only the two hands\' average (se in brackets). Run values are runs per 100 pitches, the batting side\'s.' % (len(P), len(PA), len(days), len(switch)), '']

    PAh = {h: [q for q in PA if q['hand'] == h] for h in 'RL'}; Ph = {h: [p for p in P if p['hand'] == h] for h in 'RL'}
    for h in 'RL':
        nL = sum(1 for p in Ph[h] if p['same'] == (1 if h == 'L' else 0))
        J[h] = {'pa': len(PAh[h]), 'pitches': len(Ph[h]), 'share_lhp': nL / len(Ph[h]), 'outcome': {}, 'discipline': {}, 'mix': {}, 'by_type': {}, 'loc': {}, 'aim': {}}
    # 1. the outcome line
    OUT = [('woba', 'wOBA', 1, 3), ('k', 'K per PA', 1, 3), ('bb', 'BB per PA', 1, 3), ('ibb', 'IBB per PA', 1, 3), ('hbp', 'HBP per PA', 1, 3), ('hr', 'HR per PA', 1, 3), ('bip', 'in play per PA', 1, 3), ('hit', 'BABIP', 1, 3)]
    for key, lab, sc, d in OUT:
        o = split_line(PA, key, sc, d)
        for h in 'RL':
            J[h]['outcome'][key] = o[h]
    OUTB = [('xw', 'xwOBA on contact', 1, 3), ('ev', 'exit speed (mph)', 1, 1), ('la', 'launch angle (deg)', 1, 1), ('hr', 'HR per ball in play', 1, 3)]
    for key, lab, sc, d in OUTB:
        o = split_line(P, key, sc, d)
        for h in 'RL':
            J[h]['outcome'][key + '_bip'] = o[h]
    # 2. plate discipline
    DISC = [('inz', 'in zone (per pitch)', 1, 3), ('swing', 'swing (per pitch)', 1, 3), ('zswing', 'zone swing', 1, 3), ('chase', 'chase (swing, out of zone)', 1, 3),
            ('zcontact', 'zone contact (per zone swing)', 1, 3), ('whiff', 'whiff (per swing)', 1, 3), ('called', 'called strike (per take)', 1, 3),
            ('called_oz', 'called strike, out of zone', 1, 3), ('called_iz', 'called strike, in zone', 1, 3), ('rv', 'run value per 100 pitches', 100, 2)]
    Pz = [dict(p, inz=1 if p['inz'] else 0) for p in P]
    for key, lab, sc, d in DISC:
        o = split_line(Pz if key == 'inz' else P, key, sc, d)
        for h in 'RL':
            J[h]['discipline'][key] = o[h]
    # 3. by pitch type: the mix, and each type's value and discipline
    for h in 'RL':
        same = [p for p in Ph[h] if p['same']]; opp = [p for p in Ph[h] if not p['same']]
        for t in TYPES:
            J[h]['mix'][t] = [sum(1 for p in same if p['type'] == t) / len(same), sum(1 for p in opp if p['type'] == t) / len(opp)]
        for k in ('FB', 'BR', 'OS'):
            J[h]['mix'][k] = [sum(1 for p in same if p['kind'] == k) / len(same), sum(1 for p in opp if p['kind'] == k) / len(opp)]
    BYT = [('rv', 'run value per 100 pitches', 100, 2), ('swing', 'swing', 1, 3), ('chase', 'chase', 1, 3), ('whiff', 'whiff per swing', 1, 3), ('zcontact', 'zone contact', 1, 3),
           ('called_oz', 'called strike, out of zone', 1, 3), ('xw', 'xwOBA on contact', 1, 3), ('ev', 'exit speed', 1, 1)]
    for key, lab, sc, d in BYT:
        for t in TYPES + ['FB', 'BR', 'OS']:
            v = [p for p in P if (p['kind'] if t in ('FB', 'BR', 'OS') else p['type']) == t]
            o = split_line(v, key, sc, d)
            for h in 'RL':
                J[h]['by_type'].setdefault(t, {})[key] = o[h]
    for h in 'RL':
        bt = J[h]['by_type']; mx = J[h]['mix']
        ok = [t for t in TYPES if bt[t]['rv'] and bt[t]['rv']['same'] is not None and bt[t]['rv']['opp'] is not None]
        mixT = sum((mx[t][0] - mx[t][1]) * (bt[t]['rv']['same'] + bt[t]['rv']['opp']) / 2 for t in ok)
        withinT = sum((mx[t][0] + mx[t][1]) / 2 * (bt[t]['rv']['same'] - bt[t]['rv']['opp']) for t in ok)
        withinB = sum((mx[t][0] + mx[t][1]) / 2 * (bt[t]['rv']['both'] or 0) for t in ok)
        J[h]['decomp'] = {'mix': mixT, 'within': withinT, 'within_both': withinB, 'total': J[h]['discipline']['rv']['raw']}
    # 4. by location, the batter's frame
    for lab, key, edges, names in (('across (away +)', 'away', AWAY_EDGES, AWAY_NAMES), ('height (share of his zone)', 'h', H_EDGES, H_NAMES)):
        for i, nm in enumerate(names):
            v = [p for p in P if band(p[key], edges) == i]
            o_sw = split_line(v, 'swing'); o_wh = split_line(v, 'whiff'); o_rv = split_line(v, 'rv', 100, 2); o_xw = split_line(v, 'xw')
            for h in 'RL':
                same = [p for p in Ph[h] if p['same']]; opp = [p for p in Ph[h] if not p['same']]
                ss = sum(1 for p in v if p['hand'] == h and p['same']) / len(same); so = sum(1 for p in v if p['hand'] == h and not p['same']) / len(opp)
                J[h]['loc'][key + ':' + nm] = {'share': [ss, so], 'swing': o_sw[h], 'whiff': o_wh[h], 'rv': o_rv[h], 'xw': o_xw[h]}
    # 5. the aim and the movement by type and platoon
    for h in 'RL':
        for t in TYPES:
            for sd in (1, 0):
                v = [p for p in Ph[h] if p['type'] == t and p['same'] == sd]
                if len(v) < 50:
                    continue
                pa_ = [p['pfx_away'] for p in v if p['pfx_away'] is not None]; pz_ = [p['pfx_z'] for p in v if p['pfx_z'] is not None]
                J[h]['aim'].setdefault(t, {})['same' if sd else 'opp'] = {'n': len(v), 'away_in': float(np.mean([p['away'] for p in v])) * 12, 'h': float(np.mean([p['h'] for p in v])),
                                                                         'zone': float(np.mean([1 if p['inz'] else 0 for p in v])), 'pfx_away': float(np.mean(pa_)), 'pfx_z': float(np.mean(pz_))}
    # print, hand by hand
    for h in 'RL':
        md += ['## %s-handed batters: %d plate appearances, %d pitches, %.3f of them from left-handers' % ('Right' if h == 'R' else 'Left', J[h]['pa'], J[h]['pitches'], J[h]['share_lhp']), '']
        rows1 = [row_of(lab, J[h]['outcome'][key], d) for key, lab, sc, d in OUT] + [row_of(lab, J[h]['outcome'][key + '_bip'], d) for key, lab, sc, d in OUTB]
        md += ['### 1. The outcome line', ''] + table(HEAD, rows1) + ['']
        md += ['### 2. Plate discipline', ''] + table(HEAD, [row_of(lab, J[h]['discipline'][key], d) for key, lab, sc, d in DISC]) + ['']
        mx = J[h]['mix']
        md += ['### 3a. The pitch mix: share of pitches by type', ''] + table(('type', 'same', 'opposite', 'diff'), ['| %s | %.3f | %.3f | %+.3f |' % (t, mx[t][0], mx[t][1], mx[t][0] - mx[t][1]) for t in TYPES + ['FB', 'BR', 'OS']]) + ['']
        for key, lab, sc, d in BYT:
            md += ['### 3b. By pitch type: %s' % lab, ''] + table(HEAD, [row_of(t, J[h]['by_type'][t][key], d) for t in TYPES + ['FB', 'BR', 'OS']]) + ['']
        dc = J[h]['decomp']
        md += ['### 3c. Where the run-value split comes from (runs per 100 pitches, the eight types)', '',
               'Total raw split %+.2f = the mix (which types he sees) %+.2f + the within-type value (how each type plays against him) %+.2f; the within-type part with batter and pitcher held fixed %+.2f.' % (dc['total'], dc['mix'], dc['within'], dc['within_both']), '']
        for lab, key, edges, names in (('across (away +)', 'away', AWAY_EDGES, AWAY_NAMES), ('height (share of his zone)', 'h', H_EDGES, H_NAMES)):
            rows = []
            for nm in names:
                L = J[h]['loc'][key + ':' + nm]; o_sw, o_wh, o_rv, o_xw = L['swing'], L['whiff'], L['rv'], L['xw']
                rows.append('| %s | %.3f / %.3f | %s / %s | %s / %s | %s / %s | %s / %s (%s) |' % (nm, L['share'][0], L['share'][1], fmt(o_sw['same']), fmt(o_sw['opp']), fmt(o_wh['same']), fmt(o_wh['opp']),
                                                                                           fmt(o_xw['same']) if o_xw else '-', fmt(o_xw['opp']) if o_xw else '-', fmt(o_rv['same'], 2), fmt(o_rv['opp'], 2), fmt(o_rv['both'], 2, True)))
            md += ['### 4. By location, %s: same / opposite' % lab, ''] + table(('band', 'share of pitches', 'swing', 'whiff', 'xwOBA on contact', 'run value (within both)'), rows) + ['']
        rows5 = []
        for t in TYPES:
            cells = []
            for sd in ('same', 'opp'):
                a = J[h]['aim'].get(t, {}).get(sd)
                cells += ['-'] * 5 if not a else [str(a['n']), '%+.1f' % a['away_in'], '%.2f' % a['h'], '%.3f' % a['zone'], '%+.1f / %+.1f' % (a['pfx_away'], a['pfx_z'])]
            rows5.append('| %s | %s |' % (t, ' | '.join(cells)))
        md += ['### 5. Where each type goes and how it moves, in the batter\'s frame (away +, inches; height as a share of his zone; movement away / up, inches)', ''] + table(
            ('type', 'n same', 'away', 'height', 'in zone', 'movement', 'n opp', 'away', 'height', 'in zone', 'movement'), rows5) + ['']
    # 7. the platoon effect against the release angle psi: band dummies with batter and pitcher effects (reference: the widest
    #    opposite-side band), for whiff, chase, zone swing, zone contact, xwOBA on contact, exit speed and run value; and a
    #    linear fit, y ~ psi, beside the binary y ~ same
    J['psi'] = {'edges': PSI_EDGES, 'eye': [EYE_X, EYE_Y]}
    Pp = [p for p in P if p['psi'] is not None]
    hist = collections.Counter(band(p['psi'], PSI_EDGES) for p in Pp)
    same_psi = [p['psi'] for p in Pp if p['same']]; opp_psi = [p['psi'] for p in Pp if not p['same']]
    J['psi']['mean'] = float(np.mean([p['psi'] for p in Pp])); J['psi']['mean_same'] = float(np.mean(same_psi)); J['psi']['mean_opp'] = float(np.mean(opp_psi))
    J['psi']['sd_same'] = float(np.std(same_psi)); J['psi']['sd_opp'] = float(np.std(opp_psi))
    md += ['## 7. The platoon effect against the release angle (deg, + toward the batter\'s own side; eye %.1f ft from the centre line, %.1f ft in front of the plate\'s point)' % (EYE_X, EYE_Y), '',
           'Same-side releases sit at %+.2f deg (sd %.2f), opposite-side at %+.2f deg (sd %.2f); all pitches %+.2f. Share of pitches by band: %s.' % (
               J['psi']['mean_same'], J['psi']['sd_same'], J['psi']['mean_opp'], J['psi']['sd_opp'], J['psi']['mean'],
               ', '.join('%g..%g %.3f' % (PSI_EDGES[i], PSI_EDGES[i + 1], hist[i] / len(Pp)) for i in range(len(PSI_EDGES) - 1))), '']
    for psi0 in (-3.0, -2.5, -2.0, -1.5, -1.0, -0.5):
        J['psi']['ramp_mean_%g' % psi0] = float(np.mean([max(0.0, p['psi'] - psi0) for p in Pp]))
    for psi0 in (-3.0,):
        J['psi']['ramp_same_%g' % psi0] = float(np.mean([max(0.0, p['psi'] - psi0) for p in Pp if p['same']])); J['psi']['ramp_opp_%g' % psi0] = float(np.mean([max(0.0, p['psi'] - psi0) for p in Pp if not p['same']]))
    md += ['The ramp from -3 deg averages %.3f over same-side pitches and %.3f over opposite-side ones (a difference of %.3f deg).' % (J['psi']['ramp_same_-3'], J['psi']['ramp_opp_-3'], J['psi']['ramp_same_-3'] - J['psi']['ramp_opp_-3']), '']
    md += ['Mean of the ramp max(0, psi - psi0) over all pitches: ' + ', '.join('psi0 %g: %.3f' % (psi0, J['psi']['ramp_mean_%g' % psi0]) for psi0 in (-3.0, -2.5, -2.0, -1.5, -1.0, -0.5)) + ' deg.', '']
    ref = 1   # the reference band: -4.5..-3.5, the usual opposite-side release
    for ctl in (False, True):
        rows7 = []; J['psi']['bands' + ('_type' if ctl else '')] = {}; J['psi']['linear' + ('_type' if ctl else '')] = {}
        for key, lab, sc, d in (('whiff', 'whiff per swing', 1, 3), ('chase', 'chase', 1, 3), ('zswing', 'zone swing', 1, 3), ('zcontact', 'zone contact', 1, 3), ('xw', 'xwOBA on contact', 1, 3), ('ev', 'exit speed', 1, 1), ('rv', 'run value per 100', 100, 2), ('bs', 'bat speed', 1, 2), ('vm', 'launch minus attack', 1, 2), ('topped', 'topped', 1, 3), ('sq', 'squared up', 1, 3)):
            v = [p for p in Pp if p.get(key) is not None and (not ctl or p['type'] is not None)]
            y = np.array([p[key] for p in v], float) * sc; bands = np.array([band(p['psi'], PSI_EDGES) for p in v]); psi = np.array([p['psi'] for p in v]); same = np.array([p['same'] for p in v], float)
            bat = [p['bat'] for p in v]; pit = [p['pit'] for p in v]
            cols = [b for b in range(len(PSI_EDGES) - 1) if b != ref and (bands == b).sum() >= 200]
            Xb = [(bands == b).astype(float) for b in cols]
            Xt = [np.array([1.0 if p['type'] == t else 0.0 for p in v]) for t in TYPES[1:]] if ctl else []   # pitch-type dummies, four-seam the reference
            bb, se, n = fe(y, np.column_stack(Xb + Xt), [bat, pit])
            J['psi']['bands' + ('_type' if ctl else '')][key] = {str(b): [bb[i], se[i]] for i, b in enumerate(cols)}
            lin, lse, _ = fe(y, np.column_stack([psi] + Xt), [bat, pit]); bin_, bse, _ = fe(y, np.column_stack([same] + Xt), [bat, pit])
            J['psi']['linear' + ('_type' if ctl else '')][key] = {'per_deg': lin[0], 'se': lse[0], 'same': bin_[0], 'same_se': bse[0]}
            cells = []
            for b in range(len(PSI_EDGES) - 1):
                cells.append('0 (ref)' if b == ref else ('%s (%s)' % (fmt(bb[cols.index(b)], d, True), fmt(se[cols.index(b)], d)) if b in cols else '-'))
            rows7.append('| %s | %s | %s (%s) | %s (%s) |' % (lab, ' | '.join(cells), fmt(lin[0], d + 1, True), fmt(lse[0], d + 1), fmt(bin_[0], d, True), fmt(bse[0], d)))
        md += ['### 7%s. %s' % ('b' if ctl else 'a', 'With pitch-type dummies beside the fixed effects (the within-type effect of the release angle)' if ctl else 'Band dummies with batter and pitcher effects'), ''] + table(['', ] + ['%g..%g' % (PSI_EDGES[i], PSI_EDGES[i + 1]) for i in range(len(PSI_EDGES) - 1)] + ['per deg (se)', 'same (se)'], rows7) + ['',
               'Bands up to -1.5 deg are opposite-side releases, from -1.5 deg same-side (a release level with his eye is 0; a sidearmer\'s is further toward his side). Each cell is the two-way estimate against the reference band.', '']
    # 8. the swing by platoon (bat tracking: full swings of 50+ mph): the split in bat speed, attack angle, tilt, swing length,
    #    the bat's direction; and on contact the depth, the vertical miss (launch minus attack), squared-up, EV over its max,
    #    topped (miss < -5) and under (miss > 25): raw, within batter, within pitcher, two-way; then two-way with pitch-type dummies
    SW = [('bs', 'bat speed (mph)', 1, 2), ('aa', 'attack angle (deg)', 1, 2), ('tilt', 'swing path tilt (deg)', 1, 2), ('slen', 'swing length (ft)', 1, 3), ('adir', 'bat direction (deg, + pull)', 1, 2),
          ('depth', 'contact depth (in, + out front)', 1, 2), ('ix', 'contact x (in, Statcast sign)', 1, 2), ('vm', 'launch minus attack (deg)', 1, 2), ('sq', 'squared up (share of contact)', 1, 3), ('rel_ev', 'EV over its max', 1, 3), ('topped', 'topped (miss < -5 deg)', 1, 3), ('under', 'under (miss > 25 deg)', 1, 3)]
    J['swing'] = {}
    rows8 = {h: [] for h in 'RL'}; rows8t = []
    for key, lab, sc, d in SW:
        o = split_line(P, key, sc, d)
        for h in 'RL':
            J['swing'].setdefault(h, {})[key] = o[h]; rows8[h].append(row_of(lab, o[h], d))
        v = [p for p in P if p.get(key) is not None and p['type'] is not None]
        y = np.array([p[key] for p in v], float) * sc; same = np.array([p['same'] for p in v], float)
        Xt = [np.array([1.0 if p['type'] == t else 0.0 for p in v]) for t in TYPES[1:]]
        bb, se, n = fe(y, np.column_stack([same] + Xt), [[p['bat'] for p in v], [p['pit'] for p in v]])
        J['swing'].setdefault('type_controlled', {})[key] = [bb[0], se[0], n]
        rows8t.append('| %s | %d | %s (%s) |' % (lab, n, fmt(bb[0], d, True), fmt(se[0], d)))
    for h in 'RL':
        md += ['## 8. The swing by platoon, %s-handed batters (bat tracking, full swings of 50+ mph)' % ('right' if h == 'R' else 'left'), ''] + table(HEAD, rows8[h]) + ['']
    md += ['### 8b. The swing by platoon, two-way with pitch-type dummies (both hands\' average)', ''] + table(('', 'n', 'same minus opposite (se)'), rows8t) + ['']
    # 6. the whole league: K% against release height and BB% against arm angle, per pitcher (for the model's check after the build)
    per = collections.defaultdict(lambda: {'pa': 0, 'k': 0, 'bb': 0, 'rz': [], 'arm': []})
    for p in P:
        if 'pa' in p:
            q = per[p['pit']]; q['pa'] += 1; q['k'] += p['pa']['k']; q['bb'] += p['pa']['bb']
        if p['rel_z'] is not None:
            per[p['pit']]['rz'].append(p['rel_z'])
        if p['arm'] is not None:
            per[p['pit']]['arm'].append(p['arm'])
    ok = [q for q in per.values() if q['pa'] >= 100 and q['rz'] and q['arm']]
    kr = np.array([q['k'] / q['pa'] for q in ok]); br = np.array([q['bb'] / q['pa'] for q in ok]); rz = np.array([np.mean(q['rz']) for q in ok]); ar = np.array([np.mean(q['arm']) for q in ok])
    J['pitchers'] = {'n': len(ok), 'r_k_relz': float(np.corrcoef(kr, rz)[0, 1]), 'r_bb_arm': float(np.corrcoef(br, ar)[0, 1]), 'r_k_arm': float(np.corrcoef(kr, ar)[0, 1]), 'r_relz_arm': float(np.corrcoef(rz, ar)[0, 1])}
    md += ['## 6. Pitchers with 100+ batters faced (%d): K rate ~ release height r %+.2f, BB rate ~ arm angle r %+.2f, K rate ~ arm angle r %+.2f, release height ~ arm angle r %+.2f' % (
        len(ok), J['pitchers']['r_k_relz'], J['pitchers']['r_bb_arm'], J['pitchers']['r_k_arm'], J['pitchers']['r_relz_arm']), '']
    year = J['dates'][0][:4] if J['dates'] else '2025'
    with open(os.path.join(HERE, 'platoon_%s.json' % year), 'w') as f:
        json.dump(J, f, indent=1)
    with open(os.path.join(HERE, 'platoon_%s.js' % year), 'w') as f:
        f.write('// written by statcast/platoon.py from pitch-level %s; load before headless/platoon_check.js to print the league beside the model\nvar PLATOON = %s;\n' % (year, json.dumps(J)))
    print('\n'.join(md))
    print('wrote statcast/platoon_%s.json and .js (%d pitches, %d PA, %d days)' % (year, len(P), len(PA), len(J['dates'])))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
