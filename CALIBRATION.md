# Calibration log

`CALIBRATION.md · v0.7 · 2026-09-30`

This file records where the engine stands against MLB and what is known to be off. Per Joe (2026-09-29), calibration is deliberately loose at this stage. Tuning hard now could hide real mechanisms we haven't built yet, such as fielding, base running, managers, weather and parks. Each gap below is either a missing mechanism or a trait mean that was left alone on purpose.

The rule has not changed: outcomes are never tuned directly. The only knobs are the trait distributions (`TRAITS` in `bb_engine.js`) and physical constants fitted to measurements (`PITCH_TYPES` eff/tilt, `AERO.batCd`), and each fit is labelled in the code.

## Engine v0.3: plate-appearance layer, 4 leagues × 50,000 PA

Each seed draws a different league. Parks and weather come from MLB's own mix (`mlbEnv`).

| metric | s11 | s23 | s37 | s59 | MLB |
|---|---:|---:|---:|---:|---:|
| K% | 22.8 | 23.8 | 24.2 | 24.9 | 22.6 |
| BB% | 12.1 | 11.5 | 10.9 | 11.1 | 8.2 |
| HR% | 2.1 | 1.9 | 2.1 | 2.0 | 3.0 |
| pitches / PA | 3.8 | 3.7 | 3.7 | 3.7 | 3.90 |
| swinging strike / pitch | 10.1 | 10.4 | 11.3 | 11.1 | 11.1 |
| foul / pitch | 14.2 | 14.0 | 14.6 | 14.3 | 17.9 |
| zone % | 48.3 | 48.1 | 48.6 | 48.5 | 49.0 |
| chase % | 21.5 | 21.7 | 22.2 | 22.3 | 28.5 |
| zone contact % | 81.2 | 80.9 | 79.8 | 79.5 | 85.2 |
| chase contact % | 60.3 | 59.2 | 57.7 | 58.3 | 56.5 |
| exit velocity (mph) | 93.4 | 93.0 | 93.5 | 93.3 | 88.5 |
| launch angle mean / sd | 10 / 29 | 9 / 29 | 10 / 29 | 9 / 29 | 12.5 / ~26 |
| hard hit % | 50.7 | 49.1 | 51.1 | 50.3 | 38.5 |
| HR / fly ball | 10.7 | 9.7 | 11.5 | 11.1 | ~17 |
| HR: EV / LA / projected ft | 104.4 / 27.8 / 378 | 104.0 / 27.8 / 376 | 104.2 / 28.1 / 377 | 104.3 / 28.1 / 377 | ~103.5 / ~28 / ~400 |
| pull / centre / oppo | 37 / 43 / 20 | 37 / 43 / 20 | 37 / 42 / 20 | 38 / 42 / 20 | 40 / 34 / 26 |

## Checks that passed

- **Pitch movement:** each pitch type reproduced Baseball Savant's average induced vertical and horizontal break to within 0.1 in (`headless/physics_check.js`).
- **Collision:** a squared-up hit gave exactly q·pitch + (1+q)·bat.

## What was learned

