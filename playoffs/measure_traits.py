"""
measure_traits.py · v0.1 · 2026-10-04

Step 3 of the playoff data pull: the traits Statcast measures directly, for
every player on the eight postseason rosters, with sampling error; and the
per-player summaries that step 4 (the hidden traits, inferred by simulation)
is fitted to. Reads the extracts and leaderboards written by fetch_statcast.py
and the rosters and season totals written by fetch_mlb.py.

Writes playoffs/players_measured.json (everything) and
playoffs/players_measured.csv (pooled means and SEs of the headline traits).

Every measured quantity is {"2025": {...}, "2026": {...}, "pooled": {...}},
each {mean, sd, n, se}:
  - a mean: sd is the spread of the observations, se = sd / sqrt(n);
  - a rate (a share of 0/1 events): mean is the share, sd = sqrt(p(1-p)), se = sqrt(p(1-p)/n);
  - pooled weights each 2026 observation 1.0 and each 2025 observation 0.5;
    its n is the raw count of observations, n_eff = (sum w)^2 / sum w^2, and its
    se uses n_eff (with equal weights n_eff = n).
A year with no observations is omitted.

Names and units are the engine's (TRAITS.md, bb_engine.js v3.0). Conventions
(see the brief, docs/briefs/2026-10-04_playoff_data_pull.md):
  - pitch location is batter-relative: away_in = plate_x*12 for a right-handed batter,
    -plate_x*12 for a left-handed one (+ = away from him); height h = (plate_z - sz_bot)/(sz_top - sz_bot);
  - pull = -attack_direction (statcast/bat_direction.py); spray from (126.0, 205.0), + pulled;
  - horizontal movement is + toward the pitcher's arm side;
  - pitch kinds FB = FF SI FC, BR = SL ST CU, OS = CH FS, with KC -> CU, SV -> ST, FO -> FS; any other type is kept as itself;
  - swings exclude bunts; whiffs are swinging_strike and swinging_strike_blocked;
  - distance from the zone's edge in inches, + inside, the ball's edge counted (ZH, R as in the brief;
    the same zone as statcast/discipline.py and statcast/locations.py).

  python3 playoffs/measure_traits.py
"""
import csv, datetime, gzip, json, math, os, random, statistics as st, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HERE, fl

YEARS = (2025, 2026)
W = {2026: 1.0, 2025: 0.5}
HC_X0, HC_Y0 = 126.0, 205.0                     # home plate in the hit coordinates (statcast/bat_direction.py v0.2)
ZH, R = 0.7083 + 0.121, 0.121                   # ft: half the plate plus the ball's radius; the ball's radius
MAP = {'KC': 'CU', 'SV': 'ST', 'FO': 'FS'}
ENGINE_TYPES = ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS')
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'CH': 'OS', 'FS': 'OS'}
KINDS = ('FB', 'BR', 'OS')
SWING = {'swinging_strike', 'swinging_strike_blocked', 'foul', 'foul_tip', 'hit_into_play'}
WHIFF = {'swinging_strike', 'swinging_strike_blocked'}
FOUL = {'foul', 'foul_tip'}
BANDS = ('heart', 'edge_in', 'edge_out', 'out4_8', 'out8plus')
HBANDS = ('below', '0-.33', '.33-.67', '.67-1', 'above')
CGROUPS = ('ahead', 'even', 'behind')
SIDES = ('same', 'opp')
NOT_PA = ('caught_stealing', 'pickoff', 'stolen_base', 'wild_pitch', 'passed_ball', 'other_advance', 'truncated_pa',
          'runner_double_play', 'game_advisory', 'ejection')
LB_TYPES = {'fourseam': 'FF', 'sinker': 'SI', 'cutter': 'FC', 'changeup': 'CH', 'splitter': 'FS',
            'curve': 'CU', 'slider': 'SL', 'sweeper': 'ST'}


# ---- the year-split accumulator -------------------------------------------------------------
class Acc:
    def __init__(self):
        self.v = {y: [] for y in YEARS}

    def add(self, y, x):
        if x is not None:
            self.v[y].append(x)

    def n(self):
        return sum(len(v) for v in self.v.values())


def rnd(x, k=4):
    if x is None or isinstance(x, int):
        return x
    return float('%.*g' % (k + 2, x)) if abs(x) >= 1 else round(x, k)


def _summ(vals, wts, rate):
    n = len(vals)
    if n == 0:
        return None
    sw = sum(wts)
    m = sum(w * x for w, x in zip(wts, vals)) / sw
    neff = sw * sw / sum(w * w for w in wts)
    if rate:
        sd = math.sqrt(max(m * (1 - m), 0))
        se = math.sqrt(max(m * (1 - m), 0) / neff)
    else:
        var = sum(w * (x - m) ** 2 for w, x in zip(wts, vals)) / sw
        if neff > 1:
            var *= neff / (neff - 1)
        sd = math.sqrt(var)
        se = sd / math.sqrt(neff) if n > 1 else None
    out = {'mean': rnd(m), 'sd': rnd(sd), 'n': n, 'se': rnd(se)}
    if abs(neff - n) > 0.01:
        out['n_eff'] = round(neff, 1)
    return out


