"""
fetch_statcast.py · v0.1 · 2026-10-04

Step 2 of the playoff data pull: pitch-level Statcast for every rostered
player (playoffs/rosters.json, from fetch_mlb.py), 2025 and 2026, regular
season and postseason, by player from Baseball Savant's search CSV; and the
Savant leaderboards for both years.

  raw   playoffs/raw/statcast/{year}_{role}_{id}.csv     (gitignored, the whole response)
  kept  playoffs/pitches/{year}_{role}_{id}.csv.gz        (the columns in COLS and EXTRA, plus `bunt`; floats to 4 decimals)
        playoffs/leaderboards/{name}_{year}.csv
        playoffs/leaderboards/SOURCES.json                (the exact URL behind each file)
        playoffs/pitches/INDEX.json                       (rows per file, by game type)

Pitchers are pulled as pitchers, position players as batters, two-way
players both ways. The URL style, the cache and the retries follow
statcast/fetch_pitches.py; it pulls by day, this pulls by player. A response
within 5% of Savant's ~25,000-row cap is pulled again month by month.

  python3 playoffs/fetch_statcast.py              # everything
  python3 playoffs/fetch_statcast.py --only 660271
"""
import csv, gzip, io, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HERE, RAW, fetch, csv_check, write_failures, FAILURES

SEARCH = ('https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type={role}'
          '&{role}s_lookup%5B%5D={id}&hfSea={year}%7C&hfGT=R%7CF%7CD%7CL%7CW%7C{dates}'
          '&min_pitches=0&min_results=0&group_by=name&sort_col=pitches'
          '&player_event_sort=api_p_release_speed&sort_order=desc')
CAP = 25000

COLS = ('game_date game_pk game_type at_bat_number pitch_number '
        'batter pitcher stand p_throws balls strikes outs_when_up on_1b on_2b on_3b '
        'pitch_type release_speed release_spin_rate spin_axis release_pos_x release_pos_z release_extension arm_angle '
        'pfx_x pfx_z plate_x plate_z sz_top sz_bot vx0 vy0 vz0 ax ay az '
        'description events type bb_type launch_speed launch_angle hc_x hc_y hit_distance_sc '
        'estimated_woba_using_speedangle woba_value '
        'bat_speed swing_length attack_angle attack_direction swing_path_tilt '
        'intercept_ball_minus_batter_pos_x_inches intercept_ball_minus_batter_pos_y_inches').split()
# beyond the brief's list: the inning and teams, the catcher (framing), times through the order and rest (pitcher use),
# the pitch's speed at the plate, the zone number and Savant's own arm-side break
EXTRA = ('inning inning_topbot home_team away_team fielder_2 effective_speed release_pos_y zone '
         'n_thruorder_pitcher pitcher_days_since_prev_game batter_days_since_prev_game delta_run_exp '
         'api_break_x_arm api_break_z_with_gravity woba_denom launch_speed_angle').split()
OUT_COLS = COLS + EXTRA + ['bunt']

