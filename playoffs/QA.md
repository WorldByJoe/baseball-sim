# QA: the playoff data pull

Written by `playoffs/qa.py` from `players_measured.json`, `pitches/INDEX.json`, `season_stats.json` and the fetch logs. Rosters as of 2026-10-04 (active rosters).

## 1. Coverage

- Rostered players: 208; records written: 208; missing records: 0.
- By kind: pitcher 96, position 111, two-way 1.
- Statcast pulls: 418 player-season-role files, 600763 pitches in all (325149 in 2026, 275614 in 2025).
- Every column the brief asked for was present in the search CSV.

**Players with no 2026 Statcast data** (0):

| player | team | kind | pos | what the record uses | MLB season lines |
|---|---|---|---|---|---|

**Thin 2026 samples** (under 300 tracked swings or pitches; 2025 fills in at half weight): 20 players.

| player | team | as | 2026 sample |
|---|---|---|---|
| Jake Rogers | CWS | hitter | 282 tracked swings in 2026 (531 pooled) |
| Tommy Pham | CWS | hitter | 64 tracked swings in 2026 (779 pooled) |
| Angel Genao | CLE | hitter | 226 tracked swings in 2026 (226 pooled) |
| Daniel Espino | CLE | pitcher | 285 pitches in 2026, 0 in 2025 |
| Ali Sánchez | NYY | hitter | 150 tracked swings in 2026 (196 pooled) |
| Giancarlo Stanton | NYY | hitter | 174 tracked swings in 2026 (724 pooled) |
| Brewer Hicklen | ATL | hitter | 83 tracked swings in 2026 (92 pooled) |
| Ha-Seong Kim | ATL | hitter | 269 tracked swings in 2026 (575 pooled) |
| Ray Kerr | ATL | pitcher | 259 pitches in 2026, 0 in 2025 |
| Rowdy Tellez | ATL | hitter | 23 tracked swings in 2026 (585 pooled) |
| Sean Murphy | ATL | hitter | 232 tracked swings in 2026 (872 pooled) |
| Enrique Hernández | LAD | hitter | 177 tracked swings in 2026 (831 pooled) |
| Hyeseong Kim | LAD | hitter | 240 tracked swings in 2026 (566 pooled) |
| Josue De Paula | LAD | hitter | 61 tracked swings in 2026 (61 pooled) |
| Austin Hays | SD | hitter | 214 tracked swings in 2026 (1022 pooled) |
| Dustin Harris | SD | hitter | 269 tracked swings in 2026 (359 pooled) |
| Ethan Salas | SD | hitter | 77 tracked swings in 2026 (77 pooled) |
| Jase Bowen | SD | hitter | 163 tracked swings in 2026 (163 pooled) |
| Joe Musgrove | SD | pitcher | 22 pitches in 2026, 0 in 2025 |
| Samad Taylor | SD | hitter | 263 tracked swings in 2026 (275 pooled) |

## 2. Sanity against the league

Means over the eight rosters' hitters (pooled values, every hitter with the trait, unweighted), against the league values the brief gives. Then every player more than 2 league sd from the league value: these are real outliers to eyeball, not errors by themselves.

| trait | unit | players | roster mean | roster sd | league | league sd |  |
|---|---|---|---|---|---|---|---|
| batSpeed | mph | 112 | 70.09 | 2.76 | 71.50 | 2.65 | ok |
| swingLenFt | ft | 112 | 7.28 | 0.42 | 7.30 | 0.38 | ok |
| attack | deg | 112 | 8.17 | 3.42 | 9.50 | 3.54 | ok |
| swingTilt | deg | 112 | 31.75 | 4.15 | 32.00 | 3.82 | ok |
| speed | ft/s | 112 | 27.38 | 1.35 | 27.30 | 1.02 | ok |
| four-seam velo, SP | mph | 42 | 95.07 | 1.82 | 94.06 | 2.16 | ok |
| four-seam velo, RP | mph | 51 | 95.29 | 2.77 | 95.05 | 2.37 | ok |

Players more than 2 league sd from the league value (49):

