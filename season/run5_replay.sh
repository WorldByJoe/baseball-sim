#!/bin/bash
# run5_replay.sh: run 5 (the engine-dev engine: 2026 carry, send-from-first margins, visitors' first step) replayed 400 times
# a game out of sample, scored (standings --run 5), and audited (replay_game mode audit, the second half 4 times) against
# Statcast. run400.sh (run 4 at 400) keeps its out-of-sample half and loses its in-sample half (run 5 replaces it).
R=~/bsim-wt/review; E=~/bsim-wt/engdev
until ! pgrep -f "[r]un5_fit.sh" > /dev/null; do sleep 20; done
for F in A B; do W=~/bsim-wt/hist26${F}5
  cp $E/bb_engine.js $E/bb_field.js $E/bb_game.js $W/; cp $E/review/replay_game.js $E/review/home_edge.json $W/review/
  cd $W && python3 $R/season/patch_hitters.py 2>&1 | grep -v "R2 " | cut -c1-120
done
( L="$HOME/Library/CloudStorage/OneDrive-Colostate/Claude/Baseball sim/season_aaa_logs/run400.log"
  until grep -q "games between two postseason teams" "$L"; do sleep 30; done; sleep 5
  pkill -f "[r]un400.sh"
  for pf in $(pgrep -f "replay_fold.sh season/fold[AB]_aaa .*hist26[AB]4 "); do for x in $(pgrep -P $pf); do pkill -P $x; kill $x; done; kill $pf; done   # run 4's folders only
  echo "run 4 at 400: in-sample half dropped $(date +%H:%M)" ) &
for F in A B; do echo "=== run 5 fold $F, 400 a game $(date +%H:%M)"; cd $R && season/replay_fold.sh season/fold${F}_aaa ~/bsim-wt/hist26${F}5 400 14; done
cd $R && python3 season/standings.py --run 5 2>&1 | tail -16
echo "=== audit $(date +%H:%M)"
W=~/bsim-wt/hist26A5; mkdir -p $W/diag_out/audit; cp ~/bsim-wt/hist26A4/diag_out/audit/pks.txt $W/diag_out/audit/
cd $W && cat diag_out/audit/pks.txt | xargs -P 14 -n 1 sh -c 'tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $0 4 13 0 1 ghost+audit > diag_out/audit/$0.jsonl 2> diag_out/audit/$0.err'
cd $R && python3 -c "
import sys; sys.path.insert(0, 'season'); import runs_audit as RA, os
RA.AUD = os.path.expanduser('~/bsim-wt/hist26A5/diag_out/audit'); RA.HERE = os.path.join(os.getcwd(), 'season'); RA.main()" > season/runs_audit_run5.txt 2>&1; grep -v "R2 " season/runs_audit_run5.txt
echo "=== done $(date +%H:%M)"
