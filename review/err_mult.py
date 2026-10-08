"""
err_mult.py · v0.1 · 2026-10-07

Each playoff player's error tendency for the replays (review/replay_game.js, mode 'errors'): his 2025-26
regular-season errors per chance (playoffs/fielding_season.json, MLB Stats API) against the rate at the
positions he played, weighted by his chances at each, shrunk toward 1 with 150 chances of prior weight so a
few chances do not make a man look sure-handed or error-prone. rel = his shrunk rate / his positions' rate.
The replays multiply it by one league factor (G, fitted in the replays so their errors per team-game come to
these fielders' own season rate) to get errMult, the engine's scale on his drops, fumbles and wild throws.

  python3 review/err_mult.py   ->  review/err_mult.json

CHANGED
  v0.1  first build (Joe, 2026-10-07: build the per-player error tendencies)
"""
import json

K = 150


def main():
    F = json.load(open('playoffs/fielding_season.json'))
    pos = {}
    for r in F.values():
        for yr in ('2025', '2026'):
            for s in r.get(yr, []):
                if s['pos'] in ('DH', None) or not s['TC']: continue
                p = pos.setdefault(s['pos'], [0, 0]); p[0] += s['E']; p[1] += s['TC']
    rate_pos = {k: v[0] / v[1] for k, v in pos.items()}
    out = {'positions': {k: round(v, 5) for k, v in rate_pos.items()}, 'players': {}}
    for pid, r in F.items():
        E = TC = prior = 0
        for yr in ('2025', '2026'):
            for s in r.get(yr, []):
                if s['pos'] in ('DH', None) or not s['TC']: continue
                E += s['E']; TC += s['TC']; prior += s['TC'] * rate_pos[s['pos']]
        if not TC: continue
        rp = prior / TC; rel = ((E + K * rp) / (TC + K)) / rp
        out['players'][pid] = {'name': r['name'], 'E': E, 'TC': TC, 'rel': round(rel, 3)}
    json.dump(out, open('review/err_mult.json', 'w'), indent=0)
    rels = sorted(p['rel'] for p in out['players'].values())
    print('%d players; rel from %.2f to %.2f, median %.2f' % (len(rels), rels[0], rels[-1], rels[len(rels) // 2]))


if __name__ == '__main__':
    main()
