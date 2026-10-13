"""
league_folder.py · v0.1 · 2026-10-13

Every major leaguer's 2025 and whole 2026 regular season, in a folder laid out like history/ (season/league), for the
league-wide age analyses (Joe, 2026-10-13: the age trends from the playoff players alone might understate aging):
  pitches/            2025_<role>_<id> links to season/pitches/2025; 2026_<role>_<id> his first and second halves joined
  rosters.json        season/foldA's (every man who played in 2026, with his birth date)
  season_stats.json   2025's lines and 2026's pitching lines (MLB's), 2026's hitting line counted from his pitches
  leaderboards/       Savant's 2025 and 2026 boards; league_seasons.json, seasons.json from history/
then measured (playoffs/measure_traits.py through season/measure_fold.py).

  python3 season/league_folder.py

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import csv, glob, gzip, json, os, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, 'league'); P = os.path.join(D, 'pitches'); os.makedirs(P, exist_ok=True)
from build_folds import NOT_PA
for fn in glob.glob(os.path.join(P, '*.csv.gz')): os.remove(fn)
for fn in glob.glob(os.path.join(HERE, 'pitches', '2025', '*.csv.gz')): os.symlink(os.path.abspath(fn), os.path.join(P, '2025_' + os.path.basename(fn)))
names = {os.path.basename(f) for h in ('h1', 'h2') for f in glob.glob(os.path.join(HERE, 'pitches', h, '*.csv.gz'))}
hit = {}
for b in sorted(names):
    rows, head = [], None
    for h in ('h1', 'h2'):
        f = os.path.join(HERE, 'pitches', h, b)
        if os.path.exists(f):
            R = csv.DictReader(gzip.open(f, 'rt')); head = R.fieldnames; rows += list(R)
    with gzip.open(os.path.join(P, '2026_' + b), 'wt', newline='') as o:
        w = csv.DictWriter(o, fieldnames=head); w.writeheader(); w.writerows(rows)
    if b.startswith('batter_'):
        pa = sum(1 for r in rows if r['events'] and r['events'] not in NOT_PA); hr = sum(1 for r in rows if r['events'] == 'home_run')
        hit[int(b.split('_')[1].split('.')[0])] = {'PA': pa, 'HR': hr, 'note': '2026 whole season, from its pitches'}
shutil.copy(os.path.join(HERE, 'foldA', 'rosters.json'), D)
ss = json.load(open(os.path.join(HERE, 'foldA', 'season_stats.json')))
for k, st in ss['players'].items(): st['hitting_2026'] = hit.get(int(k))
ss['note'] = '2025 lines; 2026 pitching lines (MLB); 2026 hitting counted from the whole season\'s pitches'
json.dump(ss, open(os.path.join(D, 'season_stats.json'), 'w'), indent=0)
if not os.path.lexists(os.path.join(D, 'leaderboards')): os.symlink(os.path.join(HERE, 'foldA', 'leaderboards'), os.path.join(D, 'leaderboards'))
for fn in ('league_seasons.json', 'seasons.json'): shutil.copy(os.path.join(HERE, '..', 'history', fn), D)
print('%d pitch files (%d for 2026)' % (len(glob.glob(os.path.join(P, '*.csv.gz'))), len(names)), flush=True)
subprocess.run([sys.executable, os.path.join(HERE, 'measure_fold.py'), D], check=True, stdout=subprocess.DEVNULL)
print('measured:', len(json.load(open(os.path.join(D, 'players_measured.json')))['players']), 'players')
