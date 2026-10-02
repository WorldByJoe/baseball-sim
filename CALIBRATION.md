# Calibration log

`CALIBRATION.md · v0.8 · 2026-10-02`

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

### The bat, the swing's arc and the second look (bb_engine v0.8; 2026-10-01)

Three mechanisms, built one at a time with the whole suite after each: `run_games` 200 games at seeds 3, 11, 29; `power_chain` v0.3, 500 hitters × 40 PA at seeds 3 and 11; `shape_check` 20 games; all under jsc. Before = v0.7 (`main`). The agent's contact-model branch (PR #1) is superseded by the second mechanism, which contains its `timingLift` as the first-order term, and by `power_chain` v0.3, which carries its measurements.

**1. The bat is a tapered wood beam, not two constants.** A 34 in professional profile (`BAT_SHAPE`, diameter at inches from the end) replaced `BAT_EFF`, `E_COR`, `Q_SWEET`, the barrel radius and the two fitted fall-off lengths in `qOf`. From the shape alone: the balance point (10.6 in from the end; real bats 11), the radius of gyration (8.4 in; 9 from bat MOI data), the rigid effective mass at the sweet spot (0.77 of the bat; 0.72 was assumed), and the free-free bending modes by a Jacobi eigen-solve on a half-inch grid - 151, 507 and 994 Hz with the first node 6.8 in from the end (wood bats ring near 170 and 550 Hz with the node at 6.5-7 in). A ball at x feels the rigid recoil about the balance point plus every mode slow enough to take energy during the 1 ms contact (a half-sine pulse factor by mode frequency: 0.96, 0.61, 0.11). The ball's own COR falls with approach speed (0.546 at 60 mph, the MLB specification, to 0.51 at 140 mph). The sweet spot EMERGED at 6-7 in from the end with q = 0.233 at game speed (Statcast's own 1.23 / 0.23); the barrel end dropped to 62% of the best exit speed and 12 in from the end to 71%, where v0.7 had kept 93% at 2 in from the end. The barrel's taper now sets the radius a ball meets, so a jam shot is more glancing and a vertical miss at the handle is a whiff. `headless/bat_check.js` prints all of it. Constants to hold against Nathan 2000 (the flexible-bat curve) and Cross 1998: the shape, `BAT_TAU` = 1 ms, `WOOD_C` = 4300 m/s; the end of the bat may be a little too dead here (Nathan's figure, from memory, keeps about 85% at 1 in; this keeps 72%).

**2. The swing is an arc, so timing moves the strike up and down the ball.** An early bat meets the ball out in front by s = v_bat·e·v_pitch/(v_bat + v_pitch), where the ball has yet to descend and the barrel, on its rising and curving path, is higher: D gains s·(tan descent − tan attack) − SWING_CURV·s²/2, with `SWING_CURV` = 0.5/m (a 0.9 m swing circle tilted 30°). To first order a swing on the pitch's plane is forgiving (the agent's `timingLift`); the curve of the arc tops the ball either way, about 1 in for 15 ms. This is geometry with one labelled constant; the random draws keep v0.7's order.

**3. The second look.** Recognition stayed a yes/no event at the commit point, but the swing then flies for `STEER_S` = 150 ms more before the last look that can still change the barrel's path (the hitting literature's "last 150 ms"). A batter fooled at commit gets a second chance to read the pitch there, against the separation visible by then; one who reads it late redirects toward the real pitch but the barrel can move no more than `STEER_IN` = 3 in after launch; one still fooled extrapolates from the last look, so only the gap that develops after it (1 − ts², about 0.59) is left, and his redirect is bounded the same way. Cutoffs of 110 and 130 ms were tried first: whiffs fell to .17-.19 per swing and league K% to 16-20%, so the longer, more commonly quoted delay was kept.

