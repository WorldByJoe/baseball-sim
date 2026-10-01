"""
fetch_pitches.py · v0.1 · 2026-10-01

Pulls pitch-level Statcast (Baseball Savant's search CSV, no account) one day
per request into statcast/raw/pitches/<year>/<date>.csv, for measuring what a
foul ball is (statcast/fouls.py). The server caps a response near 25,000 rows
and a day of MLB is about 4,500-5,000 pitches, so a day never hits the cap; a
response that comes close is reported. Every day is cached (an off day as a
header-only file), so a rerun fetches nothing twice. Polite: a pause between
requests, and up to four retries with backoff.

Run:  python3 statcast/fetch_pitches.py                      # the default plan
      python3 statcast/fetch_pitches.py --dates 2025-05-05:2025-05-18,2025-07-01

Default plan (2025 regular season, six weeks spread across the year):
  2025-05-05..05-18, 2025-06-30..07-13 (ends before the All-Star break),
  2025-09-08..09-21.

CHANGED
  v0.1  first build
"""
import sys, os, time, datetime, urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}
URL = ('https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details'
       '&player_type=batter&game_date_gt={d}&game_date_lt={d}&hfSea={y}%7C&hfGT=R%7C'
       '&min_pitches=0&min_results=0&group_by=name&sort_col=pitches'
       '&player_event_sort=api_p_release_speed&sort_order=desc')
DEFAULT = '2025-05-05:2025-05-18,2025-06-30:2025-07-13,2025-09-08:2025-09-21'
CAP = 25000                  # rows; the server truncates near here
PAUSE = 2.0                  # seconds between requests

def parse_dates(spec):
    """'a:b,c' -> sorted list of dates (ranges inclusive)."""
    out = set()
    for part in spec.split(','):
        part = part.strip()
        if not part: continue
        a, _, b = part.partition(':')
        d0 = datetime.date.fromisoformat(a); d1 = datetime.date.fromisoformat(b or a)
        while d0 <= d1:
            out.add(d0); d0 += datetime.timedelta(days=1)
    return sorted(out)

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()

def fetch_day(d, outdir):
    path = os.path.join(outdir, d.isoformat() + '.csv')
    if os.path.exists(path):
        return 'cached', path
    url = URL.format(d=d.isoformat(), y=d.year)
    for attempt in range(5):
        try:
            data = get(url); break
        except Exception as e:
            if attempt == 4: return 'FAILED %s' % str(e)[:80], None
            time.sleep(2 ** (attempt + 1))
    text = data.decode('utf-8-sig', 'replace')
    first = text.split('\n', 1)[0]
    if text.lstrip().startswith('<') or 'pitch_type' not in first:
        return 'not a CSV (%d bytes)' % len(data), None
    tmp = path + '.part'
    with open(tmp, 'w', encoding='utf-8') as f: f.write(text)
    os.replace(tmp, path)
    time.sleep(PAUSE)
    return 'fetched', path

def main(argv):
    spec = DEFAULT
    if '--dates' in argv:
        spec = argv[argv.index('--dates') + 1]
    days = parse_dates(spec)
    total = 0
    for d in days:
        outdir = os.path.join('statcast', 'raw', 'pitches', str(d.year)); os.makedirs(outdir, exist_ok=True)
        status, path = fetch_day(d, outdir)
        rows = 0
        if path:
            with open(path, encoding='utf-8') as f: rows = max(0, sum(1 for _ in f) - 1)
        total += rows
        warn = '  NEAR THE ROW CAP: split this day' if rows >= CAP * 0.95 else ''
        print('  %s  %-8s %6d rows%s' % (d.isoformat(), status, rows, warn))
    print('%d days, %d rows' % (len(days), total))

if __name__ == '__main__':
    main(sys.argv[1:])
