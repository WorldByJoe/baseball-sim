# The 2026 postseason data pull

The data half of the playoff forecast (steps 1-3 of `docs/briefs/2026-10-04_playoff_data_pull.md`): the eight
remaining rosters, the schedule and parks, pitch-level Statcast for every rostered player, the Savant
leaderboards, and the traits Statcast measures directly, each with its sampling error. Pulled 2026-10-04 and
2026-10-05 from a cloud session. Step 4 (the hidden traits, inferred by simulation) is the local session's.

## What was pulled

- **208 players** on the eight active rosters as of 2026-10-04 (96 pitchers, 111 position players, one two-way
  player, Shohei Ohtani, pulled both ways): White Sox, Guardians, Yankees, Rays, Braves, Dodgers, Padres, Brewers.
- **600,763 pitches** of Statcast, 418 player-season-role files: every 2025 and 2026 regular-season and postseason
  pitch each player saw (as a batter) or threw (as a pitcher). No pull came within 5% of Savant's row cap, so
  none was split by month. 392 of the files could be checked against the Stats API's season pitch totals; one
  (José Ramírez batting, 2025) differs by more than 3% (3.2%).
- **50 leaderboard files** (25 leaderboards x 2025 and 2026): sprint speed, arm strength, Outs Above Average
  (overall and by position 3-9), fielding run value (overall and by position 2-9), catcher pop time, catcher
  framing, bat tracking, swing path, pitcher arm angle, active spin. The exact URL behind each file is in
  `leaderboards/SOURCES.json`.
