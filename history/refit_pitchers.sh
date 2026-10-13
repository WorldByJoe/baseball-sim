#!/bin/bash
# refit_pitchers.sh: every October's pitchers refitted from scratch (Joe, 2026-10-13): review/fit_pitchers.js v0.3 with no
# earlier fit in place (v0.2 had fitted the command scale on top of the earlier fit's), then their mishit
# (history/fit_mishit_view.py, as build_october.sh does), then every game replayed in the four settings with the home
# hitters' edge; the regression and the series forecasts again. The fits and replays before are kept in diag_out/cmdbug/.
# refit_pitchers.sh v0.1 2026-10-13
R=~/bsim-wt/review; HIST=$R/history
until grep -q "both     2024" $HIST/logit_all_home.txt 2>/dev/null; do sleep 20; done
pkill -f "[r]erun_home.sh"; pkill -f "[r]eplay_fold.sh"; pkill -f "xargs -P 14 -n 1 .*replay_one"; sleep 90   # the season part waits; games under way finish
echo "=== season part paused $(date +%H:%M)"
for S in 2026 2025 2024; do
  W=~/bsim-wt/hist$S; cd $W || exit 1
  cp $R/review/fit_pitchers.js review/fit_pitchers.js; cp $R/review/series_sim.js review/series_sim.js
  mkdir -p diag_out/cmdbug; [ -e diag_out/cmdbug/pitchers_fit.json ] || mv review/pitchers_fit.json diag_out/cmdbug/pitchers_fit.json; rm -f review/pitchers_fit.json
  echo "=== $S pitchers $(date +%H:%M)"
  for p in $(seq 0 13); do tools/diag/run.sh bb_engine.js review/players.js review/fit_pitchers.js -- 1500 5 "" $p 14 > diag_out/pfit_$p.json 2> diag_out/pfit_$p.err & done; wait
  python3 - <<'PY' || exit 3
import json, glob
out = None
for f in sorted(glob.glob('diag_out/pfit_[0-9]*.json')):
    A = json.load(open(f))
    if out is None: out = A
    else: out['pitchers'].update(A['pitchers'])
json.dump(out, open('review/pitchers_fit.json', 'w'), indent=1)
print('pitchers fitted:', len(out['pitchers']))
PY
  python3 $HIST/fit_mishit_view.py | tail -2 || exit 4
  for D in replays replays_pitched replays_errors replays_both; do [ -d diag_out/cmdbug/$D ] || mv diag_out/$D diag_out/cmdbug/$D; mkdir -p diag_out/$D; done
  PKS=$(python3 -c "import json; print(' '.join(str(g['pk']) for g in json.load(open('$HIST/participants_$S.json'))['games']))")
  echo "=== $S replays $(date +%H:%M)"
  for PK in $PKS; do for M in season pitched errors both; do echo "$PK $M"; done; done | xargs -P 14 -L 1 bash -c '
    PK=$0; M=$1; case $M in season) D=diag_out/replays; A="";; pitched) D=diag_out/replays_pitched; A="pitched";; errors) D=diag_out/replays_errors; A="errors 1.77";; both) D=diag_out/replays_both; A="pitched+errors 1.77";; esac
    [ -s $D/$PK.jsonl ] && [ $(grep -c "^{" $D/$PK.jsonl) -ge 1000 ] && exit 0
    tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $PK 1000 7 0 1 $A > $D/$PK.jsonl 2> $D/$PK.err'
  for D in replays replays_pitched replays_errors replays_both; do echo "$S $D: $(ls diag_out/$D/*.jsonl | wc -l) games, $(cat diag_out/$D/*.jsonl | grep -c '^{') replays, $(grep -l Exception diag_out/$D/*.jsonl | wc -l) with an exception"; done
done
cd $R && python3 history/logit_all.py --refit > history/logit_all_refit.txt 2>&1; grep -v points history/logit_all_refit.txt
for S in 2024 2025 2026; do W=~/bsim-wt/hist$S
  [ -d $W/diag_out/cmdbug/series_fc ] || mv $W/diag_out/series_fc $W/diag_out/cmdbug/series_fc
  echo "=== series $S $(date +%H:%M)"; $HIST/series_run.sh $S $W 1000 1.77 | tail -1
done
cd $R && python3 history/series_picks.py 2>&1 | tail -6
echo "=== Octobers done $(date +%H:%M)"
# the season part, resumed (rerun_home.sh's second half)
for F in A B; do
  W=~/bsim-wt/hist26${F}4; O=$([ $F = A ] && echo B || echo A)
  cp $R/bb_game.js $W/bb_game.js; cp $R/review/replay_game.js $W/review/replay_game.js; cp $R/review/home_edge.json $W/review/home_edge.json
  echo "=== fold $F with the home edge $(date +%H:%M)"
  cd $R && REPLAYS=diag_out/replays_home season/replay_fold.sh season/fold${F}_aaa $W 100 14
  cd $R && REPLAYS=diag_out/replays_in_home season/replay_fold.sh season/fold${O}_aaa $W 100 14
done
cd $R && python3 season/standings.py --run 4 --sub replays_home 2>&1 | tail -16
python3 season/coaching.py 4 _home 2>&1 | head -9
echo "=== all done $(date +%H:%M)"
