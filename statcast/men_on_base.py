"""
men_on_base.py · v0.2 · 2026-10-05

Play with men on base in the league, from pitch-level Statcast (the men-on-base brief,
docs/briefs/2026-10-05_men_on_base.md), measured the way headless/mob_check.js measures the model:

  A. Hitting by base state (bases empty, a man on first only, a man in scoring position), raw and
     controlled for who: a linear probability model with a fixed effect for each batter and each
     pitcher (alternating projections), then with the contact's own expected hit rate (Statcast's
     estimated_ba_using_speedangle, from exit speed and launch angle) as well, so what is left is the
     fielding and the running. 90% intervals from 40 bootstrap draws of whole games.
  B. Ground-ball hit rate by the positioning the base-out state implies, by direction (the angle of
     the hit coordinates from home plate at 126.0, 205.0; + toward right field), in the field's frame
     and in the batter's (pull +):
       empty: no runner;  hold 2 out: a man on first, second open, two out (the first baseman holds);
       hold+DP: a man on first, second open, third empty, fewer than two out (holds, and the middle
       plays at double-play depth);  DP: first and second, fewer than two out (double-play depth, the
       first baseman behind the runner);  R3 <2 out: a man on third, fewer than two out (the infield
       may come in);  R2: a man on second only (normal depth).
  C. Which out the infielders take: ground balls fielded by an infielder (hit_location 1-6) with a
     man on first and fewer than two out - a double play, the lead runner out with the batter safe
     (force_out, fielders_choice_out), the batter out (field_out), a fielder's choice with no out, an
     infield hit, an error - by the fielder, the exit speed, and the runner's and the batter's sprint
     speed (statcast/raw/2025/sprint_speed.csv).
  D. The tag-up: a man on third (and, apart, a man on second with third open) on a ball caught in the
     outfield with fewer than two out: scored, held, out at the plate (from the play's description),
     by distance (hit_distance_sc), launch angle, fielder, outs, the runner's sprint speed and the
     fielder's arm (statcast/raw/2025/arm_strength.csv).

  E. Throwing errors on ground balls an infielder fielded (the play description's 'throwing error'), by the
     batter's sprint speed, the fielder, the exit speed, and whether men were on: how the hurry shows.

Writes statcast/men_on_base_2025.json and statcast/men_on_base_2025.js (`var MOB = ...`) for
headless/mob_check.js. Needs pandas and numpy.

  python3 statcast/men_on_base.py 2025-05-05:2025-09-21

CHANGED
  v0.2  E: throwing errors on infield ground balls
  v0.1  first build
"""
import json, os, sys, glob, datetime
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
HX, HY = 126.0, 205.0
HITS = {'single', 'double', 'triple'}
BIP_OUTS = {'field_out', 'force_out', 'grounded_into_double_play', 'double_play', 'triple_play', 'fielders_choice',
            'fielders_choice_out', 'field_error', 'sac_fly', 'sac_fly_double_play', 'other_out'}
COLS = ['game_pk', 'at_bat_number', 'pitch_number', 'events', 'des', 'bb_type', 'hit_location', 'hc_x', 'hc_y',
        'launch_speed', 'launch_angle', 'hit_distance_sc', 'on_1b', 'on_2b', 'on_3b', 'outs_when_up', 'inning',
        'inning_topbot', 'batter', 'pitcher', 'stand', 'bat_score', 'post_bat_score', 'estimated_ba_using_speedangle',
        'game_type', 'fielder_7', 'fielder_8', 'fielder_9', 'if_fielding_alignment']
SECT = [-90, -30, -15, 0, 15, 30, 90]
SECT_N = ['<-30', '-30..-15', '-15..0', '0..15', '15..30', '>30']


