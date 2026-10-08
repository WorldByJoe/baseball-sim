"""
game_feed.py · v0.3 · 2026-10-07

One postseason game from MLB's live feed (playoffs/games/<gamePk>_feed.json,
statsapi.mlb.com/api/v1.1/game/<pk>/feed/live) as the review reads it:
each plate appearance with the base-out state and score it began from, the
batter and pitcher, every pitch (type, speed, spin, plate location, the
batter's zone, the call, the count it was thrown in), the batted ball (exit
speed, launch angle, distance, hit coordinates) and the outcome; the lineups
with their positions; who pitched for each side and in what order.

  python3 review/game_feed.py 849839   ->  review/games/849839.json

CHANGED
  v0.3  each man's position is where he started (allPositions[0]), not where he ended; endPos keeps the other
  v0.2  parse(feed) returns the game, for the live watcher (review/live/poll.py); a play still in progress keeps
        its pitches so far and no outcome
  v0.1  first build (the Yankees-Rays review)
"""
import json, sys, os


def main(pk):
    out = parse(json.load(open('playoffs/games/%s_feed.json' % pk)), pk)
    os.makedirs('review/games', exist_ok=True)
    json.dump(out, open('review/games/%s.json' % pk, 'w'), indent=0)
    teams = out['teams']
    print('%s: %s at %s, %d-%d, %d plate appearances' % (pk, teams['away']['name'], teams['home']['name'], out['final']['away'], out['final']['home'], len(out['pas'])))


def parse(d, pk):
    gd, ld = d['gameData'], d['liveData']
    teams = {s: {'id': gd['teams'][s]['id'], 'name': gd['teams'][s]['name'], 'abbrev': gd['teams'][s].get('abbreviation')} for s in ('away', 'home')}
    box = ld['boxscore']['teams']
    lineups, pitchers = {}, {}
    for s in ('away', 'home'):
        L = []
        for key, p in box[s]['players'].items():
            bo = p.get('battingOrder')
            if bo:
                allp = [x.get('abbreviation') for x in p.get('allPositions', [])]
                # the position he STARTED at (v0.3): 'position' is where he ended, and a man moved during the game had left two
                # starters at one position and none at another in 8 lineups of the division series
                L.append({'id': p['person']['id'], 'name': p['person']['fullName'], 'order': int(bo),
                          'pos': allp[0] if allp else (p.get('position') or {}).get('abbreviation'), 'endPos': (p.get('position') or {}).get('abbreviation'), 'allPos': allp})
        L.sort(key=lambda x: x['order'])
        lineups[s] = L
        pitchers[s] = box[s]['pitchers']
    pas = []
    prev = {'top': None, 'bottom': None}
    score = [0, 0]
    for pl in ld['plays']['allPlays']:
        ab = pl['about']; half = 'top' if ab['isTopInning'] else 'bottom'; inn = ab['inning']
        key = (inn, half)
        if prev.get('key') != key:
            bases, outs = [None, None, None], 0
        else:
            bases, outs = prev['bases'], prev['outs']
        m = pl['matchup']
        pitches, b, s_ = [], 0, 0
        for ev in pl['playEvents']:
            if not ev.get('isPitch'):
                continue
            pd = ev.get('pitchData') or {}; c = pd.get('coordinates') or {}; br = pd.get('breaks') or {}
            det = ev['details']
            pitches.append({'code': det.get('code'), 'desc': det.get('description'), 'type': (det.get('type') or {}).get('code'),
                            'mph': pd.get('startSpeed'), 'rpm': br.get('spinRate'), 'px': c.get('pX'), 'pz': c.get('pZ'),
                            'szTop': pd.get('strikeZoneTop'), 'szBot': pd.get('strikeZoneBottom'), 'ivb': br.get('breakVerticalInduced'),
                            'hb': br.get('breakHorizontal'), 'balls': b, 'strikes': s_, 'inPlay': det.get('isInPlay', False)})
            cnt = ev.get('count') or {}
            b, s_ = cnt.get('balls', b), cnt.get('strikes', s_)
        hit = None
        for ev in pl['playEvents']:
            h = ev.get('hitData')
            if h and h.get('launchSpeed') is not None:
                co = h.get('coordinates') or {}
                hit = {'ev': h.get('launchSpeed'), 'la': h.get('launchAngle'), 'dist': h.get('totalDistance'), 'hcx': co.get('coordX'), 'hcy': co.get('coordY'),
                       'traj': h.get('trajectory'), 'hardness': h.get('hardness'), 'fielder': h.get('location')}
        r = pl['result']
        runs = (r.get('awayScore', score[0]) - score[0]) + (r.get('homeScore', score[1]) - score[1])
        post = [m.get('postOnFirst', {}).get('id') if m.get('postOnFirst') else None,
                m.get('postOnSecond', {}).get('id') if m.get('postOnSecond') else None,
                m.get('postOnThird', {}).get('id') if m.get('postOnThird') else None]
        outsAfter = pl['count'].get('outs', outs)
        pas.append({'i': len(pas), 'inning': inn, 'half': half, 'bat': 'away' if half == 'top' else 'home', 'outs': outs, 'bases': bases,
                    'score': list(score), 'batter': m['batter']['id'], 'batterName': m['batter']['fullName'], 'pitcher': m['pitcher']['id'],
                    'pitcherName': m['pitcher']['fullName'], 'batSide': m['batSide']['code'], 'pitchHand': m['pitchHand']['code'],
                    'event': r.get('event'), 'eventType': r.get('eventType'), 'desc': r.get('description'), 'rbi': r.get('rbi', 0), 'runs': runs,
                    'outsAfter': outsAfter, 'basesAfter': post, 'pitches': pitches, 'hit': hit, 'type': r.get('type')})
        score = [r.get('awayScore', score[0]), r.get('homeScore', score[1])]
        prev = {'key': key, 'bases': post, 'outs': outsAfter}
    ls = ld['linescore']
    lt = ls.get('teams', {})
    out = {'pk': int(pk), 'date': gd['datetime'].get('officialDate'), 'venue': gd['venue']['name'], 'weather': gd.get('weather'), 'teams': teams,
           'lineups': lineups, 'pitchers': pitchers, 'pas': pas,
           'final': {'away': lt.get('away', {}).get('runs', 0), 'home': lt.get('home', {}).get('runs', 0),
                     'hits': [lt.get('away', {}).get('hits', 0), lt.get('home', {}).get('hits', 0)]},
           'status': gd['status'].get('abstractGameState'), 'detailed': gd['status'].get('detailedState'),
           'now': {'inning': ls.get('currentInning'), 'half': ls.get('inningHalf'), 'outs': ls.get('outs'),
                   'balls': ls.get('balls'), 'strikes': ls.get('strikes'),
                   'bases': [bool((ls.get('offense') or {}).get(k)) for k in ('first', 'second', 'third')]},
           'innings': [[i.get('away', {}).get('runs'), i.get('home', {}).get('runs')] for i in ls.get('innings', [])]}
    return out


if __name__ == '__main__':
    for pk in sys.argv[1:]:
        main(pk)
