"""
aaa_fold.py · v0.1 · 2026-10-13

Triple-A priors for the season replay's men with no major-league data in a fold's window (Joe, 2026-10-13). Without them
such a man was the model's average major leaguer (a population hitter, a generic reliever), and the teams that leaned on
call-ups were overrated. For fold A (or B):
  1. season/aaaA: the fold's window at Triple-A (2025 and the fold's half of 2026, season/pitches_aaa from
     split_days.py --aaa), laid out like the fold and measured by playoffs/measure_traits.py exactly as the majors are.
  2. The level shift: for each measure the fits use, the difference majors minus Triple-A over the men measured at both
     levels in the same season (2025) or half, combined as a random-effects mean (DerSimonian-Laird: each man weighted by
     his precision plus tau), in log-odds for a rate and in mph or degrees otherwise. Tau, the spread of the men's own
     differences beyond their sampling error, is added to a translated measure's variance, so a Triple-A line counts for
     less than a major-league one.
  3. Each man with no major-league data in a role (hitting: no pitch seen in the window; pitching: no pitch type thrown)
     and enough at Triple-A (30 plate appearances; 100 pitches) has his Triple-A summaries for that role, translated,
     put in place of the empty ones, marked level 'AAA'. Triple-A has no bat tracking, so a hitter's bat speed, swing
     length, attack angle and swing tilt are imputed: their posterior mean given his height, weight and translated
     measures through the hitter emulator (diag_out/emu.jsonl, the model's major leaguers), the linear-Gaussian model
     the hidden traits are fitted by (the plug-in keeps the hidden traits' posterior mean exact, as the model is linear).
     His home runs per plate appearance, translated, go into his season lines. A pitcher's arsenal (speed, spin,
     movement, release, location scatter) is his Triple-A one untranslated: it is physics, measured by the same
     Hawk-Eye; only his outcome rates (strikeouts, walks, chases) are translated.
Writes season/foldA_aaa (a copy of the fold with the substitutions; the pitch links shared) and its aaa.json (the shifts,
the taus, the pairs behind them, who was substituted and who had too little at Triple-A).

  python3 season/aaa_fold.py A          (from the review worktree's root)

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import copy, csv, glob, gzip, json, math, os, shutil, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
REV = os.path.join(HERE, '..')
sys.path.insert(0, os.path.join(REV, 'review'))
import fit_hitters as FH

NOT_PA = {'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home', 'pickoff_1b', 'pickoff_2b', 'pickoff_3b', 'stolen_base_2b', 'stolen_base_3b', 'wild_pitch',
          'passed_ball', 'other_advance', 'truncated_pa', 'game_advisory', 'ejection', 'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home'}
H = ('summaries', 'hitting')
HIT = [('zoneSwing', H + ('zoneSwingRate',), 1), ('chase', H + ('chaseRate',), 1), ('whiffFB', H + ('whiffPerSwing', 'FB'), 1), ('whiffBR', H + ('whiffPerSwing', 'BR'), 1),
       ('whiffOS', H + ('whiffPerSwing', 'OS'), 1), ('foul', H + ('foulPerSwing', 'all'), 1), ('K', H + ('K_pct',), 1), ('BB', H + ('BB_pct',), 1),
       ('ev', H + ('exitVelo_bip',), 0), ('hardHit', H + ('hardHit95_share',), 1), ('GB', H + ('launchAngleShare', 'GB'), 1), ('LD', H + ('launchAngleShare', 'LD'), 1),
       ('FBs', H + ('launchAngleShare', 'FB'), 1), ('PU', H + ('launchAngleShare', 'PU'), 1), ('pull', ('traits', 'sprayPulledDeg_bip'), 0)]
P_ = ('summaries', 'pitching')
PIT = [('pK', P_ + ('K_pct',), 1), ('pBB', P_ + ('BB_pct',), 1), ('pChase', P_ + ('chaseRate',), 1)]
YEARS = ('2025', '2026')
MIN_N = 20              # events behind each side of a pair (swings, plate appearances, balls in play)
MIN_PA, MIN_PITCHES = 30, 100
SWING_KNOWN = ['swingLenFt', 'batSpeed', 'attack', 'swingTilt']


def node(rec, path):
    o = rec
    for k in path:
        o = (o or {}).get(k)
    return o


def fwd(x, rate): return math.log(min(max(x, 0.005), 0.995) / (1 - min(max(x, 0.005), 0.995))) if rate else x
def back(z, rate): return 1 / (1 + math.exp(-z)) if rate else z
def se_fwd(x, se, rate): return se / (min(max(x, 0.005), 0.995) * (1 - min(max(x, 0.005), 0.995))) if rate else se


def counts(fn):
    pa = hr = 0
    if os.path.exists(fn):
        for r in csv.DictReader(gzip.open(fn, 'rt')):
            if r['events'] and r['events'] not in NOT_PA: pa += 1; hr += r['events'] == 'home_run'
    return pa, hr


def build_aaa(fold, train, D):
    """the fold's window at Triple-A, laid out like the fold, then measured"""
    F = os.path.join(HERE, fold)
    os.makedirs(os.path.join(D, 'pitches'), exist_ok=True)
    for fn in glob.glob(os.path.join(D, 'pitches', '*.csv.gz')): os.remove(fn)
    ros = json.load(open(os.path.join(F, 'rosters.json'))); ids = {p['id'] for p in ros['players']}
    for blk, lab in (('2025', '2025'), (train, '2026')):
        for fn in glob.glob(os.path.join(HERE, 'pitches_aaa', blk, '*.csv.gz')):
            if int(os.path.basename(fn).split('_')[1].split('.')[0]) in ids:
                os.symlink(os.path.abspath(fn), os.path.join(D, 'pitches', '%s_%s' % (lab, os.path.basename(fn))))
    shutil.copy(os.path.join(F, 'rosters.json'), D)
    if not os.path.exists(os.path.join(D, 'leaderboards')): os.symlink(os.path.join(F, 'leaderboards'), os.path.join(D, 'leaderboards'))
    mlb = json.load(open(os.path.join(F, 'season_stats.json')))['players']; ss = {}
    for pid in ids:
        st = {k: v for k, v in (mlb.get(str(pid)) or {}).items() if k.startswith('pitching')}   # his major-league usage, for his role
        for blk, lab in (('2025', '2025'), (train, '2026')):
            pa, hr = counts(os.path.join(HERE, 'pitches_aaa', blk, 'batter_%d.csv.gz' % pid))
            st['hitting_' + lab] = {'PA': pa, 'HR': hr, 'note': 'Triple-A %s, from its pitches' % blk} if pa else None
        ss[str(pid)] = st
    json.dump({'note': 'Triple-A hitting lines; major-league pitching lines (usage)', 'players': ss}, open(os.path.join(D, 'season_stats.json'), 'w'), indent=0)
    subprocess.run([sys.executable, os.path.join(HERE, 'measure_fold.py'), D], check=True, stdout=subprocess.DEVNULL)


