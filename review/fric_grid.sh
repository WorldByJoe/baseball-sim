#!/bin/bash
# fric_grid.sh: the force-dependent friction (MU_REF, MU_GAMMA) on GEOM 'relative', each setting through review/graze_check.js and
# review/swing_mix.js (two seeds); outputs diag_out/fric_<ref>_<gamma>_graze.json, diag_out/smx_fric_<ref>_<gamma>_<seed>.json (2026-10-14)
cd ~/bsim-wt/engdev
for ref in ${REFS:-0.15 0.2 0.25 0.3}; do for g in ${GS:-0 0.25 0.46}; do
  echo "graze $ref $g 1"; echo "smx $ref $g 1"; echo "smx $ref $g 2"
done; done | xargs -P 14 -L 1 bash -c '
  kind=$0; ref=$1; g=$2; s=$3; T="{\"geom\":\"relative\",\"muRef\":$ref,\"muGamma\":$g,\"mu\":$ref${EXTRA:+,$EXTRA}}"
  if [ $kind = graze ]; then tools/diag/run.sh bb_engine.js review/graze_check.js -- 20000 $s "$T" > diag_out/fric_${ref}_${g}_graze.json 2>&1
  else tools/diag/run.sh bb_engine.js review/swing_mix.js -- 30000 $s 0 "$T" 1 > diag_out/smx_fric_${ref}_${g}_$s.json 2>&1; fi'
