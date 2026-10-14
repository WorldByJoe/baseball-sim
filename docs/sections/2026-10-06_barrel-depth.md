## The barrel's height against the ball by depth: he watches the ball, not his barrel (bb_engine v3.7; 2026-10-06)

Hypothesis VD (the breaking-ball contact write-up, section 4): with the fold on BC (engine v3.6), BABIP fell .036 and runs 0.76 a team-game, and the cause found was that a ball met out front was not struck over its middle as the league's is: launch minus attack fell 31 deg from deep to far out front in the league for every pitch kind, 15 deg in the model on fastballs and 2.5 on slow pitches, so out-front breaking balls and changeups were lifted into pop-ups. Joe (2026-10-06): keep v3.6 and test VD next; merge when appropriate. Worked on the Mac on branch `barrel-depth` from `integrate` after #39. Runs: the league cache (`tools/diag/bc_cache.py`, now with each pitch's descent at the front of the plate from its flight), new scripts with a model twin (`vd_league.py`, `vd_causes.py`, `vd_model.js`), a scratch engine with the candidates as knobs, the refit chain and the suite.

### 1. What the league showed

Tracked contact (52,029; bat 50+ mph), depth about each hitter's own mean, launch minus attack ("vm", + struck under the ball's middle). The pitches' descent at the plate: four-seamers -4.8 deg, sinkers -5.8, cutters -6.1, sliders and sweepers -7.3 to -7.4, changeups and splitters -7.2, curveballs -9.5.

| vm by depth (in) | < -4 | -4..0 | 0..4 | 4..8 | 8..12 | 12+ |
|---|---|---|---|---|---|---|
| fastballs, low (under .33 of the zone) | +8.2 | +4.1 | +2.9 | -2.1 | -6.9 | -15.6 |
| fastballs, middle | +20.5 | +18.1 | +15.5 | +9.3 | +5.4 | -7.5 |
| fastballs, high | +30.0 | +28.9 | +24.0 | +21.7 | +10.3 | +3.2 |
| fastballs, all | +22.7 | +19.2 | +15.1 | +9.7 | +2.4 | -8.4 |
| slow pitches, low | +2.5 | +0.6 | -4.3 | -7.7 | -11.2 | -19.3 |
| slow pitches, middle | +17.5 | +13.6 | +10.0 | +4.2 | +0.3 | -10.6 |
| slow pitches, all | +14.6 | +9.1 | +3.8 | -2.2 | -6.7 | -16.1 |

- **The slope is the same for every kind** (height held): -0.81 deg per inch of depth on fastballs, -0.78 on breaking balls, -0.80 on off-speed, curving more steeply out front (-0.017 to -0.038 per square inch).
- **The pitch's descent barely matters.** Each pitch's own descent changed the slope by -0.08 (breaking) and -0.12 (off-speed) deg per inch per degree, and by +0.11 on fastballs, the wrong sign, where the engine's term (the ball higher out front by s tan(descent)) implies about 0.24.
- **It is not a batter matching the pitch's plane**: at a given depth and height a steeper pitch was not swung at more steeply (attack per degree of descent -0.03, +0.15, +0.44).
- **It is not one cause for both** (a pitch slower than usual met out front and dropping more): holding the speed off the pitcher's usual left the slope at -0.72 to -0.81.
- **It is in the fouls.** Balls in play kept about the same launch minus attack at every depth (+0.05 deg per inch on slow pitches, +0.69 on fastballs); the fouls fell 1.6 and 0.9. On slow pitches the fouls went from +30 deg deep (fouled back) to -22 far out front (topped and hooked foul) while the balls in play stayed at -2 to +3.

**The model (v3.6)**: -0.26 deg per inch on fastballs, +0.18 on breaking balls, -0.04 on off-speed; the descent interaction twice the league's; balls in play rising 1.4-1.6 deg per inch with depth, fouls -0.3 to -0.7. Its parts (`d_parts.js`, slow pitches): the attack-against-descent term near zero at every depth (an out-front slow pitch's descent, 7-10 deg, is about its attack) and only the misreads topping the out-front ones.

### 2. Candidates (scratch engine, seed 106, 500 hitters, before any refit)

