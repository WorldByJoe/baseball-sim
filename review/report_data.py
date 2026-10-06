"""
report_data.py · v0.1 · 2026-10-06

Gathers the review's pieces into one JSON the page reads: for each game, the
model's pregame chance and run expectation (review/pregame.js runs), each
team's line against expectation (strikeouts, walks, home runs, the matchup's
expected wOBA against what happened, the batted balls against the league's
balls like them, runs against BaseRuns of the team's own events), MLB's
win probability play by play, every plate appearance with the model's view of
it and of its pitches, the surprises ranked, and the called pitches that went
against the model's umpire. Then the series outlook.

  python3 review/report_data.py 849839 849835   ->  review/report.json

CHANGED
  v0.1  first build (the Yankees-Rays review)
"""
import json, sys, glob, math

WOBA_SCALE, PA_RUN = 1.23, None
WOBA = {'BB': 0.69, 'HBP': 0.72, '1B': 0.88, '2B': 1.25, '3B': 1.58, 'HR': 2.03, 'E': 0.88, 'OUT': 0.0, 'K': 0.0, 'CI': 0.72}
NAMES = {'FF': 'four-seamer', 'SI': 'sinker', 'FC': 'cutter', 'SL': 'slider', 'ST': 'sweeper', 'CU': 'curveball', 'KC': 'knuckle curve',
         'CH': 'changeup', 'FS': 'splitter', 'CS': 'slow curve', 'SV': 'slurve'}
TAGS = {'849835': 'g1', '849839': 'g2'}


def pre(tag):
    R = [json.loads(l) for f in glob.glob('diag_out/pre2_%s_*.jsonl' % tag) for l in open(f)]
    n = len(R)
    ny = lambda r: 0 if 'Yankees' in r['away'] else 1
    win = sum(1 for r in R if r['score'][ny(r)] > r['score'][1 - ny(r)]) / n
    return {'n': n, 'nyyWin': round(win, 3), 'se': round(math.sqrt(win * (1 - win) / n), 3),
            'nyyRuns': round(sum(r['score'][ny(r)] for r in R) / n, 2), 'tbRuns': round(sum(r['score'][1 - ny(r)] for r in R) / n, 2),
            'away': R[0]['away'], 'home': R[0]['home'],
            'runDist': {s: [round(sum(1 for r in R if min(r['score'][(ny(r) if s == 'nyy' else 1 - ny(r))], 10) == k) / n, 4) for k in range(11)] for s in ('nyy', 'tb')}}


def baseruns(T):
    """BaseRuns from a team's own plate appearances (the bug audit's form)"""
    h = sum(1 for r in T if r['actual'] in ('1B', '2B', '3B', 'HR')); hr = sum(1 for r in T if r['actual'] == 'HR')
    bb = sum(1 for r in T if r['actual'] in ('BB', 'HBP', 'CI'))
    tb = sum({'1B': 1, '2B': 2, '3B': 3, 'HR': 4}.get(r['actual'], 0) for r in T)
    ab = sum(1 for r in T if r['actual'] not in ('BB', 'HBP', 'CI'))
    A, B, C, Dd = h + bb - hr, 1.02 * (1.4 * tb - 0.6 * h - 3 * hr + 0.1 * bb), ab - h, hr
    return A * B / (B + C) + Dd if B + C > 0 else Dd


def pitch_note(p):
    """one plain line on a pitch, as the model saw it"""
    nm = NAMES.get(p['type'], p['type'])
    s = '%s %s %.0f mph' % (p['count'], nm, p['mph'] or 0)
    if p.get('pSwing') is None:
        return s
    r = p['result']
    if r in ('ball', 'called'):
        s += ': taken (the model had him swinging %d%%)' % round(100 * p['pSwing'])
        if p.get('pCalled') is not None:
            s += ', called %s (a strike %d%% of the time)' % ('a strike' if r == 'called' else 'a ball', round(100 * p['pCalled']))
    else:
        s += ': swung at (%d%% likely)' % round(100 * p['pSwing'])
        if r == 'whiff' and p.get('pWhiff') is not None:
            s += ', missed (%d%% of his swings at it miss)' % round(100 * p['pWhiff'])
        elif r == 'foul':
            s += ', fouled off'
        elif r == 'inplay' and p.get('pInPlay') is not None:
            s += ', put in play (%d%% of his swings at it)' % round(100 * p['pInPlay'])
    if p.get('pFooled', 0) >= 0.3:
        s += '; fooled %d%% of the time' % round(100 * p['pFooled'])
    return s