def load(spec):
    a, _, b = spec.partition(':')
    d0 = datetime.date.fromisoformat(a); d1 = datetime.date.fromisoformat(b or a)
    fs = [f for f in sorted(glob.glob(os.path.join(HERE, 'raw', 'pitches', '2025', '*.csv')))
          if d0 <= datetime.date.fromisoformat(os.path.basename(f)[:10]) <= d1]
    df = pd.concat([pd.read_csv(f, usecols=COLS, low_memory=False) for f in fs])
    df = df[df.game_type == 'R'].sort_values(['game_pk', 'at_bat_number', 'pitch_number'])
    return df.groupby(['game_pk', 'at_bat_number']).tail(1).reset_index(drop=True)   # a plate appearance's last pitch


def state_class(r1, r2, r3):
    return np.where(r2 | r3, 'RISP', np.where(r1, 'on1', 'empty'))


def fe_lpm(y, X, b, p, iters=60):
    """y = a_batter + c_pitcher + X beta, by alternating projections; returns beta."""
    beta = np.zeros(X.shape[1]); a = np.zeros(b.max() + 1); c = np.zeros(p.max() + 1)
    nb = np.bincount(b); np_ = np.bincount(p)
    for _ in range(iters):
        xb = np.einsum('ij,j->i', X, beta)   # (X @ beta raises spurious matmul warnings under numpy 2 with Accelerate)
        a = np.bincount(b, y - xb - c[p], minlength=len(a)) / np.maximum(nb, 1)
        c = np.bincount(p, y - xb - a[b], minlength=len(c)) / np.maximum(np_, 1)
        c -= c.mean()
        beta = np.linalg.lstsq(X, y - a[b] - c[p], rcond=None)[0]
    return beta


def part_a(P, rng):
    """Hitting by base state: raw gaps from the bases empty, and the gaps left with batter and pitcher held fixed."""
    P = P[P.events.notna() & (P.events != 'truncated_pa')].copy()
    P['cls'] = state_class(P.on_1b.notna(), P.on_2b.notna(), P.on_3b.notna())
    bip = P[P.events.isin(HITS | BIP_OUTS)].copy()
    bip['hit'] = bip.events.isin(HITS).astype(float)
    bip['gb'] = bip.bb_type == 'ground_ball'
    bip['xba'] = pd.to_numeric(bip.estimated_ba_using_speedangle, errors='coerce')
    out = {}
    games = bip.game_pk.unique()

    def fit(d, ycol, control):
        b = pd.factorize(d.batter)[0]; p = pd.factorize(d.pitcher)[0]
        X = np.column_stack([(d.cls == 'on1').values, (d.cls == 'RISP').values]).astype(float)
        y = d[ycol].values.astype(float)
        if control == 'raw':
            return [y[X[:, 0] == 1].mean() - y[X.sum(1) == 0].mean(), y[X[:, 1] == 1].mean() - y[X.sum(1) == 0].mean()]
        if control == 'xba':
            y = y - d.xba.values
        return list(fe_lpm(y, X, b, p))

    for name, sel in (('BABIP', bip), ('BABIP on the ground', bip[bip.gb]), ('BABIP in the air', bip[~bip.gb])):
        sel = sel[sel.xba.notna()]   # tracked balls only, so the xBA control has the same rows
        res = {'level': {c: float(sel[sel.cls == c].hit.mean()) for c in ('empty', 'on1', 'RISP')},
               'n': {c: int((sel.cls == c).sum()) for c in ('empty', 'on1', 'RISP')},
               'xba level': {c: float(sel[sel.cls == c].xba.mean()) for c in ('empty', 'on1', 'RISP')}}
        for control in ('raw', 'fe', 'xba'):
            est = fit(sel, 'hit', control)
            boots = []
            for _ in range(40):
                g = rng.choice(games, len(games), replace=True)
                cnt = pd.Series(g).value_counts()
                d = sel[sel.game_pk.isin(cnt.index)]
                d = d.loc[d.index.repeat(d.game_pk.map(cnt).values)]
                boots.append(fit(d, 'hit', control))
            boots = np.array(boots)
            res[control] = {'on1': [est[0]] + list(np.percentile(boots[:, 0], [5, 95])), 'RISP': [est[1]] + list(np.percentile(boots[:, 1], [5, 95]))}
        out[name] = res
    # K% and BB% (every plate appearance), raw and with batter and pitcher fixed
    P['k'] = P.events.str.startswith('strikeout').astype(float)
    P['bb'] = P.events.isin(['walk', 'hit_by_pitch']).astype(float)
    for name, col in (('K%', 'k'), ('BB+HBP% (no IBB)', 'bb')):
        d = P[P.events != 'intent_walk']
        out[name] = {'level': {c: float(d[d.cls == c][col].mean()) for c in ('empty', 'on1', 'RISP')},
                     'raw': fit(d, col, 'raw'), 'fe': fit(d, col, 'fe')}
    return out


