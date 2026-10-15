# Ballgame (the latest version)

The game screen and everything it loads, updated 2026-10-15 at the end of the 2026 model review: baseball.html v5.2 with
the broadcast (bb_call v0.7, bb_schedule v0.9), engine v3.10 of the `engine-dev` branch (the playoff review's flight and contact, the swing refit,
the topped ball and less lift on low-spin liners), bb_field v1.19 (infielders dive and recover, base covers in time, one
rule for taking a base), bb_game v1.10, and the crowd, field and organ sounds. https://worldbyjoe.github.io/baseball-sim/play/

Three games in ten are drawn from real players: two clubs of 2026 major leaguers picked at random, each man with his own
measured and fitted traits (stable/bb_real2026.js, built by review/build_real2026.py on engine-dev from the season
replay's fits; review/players.js builds them as the playoff replays do). The rest are the league stable's clubs at one of
its six levels, or freshly drawn teams when the stable (stable/bb_stable.js, generated, not in git) is absent.

The announcers' voices come from the speech server on the TV's Pi and are silent here. The root baseball.html redirects here.
