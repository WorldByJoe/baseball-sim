# Ballgame

A trait-driven, physics-based baseball simulation. Players have latent traits; every statistic emerges from traits, physics and noise. Nothing tunes an outcome directly: the only knobs are the trait distributions and a few labelled physical constants, and a gap between the model and the league is a missing mechanism, not an error to absorb.

The engine is pure JavaScript, seeded and deterministic; a whole game simulates in about 50 ms. `baseball.html` replays a game on screen: a pitch every ten seconds or so, every number shown.

**Watch a game: [worldbyjoe.github.io/baseball-sim/baseball.html](https://worldbyjoe.github.io/baseball-sim/baseball.html)** (runs in the browser; nothing to install).

## Files

- `bb_engine.js` — the plate appearance: plan, expect, throw, read, decide, call, swing, collide, fly. Traits and the power chain live here.
- `bb_field.js` — the ball in play: its track, the fielders' moves, throws, runners.
- `bb_game.js` — the game: lineups, innings, managers and bullpens, the running game.
- `bb_names.js` — fictional players, teams and parks.
- `bb_schedule.js` — the game for a seed and the screen's schedule (every segment, its time and its event id), shared by the page and the headless tools.
- `bb_call.js` — the broadcast, written ahead for the whole game: the announcers' lines, the crowd and field sounds, the crowd's mood, the organ cues, each keyed to a segment's event id.
- `bb_sound.js` — plays the broadcast in the page on the game's clock; `bb_organ.js` — the ballpark organ, synthesised with Web Audio.
- `baseball.html` — the screen. Open it in a browser with the `bb_*.js` files beside it; no server needed.
- `headless/` — checks that run without a browser: `run_games.js` (the league line against MLB), `run_pa.js`, `physics_check.js`, `shape_check.js` (every play has the shape the screen needs), `power_chain.js` (the latent power chain and contact quality against the Statcast targets), `contact_check.js` (the model's contact in the league's pitch-level tables: depth, vertical miss, location, height), `bat_check.js` (what the bat model makes of the wood profile), `schedule_check.js` (the screen's schedule: event ids, the seventh-inning stretch), `call_check.js` (the broadcast against the schedule: lines, air, drops, sounds). On the Mac they run under `jsc`; elsewhere `headless/run_node.js` loads the same files under Node.
- `statcast/` — `fetch_statcast.py` pulls the open Baseball Savant leaderboards and the MLB player list; `targets.py` turns them into per-player distributions and cross-correlations; `fetch_pitches.py` pulls pitch-level data, measured by `fouls.py` (what a foul is, and contact by pitch height and approach angle), `swing_geometry.py` (the swing at contact) and `pitch_spread.py` (how much pitches of one type differ, between pitchers and pitch to pitch).
- `STATCAST_TARGETS_<year>.md` — the empirical targets: per-player distributions of the measurables, the tails, and the correlations a latent layer must reproduce without being told.
- `CALIBRATION.md` — where the model stands against the league, what each change did, what is known to be off.
- `TRAITS.md` — every player trait and the population it is drawn from (mean, spread, range, how drawn, where the numbers came from). Generated from `bb_engine.js` by `tools/traits_doc.py`; rerun it after any change to the traits. `tools/fit_pitch_spread.js` fits the pitch types' seam-break spreads to the league's spread of movement.
- `CLOUD_HANDOFF.md` — how to hand a step to Claude Code on the web; `docs/briefs/` holds the briefs.
- `tts/` — text to speech on the TV's Raspberry Pi (Piper): `speech_server.py`, the announcers' voices rendered ahead of the picture for the page; `voices.json` and `energy.json`; `samples/` to choose the voices by ear; what is installed on the Pi, measured speeds and limits.
- `sounds/` — the sounds of the park: `SOUNDS.md` describes how the crowd behaves and lists every sound; the provisional library, `manifest.json`, `CREDITS.md`, and `catalog.html` to audition and swap them.

## Running the checks

```bash
jsc bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 3 0
node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 3 0
for s in 7 48 59; do node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js bb_schedule.js headless/schedule_check.js -- $s; done
node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js bb_schedule.js bb_call.js headless/call_check.js -- 48,7,59 5b
```

The three arguments are games, seed, and innings of play-by-play to print.

## House rules

Every code file carries a header `name · vX.Y · date` and a CHANGED list of at most five lines; old code is deleted, not commented out; comments change with the code. Results are judged on the whole metric suite across several seeds, never on one number. Findings are written in the past tense, scoped to the conditions they were measured under.
