"""
fetch_fieldlogs.py · v0.1 · 2026-10-12

Each position player's regular-season fielding game by game (MLB Stats API gameLog), for the within-season error trend:
history/fieldlogs.json {id: {season: [[date, pos, chances, errors], ...]}}.

  python3 history/fetch_fieldlogs.py --years 2023,2024,2025,2026

CHANGED
  v0.1  first build (Joe, 2026-10-12: do older players fade more within a season, and their errors?)
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'playoffs'))
from common import fetch_json


def main(argv):
    years = [int(x) for x in argv[argv.index('--years') + 1].split(',')]
    R = [p for p in json.load(open(os.path.join(HERE, 'rosters.json')))['players'] if p['kind'] in ('position', 'two-way')]
    out = {}
    for k, p in enumerate(R):
        rec = {}
        for y in years:
            d = fetch_json('https://statsapi.mlb.com/api/v1/people/%d/stats?stats=gameLog&group=fielding&season=%d&gameType=R&sportId=1' % (p['id'], y), 'statsapi/fieldlog/%d_%d.json' % (p['id'], y))
            g = []
            for s in ((d or {}).get('stats') or [{}])[0].get('splits', []):
                st = s.get('stat', {}); pos = (s.get('position') or {}).get('abbreviation')
                if pos and pos != 'DH' and st.get('chances') is not None:
                    g.append([s.get('date'), pos, st.get('chances') or 0, st.get('errors') or 0])
            if g: rec[str(y)] = g
        out[str(p['id'])] = rec
        if k % 50 == 0: print('  %d/%d' % (k, len(R)), flush=True)
    json.dump(out, open(os.path.join(HERE, 'fieldlogs.json'), 'w'), separators=(',', ':'))
    print('%d players' % len(out))


if __name__ == '__main__':
    main(sys.argv[1:])