| player | team | trait | pooled | se | n | z |
|---|---|---|---|---|---|---|
| Chase Meidroth | CWS | batSpeed | 65.50 | 0.16 | 1853 | -2.3 |
| Steven Kwan | CLE | batSpeed | 61.30 | 0.16 | 1984 | -3.8 |
| Giancarlo Stanton | NYY | batSpeed | 78.39 | 0.30 | 724 | +2.6 |
| Chandler Simpson | TB | batSpeed | 63.26 | 0.18 | 1563 | -3.1 |
| Junior Caminero | TB | batSpeed | 77.48 | 0.16 | 2382 | +2.3 |
| Hyeseong Kim | LAD | batSpeed | 65.34 | 0.30 | 566 | -2.3 |
| Dustin Harris | SD | batSpeed | 64.69 | 0.48 | 359 | -2.6 |
| Braden Montgomery | CWS | swingLenFt | 6.48 | 0.03 | 709 | -2.2 |
| Steven Kwan | CLE | swingLenFt | 6.12 | 0.02 | 1984 | -3.1 |
| Giancarlo Stanton | NYY | swingLenFt | 8.60 | 0.04 | 724 | +3.4 |
| Chandler Simpson | TB | swingLenFt | 6.46 | 0.02 | 1563 | -2.2 |
| Junior Caminero | TB | swingLenFt | 8.58 | 0.01 | 2382 | +3.4 |
| Dustin Harris | SD | swingLenFt | 6.54 | 0.05 | 359 | -2.0 |
| Munetaka Murakami | CWS | attack | 18.07 | 0.34 | 598 | +2.4 |
| Steven Kwan | CLE | attack | 0.81 | 0.29 | 1835 | -2.5 |
| Ben Williamson | TB | attack | 0.52 | 0.35 | 826 | -2.5 |
| Chandler Simpson | TB | attack | 2.06 | 0.22 | 1406 | -2.1 |
| Nick Fortes | TB | attack | 2.27 | 0.26 | 808 | -2.0 |
| Ryan Vilade | TB | attack | 2.39 | 0.42 | 430 | -2.0 |
| Yandy Díaz | TB | attack | 1.53 | 0.16 | 1971 | -2.2 |
| Joey Ortiz | MIL | attack | 1.09 | 0.27 | 1302 | -2.4 |
| Luis Lara | MIL | attack | -0.58 | 0.53 | 308 | -2.8 |
| Spencer Jones | NYY | swingTilt | 43.64 | 0.18 | 668 | +3.0 |
| Jonny DeLuca | TB | swingTilt | 23.71 | 0.22 | 805 | -2.2 |
| Nick Fortes | TB | swingTilt | 19.44 | 0.22 | 969 | -3.3 |
| Yandy Díaz | TB | swingTilt | 23.86 | 0.12 | 2293 | -2.1 |
| Andy Pages | LAD | swingTilt | 40.22 | 0.13 | 2457 | +2.2 |
| Freddie Freeman | LAD | swingTilt | 42.44 | 0.11 | 2725 | +2.7 |
| Hyeseong Kim | LAD | swingTilt | 40.47 | 0.23 | 566 | +2.2 |
| Brenton Doyle | CWS | speed | 29.37 | 0.13 | 286 | +2.0 |
| Luisangel Acuña | CWS | speed | 29.74 | 0.15 | 200 | +2.4 |
| Austin Hedges | CLE | speed | 24.59 | 0.19 | 118 | -2.7 |
| Ali Sánchez | NYY | speed | 25.20 | 0.35 | 35 | -2.1 |
| Giancarlo Stanton | NYY | speed | 23.63 | 0.23 | 87 | -3.6 |
| Chandler Simpson | TB | speed | 29.45 | 0.09 | 599 | +2.1 |
| Jorge Mateo | TB | speed | 30.03 | 0.20 | 108 | +2.7 |
| Matt Olson | ATL | speed | 25.27 | 0.10 | 424 | -2.0 |
| Rowdy Tellez | ATL | speed | 23.50 | 0.24 | 74 | -3.7 |
| Sean Murphy | ATL | speed | 25.23 | 0.18 | 142 | -2.0 |
| Jase Bowen | SD | speed | 29.60 | 0.35 | 34 | +2.3 |
| Ty France | SD | speed | 24.84 | 0.12 | 339 | -2.4 |
| David Hamilton | MIL | speed | 29.38 | 0.15 | 185 | +2.0 |
| Garrett Mitchell | MIL | speed | 29.75 | 0.13 | 240 | +2.4 |
| Gary Sánchez | MIL | speed | 24.51 | 0.21 | 103 | -2.7 |
| Jacob Misiorowski | MIL | FF velo (SP) | 100.41 | 0.04 | 2456 | +2.9 |
| Ryan Yarbrough | NYY | FF velo (RP) | 87.62 | 0.08 | 307 | -3.1 |
| Brent Suter | ATL | FF velo (RP) | 87.64 | 0.06 | 889 | -3.1 |
| Edgardo Henriquez | LAD | FF velo (RP) | 100.68 | 0.06 | 445 | +2.4 |
| Mason Miller | SD | FF velo (RP) | 101.38 | 0.04 | 1090 | +2.7 |

