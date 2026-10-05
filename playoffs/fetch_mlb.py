"""
fetch_mlb.py · v0.1 · 2026-10-04

Step 1 of the playoff data pull: the postseason schedule, the eight rosters,
the parks, the season totals, and each game's weather. From the MLB Stats API
(https://statsapi.mlb.com/api/v1/), plus the weather of games not yet
played: the National Weather Service hourly forecast (api.weather.gov, about
a week out) and every park's October climate at game time, 2016-2025, from
the Open-Meteo archive (ERA5). Open-Meteo's own forecast host timed out from
the cloud sandbox on 2026-10-04.

Writes, under playoffs/:
  schedule_2026_post.json   every postseason game, probable pitchers, results so far
  rosters.json              the active roster of each team on ROSTER_DATE, with the 40-man flag
  venues.json               every park on the schedule (and the eight teams' home parks), in the engine's terms
  season_stats.json         2025 and 2026 regular-season totals, hitting and pitching
  weather.json              per game: reported (played), forecast, and the park's climate at that hour

  python3 playoffs/fetch_mlb.py
"""
import datetime, json, math, os, statistics as st, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HERE, TEAMS, ROSTER_DATE, fetch_json, write_failures, FAILURES

API = 'https://statsapi.mlb.com/api/v1/'
SCHED = API + 'schedule?sportId=1&season=2026&gameTypes=F,D,L,W&hydrate=team,venue,probablePitcher,linescore'
TODAY = datetime.date.today().isoformat()


def inches(h):
    """6' 1\" -> 73"""
    try:
        ft, _, rest = h.partition("'")
        return int(ft) * 12 + int(rest.strip().strip('"').strip() or 0)
    except Exception:
        return None


def age_on(birth, day='2026-10-01'):
    if not birth:
        return None
    b, d = datetime.date.fromisoformat(birth), datetime.date.fromisoformat(day)
    return round((d - b).days / 365.2425, 2)


def schedule():
    # the schedule changes by the hour in October: cached per day pulled
    d = fetch_json(SCHED, 'statsapi/schedule_%s.json' % TODAY)
    games = []
    for dt in d['dates']:
        for g in dt['games']:
            row = {'gamePk': g['gamePk'], 'date': g['officialDate'], 'gameDateUTC': g['gameDate'],
                   'gameType': g['gameType'], 'series': g.get('seriesDescription'), 'seriesGame': g.get('seriesGameNumber'),
                   'gamesInSeries': g.get('gamesInSeries'), 'ifNecessary': g.get('ifNecessary') == 'Y',
                   'status': g['status']['detailedState'], 'dayNight': g.get('dayNight'),
                   'venue': {'id': g['venue']['id'], 'name': g['venue']['name']}}
            for side in ('away', 'home'):
                t = g['teams'][side]
                pp = t.get('probablePitcher')
                row[side] = {'id': t['team']['id'], 'name': t['team']['name'], 'score': t.get('score'),
                             'isWinner': t.get('isWinner'), 'seriesRecord': t.get('leagueRecord'),
                             'probablePitcher': {'id': pp['id'], 'name': pp['fullName']} if pp else None}
            ls = g.get('linescore')
            if ls and ls.get('innings'):
                row['linescore'] = {'innings': len(ls['innings']),
                                    'runs': [ls['teams']['away'].get('runs'), ls['teams']['home'].get('runs')],
                                    'hits': [ls['teams']['away'].get('hits'), ls['teams']['home'].get('hits')],
                                    'errors': [ls['teams']['away'].get('errors'), ls['teams']['home'].get('errors')]}
            games.append(row)
    out = {'pulled': TODAY, 'url': SCHED, 'teamsRemaining': list(TEAMS), 'games': games}
    json.dump(out, open(os.path.join(HERE, 'schedule_2026_post.json'), 'w'), indent=1)
    print('schedule: %d games (%d final)' % (len(games), sum(g['status'] == 'Final' for g in games)))
    return games