def hr_node(rec):
    """home runs per plate appearance by season, as a year-keyed node"""
    out = {}
    for y in YEARS:
        s = (rec.get('seasonStats') or {}).get('hitting_' + y) or {}
        if s.get('PA'):
            p = s.get('HR', 0) / s['PA']; out[y] = {'mean': p, 'se': max(math.sqrt(max(p * (1 - p), 1e-6) / s['PA']), 0.004), 'n': s['PA']}
    return out


def shifts(M, A):
    """per measure: the random-effects mean of majors minus Triple-A (transformed scale), tau, and the pairs"""
    out = {}
    for name, path, rate in HIT + PIT + [('HR', None, 1)]:
        d, v = [], []
        for pid, r in M.items():
            a = A.get(pid)
            if not a: continue
            om, oa = (hr_node(r), hr_node(a)) if path is None else (node(r, path), node(a, path))
            for y in YEARS:
                x, z = (om or {}).get(y), (oa or {}).get(y)
                if not (isinstance(x, dict) and isinstance(z, dict)) or x.get('mean') is None or z.get('mean') is None or not x.get('se') or not z.get('se'): continue
                if (x.get('n') or 0) < MIN_N or (z.get('n') or 0) < MIN_N: continue
                d.append(fwd(x['mean'], rate) - fwd(z['mean'], rate)); v.append(se_fwd(x['mean'], x['se'], rate) ** 2 + se_fwd(z['mean'], z['se'], rate) ** 2)
        if len(d) < 10:
            out[name] = {'shift': 0.0, 'tau': 0.0, 'pairs': len(d), 'rate': rate, 'note': 'too few pairs: no shift'}; continue
        d, v = np.array(d), np.array(v); w = 1 / v
        m0 = (w * d).sum() / w.sum(); Q = (w * (d - m0) ** 2).sum()
        tau2 = max(0.0, (Q - (len(d) - 1)) / (w.sum() - (w ** 2).sum() / w.sum()))
        ws = 1 / (v + tau2); m = (ws * d).sum() / ws.sum()
        out[name] = {'shift': round(float(m), 4), 'se': round(float(math.sqrt(1 / ws.sum())), 4), 'tau': round(float(math.sqrt(tau2)), 4), 'pairs': int(len(d)), 'rate': rate}
    return out


