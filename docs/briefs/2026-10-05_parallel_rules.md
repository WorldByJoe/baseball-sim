# Rules for the four parallel jobs on Joe's Mac · 2026-10-05

Four sessions work at once on `WorldByJoe/baseball-sim`, each from branch `dh-everywhere` (engine v3.1, the bug
audit's eight fixes from #32, and bb_game v1.4: a game given no rules plays a designated hitter for both sides). A fifth
session (the integration, Opus) reviews and combines them. Read this file, then your own brief, then `CALIBRATION.md`
from "U and G, first measurements" to the end (the mysteries and the hypothesis table are at the end).

| Job | Branch and working copy | Model |
|---|---|---|
| Platoon: why same-side hitters do better | `platoon`, `/Users/joevonfischer/bsim-wt/platoon` | Fable |
| Ground balls by launch angle | `ground-balls`, `/Users/joevonfischer/bsim-wt/ground-balls` | Fable |
| Men on base, tag-ups, sends, throws | `men-on-base`, `/Users/joevonfischer/bsim-wt/men-on-base` | Opus |
| Fouls and far chases without their costs; reaching contact | `fouls-chases-costs`, `/Users/joevonfischer/bsim-wt/fouls-chases-costs` | Opus |

## Where you work

- **Only in your own working copy** (a git worktree already on your branch). Never edit the OneDrive checkout
  (`~/Library/CloudStorage/OneDrive-Colostate/Claude/Baseball sim`) or another job's worktree, and never switch branch.
- **The league's pitch data** (`statcast/raw/pitches/2025/`, 42 days; `statcast/raw/pitches_aaa/`) are links to the
  main checkout's copies. Read them; do not fetch or rewrite them.
- **Generated files** go in `diag_out/` (ignored by git).

## Running things

- Every engine script runs through `tools/diag/run.sh` (JavaScriptCore's jsc on this Mac).
- **The suite:** `tools/diag/suite.sh diag_out/<name>`: three seeds of 200 games, the contact score, discipline, spray,
  batted balls and the probes. Compare two suites with `python3 tools/diag/compare.py BEFORE AFTER`.
- **The baseline is already made:** `/Users/joevonfischer/bsim-wt/dh/diag_out/base_dh` (same code, same machine, so it
  is comparable; seeds are only comparable on one machine). Use it rather than running your own.
- **The refit chain:** `tools/diag/chain.sh diag_out/<name>` after any change to `bb_engine.js`, or to `bb_field.js`
  that changes fielding outcomes. It refits the swing policy, the scouts' values and the player pool, and pastes them
  into `bb_engine.js`. About 15 minutes alone.
- **The Mac is shared** (14 cores, five sessions). Run at most one suite or chain at a time; keep to the suite's seeds
  and sizes; no single run over 2,000 games. Use `pgrep -x jsc | wc -l` to see how busy it is.

## The rules of the model

- **Mechanisms, not knobs.** A change is a mechanism measured from the league (or from published physics), never a
  constant turned toward a target. If a gap turns out to need something not measurable, record it as a hypothesis with
  its numbers.
- **Judge on the whole suite,** all three seeds, the worst seed beside the baseline. If a mechanism moves its target
  but breaks two other things, record it with its costs and do not keep it.
- **If a hypothesis is refuted,** write it up and stop that line. Do not wander into other mysteries.
- **Bugs:** if you find one, fix it in its own commit with a regression test (`headless/plays_check.js` and
  `headless/invariants_check.js` show the pattern).

## Code and write-up

- **Code headers:** every changed file keeps `name · vX.Y · date` and a CHANGED list of at most five entries, newest
  first. Bump the version from what your branch has; the integration renumbers across branches. Delete old code rather
  than commenting it out, and keep comments true to the code.
- **Do not edit the shared write-ups:** `CALIBRATION.md`, `TRAITS.md`, `docs/trait_map.html` (four branches would
  collide). Write yours as `docs/sections/2026-10-05_<branch>.md` in CALIBRATION's style:
  - what was measured, in the league and in the model, with the numbers;
  - what was built, and the line against the baseline (all three seeds);
  - what was tried and failed;
  - proposed changes to the mysteries and hypothesis tables, and to the trait map's constants.
  The integration folds the sections into CALIBRATION.md.
- **Values pasted by the chain:** commit them; the integration reruns the chain once on the combined code.
- **Commits:** one per change, saying what was wrong or missing, the mechanism, and its effect. End each with a
  Co-Authored-By line for the model you are.
- **The PR:** push your branch and open ONE pull request into `dh-everywhere` (`gh pr create --base dh-everywhere`).
  **Never merge anything.** End the PR description with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Writing:** plain language, results in the past tense. Never use the long dash characters (Joe's rule; a hook
  replaces them): use a comma, parentheses or a colon.
