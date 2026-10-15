"""
build_folds.py · v0.2 · 2026-10-14

The two folds of the season replay, each a data folder laid out like history/ (history/fit_through.py reads it through
HISTDATA, season/view.py turns it into a worktree's inputs):
  season/foldA   traits from 2025 and 2026's first half (through the All-Star break); replays the second half's games
  season/foldB   traits from 2025 and 2026's second half; replays the first half's games
so no game's own pitches help fit the traits that replay it. Each folder holds:
  pitches/            links: 2025_<role>_<id> to season/pitches/2025, 2026_<role>_<id> to the fold's half of 2026
  rosters.json        every man who played in 2026 (or appears in a replayed game), his bio (MLB's season player lists),
                      his kind (a pitcher who also had 20 plate appearances, or a position player who pitched, is two-way)
                      and his team in the replayed half (the team he appeared for most there)
  season_stats.json   2025's lines (MLB's bulk season stats); 2026's pitching line for usage (games, starts, saves); 2026's
                      hitting line is the fold's own half (plate appearances and home runs counted from its pitches), since
                      the hitter fit uses home runs
  leaderboards/       Savant's 2025 and 2026 boards (playoffs/leaderboards; sprint speed and arm strength are season-long)
  participants_2026.json   the players and the replayed half's games
  seasons.json, aging.json copied from history/
Then the measurement (playoffs/measure_traits.py on the folder, 2025 and 2026).

  python3 season/build_folds.py

CHANGED
  v0.2  SEASON_Y: another season (2025) in season/y<year>, relabelled (the model review)
  v0.1  first build (Joe, 2026-10-13)
"""
import json, os, sys, glob, gzip, csv, shutil, urllib.request, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
REV = os.path.join(HERE, '..')
SY = int(os.environ.get('SEASON_Y', '2026')); PY = SY - 1   # the season replayed (SEASON_Y=2025, the model review: its data in season/y2025, labelled as 2026's, the year before as 2025's)
BASE = HERE if SY == 2026 else os.path.join(HERE, 'y%d' % SY)
UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}
NOT_PA = {'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home', 'pickoff_1b', 'pickoff_2b', 'pickoff_3b', 'stolen_base_2b', 'stolen_base_3b', 'wild_pitch',
          'passed_ball', 'other_advance', 'truncated_pa', 'game_advisory', 'ejection', 'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home'}


def get(u): return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=90))


def inches(h):
    try: ft, inch = h.replace('"', '').split("'"); return int(ft) * 12 + int(inch or 0)
    except Exception: return None


