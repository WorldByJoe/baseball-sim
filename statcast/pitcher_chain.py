"""
pitcher_chain.py · v0.1 · 2026-10-02

The pitcher's body and delivery, measured per pitcher from pitch-level
Statcast, for building the pitcher's chain in bb_engine.js: how his arm slot
sets his release point and the direction his pitches spin, how his release
point follows his height, how starters and relievers differ in speed, and
how spin follows speed. Heights and weights come from the MLB Stats API list
(statcast/raw/<year>/players.json); shoulder and release positions from the
arm-angle leaderboard (statcast/raw/<year>/arm_angle.csv).

Horizontal positions are feet toward the pitcher's ARM side. A pitch type's
spin direction is degrees from straight up toward his arm side, read from
Statcast's spin_axis (180 = pure backspin), the engine's `tilt` convention.

Writes statcast/pitcher_chain_<year>.json, and the REPERTOIRES block of
bb_engine.js between its marker lines: every pitcher's arm slot, role and pitch
mix (the share of each engine type, 3% or more), from which the engine draws
a pitcher's repertoire among those with a similar slot.

  python3 statcast/pitcher_chain.py 2025-05-05:2025-09-21

CHANGED
  v0.1  first build
"""
import csv, json, math, os, sys, collections, statistics as st
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swing_geometry import load

TYPES = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'KC', 'CH', 'FS']
ENGINE_TYPES = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS']
BEGIN = '  // ---- REPERTOIRES: written by statcast/pitcher_chain.py; do not edit by hand ----'
END = '  // ---- REPERTOIRES: end ----'
MAP = {'KC': 'CU', 'SV': 'SL', 'FO': 'FS'}


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def height_in(h):
    try:
        f, i = h.replace('"', '').split("'")
        return int(f) * 12 + int(i.strip() or 0)
    except Exception:
        return None


def reg(xs, ys):
    mx, my = st.mean(xs), st.mean(ys)
    sxx = sum((x - mx) ** 2 for x in xs); sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys)); syy = sum((y - my) ** 2 for y in ys)
    b = sxy / sxx; a = my - b * mx
    res = math.sqrt(max(syy - b * sxy, 0) / (len(xs) - 2))
    return a, b, sxy / math.sqrt(sxx * syy), res


