# Statcast targets, 2024 season

Per-player distributions of the measurables (Baseball Savant leaderboards, qualified players unless the board sets its own minimum; heights and weights from the MLB Stats API), pulled 2026-09-30 by `statcast/fetch_statcast.py`. These were the 2024 values; they are the targets the latent-trait layer must reproduce, and the cross-correlations are the test it must pass without being told.

Derived proxies are labelled: `power_proxy` = bat speed³ / swing length (kinetic energy over swing time, up to constants), `power_proxy_per_kg` divides by body mass.

## Hitters (n = qualified batters with bat tracking, 215)

| measurable | unit | n | mean | sd | 5% | 25% | 50% | 75% | 95% |
|---|---|---|---|---|---|---|---|---|---|
| height | in | 566 | 72.2 | 2.281 | 68.0 | 71.0 | 72.0 | 74.0 | 76.0 |
| weight | lb | 566 | 208.1 | 20.5 | 175.0 | 195.0 | 208.0 | 220.0 | 240.8 |
| age | yr | 566 | 30.1 | 3.733 | 24.2 | 27.0 | 30.0 | 33.0 | 37.0 |
| bat_speed | mph | 215 | 71.7 | 2.675 | 67.2 | 70.4 | 71.7 | 73.3 | 75.9 |
| swing_length | ft | 215 | 7.337 | 0.387 | 6.707 | 7.123 | 7.336 | 7.575 | 7.931 |
| hard_swing_rate | % | 215 | 0.240 | 0.185 | 0.021 | 0.094 | 0.198 | 0.342 | 0.601 |
| squared_up_per_contact | % | 215 | 0.328 | 0.037 | 0.269 | 0.304 | 0.327 | 0.350 | 0.394 |
| squared_up_per_swing | % | 215 | 0.253 | 0.042 | 0.194 | 0.226 | 0.247 | 0.276 | 0.324 |
| blast_per_contact | % | 215 | 0.142 | 0.043 | 0.070 | 0.117 | 0.141 | 0.167 | 0.211 |
| blast_per_swing | % | 215 | 0.108 | 0.031 | 0.057 | 0.090 | 0.108 | 0.125 | 0.164 |
| attack_angle | deg | 215 | 10.2 | 3.223 | 4.816 | 8.274 | 9.894 | 12.6 | 15.6 |
| swing_tilt | deg | 215 | 32.4 | 3.581 | 26.3 | 29.9 | 32.5 | 34.5 | 38.4 |
| attack_direction | deg | 215 | -1.798 | 3.976 | -8.113 | -4.415 | -1.748 | 0.856 | 4.844 |
| ideal_attack_angle_rate | % | 215 | 0.515 | 0.074 | 0.393 | 0.469 | 0.516 | 0.561 | 0.633 |
| intercept_y_vs_plate | in | 215 | 2.795 | 4.301 | -3.539 | 0.182 | 2.640 | 5.108 | 9.586 |
| power_proxy | mph^3/ft | 215 | 50481 | 4754 | 42791 | 47362 | 50186 | 53918 | 58676 |
| power_proxy_per_kg | mph^3/ft/kg | 215 | 537.6 | 55.4 | 445.3 | 500.2 | 541.7 | 578.5 | 615.8 |
| ev_avg | mph | 252 | 89.2 | 2.223 | 85.7 | 87.9 | 89.0 | 90.6 | 92.9 |
| ev50 | mph | 252 | 100.0 | 2.451 | 96.0 | 98.5 | 99.8 | 101.3 | 104.0 |
| ev_max | mph | 252 | 111.3 | 2.825 | 107.1 | 109.3 | 110.9 | 113.1 | 116.4 |
| la_avg | deg | 252 | 13.7 | 4.190 | 6.100 | 10.6 | 13.9 | 16.6 | 20.4 |
| sweet_spot_pct | % | 252 | 34.2 | 3.551 | 28.7 | 31.8 | 34.2 | 36.4 | 40.0 |
| barrel_pct_bbe | % | 252 | 8.408 | 4.019 | 2.800 | 5.575 | 7.800 | 11.0 | 15.0 |
| hard_hit_pct | % | 252 | 40.1 | 7.519 | 26.2 | 35.6 | 40.2 | 45.2 | 51.9 |
| hr_distance_avg | ft | 252 | 396.5 | 9.881 | 379.6 | 390.0 | 397.0 | 404.0 | 412.0 |
| k_pct | % | 129 | 21.1 | 5.301 | 12.8 | 17.0 | 21.1 | 25.1 | 28.8 |
| bb_pct | % | 129 | 8.698 | 2.658 | 4.780 | 6.900 | 8.500 | 10.8 | 12.2 |
| chase_pct | % | 129 | 28.3 | 5.537 | 20.8 | 24.3 | 27.5 | 31.8 | 37.4 |
| iz_contact_pct | % | 129 | 83.7 | 4.965 | 75.9 | 80.3 | 83.5 | 87.2 | 91.4 |
| oz_contact_pct | % | 129 | 57.9 | 9.370 | 44.9 | 50.7 | 58.2 | 63.7 | 74.5 |
| whiff_pct | % | 129 | 24.0 | 5.963 | 14.3 | 20.2 | 24.4 | 28.9 | 33.6 |
| swing_pct | % | 129 | 47.9 | 4.692 | 40.6 | 44.5 | 48.0 | 50.4 | 56.3 |
| pull_pct | % | 129 | 38.5 | 6.053 | 29.6 | 33.6 | 38.4 | 42.6 | 48.0 |
| oppo_pct | % | 129 | 24.9 | 4.294 | 17.7 | 22.0 | 24.6 | 27.6 | 31.4 |
| gb_pct | % | 129 | 42.0 | 6.126 | 32.4 | 37.9 | 42.2 | 46.5 | 50.9 |
| fb_pct | % | 129 | 27.3 | 4.874 | 19.0 | 23.6 | 27.3 | 30.5 | 35.8 |
| pu_pct | % | 129 | 6.773 | 2.659 | 3.200 | 4.800 | 6.500 | 8.300 | 11.1 |
| xwoba |  | 129 | 0.334 | 0.034 | 0.291 | 0.315 | 0.332 | 0.346 | 0.400 |
| sprint_speed | ft/s | 566 | 27.3 | 1.361 | 25.0 | 26.5 | 27.4 | 28.3 | 29.5 |
| hp_to_1b | s | 496 | 4.474 | 0.195 | 4.190 | 4.340 | 4.440 | 4.603 | 4.820 |
| run_t30 | s | 496 | 1.809 | 0.061 | 1.720 | 1.760 | 1.810 | 1.850 | 1.920 |
| run_t60 | s | 496 | 2.951 | 0.105 | 2.800 | 2.870 | 2.940 | 3.020 | 3.143 |
| run_t90 | s | 496 | 4.040 | 0.161 | 3.810 | 3.930 | 4.020 | 4.140 | 4.360 |
| jump_reaction | ft vs lg | 101 | 0.076 | 0.945 | -1.300 | -0.500 | -0.100 | 0.500 | 1.800 |
| jump_burst | ft vs lg | 101 | 0.034 | 1.113 | -1.900 | -0.800 | 0.100 | 0.900 | 1.800 |
| jump_route | ft vs lg | 101 | -0.044 | 0.587 | -1.200 | -0.200 | 0.100 | 0.300 | 0.600 |
| arm_overall | mph | 388 | 84.2 | 5.773 | 73.7 | 80.5 | 84.9 | 88.1 | 92.5 |
| arm_max | mph | 388 | 89.7 | 6.630 | 78.9 | 85.2 | 90.1 | 94.3 | 99.6 |
| steal_lead_primary | ft | 434 | 11.6 | 0.943 | 10.1 | 11.0 | 11.6 | 12.3 | 13.1 |
| steal_lead_secondary | ft | 434 | 15.3 | 1.205 | 13.5 | 14.5 | 15.2 | 16.1 | 17.3 |
| steal_lead_primary_on_attempt | ft | 367 | 12.0 | 1.414 | 9.966 | 11.2 | 11.9 | 12.7 | 14.2 |
| steal_lead_secondary_on_attempt | ft | 367 | 24.2 | 3.894 | 19.8 | 21.7 | 23.5 | 25.4 | 32.2 |
| steal_attempt_rate | per opp | 434 | 0.013 | 0.015 | 0.000 | 0.003 | 0.009 | 0.019 | 0.042 |
| steal_success | frac | 208 | 0.798 | 0.142 | 0.541 | 0.714 | 0.818 | 0.896 | 1.000 |