LB = {
    # name: (url with {y}, a column the header must have)
    'sprint_speed': ('https://baseballsavant.mlb.com/leaderboard/sprint_speed?year={y}&position=&team=&min=0&csv=true', 'sprint_speed'),
    'arm_strength': ('https://baseballsavant.mlb.com/leaderboard/arm-strength?type=player&year={y}&minThrows=1&pos=&team=&csv=true', 'arm_overall'),
    'oaa': ('https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&startYear={y}&endYear={y}&split=no&team=&range=year&min=0&pos=&roles=&viz=hide&csv=true', 'outs_above_average'),
    'fielding_run_value': ('https://baseballsavant.mlb.com/leaderboard/fielding-run-value?gameType=Regular&seasonStart={y}&seasonEnd={y}&type=fielder&position=&minInnings=0&minResults=1&csv=true', 'total_runs'),
    'pop_time': ('https://baseballsavant.mlb.com/leaderboard/poptime?year={y}&team=&min2b=1&min3b=0&csv=true', 'pop_2b_sba'),
    'catcher_framing': ('https://baseballsavant.mlb.com/leaderboard/catcher-framing?type=catcher&seasonStart={y}&seasonEnd={y}&team=&min=0&sortColumn=rv_tot&sortDirection=desc&csv=true', 'rv_tot'),
    'bat_tracking': ('https://baseballsavant.mlb.com/leaderboard/bat-tracking?attackZone=&batSide=&contactType=&count=&dateStart={y}-03-01&dateEnd={y}-11-30&gameType=Regular&isHardHit=&minSwings=1&minGroupSwings=1&pitchHand=&pitchType=&seasonStart=&seasonEnd=&team=&type=batter&csv=true', 'avg_bat_speed'),
    'swing_path': ('https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle?dateStart={y}-03-01&dateEnd={y}-11-30&gameType=Regular&minSwings=1&minGroupSwings=1&seasonStart=&seasonEnd=&type=batter&csv=true', 'swing_tilt'),
    'arm_angle': ('https://baseballsavant.mlb.com/leaderboard/pitcher-arm-angles?batSide=&dateStart={y}-03-01&dateEnd={y}-11-30&gameType=R&groupBy=&min=1&minGroupPitches=1&perspective=back&pitchHand=&pitchType=&season={y}&size=small&sort=ascending&team=&csv=true', 'ball_angle'),
    'active_spin': ('https://baseballsavant.mlb.com/leaderboard/active-spin?year={y}_spin-based&min=1&hand=&csv=true', 'active_spin_fourseam'),
}
# per position: OAA (3-9; Savant has no OAA for pitchers or catchers) and fielding run value (2-9)
for _pos in range(3, 10):
    LB['oaa_pos%d' % _pos] = (LB['oaa'][0].replace('&pos=&', '&pos=%d&' % _pos), 'outs_above_average')
for _pos in range(2, 10):
    LB['fielding_run_value_pos%d' % _pos] = (LB['fielding_run_value'][0].replace('&position=&', '&position=%d&' % _pos), 'total_runs')


def leaderboards():
    os.makedirs(os.path.join(HERE, 'leaderboards'), exist_ok=True)
    src = {}
    for name, (url, key) in sorted(LB.items()):
        for y in (2025, 2026):
            u = url.format(y=y)
            data = fetch(u, 'leaderboards/%s_%d.csv' % (name, y), check=csv_check(key))
            if data is None:
                src['%s_%d' % (name, y)] = {'url': u, 'rows': None, 'error': 'failed'}
                continue
            text = data.decode('utf-8-sig', 'replace').replace('\r\n', '\n')
            fn = os.path.join(HERE, 'leaderboards', '%s_%d.csv' % (name, y))
            open(fn, 'w', encoding='utf-8').write(text)
            rows = max(0, len([l for l in text.split('\n') if l.strip()]) - 1)
            src['%s_%d' % (name, y)] = {'url': u, 'rows': rows}
            print('  leaderboard %-28s %d  %5d rows' % (name, y, rows))
    json.dump(src, open(os.path.join(HERE, 'leaderboards', 'SOURCES.json'), 'w'), indent=1)


def pull(pid, role, year):
    """rows (dicts) for one player-season-role, splitting by month if the response nears the cap"""
    u = SEARCH.format(role=role, id=pid, year=year, dates='')
    data = fetch(u, 'statcast/%d_%s_%d.csv' % (year, role, pid), check=csv_check('pitch_type'))
    if data is None:
        return None, 'failed'
    rows = list(csv.DictReader(io.StringIO(data.decode('utf-8-sig', 'replace'))))
    note = ''
    if len(rows) >= CAP * 0.95:
        note = 'near the cap (%d rows): pulled again by month' % len(rows)
        rows = []
        for m in range(2, 12):
            d0, d1 = '%d-%02d-01' % (year, m), '%d-%02d-%02d' % (year, m, 31 if m in (3, 5, 7, 8, 10) else 30)
            uu = SEARCH.format(role=role, id=pid, year=year, dates='&game_date_gt=%s&game_date_lt=%s' % (d0, d1))
            dd = fetch(uu, 'statcast/%d_%s_%d_m%02d.csv' % (year, role, pid, m), check=csv_check('pitch_type'))
            if dd:
                rows += list(csv.DictReader(io.StringIO(dd.decode('utf-8-sig', 'replace'))))
    return rows, note


