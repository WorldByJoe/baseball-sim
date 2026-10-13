"""
fetch_injuries.py · v0.1 · 2026-10-13

Every injured-list stint of 2024-26 from MLB's transactions (statsapi /transactions, month by month; Joe, 2026-10-13:
how long a man is on the injured list as an index of how bad the injury was, and his play before and after it).
A stint opens when his team places him on the injured list (on the date it was made retroactive to, when it was) and
closes when he is activated (or reinstated) from it; a transfer to the 60-day list keeps it open. The injury is the
placement's last sentence ("Right elbow inflammation."). A stint still open at the data's end is kept with no end.
Rehab assignments are listed with their dates (the time a man plays in the minors on the way back).

Writes season/injuries.json: the stints (player, team, list, placed, activated, days, injury, body part) and the raw
injured-list transactions.

  python3 season/fetch_injuries.py

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import json, os, re, datetime, urllib.request, time
HERE = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'Mozilla/5.0 (research script; CSU; baseball trait model)'}
PARTS = ['elbow', 'shoulder', 'hamstring', 'oblique', 'back', 'knee', 'ankle', 'wrist', 'hand', 'finger', 'thumb', 'forearm', 'groin', 'hip', 'calf', 'foot',
         'neck', 'lat', 'rotator', 'ucl', 'quad', 'concussion', 'illness', 'side', 'abdominal', 'achilles', 'toe', 'biceps', 'triceps', 'rib', 'chest', 'pectoral', 'head', 'eye', 'leg', 'arm', 'heel', 'shin', 'thigh', 'adductor']


def get(u):
    for k in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60))
        except Exception:
            time.sleep(2 ** k)
    raise RuntimeError(u)


def part_of(txt):
    t = txt.lower()
    for p in PARTS:
        if re.search(r'\b%s' % p, t): return p
    return 'other'


def main():
    raw = []
    d = datetime.date(2024, 1, 1)
    while d < datetime.date(2026, 12, 1):
        e = (d.replace(day=28) + datetime.timedelta(days=4)).replace(day=1) - datetime.timedelta(days=1)
        T = get('https://statsapi.mlb.com/api/v1/transactions?sportId=1&startDate=%s&endDate=%s' % (d, e)).get('transactions', [])
        for t in T:
            s = t.get('description') or ''
            if 'injured list' in s.lower() or 'rehab assignment' in s.lower():
                raw.append({'id': (t.get('person') or {}).get('id'), 'name': (t.get('person') or {}).get('fullName'), 'team': (t.get('toTeam') or t.get('fromTeam') or {}).get('abbreviation') or (t.get('toTeam') or {}).get('name'),
                            'date': t.get('date'), 'effective': t.get('effectiveDate') or t.get('date'), 'desc': s})
        print('%s: %d transactions, %d injured-list or rehab so far' % (d.strftime('%Y-%m'), len(T), len(raw)), flush=True)
        d = e + datetime.timedelta(days=1)
    raw.sort(key=lambda r: (r['id'] or 0, r['effective'], r['date']))
    stints, open_ = [], {}
    for r in raw:
        s = r['desc'].lower(); pid = r['id']
        if pid is None: continue
        if ' placed ' in s and 'injured list' in s:
            if pid in open_: continue   # already on the list (a re-placement): the stint goes on
            m = re.search(r'(\d+)-day injured list', s)
            inj = r['desc'].rstrip('.').split('. ')[-1] if '. ' in r['desc'] else ''
            open_[pid] = {'id': pid, 'name': r['name'], 'team': r['team'], 'list': int(m.group(1)) if m else None, 'placed': r['effective'], 'injury': inj, 'part': part_of(inj), 'rehab': [], 'moved60': None}
        elif ('activated' in s or 'reinstated' in s) and 'injured list' in s and pid in open_:
            st = open_.pop(pid); st['activated'] = r['effective']
            st['days'] = (datetime.date.fromisoformat(st['activated'][:10]) - datetime.date.fromisoformat(st['placed'][:10])).days
            stints.append(st)
        elif 'transferred' in s and '60-day' in s and pid in open_:
            open_[pid]['moved60'] = r['effective']
        elif 'rehab assignment' in s and pid in open_:
            open_[pid]['rehab'].append(r['effective'])
    for st in open_.values():
        st['activated'] = None; st['days'] = None; stints.append(st)
    json.dump({'note': 'injured-list stints from MLB transactions, 2024-26 (season/fetch_injuries.py)', 'stints': stints, 'raw': raw}, open(os.path.join(HERE, 'injuries.json'), 'w'), indent=0)
    done = [s for s in stints if s['days'] is not None]
    print('%d stints (%d closed); days on the list: median %d, quartiles %d-%d' % (len(stints), len(done), sorted(s['days'] for s in done)[len(done) // 2],
          sorted(s['days'] for s in done)[len(done) // 4], sorted(s['days'] for s in done)[3 * len(done) // 4]))


if __name__ == '__main__':
    main()
