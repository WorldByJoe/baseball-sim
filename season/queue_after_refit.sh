#!/bin/bash
# queue_after_refit.sh: after history/refit_pitchers.sh: fold A's in-sample replays with the home edge (deferred so the
# season scores came first), the coaching term on the home-edge replays, and the live LCS and World Series forecast again
# with the refitted pitchers and the home edge, from the series specs as they stood before Game 1 (git a6665ee), not
# today's (predict_next.py has moved them to the LCS's lineups).
R=~/bsim-wt/review
until ! pgrep -f "[r]efit_pitchers.sh" > /dev/null; do sleep 20; done
echo "=== fold A in-sample with the home edge $(date +%H:%M)"
cd $R && REPLAYS=diag_out/replays_in_home season/replay_fold.sh season/foldB_aaa ~/bsim-wt/hist26A4 100 14
cd $R && python3 season/coaching.py 4 _home 2>&1 | head -12
echo "=== the LCS and World Series forecast $(date +%H:%M)"
mkdir -p review/series_pre diag_out/series_cmdbug
for sp in ALCS ALCS_CLE NLCS WS_MIL_TB WS_LAD_TB WS_MIL_CLE WS_LAD_CLE WS_MIL_CWS WS_LAD_CWS; do
  git show a6665ee:review/series/$sp.json > review/series_pre/$sp.json 2>/dev/null || continue
  mv diag_out/series/${sp}_* diag_out/series_cmdbug/ 2>/dev/null
  for p in 0 1 2 3; do tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/series_sim.js -- review/series_pre/$sp.json 2000 11 $p 4 1.77 > diag_out/series/${sp}_$p.jsonl 2> diag_out/series/${sp}_$p.err & done
  wait
done
cp review/series_forecast.json diag_out/series_cmdbug/series_forecast.json
python3 review/series_summary.py | tail -12
echo "=== done $(date +%H:%M)"
