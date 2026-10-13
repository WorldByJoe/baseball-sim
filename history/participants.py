"""
participants.py · v0.1 · 2026-10-12

Everyone who played in a season's postseason: each finished game's box score (MLB Stats API) gives the batters who came
to the plate or took the field and the pitchers who pitched. A man who did both is 'two-way'. Writes
history/participants_<season>.json: per player his name, team, kind, and the games he appeared in.

  python3 history/participants.py 2025

CHANGED
  v0.1  first build (Joe, 2026-10-12: the 2024 and 2025 playoffs, each player's traits year by year)
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'playoffs'))
from common import fetch_json

API = 'https://statsapi.mlb.com/api/v1/'
HERE = os.path.dirname(os.path.abspath(__file__))


def main(season):
    S = fetch_json(API + 'schedule?sportId=1&season=%d&gameType=F,D,L,W' % season, 'history/schedule_%d_post.json' % season)
    games = []
    for d in S['dates']:
        for g in d['games']:
            if g['status']['detailedState'] == 'Final' and g['gamePk'] not in [x['pk'] for x in games]:
                games.append({'pk': g['gamePk'], 'type': g['gameType'], 'date': g['officialDate'], 'away': g['teams']['away']['team']['name'], 'home': g['teams']['home']['team']['name'],
                              'final': [g['teams']['away'].get('score'), g['teams']['home'].get('score')], 'series': g.get('description', '')})
    P = {}
    for g in games:
        B = fetch_json(API + 'game/%d/boxscore' % g['pk'], 'history/box_%d.json' % g['pk'])
        for side in ('away', 'home'):
            T = B['teams'][side]; ab = T['team'].get('abbreviation') or T['team']['name']
            for key, pl in T['players'].items():
                st = pl.get('stats', {}); bat = st.get('batting', {}); pit = st.get('pitching', {}); fld = st.get('fielding', {})
                did_bat = bool(bat.get('plateAppearances') or bat.get('atBats') or pl.get('battingOrder') or (fld and any(fld.get(k) for k in ('chances', 'putOuts', 'assists'))) or pl.get('allPositions'))
                did_pitch = bool(pit.get('battersFaced') or pit.get('numberOfPitches') or pit.get('outs'))
                pos = [p_['abbreviation'] for p_ in pl.get('allPositions', [])]
                did_bat = did_bat and pos != ['P'] or bool(bat.get('plateAppearances'))
                if not (did_bat or did_pitch): continue
                pid = pl['person']['id']
                r = P.setdefault(pid, {'id': pid, 'name': pl['person']['fullName'], 'team': ab, 'bat': 0, 'pitch': 0, 'games': []})
                r['bat'] += did_bat; r['pitch'] += did_pitch; r['games'].append(g['pk'])
    for r in P.values():
        r['kind'] = 'two-way' if r['bat'] and r['pitch'] else 'pitcher' if r['pitch'] else 'position'
    out = {'season': season, 'games': games, 'players': sorted(P.values(), key=lambda r: (r['team'], r['kind'], r['name']))}
    json.dump(out, open(os.path.join(HERE, 'participants_%d.json' % season), 'w'), indent=1)
    from collections import Counter
    print('%d: %d games, %d players (%s), %d teams' % (season, len(games), len(P), dict(Counter(r['kind'] for r in P.values())), len(set(r['team'] for r in P.values()))))


if __name__ == '__main__':
    main(int(sys.argv[1]))
