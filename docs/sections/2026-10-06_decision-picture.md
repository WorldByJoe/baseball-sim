## The swing decision's picture: where the ball looked headed at the commit point (bb_engine v3.8; 2026-10-06)

Hypothesis DF (CALIBRATION v3.4): the far chases (mystery 2: chase about .24 against .283; walks 10.9-11.3% on v3.7 against 8.4) came with #31's DEC_UNSEEN (engine v3.4 in fouls-chases-costs, recorded and taken out), which shifted each picked-up pitch's picture by half its break still to come and so took breaking balls in the zone. The test proposed: the league's swings at breaking balls by where they ended against where their shape was headed at the commit point. Joe (2026-10-06): work on DF, then update the ranked mysteries and hypotheses. On the Mac, branch `decision-picture` from `integrate` after #40 (engine v3.7). Runs: the league cache with each pitch's 9-parameter flight (`bc_cache.py` and the additions), new scripts `df_league.py`, `df_fit.py` and the model's twin `df_model.js`, scratch engines, the refit chain and the suite.

### 1. What the league showed

**Where a pitch looked headed.** For every pitch (162,000 swings and takes), its constant-acceleration flight from Statcast's nine parameters and where it would have ended had it kept the pitcher's own fastball's acceleration (his four-seamer, else his sinker) from the commit point on (0.175 s before the plate): A, he sees its place and its motion at the commit point and assumes the fastball's acceleration after it, remaining break (a_fb - a) tau^2 / 2; B, he sees only its place and assumes the fastball's whole path, (a_fb - a) ((T - tau) tau + tau^2 / 2). The break still to come by A averaged +3.2 in up-down on breaking balls, +2.2 off-speed, +0.4 fastballs (B: +13.3, +9.0, +1.6).

**The decisions fit the place and motion at the commit point, with none of the break after it.** Swing modelled as logistic in the signed distance from the zone of a pictured place, the actual place + lambda x the remaining break, with intercepts by count group; lambda by likelihood:

| | across | up-down | gain in log-likelihood over lambda 0 |
|---|---|---|---|
| breaking balls (50,813), A | 1.0 | 1.25 | +1,701 (up-down alone: +818 at 1.0, +872 at 1.25, +853 at 1.5) |
| off-speed (22,344), A | 1.5 | 1.5 | +482 |
| fastballs, A | 1.5 | 1.0 | +530 |
| breaking balls, B | 0.25 | 0.25 | +1,644 |

A fitted better than B: the batter reads where the ball is and how it is moving at the commit point and credits none of the break after it (lambda about 1; a little over 1 on the slow pitches). Directly, over the plate:

| breaking balls, in below the zone's bottom | break left < 2 in | 2-3 | 3-4 | 4+ |
|---|---|---|---|---|
| 3-6 | .43 | .47 | .54 | .56 |
| 6-9 | .34 | .36 | .43 | .43 |
| 9-12 | .25 | .23 | .35 | .33 |
| 12-18 | .10 | .12 | .18 | .20 |

**The model (v3.7)** fitted 0.5 on breaking balls and 1.0 on off-speed: a pitch picked up was decided on as judged (to within its misread, no break kept) and one not picked up on the whole curve he expected from its place without its motion ((1 - tc^2) of the gap to the expected pitch, about four times the commit point's continuation). Breaking balls 9-12 in below the zone with little break left were swung at .06-.09 (league .23-.25).

### 2. Built: engine v3.8

**The commit point's picture (DEC_LAMBDA 1).** A pitch he has picked up he decides on from where the ball is and how it is moving at the commit point, continued as the pitch he expected: in the ghost's terms the break still to come, (1 - tc)^2 of the gap to the expected pitch, is all kept (the plain continuation; nothing fitted). A pitch he has not picked up he decides on as before, the curve he expected from where it is, without its motion ((1 - tc^2) of the gap; v3.1), the curve his swing follows. Picking a pitch up steers the swing he launches, not the decision.

**Tried on the way** (scratch engines, before the chain): the same picture for every pitch, picked up or not, with DEC_LAMBDA 1.0 / 1.25 / 1.5 gave the model's decisions a fitted lambda of 1.0 / 1.0-1.25 / 1.25 on breaking balls and fixed the in-zone takes (two strikes, breaking balls deep in the zone .97 / .93 / .88 against the league's .96 / .92 / .88), but after the chain whiffs on breaking balls rose to .383 per swing (league about .31) and K% to 24.7-25.0: a fooled batter decided on a nearly true picture and swung his barrel along the fastball path he expected, at breaking balls in the zone his swing could not reach. With the picture for picked-up pitches only, DEC_LAMBDA 1 gave the league's fit by itself: 1.25 on breaking balls and 1.5 on off-speed (the unread pitches carrying the rest), where 1.5 overshot (1.5 on both).

