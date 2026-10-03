# Ballgame

A trait-driven, physics-based baseball simulation. Players have latent traits; every statistic emerges from traits, physics and noise. Nothing tunes an outcome directly: the only knobs are the trait distributions and a few labelled physical constants, and a gap between the model and the league is a missing mechanism, not an error to absorb.

**The question** (since 2026-10-03): what is the frequency distribution of the traits among the whole pool of professional players, majors and minors, and how do those latent traits meet the physics to give the statistics we measure? The engine's `TRAITS` are that pool. Each major-league roster spot goes to the best of six candidates from it as the scouts judge them, so the majors are an extreme-value sample; the next-best play at the levels below (Triple-A down to rookie ball). The pool is fitted so the majors' measured traits come out, and Triple-A's Statcast data tests it one level down.

The engine is pure JavaScript, seeded and deterministic; a whole game simulates in about 50 ms. `baseball.html` replays a game on screen: a pitch every ten seconds or so, every number shown.

**Watch a game: [worldbyjoe.github.io/baseball-sim/baseball.html](https://worldbyjoe.github.io/baseball-sim/baseball.html)** (runs in the browser; nothing to install).

## Files

- `bb_engine.js` — the plate appearance: plan, expect, throw, read, decide, call, swing, collide, fly. Traits and the power chain live here.
- `bb_field.js` — the ball in play: its track, the fielders' moves, throws, runners.
- `bb_game.js` — the game: lineups, innings, managers and bullpens, the running game.
- `bb_names.js` — fictional players, teams and parks.
- `baseball.html` — the screen. Open it in a browser with the four `bb_*.js` files beside it; no server needed.
- `headless/` — checks that run without a browser: `run_games.js` (the league line against MLB), `run_pa.js`, `physics_check.js`, `shape_check.js` (every play has the shape the screen needs), `power_chain.js` (the latent power chain and contact quality against the Statcast targets), `contact_check.js` (the model's contact in the league's pitch-level tables: depth, vertical miss, location, height), `discipline_check.js` (where pitches go and when batters swing, beside the league), `level_check.js` (the pool's traits level by level, and the league line at each level beside the majors and Triple-A), `miss_check.js` (how far the model's swings miss, as Statcast's miss distance, beside the league's), `bat_check.js` (what the bat model makes of the wood profile). On the Mac they run under `jsc`; elsewhere `headless/run_node.js` loads the same files under Node.
- `statcast/` — `fetch_statcast.py` pulls the open Baseball Savant leaderboards and the MLB player list; `targets.py` turns them into per-player distributions and cross-correlations; `fetch_pitches.py` pulls pitch-level data (the majors, or Triple-A with `--level AAA`), measured by `levels.py` (the league line at each level, measured alike), `misses.py` (how far the league's swings miss, by pitch kind and four-seam speed), `fouls.py` (what a foul is, and contact by pitch height and approach angle), `swing_geometry.py` (the swing at contact), `pitch_spread.py` (how much pitches of one type differ, between pitchers and pitch to pitch) `discipline.py` (plate discipline: swings by count and location, where pitches go, what a ball, strike and foul are worth) `locations.py` (command, where each pitch type is aimed by count and side, pitchers' habits, which kind is thrown when, repeats, fatigue; it writes the engine's `PLAN_LOC`), `bip.py` (what balls in play become by exit velocity and launch angle, and how far they carry; `headless/bip_check.js` prints the model's beside it), `baserunning.py` (extra bases taken on singles and doubles, by outs) and `pitcher_chain.py` (the pitcher's body, arm slot, release point, speed and spin, how his slot turns his pitches, and the league's repertoires, which it writes into the engine's `REPERTOIRES`; `headless/pitcher_chain_check.js` checks the model's pitchers against it, including whether harder throwers strike out more).
- `STATCAST_TARGETS_<year>.md` — the empirical targets: per-player distributions of the measurables, the tails, and the correlations a latent layer must reproduce without being told.
- `CALIBRATION.md` — where the model stands against the league, what each change did, what is known to be off.
- `TRAITS.md` — every player trait and the population it is drawn from (mean, spread, range, how drawn, where the numbers came from). Generated from `bb_engine.js` by `tools/traits_doc.py`; rerun it after any change to the traits. `tools/fit_pitch_spread.js` fits the pitch types' seam-break spreads to the league's spread of movement (between pitchers, with the engine's own pitchers). `tools/fit_swing_policy.js` fits the batter's swing thresholds to the league's swing curves by count. `tools/plate_scatter.js` measures how much of a pitch's scatter its pitch-to-pitch variation makes on its own (the engine's `plateW`). `tools/hitter_value.js` and `tools/pitcher_value.js` value drawn hitters and pitchers by Statcast's expected wOBA and print the scouts' estimates the farm uses (`HITTER_VALUE`, `PITCHER_VALUE`); `tools/fit_population.js` fits the population so the farm's picks have the league's measured traits.
- `docs/trait_map.html` — the trait path map: distal traits, proximate abilities, the engine's stages with every constant and where its value came from, and the statistics against the league. Kept in step with the engine and published as a private artifact (https://claude.ai/artifact/Rk2QZVGpGX7jhn5BxezjMR).
- `CLOUD_HANDOFF.md` — how to hand a step to Claude Code on the web; `docs/briefs/` holds the briefs.
- `tts/` — text to speech on the TV's Raspberry Pi (Piper): what is installed there, how to speak a line, measured speeds and limits, and `playbyplay.py`, a script that speaks a radio call. The groundwork for announcers.
- `sounds/` — the sounds of the park: `SOUNDS.md` describes how the crowd behaves and lists every sound file to collect.

## Running the checks

```bash
jsc bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 3 0
node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 3 0
```

The three arguments are games, seed, and innings of play-by-play to print.

## House rules

Every code file carries a header `name · vX.Y · date` and a CHANGED list of at most five lines; old code is deleted, not commented out; comments change with the code. Results are judged on the whole metric suite across several seeds, never on one number. Findings are written in the past tense, scoped to the conditions they were measured under.
