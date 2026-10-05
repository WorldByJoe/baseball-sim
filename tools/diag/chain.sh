#!/bin/bash
# chain.sh [OUTDIR]: the refit chain after any engine change, pasting each result into bb_engine.js:
# the swing policy three times, the scouts' values (hitters, pitchers, fielders), the player pool, the policy twice more.
# About 10-15 minutes. Run from anywhere; it works in the repo root.
cd "$(dirname "$0")/../.." || exit 1
R=tools/diag/run.sh; O=${1:-diag_out/chain}; mkdir -p "$O"
pol() { $R bb_engine.js bb_names.js bb_field.js bb_game.js statcast/discipline_2025.js statcast/swing_count_kind_2025.js tools/fit_swing_policy.js > "$O/policy_$1.txt" 2>&1 && python3 tools/diag/paste.py thr "$O/policy_$1.txt" && echo "policy $1 $(date +%T)"; }
pol 1; pol 2; pol 3
$R bb_engine.js statcast/bip_2025.js tools/hitter_value.js > "$O/hv.txt" 2>&1 &
$R bb_engine.js statcast/bip_2025.js tools/pitcher_value.js -- 3000 300 3 > "$O/pv.txt" 2>&1 &
$R bb_engine.js bb_field.js tools/field_value.js > "$O/fv.txt" 2>&1 &
wait
cat "$O/hv.txt" "$O/pv.txt" "$O/fv.txt" > "$O/values.txt"; python3 tools/diag/paste.py values "$O/values.txt"; echo "values $(date +%T)"
$R bb_engine.js tools/fit_population.js > "$O/pool.txt" 2>&1 && python3 tools/diag/paste.py pool "$O/pool.txt"; echo "pool $(date +%T)"
pol 4; pol 5