def spray(d):
    return np.degrees(np.arctan2(d.hc_x - HX, HY - d.hc_y))


def pos_class(d):
    r1, r2, r3, o = d.on_1b.notna(), d.on_2b.notna(), d.on_3b.notna(), d.outs_when_up
    return np.select([~r1 & ~r2 & ~r3, r1 & ~r2 & (o == 2), r1 & ~r2 & ~r3 & (o < 2), r1 & r2 & ~r3 & (o < 2), r3 & (o < 2), ~r1 & r2 & ~r3],
                     ['empty', 'hold 2 out', 'hold+DP', 'DP', 'R3 <2 out', 'R2'], 'other')


def part_b(P):
    gb = P[(P.bb_type == 'ground_ball') & P.events.isin(HITS | BIP_OUTS) & P.hc_x.notna()].copy()
    gb['hit'] = gb.events.isin(HITS).astype(float)
    gb['cls'] = pos_class(gb)
    gb['field'] = spray(gb)
    gb['pull'] = np.where(gb.stand == 'L', gb.field, -gb.field)
    out = {}
    for frame in ('field', 'pull'):
        gb['sect'] = pd.cut(gb[frame], SECT, labels=SECT_N)
        t = {}
        for cls, g in gb.groupby('cls'):
            t[cls] = {'all': [float(g.hit.mean()), int(len(g))]}
            for s, h in g.groupby('sect', observed=False):
                t[cls][str(s)] = [float(h.hit.mean()) if len(h) else None, int(len(h))]
            t[cls]['share'] = {str(s): float((g.sect == s).mean()) for s in SECT_N}
        out[frame] = t
    # the infield's alignment as Statcast labels it, by the same classes (Strategic is where the infield comes in)
    out['alignment'] = {cls: {k: float(v) for k, v in g.if_fielding_alignment.value_counts(normalize=True).items()} for cls, g in gb.groupby('cls')}
    out['alignment_hit'] = {cls: {k: [float(h.hit.mean()), int(len(h))] for k, h in g.groupby('if_fielding_alignment')} for cls, g in gb.groupby('cls')}
    return out


def speeds():
    s = pd.read_csv(os.path.join(HERE, 'raw', '2025', 'sprint_speed.csv'), encoding='utf-8-sig')
    return dict(zip(s.player_id.astype(int), s.sprint_speed.astype(float)))


