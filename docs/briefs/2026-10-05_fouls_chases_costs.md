# Brief: fouls and far chases without their costs; reaching contact · 2026-10-05

For a local Opus session on Joe's Mac, branch `fouls-chases-costs`, working copy
`/Users/joevonfischer/bsim-wt/fouls-chases-costs`. Read `docs/briefs/2026-10-05_parallel_rules.md` first: it sets where
you work, how to run things and the rules. Then read:

- PR #31's description in full (`gh pr view 31`);
- the sections it added to CALIBRATION.md on `origin/cloud-fouls-chases`
  (`git show origin/cloud-fouls-chases:CALIBRATION.md`);
- its brief (`git show origin/cloud-fouls-chases:docs/briefs/2026-10-04_fouls_and_chases.md`).

## Why

The strikeouts and the walks are the model's biggest misses that show every game. Baseline `base_dh`, with the
designated hitter for both sides:

| | model (seeds 3 / 11 / 29) | league |
|---|---|---|
| K% | 19.5 / 19.1 / 18.7 | 22.2 |
| BB% | 8.6 / 9.5 / 9.4 | 8.4 |
| fastball swings fouled | about .32 | .45 |
| breaking balls chased far outside | about .229 | .283 |

The cloud session on #31 found both mechanisms and built them, but neither passed the suite:

- **v3.2, the last look corrects a miss** (`LOOK_GAIN` 1.3, undercut 1.0, `VERT_MISS` 0.09, scatter x1.7, `SWING_R`
  0.82, pullBias -0.4). Fastball fouls rose to .39, but BABIP fell to .242: the contact moved from over the ball to
  under it, and the model's under-the-ball contact came down fair as pop-ups and short flies, where the league's goes
  back foul. Its next suspect was **FL**, the landing of the fold: the league's pop-ups and grazes by spray, exit speed
  and fair-or-foul in the same band of launch angle minus attack angle, against the model's; and the collision's
  tangential velocity on a graze (contact struck square vertically was also fouled by spray .31 against .21).
- **v3.3, the break still to come** (`DEC_UNSEEN` 0.5). Far chases rose, but strikeouts overshot by two points and runs
  collapsed. The chased pitches were missed less than the league's (.58/.70 against .78/.91: reaching contact still too
  good), and the two-strike swing curve was too flat. Its next suspect was **KB**: the picture sharpens with two
  strikes (a later commit point when protecting the plate, `COMMIT_S` by count), so more of the break has shown by the
  decision.

## What to do, in order

### 1. FL: where folded contact lands

Carry #31's v3.2 mechanism over to your branch by hand (do not merge `cloud-fouls-chases`; it sits on the code from
before the bug audit and the DH fix). Measure the league's and the model's contact under and over the ball as #31
describes, and find the measured mechanism that sends the league's grazes foul. Build it, then run the chain and the
suite. The aim is v3.2's fouls without its BABIP cost.

### 2. KB: the two-strike picture

Carry over v3.3's mechanism (`DEC_UNSEEN`) and test KB: the commit point by count, measured from the league's swing
curves by count (`statcast/swing_count_kind_2025.js`; `tools/fit_swing_policy.js` v0.5 fits to count x pitch kind).
The aim is the league's far chases without the strikeout overshoot.

### 3. RE's second half: the contact's quality when reaching

Bat speed already falls with reach (`BAT_LOC`, engine v3.0), but reaching contact is still hit too hard:

| fastballs off the plate | model | league |
|---|---|---|
| 4-8 in outside | 80.5 mph | 72.6 |
| more than 8 in outside | 75.3 mph | 58.4 |

Test whether reaching also costs the contact's quality (the sweet spot found less often, more glancing contact),
measured from the league's exit speed and launch spread by location.

**Judge every step on the whole suite.** Strikeouts, walks, BABIP and runs move together here; #31's results show how
fixing one breaks another.

## Working beside the platoon job

The `platoon` session may change how the batter reads a pitch by platoon, also in `bb_engine.js`. Keep your changes to
the contact, the last look and the swing decision's timing; the integration combines the branches and reruns the chain
once.

## Hand-back

For each step: what was measured, what was built, its line against the baseline (all three seeds), what failed, and
what is left.

Write it up in `docs/sections/2026-10-05_fouls-chases-costs.md`, and open one PR into `dh-everywhere`. Never merge.
