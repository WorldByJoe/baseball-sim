"""
discipline.py · v0.3 · 2026-10-02

Measures plate discipline from pitch-level Statcast: where pitchers put the
ball and when batters swing at it, by count and by how far the pitch was from
the edge of the rulebook zone, plus what a swing produced at each distance and
what a ball, a strike and a foul were worth in each count. These are the
league's behaviour and the inputs a batter's swing decision would weigh.

Edge distance is in inches from the edge of the rulebook zone, + outside it
and - inside it (to the nearest edge). The zone is the plate's 17 in plus a
ball's radius on each side, and the batter's own sz_bot / sz_top widened by a
ball's radius, the engine's definition (inZone in bb_engine.js). Bunts,
pitchouts and hit batsmen are left out. Run values are Statcast's
delta_run_exp, the change in the inning's run expectancy over the pitch.

Table 5 is the run value of a ball in play by exit velocity and launch angle,
with each count's average removed (a ball in play from 3-0 is worth less than
the same ball from 0-2 only because 3-0 was already worth more), so it can value
the model's batted balls in any count.

Table 6 is the run value batters realised by swinging and by taking, by count
and distance from the edge. It is not a clean counterfactual: batters take the
pitches that look like balls and swing at the ones that look like strikes.

Prints the tables, writes statcast/discipline_<year>.json (and the same as
discipline_<year>.js, `var DISCIPLINE = ...`, for the jsc tools to load) and rewrites the
tables block of the "Plate discipline" section of STATCAST_TARGETS_<year>.md.

  python3 statcast/discipline.py 2025-05-05:2025-09-21

CHANGED
  v0.3  table 2b: swing probability by distance from the edge for each of the twelve counts (the swing policy's targets)
  v0.2  table 6: the realised run value of swings against takes, by count and distance from the edge
  v0.1  first build (the targets for plate discipline)
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swing_geometry import load

IN_FT = 12.0
HALF = (8.5 + 1.45) / IN_FT            # ft: half the zone's width
BALL_R = 1.45 / IN_FT                  # ft
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
TAKE = {'ball', 'blocked_ball', 'called_strike'}
KIND = {**{p: 'fastball' for p in ('FF', 'SI', 'FC')}, **{p: 'breaking' for p in ('SL', 'CU', 'ST', 'KC', 'SV')},
        **{p: 'offspeed' for p in ('CH', 'FS', 'FO')}}
COUNTS = ['%d-%d' % (b, s) for b in range(4) for s in range(3)]
GROUPS = (('first pitch (0-0)', ('0-0',)), ('batter ahead (1-0 2-0 2-1 3-1)', ('1-0', '2-0', '2-1', '3-1')), ('3-0', ('3-0',)),
          ('even or behind, under 2 strikes (0-1 1-1)', ('0-1', '1-1')), ('two strikes', ('0-2', '1-2', '2-2', '3-2')))
EDGES = (-99, -6, -4, -2, 0, 2, 4, 6, 9, 12, 99)
BIN_NAMES = ['%s..%s' % (a if a > -99 else '', b if b < 99 else '') for a, b in zip(EDGES, EDGES[1:])]
BEGIN, END = '<!-- discipline.py tables: begin -->', '<!-- discipline.py tables: end -->'
SECTION = '## Plate discipline (pitch level, {year}, {ndays} days)'


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def edge_in(x, z, bot, top):
    """signed distance in inches from the zone's edge, + outside"""
    lo, hi = bot - BALL_R, top + BALL_R
    dx = abs(x) - HALF
    dz = max(lo - z, z - hi)
    if dx <= 0 and dz <= 0:
        return max(dx, dz) * IN_FT
    return math.hypot(max(dx, 0), max(dz, 0)) * IN_FT


def bin_of(d):
    for i, (a, b) in enumerate(zip(EDGES, EDGES[1:])):
        if a <= d < b:
            return i
    return len(EDGES) - 2


def mean(v):
    return sum(v) / len(v) if v else None


def f3(v):
    return '' if v is None else '%.3f' % v


