## Breaking-ball contact: when a recognised pitch is re-timed, and where a swing meets a low pitch (bb_engine v3.5-v3.6; 2026-10-06)

Hypothesis BC (CALIBRATION v3.4): slow pitches were met too far out front because the timing's pull toward the expected pitch grew linearly with the speed gap where the league's flattened past about 9 mph, and the bat's path rose 1.0 deg per inch of depth across pitch types against the league's 0.73-0.84. It blocked the fold (fouls-chases-costs v3.2-v3.3), which had brought the fastball fouls and the strikeouts to the league's but cost BABIP .04 and nearly a run through the breaking balls. Worked on the Mac on branch `breaking-contact` from `integrate` (engine v3.4, the line `int3`). Runs: the league's pitches, 42 days of 2025, cut to the fields the study needs (`tools/diag/bc_cache.py`); tracked contact with the bat at 50+ mph, fouls and balls in play, 52,029 contacts, depth about each hitter's own mean (+ out front); new scripts with model twins (`bc_league.py` / `bc_model.js`, `bc_within.py`, `bc_height.py`, `bc_fit.js`); the model twin 600 hitters x 40 PA against 120 pitchers, seeds 106 and 7; the refit chain (`tools/diag/chain.sh`) and the suite (seeds 3, 11, 29) after each engine.

### 1. What the league showed

**Both parts of BC were measured with something held that the first measurement had not held: the pitch's height.**

**Depth by speed gap is not capped.** Within each pitch type the league's contact depth followed the gap to the pitcher's fastball (his four-seamer, else his sinker) at the same rate for every type (`bc_within.py`: depth on the pitcher's usual gap for the type, the pitch's own speed about his usual, height and the inside distance):

| | FF | SI | FC | SL | ST | CU | CH | FS |
|---|---|---|---|---|---|---|---|---|
| contacts | 18,754 | 8,738 | 3,849 | 7,046 | 3,321 | 2,835 | 5,244 | 1,621 |
| usual gap (mph) | 0 | -0.3 | -4.2 | -8.3 | -11.2 | -14.2 | -7.9 | -7.9 |
| depth per mph of usual gap, across pitchers (in) | | 0.05 | 0.84 | 0.43 | 0.85 | 0.83 | 0.81 | 1.00 |
| depth per mph slower than his usual, within a pitcher (in) | 1.42 | 1.26 | 1.02 | 0.74 | 0.57 | 0.82 | 0.87 | 0.72 |
| depth per zone height (in) | -3.6 | -4.8 | -6.8 | -8.4 | -8.0 | -9.8 | -4.5 | -5.5 |

Pooled with a constant for each type: 0.73 in per mph across pitchers, 1.04 within a pitcher, -5.6 in per zone height, +0.33 in per inch inside; and beyond that slope the types' own offsets were small, -1.7 in (curveballs) to +2.2 (changeups): SI -1.6, FC +0.5, SL +0.6, ST +0.2, CU -1.7, CH +2.2, FS +1.7. The raw curve by gap (all contact: -4.3, -1.7, +0.8, +3.1, +4.1, +5.1, +6.1, +7.1, +8.6, +10.8 in at 0, -2, -4, -6, -8, -10, -12, -14, -16.5 and beyond -18 mph) bends past 6 mph because the slow types are thrown low and a low pitch is met out front (below), not because the timing pull saturates.

**The model (v3.4)** matched the within-pitcher slope (1.06) and the swings' contact by gap (.821 / .857 / .696 / .668 / .714 against the league's .825 / .827 / .710 / .677 / .699 from 0 to beyond -13 mph), but carried **+3.6 to +4.6 in of out-front contact beyond the gap on its breaking balls** (FC +1.8, SL +3.6, ST +4.2, CU +4.6) where its changeups and splitters matched (+2.1, +2.0); depth by type -3.5 -3.6 +1.0 +5.0 +7.5 +9.3 +3.3 +3.0 (league -4.0 -3.9 +0.4 +3.9 +5.6 +6.5 +4.8 +5.0). In the model a recognised pitch's timing was pulled toward the pitch he expected by a share set by his eye alone; a curveball and a changeup with the same speed gap were pulled alike. In the league the pitch that shows itself early (a curveball leaves the hand going up) was met less out front for its gap than the one that hides in the fastball's tunnel (a changeup).