def translate(o, sh, rate):
    """a year-keyed node's every season and its pooled value, moved to the majors"""
    o = copy.deepcopy(o)
    for k, x in list(o.items()):
        if k in YEARS + ('pooled',) and isinstance(x, dict) and x.get('mean') is not None:
            z = fwd(x['mean'], rate) + sh['shift']
            s2 = (se_fwd(x['mean'], x['se'], rate) ** 2 if x.get('se') else 0) + sh['tau'] ** 2 + sh.get('se', 0) ** 2
            m = back(z, rate); x['mean'] = round(m, 5)
            x['se'] = round(math.sqrt(s2) * (m * (1 - m) if rate else 1), 5)
            x['level'] = 'AAA, translated (season/aaa_fold.py)'
    return o


def put(rec, path, val):
    o = rec
    for k in path[:-1]: o = o.setdefault(k, {})
    o[path[-1]] = val


def impute_swing(rec, E):
    """bat speed, swing length, attack angle and swing tilt: their posterior mean (and sd) given his height, weight and his
    translated measures, through the emulator"""
    mu, sd, coef, X = E['mu'], E['sd'], E['coef'], E['X']
    Z = (X - mu) / sd; C = np.cov(Z.T)
    names = FH.KNOWN + FH.HIDDEN; obs = [0, 1]; rest = list(range(2, len(names)))
    zo = (np.array([rec['heightIn'] or 73, rec['weightLb'] or 205]) - mu[obs]) / sd[obs]
    Coo, Cro, Crr = C[np.ix_(obs, obs)], C[np.ix_(rest, obs)], C[np.ix_(rest, rest)]
    m = Cro @ np.linalg.solve(Coo, zo); S = Crr - Cro @ np.linalg.solve(Coo, Cro.T)
    t = FH.target(rec); rows = [j for j, k in enumerate(FH.MEAS) if t[k][0] is not None]
    if len(rows) < 8: return None
    y = np.array([t[FH.MEAS[j]][0] for j in rows]); R = np.diag(np.array([t[FH.MEAS[j]][1] ** 2 for j in rows]) + E['struct'][rows])
    B = coef[1:][rest][:, rows].T; c = coef[0, rows] + zo @ coef[1:][obs][:, rows]
    K = S @ B.T @ np.linalg.inv(B @ S @ B.T + R)
    post = m + K @ (y - c - B @ m); Sp = S - K @ B @ S
    return {k: (float(mu[2 + i] + sd[2 + i] * post[i]), float(sd[2 + i] * math.sqrt(max(Sp[i, i], 0)))) for i, k in enumerate(SWING_KNOWN)}