def summ(acc, rate=False, minn=1):
    if acc.n() < minn:
        return None
    out = {}
    for y in YEARS:
        s = _summ(acc.v[y], [1.0] * len(acc.v[y]), rate)
        if s:
            out[str(y)] = s
    vals, wts = [], []
    for y in YEARS:
        vals += acc.v[y]; wts += [W[y]] * len(acc.v[y])
    out['pooled'] = _summ(vals, wts, rate)
    return out


def pct(v, q):
    v = sorted(v)
    if not v:
        return None
    i = (len(v) - 1) * q
    a, b = int(math.floor(i)), int(math.ceil(i))
    return v[a] + (v[b] - v[a]) * (i - a)


def quantiles(acc):
    """p50 and p90 by year and pooled (pooled: 2025 values counted half, by weighted quantile)"""
    out = {}
    for y in YEARS:
        if acc.v[y]:
            out[str(y)] = {'p50': rnd(pct(acc.v[y], .5)), 'p90': rnd(pct(acc.v[y], .9)), 'n': len(acc.v[y])}
    pairs = sorted([(x, W[y]) for y in YEARS for x in acc.v[y]])
    if pairs:
        tot, run, q = sum(w for _, w in pairs), 0, {}
        for x, w in pairs:
            run += w
            for k, f in (('p50', .5), ('p90', .9)):
                if k not in q and run >= f * tot:
                    q[k] = rnd(x)
        out['pooled'] = dict(q, n=len(pairs))
    return out


# ---- reading --------------------------------------------------------------------------------
def rows_of(role, pid):
    out = []
    for y in YEARS:
        fn = os.path.join(HERE, 'pitches', '%d_%s_%d.csv.gz' % (y, role, pid))
        if not os.path.exists(fn):
            continue
        with gzip.open(fn, 'rt', encoding='utf-8') as f:
            for r in csv.DictReader(f):
                r['_y'] = y
                out.append(r)
    return out


def ptype(t):
    t = MAP.get(t, t)
    return t or None


def zone_d(x, z, bot, top):
    """inches from the zone's edge, + inside, the ball's edge counted"""
    dx = ZH - abs(x)
    dlo = z - (bot - R)
    dhi = (top + R) - z
    if dx >= 0 and dlo >= 0 and dhi >= 0:
        d = min(dx, dlo, dhi)
    else:
        d = -math.hypot(max(0, -dx), max(0, -dlo, -dhi))
    return d * 12


def band(d):
    return 'heart' if d >= 4 else 'edge_in' if d >= 0 else 'edge_out' if d >= -4 else 'out4_8' if d >= -8 else 'out8plus'


def hband(h):
    return 'below' if h < 0 else '0-.33' if h < 1 / 3 else '.33-.67' if h < 2 / 3 else '.67-1' if h <= 1 else 'above'


def cgroup(b, s):
    return 'ahead' if s > b else 'behind' if b > s else 'even'


def prep(r):
    """the derived fields of one pitch"""
    p = {'y': r['_y'], 'desc': r['description'], 'ev': r['events'], 'stand': r['stand'], 'pt': ptype(r['pitch_type']),
         'bunt': r.get('bunt') == '1', 'b': int(r['balls'] or 0), 's': int(r['strikes'] or 0)}
    p['kind'] = KIND.get(p['pt'])
    x, z, bot, top = fl(r['plate_x']), fl(r['plate_z']), fl(r['sz_bot']), fl(r['sz_top'])
    if None not in (x, z, bot, top) and top > bot:
        p['d'] = zone_d(x, z, bot, top)
        p['away'] = x * 12 if r['stand'] == 'R' else -x * 12
        p['h'] = (z - bot) / (top - bot)
        p['zin'] = z * 12
    p['swing'] = p['desc'] in SWING and not p['bunt']
    p['contact'] = p['swing'] and p['desc'] not in WHIFF
    p['bip'] = p['swing'] and p['desc'] == 'hit_into_play'
    return p


def is_pa(ev):
    return bool(ev) and not any(ev.startswith(k) for k in NOT_PA)


# ---- leaderboards ---------------------------------------------------------------------------
def lb(name, year, key):
    fn = os.path.join(HERE, 'leaderboards', '%s_%d.csv' % (name, year))
    if not os.path.exists(fn):
        return {}
    out = {}
    for r in csv.DictReader(open(fn, encoding='utf-8-sig')):
        k = r.get(key)
        if k and k.strip().isdigit():
            out.setdefault(int(k), []).append(r)
    return out


def load_lbs():
    L = {}
    for y in YEARS:
        L[y] = {'sprint': lb('sprint_speed', y, 'player_id'), 'arm': lb('arm_strength', y, 'player_id'),
                'oaa': lb('oaa', y, 'player_id'), 'frv': lb('fielding_run_value', y, 'id'),
                'pop': lb('pop_time', y, 'entity_id'), 'framing': lb('catcher_framing', y, 'id'),
                'bat': lb('bat_tracking', y, 'id'), 'path': lb('swing_path', y, 'id'),
                'armangle': lb('arm_angle', y, 'pitcher'), 'spin': lb('active_spin', y, 'entity_id')}
        for pos in range(3, 10):
            L[y]['oaa%d' % pos] = lb('oaa_pos%d' % pos, y, 'player_id')
        for pos in range(2, 10):
            L[y]['frv%d' % pos] = lb('fielding_run_value_pos%d' % pos, y, 'id')
    return L