def game(pk):
    G = json.load(open('review/games/%s.json' % pk))
    R = sorted([json.loads(l) for l in open('diag_out/rev_%s_x.jsonl' % pk)], key=lambda r: r['i'])
    W = json.load(open('playoffs/games/%s_wp.json' % pk))
    wp = {w['atBatIndex']: w for w in W}
    nyy = 'away' if 'Yankees' in G['teams']['away']['name'] else 'home'
    teams = {}
    for side in ('away', 'home'):
        T = [r for r in R if r['bat'] == side and 'probs' in r]
        exp = {k: sum(r['probs'][k] for r in T) for k in T[0]['probs']}
        act = {}
        for r in T:
            act[r['actual']] = act.get(r['actual'], 0) + 1
        bip = [r for r in T if r.get('bip') and r['bip'].get('league')]
        xw, w = sum(r['xwoba'] for r in T) / len(T), sum((r['woba'] or 0) for r in T) / len(T)
        xcon = sum(r['bip']['league']['xwobacon'] for r in bip) / max(1, len(bip)); wcon = sum((r['woba'] or 0) for r in bip) / max(1, len(bip))
        runs = G['final'][side]
        teams[side] = {'name': G['teams'][side]['name'], 'pa': len(T), 'runs': runs, 'hits': G['final']['hits'][0 if side == 'away' else 1],
                       'K': [round(exp['K'], 1), act.get('K', 0)], 'BB': [round(exp['BB'] + exp['HBP'], 1), act.get('BB', 0) + act.get('HBP', 0)],
                       'HR': [round(exp['HR'], 2), act.get('HR', 0)], 'xwoba': round(xw, 3), 'woba': round(w, 3),
                       'runsVsMatchup': round((w - xw) / WOBA_SCALE * len(T), 1),
                       'bip': len(bip), 'bipHits': [round(sum(r['bip']['league']['pHit'] for r in bip), 1), sum(1 for r in bip if r['actual'] in ('1B', '2B', '3B', 'HR'))],
                       'xwobacon': round(xcon, 3), 'wobacon': round(wcon, 3), 'runsOnContact': round((wcon - xcon) / WOBA_SCALE * len(bip), 1),
                       'baseruns': round(baseruns(T), 1), 'sequencing': round(runs - baseruns(T), 1),
                       'errorsFor': sum(1 for r in T if r['actual'] == 'E')}
    rows = []
    for r in R:
        if 'probs' not in r:
            continue
        w_ = wp.get(r['i'], {})
        home_wpa = w_.get('homeTeamWinProbabilityAdded') or 0
        nyy_wpa = home_wpa if nyy == 'home' else -home_wpa
        p = r['probs']
        hitP = p['1B'] + p['2B'] + p['3B'] + p['HR']
        surprise = -math.log10(max(r['pActual'] or 0.001, 0.001)) if r['pActual'] is not None else 0
        notes = [pitch_note(q) for q in r['pitches']]
        dec = r['pitches'][-1] if r['pitches'] else None
        odd = sorted([q for q in r['pitches'] if q.get('pResult') is not None], key=lambda q: q['pResult'])[:1]
        rows.append({'i': r['i'], 'inning': r['inning'], 'half': r['half'], 'outs': r['outs'], 'bases': r['bases'], 'score': r['score'],
                     'batter': r['batter'], 'pitcher': r['pitcher'], 'bat': r['bat'], 'nyyBat': r['bat'] == nyy, 'event': r['event'], 'desc': r['desc'],
                     'actual': r['actual'], 'pK': round(p['K'], 3), 'pBB': round(p['BB'] + p['HBP'], 3), 'pHit': round(hitP, 3), 'pHR': round(p['HR'], 3),
                     'pOut': round(p['OUT'] + p['E'], 3), 'pActual': r['pActual'], 'xwoba': r['xwoba'], 'woba': r['woba'], 'pctile': r['pctile'],
                     'surprise': round(surprise, 2), 'nyyWpa': round(nyy_wpa, 1), 'homeWp': w_.get('homeTeamWinProbability'),
                     'leverage': (w_.get('contextMetrics') or {}).get('leverageIndex') or w_.get('leverageIndex'),
                     'bip': ({'ev': r['bip']['ev'], 'la': r['bip']['la'], 'dist': r['bip']['dist'], 'spray': r['bip']['spray'],
                              'pHitLeague': r['bip']['league']['pHit'], 'xwobacon': r['bip']['league']['xwobacon'], 'pHitModel': r['bip']['pHit']} if r.get('bip') and r['bip'].get('league') else None),
                     'pitches': notes, 'oddPitch': pitch_note(odd[0]) if odd else None, 'oddP': odd[0]['pResult'] if odd else None,
                     'pitchCount': r['pitchCount']})
    # the calls that went against the model's (neutral) umpire
    calls = []
    for r in R:
        for q in r.get('pitches', []):
            if q.get('pCalled') is None or q['result'] not in ('ball', 'called'):
                continue
            if q['result'] == 'called' and q['pCalled'] < 0.25 or q['result'] == 'ball' and q['pCalled'] > 0.75:
                calls.append({'i': r['i'], 'inning': r['inning'], 'half': r['half'], 'batter': r['batter'], 'pitcher': r['pitcher'], 'count': q['count'],
                              'call': 'strike' if q['result'] == 'called' else 'ball', 'pStrike': q['pCalled'], 'favours': ('pitcher' if q['result'] == 'called' else 'batter'),
                              'nyyBat': r['bat'] == nyy})
    wpline = [{'i': w['atBatIndex'], 'nyy': round(w['homeTeamWinProbability'] if nyy == 'home' else w['awayTeamWinProbability'], 1),
               'inning': w['about']['inning'], 'half': w['about']['halfInning']} for w in W]
    return {'pk': int(pk), 'date': G['date'], 'venue': G['venue'], 'final': G['final'], 'innings': G['innings'], 'nyySide': nyy,
            'teams': teams, 'rows': rows, 'calls': calls, 'wp': wpline, 'pregame': pre(TAGS[pk])}