def main():
    PL = json.load(open(os.path.join(BASE, 'players.json')))
    sched = json.load(open(os.path.join(BASE, 'schedule.json')))
    bio = {}
    for y in (PY, SY):
        for p in get('https://statsapi.mlb.com/api/v1/sports/1/players?season=%d' % y)['people']: bio[p['id']] = p
    stats = {}
    for y in (PY, SY):
        for grp in ('hitting', 'pitching'):
            for sp in get('https://statsapi.mlb.com/api/v1/stats?stats=season&group=%s&season=%d&sportId=1&playerPool=ALL&limit=5000' % (grp, y))['stats'][0]['splits']:
                st = sp['stat']; pid = sp['player']['id']
                line = {'G': st.get('gamesPlayed'), 'GS': st.get('gamesStarted'), 'PA': st.get('plateAppearances'), 'HR': st.get('homeRuns'), 'SV': st.get('saves'), 'BF': st.get('battersFaced'), 'SO': st.get('strikeOuts'), 'BB': st.get('baseOnBalls')}
                stats.setdefault(pid, {})['%s_%d' % (grp, 2025 + (y - PY))] = line   # labelled as 2025 / 2026
    T = get('https://statsapi.mlb.com/api/v1/teams?sportId=1&season=%d' % SY)['teams']
    teams = {str(t['id']): {'id': t['id'], 'abbrev': t['abbreviation'], 'name': t['name'], 'venueId': t['venue']['id']} for t in T}
    # who appeared in each half's games, and for which team
    app = {'h1': {}, 'h2': {}}
    for g in sched:
        f = os.path.join(BASE, 'games', '%d.json' % g['pk'])
        if not os.path.exists(f): continue
        G = json.load(open(f))
        for s in ('away', 'home'):
            ab = G['teams'][s]['abbrev']
            for pid in [q['id'] for q in G['lineups'][s]] + list(G['pitchers'][s]):
                c = app[g['block']].setdefault(pid, {}); c[ab] = c.get(ab, 0) + 1
    everyone = set(int(k) for k, v in PL.items() if v['seen'].get('h1') or v['seen'].get('h2') or v['thrown'].get('h1') or v['thrown'].get('h2')) | set(app['h1']) | set(app['h2'])
    for fold, train, test in (('foldA', 'h1', 'h2'), ('foldB', 'h2', 'h1')):
        D = os.path.join(BASE, fold); os.makedirs(os.path.join(D, 'pitches'), exist_ok=True)
        for fn in glob.glob(os.path.join(D, 'pitches', '*.csv.gz')): os.remove(fn)
        for blk, lab in ((str(PY), '2025'), (train, '2026')):
            for fn in glob.glob(os.path.join(BASE, 'pitches', blk, '*.csv.gz')):
                os.symlink(os.path.abspath(fn), os.path.join(D, 'pitches', '%s_%s' % (lab, os.path.basename(fn))))
        ros, ss = [], {}
        for pid in sorted(everyone):
            b = bio.get(pid, {}); P = PL.get(str(pid), {'seen': {}, 'thrown': {}, 'pa': {}, 'name': None})
            hits = sum(P['pa'].get(k, 0) for k in (str(PY), 'h1', 'h2')); throws = sum(P['thrown'].get(k, 0) for k in (str(PY), 'h1', 'h2'))
            kind = 'two-way' if throws and hits >= 20 else 'pitcher' if throws else 'position'
            c = app[test].get(pid) or app[train].get(pid) or {}
            team = max(c, key=c.get) if c else teams.get(str((b.get('currentTeam') or {}).get('id')), {}).get('abbrev')
            ros.append({'id': pid, 'name': b.get('fullName') or P['name'] or str(pid), 'team': None, 'teamAbbrev': team, 'position': (b.get('primaryPosition') or {}).get('abbreviation', 'P' if kind == 'pitcher' else 'UT'),
                        'primaryPosition': (b.get('primaryPosition') or {}).get('abbreviation'), 'kind': kind, 'bats': (b.get('batSide') or {}).get('code', 'R'), 'throws': (b.get('pitchHand') or {}).get('code', 'R'),
                        'heightIn': inches(b.get('height', '')) or 73, 'weightLb': b.get('weight') or 205, 'birthDate': b.get('birthDate'),
                        'age': round((datetime.date(SY, 7, 1) - datetime.date.fromisoformat(b['birthDate'])).days / 365.25, 2) if b.get('birthDate') else 28.0})
            st = dict(stats.get(pid, {}))
            # the fold's own half of 2026 for the hitting line (home runs are a fitted outcome)
            fn = os.path.join(BASE, 'pitches', train, 'batter_%d.csv.gz' % pid)
            if os.path.exists(fn):
                pa = hr = 0
                for r in csv.DictReader(gzip.open(fn, 'rt')):
                    if r['events'] and r['events'] not in NOT_PA: pa += 1; hr += r['events'] == 'home_run'
                st['hitting_2026'] = {'PA': pa, 'HR': hr, 'note': '2026 %s only (season/build_folds.py)' % train}
            else:
                st['hitting_2026'] = None
            ss[str(pid)] = st
        json.dump({'note': '2026 players, team = the one he appeared for most in %s' % test, 'teams': teams, 'players': ros}, open(os.path.join(D, 'rosters.json'), 'w'), indent=0)
        json.dump({'note': '2025 lines; 2026 pitching line for usage; 2026 hitting = %s only' % train, 'players': ss}, open(os.path.join(D, 'season_stats.json'), 'w'), indent=0)
        os.makedirs(os.path.join(D, 'leaderboards'), exist_ok=True)
        if SY == 2026:
            for fn in glob.glob(os.path.join(REV, 'playoffs', 'leaderboards', '*_202[56].csv')): shutil.copy(fn, os.path.join(D, 'leaderboards'))
        else:   # the season and the year before from history/leaderboards, labelled 2026 and 2025
            for y, lab in ((PY, 2025), (SY, 2026)):
                for fn in glob.glob(os.path.join(REV, 'history', 'leaderboards', '*_%d.csv' % y)): shutil.copy(fn, os.path.join(D, 'leaderboards', os.path.basename(fn)[:-8] + str(lab) + '.csv'))
        games = [{'pk': g['pk'], 'type': 'R', 'date': g['date'], 'away': g['awayName'], 'home': g['homeName'], 'final': g['final'], 'series': 'regular season'} for g in sched if g['block'] == test]
        json.dump({'season': 2026, 'note': 'fold %s: traits from 2025 + 2026 %s, replays of 2026 %s' % (fold, train, test), 'games': games,
                   'players': [{'id': p['id'], 'name': p['name'], 'team': p['teamAbbrev'], 'kind': p['kind'], 'bat': 0, 'pitch': 0, 'games': []} for p in ros]},
                  open(os.path.join(D, 'participants_2026.json'), 'w'))
        for fn in ('seasons.json', 'aging.json'): shutil.copy(os.path.join(REV, 'history', fn), D)
        print('%s: %d players (%s), %d games to replay' % (fold, len(ros), {k: sum(p['kind'] == k for p in ros) for k in ('position', 'pitcher', 'two-way')}, len(games)), flush=True)


if __name__ == '__main__':
    main()
