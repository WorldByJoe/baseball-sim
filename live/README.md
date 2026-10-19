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

Pause (2026-10-15): the Pause button holds the page while the TV is paused. On Resume, every update arrives as late as
the pause lasted, spaced by MLB's own time on each pitch. Behind live, the analyst plays any backlog (a phone that slept,
a reload) forward one pitch at a time, so nothing floods in at once. The hold is remembered per game in the browser.
Back to live skips ahead.

Pitch by pitch (2026-10-18, analyst.js v0.7): the at-bat's odds move with the count (how 2026's plate appearances
ended from each count), and the win-probability chart draws the model's own line before every pitch: each outcome's
count-moved chance, the runners moved by the league's advancement tables, the game state then valued by the league's
win chance at a plate appearance's start. MLB's line, once a plate appearance, stays for comparison (dashed).
`data/count_wp.js` holds those tables (built by forecast/couch/couch_data.py on the forecast branch).

Built 2026-10-06. Nothing here touches the rest of the site.
