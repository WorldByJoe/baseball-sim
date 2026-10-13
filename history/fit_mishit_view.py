"""
fit_mishit_view.py · v0.1 · 2026-10-12

review/fit_mishit.py for a past October's worktree: each pitcher's mishit (his scale on the batter's miss along the
barrel) fitted so the squareness he allows in the model stands to the model's league as his real squareness (the
worktree's two seasons, regular season) stands to the real league, his deception moved with it to hold his strikeouts.
The slopes (squareness and strikeouts per log mishit, deception per log mishit) and the model's league squareness are
the 2026 fit's (review/pitchers_fit.json's league.sq in the review worktree): they are facts about the engine, not about
any pitcher. His squareness in the model now comes from review/check_contact.js at his fitted deception, two runs
(1,500 PA seed 7 and 2,000 PA seed 3) averaged by balls in play, as the 2026 fit averaged them.

  python3 HIST/fit_mishit_view.py            (from the worktree's root, after review/fit_pitchers.js)

CHANGED
  v0.1  first build (Joe, 2026-10-12)
"""
import json, os, sys, glob, math, subprocess
import numpy as np
sys.path.insert(0, 'review')
src = open('review/fit_mishit.py').read()
ns = {}; exec(src.split('def load(pat)')[0], ns)     # REAL_LEAGUE, K_SHRINK, LO, HI, real_sq (reads playoffs/pitches, 2025 and 2026 labels)


def main():
    F = json.load(open('review/pitchers_fit.json'))
    L26 = json.load(open(os.path.expanduser('~/bsim-wt/review/review/pitchers_fit.json')))['league']['sq']
    teams = sorted({p['team'] for p in F['pitchers'].values()})
    os.makedirs('diag_out/mishit_view', exist_ok=True)
    procs = []
    for t in teams:
        for npa, seed in ((1500, 7), (2000, 3)):
            procs.append(subprocess.Popen(['tools/diag/run.sh', 'bb_engine.js', 'review/players.js', 'review/check_contact.js', '--', str(npa), str(seed), t],
                                          stdout=open('diag_out/mishit_view/%s_%d.jsonl' % (t, seed), 'w'), stderr=subprocess.DEVNULL))
    for p in procs: p.wait()
    M = {}
    for f in glob.glob('diag_out/mishit_view/*.jsonl'):
        for l in open(f):
            if l.startswith('{'):
                r = json.loads(l); M.setdefault(str(r['id']), []).append(r)
    s_net = L26['perLogMishit'] + 0.0
    # fit_mishit's net slope (squareness per log mishit with deception following) is not stored: recover it from the 2026 fits
    P26 = json.load(open(os.path.expanduser('~/bsim-wt/review/review/pitchers_fit.json')))['pitchers']
    est = [(p['targetSq'] - p['sqBefore']) / math.log(p['mishit']) for p in P26.values() if 'mishit' in p and abs(math.log(p['mishit'])) > 0.05 and LO_OK(p['mishit'])]
    s_net = float(np.median(est)); ratio = L26['deceptionFollows']
    n = 0; ms = []
    for pid, p in F['pitchers'].items():
        R = M.get(pid)
        if not R: continue
        sq_now = sum(r['sq'] * r['bip'] for r in R) / sum(r['bip'] for r in R)
        rs, nb = ns['real_sq'](int(pid))
        shrunk = ns['REAL_LEAGUE'] + ((rs - ns['REAL_LEAGUE']) * nb / (nb + ns['K_SHRINK']) if rs is not None else 0)
        target = L26['model'] + (shrunk - ns['REAL_LEAGUE'])
        dm = min(ns['HI'], max(ns['LO'], (target - sq_now) / s_net))
        p['mishit'] = round(math.exp(dm), 3); p['deception'] = round(p['deception'] * math.exp(ratio * dm), 3)
        p['measuredSq'] = None if rs is None else round(rs, 4); p['nSq'] = nb; p['targetSq'] = round(target, 4); p['sqBefore'] = round(sq_now, 4)
        n += 1; ms.append(p['mishit'])
    F['league']['sq'] = dict(L26, note='slopes and model league from the 2026 fit (history/fit_mishit_view.py)', sNet=s_net)
    json.dump(F, open('review/pitchers_fit.json', 'w'), indent=1)
    print('%d pitchers: mishit %.2f-%.2f, median %.2f (net slope %.4f)' % (n, min(ms), max(ms), float(np.median(ms)), s_net))


def LO_OK(m): return math.log(0.6) + 1e-3 < math.log(m) < math.log(1.8) - 1e-3


if __name__ == '__main__':
    main()
