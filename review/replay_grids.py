"""
replay_grids.py · v0.8 · 2026-10-08

The division series score grids: each finished game's replays (review/replay_game.js,
diag_out/replays/<pk>.jsonl) as a table of one team's runs (columns) against the other's
(rows), each cell the number of replays that ended at that score, shaded by count, the real
final starred, and the replays in the cell that went to extra innings counted in its corner.
Within a series the same team keeps the columns (Game 1's visitor), so the grids line up.

  python3 review/replay_grids.py OUT.html            (for the artifact)
  python3 review/replay_grids.py OUT.html --page     (a whole document, for GitHub Pages)

CHANGED
  v0.8  the ALCS against either AL Central team while their fifth game is to come (the pennant over three teams, each ALCS
        weighted by the model's call of the game); once it is played, the winner's ALCS
  v0.7  the couch companion (live/) as a third view: live on GitHub Pages, its replay inside the artifact (published with live/ beside it)
  v0.6  a game not yet played shows its prediction before first pitch (diag_out/predict, review/pregame.js) as a card of its own; once played, its card says what the prediction gave
  v0.5  the LCS and World Series forecast (review/series_forecast.json); the trait map as a second view; --page for GitHub Pages
  v0.4  the series picks: each series' chance for its winner from the replays' game chances, per set; the favourite's games won
  v0.3  a third set, each fielder's own error tendency (replay_game.js mode 'errors'); errors in the tallies and captions
  v0.2  two sets a reader flips between: the regular season's pitching and the pitching as it was that day
        (review/replay_game.js mode 'pitched'), on shared axes and colours; a game shows once both sets exist
  v0.1  first build (Joe, 2026-10-07)
"""
import json, sys, html, datetime, os

GAMES = [  # pk, series, game number, date (MLB's schedule)
    (849829, 'ALDS', 1, '2026-10-03'), (849834, 'ALDS', 2, '2026-10-05'), (849833, 'ALDS', 3, '2026-10-07'), (849832, 'ALDS', 4, '2026-10-08'), (849831, 'ALDS', 5, '2026-10-10'),
    (849835, 'ALDS', 1, '2026-10-03'), (849839, 'ALDS', 2, '2026-10-05'), (849838, 'ALDS', 3, '2026-10-07'),
    (849828, 'NLDS', 1, '2026-10-03'), (849823, 'NLDS', 2, '2026-10-04'), (849819, 'NLDS', 3, '2026-10-06'), (849822, 'NLDS', 4, '2026-10-07'),
    (849830, 'NLDS', 1, '2026-10-03'), (849825, 'NLDS', 2, '2026-10-04'), (849826, 'NLDS', 3, '2026-10-06'), (849827, 'NLDS', 4, '2026-10-07'),
]
NICK = {'CWS': 'White Sox', 'CLE': 'Guardians', 'NYY': 'Yankees', 'TB': 'Rays', 'ATL': 'Braves', 'LAD': 'Dodgers', 'SD': 'Padres', 'MIL': 'Brewers'}


