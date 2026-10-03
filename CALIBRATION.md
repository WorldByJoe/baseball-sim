# Calibration log

`CALIBRATION.md · v2.7 · 2026-10-03`

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
- **Pitch variety (v1.0):** each type's spread of induced break between pitchers and pitch to pitch matched the league's (`statcast/pitch_spread.py`) to 0.1 in in `tools/fit_pitch_spread.js`; 300 drawn pitchers throwing at-bats came within 0.4 in of the league's total spread for six types; the cutter and splitter, about 25 pitchers each in that run, were off by 0.6-1.0 in.

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

### The swing as a tilted circle (bb_engine v0.9; 2026-10-02)

The contact step after the foul measurement. One week of pitch-level 2025 (2025-07-01..07-07, 27,876 pitches, 9,972 contacts with bat tracking; `statcast/swing_geometry.py`, tables in STATCAST_TARGETS_2025.md "Swing geometry") gave the shape of a real swing at contact. A new diagnostic, `headless/contact_check.js`, measured the model in the same tables as the league. Runs: `contact_check` 400 hitters × 40 PA and `power_chain` v0.4 500 × 40 at seeds 3 and 11; `run_games` 200 games at seeds 3, 11 and 29; `shape_check` 20 games; all under jsc.

**What the league showed.** Contact depth (how far in front of the batter the ball was met) averaged 29.1 in, sd 9.7; 9.0 of that within a batter and 3.5 between batters. Met further out front, the bat's direction turned 1.46 deg per inch (r .83), its attack angle rose 0.80 deg per inch (r .75), and the ball was pulled 1.59 deg per inch (r .40). Full swings were slower when met deep: 69.0 mph at 10-20 in, 71.8 at 25-30, 73.2 at 35-40. The swing's tilt (Statcast's swing_path_tilt) was 32.2 deg, steeper for low pitches, 9.4 deg per zone height (38.5 below the zone, 20.7 above it), and batters differed by 3.8. Contact struck square vertically (launch angle within 15 deg of 10 above the attack angle) was still squared up only .695 of the time, and less on pitches inside or away: .27 more than a foot inside, .44 more than a foot away. The vertical miss (launch angle minus attack angle) went steadily from +20 deg on contact met deep to -12 deg out front.

**What was built, each piece measured against the league:**

1. **The swing is a tilted circle.** The sweet spot travels on an arc of radius `SWING_R` = 0.87 m in a plane tilted by the batter's swing tilt (new trait `swingTilt`, 32.3 ± 3.8 deg, the 2025 leaderboard; steeper for low pitches by `TILT_PER_H` = 9.4 deg per zone height). Where on the arc the ball is met sets the bat's horizontal direction (cos tilt of the angle round the arc) and its attack angle (sin tilt of it). With the league's tilt, one radius gave the bat's turn and the attack angle's rise per inch of depth within 11% of the league's. A timing error moves contact round the arc; v0.8 had turned the whole bat by the bat's angular speed times the timing error, which over-stated spray by the ratio (bat + pitch speed) / pitch speed, about 1.8.
2. **Where he plans to meet the ball.** An inside pitch was planned a little out front (`LOC_DEPTH`, 1.89 in per foot) with the face turned further to pull (`LOC_FACE`, the rest of the league's 7.9 deg per foot); a pull hitter's usual contact point is out front (`pullBias`, now 10 ± 5 deg, which put the batters' usual depth sd at about 3.5 in, as the league's). The old `C_LOC` (0.9 rad/m) moved spray about twice as much as the league's location effect and was deleted.
3. **The barrel dips toward its end** by the swing tilt, so a ball struck under its centre goes up and slices toward the tip side, and one struck over it goes down and hooks to the pull side.
4. **The bat is slower met deep**: speed short of a peak 9 in out front of his usual point, as the path short of it over his swing length, to the power 0.2 (`BAT_PEAK_M`, `BAT_GAIN_EXP`), from the league's bat speed by depth; two-strike swings 0.974 of full (league 70.7 against 72.6 mph). His `batSpeed` trait is the leaderboard average over his contact, 1.5% below the peak.
5. **The hands cover only part of a pitch in or out** (`HAND_MISS` = 0.3 of the distance moves the contact along the barrel) and he aims the sweet spot 1 in inside the ball (`AIM_HANDS`); a ball centred up to 1 in past the end still catches the rounded cap (`BAT_CAP_IN`).
6. **A bat-face scatter** (new trait `faceSD`, 8 ± 4 deg): the face's own horizontal scatter, apart from timing.
7. **Refitted traits**, each to its own measurement: `timingSD` 7 → 13.5 ms (contact depth within a batter, sd 8.7 in the model against 9.0; pitchers batting scaled with it), `longSD` 2.6 → 3.8 in (squared-up on contact struck square vertically, .72-.74 against .695), `undercut` 0.45 → 0.55 in (the vertical miss's mean, +6 against +10).

| power_chain, seeds 3 / 11 | v0.8 | v0.9 | league |
|---|---|---|---|
| squared up per contact, Statcast proxy | .752 / .737 | .564 / .557 | .435 (floor .392) |
| squared up per ball in play | .837 / .834 | .677 / .679 | .627 |
| squared up per foul | .631 / .603 | .401 / .389 | .225 (floor .184) |
| whiff per swing | .198 / .199 | .258 / .275 | .232 (pitch level) |
| K% | .172 / .216 | .211 / .265 | .204 |
| exit velocity, mean | 93.6 / 93.2 | 87.5 / 87.4 | 88.9 (pitch level), 89.7 (leaderboard) |
| EV50 | 101.1 / 100.7 | 98.0 / 97.9 | 100.6 |
| hard-hit share | .539 / .520 | .369 / .367 | .421 |
| fair EV sd | 10.5 | 14.3 / 14.2 | 15.2 |
| fair launch angle mean / sd | 10.5 / 28.1 | 15.0 / 26.0, 14.6 / 26.4 | 13.1 / 28.7 |
| fair EV GB / LD / FB / PU | 93.7 / 97.5 / 93.4 / 84.2 | 88.6 / 90.2 / 86.5 / 77.1 | 86 / 93 / 93 / - |
| whiff by kind FB / BR / OS | .19 / .17 / .27 | .29 / .22 / .27, .32 / .23 / .28 | .172 / .308 / .299 |
| pop-up spin, median rpm | 7350 | 6859 / 6741 | a few thousand |

| contact_check, seeds 3 / 11 | v0.8 | v0.9 | league |
|---|---|---|---|
| fouls / contact | .425 | .410 / .422 | .521 |
| foul exit velocity, median | 90.4 | 76.5-77.8 | 76.6 |
| contact depth sd, within a batter | 5.0 | 8.7 / 8.7 | 9.0 |
| attack angle at contact, sd | 6.9 | 9.7 / 9.5 | 10.4 |
| vertical miss, mean / sd | +3.5 / 27.2 | +6.2 / 27.9, +5.8 / 28.7 | +10.0 / 34.7 |
| fair-ball spray, mean / sd (+ = pulled) | - | +7.7 / 20.0, +8.0 / 20.2 | +6.1 / 24.9 |

| league line, seeds 3 / 11 / 29 | v0.8 | v0.9 | MLB |
|---|---|---|---|
| runs | 4.66 / 4.47 / 4.34 | 4.07 / 4.11 / 3.98 | 4.39 |
| hits | 9.43 / 9.32 / 9.03 | 8.63 / 8.79 / 8.68 | 8.15 |
| doubles | 2.18 / 2.36 / 2.17 | 2.01 / 2.10 / 2.04 | 1.60 |
| home runs | 0.90 / 0.84 / 0.77 | 0.67 / 0.62 / 0.63 | 1.12 |
| strikeouts | 8.79 / 8.53 / 8.51 | 10.01 / 10.21 / 9.99 | 8.40 |
| walks | 3.84 / 3.87 / 4.11 | 4.23 / 4.28 / 4.13 | 3.10 |
| AVG / OBP / SLG, seed 3 | .266 / .339 / .449 | .247 / .330 / .400 | .243 / .312 / .399 |
| BABIP | .330 / .324 / .316 | .327 / .331 / .330 | .291 |
| K% | 22.2 / 21.5 / 21.5 | 25.4 / 25.6 / 25.4 | 22.6 |
| HR% | 2.3 / 2.1 / 1.9 | 1.7 / 1.6 / 1.6 | 3.0 |
| GB / LD / FB / PU %, seed 3 | 52 / 17 / 18 / 14 | 42 / 21 / 25 / 12 | 43 / 24 / 24 / 9 |
| BABIP GB / LD / FB / PU, seed 3 | .305 / .803 / .196 / .009 | .257 / .738 / .247 / .010 | .24 / .68 / .12 / .02 |

What the step did, in these runs:

1. **Balls in play came to the league's quality.** Squared up per ball in play fell .84 → .68 (league .63), the exit-velocity spread widened 10.5 → 14.3 (15.2), fouls came off at the league's median speed (77), and the batted-ball mix went from 52/17/18/14 to 42/21/25/12 against 43/24/24/9. Batting average and slugging came to the league's (.247 / .400 against .243 / .399).
2. **The best contact got too soft.** EV50 fell to 98.0 (100.6), the hard-hit share to .37 (.42), fly balls to 86.5 mph against 93, and home runs to 1.6% of plate appearances (3.0).
3. **Whiffs rose** .20 → .26-.28 and league K% 21.7 → 25.5. Fastballs were whiffed .29-.32 against .17 and breaking balls .22-.23 against .31, and the high zone carried most of it (whiff .29 / .41 in the upper zone and high edge against .14 / .27). Swings on pitches read late or fooled whiffed .47 and .38-.45, as in v0.8; read swings .12-.13 (v0.8 .06), mostly from the wider timing and along-barrel scatter.
4. **Fouls became half right.** They now came off at the league's speed but were still squared up .39-.40 against .225, and were .41-.42 of contact against .52.

**Tried and rejected:**

- **The arc's own curve in the vertical offset** (v0.8's SWING_CURV term). It made contact met either deep or out front topped. The league's vertical miss instead went steadily from under the ball (deep) to over it (out front), which the attack-against-descent term alone gives. Deleted.
- **A bat path at an angle to its face** (the bat travelling at an angle to where the ball goes). Exit speed on square contact barely depended on that angle (EV/max .866 / .871 / .860 / .823 for 0-10 / 10-20 / 20-30 / 30-45 deg). Not built.
- **A wider late correction** (`STEER_IN` 3 → 4 and 5 in). Whiffs on late reads moved .48 → .41-.39 and overall whiffs barely moved. Left at 3.
- **A face scatter of 14-22 deg.** It brought fouls to half of contact, but made them solid (squared up .45-.50) and flattened the spray's dependence on depth (the turned faces went foul and dropped out of the fair balls). Kept at 8 deg, the value that left the fair-ball spray by depth near the league's.
- **Partial grip in the collision's friction** (a share of the rolling impulse). At 0.6 it brought mean exit velocity to 88.9, the hard-hit share to .41, pop-up speed to 81 and pop-up spin to 3,500 rpm, but BABIP to .37, K% to 28.0 and fly-ball backspin to 800 rpm. A lower friction coefficient (0.25, 0.15) barely moved anything until it was very low. Neither kept.

**What this leaves, and where it points.** The physical shape of contact now follows the league's swing geometry. What remains points at perception, the next step's subject (`docs/briefs/2026-10-02_perception_error.md`). The league's vertical miss went from +20 deg on contact met deep to -12 out front; the model's from +4 to +1. A batter who misjudges a pitch's speed is late and under it, or early and over it, at once. That error would put the missing tails into the vertical miss (league sd 34.7, model 28), make fouls weak and frequent, and is where the fastball and high-zone whiffs live.

### Perception: the predicted drop (bb_engine v1.0; 2026-10-02)

The step after the swing geometry, from `docs/briefs/2026-10-02_perception_error.md`. The league's height and approach tables were made reproducible as tables 9-11 of `statcast/fouls.py` v0.3 (42 days of pitch-level 2025, 78,224 swings without bunts), and the spread of pitch shapes by the new `statcast/pitch_spread.py` (163,863 pitches). Runs: `contact_check` v0.2, 400 hitters × 40 PA against 120 pitchers, at seeds 3, 11 and 29; `power_chain` 500 × 40 at seeds 3 and 11; `run_games` 200 games at seeds 3, 11 and 29; `shape_check` 10 games (882 plays, 0 bad); `physics_check` (average pitch movement unchanged, to 0.1 in of Savant's). All under jsc.

**What the league showed.** The brief's tables reproduced. At the low edge, balls in play off breaking balls came off at 8.0° against 2.0° for fastballs, and their fouls were topped (-5.5° against +4.4°). Four-seamers in the upper zone and high edge that arrived flattest for their height were whiffed .285 of the time against .142 for the steepest, and squared up .340 against .452. Formed within bands of release height and extension, the same fifths kept all of that difference (shares 1.14-1.25), so the effect was not the release point. Table 9's launch angles and exit speeds ran 0.3-0.9° and up to 3.6 mph above the brief's, which had kept bunted balls in play. And the league's pitches of one type differed far more than the model's: between pitchers, the spread of induced vertical break was 2.4 in for four-seamers (model 1.4) and 3.3 for sliders (0.9); pitch to pitch within a game, 1.4-2.7 in (model 0.5-1.3). Speed varied 0.9-1.2 mph within a game (model 0.6).

**What the v0.9 model already showed.** Launch angle already rose with height (balls in play 21-22° from the low edge to the high edge, league 18.7; fouls 27-28°, league 42.6), and the foul share was already lowest in the lower zone, so table A's shape was swing geometry. Table B was inverted: low fastballs launched at 19-21° and low breaking balls at 2.6-3.7°. Table C was nearly absent: from the steepest to the flattest fifth, whiffs went .31-.33 to .36-.39 and squared up .47-.50 to .44-.46.

**What was built:**

1. **The prior's pull.** Even a pitch he has recognised is judged partly from what he was ready for, by a share pull = 1 / (1 + (prior spread / eye)²), where his eye is eyeSD scaled by time pressure and by how used to this pitcher he is. It works differently for when and for where. Timing stays pulled toward the pitch he expected (`PRIOR_T` = 5, fitted to breaking balls being met 8 in further out front than fastballs). Place is pulled toward what that kind of pitch usually does: the league's shape for the type, turned toward this pitcher's own as he gets used to him, at this pitcher's speed. Its spread is the league's spread of the type's vertical break times `PRIOR_S` = 2.5, fitted to table C and the fastball whiffs. A share `RESID_S` = 0.07 of the gap to the pitch he expected also stays in his picture, so a recognised breaking ball is still met a little over; fitted to the breaking-ball whiffs and table B. For an average eye, the place pull was about 0.32 on a 94-mph four-seamer and 0.16 on a slider.
2. **The ghost is the guessed pitch, pictured the same way.** The pitch he expected is flown as that kind usually flies, turned toward this pitcher's own by familiarity, at the pitcher's own speed for it, with its arrival hedged toward the speed he expected.
3. **The pitch type he expected cannot fool him.** Until v1.0 a right guess drew the yes/no recognition event like any other pitch and was mostly judged fooled, which kept about 60% of the pitch's difference from its usual shape whatever his eye. Fastballs he expected were whiffed .168-.184 after the change (league fastballs .172); fastballs he had guessed were something else, .28-.31.
4. **Pitches vary as the league's do.** Spin-rate spreads between pitchers came straight from the league (four-seamer 141 rpm, curveball 276, splitter 331), as did each type's pitch-to-pitch spread of speed and spin within a game. The rest of the movement spread came from a new **seam force**: extra break the spin does not explain (seam-shifted wakes), drawn per pitcher around zero and again per pitch, growing with speed squared like lift. Its spreads (`seamSD`, `seamW` in `PITCH_TYPES`) were fitted by `tools/fit_pitch_spread.js` so that each type's spread of induced break, between pitchers and pitch to pitch, matched the league's to 0.1 in. Because it averages zero, the average pitch and `physics_check` did not move.
5. **Command stayed the whole location scatter.** The seams' pitch-to-pitch scatter was taken out of the release scatter rather than added to it, so the `command` trait still means what it says.

| power_chain, seeds 3 / 11 | v0.9 | v1.0 | league |
|---|---|---|---|
| squared up per contact, Statcast proxy | .564 / .557 | .529 / .542 | .435 (floor .392) |
| squared up per ball in play | .677 / .679 | .675 / .678 | .627 |
| squared up per foul | .401 / .389 | .394 / .409 | .225 (floor .184) |
| whiff per swing | .258 / .275 | .276 / .263 | .232 (pitch level) |
| whiff by kind FB / BR / OS | .29 / .22 / .27, .32 / .23 / .28 | .24 / .31 / .35, .22 / .31 / .33 | .172 / .308 / .299 |
| K% | .211 / .265 | .279 / .290 | .204 |
| BB% | .129 / .103 | .141 / .125 | .089 |
| exit velocity, mean | 87.5 / 87.4 | 87.6 / 87.8 | 88.9 (pitch level) |
| EV50 | 98.0 / 97.9 | 98.1 / 98.3 | 100.6 |
| fouls per pitch | .122 / .124 | .149 / .143 | .179 |
| pop-up spin, median rpm | 6859 / 6741 | 6807 / 6705 | a few thousand |

| contact_check, range over seeds 3, 11, 29 | v0.9 | v1.0 | league |
|---|---|---|---|
| whiff per swing | .272-.276 | .247-.272 | .232 |
| whiff, fastball / breaking / off-speed | .300-.307 / .213-.218 / .284-.299 | .223-.239 / .261-.306 / .298-.323 | .172 / .308 / .299 |
| fouls / contact | .423-.432 | .492-.503 | .521 |
| squared up per contact / ball in play / foul | .533-.536 / .649-.652 / .372-.385 | .500-.519 / .641-.657 / .361-.390 | .435 / .627 / .225 |
| ball-in-play exit velocity, mean / sd | 87.3-87.7 / 14.2-14.4 | 87.3-87.8 / 14.3-14.4 | 88.9 / 15.2 |
| exit velocity at launch angle -10..10 | 90.6-91.1 | 90.6-91.2 | 92.6 |
| contact depth, fastball / breaking / off-speed (in) | 29.0-29.4 / 30.1-30.3 / 30.1-30.2 | 27.9-28.2 / 35.2-35.8 / 33.3-33.9 | 27-28 / 35-36 / 34-35 |

Table A, v1.0 against the league (model ranges over the three seeds):

| height | whiff / swing | foul / contact | squared / contact | BIP launch angle | foul launch angle |
|---|---|---|---|---|---|
| below the zone (<-0.25) | .636-.689 (.766) | .645-.726 (.627) | .368-.382 (.286) | -3.8 to 11.0 (-0.1) | 4.9 to 8.0 (-9.2) |
| low edge (-0.25..0.15) | .267-.308 (.349) | .533-.571 (.498) | .482-.505 (.424) | 8.1 to 9.4 (5.4) | -2.3 to 2.5 (-3.3) |
| lower zone (0.15..0.5) | .215-.244 (.139) | .489-.515 (.464) | .516-.541 (.468) | 10.2 to 12.4 (11.1) | 1.6 to 6.0 (16.8) |
| upper zone (0.5..0.85) | .200-.209 (.138) | .434-.456 (.533) | .516-.534 (.415) | 14.4 to 15.7 (18.5) | 16.9 to 18.4 (34.2) |
| high edge (0.85..1.25) | .260-.279 (.268) | .457-.466 (.658) | .486-.509 (.408) | 17.9 to 22.1 (24.1) | 24.3 to 25.8 (39.3) |
| above the zone (>1.25) | .644-.711 (.499) | .687-.750 (.731) | .333-.417 (.549) | 8.7 to 18.1 (22.5) | 12.0 to 22.9 (38.1) |

Table C, four-seamers in the upper zone and high edge, steepest and flattest fifths (model ranges over the three seeds; league in brackets):

| | whiff / swing | foul / contact | squared / contact | BIP launch angle | foul launch angle |
|---|---|---|---|---|---|
| v0.9 steepest → flattest | .309-.334 → .358-.389 | .469-.489 → .511-.526 | .470-.496 → .443-.462 | 26.3-28.6 → 28.8-31.3 | 33.7-34.5 → 33.8-35.6 |
| v1.0 steepest → flattest | .183-.199 → .265-.291 | .400-.408 → .481-.498 | .551-.566 → .459-.480 | 7.8-10.6 → 23.0-26.1 | 8.4-12.0 → 31.1-31.6 |
| league | .142 → .285 | .555 → .688 | .452 → .340 | 20.7 → 27.4 | 38.4 → 41.6 |

| league line, seeds 3 / 11 / 29 | v0.9 | v1.0 | MLB |
|---|---|---|---|
| runs | 4.07 / 4.11 / 3.98 | 3.87 / 3.88 / 3.86 | 4.39 |
| hits | 8.63 / 8.79 / 8.68 | 7.99 / 7.78 / 7.98 | 8.15 |
| home runs | 0.67 / 0.62 / 0.63 | 0.63 / 0.58 / 0.59 | 1.12 |
| strikeouts | 10.01 / 10.21 / 9.99 | 11.74 / 11.73 / 11.72 | 8.40 |
| walks | 4.23 / 4.28 / 4.13 | 5.25 / 5.00 / 5.20 | 3.10 |
| AVG / OBP / SLG, seed 3 | .247 / .330 / .400 | .229 / .331 / .368 | .243 / .312 / .399 |
| BABIP | .327 / .331 / .330 | .325 / .326 / .329 | .291 |
| K% | 25.4 / 25.6 / 25.4 | 29.1 / 29.7 / 29.2 | 22.6 |
| BB% | 10.7 / 10.7 / 10.5 | 13.0 / 12.7 / 13.0 | 8.2 |
| HR% | 1.7 / 1.6 / 1.6 | 1.5 / 1.5 / 1.5 | 3.0 |
| GB / LD / FB / PU %, seed 3 | 42 / 21 / 25 / 12 | 44 / 20 / 25 / 11 | 43 / 24 / 24 / 9 |

What the step did, in these runs:

1. **Whiffs moved to the right pitches.** Fastballs were whiffed .22-.24 against .29-.32 in v0.9 (league .17), breaking balls .26-.31 against .21-.23 (.31). Breaking balls and off-speed pitches were met 7 and 5 in further out front than fastballs, as in the league; v0.9 met all kinds at 29-30 in.
2. **The flat-fastball effect appeared.** From the steepest to the flattest fifth, whiffs rose .07-.10 (46-68% of the league's .14, so just under half at seed 3), the foul share .07-.09 (55-68% of .13), and squared up fell .07-.11 (63-96% of .11). Its launch-angle effect was about twice the league's (+12 to +17° on balls in play against +6.7), with the steepest fastballs hit at 8-11° against 21.
3. **Fouls came to the league's share** of contact (.49-.50 against .52; v0.9 .42-.43), and table B's inversion mostly closed: low fastballs launched at 10.5-13.1° and low breaking balls at 6.5-8.2° (league 2.0 and 8.0; v0.9 19-21 and 3-4). Low breaking balls' fouls were topped, -2 to -7° (league -5.5).
4. **Contact quality did not move.** Squared up per contact stayed at .50-.52 (league .435) and per foul at .36-.39 (.225); EV50 stayed at 98 (100.6).
5. **Table A lost its U.** Launch angle still rose with height, but more gently than in v0.9: 8.5-14.0° on balls in play from the low edge to the high edge (league 18.7, half is 9.4) and 22-28° on fouls (42.6). The foul share was now lowest in the upper zone (.43-.46) instead of the lower zone, and the high edge went foul .46-.47 of the time against .66.
6. **Strikeouts and walks rose.** In games, K% went 25.5 → 29.3 and BB% 10.6 → 12.9 (MLB 22.6 and 8.2). Whiffs per swing barely moved. In a scratch run of 12,000 plate appearances, the cause was the length of the at-bat: with fouls at the league's share, fewer swings ended it with a ball in play, and plate appearances lasted 3.99 pitches against 3.74 in v0.9 (league 3.88). Batters still swung at .413 of pitches and chased .207 (league .480 and .284), and pitchers threw .470 of pitches in the zone (.507), as in v0.9 (.409, .206, .478). Longer at-bats against too-passive batters gave more walks and more called third strikes.

**Tried and rejected:**

- **One pull toward the expected pitch for both timing and place.** Whiffs ran .29-.61 across its settings. Breaking balls were met 8 in further out front but only a little over, so timing and place were split.
- **The ghost as a blend of the repertoire's spins.** Fastballs were judged surprises 43-57% of the time and whiffed .30 and more. Replaced by the guessed pitch, pictured.
- **The ghost flown at the hedged speed.** It dropped more than the pitch it pictured. It now flies at the pitcher's own speed and only its arrival is hedged.
- **The pitcher's exact shape as the batter's picture.** The flat-fastball effect vanished. Replaced by the league's shape turned toward his own by familiarity.
- **`PRIOR_S` = 1**, an ideal observer whose eye at the plate is his zone judgement at the commit point: with the league's pitch variety, whiffs ran .36 per swing. **`PRIOR_S` = 4 and 8** (sweeps of 300 hitters against 24 pitchers at seed 3): low fastballs launched 3-5° above low breaking balls, where at 2.5 they launched 1.5° below them, and the flat-fastball whiff rise shrank from .12 to .09-.10.
- **`RESID_S` = 0.10-0.25** (same sweeps): breaking-ball whiffs ran .44-.85. **`PRIOR_T` = 8** (with `PRIOR_S` 4, before the expected pitch stopped fooling him): low breaking balls launched below low fastballs (-0.1° against 5.2°).
- **Pitch variety from spin alone.** With the lift law's saturation, the four-seamer's spread of vertical break needed a spin-efficiency spread that hit its cap on 20% of pitches, and wide tilt spreads shrank the average break. The average pitch moved up to 1.4 in from the typical one (four-seamer vertical break 16.0 → 15.0 in), which would have given every batter a built-in bias. Replaced by the seam force.
- **The seam scatter on top of command.** Walks rose (power_chain BB% .149 at seed 3). Moved inside the command trait (.141).

**What this leaves, and where it points.** The read now sends whiffs to the right pitches and puts batters under flat fastballs. Three things stand out: plate discipline (zone rate and chase rate, now the main cause of the strikeout and walk excess), contact that is still too square (squared up per contact .50-.52), and the height pattern of fouls (too few fouls on high pitches, which the league fouls up and back).

### Plate discipline: measured, and a first attempt (2026-10-02; engine unchanged at v1.0)

`statcast/discipline.py` measured the league's plate discipline over the same 42 days (163,411 pitches), and `headless/discipline_check.js` measured the model's the same way (400 hitters × 40 PA against 120 pitchers, seed 3). Edge distance is inches from the edge of the rulebook zone, + outside.

| swing probability | 6+ in inside | 0-2 in outside | 6-9 in outside | 12+ in outside |
|---|---|---|---|---|
| first pitch: model / league | .78 / .54 | .27 / .26 | .05 / .09 | .00 / .04 |
| two strikes: model / league | .92 / .95 | .48 / .68 | .12 / .32 | .02 / .08 |
| breaking balls, all counts: model / league | .89 / .71 | .43 / .48 | .10 / .28 | .01 / .09 |

What the league showed: batters took nearly half of first-pitch strikes down the middle, swung most in hitters' counts (2-1: .60), and chased breaking balls far wider than fastballs (12+ in outside: .09 against .02). Pitchers put more pitches both down the middle and far outside than the model's do: 0-0 pitches 12+ in outside were .047 of pitches (model .010), and 6+ in inside .158 (.083). Within one pitcher, pitch type and batter side, hitters'-count fastballs scattered about 7 in across and 8 in up and down; the model's 6 and 5.

**Tried, and not kept:**

- **Swing or take as a bet on runs.** The thresholds were replaced by the measured run value of a ball, strike, foul and ball in play in each count, against a self-model of what his own swings produce by read and location (`tools/self_model.js`, on the branch `plate-discipline-ev-attempt`). Batters swung at .24 of pitches (league .48). The model's own balls in play were worth about 0.02 runs against the league's 0.05, and the margin between swinging and taking was a few hundredths of a run, so that gap flipped most decisions. With the league's experience in place of the model's, batters swung at .31; the one-pitch bet still took most pitches in hitters' counts (2-1: .20), where the league swings most. Real batters swing there as if contact on the pitch they sit on is worth more than the location averages say; in the model, swings on a recognised other pitch were whiffed and fouled about as often as swings on the expected one, so sitting buys almost nothing.
- **Deciding on what he could see at the commit point** (a pitch not yet picked up judged where the expected pitch would go). Chase moved .205 → .212; too few breaking balls go unrecognised at the commit point (about one in ten) for it to matter.

### The sitting payoff: the adjusted swing (bb_engine v1.1; 2026-10-02)

The payoff to sitting on a pitch, measured and then built. League figures are from `statcast/swing_geometry.py` v0.2 table 7 (42 days of pitch-level 2025); model figures from `contact_check` v0.2 (400 hitters × 40 PA against 120 pitchers, seeds 3, 11, 29), `power_chain` 500 × 40 at seeds 3 and 11, `run_games` 200 games at seeds 3, 11 and 29, `shape_check` 10 games (944 plays, 0 bad), all under jsc.

**What the league showed.** Met at the same depth, breaking and off-speed pitches were swung at about 2 mph slower than fastballs (25-30 in: 69.8 and 70.3 against 71.7 mph; 35-40 in: 72.1 and 72.5 against 74.3). Bat speed followed the count: fastballs 71.9 mph ahead, 70.2 even or behind, 68.9 with two strikes. The v1.0 model had neither: at the same depth it swung as fast at a breaking ball as at a fastball, and ahead in the count no harder than even.

**What was built.**

1. **The adjusted swing.** A batter plans his swing for the pitch he expects, arriving when he timed it. Whatever part of the gap between that plan and the real arrival he closes, by waiting on a slower pitch or hurrying for a faster one, he closes by altering the swing, and it costs bat speed: `ADJ_PER_MS` = 0.0014 of his speed per millisecond closed, fitted to the league's bat speed on breaking and off-speed pitches against fastballs met at the same depth. The pitch he sat on and got is met with his full swing.
2. **Effort by count** (`SWING_EFFORT`: ahead 1.017, two strikes 0.982 of even), fitted so bat speed by count follows the league's. It replaced the two-strike factor of 0.974, since part of the two-strike drop now comes from his wider hedge, which the adjusted swing pays for.
3. **His bat speed trait stays his average.** The trait is the leaderboard's average over a batter's swings, adjusted ones included, so the effort and adjustment factors are divided by their average over the league's swings (`SWING_NORM` = 0.978, measured from the model at seeds 3, 11 and 29). In v1.0 the two-strike factor alone had already put the average about 1% below the trait.

| model, seeds as noted | v1.0 | v1.1 | league |
|---|---|---|---|
| bat speed, fastball ahead / even / two strikes (contact_check, seed 3) | no count effect | 71.6 / 70.1 / 68.5 | 71.9 / 70.2 / 68.9 |
| bat speed, breaking ahead / even / two strikes (seed 3) | no count effect | 70.5 / 69.5 / 68.5 | 70.9 / 69.6 / 68.3 |
| bat speed at contact, mean (seeds 3, 11, 29) | 69.2-69.5 | 70.0-70.2 | 70.6 |
| ball-in-play exit velocity, mean / p90 (seeds 3, 11, 29) | 87.3-87.8 / 103.2-103.5 | 88.1-88.9 / 104.4-105.2 | 88.9 / 105.2 |
| EV50 (power_chain, seeds 3 / 11) | 98.1 / 98.3 | 98.9 / 99.2 | 100.6 |
| hard-hit share (seeds 3 / 11) | .373 / .378 | .388 / .398 | .421 |
| whiff per swing (contact_check) | .247-.272 | .261-.266 | .232 |
| squared up per contact (contact_check) | .500-.519 | .491-.518 | .435 |
| runs per team-game (run_games) | 3.86-3.88 | 4.13-4.18 | 4.39 |
| home runs per PA | 1.5% | 1.7-1.9% | 3.0% |
| AVG / SLG | .227-.230 / .363-.369 | .236-.241 / .382-.394 | .243 / .399 |
| BABIP | .325-.329 | .336-.339 | .291 |
| K% / BB% | 29.1-29.7 / 12.7-13.0 | 28.8-29.7 / 12.0-12.9 | 22.6 / 8.2 |

What the step did, in these runs: bat speed came to the league's by count and nearly by pitch kind, and with it exit velocity came to the league's mean, EV50 rose about 0.9 mph and runs about 0.27 a team-game. Most of the exit-velocity gain came from the normalisation, which made the bat-speed trait mean what it says. At the same depth the fastball-to-breaking-ball gap ran 1.7-2.7 mph from 25 in out front (league 1.9-2.2), but met deep it was smaller than the league's (0.6-1.2 against 2.1-3.2). BABIP rose further from the league's. Whiffs, squared-up contact, strikeouts and walks barely moved: the swing decision does not yet use the payoff.

**Tried and rejected:**

- **Lost barrel control on an adjusted swing** (its vertical and along-barrel scatter growing by 1.5% and 3% per millisecond closed). Breaking-ball whiffs rose .31 → .38 and .45, while squared-up contact on off-speed pitches met far out front fell only .51 → .46 (league .32). A wider scatter bought misses before mishits, as in v0.8.
- **The losses without the normalisation.** EV50 fell 98.1 → 97.1 at seed 3 and home runs 1.5% → 1.3%: every batter's average swing dropped below his trait.

### The run-value swing decision, retried on v1.1 (2026-10-02; not kept, branch `swing-decision`)

With the sitting payoff in place, the swing-or-take bet (measured count run values against the batter's self-model) was retried. `discipline_check`, 300-400 hitters × 40 PA against 120 pitchers, seed 3.

**The payoff showed up in the self-model.** A ball in play off the pitch he sat on was worth about 0.05-0.06 runs in the heart of the zone; off a pitch he recognised as something else, 0.00-0.03, with more of the contact going foul (.58 against .42).

**Batters stayed far too passive.**

| swing rate | 0-0 | 1-1 | 2-1 | 3-1 | 0-2 | all |
|---|---|---|---|---|---|---|
| the bet, as built | .32 | .24 | .13 | .05 | .44 | .28 |
| with a location prior by count | .38 | .27 | .16 | .06 | .48 | .32 |
| location prior, eye at half its scatter | .48 | .40 | .36 | .29 | .47 | .43 |
| league | .32 | .54 | .60 | .55 | .51 | .48 |

The location prior was the league's location distribution by count (statcast/discipline.py table 3), so that an ambiguous pitch looked more like a strike where pitchers throw more strikes. Halving the eye's scatter brought zone swings to the league's (.71 against .67), but chase stayed low (.16 against .28) and first pitches were over-swung.

**Why: the league's batters are more aggressive ahead in the count than a run-value bet allows.** The bet swings most at 0-0 and least in hitters' counts; the league does the reverse. The league's own realised run values (statcast/discipline.py v0.2 table 6) showed swings near the edge losing runs against takes in hitters' counts: at 2-1, -0.061 per swing at 2-0 in inside the edge and -0.136 just outside it, where batters still swung at .66 and .51 of pitches; at 2-0, swings lost 0.013 even 2-4 in inside the zone. With two strikes, swings in the zone gained 0.06-0.19 against takes, as the bet predicts. Takes are biased toward pitches that looked like balls, so the comparison flatters takes, but not enough to reverse it deep in the zone. A batter who maximises the next pitch's run value cannot reproduce the league's swing rates in hitters' counts, however good his inputs are.

### The swing policy, fitted to the league's swing curves (bb_engine v1.2; 2026-10-02)

The run-value bet could not swing like the league's batters, so the swing decision stayed a policy and its values were fitted to the policy's own measurement: the league's swing probability by distance from the zone edge in each count (`statcast/discipline.py` v0.3 table 2b, 42 days of 2025). Runs: `tools/fit_swing_policy.js` (600 hitters × 40 PA against 120 pitchers, four passes), `discipline_check` and `contact_check` (400 × 40, seeds 3, 11, 29), `power_chain` 500 × 40 at seeds 3 and 11, `run_games` 200 games at seeds 3, 11 and 29, `shape_check` 10 games (967 plays, 0 bad).

**What was built.** The batter decides on what he could see at the commit point (a pitch not yet picked up is judged where the pitch he expected would go), judges his chance it is a strike from that and his eye's scatter, and swings above a threshold for the count and his read: one for the pitch he sat on or has not told apart from it, one for a pitch he recognised as something else. The old hand-set thresholds and the sitting bonus went. The fit kept the second threshold at or above the first; left free, it reversed them in four counts, using where breaking balls go to bend the curves' tails.

| count | 0-0 | 0-1 | 0-2 | 1-0 | 1-1 | 1-2 | 2-0 | 2-1 | 2-2 | 3-0 | 3-1 | 3-2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| threshold, pitch he sat on | 0.35 | 0.10 | 0.17 | 0.19 | 0.10 | 0.08 | 0.29 | 0.10 | 0.03 | 0.88 | 0.18 | 0.03 |
| threshold, pitch recognised as other | 1.20 | 0.76 | 0.17 | 0.99 | 0.66 | 0.23 | 1.06 | 0.65 | 0.35 | 1.14 | 0.72 | 0.34 |

Early in the count and ahead, he swings only at the pitch he sat on; with two strikes, at anything that may be a strike. Each count's curve came within 0.014-0.032 rms of the league's; one threshold per count managed 0.024-0.079. The 3-1 pair moved between passes (few pitches reach 3-1; two near-equal solutions).

| | v1.1 | v1.2 | league |
|---|---|---|---|
| swing / zone swing / chase (discipline_check, seed 3) | .401 / .610 / .201 | .470 / .630 / .323 | .479 / .667 / .283 |
| in zone (seed 3) | .487 | .480 | .509 |
| whiff per swing, fastball / breaking / off-speed (contact_check) | .224-.233 / .287-.306 / .313-.325 | .259-.275 / .320-.359 / .400-.447 | .172 / .308 / .299 |
| whiff per swing, all | .261-.266 | .285-.301 | .232 |
| pitches per team-game (run_games) | 158-162 | 142-148 | 146 |
| K% / BB% | 28.8-29.7 / 12.0-12.9 | 29.1-29.5 / 6.1-6.5 | 22.6 / 8.2 |
| AVG / OBP / SLG | .236-.241 / .333-.338 / .382-.394 | .252-.254 / .301-.303 / .414-.423 | .243 / .312 / .399 |
| BABIP | .336-.339 | .348-.350 | .291 |
| runs per team-game | 4.13-4.18 | 3.84-3.92 | 4.39 |

What the step did, in these runs: the batters swung like the league's in every count, and walks fell from 12-13% to 6.1-6.5%, now below the league's 8.2. Strikeouts did not move: swinging at the league's rate, the model's swings missed .29-.30 of the time against .232, off-speed pitches above all. Walks overshot because the model's pitches outside the zone sat closer to its edge than the league's, where batters chase more (chase .323 against .283 with matching swing curves).

**The pitch kinds did not follow.** The policy matches the curves by count; by pitch kind, fastballs were swung at too much outside the zone (12+ in outside: .14 against .02) and breaking balls too little everywhere (6+ in inside: .52 against .71; 6-9 in outside: .12 against .28). A policy cannot shape those; perception does.

**Tried and rejected: perception fitted to the curves by kind.** The eye's scatter (×0.6-1.4) and how readily he spots a pitch leaving his expected path (spotIn ×1-3) were searched with the thresholds refitted at each point. Poorer spotting brought the curves by kind close (error 0.164 → 0.040-0.055 rms at spotIn ×2-3), but whiffs rose to .37-.42 per swing and K% to 36-43%. In the model a swing fooled at the commit point nearly always misses; the league's batters chase breaking balls far wider and still whiff on them only .31. What a fooled swing produces is the place to look.

### Fooled-swing contact: the ball's direction (bb_engine v1.3; 2026-10-02)

In v1.2 a swing on a pitch picked up late or never recognised missed .81 of the time, even down the middle of the zone, and making more breaking balls fool the batter (as the league's swing curves by pitch kind ask) sent whiffs on breaking balls in the heart of the zone to .36 against the league's .10. Runs: `contact_check` and a whiff table by pitch kind and location (400 hitters × 40 PA against 120 pitchers, seeds 3, 11, 29), `power_chain` 500 × 40 at seeds 3 and 11, `run_games` 200 games at seeds 3, 11 and 29, `shape_check` 10 games (1,088 plays, 0 bad). League whiffs by pitch kind and distance from the zone edge came from the 42 days of pitch-level 2025 (breaking balls: .100 in the heart, .474 at 2-4 in outside, .935 beyond 9 in).

**What was built.** A fooled batter extrapolates from what he sees. Until v1.3 he read only where the ball was across and up and down, and assumed the expected pitch's curve from there: with most break coming late, that left him about 60% of the gap off (10 in or more on a slider read as a fastball), farther than any late steering reaches. He now reads the direction the ball is travelling as well, which the eye does well for motion across its view, so only the curve still to come fools him: (1 - f)^2 of the gap from a look at a share f of the flight, about 16% at the commit point. Its speed toward him, which the eye reads poorly, still fools his timing as before. There is no new constant; a share of the direction read was searched and the best value was all of it.

| share of direction read (pitch spotting as set) | 0 (v1.2) | 0.4 | 0.7 | all |
|---|---|---|---|---|
| whiffs by pitch kind and location, rms against the league | .086 | .074 | .072 | .073 |
| K% (200 games, seed 3) | 29.1 | 27.9 | 25.9 | 24.1 |
| runs per team-game | 3.68 | 3.82 | 4.31 | 4.40 |

| | v1.2 | v1.3 | league |
|---|---|---|---|
| whiff per swing (contact_check) | .285-.301 | .229-.259 | .232 |
| whiff, fastball / breaking / off-speed | .259-.275 / .320-.359 / .400-.447 | .230-.260 / .231-.267 / .201-.217 | .172 / .308 / .299 |
| whiff in / out of the zone | .191-.207 / .457-.479 | .137-.168 / .398-.428 | .150 / .430 |
| late or fooled swings that missed (seed 3) | .81 | .26 | |
| K% / BB% (run_games) | 29.1-29.5 / 6.1-6.5 | 23.4-23.8 / 6.3-6.5 | 22.6 / 8.2 |
| runs per team-game | 3.84-3.92 | 4.40-4.66 | 4.39 |
| AVG / OBP / SLG | .252-.254 / .301-.303 / .414-.423 | .275-.284 / .322-.333 / .453-.465 | .243 / .312 / .399 |
| BABIP | .348-.350 | .349-.359 | .291 |
| EV50 (power_chain, seeds 3 / 11) | 99.3 / 99.8 | 99.2 / 99.6 | 100.6 |

What the step did, in these runs: strikeouts and whiffs per swing came to the league's, and runs to the league's average. By location, whiffs on breaking balls tracked the league's closely outside the zone (.42 against .47 at 2-4 in, .57 against .59 at 4-6). The pitch kinds turned over: breaking and off-speed whiffs ran below the league's and fastball whiffs above it. Breaking balls were low overall because batters chased them far outside so rarely (49 swings beyond 9 in out of 6,022, against 5% in the league); fastballs because a fastball chased outside the zone still missed too often (.45 at 2-4 in against .31). With more balls in play, the excess of hits on them (BABIP .35) carried batting average to .28 and slugging to .46.

**The swing curves by pitch kind did not follow** (rms .17, as in v1.2). With the direction read, poorer pitch spotting improved them (spotIn ×3: .097) for a point or two of K% (26.1) and about half a run (3.83); left for the joint fit, since spotIn is set by hand.

### The pitcher's plan, measured (bb_engine v1.4, bb_game v0.7; 2026-10-02)

Until v1.4 a pitcher chose an intent from a hand-set table (attack, edge or expand, by count), aimed at hand-set margins from the edges, and missed by a hand-set command of 4.0 in per axis (4.6 for relievers). Runs: `statcast/locations.py` (42 days of pitch-level 2025, 163,967 pitches), `run_games` 200 games at seeds 3, 11 and 29, `contact_check` 400 × 40 at the same seeds, `discipline_check` seed 3, `power_chain` seeds 3 and 11, `shape_check` (1,097 plays, 0 bad), and a hit-by-pitch count over 16,000 plate appearances (seed 5).

**What the league showed.**
- **Command is about twice what the model had.** A pitcher's 3-0 four-seamers, where the target is about as fixed as it gets, scattered 7.5 in across and 8.3 in up and down about his own 3-0 mean (starters 7.2 / 8.4, relievers 8.4 / 8.2). In other counts the scatter was only a little larger (0-0: 8.3 / 9.2), so most of a pitch's distance from where it was aimed is execution. That agrees with the published miss distances from the catcher's glove (Inside Edge about 11 in; OpenCommand 9.9 in; a per-axis scatter s gives a mean miss of 1.25 s).
- **Pitchers differ less than expected.** Beyond sampling, the spread of command between pitchers was 7% of the mean across and 11% up and down, and the two axes were not strongly linked (raw r −0.09).
- **Targets move with the count but hardly within it.** With command taken out, a pitcher's targets within a count spread 1.5-5 in. The count shifted the aim (with two strikes, breaking balls to same-side batters went 4 in farther away and 0.18 of the zone lower; fastballs went 0.18-0.25 of the zone higher), and each pitcher's own aim for a type sat about 2 in across and 0.10-0.17 of the zone in height from the league's.
- **Pitchers do not avoid repeating a pitch.** After a change the next pitch was the same type 1.13 times as often as usage, side and count predict; after two alike, 0.98. The engine had penalised repeats (×0.7 and ×0.42).
- **Fatigue hardly touched command within a start.** Starters' four-seamers scattered as much at pitches 76-90 as in their first 25 (within 4%), and lost 0.4 mph. Managers take tired pitchers out, so this is only the decline the league allows.

**What was built.** Command is two traits, across and up and down, drawn from the measured means and spreads, with each type's factor measured against the four-seamer's (`cmd`) and the part of the scatter the pitch-to-pitch speed, spin and seams already make taken out of the release-angle error (`plateW`, `tools/plate_scatter.js`). The pitcher picks a pitch from his usage times the league's use of the type against this side and of its kind in this count, with the measured repeat factors. He aims at the league's mean location for that type and side, moved by the count's shift, his own habit for the type (drawn once) and the small within-count spread. All of it comes from `PLAN_LOC`, written into the engine by `statcast/locations.py`. The intent table, the target margins and the pitcher-aggression trait are gone; the intent is now only a name for where he aimed (for the screen). Fatigue's cost to command came down from 0.6 to 0.1 of the fatigue level (`FATIGUE_CMD`). With four times as many pitches in the dirt, bb_game's chance of a pitch getting past the catcher came down to 0.4 of its old value per pitch in each band (set by hand in proportion, scaled to the league's wild pitches per game). The 24 swing thresholds were refitted to the same league curves (rms by count .023, as before).

| | v1.3 | v1.4 | league |
|---|---|---|---|
| in zone (discipline_check, seed 3) | .485 | .501 | .509 |
| swing / chase | .472 / .316 | .457 / .257 | .479 / .283 |
| pitches below 0.15 m (in the dirt) | 0.8% | 3.2% | 3.1% |
| BB% (run_games) | 6.3-6.5 | 8.4-8.5 | 8.2 |
| K% | 23.4-23.8 | 21.3-21.5 | 22.6 |
| hit by pitch, per PA | 0.40% | 1.01% | 1.1% |
| wild pitches per team-game | 0.38-0.43 | 0.29-0.35 | 0.36 |
| whiff per swing (contact_check) | .229-.259 | .220-.242 | .232 |
| runs per team-game | 4.40-4.66 | 4.88-5.11 | 4.39 |
| AVG / OBP / SLG | .275-.284 / .322-.333 / .453-.465 | .282-.285 / .349-.351 / .465-.466 | .243 / .312 / .399 |
| BABIP | .349-.359 | .349-.353 | .291 |

What the step did, in these runs: where pitches went came to the league's band by band (the share in each distance band from the zone edge within about .02 for every group of counts and every pitch kind), and with them walks and hit batsmen, from measured command and aim rather than any tuned constant. Strikeouts fell a point below the league's. Runs rose half a run above it: more men on base, and the same excess of hits on balls in play (BABIP .35) driving them in. The zone rate in hitters' counts ran a little low (2-0 .553 against .603), and the swing curves by pitch kind were still off (rms .15), since what a batter does with a breaking ball is perception, not the plan.

### Fielding and base running, measured (bb_engine v1.5, bb_field v0.7; 2026-10-02)

With strikeouts and walks at the league's, balls in play fell for hits .35 of the time against .291, and the model made 0.8 triples a game against 0.14. Runs: `statcast/bip.py` (28,609 balls in play, 42 days of 2025) beside `headless/bip_check.js` (300 games at seeds 3, 11 and 29), `statcast/baserunning.py` (extra bases taken, from where the next batter found each runner), `run_games` 200 games at seeds 3, 11 and 29, `shape_check` (1,066 plays, 0 bad), and Statcast's outfield-jump and fielder-positioning data.

**What the measurements showed, and what was changed.**
- **Hits were a fielding problem, not contact.** Conditional on exit velocity and launch angle, fly balls to 300-400 ft fell twice as often as the league's (.375 against .136 at 300-350 ft), hard balls topped into the ground fell for hits up to three times as often (.50 against .20 at 100-105 mph below −10 deg), and a fly ball hit to 300-400 ft became a triple about a tenth of the time (league .01-.03).
- **Outfielders were half as quick as Statcast's jump.** The league's average outfielder covered 33.9 ft toward the ball in the first 3 s after the pitch was RELEASED (2025 leaderboard, sd 1.9 ft between players), about 2.6 s after contact. The model's covered about 18 ft: its 0.70 s reaction and 3.5 m/s² had been set to "30 ft in 3 s" counted from contact. Fielders now all take their first step in 0.45 s (sd 0.06) and accelerate at 5.5 m/s², as the infielders already did: 33.7 ft.
- **A bounce lost too little.** The share of speed a baseball keeps bouncing was measured off a skinned infield (.57 at 25 deg, .49 at 35 deg) and natural grass (.44, .32) at 31 and 40 m/s (Brosnan, McNitt & Schlossberg 2007). The model kept .65-.69 on dirt and .56-.59 on grass whatever the angle, so a ball topped into the dirt hopped 60 ft high over the infield. A bounce now keeps 0.45 (dirt) or 0.35 (grass) of its speed into the ground and 0.76 of its speed along it less a friction term that grows with how hard it lands (0.35 or 0.65 times the speed into the ground), with a hand-set floor of 0.2.
- **Outfielders stood too shallow and turned toward the pull side.** Statcast's 2025 positioning (eight teams, every pitch) put the pull-side corner 300 ft out at 26 deg, the opposite corner 291 ft at 28 deg, and centre 323 ft shaded 1.7 deg toward the OPPOSITE field. The model had 285 / 315 / 285 ft turned 6 deg toward the pull side. Outfielders now stand at the measured spots (3 ft deeper per mph of the hitter's bat speed, set by hand to give the league's spread of depth). The infield keeps its pre-2023 shading.
- **The catch rule was fitted.** With the measured motion, outfielders caught too much; a catch now takes arriving 0.15 s before the ball for an even chance (`CATCH_SET`, fitted to catches by exit velocity and launch angle; it had been −0.05, set by hand).
- **The batted-ball drag was refitted.** Balls in the air at 25-40 deg and 100+ mph carried 7-23 ft short of the league's at the same exit velocity and launch angle; at 15-20 deg they carried a little long. The model's aerodynamics match Nathan's table for a 103 mph, 27 deg drive (380-399 ft from 500 to 2,000 rpm, his 368-400), but its fly balls leave the bat with about 3,200 rpm in all at 25-30 deg, a third of it sidespin from the dipped barrel, while the drag scale had been fitted to one 400-ft drive at a spin the collision no longer gives. Refitted to the carry table over 20-40 deg: 1.08 (was 1.142), within 6 ft rms.
- **Runners were never thrown out, and took too few extra bases.** In the league a runner on second scored on a single .36 / .51 / .83 of the time with none, one and two out (.02-.03 thrown out); a runner on first went to third on a single .28 / .30 / .43 and scored on a double .34 / .31 / .52. The model's runners decided with perfect knowledge and big margins (.43, .23 and .13 overall, none ever out) and started from rest 3.5 m off the bag. Now a runner who breaks on contact (two out, or forced on a grounder) is moving off Statcast's measured secondary lead (15.3 ft) at 1.5 m/s (`V_CONTACT`, checked against double plays: 3 m/s cut them to 0.55 a game); with fewer than two out an unforced runner freezes at his lead and starts from rest; he and the coach read the race with 0.25 s of error (set by hand) and send him when the read beats a margin for the outs (`SAFETY_FAR` 0.6 / 0.5 / 0.2 s, fitted to the extra bases taken); and a long throw's arrival is less certain the longer it is beyond 40 m (set by hand so runners are thrown out about as often as the league's).
- **A scoring bug cost the batter hits.** A runner thrown out trying for an extra base on a clean hit to the outfield made the play a fielder's choice, so the batter lost the hit (about a quarter of a hit per team-game). He now keeps it; on a third-out tag play a run counts if it crossed first.

| | v1.4 | v1.5 | league |
|---|---|---|---|
| BABIP (run_games) | .349-.353 | .265-.277 | .291 |
| BABIP ground / line / fly / pop-up | .31 / .76 / .26 / .02 | .235-.248 / .644-.655 / .134-.145 / .010-.014 | .24 / .68 / .12 / .02 |
| hits per team-game | 10.4-10.6 | 7.9-8.5 | 8.15 |
| doubles / triples | 2.45-2.54 / 0.78-0.86 | 1.14-1.17 / 0.09-0.10 | 1.60 / 0.14 |
| home runs (HR%) | 0.84-0.88 (2.1%) | 1.18-1.22 (3.1-3.2%) | 1.12 (3.0%) |
| double plays | 0.67-0.79 | 0.68-0.70 | 0.72 |
| errors | 0.68-0.78 | 0.74-0.84 | 0.55 |
| AVG / OBP / SLG | .282-.285 / .349-.351 / .465-.466 | .229-.238 / .298-.311 / .369-.379 | .243 / .312 / .399 |
| runs per team-game | 4.88-5.11 | 3.81-4.14 | 4.39 |
| runner on 2nd scores on a single, 0 / 1 / 2 out | .43 overall | .40 / .43 / .71 | .36 / .51 / .83 |
| runner on 1st to 3rd on a single | .23 overall | .27 / .28 / .45 | .28 / .30 / .43 |
| runner on 1st scores on a double | .13 overall | .20 / .23 / .40 | .34 / .31 / .52 |

Hits on balls in play by launch angle (bip_check, three seeds; league in brackets): below −10 deg .100-.107 (.122), −10 to 0 .133-.149 (.249), 0-10 .547-.562 (.482), 10-20 .699-.717 (.691), 20-30 .389-.410 (.350), 30-40 .130-.134 (.109), 40-50 .055-.061 (.044).

What the step did, in these runs: hits, home runs, walks, strikeouts and double plays all came to the league's, and runs to within half a run, with BABIP .02 below the league's. That BABIP came out a little LOW once the fielding was measured is worth noting: the old excess of hits had been hiding a home-run shortfall and a carry deficit. What it left: doubles a third short, most of them balls down the lines (the model's spray is narrower than the league's, sd 20 against 25 deg: a contact gap), grounders at −10 to 0 deg falling half as often as the league's, liners at 15-20 deg carrying 10-20 ft long (the spin's shape with launch angle), two-out runners from second scoring .71 against .83, and errors a third high.

### The pitcher's chain (bb_engine v1.6; 2026-10-02)

Until v1.6 a pitcher's fastball speed, release point and repertoire were set by hand and drawn independently of each other, and each pitch's spin direction scattered about its type's mean on its own. Runs: `statcast/pitcher_chain.py` (422 pitchers with 150+ pitches, 42 days of 2025, with the MLB Stats API heights and the arm-angle leaderboard), `headless/pitcher_chain_check.js` (3,000 pitchers drawn; 300 of them each faced 300 batters, seeds 3 and 11), `tools/fit_pitch_spread.js` v0.2, `run_games` and the rest of the suite at seeds 3, 11 and 29.

**What the league showed.** A pitcher's release point is his shoulder (0.705 of his height up, sd 0.037) plus his arm as a lever (shoulder to ball 0.372 of his height, sd 0.016) at his arm angle (37.7 ± 12.8 deg), plus where he stands on the rubber (0.14 ± 0.63 ft toward his arm side); the lever reproduces Statcast's arm angle exactly (r 1.00). Extension rose 0.065 ft per inch of height (r .33). Four-seam speed did not follow height (r .09) or weight (.05) in the majors; starters threw 94.1 ± 2.2 mph and relievers 95.1 ± 2.4. Every type's movement direction turned with the arm slot (four-seam −0.79 deg per deg of arm angle, sinker −0.93, curveball −1.03, changeup −0.88; the slider barely, −0.11), and at the average slot the directions were the engine's fitted tilts within 4 deg. Four-seam active spin rose a little with the slot (+0.12 points per deg). Spin rose 18.2 rpm per mph (r .31), and a pitcher's spin per mph carried from his four-seamer to his sinker (r .81) and partly to his slider (.36), curveball (.15) and changeup (.19). Low slots carried more sinkers (.75 of pitchers against .41 at high slots) and sweepers (.44 against .17), high slots more curveballs (.53 against .36); starters used 4.8 pitch types of 3% or more, relievers 3.8.

**What was built.** Height, weight and arm angle are traits; the release point is built from them by the lever; each pitch's tilt is its type's plus the measured turn per degree of slot plus a residual spread read from spin axes (`tiltArm`, `tiltSD`); spin efficiency follows the slot (`effArm`); spin follows speed for the fastballs and a shared spin talent across a pitcher's pitches (`spinRho`); speeds are the measured starter and reliever distributions. A pitcher's repertoire is now a league pitcher's: drawn from the 422 measured mixes of pitchers in his role with a slot near his (`REPERTOIRES`, written into the engine by `statcast/pitcher_chain.py`); the six hand-set archetypes are gone. The seam spreads between pitchers were refitted with the engine's own pitchers (`fit_pitch_spread.js` v0.2: the slot now carries much of the spread, so the four-seamer's seam spread fell from [2.6, 2.0] to [0.9, 1.3] in), and the swing thresholds refitted (rms by count .021).

| | model | league |
|---|---|---|
| arm angle (deg) | 37.8 ± 12.7 | 37.7 ± 12.8 |
| release height (ft) | 5.77 ± 0.49 | 5.78 ± 0.44 |
| extension (ft) | 6.44 ± 0.41 | 6.41 |
| four-seam IVB / HB (in) | 15.5 ± 2.4 / 7.2 ± 3.5 | 15.4 ± 2.6 / 7.8 ± 3.4 |
| four-seam IVB ~ arm angle | .61-.62 | .73 (pitch level), .71 (leaderboard) |
| release height ~ arm angle | .80-.81 | .82, .76 |
| release height ~ height | .32-.33 | .20 |
| extension ~ height | .28-.33 | .33 |
| four-seam spin ~ speed | .29-.30 | .31, .27 |
| spin per mph, four-seam ~ slider | .39 | .36 |

**The unfitted test: does stuff turn into outcomes?** (300 pitchers × 300 batters, seeds 3 and 11; league among qualified pitchers, whose larger samples attenuate less): K% ~ fastball speed .35-.37 (league .52), whiff ~ speed .34-.37 (.56), whiff ~ spin .27-.38 (.36): the model's harder and higher-spin throwers missed more bats, a little less strongly than the league's. Two came out wrong: K% ~ release height +.16-.17 against the league's −.22 (lower releases strike out more in the league; the model's batter pictures every pitch from its true release point, so a low release cannot fool him - a real batter's sense of how steeply the ball should come in is probably tuned to the typical release), and BB% ~ arm angle near 0 against +.20 (command is independent of slot in the model; not measured). The release-height result is not the pitch mix: breaking-ball share was unrelated to release height in both (model .03-.04, league .08 among 124 pitchers with 100+ plate appearances) and holding it left the correlation where it was (model +.08 to +.14, league −.26). K% spread between pitchers 5.0-5.5 points against 4.5.

| | v1.5 | v1.6 | league |
|---|---|---|---|
| swing curves by pitch kind, rms | .15 | .117 | |
| K% / BB% | 21.0-21.4 / 7.8-8.8 | 21.1-21.9 / 8.1-8.2 | 22.6 / 8.2 |
| HR% | 3.1-3.2 | 2.9-3.2 | 3.0 |
| runs per team-game | 3.81-4.14 | 3.73-3.99 | 4.39 |
| BABIP | .265-.277 | .266-.274 | .291 |

What the step did, in these runs: the hand-set pitcher traits (speed, release point, repertoire) became measured ones and a chain that reproduces the league's correlations among them; the game line did not move beyond the seeds' spread, and the swing curves by pitch kind came closer (more sinkers, cutters and sweepers, as the league throws).

### Pitching around, and what selection would do (bb_engine v1.7; 2026-10-03)

**Pitchers work around power.** Among 2025 hitters who saw 400+ pitches (175, pitch-level), the share of pitches in the zone fell 0.0038 per mph of the hitter's average bat speed (r −.34; −.35 against the hardest half of his batted balls), while the model's pitchers aimed the same way at everyone (slope +0.0005). Now every target's distance from the zone's centre is scaled by 1 + 0.021 per mph of the hitter's bat speed above 71.2 (the league's mean over hitters' tracked swings): slope −0.0036 to −0.0037, r −.35 to −.37. With nothing fitted to it, walks against bat speed went from −.05 to +.05 to +.12 (two seeds, 100 PA per hitter; league +.17 among qualified hitters). Game line (200 games × seeds 3, 11, 29): BB% 7.9-8.3, K% 20.6-21.2, HR% 3.0-3.2, runs 3.65-3.98.

**What selection would do** (`tools/hitter_value.js`, not in the game yet). In the league, bat speed correlated +.69 with whiff, +.58 with K% and −.52 with squared-up contact among qualified hitters; in the model, whose traits are drawn independently, +.06 to +.09, +.03 to +.06 and −.13 to −.20. The tool draws hitters, lets each face 300 plate appearances against the engine's pitchers, values them by Statcast's expected wOBA (walks .69, hit batsmen .72, every ball in play the league's expected wOBA on contact for its exit velocity and launch angle, `statcast/bip.py` table 6), and keeps the best. Keeping the top half or quarter by value raised bat speed ~ whiff to +.23 to +.28, ~ K% to +.23 to +.28 and ~ squared-up to −.24 to −.34 (three seeds, 1,500 hitters each); harder selection did not raise them further (top 5%: +.13 to +.17). It also narrowed K% between hitters from .086-.092 to .059-.076 (league .057). So selection on value - the major leagues as the top of a larger pool - produced about 40% of the league's bat-speed-to-whiff link and most of its narrower spread from traits that are independent before selection; the rest has to be a trade-off within the hitter. In the model the traits worth most per sd of expected wOBA were weight and swing power (bat speed's ingredients), eye (−20 points per sd of scatter), swing length, aggression (−15: swinging more costs), along-barrel and timing scatter, and pulling (−9).

### The farm: the majors as the top of a larger pool (bb_engine v1.8; 2026-10-03)

Joe (2026-10-02): drawing the full range of traits creates players who would never make the majors, and bending the model to match MLB while they are in the mix causes a different kind of trouble. Until v1.8 every drawn player counted as a major leaguer, and the trait distributions had been set or fitted at that level. Runs: `tools/hitter_value.js` (three fits of 1,500 population hitters × 300 PA), `tools/pitcher_value.js` (three fits of 1,000 population pitchers × 300 PA), `tools/fit_population.js`, the suite at seeds 3, 11 and 29, `headless/pitcher_chain_check.js`.

**What was built.** TRAITS are now the population. Each roster spot (and each player any tool draws) goes to the best of `FARM_N` = 4 candidates of his position or role, as the scouts judge them: `HITTER_VALUE` and `PITCHER_VALUE`, linear estimates of the expected wOBA the engine itself gives a player's traits (regressions over population players each facing 300 plate appearances, valued by Statcast's weights and the league's expected wOBA on contact), plus `SCOUT_SD` = 0.015 of judgement error; `FARM_N` and `SCOUT_SD` are set by hand. The population was fitted (`tools/fit_population.js`) so the picks have the league's measured values: hitters' height (72.0 ± 2.35 in), weight (206.3 ± 19.9 lb), swing length (7.32 ± 0.39 ft) and bat speed (71.2 ± 2.70 mph, each hitter's mean over his tracked swings), with weight ~ bat speed .53 (the chain's weight exponent came to −0.25 from −0.45: selection trims the slow end of bat speed); pitchers' speed by role, command on both axes, arm angle, height, and a spin talent averaging Savant's means. The hand-set hitter skills (eye, pitch spotting, timing, barrel control, aggression...) had their population means moved so the picks keep the means they were calibrated to when every drawn hitter counted, and their population spreads left for the farm to narrow (for example eye scatter 5.36 in the population, 5.0 among the picks). The population hitter is about 2 mph slower (69.0 ± 3.1) and three-quarters of an inch shorter than the picked one.

**What the scouts value.** For hitters (R2 .69-.71 against 300-PA expected wOBA): bat speed (+31 wOBA points per sd), eye scatter (−20), aggression (−15: swinging more costs), along-barrel and timing scatter, undercut, pulling, learning. For pitchers the features explained only 11-13% (300 batters are mostly luck; the rest about 40% of the true spread): command across (+11 per sd) and up and down (+6) dominated, and four-seam speed was worth only 1-2 points - the model's harder throwers strike out more but give up harder contact, while in the league speed also spoils contact (a model gap). So the farm improves picked pitchers' command more than their speed (population starters 93.7 mph, picks 94.0).

| | v1.7 | v1.8 | league |
|---|---|---|---|
| bat speed ~ whiff (power_chain, 500 picks × 40 PA) | .01 | .17-.24 | .69 |
| bat speed ~ K% | −.03 | .11-.20 | .58 |
| bat speed ~ squared-up | −.04 | −.12 to −.28 | −.52 |
| bat speed ~ BB% | −.08 | .01-.12 | .17 |
| EV avg / EV50 | 88.9 / 99.7 | 89.6 / 100.7 | 89.7 / 100.6 |
| K% / BB% (run_games) | 20.6-21.2 / 7.9-8.3 | 21.1-21.2 / 8.0-8.3 | 22.6 / 8.2 |
| HR% | 3.0-3.2 | 3.3-3.5 | 3.0 |
| AVG / OBP / SLG | .23 / .30 / .37 | .237-.242 / .308-.309 / .380-.398 | .243 / .312 / .399 |
| runs per team-game | 3.65-3.98 | 4.08-4.38 | 4.39 |

**Joe's open question (a player below average in everything).** Below the population average in all seven of bat speed, eye, timing, pitch spotting, barrel control, along-barrel control and patience: 0.88% of the population (as independent traits would give, 0.5^7), 0.03% of the farm's picks; in five of them, 3.3% against 0.29%. He can still reach the majors on the scouts' error, about one in 3,000.

What the step did, in these runs: selection on value produced part of the league's power-against-contact link from traits that are independent in the population, brought the hardest contact to the league's, and put runs and the slash line at the league's. What it left: bat speed ~ whiff at a third of the league's (the rest should be a trade-off within the hitter - how hard he chooses to swing), the pitchers' speed undervalued by the model, and home runs a little high.

### A hitter's swing style (bb_engine v1.9; 2026-10-03)

**Within a hitter, harder swings do not miss more.** Pitch-level 2025 (73,960 swings with bat speed): against each hitter's own mean, his swings 6-9 mph slower were whiffed .294 of the time and those 6-9 mph faster .140, squared up a little more often: slow swings are the ones he altered for a pitch he did not time (the model's adjusted swing). So the league's bat speed ~ whiff +.69 is a difference between hitters, not a cost of effort.

**Between hitters, pull-and-lift is a style.** Among 2025's qualified hitters (145, swing-path and batting leaderboards): attack angle ~ pull% +.66, ~ fly-ball% +.68, ~ whiff +.53; swing length ~ attack angle +.33, ~ pull% +.34, ~ whiff +.51; pull% ~ the swing's horizontal direction −.71; but contact depth ~ attack angle only +.17 - uphill swingers pull more because they aim to, not because they meet the ball farther out front. In the model those traits were independent: attack ~ pull% +.18, pull% ~ fly-ball% +.13, swing length ~ whiff +.10. The model already made uphill swingers miss more (attack ~ whiff +.69) and lift more (+.73).

**What was built.** One latent style per hitter, shared by his attack angle, pull bias and swing length with loadings 0.80, 0.82 and 0.41 (`STYLE`, from the three league correlations among them: their products), each trait keeping its own marginal. The population was refitted (`tools/fit_population.js`, now holding attack angle's spread at the leaderboard's 3.51 deg and the skills' calibrated means fixed in the tool - the first refit read them from TRAITS, which by then held the population, and shifted them a second time), and the swing thresholds refitted.

| (picked hitters, 250 PA each, seeds 3 and 11) | v1.8 | v1.9 | league |
|---|---|---|---|
| attack angle ~ pull% | +.18 | +.57 to +.65 | +.66 |
| pull% ~ fly-ball% | +.13 | +.34 to +.39 | +.55 |
| swing length ~ whiff | +.10 | +.36 to +.38 | +.51 |
| attack angle ~ whiff / K% | +.69 / +.71 | +.66-.71 / +.70-.74 | +.53 / +.47 |
| bat speed ~ whiff (power_chain) | .17-.24 | .25-.30 | .69 |
| bat speed ~ BB% | .01-.12 | .08-.15 | .17 |
| K% / BB% / HR% (run_games) | 21.1-21.2 / 8.0-8.3 / 3.3-3.5 | 20.7-21.8 / 8.0-8.4 / 3.3-3.6 | 22.6 / 8.2 / 3.0 |
| runs per team-game | 4.08-4.38 | 4.04-4.12 | 4.39 |

What it left: uphill swings cost the model's hitters more whiffs and strikeouts than the league's (+.66-.74 against +.47-.53), and bat speed ~ whiff is still under half the league's.

### The pro pool, level by level (bb_engine v2.0, bb_game v0.8; 2026-10-03)

Joe (2026-10-03): major leaguers come from an extreme-value distribution - each is the maximum of a sampling from a normal pool - and the farm is a filter for the best. The goal is now the pool itself: the frequency distribution of the traits among all professional players, majors and minors, and how those latent traits meet the physics to give the statistics we measure. Runs: `tools/fit_population.js` (8 rounds × 6,000 picks), `tools/fit_swing_policy.js` (three passes), the suite at seeds 3, 11 and 29, `headless/level_check.js` (400 games per level at seeds 3, 11 and 29), `statcast/levels.py` on 42 days of 2025 for each level (the majors 165,166 pitches, Triple-A 162,471).

**What was built.** `FARM_N` went from 4 to 6, and the pool was refitted so the majors keep the league's measured traits. The pool hitter now swings 68.2 ± 3.1 mph against the major leaguer's 71.1 ± 2.7, and stands 70.9 in against 71.9. LEVELS: the six candidates for a roster spot are ranked by the scouts' judgement and the k-th best plays at level k (`makeBatter` / `makePitcher` with `level`, `makeTeam` passes it on), 1 the majors, 2 Triple-A, down to 6 rookie ball - roughly an organisation's six levels, each about a roster deep. The majors are fitted; every level below is a prediction.

**Triple-A, measured alike** (`statcast/levels.py`; Savant's minor-league search, Hawk-Eye in every Triple-A park). Against the majors over the same 42 days: K% 22.5 both; BB% 10.8 against 7.8; HR% 2.85 against 3.14; BABIP .315 against .289; hard-hit .375 against .419 and the hardest half of batted balls 99.1 against 100.6 mph; whiffs per swing .244 against .234; four-seam speed 92.9 against 94.1 mph (starters) and 94.1 against 95.0 (relievers); arm angle the same; batters 26.9 years against 28.3. Bat speed is not published for Triple-A. **Triple-A's recorded zone is the automated system's**: its sz_top averaged 3.20 ft against the majors' 3.43 (2.9 in lower; sz_bot the same), so a zone rate on each league's own zone is not comparable - on one zone (sz_bot plus the majors' mean zone height) Triple-A's was .502 against .510, so its pitchers' locations are nearly the majors' and most of its extra walks come from the smaller called zone.

**The model, level by level** (three seeds; level 2 played with the umpire's zone top lowered 2.9 in, Triple-A's; the seeds agreed within 0.2 points of K% and BB% and .005 of any rate):

| | MLB | level 1 | Triple-A | level 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|---|
| K% | 22.5 | 21.4 | 22.5 | 21.7 | 23.6 | 24.5 | 25.9 | 27.0 |
| BB% | 7.8 | 8.2 | 10.8 | 9.2 (7.6 on the majors' zone) | 7.8 | 7.7 | 7.7 | 7.5 |
| HR% | 3.14 | 3.27 | 2.85 | 2.53 | 2.05 | 1.64 | 1.37 | 1.03 |
| BABIP | .289 | .276 | .315 | .264 | .261 | .261 | .255 | .251 |
| chase | .283 | .276 | .264 | .293 | .306 | .315 | .329 | .346 |
| whiffs per swing | .234 | .254 | .244 | .267 | .274 | .280 | .294 | .308 |
| hard-hit 95+ | .419 | .404 | .375 | .358 | .314 | .283 | .245 | .196 |
| hardest half (mph) | 100.6 | 100.4 | 99.1 | 98.7 | 97.3 | 96.3 | 95.1 | 93.6 |
| four-seam, starters (mph) | 94.1 | 93.9 | 92.9 | 93.7 | 93.6 | 93.4 | 93.2 | 93.0 |
| four-seam, relievers (mph) | 95.0 | 95.1 | 94.1 | 94.8 | 94.6 | 94.5 | 94.2 | 93.9 |
| bat speed (mph) | 71.2 | 71.2 | - | 69.6 | 68.7 | 67.8 | 66.8 | 65.5 |
| runs per team-game | 4.39 | 3.99 | - | 3.46 | 2.88 | 2.63 | 2.36 | 2.07 |

What the Triple-A test showed, in these runs (nothing in the model was fitted to Triple-A):
- **The hitters' step down matched.** From level 1 to 2 hard-hit fell .046 (Triple-A .044 below the majors), the hardest half 1.7 mph (1.5), whiffs per swing rose .013 (.010), and K% stayed level as it did in the league.
- **The pitchers' step down was a sixth of Triple-A's.** Four-seam speed fell 0.2-0.3 mph from level 1 to 2 against Triple-A's 0.9-1.2. The scouts' PITCHER_VALUE hardly values speed (v1.8), so the farm hardly sorts on it - the same gap as the slow fastballs whiffed too often (known gap 2), seen here from outside the majors.
- **Defence did not step down.** Triple-A's BABIP is .026 above the majors'; the model's level 2 is .012 below its level 1, because the farm picks hitters on hitting alone and the fielders' traits do not change with level.
- **Discipline stepped down the wrong way.** Triple-A's hitters chased less than the majors' (.264 against .283, perhaps partly the automated zone); the model's level 2 chased more (.293 against .276), because the scouts value eye and patience strongly.
- **Walks: the zone explained half the gap.** On Triple-A's zone the model's level 2 walked 9.2% against 10.8 (7.6 on the majors' zone).
- Home runs fell twice as much as Triple-A's from the majors (−0.74 points against −0.29), with hard contact falling about as Triple-A's.

At level 1 with best of six, the suite (seeds 3, 11, 29): runs 3.88-4.00 per team-game (4.39), K% 21.1-21.6 (22.6), BB% 7.9-8.3 (8.2), HR% 3.0-3.3 (3.0), BABIP .272-.276 (.291), AVG .232-.239 (.243), SLG .371-.383 (.399); among 500 major leaguers × 40 PA, bat speed ~ whiff +.26 to +.41 (+.69; v1.9 +.25 to +.30), ~ K% +.16 to +.28 (+.58), EV50 100.5-100.7 (100.6). **Joe's open question at best of six:** below the pool average in all seven categories, 0.78% of the pool and 0.01% of major leaguers (about 1 in 10,000); in five, 3.1% against 0.18%.

Caveats for the level comparison: the pool is static, while Triple-A's players are younger (26.9 against 28.3) and some are still developing; a club also keeps veterans in Triple-A as cover, so it is not purely the second-best of six. Triple-A's ball and the Pacific Coast League's parks carry differently (HR% for the International League alone: 2.81).

### The contact rebuild, stage 3: swing to swing (bb_engine v2.4; 2026-10-03)

Stage 3 was to be glancing contact and fouls. The one believable missing mechanism with a measurement of its own turned out to be how much a swing varies from the hitter's usual: Statcast records every tracked swing's bat speed. Runs: `statcast/misses.py` v0.3, scratch-engine tests of the effort spread and the check, the value and pool refits, `tools/fit_swing_policy.js` (made to count checks), the suite at seeds 3, 11 and 29, `headless/level_check.js`, `headless/contact_score.js`, `headless/spray_check.js`.

**What the league's swings do.** Each swing's bat speed against the hitter's own mean (52,434 swings, hitters with 150+): sd 7.5 mph, median +1.4, 25th percentile −2.1, 5th −11.1, 1st −35.3; 5.7% of swings more than 10 mph below his mean and 2.7% more than 20 below. A core about 4.3 mph wide, and a tail of checked and half swings (whiffs average 2.5 mph below the hitter's mean, sd 10.7). By count the means were already the league's (+1.1, +0.4, −1.2 with 0, 1, 2 strikes); the model's swings varied 2.1 mph about them and had no tail (0.2% more than 10 below).

**What was built.** Every swing's effort varies: bat speed × exp(N(0, 0.05)), the effort leaving his precision alone (within a hitter, harder swings do not miss more). And at his last look a batter whose picture now puts the pitch off the zone tries to check his swing, the more likely the farther off (never inside 2 in, always beyond 8): half the time he holds up (a take), otherwise the bat comes through slowed by 5-60%. `fit_swing_policy.js` now counts each swing by its chance of surviving the check (with a sharp 4-in trigger instead of the ramp, the swing curves broke at the trigger, rms .035 by count). The screen names a checked swing and a half swing.

| | v2.3 | v2.4 | league |
|---|---|---|---|
| bat speed against own mean: p1 / p5 / p25 / p50 / p75 / p95 (contact_score) | about −6 / −4 / −1 / 0 / +1 / +3 | −33.8 / −9.1 / −2.2 / +0.9 / +3.9 / +8.2 | −35.3 / −11.1 / −2.1 / +1.4 / +4.1 / +7.7 |
| swings more than 10 mph below his mean | .002 | .047 | .057 |
| runs per team-game (seeds 3, 11, 29) | 3.52-3.81 | 3.80-4.03 | 4.39 |
| K% / BB% / HR% | 21.1-21.6 / 8.4-8.8 / 2.8-3.2 | 20.0-20.9 / 8.2-8.6 / 3.2-3.4 | 22.6 / 8.2 / 3.0 |
| chase (games) | .267 | .258 | .283 |
| swing policy rms by count / by kind | .019-.022 / .126-.139 | .028 / .138 | |
| contact scorecard rms | .072 | .068-.071 | |
| Triple-A (level 2) BB% | 10.0 | 10.9 | 10.8 |

What it did, in these runs: the distribution of a hitter's swing speeds came to the league's, with its tail of checked swings; runs rose 0.25 a game and walks came to the league's. Glancing contact and fouls on square contact did not move (left as mysteries), hard-hit contact fell to .388 against .419 (half swings make weak contact), and the swing curves far off the plate fell below the league's (9+ in out: .00-.02 against .04-.06 at 0-0).

### The contact rebuild, stage 2: the bat's face and its path (bb_engine v2.3, bb_field v0.8; 2026-10-03)

Joe (2026-10-03): keep building believable relationships between traits and outcomes, don't overtune to Statcast, and leave what seems off as a mystery until the whole model is built. So this stage fits one trait to its own measurement and one physical constant, and lists what is left under "Open mysteries" below. Runs: `statcast/bat_direction.py`, `headless/spray_check.js` (600 hitters × 60 PA), a 4 × 4 grid in a scratch engine, the value and fielding refits, `tools/fit_population.js`, the suite at seeds 3, 11 and 29, `headless/level_check.js`, `headless/contact_score.js`, `headless/bip_check.js`.

**What the league's bat does.** Statcast records each tracked swing's attack direction, the sweet spot's horizontal direction of travel at contact (its sign + toward the opposite field; turned here to + pulled). Over 2025's 42 days: all swings +0.4 ± 19.0 deg, balls in play −0.5 ± 12.3; hitters' own means +0.3 ± 4.3 (155 hitters with 200+ tracked swings), within a hitter 18.2. The league's bat meets the ball square to centre field. The model's bat pointed 9 deg to the pull side (hitters' means +9.0 ± 5.4), from `pullBias` (10 deg, set when the only target was the spray of fair balls, which the pulled fouls had truncated). Yet a ball met with a square path goes about 14 deg to the pull side in the league (spray = 14.4 + 1.5 × the bat's pull direction on square contact), while the model's collision sent it nearly where the path pointed.

**What was built.** The bat's face and its path are now separate. The path is the barrel's direction of travel, which Statcast measures; the face is the way its hitting surface points, square to the barrel, and it is the face that sends the ball: the contact normal is built from the face, the barrel's velocity from the path. With the hands still moving at contact the barrel does not travel square to itself, so the face points `FACE_PATH` = 9 deg further to the pull side than the path, and the face's swing-to-swing scatter (`faceSD`) and the turn for an inside pitch (`LOC_FACE`) are the face's, not the path's (the path's scatter within a hitter came to 16.7 deg, the league's 18.2; with the face scatter on the path it had been 19.7). `pullBias` was refitted so the path points as Statcast's attack direction does (major leaguers' mean 1 deg); `FACE_PATH` is the one constant fitted to the ball's spray. The infielders now shade by the path's pull plus the face's; the screen draws the bat square to its face. The scouts' values, fielding values and the pool were refitted.

| (spray_check, seed 5; + pulled) | v2.2 | v2.3 | league |
|---|---|---|---|
| bat direction, all swings | 9.3 ± 20.9 | 1.2 ± 17.9 | 0.4 ± 19.0 |
| bat direction, balls in play | 6.1 ± 11.8 | −1.3 ± 10.9 | −0.5 ± 12.3 |
| hitters' own means | 9.0 ± 5.4 | 1.0 ± 5.1 | 0.3 ± 4.3 |
| spray: ground balls / liners / flies | 9.4 / 4.4 / −2.2 | 8.5 / 5.4 / −1.6 | 15.4 / 5.7 / −2.8 |
| squared-up per contact / per foul (contact_score) | .510 / .342 | .477 / .288 | .435 / .225 |
| runs per team-game (seeds 3, 11, 29) | 3.77-4.00 | 3.52-3.81 | 4.39 |
| K% / BB% / HR% | 20.5-21.2 / 8.3-8.8 / 2.9-3.5 | 21.1-21.6 / 8.4-8.8 / 2.8-3.2 | 22.6 / 8.2 / 3.0 |

What it did, in these runs: the bat now meets the ball square to centre, as the league's does, liners and fly balls go where the league's go, and contact came nearer the league's squared-up rate without being fitted to it (the face's scatter about the path makes more contact a little off square). Ground balls go less to the pull side than the league's, runs fell about 0.15 a game, and fouls on square contact stayed at .31: left as mysteries.

### The contact rebuild, stage 1: the swing's reach and read (bb_engine v2.2; 2026-10-03)

Joe asked for the contact rebuild after the miss-distance diagnosis. **The scorecard.** `headless/contact_score.js` measures, in one table with one score, every target of what a swing becomes: whiffs, fouls and miss distances by pitch kind (A), squared-up per contact, ball in play and foul (B), the vertical miss of contact - launch angle minus attack angle - by band with its foul and squared-up shares (C), and whiffs and misses beyond 3 in by how far outside the zone the pitch crossed, for each kind (D; `statcast/misses.py` v0.2). **Familiarity, fixed in every tool.** In games a batter has seen the pitcher a median 9 times when he swings (mean 12.6, 90th percentile 28); the check and fit tools had drawn 0-80 uniformly, so they measured batters far more used to the pitcher than in a game, and their whiffs ran about .03 under the games'. They now draw 40 × u × u pitches at the start of each plate appearance. Runs: random and local searches over seven constants in scratch copies of the engine (contact_score, 600 hitters × 40 PA, seed 5); a read grid checked in 300 games; the chain (`tools/hitter_value.js`, `tools/pitcher_value.js`, `tools/fit_population.js`, `tools/fit_swing_policy.js`); the suite at seeds 3, 11 and 29; `headless/level_check.js` at levels 1 and 2.

**What the league's misses said, by reach.** Fastballs in the zone whiffed .136 with almost no big misses (.004 of swings beyond 3 in); 3-6 in outside, .361 and .063. The model matched in the zone but fell apart off the plate (.523 and .237 at 3-6 in): its swing errors doubled 3 in outside the zone. Breaking balls in the zone whiffed .166 in the league with .045 of swings missing by 3+ in - fooled swings - and the model's almost never missed big (.006).

**What was built (each fitted to those tables, the league's whiffs by pitch kind and strikeouts in games):**
- **Reach.** A swing's errors double 6.3 in off the zone, not 3 (`coverage` ×2.1).
- **The read.** A fooled batter reads half of a pitch's sideways and vertical motion by his commit look (`DIR_READ` 0.5; it had read all of it since v1.3), so a fooled breaking ball is missed by inches, not a couple.
- **Looking fastball.** Sitting on a fastball, his eye is ready for any of the pitcher's fastballs (he tracks a sinker he did not guess as well as the four-seamer he did), but he still hunts only the one he guessed: the swing decision counts another fastball as the pitch he sat on only if he did not pick it up. (Letting the rule reach the decision, as tried before, made him swing at every fastball and broke swings by pitch kind.) He leans harder to guessing a fastball (`fbLean` 1.87, was 1.3).
- **The scatter.** Along the barrel 12% narrower with the aim 1.4 in toward the hands (fewer misses past the end), vertical motor scatter 40% wider (`motorIn` 0.87), pitch spotting 9% wider (4.9 in).
The scouts' values, the pool and the swing thresholds were refitted.

| (game familiarity; contact_score seeds 5 and 9) | v2.1 | v2.2 | league |
|---|---|---|---|
| contact scorecard, rms over 90 targets | .089-.090 | .074-.075 | |
| whiffs per swing: fastball / breaking / off-speed | .24-.25 / .24-.26 / .21-.22 | .21-.23 / .33-.34 / .30-.32 | .174 / .310 / .301 |
| fastball swings missing by 3+ in | .070 | .037-.041 | .014 |
| breaking-ball swings missing by 3+ in | .076 | .094-.101 | .155 |
| four-seam whiffs, under 92 mph → 98+ | .22 → .31-.36 | .18-.20 → .28 | .139 → .248 |

| (games, seeds 3, 11, 29) | v2.1 | v2.2 | league |
|---|---|---|---|
| runs per team-game | 3.77-3.91 | 3.77-4.00 | 4.39 |
| K% / BB% / HR% | 20.5-21.3 / 7.8-7.9 / 3.1-3.5 | 20.5-21.2 / 8.3-8.8 / 2.9-3.5 | 22.6 / 8.2 / 3.0 |
| BABIP | .262-.268 | .257-.263 | .291 |
| swing policy rms by count / by pitch kind | .019-.022 / .116-.121 | .019-.022 / .126-.139 | |
| Triple-A (level 2): BB% / HR% / hard-hit | 9.1 / 2.64 / .361 | 10.6 / 2.76 / .381 | 10.8 / 2.85 / .375 |

What the stage did, in these runs: whiffs by pitch kind came into the league's order (the inversion of known gap 2), fastballs lost half their big misses, and four-seam whiffs by speed came within .02-.05 of the league's above 92 mph with the league's slope; one level down, walks, home runs and hard contact came to Triple-A's. The scouts' pitcher value gave speed about 4 wOBA points per sd (v2.0 about 3.4); a setting that fooled batters more gave it 7, by making fast pitches harder to pick up, but struck out 24%. What it left: fastballs still whiffed .21-.23 against .174 and slow ones .18-.20 against .139 (the rest of the big misses off the plate); in-zone contact .80 against .85 in games, with breaking balls in the zone missed too often and those that dive out of it too rarely (the model's fooled swings do not yet gather on the pitches that leave the zone); breaking balls' big misses .10 against .155. Stage 2 is the bat's direction and spray (the bat faces 6-11° too far to the pull side, the collision's sidespin slices fly balls 20° too far); stage 3 glancing contact and fouls.

### Defence in the farm (bb_engine v2.1, field_value v0.1, fit_population v0.2; 2026-10-03)

The Triple-A test (v2.0) found the model's defence did not step down with level: the farm picked position players on their bat alone, and the fielding traits were drawn the same at every level, so the model's level-2 BABIP sat below its level 1 while Triple-A's sat .026 above the majors'. Runs: `tools/field_value.js` (3,000 balls in play × 400 test fielders per position, seed 5), `tools/fit_population.js`, `tools/fit_swing_policy.js` (three passes), the suite at seeds 3, 11 and 29, `headless/level_check.js` (400 games at levels 1, 2, 3 and 6 for each seed).

**What a fielder is worth, measured by the engine.** `tools/field_value.js` plays the engine's own balls in play (picked hitters against picked pitchers) through a defence of average fielders with one test fielder from the pool at the position, the same balls with the same random numbers in every trial, and regresses the run value allowed per ball (single .74, double 1.05, triple 1.32, reached on error .74, above an out) on his traits. R2 .92-.98 at every position. One sd of each trait, in runs per 1,000 balls in play: at shortstop reaction 2.7, route 2.1, transfer 1.1, speed 0.7, arm 0.6; in the outfield route 2.7-3.1, speed 1.9-2.2, reaction 1.3-1.6; at first base everything under 1.1. One sd of fielding came to 0.09-0.10 runs a game at shortstop and in the outfield, 0.04 at first base, against 0.18 for one sd of hitting.

**What was built.** The scouts judge a position player in runs per game: his expected wOBA over 4.2 plate appearances (wOBA scale 1.23) plus the runs his fielding saves at his position over the 25 balls in play a team allows (`FIELD_VALUE`); a designated hitter and a catcher by the bat alone (framing and throwing not valued yet). A player drawn without a position is now a major leaguer at a random lineup position, so the tools see the same mix the games do (the swing thresholds had been fitted on designated hitters, picked on hitting alone, and walks fell half a point until this was changed). The pool was refitted with the picks drawn across the nine lineup positions: sprint speed so the major leaguers run the league's 27.34 ± 1.35 ft/s (2025 Statcast hitters; pool 27.18 ± 1.30), and the other fielding traits keeping their calibrated means among them (pool reaction 0.476 s against 0.461 among the major leaguers, route 0.890 against 0.899).

| | v2.0 | v2.1 | league |
|---|---|---|---|
| runs per team-game | 3.88-4.00 | 3.77-3.91 | 4.39 |
| BABIP | .272-.276 | .262-.268 | .291 |
| K% / BB% / HR% | 21.1-21.6 / 7.9-8.3 / 3.0-3.3 | 20.5-21.3 / 7.8-7.9 / 3.1-3.5 | 22.6 / 8.2 / 3.0 |
| stolen bases per team-game | 0.53-0.59 | 0.67-0.79 | 0.47 |
| BABIP, levels 1 / 2 / 3 / 6 | .276 / .264 / .261 / .251 | .265 / .265 / .274 / .273 | majors .289, Triple-A .315 |

What it did, in these runs: the better gloves went where they count, so BABIP in the majors fell about .008 and runs about 0.1; defence now steps down with level, holding BABIP level from level 1 to 2 while contact softens (hard-hit .406 to .361) and raising it below; and the major leaguers run the league's measured speed, which raised steals above the league's (the steal decisions were set when runners averaged 27.0 ft/s). What it left: Triple-A's BABIP is still .050 above the model's level 2. If the pool held a wider range of fielders than the majors' (its spreads are the majors' calibrated ones), or the scouts weighed defence more, the levels would separate further.

### How far swings miss: measured (2026-10-03; engine unchanged at v2.0)

Statcast records a whiff's **miss distance**: the gap at closest approach between the ball and the barrel half of the bat (label to tip). `statcast/misses.py` measured it over the 42 days of 2025 (78,224 swings) and `headless/miss_check.js` measures the model's swings the same way (picked hitters × 40 PA against the engine's pitchers).

| share of swings | whiff | miss 0-1 in | 1-3 in | 3-6 in | 6+ in | median miss |
|---|---|---|---|---|---|---|
| fastballs, league | .174 | .099 | .060 | .010 | .004 | 0.9 in |
| fastballs, model | .235 | .097 | .071 | .034 | .033 | 1.4 in |
| breaking, league | .310 | .067 | .087 | .064 | .091 | 3.0 in |
| breaking, model | .241 | .102 | .066 | .032 | .041 | 1.4 in |
| off-speed, league | .301 | .058 | .108 | .072 | .063 | 2.6 in |
| off-speed, model | .212 | .078 | .058 | .031 | .044 | 1.7 in |

- **The league's fastball whiffs are near misses**, and they grow with speed while the misses stay small: four-seamers under 92 mph whiffed .139 with a median miss of 0.7 in; 98+ whiffed .248 with a median of 0.8. Beyond 3 in: .006 and .013 of swings.
- **The model's fastball whiffs carry a big-miss tail**: 6.7% of swings missed by more than 3 in (league 1.4%), about the whole of its excess whiffs. 60% of those big misses were along the barrel - past the end or inside the hands - on pitches the batter expected: the along-barrel scatter (`longSD` 3.8 in, plus the hands' share of the pitch's distance in or out) gave contact along the barrel an sd of 6.3 in. The vertical scatter was already about the league's (sd 2.1 in on expected fastballs).
- **The model's breaking and off-speed whiffs miss by too little**: fooled swings are corrected for the curve already seen as if the batter read its direction perfectly, so they end a couple of inches off, where the league's run to a foot; and batters were fooled on 1% of breaking-ball swings.

**What was tried (not kept).** In scratch copies of the engine, a grid over the along-barrel scatter, how much of a pitch's sideways and vertical motion the batter reads by his commit look (`DIR_READ`, 1 now), pitch spotting, late steering, the fastball lean and a "looking fastball" rule (sitting on a fastball readies him for all of the pitcher's fastballs). Three findings:
1. Narrowing the along-barrel scatter to the league's miss tail (0.45 of now) brought fastball whiffs to .18-.19, but squared-up contact rose from .54 to .67 and EV50 from 100.4 to 102.2-102.8, with HR% 4.3-4.5: the along-barrel scatter is what holds the model's contact quality down. Geometry alone (a vertical scatter that makes whiffs near misses, squared up within about 1.6 in of centre) gives about .6 squared-up per contact against the league's .435, so the rest of the league's mishits come from somewhere the model lacks - along the barrel without misses (jammed contact?) or in the collision.
2. Reading 40-55% of the motion (`DIR_READ` 0.4-0.55), with the looking-fastball rule and a fastball lean three times today's, put breaking-ball misses beyond 3 in at the league's .155 and the four-seam speed slope at the league's without fitting it (.149 / .200 / .248 against .139 / .191 / .248, one seed). But the looking-fastball rule makes every fastball the pitch he sat on, and the swing decision's sitting thresholds then had him swing at fastballs far more than at breaking balls in the same place (.89 against .48 at the middle of the zone; league .76 against .71): swings by pitch kind went from rms .13 to .18.
3. The direction read alone kept decisions right (rms .125) and brought breaking balls to .287 and off-speed to .269, but fastball whiffs rose to .261.

So the swing's scatter along the barrel, contact quality, the read of a pitch's motion and the decision's sitting term have to be rebuilt together; one at a time each trades one gap for another. This is where velocity's value is decided too: the model's slow fastballs are whiffed too often because of along-barrel misses that do not depend on speed.

## The manager's moves (engine v2.5, bb_game v0.9, 2026-10-03)

Joe asked for intentional walks, pickoffs, defensive substitutions and double switches before the minor-league program, so the minors have them too. The league's counts come from the MLB Stats API team totals (pitching group), per team-game:

| | 2019 | 2022 | 2025 | model (3 × 200 games) |
|---|---|---|---|---|
| intentional walks | .155 | .098 | .114 | .105-.122 |
| pickoffs (by the pitcher) | .051 | .046 | .066 | .048-.065 |
| throws over to first | not public | not public | | 1.03 (about one assumed) |
| defensive substitutions | not counted | | | .26-.29 |
| double switches, per NL team-game | not counted | | | .42-.46 |

- **The intentional walk** is signalled (the 2017-2022 rule: no pitches). The manager puts a hitter on with first base open and a man in scoring position, late (the 7th on, or with the pitcher on deck and two out) and close, when the next hitter is weaker by more than his own bar, `ibb` (expected wOBA: the scouts' `hitterValue`; mean .075, sd .025, plus .03 with nobody out, less .015 from the 9th). The bar's mean was sized to the league's count; every other piece is the situation.
- **The pickoff.** With a man on first and second open the pitcher throws over before a pitch with a chance that rises with the runner's threat to steal (his own odds of making it) and falls by half after each throw. The runner is back if his dive beats the throw: half his `jump` plus a 3.5 m primary lead at 6 m/s, against `PK_T` (0.915 s) plus the pitcher's new `pickMove` trait (sd 0.06 s), with scatter on both. `PK_T` sets how often a throw gets him (about 5%), `PK_RATE` how often pitchers throw; neither the move nor the throws are timed publicly, so both are sized to the league's pickoffs and an assumed throw a game. 1.2% of throws get away (a base, now and then two). A third out on a pickoff ends the plate appearance before a pitch (the batter leads off next inning, as after a caught stealing).
- **The bench** is four men drawn for a catcher, a utility infielder (short, second, third), a fourth outfielder and a first baseman, from the level below the team's: a regular is the best of the farm's six candidates, a bench man the next best. Letting the better of a starter and a bench man start made four positions the best of twelve and raised runs by about half a run a game, so it was taken out. The NL pinch-hitter is now the best bat on the bench (the backup catcher last).
- **Late defence.** From the 8th, with a lead of one to three, a bench man replaces a fielder (not the catcher) when the runs his glove saves over the innings left (`FIELD_VALUE` × 25/9 balls in play an inning) beat the runs the bat costs over the plate appearances left (expected wOBA × 4.2/9 an inning ÷ 1.23), by the manager's own bar `glove` (mean .012 runs).
- **The double switch (NL).** Bringing in a pitcher whose spot bats among the next two, with two or more men on the bench, the manager also takes out the fielder whose turn is furthest off; the new pitcher bats in his spot and a bench man who can play his position in the pitcher's.
- **The league line held** (three seeds × 200 games against the same runs on main): runs 3.73-3.87 against 3.80-4.03, BB% 8.0-8.9 against 8.2-8.6 (it now counts intentional walks), K% and HR% within noise.
- **Not modelled:** the first baseman holding a runner on at the bag (the fielding layer plays him at his usual depth, so a pickoff shows him hurrying over); pinch-runners; balks (.025-.037 a team-game).
- The plays now record the outs and bases a batter came up to; a steal or a pickoff during his at-bat had leaked into them, so a caught stealing in an at-bat changed the outs his introduction gave.

## Athleticism (engine v2.6, 2026-10-03)

Joe: "a deeper trait upon which power, strength and speed depend." Each position player now has an athleticism, one standard normal drawn before anything else about him. His swing power per kg, his arm strength and his sprint speed are each drawn as their own normal loaded on it, so each keeps its own spread; sprint speed also falls with body mass. Pitchers' fielding is drawn as before.

- **The league's correlations** (2025, qualified hitters; power/kg is Savant's proxy, bat speed cubed over swing length per kg): power/kg ~ sprint +.462 (n 226), power/kg ~ arm +.292 (199), sprint ~ arm +.366 (395), weight ~ sprint −.373 (579). A single shared trait fits all three pairs at once: the loadings the league's numbers imply are .60, .77 and .48.
- **Fitting them among the picks** (`tools/fit_population.js` v0.5) needed two things the pure one-factor sum leaves out. First, the league's arm strength comes from infielders' and outfielders' throws, so the pairs with arm are taken over picks who are neither catchers nor DHs. Second, much of sprint ~ arm comes from positions (catchers, first basemen and DHs slow with weak arms; centre fielders and shortstops fast with strong ones), and the power proxy carries the bat's mass and the weight exponent; each round holds what a pair has beyond the shared trait as measured and asks the shared trait for the rest. The first try, which treated the picks' correlations as one factor, drove the power loading to its cap and left the picks at .35 / .20 / .41.
- **Result:** loadings 0.95 (swing power), 0.50 (sprint), 0.41 (arm), and −0.39 sd of sprint per 20 lb. Among the picks: power/kg ~ sprint .46, power/kg ~ arm .26-.30, sprint ~ arm .36-.39, weight ~ sprint −.36. The test, not fitted: bat speed ~ sprint +.04 (league +.09) and bat speed ~ arm +.18 (+.18). So nearly all of a hitter's power per kg is his athleticism; the proxy's other parts (his bat, his weight) carry the rest of its scatter.
- **The league line held** (seeds 3, 11, 29 × 200 games against engine v2.5): runs 3.66-3.95 against 3.73-3.87, BABIP .260-.264 against .256-.259, HR% 3.1-3.6 against 3.0-3.3, K% and BB% unchanged.

## The league (bb_league v0.1, 2026-10-03)

Joe: minor leaguers face minor-league pitchers, so a good minor leaguer should hit worse when he is promoted; build a big minor-league program headless and pull the best into the majors. `bb_league.js` builds thirty organisations, each with a major-league club and a club at each level below (Triple-A, Double-A, High-A, Single-A, Rookie), every club a standing roster of 26 drawn at its level by the farm. Each level plays its own schedule; at the end of a season each organisation swaps men between adjacent levels when a man below outscores a man above (its scouts' estimate, standardised over the world, plus his season against his own level shrunk by playing time; at most two hitters, two starters and two relievers per boundary). Nobody ages or develops yet. `tools/build_stable.sh 1 3 60` played three seasons of 60 games a club (16,200 games, 12 minutes) and wrote the stable the screen loads.

The levels in the third season:

| level | wOBA | K% | BB% | HR% | runs/team-game | hitters' bat speed | starters' four-seam |
|---|---|---|---|---|---|---|---|
| majors | .305 | 19.9 | 8.9 | 3.4 | 4.06 | 71.2 | 94.1 |
| Triple-A | .295 | 21.7 | 9.6 | 2.9 | 3.78 | 70.1 | 93.8 |
| Double-A | .284 | 22.2 | 10.2 | 2.3 | 3.45 | 69.1 | 93.7 |
| High-A | .289 | 21.4 | 10.6 | 2.3 | 3.62 | 68.6 | 93.0 |
| Single-A | .283 | 23.4 | 10.7 | 1.9 | 3.42 | 68.1 | 93.5 |
| Rookie | .280 | 24.5 | 11.6 | 1.6 | 3.29 | 67.4 | 92.9 |

The promotion drop (hitters with 100+ PA in the season before and the season after):

| move | n | before | after | drop | good seasons that stayed: before → after |
|---|---|---|---|---|---|
| Triple-A to the majors | 68 | .341 | .303 | .037 | .339 → .319 |
| Double-A to Triple-A | 74 | .345 | .306 | .038 | .335 → .307 |
| High-A to Double-A | 81 | .325 | .300 | .026 | .333 → .308 |
| Single-A to High-A | 69 | .323 | .292 | .031 | .323 → .305 |
| Rookie to Single-A | 71 | .322 | .288 | .035 | .323 → .304 |

- **The drop has two parts.** Hitters who stayed at a level after a good season (30+ points over its mean) fell back about .020 the next year: the regression any selected season shows. The promoted fell .026-.038, so about .006-.018 of the drop is the better pitching above. From Triple-A to the majors: .037, of which about .017 is the step up and .020 the regression.
- **But the levels themselves run the wrong way.** The majors out-hit Triple-A here (.305 against .295) while the league measured alike shows Triple-A out-hitting the majors (2025: OBP .347 against .309, SLG .420 against .403) and walking far more (10.8% against 7.8%; the model's Triple-A 9.6). Hitters step down the levels faster than pitchers: the starters' four-seam speed falls 1.2 mph from the majors to Rookie ball, where the bat speed falls 3.8. The farm judges pitchers by PITCHER_VALUE, which values velocity at almost nothing (open mystery 5), so the pitchers it leaves for the levels below are nearly as good as the majors'. The step-up part of the promotion drop is small for the same reason.
- The first build let any hitter catch (shortstops and centre fielders caught, with no catcher's arm or blocking), and its games scored a fifth fewer runs; only catchers catch now.

## What was learned building the fielding layer

- **Statcast's outfield JUMP (about 30 ft covered in the first 3 s) is the right anchor for outfielder motion.** The first fielders covered 44 ft in 3 s and caught nearly every fly ball (fly-ball BABIP .03). Slowing everyone to the jump figure fixed the outfield but let 52% of ground balls through, so infielders got their own harder acceleration and a dive reach. That's a real difference: they work from a crouch on a ball that is on them at once.
- **Triples ran at 3× MLB until long throws went through a cut-off man.** Two short throws beat one lofted one, and once the runners' estimate knew that, triples fell from 0.42 to about 0.2 a game before the outfield slowdown raised them again.
- **Starters went eight innings** until the manager's hook mean dropped to 0.5 and relievers were swapped between innings after about a dozen pitches.

## Gaps at the game level, to fix with mechanisms

1. **Runs are low (2.8 vs 4.4)** because the plate-appearance layer's gaps compound: fewer home runs, more strikeouts, more pop-ups. Fix those first; do not tune fielding to hide them.
2. **Triples: closed** in v1.5 (0.09-0.10 vs 0.14) with the measured outfield jump, positioning and bounces; runners now read the race with error.
3. **Double plays: closed** in bb_field v0.5 (0.75 vs 0.72) once the throw to second had to wait for the covering man. Fielder's choices (about 5% of balls in play) are still worth a look.
4. **Extra innings 14–18% (vs 8%)** follow from low scoring.
5. **Not built yet:** situational positioning (infield in, no-doubles, the first baseman holding a runner), the infield-fly rule, pinch-runners, balks; the cut-off man is a timing rule rather than a moving player. (Steals, wild pitches and passed balls: built 2026-09-30; pickoffs, intentional walks, defensive substitutions and double switches: 2026-10-03, see above.)
6. **A low line drive can only be fielded once it lands.** `intercept` walks the ground track and `catchChance` looks only at the landing point, so a liner that passes an infielder at chest height goes through untouched (about one in 30 games passed within a metre of a man who had time to react). Measured while checking Joe's "balls roll past the fielder" report: in 30 games, 60 balls passed within the drawn dot's radius (1.8 m) of a man who did not field them; 52 were the pitcher and 48 passed before that man's reaction time was up, which is a comebacker, not a defect. The screen now shows the late lunge.

## Open mysteries (Joe, 2026-10-03: left until the whole model is built)

Where the model and the league disagree and no believable mechanism has been built for it yet. They are recorded, not tuned away; each may close when a missing piece of the model arrives, and the deeper tuning waits until then. (Engine v2.4, seeds 3, 11 and 29 unless noted.)

1. **Runs are low:** 3.8-4.0 per team-game against 4.39, with BABIP .258-.260 against .291 and doubles 1.05-1.10 against 1.6; hard-hit .388 against .419 in games.
2. **Ground balls are pulled less** than the league's (8.5 deg against 15.4), with the bat meeting them a little more toward the opposite field than the league's (−6.0 against −3.1).
3. **Fouls on square contact:** .31 of contact struck square vertically goes foul, against .21; the model's fouls are mostly balls met out front and pulled foul, the league's mostly glancing contact at ordinary depth. Glancing contact itself is rarer than the league's (launch minus attack angle beyond 40 deg: about .12 of contact against .23).
4. **In-zone contact** .80 against .85 in games: breaking balls in the zone are missed too often and those that dive out of it too rarely (fooled swings do not gather on the pitches that leave the zone).
5. **Slow fastballs are missed too often** (four-seamers under 92 mph .18-.20 against .139), so the scouts value speed less than the league's results would, and one level down the pitchers' speed steps down a third to a half as much as Triple-A's.
6. **Triple-A's BABIP** is .026 above the majors'; the model's level 2 matches its level 1. Triple-A's hitters also chase less than the majors' (the model's chase a little more).
7. **Errors** 0.8 a game against 0.55; **steals** 0.55-0.66 against 0.47.
8. From before: K% ~ release height has the wrong sign (+.16 against −.22), BB% ~ arm angle is flat (+.20 in the league), uphill swings cost too many whiffs (attack ~ whiff +.66 against +.53), bat speed ~ whiff is under half the league's (+.26 to +.35 against +.69), liners at 15-20 deg carry 10-20 ft too far.
10. **Down the levels the pitchers stay too good** (the league, bb_league v0.1): the majors out-hit Triple-A (.305 against .295) where the real Triple-A out-hits the majors and walks 3 points more; promotion from Triple-A costs a hitter about .017 beyond regression to the mean. Same root as 5.
9. **Swings far off the plate** run below the league's (9+ in outside: .00-.02 of pitches at 0-0 against .04-.06) since batters check their swings; chase .258 against .283.

## Known gaps, to fix with mechanisms rather than knob-turning

1. **Contact: fouls are as many as the league's but too solid; the hardest contact is still a little soft.** (Balls in play falling in too often was fielding, closed in v1.5: BABIP .265-.277 against .291.) After bb_engine v1.1 (the adjusted swing; see that section above), fouls were .49-.50 of contact against .52, but squared up per contact stayed .49-.52 against .435 and per foul .36-.39 against .225. Mean exit velocity on balls in play came to the league's (88.1-88.9 against 88.9), but EV50 ran 98.9-99.2 against 100.6 and home runs 1.7-1.9% of plate appearances against 3.0. BABIP ran .349-.359 against .291 with v1.3, which carried batting average to .275-.284 (.243) and slugging to .453-.465 (.399) once strikeouts came to the league's. Off-speed pitches met far out front were still squared up .51-.54 of the time against .32. The league's high pitches went foul .66 of the time; the model's .46-.47, with the foul share lowest in the upper zone rather than the lower zone.
2. **Whiffs by pitch kind: in the league's order since v2.2** (the contact rebuild's stage 1: reach, the read, looking fastball). Left: fastballs .21-.23 against .174, slow four-seamers .18-.20 against .139; in-zone contact .80 against .85, breaking balls in the zone missed too often and those diving out too rarely. With v1.3 (fooled-swing contact), whiffs ran .229-.259 per swing against .232 and K% 23.4-23.8 against 22.6. Fastballs were whiffed .23-.26 (.17), breaking balls .23-.27 (.31) and off-speed .20-.22 (.30): batters chased breaking balls far outside too rarely, and fastballs chased outside the zone missed too often (.45 at 2-4 in against .31). Flat four-seamers were whiffed more and squared up less, as in the league, but their launch angle rose about twice as much as the league's, and low fastballs still launched above low breaking balls. **Velocity (measured 2026-10-03, v1.9):** four-seamers swung at, by release speed, under 92 mph to 100+: league whiffs .138 → .319 with exit velocity on balls in play flat (91.3 → 89.6) and expected wOBA on contact flat (.414 → .393); the model's whiffs .212 → .328 (the slow fastballs missed far too often, so the slope is two-thirds of the league's) with contact as flat as the league's. Fouls per four-seam swing: league .47-.50, model .33-.35. So velocity's value runs through whiffs on slow and medium fastballs, and that is where the model is off - which is also why the scouts' PITCHER_VALUE hardly values speed (v1.8).
3. **Plate discipline: swings follow the league by count, not by pitch kind.** With v1.4 swing rates by count and distance from the zone matched the league's within .023 rms, pitch locations matched the league's band by band, and walks came to 8.4-8.5% against 8.2. By pitch kind the model still over-swung fastballs outside the zone and under-swung breaking balls (rms .15). Chase ran .257 against .283.
4. **Home runs: closed** in v1.5 (3.1-3.2% against 3.0%) once the batted-ball drag was refitted to the league's carry by exit velocity and launch angle. Liners at 15-20 deg still carry 10-20 ft too far.
5. **Spray is too centred.** Centre field took 42% against 34%, opposite field 20% against 26%; fair-ball spray sd 20 deg against 25 in every band of contact depth. With the fielding measured (v1.5) this is where the missing doubles are: balls down the lines.
6. **Hit-by-pitch: closed** in v1.4 (1.01% against 1.1%) once command was measured.
7. **Glancing contact makes implausible spin.** Pop-ups came off at a median 6,700-6,900 rpm in v0.9 (`power_chain` v0.4), where real ones run a few thousand. A partial grip (a share of the rolling impulse) fixed the spin and the pop-ups' exit speed but raised BABIP to .37 and cut fly-ball backspin to 800 rpm; a lower friction coefficient did little (see v0.9, tried and rejected). The tangential part of the collision still needs measured batted-ball spin by launch angle to be judged.
8. **The levels below the majors (v2.0, the Triple-A test).** The hitters step down as Triple-A's do; the pitchers' speed steps down a sixth as much (velocity is not valued: gap 2); defence steps down too little (v2.1: the farm values fielding now, and BABIP holds from level 1 to 2 where Triple-A's rises .026); discipline steps down where Triple-A's does not (chase). Steals run above the league's since the major leaguers run its measured speed (v2.1).
9. **Not built yet:** fielding, base running and every hit or out on balls in play; foul pop-ups caught; the game loop; managers and bullpens; fatigue recovery between innings; warm-up pitches; NL/AL rules; names.