def main(spec):
    here = os.path.dirname(os.path.abspath(__file__))
    year = spec[:4]
    people = {q['id']: q for q in json.load(open(os.path.join(here, 'raw', year, 'players.json')))['people']}
    rows = load(spec)
    per = collections.defaultdict(lambda: {'n': 0, 'games': set(), 'arm': [], 'rz': [], 'rx': [], 'ext': [], 'types': collections.defaultdict(lambda: collections.defaultdict(list))})
    for r in rows:
        if (r.get('game_type') or 'R') != 'R':
            continue
        pid = int(r['pitcher']); p = per[pid]
        side = 1 if r.get('p_throws') == 'L' else -1          # the engine's armSide: a right-hander releases from -x
        p['hand'] = r.get('p_throws'); p['n'] += 1; p['games'].add(r['game_pk'])
        for k, col, f in (('arm', 'arm_angle', 1), ('rz', 'release_pos_z', 1), ('rx', 'release_pos_x', side), ('ext', 'release_extension', 1)):
            v = fl(r.get(col))
            if v is not None:
                p[k].append(v * f)
        t = MAP.get(r.get('pitch_type'), r.get('pitch_type'))
        if t not in TYPES:
            continue
        p.setdefault('mix', collections.Counter())[t] += 1
        T = p['types'][t]
        for k, col in (('velo', 'release_speed'), ('spin', 'release_spin_rate'), ('axis', 'spin_axis'), ('px', 'pfx_x'), ('pz', 'pfx_z')):
            v = fl(r.get(col))
            if v is not None:
                T[k].append(v)
        T['side'] = side
    P = []
    for pid, p in per.items():
        if p['n'] < 150 or not p['arm']:
            continue
        q = people.get(pid, {})
        d = {'id': pid, 'hand': p['hand'], 'n': p['n'], 'ppg': p['n'] / len(p['games']), 'arm': st.mean(p['arm']), 'rz': st.mean(p['rz']), 'rx': st.mean(p['rx']),
             'ext': st.mean(p['ext']) if p['ext'] else None, 'height': height_in(q.get('height')), 'weight': q.get('weight'), 'types': {}}
        d['role'] = 'SP' if d['ppg'] >= 40 else 'RP'
        mx = p.get('mix', collections.Counter()); tot = sum(mx.values()) or 1
        d['mix'] = {t: mx[t] / tot for t in ENGINE_TYPES if mx[t] / tot >= 0.03}
        for t, T in p['types'].items():
            if len(T['velo']) < 25 or not T['axis']:
                continue
            side = T['side']
            ax = st.mean(T['axis'])
            tilt = (ax - 180) * (-side)            # degrees from straight up toward his arm side (sign checked against pfx below)
            hb = st.mean(T['px']) * 12 * side; ivb = st.mean(T['pz']) * 12
            d['types'][t] = {'n': len(T['velo']), 'velo': st.mean(T['velo']), 'spin': st.mean(T['spin']) if T['spin'] else None, 'tilt': tilt,
                             'hb': hb, 'ivb': ivb, 'move_dir': math.degrees(math.atan2(hb, ivb))}
        P.append(d)
    J, out = {'pitchers': len(P)}, []
    out.append('pitchers with 150+ pitches: %d (starters %d)' % (len(P), sum(d['role'] == 'SP' for d in P)))
    # sign check: spin-axis tilt against the movement direction, four-seamers
    ff = [d for d in P if 'FF' in d['types']]
    a, b, r, res = reg([d['types']['FF']['tilt'] for d in ff], [d['types']['FF']['move_dir'] for d in ff])
    out.append('check: four-seam movement direction against spin-axis tilt, slope %.2f r %.2f (n %d)' % (b, r, len(ff)))
    # 1. speed by role
    J['velo'] = {}
    for t in ('FF', 'SI'):
        for rl in ('SP', 'RP'):
            v = [d['types'][t]['velo'] for d in P if d['role'] == rl and t in d['types']]
            J['velo'][t + rl] = [st.mean(v), st.pstdev(v), len(v)]
            out.append('%s speed, %s: %.2f +- %.2f mph (n %d)' % (t, 'starters' if rl == 'SP' else 'relievers', st.mean(v), st.pstdev(v), len(v)))
    # 2. arm angle
    arms = [d['arm'] for d in P]
    J['arm'] = [st.mean(arms), st.pstdev(arms)]
    out.append('arm angle: %.1f +- %.1f deg (starters %.1f, relievers %.1f)' % (st.mean(arms), st.pstdev(arms), st.mean(d['arm'] for d in P if d['role'] == 'SP'), st.mean(d['arm'] for d in P if d['role'] == 'RP')))
    # 3. release point from height and arm angle
    hp = [d for d in P if d['height']]
    xs = [d['height'] for d in hp]
    a1, b1, r1, s1 = reg(xs, [d['rz'] for d in hp])
    out.append('release height on height: %.3f + %.4f ft/in (r %.2f, resid %.2f ft)' % (a1, b1, r1, s1))
    # the arm as a lever from the shoulder (arm-angle leaderboard): shoulder height and arm length over height
    lb = {}
    with open(os.path.join(here, 'raw', year, 'arm_angle.csv'), encoding='utf-8-sig') as f:
        for q in csv.DictReader(f):
            lb[int(q['pitcher'])] = q
    sh, al, ang = [], [], []
    for d in hp:
        q = lb.get(d['id'])
        if not q:
            continue
        sz, rz, sx, rx = fl(q['shoulder_z']), fl(q['release_ball_z']), fl(q['relative_shoulder_x']), fl(q['relative_release_ball_x'])
        if None in (sz, rz, sx, rx):
            continue
        h = d['height'] / 12.0
        sh.append(sz / h); al.append(math.hypot(rz - sz, rx - sx) / h); ang.append((d['arm'], math.degrees(math.atan2(rz - sz, abs(rx - sx)))))
    J['shoulder_over_height'] = [st.mean(sh), st.pstdev(sh)]
    J['arm_over_height'] = [st.mean(al), st.pstdev(al)]
    out.append('shoulder height / height %.3f +- %.3f; shoulder-to-ball at release / height %.3f +- %.3f (n %d)' % (st.mean(sh), st.pstdev(sh), st.mean(al), st.pstdev(al), len(sh)))
    out.append('check: leaderboard arm angle against atan of the lever, r %.2f' % reg([x for x, _ in ang], [y for _, y in ang])[2])
    off = [d['rx'] - J['arm_over_height'][0] * d['height'] / 12.0 * math.cos(math.radians(d['arm'])) for d in hp]
    J['side_offset'] = [st.mean(off), st.pstdev(off)]
    out.append('release side less the arm lever across (0.372 x height x cos arm angle): %.2f +- %.2f ft (where he stands on the rubber, and his shoulder)' % (st.mean(off), st.pstdev(off)))
    rzr = [d['rz'] - d['height'] / 12.0 * (J['shoulder_over_height'][0] + J['arm_over_height'][0] * math.sin(math.radians(d['arm']))) for d in hp]
    J['height_resid'] = [st.mean(rzr), st.pstdev(rzr)]
    out.append('release height less shoulder and lever: %+.2f +- %.2f ft' % (st.mean(rzr), st.pstdev(rzr)))
    hts = [d['height'] for d in hp]; wts = [d['weight'] for d in hp if d['weight']]
    J['height'] = [st.mean(hts), st.pstdev(hts)]
    a7, b7, r7, s7 = reg([d['height'] for d in hp if d['weight']], wts)
    J['weight_on_height'] = [a7, b7, s7]
    out.append('pitchers: height %.1f +- %.1f in; weight %.0f + %.1f lb/in (resid %.1f lb)' % (st.mean(hts), st.pstdev(hts), a7 + b7 * st.mean(hts), b7, s7))
    a2, b2, r2, s2 = reg([d['arm'] for d in P], [d['rx'] for d in P])
    out.append('release side (toward arm side) on arm angle: %.2f %+.4f ft/deg (r %.2f, resid %.2f ft)' % (a2, b2, r2, s2))
    # 4. extension
    ep = [d for d in hp if d['ext']]
    a3, b3, r3, s3 = reg([d['height'] for d in ep], [d['ext'] for d in ep])
    J['ext'] = [a3, b3, s3, st.mean(d['ext'] for d in ep)]
    out.append('extension on height: %.2f + %.3f ft/in (r %.2f, resid %.2f ft; mean %.2f)' % (a3, b3, r3, s3, J['ext'][3]))
    # 5. each type's spin direction against arm angle
    J['tilt'] = {}
    for t in ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS'):
        q = [d for d in P if t in d['types']]
        if len(q) < 30:
            continue
        a, b, r, res = reg([d['arm'] for d in q], [d['types'][t]['tilt'] for d in q])
        m = st.mean(d['arm'] for d in P)
        J['tilt'][t] = {'at_mean_arm': a + b * m, 'per_deg': b, 'r': r, 'resid': res, 'n': len(q)}
        out.append('%s spin direction: %.1f deg at the mean arm angle, %+.2f per deg of arm angle (r %.2f, resid sd %.1f deg, n %d)' % (t, a + b * m, b, r, res, len(q)))
    # 5b. each type's MOVEMENT direction against arm angle (the engine's tilt is a movement direction; seams included)
    J['move_dir'] = {}
    for t in ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS'):
        q = [d for d in P if t in d['types']]
        if len(q) < 30:
            continue
        a, b, r, res = reg([d['arm'] for d in q], [d['types'][t]['move_dir'] for d in q])
        m = st.mean(d['arm'] for d in P)
        J['move_dir'][t] = {'at_mean_arm': a + b * m, 'per_deg': b, 'r': r, 'resid': res, 'n': len(q)}
        out.append('%s movement direction: %.1f deg at the mean arm angle, %+.2f per deg (r %.2f, resid sd %.1f deg)' % (t, a + b * m, b, r, res))
    # 5c. which pitches by arm slot: share of pitchers throwing each type, and usage, by arm-angle third
    arms_sorted = sorted(d['arm'] for d in P)
    cut = [arms_sorted[len(P) // 3], arms_sorted[2 * len(P) // 3]]
    J['by_slot'] = {'cuts': cut}
    out.append('by arm slot (low < %.0f deg < middle < %.0f deg < high): share of pitchers throwing each type (25+ of it)' % tuple(cut))
    for nm, lo, hi in (('low', -99, cut[0]), ('middle', cut[0], cut[1]), ('high', cut[1], 99)):
        q = [d for d in P if lo <= d['arm'] < hi]
        sh = {t: sum(t in d['types'] for d in q) / len(q) for t in ('FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS')}
        J['by_slot'][nm] = {'n': len(q), 'share': sh}
        out.append('  %-6s n %3d  ' % (nm, len(q)) + '  '.join('%s %.2f' % (t, v) for t, v in sh.items()))
    # 6. spin and speed
    a4, b4, r4, s4 = reg([d['types']['FF']['velo'] for d in ff if d['types']['FF']['spin']], [d['types']['FF']['spin'] for d in ff if d['types']['FF']['spin']])
    J['ff_spin_on_velo'] = [a4, b4, r4, s4]
    out.append('four-seam spin on speed: %+.1f rpm per mph (r %.2f, resid %.0f rpm)' % (b4, r4, s4))
    # a pitcher's spin across his pitches, each against its type mean, after speed
    def resid_spin(d, t):
        T = d['types'][t]; return T['spin'] / T['velo'] if T['spin'] else None
    J['spin_talent'] = {}
    for t in ('SL', 'CU', 'CH', 'SI'):
        q = [d for d in ff if t in d['types'] and resid_spin(d, t) and resid_spin(d, 'FF')]
        if len(q) < 30:
            continue
        r = reg([resid_spin(d, 'FF') for d in q], [resid_spin(d, t) for d in q])[2]
        J['spin_talent'][t] = [r, len(q)]
        out.append('spin per mph, four-seamer against %s: r %.2f (n %d)' % (t, r, len(q)))
    # 7. body against speed
    for k in ('height', 'weight'):
        q = [d for d in ff if d[k]]
        out.append('four-seam speed on %s: r %.2f (n %d)' % (k, reg([d[k] for d in q], [d['types']['FF']['velo'] for d in q])[2], len(q)))
    a5, b5, r5, s5 = reg([d['arm'] for d in ff], [d['types']['FF']['ivb'] for d in ff])
    out.append('test: four-seam rise on arm angle r %.2f (leaderboard .71)' % r5)
    a6, b6, r6, s6 = reg([d['arm'] for d in P], [d['rz'] for d in P])
    out.append('test: release height on arm angle r %.2f (leaderboard .76)' % r6)
    # 8. repertoires: how many pitches, by role
    for rl in ('SP', 'RP'):
        q = [d for d in P if d['role'] == rl]
        out.append('%s: %.1f pitch types of 3%%+ on average (n %d)' % ('starters' if rl == 'SP' else 'relievers', st.mean(len(d['mix']) for d in q), len(q)))
    with open(os.path.join(here, 'pitcher_chain_%s.json' % year), 'w') as f:
        json.dump(J, f, indent=1)
    print('\n'.join(out))
    print('wrote statcast/pitcher_chain_%s.json' % year)
    rows = []
    for d in sorted(P, key=lambda d: d['arm']):
        tot = sum(d['mix'].values())
        rows.append('[%.0f,%d,%s]' % (d['arm'], 0 if d['role'] == 'SP' else 1, ','.join(str(round(100 * d['mix'].get(t, 0) / tot)) for t in ENGINE_TYPES)))
    lines = [BEGIN,
             '  // ' + year + ' pitch-level Statcast: every pitcher with 150+ pitches, as [arm angle (deg), 0 starter / 1 reliever,',
             '  // percent of his pitches of each type ' + ' '.join(ENGINE_TYPES) + ' (types under 3% dropped, the rest renormalized)]. ' + str(len(rows)) + ' pitchers.',
             '  var REPERTOIRES = [']
    for i in range(0, len(rows), 8):
        lines.append('    ' + ', '.join(rows[i:i + 8]) + (',' if i + 8 < len(rows) else ''))
    lines += ['  ];', END]
    path = os.path.join(os.path.dirname(here), 'bb_engine.js')
    text = open(path).read()
    if BEGIN in text and END in text:
        text = text[:text.index(BEGIN)] + '\n'.join(lines) + text[text.index(END) + len(END):]
        open(path, 'w').write(text)
        print('wrote REPERTOIRES into bb_engine.js (%d pitchers)' % len(rows))
    else:
        print('bb_engine.js has no REPERTOIRES markers')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
