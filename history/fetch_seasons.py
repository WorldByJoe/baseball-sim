"""
fetch_seasons.py · v0.1 · 2026-10-12

Pitch-level Statcast for every postseason participant (history/participants_<season>.json), season by season, so each
player's traits can be fitted year by year. Pulls as playoffs/fetch_statcast.py does (Savant's search CSV by player, its
cache under playoffs/raw/statcast/ shared, so a season already pulled for the 2026 review is not fetched again).

  kept  history/pitches/{year}_{role}_{id}.csv.gz     (playoffs/fetch_statcast.py's columns)
        history/pitches/INDEX.json                    (rows per file, by game type)

  python3 history/fetch_seasons.py --post 2025 --years 2024,2025,2026 [--reverse | --start N] [--index INDEX_b.json]

A second run with --reverse and its own index works the list from the other end; the shared cache makes the overlap free.

CHANGED
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'playoffs'))
from fetch_statcast import pull, extract, OUT_COLS
from common import FAILURES


def main(argv):
    posts = [int(x) for x in argv[argv.index('--post') + 1].split(',')]
    years = [int(x) for x in argv[argv.index('--years') + 1].split(',')]
    os.makedirs(os.path.join(HERE, 'pitches'), exist_ok=True)
    ip = os.path.join(HERE, 'pitches', argv[argv.index('--index') + 1] if '--index' in argv else 'INDEX.json')
    index = json.load(open(ip))['files'] if os.path.exists(ip) else {}
    seen, jobs = set(), []
    for s in posts:
        for p in json.load(open(os.path.join(HERE, 'participants_%d.json' % s)))['players']:
            roles = {'pitcher': ['pitcher'], 'position': ['batter'], 'two-way': ['batter', 'pitcher']}[p['kind']]
            for y in years:
                for role in roles:
                    if (p['id'], role, y) not in seen: seen.add((p['id'], role, y)); jobs.append((p, role, y))
    if '--reverse' in argv: jobs = jobs[::-1]
    if '--start' in argv: jobs = jobs[int(argv[argv.index('--start') + 1]):]
    for k, (p, role, y) in enumerate(jobs):
        key = '%d_%s_%d' % (y, role, p['id'])
        if key in index and index[key].get('rows') is not None: continue
        if os.path.exists(os.path.join(HERE, 'pitches', key + '.csv.gz')) and ('--reverse' in argv or '--start' in argv): continue
        rows, note = pull(p['id'], role, y)
        if rows is None:
            index[key] = {'id': p['id'], 'name': p['name'], 'role': role, 'year': y, 'rows': None, 'error': 'fetch failed'}
        else:
            by = {}
            for r in rows: by[r.get('game_type', '?')] = by.get(r.get('game_type', '?'), 0) + 1
            index[key] = {'id': p['id'], 'name': p['name'], 'role': role, 'year': y, 'rows': len(rows), 'byGameType': by}
            if note: index[key]['note'] = note
            if rows: extract(rows, os.path.join(HERE, 'pitches', key + '.csv.gz'))
        if k % 25 == 0 or rows is None:
            json.dump({'columns': OUT_COLS, 'files': index}, open(ip, 'w'), indent=1)
        print('  [%4d/%d] %-26s %-4s %d %-7s %s rows %s' % (k + 1, len(jobs), p['name'], p['team'], y, role, '-' if rows is None else len(rows), note or ''), flush=True)
    json.dump({'columns': OUT_COLS, 'files': index}, open(ip, 'w'), indent=1)
    print('%d pulls in the index, %d rows, %d failures' % (len(index), sum(v.get('rows') or 0 for v in index.values()), len(FAILURES)))


if __name__ == '__main__':
    main(sys.argv[1:])
