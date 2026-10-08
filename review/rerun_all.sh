#!/bin/bash
# rerun_all.sh: after a refit of the playoff traits, every model output the postseason page shows, rerun: the division
# series replays (three sets), each game called before first pitch (two sets), the next game's prediction, and the LCS
# and World Series forecast (2,000 series each, fielders' own error rates)
cd ~/bsim-wt/review
T0=$(date +%s)
review/run_set.sh diag_out/replays 1000 && review/run_set.sh diag_out/replays_pitched 1000 pitched && review/run_set.sh diag_out/replays_errors 1000 errors 1.77
echo "replays done $(( $(date +%s) - T0 )) s"
review/odds/run_pregame_ds.sh
for mode in season errors; do G=""; [ $mode = errors ] && G=1.77; for p in 0 1 2 3 4 5 6 7; do
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/pregame.js -- 849833 1000 21 $p 8 800048 696146 "Rate Field" - "" $G > diag_out/predict/849832_${mode}_$p.jsonl 2> diag_out/predict/849832_${mode}_$p.err &
done; done; wait
echo "pregame and prediction done $(( $(date +%s) - T0 )) s"
for sp in ALCS NLCS WS_MIL_TB WS_MIL_CWS WS_LAD_TB WS_LAD_CWS; do rm -f diag_out/series/${sp}_*; for p in 0 1 2 3; do
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/series_sim.js -- review/series/$sp.json 2000 11 $p 4 1.77 > diag_out/series/${sp}_$p.jsonl 2> diag_out/series/${sp}_$p.err &
done; done; wait
python3 review/series_summary.py
echo "all done $(( $(date +%s) - T0 )) s"
