"""
aaa_fold.py · v0.3 · 2026-10-14

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
  3. v0.2: each man's Triple-A seasons in a role join his major-league ones, season by season, wherever Triple-A carries
     at least 5% of the weight on his strikeout rate (so a man with a thin major-league season leans on his Triple-A
     one, and a regular with a rehab stint is left alone), or wherever he has no major-league season (30 plate
     appearances or 25 batters faced at Triple-A needed). Outcome measures are combined by precision in log-odds (the
     translated Triple-A value with its variance plus tau); physical ones (the arsenal, release, location scatter) by
     count. A man with no major-league data at all is marked level 'AAA', one with both 'MLB+AAA'. Triple-A has no bat tracking, so a hitter's bat speed, swing
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
  v0.3  SEASON_Y: another season (2025) (the model review)
  v0.2  Triple-A informs thin major-league seasons too (Joe, 2026-10-13), not only men with none; league_means.json keeps
        the pitchers' shrinkage targets major-league only
  v0.1  first build (Joe, 2026-10-13)
"""
import copy, csv, glob, gzip, json, math, os, shutil, subprocess, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
REV = os.path.join(HERE, '..')
SY = int(os.environ.get('SEASON_Y', '2026')); PY = SY - 1   # v0.3: SEASON_Y=2025, its folds in season/y2025 (the model review)
BASE = HERE if SY == 2026 else os.path.join(HERE, 'y%d' % SY)
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
    F = os.path.join(BASE, fold)
    os.makedirs(os.path.join(D, 'pitches'), exist_ok=True)
    for fn in glob.glob(os.path.join(D, 'pitches', '*.csv.gz')): os.remove(fn)
    ros = json.load(open(os.path.join(F, 'rosters.json'))); ids = {p['id'] for p in ros['players']}
    for blk, lab in ((str(PY), '2025'), (train, '2026')):
        for fn in glob.glob(os.path.join(BASE, 'pitches_aaa', blk, '*.csv.gz')):
            if int(os.path.basename(fn).split('_')[1].split('.')[0]) in ids:
                os.symlink(os.path.abspath(fn), os.path.join(D, 'pitches', '%s_%s' % (lab, os.path.basename(fn))))
    shutil.copy(os.path.join(F, 'rosters.json'), D)
    if not os.path.exists(os.path.join(D, 'leaderboards')): os.symlink(os.path.join(F, 'leaderboards'), os.path.join(D, 'leaderboards'))
    mlb = json.load(open(os.path.join(F, 'season_stats.json')))['players']; ss = {}
    for pid in ids:
        st = {k: v for k, v in (mlb.get(str(pid)) or {}).items() if k.startswith('pitching')}   # his major-league usage, for his role
        for blk, lab in ((str(PY), '2025'), (train, '2026')):
            pa, hr = counts(os.path.join(BASE, 'pitches_aaa', blk, 'batter_%d.csv.gz' % pid))
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


OUT_PATHS = {path: (name, rate) for name, path, rate in HIT + PIT}
W_MIN = 0.05
MIN_K_N = {'hitting': 30, 'pitching': 25}   # plate appearances, batters faced: a Triple-A season used on its own


def ok(x): return isinstance(x, dict) and x.get('mean') is not None


def zv(x, rate, sh=None):
    """an entry in log-odds (rates) or units, with its variance; Triple-A entries moved by the shift and widened by tau"""
    z = fwd(x['mean'], rate); v = se_fwd(x['mean'], x.get('se') or 0, rate) ** 2
    if sh: z += sh['shift']; v += sh['tau'] ** 2 + sh.get('se', 0) ** 2
    return z, v


def comb_outcome(m, a, sh, rate):
    if not ok(a): return m
    za, va = zv(a, rate, sh)
    if ok(m) and m.get('se'):
        zm, vm = zv(m, rate); v = 1 / (1 / vm + 1 / va); z = v * (zm / vm + za / va)
    else:
        z, v = za, va
    mu = back(z, rate)
    out = dict(m if ok(m) else a); out.update(mean=round(mu, 5), se=round(math.sqrt(v) * (mu * (1 - mu) if rate else 1), 5),
                                              n=(m.get('n') or 0 if ok(m) else 0) + (a.get('n') or 0), level='MLB+AAA' if ok(m) else 'AAA, translated (season/aaa_fold.py)')
    return out


def comb_phys(m, a):
    if not ok(a): return m
    if not ok(m): return dict(copy.deepcopy(a), level='AAA')
    n1, n2 = m.get('n') or 0, a.get('n') or 0
    out = dict(m); out['mean'] = round((n1 * m['mean'] + n2 * a['mean']) / (n1 + n2), 5) if n1 + n2 else m['mean']; out['n'] = n1 + n2
    if m.get('se') and a.get('se'): out['se'] = round(1 / math.sqrt(1 / m['se'] ** 2 + 1 / a['se'] ** 2), 5)
    out['level'] = 'MLB+AAA'
    return out


