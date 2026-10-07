# Brief: ground balls by launch angle · 2026-10-05

For a local Fable session on Joe's Mac, branch `ground-balls`, working copy `/Users/joevonfischer/bsim-wt/ground-balls`.
Read `docs/briefs/2026-10-05_parallel_rules.md` first: it sets where you work, how to run things and the rules.

## Why

**BABIP is .263-.268 in the model against .291 in the league** (baseline `base_dh`). Hits per band of launch angle
were about the league's overall, but not at the low end (CALIBRATION.md, the open mysteries, number 5):

| | model | league |
|---|---|---|
| choppers, -10 to 0 deg: hit rate | .135 | .249 |
| low liners, 0 to 10 deg: hit rate | .538 | .482 |
| line drives, share of balls in play | 20-21% | 24% |

The choppers die and the low liners get through too often. Both happen on the ground, in the first bounce and the
infielder's intercept, so look there first.

## What to do

### 1. Measure the league

From `statcast/raw/pitches/2025/` (42 days; `statcast/swing_geometry.py`'s `load()` reads them; `statcast/bip.py`
shows how balls in play are read). Ground balls and low liners (launch angle -30 to 15 deg):

- hit rate by launch angle (2-deg bands) and exit speed (5-mph bands);
- the same by direction (hit coordinates, home plate at 126.0, 205.0; pull, middle, opposite) and by the infielder
  who fielded it;
- the share that became infield hits, and how often each became an error.

**Note:** 2025 played under the shift ban (two infielders on each side of second base, all four on the dirt). The
model's rules allow shifts, so check where the model puts its infielders before comparing by direction.

### 2. Measure the model the same way

Through `headless/bip_check.js` or a new probe on whole games.

### 3. Follow a ground ball through `bb_field.js`

Find where the choppers die and the low liners get through:

- the first bounce: `BOUNCE_E`, `BOUNCE_KF`, `BOUNCE_C` and their notes (fitted, with E held at 0.45 on dirt);
- a high chopper's hang time;
- the infielder's charge and intercept, and his chance of fielding it cleanly;
- his throw, and the batter's time to first.

### 4. Physics first

Bring in measured physics for a ball bouncing on infield dirt and grass: restitution and friction by impact angle and
speed, and what the ball's topspin or backspin does to the bounce. Cite the papers you use, and read them rather than
trusting a summary (the project once took a friction value from a search summary that the paper did not say). Build
only what is measured, then run the chain and the suite.

**Accept it** if the chopper and low-liner hit rates move toward the league's and BABIP rises, with no costs on the
suite.

## Working beside the men-on-base job

The `men-on-base` session is changing where the infielders stand (holding a runner, double-play depth, the infield in)
and which base they throw to, also in `bb_field.js`. **Keep your changes to the ball:** its flight, its bounces and
the fielder's intercept. Do not change positioning; the integration combines the two branches.

## Hand-back

- The league's and the model's hit rates by launch angle, exit speed and direction.
- Where in the play the difference arises, with the evidence.
- The physics brought in, with citations.
- What was built, and its line against the baseline (all three seeds).
- What is left.

Write it up in `docs/sections/2026-10-05_ground-balls.md`, and open one PR into `dh-everywhere`. Never merge.