| power_chain, seeds 3 / 11 | v0.7 | + bat | + arc | + second look (kept) | 2025 / MLB |
|---|---|---|---|---|---|
| squared-up per contact, own q | .782 / .758 | .731 / – | .720 / .698 | .735 / .721 | .435 (floor .392)* |
| squared-up per contact, Statcast proxy | .744 / .716 | .748 / – | .738 / .716 | .752 / .737 | .435 (floor .392)* |
| squared-up per ball in play | .836 / .830 | .833 / – | .833 / – | .837 / .834 | .627* |
| squared-up per foul | .620 / .575 | .635 / – | .608 / .572 | .631 / .603 | .225 (floor .184)* |
| whiff per swing | .243 / .252 | .248 / – | .264 / .274 | .198 / .199 | .238 |
| K% | .215 / .255 | .215 / – | .225 / .269 | .172 / .216 | .204 |
| exit velo avg | 93.9 / 93.3 | 93.3 / – | 93.2 / 92.7 | 93.6 / 93.2 | 89.7 |
| EV50 | 100.8 / 100.3 | 100.9 / – | – | 101.1 / 100.7 | 100.6 |
| hard-hit share | .532 / .504 | .528 / – | .527 / .500 | .539 / .520 | .42 |
| foul per pitch | .135 / .141 | .132 / – | .128 / .134 | .131 / .139 | .179 |
| fair LA mean / sd | 11.6 / 27.4 | 11.7 / 27.8 | 10.3 / 28.3 | 10.5 / 28.1 | 12.5 / ~26 |
| fair EV sd | 10.0 | 10.8 | 10.8 | 10.5 | ~14 |
| fair EV GB / LD / FB / PU | 94.4 / 97.5 / 93.8 / 82.6 | 93.6 / 96.9 / 93.1 / 83.4 | 93.5 / 97.2 / 93.2 / 83.6 | 93.7 / 97.5 / 93.4 / 84.2 | 86 / 93 / 93 / – |
| pop-up spin, median rpm | 7570 | 7470 | 7440 | 7350 | a few thousand |
| whiff by kind FB / BR / OS | – | – | – | .19 / .17 / .27, .20 / .19 / .25 | .20 / .33 / .32 |
| whiff by read: read / late / fooled | – | – | – | .06 / .42 / .31 (52 / 19 / 29% of swings) | – |
| contact 3-6 in toward the end: share / sq-up / EV | .13 / .72 / 90.9 | .13 / .48 / 81.9 | .13 / .47 / 81.5 | .12 / .48 / 81.6 | – |
| contact 3-6 in toward the hands: share / sq-up / EV | .12 / .43 / 82.9 | .13 / .53 / 83.9 | .12 / .53 / 84.2 | .12 / .50 / 83.3 | – |

\* Revised 2026-10-02 from pitch-level Statcast (42 days of 2025; "What a foul is" in STATCAST_TARGETS_2025.md). The table first carried .337 per contact (the bat-tracking leaderboard), ~.66 per ball in play (a FanGraphs piece) and ~.05 per foul implied by the two. Squared up is Statcast's rule applied to every tracked contact; the floor counts untracked contact (foul tips, 18% of fouls) as not squared. The leaderboard's .337 was not reproduced pitch by pitch and is defined differently.

