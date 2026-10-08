"""
weak_contact_why.py · v0.1 · 2026-10-08

What in a pitcher's pitches goes with the squareness he allows (review/weak_contact.py)? Each playoff pitcher's
2025-26 regular-season pitches: his fastball's speed, rise (induced vertical break, in), run (arm-side break, in),
vertical approach angle at the plate, extension and arm angle; his whiff rate (swinging strikes per swing), his
zone rate and the share of balls in play on pitches in the heart of the zone; and how unusual his fastball's shape
is for its speed and arm angle (the residual of rise and run on speed and arm angle across these pitchers). Each
set beside his squareness allowed, across pitchers; then a pitch-level regression of squareness on the pitch's
own shape, speed, location and count, with the batter's own squareness as a control.

  python3 review/weak_contact_why.py
"""
import json, gzip, csv, os, math
import numpy as np

def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None

def vaa(r):   # vertical approach angle at the front of the plate, degrees (negative: descending)
    vy0, vz0, ay, az = f(r['vy0']), f(r['vz0']), f(r['ay']), f(r['az'])
    if None in (vy0, vz0, ay, az): return None
    vyf = -math.sqrt(max(vy0 * vy0 - 2 * ay * (50 - 17 / 12), 0)); t = (vyf - vy0) / ay; vzf = vz0 + az * t
    return math.degrees(math.atan2(vzf, -vyf))

FB = ('FF', 'SI', 'FC'); BR = ('SL', 'ST', 'CU', 'KC', 'SV', 'CS')
W = {r['id']: r for r in json.load(open('review/weak_contact.json'))['rows']}
P = {}; pitches = []
for pid, w in W.items():
    fb = []; sw = wh = n = inz = 0; bip_heart = bip = 0
    for yr in ('2025', '2026'):
        p = 'playoffs/pitches/%s_pitcher_%d.csv.gz' % (yr, pid)
        if not os.path.exists(p): continue
        for r in csv.DictReader(gzip.open(p, 'rt')):
            if r.get('game_type') != 'R': continue
            n += 1; d = r.get('description') or ''
            px, pz, top, bot = f(r['plate_x']), f(r['plate_z']), f(r['sz_top']), f(r['sz_bot'])
            if None in (px, pz, top, bot): continue
            xn = px / 0.83; zn = (pz - (top + bot) / 2) / ((top - bot) / 2)
            if abs(xn) <= 1 and abs(zn) <= 1: inz += 1
            if d in ('swinging_strike', 'swinging_strike_blocked', 'foul_tip', 'foul', 'hit_into_play', 'foul_bunt', 'missed_bunt'):
                sw += 1; wh += d in ('swinging_strike', 'swinging_strike_blocked', 'foul_tip')
            hand = 1 if r.get('p_throws') == 'R' else -1
            if r.get('pitch_type') in FB and f(r['release_speed']) and f(r['pfx_z']) is not None:
                fb.append((f(r['release_speed']), 12 * f(r['pfx_z']), -12 * hand * f(r['pfx_x']), vaa(r), f(r.get('release_extension')), f(r.get('arm_angle')), zn))
            if r.get('type') == 'X':
                ev, bs, ps = f(r.get('launch_speed')), f(r.get('bat_speed')), f(r.get('release_speed'))
                bip += 1; heart = abs(xn) <= 0.67 and abs(zn) <= 0.67; bip_heart += heart
                if ev and bs and bs > 40 and ps:
                    kind = 'FB' if r.get('pitch_type') in FB else 'BR' if r.get('pitch_type') in BR else 'OS'
                    pitches.append({'pid': pid, 'bat': r.get('batter'), 'sq': ev / (1.23 * bs + 0.23 * 0.92 * ps), 'kind': kind, 'velo': ps,
                                    'ivb': 12 * (f(r['pfx_z']) or 0), 'hb': -12 * hand * (f(r['pfx_x']) or 0), 'vaa': vaa(r), 'xn': xn * (1 if r.get('stand') == 'R' else -1), 'zn': zn,
                                    'heart': heart, 'balls': int(r['balls']), 'strikes': int(r['strikes']), 'platoon': r.get('stand') == r.get('p_throws'), 'bs': bs})
    if len(fb) < 100: continue
    F = np.array([[x if x is not None else np.nan for x in t] for t in fb], float)
    P[pid] = {'sq': w['sq'], 'hard': w['hard'], 'velo': np.nanmean(F[:, 0]), 'ivb': np.nanmean(F[:, 1]), 'hb': np.nanmean(F[:, 2]), 'vaa': np.nanmean(F[:, 3]),
              'ext': np.nanmean(F[:, 4]), 'arm': np.nanmean(F[:, 5]), 'fbz': np.nanmean(F[:, 6]), 'whiff': wh / max(sw, 1), 'zone': inz / max(n, 1), 'heart': bip_heart / max(bip, 1),
              'ivb_sd': np.nanstd(F[:, 1]), 'velo_sd': np.nanstd(F[:, 0])}