## Who holds the tails: hitters

For each measurable: the top three and bottom three (name, value), the observed extreme in sd units, the extreme a NORMAL with this mean and sd would give for this many players (E[max] ≈ μ + σ·Φ⁻¹(n/(n+1))), the excess (observed − normal, in sd), and the skew. Excess above ~0.7 sd or skew beyond ±0.5 means the tail is heavier than a normal draw of this trait would make it: the exceptional are more exceptional than the bell curve says.

| measurable | top 3 | bottom 3 | max z | normal max z | excess (sd) | min z | skew |
|---|---|---|---|---|---|---|---|
| height | Judge 79; Cruz 79; Hensley 78 | Altuve 66; Campero 66; Mullins 67 | +3.00 | +2.92 | +0.08 | -2.70 | +0.10 |
| weight | Baker 285; Judge 282; Tellez 273 | Clase 150; Sanoja 150; Rivas 150 | +3.75 | +2.92 | +0.84 | -2.83 | +0.21 |
| bat_speed | Stanton 81.2; Cruz 78.5; Schwarber 77.5 | Arraez 63.1; Lopez 64.1; Kwan 64.4 | +3.55 | +2.60 | +0.94 | -3.22 | -0.20 |
| swing_length | Stanton 8.56; Martinez 8.42; Arenado 8.22 | Arraez 5.95; Turang 6.07; Verdugo 6.32 | +3.16 | +2.60 | +0.56 | -3.58 | -0.23 |
| squared_up_per_contact | Arraez 0.458; Betts 0.425; Perkins 0.422 | Varsho 0.24; Adell 0.25; Fraley 0.258 | +3.48 | +2.60 | +0.88 | -2.37 | +0.37 |
| blast_per_contact | Stanton 0.274; Ohtani 0.258; Judge 0.254 | Lopez 0.0304; Arraez 0.0462; Turner 0.0496 | +3.09 | +2.60 | +0.49 | -2.60 | +0.22 |
| attack_angle | O'Neill 17.6; Suárez 17.5; Gorman 17.4 | Turang 1.01; Ortiz 2.25; Jr. 3.21 | +2.31 | +2.60 | -0.30 | -2.85 | -0.01 |
| power_proxy_per_kg | Carroll 698; Lowe 677; Suzuki 653 | Bell 374; Ruiz 381; Hoskins 406 | +2.90 | +2.60 | +0.29 | -2.96 | -0.23 |
| ev_avg | Judge 96.2; Ohtani 95.8; Cruz 95.5 | Frelick 83.4; Caballero 83.7; Fraley 84.3 | +3.15 | +2.66 | +0.49 | -2.61 | +0.21 |
| ev50 | Stanton 108; Judge 107; Cruz 107 | Lopez 94.1; Frelick 94.4; Arraez 94.8 | +3.34 | +2.66 | +0.69 | -2.41 | +0.33 |
| ev_max | Cruz 122; Stanton 120; Ohtani 119 | Schuemann 105; Kwan 106; Schanuel 106 | +3.63 | +2.66 | +0.97 | -2.07 | +0.60 |
| barrel_pct_bbe | Judge 26.9; Ohtani 21.5; Stanton 20.7 | Frelick 0.8; Hoerner 1.2; Lopez 1.5 | +4.60 | +2.66 | +1.94 | -1.89 | +0.81 |
| hard_hit_pct | Judge 61; Ohtani 60.1; Soto 57 | Lopez 16.9; Frelick 19.5; Rocchio 22.3 | +2.78 | +2.66 | +0.12 | -3.08 | -0.17 |
| hr_distance_avg | Cruz 422; Perez 420; Sánchez 419 | Hoerner 368; Fraley 372; Perdomo 372 | +2.58 | +2.66 | -0.07 | -2.88 | -0.13 |
| k_pct | Gelof 34.4; Cruz 31.3; Cowser 30.7 | Arraez 4.3; Kwan 9.4; Hoerner 10.3 | +2.52 | +2.42 | +0.09 | -3.16 | -0.16 |
| bb_pct | Judge 18.9; Soto 18.1; Schwarber 15.3 | Rafaela 2.6; Tovar 3.3; Arraez 3.6 | +3.84 | +2.42 | +1.42 | -2.29 | +0.59 |
| chase_pct | Rafaela 46.6; Tovar 44.1; Perez 42.9 | McCutchen 17.2; Soto 18.3; India 18.4 | +3.31 | +2.42 | +0.89 | -2.00 | +0.64 |
| whiff_pct | Gelof 36.4; García 34.3; Rooker 34.1 | Arraez 6.9; Kwan 8.2; Hoerner 11.9 | +2.07 | +2.42 | -0.35 | -2.88 | -0.32 |
| iz_contact_pct | Kwan 95.7; Arraez 95.3; Betts 93.9 | Devers 71.9; Morel 72.8; Gelof 74 | +2.43 | +2.42 | +0.00 | -2.37 | +0.03 |
| sprint_speed | Jr. 30.5; Rojas 30.1; II 30 | Ford 22.8; Narváez 23.1; Maldonado 23.1 | +2.35 | +2.92 | -0.57 | -3.31 | -0.36 |
| hp_to_1b | Sánchez 5.09; Grandal 5.08; Stanton 5.06 | Bae 4.06; Carroll 4.09; Hamilton 4.09 | +3.16 | +2.88 | +0.28 | -2.12 | +0.48 |
| arm_overall | Cruz 99.1; Jones 97.7; Doyle 97.4 | Noda 66.1; Goldschmidt 67.7; Smith 67.7 | +2.58 | +2.80 | -0.22 | -3.14 | -0.45 |
| arm_max | Cowser 104; Cruz 103; Thomas 103 | Singleton 70.2; Busch 71.2; Smith 71.4 | +2.20 | +2.80 | -0.59 | -2.94 | -0.39 |
| steal_lead_secondary_on_attempt | Refsnyder 43.5; Muncy 42.6; Bethancourt 39.1 | Heim 12.2; Rutschman 16.2; Bride 16.7 | +4.97 | +2.78 | +2.19 | -3.08 | +1.49 |
| xwoba | Judge 0.479; Soto 0.464; Ohtani 0.444 | Arcia 0.262; Varsho 0.266; Gelof 0.273 | +4.23 | +2.42 | +1.81 | -2.12 | +1.36 |

