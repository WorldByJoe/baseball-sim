# Brief: men on base, tag-ups, sends and throws · 2026-10-05

For a local Opus session on Joe's Mac, branch `men-on-base`, working copy `/Users/joevonfischer/bsim-wt/men-on-base`.
Read `docs/briefs/2026-10-05_parallel_rules.md` first: it sets where you work, how to run things and the rules. Then read
CALIBRATION.md's "Bug audit" section in full, and PR #32's description (`gh pr view 32`).

## Why

After the bug audit, the model scored .926-.988 of the runs its own events predict (BaseRuns), against the league's
1.01. The bookkeeping is now clean (the invariants check holds over 6,000 games); what is left is play with men on
base. Numbers are from #32 (seed 3, 600 games, under Node):

| | model | league |
|---|---|---|
| BABIP: bases empty / a man on first / a man in scoring position | .261 / .269 / .262 | .280 / .301 / .298 |
| BABIP on the ground: empty / first / scoring position | .233-.239 / .228-.250 / .229-.230 | .237 / .282 / .269 |
| fielder's choices a team-game | .32 | .13 |
| runners forced out a team-game | .89 | .69 |
| a man on third scores on an air out, none out / one out | .30 / .32 | .65 / .62 |
| a man on third scores on a ground out, one out | .38 | .49 |
| sacrifice flies a team-game | .11 | .27 |
| a man on first is out at home on a double, two out | .12 | .03 |
| throwing errors / all errors a team-game | .10 / .36 | .13 / .50 |
| double plays a team-game | .64-.71 | .75 |

## What to do, in order

Run `headless/runs_check.js` and `headless/xbt_check.js` on the untouched branch first, as your baseline for those.

### 1. MO: the infield with men on base

**Measure the league:**

- **Hitting by base state, controlled for who.** Pitchers who allow baserunners are worse, and the middle of the order
  bats more with men on. Compare each batter and each pitcher with himself (within-player splits, or a model with player
  effects), and report how much of the raw gain survives.
- **Ground-ball hit rate by base state, out and direction** (hit coordinates, home plate at 126.0, 205.0). The hole on
  the right side when the first baseman holds a runner; the middle when the infielders play at double-play depth; the
  infield in with a man on third and fewer than two out.
- **Which out the infielders take:** the lead runner or the batter, by where the ball was fielded, how hard it was hit,
  and the runners' and batter's speed.

**Then build it:** where the infielders stand by base-out state (holding the runner, double-play depth, the infield in,
as the manager's call), and the fielder's choice of base, both measured. 2025 played under the shift ban (two
infielders on each side of second, all four on the dirt).

### 2. TU and FO: the tag-up and the send home

**First, read the tag-up code for a logic error.** A man on third scoring on an air out half as often as the league's
is a big gap, and the audit already found one bug in that loop.

Then measure the league's tag-ups: a man on third scoring on an air out, by fly distance (`hit_distance_sc`), hang time,
the fielder (left, centre, right), and outs. Measure the model the same way, and make the runner's decision use the
same read of the catch and the throw as his sends home.

Then refit the margins for going home (`SAFETY_H`, by outs) from the league's sends, now that the second runner is sent
(the two-out double is the case that went wrong).

### 3. T and DP, if there is time

- **T:** a hurried throw's scatter should grow with the hurry, not only with the throw's length (throwing errors .10
  against .13).
- **DP:** the double-play pivot (`PIVOT` 0.35 s, set by hand); measure it from the league if you can.

After each step, run the chain, the suite, `runs_check.js` and `xbt_check.js`, and report the runs/BaseRuns ratio.

## Working beside the other jobs

- The `ground-balls` session is changing the ground ball's flight, bounce and the fielder's intercept in
  `bb_field.js`. Keep your changes to positioning, decisions, throws and the scoring.
- **The league's RE24 table:** the integration session is checking `statcast/runs_league.py`. Its bases loaded, none
  out (2.89 from 170 cases) and first and second, none out (1.65) look high against published tables (about 2.3 and
  1.45). Until that is settled, target the per-event measurements above, not the RE24 table.

## Hand-back

- The league's measurements, raw and controlled for who.
- Each step: what was found, what was built, its line against the baseline (all three seeds), and the runs/BaseRuns
  ratio before and after.
- Any bug fixed, with its test.
- What is left, and the next suspect.

Write it up in `docs/sections/2026-10-05_men-on-base.md`, and open one PR into `dh-everywhere`. Never merge.
