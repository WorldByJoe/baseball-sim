#!/bin/bash
# run_pregame_ds.sh: every finished division series game as the model would have called it before first pitch: the real
# lineups and starters (both public before the game), the model's manager running each bullpen; 1,000 games, two sets
cd ~/bsim-wt/review; O=diag_out/pregame_ds; mkdir -p $O
for pk in 849829 849834 849833 849835 849839 849838 849828 849823 849819 849822 849830 849825 849826 849827; do
  SP=$(python3 -c "import json; G=json.load(open('review/games/$pk.json')); print(G['pitchers']['away'][0], G['pitchers']['home'][0])")
  set -- $SP
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/pregame.js -- $pk 1000 31 0 1 $1 $2 "" - "" > $O/${pk}_season.jsonl 2> $O/${pk}_season.err &
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/pregame.js -- $pk 1000 31 0 1 $1 $2 "" - "" 1.77 > $O/${pk}_errors.jsonl 2> $O/${pk}_errors.err &
done
wait
