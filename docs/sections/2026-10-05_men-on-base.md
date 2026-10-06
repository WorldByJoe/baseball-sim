## Men on base: the infield's positions and throws, the tag-up and the margins (bb_field v1.8-v1.10, bb_game v1.5; 2026-10-05)

The brief (`docs/briefs/2026-10-05_men_on_base.md`), on branch `men-on-base` from `dh-everywhere` (engine v3.1, bb_game v1.4), on the Mac under jsc. Runs: the league's play with men on base (new: `statcast/men_on_base.py`, 42 days of 2025, 564 games): hitting by base state with a fixed effect for each batter and pitcher, ground-ball hit rate by base-out state and direction, which out the infielders take, the tag-up by depth, throwing errors on infield grounders; where the league's fielders stood (new: `statcast/infield_positioning.py`, Baseball Savant's fielder positioning, 2025, by batter side and runners on); the model measured the same way (new: `headless/mob_check.js`); `headless/runs_check.js` (600 games, seeds 3, 11, 29) and `headless/xbt_check.js` before and after each step; sweeps of the margins and the pivot (600-1,000 games a setting); the refit chain and the suite after each step against the shared baseline (`dh/diag_out/base_dh`).

**A measurement bug first** (`statcast/runs_league.py` v0.2). The league's measure counted a force out and a fielder's choice out as the batter's out, but 98% of batters who grounded into a force out were on base at the next plate appearance. So the forced runner was scored 'left', not out: runners forced out ran .69 a team-game where they were 1.45, and the force at second on a ground ball with a man on first counted as 'batter out' where `runs_check` counts the model's as a fielder's choice. Measured alike, the league made .84 fielder's choices a team-game to the model's .28, and its infielders took the lead runner far more often than the model's. The bug audit had read it the other way (.13 against .32). A play's outs had also gone to the lead runner first, so an inning-ending double play with men on first and third put the man on third out; they now go to the trailing runners. The RE24 table and BaseRuns are unchanged.

### What the league showed

**Hitting with men on base is mostly who is hitting** (`men_on_base.py` A; a linear probability model with a fixed effect for each batter and pitcher, then with the contact's own expected hit rate (Statcast's xBA from exit speed and launch angle) as well; 90% intervals from 40 bootstrap draws of whole games):

| BABIP gain over the bases empty | raw | batter and pitcher fixed | and the contact's xBA |
|---|---|---|---|
| all balls in play, a man on first only | +.024 [+.013, +.032] | +.010 [-.003, +.017] | +.013 [-.002, +.016] |
| all balls in play, a man in scoring position | +.033 [+.022, +.041] | +.010 [-.014, +.012] | +.013 [-.001, +.016] |
| on the ground, a man on first only | +.045 [+.029, +.065] | **+.036 [+.007, +.049]** | +.034 [+.009, +.047] |
| on the ground, scoring position | +.032 [+.018, +.045] | +.011 [-.016, +.020] | +.016 [-.011, +.020] |
| in the air, a man on first only | +.008 | -.007 | -.003 |
| in the air, scoring position | +.038 | +.015 | +.009 |

Levels: BABIP .281 / .305 / .314 (empty / on first / scoring position), on the ground .238 / .283 / .270, in the air .314 / .322 / .352. Two thirds of the raw gain was the batters and pitchers who come up with men on. What survived the control was a ground ball with a man on first (+.036), the fielding, not the contact (xBA flat at .250-.254). K% fell with men on (-.016 with a man on first, batter and pitcher fixed).

**Where the infield stood** (Savant, 2025, every fielder with 10+ PA, weighted; depth ft from home, angle deg, + toward first):

| | vs RHB, empty | vs LHB, empty | vs RHB, man on first only | vs LHB, man on first only |
|---|---|---|---|---|
| 1B | 113.7, +29.8 | 123.6, +37.8 | 87.9, +40.5 (holding) | 88.8, +41.1 |
| 2B | 153.0, +6.8 | 148.3, +19.0 | 148.9, +6.7 | 143.8, +18.8 |
| SS | 148.3, -18.1 | 152.3, -6.0 | 145.0, -17.2 | 149.1, -5.5 |
| 3B | 122.3, -36.5 | 116.0, -27.1 | 119.1, -36.6 | 114.6, -27.3 |