def main(F):
    fold, train = {'A': ('foldA', 'h1'), 'B': ('foldB', 'h2')}[F]
    D = os.path.join(HERE, 'aaa' + F); OUT = os.path.join(HERE, fold + '_aaa')
    build_aaa(fold, train, D)
    MJ = json.load(open(os.path.join(HERE, fold, 'players_measured.json')))
    M = {r['id']: r for r in MJ['players']}
    A = {r['id']: r for r in json.load(open(os.path.join(D, 'players_measured.json')))['players']}
    SH = shifts(M, A)
    for k, s in SH.items(): print('  %-8s shift %+.3f (%s)  tau %.3f  pairs %d' % (k, s['shift'], 'log-odds' if s['rate'] else 'units', s['tau'], s['pairs']))
    E = FH.emulator(os.path.join(REV, 'diag_out', 'emu.jsonl'))
    SS = json.load(open(os.path.join(HERE, fold, 'season_stats.json')))
    sub = {'hitting': [], 'pitching': []}; thin = {'hitting': [], 'pitching': []}; none = {'hitting': [], 'pitching': []}
    for pid, r in M.items():
        a = A.get(pid) or {'summaries': {}, 'traits': {}}
        # hitting: no pitch seen in the window
        if r['kind'] in ('position', 'two-way') and not r['summaries'].get('hitting'):
            ah = a['summaries'].get('hitting'); pa = sum(((a.get('seasonStats') or {}).get('hitting_' + y) or {}).get('PA', 0) for y in YEARS)
            if not ah: none['hitting'].append(pid)
            elif pa < MIN_PA: thin['hitting'].append(pid)
            else:
                r['summaries']['hitting'] = dict(copy.deepcopy(ah), level='AAA')
                for name, path, rate in HIT:
                    o = node(a, path)
                    if o: put(r, path, translate(o, SH[name], rate))
                st = SS['players'].setdefault(str(pid), {})
                for y in YEARS:
                    s = (a.get('seasonStats') or {}).get('hitting_' + y)
                    if s and s.get('PA'):
                        p = back(fwd(max(s['HR'], 0.5) / s['PA'], 1) + SH['HR']['shift'], 1) if s['HR'] else 0.0
                        st['hitting_' + y] = {'PA': s['PA'], 'HR': round(p * s['PA'], 2), 'note': 'Triple-A, home runs translated to the majors (season/aaa_fold.py)'}
                r['seasonStats'] = st
                imp = impute_swing(r, E)
                if imp:
                    for k, (m_, s_) in imp.items():
                        v = {'mean': round(m_, 3), 'se': round(s_, 3), 'n': 0, 'note': 'imputed from Triple-A measures (season/aaa_fold.py)'}
                        r['traits'][k] = dict({y: dict(v) for y in YEARS if (r['summaries']['hitting'].get('K_pct') or {}).get(y)}, pooled=v)
                    sub['hitting'].append(pid)
                else:
                    del r['summaries']['hitting']; thin['hitting'].append(pid)
        # pitching: no pitch type thrown in the window
        if r['kind'] in ('pitcher', 'two-way') and not ((r['summaries'].get('pitching') or {}).get('pitchTypes')):
            ap = a['summaries'].get('pitching') or {}
            n = sum((ap.get('sampleSizes') or {}).get('pitchesThrown', {}).values()) if ap.get('sampleSizes') else 0
            if not ap.get('pitchTypes'): none['pitching'].append(pid)
            elif n < MIN_PITCHES: thin['pitching'].append(pid)
            else:
                P = copy.deepcopy(ap); P['level'] = 'AAA'
                if (r['summaries'].get('pitching') or {}).get('role'): P['role'] = r['summaries']['pitching']['role']
                r['summaries']['pitching'] = P
                for name, path, rate in PIT:
                    o = node(a, path)
                    if o: put(r, path, translate(o, SH[name], rate))
                r['traits']['pitching'] = copy.deepcopy(a['traits'].get('pitching'))
                sub['pitching'].append(pid)
    if os.path.exists(OUT): shutil.rmtree(OUT)
    shutil.copytree(os.path.join(HERE, fold), OUT, symlinks=True)
    MJ['meta'] = dict(MJ.get('meta') or {}, aaa='Triple-A priors for men with no major-league data in the window (season/aaa_fold.py)')
    json.dump(MJ, open(os.path.join(OUT, 'players_measured.json'), 'w'), separators=(',', ':'))
    json.dump(SS, open(os.path.join(OUT, 'season_stats.json'), 'w'), indent=0)
    nm = lambda L: [M[i]['name'] for i in L]
    rep = {'fold': fold, 'window': '2025 + 2026 %s' % train, 'shifts': SH, 'minimum': {'PA': MIN_PA, 'pitches': MIN_PITCHES, 'pairEvents': MIN_N},
           'substituted': {k: nm(v) for k, v in sub.items()}, 'substitutedIds': sub, 'tooLittle': {k: nm(v) for k, v in thin.items()}, 'noTripleA': {k: nm(v) for k, v in none.items()}}
    json.dump(rep, open(os.path.join(OUT, 'aaa.json'), 'w'), indent=1, ensure_ascii=False)
    print('%s: Triple-A priors for %d hitters and %d pitchers; too little at Triple-A %d and %d; none there %d and %d' % (
        fold, len(sub['hitting']), len(sub['pitching']), len(thin['hitting']), len(thin['pitching']), len(none['hitting']), len(none['pitching'])))


if __name__ == '__main__':
    main(sys.argv[1])
