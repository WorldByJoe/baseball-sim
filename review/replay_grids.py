"""
replay_grids.py · v0.16 · 2026-10-14

The postseason score grids: each finished game's replays (review/replay_game.js, diag_out/replays*/<pk>.jsonl, one
directory per setting) as a row of four columns, one per setting. Each column holds a table of one team's runs (columns)
against the other's (rows), 0 to 10 or more, each cell the number of replays that ended at that score, shaded by count,
the real final starred; and two histograms, the total runs and the home team's runs minus the away team's. Within a
series the same team keeps the columns (Game 1's visitor), so the grids line up.

  python3 review/replay_grids.py OUT.html            (for the artifact)
  python3 review/replay_grids.py OUT.html --page     (a whole document, for GitHub Pages)

CHANGED
  v0.16 under each game's histograms, a note on what surprised the model and what decided the game (review/game_stories.json; Joe)
  v0.15 the regression adds past Octobers (history/points_<year>.json: 2025's 47 games, hollow) and fits them with this one
  v0.14 each game a row of four columns, one per setting, each labelled with its assumptions; grids capped at 10+;
        under each grid, histograms of total runs and of home runs minus away runs (Joe, 2026-10-12)
  v0.13 newest games first; the game-pick regression sits under the forecast, below the switch it follows (Joe, 2026-10-12)
  v0.12 a series with only a prediction gets its band; only an assumed starter is marked (review/predict_next.py)
  v0.10 the regression follows the switch: one fit and figure per setting; its verdict on significance computed
"""
import json, sys, html, datetime, os

GAMES = [  # pk, series, game number, date (MLB's schedule)
    (849829, 'ALDS', 1, '2026-10-03'), (849834, 'ALDS', 2, '2026-10-05'), (849833, 'ALDS', 3, '2026-10-07'), (849832, 'ALDS', 4, '2026-10-08'), (849831, 'ALDS', 5, '2026-10-10'),
    (849835, 'ALDS', 1, '2026-10-03'), (849839, 'ALDS', 2, '2026-10-05'), (849838, 'ALDS', 3, '2026-10-07'),
    (849828, 'NLDS', 1, '2026-10-03'), (849823, 'NLDS', 2, '2026-10-04'), (849819, 'NLDS', 3, '2026-10-06'), (849822, 'NLDS', 4, '2026-10-07'),
    (849830, 'NLDS', 1, '2026-10-03'), (849825, 'NLDS', 2, '2026-10-04'), (849826, 'NLDS', 3, '2026-10-06'), (849827, 'NLDS', 4, '2026-10-07'),
    (849820, 'ALCS', 1, '2026-10-12'), (849813, 'ALCS', 2, '2026-10-13'), (849818, 'ALCS', 3, '2026-10-15'), (849817, 'ALCS', 4, '2026-10-16'),
    (849816, 'ALCS', 5, '2026-10-17'), (849815, 'ALCS', 6, '2026-10-19'), (849814, 'ALCS', 7, '2026-10-20'),
    (849809, 'NLCS', 1, '2026-10-11'), (849812, 'NLCS', 2, '2026-10-12'), (849811, 'NLCS', 3, '2026-10-14'), (849810, 'NLCS', 4, '2026-10-15'),
    (849808, 'NLCS', 5, '2026-10-16'), (849806, 'NLCS', 6, '2026-10-18'), (849807, 'NLCS', 7, '2026-10-19'),
]
NICK = {'CWS': 'White Sox', 'CLE': 'Guardians', 'NYY': 'Yankees', 'TB': 'Rays', 'ATL': 'Braves', 'LAD': 'Dodgers', 'SD': 'Padres', 'MIL': 'Brewers'}


SETS = (('season', 'diag_out/replays'), ('pitched', 'diag_out/replays_pitched'), ('errors', 'diag_out/replays_errors'), ('both', 'diag_out/replays_both'))
SET_NAME = {'season': 'regular-season pitching', 'pitched': 'as pitched that day', 'errors': "fielders' own error rates", 'both': "as pitched that day, with fielders' own error rates"}


def load(pk):
    G = json.load(open('review/games/%d.json' % pk))
    R = {k: [json.loads(l) for l in open('%s/%d.jsonl' % (d, pk)) if l.startswith('{')] for k, d in SETS}
    return G, R


