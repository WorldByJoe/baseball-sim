## The vertical spread of contact and the changeup (bb_engine v3.9; 2026-10-06)

Hypotheses VS and CD (CALIBRATION v3.5, ranked first and second). VS: the in-play launch angles flattened with the fold (v3.6), too few balls at 0-30 deg (.38 of balls in play against the league's .43) and too many topped and lofted, and the suspect was the last look's correction folding near misses back to the ball's edge. CD: changeups were whiffed .375 per swing (league about .30) and lifted when hit, where the league tops them. Joe (2026-10-06): a last effort on VS and CD before the post-season, then push the final version everywhere. On the Mac, branch `vertical-spread` from `integrate` after #41 (engine v3.8). Scripts in `diag_out/vs/` (scratch): `mk.py` and `mkcd.py` (variant engines), `vs_league.py` / `vs_model.js` (launch angle split into attack and launch minus attack), `corr_league.py` / `corr_model.js` / `byb_model.js` (launch on attack, by swing and by hitter), `smap.js` (the collision's launch by the barrel's offset), `cd_league.py` / `cd_model.js` (by pitch type).

### 1. VS: the last look does not carry the flat launch angles

**Variants of the correction** (contact score, 600 hitters; the in-play launch angle's share at 0-30 deg; league .429):

| the last look | fastball whiffs (.174) | fouls FB (.453) | squared-up (.435) | vertical miss rms | 0-30 share |
|---|---|---|---|---|---|
| v3.8: 1.3 x the judged miss beyond the edge, 0.5 in of error | .175 | .461 | .392 | .0773 | .379 |
| aim 0.85 of the edge, scatter x1.15 | .138 | .463 | .412 | .0787 | .363 |
| aim 0.7 of the edge, scatter x1.3 / x1.5 | .140 / .149 | .416 / .417 | .445 / .446 | .0767 / .0735 | .358 / .336 |
| judging error 1.0 in | .188 | .396 | .452 | .0742 | |
| every gap corrected toward the middle, gain 0.5 (scatter x1.5 / x1.8 with 1 in of error) | .154 / .179 | .336 / .336 | .517 / .504 | .0677 / .0626 | |

Folding toward the middle gave the vertical-miss panel its best shape and cost the fouls (the pre-fold problem, v3.1); every form that kept the fouls left the in-play launch angles where they were. Friction on the bat (MU_BAT 0.4, 0.55) changed nothing: the tangential impulse sits at the rolling limit, under the friction cap, in most collisions.

**What the collision makes in the game.** By s, the barrel's offset as a share of the two radii: launch minus attack climbs about 70 deg per unit of s to 38 deg at s = 0.5, levels at 45-48 deg (s 0.6-0.7, where .05-.08 go over 60 deg) and falls back toward the pitch's line past 0.8 (grazes going back). The league has .045 of tracked contact at 60+ deg above the attack (pop-ups straight up) and the model .013; its folded contact lands at s 0.6-0.9 and piles at 25-60 deg (.365 against .326) and at -25 to -60 below (.209 against .139).

**Where the in-play spread comes from.** League (42 days of 2025, 27,332 balls in play with bat tracking): launch angle 13.8 ± 28.4 = attack 8.6 ± 8.5 plus launch minus attack 5.1 ± 27.4, correlation -0.04. Model: 12.6 ± 28.7 = 7.3 ± 7.7 plus 5.3 ± 25.9, correlation **+0.23**. Across hitters (40+ tracked balls in play, 293; the noise in one swing's measured attack averages away over his 90): **a hitter whose mean attack was 1 deg steeper launched his balls in play 0.86 deg higher in the league** (launch minus attack -0.14 per deg), **1.79 deg in the model** (+0.79): the collision's own lift (a square hit leaves at about twice the attack, less the pitch's descent) on top of the swing's. The league's steep swingers aim higher on the ball; the model's aim did not depend on the swing. Within a hitter's swings, with height and depth held, the league's slope was -0.48 and the model's +0.65 (the league's partly the measurement's own noise, which the hitter means remove).

### 2. Built: engine v3.9, he aims to suit his swing

**AIM_ATTACK 0.13 in per deg** of his attack trait above AIM_REF 7.8 (the picks' mean attack, so the league's aim under the ball stays the undercut trait's): a steeper swing aims higher on the ball. MEASURED to the across-hitter slope (the model twin, two seeds: 0.12 gave -0.08 and -0.01, 0.15 -0.42 and -0.39, league -0.14).

**After the chain** (model twins, seeds 106 and 31): the across-hitter slope of launch minus attack on attack -0.25 and -0.14 (league -0.14; v3.8 +0.79), the hitters' mean launch spread 5.1-5.3 deg against 6.3 (league 4.9); in play, launch angle 13.3 ± 28.3 (league 13.8 ± 28.4), the correlation of attack with launch minus attack +0.21 (league -0.04: the swing-to-swing part is not built), the share at 0-30 deg .386 (v3.8 .379, league .429).

**The suite** (seeds 3 / 11 / 29, v3.8 -> v3.9, league in brackets): runs 3.71 / 4.05 / 3.83 -> 4.18 / 3.94 / 3.73 (4.45); hits 6.9 / 7.2 / 6.8 -> 7.3 / 7.2 / 6.9 (8.26); BABIP .255 / .260 / .247 -> .266 / .264 / .256 (.291); K% 24.4 / 23.9 / 24.1 -> 24.4 / 24.9 / 25.1 (22.2); BB% 10.2 / 10.6 / 10.5 -> 10.5 / 10.1 / 10.8 (8.4); HR% 3.0-3.2 -> 3.1-3.2 (3.1); pitches 148-150 -> 149-151 (146); line drives 18-19% -> 19-20% of balls in play (24); chase .257 -> .254 (.283); whiffs per swing FB .175 -> .176, BR .320 -> .311, OS .375 -> .364; contact struck square vertically fouled .269 -> .249 (.211); the contact score's misses by kind .0314 -> .0320, squared-up .0313 -> .0307, vertical miss .0773 -> .0775, by reach .0621 -> .0665 (all 90: .0629 -> .0649). **Kept**: its own measurement came to the league's with nothing fitted to an outcome, and the hits and BABIP moved toward the league's; strikeouts rose about half a point and the panel by reach worsened.

### 3. CD: the changeup pictured like the fastball tops it and adds whiffs

**By pitch type**, league and model (v3.9 before the chain): whiffs per swing, launch minus attack over contact, in-play launch angle:

| | FF | SI | FC | SL | ST | CU | CH | FS |
|---|---|---|---|---|---|---|---|---|
| league whiffs | .189 | .121 | .204 | .315 | .303 | .293 | .289 | .335 |
| model whiffs | .181 | .157 | .160 | .353 | .279 | .269 | .339 | .422 |
| league launch minus attack | +25.2 | +6.3 | +11.2 | +2.7 | +7.4 | -7.0 | -4.1 | -7.2 |
| model | +17.5 | +12.7 | +8.5 | -5.4 | -5.6 | -9.9 | -3.9 | -7.1 |
| league in-play launch | 19.7 | 4.3 | 15.7 | 13.2 | 18.4 | 10.7 | 8.9 | 7.7 |
| model | 13.5 | 11.5 | 13.8 | 12.3 | 14.0 | 11.9 | 11.7 | 8.5 |

The league's in-play launch differs by type by 15 deg (four-seamers lifted, sinkers on the ground); the model's by 6. The model's batter pictures each type's own shape (the league's for that type from the slot), so a four-seamer's ride and a sinker's sink fool nobody; in the league they do. Changeups in the model: 41% of swings at one not picked up (whiffs .62, mostly over it; contact -12.8 deg launch minus attack), 59% at one picked up (whiffs .15; contact -1.2 deg, in-play launch 12.2). In the league a changeup that dropped more than its pitcher's usual was whiffed a little more (.310 at 2+ in more drop, .274 at 2+ in less) and topped more (-7.3 against +2.0 deg; slope 1.26 deg of launch minus attack per inch of ride; sliders 1.16, curveballs 2.19).

**Tested:** a picked-up changeup or splitter pictured a share of the way toward the pitcher's own fastball's path (the arm says fastball): 0.2 and 0.4 topped changeups (-3.9 -> -4.7 / -5.5) but raised their whiffs (.339 -> .352 / .358, splitters .422 -> .430 / .444) and worsened the contact score (.0623 -> .0642 / .0656); the in-play launch did not fall. **Not built.** The changeup's excess whiffs are the ones not picked up, and its lift is one case of the types' launch being too alike.

### 4. What is left

- **The types' launch too alike** (new, from CD): the batter's picture of a pitch's vertical break by type. Four-seamers should be lifted (19.7 in play) and sinkers, changeups and splitters kept down (4.3-8.9); the model's 8.5-14.0. A test: the picture of a picked-up pitch pulled toward a common fastball shape for the pitches thrown with the fastball's arm action, fitted to the launch by type; the whiffs by type with it.
- **Too few pop-ups straight up**: the league has .045 of tracked contact 60+ deg above the attack, the model .013; its folded contact piles at 25-60 deg instead. The collision can make them (physics_check: 85 deg at 2.0 in under the ball, square and level), but in the game the tilted barrel sends part of an undercut's deflection sideways, and the fold lands contact past s 0.8, where the ball goes back. Suspects: where on the ball the fold lands, the ball's spin at the contact point, a tangential restitution (Nathan et al. 2012 measured e_x about 0.3 at game speed).
- **Changeups not picked up** (41% of swings at them, whiffs .62).

### 5. Checks

invariants_check v0.5 (400 games, seed 11): no violations. plays_check 14 of 14. physics_check as before (undercut 2.0 in at a 10-deg attack, square and level: 82 mph at 85 deg).

### Trait map constants

- `AIM_ATTACK` 0.13 in per deg, `AIM_REF` 7.8 deg: his aim suits his swing (measured: the league's across-hitter launch on attack, 0.86 deg per deg).
