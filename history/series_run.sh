#!/bin/bash
# series_run.sh S WT N G: every series of October S (history/series_specs.py's specs) played N times before Game 1 in its
# worktree, 7 parts each, fielders at their own error rates (league factor G); one spec at a time.
# series_run.sh v0.1 2026-10-13
S=$1; WT=$2; N=${3:-1000}; G=${4:-1.77}
cd "$WT" || exit 1; mkdir -p diag_out/series_fc
for SPEC in $(python3 -c "import json; print(' '.join(json.load(open('review/series/index_$S.json'))))"); do
  B=$(basename $SPEC .json); [ -s diag_out/series_fc/$B.jsonl ] && [ $(cat diag_out/series_fc/$B.jsonl | grep -c '^{') -ge $N ] && continue
  for p in 0 1 2 3 4 5 6; do tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/series_sim.js -- $SPEC $N 29 $p 7 $G > diag_out/series_fc/${B}_$p.part 2> diag_out/series_fc/${B}_$p.err & done; wait
  cat diag_out/series_fc/${B}_*.part > diag_out/series_fc/$B.jsonl; rm -f diag_out/series_fc/${B}_*.part
  echo "$B: $(grep -c '^{' diag_out/series_fc/$B.jsonl) series"
done
