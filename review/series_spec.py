"""
series_spec.py · v0.2 · 2026-10-08

The LCS and World Series as the series simulator plays them (review/series_sim.js): for each team, its lineup
(its latest division series lineup, every man at the position he started) and its four-man rotation (its division
series starters in order, filled to four with its regular season's next starter), and its park; for each series,
the team with home field (the better regular-season record: games 1, 2, 6 and 7 at home).

  python3 review/series_spec.py   ->  review/series/<name>.json

CHANGED
  v0.2  the Guardians too (they won Game 4; the ALDS goes to a fifth game): ALCS_CLE, WS_MIL_CLE, WS_LAD_CLE
  v0.1  first build (Joe, 2026-10-08: the LCS and the World Series before Game 1; the White Sox assumed into the ALCS)
"""
import json, os, sys
sys.path.insert(0, 'review')
from replay_grids import GAMES

RECORD = {'TB': 98, 'CWS': 84, 'CLE': 85, 'MIL': 103, 'LAD': 100}   # 2026 regular-season wins (MLB standings)
VENUE = {'TB': '12', 'CWS': '4', 'CLE': '5', 'MIL': '32', 'LAD': '22'}
ROTATION = {'TB': [656876, 642547, 607259, 643377],       # Rasmussen, Peralta, Martinez, Jax
            'CWS': [696146, 641743, 656794, 663436],      # Smith, Kay, Newcomb, D. Martin
            'CLE': [800048, 668909, 682982, 676440],      # Messick, Williams, Espino, Bibee
            'MIL': [694819, 701656, 669160, 688107],      # Misiorowski, Henderson, May, Gasser
            'LAD': [669373, 605483, 808967, 607192]}      # Skubal, Snell, Yamamoto, Glasnow
SERIES = {'ALCS': ('TB', 'CWS'), 'ALCS_CLE': ('TB', 'CLE'), 'NLCS': ('MIL', 'LAD'), 'WS_MIL_TB': ('MIL', 'TB'), 'WS_MIL_CWS': ('MIL', 'CWS'), 'WS_LAD_TB': ('LAD', 'TB'), 'WS_LAD_CWS': ('LAD', 'CWS'),
          'WS_MIL_CLE': ('MIL', 'CLE'), 'WS_LAD_CLE': ('LAD', 'CLE')}


def lineup(team):
    last = None
    for pk, ser, num, date in GAMES:
        f = 'review/games/%d.json' % pk
        if not os.path.exists(f): continue
        G = json.load(open(f))
        for s in ('away', 'home'):
            if G['teams'][s]['abbrev'] == team: last = [{'id': p['id'], 'name': p['name'], 'pos': p['pos']} for p in G['lineups'][s] if p['order'] % 100 == 0]
    return last


def main():
    os.makedirs('review/series', exist_ok=True)
    V = json.load(open('playoffs/venues.json')); V = V.get('venues', V)
    for name, (a, b) in SERIES.items():
        hi, lo = (a, b) if RECORD[a] >= RECORD[b] else (b, a)
        spec = {'name': name, 'hi': hi, 'lo': lo, 'homeOf': ['hi', 'hi', 'lo', 'lo', 'lo', 'hi', 'hi'],
                'teams': {t: {'lineup': lineup(t), 'rotation': ROTATION[t], 'venue': V[VENUE[t]]} for t in (hi, lo)}}
        json.dump(spec, open('review/series/%s.json' % name, 'w'), indent=1)
        print(name, hi, 'has home field over', lo, '|', ', '.join('%s %s' % (p['pos'], p['name'].split()[-1]) for p in spec['teams'][hi]['lineup']))


if __name__ == '__main__':
    main()