def merge(m, a, path, years, SH):
    """his Triple-A node a into his major-league node m, for the seasons in years"""
    if isinstance(a, dict) and any(k in YEARS for k in a):
        out = copy.deepcopy(m) if isinstance(m, dict) else {}
        o = OUT_PATHS.get(path)
        for y in years:
            ay, my = a.get(y), out.get(y)
            if ay is None: continue
            if o: out[y] = comb_outcome(my, ay, SH[o[0]], o[1])
            elif ok(ay): out[y] = comb_phys(my, ay)
            elif path[-1] == 'command':
                if my is None or ((my.get('n') or 0) < 50 <= (ay.get('n') or 0)): out[y] = copy.deepcopy(ay)
            elif my is None: out[y] = copy.deepcopy(ay)
        if 'pooled' in a and 'pooled' not in out: out['pooled'] = translate({'pooled': a['pooled']}, SH[o[0]], o[1])['pooled'] if o and ok(a['pooled']) else copy.deepcopy(a['pooled'])
        return out
    if isinstance(a, dict):
        out = copy.deepcopy(m) if isinstance(m, dict) else {}
        for k, v in a.items(): out[k] = merge(out.get(k), v, path + (k,), years, SH)
        return out
    return m if m is not None else copy.deepcopy(a)


def years_to_use(r, a, role, SH):
    """the seasons where his Triple-A line joins: none in the majors (and enough at Triple-A), or Triple-A carries 5%+ of
    the weight on his strikeout rate"""
    km = node(r, ('summaries', role, 'K_pct')) or {}; ka = node(a, ('summaries', role, 'K_pct')) or {}
    out, wts = [], {}
    for y in YEARS:
        x, z = km.get(y), ka.get(y)
        if not ok(z) or not z.get('se'): continue
        if not ok(x) or not x.get('se'):
            if (z.get('n') or 0) >= MIN_K_N[role]: out.append(y); wts[y] = 1.0
            continue
        vm = zv(x, 1)[1]; va = zv(z, 1, SH['K' if role == 'hitting' else 'pK'])[1]; w = (1 / va) / (1 / va + 1 / vm)
        if w >= W_MIN: out.append(y); wts[y] = round(w, 3)
    return out, wts


