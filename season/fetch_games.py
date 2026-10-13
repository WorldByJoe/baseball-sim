"""
fetch_games.py · v0.1 · 2026-10-13

Every 2026 regular-season game: MLB's schedule (final games only; a suspended game counts once, on the day it ended),
each game's live feed (season/raw/feeds/<pk>.json) parsed as review/game_feed.py parses a postseason game
(season/games/<pk>.json), and the final standings (season/standings.json: wins, losses, division, league).
Writes season/schedule.json: pk, date, block (h1 through the All-Star break, h2 after), teams, final score, venue.

  python3 season/fetch_games.py

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import json, os, sys, urllib.request, time
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'review'))
from game_feed import parse

API = 'https://statsapi.mlb.com/api/v1'
UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}
ASB = '2026-07-13'


def get(url, tries=4):
    for k in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
        except Exception as e:
            if k == tries - 1: raise
            time.sleep(2 ** (k + 1))


def one(g):
    pk = g['pk']; raw = os.path.join(HERE, 'raw', 'feeds', '%d.json' % pk); out = os.path.join(HERE, 'games', '%d.json' % pk)
    if os.path.exists(out): return pk, None
    try:
        if not os.path.exists(raw):
            open(raw, 'wb').write(get('https://statsapi.mlb.com/api/v1.1/game/%d/feed/live' % pk))
        G = parse(json.load(open(raw)), pk)
        json.dump(G, open(out, 'w'), separators=(',', ':'))
        return pk, None
    except Exception as e:
        return pk, str(e)[:200]


def main():
    os.makedirs(os.path.join(HERE, 'raw', 'feeds'), exist_ok=True); os.makedirs(os.path.join(HERE, 'games'), exist_ok=True)
    S = json.loads(get(API + '/schedule?sportId=1&season=2026&gameType=R&hydrate=venue'))
    games, seen = [], set()
    for d in S['dates']:
        for g in d['games']:
            if g['status']['detailedState'] not in ('Final', 'Game Over', 'Completed Early') or g['gamePk'] in seen: continue
            if g.get('resumedFrom') or g['status'].get('statusCode') == 'S': pass
            seen.add(g['gamePk'])
            date = g.get('officialDate') or d['date']
            games.append({'pk': g['gamePk'], 'date': date, 'block': 'h1' if date <= ASB else 'h2',
                          'away': g['teams']['away']['team']['id'], 'home': g['teams']['home']['team']['id'],
                          'awayName': g['teams']['away']['team']['name'], 'homeName': g['teams']['home']['team']['name'],
                          'final': [g['teams']['away'].get('score'), g['teams']['home'].get('score')], 'venue': g['venue']['id'], 'venueName': g['venue']['name'],
                          'doubleHeader': g.get('doubleHeader'), 'inningsScheduled': g.get('scheduledInnings', 9)})
    json.dump(games, open(os.path.join(HERE, 'schedule.json'), 'w'), indent=0)
    print('%d final games (%d first half, %d second)' % (len(games), sum(g['block'] == 'h1' for g in games), sum(g['block'] == 'h2' for g in games)), flush=True)
    St = json.loads(get(API + '/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason&hydrate=team'))
    tab = []
    for rec in St['records']:
        for t in rec['teamRecords']:
            tab.append({'team': t['team']['id'], 'name': t['team']['name'], 'abbrev': t['team'].get('abbreviation'), 'division': rec['division']['id'],
                        'league': rec['league']['id'], 'w': t['wins'], 'l': t['losses'], 'rs': t.get('runsScored'), 'ra': t.get('runsAllowed'), 'divRank': t.get('divisionRank')})
    json.dump(tab, open(os.path.join(HERE, 'standings.json'), 'w'), indent=1)
    print('standings: %d teams' % len(tab), flush=True)
    bad = []
    with ThreadPoolExecutor(4) as ex:
        for k, (pk, err) in enumerate(ex.map(one, games)):
            if err: bad.append((pk, err))
            if k % 200 == 0: print('  %d/%d' % (k, len(games)), flush=True)
    json.dump(bad, open(os.path.join(HERE, 'games_failed.json'), 'w'), indent=1)
    print('parsed %d, failed %d' % (len(games) - len(bad), len(bad)))


if __name__ == '__main__':
    main()
