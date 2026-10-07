# compare.py BEFORE_DIR AFTER_DIR: the game line (3 seeds) and the check summaries side by side
import re, sys, os
B, A = sys.argv[1], sys.argv[2]
M = ['runs', 'hits', 'doubles', 'home runs', 'walks', 'strikeouts', 'double plays', 'pitches', 'AVG', 'OBP', 'SLG', 'BABIP', 'K%', 'BB%', 'HR%']
def game(d, s):
    t = open(os.path.join(d, 'games_%d.txt' % s)).read(); o = {}
    for m in M:
        r = re.search(r'^\s+%s\s+(\S+)\s+(\S+)' % re.escape(m), t, re.M)
        if r: o[m] = (r.group(1), r.group(2))
    r = re.search(r'GB / LD / FB / PU %(\d+/\d+/\d+/\d+)(\d+/\d+/\d+/\d+)', t); o['mix'] = (r.group(1), r.group(2)) if r else ('', '')
    return o
print('%-14s %-22s %-22s %s' % ('metric', 'before (3, 11, 29)', 'after (3, 11, 29)', 'MLB'))
for m in M + ['mix']:
    b = [game(B, s).get(m, ('-', '-')) for s in (3, 11, 29)]; a = [game(A, s).get(m, ('-', '-')) for s in (3, 11, 29)]
    print('%-14s %-22s %-22s %s' % (m, ' '.join(x[0] for x in b), ' '.join(x[0] for x in a), b[0][1]))
for f, pat in (('contact.txt', r'(\w misses by kind|\w squared-up|\w vertical miss|\w by reach|SCORE).*?rms[^\d]*([\d.]+)'),):
    for d, lab in ((B, 'before'), (A, 'after')):
        t = open(os.path.join(d, f)).read()
        print(lab + ' contact: ' + '  '.join('%s %s' % (x[0].strip(), x[1]) for x in re.findall(pat, t)))
for d, lab in ((B, 'before'), (A, 'after')):
    t = open(os.path.join(d, 'bip.txt')).read(); r = re.search(r'All balls in play:.*', t); print(lab + ' ' + (r.group(0) if r else ''))
    t = open(os.path.join(d, 'spray.txt')).read(); r = re.search(r'foul share.*', t); print(lab + ' ' + (r.group(0) if r else ''))
