# Postseason Replays: the page's prose, for editing

Page: https://worldbyjoe.github.io/baseball-sim/playoffs/ (draft). Every passage a reader sees, keyed by an ID and the place it sits.
Edit the text under each ID in place. Keep the IDs. Words in {braces} are numbers or names the page fills in; keep them (move them if the sentence needs it).
Headings and button labels are listed too; they can change. The trait map view is the trait map page itself and is not part of this file.

Edited 2026-10-08 to the explanatory writing rules (OneDrive/Claude/Explanatory Writing/Explanatory Writing Rules.md): every term defined where it is first used, every "so" and "because" given its step, no number changed.

## V1 (top of the page, the note beside the Postseason / Trait map switch)

The trait map: every trait, ability and engine constant the model uses, what each one does, and where its value came from.

## H1 (eyebrow and title)

2026 postseason · baseball-sim engine v3.9

Postseason Replays

## H2 (the header, paragraph 1)

This page asks how likely each real postseason result was. Each division series game finished so far was played again 1,000 times by a simulation that plays every pitch from the players' traits. The traits come in two kinds: measured ones, taken straight from Statcast and held fixed, such as how fast a hitter swings and how hard a pitcher throws each pitch; and fitted ones, hidden qualities inferred from a hitter's statistics, such as how well he reads a pitch and how steady his timing is (the trait map lists them all). Each replay kept what the real game had: the batting order, each substitute entering at the turn he really took, and the real pitchers in their real order, each facing as many batters as he faced. Two things varied from replay to replay: the pitch-by-pitch chance of the game itself, and a fresh draw of every hitter's fitted traits from the range his statistics leave open. The spread of scores therefore includes what is not known about the players as well as the luck of the game.

## H3 (the header, paragraph 2)

The page opens with the model's forecast for the League Championship Series and the World Series, made before Game 1 of each. Then come the division series replays: a score grid for every game, and two checks on whether the replays picked the winners. The switch at the top opens the trait map, which lists every trait, ability and engine constant behind these games and where each value came from.

## H4 (the header, jump links)

The LCS and World Series forecast · Division series score grids · Series picks · Game picks

## F1 (forecast section, heading)

Who goes on: the League Championship Series and the World Series

## F2 (forecast section, the paragraph under the heading)

Each League Championship Series was played 2,000 times before its Game 1, and each possible World Series pairing 2,000 times, by the same simulation, with each fielder making errors at his own regular-season rate (the third of the pitching and fielding settings described below). The bars give the share of those series each team won; the columns give how many games the series took. The {White Sox} were assumed to beat the {Guardians}, whose series stood {2-1} when the forecast ran.

## F3 (forecast, each LCS card: the line under the bar)

Home field: {Rays} (games 1, 2, 6 and 7). The simulated games averaged {3.8} runs a team.

## F4 (forecast, the small heading over the length columns)

Games the series takes  /  Games the World Series takes

## F5 (forecast, World Series card: the line under the champion bars)

Each team's chance of winning the World Series: its chance in each pairing, weighted by how likely that pairing is to happen (the table below). The simulated series lasted {5.6} games on average.

## F6 (forecast, World Series table column heads)

Pairing · Chance it happens · Favourite · Games it takes

## F7 (forecast, the assumptions (a bulleted list))

- Lineups: each team's last division series lineup, every man at the position he started.
- Starting pitchers: each team's division series starters in order, with regular-season starters added to make a four-man rotation.
- Bullpens: the relievers on the playoff roster, brought in by the model's manager, all rested at the start of every game.
- Home field: the team with the better regular-season record plays games 1, 2, 6 and 7 at home; open-air parks at 60 F, roofed parks at 72 F.
- Each simulated series drew every hitter's traits once, at its start, and kept them for the whole series.

## S1 (the replays switch, its three buttons)

Regular-season pitching · Pitching as it was that day · Fielders' own error rates

## S2 (the replays switch, the line shown with the "season" set)

Each pitcher throws at his regular-season speeds and pitch mix, and every fielder makes errors at the model's default rate. The replays averaged {RUNS_SEASON} runs and {ERR_SEASON} errors a team; the {NGAMES} real games averaged {RUNS_REAL} runs and {ERR_REAL} errors.

## S3 (the replays switch, the line shown with the "pitched" set)

