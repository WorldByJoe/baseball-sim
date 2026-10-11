#!/bin/bash
# predict_watch.sh: every 30 minutes, review/predict_next.py (each championship series' next game, predicted or remade
# when its starters or lineups change); when it makes one, the page is rebuilt (the artifact copy in the scratchpad and
# GitHub Pages' playoffs/index.html, committed and pushed, Joe's go-ahead for game pushes) and the watch ends so the
# session can republish the artifact and start it again. Gives up after 12 days.
cd ~/bsim-wt/review
OUT=/private/tmp/claude-501/-Users-joevonfischer-Library-CloudStorage-OneDrive-Colostate-Matlab-Trees2/b0851baa-7c9a-44bd-9641-9bcb33295153/scratchpad/ds_replays.html
END=$(( $(date +%s) + 12 * 86400 ))
while [ "$(date +%s)" -lt "$END" ]; do
  if python3 review/predict_next.py; then
    python3 review/replay_grids.py "$OUT" >/dev/null && python3 review/replay_grids.py ~/bsim-wt/pages/playoffs/index.html --page >/dev/null
    (cd ~/bsim-wt/pages && git add playoffs/index.html && git commit -q -m "Postseason Replays (draft): a pregame prediction updated (review/predict_next.py)" && git push -q origin pages-live:main) || echo "push did not go through"
    exit 0
  fi
  sleep 1800
done
exit 5