| | fastballs, vm deep -> far out front | slow pitches | slope FB / BR / OS (deg per in) | in play / fouls, slow |
|---|---|---|---|---|
| v3.6 (the whole descent, the tangent path) | +15.5 ... +1.6 | +1.0 ... -2.6 | -0.27 / +0.16 / -0.07 | +1.56 / -0.34 |
| the arc's own curve (the sweet spot's height on the tilted circle) | +6.3, +13.6 ... -14.9 | -8.7, +0.5 ... -21.1 | -0.11 / +0.09 / +0.09 | +1.44 / -0.99 |
| the descent kept 0.3 | +20.1 ... -9.8 | +7.2 ... -17.6 | -0.99 / -0.98 / -1.09 | +0.93 / -1.22 |
| the descent kept 0.3, plus a fixed rise of 0.03 | +22.4 ... -15.2 | +10.0 ... -21.7 | -1.23 / -1.25 / -1.32 | +0.79 / -1.55 |
| league | +22.7 ... -8.4 | +14.6 ... -16.1 | -0.81 / -0.78 / -0.80 | +0.05 / -1.59 |

The arc's own curve tops a ball met deep as much as one met out front, where the league's deep contact is struck under. Keeping only a share of the ball's descent gave the league's shape for both kinds, with no new term. Across 0.2-0.5 the slow pitches' pop-ups in play per contact by depth came to .004-.012, .030-.037, .045-.055, .054-.065, .051-.081, .043-.064 (league .006, .024, .044, .047, .056, .045; v3.6 .010, .027, .051, .077, .095, .105) and pop-ups to 9-10% of balls in play (league 9).

**The reading.** Met at a timing error that puts the contact out front, his barrel has risen along its planned path, committed at launch, and he cannot see his own barrel in time; the ball, which he does watch, is higher than at the plate, and he steers to most of where it is. Met deep, the reverse: the ball has come further down and his barrel is still low on its path. What the barrel's rise does not share with the ball is the same for every pitch, which is the league's.

### 3. Built: engine v3.7

**He watches the ball, not his barrel (DESCENT_KEPT 0.3).** In the vertical offset at contact the attack-against-descent term became `D += sFwd (DESCENT_KEPT tan(descent) - tan(attackPlan))`: his barrel's rise along its planned path, committed at launch, he cannot see in time; the ball's being higher out front (lower deep) he sees and steers to, keeping 0.3 of it. FITTED to launch minus attack by depth and kind (class O; 0.2-0.5 all fit within a few deg; the league's descent interaction on slow pitches, -0.08 to -0.12 deg per inch per deg against the full term's 0.24, points to 0.35-0.5).

**Two refits with it.** (a) The aim under the ball was tried at 1.4 in (from 1.0), which brought fastball contact's launch minus attack to the league's (18.4 against 18.1; launch 24.1 against 23.6, in play 14.8 against 14.8) but after the chain gave a batted-ball mix of 38 / 17 / 28 / 16 and K% 25.2-26.2: put back to 1.0. (b) VD's topped contacts are partly topped misses: with the aim at 1.0 the fastball whiffs rose from .161 to .183 per swing (league .174) and K% to 24.2-24.6, so the raw barrel scatter (motorIn, class O, fitted with LOOK_GAIN to the fastball whiffs in v3.2-v3.3) was scaled x0.9 (fastball whiffs .167-.175; fit_population v1.0).

**The model twin** (seed 106, 600 hitters, v3.7 after the chain):

| | v3.6 | v3.7 | league |
|---|---|---|---|
| fastballs, vm deep -> far out front | +15.3, +14.0, +12.1, +8.7, +5.3, +0.6 | +21.0, +14.5, +8.6, +0.9, -5.1, -9.7 | +22.7, +19.2, +15.1, +9.7, +2.4, -8.4 |
| slow pitches | +0.3, +1.0, +1.2, +0.2, -0.8, -2.2 | +9.5, +4.5, -0.9, -7.3, -12.4, -18.0 | +14.6, +9.1, +3.8, -2.2, -6.7, -16.1 |
| slope FB / BR / OS (deg per in, height held) | -0.26 / +0.18 / -0.04 | -1.05 / -1.03 / -0.98 | -0.81 / -0.78 / -0.80 |
| slow pitches: pop-ups in play per contact by depth | .010 .027 .051 .077 .095 .105 | .010 .030 .050 .054 .056 .053 | .006 .024 .044 .047 .056 .045 |
| in play / fouls slope, slow | +1.58 / -0.32 | +0.99 / -1.33 | +0.05 / -1.59 |
| in-play launch FB / BR / OS (deg) | 10.7 / 16.4 / 15.9 | 12.4 / 14.4 / 14.3 | 14.8 / 14.0 / 9.1 |

