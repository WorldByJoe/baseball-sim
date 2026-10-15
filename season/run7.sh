#!/bin/bash
# run7.sh · v0.1 · 2026-10-14: run 7, the model review's three phases measured in full games (Joe, 2026-10-14: "run through
# all of the phases"). Engine-dev with bb_field v1.18 (infielders' dive and recovery, base covers, refitted pivot and break;
# fitted to the league's grounders and men-on-first plays), bb_game v1.10, replay mode 'fielding' (real fielders' range and
# catchers' framing from 2025's Savant boards), players v0.3 (learn, coverage, commit held at the posterior mean), the hitter
# fit v0.3 with two direct measures (contact-depth spread -> timingSD, spray left after the bat's direction -> faceSD), walks
# net of intentional walks (season/foldX_7), call-ups without data at the farm's third pick (fit_through CALLUP_LEVEL=3).
# Emulator regenerated (it now measures depth and face); run 4's pitcher fits as in run 6; 400 replays a game; scored with
# standings v0.3's protocol against run 6; audited with runs_audit v0.3.
R=~/bsim-wt/review; E=~/bsim-wt/engdev; J=${JOBS:-10}
echo "=== emulator $(date +%H:%M)"
cd $E && mkdir -p diag_out/emu4 && seq 1 18 | xargs -P $J -I{} sh -c 'tools/diag/run.sh bb_engine.js review/emulate_hitters.js -- 200 250 {} > diag_out/emu4/{}.jsonl 2> diag_out/emu4/{}.err'
cat diag_out/emu4/{1..18}.jsonl | grep '^{' > review/emu_v4.jsonl; echo "emulator: $(wc -l < review/emu_v4.jsonl) hitters"
[ $(wc -l < review/emu_v4.jsonl) -ge 3500 ] || { echo "emulator short"; exit 2; }
FILES="bb_engine.js bb_field.js bb_game.js review/players.js review/replay_game.js review/emulate_hitters.js review/check_hitters.js review/fit_hitters.py review/level_means.json review/field_traits.py"
for F in A B; do
  W=~/bsim-wt/hist26${F}7
  for f in $FILES; do cp $E/$f $W/$f; done; cp $E/review/home_edge.json $W/review/
  mkdir -p $W/diag_out; cp $E/review/emu_v4.jsonl $W/diag_out/emu.jsonl
  cd $R && python3 season/view.py season/fold${F}_7 $W || exit 3
  cp ~/bsim-wt/hist26${F}4/review/pitchers_fit.json $W/review/pitchers_fit.json
  python3 $W/review/field_traits.py $R/season/fold${F}_aaa/leaderboards 2025 $W/review/field_traits.json | tail -1
  echo "=== fold $F hitters $(date +%H:%M)"
  cd $W && CALLUP_LEVEL=3 LEVEL_MEANS=$W/review/level_means.json HISTDATA=$R/season/fold${F}_7 FIT_PARTS=$J python3 $R/history/fit_through.py 2026 4 1500 2>&1 | grep -v "Warn\|refinement" | grep -v "R2 " ; grep -h "R2" /dev/null
  cd $W && python3 $R/season/patch_hitters.py 2>&1 | grep -v "R2 " | cut -c1-120
done
for F in A B; do echo "=== run 7 fold $F, 400 a game $(date +%H:%M)"; cd $R && MODE_EXTRA=+fielding season/replay_fold.sh season/fold${F}_7 ~/bsim-wt/hist26${F}7 400 $J; done
cd $R && python3 season/standings.py --run 7 --vs 6 2>&1 | tail -18
echo "=== audit $(date +%H:%M)"
$R/season/audit_run.sh ~/bsim-wt/hist26A7 run7 fielding $J > /dev/null; grep -v "R2 " $R/season/runs_audit_run7.txt
echo "=== done $(date +%H:%M)"
