"""
series_summary.py · v0.2 · 2026-10-08

The postseason forecast from the series simulations (review/series_sim.js, diag_out/series/<name>_<part>.jsonl):
each LCS's winner and length; each World Series pairing's chance (the two LCS taken as independent) and, within
it, each team's chance and the length; and over all pairings, each team's chance to win the World Series and
the World Series' length. Writes review/series_forecast.json.

  python3 review/series_summary.py

CHANGED
  v0.2  the ALCS against either AL Central team, weighted by the model's call of the ALDS's fifth game (the
        Guardians won Game 4); the AL pennant and the World Series over all five teams
  v0.1  first build (Joe, 2026-10-08)
"""
import json, glob
from collections import Counter

NICK = {'CWS': 'White Sox', 'CLE': 'Guardians', 'TB': 'Rays', 'MIL': 'Brewers', 'LAD': 'Dodgers'}


def load(name):
    R = [json.loads(l) for f in sorted(glob.glob('diag_out/series/%s_[0-9].jsonl' % name)) for l in open(f) if l.startswith('{')]
    n = len(R); win = Counter(r['winner'] for r in R); length = Counter(r['games'] for r in R)
    runs = sum(g[1] + g[3] for r in R for g in r['played']) / sum(2 * len(r['played']) for r in R)
    byw = {t: Counter(r['games'] for r in R if r['winner'] == t) for t in win}
    return {'n': n, 'win': {t: win[t] / n for t in win}, 'length': {k: length[k] / n for k in sorted(length)}, 'runs': runs,
            'byWinner': {t: {k: byw[t][k] / n for k in sorted(byw[t])} for t in byw}}


def al_central_odds():
    """The ALDS's fifth game, as the model called it before first pitch (diag_out/predict/849831_errors_*.jsonl, the
    errors set like the series): the Guardians' and the White Sox's chance of reaching the ALCS. Once the game is
    played its winner goes through for certain."""
    try:
        G = json.load(open('review/games/849831.json')); f = G['final']
        return ({'CLE': 1.0, 'CWS': 0.0} if f['home'] > f['away'] else {'CLE': 0.0, 'CWS': 1.0}), 'played'
    except FileNotFoundError: pass
    R = [json.loads(l) for f in glob.glob('diag_out/predict/849831_errors_*.jsonl') for l in open(f) if l.startswith('{')]
    if not R: return {'CWS': 1.0, 'CLE': 0.0}, 'assumed'
    cle = sum(1 for r in R if r['score'][1] > r['score'][0]) / len(R)
    return {'CLE': cle, 'CWS': 1 - cle}, 'predicted'


def main():
    out = {}; w, how = al_central_odds(); out['alCentral'] = {'odds': w, 'how': how}
    alcs = {'CWS': load('ALCS'), 'CLE': load('ALCS_CLE')}; out['ALCS_CWS'] = alcs['CWS']; out['ALCS_CLE'] = alcs['CLE']
    pen = {'TB': sum(w[t] * alcs[t]['win'].get('TB', 0) for t in w)}
    for t in w: pen[t] = w[t] * alcs[t]['win'].get(t, 0)
    length = Counter()
    for t in w:
        for k, v in alcs[t]['length'].items(): length[k] += w[t] * v
    out['ALCS'] = {'win': pen, 'length': dict(length), 'runs': sum(w[t] * alcs[t]['runs'] for t in w), 'n': alcs['CWS']['n']}
    out['NLCS'] = load('NLCS')
    for nm in ('ALCS_CWS', 'ALCS_CLE', 'NLCS'):
        d = out[nm]; print('%s (%d series): %s | length %s | %.2f runs a team-game' % (nm, d['n'], ', '.join('%s %.1f%%' % (NICK[t], 100 * p) for t, p in sorted(d['win'].items(), key=lambda kv: -kv[1])),
              ' '.join('%d:%.0f%%' % (int(k), 100 * v) for k, v in d['length'].items()), d['runs']))
    print('ALDS Game 5 (%s): %s' % (how, ', '.join('%s %.1f%%' % (NICK[t], 100 * p) for t, p in w.items())))
    print('AL pennant: %s' % ', '.join('%s %.1f%%' % (NICK[t], 100 * p) for t, p in sorted(pen.items(), key=lambda kv: -kv[1])))
    champ = Counter(); wl = Counter()
    for al in ('TB', 'CWS', 'CLE'):
        if pen.get(al, 0) <= 0: continue
        for nl in ('MIL', 'LAD'):
            name = 'WS_%s_%s' % (nl, al); d = load(name); pr = pen[al] * out['NLCS']['win'].get(nl, 0)
            out[name] = dict(d, chance=pr)
            for t, p in d['win'].items(): champ[t] += pr * p
            for k, v in d['length'].items(): wl[k] += pr * v
            print('  %s vs %s: happens %.1f%% | %s | length %s' % (NICK[nl], NICK[al], 100 * pr, ', '.join('%s %.1f%%' % (NICK[t], 100 * p) for t, p in sorted(d['win'].items(), key=lambda kv: -kv[1])),
                  ' '.join('%d:%.0f%%' % (int(k), 100 * v) for k, v in d['length'].items())))
    out['champion'] = dict(champ); out['wsLength'] = dict(wl)
    print('World Series champion: %s' % ', '.join('%s %.1f%%' % (NICK[t], 100 * p) for t, p in champ.most_common()))
    print('World Series length: %s; mean %.2f games' % (' '.join('%d games %.0f%%' % (int(k), 100 * v) for k, v in sorted(wl.items(), key=lambda kv: int(kv[0]))), sum(int(k) * v for k, v in wl.items())))
    json.dump(out, open('review/series_forecast.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
