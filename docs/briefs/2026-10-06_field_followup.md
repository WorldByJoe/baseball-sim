# Brief: the field layer on the new ball · 2026-10-06

For a local Opus agent on Joe's Mac, branch `field-followup`, working copy `/Users/joevonfischer/bsim-wt/field-followup`.
Read `docs/briefs/2026-10-05_parallel_rules.md` first: its rules hold, with two changes. The base branch is now
`integrate`. The baseline is `/Users/joevonfischer/bsim-wt/integrate/diag_out/int2`. Then read
`docs/sections/2026-10-05_ground-balls.md` and `docs/sections/2026-10-05_men-on-base.md` in full.

## Why

`integrate` holds the four jobs of 2026-10-05 (#33 platoon, #34 ground balls, #35 fouls and chases, #36 men on base),
the current rules (bb_game v1.6) and one refit of the chain. The ground balls are fixed by measured physics, but the
field layer's other constants were fitted around the old, unphysical ball, and now overshoot (`int2`, seeds 3 / 11 / 29):

| | model | league |
|---|---|---|
| singles, share of balls in play | .172 | .208 |
| doubles a team-game | 1.92 / 1.92 / 1.92 | 1.59 |
| triples a team-game | 0.28 / 0.36 / 0.27 | 0.13 |
| double plays a team-game | 0.94 / 0.98 / 0.90 | 0.75 |
| BABIP | .269 / .273 / .269 | .291 |
| liners / flies in play that fell for hits (seed 3, #34) | .57 / .085 | .68 / .12 |

The ground-ball section attributes each cost (its "The costs, and where each comes from"):

1. **Liners and flies caught too often:** the quicker first step (react 0.20 s, 5.0 m/s^2) fits Statcast's first jump
   window but over-reaches at 2-3 s. No single acceleration serves a 1.3-s ground ball and a 4-s fly (hypothesis FM).
2. **Triples doubled:** hard balls into the gaps now reach the wall. The outfielder's intercept takes him to the wall
   rather than across, and the sends to third (`SAFETY_3`) were fitted to the old ball.
3. **Double plays up:** the ball reaches the infielder 0.5 s sooner, while `PIVOT` and the forced runner's break
   (`V_CONTACT`) were fitted around the old ball.

## What to do, in order

### 1. The fielder's motion (FM)

**Measure the league's catch rate on liners and flies,** by hang time and by how far the nearest fielder had to go.
Use the hit coordinates, and the average spots from `statcast/infield_positioning.py` (Savant's fielder positioning,
outfield included if available). Measure the model the same way.

**Then build a motion profile that fits Statcast's three jump windows and the in-play speed,** and the league's catch
rate by hang time, together. The ground-ball section's variant H is a start, but it let deep flies fall and rolling
balls run to the wall.

### 2. The outfielder's cut-off of a rolling ball

Measure where the league's outfielders field balls that get through (distance, by exit speed and direction), against
the model's, and fix the route if it is wrong.

### 3. Refit the decisions fitted on the old ball

Refit `SAFETY_3`, `V_CONTACT` and `PIVOT` with the men-on-base job's own measurements and scripts
(`statcast/men_on_base.py`, `headless/runs_check.js`, `headless/xbt_check.js`), on the new ball.

### 4. Infield hits (IH), if there is time

The model makes .004 infield hits per ground ball against the league's .061, because the throw beats the batter by
over a second on routine plays. Measure first, as the ground-ball section lists: the infielder's exchange, the throw
speed on routine plays, and the share of reached balls knocked down.

After each step run the chain, the suite, `runs_check.js`, `xbt_check.js` and `headless/ground_check.js`.

## Sharing the Mac

The integration session is fitting players' traits for the playoff review at the same time. Run at most one suite or
chain at a time.

## Hand-back

- Each step: what was measured (league and model), what was built, and its line against `int2` on all three seeds.
- What failed, and what is left.

Write it up in `docs/sections/2026-10-06_field-followup.md`, and open one PR into `integrate`. Never merge.