def part_c(P, SP):
    g = P[(P.bb_type == 'ground_ball') & P.on_1b.notna() & (P.outs_when_up < 2) & P.hit_location.isin([1, 3, 4, 5, 6])
          & P.events.isin(HITS | BIP_OUTS)].copy()
    oc = {'grounded_into_double_play': 'DP', 'double_play': 'DP', 'triple_play': 'DP', 'force_out': 'lead out', 'fielders_choice_out': 'lead out',
          'field_out': 'batter out', 'fielders_choice': 'FC no out', 'field_error': 'error', 'single': 'hit', 'double': 'hit', 'triple': 'hit'}
    g['oc'] = g.events.map(oc).fillna('other')
    g['rs'] = g.on_1b.map(lambda x: SP.get(int(x))); g['bs'] = g.batter.map(lambda x: SP.get(int(x)))
    g['ev'] = pd.cut(g.launch_speed, [0, 80, 90, 100, 200], labels=['<80', '80-90', '90-100', '100+'])
    g['fld'] = g.hit_location.map({1: 'P', 3: '1B', 4: '2B', 5: '3B', 6: 'SS'})
    q = np.nanpercentile(list(SP.values()), [33.3, 66.7])
    g['rsT'] = pd.cut(g.rs, [0, q[0], q[1], 40], labels=['slow', 'mid', 'fast'])
    g['bsT'] = pd.cut(g.bs, [0, q[0], q[1], 40], labels=['slow', 'mid', 'fast'])
    OC = ['DP', 'lead out', 'batter out', 'FC no out', 'hit', 'error']

    def tab(by):
        t = {}
        for k, h in g.groupby(by, observed=False):
            if not len(h):
                continue
            t[str(k)] = {'n': int(len(h))}; t[str(k)].update({o: float((h.oc == o).mean()) for o in OC})
        return t
    out = {'all': tab(lambda i: 'all'), 'outs': tab('outs_when_up'), 'fielder': tab('fld'), 'ev': tab('ev'),
           'runner speed': tab('rsT'), 'batter speed': tab('bsT'), 'speed tertiles (ft/s)': [float(q[0]), float(q[1])]}
    # second open (a man on first only) apart: the classic double-play chance
    g1 = g[P.loc[g.index, 'on_2b'].isna() & P.loc[g.index, 'on_3b'].isna()]
    out['R1 only'] = {'n': int(len(g1))}; out['R1 only'].update({o: float((g1.oc == o).mean()) for o in OC})
    # where the lead runner was put out with the batter safe, among the outs that were not double plays: the share of
    # outs on the lead runner, by fielder and runner speed
    h = g[g.oc.isin(['lead out', 'batter out'])]
    out['lead share'] = {'all': float((h.oc == 'lead out').mean())}
    for by in ('fld', 'rsT', 'bsT', 'ev', 'outs_when_up'):
        out['lead share'][by] = {str(k): [float((x.oc == 'lead out').mean()), int(len(x))] for k, x in h.groupby(by, observed=False) if len(x)}
    return out


