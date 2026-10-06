# bc_sum.py OUT...: average bc_fit.js lines over seeds, one line per knob file (FILE.js.out beside FILE.js)
import sys, re
lg = [-4.0, -3.9, 0.4, 3.9, 5.6, 6.5, 4.8, 5.0]; lb = [-0.43, 0.16, 0.66, 0.27, -0.28, -0.07, 0.43, 0.40]
for fn in sys.argv[1:]:
    L = [l for l in open(fn).read().strip().split('\n') if l.startswith('prior')]
    if not L: print(fn, 'no output'); continue
    dep = [[float(v) for v in re.search(r'depth ([-\d. ]+)\|', l).group(1).split()] for l in L]
    bat = [[float(v) for v in re.search(r'bat ([-\d. ]+) rms', l).group(1).split()] for l in L]
    d = [sum(c) / len(c) for c in zip(*dep)]; b = [sum(c) / len(c) for c in zip(*bat)]
    rms = (sum((x - y) ** 2 for x, y in zip(d, lg)) / 8) ** .5; rmb = (sum((x - y) ** 2 for x, y in zip(b, lb)) / 8) ** .5
    g = lambda k: sum(float(re.search(k + r' ([\d.]+)', l).group(1)) for l in L) / len(L)
    print('%-58s | depth %s | rms %.2f | bat %s rms %.2f | BR foul %.3f attack %.1f whiff %.3f' % (open(fn[:-4]).read().strip()[:58], ' '.join('%+.1f' % x for x in d), rms, ' '.join('%+.1f' % x for x in b), rmb, g('BR foul'), g('attack'), g('whiff/swing')))