## Catchers

| measurable | unit | n | mean | sd | 5% | 25% | 50% | 75% | 95% |
|---|---|---|---|---|---|---|---|---|---|
| pop_2b | s | 83 | 1.961 | 0.051 | 1.870 | 1.930 | 1.970 | 1.990 | 2.040 |
| pop_3b | s | 72 | 1.531 | 0.099 | 1.420 | 1.480 | 1.520 | 1.570 | 1.659 |
| exchange | s | 83 | 0.654 | 0.039 | 0.590 | 0.630 | 0.650 | 0.690 | 0.719 |
| arm_maxeff | mph | 83 | 82.4 | 3.113 | 76.7 | 80.3 | 82.5 | 84.7 | 86.9 |
| blocks_above_avg_per_game |  | 74 | -0.009 | 0.095 | -0.155 | -0.075 | -0.005 | 0.060 | 0.145 |
| pbwp_freq_easy | share of pitches | 74 | 0.958 | 0.008 | 0.944 | 0.955 | 0.959 | 0.963 | 0.970 |
| pbwp_freq_medium | share of pitches | 74 | 0.032 | 0.007 | 0.023 | 0.027 | 0.032 | 0.036 | 0.045 |
| pbwp_freq_tough | share of pitches | 74 | 0.009 | 0.003 | 0.005 | 0.008 | 0.009 | 0.011 | 0.013 |

