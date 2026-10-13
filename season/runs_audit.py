"""
runs_audit.py · v0.2 · 2026-10-13

Where do the engine's runs go missing? (Joe, 2026-10-13: the model scores about 7.6 runs a game against the real 9.0, and
turns the home hitters' edge into about half the runs real baseball does.) The engine's plate appearances (replay_game.js
mode 'audit': run 4's traits, the home edge on, the second half's games with their real lineups, diag_out/audit in
hist26A4) against the real ones of the same games (Statcast, 2026 after the All-Star break), step by step:
  1. a team's game: runs, plate appearances, hits, walks, strikeouts, home runs
  2. how plate appearances end (strikeout, walk, hit by pitch, single, double, triple, home run, out in play, error)
  3. balls in play by type (ground, line, fly, pop-up): their share, hits and extra bases
  4. runners: first to third on a single (man on first only), scoring from second on a single (man on second only),
     scoring from first on a double (man on first only), the sacrifice fly (man on third, under two out, an out in the air),
     the double play (man on first, under two out, a ground ball)
  5. run expectancy over the 24 base-out states (runs from a state to the inning's end) and each event's run value
     (the expectancy after it, less before, plus the runs on it), each side with its own table
  6. the gap taken apart: the engine's events at real run values against the real events at real values (the events
     differ), and the engine's events at its own values (the events are worth less)
  7. contact against fielding: balls in play by exit speed and launch angle; each cell's single, extra-base and home-run
     rates; the run value a ball in play is worth with the engine's contact at real cell rates (the contact) and at its own
     (the fielding and the flight: how a ball of that speed and angle becomes a hit)
  8. home against away in the same games: strikeouts, walks, hits, runs per plate appearance for the home side's hitters
     less the visitors'

  python3 season/runs_audit.py      -> season/runs_audit.json

CHANGED
  v0.2  contact against fielding (exit speed and launch angle cells), and home against away
  v0.1  first build (Joe, 2026-10-13: start an investigation of where the runs go missing)
"""
import glob, json, os, sys
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__))
AUD = os.path.expanduser('~/bsim-wt/hist26A4/diag_out/audit')
REAL_MAP = {'strikeout': 'K', 'strikeout_double_play': 'K', 'walk': 'BB', 'intent_walk': 'IBB', 'hit_by_pitch': 'HBP', 'single': '1B', 'double': '2B', 'triple': '3B',
            'home_run': 'HR', 'field_error': 'E', 'catcher_interf': 'CI'}
OUTS_IN_PLAY = {'field_out', 'force_out', 'grounded_into_double_play', 'double_play', 'fielders_choice', 'fielders_choice_out', 'sac_fly', 'sac_bunt', 'sac_fly_double_play',
                'triple_play', 'sac_bunt_double_play'}
BBT = {'ground_ball': 'GB', 'line_drive': 'LD', 'fly_ball': 'FB', 'popup': 'PU'}


def engine():
    rows, games = [], 0
    for f in sorted(glob.glob(os.path.join(AUD, '*.jsonl'))):
        pk = int(os.path.basename(f).split('.')[0])
        for l in open(f):
            if not l.startswith('{'): continue
            J = json.loads(l); games += 1; start = [0, 0]
            for i, q in enumerate(J['p']):
                half, inn, outs, b, res, typ, om, runs, oa, ba, sc, mv, st, sts, wp = q[:15]; ev, la = (q[15], q[16]) if len(q) > 16 else (None, None); dist = q[18] if len(q) > 18 else None
                res = {'FC': 'OUT', 'SF': 'OUT', 'END': 'NOPA'}.get(res, res)   # the engine's fielder's choice and sacrifice fly are outs in play, as Statcast's are; END: a baserunning out ended it
                rows.append({'g': '%d_%d' % (pk, J['g']), 'half': half, 'inning': inn, 'outs': outs, 'bases': b, 'res': res, 'type': typ, 'outsMade': om, 'runs': runs,
                             'outsAfter': oa, 'basesAfter': ba, 'start': start[half], 'scoreAfter': sc, 'st': st, 'sts': sts, 'wp': wp, 'ev': ev, 'la': la, 'dist': dist})
                start[half] = sc
    D = pd.DataFrame(rows)
    D['halfkey'] = D.g + '_' + D.inning.astype(str) + '_' + D.half.astype(str)
    D['end'] = D.groupby('halfkey').scoreAfter.transform('max')
    D['toEnd'] = D.end - D.start
    return D[D.res != 'NOPA'].copy(), games