SETS = (('season', 'diag_out/replays'), ('pitched', 'diag_out/replays_pitched'), ('errors', 'diag_out/replays_errors'))
SET_NAME = {'season': 'regular-season pitching', 'pitched': 'as pitched that day', 'errors': "fielders' own error rates"}


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
    out = ['<table class="grid" data-set="%s" aria-label="Game %d replays (%s): %s runs across, %s runs down">' % (key, num, SET_NAME[key], cn, rn),
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


def load_pred(pk):
    """A game's prediction before first pitch, if one was run: its notes and its simulations per set (no game-day pitching
    exists before a game, so the as-pitched set shows the regular-season one)."""
    import glob
    meta = 'diag_out/predict/%d.json' % pk
    if not os.path.exists(meta): return None, None
    M = json.load(open(meta)); RS = {}
    for key in ('season', 'errors'):
        RS[key] = [json.loads(l) for f in sorted(glob.glob('diag_out/predict/%d_%s_*.jsonl' % (pk, key))) for l in open(f) if l.startswith('{')]
    if not all(RS.values()): return None, None
    RS = {'season': RS['season'], 'pitched': RS['season'], 'errors': RS['errors']}
    return M, RS


def pred_line(pk, ab):
    """After the game: what the prediction before first pitch gave each side, per set."""
    M, RS = load_pred(pk)
    if not M: return ''
    out = []
    for key, R in RS.items():
        hw = sum(1 for r in R if r['score'][1] > r['score'][0]) / len(R)
        out.append('<p class="tally pred" data-set="%s">Before first pitch the model gave %s %.0f%%, %s %.0f%%.</p>' % (key, NICK[ab['home']], 100 * hw, NICK[ab['away']], 100 * (1 - hw)))
    return ''.join(out)


def pred_grid(pk, num, date, colTeam, rowTeam):
    """A game not yet played: its simulations before first pitch as a score grid, no star (there is no final yet)."""
    M, RS = load_pred(pk)
    ab = {'away': M['away'], 'home': M['home']}; side = {ab['away']: 0, ab['home']: 1}
    ci, ri = side[colTeam], side[rowTeam]
    allR = [r for R in RS.values() for r in R]
    n_c = max(r['score'][ci] for r in allR); n_r = max(r['score'][ri] for r in allR)
    top = 0
    for R in RS.values():
        c = {}
        for r in R: k = (r['score'][ci], r['score'][ri]); c[k] = c.get(k, 0) + 1
        top = max(top, max(c.values()))
    home = ab['home']; d = datetime.date.fromisoformat(date); when = d.strftime('%b ') + str(d.day)
    cn, rn = NICK[colTeam], NICK[rowTeam]
    st = M['starters']
    out = ['<figure class="game pred" id="g%d">' % pk,
           '<figcaption><h3>Game %d <span class="when">%s · at %s</span> <span class="badge">Prediction</span></h3>' % (num, when, html.escape(NICK[home])),
           '<p class="final">Not yet played. Starters%s: %s for the %s, %s for the %s; %s.</p>' % (
               ' assumed, since MLB had not named them' if M.get('assumed') else '', html.escape(st[ab['away']][1]), NICK[ab['away']], html.escape(st[ab['home']][1]), NICK[ab['home']],
               html.escape(M.get('lineups', 'lineups from the last game')))]
    for key, R in RS.items():
        N = len(R); colWins = sum(1 for r in R if r['score'][ci] > r['score'][ri]); extras = sum(1 for r in R if r['innings'] > 9)
        runs = sum(sum(r['score']) for r in R) / N / 2
        extra = ' There is no game-day pitching before a game is played, so this view shows the regular-season setting.' if key == 'pitched' else ''
        out.append('<p class="tally" data-set="%s">Simulations won: %s %s, %s %s · %s went to extra innings · %.1f runs a team on average.%s</p>' % (
            key, cn, f'{colWins:,}', rn, f'{N - colWins:,}', f'{extras:,}', runs, extra))
    out.append('</figcaption><div class="scroll">')
    for key, R in RS.items(): out.append(table(R, ci, ri, n_c, n_r, top, {colTeam: -1, rowTeam: -1}, colTeam, rowTeam, cn, rn, home, num, key))
    out.append('</div></figure>')
    return '\n'.join(out)


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
    feed = json.load(open('playoffs/games/%d_feed.json' % pk)); lsc = feed['liveData']['linescore']['teams']
    errs = {ab['away']: lsc['away']['errors'], ab['home']: lsc['home']['errors']}
    home = ab['home']; d = datetime.date.fromisoformat(date)
    when = d.strftime('%b ') + str(d.day)
    cn, rn = NICK[colTeam], NICK[rowTeam]
    winner = colTeam if real[colTeam] > real[rowTeam] else rowTeam
    loser = rowTeam if winner == colTeam else colTeam
    out = ['<figure class="game" id="g%d">' % pk,
           '<figcaption><h3>Game %d <span class="when">%s · at %s</span></h3>' % (num, when, html.escape(NICK[home])),
           '<p class="final">Final: %s %d, %s %d <span class="errs">· errors: %s %d, %s %d</span></p>' % (NICK[winner], real[winner], NICK[loser], real[loser],
               cn, errs[colTeam], rn, errs[rowTeam])]
    for key, R in RS.items():
        N = len(R); colWins = sum(1 for r in R if r['score'][ci] > r['score'][ri]); extras = sum(1 for r in R if r['innings'] > 9)
        runs = sum(sum(r['score']) for r in R) / N / 2; ers = sum(sum(r.get('errors', [0, 0])) for r in R) / N / 2
        out.append('<p class="tally" data-set="%s">Replays won: %s %s, %s %s · %s went to extra innings · %.1f runs and %.2f errors a team on average</p>' % (
            key, cn, f'{colWins:,}', rn, f'{N - colWins:,}', f'{extras:,}', runs, ers))
    out.append(pred_line(pk, ab))
    out.append('</figcaption><div class="scroll">')
    for key, R in RS.items(): out.append(table(R, ci, ri, n_c, n_r, top, real, colTeam, rowTeam, cn, rn, home, num, key))
    out.append('</div></figure>')
    return '\n'.join(out)


def series_chance(ps, n=5):
    """The chance a team wins a best-of-n, given its chance in each game played; a game not yet played takes the series' average."""
    import itertools
    m = sum(ps) / len(ps); ps = ps + [m] * (n - len(ps)); tot = 0
    for o in itertools.product((0, 1), repeat=n):   # play all n: winning a majority is the same as winning first
        pr = 1
        for w, p in zip(o, ps): pr *= p if w else 1 - p
        if sum(o) > n // 2: tot += pr
    return tot


def picks_section(series):
    """Each series' chance for its winner (or leader) from the replays' chance in each game, per set; and how often the favourite won a game."""
    rows = []; right = {k: 0 for k, _ in SETS}; ngames = 0
    for S in series:
        A, B = S['col'], S['row']; wins = {A: 0, B: 0}; games = []
        for pk, num, date in S['games']:
            G, RS = load(pk); ab = (G['teams']['away']['abbrev'], G['teams']['home']['abbrev'])
            w = ab[0] if G['final']['away'] > G['final']['home'] else ab[1]; wins[w] += 1
            pA = {k: sum(1 for r in R if (r['score'][0] > r['score'][1]) == (ab[0] == A)) / len(R) for k, R in RS.items()}
            games.append((num, w, pA))
            for k in pA: right[k] += (pA[k] > 0.5) == (w == A)
            ngames += 1
        lead = A if wins[A] >= wins[B] else B; other = B if lead == A else A
        done = max(wins.values()) == 3
        status = '%s %s %d-%d' % (NICK[lead], 'won' if done else ('lead' if wins[lead] > wins[other] else 'tied with %s at' % NICK[other]), wins[lead], wins[other])
        if wins[lead] == wins[other]: status = '%s and %s tied %d-%d' % (NICK[A], NICK[B], wins[A], wins[B])
        cells = []
        for g in range(1, 6):
            hit = [x for x in games if x[0] == g]
            if not hit: cells.append('<td class="na">&middot;</td>'); continue
            num, w, pA = hit[0]
            res = 'W' if w == lead else 'L'
            cells.append('<td>' + ''.join('<span data-set="%s">%.0f%%</span>' % (k, 100 * (pA[k] if lead == A else 1 - pA[k])) for k, _ in SETS) +
                         ' <span class="wl %s" title="%s %s the real game">%s</span></td>' % (res.lower(), NICK[lead], 'won' if res == 'W' else 'lost', res))
        ch, verdict = [], []
        for k, _ in SETS:
            c = series_chance([(x[2][k] if lead == A else 1 - x[2][k]) for x in games])
            ch.append('<span data-set="%s">%.0f%%</span>' % (k, 100 * c))
            if done: v = 'right' if c > 0.5 else 'missed'
            else: v = 'open, leans %s' % NICK[lead if c > 0.5 else other]
            verdict.append('<span data-set="%s" class="v %s">%s</span>' % (k, v.split(',')[0], v))
        rows.append('<tr><th scope="row"><span class="tag">%s</span> %s vs %s</th><td class="res">%s</td>%s<td class="ch">%s</td><td>%s</td></tr>' % (
            S['name'], NICK[A], NICK[B], status, ''.join(cells), ''.join(ch), ''.join(verdict)))
    tally = ''.join('<span data-set="%s">The team the replays favoured won %d of the %d games played so far.</span>' % (k, right[k], ngames) for k, _ in SETS)
    return ('<section class="series picks-sec" id="picks"><h2><span class="tag">SERIES</span> Did the replays pick the series winners?</h2>'
            '<p class="lede">The table takes the team that won or leads each series and shows, for each game, the share of the 1,000 replays that team won under whichever setting the switch above shows, marked W or L for whether it won the real game. The series chance combines those game shares into the chance of winning a best-of-five, with any game not yet played counted at the series&#39; average share; the pick is the side that chance favours. These are not forecasts. Each game&#39;s replays used the lineups and pitchers that really played, which were known only once the game began, so the table asks a narrower question: given who played, did the replays lean the way the games went? Before the correction of 2026-10-08 (see the notes below), the regular-season setting gave the Dodgers 80%%, the Brewers 85%%, the Rays 47%% and the White Sox 60%%: the same calls, made with more confidence than the corrected replays support.</p>'
            '<div class="scroll"><table class="picks"><thead><tr><th scope="col">Series</th><th scope="col">Result</th>'
            + ''.join('<th scope="col" class="g">G%d</th>' % g for g in range(1, 6)) +
            '<th scope="col">Series chance</th><th scope="col">The pick</th></tr></thead><tbody>%s</tbody></table></div><p class="tally">%s</p></section>') % ('\n'.join(rows), tally)


def forecast_section(series):
    """The League Championship Series and World Series played 2,000 times each before Game 1 (review/series_sim.js, review/series_summary.py)."""
    F = json.load(open('review/series_forecast.json'))
    def pct(v): return '%.0f%%' % (100 * v)
    def lengths(d):   # four small columns, the chance the series takes 4, 5, 6 or 7 games
        top = max(d.values())
        return '<div class="len">' + ''.join('<div class="lc" title="%s games: %s of the simulated series"><span class="lb" style="height:%.0f%%"></span><span class="ln">%s</span><span class="lk">%s</span></div>' % (
            k, pct(v), 100 * v / top, pct(v), k) for k, v in sorted(d.items())) + '</div>'
    def split(win, hi, lo):   # one bar: the favourite's share from the left
        a, b = win.get(hi, 0), win.get(lo, 0)
        return ('<div class="split" role="img" aria-label="%s %s, %s %s"><span class="sa" style="width:%.1f%%"></span></div>'
                '<div class="splitk"><span><b>%s</b> %s</span><span>%s <b>%s</b></span></div>') % (NICK[hi], pct(a), NICK[lo], pct(b), 100 * a, NICK[hi], pct(a), pct(b), NICK[lo])
    def lcs(name, label):
        d = F[name]; S = json.load(open('review/series/%s.json' % ('ALCS' if name == 'ALCS_CWS' else name))); hi, lo = S['hi'], S['lo']
        fav = max(d['win'], key=d['win'].get); oth = lo if fav == hi else hi
        return ('<div class="fc"><h3><span class="tag">%s</span> %s vs %s</h3>%s'
                '<p class="tally">Home field: %s (games 1, 2, 6 and 7). The simulated games averaged %s runs a team.</p>'
                '<p class="lenh">Games the series takes</p>%s</div>') % (name[:4], NICK[hi], NICK[lo], split(d['win'], fav, oth), NICK[hi], '%.1f' % d['runs'], lengths(d['length']))
    def alcs_open():
        w, how = F['alCentral']['odds'], F['alCentral']['how']; pen = F['ALCS']['win']
        order = sorted(pen, key=lambda t: -pen[t]); x = 0; segs = []
        for j, t in enumerate(order):
            segs.append('<span class="s%d" style="left:%.1f%%;width:%.1f%%"></span>' % (j, 100 * x, 100 * pen[t])); x += pen[t]
        key = ''.join('<span><i class="k%d"></i><b>%s</b> %s</span>' % (j, NICK[t], pct(pen[t])) for j, t in enumerate(order))
        ifs = []
        for t in sorted(w, key=lambda t: -w[t]):
            d = F['ALCS_' + t]
            ifs.append('<li>If the %s win Game 5 (a %s chance in the model): Rays %s, %s %s.</li>' % (NICK[t], pct(w[t]), pct(d['win'].get('TB', 0)), NICK[t], pct(d['win'].get(t, 0))))
        t1, t2 = sorted(w, key=lambda t: -w[t])
        how_bar = ('<p class="tally">Each team&#39;s chance of the pennant, counting Game 5: the Rays&#39; %s is their %s if the %s come through and %s if the %s do, weighted %.0f to %.0f.</p>' % (
            pct(pen['TB']), pct(F['ALCS_' + t1]['win'].get('TB', 0)), NICK[t1], pct(F['ALCS_' + t2]['win'].get('TB', 0)), NICK[t2], 100 * w[t1], 100 * w[t2]))
        return ('<div class="fc"><h3><span class="tag">ALCS</span> Rays vs the ALDS winner</h3>'
                '<p class="lenh">The American League pennant</p><div class="split three" role="img" aria-label="%s">%s</div><div class="splitk three">%s</div>%s'
                '<ul class="ifs">%s</ul>'
                '<p class="tally">Home field: Rays (games 1, 2, 6 and 7) against either team.</p>'
                '<p class="lenh">Games the series takes</p>%s</div>') % (
            ', '.join('%s %s' % (NICK[t], pct(pen[t])) for t in order), ''.join(segs), key, how_bar, ''.join(ifs), lengths(F['ALCS']['length']))
    # the ALDS still open, if any, for the assumption's wording
    note = ''
    for S in series:
        A, B = S['col'], S['row']; w = {A: 0, B: 0}
        for pk, num, date in S['games']:
            G, _ = load(pk); ab = (G['teams']['away']['abbrev'], G['teams']['home']['abbrev'])
            w[ab[0] if G['final']['away'] > G['final']['home'] else ab[1]] += 1
        if max(w.values()) < 3:
            al = json.load(open('review/series/ALCS.json')); t = al['hi'] if al['hi'] in w else al['lo']; o = B if t == A else A
            note = ' The %s were assumed to beat the %s, whose series stood %d-%d when the forecast ran.' % (NICK[t], NICK[o], w[t], w[o])
    if 'ALCS_CLE' in F:   # the Guardians won Game 4: the American League's other finalist is open until the fifth game
        odds, how = F['alCentral']['odds'], F['alCentral']['how']
        if how == 'predicted':
            note = (' The American League&#39;s other finalist was still open: the Guardians and the White Sox play a fifth game, which the model gives the Guardians a %s chance'
                    ' of winning, so each possible ALCS is weighted by its chance of happening.') % pct(odds['CLE'])
        else:
            note = ' The %s won the fifth game.' % NICK[max(odds, key=odds.get)]
    rows = []
    for name in sorted([k for k in F if k.startswith('WS_')], key=lambda k: -F[k]['chance']):
        d = F[name]; S = json.load(open('review/series/%s.json' % name)); hi, lo = S['hi'], S['lo']
        fav = max(d['win'], key=d['win'].get)
        rows.append('<tr><th scope="row">%s vs %s</th><td class="num">%s</td><td>%s %s</td><td>%s</td></tr>' % (
            NICK[hi], NICK[lo], pct(d['chance']), NICK[fav], pct(d['win'][fav]), ' &middot; '.join('%s in %s' % (pct(v), k) for k, v in sorted(d['length'].items()))))
    champ = sorted(F['champion'].items(), key=lambda kv: -kv[1]); top = champ[0][1]
    bars = ''.join('<div class="cb"><span class="cn">%s</span><span class="ct"><span class="cf" style="width:%.1f%%"></span></span><span class="cv">%s</span></div>' % (
        NICK[t], 100 * v / top, pct(v)) for t, v in champ)
    wl = F['wsLength']; mean = sum(int(k) * v for k, v in wl.items())
    return ('<section class="series fc-sec" id="forecast"><h2><span class="tag">LCS</span> Who goes on: the League Championship Series and the World Series</h2>'
            '<p class="lede">Each League Championship Series was played 2,000 times before its Game 1, and each possible World Series pairing 2,000 times, by the same simulation, with each fielder making errors at his own regular-season rate (the third of the pitching and fielding settings described below). The bars give the share of those series each team won; the columns give how many games the series took.%s</p>'
            '<div class="fcs">%s%s</div>'
            '<div class="fc wide"><h3><span class="tag">WS</span> The World Series</h3>'
            '<div class="champ" aria-label="Chance to win the World Series">%s</div>'
            '<p class="tally">Each team&#39;s chance of winning the World Series: its chance in each pairing, weighted by how likely that pairing is to happen (the table below). The simulated series lasted %.1f games on average.</p>'
            '<p class="lenh">Games the World Series takes</p>%s'
            '<div class="scroll"><table class="picks ws"><thead><tr><th scope="col">Pairing</th><th scope="col">Chance it happens</th><th scope="col">Favourite</th><th scope="col">Games it takes</th></tr></thead>'
            '<tbody>%s</tbody></table></div></div>'
            '<ul class="assume"><li>Lineups: each team&#39;s last division series lineup, every man at the position he started.</li>'
            '<li>Starting pitchers: each team&#39;s division series starters in order, with regular-season starters added to make a four-man rotation.</li>'
            '<li>Bullpens: the relievers on the playoff roster, brought in by the model&#39;s manager, all rested at the start of every game.</li>'
            '<li>Home field: the team with the better regular-season record plays games 1, 2, 6 and 7 at home; open-air parks at 60 F, roofed parks at 72 F.</li>'
            '<li>Each simulated series drew every hitter&#39;s traits once, at its start, and kept them for the whole series.</li></ul></section>') % (
        note, alcs_open() if 'ALCS_CLE' in F and F['alCentral']['how'] == 'predicted' else lcs('ALCS' if 'ALCS_CLE' not in F else ('ALCS_' + max(F['alCentral']['odds'], key=F['alCentral']['odds'].get)), 'American League'),
        lcs('NLCS', 'National League'), bars, mean, lengths(wl), '\n'.join(rows))


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
    return ('<section class="series logit-sec" id="regression"><h2><span class="tag">FIT</span> Did the replays pick the game winners?</h2>'
            '<p class="lede">Each point is one game, seen from the home team&#39;s side: across, the share of the 1,000 replays (regular-season pitching) the home team won; up or down, whether it won the real game. The blue curve is a logistic regression, the curve that best turns the replay share into a probability of the real win, with its 95%% band. The dashed line is where the points would sit if the replay share were exactly the chance of winning, so that a team which won most of its replays won the real game just as often. The curve rises, so a higher replay share went with more real wins, but with only %d games the rise is not significant at the usual 0.05 level: the uncertainty is wide enough to include no relationship at all.</p>'
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
    played = set(g[0] for g in games)
    for pk, ser, num, date in GAMES:
        if pk in played: continue
        M, _ = load_pred(pk)
        if not M: continue
        for s in series:
            if s['key'] == frozenset((M['away'], M['home'])): s.setdefault('pred', []).append((pk, num, date))
    body = []
    for s in series:
        body.append('<section class="series"><h2><span class="tag">%s</span> %s vs %s</h2><div class="games">' % (s['name'], NICK[s['col']], NICK[s['row']]))
        for pk, num, date in s['games']: body.append(grid(pk, num, date, s['col'], s['row']))
        for pk, num, date in s.get('pred', []): body.append(pred_grid(pk, num, date, s['col'], s['row']))
        body.append('</div></section>')
    body.append(picks_section(series))
    body.append(logit_section())
    runs = {}; errs = {}
    for key, d in SETS:
        tot = te = n = 0
        for pk, _, _, _ in games:
            R = [json.loads(l) for l in open('%s/%d.jsonl' % (d, pk)) if l.startswith('{')]
            tot += sum(sum(r['score']) for r in R) / len(R) / 2; te += sum(sum(r.get('errors', [0, 0])) for r in R) / len(R) / 2; n += 1
        runs[key] = tot / n; errs[key] = te / n
    reale = sum(sum(json.load(open('playoffs/games/%d_feed.json' % g[0]))['liveData']['linescore']['teams'][s]['errors'] for s in ('away', 'home')) / 2 for g in games) / len(games)
    realr = sum((json.load(open('review/games/%d.json' % g[0]))['final']['away'] + json.load(open('review/games/%d.json' % g[0]))['final']['home']) / 2 for g in games) / len(games)
    page = open('review/replay_grids_template.html').read().replace('<!--GRIDS-->', '\n'.join(body)).replace('<!--FORECAST-->', forecast_section(series))
    for key in runs: page = page.replace('<!--RUNS_%s-->' % key.upper(), '%.2f' % runs[key]).replace('<!--ERR_%s-->' % key.upper(), '%.2f' % errs[key])
    page = page.replace('<!--RUNS_REAL-->', '%.2f' % realr).replace('<!--ERR_REAL-->', '%.2f' % reale).replace('<!--NGAMES-->', str(len(games)))
    # the trait map (docs/trait_map.html on main) rides along as a JSON string the page opens in a frame of its own; every '<' escaped so no tag inside can end this one
    import subprocess
    tm = subprocess.run(['git', 'show', 'origin/main:docs/trait_map.html'], capture_output=True, text=True, check=True).stdout
    page = page.replace('<!--TRAITMAP-->', json.dumps(tm).replace('<', '\\u003c'))
    if '--page' in sys.argv:   # a whole document for GitHub Pages (the artifact host adds this skeleton itself)
        head, rest = page.split('</style>', 1)
        page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                + head + '</style>\n</head>\n<body>\n' + rest + '\n</body>\n</html>\n')
    open(path, 'w').write(page)
    print('wrote', path, len(page), 'bytes')


if __name__ == '__main__':
    main(sys.argv[1])