| league line, seeds 3 / 11 / 29 | v0.7 | + bat | + arc | + second look (kept) | MLB |
|---|---|---|---|---|---|
| runs | 3.43 / 3.76 / 3.68 | 3.85 / 4.03 / 4.09 | 3.72 / 3.62 / 3.62 | 4.66 / 4.47 / 4.34 | 4.39 |
| hits | 7.58 / 8.04 / 7.96 | 8.46 / 8.43 / 8.57 | 8.31 / 8.00 / 8.07 | 9.43 / 9.32 / 9.03 | 8.15 |
| home runs | 0.67 / 0.77 / 0.76 | 0.81 / 0.78 / 0.80 | 0.69 / 0.76 / 0.68 | 0.90 / 0.84 / 0.77 | 1.12 |
| strikeouts | 10.28 / 10.20 / 10.15 | 9.99 / 10.03 / 9.98 | 10.28 / 10.48 / 10.22 | 8.79 / 8.53 / 8.51 | 8.40 |
| walks | 3.90 / 3.75 / 3.80 | 3.60 / 3.84 / 3.79 | 3.65 / 3.59 / 3.47 | 3.84 / 3.87 / 4.11 | 3.10 |
| AVG / OBP / SLG, seed 3 | .220 / .301 / .364 | .242 / .314 / .411 | .238 / .312 / .396 | .266 / .339 / .449 | .243 / .312 / .399 |
| BABIP | .294 / .305 / .305 | .316 / .318 / .324 | .318 / .306 / .312 | .330 / .324 / .316 | .291 |
| K% | 26.8 / 26.4 / 26.4 | 25.8 / 25.8 / 25.8 | 26.6 / 27.2 / 26.8 | 22.2 / 21.5 / 21.5 | 22.6 |
| BB% | 10.1 / 9.7 / 9.9 | 9.3 / 9.9 / 9.8 | 9.4 / 9.3 / 9.1 | 9.7 / 9.8 / 10.4 | 8.2 |
| HR% | 1.7 / 2.0 / 2.0 | 2.1 / 2.0 / 2.1 | 1.8 / 2.0 / 1.8 | 2.3 / 2.1 / 1.9 | 3.0 |
| GB / LD / FB / PU %, seed 3 | 49 / 18 / 20 / 13 | 49 / 17 / 20 / 14 | – | 52 / 17 / 18 / 14 | 43 / 24 / 24 / 9 |
| BABIP by type GB / LD / FB, seed 3 | .281 / .803 / .202 (+ bat) | | | .305 / .803 / .196 | .24 / .68 / .12 |

What the three steps showed, in these runs:

1. **The bat did what the physics said and no more.** Contact off the end got weak (3-6 in toward the end: 91 → 82 mph, squared-up .72 → .48), contact near the balance point got a little stronger, and the sweet-spot maximum rose 3.5 mph with q .21 → .233. Squared-up per contact moved .78 → .73 because 73% of contact lands within 3 in of the sweet spot, where the bat is as good as before or better. The league gained 0.4 runs, 0.14 home runs and 22 points of average from the higher maximum.
2. **The arc was small and cost whiffs.** The big timing errors of fooled swings, which v0.7 had turned into solid pulled and sliced fouls, now went over the ball: whiffs +.02, fouls −.005, launch angle mean 11.6 → 10.3°. It is kept as geometry the engine had left out, but it did not make fouls glancing: the fouls it removed were the solid ones, and the swings became whiffs rather than mishits, because the vertical offset distribution is narrow and a timing error of 15 ms tops the ball by only an inch.
3. **The second look freed the whiff budget and showed where the contact problem really is.** Whiffs fell .26 → .20 per swing and league K% 26.7 → 21.7 (MLB 22.6), home runs rose to 0.84, and the fastball whiff rate came to .19-.20 (MLB .20). But the swings that stopped whiffing became clean contact, not mishits: squared-up per contact .72 → .73, per ball in play .83, hits 9.3 per game against 8.15, BABIP .32 against .29, average .262 against .243. Fouls were unchanged at .13 per pitch and 60% squared up. Breaking balls were still whiffed on only .17-.19 of swings against .33: a slider's gap from a fastball ghost is large and visible by the commit point, so it is read and hit, where the league swings over it.

What this leaves as the contact problem, now with the whiff budget out of the way: (a) **what a foul is.** The model's fouls are 43% of contact and 60% squared up, mostly timing fouls on solid contact. This was written when the league's fouls were thought to be almost never squared up; the measurement below says otherwise. (b) **Fair contact quality.** Squared-up per ball in play .83 against about .66, exit velocity 93 against 89.7, spread 10.5 against 14, ground balls at 94 mph against 86. With the collision now physical along the barrel, the remaining lever is the distribution of vertical offsets, which is motor (barrelSD 0.62 in) plus perception; the trade-off map above says a wider vertical spread buys mishits only with whiffs, so the perception part must be the kind that makes glancing contact rather than misses - a systematic height error that depends on pitch height and type (hitters under high fastballs, over low breaking balls), not a wider random one. (c) **BABIP by type** is a fielding-layer matter: ground balls fell in at .305 against .24 and fly balls at .196 against .12 at seed 3.

