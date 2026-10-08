# Postseason Replays: the page's prose, for editing

Page: https://worldbyjoe.github.io/baseball-sim/playoffs/ (draft). Every passage a reader sees, keyed by an ID and the place it sits.
Edit the text under each ID in place. Keep the IDs. Words in {braces} are numbers or names the page fills in; keep them (move them if the sentence needs it).
Headings and button labels are listed too; they can change. The trait map view is the trait map page itself and is not part of this file.

## V1 (top of the page, the note beside the Postseason / Trait map switch)

The trait map: every trait, ability and engine constant behind these games, and where each value came from.

## H1 (eyebrow and title)

2026 postseason · baseball-sim engine v3.9

Postseason Replays

## H2 (the header, paragraph 1)

Each division series game finished so far, played again 1,000 times through the model with the lineups and pitchers it really had. Every replay used the real batting order, with each substitute taking his spot at the turn he really took it, and the real pitchers in their real order, each facing as many batters as he faced. Each replay also drew fresh values of every hitter's fitted traits, so the spread includes what is not known about the players as well as the game's own chance.

## H3 (the header, paragraph 2)

First, the model's forecast for the League Championship Series and the World Series, played before Game 1. The switch at the top opens the trait map: every trait, ability and engine constant behind these games.

## H4 (the header, jump links)

The LCS and World Series forecast · Division series score grids · Series picks · Game picks

## F1 (forecast section, heading)

Who goes on: the League Championship Series and the World Series

## F2 (forecast section, the paragraph under the heading)

Each League Championship Series played 2,000 times before Game 1, and each possible World Series 2,000 times, through the same model and with each fielder making errors at his own rate. The {White Sox} were assumed to beat the {Guardians} (the series stood {2-1} when this ran).

## F3 (forecast, each LCS card: the line under the bar)

Home field: {Rays} (games 1, 2, 6 and 7). {3.8} runs a team a game in the simulations.

## F4 (forecast, the small heading over the length columns)

Games the series takes  /  Games the World Series takes

## F5 (forecast, World Series card: the line under the champion bars)

The chance each team wins the World Series, over every pairing in proportion to its chance of happening. The series took {5.6} games on average.

## F6 (forecast, World Series table column heads)

Pairing · Chance it happens · Favourite · Games it takes

## F7 (forecast, the assumptions (a bulleted list))

- Lineups: each team's last division series lineup, every man at the position he started.
- Starters: each team's division series starters in order, filled to four from its regular season, turning over every four games.
- Bullpens: the relievers on the playoff roster, run by the model's manager, rested at the start of every game.
- Home field: the better regular-season record, games 1, 2, 6 and 7 at home; open parks at 60 F, roofed parks at 72 F.
- Each simulated series drew every hitter's traits once and kept them all series.

## S1 (the replays switch, its three buttons)

Regular-season pitching · Pitching as it was that day · Fielders' own error rates

## S2 (the replays switch, the line shown with the "season" set)

Each pitcher at his regular-season speeds and pitch mix. The replays averaged {RUNS_SEASON} runs and {ERR_SEASON} errors a team; the {NGAMES} real games, {RUNS_REAL} and {ERR_REAL}.

## S3 (the replays switch, the line shown with the "pitched" set)

Each pitcher at that day's speeds and pitch mix; the batters still expect his regular-season mix. The replays averaged {RUNS_PITCHED} runs and {ERR_PITCHED} errors a team; the {NGAMES} real games, {RUNS_REAL} and {ERR_REAL}.

## S4 (the replays switch, the line shown with the "errors" set)

Regular-season pitching, and each fielder making errors at his own regular-season rate. The replays averaged {RUNS_ERRORS} runs and {ERR_ERRORS} errors a team; the {NGAMES} real games, {RUNS_REAL} and {ERR_REAL}.

## L1 (the score-grid legend (five keys))