CAP, TCAP, MCAP = 10, 20, 10   # score grids run 0 to '10+'; total runs 0 to '20+'; the margin '10+' either way
PANEL = {   # each setting's name and its assumptions, as the label over its column
    'season': ('Regular-season pitching', "Each pitcher at his regular-season speeds and pitch mix; every fielder at the model's default error rate."),
    'pitched': ('Pitching as it was that day', "Each pitcher at the speeds and pitch mix he had that day; every fielder at the model's default error rate."),
    'errors': ("Fielders' own error rates", 'Each pitcher at his regular-season speeds and pitch mix; each fielder at his own regular-season error rate.'),
    'both': ('Both together', 'Each pitcher at the speeds and pitch mix he had that day; each fielder at his own regular-season error rate.'),
}


def cells(R, ci, ri):
    c = {}
    for r in R: k = (min(CAP, r['score'][ci]), min(CAP, r['score'][ri])); c[k] = c.get(k, 0) + 1
    return c


def lab(v, cap=CAP): return '%d+' % cap if v >= cap else str(v)


def table(R, ci, ri, top, real, colTeam, rowTeam, cn, rn, home, num, key):
    cnt = [[0] * (CAP + 1) for _ in range(CAP + 1)]; ext = [[0] * (CAP + 1) for _ in range(CAP + 1)]
    for r in R:
        c, w = min(CAP, r['score'][ci]), min(CAP, r['score'][ri])
        cnt[w][c] += 1
        if r['innings'] > 9: ext[w][c] += 1
    N = len(R); rc = {t: (min(CAP, v) if v >= 0 else -1) for t, v in real.items()}
    out = ['<table class="grid" aria-label="Game %d replays (%s): %s runs across, %s runs down">' % (num, SET_NAME[key], cn, rn),
           '<colgroup><col class="cs"><col class="cr">' + '<col>' * (CAP + 1) + '</colgroup>',
           '<thead><tr><th class="corner" rowspan="2" colspan="2"></th><th class="axis" colspan="%d">%s runs%s</th></tr><tr>' % (CAP + 1, cn, ' (home)' if colTeam == home else ''),
           ''.join('<th class="c">%s</th>' % lab(c) for c in range(CAP + 1)), '</tr></thead><tbody>']
    for w in range(CAP + 1):
        row = ['<tr>']
        if w == 0: row.append('<th class="axis side" rowspan="%d"><span>%s runs%s</span></th>' % (CAP + 1, rn, ' (home)' if rowTeam == home else ''))
        row.append('<th class="r">%s</th>' % lab(w))
        for c in range(CAP + 1):
            k, e = cnt[w][c], ext[w][c]
            tie = c == w and c < CAP   # 10+ against 10+ can still be decided
            star = (c == rc[colTeam] and w == rc[rowTeam])
            cls = []
            if tie: cls.append('tie')
            t = k / top if top else 0
            if k and t >= 0.5: cls.append('hot')
            if star: cls.append('real')
            tip = 'A game cannot end tied' if tie else '%s %s, %s %s: %s of %s replays' % (cn, lab(c), rn, lab(w), f'{k:,}', f'{N:,}') + (', %d in extra innings' % e if e else '') + (' (the real final)' if star else '')
            style = ' style="--t:%.3f"' % t if k else ''
            inner = ('<span class="n">%d</span>' % k if k else '') + ('<span class="star" aria-label="real final">★</span>' if star else '')
            row.append('<td class="%s"%s title="%s">%s</td>' % (' '.join(cls), style, html.escape(tip), inner))
        row.append('</tr>'); out.append(''.join(row))
    out.append('</tbody></table>')
    return ''.join(out)


