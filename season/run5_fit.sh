#!/bin/bash
# run5_fit.sh: run 5's worktrees (hist26A5, hist26B5) on the engine-dev branch (the 2026 carry fit, the send and visitor
# knobs) with run 4's data (Triple-A for thin and missing seasons) and pitchers' fits; every hitter refitted through the
# regenerated emulator (review/emu_v2.jsonl from engine-dev).
R=~/bsim-wt/review
for F in A B; do
  W=~/bsim-wt/hist26${F}5
  [ -d $W ] || git -C $R worktree add -q $W -b season-26${F}5 engine-dev
  mkdir -p $W/diag_out; cp $W/review/emu_v2.jsonl $W/diag_out/emu.jsonl
  cd $R && python3 season/view.py season/fold${F}_aaa $W || exit 2
  cp ~/bsim-wt/hist26${F}4/review/pitchers_fit.json $W/review/pitchers_fit.json
  cp $R/review/home_edge.json $W/review/home_edge.json
  echo "=== fold $F hitters $(date +%H:%M)"
  cd $W && HISTDATA=$R/season/fold${F}_aaa FIT_PARTS=10 python3 $R/history/fit_through.py 2026 4 1500 2>&1 | grep -v "R2 \|Warn\|refinement"
done
echo "=== done $(date +%H:%M)"