def part_d(P, SP):
    arm = pd.read_csv(os.path.join(HERE, 'raw', '2025', 'arm_strength.csv'), encoding='utf-8-sig')
    ARM = dict(zip(pd.to_numeric(arm.player_id, errors='coerce').fillna(0).astype(int), pd.to_numeric(arm.arm_of, errors='coerce')))
    air = P[P.bb_type.isin(['fly_ball', 'line_drive', 'popup']) & P.events.isin(['field_out', 'sac_fly', 'double_play', 'sac_fly_double_play'])
            & (P.outs_when_up < 2)].copy()
    air['fld'] = air.hit_location.map({7: 'LF', 8: 'CF', 9: 'RF'}).fillna('IF')
    air['arm'] = [ARM.get(int(row['fielder_%d' % int(row.hit_location)]), np.nan) if row.hit_location in (7, 8, 9) else np.nan for _, row in air.iterrows()]
    air['dist'] = pd.cut(air.hit_distance_sc, [0, 200, 250, 280, 300, 320, 340, 360, 500], labels=['<200', '200-250', '250-280', '280-300', '300-320', '320-340', '340-360', '360+'])
    out = {}
    r3 = air[air.on_3b.notna()].copy()
    r3['oc'] = np.where(r3.des.str.contains('out at home|doubled off third', regex=True), 'out', np.where(r3.des.str.contains('scores'), 'scored', 'held'))
    r3['rs'] = r3.on_3b.map(lambda x: SP.get(int(x)))
    q = np.nanpercentile(list(SP.values()), [33.3, 66.7])
    r3['rsT'] = pd.cut(r3.rs, [0, q[0], q[1], 40], labels=['slow', 'mid', 'fast'])
    r3['armT'] = pd.cut(r3.arm, [0, 85, 90, 120], labels=['<85', '85-90', '90+'])
    OC = ['scored', 'held', 'out']

    def tab(d, by):
        t = {}
        for k, h in d.groupby(by, observed=False):
            if len(h):
                t[str(k)] = {'n': int(len(h))}; t[str(k)].update({o: float((h.oc == o).mean()) for o in OC})
        return t
    of = r3[r3.fld != 'IF']
    out['R3'] = {'all': tab(r3, lambda i: 'all'), 'fielder': tab(r3, 'fld'), 'outs': tab(r3, 'outs_when_up'),
                 'OF dist': tab(of, 'dist'), 'OF dist, 0 out': tab(of[of.outs_when_up == 0], 'dist'), 'OF dist, 1 out': tab(of[of.outs_when_up == 1], 'dist'),
                 'OF fielder': tab(of, 'fld'), 'OF runner speed': tab(of, 'rsT'), 'OF arm': tab(of, 'armT'),
                 'OF 280-340 runner speed': tab(of[(of.hit_distance_sc >= 280) & (of.hit_distance_sc < 340)], 'rsT')}
    r2 = air[air.on_2b.notna() & air.on_3b.isna()].copy()
    r2['oc'] = np.where(r2.des.str.contains('out at 3rd|doubled off second', regex=True), 'out', np.where(r2.des.str.contains('to 3rd'), 'scored', 'held'))   # 'scored' = reached third
    of2 = r2[r2.fld != 'IF']
    out['R2 to third'] = {'all': tab(r2, lambda i: 'all'), 'OF dist': tab(of2, 'dist'), 'OF fielder': tab(of2, 'fld')}
    return out


def part_e(P, SP):
    g = P[(P.bb_type == 'ground_ball') & P.hit_location.isin([1, 3, 4, 5, 6]) & P.events.isin(HITS | BIP_OUTS)].copy()
    g['te'] = g.des.fillna('').str.contains('throwing error').astype(float)
    g['bs'] = g.batter.map(lambda x: SP.get(int(x)))
    q = np.nanpercentile(list(SP.values()), [33.3, 66.7])
    g['batter speed'] = pd.cut(g.bs, [0, q[0], q[1], 40], labels=['slow', 'mid', 'fast'])
    g['fielder'] = g.hit_location.map({1: 'P', 3: '1B', 4: '2B', 5: '3B', 6: 'SS'})
    g['ev'] = pd.cut(g.launch_speed, [0, 80, 90, 100, 200], labels=['<80', '80-90', '90-100', '100+'])
    g['men'] = np.where(g.on_1b.notna() | g.on_2b.notna() | g.on_3b.notna(), 'on', 'empty')
    out = {'all': {'all': [float(g.te.mean()), int(len(g))]}}
    for by in ('batter speed', 'fielder', 'ev', 'men'):
        out[by] = {str(k): [float(h.te.mean()), int(len(h))] for k, h in g.groupby(by, observed=True)}
    return out


def main(spec):
    P = load(spec)
    rng = np.random.default_rng(5)
    SP = speeds()
    J = {'spec': spec, 'games': int(P.game_pk.nunique()), 'A': part_a(P, rng), 'B': part_b(P), 'C': part_c(P, SP), 'D': part_d(P, SP), 'E': part_e(P, SP)}
    with open(os.path.join(HERE, 'men_on_base_2025.json'), 'w') as f:
        json.dump(J, f, indent=1)
    with open(os.path.join(HERE, 'men_on_base_2025.js'), 'w') as f:
        f.write('// men_on_base_2025.js: written by statcast/men_on_base.py (%s); loaded before headless/mob_check.js\nvar MOB = ' % spec + json.dumps(J) + ';\n')
    report(J)


