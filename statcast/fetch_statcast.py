"""
fetch_statcast.py · v0.1 · 2026-09-30

Pulls the openly available Baseball Savant leaderboards (CSV export, no
account) and the MLB Stats API player list (height, weight, handedness) for
a season, into statcast/raw/<year>/. These are the empirical TARGETS for the
latent-trait layer (Joe, 2026-09-30): per-player distributions of the
measurables, not league means. Each URL is tried; anything that does not
come back as a CSV (an HTML page, an empty table) is reported and skipped,
so the list can carry guesses for leaderboards whose URL pattern is unsure.

Run:  python3 statcast/fetch_statcast.py 2025 [2024 ...]

CHANGED
  v0.1  first build
"""
import sys, os, json, time, urllib.request, urllib.error

UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}
BASE = 'https://baseballsavant.mlb.com'
LEADERBOARDS = {
    # hitters
    'bat_tracking': '/leaderboard/bat-tracking?attackZone=&batSide=&contactType=&count=&dateStart=&dateEnd=&gameType=&isHardHit=&minSwings=q&minGroupSwings=1&pitchHand=&pitchType=&seasonStart={y}&seasonEnd={y}&team=&type=batter&csv=true',
    'swing_path': '/leaderboard/bat-tracking/swing-path-attack-angle?attackZone=&batSide=&contactType=&count=&dateStart=&dateEnd=&gameType=&isHardHit=&minSwings=q&minGroupSwings=1&pitchHand=&pitchType=&seasonStart={y}&seasonEnd={y}&team=&type=batter&csv=true',
    'batter_statcast': '/leaderboard/statcast?type=batter&year={y}&position=&team=&min=q&csv=true',
    'batter_expected': '/leaderboard/expected_statistics?type=batter&year={y}&position=&team=&min=q&csv=true',
    'batter_custom': '/leaderboard/custom?year={y}&type=batter&filter=&min=q&selections=player_age,b_total_pa,k_percent,bb_percent,xwoba,exit_velocity_avg,launch_angle_avg,sweet_spot_percent,barrel_batted_rate,hard_hit_percent,oz_swing_percent,iz_contact_percent,oz_contact_percent,whiff_percent,swing_percent,pull_percent,straightaway_percent,opposite_percent,groundballs_percent,flyballs_percent,popups_percent,sprint_speed,hp_to_1b&chart=false&x=k_percent&y=k_percent&r=no&chartType=beeswarm&sort=xwoba&sortDir=desc&csv=true',
    'sprint_speed': '/leaderboard/sprint_speed?year={y}&position=&team=&min=10&csv=true',
    'running_splits': '/leaderboard/running_splits?type=raw&bats=&year={y}&position=&team=&min=5&csv=true',
    'outfield_jump': '/leaderboard/outfield_jump?year={y}&min=q&csv=true',
    'arm_strength': '/leaderboard/arm-strength?type=player&year={y}&minThrows=50&pos=&team=&csv=true',
    'poptime': '/leaderboard/poptime?year={y}&team=&min2b=5&min3b=0&csv=true',
    'catcher_framing': '/catcher_framing?year={y}&team=&min=q&type=catcher&sort=4,1&csv=true',
    'catcher_blocking': '/leaderboard/catcher-blocking?year={y}&team=&min=q&csv=true',
    'oaa': '/leaderboard/outs_above_average?type=player&year={y}&team=&range=year&min=q&pos=&roles=&viz=hide&csv=true',
    'basestealing': '/leaderboard/basestealing-run-value?game_type=All&season_end={y}&season_start={y}&sortColumn=runner_runs_tot&sortDirection=desc&split_term=Run+Value&team=&type=Run&with_team_only=1&csv=true',
    # pitchers
    'pitcher_statcast': '/leaderboard/statcast?type=pitcher&year={y}&position=&team=&min=q&csv=true',
    'pitcher_custom': '/leaderboard/custom?year={y}&type=pitcher&filter=&min=q&selections=player_age,p_formatted_ip,pa,k_percent,bb_percent,xwoba,exit_velocity_avg,barrel_batted_rate,hard_hit_percent,whiff_percent,oz_swing_percent,fastball_avg_speed,fastball_avg_spin,fastball_avg_break,n_fastball_formatted,n_breaking_formatted,n_offspeed_formatted,breaking_avg_speed,breaking_avg_spin,offspeed_avg_speed,offspeed_avg_spin&chart=false&x=k_percent&y=k_percent&r=no&chartType=beeswarm&sort=xwoba&sortDir=desc&csv=true',
    'arsenal_speed': '/leaderboard/pitch-arsenals?year={y}&min=50&type=avg_speed&hand=&csv=true',
    'arsenal_spin': '/leaderboard/pitch-arsenals?year={y}&min=50&type=avg_spin&hand=&csv=true',
    'arsenal_usage': '/leaderboard/pitch-arsenals?year={y}&min=50&type=n_&hand=&csv=true',
    'movement_FF': '/leaderboard/pitch-movement?year={y}&team=&min=q&pitch_type=FF&hand=&csv=true',
    'active_spin': '/leaderboard/active-spin?year={y}&min=50&csv=true',
    'pitch_tempo': '/leaderboard/pitch-tempo?type=Pitcher&year={y}&team=&min=q&csv=true',
    'arm_angle': '/leaderboard/pitcher-arm-angles?batSide=&dateStart=&dateEnd=&gameType=&groupBy=&min=q&perspective=back&pitchHand=&pitchType=&season={y}&size=small&sort=ascending&team=&csv=true',
}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def main(years):
    for y in years:
        out = os.path.join('statcast', 'raw', str(y)); os.makedirs(out, exist_ok=True)
        print('== season', y)
        for name, path in LEADERBOARDS.items():
            url = BASE + path.format(y=y)
            try:
                data = get(url)
            except Exception as e:
                print('  %-18s FAILED %s' % (name, str(e)[:60])); continue
            text = data.decode('utf-8', 'replace')
            first = text.split('\n', 1)[0].strip()
            if text.lstrip().startswith('<') or ',' not in first:
                print('  %-18s not a CSV (%d bytes)' % (name, len(data))); continue
            rows = text.count('\n')
            with open(os.path.join(out, name + '.csv'), 'w') as f: f.write(text)
            print('  %-18s %5d rows  %s' % (name, rows, first[:150]))
            time.sleep(0.6)
        # players: height, weight, handedness, position
        try:
            pj = json.loads(get('https://statsapi.mlb.com/api/v1/sports/1/players?season=%d' % y))
            with open(os.path.join(out, 'players.json'), 'w') as f: json.dump(pj, f)
            print('  %-18s %5d players' % ('players.json', len(pj.get('people', []))))
        except Exception as e:
            print('  players.json FAILED', e)

if __name__ == '__main__':
    main([int(a) for a in sys.argv[1:]] or [2025])
