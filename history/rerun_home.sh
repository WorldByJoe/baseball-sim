#!/bin/bash
# rerun_home.sh: the home hitters' edge (bb_game v1.8, review/home_edge.json) in every replay: the three Octobers' games in
# the four settings (the replays without it kept in diag_out/nohome/), then the season replay's run-4 worktrees, the
# replayed half and the training half in sample (diag_out/replays_home, replays_in_home).
# rerun_home.sh v0.1 2026-10-13
R=~/bsim-wt/review; HIST=$R/history
for S in 2026 2025 2024; do
  W=~/bsim-wt/hist$S; cd $W || exit 1
  cp $R/bb_game.js bb_game.js; cp $R/review/replay_game.js review/replay_game.js; cp $R/review/home_edge.json review/home_edge.json
  mkdir -p diag_out/nohome
  for D in replays replays_pitched replays_errors replays_both; do [ -d diag_out/nohome/$D ] || mv diag_out/$D diag_out/nohome/$D; mkdir -p diag_out/$D; done
  PKS=$(python3 -c "import json; print(' '.join(str(g['pk']) for g in json.load(open('$HIST/participants_$S.json'))['games']))")
  echo "=== $S replays with the home edge $(date +%H:%M)"
  for PK in $PKS; do for M in season pitched errors both; do echo "$PK $M"; done; done | xargs -P 14 -L 1 bash -c '
    PK=$0; M=$1; case $M in season) D=diag_out/replays; A="";; pitched) D=diag_out/replays_pitched; A="pitched";; errors) D=diag_out/replays_errors; A="errors 1.77";; both) D=diag_out/replays_both; A="pitched+errors 1.77";; esac
    [ -s $D/$PK.jsonl ] && [ $(grep -c "^{" $D/$PK.jsonl) -ge 1000 ] && exit 0
    tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $PK 1000 7 0 1 $A > $D/$PK.jsonl 2> $D/$PK.err'
  for D in replays replays_pitched replays_errors replays_both; do echo "$S $D: $(ls diag_out/$D/*.jsonl | wc -l) games, $(cat diag_out/$D/*.jsonl | grep -c '^{') replays, $(grep -l Exception diag_out/$D/*.jsonl | wc -l) with an exception"; done
done
cd $R && python3 history/logit_all.py --refit > history/logit_all_home.txt 2>&1; cat history/logit_all_home.txt | grep -v points
for F in A B; do
  W=~/bsim-wt/hist26${F}4; O=$([ $F = A ] && echo B || echo A)
  cp $R/bb_game.js $W/bb_game.js; cp $R/review/replay_game.js $W/review/replay_game.js; cp $R/review/home_edge.json $W/review/home_edge.json
  echo "=== fold $F with the home edge $(date +%H:%M)"
  cd $R && REPLAYS=diag_out/replays_home season/replay_fold.sh season/fold${F}_aaa $W 100 14
  cd $R && REPLAYS=diag_out/replays_in_home season/replay_fold.sh season/fold${O}_aaa $W 100 14
done
cd $R && python3 season/standings.py --run 4 --sub replays_home 2>&1 | tail -16
echo "=== done $(date +%H:%M)"
