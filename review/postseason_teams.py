"""postseason_teams.py · v0.1 · 2026-10-14: each team's postseason so far against the model (diag_out/story/story.json): its
batting and its pitching (what its opponents did), actual against the replays' expectation, and hits against what the
contact deserved. python3 review/postseason_teams.py [team ...]"""
import json, os, sys, collections
S = json.load(open(os.path.expanduser('~/bsim-wt/engdev/diag_out/story/story.json')))
want = sys.argv[1:]
T = collections.defaultdict(lambda: {'g': 0, 'w': 0, 'bat': collections.Counter(), 'batx': collections.Counter(), 'pit': collections.Counter(), 'pitx': collections.Counter(), 'xh': 0.0, 'xhA': 0.0, 'p': 0.0})
for g in S:
    for me, op in ((g['away'], g['home']), (g['home'], g['away'])):
        if 'expected' not in g['teams'][me]: continue
        t = T[me]; t['g'] += 1; t['w'] += int(g['final'][0 if me == g['away'] else 1] > g['final'][1 if me == g['away'] else 0])
        t['p'] += (g['modelHome'] if me == g['home'] else 1 - g['modelHome'])
        for k in ('R', 'H', 'HR', 'XBH', 'K', 'BB', 'HH'):
            t['bat'][k] += g['teams'][me]['actual'].get(k, 0); t['batx'][k] += g['teams'][me]['expected'].get(k, 0)
            t['pit'][k] += g['teams'][op]['actual'].get(k, 0); t['pitx'][k] += g['teams'][op]['expected'].get(k, 0)
        t['xh'] += g['teams'][me]['xHitsContact']; t['xhA'] += g['teams'][op]['xHitsContact']
for tm, t in sorted(T.items()):
    if want and tm not in want: continue
    print('%s  %d games, won %d (model expected %.1f wins)' % (tm, t['g'], t['w'], t['p']))
    print('   batting   ' + '  '.join('%s %d/%.1f' % (k, t['bat'][k], t['batx'][k]) for k in ('R', 'H', 'HR', 'XBH', 'K', 'BB', 'HH')) + '   hits %d vs %.1f from contact' % (t['bat']['H'], t['xh']))
    print('   pitching  ' + '  '.join('%s %d/%.1f' % (k, t['pit'][k], t['pitx'][k]) for k in ('R', 'H', 'HR', 'XBH', 'K', 'BB', 'HH')) + '   hits %d vs %.1f from contact' % (t['pit']['H'], t['xhA']))
