"""
fetch_fielding.py · v0.1 · 2026-10-12

Each postseason participant's regular-season fielding by position and season (MLB Stats API), in the shape of
playoffs/fielding_season.json ({id: {name, '2024': [{pos, G, inn, TC, E, thE}], ...}}), for review/err_mult.py.

  python3 history/fetch_fielding.py --years 2024,2025,2026     ->  history/fielding_season.json

CHANGED
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'playoffs'))
from common import fetch_json

API = 'https://statsapi.mlb.com/api/v1/'


def main(argv):
    years = [int(x) for x in argv[argv.index('--years') + 1].split(',')]
    R = json.load(open(os.path.join(HERE, 'rosters.json')))['players']
    out = {}
    for p in R:
        rec = {'name': p['name']}
        for y in years:
            d = fetch_json(API + 'people/%d/stats?stats=season&group=fielding&season=%d&sportId=1' % (p['id'], y), 'statsapi/fielding/%d_%d.json' % (p['id'], y))
            rows = []
            for s in (d.get('stats') or [{}])[0].get('splits', []) if d else []:
                st = s['stat']
                rows.append({'pos': s['position']['abbreviation'], 'G': st.get('games', st.get('gamesPlayed')), 'inn': float(st.get('innings', 0) or 0),
                             'TC': st.get('chances'), 'E': st.get('errors'), 'thE': st.get('throwingErrors', 0)})
            rec[str(y)] = rows
        out[str(p['id'])] = rec
    json.dump(out, open(os.path.join(HERE, 'fielding_season.json'), 'w'), indent=0)
    print('%d players, %s' % (len(out), years))


if __name__ == '__main__':
    main(sys.argv[1:])