## Pitchers

| measurable | unit | n | mean | sd | 5% | 25% | 50% | 75% | 95% |
|---|---|---|---|---|---|---|---|---|---|
| height | in | 768 | 74.7 | 2.112 | 71.0 | 73.0 | 75.0 | 76.0 | 78.0 |
| weight | lb | 768 | 213.7 | 20.7 | 180.0 | 200.0 | 215.0 | 225.0 | 250.0 |
| age | yr | 768 | 30.9 | 3.696 | 26.0 | 28.0 | 30.5 | 33.0 | 37.0 |
| ff_velo | mph | 730 | 94.0 | 2.421 | 89.9 | 92.4 | 94.1 | 95.7 | 97.6 |
| si_velo | mph | 557 | 93.4 | 2.507 | 89.4 | 91.9 | 93.6 | 95.1 | 97.3 |
| sl_velo | mph | 550 | 85.5 | 2.635 | 81.0 | 83.9 | 85.8 | 87.3 | 89.5 |
| cu_velo | mph | 391 | 79.5 | 3.391 | 73.8 | 77.3 | 79.6 | 81.8 | 84.9 |
| ch_velo | mph | 511 | 86.2 | 3.217 | 81.1 | 84.2 | 86.2 | 88.5 | 91.0 |
| ff_spin | rpm | 730 | 2276 | 149.4 | 2034 | 2175 | 2277 | 2370 | 2525 |
| sl_spin | rpm | 550 | 2408 | 219.3 | 2040 | 2264 | 2410 | 2562 | 2759 |
| cu_spin | rpm | 391 | 2503 | 276.3 | 2034 | 2328 | 2505 | 2682 | 2928 |
| ch_spin | rpm | 510 | 1783 | 261.1 | 1383 | 1607 | 1760 | 1972 | 2182 |
| ff_ivb | in | 418 | 15.3 | 2.453 | 10.6 | 14.0 | 15.6 | 17.0 | 18.5 |
| ff_hb | in | 418 | 7.804 | 3.273 | 2.200 | 5.600 | 7.800 | 10.0 | 13.1 |
| arm_angle | deg | 284 | 37.9 | 14.0 | 15.4 | 31.6 | 39.9 | 45.8 | 56.6 |
| release_height | ft | 284 | 5.752 | 0.567 | 4.977 | 5.533 | 5.800 | 6.057 | 6.451 |
| release_side | ft | 284 | -0.908 | 1.696 | -2.674 | -2.068 | -1.626 | 0.804 | 2.302 |
| shoulder_height | ft | 284 | 4.366 | 0.276 | 3.930 | 4.193 | 4.381 | 4.535 | 4.790 |
| tempo_empty | s | 348 | 16.2 | 1.475 | 13.8 | 15.3 | 16.2 | 17.1 | 18.6 |
| p_k_pct | % | 58 | 23.3 | 3.773 | 18.0 | 20.6 | 23.1 | 25.5 | 30.0 |
| p_bb_pct | % | 58 | 6.833 | 1.668 | 3.925 | 5.825 | 6.550 | 8.300 | 9.400 |
| p_whiff_pct | % | 58 | 25.5 | 3.742 | 19.8 | 22.4 | 25.2 | 28.5 | 31.9 |
| p_chase_pct | % | 58 | 29.5 | 2.667 | 25.5 | 27.8 | 29.6 | 31.1 | 33.6 |
| p_ev_avg | mph | 366 | 88.8 | 1.415 | 86.3 | 88.0 | 88.8 | 89.7 | 90.8 |
| p_barrel_pct | % | 366 | 7.681 | 2.091 | 4.025 | 6.400 | 7.700 | 8.900 | 10.9 |

