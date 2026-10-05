"""
common.py · v0.1 · 2026-10-04

Shared by the playoff data scripts: a polite, cached HTTP fetch and the paths.

Every response is cached under playoffs/raw/ (gitignored), so a rerun fetches
nothing twice. Baseball Savant gets at least PAUSE_SAVANT seconds between
requests; every request retries up to four times with backoff (2, 4, 8, 16 s).
The retry and cache pattern follows statcast/fetch_pitches.py.
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}
PAUSE_SAVANT = 2.0
PAUSE_STATSAPI = 0.25
TEAMS = (145, 114, 147, 139, 144, 119, 135, 158)
ROSTER_DATE = '2026-10-04'
_last = {}
_dead = {}             # host -> consecutive fetches that failed every retry; at 2 the host is skipped this run
FAILURES = []          # (url, error) for the QA report


def _get(url, timeout=180):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch(url, path, pause=None, check=None, timeout=180):
    """bytes of url, cached at path (relative to RAW). check(bytes) -> error string or None.
    Returns None (and records the failure) if every attempt fails."""
    full = os.path.join(RAW, path)
    if os.path.exists(full):
        with open(full, 'rb') as f:
            return f.read()
    if pause is None:
        pause = PAUSE_SAVANT if 'baseballsavant' in url else PAUSE_STATSAPI
    host = url.split('/')[2]
    if _dead.get(host, 0) >= 2:
        FAILURES.append((url, 'skipped: %s failed twice this run' % host))
        return None
    wait = _last.get(host, 0) + pause - time.time()
    if wait > 0:
        time.sleep(wait)
    err = None
    for attempt in range(5):
        try:
            data = _get(url, timeout)
            _last[host] = time.time()
            err = check(data) if check else None
            if err is None:
                break
        except Exception as e:
            _last[host] = time.time()
            err = str(e)[:120]
        if attempt < 4:
            time.sleep(2 ** (attempt + 1))
    if err is not None:
        _dead[host] = _dead.get(host, 0) + 1
        FAILURES.append((url, err))
        print('  FAILED %s: %s' % (url, err), file=sys.stderr)
        return None
    _dead[host] = 0
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full + '.part', 'wb') as f:
        f.write(data)
    os.replace(full + '.part', full)
    return data


def fetch_json(url, path, **kw):
    def ok(b):
        try:
            json.loads(b)
            return None
        except Exception as e:
            return 'not JSON: %s' % str(e)[:60]
    data = fetch(url, path, check=ok, **kw)
    return json.loads(data) if data is not None else None


def csv_check(key):
    """a check that the response is a CSV whose header names `key`"""
    def ok(b):
        head = b[:4000].decode('utf-8-sig', 'replace').split('\n', 1)[0]
        if b.lstrip()[:1] == b'<' or key not in head:
            return 'not a CSV with %s (%d bytes)' % (key, len(b))
        return None
    return ok


def write_failures(name):
    """append this run's failures to raw/failures_<name>.json (read by qa.py)"""
    fn = os.path.join(RAW, 'failures_%s.json' % name)
    json.dump([{'url': u, 'error': e} for u, e in FAILURES], open(fn, 'w'), indent=1)


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None
