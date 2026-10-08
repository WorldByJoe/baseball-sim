"""
replay_grids.py · v0.1 · 2026-10-07

The division series score grids: each finished game's replays (review/replay_game.js,
diag_out/replays/<pk>.jsonl) as a table of one team's runs (columns) against the other's
(rows), each cell the number of replays that ended at that score, shaded by count, the real
final starred, and the replays in the cell that went to extra innings counted in its corner.
Within a series the same team keeps the columns (Game 1's visitor), so the grids line up.

  python3 review/replay_grids.py OUT.html

CHANGED
  v0.1  first build (Joe, 2026-10-07)
"""
import json, sys, html, datetime

GAMES = [  # pk, series, game number, date (MLB's schedule)
    (849829, 'ALDS', 1, '2026-10-03'), (849834, 'ALDS', 2, '2026-10-05'), (849833, 'ALDS', 3, '2026-10-07'),
    (849835, 'ALDS', 1, '2026-10-03'), (849839, 'ALDS', 2, '2026-10-05'),
    (849828, 'NLDS', 1, '2026-10-03'), (849823, 'NLDS', 2, '2026-10-04'), (849819, 'NLDS', 3, '2026-10-06'), (849822, 'NLDS', 4, '2026-10-07'),
    (849830, 'NLDS', 1, '2026-10-03'), (849825, 'NLDS', 2, '2026-10-04'), (849826, 'NLDS', 3, '2026-10-06'),
]
NICK = {'CWS': 'White Sox', 'CLE': 'Guardians', 'NYY': 'Yankees', 'TB': 'Rays', 'ATL': 'Braves', 'LAD': 'Dodgers', 'SD': 'Padres', 'MIL': 'Brewers'}


def load(pk):
    G = json.load(open('review/games/%d.json' % pk))
    R = [json.loads(l) for l in open('diag_out/replays/%d.jsonl' % pk) if l.startswith('{')]
    return G, R


def grid(pk, num, date, colTeam, rowTeam):
    G, R = load(pk)
    ab = {'away': G['teams']['away']['abbrev'], 'home': G['teams']['home']['abbrev']}
    side = {ab['away']: 0, ab['home']: 1}   # index into a replay's score [away, home]
    ci, ri = side[colTeam], side[rowTeam]
    real = {ab['away']: G['final']['away'], ab['home']: G['final']['home']}
    n_c = max(max(r['score'][ci] for r in R), real[colTeam]); n_r = max(max(r['score'][ri] for r in R), real[rowTeam])
    cnt = [[0] * (n_c + 1) for _ in range(n_r + 1)]; ext = [[0] * (n_c + 1) for _ in range(n_r + 1)]
    for r in R:
        c, w = r['score'][ci], r['score'][ri]
        cnt[w][c] += 1
        if r['innings'] > 9: ext[w][c] += 1
    top = max(max(row) for row in cnt)
    N = len(R); colWins = sum(1 for r in R if r['score'][ci] > r['score'][ri]); extras = sum(1 for r in R if r['innings'] > 9)
    home = ab['home']; d = datetime.date.fromisoformat(date)
    when = d.strftime('%b ') + str(d.day)
    cn, rn = NICK[colTeam], NICK[rowTeam]
    winner = colTeam if real[colTeam] > real[rowTeam] else rowTeam
    loser = rowTeam if winner == colTeam else colTeam
    out = ['<figure class="game" id="g%d">' % pk,
           '<figcaption><h3>Game %d <span class="when">%s · at %s</span></h3>' % (num, when, html.escape(NICK[home])),
           '<p class="final">Final: %s %d, %s %d</p>' % (NICK[winner], real[winner], NICK[loser], real[loser]),
           '<p class="tally">Replays won: %s %s, %s %s · extra innings %s</p></figcaption>' % (
               cn, f'{colWins:,}', rn, f'{N - colWins:,}', f'{extras:,}'),
           '<div class="scroll"><table class="grid" aria-label="Game %d replays: %s runs across, %s runs down">' % (num, cn, rn),
           '<thead><tr><th class="corner" rowspan="2" colspan="2"></th><th class="axis" colspan="%d">%s runs%s</th></tr><tr>' % (
               n_c + 1, cn, ' (home)' if colTeam == home else ''),
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
    out.append('</tbody></table></div></figure>')
    return '\n'.join(out)


def main(path):
    series = []
    for pk, ser, num, date in GAMES:
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
    page = open('review/replay_grids_template.html').read().replace('<!--GRIDS-->', '\n'.join(body))
    open(path, 'w').write(page)
    print('wrote', path, len(page), 'bytes')


if __name__ == '__main__':
    main(sys.argv[1])