## Who holds the tails: catchers

For each measurable: the top three and bottom three (name, value), the observed extreme in sd units, the extreme a NORMAL with this mean and sd would give for this many players (E[max] ≈ μ + σ·Φ⁻¹(n/(n+1))), the excess (observed − normal, in sd), and the skew. Excess above ~0.7 sd or skew beyond ±0.5 means the tail is heavier than a normal draw of this trait would make it: the exceptional are more exceptional than the bell curve says.

| measurable | top 3 | bottom 3 | max z | normal max z | excess (sd) | min z | skew |
|---|---|---|---|---|---|---|---|
| pop_2b | Grandal 2.09; Trevino 2.07; Ruiz 2.06 | Bailey 1.85; Realmuto 1.85; Lee 1.85 | +2.53 | +2.26 | +0.27 | -2.17 | -0.13 |
| exchange | Sabol 0.73; Diaz 0.73; O'Hoppe 0.72 | Gomes 0.55; Nido 0.57; Wynns 0.57 | +1.95 | +2.26 | -0.31 | -2.66 | -0.28 |
| arm_maxeff | Lee 88.3; Bethancourt 88.2; Dingler 87.5 | Gomes 75.2; Barnes 75.9; Higashioka 76.4 | +1.90 | +2.26 | -0.36 | -2.31 | -0.34 |
| blocks_above_avg_per_game | Kirk 0.216; Wynns 0.166; Murphy 0.163 | Teel -0.207; Ford -0.175; Sánchez -0.171 | +2.36 | +2.22 | +0.15 | -2.07 | +0.13 |

## Who holds the tails: pitchers

For each measurable: the top three and bottom three (name, value), the observed extreme in sd units, the extreme a NORMAL with this mean and sd would give for this many players (E[max] ≈ μ + σ·Φ⁻¹(n/(n+1))), the excess (observed − normal, in sd), and the skew. Excess above ~0.7 sd or skew beyond ±0.5 means the tail is heavier than a normal draw of this trait would make it: the exceptional are more exceptional than the bell curve says.

| measurable | top 3 | bottom 3 | max z | normal max z | excess (sd) | min z | skew |
|---|---|---|---|---|---|---|---|
| height | Hjelle 83; Ober 81; Neely 80 | Stroman 67; Matsui 68; Moll 69 | +3.95 | +3.01 | +0.94 | -3.63 | +0.10 |
| weight | Kuhnel 290; Manoah 285; Santillan 285 | Montero 145; Brazobán 155; Henriquez 155 | +3.68 | +3.01 | +0.67 | -3.31 | +0.20 |
| ff_velo | Joyce 102; Miller 101; Duran 100 | Rogers 82.3; Cimber 85; Suter 85.8 | +3.34 | +3.00 | +0.34 | -4.84 | -0.34 |
| ff_spin | Bachar 2718; Adams 2666; Adam 2653 | Crouse 1635; Thompson 1766; Burnes 1805 | +2.96 | +3.00 | -0.04 | -4.29 | -0.10 |
| ff_ivb | Vesia 20.3; Javier 20; Pivetta 19.9 | Hill 4.1; Milner 7.1; Thompson 7.2 | +2.03 | +2.82 | -0.80 | -4.58 | -0.87 |
| arm_angle | Flexen 70.1; Alvarado 65.1; Estrada 63.9 | Rogers -64.1; Hill -19.6; Thompson -5.8 | +2.30 | +2.70 | -0.40 | -7.29 | -1.93 |
| release_height | Verlander 7.1; Stripling 6.86; Flexen 6.84 | Rogers 1.1; Hill 3.14; Kelly 3.72 | +2.37 | +2.70 | -0.32 | -8.21 | -2.65 |
| p_k_pct | Sale 32.1; Gray 30.3; Skubal 30.3 | Gomber 16.7; Mikolas 16.9; Canning 17.6 | +2.33 | +2.12 | +0.21 | -1.75 | +0.31 |
| p_whiff_pct | Cease 32.4; Flaherty 32.1; Ragans 32 | Mikolas 16.4; Rea 19.3; Taillon 19.5 | +1.85 | +2.12 | -0.28 | -2.43 | +0.05 |

