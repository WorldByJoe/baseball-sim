"""
as_pitched.py · v0.1 · 2026-10-07

Each pitcher as he pitched in a postseason game, for the replays (review/replay_game.js, mode 'pitched'): for
every pitch type he threw 3+ times, his game-day release speed against his regular-season mean for it (the
change, mph), and his mix that day (each type's share of his pitches). Uses the same reading of the feed and the
season files as review/ps_behavior.py.

  python3 review/as_pitched.py [pk ...]   ->  review/as_pitched/<pk>.json

CHANGED
  v0.1  first build (Joe, 2026-10-07: the replays with the pitching as it was)
"""
import json, sys, os
sys.path.insert(0, 'review')
from ps_behavior import GAMES, game_pitches, season, mean


def main(pks):
    os.makedirs('review/as_pitched', exist_ok=True)
    for pk in pks:
        f = 'playoffs/games/%d_feed.json' % pk
        if not os.path.exists(f): continue
        by = game_pitches(json.load(open(f))); out = {}
        for pid, game in by.items():
            G = season(pid); allp = [p for g in G.values() for p in g]
            types = {}
            for t in sorted({p['t'] for p in game if p['t']}):
                gp = [p for p in game if p['t'] == t]
                rec = {'n': len(gp), 'share': round(len(gp) / len(game), 4)}
                sv = mean([p['v'] for p in allp if p['t'] == t])
                if len(gp) >= 3 and sv is not None and mean([p['v'] for p in gp]) is not None:
                    rec['dv'] = round(mean([p['v'] for p in gp]) - sv, 2)
                types[t] = rec
            out[str(pid)] = {'n': len(game), 'types': types}
        json.dump(out, open('review/as_pitched/%d.json' % pk, 'w'), indent=0)
        dv = [t['dv'] for p in out.values() for t in p['types'].values() if 'dv' in t]
        print(pk, '%d pitchers, %d types with a speed change, mean %+.2f mph' % (len(out), len(dv), sum(dv) / len(dv)))


if __name__ == '__main__':
    main([int(a) for a in sys.argv[1:]] or GAMES)