**The bat's path does not rise too fast; it depends on the pitch's height.** By height within fastballs the league's contact moved from -0.2 in about each hitter's mean below the zone to -6.2 above it, at about the same attack (7.3, 6.1, 5.4, 5.2, 5.4, 5.7 deg) and with the bat's direction following the depth (`bc_height.py`: direction 1.53 deg per inch of depth, -1.4 per zone height): a low pitch is met further round the arc, and at a given depth a high pitch is swung more uphill. Least squares on the league's contact:

| | intercept | per inch of depth | per zone height | per inch inside | breaking / off-speed |
|---|---|---|---|---|---|
| attack, all types (deg) | 6.99 | 0.959 | +3.25 | -0.14 | SL -0.9, ST -1.4, CU -1.3, CH -0.3 |
| attack, fastballs | 6.75 | 1.041 | +4.12 | -0.19 | |
| bat direction (deg, + pull) | 0.33 | 1.53 | -1.40 | +0.21 | -1.4 / -0.8 |
| swing tilt (deg) | 39.3 | -0.16 | -14.6 | +0.38 | -1.1 / -0.8 |
| depth, fastballs (in; speed gap held) | | | -4.37 | +0.31 | |

The model's attack (v3.4) was 9.4 + 0.91 x depth - 0.2 x height: the same slope on depth, no height term, and its depth flat with height (+0.45 in per zone). Breaking balls are thrown low (mean height .24-.35 of the zone against the four-seamer's .65), so across types the league's attack seemed to rise only 0.78 deg per inch (the BC table's 0.73-0.84): a low pitch is met out front at a lower attack. Its within-type slopes on breaking and off-speed pitches (0.83, 0.77) are lower than on fastballs (0.97) for the same reason within a type. And the arc's radius: at the league's tilt (32 deg) a direction slope of 1.53 deg per inch and an attack slope of 0.95 both give **0.81 m** (cos and sin of the tilt over the radius); the model's 0.87 m came from one week of July with height not held.

### 2. Built: engine v3.5 (BC)

**The earlier he picks it up, the more of its timing he changes (RETIME_S).** A recognised pitch's timing error now has two parts. How far this one strays from its kind's usual speed (`ref.t`, this pitcher's usual speed for the type) he misjudges by the prior's pull as before (PRIOR_T 5.0, unchanged: the within-pitcher slope it gives, 1.04-1.06 in per mph, is the league's 1.04). The gap from the pitch he expected to the kind he now sees is the swing he had committed: picked up at the commit point he keeps what a fooled swing keeps at launch, the share of the gap not yet shown (1 - tc^2, about 0.6); picked up earlier he re-times by launching later, at full speed, and exp(-lead / RETIME_S) of that is left, lead = the time from his pickup to the commit point. His pickup is the same random draw as before (pFooled): he needs a separation s* (exponential, mean his spot), the separation grows as the square of the flight, so he picks the pitch up at the share sqrt(s* / the separation at the plate) of it. Only the gap not re-timed is closed by altering the swing (the adjusted swing's bat-speed cost, ADJ_PER_MS). The pitch he sat on keeps the old form (his hedge). Nothing new is drawn: with RETIME_S infinite and PLAN_H zero, v3.5 reproduced v3.4's twin output exactly.

RETIME_S was FITTED (class O) to the league's depth by type (8 types, seeds 106 and 7). Three forms were tried on the way: (a) the old pull shrunk by the lead, whole (prior 3.5, RETIME_S 0.11-0.14: depth by type rms 0.56-0.66 in, but the within-pitcher slope rose to 1.44 in per mph, since a stronger pull also caught a pitch's own speed scatter); (b) the committed share a free constant (0.6, RETIME_S 0.12: rms 0.59, bat speed by type 0.39 mph); (c) the share from the geometry, 1 - tc^2 (RETIME_S 0.11: rms 0.64, bat speed 0.48). (c) was kept: one constant fewer, and it ties the recognised pitch to the fooled one. RETIME_S near 0.1 s is a believable re-timing time (a launch delayed in the 100 ms or so before the commit point).

**The swing's plan by height (PLAN_H, measured).** Where on the arc he plans to meet the ball moves -4.4 in per zone height (a low pitch out front), and the attack he brings rises 4.1 deg per zone height, both about the league's mean contact height (.47 of the zone), from the league's fastballs with the speed gap and inside distance held. **The arc's radius 0.81 m** (was 0.87), re-measured with the pitch's height held.

