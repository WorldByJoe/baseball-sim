"""
locations.py · v0.1 · 2026-10-02

Measures where pitchers put the ball, from pitch-level Statcast, as the
engine's PLAN stage needs it: how far a pitcher misses (command), where each
pitch type is aimed and how that moves with the count and the batter's side,
how much each pitcher's own habits differ from the league's, which kind of
pitch he chooses in each count, and how often he repeats a pitch.

Horizontal positions are inches toward the pitcher's ARM side (+) from the
middle of the plate, as the catcher sees it; heights are shares of the
batter's own zone (0 at sz_bot, 1 at sz_top). 'same' means a right-handed
pitcher to a right-handed batter or left to left.

COMMAND is read from four-seamers in 3-0 counts, where the target is about as
fixed as it gets (the heart of the zone): the scatter of a pitcher's 3-0
four-seamers about his own 3-0 mean, against the same side of batter (the
other types' scatter is measured against the four-seamer's, table 3). It is an
upper bound, since a 3-0 target still varies a little. It agrees with the
published miss distances from the catcher's glove (Inside Edge, about 11 in;
OpenCommand 9.9 in; a per-axis scatter s gives a mean miss of 1.25 s). The
TARGET spread in other counts is what is left of a pitcher's scatter within
a count after his command is taken out.

Prints the tables, writes statcast/locations_<year>.json, and writes the
PLAN_LOC literal into bb_engine.js between its marker lines (the engine's
aim points, count shifts, target spreads, habits, kind by count and
repeats all come from here; rerun this after a new pull).

  python3 statcast/locations.py 2025-05-05:2025-09-21

CHANGED
  v0.1  first build (command, aim points by type, count shifts, habits, kind by count, repeats, fatigue)
"""
import json, math, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swing_geometry import load

TYPE = {'FF': 'FF', 'SI': 'SI', 'FC': 'FC', 'SL': 'SL', 'ST': 'ST', 'CU': 'CU', 'KC': 'CU', 'SV': 'SL', 'CH': 'CH', 'FS': 'FS', 'FO': 'FS'}
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'CH': 'OS', 'FS': 'OS'}
TYPES = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS']
COUNTS = ['%d-%d' % (b, s) for b in range(4) for s in range(3)]
HALF = 8.5 + 1.45                       # in: half the zone's width, ball included
BALL_R = 1.45
BEGIN = '  // ---- PLAN_LOC: written by statcast/locations.py; do not edit by hand ----'
END = '  // ---- PLAN_LOC: end ----'


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def f2(v):
    return '' if v is None else '%.2f' % v


def table(head, rows):
    return ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]


def within(P, key, cell):
    """pooled scatter of `key` about each cell's own mean; returns (sd, df)"""
    g = collections.defaultdict(list)
    for p in P:
        g[cell(p)].append(p[key])
    ss = df = 0
    for v in g.values():
        if len(v) > 1:
            m = sum(v) / len(v)
            ss += sum((a - m) ** 2 for a in v)
            df += len(v) - 1
    return (math.sqrt(ss / df) if df else None), df


