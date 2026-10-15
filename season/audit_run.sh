#!/bin/bash
# audit_run.sh WT TAG [MODE] [JOBS]: run 4's audit games (985 second-half games x 4) in worktree WT with the replay mode
# ghost+audit[+MODE], scored by season/runs_audit.py into season/runs_audit_TAG.txt and .json (the model review, 2026-10-14)
W=$1; TAG=$2; M=${3:++$3}; J=${4:-10}
mkdir -p $W/diag_out/audit; cp ~/bsim-wt/hist26A4/diag_out/audit/pks.txt $W/diag_out/audit/
cd $W && cat diag_out/audit/pks.txt | xargs -P $J -n 1 sh -c 'tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $0 4 13 0 1 ghost+audit'"$M"' > diag_out/audit/$0.jsonl 2> diag_out/audit/$0.err'
cd ~/bsim-wt/review && python3 -c "
import sys, os; sys.path.insert(0, 'season'); import runs_audit as RA
RA.AUD = os.path.expanduser('$W/diag_out/audit'); RA.HERE = os.path.join(os.getcwd(), 'season'); RA.OUT = None if not hasattr(RA, 'OUT') else RA.OUT; RA.main()" > season/runs_audit_$TAG.txt 2>&1
cp season/runs_audit.json season/runs_audit_$TAG.json; grep -v "R2 " season/runs_audit_$TAG.txt | head -12
