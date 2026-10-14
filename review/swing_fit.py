"""
swing_fit.py · v0.2 · 2026-10-14

The swing refit (step 2 of the run audit, Joe 2026-10-14): the contact constants that were fitted under the old contact
geometry, refitted on GEOM 'relative' with the leather's force-dependent friction (MU_REF 0.15, MU_GAMMA 0.46, through
the two published measurements), to the league's 2026 (season/swing_mix_real.json):
  launch-angle shares of balls in play (8 bins), each swing's outcome by pitch kind (miss, foul, in play: fastballs,
  breaking balls, changeups and splitters), the fastball fouls at 10-70 deg (share of contact .386, exit speed over the
  pitch's .813, slopes .277 on pitch speed and .281 on bat speed), and the spray of balls in play (low weight).
The settings: du (every hitter's aim under the ball moved, in), bs (barrel scatter x), ts (timing scatter x), lookGain,
lookSd (the last look), aimAttack (a steeper swing aims higher on the ball), vertMiss (the barrel short of a high or low
pitch). A pattern search: from the current point, each setting moved up and down by its step; the best move taken; the
steps halved when no move helps. Each point is review/swing_mix.js, two seeds of 30,000 plate appearances (the same seeds
for every point), cached in diag_out/swfit/.

  python3 review/swing_fit.py [rounds] [fixed JSON] [tag]      -> diag_out/swfit<tag>/log.txt, best.json

v0.2: the fixed settings and an output tag as arguments (a run at friction 0.27, where the fouls' speed and distance
are the league's: the low-friction run's fouls left at .89 of the pitch's speed against .813, 246 ft against 210).
"""
import json, os, sys, subprocess, hashlib, itertools
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); OUT = os.path.join(ROOT, 'diag_out', 'swfit'); os.makedirs(OUT, exist_ok=True)
Q = json.load(open(os.path.expanduser('~/bsim-wt/review/season/swing_mix_real.json')))
RLA = list(Q['laShares'].values()); RPS = Q['perSwing']; RSP = Q['spray']['all']
FIXED = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {'geom': 'relative', 'muRef': 0.15, 'muGamma': 0.46}
if len(sys.argv) > 3: OUT = OUT + sys.argv[3]; os.makedirs(OUT, exist_ok=True)
START = {'du': 0.0, 'bs': 1.0, 'ts': 1.0, 'lookGain': 1.3, 'lookSd': 0.5, 'aimAttack': 0.13, 'vertMiss': 0.09}
STEP = {'du': 0.2, 'bs': 0.15, 'ts': 0.2, 'lookGain': 0.3, 'lookSd': 0.15, 'aimAttack': 0.06, 'vertMiss': 0.04}
LIMIT = {'du': (-1.0, 1.0), 'bs': (0.4, 1.6), 'ts': (0.4, 1.8), 'lookGain': (0.0, 2.5), 'lookSd': (0.1, 1.5), 'aimAttack': (-0.1, 0.3), 'vertMiss': (-0.05, 0.25)}
SEEDS = (1, 2); NPA = 30000


def key(p): return hashlib.md5(json.dumps({k: round(p[k], 4) for k in sorted(p)}).encode()).hexdigest()[:12]


def run1(args):
    p, s = args; f = os.path.join(OUT, '%s_%d.json' % (key(p), s))
    if not (os.path.exists(f) and os.path.getsize(f) > 100):
        tune = dict(FIXED, lookGain=p['lookGain'], lookSd=p['lookSd'], aimAttack=p['aimAttack'], vertMiss=p['vertMiss'])
        with open(f, 'w') as fh:
            subprocess.run(['tools/diag/run.sh', 'bb_engine.js', 'review/swing_mix.js', '--', str(NPA), str(s), str(p['du']), json.dumps(tune), str(p['bs']), str(p['ts']), '1'], cwd=ROOT, stdout=fh, stderr=subprocess.DEVNULL)
    return f


def score(p):
    R = [json.load(open(os.path.join(OUT, '%s_%d.json' % (key(p), s)))) for s in SEEDS]
    la = [sum(list(r['laShares'].values())[i] for r in R) / len(R) for i in range(8)]
    ps = {k: [sum(r['perSwing'][k][c] for r in R) / len(R) for c in ('whiff', 'foul', 'play')] for k in ('FB', 'BR', 'OS')}
    g = {k: sum(r['grazes'][k] for r in R) / len(R) for k in ('share', 'ratio')}; sl = [sum(r['grazes']['slopes'][i] for r in R) / len(R) for i in (0, 1)]
    spr = [sum(r['spray']['all'][i] for r in R) / len(R) for i in range(6)]
    dl = sum((a - b) ** 2 for a, b in zip(la, RLA)) ** 0.5 / 0.01
    ds = sum((a - b) ** 2 for k in ps for a, b in zip(ps[k], [RPS[k][c] for c in ('whiff', 'foul', 'play')])) ** 0.5 / 0.02
    dg = (((g['share'] - .386) / .02) ** 2 + ((g['ratio'] - .813) / .02) ** 2 + ((sl[0] - .277) / .08) ** 2 + ((sl[1] - .281) / .08) ** 2) ** 0.5
    dp = sum((a - b) ** 2 for a, b in zip(spr, RSP)) ** 0.5 / 0.02 * 0.5
    return dl + ds + dg + dp, {'LA': round(dl, 2), 'swing': round(ds, 2), 'graze': round(dg, 2), 'spray': round(dp, 2), 'la': [round(x, 3) for x in la],
                               'ps': {k: [round(x, 3) for x in v] for k, v in ps.items()}, 'g': [round(g['share'], 3), round(g['ratio'], 3)] + [round(x, 3) for x in sl]}


def evaluate(points):
    with ThreadPoolExecutor(14) as ex: list(ex.map(run1, [(p, s) for p in points for s in SEEDS]))
    return [score(p) for p in points]


def main(rounds):
    log = open(os.path.join(OUT, 'log.txt'), 'a'); cur = dict(START); step = dict(STEP)
    (best, info), = evaluate([cur])
    print('start', round(best, 2), info, file=log, flush=True); print('start', round(best, 2), info, flush=True)
    for r in range(rounds):
        cand = []
        for k in cur:
            for sgn in (1, -1):
                q = dict(cur); q[k] = min(LIMIT[k][1], max(LIMIT[k][0], round(cur[k] + sgn * step[k], 4)))
                if q[k] != cur[k]: cand.append(q)
        res = evaluate(cand)
        j = min(range(len(cand)), key=lambda i: res[i][0])
        if res[j][0] < best:
            moved = [k for k in cur if cand[j][k] != cur[k]][0]
            # a second step the same way, when the first helped
            q2 = dict(cand[j]); q2[moved] = min(LIMIT[moved][1], max(LIMIT[moved][0], round(cand[j][moved] + (cand[j][moved] - cur[moved]), 4)))
            (s2, i2), = evaluate([q2])
            if s2 < res[j][0]: cur, best, info = q2, s2, i2
            else: cur, best, info = cand[j], res[j][0], res[j][1]
        else:
            step = {k: v / 2 for k, v in step.items()}
        line = 'round %d score %.2f %s %s step %s' % (r + 1, best, json.dumps(cur), json.dumps(info), json.dumps({k: round(v, 3) for k, v in step.items()}))
        print(line, file=log, flush=True); print(line, flush=True)
        if max(step[k] / STEP[k] for k in step) < 0.13: break
    json.dump({'best': cur, 'score': best, 'info': info, 'fixed': FIXED}, open(os.path.join(OUT, 'best.json'), 'w'), indent=1)


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 20)
