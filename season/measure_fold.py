"""
measure_fold.py · v0.1 · 2026-10-13

playoffs/measure_traits.py on one fold's folder (season/foldA or foldB): 2025 and 2026 (the fold's half), regular season.

  python3 season/measure_fold.py season/foldA

CHANGED
  v0.1  first build (Joe, 2026-10-13)
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'playoffs'))
import measure_traits as MT
MT.HERE = os.path.abspath(sys.argv[1]); MT.YEARS = (2025, 2026); MT.W = {2025: 1.0, 2026: 1.0}
_rows = MT.rows_of
MT.rows_of = lambda role, pid: [r for r in _rows(role, pid) if r.get('game_type') == 'R']
if __name__ == '__main__':
    MT.main()
