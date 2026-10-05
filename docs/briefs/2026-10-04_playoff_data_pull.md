# Brief: playoff data pull (workflow steps 1-3) · 2026-10-04

For a cloud Claude Code session on `WorldByJoe/baseball-sim`. Written by the local session that builds the engine.
Joe von Fischer owns the repo and approved this work. Read this whole file before starting.

## Why

The engine (`bb_engine.js`, v3.0) plays baseball from physical TRAITS: bat speed, timing scatter, pitch recognition,
command and so on. The next project uses it to forecast the 2026 MLB postseason. Every player on the eight remaining
rosters gets trait estimates with uncertainty, and then thousands of simulated games produce series odds. This
session does the DATA half, steps 1-3 below:

1. rosters, schedule and venues;
2. the raw data;
3. the traits that Statcast measures directly, with standard errors.

Step 4 is the hidden traits (zone judgement, recognition, timing, barrel precision, aggression). It comes later and
infers those by simulation from the per-player summaries you produce here. So produce those summaries carefully,
with every sample size.

The eight teams, as of 2026-10-04 (verify the team ids from the API; do not trust these):

- AL Division Series: Chicago White Sox (145) v Cleveland Guardians (114); New York Yankees (147) v Tampa Bay Rays (139).
- NL Division Series: Atlanta Braves (144) v Los Angeles Dodgers (119); San Diego Padres (135) v Milwaukee Brewers (158).
- Calendar: Division Series to Oct 9-10, League Championship Series Oct 11-20, World Series Oct 23-31.

## Rules

- Work on branch `playoff-data`, which already holds this brief and branches from `reach-speed` (engine v3.0). Push
  it and open ONE pull request into `reach-speed`. **Never merge anything.**
- Do not edit the engine or its tools (`bb_*.js`, `tools/`, `headless/`, `statcast/*.py`). Everything new goes under
  `playoffs/`. You MAY import or copy logic from `statcast/*.py`; cite what you reuse.
- Raw downloads go to `playoffs/raw/`, and that folder is added to `.gitignore`. Commit only compact processed files.
  Keep each committed file under 50 MB; gzip the per-pitch extracts.
- Be polite to the servers: at least a 2 s pause between Baseball Savant requests, retries with backoff, and every
  response cached on disk so a rerun fetches nothing twice. Savant truncates a response near 25,000 rows. If a
  response comes close to that, split it (by month) and say so.
- If a source is unreachable from the cloud sandbox (Savant and statsapi.mlb.com are the main ones), do not work
  around it with other sites. Record exactly what failed and continue with what you can reach.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, and the PR description
  with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Plain language in the README and PR. Results in the past tense ("pulled 412,000 pitches"), scoped to what you did.

## Step 1 - rosters, schedule, venues (MLB Stats API, `https://statsapi.mlb.com/api/v1/`)

- **Postseason schedule:**
  `schedule?sportId=1&season=2026&gameTypes=F,D,L,W&hydrate=team,venue,probablePitcher,linescore`.
  Save as `playoffs/schedule_2026_post.json`, with the probable pitchers and results so far.
- **Rosters for the eight teams:** `teams/{id}/roster?rosterType=active&date=2026-10-04&hydrate=person`. Also try
  `rosterType=40Man`. Postseason rosters are the active roster at the time, so record the date pulled. For each
  player save:
  - person id, full name, team, primary position, batSide, pitchHand, height (convert to inches), weight (lb) and
    birth date (age on 2026-10-01);
  - whether he is a pitcher, a two-way player or a position player.
- **Venues for every park on the schedule:** `venues/{id}?hydrate=location,fieldInfo`, giving elevation (ft), roof
  type and the outfield dimensions if present. Save as `playoffs/venues.json`.
- **Season totals for sample sizes:** `people/{id}/stats?stats=season&group=hitting` (and `group=pitching`)
  `&season=2026`, and the same for 2025: PA, AB, H, 2B, 3B, HR, BB, IBB, SO, HBP; pitchers also BF, IP, GS and
  pitches. Save as `playoffs/season_stats.json`.

## Step 2 - the raw data

- **Pitch-level Statcast for each rostered player, for 2025 and 2026** (regular season, plus the 2026 postseason so
  far):
  - Baseball Savant's search CSV takes no account. As a batter, use
    `https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=batter&batters_lookup%5B%5D={id}&hfSea={year}%7C&hfGT=R%7CF%7CD%7CL%7CW%7C&min_pitches=0&min_results=0&group_by=name&sort_col=pitches&player_event_sort=api_p_release_speed&sort_order=desc`.
  - As a pitcher, use the same with `player_type=pitcher&pitchers_lookup%5B%5D={id}`.
  - A player-season is about 2,000-3,500 pitches, well under the cap. Check each file's row count against his
    season totals (pitches seen or thrown), and flag any mismatch over 3%.
  - `statcast/fetch_pitches.py` shows the URL style, the cache and the retry logic. It pulls by day; you pull by
    player.
  - Two-way players are pulled both ways.
