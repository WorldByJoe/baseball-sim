#!/bin/zsh
# ---------------------------------------------------------------------------
# build_stable.sh · v0.1 · 2026-10-03
# Plays the league headless (bb_league.js through headless/league_run.js) and
# writes what the screen loads: stable/bb_stable.js (window.BB_STABLE, every
# club and its roster as the last season left them) and stable/league_run.txt
# (each season's levels and the promotion drop).
# usage: tools/build_stable.sh [SEED] [SEASONS] [GAMES]     (defaults 1, 3, 60)
# CHANGED
#   v0.1  first version
# ---------------------------------------------------------------------------
J=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
cd "$(dirname "$0")/.." || exit 1
mkdir -p stable
$J bb_engine.js bb_names.js bb_field.js bb_game.js bb_league.js headless/league_run.js -- ${1:-1} ${2:-3} ${3:-60} 30 out > stable/league_run.raw || exit 1
grep '^@@STABLE@@' stable/league_run.raw | sed 's/^@@STABLE@@/window.BB_STABLE = /; s/$/;/' > stable/bb_stable.js
grep -v '^@@STABLE@@' stable/league_run.raw > stable/league_run.txt
rm stable/league_run.raw
ls -la stable/bb_stable.js
