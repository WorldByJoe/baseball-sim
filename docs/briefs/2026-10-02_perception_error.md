You are working in the repository WorldByJoe/baseball-sim (private; it should be checked out as your working directory - if not, clone https://github.com/WorldByJoe/baseball-sim.git). Your job: build a PERCEPTION ERROR in the batting engine - a systematic error in where the batter thinks the ball will be, which depends on the pitch's height and on how its approach differs from what he expected - so that contact gets less clean in the way the league's does. Verify it headlessly, push a branch and open a pull request for the owner (Joe von Fischer) to review. Do not merge to main.

## What this project is (read before touching anything)
A trait-driven, physics-based baseball simulation. Players have latent traits; every statistic EMERGES from traits + physics + noise. Outcomes are never tuned; the only knobs are trait distributions (TRAITS in bb_engine.js) and labelled physical constants; a gap between model and league is a missing mechanism. Every change is judged on the whole metric suite across several seeds, never on one number.

Read, in this order: README.md; CALIBRATION.md - the v0.8 section ("The bat, the swing's arc and the second look"), its block "The league's fouls, measured (2026-10-02)", the v0.9 section ("The swing as a tilted circle", which this brief now starts from), and "Known gaps" 1-2; STATCAST_TARGETS_2025.md, the section "Swing geometry (pitch level, 2025, one week)"; STATCAST_TARGETS_2025.md, the section "What a foul is (pitch level, 2025, 42 days)"; bb_engine.js - the header, then READ (ghostPitch, readFactors, misreadOf), DECIDE (decide), SWING (swing: the tilted circle, where on it the ball is met, the timing term in the vertical offset) and the collision (collide, with the barrel tilted), and the hitter rows of TRAITS (motorIn, barrelSD, timingSD, longSD, faceSD, swingTilt, undercut, spotIn, eyeSD, commit); headless/power_chain.js, headless/contact_check.js (the model in the league's pitch-level tables, including the vertical miss by contact depth) and headless/run_games.js; statcast/fouls.py and statcast/swing_geometry.py.

## Step 0 - prove the tooling
  node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js headless/power_chain.js -- 500 40 3
  node headless/run_node.js bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 3 0
  python3 statcast/fetch_pitches.py && python3 statcast/fouls.py 2025
The engine is seeded, so power_chain at seed 3 must reproduce the v0.9 column of CALIBRATION.md's "The swing as a tilted circle" (squared-up per contact by the Statcast proxy .564, per ball in play .677, per foul .401, whiff .258, K% .211, EV 87.5, EV50 98.0, hard-hit .369), and run_games its league line at seed 3 (runs 4.07, AVG/OBP/SLG .247/.330/.400, K% 25.4). The pitch pull takes about 7 minutes and caches under statcast/raw/pitches/2025/ (git-ignored). If any number differs, stop and find out why before modelling.

## The problem, in numbers
Measured on 42 days of 2025 (552 games; CALIBRATION.md "The league's fouls, measured"), against the model at v0.9 (power_chain and contact_check, seeds 3 / 11):

| | model v0.9 | league 2025 |
|---|---|---|
| squared up per contact (Statcast rule) | .564 / .557 | .435 (floor .392) |
| squared up per ball in play | .677 / .679 | .627 |
| squared up per foul | .401 / .389 | .225 (floor .184) |
| fouls / contact | .41 / .42 | .521 |
| fair exit velocity, mean / sd | 87.5 / 14.3 | 88.9 / 15.2 |
| EV50 | 98.0 | 100.6 |
| vertical miss (launch angle minus attack angle), mean / sd | +6 / 28 | +10.0 / 34.7 |
| vertical miss on contact met deep / out front | +4 / +1 | +20 / -12 |
| whiff per swing | .258 / .275 | .232 |
| whiff by kind FB / BR / OS | .29 / .22 / .27 | .172 / .308 / .299 |
| whiff in the upper zone / high edge | .29 / .41 | .138 / .268 |

v0.9 brought balls in play to the league's quality by the swing's geometry; what is left is in fouls (too solid, too few), in the tails of the vertical miss, in the hardest contact (EV50), and in whiffs on fastballs and high pitches. The vertical miss on contact met deep against out front is the signature of a speed misjudgment (late and under, early and over) that the model lacks on pitches it reads. v0.8 showed that a wider random vertical scatter buys mishits only with whiffs. The candidate CALIBRATION.md names is a systematic error: one that depends on where the pitch is and what it does, so the same batter is reliably under some pitches and over others.

## What the league does (the targets for the mechanism)
These were measured with a scratch script on the same 42 days. Step 1 below makes them reproducible. Height is (plate_z - sz_bot) / (sz_top - sz_bot): 0 at the bottom of the batter's zone, 1 at the top. Bunts are excluded. Launch angles are means.

**A. By pitch height, all pitch kinds (swings 78,301):**

| height | swings | whiff / swing | foul / contact | squared / contact (n) | BIP launch angle | BIP GB (<10°) / PU (>50°) | BIP EV | foul launch angle |
|---|---|---|---|---|---|---|---|---|
| below the zone (<-0.25) | 3,889 | .765 | .626 | .286 (695) | -0.4 | .63 / .03 | 75.7 | -9.3 |
| low edge (-0.25..0.15) | 15,538 | .349 | .497 | .423 (8,572) | 5.1 | .56 / .05 | 87.2 | -3.3 |
| lower zone (0.15..0.5) | 24,937 | .139 | .462 | .468 (19,139) | 10.7 | .47 / .08 | 90.5 | 16.8 |
| upper zone (0.5..0.85) | 22,562 | .138 | .531 | .416 (17,339) | 18.0 | .36 / .13 | 88.9 | 34.1 |
| high edge (0.85..1.25) | 10,386 | .268 | .653 | .409 (6,496) | 23.2 | .29 / .18 | 86.5 | 39.3 |
| above the zone (>1.25) | 989 | .503 | .740 | .544 (406) | 23.4 | .33 / .20 | 83.5 | 38.1 |

Launch angle rose steadily with pitch height: from 0° on balls in play below the zone to 23° above it. Fouls rose more steeply, from -9° to 39°. High pitches were fouled off up and back (under the ball), and low pitches were fouled into the ground (over it). The foul share was U-shaped: it was lowest in the lower half of the zone and highest above the zone. Squared up per contact stayed nearly flat inside the zone, at .41-.47.

**B. By pitch kind at the same height.** At the low edge, balls in play off breaking balls came off at 7.8°, against 1.8° for fastballs. In the lower zone the figures were 13.6° and 9.3°. So batters were NOT over low breaking balls on balls in play; CALIBRATION.md's "over low breaking balls" is not supported. Their FOULS on low breaking balls were topped, though: -5.5° at the low edge, against +4.4° for fastballs. High fastballs (0.85-1.25) went foul .666 of the time, with foul launch angle 39.7°.

**C. By approach angle at the same height: the flat-fastball effect.** VAA is the vertical approach angle at the plate, computed from vy0, vz0, ay and az to y = 17/12 ft. Its residual is the VAA minus what a pitch at that height has on average, from a linear fit within each group. Four-seamers in the upper zone and high edge (0.5..1.25; swings 17,699; VAA mean -4.45°, rising 1.85° per zone height), in quintiles of residual:

| VAA residual | mean (deg) | swings | whiff / swing | foul / contact | squared / contact (n) | BIP launch angle | foul launch angle |
|---|---|---|---|---|---|---|---|
| steepest | -0.69 | 3,539 | .141 | .550 | .453 (2,694) | 19.9 | 38.4 |
| 2 | -0.24 | 3,540 | .181 | .610 | .412 (2,565) | 22.6 | 40.1 |
| 3 | +0.01 | 3,540 | .203 | .630 | .414 (2,450) | 21.2 | 40.1 |
| 4 | +0.25 | 3,540 | .225 | .666 | .379 (2,376) | 26.7 | 40.9 |
| flattest | +0.66 | 3,540 | .284 | .685 | .341 (2,157) | 27.0 | 41.6 |

A four-seamer that arrived 1.3° flatter than its height implies doubled the whiff rate (.14 to .28). It also raised the foul share by .14, cut squared-up contact by .11, and raised the launch angle on balls in play by 7°. Batters swung under it. Low four-seamers (0..0.5; 6,920 swings) showed the same pattern, weaker: whiff .08 to .15, squared up .49 to .36, BIP launch angle 11.0° to 18.3°.

Low breaking balls (SL CU ST KC SV at -0.25..0.5; 16,093 swings) also whiffed more when flatter (.22 to .33), with squared up .50 to .42. On them, the steepest fouls were topped (-7.6°) and the flattest lifted (+10.1°).

Two confounds to keep in mind. Flat-VAA pitchers are also the better pitchers, and VAA depends on release height and extension. Before taking C at face value, repeat it within bands of release_pos_z and extension. Report how much of the effect survives.

**What this says about the mechanism.** The hitting literature's "rising fastball" and "breaking curve" illusions (McBeath 1990; Bahill & Karnavas 1993, who traced both to a misjudged speed; check both citations before quoting them) predict exactly C. A batter who predicts a pitch's height from the drop he expects swings under a pitch that drops less than expected and over one that drops more. The engine already has the expected pitch: the ghost, flown with the speed and spin he expected. What it lacks is any error on pitches he DETECTS: those keep only DETECT_RESID = 0.05 of the ghost-vs-real gap, so a detected flat fastball is hit as cleanly as any other.

## Step 1 - make the targets reproducible
Add tables A, B and C to statcast/fouls.py (bump it to v0.3). C gets one extra table within release-height bands. Write them into the "What a foul is" section of STATCAST_TARGETS_2025.md, or a new section "Height and approach (pitch level, 2025, 42 days)" written the same way, and into fouls_2025.json. The numbers above must come out the same. If they don't, the script is right and this brief is wrong: say so.

## Step 2 - measure the model the same way
Add the same three tables to headless/power_chain.js (bump to v0.5). Height relative to the batter's own zone (B.zone.bot / B.zone.top); kinds from PITCH_TYPES; VAA from pitch.plate.v; the residual against the model's own fit. (v0.4 already carries the pitch-level references .627 and .225 and squares up against the bat speed at contact.) Record the v0.9 baseline. Part of A and B is geometry the engine already has: the swing's attack angle against the pitch's descent, the tilt that steepens for low pitches, and the barrel tilted in the collision. So the baseline shows how much of the height pattern already emerges and how much is left for perception. Report that split before building anything.

## Step 3 - the mechanism, physics and perception first
Build one at a time, run the full suite after each, keep what helps and delete what doesn't.
1. **The predicted drop is shrunk toward the expected one, on every pitch, detected or not.** The batter's estimate of the ball's height at the plate is the real height plus a fraction of the difference between the ghost's drop and the real drop. That fraction is his prior's pull: larger under time pressure (rf.tp) and smaller with a better eye. It may replace DETECT_RESID for the vertical component, not add to it. Its main input is the difference in vertical approach (speed and ride against expectation), not a random draw. A ride that differs from what he expected then reliably puts him under or over. If it needs a trait, name it plainly (for example `dropPrior`, 0..1), draw it from TRAITS, and say why the existing traits (spotIn, eyeSD) cannot carry it.
2. **Height-dependent bias, only if 1 leaves pattern A unexplained.** A batter's swing plane fits some heights better than others. Before adding anything here, check whether the existing attack-angle and arc geometry already produces A.
3. Do NOT widen barrelSD or motorIn; v0.8 showed that trades mishits for whiffs. If the mechanism raises whiffs, report it. Do not tune it back.

## Acceptance (run_games 200 games at seeds 3, 11, 29; power_chain 500 x 40 at seeds 3 and 11)
- **Contact quality:**
  - squared up per contact .37-.48 (league .435, floor .392)
  - per ball in play .57-.68 (.627)
  - per foul .15-.30 (.225)
  - fouls / contact .47-.56 (.521)
- **Exit velocity and launch angle:**
  - fair EV mean 87.5-91 (88.9), with sd rising toward 15
  - EV at launch angle -10..10 below 95 (92.6)
- **The tables:**
  - A: model BIP and foul launch angles rise with height, at no less than half the league's slope.
  - A: the foul share is U-shaped, lowest in the lower zone.
  - C: whiff and foul share rise, and squared up falls, from steepest to flattest fastballs, in the league's direction and at least half its size.
- **Toward the league, from v0.9's figures in brackets:**
  - whiff per swing .20-.26 (.232; v0.9 .26-.28), fastball whiffs toward .17 (v0.9 .29-.32)
  - K% .19-.25 (v0.9 .21-.27 in power_chain, 25.5 in games)
  - EV50 99-102 (v0.9 98.0)
  - BABIP .27-.33 (v0.9 .33)
- **Watch, don't chase:**
  - breaking-ball whiffs (v0.9 .22-.23 against .308; Known gap 2)
  - GB/LD/FB/PU mix (v0.9 42/21/25/12 against 43/24/24/9: keep it)
  - pop-up spin (Known gap 7)

If a step improves some of these and worsens others, report the trade-off plainly.

## Deliverables
- statcast/fouls.py v0.3 and the new tables in STATCAST_TARGETS_2025.md and fouls_2025.json.
- headless/power_chain.js v0.4.
- bb_engine.js v1.0 with the mechanism, its header CHANGED entry, and comments that explain the perception in plain English. Change the script tag in baseball.html to `bb_engine.js?v=1.0`; that is the only change allowed in baseball.html. Do not touch bb_field.js or bb_game.js.
- CALIBRATION.md v1.0: a section "### Perception: the predicted drop (bb_engine v1.0; date)". It carries before/after/target tables for the acceptance metrics, tables A and C for the model beside the league, the league line across the three seeds, and what was tried and rejected, all in the past tense and scoped to those runs. Update Known gaps 1 and 2.

## House rules
Headers and CHANGED lists on every code file (at most five lines; drop the oldest). Delete old code; never comment it out. Comments change with the code. No Node-only APIs or Math.random in the engine or the headless scripts; they must still run under jsc on the Mac. Numbers with their n. Findings in the past tense, scoped. Work on the branch you are given (or `perception-error` from main if none is given); commits end with the `Co-Authored-By` line in use on this repo. Open a pull request against main whose description carries the before/after table, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do NOT merge.

## Your report (under 60 lines)
1. Step 0: whether the baselines reproduced.
2. Step 1: whether tables A-C reproduced, and how much of C survived the release-height control.
3. Step 2: how much of A and C the v0.9 model already showed.
4. The mechanism in plain English, with any new trait or constant and where its value came from.
5. The before/after/target table across seeds, and what was tried and rejected.
6. The PR link, the exact commands to reproduce, and open questions for the owner.
