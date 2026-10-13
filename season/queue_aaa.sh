#!/bin/bash
# queue_aaa.sh: after the October reruns (history/rerun_octobers.sh) and the Triple-A pull (fetch_pitches.py --level AAA):
# the season replay with Triple-A priors (season/run_aaa.sh) as soon as the pull is in, the series forecasts of every
# October again with the new hitter fits (history/series_run.sh; old ones kept in diag_out/oldbounds/series_fc), then the
# regression (history/logit_all.py --refit), the series picks and the season scores (standings.py --run 3, nodata.py).
R=~/bsim-wt/review
octs_done() { ! pgrep -f "[r]erun_octobers.sh" > /dev/null; }
pull_done() { ! pgrep -f "[f]etch_pitches.py --level AAA" > /dev/null; }
series() {
  for S in 2024 2025 2026; do W=~/bsim-wt/hist$S
    [ -d $W/diag_out/oldbounds/series_fc ] || mv $W/diag_out/series_fc $W/diag_out/oldbounds/series_fc
    echo "=== series $S $(date +%H:%M)"; $R/history/series_run.sh $S $W 1000 1.77
  done; SERIES=1
}
SERIES=0; AAA=0
until octs_done; do sleep 30; done
echo "=== October reruns done $(date +%H:%M)"
until [ $SERIES = 1 ] && [ $AAA = 1 ]; do
  if [ $AAA = 0 ] && pull_done; then (cd "$HOME/Library/CloudStorage/OneDrive-Colostate/Claude/Baseball sim" && python3 statcast/fetch_pitches.py --level AAA --dates 2025-03-20:2025-09-30,2026-03-20:2026-09-30 | grep -v cached | tail -3)   # any day a worker missed
    echo "=== season with Triple-A priors $(date +%H:%M)"; $R/season/run_aaa.sh; AAA=1
  elif [ $SERIES = 0 ]; then series
  else sleep 30; fi
done
cd $R && python3 history/logit_all.py --refit > history/logit_all.txt 2>&1; tail -25 history/logit_all.txt
python3 history/series_picks.py 2>&1 | tail -30
python3 season/standings.py --run 3 2>&1 | tail -40
python3 season/nodata.py ,2,3
echo "=== queue done $(date +%H:%M)"
