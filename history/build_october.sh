#!/bin/bash
# build_october.sh S WT: a past October's replays in its own worktree (history/replay_view.py must have run), in order:
# hitters through S (history/fit_through.py, refined on the simulator), pitchers (review/fit_pitchers.js, 14 parts),
# their mishit (history/fit_mishit_view.py), fielders' error tendencies (review/err_mult.py), each game's pitching as
# pitched (review/as_pitched.py), then every game replayed 1,000 times in each of the four settings, 14 at a time.
# build_october.sh v0.1 2026-10-12
S=$1; WT=$2; HIST=~/bsim-wt/review/history
cd "$WT" || exit 1
python3 $HIST/fit_through.py $S 4 1500 || exit 2
for p in $(seq 0 13); do tools/diag/run.sh bb_engine.js review/players.js review/fit_pitchers.js -- 1500 5 "" $p 14 > diag_out/pfit_$p.json 2> diag_out/pfit_$p.err & done; wait
python3 - <<'PY' || exit 3
import json, glob
out = None
for f in sorted(glob.glob('diag_out/pfit_[0-9]*.json')):
    A = json.load(open(f))
    if out is None: out = A
    else: out['pitchers'].update(A['pitchers'])
json.dump(out, open('review/pitchers_fit.json', 'w'), indent=1)
print('pitchers fitted:', len(out['pitchers']))
PY
python3 $HIST/fit_mishit_view.py || exit 4
python3 review/err_mult.py || exit 5
PKS=$(python3 -c "import json; print(' '.join(str(g['pk']) for g in json.load(open('$HIST/participants_$S.json'))['games']))")
for PK in $PKS; do python3 review/as_pitched.py $PK > /dev/null || echo "as_pitched failed $PK"; done
python3 - $S <<'PY'
import json, sys
S = sys.argv[1]
H = json.load(open('review/hitters_fit.json')); P = json.load(open('review/pitchers_fit.json'))['pitchers']
import os
miss = []
for g in json.load(open(os.path.expanduser('~/bsim-wt/review/history/participants_%s.json' % S)))['games']:
    G = json.load(open('review/games/%d.json' % g['pk']))
    miss += [(g['pk'], p['name']) for s in ('away', 'home') for p in G['lineups'][s] if str(p['id']) not in H]
    miss += [(g['pk'], 'pitcher %s' % pid) for s in ('away', 'home') for pid in G['pitchers'][s] if str(pid) not in P]
print('not fitted (hitters must be; pitchers fall back to their measured traits):', miss[:30], len(miss))
PY
JOBS=""
for PK in $PKS; do for M in season pitched errors both; do echo "$PK $M"; done; done | xargs -P 14 -L 1 bash -c '
  PK=$0; M=$1; case $M in season) D=diag_out/replays; A="";; pitched) D=diag_out/replays_pitched; A="pitched";; errors) D=diag_out/replays_errors; A="errors 1.77";; both) D=diag_out/replays_both; A="pitched+errors 1.77";; esac
  [ -s $D/$PK.jsonl ] && [ $(grep -c "^{" $D/$PK.jsonl) -ge 1000 ] && exit 0
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $PK 1000 7 0 1 $A > $D/$PK.jsonl 2> $D/$PK.err'
for D in replays replays_pitched replays_errors replays_both; do echo "$D: $(ls diag_out/$D/*.jsonl | wc -l) games, $(cat diag_out/$D/*.jsonl | grep -c '^{') replays"; done
