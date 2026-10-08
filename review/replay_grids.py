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
