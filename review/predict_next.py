"""
predict_next.py · v0.1 · 2026-10-10

The pregame prediction for each championship series' next game, made or remade when something it rests on changed.
For each series: the first game in the page's list (replay_grids.GAMES) not yet played, if it starts within 48 hours.
  starters  MLB's probables when named and fitted; otherwise the rotation as the team has really used it in this
            series (its starters so far in order, then the rest of review/series_spec.py's rotation), game n taking
            the (n - 1) mod 4 slot
  lineups   each team's latest (review/series_spec.py, rerun first so a game just played counts)
  park      the series' home pattern (2-3-2, home field by regular-season record)
A prediction is remade when the starters or the lineups' source games differ from the ones it used. Each is 1,000
games in two sets (regular-season pitching; fielders' own error rates, G 1.77) by review/game_predict.js, written as
diag_out/predict/<pk>.json and <pk>_<set>_<part>.jsonl, which replay_grids.py shows as a prediction card.

  python3 review/predict_next.py [--force]     exit 0 when a prediction was made, 3 when nothing needed doing

CHANGED
  v0.1  first build (Joe, 2026-10-10: pregame prediction cards for the championship series)
"""
import json, os, sys, glob, subprocess, datetime, urllib.request
sys.path.insert(0, 'review')
from replay_grids import GAMES, NICK

SERIES = {'ALCS': ('ALCS_CLE', 'TB', 'CLE'), 'NLCS': ('NLCS', 'MIL', 'LAD')}
RUN = ['tools/diag/run.sh', 'bb_engine.js', 'bb_names.js', 'bb_field.js', 'bb_game.js', 'review/players.js', 'review/game_predict.js', '--']
FITTED = set(json.load(open('review/pitchers_fit.json'))['pitchers'])


def schedule(pk):
    d = json.load(urllib.request.urlopen('https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePk=%d&hydrate=probablePitcher' % pk, timeout=20))
    return d['dates'][0]['games'][0]


def played(pk): return os.path.exists('review/games/%d.json' % pk)


def latest_source(team):
    src = None
    for pk, ser, num, date in GAMES:
        if not played(pk): continue
        G = json.load(open('review/games/%d.json' % pk))
        if team in (G['teams']['away']['abbrev'], G['teams']['home']['abbrev']): src = pk
    return src


def assumed_starter(team, ser, num, spec):
    """The rotation as the team has really used it in this series: its starters so far in order, then the rest of the spec's."""
    used = []
    for pk, s, n, date in GAMES:
        if s != ser or not played(pk): continue
        G = json.load(open('review/games/%d.json' % pk)); side = 'away' if G['teams']['away']['abbrev'] == team else 'home'
        sp = G['pitchers'][side][0]
        if sp not in used: used.append(sp)
    order = used + [p for p in spec['teams'][team]['rotation'] if p not in used]
    return order[(num - 1) % 4]


def main(force):
    subprocess.run(['python3', 'review/series_spec.py'], check=True, capture_output=True)
    made = []
    for ser, (specname, hi, lo) in SERIES.items():
        spec = json.load(open('review/series/%s.json' % specname))
        games = [g for g in GAMES if g[1] == ser]
        wins = {hi: 0, lo: 0}
        for pk, s, n, date in games:
            if played(pk):
                G = json.load(open('review/games/%d.json' % pk)); f = G['final']
                wins[G['teams']['away']['abbrev'] if f['away'] > f['home'] else G['teams']['home']['abbrev']] += 1
        if max(wins.values()) >= 4: continue
        nxt = [g for g in games if not played(g[0])]
        if not nxt: continue
        pk, s, num, date = nxt[0]
        g = schedule(pk)
        if g['status']['abstractGameState'] != 'Preview': continue      # under way or done: the watcher's replays take over
        when = datetime.datetime.fromisoformat(g['gameDate'].replace('Z', '+00:00'))
        if (when - datetime.datetime.now(datetime.timezone.utc)).total_seconds() > 48 * 3600: continue
        ab = {s_: (hi if NICK[hi] in g['teams'][s_]['team']['name'] else lo) for s_ in ('away', 'home')}
        assert ab['home'] == (hi if spec['homeOf'][num - 1] == 'hi' else lo), 'the schedule and the series home pattern disagree for %d' % pk
        starters, assumed = {}, []
        for s_ in ('away', 'home'):
            t = ab[s_]; pp = g['teams'][s_].get('probablePitcher')
            if pp and str(pp['id']) in FITTED: starters[t] = [pp['id'], pp['fullName']]
            else:
                sp = assumed_starter(t, ser, num, spec); name = json.load(open('review/pitchers_fit.json'))['pitchers'][str(sp)]['name']
                starters[t] = [sp, name]; assumed.append(t)
        src = {t: latest_source(t) for t in (hi, lo)}
        meta_path = 'diag_out/predict/%d.json' % pk
        old = json.load(open(meta_path)) if os.path.exists(meta_path) else None
        if old and not force and old.get('starters') == starters and old.get('sources') == {k: v for k, v in src.items()}:
            continue
        k = num - 1
        for f in glob.glob('diag_out/predict/%d_*.jsonl' % pk): os.remove(f)
        procs = []
        for mode, G_ in (('season', None), ('errors', '1.77')):
            for p in range(8):
                args = RUN + ['review/series/%s.json' % specname, str(k), str(starters[ab['away']][0]), str(starters[ab['home']][0]), '1000', '29', str(p), '8'] + ([G_] if G_ else [])
                procs.append(subprocess.Popen(args, stdout=open('diag_out/predict/%d_%s_%d.jsonl' % (pk, mode, p), 'w'), stderr=open('diag_out/predict/%d_%s_%d.err' % (pk, mode, p), 'w')))
        for pr in procs: pr.wait()
        lin = []
        for t in (ab['away'], ab['home']):
            row = [x for x in GAMES if x[0] == src[t]]
            lin.append('%s: %s Game %d' % (NICK[t], row[0][1], row[0][2]) if row else NICK[t])
        meta = {'pk': pk, 'away': ab['away'], 'home': ab['home'], 'starters': starters, 'assumedTeams': assumed, 'assumed': bool(assumed), 'sources': src,
                'lineups': 'lineups as in their last games (%s)' % ', '.join(lin), 'park': spec['teams'][ab['home']]['venue']['name'],
                'ran': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'series': ser, 'game': num}
        json.dump(meta, open(meta_path, 'w'), indent=1)
        R = [json.loads(l) for f in glob.glob('diag_out/predict/%d_errors_*.jsonl' % pk) for l in open(f) if l.startswith('{')]
        hw = sum(1 for r in R if r['score'][1] > r['score'][0]) / max(1, len(R))
        made.append('%s Game %d (%s at %s): %s vs %s%s; %s %.0f%% (errors set)' % (ser, num, NICK[ab['away']], NICK[ab['home']], starters[ab['away']][1], starters[ab['home']][1],
                    ' (assumed: %s)' % ', '.join(NICK[t] for t in assumed) if assumed else '', NICK[ab['home']], 100 * hw))
    for m in made: print(m)
    return 0 if made else 3


if __name__ == '__main__':
    sys.exit(main('--force' in sys.argv))