**The model twin** (seed 106, 600 hitters x 40 PA; v3.4 -> v3.5 before the chain, league in brackets):

| | v3.4 | v3.5 | league |
|---|---|---|---|
| depth by type FF SI FC SL ST CU CH FS (in) | -3.5 -3.6 +1.0 +5.0 +7.5 +9.3 +3.3 +3.0 | -3.3 -2.9 +1.4 +4.6 +5.7 +6.4 +4.2 +3.8 | -4.0 -3.9 +0.4 +3.9 +5.6 +6.5 +4.8 +5.0 |
| depth by gap 0, -4, -8, -10, -14, -16.5 mph | -4.0 +0.2 +3.5 +5.4 +9.2 +9.9 | -3.6 0.0 +3.5 +5.3 +6.7 +7.3 | -4.3 +0.8 +4.1 +5.1 +7.1 +8.6 |
| within-pitcher slope (in per mph) | 1.06 | 1.05 | 1.04 |
| depth per zone height (in) | +0.45 | -3.6 to -3.8 | -5.6 (fastballs -4.4) |
| attack = a + b x depth + c x height | 9.4 + 0.91 d - 0.2 h | 7.3 + 0.98 d + 4.1 h | 7.0 + 0.96 d + 3.3 h |
| breaking balls: attack, foul share of contact, launch | 15.6, .560, 9.2 | 13.9, .527, 5.0 | 11.6, .443, 12.7 |
| contact per swing by gap (0 / -1..-5 / -5..-9 / -9..-13 / -13+) | .821 .857 .696 .668 .714 | .826 .861 .700 .672 .751 | .825 .827 .710 .677 .699 |

The breaking balls' attack and fouls came down and their depth to the league's; their launch fell to 5 deg (league 12.7), because without the fold the model tops them: launch minus attack -8.9 against the league's +1.1 (v3.1 had shown the same, -6.2, before the fold's aim under the ball).

