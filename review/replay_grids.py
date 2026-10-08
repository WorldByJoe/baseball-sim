"""
replay_grids.py · v0.2 · 2026-10-07

The division series score grids: each finished game's replays (review/replay_game.js,
diag_out/replays/<pk>.jsonl) as a table of one team's runs (columns) against the other's
(rows), each cell the number of replays that ended at that score, shaded by count, the real
final starred, and the replays in the cell that went to extra innings counted in its corner.
Within a series the same team keeps the columns (Game 1's visitor), so the grids line up.

  python3 review/replay_grids.py OUT.html

CHANGED
  v0.2  two sets a reader flips between: the regular season's pitching and the pitching as it was that day
        (review/replay_game.js mode 'pitched'), on shared axes and colours; a game shows once both sets exist
  v0.1  first build (Joe, 2026-10-07)
"""
import json, sys, html, datetime, os

GAMES = [  # pk, series, game number, date (MLB's schedule)
    (849829, 'ALDS', 1, '2026-10-03'), (849834, 'ALDS', 2, '2026-10-05'), (849833, 'ALDS', 3, '2026-10-07'),
    (849835, 'ALDS', 1, '2026-10-03'), (849839, 'ALDS', 2, '2026-10-05'), (849838, 'ALDS', 3, '2026-10-07'),
    (849828, 'NLDS', 1, '2026-10-03'), (849823, 'NLDS', 2, '2026-10-04'), (849819, 'NLDS', 3, '2026-10-06'), (849822, 'NLDS', 4, '2026-10-07'),
    (849830, 'NLDS', 1, '2026-10-03'), (849825, 'NLDS', 2, '2026-10-04'), (849826, 'NLDS', 3, '2026-10-06'), (849827, 'NLDS', 4, '2026-10-07'),
]
NICK = {'CWS': 'White Sox', 'CLE': 'Guardians', 'NYY': 'Yankees', 'TB': 'Rays', 'ATL': 'Braves', 'LAD': 'Dodgers', 'SD': 'Padres', 'MIL': 'Brewers'}


SETS = (('season', 'diag_out/replays'), ('pitched', 'diag_out/replays_pitched'))


def load(pk):
    G = json.load(open('review/games/%d.json' % pk))
    R = {k: [json.loads(l) for l in open('%s/%d.jsonl' % (d, pk)) if l.startswith('{')] for k, d in SETS}
    return G, R


def table(R, ci, ri, n_c, n_r, top, real, colTeam, rowTeam, cn, rn, home, num, key):
    cnt = [[0] * (n_c + 1) for _ in range(n_r + 1)]; ext = [[0] * (n_c + 1) for _ in range(n_r + 1)]
    for r in R:
        c, w = r['score'][ci], r['score'][ri]
        cnt[w][c] += 1
        if r['innings'] > 9: ext[w][c] += 1
    N = len(R)
    out = ['<table class="grid" data-set="%s" aria-label="Game %d replays (%s): %s runs across, %s runs down">' % (key, num, 'regular-season pitching' if key == 'season' else 'as pitched that day', cn, rn),
           '<thead><tr><th class="corner" rowspan="2" colspan="2"></th><th class="axis" colspan="%d">%s runs%s</th></tr><tr>' % (n_c + 1, cn, ' (home)' if colTeam == home else ''),
           ''.join('<th class="c">%d</th>' % c for c in range(n_c + 1)), '</tr></thead><tbody>']
    for w in range(n_r + 1):
        row = ['<tr>']
        if w == 0: row.append('<th class="axis side" rowspan="%d"><span>%s runs%s</span></th>' % (n_r + 1, rn, ' (home)' if rowTeam == home else ''))
        row.append('<th class="r">%d</th>' % w)
        for c in range(n_c + 1):
            k, e = cnt[w][c], ext[w][c]
            star = (c == real[colTeam] and w == real[rowTeam])
            cls = []
            if c == w: cls.append('tie')
            t = k / top if top else 0
            if k and t >= 0.5: cls.append('hot')
            if star: cls.append('real')
            tip = '%s %d, %s %d: %s of %s replays' % (cn, c, rn, w, f'{k:,}', f'{N:,}') + (', %d in extra innings' % e if e else '') + (' (the real final)' if star else '')
            if c == w: tip = 'A game cannot end tied'
            style = ' style="--t:%.3f"' % t if k else ''
            inner = ('<span class="n">%d</span>' % k if k else '') + ('<span class="star" aria-label="real final">★</span>' if star else '') + ('<span class="x">x%d</span>' % e if e else '')
            row.append('<td class="%s"%s title="%s">%s</td>' % (' '.join(cls), style, html.escape(tip), inner))
        row.append('</tr>'); out.append(''.join(row))
    out.append('</tbody></table>')
    return ''.join(out)