- **50 postseason games** on the schedule (Wild Card to World Series), with probable pitchers and results so
  far; 12 parks; the weather of every game played (the Stats API's game-day report), a National Weather Service
  forecast for games within a week, and each park's October climate at game time.

## The files

| file | what it holds |
|---|---|
| `schedule_2026_post.json` | every postseason game: date, series, teams, venue, probable pitchers, score and line score where played |
| `rosters.json` | the 208 players: id, name, team, position, bats/throws, height (in), weight (lb), birth date, age on 2026-10-01, whether on the 40-man, Statcast's strike-zone top and bottom for him |
| `venues.json` | the 12 parks: elevation (ft), roof, turf, dimensions, and `fence` in the engine's `makeEnv` order (left line, left-centre, centre, right-centre, right line) |
| `season_stats.json` | 2025 and 2026 regular-season totals, hitting and pitching (PA, AB, H, 2B, 3B, HR, BB, IBB, SO, HBP; pitchers also G, GS, BF, IP, pitches) |
| `weather.json` | per game: the reported weather (played games), the NWS forecast at the first-pitch hour (games within about a week), and the park's climate at that hour (ERA5, 2016-2025, +-7 days): temperature, humidity, wind |
| `pitches/{year}_{role}_{id}.csv.gz` | the per-pitch extracts, one per player-season-role (418 files, 54 MB); columns listed in `pitches/INDEX.json`, which also gives each file's row count by game type |
| `leaderboards/*.csv` | the Savant leaderboards, as downloaded |
| `players_measured.json` | one record per player: identity, the measured traits with uncertainty, the summaries for step 4 |
| `players_measured.csv` | the headline traits (pooled means and SEs), one row per player |
| `QA.md` | coverage, sanity against the league, the sign conventions, row counts, failures |

The raw downloads live in `raw/` (gitignored); every response is cached there, so a rerun fetches nothing twice.

## How to rerun

    python3 playoffs/fetch_mlb.py        # step 1: schedule, rosters, parks, season totals, weather
    python3 playoffs/fetch_statcast.py   # step 2: the leaderboards, then 418 per-player Statcast pulls (about 40 min)
    python3 playoffs/measure_traits.py   # step 3: players_measured.json and .csv
    python3 playoffs/qa.py               # QA.md

The scripts are Python 3, standard library only (numpy was not available in the sandbox). Baseball Savant gets at
least 2 s between requests and every request retries up to four times with backoff; the fetch and cache logic
follows `statcast/fetch_pitches.py`.

## The measured traits (`players_measured.json`)

Every measured quantity is `{"2025": {...}, "2026": {...}, "pooled": {...}}`, each `{mean, sd, n, se}`:

- for a mean, `sd` is the spread of the observations and `se = sd / sqrt(n)`;
- for a rate, `mean` is the share, `sd = sqrt(p(1-p))` and `se = sqrt(p(1-p)/n)`;
- **pooled weights each 2026 observation 1.0 and each 2025 observation 0.5.** Its `n` is the raw count; `n_eff =
  (sum w)^2 / sum w^2` is what the SE uses.
- a year with no observations is left out.

Names and units are the engine's (`TRAITS.md`). Conventions, from the brief: pitch location is batter-relative
(`awayIn` = plate_x x 12 for a right-handed batter, flipped for a left-hander, + away from him; height `h` as a
share of his zone); `pull = -attack_direction` (+ toward the pull side); spray from the hit coordinates with
home plate at (126.0, 205.0), + pulled; horizontal movement + toward the pitcher's arm side; pitch kinds FB =
FF SI FC, BR = SL ST CU, OS = CH FS, with KC -> CU, SV -> ST, FO -> FS (any other type is kept under its own
code in `otherTypes`); swings exclude bunts; the distance from the zone's edge counts the ball's edge.

**Hitters** (`traits`): `batSpeed` (mean over tracked swings; also `batSpeed50plus` over swings of 50+ mph),
`swingLenFt`, `attack` (over contact), `swingTilt` (over swings), `pullBias` (over balls in play, over all
contact, over all swings), `sprayPulledDeg_bip`, `contactDepthIn` (mean and sd of the intercept depth over
contact, overall and by pitch kind; the sd carries `se_of_sd`), `speed` (sprint speed), `armMph` (the arm
leaderboard's overall), catchers' `popTime`, `catcherArmMph`, `exchangeS` and `framing`. `fieldingByPosition`
holds Outs Above Average, fielding run value and arm strength by position played.

**Hitters' summaries for step 4** (`summaries.hitting`), each with n: swing rate by zone band (heart, edge in,
edge out, 4-8 out, 8+ out) x pitch kind; chase and zone-swing rates; whiffs and fouls per swing by kind; K%,
BB%, IBB%, HBP% per plate appearance; exit velocity on balls in play (mean, p50, p90) and the hard-hit share;
the launch-angle mix (GB < 10, LD 10-25, FB 25-50, PU 50+); launch angle minus attack angle by height band;
first-pitch and two-strike swing rates. `batTrackingLeaderboard` keeps the Savant bat-tracking and swing-path
leaderboard rows (competitive swings, squared-up, blast, ideal attack angle rate) for a cross-check.

**Pitchers** (`traits.pitching`): `armAngle` (mean of the per-pitch column; the leaderboard's value is kept
beside it), `ext`, `releaseHeightFt`, `releaseSideFt` (as Statcast gives it, catcher's view), `fbVelo`.
`summaries.pitching`: `role` (SP if games started are at least half his games, from the season totals), `use`
(appearances, pitches per appearance mean and p90, days of rest), and per pitch type: usage overall and by count
group (ahead / even / behind for the pitcher) x batter side (same / opposite hand), velo (mean, sd), rpm, spin
axis (circular mean and sd), movement in inches (arm-side horizontal, induced vertical), active spin from the
leaderboard, batter-relative location by count group x side, whiffs per swing; and for types with 60+ pitches
the **command scatter**: his scatter about his own mean location within cells of count group x batter side,
pooled over cells with 5+ pitches with the n/(n-1) correction in each, across and up-down in inches, with a
split-half check (one seeded split and the rms half-to-half difference over 200 random splits; `se` is that rms
over 2). Then K%, BB%, zone rate and chase rate against him.

**Leaderboard SEs.** A leaderboard average has no per-event data, so its per-event sd was fitted from the
players on both years' boards: the squared change between seasons regressed on (1/n2025 + 1/n2026), the slope
being the per-event variance and the intercept the real season-to-season change (sprint speed 2.0 ft/s per run
with 0.4 of real change; arm strength 1.0 mph per throw with 3.1 of real change; pop time 0.074 s per throw).
`se = perEventSd / sqrt(n)`.

## What failed or was missing

- Nothing was unreachable: statsapi.mlb.com and baseballsavant.mlb.com both answered from the sandbox; 418 of 418
  Statcast pulls and 50 of 50 leaderboards succeeded. The bat-tracking and swing-path leaderboards return a
  header and no rows for 2025 in the date-range form of the URL; the season form (`seasonStart=2025&seasonEnd=2025`)
  works and is what `SOURCES.json` records.
- Open-Meteo's forecast host timed out from the sandbox (its archive host answered), so game forecasts come from
  the National Weather Service hourly forecast, which reaches about a week out; games beyond that have only the
  park's climate.
- 20 players have thin 2026 samples (under 300 tracked swings or pitches); 2025 fills in at half weight. Seven have
  no 2025 MLB data either (Angel Genao, Daniel Espino, Ray Kerr, Josue De Paula, Ethan Salas, Jase Bowen, and
  Joe Musgrove with 22 pitches): step 4 will need league priors for them. The list is in `QA.md`.
- The brief's team ids were right. The schedule's LCS and World Series games are placeholders until the
  Division Series end; `weather.json` carries every remaining team's home-park climate for them.