**After the chain** (model twin, seed 106): fitted lambda 1.0-1.25 on breaking balls, 1.5 off-speed (league 1.25 and 1.5; v3.7 0.5 and 1.0). Breaking balls over the plate by inches below the zone x break left:

| | < 2 in | 2-3 | 3-4 | 4+ | league < 2 / 4+ |
|---|---|---|---|---|---|
| 3-6 | .41 | .46 | .42 | .53 | .43 / .56 |
| 6-9 | .24 | .21 | .30 | .32 | .34 / .43 |
| 9-12 | .10 | .11 | .16 | .22 | .25 / .33 |
| 12-18 | .04 | .06 | .07 | .11 | .10 / .20 |

The rise with the break left is the league's; the level of the far tail, with little break left, is not (.10 against .25 at 9-12 in): the far chases that do not come from the break.

**The suite** (seeds 3 / 11 / 29, v3.7 -> v3.8, league in brackets): runs 3.79 / 4.25 / 4.06 -> 3.71 / 4.05 / 3.83 (4.45); BABIP .250 / .269 / .246 -> .255 / .260 / .247 (.291); K% 23.1 / 23.0 / 23.0 -> 24.4 / 23.9 / 24.1 (22.2); BB% 11.3 / 10.9 / 11.3 -> 10.2 / 10.6 / 10.5 (8.4); pitches 150 / 152 / 149 -> 148 / 150 / 150 (146); chase .241 -> .257 (.283); breaking balls chased below the zone at 0-3 / 3-6 / 6-9 / 9-12 / 12+ in .47 / .31 / .19 / .08 / .05 -> .57 / .42 / .25 / .14 / .06 (.56 / .49 / .36 / .28 / .11); two strikes, breaking balls in the zone .89 / .87 / .85 (league .96 / .92 / .88), unchanged; the swing policy's fit to the league's swings rms .046 -> .040 by count and .055 -> .041 by pitch kind, the swing curves by strikes .048 -> .038 (one strike) and .062 -> .053 (two); whiffs per swing on breaking balls .304 -> .320 (about .31); the contact score's misses by kind .0288 -> .0314, squared-up .0249 -> .0313, vertical miss .0766 -> .0773, by reach .0527 -> .0621. **Kept and merged**: its own measurement (the decisions' picture) came to the league's and the swing curves by count and kind to their best; walks and chases moved toward the league's, strikeouts away (more chases, contact on reaches still too good: far-chase whiffs .65 / .73 / .88 against .78 / .91 / .97).

### 3. What is left

- **The far tail of chases on breaking balls with little break left** (.10 against .25 at 9-12 in below the zone): not the break; perhaps the two-strike protection, or a pitcher's deception (DC).
- **Strikeouts 23.9-24.4%** with whiffs .246 per swing (league .232): the fold and VD's topped misses, and reaching contact that does not miss enough on the far chases (RD).

### 4. Checks

invariants_check v0.5 (400 games, seed 11): no violations. plays_check 14 of 14. physics_check as before.

### Trait map constants

- `DEC_LAMBDA` 1: the plain continuation from the commit point (not fitted); the league's decisions fitted 1.25 (breaking) and 1.5 (off-speed), reproduced by the model's mixture of picked-up and unread pitches. `DIR_READ_DEC` removed (its rule is the unread branch of the picture).
