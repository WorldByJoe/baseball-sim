"""
series_summary.py · v0.1 · 2026-10-08

The postseason forecast from the series simulations (review/series_sim.js, diag_out/series/<name>_<part>.jsonl):
each LCS's winner and length; each World Series pairing's chance (the two LCS taken as independent) and, within
it, each team's chance and the length; and over all pairings, each team's chance to win the World Series and
the World Series' length. Writes review/series_forecast.json.

  python3 review/series_summary.py

CHANGED
  v0.1  first build (Joe, 2026-10-08)
"""
import json, glob
from collections import Counter

NICK = {'CWS': 'White Sox', 'TB': 'Rays', 'MIL': 'Brewers', 'LAD': 'Dodgers'}


def load(name):
    R = [json.loads(l) for f in sorted(glob.glob('diag_out/series/%s_*.jsonl' % name)) for l in open(f) if l.startswith('{')]
    n = len(R); win = Counter(r['winner'] for r in R); length = Counter(r['games'] for r in R)
    runs = sum(g[1] + g[3] for r in R for g in r['played']) / sum(2 * len(r['played']) for r in R)
    byw = {t: Counter(r['games'] for r in R if r['winner'] == t) for t in win}
    return {'n': n, 'win': {t: win[t] / n for t in win}, 'length': {k: length[k] / n for k in sorted(length)}, 'runs': runs,
            'byWinner': {t: {k: byw[t][k] / n for k in sorted(byw[t])} for t in byw}}


def main():
    out = {}
    for s in ('ALCS', 'NLCS'):
        out[s] = load(s); d = out[s]
        print('%s (%d series): %s | length %s | %.2f runs a team-game' % (s, d['n'], ', '.join('%s %.1f%%' % (NICK[t], 100 * p) for t, p in sorted(d['win'].items(), key=lambda kv: -kv[1])),
              ' '.join('%d:%.0f%%' % (k, 100 * v) for k, v in d['length'].items()), d['runs']))
    champ = Counter(); length = Counter(); pairs = {}
    for al in ('TB', 'CWS'):
        for nl in ('MIL', 'LAD'):
            name = 'WS_%s_%s' % (nl, al); d = load(name); pr = out['ALCS']['win'].get(al, 0) * out['NLCS']['win'].get(nl, 0)
            pairs[name] = dict(d, chance=pr); out[name] = pairs[name]
            for t, p in d['win'].items(): champ[t] += pr * p
            for k, v in d['length'].items(): length[k] += pr * v
            print('  %s vs %s: happens %.1f%% | %s | length %s' % (NICK[nl], NICK[al], 100 * pr, ', '.join('%s %.1f%%' % (NICK[t], 100 * p) for t, p in sorted(d['win'].items(), key=lambda kv: -kv[1])),
                  ' '.join('%d:%.0f%%' % (k, 100 * v) for k, v in d['length'].items())))
    out['champion'] = dict(champ); out['wsLength'] = dict(length)
    print('World Series champion: %s' % ', '.join('%s %.1f%%' % (NICK[t], 100 * p) for t, p in champ.most_common()))
    print('World Series length: %s; mean %.2f games' % (' '.join('%d games %.0f%%' % (k, 100 * v) for k, v in sorted(length.items())), sum(k * v for k, v in length.items())))
    json.dump(out, open('review/series_forecast.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