def per_event_sd(L, board, val, cnt, minn=3):
    """the event-to-event sd behind a leaderboard average, from players on both years' boards: the squared
    change between seasons regressed on (1/n25 + 1/n26), weighted by its inverse expected variance. The slope is
    the sampling variance of one event (sigma^2); the intercept is real change between seasons (tau^2), kept apart.
    Returns (sigma, tau, players)."""
    pts = []
    for pid, r26 in L[2026][board].items():
        r25 = L[2025][board].get(pid)
        if not r25:
            continue
        a, b = fl(r25[0].get(val)), fl(r26[0].get(val))
        na, nb = fl(r25[0].get(cnt)), fl(r26[0].get(cnt))
        if None in (a, b, na, nb) or na < minn or nb < minn:
            continue
        pts.append((1 / na + 1 / nb, (b - a) ** 2))
    if len(pts) < 20:
        return None, None, len(pts)
    sig2, tau2 = st.mean(y for _, y in pts) / st.mean(x for x, _ in pts) / 2, 0.0
    for _ in range(20):                 # iteratively reweighted: var(diff^2) ~ 2 (sig2 x + tau2)^2
        w = [1 / max(sig2 * x + tau2, 1e-12) ** 2 for x, _ in pts]
        sw = sum(w); mx = sum(wi * x for wi, (x, _) in zip(w, pts)) / sw; my = sum(wi * y for wi, (_, y) in zip(w, pts)) / sw
        sxx = sum(wi * (x - mx) ** 2 for wi, (x, _) in zip(w, pts)); sxy = sum(wi * (x - mx) * (y - my) for wi, (x, y) in zip(w, pts))
        sig2 = max(sxy / sxx, 1e-9); tau2 = max(my - sig2 * mx, 0.0)
    return math.sqrt(sig2), math.sqrt(tau2), len(pts)


def lb_trait(L, board, pid, val, cnt, sigma):
    """a leaderboard average by year and pooled (2025 counted half), se = sigma / sqrt(n)"""
    out, num, den, den2 = {}, 0, 0, 0
    for y in YEARS:
        r = L[y][board].get(pid)
        if not r:
            continue
        v, n = fl(r[0].get(val)), fl(r[0].get(cnt)) if cnt else None
        if v is None:
            continue
        out[str(y)] = {'mean': rnd(v), 'n': int(n) if n is not None else None,
                       'se': rnd(sigma / math.sqrt(n)) if sigma and n else None}
        if n:
            num += W[y] * n * v; den += W[y] * n; den2 += (W[y] * n) ** 2 / n
    if den:
        neff = den * den / den2
        out['pooled'] = {'mean': rnd(num / den), 'n': int(sum(out[k]['n'] or 0 for k in out)),
                         'se': rnd(sigma / math.sqrt(neff)) if sigma else None}
    elif out:
        out['pooled'] = dict(out[max(out)])
    return out or None