def main(pks):
    out = {'games': [game(pk) for pk in pks], 'series': {t: pre(t) for t in ('g3', 'g4', 'g5')}}
    s = out['series']
    out['seriesNyy'] = round(s['g3']['nyyWin'] * s['g4']['nyyWin'] * s['g5']['nyyWin'], 3)
    fits = json.load(open('review/pitchers_fit.json'))['pitchers']
    out['pitchers'] = {v['name']: {'deception': v['deception'], 'cmdScale': v['cmdScale'], 'K': v['measuredK'], 'BB': v['measuredBB']} for v in fits.values() if v['team'] in ('NYY', 'TB')}
    json.dump(out, open('review/report.json', 'w'), indent=1)
    for g in out['games']:
        print(g['pk'], {s: {k: g['teams'][s][k] for k in ('runs', 'K', 'BB', 'HR', 'xwoba', 'woba', 'runsVsMatchup', 'bipHits', 'runsOnContact', 'baseruns', 'sequencing')} for s in ('away', 'home')})
        print('  pregame', g['pregame']['nyyWin'], 'calls against the model:', len(g['calls']), [(c['call'], c['favours'], c['nyyBat']) for c in g['calls']])
    print('series', out['seriesNyy'])


if __name__ == '__main__':
    main(sys.argv[1:])
