#!/bin/bash
# run.sh FILES... -- ARGS: load the files into one scope and run them, the same way on the Mac (JavaScriptCore's jsc)
# or on a cloud machine (Node, through headless/run_node.js). Every diag script is run through this.
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
if [ -x "$JSC" ]; then exec "$JSC" "$@"; else exec node "$(cd "$(dirname "$0")/../.." && pwd)/headless/run_node.js" "$@"; fi
