#!/bin/bash
# rerun_octobers.sh YEARS...: each October's hitters refitted with review/fit_hitters.py v0.2 (limits from the engine's own trait
# table) and every game replayed again in the four settings; the old replays kept in diag_out/oldbounds/. Pitchers, their
# mishit, fielders' error tendencies and the pitching as pitched do not depend on the hitters' fits and are kept.
# rerun_octobers.sh v0.1 2026-10-13
R=~/bsim-wt/review; HIST=$R/history
for S in "$@"; do
  W=~/bsim-wt/hist$S; cd $W || exit 1
  cp $R/review/fit_hitters.py review/fit_hitters.py
  mkdir -p diag_out/oldbounds
  [ -e diag_out/oldbounds/hitters_fit.json ] || cp review/hitters_fit.json diag_out/oldbounds/hitters_fit.json
  for D in replays replays_pitched replays_errors replays_both; do [ -d diag_out/oldbounds/$D ] || mv diag_out/$D diag_out/oldbounds/$D; mkdir -p diag_out/$D; done
  echo "=== $S hitter fits $(date +%H:%M)"
  FIT_PARTS=14 python3 $HIST/fit_through.py $S 4 1500 2>&1 | grep -v "R2 \|Warn"
  PKS=$(python3 -c "import json; print(' '.join(str(g['pk']) for g in json.load(open('$HIST/participants_$S.json'))['games']))")
  echo "=== $S replays $(date +%H:%M)"
  for PK in $PKS; do for M in season pitched errors both; do echo "$PK $M"; done; done | xargs -P 14 -L 1 bash -c '
    PK=$0; M=$1; case $M in season) D=diag_out/replays; A="";; pitched) D=diag_out/replays_pitched; A="pitched";; errors) D=diag_out/replays_errors; A="errors 1.77";; both) D=diag_out/replays_both; A="pitched+errors 1.77";; esac
    [ -s $D/$PK.jsonl ] && [ $(grep -c "^{" $D/$PK.jsonl) -ge 1000 ] && exit 0
    tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $PK 1000 7 0 1 $A > $D/$PK.jsonl 2> $D/$PK.err'
  for D in replays replays_pitched replays_errors replays_both; do echo "$S $D: $(ls diag_out/$D/*.jsonl | wc -l) games, $(cat diag_out/$D/*.jsonl | grep -c '^{') replays, $(grep -l Exception diag_out/$D/*.jsonl | wc -l) with an exception"; done
done
echo "=== done $(date +%H:%M)"
