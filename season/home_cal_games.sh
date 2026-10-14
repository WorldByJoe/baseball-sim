#!/bin/bash
# home_cal_games.sh TAG MODE-TOKENS [SEED]: run 5's audit games (985 second-half games x 4, hist26A5) with the home edge set by
# the tokens (replay_game v0.8: eye=x, aggr=y; nohome), and the run audit of them -> season/runs_audit_TAG.txt. The home edge's
# effect in games is a setting's home-minus-visitors less the same with 'nohome', on the same seed. (Joe, 2026-10-13)
TAG=$1; TOK=$2; SEED=${3:-13}; W=~/bsim-wt/hist26A5; mkdir -p $W/diag_out/audit_$TAG
cd $W && cat diag_out/audit/pks.txt | TOK=$TOK SEED=$SEED TAG=$TAG xargs -P 14 -n 1 sh -c 'tools/diag/run.sh bb_engine.js bb_names.js bb_field.js bb_game.js review/players.js review/replay_game.js -- $0 4 $SEED 0 1 ghost+audit+$TOK > diag_out/audit_$TAG/$0.jsonl 2> diag_out/audit_$TAG/$0.err'
cd ~/bsim-wt/review && python3 -c "
import sys; sys.path.insert(0, 'season'); import runs_audit as RA, os
RA.AUD = os.path.expanduser('~/bsim-wt/hist26A5/diag_out/audit_$TAG'); RA.HERE = os.path.join(os.getcwd(), 'season'); RA.main()" > season/runs_audit_$TAG.txt 2>&1
echo "$TAG ($TOK, seed $SEED): $(grep -E '^8\.' season/runs_audit_$TAG.txt)"