ids = list(P); A = lambda k: np.array([P[i][k] for i in ids])
# how unusual the fastball's shape is for its speed and arm angle
X = np.column_stack([np.ones(len(ids)), A('velo'), A('arm')])
for k in ('ivb', 'hb', 'vaa'):
    b = np.linalg.lstsq(X, A(k), rcond=None)[0]; res = A(k) - X @ b
    for i, v in zip(ids, res): P[i][k + '_res'] = v; P[i][k + '_odd'] = abs(v)
print('%d pitchers with 100+ fastballs' % len(ids))
print('%-40s %7s %7s' % ('across pitchers', 'r(sq)', 'r(hard)'))
out = {}
for k, lab in (('velo', 'fastball speed'), ('ivb', 'fastball rise (IVB)'), ('ivb_res', 'rise beyond his speed and arm angle'), ('ivb_odd', '|rise residual| (odd shape)'), ('hb', 'fastball run'),
               ('vaa', 'fastball approach angle (flatter = higher)'), ('vaa_res', 'approach angle beyond speed and arm'), ('ext', 'extension'), ('arm', 'arm angle'), ('fbz', 'fastball height in the zone'),
               ('whiff', 'whiffs per swing'), ('zone', 'zone rate'), ('heart', 'balls in play from the heart'), ('ivb_sd', 'fastball rise, pitch to pitch sd'), ('velo_sd', 'fastball speed sd')):
    r1 = np.corrcoef(A(k), A('sq'))[0, 1]; r2 = np.corrcoef(A(k), A('hard'))[0, 1]; out[k] = (r1, r2)
    print('%-40s %7.2f %7.2f' % (lab, r1, r2))

# pitch level: squareness on the pitch's own qualities, the batter's average squareness as a control
from collections import defaultdict
bsq = defaultdict(list)
for p in pitches: bsq[p['bat']].append(p['sq'])
bmean = {b: (np.sum(v) + 20 * 0.825) / (len(v) + 20) for b, v in bsq.items()}
D = [p for p in pitches if p['vaa'] is not None]
def col(fn): return np.array([fn(p) for p in D], float)
cols = [('batter avg sq', lambda p: bmean[p['bat']]), ('breaking', lambda p: p['kind'] == 'BR'), ('offspeed', lambda p: p['kind'] == 'OS'),
        ('speed (mph)', lambda p: p['velo']), ('rise (in)', lambda p: p['ivb']), ('run (in)', lambda p: p['hb']), ('approach angle (deg)', lambda p: p['vaa']),
        ('heart of zone', lambda p: p['heart']), ('height in zone (zn)', lambda p: p['zn']), ('height^2', lambda p: p['zn'] ** 2), ('inside-out (xn)', lambda p: p['xn']), ('xn^2', lambda p: p['xn'] ** 2),
        ('balls', lambda p: p['balls']), ('strikes', lambda p: p['strikes']), ('same hand', lambda p: p['platoon'])]
X = np.column_stack([np.ones(len(D))] + [col(c[1]) for c in cols]); y = col(lambda p: p['sq'])
b, *_ = np.linalg.lstsq(X, y, rcond=None); e = y - X @ b; s2 = e @ e / (len(y) - X.shape[1]); se = np.sqrt(np.diag(s2 * np.linalg.inv(X.T @ X)))
print('\npitch-level squareness, %d balls in play (R2 %.3f)' % (len(y), 1 - e.var() / y.var()))
for (lab, _), bb, ss, j in zip(cols, b[1:], se[1:], range(1, 99)):
    print('  %-24s %9.4f  (se %.4f, t %5.1f)  1 sd moves it %.4f' % (lab, bb, ss, bb / ss, bb * X[:, j].std()))
# pitcher-level: how much of the pitchers' spread in squareness the pitch-level qualities explain (excluding the batter control)
Xp = X.copy(); Xp[:, 1] = X[:, 1].mean()
pred = Xp @ b; pid = np.array([p['pid'] for p in D])
pm = {i: (pred[pid == i].mean(), y[pid == i].mean()) for i in set(pid)}
a = np.array(list(pm.values())); print('pitcher means: predicted from the pitches vs actual squareness r = %.2f (pitchers %d)' % (np.corrcoef(a[:, 0], a[:, 1])[0, 1], len(a)))
json.dump({'pitchers': {str(i): P[i] for i in ids}, 'corr': out, 'pitch_fit': {lab: [float(bb), float(ss)] for (lab, _), bb, ss in zip(cols, b[1:], se[1:])}}, open('review/weak_contact_why.json', 'w'), indent=1, default=float)
