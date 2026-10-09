#!/bin/bash
# couch_watch.sh: cron's entry for couch_watch.py (a path alone on cron's command line, so no pgrep can match itself)
cd /home/joe/tv_art && exec python3 couch_watch.py --once >> /home/joe/tv_art/couch_watch.log 2>&1
