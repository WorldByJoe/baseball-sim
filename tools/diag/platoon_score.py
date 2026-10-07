# platoon_score.py OUT...: score platoon_check outputs against the league. (1) the release-angle bands: sum over the three
# main same-side bands and seven stats of ((model - league type-controlled) / se)^2; (2) the headline splits, the two hands'
# average, beside the league's two-way estimate (statcast/platoon_2025.json)
import json, re, sys
J = json.load(open('statcast/platoon_2025.json')); L = J['psi']['bands_type']
STATS = ['whiff', 'chase', 'zswing', 'zcontact', 'xw', 'ev', 'rv']; BANDS = ['4', '5', '6']
HEAD = [('wOBA', 'outcome', 'woba', 3), ('K per PA', 'outcome', 'k', 3), ('BB per PA', 'outcome', 'bb', 3), ('xwOBA on contact', 'outcome', 'xw_bip', 3), ('exit speed (mph)', 'outcome', 'ev_bip', 1), ('launch angle (deg)', 'outcome', 'la_bip', 1),
        ('zone swing', 'discipline', 'zswing', 3), ('chase', 'discipline', 'chase', 3), ('zone contact', 'discipline', 'zcontact', 3), ('whiff (per swing)', 'discipline', 'whiff', 3), ('called strike (per take)', 'discipline', 'called', 3), ('run value per 100 pitches', 'discipline', 'rv', 2)]
print('BANDS (model -1.5..-0.5 / -0.5..0.5 / 0.5..1.5; league type-controlled in the header)')
print('%-30s %7s | %s' % ('run', 'score', '  '.join('%-24s' % ('%s (%s)' % (st, '/'.join('%+.3g' % L[st][b][0] for b in BANDS))) for st in STATS)))
for fn in sys.argv[1:]:
    t = open(fn).read(); sec = t[t.index('7. THE MODEL BY'):t.index('==== RIGHT')]
    sc, cells = 0.0, []
    for st in STATS:
        v = re.search(r'^\s+%s\s+(.*?)\s+\|' % st, sec, re.M).group(1).split(); vals = [float(v[int(b)]) for b in BANDS]
        sc += sum(((x - L[st][b][0]) / L[st][b][1]) ** 2 for b, x in zip(BANDS, vals)); cells.append('/'.join('%+.3g' % x for x in vals))
    print('%-30s %7.0f | %s' % (fn.split('/')[-1], sc, '  '.join('%-24s' % c for c in cells)))
print('\nHEADLINE (the two hands\' average of the model\'s same minus opposite; league two-way in the header)')
print('%-30s | %s' % ('run', '  '.join('%-16s' % ('%s (%s)' % (h[0][:12], ('%+.' + str(h[3]) + 'f') % J['R'][h[1]][h[2]]['both'])) for h in HEAD)))
for fn in sys.argv[1:]:
    t = open(fn).read(); hands = t.split('==== ')[1:3]; cells = []
    for lab, grp, key, d in HEAD:
        vals = []
        for h in hands:
            m = re.search(r'^\s+%s\s+\d+\s+(\S+)\s+(\S+)\s+(\S+)' % re.escape(lab), h, re.M); vals.append(float(m.group(3)))
        cells.append(('%+.' + str(d) + 'f') % (sum(vals) / len(vals)))
    print('%-30s | %s' % (fn.split('/')[-1], '  '.join('%-16s' % c for c in cells)))