## Relationships the latent layer must get right (unfitted tests)

- bat_speed against squared_up_per_contact: r = -0.45 (n = 215)
- bat_speed against whiff_pct: r = +0.58 (n = 129)
- bat_speed against ev50: r = +0.87 (n = 215)
- weight against bat_speed: r = +0.46 (n = 215)
- height against bat_speed: r = +0.39 (n = 215)
- bat_speed against sprint_speed: r = +0.02 (n = 215)
- bat_speed against arm_overall: r = +0.21 (n = 188)
- height against k_pct: r = +0.26 (n = 129)
- swing_length against bat_speed: r = +0.54 (n = 215)
- attack_angle against fb_pct: r = +0.53 (n = 129)
- attack_angle against barrel_pct_bbe: r = +0.36 (n = 215)

## Hitter correlations

Pearson r across players (n in brackets); only |r| ≥ 0.25 shown, sorted by |r|.

- ev_avg ~ hard_hit_pct: r = +0.94 (252)
- iz_contact_pct ~ whiff_pct: r = -0.93 (129)
- bat_speed ~ hard_swing_rate: r = +0.92 (215)
- blast_per_contact ~ hard_hit_pct: r = +0.92 (215)
- blast_per_contact ~ ev_avg: r = +0.89 (215)
- sprint_speed ~ hp_to_1b: r = -0.89 (496)
- k_pct ~ whiff_pct: r = +0.87 (129)
- bat_speed ~ blast_per_contact: r = +0.86 (215)
- k_pct ~ iz_contact_pct: r = -0.84 (129)
- la_avg ~ fb_pct: r = +0.84 (129)
- barrel_pct_bbe ~ hard_hit_pct: r = +0.82 (252)
- hard_swing_rate ~ blast_per_contact: r = +0.81 (215)
- blast_per_contact ~ ev_max: r = +0.81 (215)
- hard_swing_rate ~ ev_max: r = +0.81 (215)
- ev_avg ~ barrel_pct_bbe: r = +0.80 (252)
- bat_speed ~ hard_hit_pct: r = +0.80 (215)
- blast_per_contact ~ barrel_pct_bbe: r = +0.78 (215)
- bat_speed ~ ev_max: r = +0.78 (215)
- barrel_pct_bbe ~ xwoba: r = +0.75 (129)
- bat_speed ~ ev_avg: r = +0.74 (215)
- ev_avg ~ xwoba: r = +0.74 (129)
- ev_avg ~ ev_max: r = +0.74 (252)
- hard_swing_rate ~ hard_hit_pct: r = +0.74 (215)
- bat_speed ~ barrel_pct_bbe: r = +0.73 (215)
- hard_swing_rate ~ ev_avg: r = +0.73 (215)
- ev_max ~ hard_hit_pct: r = +0.73 (252)
- hard_swing_rate ~ barrel_pct_bbe: r = +0.72 (215)
- bb_pct ~ chase_pct: r = -0.72 (129)
- hard_hit_pct ~ xwoba: r = +0.70 (129)
- blast_per_contact ~ xwoba: r = +0.68 (129)
- ev_max ~ barrel_pct_bbe: r = +0.68 (252)
- attack_angle ~ pull_pct: r = +0.65 (129)
- ev_max ~ xwoba: r = +0.64 (129)
- barrel_pct_bbe ~ whiff_pct: r = +0.61 (129)
- barrel_pct_bbe ~ iz_contact_pct: r = -0.60 (129)
- hp_to_1b ~ jump_burst: r = -0.60 (101)
- height ~ weight: r = +0.60 (566)
- hard_swing_rate ~ xwoba: r = +0.59 (129)
- sprint_speed ~ jump_burst: r = +0.58 (101)
- squared_up_per_contact ~ k_pct: r = -0.58 (129)
- bat_speed ~ whiff_pct: r = +0.58 (129)
- weight ~ power_proxy_per_kg: r = -0.56 (215)
- bb_pct ~ xwoba: r = +0.56 (129)
- bat_speed ~ swing_length: r = +0.54 (215)
- attack_angle ~ fb_pct: r = +0.53 (129)
- bat_speed ~ iz_contact_pct: r = -0.53 (129)
- la_avg ~ pull_pct: r = +0.52 (129)
- hard_hit_pct ~ whiff_pct: r = +0.52 (129)
- barrel_pct_bbe ~ k_pct: r = +0.51 (129)
- bat_speed ~ xwoba: r = +0.50 (129)
- barrel_pct_bbe ~ fb_pct: r = +0.50 (129)
- hard_hit_pct ~ iz_contact_pct: r = -0.49 (129)
- attack_angle ~ whiff_pct: r = +0.49 (129)
- bat_speed ~ k_pct: r = +0.49 (129)
- ideal_attack_angle_rate ~ pull_pct: r = +0.49 (129)
- weight ~ hard_swing_rate: r = +0.48 (215)
- attack_angle ~ la_avg: r = +0.48 (215)
- attack_angle ~ iz_contact_pct: r = -0.47 (129)
- blast_per_contact ~ whiff_pct: r = +0.47 (129)
- weight ~ blast_per_contact: r = +0.47 (215)
- attack_angle ~ ideal_attack_angle_rate: r = +0.47 (215)
- weight ~ ev_max: r = +0.47 (252)
- squared_up_per_contact ~ whiff_pct: r = -0.47 (129)
- hard_swing_rate ~ whiff_pct: r = +0.47 (129)
- barrel_pct_bbe ~ bb_pct: r = +0.46 (129)
- swing_length ~ whiff_pct: r = +0.46 (129)
- weight ~ bat_speed: r = +0.46 (215)
- weight ~ hp_to_1b: r = +0.45 (496)
- bat_speed ~ squared_up_per_contact: r = -0.45 (215)
- weight ~ xwoba: r = +0.45 (129)
- squared_up_per_contact ~ iz_contact_pct: r = +0.44 (129)
- hard_swing_rate ~ iz_contact_pct: r = -0.44 (129)
- height ~ ev_avg: r = +0.44 (252)
- swing_length ~ hard_swing_rate: r = +0.43 (215)
- power_proxy_per_kg ~ hp_to_1b: r = -0.43 (215)
- ev_avg ~ iz_contact_pct: r = -0.43 (129)
- blast_per_contact ~ iz_contact_pct: r = -0.43 (129)
- ev_avg ~ whiff_pct: r = +0.43 (129)
- height ~ blast_per_contact: r = +0.43 (215)
- swing_length ~ iz_contact_pct: r = -0.43 (129)
- hard_hit_pct ~ k_pct: r = +0.42 (129)
- power_proxy_per_kg ~ sprint_speed: r = +0.42 (215)
- swing_length ~ barrel_pct_bbe: r = +0.42 (215)
- height ~ barrel_pct_bbe: r = +0.42 (252)
- jump_reaction ~ jump_burst: r = +0.41 (101)
- weight ~ barrel_pct_bbe: r = +0.41 (252)
- sprint_speed ~ arm_overall: r = +0.41 (388)
- ev_max ~ whiff_pct: r = +0.41 (129)
- height ~ hard_hit_pct: r = +0.41 (252)
- weight ~ ev_avg: r = +0.41 (252)
- weight ~ hard_hit_pct: r = +0.41 (252)
- swing_length ~ squared_up_per_contact: r = -0.40 (215)
- weight ~ sprint_speed: r = -0.39 (566)
- swing_length ~ blast_per_contact: r = +0.39 (215)
- ev_max ~ iz_contact_pct: r = -0.39 (129)
- attack_angle ~ k_pct: r = +0.39 (129)
- height ~ bat_speed: r = +0.39 (215)
- height ~ hard_swing_rate: r = +0.39 (215)
- swing_length ~ pull_pct: r = +0.39 (129)
- hard_swing_rate ~ k_pct: r = +0.39 (129)
- hp_to_1b ~ arm_overall: r = -0.39 (379)
- bat_speed ~ power_proxy_per_kg: r = +0.38 (215)
- pull_pct ~ fb_pct: r = +0.38 (129)
- hard_swing_rate ~ bb_pct: r = +0.38 (129)
- swing_length ~ hard_hit_pct: r = +0.37 (215)
- ev_avg ~ bb_pct: r = +0.37 (129)
- height ~ ev_max: r = +0.37 (252)
- age ~ sprint_speed: r = -0.37 (566)
- hard_swing_rate ~ squared_up_per_contact: r = -0.36 (215)
- attack_angle ~ barrel_pct_bbe: r = +0.36 (215)
- swing_length ~ ev_max: r = +0.36 (215)
- height ~ xwoba: r = +0.36 (129)
- swing_tilt ~ ideal_attack_angle_rate: r = -0.34 (215)
- blast_per_contact ~ k_pct: r = +0.34 (129)
- hard_hit_pct ~ bb_pct: r = +0.34 (129)
- attack_angle ~ swing_tilt: r = +0.34 (215)
- ev_avg ~ k_pct: r = +0.34 (129)
- hard_swing_rate ~ power_proxy_per_kg: r = +0.33 (215)
- age ~ hp_to_1b: r = +0.33 (496)
- age ~ jump_burst: r = -0.32 (101)
- weight ~ bb_pct: r = +0.32 (129)
- swing_tilt ~ fb_pct: r = +0.32 (129)
- height ~ whiff_pct: r = +0.32 (129)
- ev_avg ~ jump_burst: r = -0.31 (85)
- fb_pct ~ xwoba: r = +0.31 (129)
- weight ~ swing_length: r = +0.31 (215)
- swing_length ~ ev_avg: r = +0.31 (215)
- swing_length ~ k_pct: r = +0.31 (129)
- blast_per_contact ~ bb_pct: r = +0.31 (129)
- ev_max ~ bb_pct: r = +0.30 (129)
- fb_pct ~ jump_reaction: r = -0.30 (43)
- blast_per_contact ~ power_proxy_per_kg: r = +0.30 (215)
- hard_hit_pct ~ jump_burst: r = -0.29 (85)
- bat_speed ~ bb_pct: r = +0.29 (129)
- power_proxy_per_kg ~ arm_overall: r = +0.29 (188)
- age ~ pull_pct: r = +0.29 (129)
- height ~ power_proxy_per_kg: r = -0.28 (215)
- ev_max ~ k_pct: r = +0.28 (129)
- bb_pct ~ fb_pct: r = +0.28 (129)
- bb_pct ~ jump_burst: r = -0.28 (43)
- squared_up_per_contact ~ la_avg: r = -0.28 (215)
- ideal_attack_angle_rate ~ iz_contact_pct: r = -0.27 (129)
- swing_length ~ attack_angle: r = +0.27 (215)
- arm_overall ~ jump_burst: r = +0.27 (101)
- la_avg ~ barrel_pct_bbe: r = +0.27 (252)
- age ~ bb_pct: r = +0.27 (129)
- height ~ k_pct: r = +0.26 (129)
- iz_contact_pct ~ fb_pct: r = -0.26 (129)
- height ~ iz_contact_pct: r = -0.26 (129)
- iz_contact_pct ~ jump_reaction: r = +0.26 (43)
- power_proxy_per_kg ~ hard_hit_pct: r = +0.26 (215)
- barrel_pct_bbe ~ jump_burst: r = -0.26 (85)
- iz_contact_pct ~ jump_burst: r = +0.26 (43)
- whiff_pct ~ fb_pct: r = +0.26 (129)
- swing_length ~ hp_to_1b: r = +0.26 (215)
- height ~ swing_length: r = +0.26 (215)
- ev_max ~ jump_burst: r = -0.25 (85)
- whiff_pct ~ pull_pct: r = +0.25 (129)
- chase_pct ~ whiff_pct: r = +0.25 (129)

