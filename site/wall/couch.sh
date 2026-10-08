#!/bin/bash
# couch.sh · v1.0 · 2026-10-08
#
# Point the wall at the Couch Analyst, or send it back to the rotation.
#
#   ./couch.sh              today's postseason game (the page picks the live one)
#   ./couch.sh pin          stay on it even after the game ends
#   ./couch.sh replay       Yankees at Rays, ALDS Game 2, replayed (a test)
#   ./couch.sh back         return to the ring now
#
# Navigates the RUNNING kiosk over CDP (port 9222), as gameday.sh does, rather than restarting Chromium.
# The kiosk must be up: with the TV in standby there is no kiosk to drive.
set -euo pipefail
A="${1:-}"
case "$A" in
  back)   URL="file:///home/joe/tv_art/kiosk.html" ;;
  pin)    URL="file:///home/joe/tv_art/couch.html?pin" ;;
  replay) URL="file:///home/joe/tv_art/couch.html?replay&pin" ;;
  *)      URL="file:///home/joe/tv_art/couch.html" ;;
esac
python3 - "$URL" <<'PY'
import sys, json
src = open("/home/joe/tv_art/cdp.py").read().split("if __name__")[0]
ns = {}; exec(compile(src, "cdp", "exec"), ns)
s = ns["connect"](ns["ws_url"]())
ns["send"](s, {"id": 1, "method": "Runtime.evaluate", "params": {"expression": "location.href=%s" % json.dumps(sys.argv[1])}})
print("wall ->", sys.argv[1])
PY
