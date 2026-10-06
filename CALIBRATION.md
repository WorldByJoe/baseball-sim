# Calibration log

`CALIBRATION.md · v3.4 · 2026-10-06`

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

## Five hypotheses tested: A to E (engine v2.7, bb_field v0.9; 2026-10-04)

Joe asked for hypotheses A to E of the list below the open mysteries to be tested. Runs: the suite before and after (`headless/run_games.js` 200 games at seeds 3, 11 and 29; `contact_score.js` 600 x 40 at seed 5, and 1,200 x 40 at seeds 9 and 13 for four-seam whiffs by speed; `discipline_check.js` 400 x 40; `spray_check.js` 600 x 60; `bip_check.js` 300 games), scratch engines for each variant, and the league's pitch-level data (42 days of 2025) and team totals (MLB Stats API). After the engine change: `fit_swing_policy.js` five passes, `hitter_value.js`, `pitcher_value.js`, `field_value.js` and `fit_population.js`.

**A, the check swing works too well: confirmed, and changed (engine v2.7).** The check read the batter's picture at his last look, 25 ms after he commits. For a pitch he had already picked up, that picture was the same judgement his swing decision used, less the eye's random error - so the check judged every swing a second time without that error, and undid exactly the swings far off the plate his eye had misjudged. Now only a pitch he had not picked up at the commit point can be checked: a fooled one by what its curve has shown by the last look, a late pickup by his judgement (`checkChance` returns 0 once he has picked it up, so `fit_swing_policy.js` v0.4 counts swings the same way). Letting him check only late pickups, not fooled ones, gave similar swing curves (chase .286 against .301 before the refits). The check's constants were left as fitted in v2.4: refitted under the new rule they reach 3.1% of swings more than 10 mph under the hitter's mean only if nobody ever holds up (league 5.7%).

| | v2.6 | v2.7 | league |
|---|---|---|---|
| chase (discipline_check) | .253 | .275 | .283 |
| swings at 0-0, 6-9 / 9-12 in outside | .041 / .012 | .052 / .024 | .094 / .060 |
| fastballs swung at 9-12 in outside, all counts | .104 | .157 | .056 |
| breaking balls swung at 6+ in outside (share of swings; whiffs) | .062; .662 | .072; .616 | .103; .844 |
| breaking balls in the zone, whiffs | .292 | .271 | .166 |
| swings more than 10 mph under his mean; p1 | .046; −33.7 | .015; −11.4 | .057; −35.3 |
| K% / BB% (games, three seeds) | 20.2-21.0 / 8.8-9.2 | 21.7-21.9 / 8.2-8.4 | 22.2 / 8.4 |
| contact scorecard rms | .072 | .079 | |
| runs per team-game, with bb_field v0.8 | 3.75-3.94 | 3.87-4.00 | 4.45 |

What A did, in these runs: chase, strikeouts and walks came to the league's; swings far off the plate came halfway; the fastballs he no longer checks are chased far outside more than the league's (the swing curves by pitch kind were already off that way, known gap 3); and the slow-swing tail, which the old check had been fitted to, fell to a third of the league's - a new open question. The scorecard worsened, mostly in its table by reach.

**B, ground balls measured differently: about a third of the gap was the league's measurement.** The league's spray comes from the hit coordinates (hc_x, hc_y), from an assumed home plate at (125.42, 198.27). Fitted from 2025 balls in the air - their projected distance against the hit coordinates, four ways (all, caught flies, caught flies with a catch offset, home runs) - home plate sits at x 125.97-126.03, y 203.1-207.3, 2.36-2.41 ft per unit: the usual origin is about 7 units too shallow, which flings short balls toward the lines. With (126.0, 205.0), now in `statcast/bat_direction.py` v0.2, `bip.py` v0.2 and `swing_geometry.py` v0.3, the league's ground balls go 13.6 ± 21.6 deg pulled (was 15.4 ± 28.0), liners 5.4 ± 23.9 (5.7 ± 25.3), flies −2.5 ± 24.1 (−2.8 ± 25.5). Measuring the model's ground balls where its fielders took them, as the league's are, moved them only from 8.6 to 9.1 deg (seeds 3 and 11, 200 games each). The bounce: the model's ground balls carry 620 ± 1,790 rpm about their direction of travel, the only spin a bounce's friction turns sideways, and a rolling-friction first bounce would bend them 1.5 ± 4.7 deg toward the OPPOSITE field - the wrong way, so it was not built. What is left (about 4.5 deg) matches the bat: the model's ground balls are met with the bat pointing 6.5 deg toward the opposite field against the league's 3.1 (Statcast's attack direction, bat tracking rather than hit coordinates), and in the league a ball goes about 1.5 deg for each degree of the bat's direction. So the rest of mystery 2 is real contact: the model's ground balls come from contact met deeper than the league's.

**C, swing errors that ignore pitch speed: not supported.** The model's four-seam whiffs by speed at three seeds (contact_score, 600-1,200 hitters x 40 PA, seeds 5, 9, 13): under 92 mph .173-.195, 98+ .263-.350, a rise of .07-.17, about .11 on average - the league's rise (.139 to .248) is .11. The league's curve held with count, zone and pitch height fixed at the overall mix (.139, .170, .189, .210, .253), so the mix effect (hypothesis K) is not it either. The model's fastballs are whiffed about .04 too often at EVERY speed - about the excess of fastball swings missing by 3+ in (.039 against .014) - not more at the slow end. A scratch engine with the up-down and along-the-barrel scatter grown with time pressure, as the timing scatter already is, left slow four-seamers where they were (.175-.179) and raised 98+ (.279-.310), steepening a slope that already matched; the contact score worsened at both seeds (.0808, .0731 against .0755, .0680). Not built. Mystery 5 is restated, and mystery 10 no longer shares its root: velocity's value through whiffs is the league's.

**E, steal decisions out of date: the target was out of date.** The 0.47 stolen bases a team-game in `headless/run_games.js` was a pre-2023 figure (it matches 2019). The 2025 league (MLB Stats API team totals, now in `statcast/raw/2025/mlb_team_*.json`): 0.708 stolen bases and 0.203 caught a team-game, 78% safe; the base-stealing leaderboard (runners with enough chances) 0.528 and 0.135, 1.34% of chances. The model steals 0.64-0.65 and is caught 0.17 (79% safe): about a tenth fewer attempts than the league's, at its success rate. Nothing was changed. run_games v0.2 takes its whole MLB column from the 2025 team totals: runs 4.45, hits 8.26, doubles 1.59, triples 0.13, home runs 1.16, walks 3.16, strikeouts 8.36, errors 0.50 (throwing 0.255), double plays 0.75, wild pitches 0.29, passed balls 0.05; AVG .245, OBP .315, SLG .404, BABIP .291, K% 22.2, BB% 8.4, HR% 3.1.

**D, the error rule too strict: confirmed, and more besides (bb_field v0.9).** The model made 0.78-0.85 errors a team-game against 2025's 0.50 (half of them throwing errors, 0.255). By kind (seed 3, 300 games): fumbles 0.59, throwing 0.08, dropped catches 0.07; the league's play descriptions (42 days, 0.39 a team-game recorded): fielding 0.19, throwing 0.18, missed catches 0.02. Three things were wrong. (1) A ball he was under with time to spare was dropped 1.1% of the time (0.6 of his fumble rate, set by hand): now 0.15, fitted to the league's missed catches (0.018-0.022 a team-game over 600 games, league about 0.023). (2) A fumble that cost the out was always an error, however hard the chance; now only on an ordinary chance (no harder than a ball reaching him at 67 mph or a 10 m range), the scorer's ordinary effort. (3) A pickup's difficulty counted the ground covered for every fielder, so an outfielder running 25 m to a rolling single fumbled it about half the time, losing 1.2 s; 3.4 of a team-game's 16 fielded chances were fumbled. The ground covered now counts only for an infielder ranging on a grounder, and how much difficulty costs (`CLEAN_K`, 0.10 set by hand) was fitted to the league's fielding errors per ground ball - 1.45%, flat with exit velocity (1.3-1.9% from 70 to 130 mph): 0.015 gave 1.44-1.59% and kept ground-ball BABIP at the league's .24.

| | bb_field v0.8 | v0.9 | league 2025 |
|---|---|---|---|
| errors per team-game | 0.78-0.85 | 0.28-0.32 | 0.50 |
| fumbles scored errors / throwing / dropped catches | 0.59 / 0.08 / 0.07 | 0.16-0.17 / 0.07-0.08 / 0.02-0.03 | about 0.21 / 0.18 / 0.02 on balls in play |
| fielding errors per ground ball | 3.2-3.8% | 1.6% | 1.45% |
| doubles per team-game | 1.03-1.14 | 0.58-0.67 | 1.59 |
| runs per team-game (with engine v2.7) | 3.87-4.00 | 3.44-3.75 | 4.45 |

What D showed: the outfield fumbles were standing in for something the model lacks. Liners and fly balls landing 150-300 ft fell for hits about as often as the league's (200-250 ft: .73 against .80) but became doubles 2-3% of the time against the league's 9-12%, where before the fumbles made up much of the difference. An outfielder who runs into a gap must stop, gather and turn before he throws; the model's throws as soon as he picks the ball up. Doubles are now the biggest single piece of the runs gap. And errors are now too few: the whole shortfall is throwing errors, a third of the league's, which in the league are highest on weak grounders (1.9% of 70-80 mph grounders against 0.8% at 100-110: hurried throws), where the model's throw scatter grows only with distance.

## Joe's idea for the minors' pitching (2026-10-04)

