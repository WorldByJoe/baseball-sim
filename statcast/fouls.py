"""
fouls.py · v0.3 · 2026-10-02

Measures what a foul ball is, from the pitch-level CSVs that
statcast/fetch_pitches.py caches in statcast/raw/pitches/<year>/: how often a
swing goes foul, how hard fouls are hit, how often they are squared up, and
how that depends on pitch kind, count, zone and the contact point. Prints the
tables, writes statcast/fouls_<year>.json, and rewrites the tables block of
the "What a foul is" section in STATCAST_TARGETS_<year>.md (the prose above
the block is left alone).

Definitions (the brief, 2026-10-01):
  swing     swinging_strike(_blocked), any foul, hit_into_play
  contact   fouls + hit_into_play
  squared   launch_speed >= 0.80 * (1.23 * bat_speed + 0.23 * pitch speed),
            pitch speed = effective_speed where present, else release_speed

Tables 9-11 (the perception brief, 2026-10-02) are by pitch height in the
batter's own zone, (plate_z - sz_bot) / (sz_top - sz_bot), bunts excluded:
  9   all swings by height
  10  pitch kind at the same height
  11  four-seamers by vertical approach angle (VAA, at the front of the plate,
      from vy0, vz0, ay, az) for their height, in fifths of the residual from
      a straight-line fit of VAA on height within the group; and the same
      within bands of release height and extension, to see how much of the
      flat-fastball effect is the release rather than the pitch.

Run:  python3 statcast/fouls.py 2025 [--dates 2025-05-05:2025-05-18,...]

CHANGED
  v0.3  tables 9-11: height, kind at a height, and the flat-fastball effect with a release control
  v0.2  first real pull: the x intercept is the ball's reach from the batter (27-45 in), banded so; squared-up
        with untracked contact counted as not squared (a floor) and per swing
  v0.1  first build
"""
import sys, os, csv, json, math, glob, datetime

WHIFF = {'swinging_strike', 'swinging_strike_blocked'}
FOUL = {'foul', 'foul_tip', 'foul_bunt', 'bunt_foul_tip', 'foul_pitchout'}
BIP = {'hit_into_play'}
KIND = {**{p: 'fastball' for p in ('FF', 'SI', 'FC')},
        **{p: 'breaking' for p in ('SL', 'CU', 'ST', 'KC', 'SV')},
        **{p: 'offspeed' for p in ('CH', 'FS', 'FO')}}
KINDS = ('fastball', 'breaking', 'offspeed')
BAT_FIELDS = ('bat_speed', 'swing_length', 'attack_angle', 'attack_direction', 'swing_path_tilt',
              'intercept_ball_minus_batter_pos_x_inches', 'intercept_ball_minus_batter_pos_y_inches')
WANTED = ('description', 'events', 'bb_type', 'launch_speed', 'launch_angle', 'release_speed',
          'effective_speed', 'pitch_type', 'pitch_name', 'plate_x', 'plate_z', 'zone', 'stand',
          'p_throws', 'balls', 'strikes', 'hc_x', 'hc_y', 'sz_top', 'sz_bot', 'vy0', 'vz0', 'ay', 'az',
          'release_pos_z', 'release_extension') + BAT_FIELDS
BUNTS = {'foul_bunt', 'missed_bunt', 'bunt_foul_tip'}
BEGIN, END = '<!-- fouls.py tables: begin -->', '<!-- fouls.py tables: end -->'
SECTION = '## What a foul is (pitch level, {year}, {ndays} days)'

def num(v):
    try:
        v = str(v).strip()
        return float(v) if v not in ('', 'NA', 'null', 'None', '--') else None
    except ValueError:
        return None

# ---------------------------------------------------------------- loading
def load(year, dates):
    files = sorted(glob.glob(os.path.join('statcast', 'raw', 'pitches', str(year), '*.csv')))
    if dates:
        keep = {d.isoformat() for d in dates}
        files = [f for f in files if os.path.basename(f)[:10] in keep]
    rows, used, header = [], [], set()
    for p in files:
        with open(p, encoding='utf-8-sig') as f:
            rd = csv.DictReader(f)
            header |= set(rd.fieldnames or [])
            n0 = len(rows)
            for r in rd:
                g = (r.get('game_type') or 'R').strip()
                if g and g != 'R': continue
                rows.append(r)
            if len(rows) > n0: used.append(os.path.basename(p)[:10])
    return rows, used, header

