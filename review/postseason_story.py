"""
postseason_story.py · v0.1 · 2026-10-14

What surprised the model in each 2026 postseason game, and what decided it (Joe, 2026-10-14). Read-only on the live review
worktree. Per game:
  the model     the home side's share of the published replays (the lineups as they were; and with each pitcher as he pitched)
  the teams     each side's runs, hits, home runs, extra-base hits, strikeouts, walks and hard-hit balls (95+ mph) against the
                model's expectation (300 replays in audit mode, diag_out/story/season_<pk>.jsonl) and the share of replays
                that scored as many runs; hits expected from the contact itself (the 2026 league's hit share by exit speed
                and launch angle, review/story_tables.py): above it is luck on balls in play or defence, below it the reverse
  the swings    each plate appearance's change in the home side's win expectancy (the 2026 league's, by inning, half,
                outs, bases and lead), the largest five; each player's total for his side (hitters and pitchers)
  the pitchers  each pitcher's line (batters, outs, hits, walks, strikeouts, home runs, runs scored while he pitched)
  python3 review/postseason_story.py [pk ...]   -> diag_out/story/story.json and story.txt
"""
import json, os, sys, glob, collections
R = os.path.expanduser('~/bsim-wt/review'); O = os.path.expanduser('~/bsim-wt/engdev/diag_out/story')
T = json.load(open(os.path.join(O, 'tables.json'))); WE, HIT = T['we'], T['hit']
HITS = {'single': 1, 'double': 2, 'triple': 3, 'home_run': 4}


def we(inn, half, outs, bases, lead):
    if outs >= 3: return None
    b = (1 if bases[0] else 0) + (2 if bases[1] else 0) + (4 if bases[2] else 0)
    for L in (lead, max(-6, min(6, lead))):
        k = '%d|%d|%d|%d|%d' % (min(inn, 9), half, outs, b, max(-6, min(6, L)))
        if k in WE: return WE[k]
    for o2 in range(3):
        k = '%d|%d|%d|%d|%d' % (min(inn, 9), half, o2, 0, max(-6, min(6, lead)))
        if k in WE: return WE[k]
    return 0.5


def state_we(inn, half, outs, bases, score):
    """home win expectancy at a state; a half-inning over hands to the next"""
    lead = score[1] - score[0]
    if outs >= 3:
        if half == 0: return we(inn, 1, 0, [None] * 3, lead) if not (inn >= 9 and lead > 0) else 1.0
        if inn >= 9 and lead != 0: return 1.0 if lead > 0 else 0.0
        return we(inn + 1, 0, 0, [None] * 3, lead)
    if half == 1 and inn >= 9 and lead > 0: return 1.0
    return we(inn, half, outs, bases, lead)


def series_of(G, all_games):
    a, h = G['teams']['away']['abbrev'], G['teams']['home']['abbrev']
    pair = frozenset((a, h)); same = sorted([g for g in all_games if frozenset((g['teams']['away']['abbrev'], g['teams']['home']['abbrev'])) == pair], key=lambda g: (g['date'], g['pk']))
    n = [g['pk'] for g in same].index(G['pk']) + 1
    lg = 'AL' if pair & {'NYY', 'TB', 'CLE', 'CWS', 'DET', 'HOU', 'SEA', 'BOS', 'TOR', 'KC', 'BAL', 'TEX', 'LAA', 'ATH', 'MIN'} else 'NL'
    rnd = 'CS' if same[0]['date'] >= '2026-10-11' else 'DS'   # a pair whose first meeting came after the division series
    return '%s%s Game %d' % (lg, rnd, n)


def replays(path):
    if not os.path.exists(path): return None
    return [json.loads(l) for l in open(path) if l.startswith('{')]


def expect(path):
    """per side (0 away, 1 home): mean of runs, hits, HR, XBH, K, BB+HBP, hard-hit balls; P(runs >= x) via the list"""
    L = replays(path)
    if not L: return None
    out = {0: collections.defaultdict(float), 1: collections.defaultdict(float)}; runs = {0: [], 1: []}
    for r in L:
        c = {0: collections.Counter(), 1: collections.Counter()}
        for q in r['p']:
            s = q[0]; res = q[4]; ev = q[15]
            if res in ('1B', '2B', '3B', 'HR'): c[s]['H'] += 1
            if res == 'HR': c[s]['HR'] += 1
            if res in ('2B', '3B', 'HR'): c[s]['XBH'] += 1
            if res == 'K': c[s]['K'] += 1
            if res in ('BB', 'IBB', 'HBP'): c[s]['BB'] += 1
            if ev is not None and ev >= 95: c[s]['HH'] += 1
            if ev is not None: c[s]['BIP'] += 1
        for s in (0, 1):
            c[s]['R'] = r['score'][s]; runs[s].append(r['score'][s])
            for k, v in c[s].items(): out[s][k] += v / len(L)
    return out, runs