def real(pks):
    cols = ['game_pk', 'game_date', 'game_type', 'at_bat_number', 'pitch_number', 'inning', 'inning_topbot', 'outs_when_up', 'on_1b', 'on_2b', 'on_3b', 'events', 'bb_type',
            'bat_score', 'post_bat_score', 'launch_speed', 'launch_angle', 'hit_distance_sc']
    R = pd.concat([pd.read_csv(f, usecols=cols, low_memory=False) for f in sorted(glob.glob(os.path.join(HERE, '..', 'statcast', 'raw', 'pitches', '2026', '*.csv')))], ignore_index=True)
    R = R[(R.game_type == 'R') & R.game_pk.isin(pks)].copy()
    R = R.sort_values(['game_pk', 'at_bat_number', 'pitch_number'])
    first = R.groupby(['game_pk', 'at_bat_number']).first().reset_index()
    last = R.groupby(['game_pk', 'at_bat_number']).last().reset_index()
    P = last[['game_pk', 'at_bat_number', 'inning', 'inning_topbot', 'events', 'bb_type', 'post_bat_score', 'launch_speed', 'launch_angle', 'hit_distance_sc']].copy().rename(columns={'launch_speed': 'ev', 'launch_angle': 'la', 'hit_distance_sc': 'dist'})
    P['start'] = first.bat_score.values
    P['outs'] = first.outs_when_up.values
    P['bases'] = first.on_1b.notna().astype(int).values + 2 * first.on_2b.notna().astype(int).values + 4 * first.on_3b.notna().astype(int).values
    P['half'] = (P.inning_topbot == 'Bot').astype(int)
    P['halfkey'] = P.game_pk.astype(str) + '_' + P.inning.astype(str) + '_' + P.half.astype(str)
    P['end'] = P.groupby('halfkey').post_bat_score.transform('max')
    P['toEnd'] = P.end - P.start
    P['res'] = [REAL_MAP.get(e, 'OUT' if e in OUTS_IN_PLAY else ('NOPA' if isinstance(e, str) else 'NOPA')) for e in P.events]
    P['type'] = P.bb_type.map(BBT).fillna('')
    P['runs'] = P.post_bat_score - last.bat_score.values + 0   # on the play's last pitch
    # the state after: the next plate appearance's in the same half, else three out
    nxt = P.groupby('halfkey').shift(-1)
    P['outsAfter'] = np.where(nxt.outs.notna(), nxt.outs, 3).astype(int)
    P['basesAfter'] = np.where(nxt.bases.notna(), nxt.bases, 0).astype(int)
    P['outsMade'] = P.outsAfter - P.outs
    P['g'] = P.game_pk.astype(str)
    return P[P.res != 'NOPA'].copy()


def re24(D):
    return D.groupby(['outs', 'bases']).toEnd.mean().unstack(fill_value=np.nan)


def run_values(D, RE):
    def re(o, b): return 0.0 if o >= 3 else RE.loc[o, b]
    D = D[D.outs < 3]
    v = [re(oa, ba) - re(o, b) + r for o, b, oa, ba, r in zip(D.outs, D.bases, D.outsAfter, D.basesAfter, D.runs)]
    return pd.Series(v, index=D.index).groupby(D.res).mean(), pd.Series(v, index=D.index)


