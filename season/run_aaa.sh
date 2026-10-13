#!/bin/bash
# run_aaa.sh: the season replay again with Triple-A priors for men with no major-league data in a fold's window
# (season/aaa_fold.py) and the hitter fit's limits read from the engine (review/fit_hitters.py v0.2), in worktrees hist26A3
# and hist26B3. Each fold's major-league pitchers keep their fits (hist26A, hist26B: their data did not change); its
# Triple-A pitchers are fitted (review/fit_pitchers.js v0.2, ids file; no mishit fit, so theirs stays the league's); then
# every hitter (history/fit_through.py on the fold); then every game of the replayed half 100 times.
# run_aaa.sh v0.1 2026-10-13
R=~/bsim-wt/review
cd $R && python3 season/split_days.py 2025,h1,h2 --aaa || exit 1
for F in A B; do
  W=~/bsim-wt/hist26${F}3; S=~/bsim-wt/hist26$F
  echo "=== fold $F: Triple-A priors $(date +%H:%M)"
  cd $R && python3 season/aaa_fold.py $F || exit 2
  [ -d $W ] || git -C $R worktree add -q $W -b season-26${F}3 HEAD
  mkdir -p $W/diag_out/replays; cp $R/diag_out/emu.jsonl $W/diag_out/
  cd $R && python3 season/view.py season/fold${F}_aaa $W || exit 3
  cp $S/review/pitchers_fit.json $W/review/pitchers_fit.json
  python3 -c "import json; json.dump(json.load(open('$R/season/fold${F}_aaa/aaa.json'))['substitutedIds']['pitching'], open('$W/diag_out/aaa_pitchers.json', 'w'))"
  echo "=== fold $F: Triple-A pitchers $(date +%H:%M)"
  cd $W && for p in $(seq 0 13); do tools/diag/run.sh bb_engine.js review/players.js review/fit_pitchers.js -- 1500 5 "" $p 14 diag_out/aaa_pitchers.json > diag_out/pfit_aaa_$p.json 2> diag_out/pfit_aaa_$p.err & done; wait
  python3 - <<'PY' || exit 4
import json, glob
F = json.load(open('review/pitchers_fit.json')); n = 0
for f in sorted(glob.glob('diag_out/pfit_aaa_[0-9]*.json')):
    A = json.load(open(f)); n += len(A['pitchers'])
    for k, v in A['pitchers'].items(): F['pitchers'][k] = dict(v, level='AAA')
json.dump(F, open('review/pitchers_fit.json', 'w'), indent=1)
print('Triple-A pitchers fitted:', n)
PY
  echo "=== fold $F: hitters $(date +%H:%M)"
  cd $W && HISTDATA=$R/season/fold${F}_aaa FIT_PARTS=14 python3 $R/history/fit_through.py 2026 4 1500 2>&1 | grep -v "R2 \|Warn"
  echo "=== fold $F: replays $(date +%H:%M)"
  cd $R && season/replay_fold.sh season/fold${F}_aaa $W 100 14
done
echo "=== all done $(date +%H:%M)"
