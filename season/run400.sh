#!/bin/bash
# run400.sh: the current model (run 4: Triple-A priors for thin and missing data, the home hitters' edge) replayed 400
# times a game (Joe, 2026-10-13: at 100, two runs' game shares differed by replay noise alone, sd 0.07, enough to move
# Brier 0.003 and calibration 0.2): both replayed halves first (the season scores), then the training halves in sample
# (the coaching term). Folders diag_out/replays_home400 and replays_in_home400 in hist26A4 and hist26B4.
R=~/bsim-wt/review
until ! pgrep -f "[q]ueue_after_refit.sh" > /dev/null; do sleep 20; done
for F in A B; do echo "=== fold $F, 400 a game $(date +%H:%M)"; cd $R && REPLAYS=diag_out/replays_home400 season/replay_fold.sh season/fold${F}_aaa ~/bsim-wt/hist26${F}4 400 14; done
cd $R && python3 season/standings.py --run 4 --sub replays_home400 2>&1 | tail -16
for F in A B; do O=$([ $F = A ] && echo B || echo A); echo "=== fold $F in sample, 400 a game $(date +%H:%M)"; cd $R && REPLAYS=diag_out/replays_in_home400 season/replay_fold.sh season/fold${O}_aaa ~/bsim-wt/hist26${F}4 400 14; done
cd $R && python3 season/coaching.py 4 _home400 2>&1 | head -12
echo "=== done $(date +%H:%M)"
