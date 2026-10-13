#!/bin/bash
# replay_fold.sh FOLD WT [N] [JOBS]: every game of the fold's replayed half, N times each (default 100), JOBS at a time (default 14).
# (build_season.sh's one-line xargs job was longer than BSD xargs allows; the job is its own script, season/replay_one.sh.)
FOLD=$(cd "$1" && pwd); WT=$2; export N=${3:-100}; J=${4:-14}; export REPLAYS=${REPLAYS:-diag_out/replays}   # v0.2: REPLAYS, another folder
cd "$WT" || exit 1; mkdir -p $REPLAYS
python3 -c "import json; print('\n'.join(str(g['pk']) for g in json.load(open('$FOLD/participants_2026.json'))['games']))" | xargs -P $J -n 1 ~/bsim-wt/review/season/replay_one.sh
echo "$REPLAYS: $(ls $REPLAYS/*.jsonl | wc -l) games, $(cat $REPLAYS/*.jsonl | grep -c '^{') replays, $(grep -l Exception $REPLAYS/*.jsonl | wc -l) games with an exception"
