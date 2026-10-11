"""
couch_cards.py · v0.1 · 2026-10-11

The pregame prediction cards for the wall's Couch: each game's prediction (review/predict_next.py,
diag_out/predict/<pk>.json and <pk>_<set>_<part>.jsonl) summarised for couch.html, so the TV shows the same call as
the Postseason page: the starters (and which were assumed), the lineups' source, the park, the home team's share of the
1,000 games and the runs each side averaged, in the regular-season set (the page's first setting) with the
fielders'-own-error-rates set's share beside it, and the final scores as a grid (away runs across, home runs down,
0 to 10 and '10 or more'). Writes site/wall/couch/data/pregame_cards.js (var PREGAME_CARDS = {pk: card}) and, with
--pi, copies it to the Pi beside couch.html.

  python3 review/couch_cards.py [--pi]
"""
import json, glob, os, sys, subprocess
sys.path.insert(0, 'review')
from replay_grids import GAMES, NICK

CAP = 10


def summary(pk, key):
    R = [json.loads(l) for f in sorted(glob.glob('diag_out/predict/%d_%s_*.jsonl' % (pk, key))) for l in open(f) if l.startswith('{')]
    if not R: return None
    grid = [[0] * (CAP + 1) for _ in range(CAP + 1)]   # grid[home][away]
    for r in R: grid[min(CAP, r['score'][1])][min(CAP, r['score'][0])] += 1
    n = len(R)
    return {'n': n, 'homeWin': sum(1 for r in R if r['score'][1] > r['score'][0]) / n, 'awayRuns': sum(r['score'][0] for r in R) / n,
            'homeRuns': sum(r['score'][1] for r in R) / n, 'extras': sum(1 for r in R if r['innings'] > 9) / n, 'grid': grid}


def main():
    cards = {}
    for pk, ser, num, date in GAMES:
        p = 'diag_out/predict/%d.json' % pk
        if not os.path.exists(p): continue
        M = json.load(open(p)); s = summary(pk, 'season'); e = summary(pk, 'errors')
        if not s: continue
        cards[str(pk)] = {'pk': pk, 'series': ser, 'game': num, 'date': date, 'away': M['away'], 'home': M['home'], 'awayName': NICK[M['away']], 'homeName': NICK[M['home']],
                          'starters': M['starters'], 'assumedTeams': M.get('assumedTeams') or ([M['away'], M['home']] if M.get('assumed') else []),
                          'lineups': M.get('lineups', ''), 'park': M.get('park', ''), 'ran': M.get('ran', ''), 'season': s, 'errorsHomeWin': e['homeWin'] if e else None}
    os.makedirs('site/wall/couch/data', exist_ok=True)
    open('site/wall/couch/data/pregame_cards.js', 'w').write('// couch_cards.py: the pregame prediction cards (review/predict_next.py), for couch.html\nvar PREGAME_CARDS = ' + json.dumps(cards, separators=(',', ':')) + ';\n')
    print('%d cards: %s' % (len(cards), ', '.join('%s G%d' % (c['series'], c['game']) for c in cards.values())))
    if '--pi' in sys.argv:
        r = subprocess.run(['scp', '-q', '-o', 'ConnectTimeout=10', 'site/wall/couch/data/pregame_cards.js', 'joe@tvpi.local:tv_art/couch/data/pregame_cards.js'])
        print('copied to the Pi' if r.returncode == 0 else 'the Pi did not answer')


if __name__ == '__main__':
    main()
