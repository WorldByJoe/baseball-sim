#!/bin/bash
# october_r7.sh S · v0.1 · 2026-10-14: a past October replayed with run 7's engine and fits (the model review; Joe: does the
# current model predict past playoffs better?). Worktree hist<S>r7 from engine-dev, the October's inputs copied from
# hist<S> (replay_view's output, as_pitched), tonight's engine files, the run-7 emulator; hitters through S on
# history_7 (walks net of intentional walks; the call-up prior), pitchers refitted with their uncertainty, fielders'
# range from S-1 and S; every game 1,000 times as the lineups stood ('season') and as pitched, mode fielding+pdraw.
S=$1; R=~/bsim-wt/review; E=~/bsim-wt/engdev; J=${JOBS:-6}; OLD=~/bsim-wt/hist$S; W=~/bsim-wt/hist${S}r7
FILES="bb_engine.js bb_field.js bb_game.js review/players.js review/replay_game.js review/emulate_hitters.js review/check_hitters.js review/fit_hitters.py review/level_means.json review/field_traits.py review/fit_pitchers.js review/pitcher_sd.py"
[ -d $W ] || git -C $R worktree add -q $W -b history-${S}r7 engine-dev
rsync -a --exclude .git --exclude 'diag_out/replays*' --exclude diag_out/oldbounds --exclude diag_out/cmdbug --exclude diag_out/nohome --exclude 'diag_out/pfit_*' $OLD/ $W/
for f in $FILES; do cp $E/$f $W/$f; done; cp $E/review/emu_v4.jsonl $W/diag_out/emu.jsonl
[ -d $R/history_7 ] || python3 $R/season/ibb_fold.py $R/history $R/history_7
cd $W
python3 review/field_traits.py $R/history/leaderboards $((S - 1)),$S review/field_traits.json | tail -1
echo "=== $S hitters $(date +%H:%M)"
CALLUP_LEVEL=3 LEVEL_MEANS=$W/review/level_means.json HISTDATA=$R/history_7 FIT_PARTS=$J python3 $R/history/fit_through.py $S 4 1500 2>&1 | grep -v "Warn\|refinement\|R2 "
echo "=== $S pitchers $(date +%H:%M)"
for p in $(seq 0 $((J - 1))); do tools/diag/run.sh bb_engine.js review/players.js review/fit_pitchers.js -- 1500 5 "" $p $J > diag_out/pfit_$p.json 2> diag_out/pfit_$p.err & done; wait
python3 -c "
import json, glob
out = None
for f in sorted(glob.glob('diag_out/pfit_[0-9]*.json')):
    A = json.load(open(f))
    if out is None: out = A
    else: out['pitchers'].update(A['pitchers'])
json.dump(out, open('review/pitchers_fit.json', 'w'), indent=1); print('pitchers fitted:', len(out['pitchers']))" || exit 3
python3 $R/history/fit_mishit_view.py 2>&1 | tail -1; python3 review/pitcher_sd.py
PKS=$(python3 -c "import json; print(' '.join(str(g['pk']) for g in json.load(open('$R/history/participants_$S.json'))['games']))")
mkdir -p diag_out/replays diag_out/replays_pitched
echo "=== $S replays $(date +%H:%M)"
for PK in $PKS; do for M in season pitched; do echo "$PK $M"; done; done | xargs -P $J -L 1 bash -c '
  PK=$0; M=$1; if [ $M = season ]; then D=diag_out/replays; A="fielding+pdraw"; else D=diag_out/replays_pitched; A="pitched+fielding+pdraw"; fi
  [ -s $D/$PK.jsonl ] && [ $(grep -c "^{" $D/$PK.jsonl) -ge 1000 ] && exit 0
  tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $PK 1000 7 0 1 $A > $D/$PK.jsonl 2> $D/$PK.err'
for D in replays replays_pitched; do echo "$S $D: $(ls diag_out/$D/*.jsonl | wc -l) games, $(cat diag_out/$D/*.jsonl | grep -c '^{') replays, $(grep -l Exception diag_out/$D/*.err 2>/dev/null | wc -l) with an exception"; done
echo "=== $S done $(date +%H:%M)"
