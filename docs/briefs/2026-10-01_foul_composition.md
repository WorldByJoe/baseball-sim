You are working in the repository WorldByJoe/baseball-sim (private; it should be checked out as your working directory - if not, clone https://github.com/WorldByJoe/baseball-sim.git). Your job: MEASURE, from pitch-level Statcast data, what a foul ball is - how often contact goes foul, how hard fouls are hit, and how often they are "squared up" - and write the result into the targets. This is a data step, not a modelling step: do not change the engine. Push a branch and open a pull request for the owner (Joe von Fischer) to review. Do not merge to main.

## What this project is (read before touching anything)
A trait-driven, physics-based baseball simulation. Players have latent traits; every statistic EMERGES from traits + physics + noise. Outcomes are never tuned; the only knobs are trait distributions and labelled physical constants; a gap between model and league is a missing mechanism. The engine now squares up 73% of contact against the league's 34%, and CALIBRATION.md v0.7 ("The bat, the swing's arc and the second look") argues that the gap is mostly FOULS: the league's fouls are about half of all contact and almost never squared up, the model's are 43% of contact and 60% squared up. That argument rests on two league figures we have only at second hand (squared-up per contact .337 from the Savant leaderboard; per ball in play about .66 from a FanGraphs piece). Your measurement replaces the inference with data.

Read, in this order: README.md; CALIBRATION.md (the v0.8 section and "Known gaps" 1-2); STATCAST_TARGETS_2025.md (how targets are written); statcast/fetch_statcast.py and statcast/targets.py (the house style for pulling and summarising Savant data; keep to it).

## Step 0 - prove the tooling
Python 3 with only the standard library plus whatever fetch_statcast.py already uses. Run `python3 statcast/targets.py` (or whatever its usage says) once to see it work before writing anything.

## The data
Baseball Savant's pitch-level search returns CSV without an account:
  https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&player_type=batter&game_date_gt=YYYY-MM-DD&game_date_lt=YYYY-MM-DD&hfSea=2025%7C&min_pitches=0&min_results=0&group_by=name&sort_col=pitches&player_event_sort=api_p_release_speed&sort_order=desc
The server caps a response at about 25,000 rows, so pull one or two days at a time (a day of MLB is roughly 4,500-5,000 pitches) and be polite: a short sleep between requests, retries on failure, and cache every raw CSV under statcast/raw/pitches/2025/ so a rerun fetches nothing twice. Cover at least six weeks of the 2025 regular season spread across the year (for example two weeks each in May, July and September); say in the report exactly which dates. Columns that matter: description (swinging_strike, swinging_strike_blocked, foul, foul_tip, foul_bunt, hit_into_play, called_strike, ball ...), events, bb_type, launch_speed, launch_angle, bat_speed, swing_length, release_speed, effective_speed, pitch_type, pitch_name, plate_x, plate_z, zone, stand, p_throws, balls, strikes, hc_x, hc_y, and the 2025 bat-tracking fields if present (attack_angle, attack_direction, swing_path_tilt, intercept_ball_minus_batter_pos_x_inches, intercept_ball_minus_batter_pos_y_inches). If a column is absent, say so; do not invent it.

## What to measure (every table with its n)
Define a SWING as any pitch whose description is a swinging strike, a foul of any kind, or hit_into_play. Define CONTACT as fouls plus hit_into_play. Define SQUARED UP exactly as Statcast does: launch_speed >= 0.80 x (1.23 x bat_speed + 0.23 x pitch speed), using effective_speed if present and release_speed otherwise; say which. Then:
1. Shares per swing: whiff / foul / in play; fouls as a share of contact. Also by pitch kind (fastballs FF SI FC; breaking SL CU ST KC SV; off-speed CH FS FO) and by count (0-2 strikes).
2. MISSINGNESS first: the share of fouls, and of balls in play, that carry launch_speed, and that carry bat_speed. Everything below about fouls is conditional on being tracked, and you must say how large the tracked share is and whether tracked fouls look like untracked ones in the ways you can see (count, pitch type, location).
3. Squared-up rate per contact, per ball in play, per foul (tracked only), overall and by pitch kind.
4. The distribution of launch_speed for fouls and for balls in play separately: mean, sd, p10/p25/p50/p75/p90, and the share under 60, 70, 80, 90 mph. The same for launch_angle where it is present on fouls (it may be sparse).
5. Fouls by direction where anything records it (hc_x/hc_y are usually empty on fouls; if so, say so and stop).
6. Exit velocity by launch-angle band for balls in play: <-30, -30..-10, -10..10, 10..30, 30..50, >50, with n and mean/sd.
7. Whiff rate per swing by pitch kind and by zone (in the zone vs out, from the `zone` column), and squared-up per contact by zone.
8. If the bat-tracking contact-point fields are present: squared-up and launch_speed by intercept_ball_minus_batter_pos_y_inches band (contact depth) and by swing_path_tilt / attack_angle band - these tell the modeller whether late and early contact is weak.

## Deliverables
- statcast/fetch_pitches.py (the pull, cached, polite, with a --dates option) and statcast/fouls.py (the tables above, printed and written as statcast/fouls_2025.json), both with the house header `name · vX.Y · date` and a CHANGED list.
- A new section in STATCAST_TARGETS_2025.md, "What a foul is (pitch level, 2025, N days)", with the tables and a short plain-English finding in the past tense scoped to those dates. If the league's fouls turn out NOT to be mostly weak contact, say so plainly: that overturns the current plan and is the most useful thing you could report.
- Do not touch bb_engine.js, bb_field.js, bb_game.js or baseball.html.

## House rules
Headers and CHANGED lists on every code file (at most five lines; delete old code, never comment it out; comments change with the code). Numbers with their n. Findings in the past tense, scoped. Branch `foul-composition` from main; commits ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; a pull request against main whose description carries the headline tables and ends with the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do NOT merge.

## Your report (under 60 lines)
1. Dates pulled, rows, and how the tooling went.
2. The missingness table.
3. The headline numbers: fouls as a share of contact; squared-up per contact / per BIP / per foul; the foul launch-speed distribution.
4. Anything that contradicts CALIBRATION.md's argument.
5. The PR link and the exact commands to reproduce.
