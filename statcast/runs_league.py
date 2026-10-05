"""
runs_league.py · v0.1 · 2026-10-05

Where the league's runs come from, measured from pitch-level Statcast the way
headless/runs_check.js measures the model's: BaseRuns against actual runs per
team-game; the RE24 table (runs to the end of the inning from each base-out
state at the start of a plate appearance); the transitions by event and
state (where the runner on second went on a single, the runner on first on a
double, the runner on third on an air out, double plays per ground-ball
chance with a man on first, runners advancing on ground outs); the running
game per chance; and every event per team-game. A plate appearance's state
is its last pitch's (on_1b/on_2b/on_3b, outs_when_up); where its runners
went comes from the next plate appearance of the same half-inning (its
runners' ids), the runs on the play (post_bat_score - bat_score) and the
outs it made. On a play that ended the inning a missing runner is 'scored'
while the play's runs last, then 'out' while its outs last, then 'left'.

Writes statcast/runs_league_2025.js (var RUNSL) and prints the tables.

  python3 statcast/runs_league.py 2025-05-05:2025-09-21

CHANGED
  v0.1  first build (the bug audit, docs/briefs/2026-10-05_bug_audit.md)
"""
import json, os, sys, collections, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swing_geometry import load


def fl(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def rid(x):
    return '' if x in (None, '', 'NA', 'nan') else str(x).split('.')[0]


HIT = {'single': '1B', 'double': '2B', 'triple': '3B', 'home_run': 'HR'}
OUT_EVENTS = {'field_out', 'force_out', 'grounded_into_double_play', 'double_play', 'fielders_choice_out', 'sac_fly', 'sac_fly_double_play',
              'sac_bunt', 'sac_bunt_double_play', 'strikeout', 'strikeout_double_play', 'triple_play', 'other_out'}
AIR = {'fly_ball', 'popup', 'line_drive'}


def main(spec):
    rows = [r for r in load(spec) if (r.get('game_type') or 'R') == 'R']
    # plate appearances: first and last pitch of each, in order
    first, last, pitches = {}, {}, collections.defaultdict(list)
    E = collections.Counter()
    for r in rows:
        k = (int(fl(r['game_pk']) or 0), int(fl(r['at_bat_number']) or 0)); pn = int(fl(r['pitch_number']) or 0)
        if k not in first or pn < int(fl(first[k]['pitch_number']) or 0):
            first[k] = r
        if k not in last or pn > int(fl(last[k]['pitch_number']) or 0):
            last[k] = r
        pitches[k].append((pn, r))
        b1, b2, b3 = rid(r.get('on_1b')), rid(r.get('on_2b')), rid(r.get('on_3b'))
        if b1 or b2 or b3:
            E['pitches with runners on'] += 1
        if b1 and not b2:
            E['steal chances (pitches with R1, 2nd open)'] += 1
    # the running game: between two pitches of an at-bat a runner moved up (a steal, a wild pitch, a passed ball, a balk) or
    # vanished (thrown out, picked off, or scored on a wild pitch); the pitch rows carry no more than the state
    for k, ps in pitches.items():
        ps.sort(key=lambda q: q[0])
        for (pa_, a), (pb_, b) in zip(ps, ps[1:]):
            sa = [rid(a.get('on_1b')), rid(a.get('on_2b')), rid(a.get('on_3b'))]; sb = [rid(b.get('on_1b')), rid(b.get('on_2b')), rid(b.get('on_3b'))]
            for i, who in enumerate(sa):
                if not who:
                    continue
                if who not in sb:
                    E['runners gone between pitches'] += 1
                elif sb.index(who) > i:
                    E['runners moved up between pitches'] += 1
    keys = sorted(first)
    games = len(set(k[0] for k in keys)); tg = 2 * games
    # half-innings
    halves = collections.OrderedDict()
    for k in keys:
        r = first[k]; h = (k[0], r.get('inning'), r.get('inning_topbot'))
        halves.setdefault(h, []).append(k)
    RE = collections.defaultdict(lambda: [0.0, 0])
    TR = collections.defaultdict(collections.Counter)
    S = collections.Counter()
    HS = {c: collections.Counter() for c in ('empty', 'on', 'RISP')}
    lob = lisp = 0

    def state(r):
        b = [None, rid(r.get('on_1b')), rid(r.get('on_2b')), rid(r.get('on_3b'))]
        return b, int(fl(r.get('outs_when_up')) or 0)

    def key_of(outs, b):
        return '%d:%s' % (outs, ''.join(str(i) if b[i] else '-' for i in (1, 2, 3)))

    for h, ks in halves.items():
        final = fl(last[ks[-1]].get('post_bat_score')) or 0
        for i, k in enumerate(ks):
            f, l = first[k], last[k]
            b0, outs0 = state(f)
            RE[key_of(outs0, b0)][0] += final - (fl(f.get('bat_score')) or 0); RE[key_of(outs0, b0)][1] += 1
            ev = l.get('events') or ''; des = l.get('des') or ''; bb = l.get('bb_type') or ''
            b, outs = state(l)
            runs = (fl(l.get('post_bat_score')) or 0) - (fl(l.get('bat_score')) or 0)
            nxt = first[ks[i + 1]] if i + 1 < len(ks) else None
            if nxt is not None:
                nb, nouts = state(nxt); made = nouts - outs
            else:
                nb, nouts = [None, '', '', ''], 3; made = 3 - outs
            # hitting by base state (the batter's own line)
            cls = 'RISP' if (b[2] or b[3]) else 'on' if b[1] else 'empty'; hs = HS[cls]
            if ev:
                hs['pa'] += 1
                if ev.startswith('strikeout'): hs['k'] += 1
                elif ev in ('walk', 'intent_walk', 'hit_by_pitch'): hs['bb'] += 1
                elif ev not in ('sac_fly', 'sac_fly_double_play', 'sac_bunt', 'sac_bunt_double_play', 'catcher_interf', 'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home', 'pickoff_1b', 'pickoff_2b', 'pickoff_3b', 'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home'):
                    hs['ab'] += 1
                    if ev in HIT: hs['h'] += 1
                    if ev == 'home_run': hs['hr'] += 1
                    else: hs['bip'] += 1
                elif ev in ('sac_fly', 'sac_fly_double_play'): hs['bip'] += 1
                if ev != 'home_run' and (ev in HIT or ev in ('field_error', 'fielders_choice', 'fielders_choice_out', 'field_out', 'force_out', 'grounded_into_double_play', 'double_play', 'triple_play', 'sac_fly', 'sac_fly_double_play', 'other_out')):
                    gbk = 'gb' if bb == 'ground_ball' else 'air'; hs[gbk] += 1
                    if ev in HIT: hs[gbk + 'h'] += 1
                    if ev in ('fielders_choice', 'fielders_choice_out'): hs['fc'] += 1; hs[gbk + 'fc'] += 1
                    if ev == 'field_error': hs['roe'] += 1
                    ls, la = fl(l.get('launch_speed')), fl(l.get('launch_angle'))
                    if ls is not None and la is not None: hs['ev'] += ls; hs['la'] += la; hs['nq'] += 1
            # events per team-game
            if ev in HIT: S[HIT[ev]] += 1
            elif ev == 'walk': S['BB'] += 1
            elif ev == 'intent_walk': S['BB'] += 1; S['IBB'] += 1
            elif ev == 'hit_by_pitch': S['HBP'] += 1
            elif ev.startswith('strikeout'): S['K'] += 1
            elif ev in ('sac_fly', 'sac_fly_double_play'): S['SF'] += 1
            elif ev in ('field_error',): S['ROE'] += 1
            elif ev in ('fielders_choice', 'fielders_choice_out'): S['FC'] += 1
            elif ev in ('field_out', 'force_out', 'grounded_into_double_play', 'double_play', 'triple_play', 'sac_bunt', 'sac_bunt_double_play', 'other_out'): S['outs in play'] += 1
            if ev in ('grounded_into_double_play', 'double_play', 'sac_fly_double_play', 'strikeout_double_play', 'sac_bunt_double_play'): S['DP'] += 1
            if ev in HIT or ev in ('field_error', 'fielders_choice', 'fielders_choice_out', 'field_out', 'force_out', 'grounded_into_double_play', 'double_play', 'triple_play', 'sac_fly', 'sac_fly_double_play', 'sac_bunt', 'sac_bunt_double_play', 'other_out'):
                S['balls in play'] += 1
            S['SB'] += len(re.findall(r'\bsteals\b', des)); S['CS'] += len(re.findall(r'caught stealing', des))
            S['picked off'] += len(re.findall(r'picks off|picked off', des)) - len(re.findall(r'pickoff error|picked off .*? error', des))
            S['WP'] += len(re.findall(r'wild pitch', des)); S['PB'] += len(re.findall(r'passed ball', des))
            S['E throwing'] += len(re.findall(r'throwing error', des)); S['E fumbled grounder'] += len(re.findall(r'fielding error', des))
            S['E dropped fly'] += len(re.findall(r'missed catch error|dropped', des))
            if ev in HIT and (b[1] or b[2] or b[3]):
                S['hits with runners on'] += 1
            # where each runner went
            missing = [bi for bi in (3, 2, 1) if b[bi] and b[bi] not in (nb[1], nb[2], nb[3])]
            batter_scored = 1 if ev == 'home_run' else 0
            left_runs = runs - batter_scored
            batter_out = 1 if (ev in OUT_EVENTS or ev == 'fielders_choice_out') and ev not in ('fielders_choice',) else 0
            left_outs = made - batter_out
            went = {}
            for bi in (3, 2, 1):
                if not b[bi]:
                    continue
                if b[bi] in (nb[1], nb[2], nb[3]):
                    went[bi] = 'base%d' % ([nb[1], nb[2], nb[3]].index(b[bi]) + 1)
                elif left_runs > 0:
                    went[bi] = 'scored'; left_runs -= 1
                elif left_outs > 0:
                    went[bi] = 'out'; left_outs -= 1
                else:
                    went[bi] = 'left'
            runner_out = sum(1 for bi in went if went[bi] == 'out')
            if ev in HIT and runner_out:
                S['runner out on a hit'] += 1
            if ev in HIT or ev in ('field_error', 'fielders_choice', 'fielders_choice_out', 'field_out', 'force_out', 'grounded_into_double_play', 'double_play', 'sac_fly', 'sac_fly_double_play'):
                if runner_out:
                    S['runners forced out' if ev in ('force_out', 'grounded_into_double_play', 'fielders_choice_out', 'fielders_choice', 'double_play') else 'runners out on the bases (tag)'] += runner_out
            oo = ', %d out' % outs
            if ev == 'single':
                if b[2]: TR['single, R2' + oo][went[2]] += 1
                if b[1]: TR['single, R1' + oo][went[1]] += 1
                if b[3]: TR['single, R3' + oo][went[3]] += 1
            if ev == 'double':
                if b[1]: TR['double, R1' + oo][went[1]] += 1
                if b[2]: TR['double, R2' + oo][went[2]] += 1
                if b[3]: TR['double, R3' + oo][went[3]] += 1
            air_out = ev in ('field_out', 'sac_fly', 'sac_fly_double_play', 'double_play') and bb in AIR
            if air_out and outs < 2:
                if b[3]: TR['air out, R3' + oo][went[3]] += 1
                if b[2] and not b[3]: TR['air out, R2 (3rd open)' + oo][went[2]] += 1
                if b[1] and not b[2]: TR['air out, R1 (2nd open)' + oo][went[1]] += 1
            if bb == 'ground_ball' and outs < 2 and b[1]:
                o = 'DP' if ev in ('grounded_into_double_play', 'double_play') else 'FC' if ev in ('fielders_choice', 'fielders_choice_out') else 'batter out' if ev in ('field_out', 'force_out') else 'error' if ev == 'field_error' else 'hit' if ev in HIT else ev
                TR['ground ball, R1' + oo][o] += 1
            gb_out = bb == 'ground_ball' and ev in ('field_out', 'force_out', 'fielders_choice', 'fielders_choice_out', 'grounded_into_double_play', 'double_play')
            if gb_out and outs < 2:
                if b[3]: TR['ground out, R3' + oo][went[3]] += 1
                if b[2] and not b[3]: TR['ground out, R2 (3rd open)' + oo][went[2]] += 1
            if nxt is None:
                stranded = sum(1 for bi in went if went[bi] in ('left', 'base1', 'base2', 'base3'))
                lob += stranded; lisp += sum(1 for bi in went if went[bi] in ('left', 'base2', 'base3') and bi >= 2)
    # BaseRuns from the events
    H = S['1B'] + S['2B'] + S['3B'] + S['HR']; TB = S['1B'] + 2 * S['2B'] + 3 * S['3B'] + 4 * S['HR']
    AB = S['K'] + S['outs in play'] + S['FC'] + S['ROE'] + H
    # runs per half-inning: the batting side's score after its last plate appearance less its score at its first pitch
    runs = sum((fl(last[ks[-1]].get('post_bat_score')) or 0) - (fl(first[ks[0]].get('bat_score')) or 0) for ks in halves.values())
    A = H + S['BB'] + S['HBP'] - S['HR']; B = 1.02 * (1.4 * TB - 0.6 * H - 3 * S['HR'] + 0.1 * (S['BB'] + S['HBP'])); C = AB - H
    bsr = A * B / (B + C) + S['HR']
    S['LOB'] = lob; S['LISP'] = lisp
    J = {'games': games, 'runs': runs / tg, 'baseruns': bsr / tg, 'events': {k: v / tg for k, v in S.items()},
         're': {k: [v[0] / v[1], v[1]] for k, v in RE.items()}, 'tr': {}, 'hit': {c: dict(HS[c]) for c in HS}}
    for k in E:
        J['events'][k] = E[k] / tg
    for k in ('SB', 'CS', 'WP', 'PB', 'picked off'):   # the pitch rows do not describe these; the season's team totals (MLB Stats API, 2025) stand in
        J['events'][k] = {'SB': 0.71, 'CS': 0.20, 'WP': 0.29, 'PB': 0.05, 'picked off': 0.05}[k]
    for c, cnt in TR.items():
        n = sum(cnt.values()); J['tr'][c] = {'n': n}; J['tr'][c].update({k: v / n for k, v in cnt.items()})
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, 'runs_league_2025.js'), 'w') as f:
        f.write('// runs_league_2025.js: written by statcast/runs_league.py (%s); loaded before headless/runs_check.js\nvar RUNSL = ' % spec + json.dumps(J) + ';\n')
    print('runs_league v0.1 · %d games · runs %.2f BaseRuns %.2f ratio %.3f per team-game' % (games, runs / tg, bsr / tg, runs / bsr))
    print('RE24 (0/1/2 out):')
    for s in ('---', '1--', '-2-', '--3', '12-', '1-3', '-23', '123'):
        print('  %s  ' % s + '  '.join('%.3f (%d)' % (RE['%d:%s' % (o, s)][0] / RE['%d:%s' % (o, s)][1], RE['%d:%s' % (o, s)][1]) if RE['%d:%s' % (o, s)][1] else '  -' for o in (0, 1, 2)))
    print('transitions:')
    for c in J['tr']:
        print('  %-34s n %5d  ' % (c, J['tr'][c]['n']) + '  '.join('%s %.3f' % (k, v) for k, v in sorted(J['tr'][c].items()) if k != 'n'))
    print('events per team-game: ' + '  '.join('%s %.2f' % (k, v) for k, v in sorted(J['events'].items())))
    print('wrote statcast/runs_league_2025.js')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '2025-05-05:2025-09-21')
