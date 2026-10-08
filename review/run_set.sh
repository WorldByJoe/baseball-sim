#!/bin/bash
# run_set.sh OUTDIR N [mode] [G]: every finished division series game replayed N times into OUTDIR, in parallel (modes: pitched, errors, pitched+errors; G = the errors league factor, 1.77)
cd ~/bsim-wt/review; O=$1; N=$2; M=$3; G=$4; mkdir -p $O
for pk in 849829 849834 849833 849835 849839 849838 849828 849823 849819 849822 849830 849825 849826 849827; do
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $pk $N 7 0 1 $M $G > $O/$pk.jsonl 2> $O/$pk.err &
done
wait
python3 - "$O" <<'PY'
import json, sys, glob
e = n = 0; r = 0
for f in glob.glob(sys.argv[1] + '/*.jsonl'):
    R = [json.loads(l) for l in open(f) if l.startswith('{')]
    e += sum(sum(x['errors']) for x in R); r += sum(sum(x['score']) for x in R); n += 2 * len(R)
print('%s: errors per team-game %.3f, runs per team-game %.2f (%d team-games)' % (sys.argv[1], e / n, r / n, n))
PY
