#!/bin/bash
# run7_2025.sh · v0.1 · 2026-10-14: run 7's engine and fits on a second season, 2025 (the model review, phase 3: "add the
# 2025 season as folds"). 2025's data in season/y2025, labelled as the 2026 pipeline expects (2025 -> '2026', 2024 ->
# '2025'; SEASON_Y=2025 in fetch_games, split_days, build_folds, view, aaa_fold, standings). Fold A fits on 2024 and 2025's
# first half and replays the second; fold B the reverse. Pitchers fitted afresh (fit_pitchers, fit_mishit_view).
R=~/bsim-wt/review; E=~/bsim-wt/engdev; J=${JOBS:-10}; export SEASON_Y=2025; B=$R/season/y2025
cd $R
echo "=== waiting for the 2024 pull and 2025 feeds $(date +%H:%M)"
while pgrep -f "fetch_pitches.py --dates 2024" > /dev/null || pgrep -f "season/fetch_games.py" > /dev/null; do sleep 60; done
echo "=== Triple-A 2024 $(date +%H:%M)"; python3 statcast/fetch_pitches.py --level AAA --dates 2024-03-29:2024-09-22 2>&1 | tail -2
echo "=== split $(date +%H:%M)"; python3 season/split_days.py 2>&1 | tail -4 || exit 2; python3 season/split_days.py --aaa 2>&1 | tail -4
echo "=== folds $(date +%H:%M)"; python3 season/build_folds.py || exit 3
for F in A B; do python3 season/measure_fold.py $B/fold$F > /dev/null || exit 4; done
for F in A B; do python3 season/aaa_fold.py $F 2>&1 | grep -v "R2 " | tail -6 || exit 5; done
for F in A B; do python3 season/ibb_fold.py $B/fold${F}_aaa $B/fold${F}_7 && python3 season/face_measure.py $B/fold${F}_7; done
FILES="bb_engine.js bb_field.js bb_game.js review/players.js review/replay_game.js review/emulate_hitters.js review/check_hitters.js review/fit_hitters.py review/level_means.json review/field_traits.py review/fit_pitchers.js review/pitcher_sd.py"
for F in A B; do
  W=~/bsim-wt/hist25${F}7
  [ -d $W ] || git -C $R worktree add -q $W -b season-25${F}7 engine-dev
  for f in $FILES; do cp $E/$f $W/$f; done; cp $E/review/home_edge.json $W/review/
  mkdir -p $W/diag_out; cp $E/review/emu_v4.jsonl $W/diag_out/emu.jsonl
  python3 season/view.py $B/fold${F}_7 $W || exit 6
  python3 $W/review/field_traits.py $B/fold${F}_aaa/leaderboards 2025 $W/review/field_traits.json | tail -1
  echo "=== 2025 fold $F hitters $(date +%H:%M)"
  cd $W && CALLUP_LEVEL=3 LEVEL_MEANS=$W/review/level_means.json HISTDATA=$B/fold${F}_7 FIT_PARTS=$J python3 $R/history/fit_through.py 2026 4 1500 2>&1 | grep -v "Warn\|refinement\|R2 "
  echo "=== 2025 fold $F pitchers $(date +%H:%M)"
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
  cp $E/review/pitcher_sd.py review/ && python3 review/pitcher_sd.py
  cd $R
done
for F in A B; do echo "=== 2025 fold $F, 400 a game $(date +%H:%M)"; MODE_EXTRA=+fielding+pdraw season/replay_fold.sh $B/fold${F}_7 ~/bsim-wt/hist25${F}7 400 $J; done
python3 season/standings.py --run 7 2>&1 | tail -18
echo "=== done $(date +%H:%M)"