def classify(r):
    d = (r.get('description') or '').strip()
    if d in WHIFF: return 'whiff'
    if d in FOUL: return 'foul'
    if d in BIP: return 'bip'
    return None

def enrich(r):
    """Numeric fields, swing class, pitch kind, zone side, squared-up (or None)."""
    x = {k: num(r.get(k)) for k in WANTED if k not in ('description', 'events', 'bb_type', 'pitch_type',
                                                     'pitch_name', 'stand', 'p_throws')}
    x['cls'] = classify(r)
    x['desc'] = (r.get('description') or '').strip()
    x['kind'] = KIND.get((r.get('pitch_type') or '').strip(), 'other')
    z = x['zone']
    x['inzone'] = None if z is None else (1 <= z <= 9)
    ps = x['effective_speed'] if x['effective_speed'] else x['release_speed']
    x['speed_src'] = 'effective' if x['effective_speed'] else ('release' if x['release_speed'] else None)
    ls, bs = x['launch_speed'], x['bat_speed']
    x['sq'] = None if (ls is None or bs is None or ps is None) else (ls >= 0.80 * (1.23 * bs + 0.23 * ps))
    rs = x['release_speed']
    x['sq_release'] = None if (ls is None or bs is None or rs is None) else (ls >= 0.80 * (1.23 * bs + 0.23 * rs))
    x['bunt'] = x['desc'] in BUNTS or 'bunt' in (r.get('des') or '').lower()
    x['pt'] = (r.get('pitch_type') or '').strip()
    top, bot, pz = x['sz_top'], x['sz_bot'], x['plate_z']
    x['h'] = (pz - bot) / (top - bot) if None not in (top, bot, pz) and top > bot else None
    vy0, vz0, ay, az = x['vy0'], x['vz0'], x['ay'], x['az']
    x['vaa'] = None
    if None not in (vy0, vz0, ay, az) and ay != 0:
        q = vy0 * vy0 - 2 * ay * (50 - 17 / 12)
        if q > 0:
            vyf = -math.sqrt(q); t = (vyf - vy0) / ay; vzf = vz0 + az * t
            x['vaa'] = -math.degrees(math.atan(vzf / vyf))   # negative = descending
    return x

# ---------------------------------------------------------------- statistics
def rate(xs):
    xs = [v for v in xs if v is not None]
    return (sum(1 for v in xs if v) / len(xs) if xs else None), len(xs)

def pct(sorted_v, q):
    if not sorted_v: return None
    i = q * (len(sorted_v) - 1); lo = int(math.floor(i)); hi = min(lo + 1, len(sorted_v) - 1)
    return sorted_v[lo] + (sorted_v[hi] - sorted_v[lo]) * (i - lo)

def dist(vals, cuts=()):
    v = sorted(a for a in vals if a is not None)
    n = len(v)
    if n == 0: return {'n': 0}
    m = sum(v) / n
    sd = math.sqrt(sum((a - m) ** 2 for a in v) / (n - 1)) if n > 1 else 0.0
    out = {'n': n, 'mean': m, 'sd': sd}
    for q in (10, 25, 50, 75, 90): out['p%d' % q] = pct(v, q / 100)
    for c in cuts: out['under_%d' % c] = sum(1 for a in v if a < c) / n
    return out

def f3(v): return '' if v is None else ('%.3f' % v)
def f1(v): return '' if v is None else ('%.1f' % v)

def table(head, rows):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return out

def band(v, edges):
    """edges [a,b,c] -> '<a', 'a..b', 'b..c', '>c'."""
    if v is None: return None
    if v < edges[0]: return '<%g' % edges[0]
    for a, b in zip(edges, edges[1:]):
        if v < b: return '%g..%g' % (a, b)
    return '>%g' % edges[-1]

def band_names(edges):
    return ['<%g' % edges[0]] + ['%g..%g' % (a, b) for a, b in zip(edges, edges[1:])] + ['>%g' % edges[-1]]