def kind_of(person, pos):
    t = (pos or {}).get('type') or person.get('primaryPosition', {}).get('type')
    if t == 'Two-Way Player' or (pos or {}).get('abbreviation') == 'TWP':
        return 'two-way'
    return 'pitcher' if t == 'Pitcher' else 'position'


def rosters():
    players, teams = [], {}
    for tid in TEAMS:
        team = fetch_json(API + 'teams/%d' % tid, 'statsapi/team_%d.json' % tid)['teams'][0]
        teams[tid] = {'id': tid, 'name': team['name'], 'abbrev': team.get('abbreviation'), 'venueId': team['venue']['id'],
                      'league': team.get('league', {}).get('name')}
        act = fetch_json(API + 'teams/%d/roster?rosterType=active&date=%s&hydrate=person' % (tid, ROSTER_DATE),
                         'statsapi/roster_active_%d_%s.json' % (tid, ROSTER_DATE))
        forty = fetch_json(API + 'teams/%d/roster?rosterType=40Man&date=%s' % (tid, ROSTER_DATE),
                           'statsapi/roster_40man_%d_%s.json' % (tid, ROSTER_DATE))
        on40 = {r['person']['id'] for r in (forty or {}).get('roster', [])}
        for r in act['roster']:
            p = r['person']
            players.append({
                'id': p['id'], 'name': p['fullName'], 'team': tid, 'teamAbbrev': team.get('abbreviation'),
                'jersey': r.get('jerseyNumber'), 'position': r['position']['abbreviation'],
                'primaryPosition': p.get('primaryPosition', {}).get('abbreviation'),
                'kind': kind_of(p, r['position']), 'bats': p.get('batSide', {}).get('code'),
                'throws': p.get('pitchHand', {}).get('code'), 'heightIn': inches(p.get('height', '')),
                'weightLb': p.get('weight'), 'birthDate': p.get('birthDate'), 'age': age_on(p.get('birthDate')),
                'mlbDebut': p.get('mlbDebutDate'), 'on40Man': p['id'] in on40,
                'szTop': p.get('strikeZoneTop'), 'szBot': p.get('strikeZoneBottom')})
        print('  roster %s: %d active, %d on the 40-man' % (team.get('abbreviation'), len(act['roster']), len(on40)))
    out = {'pulled': TODAY, 'rosterDate': ROSTER_DATE, 'rosterType': 'active',
           'note': 'Postseason rosters are the active roster on the date pulled; they can change between series.',
           'teams': teams, 'players': players}
    json.dump(out, open(os.path.join(HERE, 'rosters.json'), 'w'), indent=1)
    kinds = {}
    for p in players:
        kinds[p['kind']] = kinds.get(p['kind'], 0) + 1
    print('rosters: %d players %s' % (len(players), kinds))
    return players, teams


def venues(games, teams):
    ids = sorted({g['venue']['id'] for g in games} | {t['venueId'] for t in teams.values()})
    out = {}
    for vid in ids:
        d = fetch_json(API + 'venues/%d?hydrate=location,fieldInfo' % vid, 'statsapi/venue_%d.json' % vid)
        if not d or not d.get('venues'):
            continue
        v = d['venues'][0]
        loc, fi = v.get('location', {}), v.get('fieldInfo', {})
        if not fi and not loc.get('elevation'):
            continue          # placeholder venues (TBD, "AL Stadium") for games not yet set
        fence = [fi.get(k) for k in ('leftLine', 'leftCenter', 'center', 'rightCenter', 'rightLine')]
        co = loc.get('defaultCoordinates', {})
        out[vid] = {'id': vid, 'name': v['name'], 'city': loc.get('city'), 'state': loc.get('stateAbbrev'),
                    'lat': co.get('latitude'), 'lon': co.get('longitude'), 'elevFt': loc.get('elevation'),
                    'azimuthDeg': loc.get('azimuthAngle'), 'roof': fi.get('roofType'), 'turf': fi.get('turfType'),
                    'capacity': fi.get('capacity'),
                    'dims': {k: fi.get(k) for k in ('leftLine', 'left', 'leftCenter', 'center', 'rightCenter', 'right', 'rightLine')},
                    'fence': fence if all(fence) else None,
                    'homeOf': [t['abbrev'] for t in teams.values() if t['venueId'] == vid]}
    json.dump({'pulled': TODAY, 'note': 'fence = [left line, left-centre, centre, right-centre, right line] ft, the engine makeEnv order; '
               'azimuthDeg as the API gives it (0 where it is not filled in)', 'venues': out},
              open(os.path.join(HERE, 'venues.json'), 'w'), indent=1)
    print('venues: %d' % len(out))
    return out