def grid(pk, num, date, colTeam, rowTeam):
    G, RS = load(pk)
    ab = {'away': G['teams']['away']['abbrev'], 'home': G['teams']['home']['abbrev']}
    side = {ab['away']: 0, ab['home']: 1}   # index into a replay's score [away, home]
    ci, ri = side[colTeam], side[rowTeam]
    real = {ab['away']: G['final']['away'], ab['home']: G['final']['home']}
    allR = [r for R in RS.values() for r in R]   # both sets share the axes and the colour scale, so a flip shows the change
    n_c = max(max(r['score'][ci] for r in allR), real[colTeam]); n_r = max(max(r['score'][ri] for r in allR), real[rowTeam])
    top = 0
    for R in RS.values():
        c = {}
        for r in R: k = (r['score'][ci], r['score'][ri]); c[k] = c.get(k, 0) + 1
        top = max(top, max(c.values()))
    home = ab['home']; d = datetime.date.fromisoformat(date)
    when = d.strftime('%b ') + str(d.day)
    cn, rn = NICK[colTeam], NICK[rowTeam]
    winner = colTeam if real[colTeam] > real[rowTeam] else rowTeam
    loser = rowTeam if winner == colTeam else colTeam
    out = ['<figure class="game" id="g%d">' % pk,
           '<figcaption><h3>Game %d <span class="when">%s · at %s</span></h3>' % (num, when, html.escape(NICK[home])),
           '<p class="final">Final: %s %d, %s %d</p>' % (NICK[winner], real[winner], NICK[loser], real[loser])]
    for key, R in RS.items():
        N = len(R); colWins = sum(1 for r in R if r['score'][ci] > r['score'][ri]); extras = sum(1 for r in R if r['innings'] > 9)
        runs = sum(sum(r['score']) for r in R) / N / 2
        out.append('<p class="tally" data-set="%s">Replays won: %s %s, %s %s · extra innings %s · %.1f runs a team</p>' % (
            key, cn, f'{colWins:,}', rn, f'{N - colWins:,}', f'{extras:,}', runs))
    out.append('</figcaption><div class="scroll">')
    for key, R in RS.items(): out.append(table(R, ci, ri, n_c, n_r, top, real, colTeam, rowTeam, cn, rn, home, num, key))
    out.append('</div></figure>')
    return '\n'.join(out)