# ---------------------------------------------------------------- the measurement
def measure(P, header):
    S = [p for p in P if p['cls']]
    C = [p for p in S if p['cls'] in ('foul', 'bip')]
    F = [p for p in S if p['cls'] == 'foul']
    B = [p for p in S if p['cls'] == 'bip']
    J, md = {}, []

    absent = [c for c in WANTED if c not in header]
    J['columns_absent'] = absent
    md += ['Columns absent from the CSV: ' + (', '.join(absent) if absent else 'none') + '.', '']
    descs = {}
    for p in P: descs[p['desc']] = descs.get(p['desc'], 0) + 1
    J['descriptions'] = descs
    md += ['Pitches %d; swings %d (whiff %d, foul %d, in play %d). Foul kinds: %s.' % (
        len(P), len(S), len(S) - len(C), len(F), len(B),
        ', '.join('%s %d' % (k, descs.get(k, 0)) for k in sorted(FOUL) if descs.get(k))), '']
    src = {}
    for p in C:
        if p['sq'] is not None: src[p['speed_src']] = src.get(p['speed_src'], 0) + 1
    J['squared_up_pitch_speed_source'] = src
    md += ['Squared-up used effective_speed for %d tracked contacts and release_speed for %d.' % (
        src.get('effective', 0), src.get('release', 0)), '']

    # 1. shares per swing
    def shares(sub):
        n = len(sub); w = sum(p['cls'] == 'whiff' for p in sub); f = sum(p['cls'] == 'foul' for p in sub)
        b = n - w - f
        return {'swings': n, 'whiff': w / n if n else None, 'foul': f / n if n else None,
                'bip': b / n if n else None, 'foul_of_contact': f / (f + b) if f + b else None}
    J['shares'] = {'all': shares(S)}
    rows = [('all', *[f3(J['shares']['all'][k]) for k in ('whiff', 'foul', 'bip', 'foul_of_contact')], len(S))]
    for k in KINDS:
        J['shares'][k] = shares([p for p in S if p['kind'] == k])
        rows.append((k, *[f3(J['shares'][k][c]) for c in ('whiff', 'foul', 'bip', 'foul_of_contact')], J['shares'][k]['swings']))
    for s in (0, 1, 2):
        key = '%d_strikes' % s
        J['shares'][key] = shares([p for p in S if p['strikes'] == s])
        rows.append((key.replace('_', ' '), *[f3(J['shares'][key][c]) for c in ('whiff', 'foul', 'bip', 'foul_of_contact')], J['shares'][key]['swings']))
    md += ['### 1. What a swing becomes', ''] + table(
        ('swings', 'whiff', 'foul', 'in play', 'foul / contact', 'n swings'), rows) + ['']

    # 2. missingness
    def tracked(sub, f): return rate([p[f] is not None for p in sub])
    J['missingness'] = {}
    rows = []
    for name, sub in (('fouls', F), ('fouls excl. foul_tip', [p for p in F if p['desc'] != 'foul_tip']),
                      ('foul tips', [p for p in F if p['desc'] == 'foul_tip']), ('in play', B), ('whiffs', [p for p in S if p['cls'] == 'whiff'])):
        r_ls, n = tracked(sub, 'launch_speed'); r_la, _ = tracked(sub, 'launch_angle')
        r_bs, _ = tracked(sub, 'bat_speed'); r_both, _ = rate([p['sq'] is not None for p in sub])
        J['missingness'][name] = {'n': n, 'launch_speed': r_ls, 'launch_angle': r_la, 'bat_speed': r_bs, 'both': r_both}
        rows.append((name, n, f3(r_ls), f3(r_la), f3(r_bs), f3(r_both)))
    md += ['### 2. How much is tracked', ''] + table(
        ('', 'n', 'has launch_speed', 'has launch_angle', 'has bat_speed', 'has both (squared-up computable)'), rows) + ['']
    # do tracked fouls look like untracked ones?
    T = [p for p in F if p['launch_speed'] is not None]; U = [p for p in F if p['launch_speed'] is None]
    def profile(sub):
        n = len(sub)
        if not n: return {'n': 0}
        return {'n': n, **{'%d_strikes' % s: sum(p['strikes'] == s for p in sub) / n for s in (0, 1, 2)},
                **{k: sum(p['kind'] == k for p in sub) / n for k in KINDS},
                'in_zone': rate([p['inzone'] for p in sub])[0],
                'plate_z_mean': dist([p['plate_z'] for p in sub]).get('mean'),
                'abs_plate_x_mean': dist([abs(p['plate_x']) if p['plate_x'] is not None else None for p in sub]).get('mean'),
                'foul_tip': sum(p['desc'] == 'foul_tip' for p in sub) / n,
                'bat_speed_mean': dist([p['bat_speed'] for p in sub]).get('mean')}
    J['foul_tracked_vs_not'] = {'tracked': profile(T), 'untracked': profile(U)}
    keys = ('0_strikes', '1_strikes', '2_strikes', 'fastball', 'breaking', 'offspeed', 'in_zone', 'foul_tip')
    rows = [(nm, J['foul_tracked_vs_not'][k]['n'], *[f3(J['foul_tracked_vs_not'][k].get(c)) for c in keys],
             f3(J['foul_tracked_vs_not'][k].get('plate_z_mean')), f3(J['foul_tracked_vs_not'][k].get('abs_plate_x_mean')),
             f1(J['foul_tracked_vs_not'][k].get('bat_speed_mean')))
            for nm, k in (('fouls with launch_speed', 'tracked'), ('fouls without', 'untracked'))]
    md += ['Fouls with and without a launch_speed, by what can be seen of them (shares of each group):', ''] + table(
        ('', 'n', '0 str', '1 str', '2 str', 'fastball', 'breaking', 'off-speed', 'in zone', 'foul tip',
         'plate_z mean (ft)', '|plate_x| mean (ft)', 'bat speed mean'), rows) + ['']

    # 3. squared-up
    J['squared_up'] = {}
    rows = []
    for k in ('all',) + KINDS:
        sub = C if k == 'all' else [p for p in C if p['kind'] == k]
        rc, nc = rate([p['sq'] for p in sub]); rb, nb = rate([p['sq'] for p in sub if p['cls'] == 'bip'])
        rf, nf = rate([p['sq'] for p in sub if p['cls'] == 'foul'])
        rr, _ = rate([p['sq_release'] for p in sub])
        J['squared_up'][k] = {'per_contact': rc, 'n_contact': nc, 'per_bip': rb, 'n_bip': nb, 'per_foul': rf,
                              'n_foul': nf, 'per_contact_release_speed': rr}
        rows.append((k, f3(rc), nc, f3(rb), nb, f3(rf), nf, f3(rr)))
    md += ['### 3. Squared up (tracked contact only)', ''] + table(
        ('', 'per contact', 'n', 'per ball in play', 'n', 'per foul', 'n', 'per contact, release_speed'), rows) + ['']
    # a floor: contact with a bat speed but no launch speed (foul tips, untracked fouls) counted as not squared
    J['squared_up_floor'] = {}
    rows = []
    for nm, sub in (('contact', C), ('ball in play', B), ('foul', F), ('swing', S)):
        sub = [p for p in sub if p['bat_speed'] is not None]
        n = len(sub); k = sum(1 for p in sub if p['sq'])
        J['squared_up_floor'][nm] = {'n': n, 'rate': k / n if n else None}
        rows.append((nm, f3(k / n if n else None), n))
    md += ['The same with every swing that has a bat speed but no launch speed counted as not squared up (a floor):', ''] + table(
        ('per', 'squared up', 'n with bat_speed'), rows) + ['']

    # 4. launch speed and angle, fouls vs in play
    J['launch_speed'] = {'fouls': dist([p['launch_speed'] for p in F], (60, 70, 80, 90)),
                         'in_play': dist([p['launch_speed'] for p in B], (60, 70, 80, 90))}
    J['launch_angle'] = {'fouls': dist([p['launch_angle'] for p in F]), 'in_play': dist([p['launch_angle'] for p in B])}
    rows = [(nm, d['n'], f1(d.get('mean')), f1(d.get('sd')), *[f1(d.get('p%d' % q)) for q in (10, 25, 50, 75, 90)],
             *[f3(d.get('under_%d' % c)) for c in (60, 70, 80, 90)])
            for nm, d in (('fouls', J['launch_speed']['fouls']), ('in play', J['launch_speed']['in_play']))]
    md += ['### 4. How hard (launch_speed, mph)', ''] + table(
        ('', 'n', 'mean', 'sd', 'p10', 'p25', 'p50', 'p75', 'p90', '<60', '<70', '<80', '<90'), rows) + ['']
    rows = [(nm, d['n'], f1(d.get('mean')), f1(d.get('sd')), *[f1(d.get('p%d' % q)) for q in (10, 25, 50, 75, 90)])
            for nm, d in (('fouls', J['launch_angle']['fouls']), ('in play', J['launch_angle']['in_play']))]
    md += ['Launch angle (deg):', ''] + table(('', 'n', 'mean', 'sd', 'p10', 'p25', 'p50', 'p75', 'p90'), rows) + ['']

    # 5. direction of fouls
    r_hc, n_hc = rate([p['hc_x'] is not None and p['hc_y'] is not None for p in F])
    J['foul_direction'] = {'n_fouls': n_hc, 'share_with_hc': r_hc}
    md += ['### 5. Where fouls go', '',
           'Fouls carrying hit coordinates (hc_x, hc_y): %s of %d. %s' % (
               f3(r_hc), n_hc, 'Too few to say anything about direction; stopped here.' if (r_hc or 0) < 0.2 else
               'See fouls_<year>.json for the coordinates summary.'), '']
    if (r_hc or 0) >= 0.2:
        J['foul_direction']['hc_x'] = dist([p['hc_x'] for p in F]); J['foul_direction']['hc_y'] = dist([p['hc_y'] for p in F])

    # 6. EV by launch-angle band, balls in play
    edges = [-30, -10, 10, 30, 50]
    J['ev_by_la_bip'] = {}
    for nm in band_names(edges):
        J['ev_by_la_bip'][nm] = dist([p['launch_speed'] for p in B if band(p['launch_angle'], edges) == nm])
    md += ['### 6. Exit velocity by launch angle, balls in play', ''] + table(
        ('launch angle', 'n', 'mean EV', 'sd'), [(nm, d['n'], f1(d.get('mean')), f1(d.get('sd'))) for nm, d in J['ev_by_la_bip'].items()]) + ['']
    J['ev_by_la_foul'] = {nm: dist([p['launch_speed'] for p in F if band(p['launch_angle'], edges) == nm]) for nm in band_names(edges)}
    md += ['The same for fouls that carry a launch angle:', ''] + table(
        ('launch angle', 'n', 'mean EV', 'sd'), [(nm, d['n'], f1(d.get('mean')), f1(d.get('sd'))) for nm, d in J['ev_by_la_foul'].items()]) + ['']

    # 7. whiff by kind and zone; squared-up by zone
    J['by_zone'] = {}
    rows = []
    for k in ('all',) + KINDS:
        for zn, zv in (('in zone', True), ('out of zone', False)):
            sub = [p for p in S if (k == 'all' or p['kind'] == k) and p['inzone'] is zv]
            wr, nw = rate([p['cls'] == 'whiff' for p in sub])
            cc = [p for p in sub if p['cls'] != 'whiff']
            fr, _ = rate([p['cls'] == 'foul' for p in cc])
            sr, ns = rate([p['sq'] for p in cc])
            J['by_zone']['%s/%s' % (k, zn)] = {'swings': nw, 'whiff_per_swing': wr, 'foul_of_contact': fr,
                                               'squared_per_contact': sr, 'n_tracked_contact': ns}
            rows.append((k, zn, nw, f3(wr), f3(fr), f3(sr), ns))
    md += ['### 7. By pitch kind and zone', ''] + table(
        ('kind', 'zone', 'swings', 'whiff / swing', 'foul / contact', 'squared / contact', 'n tracked contact'), rows) + ['']

    # 8. the contact point and the swing's plane
    J['bat_tracking'] = {}
    present = [f for f in ('intercept_ball_minus_batter_pos_y_inches', 'intercept_ball_minus_batter_pos_x_inches',
                           'attack_angle', 'swing_path_tilt') if f in header]
    md += ['### 8. Contact point and swing plane (tracked contact)', '']
    if not present:
        md += ['The bat-tracking contact-point fields were absent; nothing measured.', '']
    BANDS = {'intercept_ball_minus_batter_pos_y_inches': [0, 10, 20, 30, 40, 50],
             'intercept_ball_minus_batter_pos_x_inches': [25, 30, 35, 40, 45],
             'attack_angle': [0, 5, 10, 15, 20],
             'swing_path_tilt': [20, 25, 30, 35, 40]}
    for fld in present:
        edges = BANDS[fld]
        d0 = dist([p[fld] for p in C])
        J['bat_tracking'][fld] = {'all_contact': d0, 'bands': {}}
        rows = []
        for nm in band_names(edges):
            sub = [p for p in C if band(p[fld], edges) == nm]
            fr, n = rate([p['cls'] == 'foul' for p in sub]); sr, ns = rate([p['sq'] for p in sub])
            ev = dist([p['launch_speed'] for p in sub])
            evf = dist([p['launch_speed'] for p in sub if p['cls'] == 'foul'])
            J['bat_tracking'][fld]['bands'][nm] = {'n': n, 'foul_of_contact': fr, 'squared_per_contact': sr,
                                                   'n_sq': ns, 'ev': ev, 'ev_fouls': evf}
            rows.append((nm, n, f3(fr), f3(sr), ns, f1(ev.get('mean')), ev['n'], f1(evf.get('mean')), evf['n']))
        md += ['`%s` over contact: n %d, mean %s, sd %s, p10/p50/p90 %s / %s / %s.' % (
            fld, d0['n'], f1(d0.get('mean')), f1(d0.get('sd')), f1(d0.get('p10')), f1(d0.get('p50')), f1(d0.get('p90'))), '']
        md += table(('band', 'n contact', 'foul / contact', 'squared / contact', 'n', 'mean EV', 'n',
                       'mean EV, fouls', 'n'), rows) + ['']
    j2, md2 = height_tables(S)
    J.update(j2)
    return J, md + md2

