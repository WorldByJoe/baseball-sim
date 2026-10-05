# paste.py <mode> <tool-output>: paste a refit tool's printed constants into bb_engine.js
import re, sys, json
mode, out = sys.argv[1], open(sys.argv[2]).read()
fn = 'bb_engine.js'; s = open(fn).read()
def block(s, start, new):
    i = s.index(start); j = s.index('};', i) + 2
    return s[:i] + new + s[j:]
if mode == 'thr':
    m = re.search(r"  var SWING_THR = \{.*?\n  \};", out, re.S); s = block(s, 'var SWING_THR = {', m.group(0).strip())
elif mode == 'values':
    for name in ('HITTER_VALUE', 'PITCHER_VALUE', 'FIELD_VALUE'):
        m = re.search(r"var %s = .*?;\s*$" % name, out, re.M)
        if not m: print('missing', name); continue
        line = m.group(0).strip()
        if name == 'FIELD_VALUE':
            J = json.loads(line[line.index('{'):line.rindex('}') + 1])
            rows = ["    '%s': { c0: %s, w: { %s } }" % (p, J[p]['c0'], ', '.join('%s: %s' % (k, v) for k, v in J[p]['w'].items())) for p in J]
            s = block(s, 'var FIELD_VALUE = {', 'var FIELD_VALUE = {\n' + ',\n'.join(rows) + '\n  };')
        else:
            s, n = re.subn(r"var %s = \{.*?\} \};" % name, lambda mm: line, s, count=1); assert n == 1
        print('pasted', name)
elif mode == 'pool':
    i0 = s.index('var TRAITS = {'); i1 = s.index('\n  };', i0)
    T = s[i0:i1]
    pairs = []
    for ln in out.split('\n'):
        if re.match(r"^    \w+: \[", ln): pairs += re.findall(r"(\w+): \[([^\]]*)\]", ln)
    for k, v in pairs:
        T2, n = re.subn(r"\b%s:(\s*)\[[^\]]*\]" % k, lambda mm: k + ':' + mm.group(1) + '[' + v + ']', T, count=1)
        if n: T = T2
        else: print('not in TRAITS:', k)
    s = s[:i0] + T + s[i1:]
    m = re.search(r"CHAIN.powerExp = (-?[\d.]+)", out); s = re.sub(r"var CHAIN = \{ powerExp: -?[\d.]+ \};", lambda mm: "var CHAIN = { powerExp: %s };" % m.group(1), s)
    m = re.search(r"ATHLETIC = (\{[^}]*\})", out); s = re.sub(r"var ATHLETIC = \{[^}]*\};", lambda mm: "var ATHLETIC = %s;" % m.group(1), s)
    print('pasted pool (%d entries)' % len(pairs))
open(fn, 'w').write(s)
