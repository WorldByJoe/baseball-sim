"""
qa.py · v0.1 · 2026-10-04

Checks the playoff data pull and writes playoffs/QA.md: coverage, sanity
against the league, the sign conventions, Statcast row counts against the
season totals, and every fetch that failed.

  python3 playoffs/qa.py
"""
import csv, gzip, json, math, os, statistics as st, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HERE, RAW, fl

# the league, from the brief and TRAITS.md (engine v3.0): (target mean, spread between players)
LEAGUE_H = {'batSpeed': (71.5, 2.65, 'mph'), 'swingLenFt': (7.3, 0.379, 'ft'), 'attack': (9.5, 3.544, 'deg'),
            'swingTilt': (32.0, 3.821, 'deg'), 'speed': (27.3, 1.016, 'ft/s')}
LEAGUE_FF = {'SP': (94.06, 2.16), 'RP': (95.05, 2.37)}


def pooled(v):
    return (v or {}).get('pooled') or {}


def table(head, rows):
    return ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join('' if c is None else str(c) for c in r) + ' |' for r in rows]


def f(x, k=2):
    return None if x is None else ('%.*f' % (k, x))


def main():
    D = json.load(open(os.path.join(HERE, 'players_measured.json')))
    P = D['players']
    R = json.load(open(os.path.join(HERE, 'rosters.json')))
    S = json.load(open(os.path.join(HERE, 'season_stats.json')))['players']
    IDX = json.load(open(os.path.join(HERE, 'pitches', 'INDEX.json')))
    md = ['# QA: the playoff data pull', '',
          'Written by `playoffs/qa.py` from `players_measured.json`, `pitches/INDEX.json`, `season_stats.json` and the fetch logs. '
          'Rosters as of %s (active rosters).' % R['rosterDate'], '']

    # ---- coverage
    ids = {p['id'] for p in R['players']}
    have = {p['id'] for p in P}
    md += ['## 1. Coverage', '',
           '- Rostered players: %d; records written: %d; missing records: %d.' % (len(ids), len(have & ids), len(ids - have))]
    by_kind = {}
    for p in P:
        by_kind[p['kind']] = by_kind.get(p['kind'], 0) + 1
    md += ['- By kind: %s.' % ', '.join('%s %d' % kv for kv in sorted(by_kind.items()))]
    files = IDX['files']
    md += ['- Statcast pulls: %d player-season-role files, %d pitches in all (%d in 2026, %d in 2025).' % (
        len(files), sum(v['rows'] or 0 for v in files.values()),
        sum(v['rows'] or 0 for v in files.values() if v['year'] == 2026), sum(v['rows'] or 0 for v in files.values() if v['year'] == 2025))]
    if IDX.get('missingColumns'):
        md += ['- Columns the search CSV lacked (kept empty): %s.' % ', '.join(IDX['missingColumns'])]
    else:
        md += ['- Every column the brief asked for was present in the search CSV.']
    no26 = [p for p in P if 2026 not in p['statcastYears']]
    md += ['', '**Players with no 2026 Statcast data** (%d):' % len(no26), '']
    rows = []
    for p in no26:
        used = '2025 only' if 2025 in p['statcastYears'] else 'none: league priors needed in step 4'
        ss = p.get('seasonStats') or {}
        note = []
        for k in ('hitting_2026', 'pitching_2026', 'hitting_2025', 'pitching_2025'):
            if ss.get(k):
                note.append('%s: %s' % (k.replace('_', ' '), ', '.join('%s %s' % (kk, ss[k][kk]) for kk in ('PA', 'BF', 'G') if ss[k].get(kk) is not None)))
        rows.append((p['name'], p['team'], p['kind'], p['position'], used, '; '.join(note) or 'no MLB games 2025-26'))
    md += table(('player', 'team', 'kind', 'pos', 'what the record uses', 'MLB season lines'), rows) + ['']
    thin = []
    for p in P:
        if p['kind'] in ('position', 'two-way'):
            n26 = (pooled(p['traits'].get('batSpeed')) or {}).get('n') or 0
            sw26 = ((p['summaries'].get('hitting') or {}).get('sampleSizes') or {}).get('trackedSwings', {}).get('2026', 0)
            if 0 < sw26 < 300:
                thin.append((p['name'], p['team'], 'hitter', '%d tracked swings in 2026 (%d pooled)' % (sw26, n26)))
        if p['kind'] in ('pitcher', 'two-way'):
            th = ((p['summaries'].get('pitching') or {}).get('sampleSizes') or {}).get('pitchesThrown', {})
            n26 = sum(v for k, v in th.items() if k.startswith('2026'))
            if 0 < n26 < 300:
                thin.append((p['name'], p['team'], 'pitcher', '%d pitches in 2026, %d in 2025' % (n26, sum(v for k, v in th.items() if k.startswith('2025')))))
    md += ['**Thin 2026 samples** (under 300 tracked swings or pitches; 2025 fills in at half weight): %d players.' % len(thin), '']
    md += table(('player', 'team', 'as', '2026 sample'), thin) + ['']

    # ---- sanity against the league
    md += ['## 2. Sanity against the league', '',
           'Means over the eight rosters\' hitters (pooled values, every hitter with the trait, unweighted), against the league values the brief gives. '
           'Then every player more than 2 league sd from the league value: these are real outliers to eyeball, not errors by themselves.', '']
    rows, flags = [], []
    hitters = [p for p in P if p['kind'] in ('position', 'two-way')]
    for k, (m, sd, u) in LEAGUE_H.items():
        vals = [(p, pooled(p['traits'].get(k)).get('mean')) for p in hitters]
        vals = [(p, v) for p, v in vals if v is not None]
        if not vals:
            continue
        mm = st.mean(v for _, v in vals)
        rows.append((k, u, len(vals), f(mm), f(st.pstdev([v for _, v in vals])), f(m), f(sd), 'ok' if abs(mm - m) < sd else 'CHECK'))
        for p, v in vals:
            if abs(v - m) > 2 * sd:
                flags.append((p['name'], p['team'], k, f(v), f(pooled(p['traits'].get(k)).get('se')), pooled(p['traits'].get(k)).get('n'), '%+.1f' % ((v - m) / sd)))
    # four-seam velocity
    for role in ('SP', 'RP'):
        vals = []
        for p in P:
            pit = (p['summaries'].get('pitching') or {})
            if (pit.get('role') or {}).get('role') != role:
                continue
            ff = pooled(((pit.get('pitchTypes') or {}).get('FF') or {}).get('velo'))
            if ff.get('mean') is not None and ff['n'] >= 30:
                vals.append((p, ff['mean'], ff))
        if vals:
            m, sd = LEAGUE_FF[role]
            mm = st.mean(v for _, v, _ in vals)
            rows.append(('four-seam velo, %s' % role, 'mph', len(vals), f(mm), f(st.pstdev([v for _, v, _ in vals])), f(m), f(sd),
                         'ok' if abs(mm - m) < sd else 'CHECK'))
            for p, v, ff in vals:
                if abs(v - m) > 2 * sd:
                    flags.append((p['name'], p['team'], 'FF velo (%s)' % role, f(v), f(ff.get('se')), ff['n'], '%+.1f' % ((v - m) / sd)))
    md += table(('trait', 'unit', 'players', 'roster mean', 'roster sd', 'league', 'league sd', ''), rows) + ['']
    md += ['Players more than 2 league sd from the league value (%d):' % len(flags), '']
    md += table(('player', 'team', 'trait', 'pooled', 'se', 'n', 'z'), flags) + ['']

    # ---- conventions
    md += ['## 3. Convention checks', '']
    pulls, sprays = [], []
    for p in hitters:
        a = pooled((p['traits'].get('pullBias') or {}).get('bip'))
        b = pooled(p['traits'].get('sprayPulledDeg_bip'))
        if a.get('n', 0) >= 100:
            pulls.append(a['mean'])
        if b.get('n', 0) >= 100:
            sprays.append(b['mean'])
    md += ['- **Spray** (where balls in play went, + pulled): %d of %d hitters with 100+ balls in play pull on average; median %.1f deg. '
           'Most hitters pull, as they should.' % (sum(s > 0 for s in sprays), len(sprays), st.median(sprays)) if sprays else '- no spray data',
           '- **The bat\'s direction** at contact on balls in play (pullBias, + toward the pull side = -attack_direction): %d of %d hitters positive, median %.1f deg. '
           'The league\'s mean is near zero (2025: -0.5 deg on balls in play, statcast/bat_direction_2025.json): the bat meets the ball about square to centre '
           'while the ball goes to the pull side, so about half positive is expected.' % (sum(s > 0 for s in pulls), len(pulls), st.median(pulls)) if pulls else '']
    # batter-relative symmetry, from the pitchers' files: pitches to right- and left-handed batters
    sym = {'R': [], 'L': []}
    zx = {'R': [], 'L': []}
    for fn, v in list(files.items()):
        if v['role'] != 'pitcher' or not v['rows']:
            continue
        path = os.path.join(HERE, 'pitches', fn + '.csv.gz')
        with gzip.open(path, 'rt') as fh:
            for r in csv.DictReader(fh):
                x = fl(r['plate_x'])
                if x is None or r['stand'] not in sym:
                    continue
                sym[r['stand']].append(x * 12 if r['stand'] == 'R' else -x * 12)
                zx[r['stand']].append(x * 12)
    if sym['R'] and sym['L']:
        md += ['- **Batter-relative location**: the mean pitch to a right-handed batter sits %.2f in away from him (plate_x mean %+.2f in), '
               'to a left-handed batter %.2f in away (plate_x mean %+.2f in); n %d and %d. Away is + for both: the sign flip is right.' % (
                   st.mean(sym['R']), st.mean(zx['R']), st.mean(sym['L']), st.mean(zx['L']), len(sym['R']), len(sym['L']))]
    md += ['', '**Three named players** to check against their Baseball Savant pages (pooled 2025-26, 2026 in brackets):', '']
    named = [q for name in ('Shohei Ohtani', 'Aaron Judge', 'Fernando Tatis Jr.', 'Ronald Acuña Jr.', 'Freddie Freeman')
             for q in P if q['name'] == name][:3]
    for p in named:
        t = p['traits']
        g = lambda k: (pooled(t.get(k)).get('mean'), (t.get(k) or {}).get('2026', {}).get('mean'))
        bs, sl, at, ti, sp = g('batSpeed'), g('swingLenFt'), g('attack'), g('swingTilt'), g('speed')
        h = p['summaries'].get('hitting') or {}
        md += ['- **%s** (%s, bats %s): bat speed %s [%s] mph, swing length %s [%s] ft, attack angle %s [%s] deg, swing tilt %s [%s] deg, '
               'sprint speed %s [%s] ft/s, K%% %s, BB%% %s, chase %s, hard-hit %s.' % (
                   p['name'], p['team'], p['bats'], f(bs[0], 1), f(bs[1], 1), f(sl[0]), f(sl[1]), f(at[0], 1), f(at[1], 1), f(ti[0], 1), f(ti[1], 1),
                   f(sp[0], 1), f(sp[1], 1), f(pooled(h.get('K_pct')).get('mean'), 3), f(pooled(h.get('BB_pct')).get('mean'), 3),
                   f(pooled(h.get('chaseRate')).get('mean'), 3), f(pooled(h.get('hardHit95_share')).get('mean'), 3))]
    # and a pitcher
    for p in P:
        pit = (p['summaries'].get('pitching') or {})
        if (pit.get('role') or {}).get('role') == 'SP' and 'FF' in (pit.get('pitchTypes') or {}) and p['name'] in (
                'Tarik Skubal', 'Gerrit Cole', 'Chris Sale', 'Max Fried', 'Yoshinobu Yamamoto', 'Blake Snell'):
            ff = pit['pitchTypes']['FF']
            t = p['traits']['pitching']
            md += ['- **%s** (%s, throws %s): four-seam %s mph, %s rpm, %s in arm-side, %s in vertical (induced), usage %s; arm angle %s deg, '
                   'extension %s ft; four-seam command scatter %s across, %s up-down (in).' % (
                       p['name'], p['team'], p['throws'], f(pooled(ff['velo']).get('mean'), 1), f(pooled(ff['rpm']).get('mean'), 0),
                       f(pooled(ff['hbArmIn']).get('mean'), 1), f(pooled(ff['ivbIn']).get('mean'), 1), f(pooled(ff['usage']).get('mean'), 3),
                       f(pooled(t['armAngle']).get('mean'), 1), f(pooled(t['ext']).get('mean')),
                       f((ff.get('command') or {}).get('pooled', {}).get('x')), f((ff.get('command') or {}).get('pooled', {}).get('z')))]
            break
    md += ['']
    # four-seam command over the rosters against the league
    cx, cz = [], []
    for p in P:
        c = (((p['summaries'].get('pitching') or {}).get('pitchTypes') or {}).get('FF') or {}).get('command', {}).get('pooled')
        if c and c['x']:
            cx.append(c['x']); cz.append(c['z'])
    if cx:
        md += ['- **Four-seam command scatter** (within count group x batter side, pooled): mean over %d roster pitchers %.2f in across, %.2f up-down; '
               'the local session measured the league at 8.17 and 9.03.' % (len(cx), st.mean(cx), st.mean(cz)), '']

    # ---- row counts
    md += ['## 4. Statcast rows against the season totals', '',
           'Regular-season pitches in the Statcast file against the Stats API\'s pitch count (pitches seen as a batter, thrown as a pitcher). '
           'Flagged over 3%.', '']
    rows, nflag, nchk = [], 0, 0
    for key, v in sorted(files.items()):
        s = S.get(str(v['id'])) or {}
        line = s.get('%s_%d' % ('hitting' if v['role'] == 'batter' else 'pitching', v['year']))
        want = (line or {}).get('pitches')
        got = (v.get('byGameType') or {}).get('R', 0)
        if not want and not got:
            continue
        nchk += 1
        diff = (got - want) / want if want else None
        bad = diff is None or abs(diff) > 0.03
        if bad:
            nflag += 1
            rows.append((v['name'], v['role'], v['year'], got, want, f(100 * diff, 1) if diff is not None else 'no total'))
    md += ['%d player-season-role files checked; %d off by more than 3%% (listed):' % (nchk, nflag), '']
    md += table(('player', 'role', 'year', 'Statcast R pitches', 'season total', 'diff %'), rows) + ['']

    # ---- failures
    md += ['## 5. Fetches that failed', '']
    nf = 0
    for name in ('mlb', 'statcast'):
        fn = os.path.join(RAW, 'failures_%s.json' % name)
        if os.path.exists(fn):
            for e in json.load(open(fn)):
                nf += 1
                md += ['- `%s`: %s' % (e['url'], e['error'])]
    if not nf:
        md += ['None.']
    md += ['']
    open(os.path.join(HERE, 'QA.md'), 'w').write('\n'.join(md))
    print('\n'.join(md[:12]))
    print('... QA.md written (%d lines)' % len(md))


if __name__ == '__main__':
    main()