def hist(vals, lo, hi, ymax, real, N, kind, away, home):
    """Bars, one a run: total runs (kind 'total') or the home team's runs minus the away team's ('margin'; there is no 0, since no
    game ends tied). The real game's value outlined and starred; every bar's count in its tooltip."""
    W, H, T, B, L = 280, 92, 13, 30, 4
    n = hi - lo + 1; bw = (W - 2 * L) / n; ph = H - T - B; base = T + ph
    cnt = {}
    for v in vals: cnt[v] = cnt.get(v, 0) + 1
    def name(v):
        if kind == 'total': return '%s runs' % lab(v, TCAP)
        return '%s by %s' % (NICK[home] if v > 0 else NICK[away], lab(abs(v), MCAP))
    what = 'total runs' if kind == 'total' else 'home runs minus away runs'
    g = ['<svg class="hist" viewBox="0 0 %d %d" role="img" aria-label="%s across the replays">' % (W, H, what)]
    for v in range(lo, hi + 1):
        k = cnt.get(v, 0)
        if not k: continue
        h = max(1.0, ph * k / ymax); x = L + (v - lo) * bw
        cls = 'bar' + (' away' if kind == 'margin' and v < 0 else '') + (' real' if v == real else '')
        g.append('<rect class="%s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="1"><title>%s: %s of %s replays</title></rect>' % (
            cls, x + 0.8, base - h, bw - 1.6, h, html.escape(name(v)), f'{k:,}', f'{N:,}'))
    g.append('<line class="base" x1="%d" x2="%d" y1="%.1f" y2="%.1f"/>' % (L, W - L, base + 0.5, base + 0.5))
    if real is not None:
        k = cnt.get(real, 0); h = ph * k / ymax if k else 0
        g.append('<text class="rs" x="%.1f" y="%.1f" text-anchor="middle">★<title>The real game: %s</title></text>' % (L + (real - lo + 0.5) * bw, base - h - 2, html.escape(name(real))))
    ticks = (0, 5, 10, 15, 20) if kind == 'total' else (-10, -5, 0, 5, 10)
    for v in ticks:
        x = L + (v - lo + 0.5) * bw
        g.append('<text class="tk" x="%.1f" y="%.1f" text-anchor="middle">%s</text>' % (x, base + 12, lab(abs(v), TCAP if kind == 'total' else MCAP)))
    if kind == 'margin':
        g.append('<text class="sd" x="%d" y="%d" text-anchor="start">&#8592; %s won</text><text class="sd" x="%d" y="%d" text-anchor="end">%s won &#8594;</text>' % (
            L, H - 3, NICK[away], W - L, H - 3, NICK[home]))
    else:
        g.append('<text class="sd" x="%d" y="%d" text-anchor="middle">runs by both teams</text>' % (W // 2, H - 3))
    g.append('</svg>')
    return ''.join(g)


def panels(RS, ab, ci, ri, real, colTeam, rowTeam, num, preds=None, word='Replays'):
    """A game's row: one column per setting, each labelled with its assumptions, holding its score grid, its tally and its two
    histograms. Every column shares its game's scales, so the four compare at a glance. A setting with no runs (game-day
    pitching before the game is played) keeps its place, empty."""
    cn, rn = NICK[colTeam], NICK[rowTeam]; home, away = ab['home'], ab['away']
    have = [k for k, _ in SETS if k in RS]
    top = max(max(cells(RS[k], ci, ri).values()) for k in have)
    tot = {k: [min(TCAP, r['score'][0] + r['score'][1]) for r in RS[k]] for k in have}
    mar = {k: [max(-MCAP, min(MCAP, r['score'][1] - r['score'][0])) for r in RS[k]] for k in have}
    def peak(vs):
        c = {}
        for v in vs: c[v] = c.get(v, 0) + 1
        return max(c.values())
    tmax = max(peak(v) for v in tot.values()); mmax = max(peak(v) for v in mar.values())
    played = real[away] >= 0
    rt = min(TCAP, real[away] + real[home]) if played else None
    rm = max(-MCAP, min(MCAP, real[home] - real[away])) if played else None
    def by(m): return 'even' if abs(m) < 0.05 else '%s by %.1f' % (NICK[home] if m > 0 else NICK[away], abs(m))
    out = ['<div class="panels">']
    for key, _ in SETS:
        name, how = PANEL[key]
        if key not in RS:
            out.append('<section class="panel empty" data-col="%s"><header><h4>%s</h4><p class="how">%s</p></header>'
                       '<p class="na">There is no game-day pitching before a game is played; this setting is filled in after it.</p></section>' % (key, name, html.escape(how)))
            continue
        R = RS[key]; N = len(R)
        colWins = sum(1 for r in R if r['score'][ci] > r['score'][ri]); extras = sum(1 for r in R if r['innings'] > 9)
        runs = sum(sum(r['score']) for r in R) / N / 2; ers = sum(sum(r.get('errors', [0, 0])) for r in R) / N / 2
        tally = '%s won: %s %s, %s %s. %s in extra innings. %.1f runs and %.2f errors a team.' % (word, cn, f'{colWins:,}', rn, f'{N - colWins:,}', f'{extras:,}', runs, ers)
        pl = ('<br><span class="pre">%s</span>' % preds[key]) if preds and key in preds else ''
        mt = sum(r['score'][0] + r['score'][1] for r in R) / N; mm = sum(r['score'][1] - r['score'][0] for r in R) / N
        out.append('<section class="panel" data-col="%s"><header><h4>%s</h4><p class="how">%s</p></header>' % (key, name, html.escape(how))
                   + '<div class="gbox">%s</div>' % table(R, ci, ri, top, real, colTeam, rowTeam, cn, rn, home, num, key)
                   + '<p class="tally">%s%s</p>' % (tally, pl)
                   + '<div class="hbox"><p class="hh"><b>Total runs</b><span>average %.1f%s</span></p>%s</div>' % (mt, ' &middot; real %d' % (real[away] + real[home]) if played else '', hist(tot[key], 0, TCAP, tmax, rt, N, 'total', away, home))
                   + '<div class="hbox"><p class="hh"><b>Home runs minus away runs</b><span>average %s%s</span></p>%s</div>' % (by(mm), ' &middot; real %s' % by(real[home] - real[away]).replace('.0', '') if played else '', hist(mar[key], -MCAP, MCAP, mmax, rm, N, 'margin', away, home))
                   + '</section>')
    out.append('</div>')
    return ''.join(out)


def load_pred(pk):
    """A game's prediction before first pitch, if one was run: its notes and its simulations in the two settings it can
    have (no game-day pitching exists before a game)."""
    import glob
    meta = 'diag_out/predict/%d.json' % pk
    if not os.path.exists(meta): return None, None
    M = json.load(open(meta)); RS = {}
    for key in ('season', 'errors'):
        RS[key] = [json.loads(l) for f in sorted(glob.glob('diag_out/predict/%d_%s_*.jsonl' % (pk, key))) for l in open(f) if l.startswith('{')]
    if not all(RS.values()): return None, None
    return M, RS


def pred_lines(pk, ab):
    """After the game: what the prediction before first pitch gave each side, in the settings it ran."""
    M, RS = load_pred(pk)
    if not M: return {}
    out = {}
    for key, R in RS.items():
        hw = sum(1 for r in R if r['score'][1] > r['score'][0]) / len(R)
        out[key] = 'Before first pitch the model gave %s %.0f%%, %s %.0f%%.' % (NICK[ab['home']], 100 * hw, NICK[ab['away']], 100 * (1 - hw))
    return out


def starters_text(M, ab):
    """Both named: 'Starters: A for the X, B for the Y'. Both assumed: 'Starters assumed, since MLB had not named them: ...'.
    One assumed: that one marked '(assumed, not yet named by MLB)'."""
    st = M['starters']; asm = set(M.get('assumedTeams') or ([ab['away'], ab['home']] if M.get('assumed') else []))
    both = asm >= {ab['away'], ab['home']}
    def one(t): return '%s%s for the %s' % (html.escape(st[t][1]), ' (assumed, not yet named by MLB)' if t in asm and not both else '', NICK[t])
    return ('Starters assumed, since MLB had not named them: ' if both else 'Starters: ') + one(ab['away']) + ', ' + one(ab['home'])


def pred_grid(pk, num, date, colTeam, rowTeam):
    """A game not yet played: its simulations before first pitch, no star (there is no final yet)."""
    M, RS = load_pred(pk)
    ab = {'away': M['away'], 'home': M['home']}; side = {ab['away']: 0, ab['home']: 1}
    home = ab['home']; d = datetime.date.fromisoformat(date); when = d.strftime('%b ') + str(d.day)
    out = ['<figure class="game pred" id="g%d">' % pk,
           '<figcaption><h3>Game %d <span class="when">%s · at %s</span> <span class="badge">Prediction</span></h3>' % (num, when, html.escape(NICK[home])),
           '<p class="final">Not yet played. %s; %s.</p></figcaption>' % (starters_text(M, ab), html.escape(M.get('lineups', 'lineups from the last game'))),
           panels(RS, ab, side[colTeam], side[rowTeam], {colTeam: -1, rowTeam: -1}, colTeam, rowTeam, num, word='Simulations'),
           '</figure>']
    return '\n'.join(out)


STORIES = json.load(open('review/game_stories.json')) if os.path.exists('review/game_stories.json') else {'games': {}}


def story(pk):
    """v0.16: under the game's histograms, what surprised the model and what decided the game (review/game_stories.json,
    written from review/postseason_story.py's fact sheets; Joe, 2026-10-14), and on a series' latest game the series so far"""
    S = STORIES['games'].get(str(pk))
    if not S: return ''
    out = ['<div class="story"><h5>What surprised the model, and what decided it</h5>', S['html']]
    if S.get('series'): out += ['<h5>%s</h5>' % S['series']['title'], S['series']['html']]
    return '\n'.join(out + ['</div>'])


def grid(pk, num, date, colTeam, rowTeam):
    G, RS = load(pk)
    ab = {'away': G['teams']['away']['abbrev'], 'home': G['teams']['home']['abbrev']}
    side = {ab['away']: 0, ab['home']: 1}   # index into a replay's score [away, home]
    real = {ab['away']: G['final']['away'], ab['home']: G['final']['home']}
    feed = json.load(open('playoffs/games/%d_feed.json' % pk)); lsc = feed['liveData']['linescore']['teams']
    errs = {ab['away']: lsc['away']['errors'], ab['home']: lsc['home']['errors']}
    home = ab['home']; d = datetime.date.fromisoformat(date)
    when = d.strftime('%b ') + str(d.day)
    cn, rn = NICK[colTeam], NICK[rowTeam]
    winner = colTeam if real[colTeam] > real[rowTeam] else rowTeam
    loser = rowTeam if winner == colTeam else colTeam
    out = ['<figure class="game" id="g%d">' % pk,
           '<figcaption><h3>Game %d <span class="when">%s · at %s</span></h3>' % (num, when, html.escape(NICK[home])),
           '<p class="final">Final: %s %d, %s %d <span class="errs">· errors: %s %d, %s %d</span></p></figcaption>' % (NICK[winner], real[winner], NICK[loser], real[loser],
               cn, errs[colTeam], rn, errs[rowTeam]),
           panels(RS, ab, side[colTeam], side[rowTeam], real, colTeam, rowTeam, num, preds=pred_lines(pk, ab)),
           story(pk),
           '</figure>']
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
        if not S['games']: continue   # only a prediction so far
        A, B = S['col'], S['row']; wins = {A: 0, B: 0}; games = []
        for pk, num, date in S['games']:
            G, RS = load(pk); ab = (G['teams']['away']['abbrev'], G['teams']['home']['abbrev'])
            w = ab[0] if G['final']['away'] > G['final']['home'] else ab[1]; wins[w] += 1
            pA = {k: sum(1 for r in R if (r['score'][0] > r['score'][1]) == (ab[0] == A)) / len(R) for k, R in RS.items()}
            games.append((num, w, pA))
            for k in pA: right[k] += (pA[k] > 0.5) == (w == A)
            ngames += 1
        lead = A if wins[A] >= wins[B] else B; other = B if lead == A else A
        bo = 7 if S['name'].endswith('CS') or S['name'] == 'WS' else 5; need = bo // 2 + 1   # best of five (division series), seven (championship series)
        done = max(wins.values()) == need
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
            c = series_chance([(x[2][k] if lead == A else 1 - x[2][k]) for x in games], bo)
            ch.append('<span data-set="%s">%.0f%%</span>' % (k, 100 * c))
            if done: v = 'right' if c > 0.5 else 'missed'
            else: v = 'open, leans %s' % NICK[lead if c > 0.5 else other]
            verdict.append('<span data-set="%s" class="v %s">%s</span>' % (k, v.split(',')[0], v))
        rows.append('<tr><th scope="row"><span class="tag">%s</span> %s vs %s</th><td class="res">%s</td>%s<td class="ch">%s</td><td>%s</td></tr>' % (
            S['name'], NICK[A], NICK[B], status, ''.join(cells), ''.join(ch), ''.join(verdict)))
    tally = ''.join('<span data-set="%s">The team the replays favoured won %d of the %d games played so far.</span>' % (k, right[k], ngames) for k, _ in SETS)
    return ('<section class="series picks-sec" id="picks"><h2><span class="tag">SERIES</span> Did the replays pick the series winners?</h2>'
            '<p class="lede">The table takes the team that won or leads each series and shows, for each game, the share of the 1,000 replays that team won under whichever setting the switch above shows, marked W or L for whether it won the real game. The series chance combines those game shares into the chance of winning the series (best of five, or seven for a championship series), with any game not yet played counted at the series&#39; average share; the pick is the side that chance favours. These are not forecasts. Each game&#39;s replays used the lineups and pitchers that really played, which were known only once the game began, so the table asks a narrower question: given who played, did the replays lean the way the games went? Before the correction of 2026-10-08 (see the notes below), the regular-season setting gave the Dodgers 80%%, the Brewers 85%%, the Rays 47%% and the White Sox 60%%: the same calls, made with more confidence than the corrected replays support.</p>'
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
        if S['name'] not in ('ALDS', 'NLDS'): continue   # the assumption's wording is about the division series
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
            '<li>Starting pitchers: each team&#39;s division series starters in order, with regular-season starters added to make a four-man rotation; the Guardians&#39; order follows their rest after the fifth game, and the Dodgers&#39; first two follow MLB&#39;s announced starters.</li>'
            '<li>Bullpens: the relievers on the playoff roster, brought in by the model&#39;s manager, all rested at the start of every game.</li>'
            '<li>Home field: the team with the better regular-season record plays games 1, 2, 6 and 7 at home; open-air parks at 60 F, roofed parks at 72 F.</li>'
            '<li>Each simulated series drew every hitter&#39;s traits once, at its start, and kept them for the whole series.</li></ul></section>') % (
        note, alcs_open() if 'ALCS_CLE' in F and F['alCentral']['how'] == 'predicted' else lcs('ALCS' if 'ALCS_CLE' not in F else ('ALCS_' + max(F['alCentral']['odds'], key=F['alCentral']['odds'].get)), 'American League'),
        lcs('NLCS', 'National League'), bars, mean, lengths(wl), '\n'.join(rows))


def logit_section():
    """The replays' win share against the real results (review/win_logit.py's fit), one figure per setting (it follows the
    page's switch), each an SVG on the page's theme."""
    import numpy as np
    from scipy import stats
    from win_logit import rows, fit
    import glob
    PAST = [q for f in sorted(glob.glob('history/points_*.json')) for q in json.load(open(f))]   # past Octobers (history/logit_all.py)
    figs, signif = [], []
    for key, d in SETS:
        D = rows(d); Dp = [{'pk': q['pk'], 'label': q['label'], 'p': q['p'][key], 'y': q['y']} for q in PAST if key in q['p']]
        x = np.array([q['p'] for q in D + Dp]); y = np.array([q['y'] for q in D + Dp], float)
        b, cov, mu, ll1, ll0 = fit(x, y); se = np.sqrt(np.diag(cov))
        x6 = np.array([q['p'] for q in D]); y6 = np.array([q['y'] for q in D], float)
        b6, cov6, _, l16, l06 = fit(x6, y6); p6 = stats.chi2.sf(2 * (l16 - l06), 1)
        p_wald = 2 * stats.norm.sf(abs(b[1] / se[1])); p_lr = stats.chi2.sf(2 * (ll1 - ll0), 1)
        r2m = 1 - ll1 / ll0; r2t = mu[y == 1].mean() - mu[y == 0].mean()
        W, H, L, R, T, B = 760, 600, 64, 20, 14, 56
        def X(v): return L + v * (W - L - R)
        def Y(v): return T + (1.4 - v) / 1.8 * (H - T - B)   # 1.4 at the top, -0.4 at the bottom: room outside each row for the past Octobers' stacks
        xs = np.linspace(0, 1, 101); Xs = np.column_stack([np.ones_like(xs), xs]); eta = Xs @ b
        se_eta = np.sqrt(np.einsum('ij,jk,ik->i', Xs, cov, Xs)); sig = lambda z: 1 / (1 + np.exp(-z))
        lo, hi, fitc = sig(eta - 1.96 * se_eta), sig(eta + 1.96 * se_eta), sig(eta)
        band = 'M' + ' L'.join('%.1f,%.1f' % (X(a), Y(c)) for a, c in zip(xs, hi)) + ' L' + ' L'.join('%.1f,%.1f' % (X(a), Y(c)) for a, c in zip(xs[::-1], lo[::-1])) + ' Z'
        curve = 'M' + ' L'.join('%.1f,%.1f' % (X(a), Y(c)) for a, c in zip(xs, fitc))
        g = ['<svg class="logit" viewBox="0 0 %d %d" role="img" aria-label="Logistic regression of the real result on the replays\' win share, %d games">' % (W, H, len(D) + len(Dp))]
        for t in range(0, 11):   # grid and the x axis
            v = t / 10; g.append('<line class="gl" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (X(v), Y(1.4), X(v), Y(-0.4)))
            g.append('<text class="tk" x="%.1f" y="%.1f" text-anchor="middle">%d%%</text>' % (X(v), H - B + 18, 10 * t))
        for v, lab in ((0, 'lost'), (0.25, '25%'), (0.5, '50%'), (0.75, '75%'), (1, 'won')):
            g.append('<line class="gl" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (X(0), Y(v), X(1), Y(v)))
            g.append('<text class="tk" x="%.1f" y="%.1f" text-anchor="end">%s</text>' % (L - 8, Y(v) + 4, lab))
        g.append('<path class="band" d="%s"/>' % band)
        g.append('<line class="diag" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (X(0), Y(0), X(1), Y(1)))
        g.append('<path class="fit" d="%s"/>' % curve)
        lvl = {}   # past Octobers: hollow, no label (the tooltip names the game), stacked outward from their row so none hides another
        for row in (0, 1):
            placed = []
            for d in sorted([q for q in Dp if q['y'] == row], key=lambda q: q['p']):
                k = 0
                while any(abs(X(d['p']) - x0) < 9.5 and k0 == k for x0, k0 in placed): k += 1
                placed.append((X(d['p']), k)); lvl[d['pk']] = k
        for d in Dp:
            tip = '%s: home team won %d of 1,000 replays (%.0f%%); %s the real game' % (d['label'], round(1000 * d['p']), 100 * d['p'], 'won' if d['y'] else 'lost')
            cy = Y(d['y']) + (-1 if d['y'] else 1) * (11 + 9 * lvl[d['pk']])
            g.append('<g class="pt past"><title>%s</title><circle cx="%.1f" cy="%.1f" r="4.2"/></g>' % (html.escape(tip), X(d['p']), cy))
        # each row's labels spaced at least 13 px apart (pushed outward from the row's middle), a leader where a label moved
        lx = {}
        for row in (0, 1):
            pts = sorted([q for q in D if q['y'] == row], key=lambda q: q['p'])
            xs_ = [X(q['p']) for q in pts]
            for k in range(1, len(xs_)): xs_[k] = max(xs_[k], xs_[k - 1] + 13)
            shift = (sum(X(q['p']) for q in pts) - sum(xs_)) / len(xs_) if xs_ else 0   # recentre the run of labels on the dots
            for q, x_ in zip(pts, xs_): lx[q['pk']] = x_ + shift
        for d in D:
            cx, cy = X(d['p']), Y(d['y']); tx = lx[d['pk']]
            tip = '%s: home team won %d of 1,000 replays (%.0f%%); %s the real game' % (d['label'], round(1000 * d['p']), 100 * d['p'], 'won' if d['y'] else 'lost')
            ty = cy - 14 if d['y'] == 0 else cy + 14
            lead = '<line class="gl" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (cx, cy + (-6 if d['y'] == 0 else 6), tx, ty + (4 if d['y'] == 0 else -4)) if abs(tx - cx) > 1.5 else ''
            g.append('<g class="pt"><title>%s</title>%s<circle cx="%.1f" cy="%.1f" r="5.5"/><text class="pl" transform="translate(%.1f,%.1f) rotate(-90)" text-anchor="%s" dominant-baseline="middle">%s</text></g>' % (
                html.escape(tip), lead, cx, cy, tx, ty, 'start' if d['y'] == 0 else 'end', html.escape(d['label'])))
        g.append('<text class="ax" x="%.1f" y="%.1f" text-anchor="middle">Home team\'s share of 1,000 replays won (%s)</text>' % ((X(0) + X(1)) / 2, H - 12, html.escape(SET_NAME[key])))
        g.append('<text class="ax" transform="translate(16,%.1f) rotate(-90)" text-anchor="middle">Real game, and the fitted chance of winning</text>' % ((Y(1) + Y(0)) / 2))
        g.append('</svg>')
        stats_line = ('All %d games: slope %.1f (standard error %.1f), Wald p = %.3f; likelihood-ratio p = %.3f; McFadden R² = %.2f, Tjur R² = %.2f.' % (len(D) + len(Dp), b[1], se[1], p_wald, p_lr, r2m, r2t)
                      + (' This October alone (%d games): slope %.1f (standard error %.1f), likelihood-ratio p = %.3f.' % (len(D), b6[1], np.sqrt(cov6[1, 1]), p6) if Dp else ''))
        signif.append(p_lr < 0.05 or p_wald < 0.05)
        figs.append('<div data-set="%s"><div class="scroll">%s</div><p class="tally">%s</p></div>' % (key, '\n'.join(g), stats_line))
    n = len(rows(SETS[0][1])) + len([q for q in PAST if SETS[0][0] in q['p']])
    yrs = sorted({q['yr'] for q in PAST}); ylab = ' and '.join(str(y) for y in yrs)
    past_txt = (' Filled points are this October&#39;s games; hollow points are the %d games of the %s postseason%s, replayed the same way with each player&#39;s traits as they stood that October (fitted to that season and the one before, tied by how much each trait carries over from one season to the next), and the fit uses every October.' % (
        len(set(q['pk'] for q in PAST)), ylab, 's' if len(yrs) > 1 else '')) if PAST else ''
    verdict = ('but with only %d games the rise is not significant at the usual 0.05 level under any of the four settings: the uncertainty is wide enough to include no relationship at all.' % n
               if not any(signif) else 'and the tests under the figure say whether, with only %d games, the rise is significant at the usual 0.05 level for the setting shown.' % n)
    return ('<section class="series logit-sec" id="regression"><h2><span class="tag">FIT</span> Did the replays pick the game winners?</h2>'
            '<p class="lede">Each point is one game, seen from the home team&#39;s side: across, the share of the 1,000 replays (under the setting chosen above) the home team won; up or down, whether it won the real game. The blue curve is a logistic regression, the curve that best turns the replay share into a probability of the real win, with its 95%% band. The dashed line is where the points would sit if the replay share were exactly the chance of winning, so that a team which won most of its replays won the real game just as often. %s The curve rises, so a higher replay share went with more real wins, %s</p>'
            '%s'
            '<div class="howto"><span class="k"><span class="sw fit" aria-hidden="true"></span> logistic fit</span><span class="k"><span class="sw band" aria-hidden="true"></span> its 95%% band</span>'
            '<span class="k"><span class="sw diag" aria-hidden="true"></span> a perfectly calibrated forecast</span>%s</div></section>') % (past_txt, verdict, '\n'.join(figs),
            '<span class="k"><span class="sw dot" aria-hidden="true"></span> this October</span><span class="k"><span class="sw dot past" aria-hidden="true"></span> %s</span>' % ylab if PAST else '')


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
        key = frozenset((M['away'], M['home']))
        band = [s for s in series if s['key'] == key]
        if not band:   # nothing played in this series yet: Game 1's visitor across (the prediction for Game 1 is that game)
            series.append({'key': key, 'name': ser, 'col': M['away'], 'row': M['home'], 'games': []}); band = series[-1:]
        band[0].setdefault('pred', []).append((pk, num, date))
    body = ['<section class="series story-intro"><h2><span class="tag">NOTES</span> Reading the game notes</h2>%s</section>' % STORIES['intro']] if STORIES.get('intro') else []   # newest first: the series whose latest game (or prediction) is latest on top, and within each, the prediction, then its games from last to first
    for s in sorted(series, key=lambda s: max(d for _, _, d in s['games'] + s.get('pred', [])), reverse=True):
        body.append('<section class="series"><h2><span class="tag">%s</span> %s vs %s</h2><div class="games">' % (s['name'], NICK[s['col']], NICK[s['row']]))
        for pk, num, date in s.get('pred', [])[::-1]: body.append(pred_grid(pk, num, date, s['col'], s['row']))
        for pk, num, date in s['games'][::-1]: body.append(grid(pk, num, date, s['col'], s['row']))
        body.append('</div></section>')
    body.append(picks_section(series))
    runs = {}; errs = {}
    for key, d in SETS:
        tot = te = n = 0
        for pk, _, _, _ in games:
            R = [json.loads(l) for l in open('%s/%d.jsonl' % (d, pk)) if l.startswith('{')]
            tot += sum(sum(r['score']) for r in R) / len(R) / 2; te += sum(sum(r.get('errors', [0, 0])) for r in R) / len(R) / 2; n += 1
        runs[key] = tot / n; errs[key] = te / n
    reale = sum(sum(json.load(open('playoffs/games/%d_feed.json' % g[0]))['liveData']['linescore']['teams'][s]['errors'] for s in ('away', 'home')) / 2 for g in games) / len(games)
    realr = sum((json.load(open('review/games/%d.json' % g[0]))['final']['away'] + json.load(open('review/games/%d.json' % g[0]))['final']['home']) / 2 for g in games) / len(games)
    page = open('review/replay_grids_template.html').read().replace('<!--GRIDS-->', '\n'.join(body)).replace('<!--FORECAST-->', forecast_section(series)).replace('<!--REGRESSION-->', logit_section())
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