# ---- hitters --------------------------------------------------------------------------------
def hitter(pid, L, sig):
    raw = rows_of('batter', pid)
    if not raw:
        return None, {}
    P = [prep(r) for r in raw]
    A = lambda: Acc()
    bs, bs50, sl, att, tilt = A(), A(), A(), A(), A()
    pull_bip, pull_con, pull_sw, spray = A(), A(), A(), A()
    depth = {k: A() for k in ('all',) + KINDS}
    swing_band = {(b, k): A() for b in BANDS for k in KINDS}
    chase, zswing = A(), A()
    wh = {k: A() for k in KINDS + ('all',)}
    fo = {k: A() for k in KINDS + ('all',)}
    K, BB, IBB, HBP = A(), A(), A(), A()
    ev, hard = A(), A()
    la = {k: A() for k in ('GB', 'LD', 'FB', 'PU')}
    lma = {k: A() for k in HBANDS}
    fps, tss = A(), A()
    tracked = {y: 0 for y in YEARS}
    for p, r in zip(P, raw):
        y = p['y']
        if p['swing']:
            v = fl(r['bat_speed'])
            if v is not None:
                tracked[y] += 1
                bs.add(y, v)
                if v >= 50:
                    bs50.add(y, v)
                sl.add(y, fl(r['swing_length']))
            tilt.add(y, fl(r['swing_path_tilt']))
            ad = fl(r['attack_direction'])
            if ad is not None:
                pull_sw.add(y, -ad)
            if p['kind']:
                wh[p['kind']].add(y, 1 if p['desc'] in WHIFF else 0)
                fo[p['kind']].add(y, 1 if p['desc'] in FOUL else 0)
            wh['all'].add(y, 1 if p['desc'] in WHIFF else 0)
            fo['all'].add(y, 1 if p['desc'] in FOUL else 0)
        if p['contact']:
            att.add(y, fl(r['attack_angle']))
            ad = fl(r['attack_direction'])
            if ad is not None:
                pull_con.add(y, -ad)
            dep = fl(r['intercept_ball_minus_batter_pos_y_inches'])
            if dep is not None:
                depth['all'].add(y, dep)
                if p['kind']:
                    depth[p['kind']].add(y, dep)
        if p['bip']:
            ad = fl(r['attack_direction'])
            if ad is not None:
                pull_bip.add(y, -ad)
            hx, hy = fl(r['hc_x']), fl(r['hc_y'])
            if None not in (hx, hy):
                sp = math.degrees(math.atan2(hx - HC_X0, HC_Y0 - hy))
                spray.add(y, -sp if p['stand'] == 'R' else sp)
            s, a = fl(r['launch_speed']), fl(r['launch_angle'])
            if s is not None:
                ev.add(y, s); hard.add(y, 1 if s >= 95 else 0)
            if a is not None:
                k = 'GB' if a < 10 else 'LD' if a < 25 else 'FB' if a < 50 else 'PU'
                for kk in la:
                    la[kk].add(y, 1 if kk == k else 0)
                aa = fl(r['attack_angle'])
                if aa is not None and 'h' in p:
                    lma[hband(p['h'])].add(y, a - aa)
        # take-or-swing tables: every pitch with a location, bunts left out
        if 'd' in p and not p['bunt'] and p['desc'] not in ('pitchout', 'intent_ball', 'hit_by_pitch'):
            sw = 1 if p['swing'] else 0
            if p['kind']:
                swing_band[(band(p['d']), p['kind'])].add(y, sw)
            (zswing if p['d'] >= 0 else chase).add(y, sw)
        if not p['bunt'] and p['desc'] not in ('pitchout', 'intent_ball'):
            if p['b'] == 0 and p['s'] == 0:
                fps.add(y, 1 if p['swing'] else 0)
            if p['s'] == 2:
                tss.add(y, 1 if p['swing'] else 0)
        if is_pa(p['ev']):
            K.add(y, 1 if p['ev'].startswith('strikeout') else 0)
            BB.add(y, 1 if p['ev'] in ('walk', 'intent_walk') else 0)
            IBB.add(y, 1 if p['ev'] == 'intent_walk' else 0)
            HBP.add(y, 1 if p['ev'] == 'hit_by_pitch' else 0)
    tr = {
        'batSpeed': summ(bs), 'batSpeed50plus': summ(bs50), 'swingLenFt': summ(sl),
        'attack': summ(att), 'swingTilt': summ(tilt),
        'pullBias': {'bip': summ(pull_bip), 'contact': summ(pull_con), 'allSwings': summ(pull_sw)},
        'sprayPulledDeg_bip': summ(spray),
        'contactDepthIn': {k: summ(v) or {} for k, v in depth.items()},
        'speed': lb_trait(L, 'sprint', pid, 'sprint_speed', 'competitive_runs', sig['sprint']),
    }
    for k, v in tr['contactDepthIn'].items():          # the sd's own sampling error (normal theory), for the timing fit
        for yk, s in v.items():
            if s and s.get('sd') is not None and s['n'] > 1:
                s['se_of_sd'] = rnd(s['sd'] / math.sqrt(2 * ((s.get('n_eff') or s['n']) - 1)))
    summaries = {
        'swingRateByBandKind': {'%s|%s' % bk: summ(a, rate=True) for bk, a in swing_band.items() if a.n()},
        'chaseRate': summ(chase, rate=True), 'zoneSwingRate': summ(zswing, rate=True),
        'whiffPerSwing': {k: summ(a, rate=True) for k, a in wh.items() if a.n()},
        'foulPerSwing': {k: summ(a, rate=True) for k, a in fo.items() if a.n()},
        'K_pct': summ(K, rate=True), 'BB_pct': summ(BB, rate=True), 'IBB_pct': summ(IBB, rate=True), 'HBP_pct': summ(HBP, rate=True),
        'exitVelo_bip': dict(summ(ev) or {}, quantiles=quantiles(ev)) if ev.n() else None,
        'hardHit95_share': summ(hard, rate=True),
        'launchAngleShare': {k: summ(a, rate=True) for k, a in la.items() if a.n()},
        'laMinusAttack_byHeight': {k: summ(a) for k, a in lma.items() if a.n()},
        'firstPitchSwingRate': summ(fps, rate=True), 'twoStrikeSwingRate': summ(tss, rate=True),
    }
    gt = {}
    for r in raw:
        gt['%s_%s' % (r['_y'], r['game_type'])] = gt.get('%s_%s' % (r['_y'], r['game_type']), 0) + 1
    meta = {'pitchesSeen': gt, 'trackedSwings': {str(y): n for y, n in tracked.items()}}
    return tr, dict(summaries, sampleSizes=meta)


