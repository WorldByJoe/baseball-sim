# fastball fouls (tracked): exit velocity and launch angle distribution, against fastball balls in play
import csv, glob
F, B = [], []
for fn in sorted(glob.glob('statcast/raw/pitches/2025/*.csv')):
    for r in csv.DictReader(open(fn, encoding='utf-8')):
        if r['pitch_type'] not in ('FF', 'SI', 'FC') or r['description'] not in ('foul', 'hit_into_play'): continue
        try: ev, la = float(r['launch_speed']), float(r['launch_angle'])
        except ValueError: continue
        (F if r['description'] == 'foul' else B).append((ev, la))
def tab(V, name):
    n = len(V); print('%s n %d' % (name, n))
    print('   EV <50 %.3f  50-70 %.3f  70-85 %.3f  85-95 %.3f  95+ %.3f' % tuple(sum(1 for e, l in V if lo <= e < hi) / n for lo, hi in ((0, 50), (50, 70), (70, 85), (85, 95), (95, 200))))
    print('   LA <-10 %.3f  -10..10 %.3f  10..30 %.3f  30..50 %.3f  50..70 %.3f  70+ %.3f' % tuple(sum(1 for e, l in V if lo <= l < hi) / n for lo, hi in ((-90, -10), (-10, 10), (10, 30), (30, 50), (50, 70), (70, 100))))
tab(F, 'LEAGUE fastball fouls'); tab(B, 'LEAGUE fastball balls in play')