The model's infielders turned toward the pull side from a central spot by 1.0 deg per deg of pull (2B, SS), 0.8 (3B), 0.2 (1B): against a right-handed hitter the SS stood at -24 deg, the 3B at -40, the 2B at +4, 5-7 deg further round than the league's, and the opposite-field hole let through .46 of ground balls against .31. .63 of the league's pitches with a man on first only came with fewer than two out. With a man on third and fewer than two out, Statcast's 'Strategic' infield alignment (the infield in) ran .37 of pitches against .079 with third empty: .75 with first open, .18-.22 with first occupied; by the fielding side's lead, never when it led by two or more, .4-.85 otherwise, more late.

**Ground-ball hit rate by the positioning the state implies** (field frame, direction in deg, + toward right field):

| | <-30 | -30..-15 | -15..0 | 0..15 | 15..30 | >30 | all |
|---|---|---|---|---|---|---|---|
| bases empty | .321 | .223 | .271 | .287 | .174 | .193 | .237 |
| man on first, 2 out (holding) | .254 | .189 | .217 | .320 | .214 | .301 | .240 |
| man on first, <2 out (holding, DP depth) | .417 | .264 | .287 | .267 | .276 | .344 | .302 |
| first and second, <2 out | .420 | .388 | .200 | .327 | .226 | .254 | .303 |
| man on third, <2 out | .351 | .364 | .222 | .338 | .231 | .417 | .319 |
| man on second only | .284 | .261 | .176 | .331 | .162 | .244 | .241 |

Holding the runner opens the right side (>30 deg .301 against .193) but closes the left; the gain comes with fewer than two out.

**Which out the infielders took** (ground balls an infielder fielded, a man on first, fewer than two out, 1,699): a double play .403, the lead runner out and the batter safe .274, the batter out .180, a fielder's choice with no out .036, a hit .101. Among single outs the lead runner .60: more with a fast batter (.71 against .47 slow), less with a fast runner (.49 against .70 slow), more on hard balls (.72-.73 at 90+ mph against .52 under 80), by fielder SS .69, 2B .67, 3B .64, 1B .54, P .28. Once the force at second was made the relay beat the batter .60 of the time (.73 / .59 / .47 for slow, middling and fast batters). Covers (play descriptions): on a ball to third the throw to second went to the second baseman 239 times in 267; on a 3-6 double play the relay went to the pitcher covering 19 times, the first baseman back at the bag 11.

