#!/bin/bash
# build_season.sh FOLD WT [N]: one fold of the 2026 season replay in its worktree (season/view.py has run): hitters through
# the fold (history/fit_through.py on the fold's folder, refined on the simulator, 12 jobs), pitchers (14 parts), their
# mishit, then every game of the replayed half N times (default 100) with each pitcher at his regular-season stuff, 14 at a time.
# build_season.sh v0.1 2026-10-13
FOLD=$(cd "$1" && pwd); WT=$2; N=${3:-100}; HIST=~/bsim-wt/review/history
cd "$WT" || exit 1
HISTDATA=$FOLD FIT_PARTS=12 python3 $HIST/fit_through.py 2026 4 1500 || exit 2
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
python3 - $FOLD <<'PY'
import json, sys, os
H = json.load(open('review/hitters_fit.json')); P = json.load(open('review/pitchers_fit.json'))['pitchers']
R = {r['id']: r for r in json.load(open('playoffs/players_measured.json'))['players']}
mh = mp = gen = 0
for g in json.load(open(os.path.join(sys.argv[1], 'participants_2026.json')))['games']:
    G = json.load(open('review/games/%d.json' % g['pk']))
    mh += sum(1 for s in ('away', 'home') for p in G['lineups'][s] if str(p['id']) not in H)
    mp += sum(1 for s in ('away', 'home') for pid in G['pitchers'][s] if pid not in R)
    gen += sum(1 for s in ('away', 'home') for pid in G['pitchers'][s] if pid in R and not ((R[pid]['summaries'].get('pitching') or {}).get('pitchTypes')))
print('lineup men without hitter fits: %d; pitchers without records: %d; pitcher appearances that will use a generic reliever: %d' % (mh, mp, gen))
PY
python3 -c "import json; print(' '.join(str(g['pk']) for g in json.load(open('$FOLD/participants_2026.json'))['games']))" | tr ' ' '\n' | xargs -P 14 -I{} bash -c '
  PK={}; [ -s diag_out/replays/$PK.jsonl ] && [ $(grep -c "^{" diag_out/replays/$PK.jsonl) -ge '$N' ] && exit 0
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $PK '$N' 7 0 1 ghost > diag_out/replays/$PK.jsonl 2> diag_out/replays/$PK.err'
echo "replays: $(ls diag_out/replays/*.jsonl | wc -l) games, $(cat diag_out/replays/*.jsonl | grep -c '^{') replays, $(grep -l Exception diag_out/replays/*.jsonl | wc -l) games with an exception"