**The suite** (seeds 3 / 11 / 29, v3.6 -> v3.7, league in brackets): runs 3.82 / 4.04 / 3.84 -> 3.79 / 4.25 / 4.06 (4.45); BABIP .241 / .246 / .242 -> .250 / .269 / .246 (.291); K% 21.0 / 20.7 / 21.1 -> 23.1 / 23.0 / 23.0 (22.2); BB% 10.4 / 10.6 / 10.3 -> 11.3 / 10.9 / 11.3 (8.4); pitches 146 / 147 / 146 -> 150 / 152 / 149 (146); HR% 2.9-3.3 -> 3.0-3.2 (3.1); doubles 1.45-1.52 -> 1.55-1.69 (1.59); in play GB / LD / FB / PU 43-44 / 17 / 24-25 / 14-15 -> 43-44 / 18 / 26-27 / 12 (43 / 24 / 24 / 9); the foul share of contact struck square vertically .293 -> .255 (.211); the contact score: misses by kind .0287 -> .0288, squared-up .0188 -> .0249, vertical miss .0627 -> .0766, by reach .0569 -> .0527. **Kept and merged**: its own measurement (launch minus attack by depth, every kind) came to the league's, and BABIP, runs, strikeouts, pop-ups and square-contact fouls moved toward the league's; walks, pitches and two panels of the contact score moved away.

### 4. What is left

- **Too much heavily topped contact, too few liners: the vertical scatter is too wide.** Launch minus attack -60 to -25 deg was .206 of contact against the league's .139, and +5 to +15 .088 against .116 (the contact score's vertical-miss panel); balls in play by launch angle in 10-deg bins from -40 to 80: .036 .056 .083 .107 .123 .130 .127 .113 .088 .060 .027 .010 against the league's .025 .043 .078 .111 .139 .149 .141 .108 .067 .047 .031 .020 (v3.4 before the fold .034 .055 .081 .115 .134 .139 .132 .112 .082 .049 .021 .008). The fold doubled the raw scatter on the premise that the last look folds the near misses back to the ball's edge; the in-play launch angles flattened with it (sd 27.5 -> 30.9 deg at v3.6, 28.6 now). Proposed as hypothesis VS (the vertical scatter's width once the last look corrects): what share of the league's contact is a folded near miss, and whether the raw scatter or the look's gain carries the width.
- **Changeups are lifted** (in-play launch 14.3 against 9.1; launch minus attack -3.2 against -4.8 over contact, while breaking balls are -6.3 against +1.1): the league tops changeups more than breaking balls, the model the other way. Probably the changeup's dive misread (it drops and fades more than its kind is pictured).
- **Walks** (10.9-11.3%) with chase .241 against .283 (DF).

### 5. Checks

invariants_check v0.5 (400 games, seed 11): no violations. plays_check 14 of 14. physics_check as before.

### Proposed changes to the mysteries and hypotheses tables

- **New mystery (from BC): the barrel's height against the ball by depth:** closed by VD (launch minus attack by depth within a few deg of the league's for every kind).
- **Mystery 1 (fouls and strikeouts):** K% 23.0-23.1 (22.2), pitches 149-152 (146), square-contact fouls .255 (.211).
- **Mystery 3 (batted-ball mix and BABIP):** BABIP .246-.269; liners 18%, pop-ups 12%; the in-play launch angles too flat (VS).
- **Hypotheses:** VD confirmed and built (engine v3.7). New: **VS** (likely), the vertical scatter's width once the last look corrects; **CD** (possible), the changeup's dive misread. Order: VS, then DF, then DC, then CO and TB.

### Trait map constants

- `DESCENT_KEPT` 0.3: class O, fitted to launch minus attack by depth and kind.
- `motorIn` x0.9 (the picks' target 1.70 -> 1.53): class O, the fastball whiffs again.
- The aim under the ball stays 1.0 in (1.4 tried and dropped).