**The tag-up** (caught balls, fewer than two out; outcome from the play's description): a man on third scored .626 of the time (infield catches held always; LF .80, CF .90, RF .87), out .020; by depth 200-250 ft .35 scored (.05 out), 250-280 .67 (.15 out), 280-300 .93 (0), 300+ .98-1.00. A man on second took third .21 (.07 to LF, .36 to CF, .45 to RF; .41 at 320-340 ft, .71 at 340-360).

**Throwing errors on infield ground balls** (play descriptions): .0123 a ground ball, rising with the batter's speed (.0054 / .0146 / .0167, slow to fast) and falling with the exit speed (.0149 under 80 mph, .0089 over 100); the pitcher's the most (.0219) on the shortest throws. 56% put the batter on base by the error, 28% came on a single.

**The runner from a standstill**: Statcast's running splits (549 hitters, 2025, every 5 ft) fit an exponential rise to sprint speed, 1 - exp(-t / 0.78 s), at rmse .054 s (a constant acceleration .082): the average runner covers 90 ft in 4.11 s. Statcast's home to first runs .44 s (sd .08) longer than the split to 90 ft: the swing's finish.

### What was built

**1. MO: the infield with men on base** (bb_field v1.8, bb_game v1.5; four commits).
- *Positions* (measured): the league's spots by batter side, shading toward a hitter's pull beyond the average at the rate that turns one hand's spots into the other's (2B, SS 0.54 deg per deg, 3B 0.42, 1B 0.36); the first baseman holds a runner whenever second is open; with a force at second and fewer than two out the middle infielders and the third baseman play at double-play depth (the 'first only' shift over .63); with a man on third and fewer than two out the manager brings the infield in as often as the league's did by first base, inning and lead (one draw a plate appearance). The 2023 rule holds them: two infielders each side of second, all four on the dirt. Infield in stands on the line through the bases (2B and SS about 102 ft out, the corners about 92): a definition, as Statcast publishes no depth for it. bb_game places the infield at each plate appearance and again as the ball is hit. *This plays the 2023 shift rule against Joe's pre-2023 'shifts allowed' (bb_game's RULES): for Joe to decide.*
- *Covers* (measured): the second baseman covers second on a ball to third; a double play's relay goes to the man covering first (the pitcher, or the first baseman back), thrown with the pivot man's arm (plays_check 7, 8).
- *The throw* (a decision from measured values): for each runner he could play, the fielder weighs the runs that would score plus the league's RE24 of the bases and outs left, if the throw gets him and if not (and for a force at second the relay's chance at the batter), and throws for the lowest. It had counted expected outs and tried a force at second only when it was .6 likely (plays_check 9).
- *The pivot* (fitted, class O): at double-play depth the relay beat the batter .87-.91 of the time once the force was made; PIVOT 0.35 s (by hand) -> 0.65 s, swept 0.55-0.85 at seeds 3 and 11, fitted to the .60 overall; the slope by the batter's speed is the check.

Result (mob_check, seed 3, 600 games, after the chain; model | league): lead runner on .51 of single outs | .60 (.13 before); by the batter's speed .61 / .50 / .38 | .71 / .59 / .47; by the runner's .36 / .54 / .59 | .49 / .59 / .70; by the exit speed .36 / .53 / .63 / .65 | .52 / .62 / .73 / .72; SS .76 | .69, 3B .52 | .64, 2B .45 | .67, 1B .40 | .54, P .26 | .28 - not fitted. Double plays .409 of chances | .403, the relay's success .62 | .60 (.75 / .63 / .45 by the batter's speed | .73 / .59 / .47). Fielder's choices .55 a team-game (.28 before | .84), runners forced out 1.24 (.87 | 1.45). Ground-ball BABIP with a man on first .259 (.240 before | .283), hits with men on 3.57 a team-game (3.46 | 3.61).

