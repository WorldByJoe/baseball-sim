"""run_score.py · v0.1 · 2026-10-15: hits and base running from replay_game's audit output (a folder of jsonl), as season/runs_audit.py
defines them, against the league's 2026 rates; for refitting the running margins (the model review, item 5).
  python3 review/run_score.py DIR [DIR ...]"""
import json, glob, sys, os
REAL = {'1B': .144, '2B': .040, '3B': .004, 'runs': 4.43, 'firstToThird': .313, 'scoresFromSecond': .567, 'scoresFromFirstOnDouble': .370, 'sacFly': .617}
SE = {'1B': .002, '2B': .0015, '3B': .0006, 'runs': .05, 'firstToThird': .012, 'scoresFromSecond': .02, 'scoresFromFirstOnDouble': .02, 'sacFly': .02}
def score(d):
    L = {}; c = dict.fromkeys(['ld', 'ldx', 'pa', '1B', '2B', '3B', 's1', 's1y', 's2', 's2y', 'd1', 'd1y', 'sf', 'sfy', 'runs', 'games'], 0)
    for f in glob.glob(d + '/*.jsonl'):
        for l in open(f):
            if not l.startswith('{'): continue
            J = json.loads(l); c['games'] += 1; c['runs'] += sum(J.get('score', [0, 0]))
            for q in J['p']:
                half, inn, outs, b, res, typ, om, runs, oa, ba = q[:10]
                if res in ('END', 'NOPA'): continue
                c['pa'] += 1
                if res in ('1B', '2B', '3B'): c[res] += 1
                ev, la, dist = (q[15], q[16], q[18]) if len(q) > 18 else (None, None, None)
                if typ == 'LD' and res in ('1B', '2B', '3B'): c['ld'] += 1; c['ldx'] += 1 if res != '1B' else 0
                if ev is not None and dist is not None and res in ('1B', '2B', '3B') and 15 <= la < 25 and ev >= 90:
                    L.setdefault((int(la // 5 * 5), min(105, int(ev // 5 * 5))), []).append(dist)
                if res == '1B' and b == 1: c['s1'] += 1; c['s1y'] += 1 if (ba & 4) else 0
                if res == '1B' and b == 2: c['s2'] += 1; c['s2y'] += 1 if runs >= 1 else 0
                if res == '2B' and b == 1: c['d1'] += 1; c['d1y'] += 1 if runs >= 1 else 0
                if (b & 4) and outs < 2 and res in ('OUT', 'SF') and typ in ('FB', 'PU', 'LD') and om == 1: c['sf'] += 1; c['sfy'] += 1 if runs >= 1 else 0
    v = {'1B': c['1B'] / c['pa'], '2B': c['2B'] / c['pa'], '3B': c['3B'] / c['pa'], 'runs': c['runs'] / max(1, 2 * c['games']), 'firstToThird': c['s1y'] / max(1, c['s1']),
         'scoresFromSecond': c['s2y'] / max(1, c['s2']), 'scoresFromFirstOnDouble': c['d1y'] / max(1, c['d1']), 'sacFly': c['sfy'] / max(1, c['sf'])}
    import statistics as st
    LR = {(15, 90): 255, (15, 95): 270, (15, 100): 292, (15, 105): 335, (20, 90): 299, (20, 95): 340, (20, 100): 372, (20, 105): 394}   # real, hits only (runs_audit v0.3)
    lerr = [st.median(L[k]) - LR[k] for k in LR if len(L.get(k, [])) >= 15]
    v['linerFt'] = sum(lerr) / len(lerr) if lerr else float('nan'); v['ldXbhShare'] = c['ldx'] / max(1, c['ld'])
    sc = sum(((v[k] - REAL[k]) / SE[k]) ** 2 for k in ('2B', 'firstToThird', 'scoresFromSecond', 'scoresFromFirstOnDouble', 'sacFly'))
    return sc, v
for d in sys.argv[1:]:
    sc, v = score(d); cfg = (open(d + '/cfg').read().strip() if os.path.exists(d + '/cfg') else '') + (' ' + open(d + '/tc').read().strip() if os.path.exists(d + '/tc') else '')
    print('%6.1f  ' % sc + '  '.join('%s %.3f' % (k, v[k]) for k in v) + '  ' + cfg)