# ---------------------------------------------------------------- height and approach (tables 9-11)
HBANDS = (('below the zone (<-0.25)', -99, -0.25), ('low edge (-0.25..0.15)', -0.25, 0.15), ('lower zone (0.15..0.5)', 0.15, 0.5),
          ('upper zone (0.5..0.85)', 0.5, 0.85), ('high edge (0.85..1.25)', 0.85, 1.25), ('above the zone (>1.25)', 1.25, 99))

def mean(v):
    v = [a for a in v if a is not None]
    return sum(v) / len(v) if v else None

def group(sub):
    """swings, whiff/swing, foul/contact, squared/contact (n), BIP LA, BIP GB and PU shares, BIP EV, foul LA"""
    con = [p for p in sub if p['cls'] != 'whiff']; bip = [p for p in con if p['cls'] == 'bip']; fo = [p for p in con if p['cls'] == 'foul']
    la = [p['launch_angle'] for p in bip if p['launch_angle'] is not None]
    sq, nsq = rate([p['sq'] for p in con])
    return {'swings': len(sub), 'whiff': rate([p['cls'] == 'whiff' for p in sub])[0], 'foul_of_contact': rate([p['cls'] == 'foul' for p in con])[0],
            'squared': sq, 'n_squared': nsq, 'bip_la': mean(la), 'gb': (sum(a < 10 for a in la) / len(la)) if la else None,
            'pu': (sum(a > 50 for a in la) / len(la)) if la else None, 'bip_ev': mean([p['launch_speed'] for p in bip]),
            'foul_la': mean([p['launch_angle'] for p in fo])}

