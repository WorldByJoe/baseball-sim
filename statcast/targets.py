"""
targets.py · v0.2 · 2026-09-30

Turns the raw Savant leaderboards and the MLB player list (statcast/raw/<year>/)
into the empirical TARGETS for the latent-trait layer: for each measurable,
its distribution ACROSS PLAYERS (n, mean, sd, 5/25/50/75/95th percentiles),
and the cross-correlations between measurables, which a latent layer with
shared traits must reproduce without being told. Writes
STATCAST_TARGETS_<year>.md (for reading) and targets_<year>.json (for fitting).

Derived proxies, labelled as such:
  power_proxy  = bat_speed^3 / swing_length  (kinetic energy over swing time,
                 up to constants: mph^3/ft); per_kg divides by body mass
  speed-accuracy: squared-up rate against bat speed, across players

Run:  python3 statcast/targets.py 2025

CHANGED
  v0.2  the tails: top/bottom names, max in sd units against a normal's expected max, skew (Joe: do the exceptional survive a normal draw?)
  v0.1  first build (tempo read by column position: the Savant header repeats a name)
"""
import sys, os, csv, json, math, re
from collections import defaultdict

def load(year, name):
    p = os.path.join('statcast', 'raw', str(year), name + '.csv')
    if not os.path.exists(p): return []
    with open(p, encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))

def num(v):
    try:
        v = str(v).strip().replace('%', '')
        return float(v) if v not in ('', 'NA', 'null', '--') else None
    except ValueError:
        return None

def height_in(h):            # "6' 7\"" -> 79
    m = re.match(r"(\d+)'\s*(\d+)", str(h or ''))
    return int(m.group(1)) * 12 + int(m.group(2)) if m else None

def stats(vals):
    v = sorted(x for x in vals if x is not None and not math.isnan(x))
    n = len(v)
    if n < 5: return None
    mean = sum(v) / n; sd = math.sqrt(sum((x - mean) ** 2 for x in v) / (n - 1))
    def pct(p):
        k = (n - 1) * p; lo = int(math.floor(k)); hi = min(lo + 1, n - 1)
        return v[lo] + (v[hi] - v[lo]) * (k - lo)
    skew = sum((x - mean) ** 3 for x in v) / n / sd ** 3 if sd > 0 else 0
    kurt = sum((x - mean) ** 4 for x in v) / n / sd ** 4 - 3 if sd > 0 else 0
    return { 'n': n, 'mean': mean, 'sd': sd, 'p5': pct(0.05), 'p25': pct(0.25), 'p50': pct(0.5), 'p75': pct(0.75), 'p95': pct(0.95),
             'min': v[0], 'max': v[-1], 'skew': skew, 'kurt': kurt }

def corr(xs, ys):
    pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    n = len(pairs)
    if n < 20: return None, n
    mx = sum(p[0] for p in pairs) / n; my = sum(p[1] for p in pairs) / n
    sxx = sum((p[0] - mx) ** 2 for p in pairs); syy = sum((p[1] - my) ** 2 for p in pairs)
    sxy = sum((p[0] - mx) * (p[1] - my) for p in pairs)
    return (sxy / math.sqrt(sxx * syy) if sxx > 0 and syy > 0 else None), n

