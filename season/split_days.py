"""
split_days.py · v0.1 · 2026-10-13

Every pitch of the 2025 and 2026 regular seasons (statcast/raw/pitches/<year>/<date>.csv, statcast/fetch_pitches.py's
day files) split into one file per player, role and block, in playoffs/fetch_statcast.py's extract format:
  season/pitches/<block>/<role>_<id>.csv.gz      block 2025, h1 (2026 through the All-Star break, July 13), h2 (after)
A pitch goes to its batter's batter file and its pitcher's pitcher file. Also season/players.json: per player, the
pitches he saw and threw and the plate appearances he had in each block, and his name as Savant gives it.

  python3 season/split_days.py

CHANGED
  v0.1  first build (Joe, 2026-10-13: the whole 2026 season, every team and game)
"""
import csv, glob, gzip, io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'playoffs'))
from fetch_statcast import OUT_COLS, extract

KEEP = OUT_COLS[:-1] + ['des', 'player_name']
ASB = '2026-07-13'


def block_of(date):
    return '2025' if date < '2026' else ('h1' if date <= ASB else 'h2')


def main():
    players = {}
    for blk in ('2025', 'h1', 'h2'):
        yr = '2025' if blk == '2025' else '2026'
        files = sorted(glob.glob(os.path.join(HERE, '..', 'statcast', 'raw', 'pitches', yr, '*.csv')))
        rows = {}
        n = 0
        for fn in files:
            d = os.path.basename(fn)[:10]
            if block_of(d) != blk: continue
            for r in csv.DictReader(open(fn, encoding='utf-8-sig')):
                if r.get('game_type') != 'R': continue
                t = {k: r.get(k, '') for k in KEEP}
                rows.setdefault(('batter', int(r['batter'])), []).append(t)
                rows.setdefault(('pitcher', int(r['pitcher'])), []).append(t)
                n += 1
                p = players.setdefault(int(r['batter']), {'name': None, 'seen': {}, 'thrown': {}, 'pa': {}})
                p['seen'][blk] = p['seen'].get(blk, 0) + 1
                if r.get('events'): p['pa'][blk] = p['pa'].get(blk, 0) + 1
                if r.get('player_name') and not p['name']: p['name'] = r['player_name']
                q = players.setdefault(int(r['pitcher']), {'name': None, 'seen': {}, 'thrown': {}, 'pa': {}})
                q['thrown'][blk] = q['thrown'].get(blk, 0) + 1
        out = os.path.join(HERE, 'pitches', blk); os.makedirs(out, exist_ok=True)
        for (role, pid), L in rows.items():
            extract(L, os.path.join(out, '%s_%d.csv.gz' % (role, pid)))
        print('%s: %d pitches, %d player-role files' % (blk, n, len(rows)), flush=True)
    json.dump({str(k): v for k, v in players.items()}, open(os.path.join(HERE, 'players.json'), 'w'))
    print('%d players' % len(players))


if __name__ == '__main__':
    main()