STAT_KEYS_H = {'gamesPlayed': 'G', 'plateAppearances': 'PA', 'atBats': 'AB', 'hits': 'H', 'doubles': '2B', 'triples': '3B',
               'homeRuns': 'HR', 'baseOnBalls': 'BB', 'intentionalWalks': 'IBB', 'strikeOuts': 'SO', 'hitByPitch': 'HBP',
               'sacFlies': 'SF', 'sacBunts': 'SH', 'stolenBases': 'SB', 'caughtStealing': 'CS', 'numberOfPitches': 'pitches'}
STAT_KEYS_P = dict(STAT_KEYS_H, **{'gamesPitched': 'G', 'gamesStarted': 'GS', 'battersFaced': 'BF', 'inningsPitched': 'IP',
                                   'outs': 'outs', 'numberOfPitches': 'pitches', 'saves': 'SV', 'holds': 'HLD',
                                   'earnedRuns': 'ER', 'gamesFinished': 'GF'})


def season_line(d, keys):
    """the season line from a stats response; a player who changed teams has a split per team and one without a team (the total)"""
    if not d or not d.get('stats'):
        return None
    splits = d['stats'][0].get('splits', [])
    if not splits:
        return None
    tot = [s for s in splits if 'team' not in s]
    if tot:
        s = tot[0]['stat']
    elif len(splits) == 1:
        s = splits[0]['stat']
    else:          # no total given: add the team splits
        s = {}
        for sp in splits:
            for k, v in sp['stat'].items():
                if k == 'inningsPitched':
                    a, _, b = str(v).partition('.')
                    s['outs_ip'] = s.get('outs_ip', 0) + int(a) * 3 + int(b or 0)
                elif isinstance(v, (int, float)):
                    s[k] = s.get(k, 0) + v
        if 'outs_ip' in s:
            s['inningsPitched'] = '%d.%d' % divmod(s.pop('outs_ip'), 3)
    out = {short: s.get(k) for k, short in keys.items() if k in s}
    out['teams'] = [sp['team']['abbreviation'] if 'abbreviation' in sp.get('team', {}) else sp.get('team', {}).get('id')
                    for sp in splits if 'team' in sp]
    return out


def season_stats(players):
    out = {}
    for p in players:
        rec = {}
        for year in (2025, 2026):
            for grp in ('hitting', 'pitching'):
                if grp == 'pitching' and p['kind'] == 'position':
                    continue
                if grp == 'hitting' and p['kind'] == 'pitcher':
                    continue
                url = API + 'people/%d/stats?stats=season&group=%s&season=%d&sportId=1&gameType=R' % (p['id'], grp, year)
                d = fetch_json(url, 'statsapi/stats/%d_%s_%d.json' % (p['id'], grp, year))
                rec['%s_%d' % (grp, year)] = season_line(d, STAT_KEYS_P if grp == 'pitching' else STAT_KEYS_H)
        out[p['id']] = rec
    json.dump({'pulled': TODAY, 'note': 'regular season, MLB only; None = no MLB games that season', 'players': out},
              open(os.path.join(HERE, 'season_stats.json'), 'w'), indent=1)
    print('season stats: %d players' % len(out))
    return out