def main(year):
    # ---------------------------------------------------------------- players
    people = json.load(open(os.path.join('statcast', 'raw', str(year), 'players.json')))['people']
    P = {}
    for q in people:
        P[q['id']] = { 'name': q.get('fullName'), 'height': height_in(q.get('height')), 'weight': num(q.get('weight')),
                       'bats': (q.get('batSide') or {}).get('code'), 'throws': (q.get('pitchHand') or {}).get('code'),
                       'pos': (q.get('primaryPosition') or {}).get('abbreviation'), 'age': num(q.get('currentAge')) }
    # ---------------------------------------------------------------- hitters
    H = defaultdict(dict)
    def put(rows, idkey, fields):
        for r in rows:
            pid = num(r.get(idkey))
            if pid is None: continue
            pid = int(pid)
            for k, col in fields.items():
                H[pid][k] = num(r.get(col))
    put(load(year, 'bat_tracking'), 'id', { 'bat_speed': 'avg_bat_speed', 'hard_swing_rate': 'hard_swing_rate', 'squared_up_per_contact': 'squared_up_per_bat_contact',
        'squared_up_per_swing': 'squared_up_per_swing', 'blast_per_contact': 'blast_per_bat_contact', 'blast_per_swing': 'blast_per_swing',
        'swing_length': 'swing_length', 'whiff_per_swing': 'whiff_per_swing', 'competitive_swings': 'swings_competitive' })
    put(load(year, 'swing_path'), 'id', { 'attack_angle': 'attack_angle', 'swing_tilt': 'swing_tilt', 'attack_direction': 'attack_direction',
        'ideal_attack_angle_rate': 'ideal_attack_angle_rate', 'intercept_y_vs_plate': 'avg_intercept_y_vs_plate' })
    put(load(year, 'batter_statcast'), 'player_id', { 'ev_avg': 'avg_hit_speed', 'ev50': 'ev50', 'ev_max': 'max_hit_speed', 'la_avg': 'avg_hit_angle',
        'sweet_spot_pct': 'anglesweetspotpercent', 'barrel_pct_bbe': 'brl_percent', 'barrel_pct_pa': 'brl_pa', 'hard_hit_pct': 'ev95percent', 'hr_distance_avg': 'avg_hr_distance', 'max_distance': 'max_distance' })
    put(load(year, 'batter_custom'), 'player_id', { 'k_pct': 'k_percent', 'bb_pct': 'bb_percent', 'xwoba': 'xwoba', 'chase_pct': 'oz_swing_percent',
        'iz_contact_pct': 'iz_contact_percent', 'oz_contact_pct': 'oz_contact_percent', 'whiff_pct': 'whiff_percent', 'swing_pct': 'swing_percent',
        'pull_pct': 'pull_percent', 'oppo_pct': 'opposite_percent', 'gb_pct': 'groundballs_percent', 'fb_pct': 'flyballs_percent', 'pu_pct': 'popups_percent' })
    put(load(year, 'sprint_speed'), 'player_id', { 'sprint_speed': 'sprint_speed', 'hp_to_1b': 'hp_to_1b', 'bolts': 'bolts' })
    put(load(year, 'outfield_jump'), 'resp_fielder_id', { 'jump_reaction': 'rel_league_reaction_distance', 'jump_burst': 'rel_league_burst_distance',
        'jump_route': 'rel_league_routing_distance', 'jump_bootup': 'f_bootup_distance' })
    put(load(year, 'arm_strength'), 'player_id', { 'arm_overall': 'arm_overall', 'arm_max': 'max_arm_strength', 'arm_of': 'arm_of', 'arm_inf': 'arm_inf' })
    # running splits: time to 30, 60, 90 ft from contact (the acceleration profile)
    for r in load(year, 'running_splits'):
        pid = num(r.get('player_id'))
        if pid is None: continue
        pid = int(pid)
        for ft in (30, 45, 60, 90):
            H[pid]['run_t%d' % ft] = num(r.get('seconds_since_hit_%03d' % ft))
    # base stealing: leads, attempt rate, success
    for r in load(year, 'basestealing'):
        pid = num(r.get('player_id'))
        if pid is None or r.get('key_target_base') not in ('2B', '2', None, ''): pass
        if pid is None: continue
        pid = int(pid)
        if H[pid].get('steal_lead_primary') is None:
            H[pid]['steal_lead_primary'] = num(r.get('r_primary_lead')); H[pid]['steal_lead_secondary'] = num(r.get('r_secondary_lead'))
            H[pid]['steal_lead_primary_on_attempt'] = num(r.get('r_primary_lead_sbx')); H[pid]['steal_lead_secondary_on_attempt'] = num(r.get('r_secondary_lead_sbx'))
            ni, sb, cs = num(r.get('n_init')), num(r.get('n_sb')), num(r.get('n_cs'))
            H[pid]['steal_attempts'] = (sb or 0) + (cs or 0)
            H[pid]['steal_success'] = (sb / (sb + cs)) if sb is not None and cs is not None and (sb + cs) >= 5 else None
            H[pid]['steal_attempt_rate'] = ((sb or 0) + (cs or 0)) / ni if ni else None
    for pid, h in H.items():
        q = P.get(pid, {})
        h['height'] = q.get('height'); h['weight'] = q.get('weight'); h['age'] = q.get('age'); h['pos'] = q.get('pos'); h['name'] = q.get('name')
        if h.get('bat_speed') and h.get('swing_length') and h.get('weight'):
            h['power_proxy'] = h['bat_speed'] ** 3 / h['swing_length']
            h['power_proxy_per_kg'] = h['power_proxy'] / (h['weight'] * 0.4536)
    # ---------------------------------------------------------------- catchers
    C = {}
    for r in load(year, 'poptime'):
        pid = num(r.get('entity_id'))
        if pid is None: continue
        C[int(pid)] = { 'name': r.get('entity_name'), 'pop_2b': num(r.get('pop_2b_sba')), 'exchange': num(r.get('exchange_2b_3b_sba')), 'arm_maxeff': num(r.get('maxeff_arm_2b_3b_sba')), 'pop_3b': num(r.get('pop_3b_sba')) }
    for r in load(year, 'catcher_blocking'):
        pid = num(r.get('player_id'))
        if pid is None: continue
        C.setdefault(int(pid), {}).setdefault('name', r.get('player_name')); C[int(pid)].update({ 'blocks_above_avg_per_game': num(r.get('blocks_above_average_per_game')), 'pbwp_freq_tough': num(r.get('freq_pbwp_tough')),
                                            'pbwp_freq_medium': num(r.get('freq_pbwp_medium')), 'pbwp_freq_easy': num(r.get('freq_pbwp_easy')) })
    # ---------------------------------------------------------------- pitchers
    T = defaultdict(dict)
    for r in load(year, 'arsenal_speed'):
        pid = num(r.get('pitcher'));
        if pid is None: continue
        T[int(pid)].update({ 'ff_velo': num(r.get('ff_avg_speed')), 'si_velo': num(r.get('si_avg_speed')), 'sl_velo': num(r.get('sl_avg_speed')), 'cu_velo': num(r.get('cu_avg_speed')), 'ch_velo': num(r.get('ch_avg_speed')) })
    for r in load(year, 'arsenal_spin'):
        pid = num(r.get('pitcher'))
        if pid is None: continue
        T[int(pid)].update({ 'ff_spin': num(r.get('ff_avg_spin')), 'sl_spin': num(r.get('sl_avg_spin')), 'cu_spin': num(r.get('cu_avg_spin')), 'ch_spin': num(r.get('ch_avg_spin')) })
    for r in load(year, 'movement_FF'):
        pid = num(r.get('pitcher_id'))
        if pid is None: continue
        T[int(pid)].update({ 'ff_ivb': num(r.get('pitcher_break_z_induced')), 'ff_hb': num(r.get('pitcher_break_x')), 'ff_pitches': num(r.get('pitches_thrown')) })
    for r in load(year, 'arm_angle'):
        pid = num(r.get('pitcher'))
        if pid is None: continue
        T[int(pid)].update({ 'arm_angle': num(r.get('ball_angle')), 'release_height': num(r.get('release_ball_z')), 'release_side': num(r.get('relative_release_ball_x')), 'shoulder_height': num(r.get('shoulder_z')) })
    # pitch tempo: the header repeats 'median_seconds_empty' (the second one is with men on base), so read it by position
    tp = os.path.join('statcast', 'raw', str(year), 'pitch_tempo.csv')
    if os.path.exists(tp):
        with open(tp, encoding='utf-8-sig') as f:
            rows = list(csv.reader(f))
        hdr = rows[0]; idx = [i for i, h in enumerate(hdr) if h == 'median_seconds_empty']; iid = hdr.index('entity_id')
        for r in rows[1:]:
            pid = num(r[iid]) if len(r) > iid else None
            if pid is None or len(idx) < 2: continue
            T[int(pid)]['tempo_empty'] = num(r[idx[0]])   # the export repeats the empty-bases value in the men-on column, so the hold is not available here
    for r in load(year, 'pitcher_custom'):
        pid = num(r.get('player_id'))
        if pid is None: continue
        T[int(pid)].update({ 'p_k_pct': num(r.get('k_percent')), 'p_bb_pct': num(r.get('bb_percent')), 'p_whiff_pct': num(r.get('whiff_percent')), 'p_chase_pct': num(r.get('oz_swing_percent')), 'p_xwoba': num(r.get('xwoba')) })
    for r in load(year, 'pitcher_statcast'):
        pid = num(r.get('player_id'))
        if pid is None: continue
        T[int(pid)].update({ 'p_ev_avg': num(r.get('avg_hit_speed')), 'p_barrel_pct': num(r.get('brl_percent')) })
    for pid, t in T.items():
        q = P.get(pid, {})
        t['height'] = q.get('height'); t['weight'] = q.get('weight'); t['age'] = q.get('age'); t['throws'] = q.get('throws'); t['name'] = q.get('name')

    # ---------------------------------------------------------------- the sheet
    HIT = [('height', 'in'), ('weight', 'lb'), ('age', 'yr'), ('bat_speed', 'mph'), ('swing_length', 'ft'), ('hard_swing_rate', '%'), ('squared_up_per_contact', '%'), ('squared_up_per_swing', '%'),
           ('blast_per_contact', '%'), ('blast_per_swing', '%'), ('attack_angle', 'deg'), ('swing_tilt', 'deg'), ('attack_direction', 'deg'), ('ideal_attack_angle_rate', '%'), ('intercept_y_vs_plate', 'in'),
           ('power_proxy', 'mph^3/ft'), ('power_proxy_per_kg', 'mph^3/ft/kg'),
           ('ev_avg', 'mph'), ('ev50', 'mph'), ('ev_max', 'mph'), ('la_avg', 'deg'), ('sweet_spot_pct', '%'), ('barrel_pct_bbe', '%'), ('hard_hit_pct', '%'), ('hr_distance_avg', 'ft'),
           ('k_pct', '%'), ('bb_pct', '%'), ('chase_pct', '%'), ('iz_contact_pct', '%'), ('oz_contact_pct', '%'), ('whiff_pct', '%'), ('swing_pct', '%'), ('pull_pct', '%'), ('oppo_pct', '%'), ('gb_pct', '%'), ('fb_pct', '%'), ('pu_pct', '%'), ('xwoba', ''),
           ('sprint_speed', 'ft/s'), ('hp_to_1b', 's'), ('run_t30', 's'), ('run_t60', 's'), ('run_t90', 's'),
           ('jump_reaction', 'ft vs lg'), ('jump_burst', 'ft vs lg'), ('jump_route', 'ft vs lg'), ('arm_overall', 'mph'), ('arm_max', 'mph'),
           ('steal_lead_primary', 'ft'), ('steal_lead_secondary', 'ft'), ('steal_lead_primary_on_attempt', 'ft'), ('steal_lead_secondary_on_attempt', 'ft'), ('steal_attempt_rate', 'per opp'), ('steal_success', 'frac')]
    CAT = [('pop_2b', 's'), ('pop_3b', 's'), ('exchange', 's'), ('arm_maxeff', 'mph'), ('blocks_above_avg_per_game', ''), ('pbwp_freq_easy', 'share of pitches'), ('pbwp_freq_medium', 'share of pitches'), ('pbwp_freq_tough', 'share of pitches')]
    PIT = [('height', 'in'), ('weight', 'lb'), ('age', 'yr'), ('ff_velo', 'mph'), ('si_velo', 'mph'), ('sl_velo', 'mph'), ('cu_velo', 'mph'), ('ch_velo', 'mph'), ('ff_spin', 'rpm'), ('sl_spin', 'rpm'), ('cu_spin', 'rpm'), ('ch_spin', 'rpm'),
           ('ff_ivb', 'in'), ('ff_hb', 'in'), ('arm_angle', 'deg'), ('release_height', 'ft'), ('release_side', 'ft'), ('shoulder_height', 'ft'), ('tempo_empty', 's'),
           ('p_k_pct', '%'), ('p_bb_pct', '%'), ('p_whiff_pct', '%'), ('p_chase_pct', '%'), ('p_ev_avg', 'mph'), ('p_barrel_pct', '%')]
    out = { 'year': year, 'hitters': {}, 'catchers': {}, 'pitchers': {}, 'corr_hitters': [], 'corr_pitchers': [] }
    md = ['# Statcast targets, %d season' % year, '',
          'Per-player distributions of the measurables (Baseball Savant leaderboards, qualified players unless the board sets its own minimum; heights and weights from the MLB Stats API), pulled 2026-09-30 by `statcast/fetch_statcast.py`. These were the %d values; they are the targets the latent-trait layer must reproduce, and the cross-correlations are the test it must pass without being told.' % year, '',
          'Derived proxies are labelled: `power_proxy` = bat speed³ / swing length (kinetic energy over swing time, up to constants), `power_proxy_per_kg` divides by body mass.', '']
    def table(title, rows, src):
        md.append('## ' + title); md.append(''); md.append('| measurable | unit | n | mean | sd | 5% | 25% | 50% | 75% | 95% |'); md.append('|---|---|---|---|---|---|---|---|---|---|')
        res = {}
        for k, u in rows:
            s = stats([v.get(k) for v in src.values()])
            if not s: continue
            res[k] = dict(s, unit=u)
            f = (lambda x: ('%.3f' % x) if abs(x) < 10 else ('%.1f' % x) if abs(x) < 1000 else ('%.0f' % x))
            md.append('| %s | %s | %d | %s | %s | %s | %s | %s | %s | %s |' % (k, u, s['n'], f(s['mean']), f(s['sd']), f(s['p5']), f(s['p25']), f(s['p50']), f(s['p75']), f(s['p95'])))
        md.append('')
        return res
    def phi_inv(p):   # Acklam's approximation, good to 1e-9
        a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
        b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
        c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
        d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
        if p < 0.02425:
            q = math.sqrt(-2 * math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
        if p > 1 - 0.02425:
            q = math.sqrt(-2 * math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
        q = p - 0.5; r = q * q
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
    def tails(title, keys, src, nameKey='name'):
        md.append('## ' + title); md.append('')
        md.append('For each measurable: the top three and bottom three (name, value), the observed extreme in sd units, the extreme a NORMAL with this mean and sd would give for this many players (E[max] ≈ μ + σ·Φ⁻¹(n/(n+1))), the excess (observed − normal, in sd), and the skew. Excess above ~0.7 sd or skew beyond ±0.5 means the tail is heavier than a normal draw of this trait would make it: the exceptional are more exceptional than the bell curve says.'); md.append('')
        md.append('| measurable | top 3 | bottom 3 | max z | normal max z | excess (sd) | min z | skew |'); md.append('|---|---|---|---|---|---|---|---|')
        res = {}
        for k in keys:
            rows = [(v.get(k), v.get(nameKey) or '?') for v in src.values() if v.get(k) is not None]
            if len(rows) < 20: continue
            rows.sort(key=lambda t: t[0]); vals = [t[0] for t in rows]
            st = stats(vals)
            if not st: continue
            z = lambda x: (x - st['mean']) / st['sd']
            zn = phi_inv(st['n'] / (st['n'] + 1.0))
            fmt = lambda t: '%s %s' % (t[1].split(',')[0] if ',' in t[1] else t[1].split(' ')[-1], ('%.3g' % t[0]) if abs(t[0]) < 100 else ('%.0f' % t[0]))
            top = '; '.join(fmt(t) for t in rows[-1:-4:-1]); bot = '; '.join(fmt(t) for t in rows[:3])
            res[k] = { 'max': st['max'], 'min': st['min'], 'max_z': z(st['max']), 'min_z': z(st['min']), 'normal_max_z': zn, 'excess_sd': z(st['max']) - zn, 'skew': st['skew'], 'kurt': st['kurt'],
                       'top3': rows[-1:-4:-1], 'bottom3': rows[:3] }
            md.append('| %s | %s | %s | %+.2f | %+.2f | %+.2f | %+.2f | %+.2f |' % (k, top, bot, z(st['max']), zn, z(st['max']) - zn, z(st['min']), st['skew']))
        md.append('')
        return res
    out['hitters'] = table('Hitters (n = qualified batters with bat tracking, %d)' % len([h for h in H.values() if h.get('bat_speed')]), HIT, H)
    out['tails_hitters'] = tails('Who holds the tails: hitters', ['height', 'weight', 'bat_speed', 'swing_length', 'squared_up_per_contact', 'blast_per_contact', 'attack_angle', 'power_proxy_per_kg', 'ev_avg', 'ev50', 'ev_max', 'barrel_pct_bbe', 'hard_hit_pct', 'hr_distance_avg', 'k_pct', 'bb_pct', 'chase_pct', 'whiff_pct', 'iz_contact_pct', 'sprint_speed', 'hp_to_1b', 'arm_overall', 'arm_max', 'steal_lead_secondary_on_attempt', 'xwoba'], H)
    out['catchers'] = table('Catchers', CAT, C)
    out['pitchers'] = table('Pitchers', PIT, T)
    out['tails_catchers'] = tails('Who holds the tails: catchers', ['pop_2b', 'exchange', 'arm_maxeff', 'blocks_above_avg_per_game'], C, 'name')
    out['tails_pitchers'] = tails('Who holds the tails: pitchers', ['height', 'weight', 'ff_velo', 'ff_spin', 'ff_ivb', 'arm_angle', 'release_height', 'p_k_pct', 'p_whiff_pct'], T)
    def corrtable(title, keys, src, store):
        md.append('## ' + title); md.append(''); md.append('Pearson r across players (n in brackets); only |r| ≥ 0.25 shown, sorted by |r|.'); md.append('')
        rows = []
        for i, a in enumerate(keys):
            for b in keys[i + 1:]:
                r, n = corr([v.get(a) for v in src.values()], [v.get(b) for v in src.values()])
                if r is not None: store.append({ 'a': a, 'b': b, 'r': r, 'n': n })
                if r is not None and abs(r) >= 0.25: rows.append((abs(r), a, b, r, n))
        rows.sort(reverse=True)
        for _, a, b, r, n in rows: md.append('- %s ~ %s: r = %+.2f (%d)' % (a, b, r, n))
        md.append('')
    # the speed-accuracy trade-off and the body-to-bat-speed link, spelled out
    md.append('## Relationships the latent layer must get right (unfitted tests)'); md.append('')
    for a, b in [('bat_speed', 'squared_up_per_contact'), ('bat_speed', 'whiff_pct'), ('bat_speed', 'ev50'), ('weight', 'bat_speed'), ('height', 'bat_speed'), ('bat_speed', 'sprint_speed'), ('bat_speed', 'arm_overall'), ('height', 'k_pct'), ('swing_length', 'bat_speed'), ('attack_angle', 'fb_pct'), ('attack_angle', 'barrel_pct_bbe')]:
        r, n = corr([v.get(a) for v in H.values()], [v.get(b) for v in H.values()])
        if r is not None: md.append('- %s against %s: r = %+.2f (n = %d)' % (a, b, r, n))
    md.append('')
    corrtable('Hitter correlations', ['height', 'weight', 'age', 'bat_speed', 'swing_length', 'hard_swing_rate', 'squared_up_per_contact', 'blast_per_contact', 'attack_angle', 'swing_tilt', 'ideal_attack_angle_rate', 'power_proxy_per_kg',
                                      'ev_avg', 'ev_max', 'la_avg', 'barrel_pct_bbe', 'hard_hit_pct', 'k_pct', 'bb_pct', 'chase_pct', 'iz_contact_pct', 'whiff_pct', 'pull_pct', 'fb_pct', 'sprint_speed', 'hp_to_1b', 'arm_overall', 'jump_reaction', 'jump_burst', 'xwoba'], H, out['corr_hitters'])
    corrtable('Pitcher correlations', ['height', 'weight', 'age', 'ff_velo', 'ff_spin', 'ff_ivb', 'arm_angle', 'release_height', 'tempo_empty', 'p_k_pct', 'p_bb_pct', 'p_whiff_pct', 'p_chase_pct', 'p_ev_avg'], T, out['corr_pitchers'])
    # the pitcher's delivery with men on vs empty
    md.append('## The running game, from the data'); md.append('')
    md.append('- pitch tempo with the bases empty (median, s) is above; the CSV export repeats that value in its men-on column, so the hold (delivery with a runner on) is NOT available from this board')
    md.append('- base stealers\' leads: primary and secondary, overall and on attempts (ft), attempt rate per opportunity and success fraction: above')
    md.append('- catchers: pop time to second, exchange time, max-effort arm (mph): above')
    md.append('')
    with open('STATCAST_TARGETS_%d.md' % year, 'w') as f: f.write('\n'.join(md))
    with open(os.path.join('statcast', 'targets_%d.json' % year), 'w') as f: json.dump(out, f, indent=1)
    print('wrote STATCAST_TARGETS_%d.md and statcast/targets_%d.json  (hitters %d, catchers %d, pitchers %d)' % (year, year, len(H), len(C), len(T)))

if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 2025)
