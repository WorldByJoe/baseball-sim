"""
measure_seasons.py · v0.1 · 2026-10-12

The measured traits and summaries of every postseason participant, season by season: playoffs/measure_traits.py run on
history/ (its rosters, season stats, leaderboards and pitches) for 2024, 2025 and 2026, with two changes:
  - regular-season pitches only (the 2026 review's measurement also counts postseason pitches, which would put the
    very games a replay asks about into the traits it replays them with);
  - every season weighted alike in 'pooled' (pooled is not used here: history/seasons.py reads each season alone).
Writes history/players_measured.json (each quantity {"2024": .., "2025": .., "2026": .., "pooled": ..}).

  python3 history/measure_seasons.py [years, e.g. 2023,2024,2025,2026]

CHANGED
  v0.1  first build (Joe, 2026-10-12)
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'playoffs'))
import measure_traits as MT

MT.HERE = HERE
MT.YEARS = tuple(int(y) for y in (sys.argv[1] if len(sys.argv) > 1 else '2024,2025,2026').split(','))
MT.W = {y: 1.0 for y in MT.YEARS}
_rows = MT.rows_of
MT.rows_of = lambda role, pid: [r for r in _rows(role, pid) if r.get('game_type') == 'R']

if __name__ == '__main__':
    MT.main()