def is_bunt(r):
    d = (r.get('description') or '') + ' ' + (r.get('events') or '') + ' ' + (r.get('des') or '').lower()
    return 1 if 'bunt' in d else 0


def trim(v):
    """a float written to 4 decimals (Savant writes up to 15); anything else as given"""
    if v and '.' in v and len(v) - v.index('.') > 5:
        try:
            return ('%.4f' % float(v)).rstrip('0').rstrip('.')
        except ValueError:
            pass
    return v


def extract(rows, path):
    rows = sorted(rows, key=lambda r: (r.get('game_date', ''), int(r.get('game_pk') or 0),
                                       int(r.get('at_bat_number') or 0), int(r.get('pitch_number') or 0)))
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(OUT_COLS)
    for r in rows:
        w.writerow([trim(r.get(c, '')) for c in OUT_COLS[:-1]] + [is_bunt(r)])
    with open(path, 'wb') as f:
        with gzip.GzipFile(fileobj=f, mode='wb', mtime=0, filename='') as g:      # mtime 0: a rerun writes the same bytes
            g.write(buf.getvalue().encode('utf-8'))


def main(argv):
    only = set(int(x) for x in argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None
    R = json.load(open(os.path.join(HERE, 'rosters.json')))
    os.makedirs(os.path.join(HERE, 'pitches'), exist_ok=True)
    if not only:
        leaderboards()
    index, missing_cols = {}, set()
    jobs = []
    for p in R['players']:
        if only and p['id'] not in only:
            continue
        roles = {'pitcher': ['pitcher'], 'position': ['batter'], 'two-way': ['batter', 'pitcher']}[p['kind']]
        for year in (2026, 2025):
            for role in roles:
                jobs.append((p, role, year))
    for k, (p, role, year) in enumerate(jobs):
        rows, note = pull(p['id'], role, year)
        key = '%d_%s_%d' % (year, role, p['id'])
        if rows is None:
            index[key] = {'id': p['id'], 'name': p['name'], 'role': role, 'year': year, 'rows': None, 'error': 'fetch failed'}
            continue
        if rows:
            missing_cols |= {c for c in OUT_COLS[:-1] if c not in rows[0]}
        by_gt = {}
        for r in rows:
            by_gt[r.get('game_type', '?')] = by_gt.get(r.get('game_type', '?'), 0) + 1
        index[key] = {'id': p['id'], 'name': p['name'], 'role': role, 'year': year, 'rows': len(rows), 'byGameType': by_gt}
        if note:
            index[key]['note'] = note
        if rows:
            extract(rows, os.path.join(HERE, 'pitches', key + '.csv.gz'))
        print('  [%3d/%d] %-26s %s %d %-7s %5d rows %s' % (k + 1, len(jobs), p['name'], p['teamAbbrev'], year, role, len(rows), note), flush=True)
    if not only:
        json.dump({'columns': OUT_COLS, 'missingColumns': sorted(missing_cols), 'files': index},
                  open(os.path.join(HERE, 'pitches', 'INDEX.json'), 'w'), indent=1)
        write_failures('statcast')
    print('%d player-season-role pulls, %d rows, %d failures' % (
        len(index), sum(v['rows'] or 0 for v in index.values()), len(FAILURES)))


if __name__ == '__main__':
    main(sys.argv[1:])
