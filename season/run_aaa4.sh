#!/bin/bash
# run_aaa4.sh: run 4 of the season replay (worktrees hist26A4, hist26B4): Triple-A joined to thin major-league seasons as
# well as missing ones (season/aaa_fold.py v0.2). Every pitcher with Triple-A joined is refitted (review/fit_pitchers.js
# v0.3, on his measured scatter; his mishit from run 3 kept), the rest keep run 3's fits; then every hitter; then the
# replayed half 100 times (diag_out/replays); then, for the coaching term, the fold's own training half 100 times with
# the same traits (diag_out/replays_in: in-sample, the residual a team's coaching would leave).
# run_aaa4.sh v0.1 2026-10-13
R=~/bsim-wt/review
for F in A B; do
  W=~/bsim-wt/hist26${F}4; S=~/bsim-wt/hist26${F}3
  echo "=== fold $F: Triple-A joined $(date +%H:%M)"
  cd $R && python3 season/aaa_fold.py $F | tail -1 || exit 2
  [ -d $W ] || git -C $R worktree add -q $W -b season-26${F}4 HEAD
  mkdir -p $W/diag_out/replays; cp $R/diag_out/emu.jsonl $W/diag_out/
  cd $R && python3 season/view.py season/fold${F}_aaa $W || exit 3
  cp $S/review/pitchers_fit.json $W/review/pitchers_fit.json
  python3 -c "import json; json.dump(json.load(open('$R/season/fold${F}_aaa/aaa.json'))['substitutedIds']['pitching'], open('$W/diag_out/aaa_pitchers.json', 'w'))"
  echo "=== fold $F: pitchers with Triple-A refitted $(date +%H:%M)"
  cd $W && for p in $(seq 0 13); do tools/diag/run.sh bb_engine.js review/players.js review/fit_pitchers.js -- 1500 5 "" $p 14 diag_out/aaa_pitchers.json > diag_out/pfit_aaa4_$p.json 2> diag_out/pfit_aaa4_$p.err & done; wait
  python3 - <<'PY' || exit 4
import json, glob
F = json.load(open('review/pitchers_fit.json')); n = 0
for f in sorted(glob.glob('diag_out/pfit_aaa4_[0-9]*.json')):
    A = json.load(open(f))
    for k, v in A['pitchers'].items():
        old = F['pitchers'].get(k) or {}; n += 1
        F['pitchers'][k] = dict(v, level='AAA', **({'mishit': old['mishit']} if old.get('mishit') else {}))
json.dump(F, open('review/pitchers_fit.json', 'w'), indent=1)
print('pitchers refitted with Triple-A joined:', n)
PY
  echo "=== fold $F: hitters $(date +%H:%M)"
  cd $W && HISTDATA=$R/season/fold${F}_aaa FIT_PARTS=14 python3 $R/history/fit_through.py 2026 4 1500 2>&1 | grep -v "R2 \|Warn\|refinement"
  echo "=== fold $F: replays $(date +%H:%M)"
  cd $R && season/replay_fold.sh season/fold${F}_aaa $W 100 14
done
# the training halves, in sample: each worktree also gets the other half's games and parks
for F in A B; do
  W=~/bsim-wt/hist26${F}4; O=$([ $F = A ] && echo B || echo A); WO=~/bsim-wt/hist26${O}4
  python3 - $W $WO <<'PY'
import json, os, sys, glob
W, WO = sys.argv[1:]
n = 0
for f in glob.glob(os.path.join(WO, 'review', 'games', '*.json')):
    d = os.path.join(W, 'review', 'games', os.path.basename(f))
    if not os.path.lexists(d): os.symlink(os.path.realpath(f), d); n += 1
V = json.load(open(os.path.join(W, 'playoffs', 'venues.json'))); V2 = json.load(open(os.path.join(WO, 'playoffs', 'venues.json')))
for k, v in V2['venues'].items(): V['venues'].setdefault(k, v)
json.dump(V, open(os.path.join(W, 'playoffs', 'venues.json'), 'w'), indent=0)
print('linked %d games of the other half; %d parks' % (n, len(V['venues'])))
PY
  echo "=== fold $F: in-sample replays of its training half $(date +%H:%M)"
  cd $R && REPLAYS=diag_out/replays_in season/replay_fold.sh season/fold${O}_aaa $W 100 14
done
echo "=== all done $(date +%H:%M)"
