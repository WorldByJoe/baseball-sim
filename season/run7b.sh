#!/bin/bash
# run7b.sh · v0.1 · 2026-10-14: run 7 from its replays on (run7.sh was stopped after the hitter fits to add the pitchers'
# uncertainty, review/pitcher_sd.py, replay mode 'pdraw'): fold B's patch, 400 replays a game in mode ghost+fielding+pdraw,
# the scores against run 6 and the audit.
R=~/bsim-wt/review; J=${JOBS:-10}
while pgrep -f "[h]istory/fit_through.py 2026" > /dev/null; do sleep 20; done
cd ~/bsim-wt/hist26B7 && python3 $R/season/patch_hitters.py 2>&1 | grep -v "R2 " | cut -c1-120
for F in A B; do echo "=== run 7 fold $F, 400 a game $(date +%H:%M)"; cd $R && MODE_EXTRA=+fielding+pdraw season/replay_fold.sh season/fold${F}_7 ~/bsim-wt/hist26${F}7 400 $J; done
cd $R && python3 season/standings.py --run 7 --vs 6 2>&1 | tail -18
echo "=== audit $(date +%H:%M)"
$R/season/audit_run.sh ~/bsim-wt/hist26A7 run7 fielding+pdraw $J > /dev/null; grep -v "R2 " $R/season/runs_audit_run7.txt
echo "=== done $(date +%H:%M)"
