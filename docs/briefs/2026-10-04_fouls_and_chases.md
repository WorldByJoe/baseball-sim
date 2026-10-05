# Brief: the missing fouls and the far chases · 2026-10-04

For a cloud Claude Code session (Fable is worth it here: the fouls need deep analysis) on `WorldByJoe/baseball-sim`.
Written by the local session that has been building the engine. Joe von Fischer owns the repo and asked for this
("we need to get our model working before moving on to the playoff project"). Read the whole brief, then
`CALIBRATION.md` from the section "U and G, first measurements" to the end.

## Where things stand

- The engine is `bb_engine.js` v3.1, on branch `breaking-reads` (PR #29, stacked on #28 and #27).
- This branch, `cloud-fouls-chases`, adds the diagnostic scripts in `tools/diag/` and this brief.
- Philosophy, which Joe holds firmly:
  - Players are physical traits, and statistics must EMERGE.
  - Never tune an outcome directly. A gap means a missing mechanism.
  - A constant is either measured, fitted to its own measurement, or fitted to outcomes ("class O", provisional,
    labelled so).
  - Judge every change on the whole suite at all three seeds, never on one metric.
  - "Believable" beats matching MLB, since MLB is selected.
- The two biggest gaps left, as ranked with Joe, are the ones below. Both feed strikeouts and walks, which matter
  most for the playoff forecasts that come next.

The v3.1 line, as measured on the Mac (seeds 3, 11, 29, 200 games each), against 2025 MLB:

| | model | league |
|---|---|---|
| K% / BB% | 19.2-19.6 / 8.9-9.5 | 22.2 / 8.4 |
| AVG / OBP / SLG | .231-.234 / .309-.311 / .389-.405 | .245 / .315 / .404 |
| runs per team-game | 3.97-4.11 | 4.45 |
| fastball swings fouled | .322 | .453 |
| chase (swings at pitches outside the zone) | .229 | .283 |
| pitches per team-game | 138 | 146 |

## Setup

1. `git checkout cloud-fouls-chases`. You need Node and Python 3 (numpy helps). Every engine script runs through
   `tools/diag/run.sh` (jsc on the Mac, `node headless/run_node.js` elsewhere), for example
   `tools/diag/run.sh bb_engine.js tools/diag/curve.js`.
2. **The league's pitch-level data:** `python3 statcast/fetch_pitches.py` pulls the 42 days of 2025 into
   `statcast/raw/pitches/2025/` (gitignored, about 200k pitches, a 2 s pause between days). The `*_league.py`
   scripts and `statcast/*.py` read it. If Baseball Savant is unreachable from the sandbox, say so in the PR and
   work only from the committed `statcast/*_2025.js` tables.
3. **The baseline on your machine:** `tools/diag/suite.sh diag_out/v31`. Seeds are not comparable across machines
   (Node and jsc can differ in the last bits of Math), so every before/after comparison uses your own baseline.
   Then run `python3 tools/diag/compare.py diag_out/v31 diag_out/<new>`.
4. **After ANY engine change:** run `tools/diag/chain.sh diag_out/chain_<name>` (it refits the swing policy, the
   scouts' values and the player pool, pasting each into `bb_engine.js`), then the suite.
5. **For experiments, use scratch copies of the engine** with a knob read from a global, e.g.
   `var X = typeof MY_X !== 'undefined' ? MY_X : 1;`. Pass a one-line settings file before the engine:
   `run.sh set.js eng_copy.js script.js`. Build the real change only once it has earned it.

## Problem 1: the missing fouls (first)

**What is known** (the scripts reproduce each line):

- **Per fastball swing** the league fouled .451 (.377 tracked, .046 untracked, .028 tips) and the model .322.
  Whiffs and contact per swing match, so the model puts fastballs IN PLAY where the league fouls them off. Two-strike
  at-bats end early, which is why K% is short.
- **The league's typical fastball foul** (`foul_evla_league.py` against `foul_evla_model.js`):
  - it leaves at 70-85 mph (64% of fouls; the model 32%) and at 30-70 deg (54%);
  - the model's fouls are slower (36% at 50-70 mph against 14%), harder at the top (12% at 95+ against 6%) and
    flatter;
  - the model sends 30-70 deg contact at 75-90 mph forward and fair.
- **Where the gap sits by vertical miss** (`fbfoul_league.py` / `fbfoul_model.js`; launch angle minus attack angle,
  "vm"):
  - the league's tracked fastball contact is struck 25+ deg under the ball's middle .457 of the time, the model's
    .311;
  - within bands the model also fouls less: 5-25 deg .24 against .345, 25-40 deg .43 against .60;
  - late (deep) contact fouls .669 in the league, .432 in the model.
- **By the bat's horizontal direction** (`dirfoul_league.py` / `dirfoul_model.js`; Statcast attack_direction, sign
  flipped so + = pull):
  - with the bat toward the opposite field (-15 to -30 deg) the league makes .204 of contact and fouls .646; the
    model .114 and .498;
  - near square (-15 to +15) the league fouls .40-.45 and the model .32-.35;
  - about a third of the gap is the share shift (real hitters meet fastballs later) and two-thirds the foul rate at
    the same bat direction.
- **At the same launch angle**, the league's fouls come with the bat about 13 deg toward the opposite field
  (`foul_dir_*.py/js`, 10-50 deg launch).
- **Ruled out:**
  - the slice of under-contact on the tilted barrel. With LANDING direction, the model's residual spray by vm band
    (+18, +14, +2, -10, -22) is close to the league's (+21, +16, +3, -11, -29) (`slice_*`, `slice_model.js -- 1 1`);
  - the ball's direction against the bat on balls in play (model slope 1.5-1.7, the league's 1.5);
  - more aim under the ball with less random up-down scatter: fouls reached only .37, with too many whiffs.
