"""
fetch_context.py · v0.1 · 2026-10-12

Everything besides the pitches that the season-by-season measurement needs (playoffs/measure_traits.py, run on
history/ by history/measure_seasons.py), for every postseason participant (history/participants_<season>.json):
  rosters.json         bio (bats, throws, height, weight, birth date, position) from the MLB Stats API, in the shape
                       playoffs/rosters.json has; his team is the one he played for in the latest postseason given
  season_stats.json    regular-season lines, hitting and pitching, for each season asked (playoffs/fetch_mlb.season_line)
  leaderboards/        Savant's leaderboards for each season (playoffs/fetch_statcast.LB); the 2025 and 2026 boards are
                       copied from playoffs/leaderboards/

  python3 history/fetch_context.py --post 2025 --years 2024,2025,2026

CHANGED
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys, shutil, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'playoffs'))
from common import fetch_json, fetch, csv_check
from fetch_mlb import season_line, STAT_KEYS_H, STAT_KEYS_P
from fetch_statcast import LB

API = 'https://statsapi.mlb.com/api/v1/'


def age_on(birth, day):
    b = datetime.date.fromisoformat(birth); d = datetime.date.fromisoformat(day)
    return round((d - b).days / 365.25, 2)


def main(argv):
    posts = [int(x) for x in argv[argv.index('--post') + 1].split(',')]
    years = [int(x) for x in argv[argv.index('--years') + 1].split(',')]
    players = {}
    for s in sorted(posts):   # the latest postseason given sets a man's team
        for p in json.load(open(os.path.join(HERE, 'participants_%d.json' % s)))['players']:
            players[p['id']] = dict(p, post=s)
    ros, stats = [], {}
    for pid, p in sorted(players.items()):
        d = fetch_json(API + 'people/%d?hydrate=currentTeam' % pid, 'history/people/%d.json' % pid)['people'][0]
        h = d.get('height', "6' 0\""); ft, inch = h.replace('"', '').split("'")
        ros.append({'id': pid, 'name': d['fullName'], 'team': None, 'teamAbbrev': p['team'], 'position': d['primaryPosition']['abbreviation'],
                    'primaryPosition': d['primaryPosition']['abbreviation'], 'kind': p['kind'], 'bats': d['batSide']['code'], 'throws': d['pitchHand']['code'],
                    'heightIn': int(ft) * 12 + int(inch or 0), 'weightLb': d.get('weight'), 'birthDate': d.get('birthDate'),
                    'age': age_on(d['birthDate'], '%d-10-01' % p['post']) if d.get('birthDate') else None, 'mlbDebut': d.get('mlbDebutDate'),
                    'szTop': d.get('strikeZoneTop'), 'szBot': d.get('strikeZoneBottom'), 'post': p['post']})
        rec = {}
        for y in years:
            for grp in ('hitting', 'pitching'):
                if (grp == 'pitching' and p['kind'] == 'position') or (grp == 'hitting' and p['kind'] == 'pitcher'): continue
                dd = fetch_json(API + 'people/%d/stats?stats=season&group=%s&season=%d&sportId=1&gameType=R' % (pid, grp, y), 'statsapi/stats/%d_%s_%d.json' % (pid, grp, y))
                rec['%s_%d' % (grp, y)] = season_line(dd, STAT_KEYS_P if grp == 'pitching' else STAT_KEYS_H)
        stats[pid] = rec
    json.dump({'note': 'postseason participants; team = the latest postseason given', 'players': ros}, open(os.path.join(HERE, 'rosters.json'), 'w'), indent=1)
    json.dump({'note': 'regular season, MLB only; None = no MLB games that season', 'players': stats}, open(os.path.join(HERE, 'season_stats.json'), 'w'), indent=1)
    os.makedirs(os.path.join(HERE, 'leaderboards'), exist_ok=True)
    for name, (url, key) in sorted(LB.items()):
        for y in years:
            src = os.path.join(HERE, '..', 'playoffs', 'leaderboards', '%s_%d.csv' % (name, y)); dst = os.path.join(HERE, 'leaderboards', '%s_%d.csv' % (name, y))
            if os.path.exists(src): shutil.copy(src, dst); continue
            data = fetch(url.format(y=y), 'leaderboards/%s_%d.csv' % (name, y), check=csv_check(key))
            if data and data.strip().count(b'\n'):
                open(dst, 'w', encoding='utf-8').write(data.decode('utf-8-sig', 'replace').replace('\r\n', '\n'))
            print('  leaderboard %-28s %d %s' % (name, y, 'ok' if os.path.exists(dst) else 'MISSING'))
    print('%d players: bios and %d seasons of stats' % (len(ros), len(years)))


if __name__ == '__main__':
    main(sys.argv[1:])