# ---- weather -------------------------------------------------------------------------------
HOURLY = 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure'
CLIMATE_YEARS = range(2016, 2026)


def compass_mean(degs, speeds):
    x = sum(s * math.sin(math.radians(d)) for d, s in zip(degs, speeds))
    y = sum(s * math.cos(math.radians(d)) for d, s in zip(degs, speeds))
    return round(math.degrees(math.atan2(x, y)) % 360, 0), round(math.hypot(x, y) / max(1, len(degs)), 1)


def climate(v):
    """the park's October evening climate: hourly 2016-2025, Oct 1 - Nov 3, local time"""
    clim = {}
    for y in CLIMATE_YEARS:
        url = ('https://archive-api.open-meteo.com/v1/archive?latitude=%s&longitude=%s&start_date=%d-10-01&end_date=%d-11-03'
               '&hourly=%s&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto' % (v['lat'], v['lon'], y, y, HOURLY))
        d = fetch_json(url, 'weather/climate_%d_%d.json' % (v['id'], y), pause=0.5, timeout=60)
        if d:
            clim[y] = d['hourly']
    return clim


def climate_at(clim, month_day, hour, window=7):
    """temperature, humidity and wind at `hour` local within +-window days of month_day, over the years"""
    md = datetime.date(2001, *month_day)
    T, RH, WS, WD, PR = [], [], [], [], []
    for y, h in clim.items():
        for i, ts in enumerate(h['time']):
            dt = datetime.datetime.fromisoformat(ts)
            if abs(hour - dt.hour) > 0 or abs((datetime.date(2001, dt.month, dt.day) - md).days) > window:
                continue
            if h['temperature_2m'][i] is None:
                continue
            T.append(h['temperature_2m'][i]); RH.append(h['relative_humidity_2m'][i])
            WS.append(h['wind_speed_10m'][i]); WD.append(h['wind_direction_10m'][i]); PR.append(h['precipitation'][i] or 0)
    if len(T) < 10:
        return None
    wd, wres = compass_mean(WD, WS)
    return {'n_hours': len(T), 'tempF': {'mean': round(st.mean(T), 1), 'sd': round(st.pstdev(T), 1)},
            'rh': {'mean': round(st.mean(RH) / 100, 2), 'sd': round(st.pstdev(RH) / 100, 2)},
            'windMph': {'mean': round(st.mean(WS), 1), 'sd': round(st.pstdev(WS), 1)},
            'windFromDeg_vectorMean': wd, 'windVectorMeanMph': wres,
            'rainyHourShare': round(sum(p > 0.2 for p in PR) / len(PR), 3)}


def forecast(v, utc):
    """the US National Weather Service's hourly forecast (about 7 days out) for the first-pitch hour"""
    pt = fetch_json('https://api.weather.gov/points/%.4f,%.4f' % (v['lat'], v['lon']), 'weather/nws_point_%d.json' % v['id'],
                    pause=0.5, timeout=40)
    if not pt:
        return None
    d = fetch_json(pt['properties']['forecastHourly'], 'weather/nws_hourly_%d_%s.json' % (v['id'], TODAY), pause=0.5, timeout=40)
    if not d:
        return None
    for per in d['properties']['periods']:
        t0 = datetime.datetime.fromisoformat(per['startTime'])
        t1 = datetime.datetime.fromisoformat(per['endTime'])
        if t0 <= utc < t1:
            ws = per.get('windSpeed') or ''
            return {'issued': d['properties'].get('generatedAt') or d['properties'].get('updateTime'),
                    'source': 'api.weather.gov hourly', 'tempF': per['temperature'] if per.get('temperatureUnit') == 'F' else None,
                    'rh': (per.get('relativeHumidity') or {}).get('value', 0) / 100 if per.get('relativeHumidity') else None,
                    'windMph': float(ws.split()[0]) if ws[:1].isdigit() else None, 'windFrom': per.get('windDirection'),
                    'precipChance': (per.get('probabilityOfPrecipitation') or {}).get('value'), 'sky': per.get('shortForecast')}
    return None