def leaderboard_hitting(L, pid):
    out = {}
    for y in YEARS:
        b, p = L[y]['bat'].get(pid), L[y]['path'].get(pid)
        if b or p:
            rec = {}
            if b:
                rec.update({k: fl(b[0].get(k)) for k in ('swings_competitive', 'avg_bat_speed', 'swing_length', 'squared_up_per_swing',
                                                          'squared_up_per_bat_contact', 'blast_per_swing', 'hard_swing_rate')})
            if p:
                rec['swingPath'] = [{k: (fl(r.get(k)) if k != 'side' else r.get(k)) for k in
                                     ('side', 'swing_tilt', 'attack_angle', 'attack_direction', 'avg_intercept_y_vs_batter',
                                      'avg_intercept_y_vs_plate', 'ideal_attack_angle_rate', 'competitive_swings')} for r in p]
            out[str(y)] = rec
    return out


def fielding(L, pid, sig):
    """by position: Outs Above Average, fielding run value and arm strength; catchers' pop time and framing"""
    POS = {2: 'C', 3: '1B', 4: '2B', 5: '3B', 6: 'SS', 7: 'LF', 8: 'CF', 9: 'RF'}
    out = {}
    for code, pos in POS.items():
        rec = {}
        for y in YEARS:
            yr = {}
            o = L[y].get('oaa%d' % code, {}).get(pid)
            if o:
                yr['oaa'] = fl(o[0].get('outs_above_average')); yr['fieldingRunsPrevented_oaa'] = fl(o[0].get('fielding_runs_prevented'))
            f = L[y].get('frv%d' % code, {}).get(pid)
            if f:
                yr['frv'] = fl(f[0].get('total_runs')); yr['frv_outs'] = fl(f[0].get('outs_total'))
                for k in ('range_runs', 'arm_runs', 'framing_runs', 'throwing_runs', 'blocking_runs'):
                    if f[0].get(k):
                        yr[k] = fl(f[0][k])
            a = L[y]['arm'].get(pid)
            key = pos.lower()
            if a and code >= 3 and fl(a[0].get('arm_%s' % key)) is not None:
                n = fl(a[0].get('total_throws_%s' % key))
                yr['armMph'] = {'mean': fl(a[0]['arm_%s' % key]), 'n': int(n) if n else None,
                                'se': rnd(sig['arm'] / math.sqrt(n)) if sig['arm'] and n else None}
            if yr:
                rec[str(y)] = yr
        if rec:
            out[pos] = rec
    tr = {'armMph': lb_trait(L, 'arm', pid, 'arm_overall', 'total_throws', sig['arm'])}
    pop = lb_trait(L, 'pop', pid, 'pop_2b_sba', 'pop_2b_sba_count', sig['pop'])
    if pop:
        tr['popTime'] = pop
        tr['catcherArmMph'] = lb_trait(L, 'pop', pid, 'maxeff_arm_2b_3b_sba', 'pop_2b_sba_count', None)
        tr['exchangeS'] = lb_trait(L, 'pop', pid, 'exchange_2b_3b_sba', 'pop_2b_sba_count', None)
    fr = {}
    for y in YEARS:
        r = L[y]['framing'].get(pid)
        f = L[y]['frv'].get(pid)
        if r or (f and f[0].get('framing_runs')):
            fr[str(y)] = {'framingRuns': fl(r[0]['rv_tot']) if r else None, 'pitches': fl(r[0]['pitches']) if r else None,
                          'strikeRateAdded_pct': fl(r[0].get('pct_tot')) if r else None,
                          'framingRuns_frv': fl(f[0]['framing_runs']) if f and f[0].get('framing_runs') else None}
    if fr:
        tr['framing'] = fr
    return tr, out


# ---- pitchers -------------------------------------------------------------------------------
def circ(degs):
    if not degs:
        return None
    s = sum(math.sin(math.radians(d)) for d in degs) / len(degs)
    c = sum(math.cos(math.radians(d)) for d in degs) / len(degs)
    Rb = math.hypot(s, c)
    return {'mean': round(math.degrees(math.atan2(s, c)) % 360, 1), 'circSd': round(math.degrees(math.sqrt(-2 * math.log(max(Rb, 1e-9)))), 1),
            'n': len(degs)}


def scatter(pts):
    """pooled scatter about each cell's own mean; pts = [(cell, x, z)]; cells under 5 skipped;
    each cell's variance corrected by n/(n-1); cells pooled weighted by n. Returns (sx, sz, n)."""
    cells = {}
    for c, x, z in pts:
        cells.setdefault(c, []).append((x, z))
    vx = vz = n = 0
    for v in cells.values():
        k = len(v)
        if k < 5:
            continue
        mx = sum(a for a, _ in v) / k; mz = sum(b for _, b in v) / k
        vx += sum((a - mx) ** 2 for a, _ in v) / (k - 1) * k
        vz += sum((b - mz) ** 2 for _, b in v) / (k - 1) * k
        n += k
    return (math.sqrt(vx / n), math.sqrt(vz / n), n) if n else (None, None, 0)