**2. TU and FO: the tag-up and the sends home** (bb_field v1.9; five commits). First, as the brief asked, the tag-up loop read for a logic error: no bookkeeping slip after the audit's fix, but its decision was not the send's. A runner weighed the race with no error against SAFETY (0.30 s, the margin for taking second) and took the throw as sure to 0.15 s, so he went only when the throw had at most a 2% chance: no runner was ever thrown out tagging up (the league's .02 of chances), and the runner left from the batter's start out of the box.
- *The runner from a standstill* (measured): a runner on base starting from rest runs the running splits' curve (90 ft in 4.11 s where he took 4.40); the batter keeps his run from the box, a man moving off his lead keeps ACC_R.
- *The tag-up's read* (the send's): for third or home READ_SD (0.25 s), the margins SAFETY_3 and SAFETY_H by the outs he plays with once the catch is made, and the throw as sure as raceSD (plays_check 11).
- *The cut-off man* (measured elsewhere): his catch, turn and throw takes the pivot's 0.65 s (was 0.45 s by hand).
- *FO, the margins refitted* (class O, as before): one margin per base and outs for hits and tag-ups (a tag-up indexed by the outs after the catch); swept SAFETY_H -0.4 to 0.8 at three values of RACE_SD_M (the throw's spread: nothing decisive, left at 0.005), then SAFETY_3 0.55-0.95, 1,000 games a setting: SAFETY_3 [0.75, 0.75, 0.35] -> [0.95, 0.95, 0.35], SAFETY_H [0.7, 0.2, -0.4] -> [0.8, 0.2, 0].

Result (1,000 games, seeds 3 / 11; model | league): a man on third scored on a caught ball .48 / .50 | .63 (.27-.36 before), out .05 / .04 | .02; a man on second took third on a catch .19 | .21; sacrifice flies .17 a team-game (.10-.13 before | .27). A man on second scored on a single .43/.40, .61/.56, .71/.70 with none, one, two out | .36, .51, .83; a man on first took third on a single .32/.28, .30/.31, .48/.46 | .28, .30, .42; a man on first scored on a double .33/.23, .41/.44, .44/.53 | .34, .31, .52, thrown out at home with two out .10 / .09 | .03 (.12 in #32). One margin cannot fit both: at the same margin hits are sent too readily and tag-ups too seldom (below).

**3. T and DP.** DP is above (the pivot measured once double-play depth exposed it). T was built (bb_field v1.10, commit 3fa15f8): an infielder with less than 0.5 s to spare on his play rushes it and his throw scatters by up to 1.1 x armAcc more (fitted to the overall rate; additive and multiplicative forms swept). It brought throwing errors on infield ground balls from .0039 to .0098-.0123 (league .0123) with the league's slopes by the exit speed and men on, and all errors to .43 / .41 / .40 a team-game (.32 / .36 / .37 | .50); but throwing errors a team-game rose from .09 to .17 (league .13) and batters reaching on an error from .23 to .30 (.19), so it was **taken out again** (760c148): see what failed.

### Bugs fixed (each its own commit with a test)

1. **`runs_league.py`: a force out was the batter's out** (above). Check: the script now counts force outs whose batter was on base next (0.41 of 0.42 a team-game).
2. **A fly the fielder was under and dropped was the batter's hit as well as the fielder's error** (bb_field v1.9): the scorer judged the batter's race to first as if no catch had been possible. Rule 9.12: he reaches on the error. plays_check 10 (three drops: hits before, errors after). About 0.02 hits a team-game.
3. **A tag play that made the third out counted every run of a runner who tagged and reached home** (bb_field v1.10): rule 5.08(a) makes it a time play. Found by `invariants_check` once tag-ups could be thrown out (3 plays in 500 games); its rule now leaves a caught fly to bb_field (v0.3). plays_check 12 (19 plays, the run counted in all before, none after). `invariants_check`, 500 games at seed 11: clean but for the 18-inning limit; on the final code, 500 games at seed 29: no violations.
4. **A double play's relay went to the first baseman who had just thrown to second** (with the covers above): outcome-neutral, as the pitcher covering is there long before a relay can be.
5. `plays_check` v0.8: its constructed batters set the defence by their own drawn bat speed and pull, so the chain's pool refit moved the fielders and cases 1 and 5 failed on unchanged code; they now carry the pool's average, and case 1 throws true.

### The line against the baseline

Suite (200 games a seed) and runs_check (600 games a seed), seeds 3 / 11 / 29, each step after its chain:

| | baseline (base_dh) | after MO | after TU and FO | final (TU, the time play; T out) | league |
|---|---|---|---|---|---|
| runs | 4.37 / 4.50 / 4.39 | 4.23 / 4.45 / 4.07 | 4.45 / 4.48 / 4.29 | 4.37 / 4.36 / 4.59 | 4.45 |
| runs / BaseRuns (runs_check) | .962 / .962 / .947 | .943 / .957 / .952 | .960 / .974 / .962 | .950 / .954 / .955 | 1.011 |
| hits | 8.27 / 8.13 / 8.27 | 8.07 / 8.02 / 7.94 | 8.27 / 8.01 / 8.04 | 8.29 / 8.34 / 8.45 | 8.26 |
| doubles | 1.65 / 1.56 / 1.62 | 1.66 / 1.68 / 1.74 | 1.62 / 1.76 / 1.72 | 1.79 / 1.69 / 1.76 | 1.59 |
| home runs | 1.36 / 1.42 / 1.33 | 1.27 / 1.36 / 1.25 | 1.25 / 1.33 / 1.32 | 1.31 / 1.34 / 1.36 | 1.16 |
| walks | 3.31 / 3.65 / 3.63 | 3.48 / 3.53 / 3.33 | 3.42 / 3.48 / 3.46 | 3.25 / 3.46 / 3.52 | 3.16 |
| strikeouts | 7.45 / 7.28 / 7.22 | 7.58 / 7.51 / 7.22 | 7.10 / 7.42 / 7.30 | 7.03 / 7.04 / 7.36 | 8.36 |
| double plays | 0.70 / 0.75 / 0.68 | 0.73 / 0.77 / 0.78 | 0.73 / 0.65 / 0.72 | 0.70 / 0.76 / 0.62 | 0.75 |
| errors | 0.37 / 0.30 / 0.33 | 0.38 / 0.40 / 0.35 | 0.32 / 0.36 / 0.37 | 0.38 / 0.37 / 0.41 | 0.50 |
| triples | 0.15 / 0.11 / 0.11 | 0.14 / 0.11 / 0.14 | 0.14 / 0.14 / 0.13 | 0.12 / 0.13 / 0.14 | 0.13 |
| AVG | .240 / .238 / .240 | .235 / .235 / .234 | .244 / .234 / .238 | .242 / .243 / .245 | .245 |
| BABIP | .268 / .263 / .267 | .265 / .262 / .263 | .273 / .260 / .264 | .267 / .268 / .273 | .291 |
| SLG | .415 / .415 / .410 | .402 / .410 / .404 | .410 / .409 / .414 | .416 / .417 / .422 | .404 |

runs_check, final code (600 games; seeds 3 / 11 / 29 where given; model | league): BABIP with the bases empty, a man on first only, a man in scoring position .265 / .271 / .264 at seed 3 (.280 / .301 / .298), on the ground .237 / .253 / .233 (.237 / .282 / .269; with a man on first .253 / .261 / .272 at the three seeds, .240 at the baseline); a man on third scored on an air out .50 / .49 with none and one out (.65 / .62; .35 / .37 at the baseline), out .04 / .05 (.00 / .04); sacrifice flies .17 / .17 / .18 a team-game (.27; .13 at the baseline); fielder's choices .57 / .55 / .54 (.84; .28); runners forced out 1.26 (1.45; .87); double plays .72 (.71); a man on first thrown out at home on a two-out double .04 at seed 3 (runs_check), .08 / .06 (xbt_check, seeds 3 / 11) (.03; .08 at the baseline, .12 in #32); hits with runners on 3.51 (3.61; 3.46); reached on error .26 / .27 / .26 (.19; .23); throwing errors .09 / .09 / .07 (.13; .12); runners left in scoring position 4.24 (3.55; 4.37).

The run-conversion ratio: **.962 / .962 / .947 before, .950 / .954 / .955 after** (league 1.011): unchanged within the spread the refit chain itself puts between runs of the same code (after MO .943 / .957 / .952, after TU and FO .960 / .974 / .962, with T .958 / .977 / .970 - each after its own chain, whose pool refit moves who plays). The lead-runner choice (MO) pulls it down, as it should: a lead runner put out costs about 0.15 runs that BaseRuns, counting no fielder's choice as a hit, does not see, so matching the league's choices widens the gap; the tag-up and the margins push it back up. Runs a team-game 4.37 / 4.36 / 4.59 against 4.45 (4.37 / 4.50 / 4.39 before); the worst seed beside the baseline: seed 11, runs 4.50 -> 4.36, ratio .962 -> .954. What is left of the gap is not the fielders' choices or the tag-up's rule: it is hitting in scoring position (AVG .307 against .344, BABIP .264 against .298) and the outfield throw's race (TB below).

### Tried and not kept

- **T, the hurried throw** (above): it matched the infield's throwing errors and their slopes, but the totals overshot because the model's outfield throws go wild about 3.5 times as often as the league's (throwing errors other than on infield grounders .07 a team-game against .02; a long throw's scatter grows with its length and nobody at the other end moves for it) and its fumbles already put the batter on too often (reached on error .23 against .19 before T). Keep it for when the long throw's receiver is built (hypothesis RX below).
- **The pivot at 0.70 s** matched the lead-runner share better (.55-.58 against .60) but the relay's success worse (.55-.56 against .60); 0.65 s was kept for the relay, which the pivot alone governs.
- **One margin for hits and tag-ups**: no value fits both (the sweep above); the residual is recorded as TB.
- **The throw's spread (RACE_SD_M 0.005 -> 0.002 or 0)**: no decisive change in the joint fit; not changed.
- **The hurry as a multiple of the length's scatter** (1.5-8): the third baseman's long throws went wild 1.5 times the league's rate; the additive form fitted the fielders better.

### What is left, and the next suspects

- **TB, the race on the throw home from the outfield.** At the same margins the model's hit-sends go too readily and its tag-ups too seldom; by depth a man on third tagging was still thrown out .15-.30 of the time at 250-320 ft where the league's were 0-.15, and scored .46-.75 where the league's scored .67-.98. The model's race margin for a man on third (the throw's arrival less his) ran -0.12, +0.25, +0.62, +0.96 s at 250-280, 280-300, 300-320, 320-340 ft; the league's outcomes (93% safe at 280-300 ft, no out in 53 sends) need about +0.5 s more at those depths and a smaller spread (raceSD grows 0.005 s a metre past 40 m: 0.39 s at 88 m, which turns a 0.25 s lead into a 26% out). Suspects: an outfielder's catch-to-release on a throw home (one transfer, 0.69 s, for every fielder), the throw's spread past 40 m (set by hand), the direct throw against the relay estimate. Test: Statcast's outfield throw times if they can be had, or the league's out rate by depth with the spread fitted jointly.
- **Doubles rose** from 1.65 / 1.56 / 1.62 to 1.79 / 1.69 / 1.76 a team-game (league 1.59; .067 of balls in play against .063), from the first step on (after MO 1.66 / 1.68 / 1.74): the cost of this work on the suite. Suspects: the measured spots put the corners further off the lines than the hand-set ones did (the third baseman at -36.5 deg against a right-handed hitter, -40 before), so the model's grounders and liners down the lines (its bounce and the batter's stretch at SAFETY 0.30 s, set by hand) now show; and the slower cut-off man.
- **RX, a receiver's reach on a long throw**: outfield throwing errors 3.5 times the league's; it blocks T.
- **Who takes the ball between first and second** (bases empty; for the ground-balls job and the integration): with the league's spots the model's first baseman fielded .26 of grounders at 15-30 deg and turned .33 of them into infield hits (throwing to the pitcher covering), where the league's second baseman took .70 of them and the first baseman's went for hits .07: the fielder who can reach the ball first takes it, where the league's first baseman yields to the second baseman who has the play.
- **Ground-ball BABIP with men on**: .253-.272 with a man on first after the build at the three seeds (.240 before; league .283, its controlled gain +.036, the model's now +.016-.035); in scoring position flat (.233-.244 against .270; the league's controlled gain +.011, not significant).
- **Who comes up with men on.** Two thirds of the league's raw BABIP gain with men on (+.014 of +.024 with a man on first, +.023 of +.033 in scoring position) is the batters and pitchers who meet in those states; the model's raw gain was nil before this work (-.008 / -.006), so it has no such mix effect: its BABIP talent may vary too little between hitters and pitchers. The model's checks draw fresh teams every game, so the fixed-effects fit cannot be run on it as on the league (mob_check's csv rows give a meaningless fit: every player has four or five plate appearances); a season in bb_league would allow it.
- **The infield in's depth** is a definition; **the shift rule** plays 2023's against Joe's pre-2023 choice.