def weather(games, vens, teams):
    climates = {vid: climate(v) for vid, v in vens.items() if v.get('lat')}
    out, typical_hour = [], {}
    for g in games:
        utc = datetime.datetime.fromisoformat(g['gameDateUTC'].replace('Z', '+00:00'))
        v = vens.get(g['venue']['id'])
        rec = {'gamePk': g['gamePk'], 'date': g['date'], 'series': g['series'], 'seriesGame': g['seriesGame'],
               'venueId': g['venue']['id'], 'venue': g['venue']['name'], 'firstPitchUTC': g['gameDateUTC']}
        if v:
            rec['roof'] = v['roof']
            if g['status'] in ('Final', 'Game Over', 'Completed Early') or g['status'].startswith('In Progress'):
                feed = fetch_json(API.replace('/v1/', '/v1.1/') + 'game/%d/feed/live' % g['gamePk'],
                                  'statsapi/feed_%d.json' % g['gamePk'])
                if feed:
                    rec['reported'] = feed['gameData'].get('weather')
            else:
                rec['forecast'] = forecast(v, utc)
            clim = climates.get(v['id'])
            if clim:
                off = next(iter(clim.values()))
                # local hour of first pitch from the archive's own utc offset
                tz = fetch_json('https://archive-api.open-meteo.com/v1/archive?latitude=%s&longitude=%s&start_date=2025-10-10&end_date=2025-10-10&hourly=temperature_2m&timezone=auto'
                                % (v['lat'], v['lon']), 'weather/tz_%d.json' % v['id'], pause=0.5, timeout=60)
                lt = utc + datetime.timedelta(seconds=tz['utc_offset_seconds']) if tz else utc
                rec['localFirstPitch'] = lt.strftime('%H:%M')
                hour = lt.hour + (1 if lt.minute >= 30 else 0) + 1          # the middle of the game's first half
                rec['climate'] = climate_at(clim, (utc.month, utc.day), min(hour, 23))
                rec['climate_note'] = 'Open-Meteo archive (ERA5), %d-%d, +-7 days of the date, the hour after first pitch' % (min(CLIMATE_YEARS), max(CLIMATE_YEARS))
        out.append(rec)
    # parks for the games still to be placed (LCS, World Series): every remaining team's home park at 20:00 local
    possible = {}
    for t in teams.values():
        v = vens.get(t['venueId'])
        if not v or v['id'] not in climates:
            continue
        possible[t['abbrev']] = {'venueId': v['id'], 'venue': v['name'], 'roof': v['roof'],
                                 'mid_october_20h': climate_at(climates[v['id']], (10, 15), 20),
                                 'late_october_20h': climate_at(climates[v['id']], (10, 27), 20)}
    json.dump({'pulled': TODAY, 'units': 'tempF in F, rh as a share, wind in mph, windFromDeg compass (0 = from the north)',
               'note': 'Closed or fixed roofs: the engine holds 72 F indoors. A reported value is the Stats API game-day report. '
                       'A forecast is the National Weather Service hourly forecast for the first-pitch hour (about 7 days out); '
                       'later games have only the climate.',
               'games': out, 'homeParkClimate': possible}, open(os.path.join(HERE, 'weather.json'), 'w'), indent=1)
    print('weather: %d games (%d reported, %d forecast), %d parks with climate' % (
        len(out), sum(1 for r in out if r.get('reported')), sum(1 for r in out if r.get('forecast')), len(climates)))


def main():
    games = schedule()
    players, teams = rosters()
    vens = venues(games, teams)
    season_stats(players)
    weather(games, vens, teams)
    write_failures('mlb')
    print('%d failures' % len(FAILURES))


if __name__ == '__main__':
    main()
