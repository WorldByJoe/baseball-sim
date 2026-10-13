#!/bin/bash
# the rest of the night, in order: fold B's replays (its build's xargs step failed), then the A/B rerun with the hitter fit's
# stale bounds widened (fit_hitters RANGE: motorIn 0.56-1.4 -> 0.4-3.0, undercut -0.35-1.15 -> -0.2-2.0; the engine's own
# populations are 0.98-2.47 and 0.25-1.75 since v3.2) in worktrees hist26A2 and hist26B2, reusing each fold's pitcher fits.
R=~/bsim-wt/review; SP=/private/tmp/claude-501/-Users-joevonfischer-Library-CloudStorage-OneDrive-Colostate-Matlab-Trees2/b0851baa-7c9a-44bd-9641-9bcb33295153/scratchpad
until ! pgrep -f "build_season.sh" > /dev/null && ! pgrep -f "replay_fold.sh season/foldA" > /dev/null; do sleep 30; done
echo "=== fold B replays $(date +%H:%M)"; cd $R && season/replay_fold.sh season/foldB ~/bsim-wt/hist26B 100 14
cd $R && python3 season/standings.py > $SP/standings_before.txt 2>&1; echo "=== standings (bounds as they were) written $(date +%H:%M)"
for F in A B; do
  W=~/bsim-wt/hist26${F}2; S=~/bsim-wt/hist26$F
  [ -d $W ] || git -C $R worktree add -q $W -b season-26${F}2 HEAD
  mkdir -p $W/diag_out/replays; cp $R/diag_out/emu.jsonl $W/diag_out/
  cp $S/playoffs/players_measured.json $S/playoffs/rosters.json $S/playoffs/venues.json $W/playoffs/
  rm -rf $W/playoffs/pitches; cp -a $S/playoffs/pitches $W/playoffs/pitches
  rm -f $W/review/games/*.json; cp -a $S/review/games/. $W/review/games/
  cp $S/review/pitchers_fit.json $S/review/players.js $S/review/replay_game.js $W/review/
  python3 - $W/review/fit_hitters.py <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
s = s.replace("RANGE = {'motorIn': (0.56, 1.4),", "RANGE = {'motorIn': (0.4, 3.0),").replace("'undercut': (-0.35, 1.15),", "'undercut': (-0.2, 2.0),")
assert "'motorIn': (0.4, 3.0)" in s and "'undercut': (-0.2, 2.0)" in s
open(p, 'w').write(s)
PY
  echo "=== fold ${F}2 hitter fits $(date +%H:%M)"
  cd $W && HISTDATA=$R/season/fold$F FIT_PARTS=14 python3 $R/history/fit_through.py 2026 4 1500 2>&1 | grep -v "R2 \|Warn"
  echo "=== fold ${F}2 replays $(date +%H:%M)"; cd $R && season/replay_fold.sh season/fold$F $W 100 14
done
echo "=== all done $(date +%H:%M)"