**The suite on v3.5 alone** (after the chain; `int3` -> v3.5, seeds 3 / 11 / 29, league in brackets): runs 4.58 / 4.75 / 4.65 -> 4.79 / 4.94 / 4.93 (4.45); BABIP .277 / .278 / .282 -> .278 / .288 / .281 (.291); K% 18.9 / 18.1 / 19.5 -> 18.7 / 18.7 / 19.6 (22.2); BB% 9.0 / 9.2 / 8.5 -> 9.4 / 9.3 / 9.5 (8.4); HR% 3.3-3.5 -> 3.5-3.8 (3.1); chase .238 -> .222 (.283); the contact score's misses by kind .0396 -> .0361 and vertical miss .0816 -> .0788, squared-up .0522 -> .0583. As the fouls write-up found for the timing cap alone, BC without the fold moved the outcomes away from the league's (fewer of the breaking balls' early, weak contacts; more home runs), with the strikeouts unchanged.

### 3. Built: engine v3.6, the fold on BC

The fold carried over by hand from `fouls-chases-costs` v3.2-v3.3 (its pasted fit blocks left out; the chain refits those): the last look corrects a miss it can see (LOOK_GAIN 1.3, LOOK_SD 0.5 in), the raw barrel scatter x1.96 (motorIn), the aim under the ball 1.0 in (undercut), VERT_MISS 0.09, the friction of a graze 0.27 (MU_BAT). Two traits recentred on their own measurements with it (fit_population v0.9):

- **The usual contact point** (pullBias, the picks' target 1 -> -1.5 deg, as v3.2 had re-measured): v3.5's path on contact pointed +1.5 deg to the pull side over all kinds (fastballs -2.7, breaking +9.2, off-speed +8.3) against the league's -0.9 (-5.7, +6.0, +6.0; `bc_height.py`). After: -0.9 on contact in `spray_check` (league -1.3).
- **The attack trait** (the picks' target 9 -> 7.8 deg). The trait is his attack at his usual contact point; the attack his swings actually made, with the arc and PLAN_H, averaged 10.8 deg over swings of 50+ mph where the league's averaged 9.6 (whiffs 14.2, contact 8.3; per hitter 9.5 +- 3.7). After: 9.3 over swings (contact 8.5); fastball contact 5.7 deg (league 5.5), off-speed 12.7 (12.5), breaking 13.6 (11.6).

**The suite** (v3.6 after the chain; `int3` -> v3.5 -> v3.6, league in brackets; the fold on the old engine, `fouls-chases-costs` v3.3, for comparison):

| (seeds 3 / 11 / 29) | int3 (v3.4) | v3.5 (BC) | v3.6 (BC + fold) | fold on v3.1 | league |
|---|---|---|---|---|---|
| runs / team-game | 4.58 / 4.75 / 4.65 | 4.79 / 4.94 / 4.93 | 3.82 / 4.04 / 3.84 | 3.45 / 3.38 / 3.42 | 4.45 |
| BABIP | .277 / .278 / .282 | .278 / .288 / .281 | .241 / .246 / .242 | .227 / .224 / .232 | .291 |
| K% | 18.9 / 18.1 / 19.5 | 18.7 / 18.7 / 19.6 | 21.0 / 20.7 / 21.1 | 22.3 / 22.3 / 23.0 | 22.2 |
| BB% | 9.0 / 9.2 / 8.5 | 9.4 / 9.3 / 9.5 | 10.4 / 10.6 / 10.3 | 10.2 / 10.2 / 10.4 | 8.4 |
| HR% | 3.3 / 3.4 / 3.5 | 3.7 / 3.5 / 3.8 | 3.3 / 3.3 / 2.9 | | 3.1 |
| pitches / team-game | 138 / 139 / 139 | 140 / 141 / 142 | 146 / 147 / 146 | 147 | 146 |
| in play GB / LD / FB / PU % | 45 / 21 / 25 / 9 | 46-48 / 20-21 / 24-25 / 8 | 43-44 / 17 / 24-25 / 14-15 | 40-41 / 17 / 26-27 / 16 | 43 / 24 / 24 / 9 |
| chase | .238 | .222 | .244 | .244 | .283 |
| fastball fouls per swing (foldscore) | .320 | .340 | .444 | .446 | .451 |
| grazes, share of fastball contact | .120 | .136 | .288 at .817 | .30 | .327 at .817 |
| contact score: misses by kind / squared-up / vertical miss / by reach | .0396 / .0522 / .0816 / .0521 | .0361 / .0583 / .0788 / .0519 | .0287 / .0188 / .0627 / .0569 | | |

The fold brought the fastball fouls, the grazes, the pitches and (nearly) the strikeouts to the league's, and three of the contact score's four panels to their best yet. **But BC did not unblock it**: BABIP fell .036 and runs 0.76 a team-game, against .038 and 1.0 on the old engine. The extra walks follow the longer counts with a chase still short of the league's (DF).

### 4. What is left: the barrel's height against the ball by depth

By kind after the fold (model twin, seed 106): breaking balls fouled .547 of contact (league .443) and popped up in play .068 per contact (.041); off-speed .551 and .064 (.417 and .036); fastballs .529 and .047 (.507 and .036); in-play launch on off-speed 15.9 deg against the league's 9.1, on breaking balls 16.4 against 14.0. Where in depth (`pu_depth_model.js` against the league, breaking and off-speed together, launch minus attack by depth about each hitter's mean):

| depth (in) | < -4 | -4..0 | 0..4 | 4..8 | 8..12 | 12+ |
|---|---|---|---|---|---|---|
| league: launch minus attack (deg) | +14.6 | +9.1 | +3.8 | -2.2 | -6.7 | -16.1 |
| v3.4 | -2.3 | -5.1 | -5.6 | -7.1 | -8.4 | -5.6 |
| v3.5 | -0.5 | -1.2 | -6.8 | -8.2 | -9.2 | -10.4 |
| v3.6 | +0.3 | +1.0 | +1.2 | +0.2 | -0.8 | -2.2 |
| league: pop-ups in play per contact | .006 | .024 | .044 | .047 | .056 | .045 |
| v3.6 | .010 | .027 | .051 | .077 | .095 | .105 |
| fastballs, league: launch minus attack | +22.7 | +19.2 | +15.1 | +9.7 | +2.6 | -8.3 |
| fastballs, v3.6 | +15.3 | +14.0 | +12.1 | +8.7 | +5.3 | +0.6 |

**In the league a ball met out front is struck over its middle and one met deep under it, by about 31 deg of launch minus attack from deep to far out front, the same for fastballs and slow pitches. The model's falls 15 deg on fastballs and, since the fold, 2.5 on slow pitches**, so its out-front breaking balls and changeups are lifted (pop-ups, and fouls pulled off the out-front path) where the league's are topped into the ground. In the engine the only term that moves the barrel's height with depth is the attack against the pitch's descent (`D += sFwd (tan(descent) - tan(attackPlan))`, from the timing part of the depth only), which nearly vanishes for a breaking ball (its descent, 8-12 deg, is about its attack) and is not touched by the planned depth; the last look then folds the out-front misses back to the edge of the ball. The league's gradient being the same for both kinds says it is not the descent. Proposed as hypothesis VD (below). The league also swung at breaking balls 1.4 deg less to the pull side and 1.1 deg flatter than at fastballs met at the same depth and height (section 1), which the model does not do (its breaking balls' path +8.7 deg on contact against +6.0).

### 5. Checks

invariants_check v0.5 (400 games, seed 11): no violations. physics_check as before. plays_check: 14 of 14, including case 4 (hypothesis 1C), with only two qualifying plays at this mix; not counted as fixed.

### Proposed changes to the mysteries and hypotheses tables

- **Mystery 1 (fouls and strikeouts):** with the fold on v3.6, fastball fouls .444 per swing (league .451), grazes .288 of fastball contact at .817 of the release speed (.327 at .817), pitches 146-147 (146), K% 20.7-21.1 (22.2). It costs BABIP .036 and 0.76 runs through VD.
- **Mystery 3 (batted-ball mix and BABIP):** BABIP .241-.246 with the fold; liners 17% of balls in play, pop-ups 14-15%: the out-front slow pitches lifted (VD).
- **Mystery 9 (reaching contact by direction):** unchanged; re-measure on v3.6.
- **New mystery: the barrel's height against the ball by depth** (VD's table): launch minus attack falls 31 deg from deep to far out front in the league for every kind, 15 (fastballs) and 2.5 (slow pitches) in the model.
- **Hypotheses:**
  - **BC: confirmed in part and built** (engine v3.5). The timing pull does not saturate; what the model lacked was re-timing by how early the pitch is picked up (RETIME_S 0.11 s), and the bat's path did not rise too fast across types: it was the pitch's height (PLAN_H, measured; the arc's radius 0.81 m). It did not unblock the fold.
  - **VD (new, likely): the barrel's height by depth.** A ball met out front is struck over its middle by the arc's own rise, whatever the pitch; the model moves the barrel against the ball only by the attack against the descent, on the timing part of the depth. Test: the barrel's height along the arc (the rise from the planned point to contact, for planned and timed depth alike) against the league's launch minus attack by depth and kind; then whether the last look should fold an out-front miss at all.
  - **BK (new, possible): breaking balls swung flatter and less pulled** at the same depth and height (league -1.1 deg attack, -1.4 deg direction): perhaps the adjusted swing that waits on a slow pitch.
  - **DF** unchanged and next with VD: the walks with the fold (10.3-10.6%) are the long counts meeting a chase of .244 against .283.
  - **1C:** passed on this branch with two qualifying plays; keep open.
- **Order:** VD, then DF, then DC, then CO and TB.

### Trait map constants

- `TIMING.retime` (RETIME_S) 0.11 s: class O, fitted to the league's contact depth by pitch type. `TIMING.prior` (PRIOR_T) 5.0 unchanged, now judging only a pitch's own speed scatter (confirmed by the within-pitcher slope).
- `PLAN_H` depth -0.111 m and attack +4.1 deg per zone height about 0.47 of the zone: measured (league fastballs, 42 days of 2025).
- `SWING_R` 0.81 m (was 0.87): measured (bat direction and attack per inch of depth, height held).
- The fold: `LOOK_GAIN` 1.3 (class O), `LOOK_SD` 0.5 in (fitted to the grazes' share), `MU_BAT` 0.27 (fitted to the grazes' speed), `VERT_MISS` 0.09 and the aim under the ball 1.0 in (fitted, v3.2), motorIn x1.96 (class O, with LOOK_GAIN).
- The picks' targets (fit_population v0.9): pullBias -1.5 deg (the path's direction on contact), attack 7.8 deg (the swings' attack, 9.6), motorIn 1.70, undercut 1.0.

### Commits on the branch

f0241b2 engine v3.5 and the bc scripts; d9c2723 the arc's radius; 7a596be the chain; 498dc33 engine v3.6 (the fold); ef0401d the usual contact point; 669aa8a the chain; 1a240a2 the attack recentred; 2430801 the chain.