def main(spec):
    rows = load(spec)
    P, days = [], set()
    by_game = collections.defaultdict(int)
    for r in rows:
        if (r.get('game_type') or 'R') != 'R' or r.get('description') == 'pitchout':
            continue
        t = TYPE.get(r.get('pitch_type'))
        x, z, bot, top = fl(r.get('plate_x')), fl(r.get('plate_z')), fl(r.get('sz_bot')), fl(r.get('sz_top'))
        b, s = fl(r.get('balls')), fl(r.get('strikes'))
        if t is None or None in (x, z, bot, top, b, s) or top <= bot or b > 3 or s > 2:
            continue
        arm = 1 if r.get('p_throws') == 'L' else -1      # the engine's armSide: a right-hander releases from the -x side
        p = {'pit': r['pitcher'], 'game': r['game_pk'], 'ab': int(fl(r['at_bat_number']) or 0), 'pn': int(fl(r['pitch_number']) or 0),
             'type': t, 'kind': KIND[t], 'count': '%d-%d' % (b, s), 'same': r.get('stand') == r.get('p_throws'),
             'xa': x * arm * 12, 'zf': (z - bot) / (top - bot), 'zin': z * 12, 'zh': (top - bot) * 12,
             'inzone': abs(x * 12) <= HALF and bot * 12 - BALL_R <= z * 12 <= top * 12 + BALL_R}
        P.append(p)
        by_game[(p['pit'], p['game'])] += 1
        days.add(r.get('game_date'))
    ZH = sum(p['zh'] for p in P) / len(P)
    # starters and relievers, by a pitcher's pitches per game
    per_pit = collections.defaultdict(list)
    for (pit, g), n in by_game.items():
        per_pit[pit].append(n)
    role = {pit: 'SP' if sum(v) / len(v) >= 40 else 'RP' for pit, v in per_pit.items()}
    J, md = {'pitches': len(P), 'zone_height_in': ZH}, []
    md += ['Pitches %d (%d days). Horizontal: inches toward the pitcher\'s arm side; height: share of the batter\'s zone (0 = bottom, 1 = top); mean zone height %.1f in.' % (len(P), len(days), ZH), '']

    # 1. command: four-seamers in 3-0, about the pitcher's own 3-0 mean, same side of batter
    cell = lambda p: (p['pit'], p['same'], p['count'])
    fb30 = [p for p in P if p['count'] == '3-0' and p['type'] == 'FF']
    cx, df = within(fb30, 'xa', cell)
    cz, _ = within(fb30, 'zin', cell)
    rows1 = [('four-seamers, 3-0 (all)', df, f2(cx), f2(cz))]
    J['command'] = {'x': cx, 'z': cz, 'df': df}
    for rl in ('SP', 'RP'):
        sub = [p for p in fb30 if role[p['pit']] == rl]
        a, d = within(sub, 'xa', cell); c, _ = within(sub, 'zin', cell)
        J['command'][rl] = {'x': a, 'z': c, 'df': d}
        rows1.append(('four-seamers, 3-0, ' + ('starters' if rl == 'SP' else 'relievers (under 40 pitches a game)'), d, f2(a), f2(c)))
    for c in ('3-1', '2-0', '0-0', '0-2'):
        sub = [p for p in P if p['count'] == c and p['type'] == 'FF']
        a, d = within(sub, 'xa', cell); b2, _ = within(sub, 'zin', cell)
        rows1.append(('four-seamers, %s (for comparison)' % c, d, f2(a), f2(b2)))
    md += ['### 1. Command: scatter of a pitcher\'s pitches about his own mean in the count, same side of batter (in)', ''] + table(('pitches', 'degrees of freedom', 'across', 'up and down'), rows1) + ['']

    # 2. how much command differs between pitchers: fastballs in hitters' counts, spread of each pitcher's scatter beyond sampling
    hc = [p for p in P if p['count'] in ('1-0', '2-0', '2-1', '3-0', '3-1') and p['type'] in ('FF', 'SI')]
    acc = collections.defaultdict(lambda: [0.0, 0.0, 0])
    g = collections.defaultdict(list)
    for p in hc:
        g[cell(p)].append(p)
    for k, v in g.items():
        if len(v) > 1:
            mx = sum(p['xa'] for p in v) / len(v); mz = sum(p['zin'] for p in v) / len(v)
            a = acc[k[0]]
            a[0] += sum((p['xa'] - mx) ** 2 for p in v); a[1] += sum((p['zin'] - mz) ** 2 for p in v); a[2] += len(v) - 1
    J['command_spread'] = {}
    rows2 = []
    for i, ax in ((0, 'x'), (1, 'z')):
        est = [(a[i] / a[2], a[2]) for a in acc.values() if a[2] >= 15]
        m = sum(e for e, _ in est) / len(est)
        var = sum((e - m) ** 2 for e, _ in est) / len(est)
        noise = sum(2 * e * e / d for e, d in est) / len(est)
        cv = 0.5 * math.sqrt(max(var - noise, 0)) / m      # sd of the per-axis scatter over its mean (delta method)
        J['command_spread'][ax] = cv
        rows2.append(('across' if ax == 'x' else 'up and down', len(est), '%.2f' % math.sqrt(m), '%.3f' % cv))
    xs = [math.sqrt(a[0] / a[2]) for a in acc.values() if a[2] >= 30]; zs = [math.sqrt(a[1] / a[2]) for a in acc.values() if a[2] >= 30]
    mx, mz = sum(xs) / len(xs), sum(zs) / len(zs)
    r = sum((a - mx) * (b - mz) for a, b in zip(xs, zs)) / math.sqrt(sum((a - mx) ** 2 for a in xs) * sum((b - mz) ** 2 for b in zs))
    J['command_spread']['r_xz_raw'] = r
    md += ['### 2. How command differs between pitchers (fastballs in 1-0 2-0 2-1 3-0 3-1; pitchers with 15+ degrees of freedom)', ''] + table(
        ('axis', 'pitchers', 'pooled scatter (in)', 'spread between pitchers (share of the mean, sampling removed)'), rows2) + [
        '', 'The across and up-and-down scatters of the same pitcher correlated %.2f (pitchers with 30+ degrees of freedom; sampling noise pulls this toward 0, so it says only that the two are not strongly linked).' % r, '']

    # 3. each type's scatter against the four-seamer's in the same counts (hitters' counts, then 0-0)
    J['type_scatter'] = {}
    rows3 = []
    ref = {}
    for cs, nm in ((('2-0', '3-0', '3-1'), 'hitters'), (('0-0',), 'first')):
        for t in TYPES:
            sub = [p for p in P if p['type'] == t and p['count'] in cs]
            a, d = within(sub, 'xa', cell); c, _ = within(sub, 'zin', cell)
            ref[(nm, t)] = (a, c, d)
    for t in TYPES:
        h, f = ref[('hitters', t)], ref[('first', t)]
        hx, hz = (h[0] / ref[('hitters', 'FF')][0], h[1] / ref[('hitters', 'FF')][1]) if h[2] >= 100 else (None, None)
        fx, fz = f[0] / ref[('first', 'FF')][0], f[1] / ref[('first', 'FF')][1]
        mult = (hx, hz) if hx is not None else (fx, fz)
        J['type_scatter'][t] = {'hitters': [hx, hz, h[2]], 'first': [fx, fz, f[2]], 'mult': mult}
        rows3.append((t, h[2], f2(hx), f2(hz), f[2], f2(fx), f2(fz), '%.2f / %.2f' % mult))
    md += ['### 3. Each type\'s scatter against the four-seamer\'s, within pitcher and count', ''] + table(
        ('type', 'df, 2-0 3-0 3-1', 'across', 'up and down', 'df, 0-0', 'across', 'up and down', 'used (hitters\' counts where df 100+)'), rows3) + ['']

    # 4. where each type is aimed: league mean location by type and side of batter
    J['type_mean'] = {}
    rows4 = []
    for t in TYPES:
        J['type_mean'][t] = {}
        cells = []
        for sd in (True, False):
            sub = [p for p in P if p['type'] == t and p['same'] == sd]
            mx = sum(p['xa'] for p in sub) / len(sub); mz = sum(p['zf'] for p in sub) / len(sub)
            J['type_mean'][t]['same' if sd else 'opp'] = [mx, mz, len(sub)]
            cells += [len(sub), '%+.1f' % mx, '%.2f' % mz]
        rows4.append([t] + cells)
    md += ['### 4. Mean location by pitch type and side of batter', ''] + table(
        ('type', 'n same', 'across', 'height', 'n opposite', 'across', 'height'), rows4) + ['']

    # 5. the count's shift, by kind and side, from each pitch's type mean
    def resid(p):
        m = J['type_mean'][p['type']]['same' if p['same'] else 'opp']
        return p['xa'] - m[0], p['zf'] - m[1]
    J['count_shift'] = {}
    rows5 = []
    for k in ('FB', 'BR', 'OS'):
        J['count_shift'][k] = {}
        for sd in (True, False):
            nm = 'same' if sd else 'opp'
            J['count_shift'][k][nm] = {}
            cells = []
            for c in COUNTS:
                sub = [resid(p) for p in P if p['kind'] == k and p['same'] == sd and p['count'] == c]
                n = len(sub); w = n / (n + 150.0)
                dx = w * sum(a for a, _ in sub) / n if n else 0; dz = w * sum(b for _, b in sub) / n if n else 0
                J['count_shift'][k][nm][c] = [dx, dz, n]
                cells.append('%+.1f / %+.2f' % (dx, dz))
            rows5.append([k + ' ' + nm] + cells)
    md += ['### 5. How the count moves the aim: shift from the type\'s mean, across (in) / height (zone share), shrunk toward 0 by n / (n + 150)', ''] + table(['kind, side'] + COUNTS, rows5) + ['']

    # 6. what is left of a pitcher's scatter within a count once his command is out: the target's spread
    fbx, fbz = J['command']['x'], J['command']['z']
    J['target_sd'] = {}
    rows6 = []
    cellt = lambda p: (p['pit'], p['type'], p['same'], p['count'])
    for k in ('FB', 'BR', 'OS'):
        J['target_sd'][k] = {}
        cells = []
        for c in COUNTS:
            sub = [p for p in P if p['kind'] == k and p['count'] == c]
            a, d = within(sub, 'xa', cellt); b2, _ = within(sub, 'zin', cellt)
            if d < 60:
                J['target_sd'][k][c] = None; cells.append(''); continue
            # command for the pitches of this kind in this count, type by type (usage-weighted mean of the squared multipliers)
            tm = collections.Counter(p['type'] for p in sub)
            mx2 = sum(n * J['type_scatter'][t]['mult'][0] ** 2 for t, n in tm.items()) / len(sub)
            mz2 = sum(n * J['type_scatter'][t]['mult'][1] ** 2 for t, n in tm.items()) / len(sub)
            tx = math.sqrt(max(a * a - fbx * fbx * mx2, 0)); tz = math.sqrt(max(b2 * b2 - fbz * fbz * mz2, 0))
            J['target_sd'][k][c] = [tx, tz / ZH, d]
            cells.append('%.1f / %.1f' % (tx, tz))
        rows6.append([k] + cells)
    md += ['### 6. The spread of a pitcher\'s targets within a count, across / up and down (in): his scatter there with his command taken out', ''] + table(['kind'] + COUNTS, rows6) + ['']

    # 7. habits: how far each pitcher's own aim for a type sits from the league's, beyond sampling
    J['habit'] = {}
    rows7 = []
    for t in TYPES:
        g = collections.defaultdict(list)
        for p in P:
            if p['type'] == t:
                cs = J['count_shift'][p['kind']]['same' if p['same'] else 'opp'][p['count']]
                rx, rz = resid(p)
                g[p['pit']].append((rx - cs[0], rz - cs[1]))
        est = [v for v in g.values() if len(v) >= 40]
        out = []
        for i in (0, 1):
            means = [sum(q[i] for q in v) / len(v) for v in est]
            noise = [sum((q[i] - mm) ** 2 for q in v) / (len(v) - 1) / len(v) for v, mm in zip(est, means)]
            gm = sum(means) / len(means)
            var = sum((mm - gm) ** 2 for mm in means) / len(means) - sum(noise) / len(noise)
            out.append(math.sqrt(max(var, 0)))
        J['habit'][t] = [out[0], out[1], len(est)]
        rows7.append((t, len(est), '%.1f' % out[0], '%.2f' % out[1]))
    md += ['### 7. Each pitcher\'s own aim for a type: spread between pitchers beyond sampling (pitchers with 40+ of the type)', ''] + table(
        ('type', 'pitchers', 'across (in)', 'height (zone share)'), rows7) + ['']

    # 8. which kind he throws: by side of batter (per type) and by count (per kind and side)
    allT = collections.Counter(p['type'] for p in P)
    J['usage_side'] = {}
    rows8 = []
    for t in TYPES:
        sh = allT[t] / len(P)
        v = []
        for sd in (True, False):
            sub = [p for p in P if p['same'] == sd]
            v.append((sum(p['type'] == t for p in sub) / len(sub)) / sh)
        J['usage_side'][t] = v
        rows8.append((t, '%.3f' % sh, '%.2f' % v[0], '%.2f' % v[1]))
    md += ['### 8a. Use of each type against same-side and opposite-side batters, over its overall share', ''] + table(('type', 'share', 'same', 'opposite'), rows8) + ['']
    J['usage_count'] = {}
    rows8b = []
    for sd in (True, False):
        nm = 'same' if sd else 'opp'
        sub = [p for p in P if p['same'] == sd]
        base = {k: sum(p['kind'] == k for p in sub) / len(sub) for k in ('FB', 'BR', 'OS')}
        J['usage_count'][nm] = {}
        for c in COUNTS:
            sc = [p for p in sub if p['count'] == c]
            J['usage_count'][nm][c] = {k: (sum(p['kind'] == k for p in sc) / len(sc)) / base[k] for k in base}
            rows8b.append([nm, c, len(sc)] + ['%.2f' % J['usage_count'][nm][c][k] for k in ('FB', 'BR', 'OS')])
    md += ['### 8b. Use of each kind by count, over its share against that side', ''] + table(('side', 'count', 'pitches', 'fastball', 'breaking', 'off-speed'), rows8b) + ['']

    # 9. repeats: the chance the next pitch of the plate appearance is the same type, over what his own usage predicts
    seq = collections.defaultdict(list)
    for p in P:
        seq[(p['game'], p['ab'])].append(p)
    use = collections.defaultdict(collections.Counter)
    for p in P:
        use[p['pit']][p['type']] += 1
    def expect(p, t):     # his chance of type t on this pitch from his usage, the side and the count (tables 8a, 8b)
        u = use[p['pit']]; nm = 'same' if p['same'] else 'opp'; i = 0 if p['same'] else 1
        w = {k: u[k] * J['usage_side'][k][i] * J['usage_count'][nm][p['count']][KIND[k]] for k in u}
        return w.get(t, 0) / sum(w.values())
    o1 = e1 = o2 = e2 = 0.0
    for v in seq.values():
        v.sort(key=lambda p: p['pn'])
        for i in range(1, len(v)):
            same1 = v[i]['type'] == v[i - 1]['type']
            ex = expect(v[i], v[i - 1]['type'])
            if i >= 2 and v[i - 1]['type'] == v[i - 2]['type']:
                o2 += same1; e2 += ex
            else:
                o1 += same1; e1 += ex
    J['repeat'] = {'after_one': o1 / e1, 'after_two': o2 / e2}
    md += ['### 9. Repeats within a plate appearance', '', 'The next pitch was the same type as the last %.2f times as often as his usage, the side and the count predict (tables 8a, 8b) after a change, and the same as the last two %.2f times as often after two alike.' % (J['repeat']['after_one'], J['repeat']['after_two']), '']

    # 10. checks for the model: in zone by count, and where pitches went by kind
    J['zone_by_count'] = {c: sum(p['inzone'] for p in P if p['count'] == c) / max(1, sum(p['count'] == c for p in P)) for c in COUNTS}
    md += ['### 10. In-zone share by count', ''] + table(COUNTS, [['%.3f' % J['zone_by_count'][c] for c in COUNTS]]) + ['']

    # 11. fatigue: starters' four-seamers by pitch of the game, scatter and speed against his first 25
    games = collections.defaultdict(list)
    for r in rows:
        if (r.get('game_type') or 'R') == 'R':
            games[(r['game_pk'], r['pitcher'])].append(r)
    bands = ((1, 25), (26, 50), (51, 75), (76, 90), (91, 105))
    fa = {b: [0.0, 0.0, 0, 0.0, 0] for b in bands}
    for v in games.values():
        if len(v) < 60:
            continue
        v.sort(key=lambda r: (int(fl(r['at_bat_number']) or 0), int(fl(r['pitch_number']) or 0)))
        arm = 1 if v[0].get('p_throws') == 'L' else -1
        ff = [(i + 1, r) for i, r in enumerate(v) if r.get('pitch_type') == 'FF' and fl(r.get('plate_x')) is not None and fl(r.get('plate_z')) is not None and fl(r.get('release_speed')) is not None]
        v0 = [fl(r['release_speed']) for n, r in ff if n <= 25]
        if len(v0) < 4:
            continue
        base = sum(v0) / len(v0)
        for b in bands:
            cells = collections.defaultdict(list)
            for n, r in ff:
                if b[0] <= n <= b[1]:
                    cells[(r.get('stand') == r.get('p_throws'), r.get('balls'), r.get('strikes'))].append((fl(r['plate_x']) * arm * 12, fl(r['plate_z']) * 12))
                    fa[b][3] += fl(r['release_speed']) - base; fa[b][4] += 1
            for c in cells.values():
                if len(c) > 1:
                    mx = sum(a for a, _ in c) / len(c); mz = sum(z for _, z in c) / len(c)
                    fa[b][0] += sum((a - mx) ** 2 for a, _ in c); fa[b][1] += sum((z - mz) ** 2 for _, z in c); fa[b][2] += len(c) - 1
    J['fatigue'] = {}
    rows11 = []
    for b in bands:
        a = fa[b]
        g = {'x': math.sqrt(a[0] / a[2]) if a[2] else None, 'z': math.sqrt(a[1] / a[2]) if a[2] else None, 'df': a[2], 'speed': a[3] / a[4] if a[4] else None, 'n': a[4]}
        J['fatigue']['%d-%d' % b] = g
        rows11.append(('%d-%d' % b, g['df'], f2(g['x']), f2(g['z']), '%+.2f' % g['speed'] if g['speed'] is not None else '', g['n']))
    md += ['### 11. Fatigue: starters\' four-seamers (60+ pitches in the game) by pitch of the game: scatter within pitcher-game, side and count, and speed against his first 25 pitches', ''] + table(
        ('pitches', 'df', 'across (in)', 'up and down (in)', 'speed (mph)', 'four-seamers'), rows11) + [
        '', 'Managers take a tired pitcher out, so this is the decline the league lets happen, not the decline a pitcher would show if he stayed in.', '']

    J['dates'] = sorted(d for d in days if d)
    year = J['dates'][0][:4] if J['dates'] else '2025'
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'locations_%s.json' % year), 'w') as f:
        json.dump(J, f, indent=1)
    print('\n'.join(md))
    print('wrote statcast/locations_%s.json (%d pitches, %d days)' % (year, len(P), len(J['dates'])))
    write_engine(J, year)


