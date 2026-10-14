#!/bin/bash
# smx_grid.sh: review/swing_mix.js over a grid of contact settings on the fixed collision (GEOM_VERTICAL, E_X 0.46, R_X 0.29),
# two seeds each, 14 at a time; outputs diag_out/smx_g2_<du>_<bs>_<lg>_<seed>.json (step 2, 2026-10-13)
cd ~/bsim-wt/engdev
for du in ${DUS:-0.2 0.4 0.6}; do for bs in ${BSS:-0.7 0.85 1.0}; do for lg in ${LGS:-1.3 1.6}; do for s in 1 2; do
  echo "$du $bs $lg $s"; done; done; done; done | xargs -P 14 -L 1 bash -c '
  tools/diag/run.sh bb_engine.js review/swing_mix.js -- 30000 $3 $0 "{\"geomVertical\":true,\"ex\":0.46,\"rx\":0.29,\"aimAttack\":${AIMA:-0},\"lookGain\":$2}" $1 > diag_out/smx_g2_$0_$1_$2_$3.json 2>&1'
