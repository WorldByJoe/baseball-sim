#!/bin/bash
# suite.sh [OUTDIR]: the metric suite on the engine in the working tree - three seeds of 200 games (run_games), the
# contact score (90 targets), plate discipline, spray, batted balls, and the diag probes (vertical miss, whiffs and
# depth by kind and height; fastball fouls; breaking-ball reads). Compare two suites with compare.py BEFORE AFTER.
# Seeds are only comparable within one machine: jsc and Node can differ in the last bits of Math functions.
cd "$(dirname "$0")/../.." || exit 1
R=tools/diag/run.sh; O=${1:-diag_out/suite}; mkdir -p "$O"
for s in 3 11 29; do $R bb_engine.js bb_names.js bb_field.js bb_game.js headless/run_games.js -- 200 $s 0 > "$O/games_$s.txt" 2>&1 & done
$R bb_engine.js statcast/misses_2025.js headless/contact_score.js -- 600 40 5 > "$O/contact.txt" 2>&1 &
$R bb_engine.js bb_names.js bb_field.js bb_game.js statcast/discipline_2025.js headless/discipline_check.js -- 400 40 3 > "$O/discipline.txt" 2>&1 &
$R bb_engine.js statcast/bat_direction_2025.js headless/spray_check.js -- 600 60 5 > "$O/spray.txt" 2>&1 &
$R bb_engine.js bb_names.js bb_field.js bb_game.js statcast/bip_2025.js headless/bip_check.js -- 300 3 > "$O/bip.txt" 2>&1 &
$R bb_engine.js tools/diag/probe.js -- 106 600 > "$O/probe.txt" 2>&1 &
$R bb_engine.js tools/diag/fbfoul_model.js -- 1 > "$O/fbfoul.txt" 2>&1 &
$R bb_engine.js tools/diag/brread.js -- 106 > "$O/brread.txt" 2>&1 &
wait
echo "suite written to $O"