def table(head, rows):
    return ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]


def main(spec):
    P = []
    days = set()
    for r in load(spec):
        if (r.get('game_type') or 'R') != 'R':
            continue
        d = r.get('description', '')
        if d not in SWING and d not in TAKE:
            continue
        if 'bunt' in (r.get('des') or '').lower() and d == 'hit_into_play':
            continue
        x, z, bot, top = fl(r.get('plate_x')), fl(r.get('plate_z')), fl(r.get('sz_bot')), fl(r.get('sz_top'))
        b, s = fl(r.get('balls')), fl(r.get('strikes'))
        if None in (x, z, bot, top, b, s) or top <= bot or b > 3 or s > 2:
            continue
        e = edge_in(x, z, bot, top)
        P.append({'count': '%d-%d' % (b, s), 'swing': d in SWING, 'desc': d, 'edge': e, 'bin': bin_of(e), 'inzone': e <= 0,
                  'kind': KIND.get(r.get('pitch_type'), 'other'), 'rv': fl(r.get('delta_run_exp')),
                  'ev': fl(r.get('launch_speed')), 'la': fl(r.get('launch_angle'))})
        days.add(r.get('game_date'))
    J, md = {'pitches': len(P)}, []
    md += ['Pitches %d (bunts, pitchouts and hit batsmen left out). Edge distance in inches, + outside the rulebook zone. Run values are Statcast delta_run_exp.' % len(P), '']

    # 1. by count
    J['by_count'] = {}
    rows = []
    for c in COUNTS:
        s = [p for p in P if p['count'] == c]
        if not s:
            continue
        zs = [p for p in s if p['inzone']]; os_ = [p for p in s if not p['inzone']]
        rvb = mean([p['rv'] for p in s if p['desc'] in ('ball', 'blocked_ball') and p['rv'] is not None])
        rvs = mean([p['rv'] for p in s if p['desc'] == 'called_strike' and p['rv'] is not None])
        rvf = mean([p['rv'] for p in s if p['desc'] == 'foul' and p['rv'] is not None])
        rvw = mean([p['rv'] for p in s if p['desc'] in ('swinging_strike', 'swinging_strike_blocked') and p['rv'] is not None])
        rvp = mean([p['rv'] for p in s if p['desc'] == 'hit_into_play' and p['rv'] is not None])
        g = {'pitches': len(s), 'zone': len(zs) / len(s), 'swing': sum(p['swing'] for p in s) / len(s),
             'zone_swing': sum(p['swing'] for p in zs) / len(zs) if zs else None, 'chase': sum(p['swing'] for p in os_) / len(os_) if os_ else None,
             'rv_ball': rvb, 'rv_called_strike': rvs, 'rv_foul': rvf, 'rv_whiff': rvw, 'rv_in_play': rvp}
        J['by_count'][c] = g
        rows.append((c, g['pitches'], f3(g['zone']), f3(g['swing']), f3(g['zone_swing']), f3(g['chase']), f3(rvb), f3(rvs), f3(rvf), f3(rvp)))
    md += ['### 1. By count', ''] + table(('count', 'pitches', 'in zone', 'swing', 'zone swing', 'chase', 'run value: ball', 'called strike', 'foul', 'in play'), rows) + ['']
    a = P
    zs = [p for p in a if p['inzone']]; os_ = [p for p in a if not p['inzone']]
    J['all'] = {'zone': len(zs) / len(a), 'swing': sum(p['swing'] for p in a) / len(a), 'zone_swing': sum(p['swing'] for p in zs) / len(zs), 'chase': sum(p['swing'] for p in os_) / len(os_)}
    md += ['All counts: in zone %.3f, swing %.3f, zone swing %.3f, chase %.3f.' % (J['all']['zone'], J['all']['swing'], J['all']['zone_swing'], J['all']['chase']), '']

    # 2. swing probability by edge distance, by count group and by kind
    def curve(sub):
        out = []
        for i in range(len(BIN_NAMES)):
            t = [p for p in sub if p['bin'] == i]
            out.append((sum(p['swing'] for p in t) / len(t) if t else None, len(t)))
        return out
    J['swing_by_edge'] = {}
    rows = []
    for nm, cs in GROUPS:
        cv = curve([p for p in P if p['count'] in cs]); J['swing_by_edge'][nm] = cv
        rows.append([nm] + ['%s' % f3(v) for v, n in cv])
    for k in ('fastball', 'breaking', 'offspeed'):
        cv = curve([p for p in P if p['kind'] == k]); J['swing_by_edge'][k] = cv
        rows.append([k + ' (all counts)'] + ['%s' % f3(v) for v, n in cv])
    md += ['### 2. Swing probability by distance from the zone edge (in, + outside)', ''] + table(['counts'] + BIN_NAMES, rows) + ['']
    J['swing_by_edge_count'] = {}
    rows = []
    for c in COUNTS:
        cv = curve([p for p in P if p['count'] == c]); J['swing_by_edge_count'][c] = cv
        rows.append([c] + ['%s' % f3(v) if n >= 30 else '' for v, n in cv])
    md += ['Table 2b. The same for each count (blank where fewer than 30 pitches):', ''] + table(['count'] + BIN_NAMES, rows) + ['']

    # 3. where pitches go: share of pitches in each distance band, by count group and kind
    J['location_by_edge'] = {}
    rows = []
    for nm, cs in GROUPS:
        sub = [p for p in P if p['count'] in cs]
        sh = [sum(p['bin'] == i for p in sub) / len(sub) for i in range(len(BIN_NAMES))]
        J['location_by_edge'][nm] = {'share': sh, 'n': len(sub), 'zone': sum(p['inzone'] for p in sub) / len(sub)}
        rows.append([nm, len(sub), f3(J['location_by_edge'][nm]['zone'])] + [f3(v) for v in sh])
    for k in ('fastball', 'breaking', 'offspeed'):
        sub = [p for p in P if p['kind'] == k]
        sh = [sum(p['bin'] == i for p in sub) / len(sub) for i in range(len(BIN_NAMES))]
        J['location_by_edge'][k] = {'share': sh, 'n': len(sub), 'zone': sum(p['inzone'] for p in sub) / len(sub)}
        rows.append([k, len(sub), f3(J['location_by_edge'][k]['zone'])] + [f3(v) for v in sh])
    md += ['### 3. Where pitches went: share of pitches by distance from the zone edge', ''] + table(['counts', 'pitches', 'in zone'] + BIN_NAMES, rows) + ['']

    # 4. what a swing produced, and the called-strike chance, by edge distance
    J['outcome_by_edge'] = []
    rows = []
    for i, nm in enumerate(BIN_NAMES):
        sw = [p for p in P if p['bin'] == i and p['swing']]; tk = [p for p in P if p['bin'] == i and not p['swing']]
        con = [p for p in sw if p['desc'] in ('foul', 'foul_tip', 'hit_into_play')]
        bip = [p for p in con if p['desc'] == 'hit_into_play']
        g = {'swings': len(sw), 'whiff': (len(sw) - len(con)) / len(sw) if sw else None, 'foul_of_contact': (len(con) - len(bip)) / len(con) if con else None,
             'rv_in_play': mean([p['rv'] for p in bip if p['rv'] is not None]), 'takes': len(tk),
             'called_strike': sum(p['desc'] == 'called_strike' for p in tk) / len(tk) if tk else None}
        J['outcome_by_edge'].append(g)
        rows.append((nm, g['swings'], f3(g['whiff']), f3(g['foul_of_contact']), f3(g['rv_in_play']), g['takes'], f3(g['called_strike'])))
    md += ['### 4. What a swing produced, and how often a take was called a strike, by distance from the zone edge', ''] + table(
        ('edge (in)', 'swings', 'whiff / swing', 'foul / contact', 'run value per ball in play', 'takes', 'called strike / take'), rows) + ['']
    # 5. run value per ball in play by exit velocity and launch angle, each count's mean removed
    bip = [p for p in P if p['desc'] == 'hit_into_play' and p['rv'] is not None]
    allm = mean([p['rv'] for p in bip])
    cm = {c: mean([p['rv'] for p in bip if p['count'] == c]) for c in COUNTS}
    EV_E, LA_E = (0, 60, 70, 80, 90, 95, 100, 105, 110, 130), (-90, -10, 0, 10, 20, 30, 40, 50, 90)
    grid, rows = [], []
    for a, b in zip(LA_E, LA_E[1:]):
        row = []
        for c, d in zip(EV_E, EV_E[1:]):
            v = [p['rv'] - cm[p['count']] + allm for p in bip if p['ev'] is not None and p['la'] is not None and c <= p['ev'] < d and a <= p['la'] < b]
            row.append([mean(v), len(v)])
        grid.append(row)
        rows.append(['%d..%d' % (a, b)] + ['%s (%d)' % (f3(m), n) if n else '' for m, n in row])
    J['bip_value'] = {'ev_edges': EV_E, 'la_edges': LA_E, 'grid': grid, 'mean': allm, 'count_mean': cm,
                      'untracked': mean([p['rv'] - cm[p['count']] + allm for p in bip if p['ev'] is None or p['la'] is None])}
    md += ['### 5. Run value per ball in play by exit velocity and launch angle (each count\'s mean removed; all balls in play %.3f, n %d)' % (allm, len(bip)), ''] + table(
        ['launch angle'] + ['%d..%d mph' % (c, d) for c, d in zip(EV_E, EV_E[1:])], rows) + ['']
    # 6. realised run value of swings and takes, by count and distance from the edge
    J['swing_vs_take'] = {}
    rows = []
    for c in COUNTS:
        for i in range(2, 6):   # -4..-2, -2..0, 0..2, 2..4
            sw = [p['rv'] for p in P if p['count'] == c and p['bin'] == i and p['swing'] and p['rv'] is not None]
            tk = [p['rv'] for p in P if p['count'] == c and p['bin'] == i and not p['swing'] and p['rv'] is not None]
            if len(sw) < 80 or len(tk) < 80:
                continue
            a, b = mean(sw), mean(tk)
            J['swing_vs_take']['%s %s' % (c, BIN_NAMES[i])] = {'swing_share': len(sw) / (len(sw) + len(tk)), 'swing': a, 'take': b, 'n_swing': len(sw), 'n_take': len(tk)}
            rows.append((c, BIN_NAMES[i], f3(len(sw) / (len(sw) + len(tk))), '%+.3f' % a, '%+.3f' % b, '%+.3f' % (a - b), '%d / %d' % (len(sw), len(tk))))
    md += ['### 6. Run value realised by swinging and by taking, by count and distance from the edge (takes are biased toward pitches that looked like balls)', ''] + table(
        ('count', 'edge (in)', 'swing share', 'per swing', 'per take', 'swing minus take', 'n swings / takes'), rows) + ['']
    J['dates'] = sorted(d for d in days if d)
    year = J['dates'][0][:4] if J['dates'] else '2025'
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'discipline_%s.json' % year), 'w') as f:
        json.dump(J, f, indent=1)
    with open(os.path.join(here, 'discipline_%s.js' % year), 'w') as f:
        f.write('// written by statcast/discipline.py from pitch-level %s; load before the headless tools that compare with the league\nvar DISCIPLINE = %s;\n' % (year, json.dumps(J)))
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'STATCAST_TARGETS_%s.md' % year)
    text = open(path).read()
    block = BEGIN + '\n\n' + '\n'.join(md).rstrip() + '\n\n' + END
    head = SECTION.format(year=year, ndays=len(J['dates']))
    if BEGIN in text and END in text:
        text = text[:text.index(BEGIN)] + block + text[text.index(END) + len(END):]
    else:
        text = text.rstrip() + '\n\n' + head + '\n\n' + block + '\n'
    open(path, 'w').write(text)
    print('\n'.join(md))
    print('wrote statcast/discipline_%s.json and the tables in %s (%d pitches, %d days)' % (year, os.path.basename(path), len(P), len(J['dates'])))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
