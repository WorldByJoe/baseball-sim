"""
add_players.py · v0.1 · 2026-10-13

A late roster add, into the playoff data: each named player's roster entry, from the Stats API, in fetch_mlb.py's
format, appended to playoffs/rosters.json (marked with the date added). Then pull his Statcast, measure him and fit
him as the rest were:

  python3 playoffs/add_players.py 677944,811315      # Slade Cecconi (CLE) and Brody Hopkins (TB), added for the ALCS
  python3 playoffs/fetch_statcast.py --only 677944,811315
  python3 playoffs/measure_traits.py
  python3 playoffs/add_players.py 677944,811315 --merge

The roster step also adds each man's 2025-26 season lines to season_stats.json (fetch_mlb.season_stats's format). The
merge step keeps every other player's measured record as committed and takes only the new men's from the re-measure:
measure_traits.py run again today does not reproduce the committed file (its inputs and extra fields have moved since
the pull), and re-measuring everyone would shift the traits the hitters and pitchers were fitted to.

The Couch had no traits for a man added after the pull (2026-10-04): his plate appearances had no odds, and the
post-game replays stopped (review/wait_game.sh, exit 3).

CHANGED
  v0.1  first build (Joe, 2026-10-13: Cecconi pitching in ALCS Game 2)
"""
import json, os, sys, datetime, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_mlb import inches, age_on, kind_of, API, season_line, STAT_KEYS_P, STAT_KEYS_H
import subprocess, csv, io
HERE = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}


def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60))


def main(ids):
    R = json.load(open(os.path.join(HERE, 'rosters.json')))
    have = {p['id'] for p in R['players']}
    today = datetime.date.today().isoformat()
    for pid in ids:
        if pid in have:
            print('%d already on the rosters' % pid); continue
        p = get(API + 'people/%d?hydrate=currentTeam' % pid)['people'][0]
        tid = (p.get('currentTeam') or {}).get('id')
        if str(tid) not in R['teams'] and tid not in R['teams']:
            raise SystemExit('%s (%d): his team %s is not one of the playoff teams' % (p['fullName'], pid, tid))
        team = R['teams'].get(str(tid)) or R['teams'][tid]
        act = get(API + 'teams/%d/roster?rosterType=active' % tid)['roster']
        r = next((x for x in act if x['person']['id'] == pid), None)
        if r is None:
            raise SystemExit('%s (%d) is not on the %s active roster' % (p['fullName'], pid, team['abbrev']))
        forty = {x['person']['id'] for x in get(API + 'teams/%d/roster?rosterType=40Man' % tid)['roster']}
        R['players'].append({
            'id': pid, 'name': p['fullName'], 'team': tid, 'teamAbbrev': team['abbrev'],
            'jersey': r.get('jerseyNumber'), 'position': r['position']['abbreviation'],
            'primaryPosition': p.get('primaryPosition', {}).get('abbreviation'),
            'kind': kind_of(p, r['position']), 'bats': p.get('batSide', {}).get('code'),
            'throws': p.get('pitchHand', {}).get('code'), 'heightIn': inches(p.get('height', '')),
            'weightLb': p.get('weight'), 'birthDate': p.get('birthDate'), 'age': age_on(p.get('birthDate')),
            'mlbDebut': p.get('mlbDebutDate'), 'on40Man': pid in forty,
            'szTop': p.get('strikeZoneTop'), 'szBot': p.get('strikeZoneBottom'), 'added': today})
        print('added %s (%d, %s, %s)' % (p['fullName'], pid, team['abbrev'], R['players'][-1]['kind']))
    json.dump(R, open(os.path.join(HERE, 'rosters.json'), 'w'), indent=1)
    S = json.load(open(os.path.join(HERE, 'season_stats.json')))
    for p in [q for q in R['players'] if q['id'] in ids]:
        rec = {}
        for year in (2025, 2026):
            for grp in ('hitting', 'pitching'):
                if (grp == 'pitching' and p['kind'] == 'position') or (grp == 'hitting' and p['kind'] == 'pitcher'): continue
                d = get(API + 'people/%d/stats?stats=season&group=%s&season=%d&sportId=1&gameType=R' % (p['id'], grp, year))
                rec['%s_%d' % (grp, year)] = season_line(d, STAT_KEYS_P if grp == 'pitching' else STAT_KEYS_H)
        S['players'][str(p['id'])] = rec
    json.dump(S, open(os.path.join(HERE, 'season_stats.json'), 'w'), indent=1)


def merge(ids):
    """players_measured.json/.csv as committed, plus the new men's records from the re-measure just run"""
    new = json.load(open(os.path.join(HERE, 'players_measured.json')))
    old = json.loads(subprocess.check_output(['git', 'show', 'HEAD:playoffs/players_measured.json'], cwd=HERE))
    have = {r['id'] for r in old['players']}
    add = [r for r in new['players'] if r['id'] in ids and r['id'] not in have]
    old['players'] += add
    old['meta']['added'] = old['meta'].get('added', []) + [{'id': r['id'], 'name': r['name'], 'on': datetime.date.today().isoformat()} for r in add]
    json.dump(old, open(os.path.join(HERE, 'players_measured.json'), 'w'), indent=None, separators=(',', ':'))   # measure_traits.py's layout
    rows = list(csv.reader(io.StringIO(open(os.path.join(HERE, 'players_measured.csv')).read())))
    oldcsv = subprocess.check_output(['git', 'show', 'HEAD:playoffs/players_measured.csv'], cwd=HERE).decode()
    keep = [r for r in rows[1:] if r and r[0].isdigit() and int(r[0]) in {a['id'] for a in add}]
    buf = io.StringIO(); csv.writer(buf, lineterminator='\n').writerows(keep)
    open(os.path.join(HERE, 'players_measured.csv'), 'w').write(oldcsv.rstrip('\n') + '\n' + buf.getvalue())
    print('merged %d new records (%s) into the committed %d' % (len(add), ', '.join(r['name'] for r in add), len(have)))


if __name__ == '__main__':
    ids = [int(x) for x in sys.argv[1].split(',')]
    merge(ids) if '--merge' in sys.argv else main(ids)
