#!/bin/bash
# queue_fix4.sh: after run_aaa4.sh, the batting pitchers' population hitting traits in fold B's worktree too
# (season/patch_hitters.py), the in-sample games that failed for want of them replayed, then the home-edge calibration.
R=~/bsim-wt/review
until ! pgrep -f "[r]un_aaa4.sh" > /dev/null; do sleep 20; done
cd ~/bsim-wt/hist26B4 && python3 $R/season/patch_hitters.py 2>&1 | grep -v "R2 "
for F in A B; do
  W=~/bsim-wt/hist26${F}4; O=$([ $F = A ] && echo B || echo A)
  cd $W && for f in $(grep -l Exception diag_out/replays_in/*.jsonl); do rm -f $f; done
  cd $R && REPLAYS=diag_out/replays_in season/replay_fold.sh season/fold${O}_aaa $W 100 14
done
cd $R
for cfg in "0.9 1 1" "1 0.9 1" "1 1 0.9" "0.95 0.95 0.95"; do
  echo $cfg | xargs -n 3 sh -c 'tools/diag/run.sh bb_engine.js review/home_calib.js -- 20000 1 $0 $1 $2 > diag_out/hc_$0_$1_$2.json 2> diag_out/hc.err' &
done; wait
cat diag_out/hc_*.json
echo "=== done $(date +%H:%M)"