**The league's fouls, measured (2026-10-02).** Every pitch of 552 games of 2025 (2025-05-05..05-18, 06-30..07-13, 09-08..09-21; 165,166 pitches, 78,837 swings; `statcast/fetch_pitches.py`, `statcast/fouls.py`, tables in STATCAST_TARGETS_2025.md) replaced the inference above:

| league, 42 days of 2025 | value | n |
|---|---|---|
| fouls / contact | .521 | 60,571 contacts |
| whiff / swing | .232 | 78,837 swings |
| squared up per contact (floor) | .435 (.392) | 52,843 tracked |
| squared up per ball in play | .627 | 27,565 |
| squared up per foul (floor) | .225 (.184) | 25,278 tracked |
| foul exit speed, mean / sd / median | 76.7 / 13.1 / 76.6 mph | 25,798 |
| fouls under 80 mph / at 90+ | .640 / .138 | 25,798 |
| ball-in-play exit speed, mean / sd / median | 88.9 / 15.2 / 92.0 mph | 28,914 |
| foul / contact by contact depth: 10-20 in / 30-40 in / >50 in | .706 / .425 / .780 | 8,529 / 18,727 / 785 |

1. **Fouls were half of contact, as assumed, but a fifth of them were squared up, not almost none.** They were weaker than balls in play (median 77 against 92 mph), but not mostly glancing.
2. **The gap is not mostly fouls.** The league's fouls gave .521 × .225 = .12 squared-up per contact against the model's about .27; its balls in play gave .479 × .627 = .30 against the model's .48. Fair contact (about .18) carried at least as much of the gap as fouls (about .15), so (a) and (b) are one problem of equal halves, and the mechanism that makes contact less clean has to act on fair balls as much as on fouls.
3. **The target per contact is .39-.44, not .34.** The model's .735-.752 is .30 above it, not .40.
4. **Contact depth decided fouls.** Contact met late (10-20 in in front of the batter) or far out front went foul most often, and squared up least far out front. A timing error that turns into a foul is real; the model's problem is that its timing fouls are solid.

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

1. **Contact is too clean, on fouls and fair balls about equally.** Partly addressed in bb_engine v0.8 (the bat as a beam, the swing's arc, the second look; see "The bat, the swing's arc and the second look" above): whiffs and K% now sit at the league's figures, but squared-up per contact runs .72-.74 against .435 (floor .39), per ball in play .83 against .627, per foul about .62 against .225, exit velocity 93 against 89.7 with spread 10.5 against 14, fouls .13 per pitch against .18. The foul composition is now measured ("The league's fouls, measured" above): fouls and fair balls each carry about half of the excess. Next: a height-and-type-dependent perception error rather than a wider random one, judged on fouls and balls in play together.
2. **Whiff rate by pitch type.** With v0.8's second look, fastballs were whiffed on .19-.20 of swings (MLB .20) and off-speed .25-.27 (.32), but breaking balls only .17-.19 (.33): a slider's gap from the fastball ghost is large and visible by the commit point, so it is read and hit where the league swings over it. The detection function's dependence on separation, and the swing decision on breaking balls below the zone, are the places to look.
3. **Batters are too passive.** Chase rate was 22% against 28.5%, and walks 11–12% against 8.2%.
4. **Home runs.** They ran 2.0% of plate appearances against 3.0%, and 11% of fly balls against 17%. See the drag proxy above; exit velocity is also too uniform.
5. **Spray is too centred.** Centre field took 42% against 34%, opposite field 20% against 26%.
6. **Hit-by-pitch** ran 0.4% against 1.1%.
7. **Glancing contact makes implausible spin.** Pop-ups came off at a median 7,400 rpm in v0.8's measurement (`power_chain` v0.3), where real ones run a few thousand; the bat model did not touch the tangential (friction) part of the collision, which is still full rolling under a Coulomb cap of 0.5. Check it against Nathan's measured batted-ball spin, including the ball's tangential compliance.
8. **Not built yet:** fielding, base running and every hit or out on balls in play; foul pop-ups caught; the game loop; managers and bullpens; fatigue recovery between innings; warm-up pitches; NL/AL rules; names.