def main(pks):
    allG = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(R, 'review', 'games', '*.json')))]
    allG = [g for g in allG if g.get('status') == 'Final' or g['pk'] in pks]
    res = []
    for G in sorted(allG, key=lambda g: (g['date'], g['pk'])):
        if pks and G['pk'] not in pks: continue
        pk = G['pk']; a, h = G['teams']['away']['abbrev'], G['teams']['home']['abbrev']; ab = {0: a, 1: h}
        pub = replays(os.path.join(R, 'diag_out', 'replays', '%d.jsonl' % pk)) or replays(os.path.join(R, 'review', 'replays', '%d.jsonl' % pk))
        pit = replays(os.path.join(R, 'diag_out', 'replays_pitched', '%d.jsonl' % pk)) or replays(os.path.join(R, 'review', 'replays_pitched', '%d.jsonl' % pk))
        share = lambda L: sum(r['score'][1] > r['score'][0] for r in L) / len(L) if L else None
        E = expect(os.path.join(O, 'season_%d.jsonl' % pk)); EP = expect(os.path.join(O, 'pitched_%d.jsonl' % pk))
        act = {0: collections.Counter(), 1: collections.Counter()}; xh = {0: 0.0, 1: 0.0}; xhr = {0: 0.0, 1: 0.0}; bip = {0: 0, 1: 0}
        swings = []; byp = collections.defaultdict(float); lines = collections.OrderedDict(); names = {}
        pas = [p for p in G['pas'] if p.get('type', 'atBat') == 'atBat' or p.get('eventType')]
        for i, p in enumerate(pas):
            s = 1 if p['bat'] == 'home' else 0; half = s; inn = p['inning']
            et = p.get('eventType') or ''
            names[p['batter']] = p['batterName']; names[p['pitcher']] = p['pitcherName']
            L = lines.setdefault(p['pitcher'], collections.Counter()); L['BF'] += 1
            if et in HITS: act[s]['H'] += 1; L['H'] += 1
            if et == 'home_run': act[s]['HR'] += 1; L['HR'] += 1
            if et in ('double', 'triple', 'home_run'): act[s]['XBH'] += 1
            if 'strikeout' in et: act[s]['K'] += 1; L['K'] += 1
            if et in ('walk', 'intent_walk', 'hit_by_pitch'): act[s]['BB'] += 1; L['BB'] += 1
            if 'error' in et: act[s]['E'] += 1
            hit = p.get('hit') or {}
            if hit.get('ev') is not None:
                if hit['ev'] >= 95: act[s]['HH'] += 1
                if hit.get('la') is not None and et not in ('sac_bunt',):
                    k = '%d|%d' % (max(40, min(115, int(hit['ev'] // 5 * 5))), max(-40, min(70, int(hit['la'] // 5 * 5))))
                    if k in HIT: xh[s] += HIT[k][0]; xhr[s] += HIT[k][2]; bip[s] += 1
            runs = int(p.get('runs') or 0); L['R'] += runs
            L['outs'] += max(0, int(p.get('outsAfter') or 0) - int(p.get('outs') or 0)) if p.get('outsAfter') is not None else 0
            sc = p['score']; w0 = state_we(inn, half, p['outs'], p['bases'], sc)
            nsc = [sc[0] + (runs if s == 0 else 0), sc[1] + (runs if s == 1 else 0)]
            if i + 1 < len(pas):
                q = pas[i + 1]
                if q['inning'] == inn and (1 if q['bat'] == 'home' else 0) == half: w1 = state_we(inn, half, q['outs'], q['bases'], q['score'])
                else: w1 = state_we(inn, half, 3, [None] * 3, q['score'])
            else:
                w1 = 1.0 if G['final']['home'] > G['final']['away'] else 0.0
            if w0 is None or w1 is None: continue
            d = w1 - w0; side = d if s == 1 else -d   # for the batting side
            swings.append((abs(d), side, inn, 'bot' if s else 'top', ab[s], p['batterName'], p['pitcherName'], p.get('desc', '')[:170], round(w0, 3), round(w1, 3)))
            byp[(ab[s], p['batter'], 'bat')] += side; byp[(ab[1 - s], p['pitcher'], 'pitch')] -= side
        for s in (0, 1): act[s]['R'] = G['final']['away' if s == 0 else 'home']; act[s]['BIP'] = bip[s]
        g = {'pk': pk, 'date': G['date'], 'series': series_of(G, allG), 'away': a, 'home': h, 'final': [G['final']['away'], G['final']['home']], 'hits': G['final'].get('hits'),
             'modelHome': share(pub), 'modelHomePitched': share(pit), 'innings': len(G.get('innings') or []), 'teams': {}}
        for s in (0, 1):
            t = {'actual': dict(act[s]), 'xHitsContact': round(xh[s], 1), 'xHRContact': round(xhr[s], 2)}
            if E:
                t['expected'] = {k: round(v, 2) for k, v in E[0][s].items()}; rr = E[1][s]
                t['pRunsAtLeast'] = round(sum(x >= act[s]['R'] for x in rr) / len(rr), 3)
            if EP: t['expectedPitched'] = {k: round(v, 2) for k, v in EP[0][s].items()}
            g['teams'][ab[s]] = t
        swings.sort(key=lambda x: -x[0])
        g['swings'] = [{'wpa': round(x[1], 3), 'inning': '%s %d' % (x[3], x[2]), 'team': x[4], 'batter': x[5], 'pitcher': x[6], 'desc': x[7], 'we': [x[8], x[9]]} for x in swings[:6]]
        tops = sorted(byp.items(), key=lambda kv: -abs(kv[1]))
        g['players'] = [{'team': k[0], 'name': names.get(k[1], str(k[1])), 'role': k[2], 'wpa': round(v, 3)} for k, v in tops[:10]]
        g['pitchers'] = [dict(name=names.get(pid, str(pid)), team=ab[0] if pid in G['pitchers']['away'] else ab[1], ip='%d.%d' % (L['outs'] // 3, L['outs'] % 3), **{k: L[k] for k in ('BF', 'H', 'BB', 'K', 'HR', 'R')}) for pid, L in lines.items()]
        res.append(g)
    json.dump(res, open(os.path.join(O, 'story.json'), 'w'), indent=1)
    with open(os.path.join(O, 'story.txt'), 'w') as f:
        for g in res:
            f.write('\n=== %s  %s %s  %s %d - %s %d  (model %s home %.0f%%, pitched %.0f%%)\n' % (g['series'], g['date'], g['pk'], g['away'], g['final'][0], g['home'], g['final'][1], g['home'],
                    100 * (g['modelHome'] or 0), 100 * (g['modelHomePitched'] or 0)))
            for tm, t in g['teams'].items():
                A, Ex = t['actual'], t.get('expected', {})
                f.write('  %s  ' % tm + '  '.join('%s %d/%.1f' % (k, A.get(k, 0), Ex.get(k, 0)) for k in ('R', 'H', 'HR', 'XBH', 'K', 'BB', 'HH')) +
                        '  | hits on contact %d vs %.1f expected from EV/LA; P(runs>=) %.2f; E %d\n' % (A.get('H', 0), t['xHitsContact'], t.get('pRunsAtLeast', -1), A.get('E', 0)))
            for x in g['swings'][:5]: f.write('   %+.2f %s %s: %s (%s vs %s)\n' % (x['wpa'], x['inning'], x['team'], x['desc'][:120], x['batter'], x['pitcher']))
            f.write('   players: ' + '; '.join('%s %s %s %+.2f' % (p['team'], p['name'], p['role'], p['wpa']) for p in g['players'][:8]) + '\n')
            f.write('   pitchers: ' + '; '.join('%s %s %s IP %dH %dBB %dK %dHR %dR' % (p['team'], p['name'], p['ip'], p['H'], p['BB'], p['K'], p['HR'], p['R']) for p in g['pitchers']) + '\n')
    print('%d games -> %s' % (len(res), os.path.join(O, 'story.txt')))


if __name__ == '__main__':
    main([int(x) for x in sys.argv[1:]])