## Pitcher correlations

Pearson r across players (n in brackets); only |r| ≥ 0.25 shown, sorted by |r|.

- p_k_pct ~ p_whiff_pct: r = +0.87 (58)
- arm_angle ~ release_height: r = +0.83 (284)
- ff_ivb ~ arm_angle: r = +0.72 (252)
- ff_ivb ~ release_height: r = +0.59 (252)
- ff_velo ~ p_k_pct: r = +0.49 (57)
- height ~ weight: r = +0.45 (768)
- ff_velo ~ p_whiff_pct: r = +0.39 (57)
- ff_spin ~ p_k_pct: r = +0.39 (57)
- p_whiff_pct ~ p_chase_pct: r = +0.38 (58)
- p_k_pct ~ p_chase_pct: r = +0.35 (58)
- p_bb_pct ~ p_chase_pct: r = -0.33 (58)
- p_k_pct ~ p_ev_avg: r = -0.29 (58)
- age ~ ff_velo: r = -0.27 (730)
- ff_velo ~ ff_spin: r = +0.27 (730)
- arm_angle ~ p_chase_pct: r = -0.26 (58)
- ff_velo ~ tempo_empty: r = +0.26 (254)
- ff_spin ~ p_whiff_pct: r = +0.26 (57)

## The running game, from the data

- pitch tempo with the bases empty (median, s) is above; the CSV export repeats that value in its men-on column, so the hold (delivery with a runner on) is NOT available from this board
- base stealers' leads: primary and secondary, overall and on attempts (ft), attempt rate per opportunity and success fraction: above
- catchers: pop time to second, exchange time, max-effort arm (mph): above
