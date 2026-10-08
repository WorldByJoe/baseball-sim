#!/bin/bash
# wait_game.sh PK: waits for a postseason game to go final, then fetches and parses it, checks every player has
# fitted traits (exit 3 naming any who do not), builds his game-day pitching, replays it 1,000 times each way
# (regular-season pitching, as pitched, fielders' own error rates) and rebuilds the score-grid page.
cd ~/bsim-wt/review; PK=$1; OUT=${2:-/private/tmp/claude-501/-Users-joevonfischer-Library-CloudStorage-OneDrive-Colostate-Matlab-Trees2/b0851baa-7c9a-44bd-9641-9bcb33295153/scratchpad/ds_replays.html}
until curl -s "https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePk=$PK" | grep -q '"detailedState" *: *"\(Final\|Game Over\|Completed Early\)"'; do sleep 300; done
sleep 90
curl -s "https://statsapi.mlb.com/api/v1.1/game/$PK/feed/live" -o playoffs/games/${PK}_feed.json && python3 review/game_feed.py $PK || exit 2
python3 - "$PK" <<'PY' || exit 3
import json, sys
pk = sys.argv[1]
H = json.load(open('review/hitters_fit.json')); P = json.load(open('review/pitchers_fit.json'))['pitchers']; G = json.load(open('review/games/%s.json' % pk))
miss = [p['name'] for s in ('away', 'home') for p in G['lineups'][s] if str(p['id']) not in H] + ['pitcher %s' % pid for s in ('away', 'home') for pid in G['pitchers'][s] if str(pid) not in P]
if miss: print('MISSING:', miss); sys.exit(3)
PY
python3 review/as_pitched.py $PK
for M in "" pitched "errors 1.77"; do
  D=diag_out/replays; [ "$M" = pitched ] && D=diag_out/replays_pitched; [ "$M" = "errors 1.77" ] && D=diag_out/replays_errors
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $PK 1000 7 0 1 $M > $D/$PK.jsonl 2> $D/$PK.err &
done
wait
python3 review/replay_grids.py "$OUT"
echo "$PK replayed: $(wc -l < diag_out/replays/$PK.jsonl) $(wc -l < diag_out/replays_pitched/$PK.jsonl) $(wc -l < diag_out/replays_errors/$PK.jsonl)"