## 3. Convention checks

- **Spray** (where balls in play went, + pulled): 100 of 107 hitters with 100+ balls in play pull on average; median 4.5 deg. Most hitters pull, as they should.
- **The bat's direction** at contact on balls in play (pullBias, + toward the pull side = -attack_direction): 55 of 106 hitters positive, median 0.1 deg. The league's mean is near zero (2025: -0.5 deg on balls in play, statcast/bat_direction_2025.json): the bat meets the ball about square to centre while the ball goes to the pull side, so about half positive is expected.
- **Batter-relative location**: the mean pitch to a right-handed batter sits 2.09 in away from him (plate_x mean +2.09 in), to a left-handed batter 1.80 in away (plate_x mean -1.80 in); n 142446 and 116062. Away is + for both: the sign flip is right.

**Three named players** to check against their Baseball Savant pages (pooled 2025-26, 2026 in brackets):

- **Shohei Ohtani** (LAD, bats L): bat speed 73.5 [73.1] mph, swing length 7.87 [7.85] ft, attack angle 12.0 [11.4] deg, swing tilt 37.2 [37.4] deg, sprint speed 27.8 [27.7] ft/s, K% 0.250, BB% 0.140, chase 0.287, hard-hit 0.553.
- **Fernando Tatis Jr.** (SD, bats R): bat speed 73.2 [74.0] mph, swing length 7.23 [7.23] ft, attack angle 5.9 [5.5] deg, swing tilt 29.5 [29.3] deg, sprint speed 28.9 [29.0] ft/s, K% 0.188, BB% 0.103, chase 0.261, hard-hit 0.535.
- **Ronald Acuña Jr.** (ATL, bats R): bat speed 73.4 [73.1] mph, swing length 7.50 [7.50] ft, attack angle 9.6 [9.3] deg, swing tilt 37.8 [37.2] deg, sprint speed 27.3 [27.1] ft/s, K% 0.225, BB% 0.132, chase 0.270, hard-hit 0.458.
- **Gerrit Cole** (NYY, throws R): four-seam 96.8 mph, 2322 rpm, 9.8 in arm-side, 16.9 in vertical (induced), usage 0.494; arm angle 37.6 deg, extension 6.22 ft; four-seam command scatter 7.88 across, 9.40 up-down (in).

- **Four-seam command scatter** (within count group x batter side, pooled): mean over 92 roster pitchers 8.34 in across, 9.31 up-down; the local session measured the league at 8.17 and 9.03.

## 4. Statcast rows against the season totals

Regular-season pitches in the Statcast file against the Stats API's pitch count (pitches seen as a batter, thrown as a pitcher). Flagged over 3%.

392 player-season-role files checked; 1 off by more than 3% (listed):

| player | role | year | Statcast R pitches | season total | diff % |
|---|---|---|---|---|---|
| José Ramírez | batter | 2025 | 2752 | 2666 | 3.2 |

## 5. Fetches that failed

None.