def main(F):
    fold, train = {'A': ('foldA', 'h1'), 'B': ('foldB', 'h2')}[F]
    D = os.path.join(BASE, 'aaa' + F); OUT = os.path.join(BASE, fold + '_aaa')
    build_aaa(fold, train, D)
    MJ = json.load(open(os.path.join(BASE, fold, 'players_measured.json')))
    M = {r['id']: r for r in MJ['players']}
    # the pitchers' shrinkage targets (season/view.py), from the major-league records only
    LM = {}
    for k in ('K_pct', 'BB_pct', 'chaseRate'):
        v = [o['mean'] for r in M.values() for y, o in ((r['summaries'].get('pitching') or {}).get(k) or {}).items() if y.isdigit() and isinstance(o, dict) and o.get('mean') is not None]
        LM[k] = float(np.mean(v)) if v else None
    A = {r['id']: r for r in json.load(open(os.path.join(D, 'players_measured.json')))['players']}
    SH = shifts(M, A)
    for k, s_ in SH.items(): print('  %-8s shift %+.3f (%s)  tau %.3f  pairs %d' % (k, s_['shift'], 'log-odds' if s_['rate'] else 'units', s_['tau'], s_['pairs']))
    E = FH.emulator(os.path.join(REV, 'diag_out', 'emu.jsonl'))
    SS = json.load(open(os.path.join(BASE, fold, 'season_stats.json')))
    done = {'hitting': {}, 'pitching': {}}
    for pid, r in M.items():
        a = A.get(pid)
        if not a: continue
        # hitting
        if r['kind'] in ('position', 'two-way') and a['summaries'].get('hitting'):
            ys, wts = years_to_use(r, a, 'hitting', SH)
            if ys:
                had = bool(r['summaries'].get('hitting'))
                r['summaries']['hitting'] = merge(r['summaries'].get('hitting'), a['summaries']['hitting'], ('summaries', 'hitting'), ys, SH)
                r['summaries']['hitting']['level'] = 'MLB+AAA' if had else 'AAA'
                sp = node(a, ('traits', 'sprayPulledDeg_bip'))
                if sp: r['traits']['sprayPulledDeg_bip'] = merge(r['traits'].get('sprayPulledDeg_bip'), sp, ('traits', 'sprayPulledDeg_bip'), ys, SH)
                st = SS['players'].setdefault(str(pid), {})
                for y in ys:   # home runs: combined by precision as the measures are, written as an effective line
                    sa = (a.get('seasonStats') or {}).get('hitting_' + y) or {}; sm = st.get('hitting_' + y) or {}
                    if not sa.get('PA'): continue
                    ea = {'mean': max(sa['HR'], 0.5) / sa['PA'], 'n': sa['PA']}; ea['se'] = math.sqrt(ea['mean'] * (1 - ea['mean']) / sa['PA'])
                    em = None
                    if sm.get('PA'):
                        em = {'mean': max(sm.get('HR', 0), 0.5) / sm['PA'], 'n': sm['PA']}; em['se'] = math.sqrt(em['mean'] * (1 - em['mean']) / sm['PA'])
                    c = comb_outcome(em, ea, SH['HR'], 1); p_ = c['mean']; pa_eff = p_ * (1 - p_) / c['se'] ** 2
                    st['hitting_' + y] = {'PA': round(pa_eff), 'HR': round(p_ * pa_eff, 2), 'note': 'effective line: major-league %s + Triple-A %s translated (season/aaa_fold.py)' % (sm.get('PA') or 0, sa['PA'])}
                r['seasonStats'] = st
                # bat tracking: Triple-A has none; a season without it takes his major-league mean, else the imputation
                miss = [y for y in ys if not ok((r['traits'].get('batSpeed') or {}).get(y))]
                if miss:
                    imp = None if ok((r['traits'].get('batSpeed') or {}).get('pooled')) else impute_swing(r, E)
                    for k in SWING_KNOWN:
                        node_ = r['traits'].setdefault(k, {})
                        src = node_.get('pooled') if ok(node_.get('pooled')) else ({'mean': round(imp[k][0], 3), 'se': round(imp[k][1], 3), 'n': 0, 'note': 'imputed from Triple-A measures (season/aaa_fold.py)'} if imp else None)
                        if src is None: continue
                        for y in miss: node_.setdefault(y, dict(src))
                        node_.setdefault('pooled', dict(src))
                done['hitting'][pid] = wts
        # pitching
        if r['kind'] in ('pitcher', 'two-way') and (a['summaries'].get('pitching') or {}).get('pitchTypes'):
            ys, wts = years_to_use(r, a, 'pitching', SH)
            if ys:
                had = bool((r['summaries'].get('pitching') or {}).get('pitchTypes'))
                role = (r['summaries'].get('pitching') or {}).get('role')
                r['summaries']['pitching'] = merge(r['summaries'].get('pitching') if had else None, a['summaries']['pitching'], ('summaries', 'pitching'), ys, SH)
                r['summaries']['pitching']['level'] = 'MLB+AAA' if had else 'AAA'
                if role: r['summaries']['pitching']['role'] = role
                r['traits']['pitching'] = merge(r['traits'].get('pitching') if had else None, a['traits'].get('pitching') or {}, ('traits', 'pitching'), ys, SH)
                done['pitching'][pid] = wts
    if os.path.exists(OUT): shutil.rmtree(OUT)
    shutil.copytree(os.path.join(BASE, fold), OUT, symlinks=True)
    MJ['meta'] = dict(MJ.get('meta') or {}, aaa='Triple-A seasons joined to thin or missing major-league ones (season/aaa_fold.py v0.2)')
    json.dump(MJ, open(os.path.join(OUT, 'players_measured.json'), 'w'), separators=(',', ':'))
    json.dump(SS, open(os.path.join(OUT, 'season_stats.json'), 'w'), indent=0)
    json.dump(LM, open(os.path.join(OUT, 'league_means.json'), 'w'))
    only = {k: [i for i in v if (M[i]['summaries'].get(k) or {}).get('level') == 'AAA'] for k, v in done.items()}
    rep = {'fold': fold, 'window': '2025 + 2026 %s' % train, 'shifts': SH, 'minimum': {'tripleAWeight': W_MIN, 'K_n': MIN_K_N, 'pairEvents': MIN_N},
           'tripleAOnly': {k: [M[i]['name'] for i in v] for k, v in only.items()}, 'combined': {k: {M[i]['name']: w for i, w in v.items()} for k, v in done.items()},
           'substitutedIds': {k: list(v) for k, v in done.items()}, 'tripleAOnlyIds': only}
    json.dump(rep, open(os.path.join(OUT, 'aaa.json'), 'w'), indent=1, ensure_ascii=False)
    print('%s: Triple-A joined for %d hitters (%d with no major-league data) and %d pitchers (%d with none)' % (
        fold, len(done['hitting']), len(only['hitting']), len(done['pitching']), len(only['pitching'])))


if __name__ == '__main__':
    main(sys.argv[1])
