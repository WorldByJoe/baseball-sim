#!/bin/bash
# run6_2025.sh · v0.1 · 2026-10-14: the baseline for the 2025 test: run 6's engine and fits (engine-dev 4d160d0, its emulator
# review/emu_v3.jsonl, walks with intentional walks, no call-up prior, no fielders' own range, no pitcher draws) on the same
# 2025 folds as run 7 (season/y2025/foldX_aaa, built by season/run7_2025.sh), pitchers refitted on that engine; scored
# against run 7 with standings --vs.
R=~/bsim-wt/review; E=~/bsim-wt/engdev; J=${JOBS:-6}; export SEASON_Y=2025; B=$R/season/y2025
while [ ! -s $B/foldB_7/players_measured.json ] || pgrep -f "[s]eason/face_measure.py" > /dev/null; do sleep 60; done
for F in A B; do
  W=~/bsim-wt/hist25${F}6
  [ -d $W ] || git -C $R worktree add -q $W -b season-25${F}6 4d160d0
  mkdir -p $W/diag_out; cp $E/review/emu_v3.jsonl $W/diag_out/emu.jsonl
  cd $R && python3 season/view.py $B/fold${F}_aaa $W || exit 3
  echo "=== 2025 run 6 fold $F hitters $(date +%H:%M)"
  cd $W && HISTDATA=$B/fold${F}_aaa FIT_PARTS=$J python3 $R/history/fit_through.py 2026 4 1500 2>&1 | grep -v "Warn\|refinement\|R2 "
  echo "=== 2025 run 6 fold $F pitchers $(date +%H:%M)"
  for p in $(seq 0 $((J - 1))); do tools/diag/run.sh bb_engine.js review/players.js review/fit_pitchers.js -- 1500 5 "" $p $J > diag_out/pfit_$p.json 2> diag_out/pfit_$p.err & done; wait
  python3 -c "
import json, glob
out = None
for f in sorted(glob.glob('diag_out/pfit_[0-9]*.json')):
    A = json.load(open(f))
    if out is None: out = A
    else: out['pitchers'].update(A['pitchers'])
json.dump(out, open('review/pitchers_fit.json', 'w'), indent=1); print('pitchers fitted:', len(out['pitchers']))" || exit 7
  python3 $R/history/fit_mishit_view.py 2>&1 | tail -1
  python3 $R/season/patch_hitters.py 2>&1 | grep -v "R2 " | cut -c1-120
done
for F in A B; do echo "=== 2025 run 6 fold $F, 400 a game $(date +%H:%M)"; cd $R && MODE_EXTRA= season/replay_fold.sh $B/fold${F}_aaa ~/bsim-wt/hist25${F}6 400 $J; done
while pgrep -f "[r]un7_2025.sh" > /dev/null; do sleep 60; done
cd $R && python3 season/standings.py --run 6 2>&1 | tail -18; python3 season/standings.py --run 7 --vs 6 2>&1 | tail -4
echo "=== done $(date +%H:%M)"
