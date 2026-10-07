# Couch Analyst

A live postseason game read pitch by pitch through the baseball-sim model, in the viewer's own browser:
https://worldbyjoe.github.io/baseball-sim/live/

- `index.html`: the page; picks today's postseason games from MLB's schedule, or `?g=<gamePk>`, or `?replay`.
- `analyst.js`: a Web Worker that follows MLB's live feed (statsapi.mlb.com) and runs the model on each batter,
  pitch and play (the browser version of `review/live/poll.py`, `review/game_review.js` and `review/pregame.js`
  on the `yankees-review` branch).
- `engine/`: the engine as of that branch (bb_engine v3.9, the model as the season's development left it, with the
  review's deception hook; bb_field v1.15, bb_game v1.6) and `players.js`.
- `data/playoff.js`: the playoff rosters' measured and fitted traits (refitted on engine v3.9, 2026-10-06: the
  112 hitters and all eight teams' pitchers) and the league's 2025 balls in play.

Built 2026-10-06. Nothing here touches the rest of the site.