def command(pts_by_year, seed):
    """per year and pooled scatter (in), with the split-half check: one seeded half-split, and the rms of the
    half-to-half difference over 200 random splits (se of the full-sample value ~ that rms / 2)"""
    out = {}
    pooled_vx = pooled_vz = pooled_w = 0
    for y in YEARS:
        pts = pts_by_year.get(y, [])
        sx, sz, n = scatter(pts)
        if not n:
            continue
        rng = random.Random(seed * 10 + y)
        dx, dz, first = [], [], None
        for i in range(200):
            idx = list(range(len(pts)))
            rng.shuffle(idx)
            h = len(idx) // 2
            a = scatter([pts[j] for j in idx[:h]]); b = scatter([pts[j] for j in idx[h:]])
            if a[2] and b[2]:
                dx.append(a[0] - b[0]); dz.append(a[1] - b[1])
                if first is None:
                    first = {'halfA': [rnd(a[0]), rnd(a[1])], 'halfB': [rnd(b[0]), rnd(b[1])],
                             'diff': [rnd(a[0] - b[0]), rnd(a[1] - b[1])]}
        rx = math.sqrt(st.mean([d * d for d in dx])) if dx else None
        rz = math.sqrt(st.mean([d * d for d in dz])) if dz else None
        out[str(y)] = {'x': rnd(sx), 'z': rnd(sz), 'n': n, 'splitHalf': first,
                       'rmsHalfDiff': [rnd(rx), rnd(rz)], 'se': [rnd(rx / 2) if rx else None, rnd(rz / 2) if rz else None]}
        pooled_vx += W[y] * n * sx * sx; pooled_vz += W[y] * n * sz * sz; pooled_w += W[y] * n
    if pooled_w:
        ses = [(W[int(y)] * v['n']) ** 2 * (v['se'][0] or 0) ** 2 for y, v in out.items()]
        sez = [(W[int(y)] * v['n']) ** 2 * (v['se'][1] or 0) ** 2 for y, v in out.items()]
        out['pooled'] = {'x': rnd(math.sqrt(pooled_vx / pooled_w)), 'z': rnd(math.sqrt(pooled_vz / pooled_w)),
                         'n': sum(v['n'] for v in out.values()),
                         'se': [rnd(math.sqrt(sum(ses)) / pooled_w), rnd(math.sqrt(sum(sez)) / pooled_w)]}
    return out


