"""
compare_mishit.py · v0.1 · 2026-10-08

The model before and after the pitchers' MISHIT fit (review/fit_mishit.py), on everything the postseason page shows:
the division series replays' scoring and win shares, each game called before first pitch against DraftKings'
closing line (Brier score), the next game's prediction, and the LCS and World Series forecast. Before = diag_out/*_v1
and the committed forecast; after = diag_out/* and review/series_forecast.json.

  python3 review/compare_mishit.py
"""
import json, sys, glob, subprocess
import numpy as np
sys.path.insert(0, 'review')
from replay_grids import GAMES, NICK

def J(path): return [json.loads(l) for l in open(path) if l.startswith('{')]
def homeshare(R): return sum(1 for r in R if r['score'][1] > r['score'][0]) / len(R)
L = json.load(open('review/odds/espn_ds_lines.json'))
rows = []
for pk, ser, num, date in GAMES:
    try: G = json.load(open('review/games/%d.json' % pk))
    except FileNotFoundError: continue
    a, h = G['teams']['away']['abbrev'], G['teams']['home']['abbrev']
    ln = [x for x in L if x['away'] == a and x['home'] == h and x['date'] == date.replace('-', '')][0]
    r = {'label': '%s G%d %s@%s' % (ser, num, a, h), 'y': int(G['final']['home'] > G['final']['away']), 'mkt': ln['homeP'], 'real_runs': (G['final']['away'] + G['final']['home']) / 2}
    for tag, sfx in (('before', '_v1'), ('after', '')):
        for k, d in (('rep_s', 'replays'), ('rep_e', 'replays_errors')):
            R = J('diag_out/%s%s/%d.jsonl' % (d, sfx, pk)); r[k + '_' + tag] = homeshare(R); r[k + '_runs_' + tag] = np.mean([sum(x['score']) / 2 for x in R])
        for k, m in (('pre_s', 'season'), ('pre_e', 'errors')):
            R = J('diag_out/pregame_ds%s/%d_%s.jsonl' % (sfx, pk, m)); r[k + '_' + tag] = homeshare(R); r[k + '_runs_' + tag] = np.mean([sum(x['score']) / 2 for x in R])
    rows.append(r)
y = np.array([r['y'] for r in rows])
def brier(k): return float(np.mean((np.array([r[k] for r in rows]) - y) ** 2))
def fav(k): return int(sum((np.array([r[k] for r in rows]) > 0.5) == (y == 1)))
print('runs a team a game: real %.2f' % np.mean([r['real_runs'] for r in rows]))
for k in ('rep_s', 'rep_e', 'pre_s', 'pre_e'):
    print('  %-6s before %.2f, after %.2f' % (k, np.mean([r[k + '_runs_before'] for r in rows]), np.mean([r[k + '_runs_after'] for r in rows])))
print('\nBrier (lower is better; a coin 0.250)   market %.3f (favourite won %d of 14)' % (float(np.mean((np.array([r['mkt'] for r in rows]) - y) ** 2)), fav('mkt')))
for k in ('pre_s', 'pre_e', 'rep_s', 'rep_e'):
    print('  %-6s before %.3f (fav %2d), after %.3f (fav %2d)' % (k, brier(k + '_before'), fav(k + '_before'), brier(k + '_after'), fav(k + '_after')))
d = (np.array([r['mkt'] for r in rows]) - y) ** 2 - (np.array([r['pre_s_after'] for r in rows]) - y) ** 2
print('  market minus model (pre_s after): %.3f, se %.3f' % (d.mean(), d.std(ddof=1) / np.sqrt(len(d))))
print('  agreement with the market: mean |model - market| before %.3f, after %.3f; r before %.2f, after %.2f' % (
    np.mean([abs(r['pre_s_before'] - r['mkt']) for r in rows]), np.mean([abs(r['pre_s_after'] - r['mkt']) for r in rows]),
    np.corrcoef([r['pre_s_before'] for r in rows], [r['mkt'] for r in rows])[0, 1], np.corrcoef([r['pre_s_after'] for r in rows], [r['mkt'] for r in rows])[0, 1]))
print('\n%-24s %4s %6s %13s %13s' % ('game (home side)', 'won', 'market', 'pregame b->a', 'replay b->a'))
for r in rows: print('%-24s %4d %6.2f   %.2f -> %.2f   %.2f -> %.2f' % (r['label'], r['y'], r['mkt'], r['pre_s_before'], r['pre_s_after'], r['rep_s_before'], r['rep_s_after']))
for m in ('season', 'errors'):
    b = [x for f in glob.glob('diag_out/predict_v1/849832_%s_*.jsonl' % m) for x in J(f)]; a = [x for f in glob.glob('diag_out/predict/849832_%s_*.jsonl' % m) for x in J(f)]
    print('ALDS G4 (%s): White Sox %.1f%% before, %.1f%% after (market 47.8%%)' % (m, 100 * homeshare(b), 100 * homeshare(a)))
old = json.loads(subprocess.run(['git', 'show', 'd7f0d9d:review/series_forecast.json'], capture_output=True, text=True).stdout); new = json.load(open('review/series_forecast.json'))
mkt = {'ALCS': {'TB': 0.622}, 'NLCS': {'MIL': 0.414, 'LAD': 0.586}, 'champion': {'LAD': 0.416, 'TB': 0.234, 'MIL': 0.228, 'CWS': 0.078}}
for k in ('ALCS', 'NLCS'):
    print('%s: %s' % (k, ', '.join('%s %.0f%% -> %.0f%%' % (NICK[t], 100 * old[k]['win'][t], 100 * new[k]['win'][t]) for t in sorted(new[k]['win'], key=lambda t: -new[k]['win'][t]))), '| market', mkt[k])
print('champion: %s' % ', '.join('%s %.0f%% -> %.0f%% (market %.0f%%)' % (NICK[t], 100 * old['champion'][t], 100 * new['champion'][t], 100 * mkt['champion'][t]) for t in sorted(new['champion'], key=lambda t: -new['champion'][t])))
nl = lambda F: F['champion']['MIL'] + F['champion']['LAD']
print('NL wins the World Series: %.0f%% -> %.0f%% (market 65%%)' % (100 * nl(old), 100 * nl(new)))
json.dump(rows, open('review/compare_mishit.json', 'w'), indent=1, default=float)