Joe: for mystery 7, lower the mean of the pitching traits in the minors so good pitchers are rarer, perhaps trimming the variance; or break the pitchers' proximate traits into more distal traits, so quality pitching comes from the sparse perimeter of a joint distribution. Runs: `statcast/raw/pitches` and `pitches_aaa` (the same 42 days of 2025), the model's levels played against each other (400 players a level, 50,000 PA a side, seeds 3, 11, 29; level 2 with Triple-A's zone top 2.9 in lower), the model's major-league pitchers at 700 PA each, a farm simulation in Python, and a scratch engine.

**What the levels are, measured alike.** On expected outcomes - the engine's own expected wOBA by exit velocity and launch angle, which takes out defence, parks and luck on balls in play - the model's levels already step down as the league's do: level-2 game minus level-1 game xwOBA −.004 to −.013 against Triple-A minus the majors −.008; K% −0.4 to +1.0 against +0.1; hard-hit −.037 to −.043 against −.044; xwOBA on contact −.015 to −.025 against −.029. The real Triple-A out-hits the majors on balls in play: its actual wOBA runs .042 above its expected (.350 against .308), the majors' .003 (.319 against .316) - defence and parks, mystery 9. Matched players (20+ PA at both levels) showed the same split: a hitter moving up struck out 4.5 points more and walked 3.7 fewer with no change in his contact (xwOBA on contact +.002); a pitcher moving up gave up harder contact (+.051) and 3.6 points fewer strikeouts.

**Where the minors fall short: command.** Triple-A's 3-0 four-seamers scatter about each pitcher's own mean 12.7% wider across the plate than the majors' (8.53 against 7.57 in) and 8.7% wider up and down (9.40 against 8.65). The model's level 2 is 1.5-2.0% and 3.2-3.7% worse than its level 1; its whole pool is only 3.6% worse than its major leaguers (starters 7.45 against 7.19 in across). Walks step up 0.7-2.2 points against 3.1, fastballs slow 0.5 mph against 0.9-1.2.

**Why: the farm cannot see pitching quality.** The scouts' estimate of a pitcher spans .014 of wOBA (sd), and their judgement error, set by hand, is .015: the ranking tracks command at about .58 (the estimate itself at .86). Hitters get the same error on an estimate three times as wide. And the model's pitchers are not too alike - their true spread among major leaguers (sampling noise removed) is K% .059-.062, BB% .033, expected wOBA against .029-.031, against the league's .044, .015 and .028 (2025 pitchers with 100+ PA in the 42 days) - so hypothesis F is wrong: the scouts' trait estimate sees about a fifth of the differences the engine makes. Too many wild pitchers reach the majors (walk rates spread twice as widely as the league's) and too few stay below.

**The farm simulation.** A pool fitted so the best of six has the majors' command (7.2 in, sd 7%): with perfect sorting the next level is 6.9% wider, with the scouts tracking command at .6, 3.0%. Four distal traits added, joined so all must be good (weakest link), or multiplied, gave 7.0%, 6.9% and 4.1% with perfect sorting: the shape of the pool barely moved the step. What moves it is how well the farm sorts.

**The prototype.** The scouts' judgement error on pitchers cut to 0.37 of today's (as sharp as on hitters, against the spread their estimate shows), and the pool refitted: the refit lowered the pool by itself (starters' fastball 93.2 to 92.8 mph, command 7.44/8.99 to 7.54/9.30 in) - Joe's rarer good pitchers. Level 1 to 2: command +2.5% / +5.6% (starters), fastball −0.51 / −0.66 mph, walks +1.5 to +1.8, the major leaguers' walk-rate spread .030; expected wOBA and strikeouts still stepped as the league's. About a third of the command gap closed. Not built.

**What it means.** Joe's mean-lowering is right for command, and it follows from the pool fit once the farm can tell pitchers apart; trimming the variance goes the other way (selection narrows the spread, so the pool must be wider than the majors). His joint distribution is already in the engine - repertoire, shapes, slot and command together make a pitcher, which is why a trait-by-trait estimate sees so little - so the useful form of the idea is a farm that judges pitchers by what that joint distribution produces, their results, as real organisations do. Two other gaps would leave command short even then: Triple-A's pitchers are 1.8 years younger and still learning command (the model has no development), and a wild pitcher in the model aims where everyone does instead of more over the plate.

## S, J, Y and Z: the outfielder's stop and turn, the runners' sends, aiming to command, and what the scouts see (engine v2.8, bb_field v1.0; 2026-10-04)

Joe asked for hypotheses S, J, Y and Z. Runs: a probe of the batter-runner's race on every outfield single; `headless/xbt_check.js` (new: how far runners go, as `statcast/baserunning.py` measures the league's) at 600-1,500 games; a sweep of the send margins; `statcast` pitch-level aim against scatter for both levels and the same measure on the model (`aim_model`, 300 pitchers x 180 PA, four to six seeds); 4,200 pool pitchers x 400 PA with their results in two halves; the arm-slot spread by level; the refit chain (swing policy, the scouts' values with `pitcher_value.js` v0.3 at 3,000 pitchers, fielding values, the pool) after each engine change; the suite and the level comparison (400 players a level, 50,000 PA a side, three seeds).

**S, the outfielder's stop and turn: confirmed, built (bb_field v1.0).** On the 4.3 singles to the outfield a team-game that stayed singles, the throw beat the batter-runner to second by a median 1.6 s; only 0.16 a game came within the 0.3 s he demands, so caution (J) could add at most a fifth of the missing doubles. The outfielder threw the instant he had the ball, at full speed in whatever direction he was running. Now he first sheds the part of his speed not carrying him toward his throw - all of it running across or away, none charging - braking at his own acceleration (ACC_F, an assumption), less what he could brake in any time he had to spare; on a catch too, before a throw against a tagging runner. Doubles came from 0.58-0.67 a team-game to 1.52-1.57 (league 1.59), triples 0.03-0.05 to 0.10-0.11 (0.13), slugging .351-.369 to .384-.406 (.404), and a runner on first scored on a double .31 of the time (.16-.21; league .39).

**J, base running too cautious: half right, refitted (bb_field v1.0).** After S the runners were too timid going home and too bold going to third, so one margin by outs could not fit both. Third and home now have their own (never make the first or third out at third; risk the plate, most of all with two out), fitted by a sweep to the league's extra bases taken: taking third [0.75, 0.75, 0.35] s, going home [0.7, 0.2, −0.4] s by outs (one margin, [0.6, 0.5, 0.2], before). Runners on second scored on a single .59-.60 of the time (.60), runners on first took third on a single .35 (.33) and scored on a double .41-.45 (.39). They are thrown out about twice as often as the league's (.03-.08 against .01-.03), most of all scoring from first on a double with two out; a sharper read of the race (READ_SD 0.10-0.15, against 0.25 set by hand) did not change that, so it was left.

**Z, aim that follows command: confirmed, built (engine v2.8).** In the league, per pitcher, pitch type and batter side (30+ pitches), the mean location's distance from the zone's centre fell 0.29 in for each inch of scatter about it in the majors (1,919 cells) and 0.31 in Triple-A (1,814); measurement noise in the mean would push it the other way. The model's slope was about 0 (−0.14 and +0.03 at two seeds) with the league's mean scatter and aim distance. Every target's distance from the centre is now scaled by 1 − AIM_CMD per inch his scatter is wider than 8.0 in; AIM_CMD 0.09, between 0.08 (slope −0.25) and 0.10 (−0.34), six seeds each.

**Y, the farm cannot see pitching quality: right as a diagnosis; seeing more did not make the minors wilder (engine v2.8).** 4,200 pool pitchers x 400 PA, their results split in two halves: true spread of expected wOBA allowed .0275, of which the scouts' estimate saw 18% (correlation .42). With what each pitch does against its type - how unusual its spin, efficiency and direction are, its seam break, the speed gap, role and stamina - a fitted estimate saw 39%; squares and products added nothing, and unusual direction counted most (11 points of wOBA per sd). Built into the scouts (`PITCHER_FEATURES`, `pitcher_value.js` v0.3), it exposed two flaws in turn:
- **The farm picked extreme arm slots** (major leaguers' arm angles 12.5 deg sd, level 2's 10.9; the league's majors 12.9 and Triple-A 12.4): the batter pictured each pitch from the league's average shape whatever the slot, so a slot's ordinary movement fooled him. **He now reads the slot** - his picture starts from the league's shape at that slot - and the levels' slots spread alike (12.7 and 12.7); unusual direction fell to a minor feature, and the major leaguers' strikeout spread came nearer the league's (true sd .050-.053 against .055-.060; league .044).
- **The farm picked breaking-ball pitchers** (the major leaguers' breaking share .356 against the league's .320) because the model's batters miss breaking balls in the zone too often: a farm that judges by results selects for the engine's flaws. The mix is now left out of the estimate (share .333).
On the final engine the pool's true spread is .0232 and the estimate sees 35% (the eight features refitted, 27%). But the minors are no wilder: level 1 to 2, starters' command +1.3% across and +2.2% up and down (v2.7 +1.5 / +3.7; league +12.7 / +8.7), fastballs −0.35 mph (−0.50; league −1.2), walks +0.1 to +1.7 points (+3.1). The estimate weighs command most (8 points per sd), but command's spread in the pool is narrow and the judgement error large. The major leaguers' walk rates still spread far wider than the league's (true sd .026-.027 against .015).

**The line, after all four** (seeds 3, 11, 29; against 2025):

| | v2.7 | v2.8 | league |
|---|---|---|---|
| runs per team-game | 3.44-3.75 | 3.85-4.07 | 4.45 |
| doubles / triples | 0.58-0.67 / 0.03-0.05 | 1.54-1.63 / 0.09-0.12 | 1.59 / 0.13 |
| AVG / OBP / SLG | .223-.234 / .296-.305 / .351-.369 | .224-.230 / .299-.307 / .392-.403 | .245 / .315 / .404 |
| BABIP | .259-.270 | .257-.263 | .291 |
| K% / BB% / HR% | 21.7-21.9 / 8.2-8.4 / 3.3-3.4 | 20.4-21.9 / 8.7-9.0 / 3.4-3.6 | 22.2 / 8.4 / 3.1 |
| chase | .275 | .258 | .283 |
| double plays | 0.64-0.69 | 0.54-0.59 | 0.75 |
| runner on first scores on a double | .16-.21 | .38-.42 | .39 |
| aim against scatter (in per in) | about 0 | −0.31 | −0.30 |
| arm-slot spread, level 1 / level 2 | - | 12.7 / 12.7 | 12.9 / 12.4 |

The doubles, slugging and extra bases came to the league's. The batter who reads the slot is fooled less, so strikeouts and chase fell a little and walks rose; home runs rose to 14% above the league's (wilder pitchers now miss over the middle), and double plays fell a quarter below it.

## U and G, first measurements: the vertical miss by pitch height, and the bat's grip (engine v2.8; 2026-10-04)

Joe asked for the hypotheses in the order ranked, U and G first. Runs: the league's pitch-level contact (42 days of 2025, 52,925 fouls and balls in play with bat tracking) by pitch height as a share of the batter's zone; the model the same way (600 hitters x 40 PA, seed 106; `contact_score.js` 600 x 40 at seed 5); scratch engines only - nothing was built.

**The model's vertical miss hardly depended on pitch height.** Launch angle minus attack angle, by height (0 = the bottom of the zone, 1 = the top):

| height | below | 0-.25 | .25-.5 | .5-.75 | .75-1 | above | mean |
|---|---|---|---|---|---|---|---|
| league LA | −2.8 | +6.4 | +15.2 | +25.0 | +31.6 | +35.4 | |
| league AA | +12.0 | +9.9 | +8.1 | +6.6 | +5.7 | +5.0 | |
| league LA − AA | −14.8 | −3.5 | +7.0 | +18.4 | +25.9 | +30.4 | +10.3 |
| model LA − AA | −1.9 | +1.1 | +3.3 | +6.0 | +9.2 | +9.1 | +4.3 |

The league's launch angle climbed 38 deg from low pitches to high, the model's 7; the spread within each band was alike (league 27-34 deg, model 29-32). The model's barrel offset D rose only 0.4 in across the zone, and at about 23 deg of launch per inch of D (the model's own slope, at every friction tried) the league's curve needs about 1.5 in. Real hitters met high pitches under the middle of the ball and low ones over it, as if their aim were pulled toward the middle of the zone. Breaking balls were topped more than the league's in every band (8 to 15 deg below fastballs against the league's 7 to 9): recognised breaking balls kept a misread of −1.45 in (the RESID_S share of the gap to the pitch expected), while those sat on were misread +0.16.

**A pull toward the middle reproduced the curve.** A scratch engine added D += k (pitch height − the zone's middle). With k = 0.11 in per in and the aim under the ball raised 0.4 in, the model's curve was −16.0, −5.8, +5.9, +17.2, +26.6, +30.6 against the league's −14.8, −3.5, +7.0, +18.4, +25.9, +30.4 (mean +8.1 against +10.3). It is the up-down twin of HAND_MISS, by which the hands already cover only 70% of a pitch's distance inside or outside.

**But whiffs by height did not follow.** Whiffs per swing, low to high:

| | below | 0-.25 | .25-.5 | .5-.75 | .75-1 | above |
|---|---|---|---|---|---|---|
| league fastballs | .345 | .122 | .102 | .131 | .198 | .366 |
| model fastballs, as built | .220 | .158 | .179 | .199 | .221 | .327 |
| model, k .11 + aim .4 in | .190 | .121 | .165 | .248 | .378 | .607 |
| league breaking balls | .602 | .271 | .147 | .129 | .181 | .317 |
| model breaking balls, as built | .428 | .298 | .297 | .289 | .256 | .259 |

The league's whiffs sat at the edges of the zone and fell to .10-.15 in the middle; the model's were flat, too many in the middle and too few at the edges. The pull moved whiffs toward the edges, the right shape, but it overshot fastballs up (high fastballs swung under, .38 and .61) and left low fastballs short (.19 against .345), and fastball whiffs overall rose from .210 to .24-.29 (league .174). Shrinking the random up-down scatter (motor x0.65-0.8) barely lowered them: the excess middle-zone misses come from elsewhere, most likely the misses along the barrel (hypothesis V: the excess of fastball swings missing by 3+ in). The best overall contact score of the grid (.0715 against .0775 as built, k .08) came with fastball whiffs of .238.

**G: the grip did not change the launch angles.** The friction cap at 0.5, 0.35 and 0.2 left the launch per inch of D at 22.4-23.0 deg and contact struck 60+ deg under the ball at .010-.017 of contact against the league's .045; it moves spin, which needs published batted-ball spin by launch angle to judge (as v0.9 found). So G is not the other half of U.

**Where this leaves U.** Confirmed as a missing mechanism (the up-down aim does not follow pitch height as the league's does), not built: alone it trades the launch-angle curve for fastball whiffs above the zone. Next: build it with V (misses along the barrel that should connect weakly), which lowers fastball whiffs at every height, and judge the pair on the launch-angle and whiff curves together; G waits for spin measurements.

## U built with timing; DM and CS tested (engine v2.9; 2026-10-04)

Joe asked for the next hypotheses in the order suggested: U with V, then DM and CS. Runs: the league's pitch-level contact and swings (42 days of 2025) by pitch height, kind and contact depth about each batter's mean; MLB Stats API season totals for 2025 pitchers; the model measured the same way (`probe`: 400-600 hitters x 40 PA, seeds 106 and 211); the model's misses taken apart by reason and by the parts of the barrel's offset; scratch engines, then a random search over five constants scored on 46 targets at once; the refit chain (swing policy, the scouts' values, the pool); the suite before and after (three seeds of 200 games, `contact_score`, `discipline_check`, `spray_check`, `bip_check`).

**V was mostly the wrong suspect.** The model's fastball whiffs were mostly swings UNDER the ball (.138 per swing; off the end .034, inside the hands .007, over .029). Swung under, the barrel sat 4.2 in below the ball on average, and the largest part was timing: those swings were 18 ms late (the biggest misses 26 ms), and met deeper, the ball has fallen further than the rising barrel. Misses along the barrel were a third of the big ones.

**Timing scatter was too wide, and widest the wrong way.** About each batter's own mean, the league met fastballs over a narrower spread of depths than breaking balls and off-speed (sd 7.4, 8.3 and 8.2 in); the model's spread was wider and widest for fastballs (10.0, 9.1, 9.3). The engine grew timing scatter with time pressure (a faster pitch, more scatter). Timing an interval goes the other way - the error grows with the interval, a Weber fraction - so the scatter now grows with the pitch's flight time (FLIGHT_REF 0.41 s, a 94-mph fastball), and one scale (x0.72 of the trait) gave 7.5, 8.2-8.4 and 8.0. Since v0.9 the batter's timing misread had been added on top of a scatter fitted alone, which is how it had grown too wide.

**U: the up-down aim did not follow pitch height (section above).** For fastball contact the model's barrel offset already followed contact depth as the league's did (-0.029 in per inch of depth against -0.030); height was the missing piece (+0.11 in across the zone against +1.37). VERT_MISS = 0.065 pulls the barrel toward the middle of his zone by that share of the pitch's distance from it. With it, most of the breaking balls' extra topping turned out to be height, so RESID_S was halved (0.07 to 0.035); the aim under the ball fell 0.15 in.

**Fitted jointly.** VERT_MISS, the aim under the ball, RESID_S, the barrel's random up-down scatter and the timing scale were fitted together to the league's launch angle minus attack angle by height (6 bands), the fastball's gap to breaking balls and to off-speed by height (8), whiffs by kind (3) and by height in and above the zone (15), and contact depth by kind (3): a standardized score of 2.3 (as built) fell to 1.1-1.3 on two seeds. The random scatter was left as it was (unchanged scored best on one seed, second on the other). Then the refit chain.

**Results (after the chain).**

| | before | after | league |
|---|---|---|---|
| launch − attack by height (deg) | −2, +1, +3, +6, +9, +9 | −14, −8, −1, +8, +16, +21 | −15, −4, +7, +18, +26, +30 |
| contact depth sd by kind (in) | 10.0 / 9.1 / 9.3 | 7.4 / 8.3 / 8.0 | 7.4 / 8.3 / 8.2 |
| whiffs per swing FB / BR / OS | .210 / .321 / .267 | .174 / .278 / .320 | .174 / .310 / .301 |
| fastball whiffs by height, low to high | .22 .15 .17 .19 .21 .33 | .20 .11 .12 .15 .20 .37 | .35 .12 .10 .13 .20 .37 |
| fastball swings fouled | .359 | .324 | .453 |
| foul share of contact struck square | .303 | .253 | .211 |
| contact score (90 targets) | .0775 | .0673 | |
| runs / team-game | 3.86-4.11 | 3.96-4.27 | 4.45 |
| AVG / OBP / SLG | .226-.231 / .302-.306 / .389-.405 | .238-.247 / .307-.317 / .397-.417 | .245 / .315 / .404 |
| K% / BB% / HR% | 20.5-22.0 / 8.7-8.9 / 3.3-3.6 | 16.9-17.3 / 8.3-8.6 / 3.3-3.5 | 22.2 / 8.4 / 3.1 |
| double plays / team-game | 0.53-0.61 | 0.59-0.73 | 0.75 |

**The cost: strikeouts fell to 17%.** The excess fastball whiffs had been standing in for the fouls the model does not make: with whiffs now the league's, fastballs are fouled off on .32 of swings against .45, so two-strike at-bats end in play where the league's go on (mystery 9, now the first gap in runs and strikeouts). Not hidden by a constant: the fouls are next.

**Tried and not kept.** Carrying the swing decision's perception error into the barrel's aim (he swings where he judged it): it made the pull toward the middle only weakly - the selection works near the edges of the zone - and added random barrel noise. Shrinking the random up-down scatter: not needed once timing was refitted.

**Left open.** Pitches below the zone are whiffed too rarely (fastballs .20 against .345, breaking balls .43 against .60): chases of pitches judged higher than they were, the reads of mystery 4. Launch angle above the middle of the zone runs 6-10 deg short.

**DM, damage on mistakes: refuted as stated.** By distance from the zone's edge, the model's pitches over the heart of the plate were NOT hit too hard: fastballs there were contacted .893 of swings against .886 and came off at 91.6 mph against 93.8 (xwOBA on contact .394 against .422, the engine's exit speed x launch angle table on both). What is wrong is how slowly damage falls away from the zone: fastballs 4-8 in outside came off at 83 mph against 73, 8+ in outside at 83 against 58; breaking balls 4-8 in out at 84 against 75. Reaching costs the model's batter only scatter; the league's reaching contact is weak. Restated as hypothesis RE below (first test: the league's bat speed by distance outside the zone, which bat tracking records on every swing).

**CS, the command spread: refuted.** Each pitcher's four-seam scatter about his own mean location within cells of count group and batter side, pooled (league: 110 pitchers with 150+ four-seamers; model: 200 pitchers x 300 four-seamers, measured alike): league 8.17 in across, 9.03 up-down, varying between pitchers by 0.65 and 0.85 (true sd, split halves); model 8.48 and 9.42, varying by 0.71 and 0.68. The command spread is the league's. The walk-rate spread is still too wide - true sd .033 in the model against .019 among the league's 2025 pitchers with 100+ batters faced (MLB Stats API season totals; .017 starters, .019 relievers; the 42-day sample's .015 was thin) - and command accounts for .015 of it. The rest follows the pitch mix: the model's pitchers who throw fewer fastballs walk more (r −.42 between fastball share and walk rate, league −.10), because the model's batters chase breaking balls far too rarely (8+ in outside .046 against .146; 4-8 in .13 against .33) and swing at them too rarely even in the heart of the zone (.53 against .69). That is mystery 6, and it shares its root with mystery 4 and the below-zone whiffs above: the reading of breaking balls (hypotheses I, W). The swing policy knows only 'the pitch he sat on' against 'one he recognised as something else', so fitted by count it over-swings fastballs everywhere and under-swings breaking balls (swings by kind still miss by .15 rms).

## FG and G: where the fouls are missing, and the bat's grip at game speed (engine v2.9; 2026-10-04; nothing built)

The next hypothesis after U. Runs: the league's pitch-level fastball swings (42 days of 2025): fouls with and without tracking, tracked contact by launch minus attack band, by contact depth about each batter's mean and by the bat's horizontal direction (Statcast attack_direction, on fouls too); the model the same way (500 hitters x 40 PA); the collision alone on a fixed pitch; scratch engines with the published grip.

**Where the fouls are missing.** The league fouled off .451 of fastball swings (.377 tracked, .046 untracked, .028 tips), the model .325. Of the league's tracked fastball contact, .457 was struck 25+ deg under the middle of the ball (40-60 alone .231), where 60-82% of it went foul; the model's was .311 (.139 at 40-60). Struck over the ball (-40 to +5 deg), the league's was .246, the model's .383. Within bands the model's contact also went foul less often: 5-25 deg under .24 against .345, 25-40 .43 against .60. By timing, the league's late (deep) contact went foul .669, the model's .432; by the bat's direction, toward the opposite field (-15 to -30 deg) the league's fouled .646 and made .204 of contact, the model's .498 and .114; square (-15 to +15) .40-.45 against .32-.35. So the model's fastball contact is met too seldom late and under the ball, and contact of the same height, timing and bat direction goes foul less often. More aim under the ball with less random up-down scatter (scratch: up to +0.8 in, scatter x0.45) raised fastball fouls only to .37 and broke whiffs and the contact score. Not solved; first among the open mysteries.

**G: the grip, measured at game speed.** The model's collision brings the contact point to rest against the bat (tangential restitution e_T = 0) under friction 0.5, the low-speed measurement (Cross & Nathan, Am. J. Phys. 74, 896 (2006): balls dropped at 4 m/s, apparent e_T = 0 +- 0.02, sliding friction at least 0.50). At game speeds (Nathan, Cantakos, Kesman, Mathew & Lukash, Procedia Engineering 34, 182 (2012): balls fired at 85-120 mph onto a clamped wooden cylinder) the ball gripped and left over-spinning below about 40 deg of incidence (e_x = 0.30 +- 0.02) and slid above it with friction only 0.15; the batted spin of a fastball rose to about 5,000 rpm and fell to about 3,500 at high launch angles. The model's glancing contact spun 9,000-12,000 rpm (the pop-up spin gap). With the measured values (friction 0.15; e_x 0.30 less the swung bat's tangential recoil, about 0.16-0.2, so an apparent 0.10) glancing hits spun 3,500-5,300 rpm and their launch angles barely moved - but they kept more speed (squared-up in the 40-60 deg band .32 against the league's .17; contact score .0673 -> .0733), and fouls rose only from .324 to .330. Not built: it needs the normal restitution at low impact speed beside it. G stays open, now grounded in measurement.

**RE: reaching costs bat speed - confirmed** (section below).

## RE: reaching costs bat speed (engine v3.0; 2026-10-04)

DM's test showed the model's contact on pitches off the plate came off far too hard; RE asked whether a reaching swing loses speed. Runs: every 2025 swing with bat tracking in the 42 days (bat speed 50+ mph, so checked swings and bunts out), bat speed about each hitter's own mean, by distance from the zone's edge, by direction out of the zone and on a grid of location; a quadratic surface fitted with the count held fixed; the model measured the same way (600 hitters x 40 PA); then the refit chain and the suite.

**Confirmed.** The league's fastball swings ran +1.2 mph over the heart of the plate, -0.3 just inside the edge, -1.8 just outside, -3.4 at 4-8 in out and -5.0 beyond (above the zone -4.9, away -2.4, inside -1.3, below +1.1); the model's barely moved (+0.2 to -1.4; above -0.6). On a grid the league's bat was fastest low over the plate (+2 mph) and slowest above the zone (-3.5 to -6) and well away (-4).

**Built: BAT_LOC**, the measured surface as a share of his speed - in height h (share of his zone) and a, inches away from the plate's centre over 10: +0.0386 h -0.0849 h^2 -0.0172 a -0.0203 a^2 +0.0203 a h (peak at 0.23 of the zone), with ahead +1.2% and two strikes -1.7% in the same fit, the engine's SWING_EFFORT already (+1.7%, -1.8%). Clamped where the league's swings are thick (h -0.5 to 1.5, a -1.5 to 1.8). SWING_NORM 0.978 -> 0.961 keeps each hitter's average at his bat-speed trait. After the refit chain the model's bat speed by reach ran +1.4, +0.2, -1.3, -3.7, -6.2 mph (above the zone -5.3, away -2.8, inside -0.5, below +0.4).

**Results (after the chain; seeds 3, 11, 29).** Fastballs' home runs per ball in play by distance from the zone's edge (heart, edge in, edge out, 4-8 out, 8+ out): .062, .047, .028, .014, 0 against the league's .058, .039, .026, .012, 0 (v2.9: .055, .052, .037, .028, .009); all balls in play .045 against .046 (v2.9 .048); home runs per team-game 1.21-1.36 against 1.16 (v2.9 1.25-1.35); contact score .0673 -> .0653 (squared-up .0531 -> .0466, by reach .0744 -> .0693). Runs 3.92-4.26, AVG .240-.247, walks 3.02-3.23 a team-game (3.16); K% 16.9-17.1, unchanged. Exit speed still falls too slowly past 4 in outside (80.5 and 75.3 mph against 72.6 and 58.4): what is left of mystery 3 is the quality of reaching contact, not its speed.

## #2, the breaking-ball reads (engine v3.1, fit_swing_policy v0.5; 2026-10-04)

Joe asked for the big-picture questions 1-3 (fouls, breaking-ball reads, reaching contact). Runs: the league's swings by count x pitch kind x distance from the zone's edge (new: `statcast/swing_count_kind.py`, 42 days of 2025); the model's breaking balls taken apart by read (sat on it, picked up, late, fooled) and the swing rate of each by band; scratch engines and scratch fitters for each variant; the refit chain and the suite.

**What the league showed.** In the zone, the league took breaking balls more than fastballs only in hitters' counts (0-0: .45 against .57 deep in the zone; 2-0: .48 against .72); at 1-1 and with two strikes it swung at them alike (.87 and .88; .94 and .90). Outside the zone it chased breaking balls MORE than fastballs in every count (two strikes, 6-9 in out: .39 against .20). So the first is the batter's choice when hunting a fastball, the second deception.

**What the model did.** It picked up 80% of breaking balls at the commit point, and a recognised breaking ball put him on the 'off' threshold, which the fitter (matching each count's curve over all kinds) had set so high that a recognised breaking ball in the heart of the zone was swung at .45 of the time, and 1% far outside; the reads stood in for pitch kind, so fastballs were over-swung everywhere (swings by kind missed by .15 rms).

**Built.** (1) The swing policy fitted to the league's curves by count x kind (`fit_swing_policy.js` v0.5): the 'off' read now costs swings only in hitters' counts (0-0, 1-0, 2-0, 3-1), as the league's does. (2) DIR_READ_DEC = 0: a batter who has not picked a pitch up decides on where the ball has got to on the curve he expected, without the half of its direction the swing later steers by (with it, a fooled batter judged a diving breaking ball most of the way to where it went, and seldom chased). (3) TUNNEL_SEP = 0.5: a breaking ball or changeup shows the eye half of its geometric separation from the fastball path at the commit point - a position there is as easily a lower-aimed fastball as a breaking pitch. (3) is fitted to outcomes (class O): 0.35 and 0.25 raised strikeouts to 21.7% and 23.3% but breaking-ball whiffs to .375 and .431 against .310, and doubling every batter's spotIn instead raised walks and changeup whiffs.

**Results (after the chain; seeds 3, 11, 29).**

| | v3.0 | v3.1 | league |
|---|---|---|---|
| K% | 16.9-17.1 | 19.2-19.6 | 22.2 |
| BB% | 8.0-8.4 | 8.9-9.5 | 8.4 |
| AVG / OBP / SLG | .240-.247 / .307-.317 / .400-.417 | .231-.234 / .309-.311 / .389-.405 | .245 / .315 / .404 |
| runs / team-game | 3.92-4.26 | 3.97-4.11 | 4.45 |
| swings: error by kind / by count | .148 / .022 | .058 / .050 | |
| breaking balls swung at, heart to 8+ in out | .54 .41 .25 .12 .05 | .71 .55 .38 .20 .07 | .69 .60 .46 .33 .15 |
| whiffs per swing FB / BR / OS | .180 / .285 / .307 | .167 / .323 / .343 | .174 / .310 / .301 |
| chase | .260 | .229 | .283 |
| contact score | .0653 | .0645 | |

**The cost.** Walks rose (8.9-9.5% against 8.4) and the chase fell (.229 against .283): the old chase rate was reached by chasing fastballs too often; those chases are now the league's, but breaking balls and changeups far outside are still chased half as often as the league's (6-9 in out .15 against .28, 9-12 in .08 against .21). More deception through TUNNEL_SEP does not close it without too many whiffs; the far chase needs another piece (the decision's eye at the commit point, or how a fooled batter's chase is judged).

## Bug audit: the game, the bases and the scoring (bb_field v1.7, bb_game v1.3, field_value v0.2; 2026-10-05)

Joe asked whether some of the open mysteries were bugs; the brief (`docs/briefs/2026-10-05_bug_audit.md`) set out from the run-conversion gap: the model scored 90-93% of what BaseRuns predicts from its own events, the league 102%. Worked in a cloud session under Node on `bug-audit` (engine v3.1 as kept). Runs: a new measure of where the runs leak (`headless/runs_check.js` on whole games against `statcast/runs_league.py` on 42 days of 2025, 564 games: BaseRuns against actual runs, the RE24 table, the transitions by event and base-out state, the running game per pitch, hitting by base state, every event per team-game); a check of every play of thousands of games for the impossible (`headless/invariants_check.js`); constructed plays through `BBField.resolve` as regression tests (`headless/plays_check.js`); a left-right mirror and platoon test (`headless/mirror_check.js`: the same men drawn with both hands, each mirror pair on the same dice); the sign conventions followed through the code and the data; a fresh reading of `bb_game.js` and `bb_field.js`; the suite before (`diag_out/base`) and after each fix, and the chain's tail (the fielders' values, the pool) after the field layer changed.

**What the measurements showed (the engine as found).** Runs 4.11 / 4.08 / 3.87 a team-game at seeds 3, 11 and 29 against BaseRuns 4.52 / 4.50 / 4.28: ratio .905-.909 (the league's 42 days: 4.39 against 4.34, 1.011). The RE24 table was the league's from an empty base (.47 against .49 with none out) and fell away with men on: first and second, none out, 1.27 against 1.65; bases loaded, none out, 1.92 against 2.89. No single, double or triple ever scored two runs (150 games: none). The invariants check found two men on one base after a tag-up (a runner tagging up onto a man who held, 21 times in 2,000 games) and, once the batting order was recorded, an NL side batting nine hitters and no pitcher after its first pinch-hit (9% of its plate appearances). Reading the code found the first (the runner behind a man who scores was held to third), a holder vanishing under a thrown-away ball, and two scorer's rules broken; the 2,000-game check on the finished code found two more (a pitcher hit for coming back when the pen was empty, and a slip in one of the scorer's fixes). Eight in all.

**Bugs found and fixed, one a commit, each with a regression test that failed before and passes after.**

1. **The runner behind a man who scores was held to third** (`bb_field.js` resolve(), the loop that sets how far each runner goes; bb_field v1.2). A man who had crossed the plate stayed the ceiling for the runner behind him, so no single, double or triple ever scored two runs (150 games: none), and the RE24 table from bases loaded with none out ran 1.9 against 2.9. Fixed: a man who has crossed the plate is nobody's ceiling. Test: `plays_check` case 1 (bases loaded, two out, a drive into the right-field corner: at least two score; and second and third, two out, a single up the middle: both score), one run each before. Effect: runs 4.11 / 4.08 / 3.87 -> 4.33 / 4.32 / 4.70 a team-game, the BaseRuns ratio .905-.909 -> .938-.981; from bases loaded with none out the RE24 1.92 -> 2.40.
2. **A runner tagged up onto a man who held** (resolve(), the tag-up loop; v1.3). Each runner judged his own tag with no regard to the man ahead; when the man on third held and the man on second tagged, both were sent to third and the holder vanished from the bases: 21 times in 2,000 games, a runner on third lost each time. Fixed: the lead runner first, each only to a base the man ahead leaves. Test: `plays_check` case 2, second and third with a timid slow man on third and a bolder one on second, flies of every depth: 2 of 53 catches put both on third before, none after. Effect: below the seeds' noise (one play in 95 games).
3. **A holder vanished under a thrown-away ball** (resolve(), the throwing-error branch; v1.4). Only the runners already moving took the extra base; a man who had held stayed and the man behind him took his base. Fixed: every runner moves up a base, the holders included. Test: `plays_check` case 3 with dice that make the infielder's throw wild: a man on second and a grounder to the second baseman thrown away (the batter had landed on top of him), first and third and a grounder to short thrown away. Effect: below the noise (one play in 170 games).
4. **The pinch-hitter kept the pitcher's spot for the rest of the game** (`bb_game.js` nextBatter() and startHalf(); bb_game v1.2). The pinch-hitter went into the NL's pitcher's spot and nothing took him out: he batted there for every pitcher after, and the double switch, which looks for the pitcher's spot, never found one. An NL side batted nine hitters and no pitcher in 9% of its plate appearances (2,146 of 23,336 in 300 games once the order was recorded). Fixed: the spot goes back to the pitcher before the pen takes over. Test: the play records the batting order; `invariants_check` requires exactly one pitcher's spot in an NL order (none while the pinch-hitter has it), the batter in the order, every fielder batting for his side, and no pitcher who was hit for coming back - 2,146 violations before, none in 500 games after. Effect: runs 4.52 / 4.32 / 4.70 -> 4.02 / 4.49 / 4.52 - it takes runs away, as a bench bat had been hitting where a pitcher should; the ratio .934 / .960 / .983.
5. **A force tried and missed was always the batter's hit** (resolve(), the scorer; v1.5). The scorer's rule 9.05 credits the batter a hit on a failed force only if he would have beaten a throw to first; the model credited one whenever the lead runner was safe (1.0-1.7% of balls in play with men on). Fixed: his own race to first is judged, as it already was for an error. Test: `plays_check` case 4, a slow batter, a man on first, soft grounders with dice that make every throw late: all 23 forces tried and missed were singles before, fielder's choices after. Effect: hits with men on 3.17 -> 3.13 a team-game; runs unchanged at the seed.
6. **A batter thrown out past first lost his hit** (resolve(), the scorer; v1.6). A batter put out at second, third or home after reaching first safely was scored a plain out; the rule credits the hit with an out on the bases. 0.2-0.3% of balls in play, three times the league's 0.09% (the model's batters stretch more). Fixed: the base before the one he was put out at. Test: `plays_check` case 5, a bold batter and a ball down the right-field line with dice that let the throw beat him at second: 'ground out, RF to second' before, 'single ... out at second trying for more' after; `field_value.js` v0.2 values such a ball as an out to the fielder.
7. **A pitcher who had been pinch-hit for came back to pitch when the pen was empty** (`bb_game.js` nextBatter(); bb_game v1.3). With every reliever used, in extra innings, bringIn() found nobody and the man who had been hit for went back out: one game in 2,000 at seed 11, 43 plate appearances. Fixed: the manager pinch-hits for his pitcher only with a fresh arm to follow. Test: `invariants_check`'s rule that a pitcher hit for never pitches again - 43 violations in the first 200 games at seed 11 before, none after.
8. **A force tried and thrown away was scored a fielder's choice with nobody out** (resolve(), the scorer; v1.7 - a slip of v1.5's, caught by the invariants check on the final code: 1 in 2,000 games). Fixed: a throw that gets away is an error, scored as before v1.5. Test: `plays_check` case 6, the grid of case 4 with wild throws: 31 of 50 fielder's choices before, all errors after.

**The leak, before and after** (runs_check, 300 games, seed 3, against the league's 42 days):

| | before | after | league |
|---|---|---|---|
| runs / BaseRuns a team-game: the ratio | 4.16 / 4.55: 0.913 | 4.24 / 4.44: 0.956 | 4.39 / 4.34: 1.011 |
| RE24: bases empty, none out | 0.469 | 0.471 | 0.486 |
| RE24: a man on first, none out | 0.835 | 0.829 | 0.898 |
| RE24: first and second, none out | 1.267 | 1.329 | 1.650 |
| RE24: second and third, none out | 2.000 | 1.500 | 2.129 |
| RE24: bases loaded, none out | 1.922 | 1.937 | 2.888 |
| RE24: bases loaded, one out | 1.656 | 1.472 | 1.591 |
| RE24: bases loaded, two out | 0.818 | 0.844 | 0.754 |
| a man on second scores on a single, two out | 0.53 | 0.74 | 0.79 |
| a man on first reaches third on a single, two out | 0.30 | 0.40 | 0.41 |
| a man on first scores on a double, two out | 0.35 | 0.55 | 0.55 |
| a man on first is out at home on a double, two out | 0.04 | 0.12 | 0.03 |
| a man on third scores on an air out, none out | 0.35 | 0.30 | 0.65 |
| a man on third scores on an air out, one out | 0.30 | 0.32 | 0.62 |
| a ground ball with a man on first, one out: a double play | 0.31 | 0.29 | 0.32 |
| a ground ball with a man on first, one out: a fielder's choice | 0.07 | 0.07 | 0.03 |
| a man on third scores on a ground out, one out | 0.38 | 0.38 | 0.49 |
| the transitions' cost, runs a team-game | +0.163 | +0.030 | |
| AVG / BABIP, bases empty | .303 / .268 | .297 / .261 | .314 / .280 |
| AVG / BABIP, a man on first only | .303 / .267 | .305 / .269 | .332 / .301 |
| AVG / BABIP, a man in scoring position | .301 / .256 | .302 / .262 | .344 / .298 |
| singles a team-game | 4.92 | 4.96 | 5.36 |
| hits with runners on | 3.43 | 3.39 | 3.61 |
| sacrifice flies | 0.13 | 0.11 | 0.27 |
| fielder's choices | 0.32 | 0.32 | 0.13 |
| double plays | 0.72 | 0.67 | 0.71 |
| runners forced out | 0.96 | 0.89 | 0.69 |
| runners tagged out on the bases | 0.11 | 0.15 | 0.10 |
| throwing errors | 0.08 | 0.10 | 0.13 |
| runners left in scoring position | 4.59 | 4.36 | 3.37 |

Seed 3: before 300 games, after 600; at seed 11 (300 and 600 games) the ratio went .915 -> .940, a man on second scoring on a single with two out .51 -> .71, a man on first scoring on a double with two out .35 -> .53, a man on third scoring on an air out .29 -> .31-.37, the transitions' cost +.104 -> +.056.

**The suite** (seeds 3, 11, 29; `tools/diag/compare.py diag_out/base diag_out/final`):

| | before (seeds 3, 11, 29) | after | league |
|---|---|---|---|
| runs per team-game | 4.11 / 4.08 / 3.87 | 4.54 / 4.06 / 4.31 | 4.45 |
| runs / BaseRuns from the model's own events | .909 / .907 / .905 | .988 / .926 / .960 | 1.01 |
| hits | 7.97 / 8.09 / 7.90 | 8.19 / 8.01 / 8.18 | 8.26 |
| walks | 3.68 / 3.53 / 3.47 | 3.63 / 3.49 / 3.37 | 3.16 |
| AVG | .234 / .235 / .231 | .237 / .232 / .239 | .245 |
| OBP | .315 / .311 / .307 | .315 / .308 / .314 | .315 |
| SLG | .405 / .405 / .391 | .408 / .397 / .406 | .404 |
| BABIP | .263 / .262 / .263 | .264 / .262 / .272 | .291 |
| K% | 19.6 / 19.4 / 20.3 | 19.0 / 19.8 / 19.7 | 22.2 |
| BB% | 9.6 / 9.2 / 9.1 | 9.4 / 9.1 / 8.9 | 8.4 |
| HR% | 3.4 / 3.6 / 3.2 | 3.5 / 3.3 / 3.3 | 3.1 |
| double plays | 0.74 / 0.67 / 0.61 | 0.71 / 0.66 / 0.64 | 0.75 |
| errors | 0.28 / 0.34 / 0.35 | 0.34 / 0.34 / 0.37 | 0.50 |
| stolen bases | 0.61 / 0.61 / 0.54 | 0.57 / 0.59 / 0.67 | 0.71 |
| caught stealing | 0.18 / 0.17 / 0.14 | 0.18 / 0.18 / 0.19 | 0.20 |
| left on base | 6.63 / 6.66 / 6.74 | 6.37 / 6.63 / 6.32 | 6.73 |
| pitches per team-game | 141 / 140 / 140 | 141 / 140 / 137 | 146 |
| in play: ground / liner / fly / pop, % | 44-46 / 20-21 / 24-25 / 9-10 | 45-46 / 20-21 / 24-25 / 9 | 43 / 24 / 24 / 9 |
| contact score (90 targets) | .0645 | .0630 | |

**Mirrors and signs.** The same men drawn with both hands, each mirror pair on the same dice (150 batters x 40 PA x 4 hand combinations, two seeds): right-on-left against left-on-right differed by no more than sampling noise in strikeouts, walks, home runs, whiffs, chases, pull share, ground balls, wOBA and spray (|z| under 2.5 on every line at both seeds); so did right-on-right against left-on-left. Pitch by pitch a mirror pair is not identical, because the throw's scatter is drawn in the field's frame rather than the pitcher's (the same draw sends a right-hander's miss toward first base and a left-hander's too): a benign asymmetry of the dice, not of the physics or the rules. The conventions were followed through: plate x in metres, + toward first base from the catcher's view, a right-handed batter at -x and a right-handed pitcher's arm at -x (`armSide`); the pitcher's aim tables keyed same-side / opposite-side in his arm-side frame (`PLAN_LOC`, statcast/locations.py); Statcast's attack_direction + toward the opposite field - checked against the data: across hitters r = -.42 with the pull-frame spray of their balls in play, and by band the balls go 22 deg pulled at -30 and 20 deg opposite at +20 - so `statcast/bat_direction.py`'s pull = -attack_direction is right, and the model's bat direction and spray (+ pulled, `spray * side`) agree with `statcast/bip.py`'s (home plate at 126.0, 205.0). No flipped sign was found. K% against release height (+.16 in the model, -.22 in the league) and the flat walk rate against arm angle follow from the chain as built (release height ~ arm angle +.81, arm angle ~ ride): the league's signs come from deception the model does not have, a mechanism, not a sign. The platoon split has the WRONG SIGN in the model: same-side batters are 13-16 points of wOBA BETTER (right-handed +.013 / +.014, left-handed +.030 / +.016 at the two seeds; the league -.020 and -.030), striking out less (-.009 to -.022) and walking more. Everything hand-dependent in the code is symmetric, so this is a missing mechanism too: the same-side release is harder to pick up in the league, and the model's batter pictures every pitch from its true release. Recorded as a hypothesis (PL).

**Mechanisms, not bugs** (recorded with their numbers; none built here):

- **Hitting with men on base** - the largest piece of what is left. The league's batters hit BETTER with runners on: AVG .314 with the bases empty, .332 with a man on first only, .344 with a man in scoring position; BABIP .280 / .301 / .298, on the ground .237 / .282 / .269. The model's are flat (600 games at each of two seeds, after the fixes): AVG .297-.302 / .297-.305 / .302, BABIP .261-.269 / .262-.269 / .262, on the ground .233-.239 / .228-.250 / .229-.230, in the air .288-.296 / .286-.294 / .288-.293 (league .314 / .322 / .322). The contact is the same in every state (exit speed 88.3-88.5 against 88.0-88.5), so it is the fielding and the scoring with runners on: the model's infield never holds a runner at first or plays in, so the hole the league's hitters get with a man on (+.045 of ground-ball BABIP) is not there; and its fielders prefer the force at second (a fielder's choice on .044-.061 of ground balls with men on against .017-.038, .32 a team-game against .13, runners forced out .89 against .69). Situational positioning is on the not-built list above; the fielder's choice of base is a decision rule to measure (which out the league's infielders take, by the runner's and the batter's speed).
- **Sacrifice flies.** A man on third on an air out with fewer than two out scored .27-.35 of the time against the league's .62-.65 (SF .08-.13 a team-game against .27), worth about 0.07 runs a team-game. The tag-up uses the generic margin for taking second (SAFETY 0.30 s) from a standing start, with no read error, where going home on a hit uses the margins fitted by outs (SAFETY_H) and a read with error: a rule to measure from the league's tag-ups by fly distance, not a constant to turn.
- **The send home on a double with two out.** A runner on first on a double with two out was out at home .14 of the time against .03 (scored .51 against .55). SAFETY_H[2] = -0.4 s was fitted with bug A present, when the second runner was never sent; it should be refitted (statcast/baserunning.py, headless/xbt_check.js) now that he is.
- **Ground balls by launch angle.** Balls hit at -10 to 0 deg are hits .135 of the time against .249, at 0-10 deg .538 against .482 (bip_check): the choppers are fielded too easily and the low liners get through too easily - the bounce and the intercept, physics to measure (the league's hit rate by launch angle and exit speed on the ground is in statcast/bip.py).
- **The platoon split (PL).** Same-side batters are better in the model, worse in the league; the model's batter sees every pitch from its true release. A same-side release harder to pick up (a later or noisier commit point by platoon, measured from the league's swing-and-miss and chase by platoon) is the mechanism to test; it would also move K% against release height and walks against arm angle toward the league's signs.
- **Strikeouts and walks** (the engine): K 7.4 against 8.4 a team-game, walks 3.5 against 3.05 - the fouls and the far chases (#31), not this audit.
- **Runners doubled off** are not modelled: a man running with the pitch or halfway on a liner that is caught is never doubled up; the league's line-drive double plays are a few a season per team.
- **A game stops after 18 innings** (one tie in 2,000 games); a limit, not a bug.

**What is left.** The run-conversion ratio came from .905-.909 to .926-.988 (three seeds of 200 games; .956 and .940 over 600 games at seeds 3 and 11; the league 1.01), most of it the first bug: a second runner scoring. Runs are 4.06-4.54 a team-game against 4.45, now within the seeds' spread of the league on two seeds of three, with strikeouts 2.5 points low and walks a point high (the engine, #31). What is left of the conversion is not in the bases' bookkeeping, which the invariants check now holds clean over 6,000 games at three seeds (apart from one 18-inning tie a run): it is hitting with men on base, where the league gains 20-45 points of BABIP from the hole a held runner opens and the infield's depth, and the model gains nothing; and the sacrifice fly, where a man on third scores on an air out half as often as the league's. The next suspect is MO - the infield with men on base: measure the league's infield positions and the ground-ball hit rate by base state and by where the ball went (the hit coordinates), and which out its infielders take by the runners' and the batter's speed; then TU and FO together, one refit of the runners' margins.

## The designated hitter for both sides, the league's run table, and five jobs at once (bb_game v1.4; 2026-10-05)

**The designated hitter.** `simGame` drew AL or NL rules at random when a caller gave none, so the pitcher batted in half the games of every headless check (run_games, runs_check, bip_check, xbt_check, shape_check, level_check), measured against 2025's league, where no pitcher batted. bb_game v1.4: a game given no rules plays the designated hitter for both sides; invariants_check v0.2 names NL rules for half its games so the pitcher's spot is still checked. The new baseline on the Mac (`diag_out/base_dh`, seeds 3 / 11 / 29): runs 4.37 / 4.50 / 4.39 (league 4.45), K% 19.5 / 19.1 / 18.7 (22.2), BB% 8.6 / 9.5 / 9.4 (8.4), BABIP .268 / .263 / .267 (.291). Without the pitchers at the plate the strikeout rate fell, as expected: the strikeout gap was a little larger than it had looked.

**The league's run table.** The bug audit's RE24 from 42 days of 2025 (`statcast/runs_league.py`) ran high with men on and none out. Recomputed for innings 1-9 with game-bootstrap 90% intervals beside FanGraphs' 2010-15 table, 21 of 24 states agreed within their intervals. Three none-out states with a man on second ran high: second only 1.29 (1.19-1.40) against 1.10, first and second 1.67 (1.53-1.79) against 1.44, bases loaded 2.92 (2.48-3.35) against 2.28. The data had no gaps (at-bat numbers contiguous within every half-inning; only extra innings started with a runner on). It may be a real 2025 effect (pickoff limits and bigger bases since 2023); the men-on-base job weighted those three states lightly. That job later fixed a different fault in the same script's transitions (runs_league v0.2: a force out had been counted as the batter's out); RE24 and BaseRuns were unchanged by it.

**Five jobs at once.** From `dh-everywhere`, four jobs ran in parallel on Joe's Mac, each in its own git worktree, under shared rules (`docs/briefs/2026-10-05_parallel_rules.md`): write-ups in `docs/sections/` rather than this file, one suite or chain at a time, one pull request each. The platoon and ground-ball jobs ran in Joe's Fable sessions, the men-on-base and fouls-and-chases jobs as Opus agents. A fifth job, the field follow-up (2026-10-06), took on the ground-ball job's costs. Their write-ups follow as written, in the order they were combined, with the integration's own notes between them.

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

## Fouls and far chases without their costs; reaching contact (engines v3.2-v3.4 built and taken back out; 2026-10-05)

The brief (`docs/briefs/2026-10-05_fouls_chases_costs.md`) asked for three things in order: FL, #31's v3.2 fouls without its BABIP cost; KB, #31's v3.3 far chases without its strikeout overshoot; RE's second half, whether reaching costs the contact's quality. Worked on the Mac on branch `fouls-chases-costs` from `dh-everywhere` (engine v3.1). Runs: the league's pitch-level data (42 days of 2025, tracked contact with bat 50+ mph unless noted), measured with new scripts that have model twins (`tools/diag/fl_*`, `aa_*`, `re_*`, `vmh_*`, `kbcurve.js`, `foldscore.js`); scratch engines with each candidate as a knob (`diag_out/scratch/`); for each engine built, the refit chain (`tools/diag/chain.sh`) and the suite (three seeds of 200 games, `compare.py` against the shared baseline `base_dh`). Three engine versions were built and suited: v3.2 (#31's last look, carried by hand), v3.3 (FL on top of it) and v3.4 (#31's DEC_UNSEEN on v3.1). Each moved its target and broke two or more other lines, so each is committed with its chain values for the record and then taken back out: **the engine at the end of the branch is v3.1, unchanged.** Results below are scoped to these runs.

### 1. FL: where the folded contact lands

**What #31 suspected, tested first: refuted for fastballs.** #31 thought v3.2's under-the-ball contact came down fair as pop-ups where the league's goes back foul. Fastball pop-ups in play (50+ deg) per tracked contact were .054 in the league, .043 in v3.1 and .051 in v3.2: v3.2's fastballs popped up no more than the league's. The extra pop-ups were breaking balls (below).

**The league's fouls are grazes.** A third of the league's tracked fastball contact (.327; .245 over all kinds) was a foul at 10-70 deg whose exit speed followed the pitch's speed and not the bat's: fitted on both, exit speed = 14.9 + 0.655 x pitch speed + 0.006 x bat speed (balls in play: 19.0 + 0.049 x pitch + 0.943 x bat). They left at .817 of the release speed (sd .054); fouls at 10-70 deg piled up at .75-.85 of it (.212 of all fastball contact in those two bins). By launch angle and exit speed, the league's contact at 70-80 mph and 10-70 deg was 7,255 balls (24% of fastball contact), 84-91% of them foul: a ball that barely touched the bat and went on back. v3.2's grazes were .181 of fastball contact (.146 over all kinds), spread from .60 to .95 of the release speed with the most at .60-.70: on the collision's own curve (a 95-mph fastball, a 70-mph square swing, the offset stepped 0.05 in), with the low-speed friction of 0.5 a near-miss 2.2-2.6 in under the ball's centre came off at 62-73 mph, the friction dragging it forward with the bat; with 0.15 at 83-90 mph.

| exit speed / release speed, fouls at 10-70 deg, share of fastball contact | .60-.70 | .70-.75 | .75-.80 | .80-.85 | .85-.90 | .90-.95 | grazes |
|---|---|---|---|---|---|---|---|
| league | .018 | .035 | .091 | .121 | .052 | .029 | .327 at .817 |
| v3.2 (friction 0.5, last look 1 in) | .069 | .042 | .036 | .037 | .035 | .031 | .181 |
| friction 0.25 (scratch on v3.2) | .021 | .029 | .051 | .077 | .050 | .033 | .241 |
| friction 0.15 (scratch on v3.2) | .012 | .012 | .025 | .049 | .088 | .064 | .237 |

**Where v3.2's BABIP cost came from: the breaking balls.** By pitch kind (all tracked contact, bat 50+ mph):

| | attack | launch minus attack | launch | launch in play | foul share of contact | pop-ups in play per contact | in play GB / LD / FB / PU % |
|---|---|---|---|---|---|---|---|
| league fastballs | 5.5 | 18.1 | 23.6 | 14.8 | .506 | .054 | 42 / 22 / 25 / 11 |
| v3.2 fastballs | 6.7 | 12.7 | 19.4 | 12.8 | .474 | .051 | 44 / 20 / 27 / 10 |
| league breaking | 11.6 | 1.1 | 12.7 | 14.0 | .442 | .058 | 42 / 22 / 25 / 10 |
| v3.1 breaking | 15.9 | -6.2 | 9.7 | 16.0 | .565 | .052 | 41 / 20 / 27 / 12 |
| v3.2 breaking | 17.1 | 0.9 | 18.0 | 21.1 | .560 | .076 | 34 / 19 / 30 / 17 |
| league off-speed | 12.5 | -4.8 | 7.7 | 9.1 | .416 | .049 | 50 / 22 / 19 / 8 |
| v3.2 off-speed | 14.2 | 1.3 | 15.6 | 18.8 | .513 | .069 | 37 / 19 / 29 / 14 |

v3.2's aim under the ball (1.0 in for every kind) brought the breaking balls' launch minus attack to the league's (0.9 against 1.1); in v3.1 the breaking balls had been topped (-6.2), which hid a bat path 4-5 deg too steep. Unmasked, it launched them 5 deg too high (in play 21 against 14), and they were fouled too often by spray, so what stayed fair was the under-struck part. Both come from where breaking balls are met:

| about each hitter's mean depth (in) | FF | SI | FC | SL | ST | CU | CH | FS |
|---|---|---|---|---|---|---|---|---|
| league | -4.2 | -4.0 | +0.4 | +4.0 | +5.6 | +6.6 | +4.8 | +5.1 |
| model (v3.2) | -4.2 | -3.5 | 0.0 | +5.2 | +6.8 | +9.4 | +4.0 | +5.1 |
| league attack (deg) | 5.2 | 4.5 | 9.0 | 11.2 | 12.3 | 13.1 | 12.8 | 13.1 |
| model attack | 6.0 | 6.6 | 10.2 | 15.2 | 17.0 | 19.6 | 14.1 | 15.1 |

The league's contact depth rose about 1 in per mph of speed below the fastball up to about 9 mph and then flattened (curveballs, 15 mph slower, met 10.8 in further out front than four-seamers); the model's kept rising at 1 in per mph (13.6 in). And across pitch types the league's attack rose only 0.73-0.84 deg per inch of depth (within fastballs 0.97), the model's 1.0 everywhere. The bat's direction on breaking-ball contact pointed +10.2 deg to the pull side against the league's +5.7 (fastballs -5.5 against -5.6). So contact struck square vertically (launch minus attack -15 to +15) went foul .464 of the time on breaking balls against the league's .234, and .362 on off-speed against .206, nearly all pulled foul; on fastballs .231 against .226. The brief's "square contact fouled by spray .31 against .21" is the breaking and off-speed pitches. With the fouls at the bottom of the vertical spread removed, the breaking balls left in play were the high ones.

**Built: v3.2 carried over, then v3.3 (FL).** v3.2 as #31 built it (LOOK_GAIN 1.3, LOOK_SD 1 in, raw barrel scatter x1.7, aim under the ball 1.0 in, VERT_MISS 0.09, SWING_R 0.82 m, pullBias -0.4; fit_population v0.7). v3.3 added the two things the grazes measure: the ball-bat friction 0.27 (was 0.5), fitted to the grazes' speed (0.2 gave .84 of the release speed, 0.25 .82, 0.3 .81; league .817; Cross & Nathan 2006 measured at least 0.50 at 4 m/s, Nathan et al. 2012 about 0.15 at game speed beyond 40 deg of incidence; square contact rolls on the bat under either cap); and the last look's error 0.5 in (was 1 in), fitted to the grazes' share of contact, with the raw barrel scatter x1.15 to keep the fastball whiffs (in a scratch engine on chained v3.2: 1 in gave grazes .233 of fastball contact and whiffs .173; 0.5 in x1.15 .303 and .170; 0.3 in .318 and .152). At 1 in, the correction had scattered the folded swings back across the barrel, many of them square; at 0.5 they stop at the edge of the ball.

| (seeds 3 / 11 / 29) | base_dh (v3.1) | v3.2 | v3.3 | league |
|---|---|---|---|---|
| fastball fouls per swing | .327 | .389 | .446 | .451 |
| fastball whiffs per swing | .162 | .169 | .168 | .174 |
| K% | 19.5 / 19.1 / 18.7 | 19.9 / 19.8 / 20.2 | 22.3 / 22.3 / 23.0 | 22.2 |
| BB% | 8.6 / 9.5 / 9.4 | 9.7 / 10.3 / 10.0 | 10.2 / 10.2 / 10.4 | 8.4 |
| BABIP | .268 / .263 / .267 | .242 / .242 / .234 | .227 / .224 / .232 | .291 |
| runs / team-game | 4.37 / 4.50 / 4.39 | 4.00 / 4.07 / 3.99 | 3.45 / 3.38 / 3.42 | 4.45 |
| AVG | .240 / .238 / .240 | .219 / .217 / .213 | .199 / .195 / .198 | .245 |
| pitches / team-game | 139 / 139 / 141 | 141 / 143 / 144 | 147 / 147 / 147 | 146 |
| in play GB / LD / FB / PU % | 45 / 20-21 / 25 / 9-10 | 39-41 / 18 / 27-28 / 14-15 | 40-41 / 17 / 26-27 / 16 | 43 / 24 / 24 / 9 |
| chase | .225 | .234 | .244 | .283 |
| breaking balls chased 6-9 / 9-12 in below the zone | .16 / .09 | .17 / .11 | .19 / .10 | .36 / .28 |
| contact score (90 targets) | .0630 | .0576 | .0601 | |

v3.3 brought the fastball fouls, strikeouts and pitches to the league's, and the squared-up panel of the contact score from .060 to .021; on the worst seed (29) runs fell from 4.39 to 3.42 and BABIP from .267 to .232. With the breaking-ball contact as it is, every extra foul is a breaking ball pulled foul or a fastball graze, and what reaches the field is lofted: by kind in chained v3.3, breaking balls were fouled .620 of contact (league .442) and 20% of those in play were pop-ups (league 10%); fastball liners were 16% of fastballs in play (22). Recorded, not kept.

**Tried and not built (scratch engines).**
- The breaking balls' attack lowered by hand (5 deg): their launch did not fall (18.0 to 19.8): the vertical offset's timing term uses the planned path, so a flatter path put the barrel further under an out-front ball. Not a mechanism; it located the problem in the bat's path at the contact point, not in the aim.
- RESID_S 0.07-0.10 with the aim re-raised: the breaking balls' launch came to the league's only with their launch minus attack 7-10 deg below it (the fastball-to-breaking gap by height 11-20 deg against 7-9). One aim cannot fit both kinds while the breaking balls' path is 5 deg too steep.
- A lower aim with the sharper last look (0.7 in, 0.4 in): pop-ups per contact .051 and .044, but fastball launch in play 8.5 and 7.7 deg against the league's 14.8: the aim was measured from the fastballs.
- The timing of slow pitches flattening (a soft cap on the prior's pull on timing, tanh with 18 ms): measured from the depth by pitch type above, and it reproduced it (curveballs +8.9 to +6.3 in, sweepers +6.7 to +5.3; league +6.6, +5.6); on v3.1 breaking balls were fouled .565 to .521 and popped up .052 to .042 per contact (in play 45 / 21 / 24 / 9 against the league's 42 / 22 / 25 / 10), but strikeouts per plate appearance fell .195 to .179 (fewer fouls and whiffs). On v3.3 it took the breaking balls' fouls from .620 to .571 and left the pop-ups. Not built alone (it would take two points of K from a model already short); it is half of the breaking-ball fix.

**What is left.** The fold and the graze physics are measured and ready (friction 0.27, last look 0.5 in); what stops them is the breaking-ball contact: met too far out front on the slowest pitches (timing linear in the speed gap where the league's flattens), and with a path that rises too fast across pitch types. That is a new suspect (BC below), to fix before the fold is adopted again.

### 2. KB: the two-strike picture

**DEC_UNSEEN, carried over and fitted by direction.** On v3.1 with the policy refitted twice (scratch, 500 hitters; plate-appearance level strikeouts and walks, the far chases of breaking balls by direction, two-strike swings at breaking balls 6+ in inside the zone, the policy's rms):

| | K / BB per PA | below 6-9 / 9-12 | away 6-9 / 9-12 | in 6-9 / 9-12 | two strikes, deep in the zone | rms by count / kind |
|---|---|---|---|---|---|---|
| v3.1 | .206 / .093 | .17 / .10 | .13 / .08 | .13 / .09 | .90 | .048 / .053 |
| 0.5 both axes (#31) | .248 / .079 | .38 / .24 | .27 / .14 | .25 / .19 | .81 | .035 / .041 |
| 0.5 up-down only | .219 / .084 | .35 / .26 | .12 / .06 | .13 / .06 | .88 | .033 / .036 |
| 0.5 up-down, 0.25 across (built, v3.4) | .231 / .080 | .36 / .25 | .17 / .10 | .18 / .10 | .83 | .030 / .036 |
| the same, two-strike commit 0.12 s (KB) | .211 / .081 | .34 / .23 | .18 / .08 | .15 / .11 | .88 | .028 / .036 |
| league (game K% / BB%) | 22.2 / 8.4 | .36 / .28 | .21 / .15 | .25 / .14 | .96 | |

**KB refuted on its premise.** A later two-strike commit point needs a quicker two-strike swing. The league's two-strike swing was shorter but slower, so it took as long: swing length over bat speed 69.4 ms with no strikes, 69.7 with one, 70.5 with two (7.35 / 7.29 / 7.19 ft at 72.4 / 71.5 / 69.8 mph, 74,000 swings). As a knob, a commit 55 ms later with two strikes did cut the strikeouts (.231 to .211 per plate appearance) and kept the far chases, but nothing measured says it is later, so it was not built. The two-strike curve is sharper than the no-strike one in the league, but on the model's policy that follows from the single two-strike threshold (with no strikes the 'on' and 'off' thresholds mix two curves), not from a sharper eye.

**Built: v3.4 (DEC_UNSEEN 0.5 up-down, 0.25 across; class O, fitted to the league's chases by direction).** The chain and the suite:

| (seeds 3 / 11 / 29) | base_dh | v3.4 | league |
|---|---|---|---|
| K% | 19.5 / 19.1 / 18.7 | 22.8 / 22.7 / 22.0 | 22.2 |
| BB% | 8.6 / 9.5 / 9.4 | 7.6 / 6.9 / 7.5 | 8.4 |
| BABIP | .268 / .263 / .267 | .267 / .271 / .255 | .291 |
| runs / team-game | 4.37 / 4.50 / 4.39 | 3.91 / 3.99 / 3.63 | 4.45 |
| OBP | .312 / .317 / .320 | .292 / .291 / .287 | .315 |
| pitches / team-game | 139 / 139 / 141 | 135 / 136 / 135 | 146 |
| chase | .225 | .274 | .283 |
| breaking balls swung at, heart to 8+ in out | .70 .55 .37 .20 .06 | .61 .57 .47 .34 .14 | .69 .60 .46 .33 .15 |
| breaking balls chased below, 6-9 / 9-12 / 12+ in (whiff per swing) | .16 / .09 / .03 (.74 / .75 / .92) | .41 / .28 / .12 (.59 / .67 / .71) | .36 / .28 / .11 (.78 / .91 / .97) |
| two-strike swings at breaking balls, deep in the zone to the edge | .89 .91 .87 .79 | .82 .81 .79 .76 | .96 .92 .88 .82 |
| fastball fouls per swing | .327 | .317 | .451 |
| contact score (90 targets; by reach) | .0630 (.051) | .0708 (.073) | |

It met the step's stated aim: the league's far chases with strikeouts at 22.0-22.8%, no overshoot (#31's v3.3 on v3.2 had 23.8-24.6). But walks fell past the league's (6.9-7.6), runs to 3.63-3.99 (worst seed 3.63 against 4.39), pitches to 135 and the contact score by reach worsened. The cause is in the curve: the picture's shift is proportional to each pitch's break still to come (measured in v3.4: curveballs pictured 9.6 in higher than their true place on average, sliders 5.7, sweepers 5.5, splitters 4.9, changeups 3.5), so it spreads the pictures and flattens the swing curve; the policy's one two-strike threshold then trades swings deep in the zone for chases, and breaking balls in the zone are taken for strikes (.82 against .96). The far chases are also missed too rarely (.59 / .67 / .71 against .78 / .91 / .97): reaching contact is too good. Recorded, not kept.

**What is left.** The far chases come with DEC_UNSEEN, but its shift makes strikes look like balls. A form that shifts the picture only for pitches whose break carries them out of the zone has no measured basis yet; the next measurement is the league's swing rate at breaking balls by where they ended against where a pitch of that shape was headed at the commit point (the in-zone takes are the test). With the strikeouts the league's, the run gap would be BABIP's.

### 3. RE: the quality of reaching contact (measured; nothing built)

Fastball contact by distance from the zone's edge and by direction out of it (league from 42 days; model v3.1, 600 hitters x 40 PA). "Efficiency" is exit speed over Statcast's squared-up ceiling (1.23 x bat + 0.23 x pitch), so the bat speed lost to reaching (BAT_LOC, v3.0) is taken out; balls in play only:

| | league n | league EV in play | league efficiency | model EV in play | model efficiency |
|---|---|---|---|---|---|
| heart (4+ in inside) | 15,186 | 94.3 | .851 | 91.9 | .838 |
| edge, 0-4 in inside | 10,447 | 89.3 | .817 | 89.6 | .826 |
| edge, 0-4 in outside | 4,220 | 82.9 | .772 | 85.4 | .801 |
| 4-8 in outside | 839 | 74.5 | .709 | 79.7 | .767 |
| 8+ in outside | 109 | 62.5 | .634 | 72.1 | .716 |
| in toward the batter 0-4 / 4+ | 1,600 / 392 | 75.5 / 62.2 | .702 / .586 | 79.0 / 74.7 | .731 / .709 |
| away 0-4 / 4+ | 1,099 / 193 | 86.6 / 77.7 | .802 / .752 | 87.5 / 79.7 | .823 / .768 |
| below 0-4 / 4+ | 344 / 47 | 90.8 / 74.3 | .821 / .682 | 90.1 / 84.9 | .827 / .792 |
| above 0-4 / 4+ | 1,177 / 316 | 88.7 / 87.7 | .848 / .853 | 84.3 / 78.5 | .811 / .779 |

**Confirmed, and it depends on the direction.** Reaching cost the league's contact its quality beyond the bat speed: efficiency in play fell .14 from the heart to 4-8 in outside (the model's .07) and .22 to 8+ in (the model's .12). Most of it was inside (jammed: .586 at 4+ in against the model's .709) and below (.682 against .792, a thin sample); away the model was close (.768 against .752); above, the league's contact lost nothing (.85, as in the heart) while the model's lost .03-.06. The launch spread grew with reach alike in both (launch sd from the heart to 8+ in outside: 29 to 35 deg in the league, 29 to 37 in the model). So the model's reach cost (every execution error x (1 + reach / coverage), the same in every direction) is too small inside and below and too large above.

**Tried: the hands cover less of a reach (HAND_MISS split in and out; scratch on v3.1 with DEC_UNSEEN).** HAND_MISS (0.3, the share of a pitch's distance in or out that the hands do not cover) has no stated measurement. Out 0.45 brought the away efficiency to the league's (0-4 in .793, 4+ in .753 against .802 and .752); in 0.5 took the inside 0-4 in to .630 (league .702, too far) while 4+ in stayed .685 (league .586), because the deepest jams became misses inside the hands rather than weak contact. Both raised the fastball whiffs (.174 to .183-.195, misses past the end and inside the hands; the league's swings missing by 3+ in are already .014 against the model's .023). Not built: the league's reaching contact gets weak without missing more.

**What is left.** The cost of a reach should depend on its direction: inside jams the ball on the handle as contact, not as a miss (the model counts contact to 14 in from the sweet spot, where its collision efficiency is about -0.11; the league's jammed balls in play imply about -0.05); a low reach tops the ball; a high reach costs bat speed (BAT_LOC has it) but not the strike. Proposed as hypothesis RD.

### Proposed changes to the mysteries and hypotheses tables

- **Mystery 1 (fouls and strikeouts):** the fouls are grazes (a third of the league's tracked fastball contact; exit speed follows the pitch's speed, at .817 of it). v3.2 + v3.3 brought fastball fouls to .446 and K% to 22.3-23.0 but BABIP to .224-.232 and runs to 3.4: blocked by BC.
- **Mystery 4 (far chases):** v3.4 brought them (chase .274; 6-9 / 9-12 in below .41 / .28) with K% 22.0-22.8, but walks to 6.9-7.6 and runs to 3.6-4.0: the in-zone takes (DF).
- **Mystery 5 (batted-ball mix and BABIP):** add that breaking balls are fouled .565 of contact against .442 (pulled foul) and that their path is 4-5 deg too steep, hidden in v3.1 by topping; any change that raises the aim exposes it.
- **Mystery 7 (reaching contact):** restate with the efficiency in play by direction (table above): inside .709 against .586, below .792 against .682, above .779 against .853.
- **New hypotheses:**
  - **BC, breaking-ball contact** (mysteries 1, 5): slow pitches are met too far out front because the timing's pull toward the expected pitch grows linearly with the speed gap where the league's flattens past about 9 mph (curveballs +9.4 in against +6.6), and the bat's path rises 1.0 deg per inch across pitch types where the league's rises 0.73-0.84. Test: the timing cap (measured from depth by pitch type) with the attack across types; judge by the breaking balls' foul share (.442), pop-ups (.058 per contact) and attack (11.6). First in line: it blocks FL.
  - **DF, the decision's picture flattens** (mysteries 4, 1): DEC_UNSEEN's shift spreads with each pitch's break and takes breaking balls in the zone. Test: the league's swings at breaking balls by where they ended against where their shape was headed at the commit point.
  - **RD, the reach's cost by direction** (mystery 7): see section 3.
  - **KB:** refuted (two-strike swings take as long: 70.5 ms of swing length over bat speed against 69.4).
  - **FG and FL:** FG confirmed with its physics measured (the grazes); FL's suspect (fastball under-contact landing fair) refuted, replaced by BC.
- **Order:** BC first (it unblocks the fold, which is ready), then DF (it unblocks DEC_UNSEEN), then RD.

### Proposed trait map constants (none adopted on this branch)

- `MU_BAT` 0.27: ball-bat friction on a glancing strike, fitted to its own measurement (the grazes' speed, .817 of release); ready when the fold returns.
- `LOOK_SD` 0.5 in with `motorIn` x1.15 (x1.96 over v3.1 in all): the last look's error, fitted to the grazes' share of contact (.33 of fastball contact); with v3.2's `LOOK_GAIN` 1.3 (class O).
- `DEC_UNSEEN` 0.5 up-down, 0.25 across: class O, fitted to the league's chases by direction.
- A timing cap of about 18 ms on the prior's pull (candidate for BC), fitted to the league's contact depth by pitch type.
- `HAND_MISS`: no measurement found; a split (out 0.45) fits the away efficiency but costs whiffs.

### Commits on the branch

`14c4454` FL diag scripts; `3d467d9` v3.2 carried over and chained (recorded); `d1e273e` v3.3 FL and chained (recorded); `bd6e19d` v3.2 and v3.3 taken back out; `c7075d2` v3.4 DEC_UNSEEN and chained (recorded); `a8e3b8a` v3.4 taken back out; `b3b296b` KB and RE diag scripts. The chained engines can be restored from their commits (`git show d1e273e:bb_engine.js`, `git show c7075d2:bb_engine.js`).

## The current rules (bb_game v1.6, bb_schedule v0.8, bb_league v0.2; 2026-10-06)

Joe (2026-10-06): the model plays the current rules, 2023 on (until then pre-2023 with shifts allowed). Every number the model is measured against is 2025's, and the playoff forecasts are for 2026.

- The designated hitter for both sides in every game, the TV's schedule and the league season included (bb_schedule v0.8, bb_league v0.2). NL rules remain for a caller who asks.
- The shift ban: two infielders on each side of second, all four on the dirt (the men-on-base job's measured 2025 positions, bb_field v1.8).
- Every pitcher faces three batters or finishes the half-inning.
- At most two throws over a plate appearance (a third that missed would be a balk, so he does not make one).
- The 18-in bases take 4.5 in off the steal of second and third.
- From the tenth inning of a regular-season game each half starts with the man who batted before its leadoff hitter on second (`o.ghost`; the postseason passes `ghost: false`).
- The pitch clock is not modelled: it sets the pace, and nothing in the model depends on the time between pitches.

The reliever is now picked for the three hitters due up: among the freshest arms (within ten pitches of load), the one with the most of them on his own side. bb_game's header had described a matchup choice since v0.4, but the hitters due up were never looked at (`def.oppOrder` was never set).

invariants_check v0.4 checks the three new rules. Against the old game file (400 games at seed 11) it found three pitchers who left before facing three batters or finishing a half, and one plate appearance with three throws over; with v1.6 it found none (400 games at seed 11, 300 at seed 29). On the suite (seeds 3 / 11 / 29, before and after): runs 4.37 / 4.36 / 4.59 to 4.57 / 4.64 / 4.60 (the extra-innings runner, and the seeds' spread), K% 18.4 / 18.4 / 19.1 to 17.8 / 18.4 / 19.1, BB% 8.5 / 9.0 / 9.1 to 9.0 / 9.2 / 9.0. The three-batter minimum barely bound: the old managers had broken it three times in 400 games.

## The platoon split: the release behind his shoulder (engine v3.2; 2026-10-05)

Joe's brief (`docs/briefs/2026-10-05_platoon.md`): the model's same-side batters did better, the league's do worse; measure the league's split by component and pitch type with the batter and the pitcher held fixed, measure the model the same way, find what gives the model's same-side batter his edge, and build the mechanism the measurements support. Runs: the league's split from pitch-level Statcast (42 days of 2025, 145,252 pitches, 37,238 plate appearances; new: `statcast/platoon.py`, which writes `statcast/platoon_2025.json` and `.js`); the model's split from the same men drawn with both hands on the same dice (new: `headless/platoon_check.js`, 300 batters x 40 PA x 4 hand combinations x 60 pitchers, seeds 3 and 11, every pitch valued in runs with the league's run values by count and ball-in-play value by launch angle and exit speed); scratch runs with the pitcher's plan made blind to the batter's side (`tools/diag/platoon_sym.js`); the fit of one constant over seeds 3 and 11 (`tools/diag/platoon_k.js`, `tools/diag/platoon_score.py`); the refit chain and the suite.

**Who is batting and who is pitching hide most of the split.** Raw, right-handed batters showed no platoon split at all (wOBA .318 against .319, same side minus opposite) and left-handed batters a large one (-.032): left-handers are kept away from left-handed pitchers, and the left-handers who face them are the ones who can. Within batter the splits were -.009 (right) and -.042 (left); within pitcher -.013 and -.024. Both at once can be held fixed, but then only the two hands' average is identified: with a batter effect and a pitcher effect in the regression, the right-handed split's dummy and the left-handed split's dummy differ by terms the effects absorb (the batter's hand, the pitcher's hand), so a two-way regression gives one number, their sum. The two-way average was **-.028 of wOBA (se .007)**, and every component below is that two-way average unless it says otherwise. (The one-way splits are per hand but each carries the other pool's quality with opposite signs on the two hands, which is why they straddle the two-way number.)

**The league's split by component** (same side minus opposite, two-way):

| | split | se |
|---|---|---|
| wOBA | -.028 | .007 |
| K per PA | +.008 | .005 |
| BB per PA | -.015 | .003 |
| HR per PA | -.007 | .002 |
| xwOBA on contact | -.041 | .006 |
| exit speed | -2.5 mph | 0.2 |
| launch angle | -3.1 deg | 0.4 |
| in zone (the pitcher's choice) | +.018 | .003 |
| swing | -.001 | .003 |
| zone swing | -.026 | .004 |
| chase | +.013 | .004 |
| zone contact | -.009 | .004 |
| whiff per swing | +.013 | .004 |
| called strike per take | +.032 | .004 |
| run value, per 100 pitches | -0.61 | 0.15 |

The largest piece was the contact: same-side contact came off 2.5 mph slower and 3 deg lower, worth .041 of xwOBA, where the discipline moved by a point or two (fewer swings at strikes, a few more chases and whiffs, more called strikes). Taking the eight pitch types apart (run value per pitch, the types' shares against their values), the split was almost all within type: for left-handed batters, where the raw split is not confounded away, the mix (which types he sees) was worth -0.07 runs per 100 pitches and how each type played against him -0.62. The pitch mix by platoon is large (same-side batters see sinkers x1.7, sliders x1.5, sweepers x2, and changeups x0.3, splitters x0.4) but nearly value-neutral in the league.

**By pitch type**, the same-side penalty (two-way) sat on the pitches that move sideways and on contact: whiffs per swing sliders +.047, sweepers +.092, cutters +.046, four-seamers +.020; sinkers -.015 but chased +.097 (the one running in at him is swung at and jammed: exit speed -5.1 mph); xwOBA on contact -.064 to -.071 on sinkers, sliders, sweepers and curveballs, -.048 cutters, -.015 four-seamers, and +.013 on changeups, the one type that did not play worse from the same side. By location in the batter's frame, same-side pitches off the plate away were whiffed .60 against .37 (sliders and sweepers breaking away against changeups and sinkers running away), and off the plate inside .19 against .46 with twice the swings (.31 against .21: the sinker that looks like a strike and runs in).

**The read worsens with the release's angle behind his line of sight, not with the pitcher's hand as such.** Each release was placed against the batter's eye (1.8 ft from the plate's centre line toward him, 0.7 ft in front of the plate's point): psi, the angle toward his own side, + when the release sits behind his line of sight. Same-side releases sat at +0.12 deg (sd 0.79), opposite-side at -4.02 (sd 0.80). With batter, pitcher and pitch type held fixed, against the usual opposite-side release (-4.5..-3.5 deg):

| psi band (deg) | -9..-4.5 | -3.5..-2.5 | -1.5..-0.5 | -0.5..0.5 | 0.5..1.5 | 1.5..9 |
|---|---|---|---|---|---|---|
| share of pitches | .135 | .110 | .095 | .241 | .139 | .019 |
| whiff per swing | -.007 | +.005 | +.019 | +.027 | +.026 | +.003 |
| chase | -.000 | +.014 | +.016 | +.024 | +.028 | +.058 |
| zone swing | -.024 | +.024 | +.032 | -.010 | -.034 | -.057 |
| zone contact | +.003 | +.005 | -.007 | -.017 | -.025 | +.012 |
| xwOBA on contact | +.001 | -.000 | -.034 | -.043 | -.036 | -.041 |
| exit speed (mph) | +0.2 | -0.3 | -2.8 | -2.7 | -2.6 | -2.3 |
| bat speed (mph) | +0.05 | -0.36 | -1.23 | -1.08 | -0.95 | -0.73 |
| launch minus attack (deg) | -0.9 | -0.1 | -2.0 | -3.3 | -3.5 | -5.6 |
| topped (miss under -5 deg) | +.018 | +.008 | +.023 | +.047 | +.045 | +.087 |
| run value per 100 | +0.04 | -0.14 | +0.03 | -0.62 | -0.74 | -1.43 |

The opposite-side bands are flat; the penalty is there in full by the first same-side band and the zone judgement keeps worsening as the release goes behind him (zone swing +.032 to -.057, chase +.016 to +.058, launch minus attack -2.0 to -5.6). The sidearmer's platoon split is this ramp. Without the type dummies the whiff and exit-speed rows ramped too (+.011, +.026, +.027; -2.3, -3.0, -3.1), which was the low slots' repertoires (sinkers and sweepers), not the read.

**What the swing itself does against a release behind him** (bat tracking, full swings of 50+ mph; two-way with pitch type held fixed): bat speed -0.99 mph (se .05), swing path tilt -1.1 deg, swing length -0.02 ft, contact depth +0.3 in, and the barrel higher on the ball: launch minus attack -2.8 deg (se .4), topped balls +.036, under -.015, squared-up contact -.025, exit speed over its maximum -.007. So the league's contact penalty is a slower bat and a barrel over the ball, both systematic, not a scattered barrel.

**What the model did** (as built, engine v3.1; the two hands' average over seeds 3 and 11, every split within batter and within pitcher by construction): wOBA +.021 (right-handed +.026 / +.017, left-handed +.024 / +.021), K -.028, BB +.002, xwOBA on contact +.018, exit speed +0.5 mph, launch angle -0.6 deg, zone swing -.004, chase -.005, zone contact +.021, whiff -.018, called strike per take -.005, run value +0.52 per 100 pitches. The pitch mix by platoon was the league's (same-side sinkers +.085 of pitches against +.085, changeups -.101 against -.132) and the aim was the league's; the values were not: same-side fastballs, sinkers, cutters, sliders and sweepers all played BETTER for the model's batter (+0.6 to +1.3 runs per 100 pitches, whiffs on sliders -.027, xwOBA on sweepers +.081), changeups and splitters worse (-0.6, -0.4), where the league has the first group worse (-0.2 to -0.9) and the changeup better (+0.3). Taken apart, the model's split was +0.16 the mix and +0.59 within type (seed 3, right-handed).

**The cause: the model had no platoon mechanism at all.** With the pitcher's plan made blind to the batter's side (the same-side and opposite-side aim averaged; the mix averaged; both), on the same dice: aim blind, wOBA +.015 / +.014; mix blind, +.013 / +.016; both blind, **+.005 / +.007** (se .007), with whiffs -.005 / +.005 and strikeouts -.003 / +.004. Everything hand-dependent in the engine was the league's own pitch mix and aim by platoon; the batter read every release alike, and to him the league's same-side package (sinkers and sweepers in, changeups out) was the easier one, because the model's breaking balls play too well and its changeups too poorly against the league's (mystery 4, the far chase, and the whiffs by kind: changeups .34-.41 against .30-.33). That wrong-signed +.02 is what the mix and the aim are worth to the model's batter; the league's same-side batter loses .028 on top of a near-neutral mix because he reads the release worse.

**Built: THE RELEASE BEHIND HIS SHOULDER (PL, engine v3.2).** The release's angle psi toward the batter's own side is computed from the release point and his eye (`releaseAngle`); a ramp max(0, psi + 3 deg), centred on the league's mean of it over its matchups (1.593 deg; same-side pitches average 3.12, opposite-side 0.04), drives three things:

1. **the read's noise** - his pickup (spotIn), his judgement of a pitch he has picked up (the prior's pull) and his eye at the decision (eyeSD), all through the time-pressure term they already share - grows by PL.read = 0.03 per degree (so +9% behind a same-side release, -5% against an opposite-side one). FITTED (class O): the band score (the three main same-side bands, seven stats, against the league's type-controlled estimates) had its minimum at 0.03 on both seeds (125 and 163 against 136 and 169 at 0.04, 189 at 0.02); whiffs per swing came to +.023 / +.028 at the centre band against the league's +.027, chases to +.005 / +.011 against +.024, zone swings to -.031 / -.019 against -.010;
2. **a slower bat**, PL.speed = 0.0045 of his speed per degree: the league's -0.99 mph over the 3.08 deg between the sides, MEASURED;
3. **the barrel higher on the ball**, PL.over = 0.039 in per degree: the league's launch minus attack of -2.8 deg at this engine's 23 deg of launch per inch of barrel height, over the same 3.08 deg, MEASURED.

The centring keeps the average batter's noise, bat speed and barrel height at what the traits were fitted to. The last-look steer, the swing policy and the collision are untouched.

**Tried and not kept.** The read's noise alone (no swing channels): at 0.05 per degree the whiffs and zone swings were the league's but contact did not weaken at all (xwOBA -.003, exit speed -0.1 mph): in this engine perception noise reaches the decision and the misses, never the quality of a hit. A scattered barrel (the execution scatter scaled by the same ramp) bought the exit speed only with twice the league's whiffs (-2.8 mph with whiffs +.069 against +.027), which is what sent me to the bat tracking. A ramp starting at -1 deg rather than -3: the type-controlled bands showed the penalty in full by -1.

**Results (after the chain; seeds 3, 11, 29; `tools/diag/compare.py` against the integration's baseline `diag_out/base_dh`).**

| | before (3, 11, 29) | after | league |
|---|---|---|---|
| runs per team-game | 4.37 / 4.50 / 4.39 | 4.34 / 4.39 / 4.55 | 4.45 |
| hits | 8.27 / 8.13 / 8.27 | 8.02 / 8.24 / 8.41 | 8.26 |
| walks | 3.31 / 3.65 / 3.63 | 3.51 / 3.54 / 3.58 | 3.16 |
| strikeouts | 7.45 / 7.28 / 7.22 | 7.12 / 7.35 / 7.29 | 8.36 |
| home runs | 1.36 / 1.42 / 1.33 | 1.45 / 1.24 / 1.35 | 1.16 |
| AVG | .240 / .238 / .240 | .235 / .241 / .243 | .245 |
| OBP | .312 / .317 / .320 | .312 / .317 / .321 | .315 |
| SLG | .415 / .415 / .410 | .415 / .405 / .415 | .404 |
| BABIP | .268 / .263 / .267 | .256 / .272 / .271 | .291 |
| K% | 19.5 / 19.1 / 18.7 | 18.7 / 19.2 / 18.8 | 22.2 |
| BB% | 8.6 / 9.5 / 9.4 | 9.2 / 9.2 / 9.3 | 8.4 |
| HR% | 3.6 / 3.7 / 3.4 | 3.8 / 3.2 / 3.5 | 3.1 |
| double plays | 0.70 / 0.75 / 0.68 | 0.77 / 0.63 / 0.69 | 0.75 |
| pitches per team-game | 139 / 139 / 141 | 139 / 140 / 141 | 146 |
| whiffs per swing FB / BR / OS (probe) | .162 / .328 / .362 | .172 / .308 / .326 | .174 / .310 / .301 |
| chase / zone swing (discipline_check) | .225 / .658 | .232 / .668 | .283 / .667 |
| breaking balls swung at, heart to 8+ in out | .70 .55 .37 .20 .06 | .72 .58 .40 .21 .07 | .69 .60 .46 .33 .15 |
| contact score (90 targets) | .0630 | .0655 | |
| foul share of contact struck square | .275 | .291 | .211 |

The game line moved within the seeds' spread on every row (the worst seed on runs, 4.34, sits beside the baseline's 4.37; BABIP's worst seed .256 against .263). Whiffs by kind came nearer the league's on all three kinds after the refit, and breaking balls are swung at a little more in every band. **The cost:** the contact score rose .0630 to .0655, all of it in the part scored by reach (.051 to .060; the misses, the squared-up contact and the vertical miss each improved a little), and the foul share of contact struck square rose .275 to .291, away from the league's .211. Strikeouts and walks did not move (the fouls, mystery 1).

**The platoon split after the build** (the probe on the chained engine; the two hands' average; seeds 3 / 11; before = engine v3.1 on the same seeds):

| | before | after | league, two-way |
|---|---|---|---|
| wOBA | +.025 / +.019 | **-.026 / -.012** | -.028 (within batter -.009 to -.042) |
| K per PA | -.028 / -.028 | +.013 / +.010 | +.008 |
| BB per PA | +.002 / +.002 | -.004 / +.001 | -.015 |
| xwOBA on contact | +.025 / +.012 | -.017 / -.011 | -.041 |
| exit speed (mph) | +0.7 / +0.3 | -0.9 / -1.1 | -2.5 |
| launch angle (deg) | -0.7 / -0.4 | -2.8 / -3.2 | -3.1 |
| zone swing | -.005 / -.003 | -.037 / -.032 | -.026 |
| chase | -.005 / -.005 | +.006 / +.006 | +.013 |
| zone contact | +.021 / +.021 | -.006 / -.009 | -.009 |
| whiff per swing | -.018 / -.018 | +.013 / +.014 | +.013 |
| called strike per take | -.004 / -.006 | +.019 / +.013 | +.032 |
| run value per 100 pitches | +0.62 / +0.43 | -0.43 / -0.29 | -0.61 |

By release-angle band (type-standardised, against the usual opposite-side release; seeds 3 / 11, the league's type-controlled estimate in brackets): whiffs +.040 / +.030, +.027 / +.023, +.037 / +.039 (+.019, +.027, +.026); chases +.021 / -.005, +.016 / +.012, -.002 / +.001 (+.016, +.024, +.028); zone swings -.006 / -.024, -.022 / -.020, -.042 / -.032 (+.032, -.010, -.034); zone contact -.032 / -.027, -.016 / -.018, -.026 / -.027 (-.007, -.017, -.025); xwOBA on contact -.017 / -.015, -.021 / -.019, -.020 / -.026 (-.034, -.043, -.036); exit speed -1.2 / -1.2, -1.0 / -1.2, -0.9 / -1.0 (-2.8, -2.7, -2.6); run value -0.67 / -0.32, -0.53 / -0.49, -0.49 / -0.40 (+0.03, -0.62, -0.74). The sign is the league's on every line of both seeds; the size is the league's on the discipline and the strikeouts, and about half of it on the contact.

**K% against release height and BB% against arm angle** (`headless/pitcher_chain_check.js`, 240 pitchers x 250 PA, seeds 3 / 11): K% ~ release height -.11 / -.03 (the audit's +.16; league -.22), BB% ~ arm angle +.08 / +.06 (the audit's about 0; league +.20); K% ~ fastball speed +.36 / +.37 (.52), as before. Both turned to the league's sign through the ramp: a low slot releases further behind the same-side batter. The rest of the league's correlation is the managers' doing, who send a sidearmer out against his own side; the model's managers do not platoon yet.

**Left open.**

- **The contact half of the split is under half the league's** (exit speed -1.0 mph against -2.5, xwOBA on contact -.014 against -.041). The measured bat speed (-1.0 mph) and barrel height (2.8 deg over the ball) reproduce themselves in the model and give it one mph of exit speed; the league loses 2.7, because its same-side contact is also less square (squared-up -.025, exit speed over its maximum -.007). In this engine a less precise barrel means a miss, not a weak hit: perception noise reaches the decision and the whiffs and never the quality of a hit that is made. That is mystery 7's question too (reaching contact comes off too hard): how off-centre contact leaves the bat.
- **The decision's balance.** The eye's noise took swings at strikes (-.035 against the league's -.026) more than it added chases (+.006 against +.013). With pitch type held fixed the league's same-side batter swings MORE at balls and barely less at strikes (+.024, -.010): a bias toward swinging, not noise alone; he judges a same-side pitch nearer the zone than it is (the sinker running in at him is chased +.097). The candidate is the pitch's late lateral movement, which he under-reads from behind his shoulder; not built.
- **Walks.** The model's same-side batter walks the same (-.004 / +.001 against -.015). The league's same-side pitcher throws more strikes (+.018 in zone, two-way), the model's a few fewer (-.006): PLAN carries the league's mean location by side, and the zone rate that falls out of it with his command is not quite the league's. To measure: the league's zone rate by type and side against the model's.
- **The model's own pitch-type values** are the other half of the sign. With the plan blind to the batter's side the split was +.005; the league's same-side mix and aim, near value-neutral in the league, are worth +.02 to the model's batter because breaking balls play too well and changeups too poorly against it (mystery 4). PL carries the split to the league's size on one seed and half on the other; closing mystery 4 would carry it the rest of the way without touching PL.
- **Switch hitters** always bat opposite in both and are untouched. The reference eye position (1.8 ft from the centre line, 0.7 ft in front of the plate's point) is assumed, not measured; it sets where psi = 0 falls and nothing else, since the ramp is centred on the league's matchups.

**Proposed changes to the tables.**

- Mystery 8 (the platoon split has the wrong sign): closed in sign on every component and in size on the discipline and the strikeouts; restate as *the platoon split's contact half*: same-side contact comes off 1.0 mph slower in the model against 2.5 in the league, xwOBA on contact -.014 against -.041, and the same-side batter does not walk less (-.004 / +.001 against -.015).
- Hypothesis PL: CONFIRMED and BUILT (engine v3.2). The release's angle behind the batter's line of sight is the variable, not the pitcher's hand: the penalty is flat across the opposite-side releases and ramps through the same-side ones, a sidearmer's worst. Three channels: the read's noise (fitted, class O), the bat's speed and the barrel's height (measured).
- New hypothesis **PB**, the swing bias behind the shoulder: a same-side pitch's late lateral movement is under-read, so he judges it nearer the zone than it is (the sinker running in is chased +.097, the league's zone swing falls only -.010 with type held fixed) and meets it off the sweet spot (squared-up -.025): would close the contact half and the decision's balance. Mysteries 8, 7. Likelihood: likely.
- Trait map: add PL (`releaseAngle`, `ramp`): PL.read 0.03 per deg (fitted, class O), PL.speed 0.0045 of bat speed per deg (measured), PL.over 0.039 in per deg (measured), psi0 -3 deg and the centring 1.593 deg (measured from the league's releases), the eye at (1.8 ft, 0.7 ft) (assumed). The chain's refit: SWING_THR, HITTER_VALUE, PITCHER_VALUE, FIELD_VALUE and the pool, as pasted.
- The audit's two correlations: K% ~ release height -.03 to -.11 (was +.16; league -.22), BB% ~ arm angle +.06 to +.08 (was 0; league +.20).

## Ground balls by launch angle: the bounce, the grass infield, the catch in the air and the fielder's first step (bb_field v1.11, bb_engine v3.3 after the integration renumbered them; 2026-10-05)

The brief (`docs/briefs/2026-10-05_ground_balls.md`): choppers at -10 to 0 deg were hits .135 of the time against the league's .249, low liners at 0 to 10 deg .538 against .482, and BABIP .263-.268 against .291. Runs: the league's ground balls and low liners (launch angle -30 to 15 deg) from the 42 days of 2025 by launch angle, exit speed, direction and the fielder who handled them (new: `statcast/ground_balls.py`, 12,801 balls); the model the same way on whole games (new: `headless/ground_check.js`, 300 games at seed 3); the ball's track through `bb_field.js` on representative balls; the published physics of a ball bouncing on dirt and turf, read in full; Statcast's outfield jump in all its windows; the refit chain and the suite (seeds 3, 11, 29) against `base_dh`; six variants of the fielder's motion on the suite to attribute the costs.

**What the league showed.** Hits per ball rose smoothly with launch angle, .05 at -30 to -20 deg, .09-.18 at -20 to -10, .18-.33 at -10 to 0, .38-.58 at 0 to 10 and .71-.80 at 10 to 16, and with exit speed on the ground (.087 under 70 mph, .229 at 85-90, .340 at 95-100, .471 at 105-110). Infield hits (a hit handled by an infielder) were .061 of ground balls, flat with exit speed (.05-.07 from 70 to 110 mph) and with launch angle (.04-.06 on choppers steeper than -14 deg, .06-.08 from -6 to +10), and rose with the batter's sprint speed (.045 for 25.5-27 ft/s, .065 for 27-28.5, .075 above 28.5; .055 for the slowest, n 766). Errors were .014 per ground ball. At 5-10 deg the league caught .138 of balls in the air (line-outs; .168 at 10-15 deg, .009 at 0-5), and its infielders handled .52 of the 5-10 deg balls; when an infielder handled a ball at -5 to +5 deg it was still a hit .06-.09 of the time. By direction (the hit coordinates, home plate at 126.0, 205.0, + pulled) the opposite field was always the softest: at -5 to 0 deg .385 opposite, .330 middle, .251 pulled; at 0-5, .535 / .455 / .351. Under the shift ban the infield was Standard on .655 of ground balls (hits .294), shaded on .245 (.283) and Strategic on .100 (.286). Statcast's hit distance on a ground-ball out marks its first bounce: a median 22-33 ft for -5 to 0 deg, 39-71 for 0-5 and 68-122 for 5-10, rising with exit speed. Relative to the league's average starting spots with the bases empty (Baseball Savant positioning, branch men-on-base), infielders made ground outs a median 20-21 ft from their spot at 90-110 mph (p90 38-42 ft; first basemen 11-13, the others 19-25), with no fall as exit speed rose, so that table measures the pitch-to-pitch scatter of positioning as much as the fielder's range.

**What the model did (the baseline, `base_dh`'s code).** Hits per ball were .250 on ground balls (.291) and .337 over -30 to 15 deg (.369): .055-.091 at -12 to -6 deg against .18-.21, .19-.25 at -4 to 0 against .28-.33, then .56-.79 at 4-10 deg against .49-.58. By direction the pulled side died (.027-.076 at -20 to 0 deg against .095-.251) while the opposite field got through more than the league's (.231-.475 against .367-.385); with the infield's pull turn switched off in a scratch copy the ground-ball hit rate went .250 to .261 and the deficit became even across directions, so positioning explained about a quarter of the gap and belongs to the men-on-base job. In the air the model caught .043 of 5-10 deg balls (.138). Infield hits were .051 of ground balls, but .104 under 70 mph (.068) and .027-.045 from 85 to 105 (.061-.069), most of them muffs.

**Where the difference arose: the bounce.** A 95-mph ball at -5 deg landed 26 ft out at 0.17 s doing 91 mph, hopped 0.31 m, and reached 35 m (the corner infielders) at 1.60 s doing 28 mph and 45 m (shortstop depth) at 2.46 s doing 23 mph: three bounces had taken 70% of its speed. The bounce kept `BOUNCE_KF - C vn/vh` of the horizontal speed (0.76 - 0.35 vn/vh on dirt), a line fitted through the Pennbounce measurements at 25 and 35 deg that extrapolated to a 24% loss at grazing incidence. That is unphysical: during a bounce the friction impulse cannot exceed the friction coefficient times the normal impulse (Cross 2002, below), and at a 5-deg bounce the normal impulse is a twelfth of the horizontal momentum. With a slow ball every infielder had time to range: they fielded choppers a median 6-7 m from their spot, 1.7-2.0 s after contact. The infield was also entirely dirt, a circle 93 ft round the mound, so the first bounce (20-70 ft out) was on the faster surface where the league's is on grass. Last, a liner could be caught only at its landing point (`catchChance` looked nowhere else; gap 6 of CALIBRATION), so a ball passing an infielder at chest height went through.

**The physics brought in** (each paper read in full).

- Cross, R., "Grip-slip behavior of a bouncing ball", Am. J. Phys. 70, 1093 (2002). Measurements of the normal and friction forces on bouncing balls, a baseball among them. At low angles of incidence a ball slides throughout the bounce and its horizontal speed falls by mu (1 + e_y) v_y (his eq. 4), the spin rising by the matching impulse (eq. 5); at steeper angles the bottom grips and the ball comes off spinning a little faster than rolling (a baseball at 41 deg on a smooth surface: e_y 0.39, horizontal speed kept 0.76, R w2 = 1.13 v_x2). The sliding regime ends when the friction impulse reaches 2/7 of the slip (a solid sphere, I = 0.4 m R^2). Cross's 1999 paper (Am. J. Phys. 67, 222) gave a baseball's own restitution on a rigid surface, 0.49 at 1.25 m/s.
- Brosnan, McNitt and Schlossberg, "An apparatus to evaluate the pace of baseball field playing surfaces", J. Testing and Evaluation 35, 676 (2007). Pennbounce: a ball fired at 31 and 40 m/s onto a skinned infield and natural turf at 25 and 35 deg, the speed kept measured by light screens (their table 5): skinned .549 and .610 at 25 deg, .471 and .518 at 35; turf .448 and .428, .358 and .281. These were the two points the old line went through. There are no measurements below 25 deg.
- Brosnan and McNitt, Penn State turfgrass annual report 2005 (the survey of 4 major-league, 4 minor-league and 6 college fields, Pennbounce at 25 deg and 40 m/s): skinned infields .562 (range .514-.584), natural turf .479 (.429-.533), the infield grass .484. The league's parks are faster than the test plot on turf (.479 against .44) and slower on dirt (.562 against .58). Brosnan, McNitt and Serensits (J. Testing and Evaluation 39, 2011) showed the dirt's pace follows its compaction (.44-.59), not its conditioner.
- Statcast's outfield jump, the 2025 leaderboard's raw feet (the CSV in `statcast/raw/2025` carries only the differences from average; the page's data carry the feet): 6.91 ft covered in any direction in the first 1.5 s after the pitch is released (about 1.07 s after contact), 30.0 ft in the next 1.5 s, 34.0 ft toward the ball in 3 s, and 24.0 ft/s as the fielders' average sprint speed on those plays.

**Built: the bounce (`bounce()` in bb_field).** The ball keeps BOUNCE_E of its speed into the ground (dirt .45, grass .35, unchanged; the Pennbounce totals cannot separate the vertical part from the crater). Along the ground it loses (1) Coulomb friction on the slip of its bottom point, the centre's horizontal velocity plus the spin's share there, an impulse of at most BOUNCE_MU (1 + e) vn and never more than 2/7 of the slip, with the spin changed by the same impulse; and (2) the soil's crater, a share BOUNCE_KC of the normal speed taken from the centre on top of friction, which is how dirt and turf take more horizontal momentum than a rigid surface can. mu was set so that the ball reaches rolling at the measured 25 deg (dirt 0.41, turf 0.45), and BOUNCE_KC fitted to the league parks' totals at 25 deg (dirt 0.28, turf 0.46); the 35-deg points then came out at .50 on dirt (measured .49) and .38 on turf (measured .32 on the test plot, which was slower than the parks at 25 deg too). At a 5-deg bounce the horizontal loss is now 7.5% on dirt and 10% on grass. The spin is carried from the flight (`landW`, bb_engine v3.2) and through each bounce, so a topped ball's topspin (the model's median 1,300 rpm at -5 to 0 deg, 2,800 at -20 to -10) grows at each bounce and the hop's Magnus force holds it down. The same 95-mph ball at -5 deg now hops 0.15 m and reaches 35 m at 1.06 s doing 59 mph and 45 m at 1.46 s doing 54 mph; the -25 deg chopper hops 2.4 m at 49 ft and reaches 45 m at 2.5 s doing 29 mph (was 16).

**Built: the surfaces (`onDirt`).** A grass infield, as every 2025 park has: dirt within the plate's circle (rule 2.01, 26 ft across) and the mound's (18 ft), and on the skin between the base paths and the outfield, the arc 95 ft from the rubber less the grass diamond inside the base paths (3 ft inside each base line); the paths home to first and third to home are dirt. The roll, once a hop is under 1 m/s, now feels the air (the engine's own batted-ball drag, 4.8 m/s^2 at 25 m/s, which the hops already felt) on top of the surface's hand-set resistance.

**Built: the catch anywhere along the flight (`catchChance`).** A fielder can catch a ball at any point of its path no higher than 2.6 m (a standing man's glove overhead with a small jump), with his reach to the side the full 1.2 m up to chest height (1.3 m, where a lunge or dive works) and tapering to nothing straight overhead, or at the landing point; the point taken is the one with the most time to spare, judged by the same margin rule as before (no new fitted constant). Line-outs at 5-10 deg went from .043 of balls to .17 (league .138) and at 10-15 deg from .130 to .18 (.168).

**Built: the fielder's first step.** With the ball at the right speed the infielders' reach was too small: the ground-ball hit rate went to .384 on the physics alone, with the react trait (0.47 s) and acceleration (5.5 m/s^2) that had been fitted to the jump's 3-second total only. Fitted to the jump's first window as well, with the model's own kinematics (first step, acceleration to top speed, route 0.90), the built pair covered 3.3 ft in the first window against the measured 6.9 and 31 ft in 3 s against 34; react 0.20 s and 5.0 m/s^2 cover 6.2 and 37.8 ft (the 3-s figure runs over because the model runs fielders at their top sprint speed, 27.3 ft/s, where the league averages 24.0 on these plays). The population's react mean is 0.234 so that the farm's picks average 0.20 (`fit_population` v0.7); the catcher's and pitcher's offsets were raised (0.37, 0.42) so their absolute reaction stayed where it was (0.57 and 0.62 s), since the jump says nothing about them. With react 0.20 the pitcher had been snaring comebackers at 0.45 s and the infielders catching liners at full lateral reach two and a half metres up, which is why the reach tapers with height.

**Results, the ground balls** (`ground_check`, 300 games at seed 3, after the chain; the league beside):

| | baseline | built | league |
|---|---|---|---|
| hits per ball, -30 to 15 deg | .337 | .368 | .369 |
| hits per ground ball (under 10 deg) | .250 | .304 | .291 |
| -10 to -6 deg / -6 to -2 / -2 to 2 | .074-.091 / .070-.193 / .254-.324 | .171-.251 / .320-.351 / .367-.389 | .18-.21 / .23-.28 / .33-.38 |
| 2 to 6 deg / 6 to 10 | .410-.558 / .626-.785 | .428-.455 / .559-.664 | .42-.49 / .53-.58 |
| by exit speed, ground balls, 85-90 / 90-95 / 95-100 / 100-105 | .153 / .199 / .283 / .352 | .202 / .297 / .347 / .462 | .229 / .270 / .340 / .431 |
| caught in the air, 0-5 / 5-10 / 10-15 deg | .001 / .043 / .130 | .033 / .173 / .184 | .009 / .138 / .168 |
| through to the outfield, -5 to 0 / 5 to 10 deg | .175 / .594 | .350 / .584 | .23 / .48 |
| infield hits per ground ball | .051 | .005 | .061 |
| errors per ground ball | .017 | .010 | .014 |
| time the infielder had the ball, -10 to 0 deg (median) | 1.7-1.9 s | 1.2-1.4 s | |
| ball's speed when fielded, -10 to 0 deg | 25-34 mph | 47-57 mph | |
| distance the infielder moved, -10 to 0 deg | 5.3-6.4 m | 3.4-4.2 m | |

**Results, the suite** (after the chain; seeds 3, 11, 29; `tools/diag/compare.py` against `base_dh`):

| | before (3, 11, 29) | after (3, 11, 29) | league |
|---|---|---|---|
| runs per team-game | 4.37 / 4.50 / 4.39 | 4.57 / 4.24 / 4.39 | 4.45 |
| hits | 8.27 / 8.13 / 8.27 | 8.32 / 8.01 / 7.91 | 8.26 |
| doubles | 1.65 / 1.56 / 1.62 | 1.74 / 1.67 / 1.62 | 1.59 |
| triples | 0.15 / 0.11 / 0.11 | 0.30 / 0.27 / 0.28 | 0.13 |
| home runs | 1.36 / 1.42 / 1.33 | 1.42 / 1.37 / 1.39 | 1.16 |
| walks | 3.31 / 3.65 / 3.63 | 3.41 / 3.41 / 3.48 | 3.16 |
| strikeouts | 7.45 / 7.28 / 7.22 | 7.07 / 7.26 / 7.16 | 8.36 |
| double plays | 0.70 / 0.75 / 0.68 | 0.86 / 0.94 / 0.88 | 0.75 |
| errors | 0.37 / 0.30 / 0.33 | 0.28 / 0.37 / 0.32 | 0.50 |
| AVG / OBP / SLG | .240 / .312 / .415 (seed 3) | .241 / .315 / .433 | .245 / .315 / .404 |
| BABIP | .268 / .263 / .267 | .264 / .261 / .256 | .291 |
| BABIP on the ground (under 10 deg) | .237 / .237 / .246 | .270 / .269 / .267 | .291 (same definition) |
| BABIP on liners (10-25 deg) | .640 / .637 / .625 | .574 / .562 / .565 | .68 |
| BABIP on flies (25-50 deg) | .112 / .104 / .107 | .086 / .081 / .085 | .12 |
| hits per ball by launch angle, -10 to 0 / 0-10 / 10-20 / 20-30 / 30-40 (bip_check, seed 3) | .139 / .544 / .717 / .356 / .102 | .297 / .501 / .647 / .312 / .084 | .249 / .482 / .691 / .350 / .109 |
| K% / BB% / HR% | 19.5 / 8.6 / 3.6 (seed 3) | 18.4 / 8.9 / 3.7 | 22.2 / 8.4 / 3.1 |
| contact score (90 targets) | .0428 .0596 .0816 .0510 | .0421 .0530 .0848 .0591 | |

**The costs, and where each comes from.** The ground balls are fixed and the batted-ball mix, strikeouts and walks untouched, but BABIP did not rise: three costs appeared, attributed by running the suite on variants of the fielder's motion.

1. *Liners and flies caught more often* (10-20 deg .717 to .647 against .691; liners .63 to .57, flies .11 to .085). Not the catch anywhere along the flight: without it (variant E) liners stayed .57-.59 and flies .087-.089. It is the quicker first step: with the old pair restored (variant G: 0.47 s, 5.5 m/s^2) liners came back to .61-.63 and flies to .10-.11 and the 10-20 deg band to .691 exactly, while ground balls went to .34-.36. The pair that fits the first window over-reaches at 2-3 s (the 3-s jump +11%), and the lever is sharp: 4.3 m/s^2 (variant D) sent ground balls to .31 and triples to 0.5. A profile that fits all three windows and the in-play speed (variant H: already moving at 1 m/s when the ball is hit, 0.20 s, 3.25 m/s^2 to 24 ft/s) kept ground balls at .28-.29 and liners at .63-.64 but let deep flies fall (.14-.15) and rolling balls run to the wall (triples 1.0-1.1): the constant-acceleration model of a fielder cannot serve a 1.3-s ground ball and a 4-s fly with one pair, and the outfielder's cut-off of a rolling ball is more sensitive to his top speed than anything else in the suite.
2. *Triples doubled* (0.11-0.15 to 0.27-0.30 against 0.13), doubles up a little. In 300 games the 175 triples were balls at 99-105 mph into the gaps and down the lines (80 at 10-20 deg, 50 at 0-10, 36 at 20-35), fielded at 350-375 ft 5.4-6.0 s after contact once the outfielder had run 32-37 m; the track would have stopped at 356-381 ft. The ball now reaches the wall where it used to die at 200-300 ft, the outfielder's intercept rule (the first point of the track he can reach) takes him to the wall rather than across it, and the runners' margins for third (SAFETY_3, fitted to the league's extra bases with the old ball) send the batter on. The sends belong to the men-on-base job; the outfielder's route to a rolling ball is a mechanism to measure (a wider reach for a rolling ball, variant C, did not help at 4.3 m/s^2).
3. *Double plays* 0.68-0.75 to 0.86-0.94 against 0.75: the ball reaches the infielder 0.5 s sooner, and the forced runner's break (V_CONTACT, "fitted to the league's double plays per game") and the pivot (PIVOT 0.35 s) were fitted around the old ball; both sit in the men-on-base job's force plays.

By the parallel rules a mechanism that moves its target and breaks other things is recorded, not kept; here the mechanism is the ball's physics, which is not in doubt, and what broke are constants fitted around the unphysical ball. The branch keeps the physics, the surfaces, the catch anywhere along the flight and the first step as fitted, and hands the three costs to the integration with their attribution; the alternative, the old first step on the physical ball (variant G), is worse on every line.

**Left open: the infield hits.** The model now makes .005 infield hits per ground ball against the league's .061, a fifth of the league's ground-ball hits; they fell from .051 because the old ones were muffs on slow balls, and the physical ball reaches the fielder so early that the throw beats the batter by a median 1.2-1.4 s on plays to first (the league's batters beat out .055 of ground balls even when their sprint speed is under 25.5 ft/s). The deficit sits on the softer balls (70-90 mph: hits .07-.20 against .12-.23, infield hits .000-.004 against .05-.06) while the hardest get through a little too often (100-110 mph .46-.52 against .43-.47). The candidates are on the throw's side, not the ball's: an infielder's exchange on a routine play (the `transfer` trait, 0.68 s, is the catcher's exchange), throws made at the arm's top speed on every play where the league's routine throws are not, and a ball reached at full stretch that is knocked down rather than fielded (the league's infielders turned .06-.09 of the balls they handled at -5 to +5 deg into hits). Each is a measurement to make before a mechanism is built: recorded as hypothesis IH below. Also left: the roll's surface resistance is still set by hand (2.4 and 3.2 m/s^2; a ball-roll measurement on baseball turf was not found); the vertical restitution on dirt and grass is not separated from the crater by any published test (a drop test on the skin would do it); the turf's 35-deg point is reproduced at .38 against the plot's .32; fielders run at their maximum sprint speed where the league's average 24 ft/s on plays; line-outs at 5-15 deg run .02-.04 over the league's.

**Tried and not kept.** The physics with the old first step (react 0.47, 5.5 m/s^2): ground-ball hit rate .384-.427 (the skinned infield made it .427), infield hits .005, the infielders covering half the distances the league's did on ground outs. React 0.20 applied to the pitcher and catcher too: the pitcher caught .06 of 0-5 deg balls in the air (league .009). Full lateral reach at any height up to 2.6 m: line-outs .19 at 5-10 deg and .25 at 10-15. The fielders' top speed set to the in-play 24 ft/s with 5.0 m/s^2 (variant B): BABIP .28-.29 but triples 0.43-0.49 and doubles 2.0-2.1. Variants D, C and H as above.

**Proposed changes to CALIBRATION's tables.** Mystery 5 (the batted-ball mix and BABIP): the ground-ball part is closed, choppers at -10 to 0 deg .30 against .249 and low liners at 0 to 10 deg .50 against .482 (seed 3, bip_check); what remains of it is the liner share of balls in play (the contact model), the infield hits, and now liners and flies caught too often by the quicker first step. Hypothesis GB: built. New hypothesis IH, likely: infield hits are a fifth of the league's ground-ball hits and the model makes none, because the throw beats the batter by over a second on every routine play; measure the infielder's exchange, the throw speed used on routine plays, and the share of reached balls knocked down, before building. New hypothesis FM, likely: the fielder's motion needs a profile with more than a first step and one acceleration (Statcast's three windows and the in-play speed fit a fielder already moving at 1 m/s, 0.20 s, 3.25 m/s^2 to 24 ft/s, which is right at 1-3 s but lets deep flies fall and rolling balls run to the wall); and the outfielder's route to a rolling ball (the cut-off) is to be measured against where the league's outfielders field balls that get through, by exit speed. For the men-on-base job: SAFETY_3, V_CONTACT and PIVOT were fitted around the old ball and now overshoot (triples 0.28, double plays 0.88). Hypothesis G (the bat's grip sets batted-ball spin): the bounce now uses the spin, so measured batted-ball spin by launch angle would also be tested on the ground. Gap 6 (a low liner can only be fielded once it lands): closed. The trait map's constants: react 0.466 to 0.234 (population; picks 0.20), ACC_F 5.5 to 5.0, the bounce's BOUNCE_KF/BOUNCE_C replaced by BOUNCE_MU (0.41, 0.45) and BOUNCE_KC (0.28, 0.46), new Z_CATCH 2.6 and Z_LUNGE 1.3, ROLL_DRAG from the engine's drag, the grass diamond.

**Measurement notes.** The league's direction is the angle of the hit coordinates (where the fielder touched the ball), the model's the angle of the spot where the ball was fielded, so both are fielding spots. Statcast's `hit_distance_sc` on a ground ball is its first bounce, which checks the model's flight: the model's ground outs first landed 7, 11, 17, 31 and 70 ft out (medians by band from -30 to +5 deg) against the league's 5, 8, 14, 27 and 60, about 15-25% further at every band, a small open question about the contact height or the league's measure. The ranging table (section 8 of both scripts) is dominated by positioning scatter and should not be read as range. The suite's "GB .24" league column in `run_games` is by Statcast's batted-ball type; the model's ground balls are launch angle under 10 deg, for which the league is .291.

## The integration (branch `integrate`; 2026-10-06)

`integrate` holds `dh-everywhere`; the men-on-base job (#36); the fouls-and-chases record (#35, the engine unchanged); the current rules; the platoon job (#33); the ground-ball job (#34); one refit of the chain; and the field follow-up (#37).

**The conflicts** were the values the chain pastes (each job had refitted them; one refit of the combined code replaced them) and clashing version numbers, renumbered in the order combined. The platoon's engine is v3.2. The ground balls' engine is v3.3 (its write-up says v3.2) and its bb_field v1.11 (its write-up says v1.8; the men-on-base job's v1.8-v1.10 came first); plays_check v0.11 (written as v0.7). The field follow-up's engine is v3.4, its bb_field v1.12-v1.15.

**A mistake in combining.** Resolving the ground-ball merge, the pasted-value blocks were taken from the platoon side, and with them the old clip on `react` (0.25-0.7 s). The refit then pulled react's mean to 0.035, below the clip, so every position player reacted in exactly 0.25 s and the pitcher fielded .11-.13 of choppers against the league's .05-.06 (the line `int2` below). The field follow-up found and fixed it (react drawn within 0.05-0.8; invariants_check v0.5). A block of pasted values can carry a hand-set limit beside the fitted ones: such blocks are to be diffed line by line, not taken whole from one side.

**The line after combining and one refit** (`int2`, seeds 3 / 11 / 29, league in brackets): runs 4.50 / 4.71 / 4.45 (4.45), BABIP .270 / .273 / .269 (.291), K% 18.3 / 18.3 / 19.2 (22.2), BB% 9.7 / 9.3 / 8.6 (8.4), doubles 1.92 on all three (1.59), triples 0.28 / 0.36 / 0.27 (0.13), ground-ball double plays 0.94 / 0.98 / 0.90 (0.64, the grounded-into figure; see the field follow-up), singles .172 of balls in play (.208). The ground-ball job's costs (triples, double plays, liners and flies caught) survived the refit: they sat in constants fitted to the old ball, which the refit does not touch.

**The line after the field follow-up** (`int3`): runs 4.58 / 4.75 / 4.65; hits 8.40 / 8.61 / 8.65 (8.26); AVG / OBP / SLG .246-.251 / .321-.326 / .422-.433 (.245 / .315 / .404); BABIP .277 / .278 / .282; K% 18.9 / 18.1 / 19.5; BB% 9.0 / 9.2 / 8.5; HR% 3.3 / 3.4 / 3.5 (3.1); doubles 1.94 / 1.94 / 1.95; triples 0.14 / 0.15 / 0.14; ground-ball double plays 0.66 / 0.65 / 0.61; errors 0.29 / 0.31 / 0.24 (0.50); stolen bases 0.64-0.65 (0.71); singles .188 of balls in play (.208); the contact score better on all four parts (misses by kind .0396, squared up .0522, vertical miss .0816, by reach .0521, from .0416 / .0562 / .0839 / .0609). Runs over BaseRuns .958-.971 (league 1.011).

**Open:** plays_check case 4 (a slow batter and a man on first, soft grounders: every force tried and missed at second should be a fielder's choice) has failed since #37's final refit, and still failed with the test's fielders held at the pool's averages; no change to the scoring rule caused it. On some soft grounders to the first baseman the clean play to first is no longer decisive. The suspect is his carry to the bag under the new run (TAU_F) against the pitcher covering (the 12-m rule). Recorded as hypothesis 1C.

## The field layer on the new ball: the fielder's run, the runner's arc, the double play and the sends to third (bb_field v1.12-v1.15, bb_engine v3.4; 2026-10-06)

The brief (`docs/briefs/2026-10-06_field_followup.md`), on branch `field-followup` from `integrate` (the four jobs of 2026-10-05, bb_game v1.6, one refit of the chain), on the Mac under jsc, against the baseline `integrate/diag_out/int2`. Runs: the league's liners and flies by hang time and distance, and where its outfield picked up the hits (new: `statcast/air_balls.py`, 42 days of 2025, 11,919 liners and flies, 6,752 outfield-fielded hits; hang time from the engine's own flight, `statcast/hang_time.js`); the model measured the same way (new: `headless/air_check.js`); Statcast's outfield jump leaderboard (2025, the page's raw feet, 7,417 plays); `mob_check`, `xbt_check`, `runs_check` and `ground_check` before and after; sweeps of the double-play pivot and the forced runner's break (600 games a setting) and of the margins for third and home (1,000 games a setting, seeds 3 and 11); the refit chain after each change and the suite (seeds 3, 11, 29).

### A bug in the baseline first

**Every position player reacted in exactly 0.25 s** (bb_engine v3.4; regression test in `invariants_check` v0.5). Combining #34 into `integrate` brought back the old line for the react trait, clipped to 0.25-0.7 s. #34 had moved its mean to 0.234 so that the farm's picks average the 0.20 s that fits the jump; under the old clip the chain's pool refit kept lowering the mean toward that target and left it at 0.035, below the floor, so every draw was pinned at 0.25 s. The catcher's and pitcher's offsets (0.37, 0.42) put them at 0.405 and 0.455 s where #34 meant 0.57 and 0.62. In `int2` the pitcher handled .11-.13 of the choppers at -30 to -5 deg (league .05-.06). The next chain's `field_value` could not fit react at all (a constant column; FIELD_VALUE came out NaN), which is how it showed. #34's own clip (0.05-0.45) would have pinned the catcher and pitcher at 0.45. Now 0.05-0.8 with the mean refitted by the chain (0.219); the pitcher handles .07 / .06 / .02 / .02 of the balls from -30 to 0 deg (league .06 / .06 / .05 / .02). Every line below against `int2` carries this fix.

**And a measurement slip in the suite** (`run_games` v0.3): the model counts a double play only on the ground ball's force and relay, but the league column was every double play turned (0.75 a team-game), which also counts line drives doubled off and strike-'em-out, throw-'em-out. Grounded into double plays, 2025 team totals: 3,122 in 4,860 team-games, **0.64**. The brief's 0.94 / 0.98 / 0.90 were half again the league's, not a quarter.

### 1. The fielder's run (FM)

**What the league showed** (`air_balls.py`). Hang time is not in the pitch data, so it was solved: the engine's flight in the parks' average air, with the model's median backspin for the launch angle, its exit speed set so the ball comes down at Statcast's projected distance (on the model's own balls the solve ran +0.06 s median, p10 -0.15, p90 +0.32 against the true hang; the model's tables use the same solve). The landing spot is that distance along the direction of the hit coordinates, and the distance is to the nearest of the seven fielders' average starting spots (Savant's positioning by batter side and runners), so it includes the pitch-to-pitch scatter of positioning; the model is measured from the same spots. Caught in the air by hang time: .167 at 1-1.5 s, .249 at 1.5-2 (infielders), .081 at 2-2.5, .193 at 2.5-3, .485, .632, .728, .848 at 3-5 s, .927, .970, .980 at 5-6.5 s. The distance at which half the balls nearest an outfielder were caught (a logistic in distance within each half-second): **25, 37, 51, 65, 78, 92, 106, 120 ft at 2.25 to 5.75 s**, a straight line of 27-29 ft/s (full sprint speed) after a lag of about 1.4 s. Running back cost 3-8 ft against running to the side from 3.5 to 5 s, and running in about 6 ft at 3-3.5 s. Liners (10-25 deg) were caught .355 of the time and fell for hits .614; flies (25-50 deg) .870 and .125. The jump leaderboard's raw feet on its 2-star-and-harder plays (average hang 4.19 s, caught .48): 6.91 ft covered in the first 1.5 s after the release, 30.0 ft in the next 1.5 s, 2.90 ft lost to the route, 34.0 ft toward the ball in 3 s, and a sprint speed on those plays of 24.0 ft/s against the same men's 27.4 fielding and 28.1 running.

**What the model did (int2).** Half caught at 36, 46, 56, 69, 80, 92, 113 ft at 2.25 to 5.25 s: 10 ft too far on liners, right at 4-5 s. Its outfielders made 40% of the catches at 2-2.5 s (league 17%). A constant 5.0 m/s^2 to top speed fits the jump's first window but reaches too far at 2-3 s, and the route as a share of the whole path (0.885) made the late slope route times speed, about 24.5 ft/s, where the league's is the full sprint speed.

**Built (bb_field v1.12).** After his first step a fielder's speed rises toward his sprint speed as 1 - exp(-t / TAU_F), the form the league's runners follow from a standstill (Statcast's running splits, TAU_RUN 0.78 s), with **TAU_F 1.2 s fitted to the jump's two windows**: 6.9 ft in the first window (6.91) and 29.6 ft in the second (30.0), running 23.6 ft/s at the window's end (the leaderboard's 24.0). His route now costs him only over the window's 34 ft toward the ball (the read), and the route trait's mean among major leaguers is the window's 34.0 / 36.9 = 0.921 (fit_population v0.8; was 0.90). An outfielder braking to throw keeps 5.0 m/s^2 (BRAKE_F): an assumption, but the measured average maximal horizontal deceleration of team-sport athletes from 7.4-7.8 m/s is 4.2-5.0 m/s^2 (Harper, Cohen, Carling and Kiely, Sports 8, 76, 2020).

**Result** (`air_check`, 400 games, seed 3, after the chain): half caught at **36, 42, 54, 66, 78, 92, 106 ft** at 2.25 to 5.25 s (league 25, 37, 51, 65, 78, 92, 106): from 3.5 to 5.5 s within a foot. Liners caught .378 / .365 / .363 at seeds 3 / 11 / 29 (int2 .387 / .380 / .386, league .355), hits .591 / .605 / .602 (.576 / .587 / .575, league .614); flies caught .896 / .897 / .891 (.908 / .908 / .903, league .870), hits .098 / .098 / .103 (.086 / .083 / .091, league .125). Two residuals: at 2.25 s the outfielder still reaches 11 ft too far (the low liner he charges, which the catch anywhere along the flight lets him take at chest height 5-10 ft in front of its landing), and flies of 5 s and more are caught .960-1.000 against .927-.980, including at 30-75 ft where the league still misses 1-3%: probably the wall (the model plays one park shape with an 8-ft wall) and the league's measure (a hit's direction comes from where it was picked up, which off a carom is not where it landed).

### 2. The outfielder's cut-off of a rolling ball

**Measured** (`air_balls.py` 5-8, `air_check` 5-8). The league's outfielders picked up ground balls that got through a median 216-272 ft from the plate, rising from 245 to 267 ft up the middle between 80-90 and 105+ mph. **The model's picked them up deeper**: by 11-23 ft up the middle (261-290 ft), 7-24 in the left gap, 17-36 on the left-field line, 6-37 on the right-field line and 0-9 in the right gap (final code; int2 the same within a few feet), and hard grounders up the middle and in the gaps went for doubles .05-.25 of the time (league .00-.09). Liners and flies that fell for hits rolled about as far past their landing in both (10-20 deg: model 39-56 ft, league 46-62). The excess doubles were on the lines: of the hits the outfield picked up, doubles were .568 on the left-field line and .445 on the right (league .493, .331) against .177 / .091 / .204 in the left gap, centre and right gap (.204 / .124 / .167); and the model sent more balls toward the left-field line (.170 of balls in play fielded or caught at -50 to -30 deg, the league .132). Triples had been three times the league's on the right side (.113 of right-line hits on int2, league .033; .058 on the final code).

**The route is not wrong in kind**: the fielder takes the first point of the ball's track he can reach, which is the cut-off. What the measurements point to instead: the ball through the outfield (the roll's resistance is still set by hand, and the model's ground balls get through the infield more often than the league's), the share of balls toward the left-field line (the spray, or the corners' positions), and the time from the pickup to the throw. Switching the stop-and-turn off entirely (a bracket, not a mechanism) took doubles from 2.0-2.3 to 1.21-1.24 a team-game, so it carries about one double a game; the deceleration it uses is the measured one. Nothing was built for the route.

### 3. The decisions fitted on the old ball

**The double play (bb_field v1.13).** On the new ball, with a man on first and fewer than two out, the infield forced him at second on .89 of its clean plays (league .757, from `men_on_base.py`: double plays .403, lead runner out .274 of the infield's chances, less the hits and errors) and the relay then beat the batter .73 of the time (.595); double plays were .63 of those chances (.40). Swept with `mob_check` (V_CONTACT 1.5-3.0 m/s by PIVOT 0.65-0.95 s): **V_CONTACT 2.75 m/s and PIVOT 0.87 s** gave forced on .770 / .745 of clean plays at seeds 3 / 11 and the relay .603 / .598, by the batter's speed .79-.76 / .56-.61 / .46-.42 against the league's .73 / .59 / .47 (not fitted). 2.75 m/s is a little under the 3 m/s of a man walking off on a steal. The cut-off man had taken the pivot's time; he keeps 0.65 s (RELAY_XFER), since the refitted pivot also carries the man crossing second ahead of the slide. Final code: double plays .416 of the chances (.403), relay .575; ground-ball double plays 0.66 / 0.65 / 0.61 a team-game against the league's 0.64.

**The runner's arc (bb_field v1.14).** Built before refitting the sends, because the sends were absorbing it: a runner went straight through every base, so a 30-ft/s batter reached third in 10.2 s, faster than Statcast has ever timed a triple (Buxton 10.57 s in 2017, De La Cruz 10.84 s in 2023, both near 30 ft/s, each man's best run). **ROUND_PATH 2.4 m of extra ground for each base a runner goes on past**, measured roughly from those times against the model's straight-line run (0.2-0.3 s, 6-9 ft a base) and the optimal arc at a sprinter's lean (about 10 ft; Carozza, Johnson and Morgan, Williams College 2010). A 30-ft/s batter now takes 10.74 s to third. On its own (200 games, before the chain): triples 0.31 / 0.31 / 0.31 to 0.17 / 0.17 / 0.15, doubles 2.05 / 1.94 / 1.88 to 1.86 / 1.92 / 1.90.

**The sends to third (bb_field v1.15).** With the arc, a man on first took third on a single .32 / .30 / .50 of the time with none, one and two out (league .28 / .30 / .42). Refitted with `xbt_check` and `mob_check` as in v1.9: **SAFETY_3 [0.95, 0.95, 0.35] to [1.15, 0.95, 0.55]**, giving .31-.28 / .30 / .41-.42 at seeds 3 and 11. **SAFETY_H could not be refitted**: at every margin swept (0.6-1.0, 0.2-0.6 and -0.2 to 0.2 by outs) a man on second scored on a single too seldom while a man on first scored on a double too often (final code: .32-.30 / .48-.54 / .64-.73 against .36 / .51 / .83, and .35-.36 / .45-.53 / .63-.65 against .34 / .31 / .52). The outfield's throw home beats him too easily on a single and too slowly on a double, which is the cut-off of section 2 again; kept as fitted in v1.9.

### 4. Infield hits (IH)

Not built. The model now makes .012-.015 infield hits per ground ball (int2 .006, league .061); with a man on first .020 of the infield's chances were hits against the league's .101, by fielder the league's 3B .144, SS .085, 1B .085, 2B .049, P .208. The three measurements the ground-ball section asks for are not in the public data: Statcast times no infielder's exchange (pop time is the catcher's), its arm strength is the average of a fielder's hardest throws, not his routine ones, and the play descriptions do not say when a ball was knocked down.

### The line against the baseline

Suite (200 games a seed), seeds 3 / 11 / 29, `int2` against the final code (after its chain); the steps after their own chains:

| | int2 | FM and the react fix | and the double play | final (and the arc, SAFETY_3) | league |
|---|---|---|---|---|---|
| runs | 4.50 / 4.71 / 4.45 | 4.76 / 4.43 / 4.82 | 5.08 / 4.78 / 4.64 | 4.58 / 4.75 / 4.65 | 4.45 |
| hits | 8.19 / 8.43 / 8.16 | 8.70 / 8.29 / 8.70 | 8.73 / 8.27 / 8.03 | 8.40 / 8.61 / 8.65 | 8.26 |
| BABIP | .270 / .273 / .269 | .286 / .272 / .286 | .283 / .271 / .269 | .277 / .278 / .282 | .291 |
| singles, share of balls in play | .175 / .175 / .175 | .185 / .175 / .187 | .182 / .175 / .175 | .187 / .189 / .191 | .208 |
| doubles | 1.92 / 1.92 / 1.92 | 2.10 / 1.98 / 2.04 | 2.05 / 1.94 / 1.88 | 1.94 / 1.94 / 1.95 | 1.59 |
| triples | 0.28 / 0.36 / 0.27 | 0.28 / 0.31 / 0.24 | 0.31 / 0.31 / 0.31 | 0.14 / 0.15 / 0.14 | 0.13 |
| home runs | 1.30 / 1.37 / 1.26 | 1.29 / 1.24 / 1.34 | 1.38 / 1.32 / 1.19 | 1.26 / 1.29 / 1.36 | 1.16 |
| double plays (ground ball) | 0.94 / 0.98 / 0.90 | 0.93 / 1.00 / 1.08 | 0.62 / 0.69 / 0.63 | 0.66 / 0.65 / 0.61 | 0.64 (GIDP) |
| errors | 0.31 / 0.30 / 0.29 | 0.33 / 0.31 / 0.28 | 0.34 / 0.38 / 0.33 | 0.29 / 0.31 / 0.24 | 0.50 |
| K% | 18.3 / 18.3 / 19.2 | 18.6 / 18.2 / 19.0 | 19.1 / 18.6 / 19.1 | 18.9 / 18.1 / 19.5 | 22.2 |
| BB% | 9.7 / 9.3 / 8.6 | 9.3 / 9.0 / 9.7 | 9.3 / 9.4 / 9.7 | 9.0 / 9.2 / 8.5 | 8.4 |
| ground balls (under 10 deg) | .270 / .280 / .277 | .295 / .283 / .294 | .284 / .270 / .264 | .283 / .283 / .283 | .291 |
| liners / flies, hits per ball (run_games) | .58 / .58 / .57, .09 / .09 / .10 | .61 / .59 / .60, .09 / .09 / .11 | .61 / .60 / .60, .12 / .10 / .10 | .58 / .60 / .61, .10 / .10 / .10 | .614 / .125 (10-25, 25-50 deg) |
| contact score (A-D) | .0416 .0562 .0839 .0609 | .0413 .0578 .0853 .0613 | .0416 .0571 .0777 .0573 | .0396 .0522 .0816 .0521 | |

From the checks (int2 | final): liners caught .387 / .380 / .386 | .378 / .365 / .363 (league .355), flies caught .908 / .908 / .903 | .896 / .897 / .891 (.870) (`air_check`, 400 games a seed); ground-ball hit rate .312 / .317 / .317 | .311 / .322 / .309 (.291) and infield hits .006 | .012-.015 (.061) (`ground_check`, 300 games a seed); runs over BaseRuns .952 / .938 / .952 | .971 / .958 / .964 (1.011) (`runs_check`, 600 games); a man on first scored on a double .56 / .59 | .52 / .49 (.39) and took third on a single .37 / .36 | .34 / .34 (.33) (`xbt_check`, 1,000 games, seeds 3 / 11); a man on third scored on a caught ball .459 (.626), out .059 (.020) (`mob_check`, seed 3). The worst seed beside the baseline: runs at seed 29 went 4.45 to 4.65 and hits 8.16 to 8.65, from BABIP .269 to .282 with K% unchanged: the hits per game run over the league's because the model's batters strike out 18-19% of the time against 22%, so more balls are put in play.

### What failed, and what is left

- **The stop-and-turn switched off** (bracket): doubles 1.21-1.24, triples 0.09-0.11, double plays 0.99-1.02 on the old pivot; not physical, not kept.
- **SAFETY_H**: no margin fits both the single and the double (above).
- **A quicker run for an outfielder going after a ball on the ground** (the runners' 0.78 s instead of 1.2, on the argument that a grounder needs no read of depth) was considered for the deep pickups and not built: the same argument holds for the infielders, whose reach on a 1.3-s ground ball fits the league's ground-ball hit rate with 1.2 s and would grow by 1.2 m.
- **Left**: doubles 1.94 against 1.59, concentrated on the lines (above); the outfield's pickups 7-36 ft deep (the roll's resistance by hand, the ball through the infield, the corners); the outfielder's catch on a low liner he charges (2.25 s, 11 ft too far) and deep flies near the wall; infield hits (IH); the tag-up home (TB, unchanged: scored .46 against .63).

### Proposed changes for CALIBRATION.md

**Mysteries.** 5 (the batted-ball mix and BABIP): liners and flies are now caught at the league's range from 3 to 5.5 s of hang; BABIP .277-.282 against .291, the rest in the deep flies, the low liners an outfielder charges and the infield hits. 10 (double plays, outs on the bases): the double play is the league's once measured alike (ground-ball double plays against GIDP 0.64) and its forces and relays are fitted on the new ball; triples are the league's with the runner's arc. New: doubles on the lines (above).

**Hypotheses.** FM: built (TAU_F, the route over the read); residuals at 2.25 s and 5 s and more. DP: PIVOT and V_CONTACT refitted. FO: SAFETY_3 refitted, SAFETY_H not refittable (the single against the double). New, RA (the runner's arc): built, ROUND_PATH measured roughly from record times; a measurement of ordinary home-to-second and home-to-third times would pin it. New, CO (the cut-off): the model's outfield picks up ground balls 7-36 ft deeper than the league's (0-9 in the right gap), and doubles on the lines run .57 / .45 of the hits there against .49 / .33; suspects the roll's resistance (by hand), the ball through the infield, the share of balls to the left-field line; test with a ball-roll measurement on outfield grass, or Statcast's time from contact to the outfielder's pickup if it can be had. IH: unchanged, its three measurements are not public. TB: unchanged.

**The trait map's constants** (bb_field, bb_engine, fit_population): ACC_F 5.0 no longer moves the fielder; TAU_F 1.2 s (fitted, the jump's two windows); ROUTE_D 34 ft (measured, the jump's window toward the ball); the route trait's target 0.90 to 0.921 (measured, the window's share toward the ball); BRAKE_F 5.0 m/s^2 (assumption, within the measured 4.2-5.0); react [0.234, 0.06, 0.05, 0.8] (the clip restored and widened; the chain's mean 0.219); PIVOT 0.65 to 0.87 s and V_CONTACT 1.5 to 2.75 m/s (class O, refitted); RELAY_XFER 0.65 s (the cut-off man, kept); ROUND_PATH 2.4 m (measured, roughly); SAFETY_3 [1.15, 0.95, 0.55] (class O, refitted); SAFETY_H [0.8, 0.2, 0] (kept). The suite's league column for double plays: 0.64 (GIDP).

**Measurement notes.** Hang time for the league is a solve through the engine's flight with the model's backspin by launch angle, which is higher than published batted-ball spin at high launch angles (about 4,500 rpm at 40 deg); the league's slope of range against hang (27-29 ft/s, the fielders' sprint speed) suggests the solve does not stretch time. Distances are from the average spots, so the league's logistic scales (10-13 ft) are wider than the model's (5-8 ft), whose fielders scatter less around their spots.

## The playoff review: each player's hidden traits, and a pitcher's own deception (branch `yankees-review`; 2026-10-06)

For a review of the Yankees' ALDS losses and the live couch analyst (Joe, 2026-10-06; `review/`, the page at worldbyjoe.github.io/baseball-sim/live/), every playoff player was made into the engine's player from his 2025-26 measurements (PR #30's data).

- **Hitters.** His measured body and swing (height, weight, swing length, attack angle, swing tilt, and bat speed by solving the power chain for his swing power), and 13 hidden traits (eye, spotting, aggression, timing, barrel scatter, along-barrel scatter, face, undercut, commitment, fastball lean, pull bias, learning, coverage) from a linear-Gaussian posterior (`review/fit_hitters.py`). The emulator was a linear map from the traits to 16 measures over 3,600 emulated major leaguers (`review/emulate_hitters.js`, the measures as `playoffs/measure_traits.py` took them); the prior was the emulated major leaguers' traits conditional on the measured ones; the noise was the player's own sampling error plus the emulator's structural error. Then four Gauss-Newton steps on the simulator itself (`review/check_hitters.js`). On a fresh seed over 112 hitters the model reproduced each one's strikeouts at r .86, walks .66-.75, home runs .70-.76, chase .93, zone swing .94 and exit speed .92-.93; the median miss was about one measured standard error. Home runs ran about a fifth low on average.
- **Pitchers.** Slot, release, command, and every pitch's speed, spin, active spin and movement (the tilt solved for the Magnus break's direction, the seam break for the rest: the movement matched exactly). **Built from measurables alone, the pitchers did not pitch like themselves:** against the league's hitters their strikeout rates tracked their own at r .29 (Cam Schlittler 15% against 31%), and they walked too many (the measured location scatter holds the deliberate spread of targets as well as the misses). Two hidden traits were fitted by bisection (`review/fit_pitchers.js`): DECEPTION, a multiplier on the batter's read noise for that pitcher (engine v3.5 on that branch, `pitch.deception`, unchanged when unset), and a scale on command. The targets were relative to the league (his rates stand to the model's league as his measured ones stand to the real league): the hitters' fit already carries the model's league-wide shortfall of strikeouts, and absolute targets would count it twice in every matchup. Deception came to 0.79-1.35 among the Yankees' and Rays' pitchers.
- **What it says about the model.** The engine's map from a pitcher's measured stuff to his strikeouts carries little of the real spread between pitchers (the trait map's Stuff into strikeouts: K% ~ fastball speed .36 against .52). Something the measurables miss, the hiding of the ball, the sequencing, is a real trait. Recorded as mystery 11 and hypothesis DC.
- **The review itself** (Games 1 and 2 at Tampa Bay): pregame the model made the Yankees 52% and 60%; they lost 1-0 and 5-2. In Game 1 they made one hit from 15 balls in play against 4.1 expected from the league's 40 most similar balls (a 1-in-45 outcome); in Game 2 four defensive miscues led to three of the Rays' five runs, and Freddy Peralta threw his four-seamer 2.4 mph above his season (replayed with his speeds that day, the Yankees' chance fell from 60% to 56%).

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

Where the model and the league disagree and no believable mechanism has been built for it yet. They are recorded, not tuned away; each may close when a missing piece of the model arrives, and the deeper tuning waits until then. Remade 2026-10-06 after the five jobs and the current rules (engine v3.4, bb_field v1.15, bb_game v1.6; the line `int3`), in order of how much each matters to the game; the previous number in brackets. Seeds 3, 11 and 29, against 2025's team totals, unless noted.

1. **Fouls and strikeouts** (1): K% 18.1-19.5 against 22.2; fastball swings fouled about .32 against .45; 138-139 pitches a team-game against 146. The fouls are grazes: a third of the league's fastball contact, coming off at .817 of the pitch's speed. Building them (#35's v3.2 and v3.3) fixed the fouls and the strikeouts but cost BABIP .04 and nearly a run, through breaking balls met too far out front (BC).
2. **Far chases and walks** (4): chase about .23 against .283; BB% 8.5-9.2 against 8.4. #35's v3.4 (DEC_UNSEEN) got the league's far chases but took breaking balls in the zone, and walks and runs fell (DF).
3. **The batted-ball mix and BABIP** (5): BABIP .277-.282 against .291 (.262-.272 before the jobs). The ground balls closed (choppers at -10 to 0 deg .30 against .249, low liners at 0-10 deg .50 against .482) and liners and flies are caught at the league's range from 3 to 5.5 s of hang. Left: line drives 20-21% of balls in play against 24; infield hits .012-.015 of ground balls against .061; flies of 5 s and more caught .96-1.00 against .93-.98; low liners charged at 2.25 s reached 11 ft too far.
4. **Doubles** (new): 1.94-1.95 a team-game against 1.59 (1.56-1.65 before the jobs), on the lines: outfielders pick up balls that get through deeper than the league's (11-36 ft), and the model sends .170 of balls toward the left-field line against .132 (CO).
5. **Runs** (3): 4.58-4.75 against 4.45, a little high now that BABIP has risen while strikeouts stay low; runs over BaseRuns .958-.971 against 1.011.
6. **Tag-ups and sends home** (6, and part of 10): a man on third scores on a catch .46-.50 of the time against .63 (sacrifice flies .17-.18 a team-game against .27); a man on second scores on a single .30-.32 / .48-.54 / .64-.73 by outs against .36 / .51 / .83, while a man on first scores on a double too often. One margin cannot fit both (TB).
7. **Hitting with men on base** (2): two thirds of the league's raw gain is who comes up with men on; with batter and pitcher held fixed it is +.010 of BABIP, +.036 on the ground with a man on first. The model's ground-ball gain with a man on first is now +.016-.035; its raw gain has no who-comes-up part, so its BABIP talent may vary too little between players (WC).
8. **The platoon split's contact half** (8; the sign closed by PL): same-side contact comes off 1.0 mph slower in the model against 2.5 in the league, xwOBA on contact -.014 against -.041, and the same-side batter does not walk less. K% ~ release height -.03 to -.11 against -.22; BB% ~ arm angle +.06 to +.08 against +.20.
9. **Reaching contact by direction** (7): the efficiency of balls in play over Statcast's squared-up ceiling, inside .709 against .586, below .792 against .682, above .779 against .853; away it is close (RD).
10. **Errors** (10): 0.24-0.31 a team-game against 0.50. Outfield throws go wild about 3.5 times as often as the league's because nobody at the other end moves for a long throw (RX); the hurried throw is built and recorded, blocked by that (T).
11. **A pitcher's stuff into his strikeouts** (new, from the playoff review): pitchers built from their measurements struck out the league's hitters at rates that tracked their own at r .29. A fitted deception (the read's noise) carries the rest (DC).
12. **The minors' pitchers are not wild enough** (9).
13. **Triple-A's BABIP and chase** (11).
14. **The slow-swing tail** (12): 1.5% of swings more than 10 mph under the hitter's mean, against 5.7%.
15. **Ground balls are pulled less** (13): 10.4 deg against 13.6.
16. **From before** (14; engine v2.4, to re-measure): uphill swings cost too many whiffs, bat speed ~ whiff under half the league's, liners at 15-20 deg carry too far.

## Hypotheses for the open mysteries (2026-10-06, after the five jobs)

Tested by the five jobs of 2026-10-05/06 (sections above): PL confirmed and built (engine v3.2); GB built (bb_field v1.11, engine v3.3); MO built (bb_field v1.8, bb_game v1.5); TU built (the tag-up as a read, the runner from a standstill, v1.9); DP built (PIVOT and V_CONTACT refitted, v1.13); FM built (the fielder's run, v1.12); RA built roughly (the runner's arc, v1.14); FO half built (SAFETY_3 refitted, v1.15; SAFETY_H not refittable); T built with a cost and recorded (blocked by RX); FG confirmed with its physics measured (the grazes), FL refuted and replaced by BC; I/W built and recorded (blocked by DF); KB refuted (two-strike swings take as long: 70.5 ms of swing length over bat speed against 69.4). From the playoff review: DC.

| | Hypothesis | Mysteries | Likelihood |
|---|---|---|---|
| BC | Breaking-ball contact: slow pitches are met too far out front because the timing's pull toward the expected pitch grows linearly with the speed gap where the league's flattens past about 9 mph (curveballs +9.4 in from each hitter's mean contact point against +6.6), and the bat's path rises 1.0 deg per inch across pitch types against the league's 0.73-0.84. Test: the timing cap (about 18 ms, measured from contact depth by type) and the path; then the fold's measured constants (ball-bat friction 0.27, last-look error 0.5 in) return | 1, 3 | likely |
| DF | The decision's picture flattens: DEC_UNSEEN shifts each pitch's picture by its remaining break, so breaking balls in the zone are taken. Test: the league's swings at breaking balls by where they ended against where their shape was headed at the commit point | 2, 1 | likely |
| DC | A pitcher's deception is a hidden trait: a multiplier on the batter's read noise, fitted per playoff pitcher to his strikeouts (0.79-1.68). For the main model: its spread in the pool and what it correlates with (release, extension, arm angle) | 11, 1 | likely |
| CO | The cut-off's depth: outfielders pick up balls that get through 11-36 ft deeper than the league's; with the left-line share of balls (.170 against .132) and the roll's hand-set resistance | 4, 5 | likely |
| TB | The outfield throw's race home: the runner's margin at 250-320 ft needs about 0.5 s more and a tighter spread; suspects one 0.69 s transfer for all fielders, raceSD's growth (set by hand), the relay estimate | 6 | likely |
| RX | A long throw's receiver does not move: outfield throwing errors 3.5 times the league's; unblocks T | 10 | likely |
| IH | Infield hits: the infielder's exchange, the routine throw's speed, balls knocked down at full stretch; none of the three is in the public data | 3 | likely, needs data |
| WB | Who takes the ball between first and second (bases empty): the model's first baseman fields .26 of grounders at 15-30 deg, the league's second baseman .70 | 3 | likely |
| RD | The cost of a reach by direction: jammed inside, topped below, nothing lost above | 9 | likely |
| PB | The swing bias behind the shoulder: a same-side pitch's late lateral movement under-read, so he judges it nearer the zone (a sinker running in chased +.097) and meets it off the sweet spot | 8, 9 | possible |
| WC | Who comes up with men on: the model's BABIP talent varies too little between hitters and pitchers | 7 | possible |
| 1C | plays_check case 4 after #37's refit: the first baseman's carry to the bag under the new run against the pitcher covering | (a test) | to check |
| AA | No development: Triple-A's pitchers are 1.8 years younger and still learning command | 12, 13 | plausible |
| YS | Pitchers judged more sharply: a season's results seen alongside the estimate | 12 | plausible |
| G | The bat's grip sets batted-ball spin: needs published spin by launch angle (the bounce now uses the spin too) | 3, 16 | plausible |
| L | Triple-A's own conditions: Pacific Coast League parks, the automated zone | 13, 12 | plausible |
| X | A later checking point than the 0.15 s last look | 14, 2 | possible |
| AB | Command built from several distal traits, elite only where all are good (Joe's sparse perimeter) | 12 | possible |
| M, N, O, P | Swing style and bat speed; sideways misreads forgiven; the release point; command by slot: to re-measure | 16, 2 | possible |
| R | Long shots: a two-strike spoiling swing; minor-league fielders positioned worse | 1; 13 | long shot |

Order to test (shared mechanisms and the game's biggest gaps first): (1) BC, which unblocks the fouls and the strikeouts; (2) DF, which unblocks the far chases; (3) DC into the main model; (4) CO and TB together (the doubles and the sends); (5) RX, then T; (6) RD and PB; (7) WB, and IH when data allow; (8) 1C; (9) the minors (AA, YS, L, AB); (10) re-measure 16, then G, X, R.

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