def pitcher(pid, throws, L, stats):
    raw = rows_of('pitcher', pid)
    if not raw:
        return None, {}
    P = [prep(r) for r in raw]
    A = lambda: Acc()
    arm, ext, rz, rx = A(), A(), A(), A()
    types = sorted({p['pt'] for p in P if p['pt']})
    usage = {t: A() for t in types}
    usage_cell = {(t, c, s): A() for t in types for c in CGROUPS for s in SIDES}
    velo, rpm, hb, ivb = ({t: A() for t in types} for _ in range(4))
    axis = {t: {y: [] for y in YEARS} for t in types}
    loc = {(t, c, s): (A(), A()) for t in types for c in CGROUPS for s in SIDES}
    cmd_pts = {t: {y: [] for y in YEARS} for t in types}
    whiff = {t: A() for t in types}
    K, BB, zone, chase = A(), A(), A(), A()
    games = {}
    sgn = -1 if throws == 'R' else 1          # + = toward his arm side
    for p, r in zip(P, raw):
        y, t = p['y'], p['pt']
        games.setdefault((y, r['game_pk']), [r['game_date'], 0])[1] += 1
        arm.add(y, fl(r['arm_angle'])); ext.add(y, fl(r['release_extension']))
        rz.add(y, fl(r['release_pos_z'])); rx.add(y, fl(r['release_pos_x']))
        if not t or p['desc'] == 'pitchout':
            continue
        same = 'same' if p['stand'] == throws else 'opp'
        cg = cgroup(p['b'], p['s'])
        for tt in types:
            usage[tt].add(y, 1 if tt == t else 0)
            usage_cell[(tt, cg, same)].add(y, 1 if tt == t else 0)
        velo[t].add(y, fl(r['release_speed'])); rpm[t].add(y, fl(r['release_spin_rate']))
        if fl(r['spin_axis']) is not None:
            axis[t][y].append(fl(r['spin_axis']))
        px, pz = fl(r['pfx_x']), fl(r['pfx_z'])
        if px is not None:
            hb[t].add(y, sgn * px * 12)
        if pz is not None:
            ivb[t].add(y, pz * 12)
        if 'away' in p:
            loc[(t, cg, same)][0].add(y, p['away']); loc[(t, cg, same)][1].add(y, p['h'])
            if p['desc'] != 'intent_ball':
                cmd_pts[t][y].append(((cg, same), p['away'], p['zin']))
            if p['desc'] != 'intent_ball' and not p['bunt']:
                zone.add(y, 1 if p['d'] >= 0 else 0)
                if p['d'] < 0:
                    chase.add(y, 1 if p['swing'] else 0)
        if p['swing']:
            whiff[t].add(y, 1 if p['desc'] in WHIFF else 0)
        if is_pa(p['ev']):
            K.add(y, 1 if p['ev'].startswith('strikeout') else 0)
            BB.add(y, 1 if p['ev'] in ('walk', 'intent_walk') else 0)
    # use: appearances, pitches per appearance, days between appearances
    use = {}
    for y in YEARS:
        g = sorted(v for (yy, _), v in games.items() if yy == y)
        if not g:
            continue
        counts = [n for _, n in g]
        dates = sorted({d for d, _ in g})
        rest = [(datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days - 1 for a, b in zip(dates, dates[1:])]
        use[str(y)] = {'appearances': len(g), 'pitchesPerApp': {'mean': rnd(st.mean(counts)), 'p90': rnd(pct(counts, .9)), 'max': max(counts)},
                       'daysRest': {'mean': rnd(st.mean(rest)) if rest else None, 'median': st.median(rest) if rest else None,
                                    'share0': rnd(sum(x == 0 for x in rest) / len(rest)) if rest else None,
                                    'share4plus': rnd(sum(x >= 4 for x in rest) / len(rest)) if rest else None, 'n': len(rest)}}
    role = None
    for y in (2026, 2025):
        s = (stats or {}).get('pitching_%d' % y)
        if s and s.get('G'):
            role = {'role': 'SP' if (s.get('GS') or 0) >= 0.5 * s['G'] else 'RP', 'from': y, 'G': s['G'], 'GS': s.get('GS')}
            break
    # leaderboard arm angle (pitch-weighted) and active spin
    lb_arm = {}
    for y in YEARS:
        a = L[y]['armangle'].get(pid)
        if a:
            lb_arm[str(y)] = {'mean': fl(a[0]['ball_angle']), 'n': int(fl(a[0]['n_pitches']) or 0)}
    pt = {}
    for t in types:
        if usage[t].n() == 0 or (velo[t].n() == 0):
            continue
        rec = {'kind': KIND.get(t, 'other'), 'engineType': t in ENGINE_TYPES,
               'usage': summ(usage[t], rate=True),
               'usageByCountSide': {'%s|%s' % (c, s): summ(usage_cell[(t, c, s)], rate=True) for c in CGROUPS for s in SIDES
                                    if usage_cell[(t, c, s)].n()},
               'velo': summ(velo[t]), 'rpm': summ(rpm[t]),
               'spinAxis': {str(y): circ(axis[t][y]) for y in YEARS if axis[t][y]},
               'hbArmIn': summ(hb[t]), 'ivbIn': summ(ivb[t]),
               'locByCountSide': {'%s|%s' % (c, s): {'awayIn': summ(loc[(t, c, s)][0]), 'h': summ(loc[(t, c, s)][1])}
                                  for c in CGROUPS for s in SIDES if loc[(t, c, s)][0].n()},
               'whiffPerSwing': summ(whiff[t], rate=True)}
        asp = {}
        for y in YEARS:
            a = L[y]['spin'].get(pid)
            if a:
                for lk, lt in LB_TYPES.items():
                    if lt == t and fl(a[0].get('active_spin_%s' % lk)) is not None:
                        asp[str(y)] = fl(a[0]['active_spin_%s' % lk])
        if asp:
            rec['activeSpin'] = asp
        npt = sum(len(v) for v in cmd_pts[t].values())
        if npt >= 60:
            rec['command'] = command(cmd_pts[t], pid % 100000 + ENGINE_TYPES.index(t) if t in ENGINE_TYPES else pid % 100000)
        pt[t] = rec
    tr = {'armAngle': summ(arm), 'armAngle_leaderboard': lb_arm or None, 'ext': summ(ext),
          'releaseHeightFt': summ(rz), 'releaseSideFt': summ(rx),
          'releaseSide_note': 'release_pos_x as Statcast gives it (catcher\'s view, + toward first base)'}
    fb = pt.get('FF') or pt.get('SI')
    if fb:
        tr['fbVelo'] = dict(fb['velo'], type='FF' if 'FF' in pt else 'SI')
    gt = {}
    for r in raw:
        gt['%s_%s' % (r['_y'], r['game_type'])] = gt.get('%s_%s' % (r['_y'], r['game_type']), 0) + 1
    other = sorted(t for t in types if t not in ENGINE_TYPES)
    summaries = {'role': role, 'use': use, 'pitchTypes': pt, 'otherTypes': other,
                 'K_pct': summ(K, rate=True), 'BB_pct': summ(BB, rate=True), 'zoneRate': summ(zone, rate=True),
                 'chaseRate': summ(chase, rate=True), 'sampleSizes': {'pitchesThrown': gt}}
    return tr, summaries


# ---- main -----------------------------------------------------------------------------------
def headline(v, key='pooled'):
    if not v or not isinstance(v, dict) or key not in v or not v[key]:
        return (None, None)
    return (v[key].get('mean'), v[key].get('se'))


def main():
    R = json.load(open(os.path.join(HERE, 'rosters.json')))
    S = json.load(open(os.path.join(HERE, 'season_stats.json')))['players']
    L = load_lbs()
    sig, tau = {}, {}
    for name, board, val, cnt in (('sprint', 'sprint', 'sprint_speed', 'competitive_runs'), ('arm', 'arm', 'arm_overall', 'total_throws'),
                                  ('pop', 'pop', 'pop_2b_sba', 'pop_2b_sba_count')):
        sig[name], tau[name], nboth = per_event_sd(L, board, val, cnt)
        print('per-event sd behind %s: %s; real change between seasons sd %s (%d players on both boards)' % (
            name, sig[name] and round(sig[name], 3), tau[name] and round(tau[name], 3), nboth))
    out, flat = [], []
    for p in R['players']:
        rec = {'id': p['id'], 'name': p['name'], 'team': p['teamAbbrev'], 'teamId': p['team'], 'kind': p['kind'],
               'position': p['position'], 'bats': p['bats'], 'throws': p['throws'], 'heightIn': p['heightIn'],
               'weightLb': p['weightLb'], 'age': p['age'], 'traits': {}, 'summaries': {}}
        roles = []
        if p['kind'] in ('position', 'two-way'):
            roles.append('hitter')
            tr, sm = hitter(p['id'], L, sig)
            if tr:
                rec['traits'].update(tr)
                rec['summaries']['hitting'] = sm
            else:
                rec['traits']['speed'] = lb_trait(L, 'sprint', p['id'], 'sprint_speed', 'competitive_runs', sig['sprint'])
            rec['summaries']['batTrackingLeaderboard'] = leaderboard_hitting(L, p['id'])
            ft, fpos = fielding(L, p['id'], sig)
            rec['traits'].update({k: v for k, v in ft.items() if v})
            rec['fieldingByPosition'] = fpos
        if p['kind'] in ('pitcher', 'two-way'):
            roles.append('pitcher')
            tr, sm = pitcher(p['id'], p['throws'], L, S.get(str(p['id'])))
            if tr:
                rec['traits']['pitching'] = tr
                rec['summaries']['pitching'] = sm
            elif S.get(str(p['id'])):
                rec['summaries']['pitching'] = {'role': None}
        rec['role'] = '+'.join(roles)
        years = set()
        for side in ('hitting', 'pitching'):
            ss = rec['summaries'].get(side, {}).get('sampleSizes', {})
            for k, v in list(ss.get('pitchesSeen', {}).items()) + list(ss.get('pitchesThrown', {}).items()):
                if v:
                    years.add(int(k[:4]))
        rec['statcastYears'] = sorted(years)
        rec['seasonStats'] = S.get(str(p['id']))
        out.append(rec)
        t = rec['traits']
        pit = t.get('pitching', {})
        row = {'id': p['id'], 'name': p['name'], 'team': p['teamAbbrev'], 'kind': p['kind'], 'pos': p['position'],
               'bats': p['bats'], 'throws': p['throws'], 'heightIn': p['heightIn'], 'weightLb': p['weightLb'], 'age': p['age'],
               'statcastYears': ' '.join(map(str, rec['statcastYears']))}
        for k in ('batSpeed', 'swingLenFt', 'attack', 'swingTilt', 'speed', 'armMph', 'popTime'):
            row[k], row[k + '_se'] = headline(t.get(k))
        row['pullBias'], row['pullBias_se'] = headline((t.get('pullBias') or {}).get('bip'))
        cd = (t.get('contactDepthIn') or {}).get('all', {}).get('pooled') or {}
        row['contactDepthSd'], row['contactDepthSd_se'] = cd.get('sd'), cd.get('se_of_sd')
        row['armAngle'], row['armAngle_se'] = headline(pit.get('armAngle'))
        row['ext'], row['ext_se'] = headline(pit.get('ext'))
        row['fbVelo'], row['fbVelo_se'] = headline(pit.get('fbVelo'))
        ff = ((rec['summaries'].get('pitching') or {}).get('pitchTypes') or {}).get('FF', {}).get('command', {}).get('pooled') or {}
        row['ffCmdX'], row['ffCmdZ'] = ff.get('x'), ff.get('z')
        row['ffCmdX_se'], row['ffCmdZ_se'] = (ff.get('se') or [None, None])
        row['spRole'] = ((rec['summaries'].get('pitching') or {}).get('role') or {}).get('role')
        flat.append(row)
    meta = {'written': datetime.date.today().isoformat(), 'by': 'playoffs/measure_traits.py v0.1',
            'weights': {'2026': 1.0, '2025': 0.5},
            'leaderboardSe': {'perEventSd': {k: rnd(v) for k, v in sig.items()}, 'seasonToSeasonChangeSd': {k: rnd(v) for k, v in tau.items()},
                              'note': 'se of a leaderboard average = perEventSd / sqrt(n events); fitted from players on both years\' boards (per_event_sd)'},
            'note': 'See the docstring of measure_traits.py and playoffs/README.md for every definition.'}
    json.dump({'meta': meta, 'players': out}, open(os.path.join(HERE, 'players_measured.json'), 'w'), indent=None, separators=(',', ':'))
    with open(os.path.join(HERE, 'players_measured.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(flat[0].keys()))
        w.writeheader()
        w.writerows(flat)
    print('%d players written' % len(out))


if __name__ == '__main__':
    main()
