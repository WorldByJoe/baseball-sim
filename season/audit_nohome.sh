#!/bin/bash
# audit_nohome.sh: run 5's audit replays again with the home edge off, the same seed (13), for the home edge's own effect in games
W=~/bsim-wt/hist26A5; mkdir -p $W/diag_out/audit_nohome
cd $W && cat diag_out/audit/pks.txt | xargs -P 14 -n 1 sh -c 'tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $0 4 13 0 1 ghost+audit+nohome > diag_out/audit_nohome/$0.jsonl 2> diag_out/audit_nohome/$0.err'
cd ~/bsim-wt/review && python3 -c "
import sys; sys.path.insert(0, 'season'); import runs_audit as RA, os
RA.AUD = os.path.expanduser('~/bsim-wt/hist26A5/diag_out/audit_nohome'); RA.HERE = os.path.join(os.getcwd(), 'season'); RA.main()" > season/runs_audit_run5_nohome.txt 2>&1
grep -E "^8\.|^1\." season/runs_audit_run5_nohome.txt