def report(J):
    print('men_on_base v0.2 · %d games (%s)' % (J['games'], J['spec']))
    print('\nA. HITTING BY BASE STATE: level (empty / on1 / RISP), then the gain over the bases empty: raw, batter+pitcher fixed, and with the contact\'s xBA too [90%]')
    for k, v in J['A'].items():
        if 'BABIP' in k:
            print('  %-20s %s   n %s   xBA %s' % (k, ' / '.join('%.3f' % v['level'][c] for c in ('empty', 'on1', 'RISP')), '/'.join(str(v['n'][c]) for c in ('empty', 'on1', 'RISP')),
                                              ' / '.join('%.3f' % v['xba level'][c] for c in ('empty', 'on1', 'RISP'))))
            for ctl in ('raw', 'fe', 'xba'):
                print('      %-4s on1 %+.3f [%+.3f %+.3f]   RISP %+.3f [%+.3f %+.3f]' % ((ctl,) + tuple(v[ctl]['on1']) + tuple(v[ctl]['RISP'])))
        else:
            print('  %-20s %s   raw %+.3f %+.3f   fixed %+.3f %+.3f' % (k, ' / '.join('%.3f' % v['level'][c] for c in ('empty', 'on1', 'RISP')), v['raw'][0], v['raw'][1], v['fe'][0], v['fe'][1]))
    print('\nB. GROUND-BALL HIT RATE by the positioning the state implies, by direction (deg, + toward right field / the pull side)')
    for frame in ('field', 'pull'):
        print('  frame: %s        ' % frame + ''.join('%14s' % s for s in SECT_N) + '           all')
        for cls in ('empty', 'hold 2 out', 'hold+DP', 'DP', 'R3 <2 out', 'R2', 'other'):
            t = J['B'][frame].get(cls)
            if not t:
                continue
            print('  %-12s       ' % cls + ''.join('%14s' % ('%.3f (%d)' % (t[s][0], t[s][1]) if t.get(s) and t[s][1] else '-') for s in SECT_N) + '   %.3f (%d)' % tuple(t['all']))
    print('  Statcast alignment by class: ' + '; '.join('%s %s' % (c, ' '.join('%s %.2f' % (k[:5], v) for k, v in a.items())) for c, a in J['B']['alignment'].items()))
    print('\nC. WHICH OUT: ground balls fielded by an infielder, a man on first, fewer than two out (shares)')
    for by in ('all', 'outs', 'fielder', 'ev', 'runner speed', 'batter speed'):
        for k, t in J['C'][by].items():
            print('  %-14s %-8s n %5d  ' % (by, k, t['n']) + '  '.join('%s %.3f' % (o, t[o]) for o in ('DP', 'lead out', 'batter out', 'FC no out', 'hit', 'error')))
    print('  R1 only: ' + '  '.join('%s %.3f' % (k, v) for k, v in J['C']['R1 only'].items() if k != 'n') + '  n %d' % J['C']['R1 only']['n'])
    ls = J['C']['lead share']
    print('  outs on the lead runner among single outs: all %.3f; ' % ls['all'] + '; '.join('%s %s' % (by, ' '.join('%s %.2f(%d)' % (k, v[0], v[1]) for k, v in ls[by].items())) for by in ('fld', 'rsT', 'bsT', 'ev', 'outs_when_up')))
    print('\nD. THE TAG-UP (caught air balls, fewer than two out)')
    for grp, tabs in J['D'].items():
        for by, t in tabs.items():
            for k, x in t.items():
                print('  %-12s %-24s %-9s n %4d  ' % (grp, by, k, x['n']) + '  '.join('%s %.3f' % (o, x.get(o, 0)) for o in ('scored', 'held', 'out')))
    print('\nE. THROWING ERRORS per ground ball an infielder fielded')
    for by, t in J['E'].items():
        print('  %-14s ' % by + '   '.join('%s %.4f (%d)' % (k, v[0], v[1]) for k, v in t.items()))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