def fit(xs, ys):
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx if sxx else 0
    return my - b * mx, b

def fifths(sub):
    """residual of VAA on height within sub; returns (mean VAA, slope, [(mean residual, group) x5], residuals)"""
    a, b = fit([p['h'] for p in sub], [p['vaa'] for p in sub])
    res = sorted(((p['vaa'] - (a + b * p['h'])), i) for i, p in enumerate(sub))
    n = len(res); out = []
    for k in range(5):
        part = res[k * n // 5:(k + 1) * n // 5]
        out.append((sum(r for r, _ in part) / len(part), [sub[i] for _, i in part]))
    return mean([p['vaa'] for p in sub]), b, out

def tercile_edges(v):
    v = sorted(v); return v[len(v) // 3], v[2 * len(v) // 3]

def height_tables(S):
    J, md = {}, []
    H = [p for p in S if not p['bunt'] and p['h'] is not None]
    md += ['### 9. By pitch height (0 = bottom of the batter\'s zone, 1 = top; bunts excluded): swings %d' % len(H), '']
    J['by_height'] = {}
    rows = []
    for nm, lo, hi in HBANDS:
        g = group([p for p in H if lo <= p['h'] < hi]); J['by_height'][nm] = g
        rows.append((nm, g['swings'], f3(g['whiff']), f3(g['foul_of_contact']), '%s (%d)' % (f3(g['squared']), g['n_squared']), f1(g['bip_la']),
                     '%s / %s' % (f3(g['gb']), f3(g['pu'])), f1(g['bip_ev']), f1(g['foul_la'])))
    md += table(('height', 'swings', 'whiff / swing', 'foul / contact', 'squared / contact (n)', 'BIP launch angle', 'BIP GB (<10) / PU (>50)',
                 'BIP EV', 'foul launch angle'), rows) + ['']
    J['kind_at_height'] = {}
    rows = []
    for nm, lo, hi in HBANDS[1:5]:
        for k in KINDS:
            g = group([p for p in H if lo <= p['h'] < hi and p['kind'] == k]); J['kind_at_height']['%s/%s' % (nm, k)] = g
            rows.append((nm, k, g['swings'], f3(g['whiff']), f3(g['foul_of_contact']), f1(g['bip_la']), f1(g['foul_la'])))
    md += ['### 10. Pitch kind at the same height', ''] + table(('height', 'kind', 'swings', 'whiff / swing', 'foul / contact', 'BIP launch angle',
                                                                 'foul launch angle'), rows) + ['']
    def ctable(title, sub, key):
        sub = [p for p in sub if p['vaa'] is not None]
        m, b, q = fifths(sub)
        J[key] = {'swings': len(sub), 'vaa_mean': m, 'vaa_per_height': b, 'fifths': []}
        rows = []
        for i, (r, g0) in enumerate(q):
            g = group(g0); g['residual'] = r; J[key]['fifths'].append(g)
            rows.append((('steepest', '2', '3', '4', 'flattest')[i], '%+.2f' % r, g['swings'], f3(g['whiff']), f3(g['foul_of_contact']),
                         '%s (%d)' % (f3(g['squared']), g['n_squared']), f1(g['bip_la']), f1(g['foul_la'])))
        return ['%s (swings %d; VAA mean %.2f deg, %+.2f deg per zone height), in fifths of VAA residual:' % (title, len(sub), m, b), ''] + table(
            ('VAA residual', 'mean (deg)', 'swings', 'whiff / swing', 'foul / contact', 'squared / contact (n)', 'BIP launch angle', 'foul launch angle'), rows) + ['']
    FF = [p for p in H if p['pt'] == 'FF']
    md += ['### 11. Four-seamers by how flat they arrive for their height', '']
    md += ctable('Four-seamers in the upper zone and high edge (0.5..1.25)', [p for p in FF if 0.5 <= p['h'] < 1.25], 'flat_fastball_high')
    md += ctable('Four-seamers low (0..0.5)', [p for p in FF if 0 <= p['h'] < 0.5], 'flat_fastball_low')
    md += ctable('Breaking balls low (SL CU ST KC SV, -0.25..0.5)', [p for p in H if p['pt'] in ('SL', 'CU', 'ST', 'KC', 'SV') and -0.25 <= p['h'] < 0.5], 'flat_breaking_low')
    # the release control: the same fifths, formed within each cell of release-height x extension terciles, pooled by fifth
    hi = [p for p in FF if 0.5 <= p['h'] < 1.25 and p['vaa'] is not None and p['release_pos_z'] is not None and p['release_extension'] is not None]
    e1 = tercile_edges([p['release_pos_z'] for p in hi]); e2 = tercile_edges([p['release_extension'] for p in hi])
    cell = lambda v, e: 0 if v < e[0] else (1 if v < e[1] else 2)
    cells = {}
    for p in hi: cells.setdefault((cell(p['release_pos_z'], e1), cell(p['release_extension'], e2)), []).append(p)
    pooled = [[] for _ in range(5)]; res = [[] for _ in range(5)]
    for c in cells.values():
        _, _, q = fifths(c)
        for i, (r, g0) in enumerate(q): pooled[i] += g0; res[i].append((r, len(g0)))
    J['flat_fastball_high_release_control'] = {'release_pos_z_terciles_ft': e1, 'extension_terciles_ft': e2, 'fifths': []}
    rows = []
    for i in range(5):
        g = group(pooled[i]); g['residual'] = sum(r * n for r, n in res[i]) / sum(n for _, n in res[i]); J['flat_fastball_high_release_control']['fifths'].append(g)
        rows.append((('steepest', '2', '3', '4', 'flattest')[i], '%+.2f' % g['residual'], g['swings'], f3(g['whiff']), f3(g['foul_of_contact']),
                     '%s (%d)' % (f3(g['squared']), g['n_squared']), f1(g['bip_la']), f1(g['foul_la'])))
    raw = J['flat_fastball_high']['fifths']; ctl = J['flat_fastball_high_release_control']['fifths']
    surv = {k: (ctl[4][k] - ctl[0][k]) / (raw[4][k] - raw[0][k]) for k in ('whiff', 'foul_of_contact', 'squared', 'bip_la') if raw[4][k] != raw[0][k]}
    J['flat_fastball_high_release_control']['share_surviving'] = surv
    md += ['The same four-seamers (0.5..1.25), with the fifths formed within each of 9 cells of release height (terciles at %.2f and %.2f ft) by '
           'extension (terciles at %.2f and %.2f ft) and pooled by fifth:' % (e1[0], e1[1], e2[0], e2[1]), ''] + table(
        ('VAA residual', 'mean (deg)', 'swings', 'whiff / swing', 'foul / contact', 'squared / contact (n)', 'BIP launch angle', 'foul launch angle'), rows) + ['']
    md += ['Share of the steepest-to-flattest difference that survived the release control: whiff %.2f, foul / contact %.2f, squared up %.2f, BIP launch angle %.2f.' % (
        surv.get('whiff', 0), surv.get('foul_of_contact', 0), surv.get('squared', 0), surv.get('bip_la', 0)), '']
    return J, md

# ---------------------------------------------------------------- writing
def write_section(year, used, md):
    path = 'STATCAST_TARGETS_%d.md' % year
    with open(path) as f: text = f.read()
    block = BEGIN + '\n\n' + '\n'.join(md).rstrip() + '\n\n' + END
    if BEGIN in text and END in text:
        a = text.index(BEGIN); b = text.index(END) + len(END)
        text = text[:a] + block + text[b:]
        hs = text.rfind('\n## What a foul is', 0, a)
        if hs >= 0:
            he = text.index('\n', hs + 1)
            text = text[:hs + 1] + SECTION.format(year=year, ndays=len(used)) + text[he:]
    else:
        text = text.rstrip() + '\n\n' + SECTION.format(year=year, ndays=len(used)) + '\n\n' + block + '\n'
    with open(path, 'w') as f: f.write(text)
    return path

def spans(days):
    """['2025-05-05', ...] -> '2025-05-05..05-18, ...'"""
    ds = sorted(datetime.date.fromisoformat(d) for d in days)
    out, i = [], 0
    while i < len(ds):
        j = i
        while j + 1 < len(ds) and (ds[j + 1] - ds[j]).days == 1: j += 1
        out.append(ds[i].isoformat() + ('' if i == j else '..' + ds[j].strftime('%m-%d')))
        i = j + 1
    return ', '.join(out)

def main(argv):
    year = int(argv[0]) if argv and argv[0].isdigit() else 2025
    dates = None
    if '--dates' in argv:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from fetch_pitches import parse_dates
        dates = parse_dates(argv[argv.index('--dates') + 1])
    raw, used, header = load(year, dates)
    if not raw:
        print('no pitch CSVs in statcast/raw/pitches/%d; run statcast/fetch_pitches.py first' % year); return
    P = [enrich(r) for r in raw]
    J, md = measure(P, header)
    J['dates'] = used; J['pitches'] = len(P)
    md = ['Dates (%d days with games): %s. Pulled by `statcast/fetch_pitches.py`, measured by `statcast/fouls.py`; '
          'every rate is a share of the n beside it.' % (len(used), spans(used)), ''] + md
    with open(os.path.join('statcast', 'fouls_%d.json' % year), 'w') as f: json.dump(J, f, indent=1)
    path = write_section(year, used, md)
    print('\n'.join(md))
    print('wrote statcast/fouls_%d.json and the tables in %s  (%d pitches, %d days)' % (year, path, len(P), len(used)))

if __name__ == '__main__':
    main(sys.argv[1:])
