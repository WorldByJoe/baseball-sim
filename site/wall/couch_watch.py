#!/usr/bin/env python3
"""
couch_watch.py · v1.1 · 2026-10-08

Bring the wall to the Couch Analyst for every postseason game, once a game.

The ring holds couch.html for a whole game once it gets there, but it gets there only in its turn. This check
reads MLB's schedule; when a postseason game is within 20 minutes of its first pitch or under way, and the kiosk
is running (the TV on), it points the wall at couch.html (no ?pin, so the page hands back to the ring 10 minutes
after the last out). It switches ONCE PER GAME (couch_watch.state records the game): if somebody then moves the
wall elsewhere with the remote, it is left there. A TV switched on mid-game still gets the game.

Cron (Joe, 2026-10-08: "make the Couch switch automatic for every postseason game"):
    */2 * * * * /home/joe/tv_art/couch_watch.sh
couch_watch.sh runs `python3 couch_watch.py --once`; the path alone is cron's command line (the pgrep lesson).
`python3 couch_watch.py` without --once keeps checking every 30 s for up to 5 hours (the v1.0 behaviour).

CHANGED
  v1.1  --once for cron, once per game via couch_watch.state; timezone-aware clock
  v1.0  first build: a one-off watcher for ALDS Game 4
"""
import json, time, urllib.request, datetime, sys, os

POLL_S, PRE_MIN, GIVE_UP_H = 30, 20, 5
PAGE = "file:///home/joe/tv_art/couch.html"
STATE = "/home/joe/tv_art/couch_watch.state"

def stamp(): return time.strftime("%Y-%m-%d %H:%M:%S")

def wall_url():
    """The kiosk's current page, or None when no kiosk is running (TV off)."""
    try:
        d = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5))
        pages = [p for p in d if p.get("type") == "page"]
        return pages[0]["url"] if pages else None
    except Exception:
        return None

def navigate(url):
    src = open("/home/joe/tv_art/cdp.py").read().split("if __name__")[0]
    ns = {}; exec(compile(src, "cdp", "exec"), ns)
    s = ns["connect"](ns["ws_url"]())
    ns["send"](s, {"id": 1, "method": "Runtime.evaluate", "params": {"expression": "location.href=%s" % json.dumps(url)}})

def games():
    day = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=6)).strftime("%Y-%m-%d")
    u = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=%s&gameType=F,D,L,W" % day
    d = json.load(urllib.request.urlopen(u, timeout=20))
    return [g for x in d.get("dates", []) for g in x["games"]]

def switched():
    try: return set(json.load(open(STATE)).get("games", []))
    except Exception: return set()

def remember(pk):
    s = sorted(switched() | {pk})[-50:]
    json.dump({"games": s}, open(STATE, "w"))

def check():
    """One look. Returns True when there is nothing more to do today."""
    G = games(); now = datetime.datetime.now(datetime.timezone.utc)
    if not G or all(g["status"]["abstractGameState"] == "Final" for g in G): return True
    due = [g for g in G if g["status"]["abstractGameState"] == "Live" or (g["status"]["abstractGameState"] == "Preview" and
           (datetime.datetime.fromisoformat(g["gameDate"].replace("Z", "+00:00")) - now).total_seconds() < PRE_MIN * 60)]
    due = [g for g in due if g["gamePk"] not in switched()]
    if not due: return False
    pk = due[0]["gamePk"]; u = wall_url()
    if u is None: return False                                   # TV off: look again next time
    if "couch.html" in u: remember(pk); print(stamp(), "game", pk, "already on the couch", flush=True); return False
    navigate(PAGE); remember(pk); print(stamp(), "game", pk, ": wall ->", PAGE, "(was", u + ")", flush=True)
    return False

if "--once" in sys.argv:
    try: check()
    except Exception as e: print(stamp(), "error:", e, flush=True)
else:
    t0 = time.time()
    while time.time() - t0 < GIVE_UP_H * 3600:
        try:
            if check(): print(stamp(), "nothing more today", flush=True); break
        except Exception as e:
            print(stamp(), "error:", e, flush=True)
        time.sleep(POLL_S)