- **Compact extracts to commit**, one gzipped CSV per player-season-role:
  `playoffs/pitches/{year}_{role}_{id}.csv.gz`, with these columns:
  - game: `game_date, game_pk, game_type, at_bat_number, pitch_number`;
  - matchup and count: `batter, pitcher, stand, p_throws, balls, strikes, outs_when_up, on_1b, on_2b, on_3b`;
  - the pitch: `pitch_type, release_speed, release_spin_rate, spin_axis, release_pos_x, release_pos_z,
    release_extension, arm_angle, pfx_x, pfx_z, plate_x, plate_z, sz_top, sz_bot, vx0, vy0, vz0, ax, ay, az`;
  - the outcome: `description, events, type, bb_type, launch_speed, launch_angle, hc_x, hc_y, hit_distance_sc,
    estimated_woba_using_speedangle, woba_value`;
  - bat tracking: `bat_speed, swing_length, attack_angle, attack_direction, swing_path_tilt,
    intercept_ball_minus_batter_pos_x_inches, intercept_ball_minus_batter_pos_y_inches`;
  - keep any column the CSV lacks as empty, and list missing columns in the QA report.
- **Savant leaderboards for 2025 and 2026**, saved as CSV under `playoffs/leaderboards/` with the exact URL used
  recorded in the README:
  - sprint speed (ft/s), arm strength (throw mph), Outs Above Average and fielding run value;
  - catcher pop time and framing;
  - bat tracking (bat speed, swing length, squared-up);
  - pitcher arm angle and active spin.
  - The leaderboards have "Download CSV" links. The usual pattern is the leaderboard URL plus `&csv=true`.
    Discover and verify each; do not guess silently.

## Step 3 - the traits Statcast measures directly, with uncertainty

Write `playoffs/measure_traits.py` (Python 3, standard library plus numpy if available). It reads the extracts and
leaderboards and writes `playoffs/players_measured.json`:

- one record per player, with `id, name, team, role, bats/throws, heightIn, weightLb, age`;
- a `traits` object in which each measured trait is `{ "2025": {mean, sd, n, se}, "2026": {...}, "pooled": {...} }`;
- `pooled` weights each 2026 observation 1.0 and each 2025 observation 0.5; say so in the README;
- `se` is sd/sqrt(n) for means, and sqrt(p(1-p)/n) for rates;
- also a flat `players_measured.csv` (pooled means and SEs) for a quick look.

Use the ENGINE's names and units. The trait list is in `TRAITS.md` (generated from `bb_engine.js`), and the measured
definitions are in the cited files.

### Conventions (get these right; most errors live here)

- **Sides.** A right-handed batter stands on the -x side (`plate_x` is in feet, catcher's view, + toward first base).
  Report pitch location batter-relative: `away_in = plate_x * 12` for a right-handed batter and `-plate_x * 12` for
  a left-handed one (+ = away from him). Report height as `h = (plate_z - sz_bot) / (sz_top - sz_bot)`.
- **Pull.** Statcast's `attack_direction` is + toward the OPPOSITE field. The engine's pull is + toward the pull side,
  so `pull = -attack_direction` (see `statcast/bat_direction.py`).
- **Spray.** From the hit coordinates, home plate is at (126.0, 205.0):
  `spray = atan2(hc_x - 126, 205 - hc_y)` in degrees, + toward right field; pull = -spray for a right-handed batter.
- **Movement.** `pfx_x` and `pfx_z` are in feet; multiply by 12 for inches. Report horizontal movement + toward the
  pitcher's arm side (flip the sign for a right-handed pitcher, since Statcast's + is toward first base from the
  catcher's view).
- **Pitch kinds.** FB = FF, SI, FC; BR = SL, ST, CU, KC, SV; OS = CH, FS, FO. Engine types are FF SI FC SL ST CU CH
  FS. Map KC to CU, SV to ST and FO to FS, and list any other type (KN, EP, CS, SC) separately; do not drop it.
- **Swings** are the descriptions `swinging_strike, swinging_strike_blocked, foul, foul_tip, hit_into_play`, with
  bunts excluded (`foul_bunt, missed_bunt, bunt_foul_tip`, and `bb_type` bunts). Whiffs are the two
  `swinging_strike*`.
- **Distance from the zone's edge** (inches, + inside), with the ball's edge counted. With
  `ZH = 0.7083 + 0.121` ft and `R = 0.121` ft:
  - `dx = ZH - |plate_x|`, `dlo = plate_z - (sz_bot - R)`, `dhi = (sz_top + R) - plate_z`;
  - inside the zone, `d = min(dx, dlo, dhi)`;
  - outside it, `d = -hypot(max(0, -dx), max(0, -dlo, -dhi))`;
  - times 12. Bands: heart 4+, edge-in 0-4, edge-out 0 to -4, out 4-8, out 8+.

### Hitters (for each, every quantity with n)

- **batSpeed** (mph): mean `bat_speed` over his tracked swings, the engine's definition (its fit used each hitter's
  mean over all his tracked swings). Also report the mean over swings of 50+ mph, and **swingLenFt**, the mean
  `swing_length`.
