# score a probe output against the league targets (standardized rms)
import re, sys, math
LG = {'vm': [-14.8, -3.5, 7.0, 18.4, 25.9, 30.4], 'fbbr': [8.7, 8.9, 7.7, 6.7], 'fbos': [11.5, 15.4, 13.5, 14.2],
      'wk': {'FB': .174, 'BR': .310, 'OS': .301}, 'dep': {'FB': 7.4, 'BR': 8.3, 'OS': 8.2},
      'wh': {'FB': [.345, .122, .102, .131, .198, .366], 'BR': [.602, .271, .147, .129, .181, .317], 'OS': [.538, .262, .165, .132, .108, .167]}}
def parse(txt):
    o = {}
    m = re.search(r'vm by height (.*?) \| mean', txt); o['vm'] = [float(x) for x in m.group(1).split()]
    m = re.search(r'FB-BR gap by height (.*?) \| FB-OS (.*?)  ', txt); o['fbbr'] = [float(x) for x in m.group(1).split()]; o['fbos'] = [float(x) for x in m.group(2).split()]
    o['wk'] = {}; o['dep'] = {}; o['wh'] = {}
    for k in ('FB', 'BR', 'OS'):
        m = re.search(r'whiff %s ([\d.]+) 3\+in [\d.]+ depth sd ([\d.]+) \| by height (.*)' % k, txt)
        o['wk'][k] = float(m.group(1)); o['dep'][k] = float(m.group(2)); o['wh'][k] = [float(x) for x in m.group(3).split()]
    return o
def score(o):
    e = []
    e += [(a - b) / 5 for a, b in zip(o['vm'], LG['vm'])]
    e += [(a - b) / 5 for a, b in zip(o['fbbr'], LG['fbbr'])] + [(a - b) / 5 for a, b in zip(o['fbos'], LG['fbos'])]
    for k in ('FB', 'BR', 'OS'):
        e += [(o['wk'][k] - LG['wk'][k]) / 0.02] * 3 + [(o['dep'][k] - LG['dep'][k]) / 0.5]
        e += [(a - b) / 0.04 for a, b in zip(o['wh'][k][1:], LG['wh'][k][1:])]
    return math.sqrt(sum(x * x for x in e) / len(e))
if __name__ == '__main__':
    res = []
    for fn in sys.argv[1:]:
        try: res.append((score(parse(open(fn).read())), fn))
        except Exception as ex: pass
    for s, fn in sorted(res)[:12]: print('%.3f  %s' % (s, fn.split('/')[-1]))
