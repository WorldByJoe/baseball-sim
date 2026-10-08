"""apply_prose.py · v0.1 · 2026-10-08
Puts the writing session's passages (review/prose/postseason_page_prose.md) into review/replay_grids_template.html and review/replay_grids.py.
  python3 review/prose/apply_prose.py [ID ...]   (all IDs if none)
CHANGED
  v0.1  first build (the writing session's edit of 2026-10-08)
"""
# Put the writing session's passages (review/prose/postseason_page_prose.md) into the template and the generator.
import re, html, sys
P = {}
cur = None
for line in open('review/prose/postseason_page_prose.md'):
    m = re.match(r'## (\w+) \(', line)
    if m: cur = m.group(1); P[cur] = []; continue
    if cur: P[cur].append(line.rstrip('\n'))
P = {k: '\n'.join(v).strip() for k, v in P.items()}
ONLY = set(sys.argv[1:])   # apply only these IDs (all if none)
def want(k): return not ONLY or k in ONLY
def esc(x): return html.escape(x, quote=False)
def py(x): return esc(x).replace("'", '&#39;')          # inside a single-quoted Python literal
def pyf(x): return py(x).replace('%', '%%')             # ... that is %-formatted

t = open('review/replay_grids_template.html').read()
def tsub(pat, new, flags=re.S):
    global t
    n = len(re.findall(pat, t, flags)); assert n == 1, (pat, n)
    t = re.sub(pat, lambda m: new, t, flags=flags)
if want('V1'): tsub(r'<span class="note">.*?</span>', '<span class="note">%s</span>' % esc(P['V1']))
if want('H2') or want('H3'):
    hdr0 = t.index('<header>'); hdr1 = t.index('</header>'); hdr = t[hdr0:hdr1]
    ps = re.findall(r'    <p>.*?</p>\n', hdr, re.S); assert len(ps) == 2
    hdr = hdr.replace(ps[0], '    <p>%s</p>\n' % esc(P['H2'])).replace(ps[1], '    <p>%s</p>\n' % esc(P['H3']))
    t = t[:hdr0] + hdr + t[hdr1:]
for k, key in (('S2', 'season'), ('S3', 'pitched'), ('S4', 'errors')):
    if not want(k): continue
    x = esc(P[k]).replace('{RUNS_%s}' % key.upper(), '<strong><!--RUNS_%s--></strong>' % key.upper())
    x = re.sub(r'\{(\w+)\}', r'<!--\1-->', x)
    tsub(r'<p class="sum" data-set="%s">.*?</p>' % key, '<p class="sum" data-set="%s">%s</p>' % (key, x))
if want('L1'):
    keys = [l[2:] for l in P['L1'].split('\n')]
    tsub(r'<span class="k">Across:[^<]*</span>', '<span class="k">%s</span>' % esc(keys[0]))
    tsub(r'<span class="chip tie" aria-hidden="true"></span> [^<]*</span>', '<span class="chip tie" aria-hidden="true"></span> ' + esc(keys[4]) + '</span>')
if any(want('N%d' % i) for i in range(1, 6)):
    f0 = t.index('<footer>') + len('<footer>'); f1 = t.index('  </footer>')
    t = t[:f0] + '\n' + ''.join('    <p>%s</p>\n' % esc(P['N%d' % i]) for i in range(1, 6)) + t[f1:]
open('review/replay_grids_template.html', 'w').write(t)

g = open('review/replay_grids.py').read()
def gsub(old, new):
    global g
    assert g.count(old) == 1, old[:80]
    g = g.replace(old, new)
def between(a, b):   # the text from marker a up to (not including) marker b, exactly one occurrence
    i = g.index(a); j = g.index(b, i); assert g.count(a) == 1
    return g[i:j]
if want('G1'):
    gsub("Replays won: %s %s, %s %s · extra innings %s · %.1f runs and %.2f errors a team</p>",
         "Replays won: %s %s, %s %s · %s went to extra innings · %.1f runs and %.2f errors a team on average</p>")
if want('F2'):
    x = P['F2']; cut = x.index(' The {White Sox}')
    old = between("'<p class=\"lede\">Each League Championship Series", "'<div class=\"fcs\">")
    gsub(old, "'<p class=\"lede\">%s%%s</p>'\n            " % pyf(x[:cut]))
    note = x[cut:].replace('{White Sox}', '%s').replace('{Guardians}', '%s').replace('{2-1}', '%d-%d')
    old = between("note = ' The %s were assumed", "% (NICK[t], NICK[o], w[t], w[o])")
    gsub(old, "note = '%s' " % py(note))
if want('F3'):
    x = py(P['F3']).replace('{Rays}', '%s').replace('{3.8}', '%s')
    gsub("'<p class=\"tally\">Home field: %s (games 1, 2, 6 and 7). %s runs a team a game in the simulations.</p>'", "'<p class=\"tally\">%s</p>'" % x)
if want('F5'):
    x = pyf(P['F5']).replace('{5.6}', '%.1f')
    gsub("'<p class=\"tally\">The chance each team wins the World Series, over every pairing in proportion to its chance of happening. The series took %.1f games on average.</p>'", "'<p class=\"tally\">%s</p>'" % x)
if want('F7'):
    items = [l[2:] for l in P['F7'].split('\n')]
    old = between("'<ul class=\"assume\">", "</ul></section>')")
    gsub(old + "</ul></section>')", "'<ul class=\"assume\">" + "'\n            '".join('<li>%s</li>' % pyf(i) for i in items) + "</ul></section>')")
if want('P2'):
    old = between("'<p class=\"lede\">Each game&#39;s share of replays", "'<div class=\"scroll\"><table class=\"picks\">")
    gsub(old, "'<p class=\"lede\">%s</p>'\n            " % pyf(P['P2']))
if want('P4'):
    x = py(P['P4']).replace('{8}', '%d').replace('{14}', '%d')
    gsub("The replays&#39; favourite won %d of the %d games.", x)
if want('R2'):
    old = between("'<p class=\"lede\">One point per game", "'<div class=\"scroll\">%s</div><p class=\"tally\">%s</p>'")
    gsub(old, "'<p class=\"lede\">%s</p>'\n            " % pyf(P['R2']).replace('{14}', '%d'))
open('review/replay_grids.py', 'w').write(g)
print('applied', sorted(ONLY) if ONLY else 'all')
