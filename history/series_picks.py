"""
series_picks.py · v0.1 · 2026-10-13

Who won each round, against two calls by the model:
  forecast   before Game 1 (history/series_specs.py + review/series_sim.js, fielders at their own error rates): the share
             of the simulated series each team won
  replays    after the fact, as the Postseason page's series table does it: each game's share of its 1,000 replays for
             the series winner, the games not played filled with the series' average, combined into the chance of winning
             a best-of-n (replay_grids.series_chance); the replays know each game's real lineups and pitchers, so this
             is the model's verdict on how deserved each result was, not a prediction
Per October and round: the favourite, its chance, the real winner, and whether the favourite won.

  python3 history/series_picks.py        -> history/series_picks.json

CHANGED
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys, glob
REV = os.path.expanduser('~/bsim-wt/review')
sys.path.insert(0, os.path.join(REV, 'review'))
from replay_grids import series_chance, SETS

ROUND = {'F': 'Wild Card', 'D': 'Division Series', 'L': 'League Championship Series', 'W': 'World Series'}


def main():
    out = []
    for y, wt in ((2024, '~/bsim-wt/hist2024'), (2025, '~/bsim-wt/hist2025'), (2026, '~/bsim-wt/hist2026')):
        wt = os.path.expanduser(wt); idx = os.path.join(wt, 'review', 'series', 'index_%d.json' % y)
        if not os.path.exists(idx): continue
        for spec in json.load(open(idx)):
            S = json.load(open(os.path.join(wt, spec))); W = S['real']['winner']; L = S['lo'] if W == S['hi'] else S['hi']
            n = len(S['homeOf']); need = n // 2 + 1
            done = max(S['real']['wins'].values()) >= need
            row = {'year': y, 'round': ROUND[S['type']], 'hi': S['hi'], 'lo': S['lo'], 'winner': W if done else None, 'wins': S['real']['wins'], 'bestOf': n}
            f = os.path.join(wt, 'diag_out', 'series_fc', os.path.basename(spec).replace('.json', '.jsonl'))
            if os.path.exists(f):
                R = [json.loads(l) for l in open(f) if l.startswith('{')]
                if R:
                    pw = sum(r['winner'] == W for r in R) / len(R); fav = W if pw >= 0.5 else L
                    row['forecast'] = {'n': len(R), 'winnerChance': round(pw, 3), 'favourite': fav, 'favChance': round(max(pw, 1 - pw), 3), 'right': fav == W}
            for key, d in SETS:
                ps = []
                for pk, a, h, ab, hb in S['real']['games']:
                    g = os.path.join(wt, d, '%d.jsonl' % pk)
                    if not os.path.exists(g): ps = None; break
                    Rg = [json.loads(l) for l in open(g) if l.startswith('{')]
                    hw = sum(r['score'][1] > r['score'][0] for r in Rg) / len(Rg)
                    ps.append(hw if hb == W else 1 - hw)
                if ps:
                    c = series_chance(ps, n)
                    row.setdefault('replays', {})[key] = {'winnerChance': round(c, 3), 'right': c >= 0.5}
            out.append(row)
    json.dump(out, open(os.path.join(REV, 'history', 'series_picks.json'), 'w'), indent=1)
    for r in out:
        fc = r.get('forecast'); rp = (r.get('replays') or {}).get('errors')
        print('%d %-26s %-4s vs %-4s won by %-4s %s | forecast: %s | replays (own error rates): %s' % (
            r['year'], r['round'], r['hi'], r['lo'], r['winner'] or '-', r['wins'],
            ('%s %.0f%% %s' % (fc['favourite'], 100 * fc['favChance'], 'right' if fc['right'] else 'WRONG')) if fc else 'not run',
            ('winner %.0f%% %s' % (100 * rp['winnerChance'], 'right' if rp['right'] else 'WRONG')) if rp else '-'))
    def summary(rows, lab):
        fc = [r for r in rows if 'forecast' in r]
        if not fc: return
        brier = sum((1 - r['forecast']['winnerChance']) ** 2 for r in fc) / len(fc)
        hf = sum(r['winner'] == r['hi'] for r in fc)
        print('%-10s %2d series: forecast favourite won %2d (%.0f%%), Brier %.3f (coin 0.250); the team with home field won %2d' % (lab, len(fc), sum(r['forecast']['right'] for r in fc), 100 * sum(r['forecast']['right'] for r in fc) / len(fc), brier, hf))
    done_ = [r for r in out if r['winner']]
    for rd in ROUND.values(): summary([r for r in done_ if r['round'] == rd], rd.split()[0] if rd != 'World Series' else 'World')
    summary(done_, 'all')
    for y in (2024, 2025, 2026):
        rows = [r for r in out if r['year'] == y and r['winner']]
        if not rows: continue
        fc = [r for r in rows if 'forecast' in r]; rp = [r for r in rows if 'errors' in (r.get('replays') or {})]
        print('%d: forecast favourites won %d of %d; replays favoured the winner in %d of %d' % (y, sum(r['forecast']['right'] for r in fc), len(fc), sum(r['replays']['errors']['right'] for r in rp), len(rp)))


if __name__ == '__main__':
    main()