def write_engine(J, year):
    r1, r3 = lambda v: round(v, 1), lambda v: round(v, 3)
    def spread(k, c):     # a count too rare to measure borrows the nearest count with the same strikes, fewer balls
        v = J['target_sd'][k][c]
        b, st = int(c[0]), c[2]
        while v is None and b > 0:
            b -= 1; v = J['target_sd'][k]['%d-%s' % (b, st)]
        return [r1(v[0]), r3(v[1])]
    L = {'aim': {t: {sd: [r1(J['type_mean'][t][sd][0]), r3(J['type_mean'][t][sd][1])] for sd in ('same', 'opp')} for t in TYPES},
         'shift': {k: {sd: {c: [r1(v[0]), r3(v[1])] for c, v in J['count_shift'][k][sd].items()} for sd in ('same', 'opp')} for k in ('FB', 'BR', 'OS')},
         'spread': {k: {c: spread(k, c) for c in COUNTS} for k in ('FB', 'BR', 'OS')},
         'habit': {t: [r1(J['habit'][t][0]), r3(J['habit'][t][1])] for t in TYPES},
         'sideUse': {t: [round(v, 2) for v in J['usage_side'][t]] for t in TYPES},
         'countUse': {sd: {c: [round(J['usage_count'][sd][c][k], 2) for k in ('FB', 'BR', 'OS')] for c in COUNTS} for sd in ('same', 'opp')},
         'repeat': [round(J['repeat']['after_one'], 2), round(J['repeat']['after_two'], 2)]}
    lines = [BEGIN,
             '  // %s, %d days of pitch-level Statcast. aim: league mean location by type and side of batter, [in toward' % (year, len(J['dates'])),
             '  // his arm side, share of the zone height]; shift: the count\'s move from it, by kind and side; spread: sd of',
             '  // his targets within a count with his command taken out, by kind; habit: sd between pitchers of their own',
             '  // aim for a type; sideUse: use of a type against same / opposite-side batters over its share; countUse:',
             '  // use of fastballs, breaking balls, off-speed by count over their share against that side; repeat: the',
             '  // chance of the same type again after a change / after two alike, over what usage predicts.',
             '  var PLAN_LOC = {']
    keys = list(L)
    for i, k in enumerate(keys):
        lines.append('    %s: %s%s' % (k, json.dumps(L[k], separators=(',', ':')).replace('"', "'"), ',' if i < len(keys) - 1 else ''))
    lines += ['  };', END]
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'bb_engine.js')
    text = open(path).read()
    if BEGIN in text and END in text:
        text = text[:text.index(BEGIN)] + '\n'.join(lines) + text[text.index(END) + len(END):]
        open(path, 'w').write(text)
        print('wrote PLAN_LOC into bb_engine.js')
    else:
        print('bb_engine.js has no PLAN_LOC markers; the literal:\n' + '\n'.join(lines))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