### Proposed changes for CALIBRATION.md

**Mysteries.** 2 (hitting with men on): two thirds of the league's raw gain is who comes up with men on (batter and pitcher fixed: +.010 overall, +.036 on the ground with a man on first); the fielders' choices are now the league's, and the ground-ball gain with a man on first half there; the audit's 'fielder's choices .32 against .13' was the league's measure counting force outs as the batter's. 6 (sacrifice flies): .10-.13 -> .17 a team-game against .27; a man on third scores on a catch .48-.50 against .63; the rest is TB. 10 (double plays, errors, outs on the bases): double plays matched (pivot measured), the two-out double's out at home .12 -> .09-.10 against .03; throwing errors on infield grounders .0039 against .0123 (T built, not kept, until RX).

**Hypotheses.** MO: built (positions, covers, the throw by run value). TU: built (the read, the runner from a standstill). FO: refitted. DP: PIVOT fitted 0.65 s. T: built with a cost, recorded (3fa15f8). New: TB (the outfield throw's race home), RX (a receiver's reach on a long throw), WB (who takes the ball between first and second).

**Trait map constants** (bb_field): INF and INF_FIRST spots (measured, Savant 2025); FIRST_LT2 .63 (measured); IN_P, the infield in by first base, inning and lead (measured from Statcast's alignment); lineDepth for the infield in (definition); RE24 (measured, runs_league 2025); PIVOT 0.35 -> 0.65 s (class O); RELAY_XFER 0.45 s removed, the cut-off man takes PIVOT; TAU_RUN 0.78 s (measured, running splits); SAFETY_3 [0.95, 0.95, 0.35] and SAFETY_H [0.8, 0.2, 0] (class O, refitted); the shade 0.54 / 0.54 / 0.42 / 0.36 deg per deg of pull (measured from the L/R spots, proportional pull assumed).