- **The collision** (`curve.js`: a fixed fastball, a 72-mph square swing, the barrel's offset D stepped in inches):
  - launch minus attack rises about 23 deg per inch of D and peaks near 56 deg at D = 2.1 in, then turns backward;
  - glancing hits spin 9,000-12,000 rpm.
- **The published grip at game speed.** Nathan, Cantakos, Kesman, Mathew & Lukash, Procedia Engineering 34, 182
  (2012): balls at 85-120 mph on a clamped wooden cylinder gripped and over-spun below about 40 deg of incidence
  (e_x = 0.30) and slid above it with friction 0.15. The engine uses friction 0.5 and e_T = 0, the low-speed values
  of Cross & Nathan, Am. J. Phys. 74, 896 (2006).
  - With friction 0.15 and e_x 0.30 less the swung bat's tangential recoil (an apparent 0.10), glancing spin fell to
    3,500-5,300 rpm, as the 2012 paper's game-condition curve shows.
  - But fouls moved only .324 to .330, and glancing contact kept too much speed (squared-up in the 40-60 deg band
    .32 against .17).
  - So it needs a partner, most likely the normal restitution at low normal speed (`E_COR`, `qAt`). The PDF is at
    `https://baseball.physics.illinois.edu/ProcediaEngineering34Spin.pdf`.

**Hypotheses, in the order the local session would test them:**

1. **The fastball's up-down offset sits too low and too wide.** The league meets fastballs under the ball far more
   often, yet misses no more and by less. Suspects:
   - the batter's picture of a fastball's ride (THE PRIOR'S PULL, `PRIOR_S`, and the league-shape reference in
     `pictured()`), which would make riding fastballs met under;
   - the timing-to-height coupling of late swings;
   - the offset's distribution shape (skewed rather than normal).
2. **Glancing-under contact should go back or sideways at moderate speed:** the game-speed grip plus the normal
   restitution at low normal speed, together. Test against `foul_evla_*`, the vm-band foul rates and the contact
   score's squared-up panel.
3. **Real hitters are later on fastballs** (more contact with the bat toward the opposite field). The league's mean
   bat direction on fastball contact is about 4 deg further toward the opposite field than the model's. Check the
   mean timing on fastballs against the league's contact depth by kind (fastballs met 3.4 in deeper than each
   batter's mean, breaking balls 4.9 in further out).

**Acceptance:**

- fastball fouls per swing of .40 or more (league .45);
- fastball whiffs .16-.19 (league .174);
- K% higher than v3.1 and walks no worse;
- the contact score (`contact_score.js`, 90 targets) no worse than your v3.1 baseline;
- AVG and runs no worse.

If a mechanism moves fouls but breaks two other things, record it and do not build it.

## Problem 2: the far chases (second)

**What is known:**

- **Swing rates by distance outside the zone.** Breaking balls 6-9, 9-12 and 12+ in outside are swung at .15, .08
  and .03 against the league's .28, .21 and .09; changeups .17, .08 and .02 against .28, .15 and .05. Fastballs now
  match.
- **The cost:** overall chase .229 against .283, and walks 8.9-9.5% against 8.4.
- **In the league, breaking balls are chased MORE than fastballs in every count**
  (`statcast/swing_count_kind_2025.js`; two strikes, 6-9 in out: .39 against .20).
- **Breaking balls by read** (`brread.js`):
  - shares: picked up at the commit point 62%, late 21%, fooled 2.5%, sat on it 14%;
  - swing rates from the heart to 8+ in out: picked up .79 .57 .35 .16 .04; late .36 .41 .43 .34 .17; fooled .63 .51
    .40 .32 .19.
- **What v3.1 did:**
  - the swing policy fitted by count x kind (`tools/fit_swing_policy.js` v0.5, which keeps off >= on);
  - DIR_READ_DEC = 0 (a batter who has not picked a pitch up decides on where it is, on the curve he expected);
  - TUNNEL_SEP = 0.5 (class O).
  - Lowering TUNNEL_SEP to 0.35 or 0.25 raised strikeouts (21.7%, 23.3%) but breaking-ball whiffs to .375-.431
    against .310. So more deception alone is not the answer.
- **Candidates to test:**
  - the eye's scatter at the commit point (`eyeSD x tp`) and how it judges a pitch that is diving;
  - what a LATE pickup does about a pitch far outside;
  - the two-strike "protect" approach widening what he swings at;
  - whether a fooled batter's judged location for a breaking ball (`baseDec`) should keep more of the fastball's
    path.

**Acceptance:**

- chase .26 or more (league .283);
- walks 8.8% or less;
- breaking-ball whiffs no more than .34;
- K% no lower;
- swings by kind no worse (`fit_swing_policy` prints the rms; v3.1 .058).

## Rules

- **Branches.** Work on `cloud-fouls-chases`. One engine version per mechanism (v3.2, v3.3...), each committed with
  the chain and suite run. Open ONE pull request into `breaking-reads`, or two stacked if the problems land
  separately. **Never merge.**
- **Code headers:**
  - every file you change keeps `name · vX.Y · date` and a CHANGED list of at most five entries, the newest first;
  - delete old code rather than commenting it out;
  - keep comments true to the code;
  - every constant's comment says where its value came from (measured / fitted to its own measurement / class O).
- **Write the results up.** Add a `CALIBRATION.md` section per problem, in the style of the existing ones:
  - what was run;
  - what the league showed;
  - what was built or rejected, with numbers;
  - a before/after table;
  - and update the open-mysteries list and the hypothesis table at the end.
  Results go in the past tense, scoped to your runs.
- **Also update:** `python3 tools/traits_doc.py` regenerates `TRAITS.md`, and `docs/trait_map.html` gets the new
  constants in the same style (the local session will publish it). Check that the trait map still parses and that
  `N.length` equals the number of node rows: a missing comma once blanked it.
- **Attribution.** End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (or the
  model you are), and the PR description with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Hand-back.** The PR description gives:
  - each problem's verdict;
  - the new line against v3.1 (your baseline);
  - what was tried and rejected;
  - the next suspect, if a problem is still open.
- **Write in plain language:** no shorthand without saying what it means.