def advancement(D):
    one = lambda m: float(m.mean()) if len(m) else float('nan')
    s1 = D[(D.res == '1B') & (D.bases == 1)]; s2 = D[(D.res == '1B') & (D.bases == 2)]; d1 = D[(D.res == '2B') & (D.bases == 1)]
    sf = D[(D.bases & 4 > 0) & (D.outs < 2) & (D.res == 'OUT') & D.type.isin(['FB', 'PU', 'LD']) & (D.outsMade == 1)]
    dp = D[(D.bases & 1 > 0) & (D.outs < 2) & (D.res == 'OUT') & (D.type == 'GB')]
    return {'first to third on a single': (one((s1.basesAfter & 4) > 0), len(s1)), 'scores from second on a single': (one(s2.runs >= 1), len(s2)),
            'scores from first on a double': (one(d1.runs >= 1), len(d1)), 'run scores on an air out, man on third': (one(sf.runs >= 1), len(sf)),
            'double play on a grounder, man on first': (one(dp.outsMade >= 2), len(dp))}


def main():
    E, ng = engine()
    pks = sorted({int(g.split('_')[0]) for g in E.g})
    R = real(pks)
    out = {'engineGames': ng, 'realGames': int(R.g.nunique())}
    def per_game(D, n):
        return {'runs': D.groupby('halfkey').toEnd.first().sum() / n, 'PA': len(D) / n, 'H': D.res.isin(['1B', '2B', '3B', 'HR']).sum() / n, 'BB+HBP': D.res.isin(['BB', 'IBB', 'HBP']).sum() / n,
                'K': (D.res == 'K').sum() / n, 'HR': (D.res == 'HR').sum() / n}
    pg = {'engine': per_game(E, 2 * ng), 'real': per_game(R, 2 * R.g.nunique())}
    print('1. per team-game:  ' + '  '.join('%s %.2f / %.2f' % (k, pg['engine'][k], pg['real'][k]) for k in pg['engine']) + '   (engine / real)')
    res = ['K', 'BB', 'IBB', 'HBP', '1B', '2B', '3B', 'HR', 'OUT', 'E']
    sh = {s: {r: float((D.res == r).mean()) for r in res} for s, D in (('engine', E), ('real', R))}
    print('2. per plate appearance:  ' + '  '.join('%s %.3f / %.3f' % (r, sh['engine'][r], sh['real'][r]) for r in res))
    bip = {}
    for s, D in (('engine', E), ('real', R)):
        B = D[D.res.isin(['1B', '2B', '3B', 'OUT', 'E']) & D.type.isin(['GB', 'LD', 'FB', 'PU'])]
        bip[s] = {t: {'share': float((B.type == t).mean()), 'hit': float(B[B.type == t].res.isin(['1B', '2B', '3B']).mean()), 'xbh': float(B[B.type == t].res.isin(['2B', '3B']).mean())} for t in ('GB', 'LD', 'FB', 'PU')}
        bip[s]['all'] = {'BABIP': float(B.res.isin(['1B', '2B', '3B']).mean()), 'error': float((B.res == 'E').mean())}
    print('3. balls in play (engine / real):  BABIP %.3f / %.3f, errors %.3f / %.3f' % (bip['engine']['all']['BABIP'], bip['real']['all']['BABIP'], bip['engine']['all']['error'], bip['real']['all']['error']))
    for t in ('GB', 'LD', 'FB', 'PU'):
        e, r = bip['engine'][t], bip['real'][t]
        print('     %s  share %.3f / %.3f   hits %.3f / %.3f   extra-base %.3f / %.3f' % (t, e['share'], r['share'], e['hit'], r['hit'], e['xbh'], r['xbh']))
    adv = {'engine': advancement(E), 'real': advancement(R)}
    print('4. runners (engine / real):')
    for k in adv['engine']: print('     %-42s %.3f / %.3f   (n %d / %d)' % (k, adv['engine'][k][0], adv['real'][k][0], adv['engine'][k][1], adv['real'][k][1]))
    REe, RErr = re24(E), re24(R)
    print('5. run expectancy, engine / real (outs x bases: empty, 1st, 2nd, 1st+2nd, 3rd, 1st+3rd, 2nd+3rd, loaded):')
    for o in (0, 1, 2): print('     %d out  ' % o + '  '.join('%.2f/%.2f' % (REe.loc[o, b], RErr.loc[o, b]) for b in range(8)))
    LWe, ve = run_values(E, REe); LWr, vr = run_values(R, RErr)
    print('   run value of each event, engine / real:  ' + '  '.join('%s %+.3f / %+.3f' % (r, LWe.get(r, np.nan), LWr.get(r, np.nan)) for r in ('BB', 'HBP', '1B', '2B', '3B', 'HR', 'K', 'OUT', 'E')))
    # 6. the gap: a team-game's runs = its innings x the expectancy of a fresh inning + the sum of its plate appearances' run values
    #    (the values telescope over an inning), so: the engine's events at real values against the real events at real values
    def runs_at(D, n, RE, LW):
        inns = D.halfkey.nunique() / n
        return inns * RE.loc[0, 0] + float((D[D.outs < 3].res.map(LW).fillna(0)).sum()) / n
    ne, nr = 2 * ng, 2 * R.g.nunique()
    gap = {'real events, real values': runs_at(R, nr, RErr, LWr), 'engine events, real values': runs_at(E, ne, RErr, LWr), 'engine events, engine values': runs_at(E, ne, REe, LWe),
           'real runs': pg['real']['runs'], 'engine runs': pg['engine']['runs']}
    print('6. runs per team-game:  ' + '  '.join('%s %.2f' % kv for kv in gap.items()))
    # 7. contact against fielding
    EVB = [-1, 70, 80, 90, 95, 100, 105, 200]; LAB = [-91, -10, 0, 10, 20, 30, 40, 50, 91]
    def cells(D):
        B = D[D.res.isin(['1B', '2B', '3B', 'HR', 'OUT', 'E']) & D.ev.notna() & D.la.notna()].copy()
        B = B.assign(ev=B.ev.astype(float), la=B.la.astype(float)); B = B[(B.ev > -1) & (B.ev <= 200) & (B.la > -91) & (B.la <= 91)]
        B['cell'] = pd.cut(B.ev, EVB, labels=False).astype(int).astype(str) + '|' + pd.cut(B.la, LAB, labels=False).astype(int).astype(str)   # integer labels on both sides
        return B
    Be, Br = cells(E), cells(R)
    val = LWr.to_dict()
    def cell_value(B): return B.groupby('cell').res.apply(lambda r: float(r.map(val).fillna(val.get('OUT', -0.25)).mean()))
    vr, ve = cell_value(Br), cell_value(Be)
    she, shr = Be.cell.value_counts(normalize=True), Br.cell.value_counts(normalize=True)
    allc = sorted(set(she.index) | set(shr.index))
    contact = {'real contact, real outcomes': float(sum(shr.get(c, 0) * vr.get(c, ve.get(c, 0)) for c in allc)),
               'engine contact, real outcomes': float(sum(she.get(c, 0) * vr.get(c, ve.get(c, 0)) for c in allc)),
               'engine contact, engine outcomes': float(sum(she.get(c, 0) * ve.get(c, 0) for c in allc))}
    bip_per_game = len(Be) / (2 * ng)
    print('7. run value per ball in play (real run values):  ' + '  '.join('%s %+.4f' % kv for kv in contact.items()) + '   (%.1f balls in play a team-game)' % bip_per_game)
    LAS = (('<-10', -90, -10), ('-10-0', -10, 0), ('0-10', 0, 10), ('10-20', 10, 20), ('20-30', 20, 30), ('30-40', 30, 40), ('40-50', 40, 50), ('50+', 50, 91))
    EVS = (('<70', 0, 70), ('70-80', 70, 80), ('80-90', 80, 90), ('90-95', 90, 95), ('95-100', 95, 100), ('100-105', 100, 105), ('105+', 105, 200))
    shr_ = lambda B, col, lo, hi: float(((B[col] >= lo) & (B[col] < hi)).mean())
    print('   launch angle shares (engine / real): ' + '  '.join('%s %.3f/%.3f' % (lab, shr_(Be, 'la', lo, hi), shr_(Br, 'la', lo, hi)) for lab, lo, hi in LAS))
    print('   exit speed shares (engine / real):   ' + '  '.join('%s %.3f/%.3f' % (lab, shr_(Be, 'ev', lo, hi), shr_(Br, 'ev', lo, hi)) for lab, lo, hi in EVS) + '   mean %.1f / %.1f' % (Be.ev.mean(), Br.ev.mean()))
    # the cells that cost the most: share x value differences
    rows = []
    for c in allc:
        se_, sr_ = she.get(c, 0), shr.get(c, 0)
        rows.append((c, se_, sr_, ve.get(c, np.nan), vr.get(c, np.nan), (se_ - sr_) * vr.get(c, 0), se_ * (ve.get(c, 0) - vr.get(c, 0))))
    rows.sort(key=lambda r: -abs(r[5]) - abs(r[6]))
    print('   cells that matter most (exit speed bin | angle bin): share engine/real, value engine/real, contact cost, fielding cost (runs per ball in play)')
    for r in rows[:12]:
        e_, l_ = r[0].split('|')
        print('     ev %-8s la %-7s  %.3f/%.3f  %+.3f/%+.3f  %+.4f  %+.4f' % ('%s-%s' % (EVB[int(float(e_))], EVB[int(float(e_)) + 1]), '%s-%s' % (LAB[int(float(l_))], LAB[int(float(l_)) + 1]), r[1], r[2], r[3], r[4], r[5], r[6]))
    # 7b. carry: distance of balls in the air by exit speed and angle (the engine's projected distance, Statcast's hit distance)
    print('   distance of balls in the air, median ft (engine / real) and home-run share (engine / real):')
    for lo, hi in ((90, 95), (95, 100), (100, 105), (105, 120)):
        cells_ = []
        for alo, ahi in ((15, 20), (20, 25), (25, 30), (30, 35), (35, 40)):
            me = Be[(Be.ev >= lo) & (Be.ev < hi) & (Be.la >= alo) & (Be.la < ahi) & Be.dist.notna()]; mr = Br[(Br.ev >= lo) & (Br.ev < hi) & (Br.la >= alo) & (Br.la < ahi) & Br.dist.notna()]
            cells_.append('%d-%d deg %3.0f/%3.0f (%.2f/%.2f)' % (alo, ahi, me.dist.median() if len(me) else np.nan, mr.dist.median() if len(mr) else np.nan, (me.res == 'HR').mean() if len(me) else np.nan, (mr.res == 'HR').mean() if len(mr) else np.nan))
        print('     %d-%d mph  ' % (lo, hi) + '  '.join(cells_))
    # 8. home against away in the same games
    def ha(D):
        o = {}
        for k, f in (('K', lambda d: (d.res == 'K').mean()), ('BB+HBP', lambda d: d.res.isin(['BB', 'IBB', 'HBP']).mean()), ('H', lambda d: d.res.isin(['1B', '2B', '3B', 'HR']).mean()),
                     ('HR', lambda d: (d.res == 'HR').mean()), ('runs per PA', lambda d: d.groupby('halfkey').toEnd.first().sum() / len(d))):
            o[k] = float(f(D[D.half == 1]) - f(D[D.half == 0]))
        return o
    hae, har = ha(E), ha(R)
    print('8. home hitters minus visitors, per plate appearance (engine / real):  ' + '  '.join('%s %+.4f / %+.4f' % (k, hae[k], har[k]) for k in hae))
    out.update(contact=contact, homeAway={'engine': hae, 'real': har})
    out.update(perGame=pg, perPA=sh, bip=bip, runners={s: {k: list(v) for k, v in a.items()} for s, a in adv.items()},
               RE24={'engine': REe.round(3).to_dict(), 'real': RErr.round(3).to_dict()}, runValues={'engine': LWe.round(4).to_dict(), 'real': LWr.round(4).to_dict()}, gap=gap)
    json.dump(out, open(os.path.join(HERE, 'runs_audit.json'), 'w'), indent=1, default=float)


if __name__ == '__main__':
    main()