- **Pitch spin efficiency.** The breaking-ball `eff` fitted from movement came out well below Savant's published "active spin" (slider 0.12 against ~0.35). Either this lift model credits low spin factors generously, or seam effects matter; seam effects are not modelled.
- **Air (Joe's point).** MLB's mix of parks and weather averaged 2.6% thinner air than sea level at 70 °F. That was worth +5 ft on a 103.5 mph, 28° drive league-wide and +32 ft at Coors. The batted-ball drag factor was refitted under that mix, 1.115 → 1.142.
- **The drag proxy was wrong.** Model home runs matched MLB exit velocity and launch angle but carried about 23 ft short. They carried about 3,550 rpm of spin, of which only about 2,700 was backspin; the rest was sidespin and gyro, which make no lift. So the pure-backspin proxy ball that drag was fitted to overstated carry. The next fit should target the model's own home-run population.
- **Recognition is all-or-nothing, not proportional.** A proportional misread, and then a saturating one, both spread contact evenly across the bat face and flattened launch angles from −60° to +80°. A yes/no detection event, with a fooled batter correcting only the break he could see by the commit point, brought strikeouts, swinging strikes and contact onto MLB values.
- **The command-line bug.** The first "four seeds" batch was byte-identical, because the harness never read its arguments. That was fixed in run_pa.js v0.4. Identical output from different seeds is the tell.


## Full games (bb_field v0.1 + bb_game v0.1 on engine v0.5): 3 seeds × 300 games

Fresh teams every game; AL and NL rules drawn at random; parks and weather from MLB's mix.

| per team-game | s11 | s23 | s37 | MLB |
|---|---:|---:|---:|---:|
| runs | 2.77 | 2.87 | 2.83 | 4.39 |
| hits | 7.19 | 7.35 | 7.56 | 8.15 |
| doubles | 1.70 | 1.63 | 1.77 | 1.60 |
| triples | 0.39 | 0.39 | 0.46 | 0.14 |
| home runs | 0.69 | 0.73 | 0.71 | 1.12 |
| walks | 3.61 | 3.85 | 3.59 | 3.10 |
| strikeouts | 9.63 | 9.68 | 9.80 | 8.40 |
| errors | 0.66 | 0.66 | 0.69 | 0.55 |
| double plays | 1.16 | 1.26 | 1.19 | 0.72 |
| pitchers used | 3.75 | 3.86 | 3.85 | 4.2 |
| pitches | 137 | 139 | 140 | 146 |
| AVG / OBP / SLG | .212/.289/.346 | .215/.296/.350 | .217/.292/.355 | .243/.312/.399 |
| BABIP | .274 | .278 | .281 | .291 |
| BABIP by type (100-game check) | GB .27 · LD .74 · FB .17 · PU .01 | | | GB .24 · LD .68 · FB .12 · PU .02 |

### bb_field v0.5 (2026-09-29): receivers and fly-ball reads, 200 games, seed 3

Two mechanisms Joe's watching exposed, both changing the line in the right direction without a knob: a throw cannot arrive before the man covering that base does (a first baseman playing deep is late on a hot shot), and a runner on a fly ball reads the catch chance (goes on contact when nobody will reach it, halfway when it might drop, holds on a routine fly) instead of waiting at the bag.

| metric | v0.4 | v0.5 | MLB |
|---|---|---|---|
| runs | 2.75 | 3.25 | 4.39 |
| hits | 7.16 | 7.52 | 8.15 |
| doubles | 1.67 | 1.96 | 1.60 |
| triples | 0.42 | 0.49 | 0.14 |
| errors | 0.73 | 0.67 | 0.55 |
| double plays | 1.07 | 0.75 | 0.72 |

The double-play excess was the receiver: with the covering man always at second the force was too easy. Doubles now run a little high, which points at the outfield arm and cut-off timing rather than the runners.

### The running game (bb_engine v0.6, bb_field v0.6, bb_game v0.6; 2026-09-30): 300 games, seed 3

Four new traits: a runner's **jump** (0.22 s), a pitcher's **delivery time** with a man on (1.35 s), a catcher's **pop time** (1.95 s) and **blocking** (0.75). A runner on first (or second, third open, fewer than two out) weighs his own time to the bag - jump, then a sprint from a moving 3 m/s secondary lead - against the battery's delivery plus pop time, and goes when his estimate clears 72% plus his own aggression, picking one pitch in five. The stopwatch then carries noise the runner cannot know (a slide step or not, the throw's accuracy: 0.22 s), which is where the outs come from. A pitch the catcher cannot hold is judged from where it crosses: bounced (0.5% of pitches), below the knees (8%), wide or high, or an ordinary miss, against his blocking. Every runner moves up one base.

| metric | model | MLB |
|---|---|---|
| stolen bases | 0.59 | 0.47 |
| caught stealing | 0.15 | 0.19 |
| wild pitches | 0.35 | 0.36 |
| passed balls | 0.07 | 0.08 |
| runs | 3.50 | 4.39 |

Two calibration lessons. Raising runner acceleration to 5.5 m/s² to make steals work pushed BABIP to .315 and triples up; the average home-to-first (4.4 s) was right all along, and the missing speed on a steal was the moving lead, not the legs. And the first stopwatch noise (0.08 s on the throw) made steals 92% safe: the runner's estimate was as good as the outcome. Not built: pickoffs, the runner returning on a caught fly he ran on (he is scored as having held), catchers' throws to third on a steal of third are only shortened by 0.2 s.

### The hitter's power chain (bb_engine v0.7; 2026-09-30): first latent layer

Bat speed is no longer drawn. Height → weight (r = .62 line plus scatter) → swing power per kg (lognormal, falling as weight^−0.45), swing length (about the height line), the bat he swings (31.8 oz plus a little for size) → bat speed from v³ = 4pWL/m_eff (the bat's kinetic energy over the swing time 2L/v; 337 J in 0.139 s at the means), the bat's effective mass → collision efficiency q (0.21 for the mean bat, via the ball-bat COR 0.48), and precision worsening as bat speed squared (impulse variability). Fitted: the power mean and log-sd, the weight exponent. Targets and tests are the 2025 Statcast per-player distributions (`STATCAST_TARGETS_2025.md`); the check is `headless/power_chain.js`.

| | model | 2025 |
|---|---|---|
| bat speed, mph (mean ± sd, p5–p95) | 71.9 ± 2.67, 67.6–76.4 | 72.0 ± 2.65, 67.5–76.0 |
| best of 226 hitters | 79.4 mph (z +2.78) | 78.8 (Cruz, z +2.55) |
| slowest of 226 | z −2.64 | 62.5 (Arraez, z −3.57) |
| weight ~ bat speed (not fitted) | +0.50 | +0.53 |
| height ~ bat speed (not fitted) | +0.38 | +0.45 |
| swing length ~ bat speed (not fitted) | +0.54 | +0.58 |
| bat speed ~ EV50 (not fitted) | +0.87 | +0.86 |
| bat speed ~ exit velo avg | +0.76 | +0.71 |
| bat speed ~ hard-hit share | +0.72 | +0.77 |

What the chain exposed, both for the next layers rather than this one:

1. **Contact is far too clean.** Measured the Statcast way (exit velocity ≥ 80% of the most that bat and pitch could give), the model squares up 78% of contact against 34% in the league; so average exit velocity runs 93.7 vs 89.7 while the top half (EV50) matches, 100.7 vs 100.6. The best contact is right; the mishits are missing. This is the "contact is two-state" gap with a number on it.
2. **Bat speed does not drive whiffs in the model** (r +0.03 vs +0.69 real; vs K% +0.09 vs +0.58). The model's whiffs are all recognition; the real link runs through approach - power hitters hunt pitches to drive, swing with high attack angles and accept misses - and through the longer swing. The precision-speed coupling alone does not produce it.
3. **The real league has a left tail the model lacks**: Arraez and Kwan swing 3.6 sd below the mean, well under what their bodies could deliver. That is an effort-allocation trait (contact over power), not a weak body.

A fitting lesson: the weight exponent read off the proxy power/kg = bat speed³/(swing length × weight) was −0.6, but that proxy carries weight in its own denominator, so its slope is biased toward −1; the exponent that reproduces weight~bat speed .53 in the drawn league is −0.45. Fit to the measurable the data actually reports, not to a derived proxy.

### The contact model (bb_engine v0.8; 2026-09-30)

The goal was a middle ground between the whiff and clean contact: squared-up per contact from 0.78 to about 0.34 without raising K%. That goal was not reached. One mechanism was built and kept. Three more were built, measured and removed, and a map of the trade-off showed why widening the spread of contact offsets cannot reach the target in this engine as it stands. Runs: `run_games` 200 games at seeds 3, 11, 29; `power_chain` 500 hitters × 40 PA at seeds 3 and 11 (v0.2 of the script, which added the rows marked new). All under jsc.

**Built and kept: timing moves the strike up and down the bat face (`timingLift`).** Until v0.7 a timing error only turned the bat (spray). Seen from the bat, the ball comes in along the relative velocity u = v_ball − v_bat. A bat that is early by e sits v_bat·e farther along its own path, and the part of that shift across the ball's line of approach changes where the ball meets the barrel: ΔD = −e·(v_bat across u). In the vertical plane that is −e·v_bat·v_pitch·sin(attack − descent)/|u|. This is pure geometry with no new constant. The brief suggested adding the two terms, e·(v_bat·sin attack + v_pitch,vertical). Worked through, the early bat and the ball both meet higher, so the terms subtract. That is the hitting coach's "match the plane of the pitch": a 9° attack angle against a pitch falling at 6–10° is forgiving of timing. A bat path steeper than the pitch tops the ball when early and gets under it when late. The random draws keep v0.7's order. With the term switched off, run_games at seed 3 reproduced v0.7 to the digit, so every difference below came from the mechanism.

| | before (v0.7) | after (v0.8) | 2025 / MLB |
|---|---|---|---|
| squared-up per contact, own q (v0.7 measure) | .782 / .758 | .773 / .750 | .337 (band .30–.40) |
| squared-up per contact, Statcast proxy (new) | .744 / .716 | .731 / .710 | .337 |
| squared-up per ball in play, Statcast proxy (new) | .836 / .830 | .831 / .822 | ~.66 |
| squared-up per foul, Statcast proxy (new) | .620 / .575 | .607 / .574 | ~0 (implied) |
| exit velo avg (mph) | 93.85 / 93.25 | 93.64 / 92.94 | 89.7 (88.5–91.0) |
| hard-hit (95+) share | .532 / .504 | .521 / .490 | .42 (.36–.46) |
| EV50 (mph) | 100.8 / 100.3 | 100.7 / 100.0 | 100.6 (99–102) |
| whiff per swing | .243 / .252 | .252 / .269 | .238 (.21–.27) |
| K% (power_chain) | .215 / .255 | .229 / .270 | .204 (.19–.25) |
| bat speed ~ squared-up, 40 PA | −.15 / −.16 | −.12 / −.11 | −.52 |
| bat speed ~ squared-up, 300 PA | −.07 / −.25 | −.16 / −.17 | −.52 |
| bat speed ~ whiff, 300 PA | +.03 / +.05 | +.00 / +.02 | +.69 |
| foul per pitch (new) | .135 / .141 | .137 / .140 | .179 |
| fair LA mean / sd (new) | 11.6 / 27.4, 11.0 / 28.6 | 11.2 / 28.1, 10.4 / 28.9 | 12.5 / ~26 |
| fair EV sd (new) | 10.0 / 10.1 | 10.2 / 10.3 | ~14 |
| fair EV by type GB / LD / FB / PU, seed 3 (new) | 94.4 / 97.5 / 93.8 / 82.6 | 94.1 / 97.6 / 93.5 / 83.1 | 86 / 93 / 93 / – (2022) |

| league line, seeds 3 / 11 / 29 | before (v0.7) | after (v0.8) | MLB |
|---|---|---|---|
| runs | 3.43 / 3.76 / 3.68 | 3.21 / 3.20 / 3.69 | 4.39 |
| hits | 7.58 / 8.04 / 7.96 | 7.42 / 7.36 / 7.86 | 8.15 |
| doubles | 1.96 / 2.04 / 1.94 | 1.88 / 1.75 / 1.78 | 1.60 |
| triples | 0.48 / 0.56 / 0.53 | 0.46 / 0.47 / 0.58 | 0.14 |
| home runs | 0.67 / 0.77 / 0.76 | 0.63 / 0.66 / 0.74 | 1.12 |
| walks | 3.90 / 3.75 / 3.80 | 3.93 / 3.73 / 3.97 | 3.10 |
| strikeouts | 10.28 / 10.20 / 10.15 | 10.28 / 10.31 / 10.50 | 8.40 |
| errors | 0.69 / 0.72 / 0.73 | 0.65 / 0.71 / 0.65 | 0.55 |
| double plays | 0.86 / 0.76 / 0.72 | 0.85 / 0.80 / 0.73 | 0.72 |
| AVG / OBP / SLG | .220/.301/.364, .231/.308/.389, .231/.309/.385 | .217/.299/.354, .216/.296/.353, .226/.307/.375 | .243/.312/.399 |
| BABIP | .294 / .305 / .305 | .291 / .289 / .302 | .291 |
| K% | 26.8 / 26.4 / 26.4 | 26.8 / 27.1 / 27.0 | 22.6 |
| BB% | 10.1 / 9.7 / 9.9 | 10.3 / 9.8 / 10.2 | 8.2 |
| HR% | 1.7 / 2.0 / 2.0 | 1.6 / 1.7 / 1.9 | 3.0 |
| GB / LD / FB / PU % | 49/18/20/13, 50/18/20/13, 49/18/20/14 | 49/17/20/14, 50/17/19/14, 50/17/20/13 | 43/24/24/9 |

The effect was small and mixed. Contact got a little weaker: squared-up −.01, exit velocity −0.2 to −0.3 mph, hard-hit −.01. Whiffs rose by .01–.02, and league K% rose 0.6–0.7 points at seeds 11 and 29 (unchanged at seed 3). The batted-ball mix did not move. Bat speed ~ squared-up did not move consistently: at 300 PA per hitter the seed-to-seed spread was ±0.1, larger than any shift. The mechanism was kept because it is geometry the engine had left out, not a fitted knob. Dropping it is a one-line change that restores v0.7 exactly.

**Built, measured, removed:**

| mechanism (two values: power_chain seeds 3 / 11; one value: a 300-hitter diagnostic at seed 3) | whiff/swing | squared-up/contact | K% (games) | other |
|---|---|---|---|---|
| timing also moves the strike ALONG the barrel (barrel turning about a fixed point SWING_RADIUS behind the sweet spot: r = R·cos(planned)/cos(actual)) | .374 / .378 | .786 / .754 | 29.3 / 29.6 / 29.7 | foul/pitch .086; mistimed swings went off the end as misses instead of weak contact |
| continuous read: a detected pitch keeps a share √(lateness) of the fooled residual, lateness = ln u / ln pFooled from the same draw | .569 / .623 | .556 / .511 | 61.6 / 62.3 / 62.2 | LA sd 36–39°: the proportional-misread failure of v0.2 again |
| the same, share = lateness | .449 | .614 | 49.7 | LA sd 34.5° |
| the same, timing residual only | .288 | .773 | 39.0 | foul/pitch .183 (MLB .179), but pop-ups 20% |

The continuous read failed for one reason. The pitches a batter detects are exactly the ones whose real path differs most from the one he expected. A curveball read as a fastball differs by a foot at the plate, so even a modest residual share of that gap is a miss. Mechanism 3 (a heavier-shouldered motor scatter) was not built. The trade-off map below bounds it, and it needed a new trait with no measurement behind it.

**Why widening the offsets cannot reach .34 here: the trade-off map.** These runs scaled every swing's execution scatter in a scratch copy, not committed, at seed 3 with 300 hitters × 40 PA:

| execution scatter × | whiff/swing | squared-up/contact (own q) | Statcast proxy | per ball in play | foul/pitch |
|---|---|---|---|---|---|
| as built | .250 | .780 | .739 | .842 | .135 |
| vertical × 2 | .303 | .712 | .668 | .789 | .133 |
| vertical × 3 | .377 | .662 | .614 | .756 | .129 |
| along the barrel × 2 | .349 | .635 | .587 | .681 | .120 |
| timing × 2 | .309 | .780 | .744 | .832 | .174 |
| all three × 2 | .440 | .607 | .558 | .650 | .145 |

Four findings came out of it.

1. **The collision keeps 80% of the maximum exit velocity out to about 1.8 in of vertical offset, on a contact half-width of 2.75 in.** So even contact spread evenly across the bat face squares up about 0.6 of the time. Every widening that lowered squared-up raised whiffs about as much. The .30–.40 band needs something other than a wider spread of offsets.
2. **Statcast's squared-up per contact counts fouls.** Per ball in play the league ran about .66 (FanGraphs, early 2024, same proxy), which implied that the league's fouls were almost never squared up, so most of them must have been glancing contact. The model's fouls were squared up 57–62% of the time. Two-thirds of them went foul beside the lines (28–34% went behind the plate) with a median of 86% of the maximum exit velocity: solid balls with the wrong direction. Per ball in play the model ran .82–.84 against .66.
3. **The excess exit velocity sat in ground balls and line drives.** Ground balls came off at 93–94 mph against MLB's 86, line drives at 97–98 against 93, while fly balls matched (93.5 vs 93). The rigid-body collision is symmetric in the vertical offset: a topped ball at −19° keeps 94% of the maximum, as an equally undercut one does. Whatever makes the league's grounders weak was missing: contact off the end or near the hands, a falling bat path on low pitches, rolling over, or a steeper loss of speed with offset than this collision gives.
4. **The fooled branch owns the whiff budget.** About half of all swings were "fooled", and they whiffed 46% of the time against 5% for detected pitches, so fooled swings made about 90% of the whiffs. By pitch kind the model whiffed on fastballs .25, breaking balls .18 and off-speed .34; MLB runs about .20 / .33 / .32. With the budget spent there, the recognised pitches cannot take the broader scatter that, in the league, produces whiffs and mishits together.

A measuring lesson: at 40 PA a hitter's squared-up rate carries binomial noise of about .08, twice the real spread between hitters (.041). Bat speed ~ squared-up needs 300 PA or more per hitter to read at all.

## What was learned building the fielding layer

- **Statcast's outfield JUMP (about 30 ft covered in the first 3 s) is the right anchor for outfielder motion.** The first fielders covered 44 ft in 3 s and caught nearly every fly ball (fly-ball BABIP .03). Slowing everyone to the jump figure fixed the outfield but let 52% of ground balls through, so infielders got their own harder acceleration and a dive reach. That's a real difference: they work from a crouch on a ball that is on them at once.
- **Triples ran at 3× MLB until long throws went through a cut-off man.** Two short throws beat one lofted one, and once the runners' estimate knew that, triples fell from 0.42 to about 0.2 a game before the outfield slowdown raised them again.
- **Starters went eight innings** until the manager's hook mean dropped to 0.5 and relievers were swapped between innings after about a dozen pitches.

## Gaps at the game level, to fix with mechanisms

1. **Runs are low (2.8 vs 4.4)** because the plate-appearance layer's gaps compound: fewer home runs, more strikeouts, more pop-ups. Fix those first; do not tune fielding to hide them.
2. **Triples (0.4 vs 0.14):** runners decide with perfect knowledge of when the ball will be fielded, and outfielders take a while to reach balls at the wall.
3. **Double plays: closed** in bb_field v0.5 (0.75 vs 0.72) once the throw to second had to wait for the covering man. Fielder's choices (about 5% of balls in play) are still worth a look.
4. **Extra innings 14–18% (vs 8%)** follow from low scoring.
5. **Not built yet:** pickoffs, intentional walks, defensive substitutions and double switches, situational positioning (infield in, no-doubles), the infield-fly rule; the cut-off man is a timing rule rather than a moving player. (Steals, wild pitches and passed balls: built 2026-09-30, see above.)
6. **A low line drive can only be fielded once it lands.** `intercept` walks the ground track and `catchChance` looks only at the landing point, so a liner that passes an infielder at chest height goes through untouched (about one in 30 games passed within a metre of a man who had time to react). Measured while checking Joe's "balls roll past the fielder" report: in 30 games, 60 balls passed within the drawn dot's radius (1.8 m) of a man who did not field them; 52 were the pitcher and 48 passed before that man's reaction time was up, which is a comebacker, not a defect. The screen now shows the late lunge.

## Known gaps, to fix with mechanisms rather than knob-turning

1. **Contact is too clean; partly addressed in bb_engine v0.8.** Closed: a timing error now moves the strike up or down the bat face as well as turning it, through the angle between the bat's path and the pitch's (see "The contact model" above). Still open, at seeds 3 and 11: squared-up per contact .75–.77 vs .34, and per ball in play .82–.83 vs .66; fouls squared up about 60% of the time where the league's almost never were; ground balls 93–94 mph vs 86 while fly balls matched; exit velocity 93–94 vs 89.7 with spread 10 vs 14 mph; fouls 14% of pitches vs 18%. The trade-off map showed that widening the spread of contact offsets cannot close this alone. The next candidates are the READ layer's whiff budget (fooled swings made about 90% of the whiffs, with breaking balls whiffed too rarely and fastballs too often; gap 2), the collision's loss of speed on topped balls, and whatever makes the league's fouls glancing contact.
2. **Whiff rate by pitch type.** Curveballs were whiffed on 7% of swings against 31%, and fastballs 33% against 21%. The dependence of detection on separation is too steep, and batters who hedge are too late on fastballs.
3. **Batters are too passive.** Chase rate was 22% against 28.5%, and walks 11–12% against 8.2%.
4. **Home runs.** They ran 2.0% of plate appearances against 3.0%, and 11% of fly balls against 17%. See the drag proxy above; exit velocity is also too uniform.
5. **Spray is too centred.** Centre field took 42% against 34%, opposite field 20% against 26%.
6. **Hit-by-pitch** ran 0.4% against 1.1%.
7. **Glancing contact makes implausible spin.** It came to light in the mock-up's seed survey. Pop-ups came off at 9,000–10,000 rpm, where real ones run a few thousand. Some 13–17° line drives off breaking balls came off with topspin. The collision's full-rolling friction needs checking against Nathan's measured batted-ball spin.
8. **Not built yet:** fielding, base running and every hit or out on balls in play; foul pop-ups caught; the game loop; managers and bullpens; fatigue recovery between innings; warm-up pitches; NL/AL rules; names.
