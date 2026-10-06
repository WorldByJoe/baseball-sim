"""
poll.py · v0.1 · 2026-10-06

The couch analyst, live: watches one game on MLB's live feed and keeps
review/live/state.json current for the page beside it (live.html).

Every few seconds it fetches the feed (statsapi.mlb.com/api/v1.1/game/<pk>/feed/live),
turns it into the review's game format (review/game_feed.py), and runs the
model on what changed (review/game_review.js, one plate appearance at a time):

- when a batter steps in: what to watch for (the pitcher's mix to his side,
  where the batter tends to swing and miss, the model's chances for the
  plate appearance, the pitcher's speed tonight against his season);
- after each pitch: what the model expected the batter to do with it, and
  whether what he did was a surprise;
- after each plate appearance: how likely the outcome was, and for a batted
  ball how often the league's similar balls fell for hits (review/xhit_league.py);
- the running ledger: each team's strikeouts, walks, hits on balls in play and
  wOBA against expectation.

Before the first pitch, once the lineups are posted, it plays the game 600
times (review/pregame.js) for the pregame chances.

  python3 review/live/poll.py PK [seconds between fetches] [--quiet]
  python3 review/live/poll.py PK --replay playoffs/games/PK_feed.json [seconds a step]   (a finished game, as if live)

Each game's state goes to review/live/state_PK.json (the page reads it as
live.html?g=PK); the featured game also to state.json (live.html), unless
--quiet. Run from the repository's root. Nothing here needs Claude while it runs.

CHANGED
  v0.1  first build (Brewers-Padres, NLDS Game 3, 2026-10-06)
"""
import json, os, sys, time, math, subprocess, copy, urllib.request
sys.path.insert(0, 'review'); sys.path.insert(0, 'statcast')
import numpy as np
from game_feed import parse
import xhit_league

OUT_DIR = 'review/live'
RUN = ['tools/diag/run.sh', 'bb_engine.js', 'bb_names.js', 'bb_field.js', 'bb_game.js', 'review/players.js']
WOBA = {'BB': 0.69, 'HBP': 0.72, '1B': 0.88, '2B': 1.25, '3B': 1.58, 'HR': 2.03, 'E': 0.88, 'OUT': 0.0, 'K': 0.0, 'CI': 0.72}
NAMES = {'FF': 'four-seamer', 'SI': 'sinker', 'FC': 'cutter', 'SL': 'slider', 'ST': 'sweeper', 'CU': 'curveball', 'KC': 'knuckle curve',
         'CH': 'changeup', 'FS': 'splitter', 'CS': 'slow curve', 'SV': 'slurve', 'FO': 'forkball', 'KN': 'knuckleball', 'EP': 'eephus'}
KIND = {'FF': 'FB', 'SI': 'FB', 'FC': 'FB', 'SL': 'BR', 'ST': 'BR', 'CU': 'BR', 'KC': 'BR', 'SV': 'BR', 'CS': 'BR', 'CH': 'OS', 'FS': 'OS', 'FO': 'OS'}
KINDWORD = {'FB': 'fastballs', 'BR': 'breaking balls', 'OS': 'changeups and splitters'}


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'baseball-sim review'}), timeout=15) as r:
        return json.loads(r.read().decode('utf-8'))


def pct(p):
    return '%d%%' % round(100 * p) if p >= 0.01 else '%.1f%%' % (100 * p)


def ordinal(n):
    return '%d%s' % (n, 'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th'))


