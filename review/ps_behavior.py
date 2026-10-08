"""
ps_behavior.py · v0.1 · 2026-10-07

What the pitchers did in the postseason games that they did not do in the season: each pitcher's outing in
each game (MLB's live feed, playoffs/games/<pk>_feed.json) against his own 2026 regular-season games
(playoffs/pitches/2026_pitcher_<id>.csv.gz, game_type R; 2025 added when 2026 has under 8 games). For each
pitch type he threw 5+ times in the game: speed, spin, induced vertical and horizontal break (inches),
extension; and for the outing: his mix, his share of pitches in the zone, and his pitch count. Each game value is
set against the spread of the same value from one regular-season game to the next (his own per-game means and shares,
games with 5+ of that type), as a z-score, so "outside normal" means outside his own game-to-game range.

  python3 review/ps_behavior.py [pk ...]   ->  review/ps_behavior.json, and a summary

CHANGED
  v0.1  first build (Joe, 2026-10-07: were the pitchers throwing harder than in the season?)
"""
import json, sys, gzip, csv, os, math, glob
from collections import defaultdict

GAMES = [849829, 849834, 849833, 849835, 849839, 849838, 849828, 849823, 849819, 849822, 849830, 849825, 849826, 849827]
FB = ('FF', 'SI', 'FC')


def fnum(x):
    try: return float(x)
    except (TypeError, ValueError): return None


def season(pid):
    rows = []
    for yr in ('2026', '2025'):
        f = 'playoffs/pitches/%s_pitcher_%s.csv.gz' % (yr, pid)
        if not os.path.exists(f): continue
        rs = [r for r in csv.DictReader(gzip.open(f, 'rt')) if r['game_type'] == 'R']
        rows += rs
        if len({r['game_pk'] for r in rows}) >= 8: break
    G = defaultdict(list)
    for r in rows:
        sz_t, sz_b, px, pz = fnum(r['sz_top']), fnum(r['sz_bot']), fnum(r['plate_x']), fnum(r['plate_z'])
        inz = None if None in (sz_t, sz_b, px, pz) else (abs(px) <= 0.83 and sz_b <= pz <= sz_t)
        G[r['game_pk']].append({'t': r['pitch_type'], 'v': fnum(r['release_speed']), 's': fnum(r['release_spin_rate']),
                                'ivb': None if fnum(r['pfx_z']) is None else fnum(r['pfx_z']) * 12, 'hb': None if fnum(r['pfx_x']) is None else fnum(r['pfx_x']) * 12,
                                'ext': fnum(r['release_extension']), 'z': inz})
    return G


def game_pitches(feed):
    by = defaultdict(list)
    for pl in feed['liveData']['plays']['allPlays']:
        pid = pl['matchup']['pitcher']['id']
        for ev in pl['playEvents']:
            if not ev.get('isPitch'): continue
            pd = ev.get('pitchData') or {}; c = pd.get('coordinates') or {}; b = pd.get('breaks') or {}
            t = ((ev.get('details') or {}).get('type') or {}).get('code')
            sz_t, sz_b = pd.get('strikeZoneTop'), pd.get('strikeZoneBottom')
            px, pz = c.get('pX'), c.get('pZ')
            inz = None if None in (sz_t, sz_b, px, pz) else (abs(px) <= 0.83 and sz_b <= pz <= sz_t)
            hb = b.get('breakHorizontal')   # the feed's breaks are Statcast's: induced vertical, and horizontal with the sign of pfx_x reversed (its pfxX/pfxZ are PITCHf/x's, over the last 40 ft)
            by[pid].append({'t': t, 'v': pd.get('startSpeed'), 's': b.get('spinRate'), 'ivb': b.get('breakVerticalInduced'), 'hb': None if hb is None else -hb, 'ext': pd.get('extension'), 'z': inz})
    return by


def mean(a): a = [x for x in a if x is not None]; return sum(a) / len(a) if a else None


def sd(a):
    a = [x for x in a if x is not None]
    if len(a) < 3: return None
    m = sum(a) / len(a); return math.sqrt(sum((x - m) ** 2 for x in a) / (len(a) - 1))


