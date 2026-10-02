# Ballgame

A trait-driven, physics-based baseball simulation. Players have latent traits; every statistic emerges from traits, physics and noise. Nothing tunes an outcome directly: the only knobs are the trait distributions and a few labelled physical constants, and a gap between the model and the league is a missing mechanism, not an error to absorb.

The engine is pure JavaScript, seeded and deterministic; a whole game simulates in about 50 ms. `baseball.html` replays a game on screen: a pitch every ten seconds or so, every number shown.

**Watch a game: [worldbyjoe.github.io/baseball-sim/baseball.html](https://worldbyjoe.github.io/baseball-sim/baseball.html)** (runs in the browser; nothing to install).

## Files

- `bb_engine.js` — the plate appearance: plan, expect, throw, read, decide, call, swing, collide, fly. Traits and the power chain live here.
- `bb_field.js` — the ball in play: its track, the fielders' moves, throws, runners.
- `bb_game.js` — the game: lineups, innings, managers and bullpens, the running game.
- `bb_names.js` — fictional players, teams and parks.
- `baseball.html` — the screen. Open it in a browser with the four `bb_*.js` files beside it; no server needed.
- `headless/` — checks that run without a browser: `run_games.js` (the league line against MLB), `run_pa.js`, `physics_check.js`, `shape_check.js` (every play has the shape the screen needs), `power_chain.js` (the latent power chain and contact quality against the Statcast targets), `bat_check.js` (what the bat model makes of the wood profile). On the Mac they run under `jsc`; elsewhere `headless/run_node.js` loads the same files under Node.
- `statcast/` — `fetch_statcast.py` pulls the open Baseball Savant leaderboards and the MLB player list; `targets.py` turns them into per-player distributions and cross-correlations.
- `STATCAST_TARGETS_<year>.md` — the empirical targets: per-player distributions of the measurables, the tails, and the correlations a latent layer must reproduce without being told.
- `CALIBRATION.md` — where the model stands against the league, what each change did, what is known to be off.
- `CLOUD_HANDOFF.md` — how to hand a step to Claude Code on the web; `docs/briefs/` holds the briefs.

## Running the checks

```bash
jsc bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 3 0
node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 3 0
```

The three arguments are games, seed, and innings of play-by-play to print.

## House rules

Every code file carries a header `name · vX.Y · date` and a CHANGED list of at most five lines; old code is deleted, not commented out; comments change with the code. Results are judged on the whole metric suite across several seeds, never on one number. Findings are written in the past tense, scoped to the conditions they were measured under.
