"""
series_specs.py · v0.1 · 2026-10-13

Every series of an October as review/series_sim.js plays it before Game 1, written into that October's worktree
(run there): review/series/<year>_<type>_<hi>_<lo>.json, one per series, with
  hi, lo       the team with home field (Game 1's home team) and the other
  homeOf       the round's home pattern: wild card all at hi (3), division series 2-2-1 (5), LCS and World Series 2-3-2 (7)
  lineups      each team's Game 1 lineup (public before the first pitch), every man at the position he started
  rotation     the men who started that series' games for each team, in order, filled to four with the team's regular-
               season starters by games started (who would start was known a day or two ahead; how they did is not used)
  venue        each team's park (playoffs/venues.json, by the team's park in playoffs/rosters.json)

  python3 HIST/series_specs.py S        (from the worktree's root)

CHANGED
  v0.1  first build (Joe, 2026-10-12: how well did we predict the winners of each round in past Octobers?)
"""
import json, os, sys
HIST = os.path.dirname(os.path.abspath(__file__))
HOME = {'F': ['hi'] * 3, 'D': ['hi', 'hi', 'lo', 'lo', 'hi'], 'L': ['hi', 'hi', 'lo', 'lo', 'lo', 'hi', 'hi'], 'W': ['hi', 'hi', 'lo', 'lo', 'lo', 'hi', 'hi']}


def main(S):
    games = json.load(open(os.path.join(HIST, 'participants_%d.json' % S)))['games']
    recs = {r['id']: r for r in json.load(open('playoffs/players_measured.json'))['players']}
    R = json.load(open('playoffs/rosters.json')); V = json.load(open('playoffs/venues.json')); V = V.get('venues', V)
    venue_of = {t['abbrev']: V.get(str(t['venueId'])) for t in R['teams'].values()}
    series = {}
    for g in sorted(games, key=lambda g: (g['date'], g['pk'])):
        if not os.path.exists('review/games/%d.json' % g['pk']): continue
        G = json.load(open('review/games/%d.json' % g['pk']))
        key = (g['type'], frozenset((G['teams']['away']['abbrev'], G['teams']['home']['abbrev'])))
        series.setdefault(key, []).append(G)
    os.makedirs('review/series', exist_ok=True)
    out = []
    for (typ, teams), GS in series.items():
        g1 = GS[0]; hi, lo = g1['teams']['home']['abbrev'], g1['teams']['away']['abbrev']
        side = lambda G, t: 'away' if G['teams']['away']['abbrev'] == t else 'home'
        spec = {'name': '%d %s %s-%s' % (S, typ, hi, lo), 'year': S, 'type': typ, 'hi': hi, 'lo': lo, 'homeOf': HOME[typ], 'teams': {},
                'real': {'winner': None, 'games': [(G['pk'], G['final']['away'], G['final']['home'], G['teams']['away']['abbrev'], G['teams']['home']['abbrev']) for G in GS]}}
        wins = {hi: 0, lo: 0}
        for G in GS: wins[G['teams']['away']['abbrev'] if G['final']['away'] > G['final']['home'] else G['teams']['home']['abbrev']] += 1
        spec['real']['winner'] = max(wins, key=wins.get); spec['real']['wins'] = wins
        for t in (hi, lo):
            s1 = side(g1, t)
            lineup = [{'id': p['id'], 'name': p['name'], 'pos': p['pos']} for p in g1['lineups'][s1] if p['order'] % 100 == 0]
            rot = []
            for G in GS:
                sp = G['pitchers'][side(G, t)][0]
                if sp not in rot: rot.append(sp)
            sps = sorted([r for r in recs.values() if r['team'] == t and r['kind'] != 'position' and (r['summaries'].get('pitching') or {})],
                         key=lambda r: -(((r.get('seasonStats') or {}).get('pitching_2026') or {}).get('GS') or 0))
            for r in sps:
                if len(rot) >= 4: break
                if r['id'] not in rot: rot.append(r['id'])
            spec['teams'][t] = {'lineup': lineup, 'rotation': rot[:4], 'venue': venue_of[t]}
        fn = 'review/series/%d_%s_%s_%s.json' % (S, typ, hi, lo)
        json.dump(spec, open(fn, 'w'), indent=1); out.append(fn)
        print('%s: %s (home field) vs %s, real winner %s %s; rotations %s / %s' % (spec['name'], hi, lo, spec['real']['winner'], wins,
              [recs[i]['name'].split()[-1] for i in spec['teams'][hi]['rotation']], [recs[i]['name'].split()[-1] for i in spec['teams'][lo]['rotation']]))
    json.dump(out, open('review/series/index_%d.json' % S, 'w'), indent=1)


if __name__ == '__main__':
    main(int(sys.argv[1]))