- **attack** (deg): mean `attack_angle` over contact (fouls plus balls in play). **swingTilt** (deg): mean
  `swing_path_tilt` over swings. **pullBias**: mean `pull` (see Conventions) over balls in play, and over all contact.
- **Contact depth** (for the timing trait): mean and sd of `intercept_ball_minus_batter_pos_y_inches` over contact,
  overall and by pitch kind. This sd is what the engine's timing scatter was fitted to (league about each batter's
  mean: 7.4 in for fastballs, 8.3 breaking, 8.2 off-speed).
- **speed** (ft/s, sprint speed); **armMph** and fielding (OAA, fielding run value) by position played; catchers'
  pop time and framing.
- **Summaries for step 4**, each with n:
  - swing rate by band x pitch kind (5 x 3), and chase rate (swings at pitches outside the zone);
  - whiffs and fouls per swing by pitch kind;
  - K%, BB%, HBP%;
  - exit velocity on balls in play (mean, p50, p90) and hard-hit share (95+);
  - launch angle distribution (GB <10, LD 10-25, FB 25-50, PU 50+);
  - launch angle minus attack angle by height band (below, 0-.33, .33-.67, .67-1, above);
  - first-pitch swing rate and two-strike swing rate.

### Pitchers

- **Role and use:** role (SP if games started are at least half his appearances), mean and 90th percentile pitches
  per appearance, and days of rest between appearances.
- **Delivery:** **armAngle** (deg; the Savant leaderboard, or the mean `arm_angle` column), **ext** (ft, mean
  `release_extension`), release height and side (means and sd of `release_pos_z` and `release_pos_x`).
- **For each pitch type** (engine types after mapping), each with n:
  - **usage** overall and by count group (ahead / even / behind for the pitcher) x batter side (same / opposite hand);
  - **velo** (mean and sd `release_speed`), **rpm** (mean `release_spin_rate`), spin axis (mean, circular), and
    movement in inches (arm-side horizontal, vertical);
  - active spin, from the leaderboard if available;
  - mean batter-relative location by count group x side.
- **Command scatter** for each pitch type with 60+ pitches:
  - his scatter about his own mean location within cells of count group (ahead / even / behind) x batter side
    (same / opposite), with deviations pooled over the cells, cells with fewer than 5 pitches skipped, and a small
    sample correction n/(n-1) in each cell;
  - report it across and up-down separately, in inches;
  - its SE: split his pitches randomly in halves and report the half-to-half difference, which is what step 4
    needs;
  - the local session measured the league this way: four-seam scatter per pitcher averaged 8.17 in across and
    9.03 up-down.
- **Outcomes against him:** K%, BB%, whiffs per swing by pitch type, zone rate and chase rate.

## QA (put the results in `playoffs/QA.md`)

- **Coverage:** every rostered player has a record; list anyone with no 2026 Statcast data (injured, recalled late,
  rookies) and what you used instead.
- **Sanity against the league.**
  - The mean over all eight rosters' hitters should sit near: bat speed about 71-72 mph, swing length about 7.3 ft,
    attack angle about 9-10 deg, swing tilt about 32 deg and sprint speed about 27.3 ft/s.
  - The pitchers' four-seam velocity should sit near 94-95 mph.
  - Flag anything more than 2 sd from those league values.
- **Convention checks:** pull-side means positive for most hitters, and a left-handed and a right-handed batter
  symmetric in batter-relative location. Show three named players' numbers so a human can eyeball them against
  their Baseball Savant pages.
- **Row counts:** Statcast pitches against season totals, per player.

## Hand-back

The PR description gives:

- what was pulled, as counts (players, pitches, leaderboards);
- what failed or was missing;
- the QA summary;
- the files and their formats;
- anything in this brief that turned out wrong, or a better source you found.

Do not start step 4 (the hidden traits). The local session does that, against the engine.
