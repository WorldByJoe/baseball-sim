# Postseason Replays (2026)

**Open it: [worldbyjoe.github.io/baseball-sim/playoffs/](https://worldbyjoe.github.io/baseball-sim/playoffs/)** (draft, 2026-10-08)

The 2026 postseason through the model (engine v3.9), on one page with three views.

**Postseason**
- The League Championship Series and the World Series, each played 2,000 times before Game 1.
- Every finished division series game played again 1,000 times with the lineups and pitchers it really had. Each game is a score grid with the real final starred, in three sets: regular-season pitching, pitching as it was that day, and each fielder making errors at his own rate.
- Whether those replays picked the series winners and the game winners (a logistic regression of the real results on the replays' win share).

**Couch companion**: a postseason game followed pitch by pitch through the same model (the page in [live/](../live/), shown in a frame; it follows today's game through MLB's live feed, or replays ALDS Game 2).

**Trait map**: every trait, ability and engine constant behind these games, and where each value came from (the same page as [docs/trait_map.html](../docs/trait_map.html)).

`index.html` holds its own data, figures and the trait map; the couch companion view opens `../live/`.

## How it is built

The code is on the `yankees-review` branch, in `review/`:

| Step | Script |
|---|---|
| Each game's lineups, substitutions and pitchers from the MLB Stats API feed | `review/game_feed.py` |
| A game replayed 1,000 times with its real lineups and pitchers | `review/replay_game.js` (`review/run_set.sh` for all games) |
| Each pitcher's speeds and mix on the day | `review/as_pitched.py` |
| Each fielder's error tendency (2025-26 errors per chance, shrunk toward his positions' rate) | `review/err_mult.py` |
| The League Championship Series and World Series, played before Game 1 | `review/series_spec.py`, `review/series_sim.js`, `review/series_summary.py` |
| This page | `python3 review/replay_grids.py playoffs/index.html --page` |

Hitters' traits were fitted to their 2025-26 Statcast numbers and pitchers' to their strikeout and walk rates (`review/fit_hitters.py`, `review/fit_pitchers.js`).
