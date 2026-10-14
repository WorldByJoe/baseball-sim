"""
infield_positioning.py · v0.1 · 2026-10-05

Where the league's fielders stood in 2025, from Baseball Savant's fielder-positioning data (the
same source as bb_field's outfield spots): each fielder's average starting spot when the pitch is
thrown, by position, the batter's side, and the runners (none on, a man on first only, any other),
every fielder with 10+ plate appearances in that split, weighted by his plate appearances. Depth is
feet from home plate, angle degrees from the centre-field line (+ toward first base). Savant's
endpoint: /visuals/position_data?type=player&firstBase={0,1,27}&batSide={R,L}&season=2025&position=N.

Also, from the league's pitch data (statcast/raw/pitches/2025), the share of pitches with a man on
first only that came with fewer than two out (to turn the pooled 'first only' shift into the
double-play depth, which is played with fewer than two out), and how often the infield came in with
a man on third and fewer than two out: Statcast's 'Strategic' infield alignment, less its rate with
third base empty, by whether first base was occupied, the inning and the fielding side's lead.

Writes statcast/infield_positioning_2025.json.

  python3 statcast/infield_positioning.py            (fetches Savant, then reads the pitch data)
  python3 statcast/infield_positioning.py --cached   (reuses the saved Savant numbers)

CHANGED
  v0.1  first build (the men-on-base brief)
"""
import json, os, sys, glob, time, urllib.request
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'infield_positioning_2025.json')
URL = 'https://baseballsavant.mlb.com/visuals/position_data?type=player&teamId=&firstBase=%d&shift=0&batSide=%s&season=2025&position=%d&attempts=10'
POS = {3: '1B', 4: '2B', 5: '3B', 6: 'SS', 7: 'LF', 8: 'CF', 9: 'RF'}
RUN = {0: 'none', 1: 'first only', 27: 'other'}


def fetch():
    spots = {}
    for pid, pos in POS.items():
        for side in ('R', 'L'):
            for fb, run in RUN.items():
                req = urllib.request.Request(URL % (fb, side, pid), headers={'User-Agent': 'Mozilla/5.0'})
                P = json.load(urllib.request.urlopen(req))['positionData']
                n = sum(int(p['n']) for p in P)
                w = lambda k: sum(int(p['n']) * float(p[k]) for p in P) / n
                spots['%s|%s|%s' % (pos, side, run)] = {'n': n, 'fielders': len(P), 'depth': round(w('avg_norm_start_distance'), 1),
                                                        'angle': round(w('avg_norm_start_angle'), 1),
                                                        'x': round(w('avg_norm_start_pos_x'), 1), 'y': round(w('avg_norm_start_pos_y'), 1)}
                time.sleep(0.3)
    return spots


def pitch_side():
    fs = sorted(glob.glob(os.path.join(HERE, 'raw', 'pitches', '2025', '*.csv')))
    cols = ['game_type', 'on_1b', 'on_2b', 'on_3b', 'outs_when_up', 'inning', 'bat_score', 'fld_score', 'if_fielding_alignment']
    df = pd.concat([pd.read_csv(f, usecols=cols, low_memory=False) for f in fs])
    df = df[df.game_type == 'R']
    r1o = df[df.on_1b.notna() & df.on_2b.isna() & df.on_3b.isna()]
    out = {'first only, share with fewer than two out': round(float((r1o.outs_when_up < 2).mean()), 3)}
    df['strat'] = df.if_fielding_alignment == 'Strategic'
    base = df[df.on_3b.isna()]
    df['inn'] = pd.cut(df.inning, [0, 3, 6, 30], labels=['1-3', '4-6', '7+']).astype(str)
    df['lead'] = (df.fld_score - df.bat_score).clip(-2, 2).astype(int).astype(str)   # the fielding side's lead, -2 = trailing by 2 or more
    base_rate = float(base.strat.mean())
    out['strategic with third empty'] = round(base_rate, 3)
    r3 = df[df.on_3b.notna() & (df.outs_when_up < 2)]
    tab = {}
    for first, g in r3.groupby(r3.on_1b.notna()):
        key = 'first occupied' if first else 'first open'
        tab[key] = {}
        for (inn, lead), h in g.groupby(['inn', 'lead']):
            tab[key]['%s|%s' % (inn, lead)] = [round(max(0.0, float(h.strat.mean()) - base_rate), 3), int(len(h))]
    out['infield in, man on third, fewer than two out (Strategic less its rate with third empty)'] = tab
    return out


def main(cached):
    J = json.load(open(OUT)) if cached and os.path.exists(OUT) else {}
    if not cached or 'spots' not in J:
        J['spots'] = fetch()
    J.update(pitch_side())
    with open(OUT, 'w') as f:
        json.dump(J, f, indent=1)
    print('infield_positioning v0.1 (2025): depth ft, angle deg (+ toward first base); weighted by plate appearances')
    for pos in ('1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'):
        print('  %-3s ' % pos + '   '.join('%s %s: %5.1f ft %+5.1f deg (n %d)' % (side, run, J['spots']['%s|%s|%s' % (pos, side, run)]['depth'], J['spots']['%s|%s|%s' % (pos, side, run)]['angle'],
                                                                         J['spots']['%s|%s|%s' % (pos, side, run)]['n']) for side in ('R', 'L') for run in ('none', 'first only', 'other')))
    for k, v in J.items():
        if k != 'spots':
            print('  %s: %s' % (k, v))


if __name__ == '__main__':
    main('--cached' in sys.argv)