- Across: one team's runs. Down: the other's. Each cell counts the replays that ended at that score.
- fewer to more replays
- ★ the real final
- x4 4 of the cell's replays went to extra innings
- a tie (no game ends tied)

## G1 (each game card: the lines over its grid)

Game {number} {date} · at {home team}
Final: {winner} {runs}, {loser} {runs} · errors: {team} {errors}, {team} {errors}
Replays won: {team} {count}, {team} {count} · extra innings {count} · {runs} runs and {errors} errors a team

## P1 (series picks section, heading)

Did the replays pick the series winners?

## P2 (series picks, the paragraph under the heading)

Each game's share of replays won by the team that won or leads the series, combined into its chance of winning a best-of-five; a game not yet played counts at that series' average. W or L: whether that team won the real game. These are not forecasts: each game's replays used the lineups and pitchers that really played, known only once the game began. Before the correction of 2026-10-08 (see the notes below), the regular-season set gave the Dodgers 80%, the Brewers 85%, the Rays 47% and the White Sox 60%: the same calls, made with more confidence than the corrected replays support.

## P3 (series picks, table column heads and verdicts)

Series · Result · G1-G5 · Series chance · The pick
Verdicts: right / missed / open, leans {Guardians}
Result: {Dodgers} won {3-1} / {White Sox} lead {2-1}

## P4 (series picks, the line under the table)

The replays' favourite won {8} of the {14} games.

## R1 (regression section, heading)

Did the replays pick the game winners?

## R2 (regression, the paragraph under the heading)

One point per game, from the home team's side: across, the share of the 1,000 replays (regular-season pitching) the home team won; up or down, whether it won the real game. The blue curve is a logistic regression of the real result on that share, with its 95% band; the dashed line is where a perfectly calibrated forecast would sit. A higher replay share went with more real wins, but over {14} games the slope is not significant at the usual 0.05 level.

## R3 (regression, axis titles and the statistics line)

Across: Home team's share of 1,000 replays won (regular-season pitching)
Up: Real game, and the fitted chance of winning
Slope {7.9} (standard error {6.2}), Wald p = {0.20}; likelihood-ratio p = {0.17}; McFadden R² = {0.10}, Tjur R² = {0.13}.
Key: logistic fit · its 95% band · a perfectly calibrated forecast

## N1 (the notes at the bottom, paragraph 1)

Each replay was played in the real park, with the designated hitter and no runner placed on second in extra innings, as in the postseason. A replay that ran longer than the real game went back to the model's manager and the rest of the playoff bullpen once the real game's pitchers were used up. Hover over a cell for its count and score.

## N2 (the notes at the bottom, paragraph 2)

Pitching as it was that day: for every pitch type a pitcher threw three or more times, his regular-season speed plus that day's change (his game average against his season average), and his mix as that day's share of each type. Pitchers in the postseason threw their fastballs 0.7 mph harder than in their own regular seasons on average and changed their mixes often.

## N3 (the notes at the bottom, paragraph 3)

Fielders' own error rates: each fielder's errors per chance in 2025-26 against the usual rate at the positions he played (players with few chances pulled toward that rate), scaling his chance of dropping a ball, fumbling a grounder or throwing one away; one league-wide factor then brings the replays' errors near these fielders' own regular-season rate (0.43 a team per game against their 0.44), where the model on its own makes 0.26. The most error-prone of them errs about twice his position's rate and the surest about a third of it.

## N4 (the notes at the bottom, paragraph 4)

Corrected 2026-10-08: each starter now plays the position he started at. Before, a man who moved during a game was placed at the position he ended at, so in 8 lineups (7 games) two men shared one position and another was left empty; that had inflated the replays' scoring (4.24 runs a team, now 3.62) and their margins in those games.

## N5 (the notes at the bottom, paragraph 5)

Hitters' traits were fitted to their 2025-26 Statcast numbers and pitchers' to their strikeout and walk rates, on engine v3.9 (refit 2026-10-06).