def logit_section():
    """The replays' win share against the real results (review/win_logit.py's fit), as an SVG that follows the page's theme."""
    import numpy as np
    from scipy import stats
    from win_logit import rows, fit
    D = rows(); x = np.array([d['p'] for d in D]); y = np.array([d['y'] for d in D], float)
    b, cov, mu, ll1, ll0 = fit(x, y); se = np.sqrt(np.diag(cov))
    p_wald = 2 * stats.norm.sf(abs(b[1] / se[1])); p_lr = stats.chi2.sf(2 * (ll1 - ll0), 1)
    r2m = 1 - ll1 / ll0; r2t = mu[y == 1].mean() - mu[y == 0].mean()
    W, H, L, R, T, B = 760, 470, 64, 20, 24, 56
    def X(v): return L + v * (W - L - R)
    def Y(v): return T + (1.08 - v) / 1.16 * (H - T - B)   # 1.08 at the top, -0.08 at the bottom
    xs = np.linspace(0, 1, 101); Xs = np.column_stack([np.ones_like(xs), xs]); eta = Xs @ b
    se_eta = np.sqrt(np.einsum('ij,jk,ik->i', Xs, cov, Xs)); sig = lambda z: 1 / (1 + np.exp(-z))
    lo, hi, fitc = sig(eta - 1.96 * se_eta), sig(eta + 1.96 * se_eta), sig(eta)
    band = 'M' + ' L'.join('%.1f,%.1f' % (X(a), Y(c)) for a, c in zip(xs, hi)) + ' L' + ' L'.join('%.1f,%.1f' % (X(a), Y(c)) for a, c in zip(xs[::-1], lo[::-1])) + ' Z'
    curve = 'M' + ' L'.join('%.1f,%.1f' % (X(a), Y(c)) for a, c in zip(xs, fitc))
    g = ['<svg class="logit" viewBox="0 0 %d %d" role="img" aria-label="Logistic regression of the real result on the replays\' win share, %d games">' % (W, H, len(D))]
    for t in range(0, 11):   # grid and the x axis
        v = t / 10; g.append('<line class="gl" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (X(v), Y(1.08), X(v), Y(-0.08)))
        g.append('<text class="tk" x="%.1f" y="%.1f" text-anchor="middle">%d%%</text>' % (X(v), H - B + 18, 10 * t))
    for v, lab in ((0, 'lost'), (0.25, '25%'), (0.5, '50%'), (0.75, '75%'), (1, 'won')):
        g.append('<line class="gl" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (X(0), Y(v), X(1), Y(v)))
        g.append('<text class="tk" x="%.1f" y="%.1f" text-anchor="end">%s</text>' % (L - 8, Y(v) + 4, lab))
    g.append('<path class="band" d="%s"/>' % band)
    g.append('<line class="diag" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (X(0), Y(0), X(1), Y(1)))
    g.append('<path class="fit" d="%s"/>' % curve)
    for d in D:
        cx, cy = X(d['p']), Y(d['y'])
        tip = '%s: home team won %d of 1,000 replays (%.0f%%); %s the real game' % (d['label'], round(1000 * d['p']), 100 * d['p'], 'won' if d['y'] else 'lost')
        ty = cy - 9 if d['y'] == 0 else cy + 9
        g.append('<g class="pt"><title>%s</title><circle cx="%.1f" cy="%.1f" r="5.5"/><text class="pl" transform="translate(%.1f,%.1f) rotate(-90)" text-anchor="%s" dominant-baseline="middle">%s</text></g>' % (
            html.escape(tip), cx, cy, cx, ty, 'start' if d['y'] == 0 else 'end', html.escape(d['label'])))
    g.append('<text class="ax" x="%.1f" y="%.1f" text-anchor="middle">Home team\'s share of 1,000 replays won (regular-season pitching)</text>' % ((X(0) + X(1)) / 2, H - 12))
    g.append('<text class="ax" transform="translate(16,%.1f) rotate(-90)" text-anchor="middle">Real game, and the fitted chance of winning</text>' % ((Y(1) + Y(0)) / 2))
    g.append('</svg>')
    stats_line = 'Slope %.1f (standard error %.1f), Wald p = %.2f; likelihood-ratio p = %.2f; McFadden R² = %.2f, Tjur R² = %.2f.' % (b[1], se[1], p_wald, p_lr, r2m, r2t)
    return ('<section class="series logit-sec" id="regression"><h2><span class="tag">FIT</span> Did the replays pick the winners?</h2>'
            '<p class="lede">One point per game, from the home team&#39;s side: across, the share of the 1,000 replays (regular-season pitching) the home team won; '
            'up or down, whether it won the real game. The blue curve is a logistic regression of the real result on that share, with its 95%% band; the dashed line is where a perfectly calibrated forecast would sit. '
            'A higher replay share went with more real wins, but over %d games the slope is not significant at the usual 0.05 level.</p>'
            '<div class="scroll">%s</div><p class="tally">%s</p>'
            '<div class="howto"><span class="k"><span class="sw fit" aria-hidden="true"></span> logistic fit</span><span class="k"><span class="sw band" aria-hidden="true"></span> its 95%% band</span>'
            '<span class="k"><span class="sw diag" aria-hidden="true"></span> a perfectly calibrated forecast</span></div></section>') % (len(D), '\n'.join(g), stats_line)


def main(path):
    series = []; games = [g for g in GAMES if all(os.path.exists('%s/%d.jsonl' % (d, g[0])) for _, d in SETS)]
    for pk, ser, num, date in games:
        G, _ = load(pk)
        key = frozenset((G['teams']['away']['abbrev'], G['teams']['home']['abbrev']))
        if not series or series[-1]['key'] != key:
            series.append({'key': key, 'name': ser, 'col': G['teams']['away']['abbrev'], 'row': G['teams']['home']['abbrev'], 'games': []})
        series[-1]['games'].append((pk, num, date))
    body = []
    for s in series:
        body.append('<section class="series"><h2><span class="tag">%s</span> %s vs %s</h2><div class="games">' % (s['name'], NICK[s['col']], NICK[s['row']]))
        for pk, num, date in s['games']: body.append(grid(pk, num, date, s['col'], s['row']))
        body.append('</div></section>')
    body.append(logit_section())
    runs = {}
    for key, d in SETS:
        tot = n = 0
        for pk, _, _, _ in games:
            R = [json.loads(l) for l in open('%s/%d.jsonl' % (d, pk)) if l.startswith('{')]
            tot += sum(sum(r['score']) for r in R) / len(R) / 2; n += 1
        runs[key] = tot / n
    realr = sum((json.load(open('review/games/%d.json' % g[0]))['final']['away'] + json.load(open('review/games/%d.json' % g[0]))['final']['home']) / 2 for g in games) / len(games)
    page = open('review/replay_grids_template.html').read().replace('<!--GRIDS-->', '\n'.join(body))
    page = page.replace('<!--RUNS_SEASON-->', '%.2f' % runs['season']).replace('<!--RUNS_PITCHED-->', '%.2f' % runs['pitched']).replace('<!--RUNS_REAL-->', '%.2f' % realr).replace('<!--NGAMES-->', str(len(games)))
    open(path, 'w').write(page)
    print('wrote', path, len(page), 'bytes')


if __name__ == '__main__':
    main(sys.argv[1])
