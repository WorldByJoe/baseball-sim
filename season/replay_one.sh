#!/bin/bash
# replay_one.sh PK: one regular-season game N times (env N, default 100) in the current worktree, the extra-innings runner on
replays_dir=${REPLAYS:-diag_out/replays}; PK=$1; N=${N:-400}   # REPLAYS: another folder (v0.2: the in-sample replays for the coaching term)
[ -s $replays_dir/$PK.jsonl ] && [ $(grep -c "^{" $replays_dir/$PK.jsonl) -ge $N ] && exit 0
tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $PK $N 7 0 1 ghost > $replays_dir/$PK.jsonl 2> $replays_dir/$PK.err