Each pitcher throws at the speeds and pitch mix he had that day, while the batters still expect his regular-season mix (how the day's values are built is in the notes below). The replays averaged {RUNS_PITCHED} runs and {ERR_PITCHED} errors a team; the {NGAMES} real games averaged {RUNS_REAL} runs and {ERR_REAL} errors.

## S4 (the replays switch, the line shown with the "errors" set)

Regular-season pitching, with each fielder making errors at his own regular-season rate instead of the model's default (how the rates are built is in the notes below). The replays averaged {RUNS_ERRORS} runs and {ERR_ERRORS} errors a team; the {NGAMES} real games averaged {RUNS_REAL} runs and {ERR_REAL} errors.

## L1 (the score-grid legend (five keys))

- Across: one team's runs. Down: the other's. Each cell counts how many of the 1,000 replays ended at that score.
- fewer to more replays
- ★ the real final
- x4 4 of the cell's replays went to extra innings
- a tie: no game ends there

## G1 (each game card: the lines over its grid)

Game {number} {date} · at {home team}
Final: {winner} {runs}, {loser} {runs} · errors: {team} {errors}, {team} {errors}
Replays won: {team} {count}, {team} {count} · {count} went to extra innings · {runs} runs and {errors} errors a team on average

## P1 (series picks section, heading)

Did the replays pick the series winners?

## P2 (series picks, the paragraph under the heading)

The table takes the team that won or leads each series and shows, for each game, the share of the 1,000 replays that team won under whichever setting the switch above shows, marked W or L for whether it won the real game. The series chance combines those game shares into the chance of winning a best-of-five, with any game not yet played counted at the series' average share; the pick is the side that chance favours. These are not forecasts. Each game's replays used the lineups and pitchers that really played, which were known only once the game began, so the table asks a narrower question: given who played, did the replays lean the way the games went? Before the correction of 2026-10-08 (see the notes below), the regular-season setting gave the Dodgers 80%, the Brewers 85%, the Rays 47% and the White Sox 60%: the same calls, made with more confidence than the corrected replays support.

## P3 (series picks, table column heads and verdicts)

Series · Result · G1-G5 · Series chance · The pick
Verdicts: right / missed / open, leans {Guardians}
Result: {Dodgers} won {3-1} / {White Sox} lead {2-1}

## P4 (series picks, the line under the table)

The team the replays favoured won {8} of the {14} games played so far.

## R1 (regression section, heading)

Did the replays pick the game winners?

## R2 (regression, the paragraph under the heading)

Each point is one game, seen from the home team's side: across, the share of the 1,000 replays (regular-season pitching) the home team won; up or down, whether it won the real game. The blue curve is a logistic regression, the curve that best turns the replay share into a probability of the real win, with its 95% band. The dashed line is where the points would sit if the replay share were exactly the chance of winning, so that a team which won most of its replays won the real game just as often. The curve rises, so a higher replay share went with more real wins, but with only {14} games the rise is not significant at the usual 0.05 level: the uncertainty is wide enough to include no relationship at all.

## R3 (regression, axis titles and the statistics line)

Across: Home team's share of 1,000 replays won (regular-season pitching)
Up: Real game, and the fitted chance of winning
Slope {7.9} (standard error {6.2}), Wald p = {0.20}; likelihood-ratio p = {0.17}; McFadden R² = {0.10}, Tjur R² = {0.13}.
Key: logistic fit · its 95% band · a perfectly calibrated forecast

## N1 (the notes at the bottom, paragraph 1)

Each replay was played in the real park, with the designated hitter and, as in the real postseason, no runner placed on second base in extra innings. When a replay ran longer than the real game, the real game's pitchers ran out, and the model's manager took over with the rest of the playoff bullpen. Hover over a cell for its count and score.

## N2 (the notes at the bottom, paragraph 2)

Pitching as it was that day: for every pitch type a pitcher threw three or more times in the game, his speed is his regular-season speed plus that day's change (his average in the game against his season average), and his mix is that day's share of each type. The setting exists because postseason pitching differed from the regular season: on average, pitchers threw their fastballs 0.7 mph harder than in their own regular seasons, and they often changed their mixes.

## N3 (the notes at the bottom, paragraph 3)

Fielders' own error rates: each fielder's errors per chance in 2025-26 are compared with the usual rate at the positions he played, and the ratio scales his chance in the model of dropping a ball, fumbling a grounder or throwing one away (a player with few chances is pulled toward the usual rate, because a handful of plays says little about him). The model on its own makes 0.26 errors a team per game, fewer than real fielders make, so one league-wide factor is applied on top to bring the replays' errors near these fielders' own regular-season rate: 0.43 a team per game against their 0.44. The spread among them is wide: the most error-prone errs at about twice his position's rate and the surest at about a third of it.

## N4 (the notes at the bottom, paragraph 4)

Corrected 2026-10-08: each starter now plays the position he started at. Before the correction, a man who changed positions during a game was placed at the position he ended at, so in 8 lineups (7 games) two men shared one position and another position stood empty. In the model each fielder stands at the spot of his listed position, so the two men stood on the same spot and nobody stood at the empty one; a ball hit toward the empty position had to be reached by a fielder starting farther away, and more of those balls went for hits. Game 3 of White Sox vs Guardians, for example, listed two Cleveland left fielders and no centre fielder. That inflated the replays' scoring (4.24 runs a team, now 3.62) and widened their margins in those games.

## N5 (the notes at the bottom, paragraph 5)

Every hitter's traits were fitted to his 2025-26 Statcast measurements and every pitcher's to his strikeout and walk rates, on engine v3.9 (refit 2026-10-06); the trait map shows what each trait does and where its value came from.