def compare(game, G):
    out = {'n': len(game), 'types': {}, 'flags': []}
    games = list(G.values())
    # per pitch type: speed, spin, breaks, extension
    for t in sorted({p['t'] for p in game if p['t']}):
        gp = [p for p in game if p['t'] == t]
        if len(gp) < 5: continue
        rec = {'n': len(gp)}
        for k in ('v', 's', 'ivb', 'hb', 'ext'):
            per = [mean([p[k] for p in g if p['t'] == t]) for g in games if sum(1 for p in g if p['t'] == t) >= 5]
            m, s, x = mean(per), sd(per), mean([p[k] for p in gp])
            if m is None or x is None: continue
            rec[k] = {'game': round(x, 2), 'season': round(m, 2), 'delta': round(x - m, 2), 'z': round((x - m) / s, 2) if s else None, 'games': len(per)}
        out['types'][t] = rec
    # the mix: each type's share against his season share
    allp = [p for g in games for p in g]
    for t in sorted({p['t'] for p in game + allp if p['t']}):
        g_sh = sum(1 for p in game if p['t'] == t) / len(game)
        s_sh = sum(1 for p in allp if p['t'] == t) / len(allp) if allp else 0
        per = [sum(1 for p in g if p['t'] == t) / len(g) for g in games if len(g) >= 10]   # his share game to game
        s_g = sd(per)
        zz = (g_sh - mean(per)) / s_g if s_g and per else None
        if abs(g_sh - s_sh) >= 0.10 and zz is not None: out['flags'].append({'what': 'mix', 'type': t, 'game': round(g_sh, 3), 'season': round(s_sh, 3), 'z': round(zz, 2)})
        out.setdefault('mix', {})[t] = [round(g_sh, 3), round(s_sh, 3)]
    # the zone and the workload
    zg = mean([1.0 if p['z'] else 0.0 for p in game if p['z'] is not None])
    zper = [mean([1.0 if p['z'] else 0.0 for p in g if p['z'] is not None]) for g in games if len(g) >= 10]
    if zg is not None and zper: out['zone'] = {'game': round(zg, 3), 'season': round(mean(zper), 3), 'z': round((zg - mean(zper)) / sd(zper), 2) if sd(zper) else None}
    npg = [len(g) for g in games]
    out['pitches'] = {'game': len(game), 'season_mean': round(mean(npg), 1) if npg else None, 'season_max': max(npg) if npg else None}
    return out


def main(pks):
    P = json.load(open('review/pitchers_fit.json'))['pitchers']
    res = []
    for pk in pks:
        f = 'playoffs/games/%d_feed.json' % pk
        if not os.path.exists(f): continue
        feed = json.load(open(f)); by = game_pitches(feed)
        gd = feed['gameData']; teams = {gd['teams']['away']['id']: gd['teams']['away']['abbreviation'], gd['teams']['home']['id']: gd['teams']['home']['abbreviation']}
        for pid, game in by.items():
            G = season(pid)
            if len(G) < 3: continue
            c = compare(game, G); c.update({'pk': pk, 'pitcher': pid, 'name': (P.get(str(pid)) or {}).get('name', str(pid)), 'team': (P.get(str(pid)) or {}).get('team'), 'seasonGames': len(G)})
            res.append(c)
    json.dump(res, open('review/ps_behavior.json', 'w'), indent=0)
    # summary: the fastball's speed
    rows = [(r, t, r['types'][t]['v']) for r in res for t in r['types'] if t in FB and 'v' in r['types'][t] and r['types'][t]['v']['z'] is not None]
    d = [v['delta'] for _, _, v in rows]; z = [v['z'] for _, _, v in rows]; w = [r['types'][t]['n'] for r, t, _ in rows]
    print('%d pitcher-games, %d fastball-type rows' % (len(res), len(rows)))
    print('fastball speed vs his season: mean %+.2f mph (pitch-weighted %+.2f); mean z %+.2f; z > +1: %d of %d, z > +2: %d, z < -2: %d' % (
        mean(d), sum(a * b for a, b in zip(d, w)) / sum(w), mean(z), sum(1 for x in z if x > 1), len(z), sum(1 for x in z if x > 2), sum(1 for x in z if x < -2)))
    for k, lab in (('s', 'spin'), ('ivb', 'induced vertical break'), ('hb', 'horizontal break'), ('ext', 'extension')):
        zz = [r['types'][t][k]['z'] for r in res for t in r['types'] if k in r['types'][t] and r['types'][t][k]['z'] is not None]
        dd = [r['types'][t][k]['delta'] for r in res for t in r['types'] if k in r['types'][t] and r['types'][t][k]['z'] is not None]
        print('%s (all types): mean delta %+.2f, mean z %+.2f, |z| > 2: %d of %d' % (lab, mean(dd), mean(zz), sum(1 for x in zz if abs(x) > 2), len(zz)))
    zz = [r['zone']['z'] for r in res if r.get('zone') and r['zone']['z'] is not None]
    print('zone share: mean z %+.2f, |z| > 2: %d of %d' % (mean(zz), sum(1 for x in zz if abs(x) > 2), len(zz)))
    print('mix shifts of 10+ points with |z| > 2: %d' % sum(1 for r in res for f in r['flags'] if f['what'] == 'mix' and abs(f['z']) > 2))


if __name__ == '__main__':
    main([int(a) for a in sys.argv[1:]] or GAMES)