class Analyst:
    def __init__(self, pk):
        self.pk = str(pk)
        recs = json.load(open('playoffs/players_measured.json')); recs = recs if isinstance(recs, list) else recs['players']
        self.rec = {r['id']: r for r in recs}
        self.X, self.C = xhit_league.league()
        self.cache = {}        # plate appearance i -> its analysis
        self.done = {}         # i -> (pitches analysed, complete)
        self.events = []       # the running list, newest last
        self.pregame = None
        self.wp = []

    # ---- the model, one plate appearance
    def model(self, i, what):
        try:
            r = subprocess.run(RUN + ['review/game_review.js', '--', self.pk, '600', '7', '0', '1', str(i), what], capture_output=True, text=True, timeout=120)
            line = [l for l in r.stdout.splitlines() if l.startswith('{')]
            return json.loads(line[-1]) if line else None
        except Exception as e:
            print('model failed for', i, e, file=sys.stderr)
            return None

    def league_hit(self, pa):
        h = pa.get('hit')
        if not h or h.get('ev') is None or h.get('la') is None or h.get('hcx') is None:
            return None
        spray = math.degrees(math.atan2(h['hcx'] - 126.0, 205.0 - h['hcy']))
        pull = -spray if pa['batSide'] == 'R' else spray
        d = (((self.X - np.array([h['ev'], h['la'], pull])) / np.array([2.5, 2.5, 4.0])) ** 2).sum(1)
        idx = np.argsort(d)[:40]
        cats = {k: float(np.mean(self.C[idx] == k)) for k in ('OUT', '1B', '2B', '3B', 'HR', 'E')}
        return {'pHit': cats['1B'] + cats['2B'] + cats['3B'] + cats['HR'], 'xwobacon': sum(WOBA[k] * v for k, v in cats.items()), 'cats': cats}

    # ---- words
    def mix(self, pid, side):
        """the pitcher's pitch mix to this side of the plate, from his measured usage by count and side"""
        r = self.rec.get(pid); S = (r or {}).get('summaries', {}).get('pitching') or {}
        tot = {}
        for t, d in (S.get('pitchTypes') or {}).items():
            n = 0
            for key, v in (d.get('usageByCountSide') or {}).items():
                if key.endswith('|' + side):
                    p = v.get('pooled') or {}
                    if p.get('mean') is not None:
                        n += p['mean'] * p.get('n', 0)
            tot[t] = n
        s = sum(tot.values())
        return sorted([(t, n / s) for t, n in tot.items() if s and n / s >= 0.05], key=lambda x: -x[1])

    def watch(self, pa, game, a):
        lines = []
        bat, pit = self.rec.get(pa['batter'], {}), self.rec.get(pa['pitcher'], {})
        bs, ph = pa['batSide'], pa['pitchHand']
        side = 'same' if bs == ph else 'opp'
        last = lambda n: n.split(' ')[-1]
        k = sum(1 for q in game['pas'][:pa['i']] if q['batter'] == pa['batter'] and q['pitcher'] == pa['pitcher']) + 1
        lines.append('%s (bats %s) against %s (throws %s): %s matchup%s.' % (pa['batterName'], bs, pa['pitcherName'], ph,
                     'a same-side' if side == 'same' else 'an opposite-side', ', the %s time he has faced him tonight' % {2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth'}.get(k, ordinal(k)) if k > 1 else ''))
        m = self.mix(pa['pitcher'], side)
        if m:
            lines.append('%s to %s-handed hitters: %s.' % (last(pa['pitcherName']), 'right' if bs == 'R' else 'left',
                         ', '.join('%s %s' % (NAMES.get(t, t), pct(u)) for t, u in m[:3])))
            kinds = [KIND.get(t) for t, u in m[:3] if KIND.get(t) and KIND.get(t) != 'FB']
            H = (bat.get('summaries') or {}).get('hitting') or {}
            if kinds:
                w = ((H.get('whiffPerSwing') or {}).get(kinds[0]) or {}).get('pooled') or {}
                ch = (H.get('chaseRate') or {}).get('pooled') or {}
                if w.get('mean') is not None:
                    lines.append('%s misses on %s of his swings at %s and chases %s of pitches off the plate.' % (last(pa['batterName']), pct(w['mean']), KINDWORD[kinds[0]], pct(ch.get('mean', 0))))
        if a and a.get('probs'):
            p = a['probs']
            lines.append('Model: strikeout %s, walk %s, hit %s, home run %s.' % (pct(p['K']), pct(p['BB'] + p['HBP']), pct(p['1B'] + p['2B'] + p['3B'] + p['HR']), pct(p['HR'])))
        # the pitcher tonight against his season, his main fastball
        S = (pit.get('summaries') or {}).get('pitching') or {}
        fb = sorted([(t, (d.get('usage') or {}).get('pooled', {}).get('mean') or 0) for t, d in (S.get('pitchTypes') or {}).items() if KIND.get(t) == 'FB'], key=lambda x: -x[1])
        if fb:
            t = fb[0][0]; sv = ((S['pitchTypes'][t].get('velo') or {}).get('2026') or {}).get('mean')
            mph = [q['mph'] for q2 in game['pas'][:pa['i'] + 1] if q2['pitcher'] == pa['pitcher'] for q in q2['pitches'] if q['type'] == t and q['mph']]
            if sv and len(mph) >= 8:
                d = sum(mph) / len(mph) - sv
                lines.append('%s\'s %s: %.1f mph tonight, %s%.1f against his season.' % (last(pa['pitcherName']), NAMES.get(t, t), sum(mph) / len(mph), '+' if d >= 0 else '', d))
        return lines

    def pitch_text(self, q):
        nm = NAMES.get(q['type'], q['type'] or 'pitch')
        s = '%s %s, %.0f mph' % (q['count'], nm, q['mph'] or 0)
        if q.get('pSwing') is None:
            return s, False
        r, flag = q['result'], (q.get('pResult') is not None and q['pResult'] < 0.15)
        if r in ('ball', 'called'):
            s += ': taken, %s. The model had him swinging %s' % ('a strike' if r == 'called' else 'a ball', pct(q['pSwing']))
            if q.get('pCalled') is not None:
                s += ', and that pitch called a strike %s of the time' % pct(q['pCalled'])
        else:
            s += ': swung at (%s likely)' % pct(q['pSwing'])
            if r == 'whiff' and q.get('pWhiff') is not None:
                s += ', missed. %s of his swings at it miss' % pct(q['pWhiff'])
            elif r == 'foul':
                s += ', fouled off'
            elif r == 'inplay':
                s += ', in play'
        if q.get('pFooled', 0) >= 0.3:
            s += '. It fools him %s of the time' % pct(q['pFooled'])
        return s + '.', flag

    def pa_text(self, pa, a, lg):
        p = a.get('pActual') if a else None
        s = '%s %s %s.' % (('T' if pa['half'] == 'top' else 'B') + str(pa['inning']), pa['batterName'] + ':', pa['event'] or '')
        flag = p is not None and p < 0.10
        if p is not None:
            s += ' The model gave that %s.' % pct(p)
        if lg:
            h = pa['hit']; hit = pa['eventType'] in ('single', 'double', 'triple', 'home_run')
            s += ' %.0f mph at %d°: balls like it fall for hits %s of the time.' % (h['ev'], h['la'], pct(lg['pHit']))
            if hit and lg['pHit'] < 0.3:
                s += ' A lucky one.'; flag = True
            elif not hit and pa['eventType'] != 'field_error' and lg['pHit'] > 0.6:
                s += ' An unlucky out.'; flag = True
        return s, flag

    # ---- one fetch
    def step(self, feed, now=None, live=True):
        now = now or time.time()
        game = parse(feed, self.pk)
        os.makedirs('review/games', exist_ok=True)
        json.dump(game, open('review/games/%s.json' % self.pk, 'w'))
        pas = game['pas']
        if self.pregame is None and game['lineups']['away'] and game['lineups']['home']:
            self.pregame = self.run_pregame(feed, game)
        for pa in pas:
            i, n = pa['i'], len(pa['pitches'])
            complete = pa['eventType'] is not None
            seen = self.done.get(i)
            if seen == (n, complete):
                continue
            first = seen is None
            a = self.model(i, 'ep' if first else 'p')
            if a is None or 'skip' in a:   # a player the data does not have: the plate appearance is told without the model
                a = {'probs': None, 'xwoba': None, 'woba': None, 'actual': None, 'pActual': None, 'pitches': []}
            prev = self.cache.get(i) or {}
            if not first and prev and prev.get('probs'):
                a['probs'], a['xwoba'] = prev['probs'], prev['xwoba']
                if a['actual'] in a['probs']:
                    a['pActual'] = a['probs'][a['actual']]
            old = prev.get('pitches', [])
            a['watch'] = prev.get('watch') or self.watch(pa, game, a)
            self.cache[i] = a
            if first:
                self.events.append({'t': now, 'kind': 'up', 'i': i, 'text': 'Now batting: ' + a['watch'][0], 'flag': False})
            for q in a['pitches'][len(old):]:
                txt, flag = self.pitch_text(q)
                self.events.append({'t': now, 'kind': 'pitch', 'i': i, 'text': txt, 'flag': flag})
            if complete:
                lg = self.league_hit(pa)
                a['league'] = lg
                txt, flag = self.pa_text(pa, a, lg)
                self.events.append({'t': now, 'kind': 'pa', 'i': i, 'text': txt, 'flag': flag})
                if live:
                    try:
                        self.wp = [[w['atBatIndex'], w['homeTeamWinProbability']] for w in fetch('https://statsapi.mlb.com/api/v1/game/%s/winProbability' % self.pk)]
                    except Exception:
                        pass
            self.done[i] = (n, complete)
        return self.state(game, now)

    def run_pregame(self, feed, game):
        pp = feed['gameData'].get('probablePitchers') or {}
        asp = (pp.get('away') or {}).get('id') or (game['pitchers']['away'] or [None])[0]
        hsp = (pp.get('home') or {}).get('id') or (game['pitchers']['home'] or [None])[0]
        if not asp or not hsp:
            return None
        procs = [subprocess.Popen(RUN + ['review/pregame.js', '--', self.pk, '600', '3', str(k), '6', str(asp), str(hsp)], stdout=subprocess.PIPE, text=True) for k in range(6)]
        R = []
        for p in procs:
            R += [json.loads(l) for l in p.communicate()[0].splitlines() if l.startswith('{')]
        if not R:
            return None
        n = len(R)
        return {'n': n, 'awayWin': round(sum(1 for r in R if r['score'][0] > r['score'][1]) / n, 3),
                'awayRuns': round(sum(r['score'][0] for r in R) / n, 2), 'homeRuns': round(sum(r['score'][1] for r in R) / n, 2),
                'awaySP': self.rec.get(asp, {}).get('name'), 'homeSP': self.rec.get(hsp, {}).get('name')}

    def state(self, game, now):
        pas = game['pas']
        cur = pas[-1] if pas else None
        led = {}
        for side in ('away', 'home'):
            T = [(pa, self.cache.get(pa['i'])) for pa in pas if pa['bat'] == side and pa['eventType'] and (self.cache.get(pa['i']) or {}).get('probs')]
            lg = [(pa, a) for pa, a in T if a.get('league')]
            led[side] = {'pa': len(T), 'K': [round(sum(a['probs']['K'] for pa, a in T), 1), sum(1 for pa, a in T if a['actual'] == 'K')],
                         'BB': [round(sum(a['probs']['BB'] + a['probs']['HBP'] for pa, a in T), 1), sum(1 for pa, a in T if a['actual'] in ('BB', 'HBP'))],
                         'hits': [round(sum(a['league']['pHit'] for pa, a in lg), 1), sum(1 for pa, a in lg if pa['eventType'] in ('single', 'double', 'triple', 'home_run'))],
                         'xwoba': round(sum(a['xwoba'] for pa, a in T) / len(T), 3) if T else None,
                         'woba': round(sum((a['woba'] or 0) for pa, a in T) / len(T), 3) if T else None}
        now_pa = None
        if cur:
            a = self.cache.get(cur['i']) or {}
            b, s = 0, 0
            if cur['pitches']:
                lp = cur['pitches'][-1]
                b, s = lp['balls'], lp['strikes']
            now_pa = {'i': cur['i'], 'batter': cur['batterName'], 'pitcher': cur['pitcherName'], 'inning': cur['inning'], 'half': cur['half'],
                      'outs': cur['outs'], 'bases': [bool(x) for x in cur['bases']], 'score': cur['score'], 'complete': cur['eventType'] is not None,
                      'watch': a.get('watch', []), 'probs': a.get('probs'),
                      'pitches': [{'text': self.pitch_text(q)[0], 'flag': self.pitch_text(q)[1]} for q in a.get('pitches', [])]}
        return {'updated': now, 'pk': self.pk, 'teams': game['teams'], 'status': game.get('status'), 'detailed': game.get('detailed'),
                'final': game['final'], 'innings': game['innings'], 'now': now_pa, 'ledger': led, 'pregame': self.pregame,
                'wp': self.wp, 'events': self.events[-60:]}


def replay_feeds(path):
    """a finished game's feed cut back pitch by pitch, as the live feed would have shown it"""
    full = json.load(open(path))
    plays = full['liveData']['plays']['allPlays']
    for k, pl in enumerate(plays):
        pitch_idx = [j for j, ev in enumerate(pl['playEvents']) if ev.get('isPitch')]
        for m in range(1, len(pitch_idx) + 1):
            f = copy.deepcopy(full)
            cut = copy.deepcopy(pl)
            cut['playEvents'] = pl['playEvents'][:pitch_idx[m - 1] + 1] if m < len(pitch_idx) else pl['playEvents']
            if m < len(pitch_idx):
                cut['result'] = {'type': 'atBat'}; cut['about']['isComplete'] = False
                for ev in cut['playEvents']:
                    ev.pop('hitData', None)
            f['liveData']['plays']['allPlays'] = plays[:k] + [cut]
            if k < len(plays) - 1 or m < len(pitch_idx):
                f['gameData']['status']['abstractGameState'] = 'Live'; f['gameData']['status']['detailedState'] = 'In Progress'
            yield f


def write(st, pk, quiet):
    for name in ['state_%s.json' % pk] + ([] if quiet else ['state.json']):
        path = os.path.join(OUT_DIR, name)
        json.dump(st, open(path + '.tmp', 'w')); os.replace(path + '.tmp', path)


def main():
    a = sys.argv[1:]
    quiet = '--quiet' in a; a = [x for x in a if x != '--quiet']
    pk = a[0]
    A = Analyst(pk)
    if '--replay' in a:
        path = a[a.index('--replay') + 1]; dt = float(a[a.index('--replay') + 2]) if len(a) > a.index('--replay') + 2 else 1.0
        wp = json.load(open(path.replace('_feed.json', '_wp.json'))) if os.path.exists(path.replace('_feed.json', '_wp.json')) else []
        for f in replay_feeds(path):
            n = len(f['liveData']['plays']['allPlays'])
            A.wp = [[w['atBatIndex'], w['homeTeamWinProbability']] for w in wp if w['atBatIndex'] < n - 1]
            st = A.step(f, live=False)
            write(st, pk, quiet)
            time.sleep(dt)
        return
    dt = float(a[1]) if len(a) > 1 else 10.0
    url = 'https://statsapi.mlb.com/api/v1.1/game/%s/feed/live' % pk
    while True:
        try:
            f = fetch(url)
            st = A.step(f)
            write(st, pk, quiet)
            state = f['gameData']['status'].get('abstractGameState')
            print(time.strftime('%H:%M:%S'), state, f['gameData']['status'].get('detailedState'), len(A.cache), 'plate appearances', flush=True)
            if state == 'Final':
                print('final'); break
        except Exception as e:
            state = None
            print(time.strftime('%H:%M:%S'), 'fetch or step failed:', e, file=sys.stderr, flush=True)
        time.sleep(120 if state == 'Preview' else dt)   # every two minutes until the first pitch


if __name__ == '__main__':
    main()
