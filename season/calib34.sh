#!/bin/bash
# calib34.sh: steps 3 and 4 of the run audit calibrated in ~/bsim-wt/cal (fold A's fits, the new flight): each setting
# replays 400 second-half games 3 times in audit mode, with a margin for sending a man home from first (SEND.H1, by outs)
# and a slower first step for the visiting fielders (vis, s).
cd ~/bsim-wt/cal || exit 1
head -400 diag_out/pks.txt > diag_out/pks400.txt
for S in "0.8,0.2,0.0 0" "1.4,0.8,0.6 0.05" "1.8,1.2,1.0 0.10" "2.2,1.6,1.4 0.15"; do
  set -- $S; D=diag_out/cal_${1}_$2; mkdir -p $D
  echo "=== send $1 vis $2 $(date +%H:%M)"
  cat diag_out/pks400.txt | xargs -P 8 -n 1 sh -c "tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- \$0 3 13 0 1 'ghost+audit+send=$1+vis=$2' > $D/\$0.jsonl 2> $D/\$0.err"
done
echo "=== done $(date +%H:%M)"
