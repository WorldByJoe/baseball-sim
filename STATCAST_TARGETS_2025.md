# Statcast targets, 2025 season

Per-player distributions of the measurables (Baseball Savant leaderboards, qualified players unless the board sets its own minimum; heights and weights from the MLB Stats API), pulled 2026-09-30 by `statcast/fetch_statcast.py`. These were the 2025 values; they are the targets the latent-trait layer must reproduce, and the cross-correlations are the test it must pass without being told.

Derived proxies are labelled: `power_proxy` = bat speed³ / swing length (kinetic energy over swing time, up to constants), `power_proxy_per_kg` divides by body mass.

## Hitters (n = qualified batters with bat tracking, 226)

| measurable | unit | n | mean | sd | 5% | 25% | 50% | 75% | 95% |
|---|---|---|---|---|---|---|---|---|---|
| height | in | 579 | 72.0 | 2.349 | 68.0 | 70.0 | 72.0 | 74.0 | 76.0 |
| weight | lb | 579 | 206.3 | 19.9 | 177.7 | 190.5 | 205.0 | 220.0 | 240.1 |
| age | yr | 579 | 29.0 | 3.709 | 24.0 | 26.0 | 29.0 | 31.0 | 36.0 |
| bat_speed | mph | 226 | 72.0 | 2.650 | 67.5 | 70.6 | 72.1 | 73.8 | 76.0 |
| swing_length | ft | 226 | 7.317 | 0.394 | 6.714 | 7.054 | 7.312 | 7.566 | 7.935 |
| hard_swing_rate | % | 226 | 0.259 | 0.192 | 0.025 | 0.103 | 0.216 | 0.395 | 0.624 |
| squared_up_per_contact | % | 226 | 0.337 | 0.041 | 0.274 | 0.308 | 0.336 | 0.362 | 0.406 |
| squared_up_per_swing | % | 226 | 0.262 | 0.046 | 0.197 | 0.229 | 0.257 | 0.289 | 0.347 |
| blast_per_contact | % | 226 | 0.158 | 0.042 | 0.092 | 0.132 | 0.163 | 0.185 | 0.225 |
| blast_per_swing | % | 226 | 0.121 | 0.031 | 0.074 | 0.101 | 0.122 | 0.142 | 0.170 |
| attack_angle | deg | 226 | 10.0 | 3.372 | 4.444 | 7.848 | 9.955 | 11.8 | 15.8 |
| swing_tilt | deg | 226 | 32.3 | 3.786 | 26.5 | 29.4 | 32.2 | 34.8 | 38.7 |
| attack_direction | deg | 226 | -1.628 | 4.033 | -7.993 | -4.551 | -1.696 | 1.067 | 4.736 |
| ideal_attack_angle_rate | % | 226 | 0.512 | 0.076 | 0.373 | 0.470 | 0.505 | 0.566 | 0.644 |
| intercept_y_vs_plate | in | 226 | 2.792 | 4.633 | -3.172 | -0.265 | 2.152 | 5.579 | 10.1 |
| power_proxy | mph^3/ft | 226 | 51167 | 4623 | 43988 | 48037 | 50818 | 54472 | 58977 |
| power_proxy_per_kg | mph^3/ft/kg | 226 | 545.5 | 53.2 | 465.7 | 508.2 | 546.2 | 579.1 | 635.6 |
| ev_avg | mph | 251 | 89.7 | 2.179 | 85.6 | 88.3 | 89.9 | 91.1 | 93.3 |
| ev50 | mph | 251 | 100.6 | 2.461 | 96.1 | 99.2 | 100.7 | 102.3 | 104.2 |
| ev_max | mph | 251 | 111.7 | 2.942 | 107.3 | 109.6 | 111.3 | 113.6 | 116.8 |
| la_avg | deg | 251 | 13.6 | 4.450 | 6.600 | 10.8 | 13.8 | 16.6 | 20.9 |
| sweet_spot_pct | % | 251 | 34.6 | 3.485 | 28.9 | 32.6 | 34.4 | 36.9 | 40.2 |
| barrel_pct_bbe | % | 251 | 9.157 | 4.413 | 2.050 | 6.200 | 9.000 | 12.0 | 16.9 |
| hard_hit_pct | % | 251 | 42.1 | 7.839 | 27.6 | 37.5 | 43.4 | 47.1 | 53.5 |
| hr_distance_avg | ft | 249 | 395.0 | 10.8 | 378.0 | 387.0 | 395.0 | 403.0 | 411.0 |
| k_pct | % | 145 | 20.4 | 5.675 | 11.1 | 16.7 | 20.4 | 25.2 | 28.8 |
| bb_pct | % | 145 | 8.865 | 3.063 | 4.800 | 6.400 | 8.700 | 10.9 | 14.5 |
| chase_pct | % | 145 | 27.9 | 5.904 | 19.5 | 23.6 | 26.9 | 31.6 | 38.7 |
| iz_contact_pct | % | 145 | 84.0 | 4.770 | 76.2 | 81.0 | 83.9 | 87.0 | 91.8 |
| oz_contact_pct | % | 145 | 57.2 | 10.1 | 42.7 | 49.8 | 56.3 | 63.3 | 74.3 |
| whiff_pct | % | 145 | 23.8 | 6.001 | 13.0 | 20.4 | 24.4 | 28.5 | 32.9 |
| swing_pct | % | 145 | 47.4 | 4.791 | 39.5 | 44.5 | 47.1 | 50.4 | 55.3 |
| pull_pct | % | 145 | 39.1 | 5.892 | 29.2 | 35.2 | 39.0 | 42.9 | 48.8 |
| oppo_pct | % | 145 | 24.4 | 3.894 | 18.0 | 22.0 | 24.4 | 26.6 | 30.5 |
| gb_pct | % | 145 | 41.5 | 5.795 | 32.3 | 37.4 | 41.9 | 45.8 | 50.3 |
| fb_pct | % | 145 | 27.3 | 4.988 | 19.1 | 23.8 | 27.3 | 30.0 | 35.7 |
| pu_pct | % | 145 | 6.871 | 2.495 | 3.240 | 5.100 | 6.700 | 8.700 | 10.9 |
| xwoba |  | 145 | 0.333 | 0.029 | 0.296 | 0.314 | 0.329 | 0.350 | 0.386 |
| sprint_speed | ft/s | 579 | 27.3 | 1.355 | 25.0 | 26.4 | 27.5 | 28.3 | 29.4 |
| hp_to_1b | s | 513 | 4.467 | 0.193 | 4.190 | 4.330 | 4.440 | 4.580 | 4.820 |
| run_t30 | s | 513 | 1.804 | 0.059 | 1.720 | 1.760 | 1.800 | 1.840 | 1.900 |
| run_t60 | s | 513 | 2.944 | 0.101 | 2.800 | 2.870 | 2.940 | 3.000 | 3.120 |
| run_t90 | s | 513 | 4.030 | 0.156 | 3.810 | 3.910 | 4.010 | 4.120 | 4.320 |
| jump_reaction | ft vs lg | 92 | 0.070 | 1.131 | -1.300 | -0.700 | -0.100 | 0.525 | 1.790 |
| jump_burst | ft vs lg | 92 | -0.036 | 1.077 | -1.845 | -0.800 | -0.100 | 0.700 | 1.835 |
| jump_route | ft vs lg | 92 | -0.028 | 0.685 | -1.200 | -0.300 | 0.100 | 0.400 | 0.900 |
| arm_overall | mph | 395 | 83.9 | 5.881 | 73.6 | 80.3 | 84.2 | 87.9 | 92.6 |
| arm_max | mph | 395 | 89.4 | 6.824 | 76.7 | 85.2 | 89.8 | 94.3 | 99.0 |
| steal_lead_primary | ft | 426 | 11.7 | 0.943 | 10.0 | 11.2 | 11.7 | 12.3 | 13.1 |
| steal_lead_secondary | ft | 426 | 15.3 | 1.204 | 13.2 | 14.5 | 15.3 | 16.1 | 17.2 |
| steal_lead_primary_on_attempt | ft | 368 | 12.2 | 1.375 | 10.1 | 11.2 | 12.1 | 12.9 | 14.4 |
| steal_lead_secondary_on_attempt | ft | 368 | 24.0 | 3.692 | 19.3 | 21.8 | 23.4 | 25.4 | 29.9 |
| steal_attempt_rate | per opp | 426 | 0.013 | 0.014 | 0.000 | 0.003 | 0.009 | 0.021 | 0.041 |
| steal_success | frac | 202 | 0.796 | 0.135 | 0.556 | 0.727 | 0.800 | 0.884 | 1.000 |

## Who holds the tails: hitters

For each measurable: the top three and bottom three (name, value), the observed extreme in sd units, the extreme a NORMAL with this mean and sd would give for this many players (E[max] ≈ μ + σ·Φ⁻¹(n/(n+1))), the excess (observed − normal, in sd), and the skew. Excess above ~0.7 sd or skew beyond ±0.5 means the tail is heavier than a normal draw of this trait would make it: the exceptional are more exceptional than the bell curve says.

| measurable | top 3 | bottom 3 | max z | normal max z | excess (sd) | min z | skew |
|---|---|---|---|---|---|---|---|
| height | Eldridge 79; Judge 79; Cruz 79 | Altuve 66; Durbin 66; Campero 66 | +2.96 | +2.92 | +0.04 | -2.57 | +0.19 |
| weight | Baker 285; Judge 282; Tellez 273 | Sanoja 150; Clase 150; Rivas 150 | +3.95 | +2.92 | +1.02 | -2.82 | +0.35 |
| bat_speed | Cruz 78.8; Caminero 78.5; Walker 78.1 | Arraez 62.5; Kwan 63.5; Wilson 63.8 | +2.55 | +2.62 | -0.06 | -3.57 | -0.34 |
| swing_length | Arenado 8.43; Caminero 8.42; Báez 8.27 | Arraez 5.85; Wilson 6.1; Kwan 6.32 | +2.82 | +2.62 | +0.20 | -3.72 | -0.20 |
| squared_up_per_contact | Betts 0.469; Arraez 0.457; Meidroth 0.441 | Greene 0.247; Wallner 0.252; Smith 0.255 | +3.25 | +2.62 | +0.63 | -2.20 | +0.41 |
| blast_per_contact | Soto 0.265; Jr. 0.263; Ohtani 0.261 | Arraez 0.0223; Frazier 0.043; Kwan 0.043 | +2.54 | +2.62 | -0.08 | -3.21 | -0.21 |
| attack_angle | Suárez 18.5; Adames 18.4; Neto 18 | Jr. 1.19; Ortiz 1.63; Mangum 2.25 | +2.51 | +2.62 | -0.10 | -2.62 | +0.12 |
| power_proxy_per_kg | Carroll 697; Lowe 682; Collins 672 | Flores 399; Bell 414; Paredes 423 | +2.84 | +2.62 | +0.22 | -2.74 | +0.07 |
| ev_avg | Cruz 95.8; Judge 95.4; Ohtani 94.9 | Iglesias 84; Simpson 84.3; Dubón 84.5 | +2.81 | +2.65 | +0.16 | -2.60 | -0.22 |
| ev50 | Cruz 107; Judge 107; Wood 106 | Arraez 93.6; Simpson 93.6; Kwan 94.4 | +2.74 | +2.65 | +0.08 | -2.83 | -0.21 |
| ev_max | Cruz 123; Jr. 120; Ohtani 120 | Kwan 104; Allen 104; Frazier 105 | +3.82 | +2.65 | +1.16 | -2.54 | +0.51 |
| barrel_pct_bbe | Judge 24.7; Ohtani 23.5; Schwarber 20.8 | Simpson 0; Allen 0; Edwards 0.8 | +3.52 | +2.65 | +0.87 | -2.08 | +0.41 |
| hard_hit_pct | Schwarber 59.6; Ohtani 58.7; Judge 58.2 | Arraez 16.7; Simpson 17.3; Kwan 19.3 | +2.24 | +2.65 | -0.42 | -3.24 | -0.59 |
| hr_distance_avg | Jr. 419; Pham 418; Wagaman 417 | Frazier 366; Kiner-Falefa 368; Caballero 369 | +2.23 | +2.65 | -0.43 | -2.69 | -0.18 |
| k_pct | McMahon 32.3; Wood 32.1; Trout 32 | Arraez 3.1; Wilson 7.5; Hoerner 7.6 | +2.09 | +2.47 | -0.37 | -3.05 | -0.25 |
| bb_pct | Judge 18.3; Soto 17.8; Ozuna 15.9 | II 2.5; Sosa 3.3; Diaz 3.5 | +3.08 | +2.47 | +0.62 | -2.08 | +0.59 |
| chase_pct | Diaz 44.4; II 43; Rafaela 42.2 | Soto 16; Torres 17.1; Grisham 17.3 | +2.80 | +2.47 | +0.34 | -2.01 | +0.53 |
| whiff_pct | McMahon 35.2; Judge 34.6; Cruz 34 | Arraez 5.3; Kwan 8.7; Wilson 9.6 | +1.89 | +2.47 | -0.57 | -3.09 | -0.46 |
| iz_contact_pct | Kwan 96.1; Arraez 95.9; Hoerner 94.9 | Devers 71.4; McMahon 74.8; Jr. 75.1 | +2.54 | +2.47 | +0.07 | -2.64 | +0.10 |
| sprint_speed | Turner 30.3; II 30.2; Jr. 30.2 | Maldonado 23.1; Huff 23.4; Tellez 23.5 | +2.18 | +2.92 | -0.74 | -3.13 | -0.35 |
| hp_to_1b | Stanton 5.22; Maldonado 5.14; Stallings 5.08 | Simpson 3.97; Hamilton 4.02; Mangum 4.08 | +3.89 | +2.89 | +1.01 | -2.57 | +0.55 |
| arm_overall | Cruz 98.2; Fernández 97.2; Barger 96.5 | Mountcastle 62.5; Bell 63.5; Smith 65.6 | +2.42 | +2.80 | -0.38 | -3.65 | -0.51 |
| arm_max | Jr. 105; Cruz 105; Caglianone 104 | Mountcastle 63; Bell 65.9; Rice 67.7 | +2.27 | +2.80 | -0.53 | -3.87 | -0.58 |
| steal_lead_secondary_on_attempt | Vientos 47.4; Fermín 38; Urías 37.7 | Sheets 14.9; Aranda 15.8; Quero 16.4 | +6.35 | +2.78 | +3.57 | -2.46 | +1.72 |
| xwoba | Judge 0.457; Soto 0.429; Ohtani 0.425 | Ortiz 0.275; Hayes 0.282; Winn 0.286 | +4.20 | +2.47 | +1.73 | -1.98 | +1.07 |

## Catchers

| measurable | unit | n | mean | sd | 5% | 25% | 50% | 75% | 95% |
|---|---|---|---|---|---|---|---|---|---|
| pop_2b | s | 84 | 1.958 | 0.051 | 1.880 | 1.930 | 1.950 | 2.000 | 2.048 |
| pop_3b | s | 71 | 1.542 | 0.102 | 1.420 | 1.475 | 1.540 | 1.570 | 1.685 |
| exchange | s | 84 | 0.655 | 0.045 | 0.572 | 0.630 | 0.650 | 0.690 | 0.730 |
| arm_maxeff | mph | 84 | 82.4 | 3.089 | 77.7 | 80.3 | 82.6 | 84.6 | 87.1 |
| blocks_above_avg_per_game |  | 74 | -0.009 | 0.095 | -0.155 | -0.075 | -0.005 | 0.060 | 0.145 |
| pbwp_freq_easy | share of pitches | 74 | 0.958 | 0.008 | 0.944 | 0.955 | 0.959 | 0.963 | 0.970 |
| pbwp_freq_medium | share of pitches | 74 | 0.032 | 0.007 | 0.023 | 0.027 | 0.032 | 0.036 | 0.045 |
| pbwp_freq_tough | share of pitches | 74 | 0.009 | 0.003 | 0.005 | 0.008 | 0.009 | 0.011 | 0.013 |

## Pitchers

| measurable | unit | n | mean | sd | 5% | 25% | 50% | 75% | 95% |
|---|---|---|---|---|---|---|---|---|---|
| height | in | 773 | 74.7 | 2.185 | 71.0 | 73.0 | 75.0 | 76.0 | 78.0 |
| weight | lb | 773 | 213.2 | 21.4 | 180.0 | 200.0 | 214.0 | 225.0 | 250.0 |
| age | yr | 773 | 30.0 | 3.785 | 25.0 | 27.0 | 30.0 | 32.0 | 37.0 |
| ff_velo | mph | 726 | 94.2 | 2.418 | 90.1 | 92.7 | 94.3 | 95.8 | 98.0 |
| si_velo | mph | 551 | 93.7 | 2.548 | 89.3 | 92.2 | 93.9 | 95.4 | 97.5 |
| sl_velo | mph | 541 | 86.0 | 2.642 | 81.4 | 84.3 | 86.2 | 87.7 | 90.0 |
| cu_velo | mph | 391 | 79.9 | 3.729 | 73.8 | 77.8 | 80.1 | 82.3 | 85.4 |
| ch_velo | mph | 517 | 86.4 | 3.315 | 80.5 | 84.6 | 86.7 | 88.5 | 91.5 |
| ff_spin | rpm | 726 | 2308 | 142.4 | 2063 | 2216 | 2308 | 2404 | 2538 |
| sl_spin | rpm | 541 | 2430 | 209.9 | 2083 | 2290 | 2432 | 2573 | 2770 |
| cu_spin | rpm | 391 | 2547 | 271.7 | 2088 | 2392 | 2547 | 2730 | 2982 |
| ch_spin | rpm | 517 | 1772 | 283.3 | 1298 | 1589 | 1768 | 1970 | 2207 |
| ff_ivb | in | 438 | 15.4 | 2.550 | 10.9 | 14.1 | 15.8 | 17.2 | 18.8 |
| ff_hb | in | 438 | 7.810 | 3.382 | 2.200 | 5.525 | 7.850 | 10.1 | 13.6 |
| arm_angle | deg | 287 | 37.4 | 11.4 | 17.3 | 31.0 | 37.4 | 45.0 | 55.2 |
| release_height | ft | 287 | 5.777 | 0.442 | 5.025 | 5.499 | 5.814 | 6.061 | 6.486 |
| release_side | ft | 287 | -0.872 | 1.774 | -2.692 | -2.114 | -1.683 | 1.115 | 2.304 |
| shoulder_height | ft | 287 | 4.397 | 0.254 | 3.969 | 4.227 | 4.404 | 4.561 | 4.805 |
| tempo_empty | s | 348 | 16.2 | 1.475 | 13.8 | 15.3 | 16.2 | 17.1 | 18.6 |
| p_k_pct | % | 52 | 22.8 | 4.498 | 16.1 | 19.3 | 22.6 | 26.3 | 29.6 |
| p_bb_pct | % | 52 | 7.317 | 1.723 | 4.855 | 6.025 | 7.100 | 8.625 | 9.745 |
| p_whiff_pct | % | 52 | 24.9 | 3.789 | 19.0 | 22.1 | 24.6 | 27.6 | 30.6 |
| p_chase_pct | % | 52 | 28.9 | 2.316 | 25.3 | 27.4 | 28.9 | 30.3 | 32.5 |
| p_ev_avg | mph | 349 | 89.2 | 1.418 | 86.5 | 88.4 | 89.3 | 90.3 | 91.3 |
| p_barrel_pct | % | 349 | 8.272 | 2.205 | 4.400 | 6.900 | 8.400 | 9.700 | 11.8 |

## Who holds the tails: catchers

For each measurable: the top three and bottom three (name, value), the observed extreme in sd units, the extreme a NORMAL with this mean and sd would give for this many players (E[max] ≈ μ + σ·Φ⁻¹(n/(n+1))), the excess (observed − normal, in sd), and the skew. Excess above ~0.7 sd or skew beyond ±0.5 means the tail is heavier than a normal draw of this trait would make it: the exceptional are more exceptional than the bell curve says.

| measurable | top 3 | bottom 3 | max z | normal max z | excess (sd) | min z | skew |
|---|---|---|---|---|---|---|---|
| pop_2b | Barnes 2.11; Nola 2.07; Rice 2.07 | Realmuto 1.86; Bailey 1.86; Rodríguez 1.86 | +2.98 | +2.26 | +0.72 | -1.93 | +0.31 |
| exchange | Millas 0.77; Fulford 0.73; Feduccia 0.73 | Heineman 0.55; Brantly 0.55; Rodríguez 0.56 | +2.58 | +2.26 | +0.32 | -2.35 | -0.10 |
| arm_maxeff | Dingler 89; Basallo 87.5; Senger 87.4 | Barnes 73.2; Higashioka 76.5; Caratini 77.2 | +2.14 | +2.26 | -0.12 | -2.97 | -0.24 |
| blocks_above_avg_per_game | Kirk 0.216; Wynns 0.166; Murphy 0.163 | Teel -0.207; Ford -0.175; Sánchez -0.171 | +2.36 | +2.22 | +0.15 | -2.07 | +0.13 |

## Who holds the tails: pitchers

For each measurable: the top three and bottom three (name, value), the observed extreme in sd units, the extreme a NORMAL with this mean and sd would give for this many players (E[max] ≈ μ + σ·Φ⁻¹(n/(n+1))), the excess (observed − normal, in sd), and the skew. Excess above ~0.7 sd or skew beyond ±0.5 means the tail is heavier than a normal draw of this trait would make it: the exceptional are more exceptional than the bell curve says.

| measurable | top 3 | bottom 3 | max z | normal max z | excess (sd) | min z | skew |
|---|---|---|---|---|---|---|---|
| height | Hjelle 83; Gervase 82; Ober 81 | Stroman 67; Matsui 68; Garcia 69 | +3.79 | +3.01 | +0.78 | -3.53 | +0.14 |
| weight | Bautista 285; Santillan 285; Estévez 277 | Montero 145; Henriquez 155; Brazobán 155 | +3.35 | +3.01 | +0.34 | -3.18 | +0.09 |
| ff_velo | Miller 101; Joyce 101; Henriquez 101 | Jacob 85.3; Hendricks 86.5; Suter 87.3 | +2.87 | +2.99 | -0.12 | -3.70 | -0.20 |
| ff_spin | Kent 2761; Hollowell 2718; Bachar 2717 | Cantillo 1842; Loutos 1877; McFarland 1911 | +3.18 | +2.99 | +0.19 | -3.27 | -0.03 |
| ff_ivb | Vesia 20.9; Sabrowski 19.8; Enright 19.8 | Hill 2.7; Lee 6.1; Milner 6.6 | +2.15 | +2.84 | -0.69 | -4.99 | -0.94 |
| arm_angle | Estrada 66.3; Vesia 64.8; Blalock 62.4 | Milner -6; Anderson 3.8; Herget 4.7 | +2.54 | +2.70 | -0.16 | -3.81 | -0.36 |
| release_height | Verlander 7.1; Fairbanks 7; Pivetta 6.78 | Milner 4.17; Anderson 4.34; Schreiber 4.53 | +2.99 | +2.70 | +0.29 | -3.63 | -0.34 |
| p_k_pct | Skubal 32.2; Crochet 31.3; Cease 29.8 | Parker 14.2; Pallante 15.5; Irvin 15.8 | +2.08 | +2.08 | +0.00 | -1.92 | +0.10 |
| p_whiff_pct | Cease 33.4; Skubal 32.5; Luzardo 30.8 | Irvin 18.2; Severino 18.3; Hendricks 18.3 | +2.24 | +2.08 | +0.16 | -1.77 | +0.19 |

## Relationships the latent layer must get right (unfitted tests)

- bat_speed against squared_up_per_contact: r = -0.52 (n = 226)
- bat_speed against whiff_pct: r = +0.69 (n = 145)
- bat_speed against ev50: r = +0.86 (n = 225)
- weight against bat_speed: r = +0.53 (n = 226)
- height against bat_speed: r = +0.45 (n = 226)
- bat_speed against sprint_speed: r = +0.09 (n = 226)
- bat_speed against arm_overall: r = +0.18 (n = 199)
- height against k_pct: r = +0.30 (n = 145)
- swing_length against bat_speed: r = +0.58 (n = 226)
- attack_angle against fb_pct: r = +0.68 (n = 145)
- attack_angle against barrel_pct_bbe: r = +0.47 (n = 225)

## Hitter correlations

Pearson r across players (n in brackets); only |r| ≥ 0.25 shown, sorted by |r|.

- ev_avg ~ hard_hit_pct: r = +0.94 (251)
- bat_speed ~ hard_swing_rate: r = +0.93 (226)
- iz_contact_pct ~ whiff_pct: r = -0.92 (145)
- blast_per_contact ~ hard_hit_pct: r = +0.91 (225)
- k_pct ~ whiff_pct: r = +0.88 (145)
- blast_per_contact ~ ev_avg: r = +0.88 (225)
- sprint_speed ~ hp_to_1b: r = -0.88 (513)
- k_pct ~ iz_contact_pct: r = -0.85 (145)
- la_avg ~ fb_pct: r = +0.84 (145)
- hard_swing_rate ~ ev_max: r = +0.83 (225)
- barrel_pct_bbe ~ hard_hit_pct: r = +0.82 (251)
- bat_speed ~ ev_max: r = +0.81 (225)
- ev_avg ~ barrel_pct_bbe: r = +0.79 (251)
- bat_speed ~ blast_per_contact: r = +0.79 (226)
- blast_per_contact ~ ev_max: r = +0.77 (225)
- bat_speed ~ hard_hit_pct: r = +0.77 (225)
- barrel_pct_bbe ~ xwoba: r = +0.74 (145)
- bb_pct ~ chase_pct: r = -0.73 (145)
- blast_per_contact ~ barrel_pct_bbe: r = +0.73 (225)
- barrel_pct_bbe ~ iz_contact_pct: r = -0.73 (145)
- barrel_pct_bbe ~ whiff_pct: r = +0.72 (145)
- ev_max ~ hard_hit_pct: r = +0.71 (251)
- bat_speed ~ ev_avg: r = +0.71 (225)
- hard_swing_rate ~ blast_per_contact: r = +0.70 (226)
- ev_avg ~ ev_max: r = +0.70 (251)
- ev_max ~ barrel_pct_bbe: r = +0.70 (251)
- bat_speed ~ barrel_pct_bbe: r = +0.70 (225)
- bat_speed ~ whiff_pct: r = +0.69 (145)
- hard_hit_pct ~ whiff_pct: r = +0.68 (145)
- attack_angle ~ fb_pct: r = +0.68 (145)
- ev_avg ~ xwoba: r = +0.68 (145)
- hard_hit_pct ~ iz_contact_pct: r = -0.67 (145)
- hard_swing_rate ~ hard_hit_pct: r = +0.66 (225)
- hard_swing_rate ~ barrel_pct_bbe: r = +0.66 (225)
- attack_angle ~ pull_pct: r = +0.66 (145)
- blast_per_contact ~ xwoba: r = +0.65 (145)
- squared_up_per_contact ~ k_pct: r = -0.65 (145)
- hard_swing_rate ~ ev_avg: r = +0.65 (225)
- hard_hit_pct ~ xwoba: r = +0.65 (145)
- barrel_pct_bbe ~ k_pct: r = +0.64 (145)
- bat_speed ~ iz_contact_pct: r = -0.63 (145)
- la_avg ~ pull_pct: r = +0.62 (145)
- height ~ weight: r = +0.62 (579)
- ev_max ~ whiff_pct: r = +0.61 (145)
- hard_hit_pct ~ k_pct: r = +0.60 (145)
- ev_avg ~ whiff_pct: r = +0.59 (145)
- ev_avg ~ iz_contact_pct: r = -0.59 (145)
- bb_pct ~ xwoba: r = +0.59 (145)
- squared_up_per_contact ~ iz_contact_pct: r = +0.58 (145)
- bat_speed ~ swing_length: r = +0.58 (226)
- hard_swing_rate ~ whiff_pct: r = +0.58 (145)
- squared_up_per_contact ~ whiff_pct: r = -0.58 (145)
- bat_speed ~ k_pct: r = +0.58 (145)
- barrel_pct_bbe ~ fb_pct: r = +0.58 (145)
- attack_angle ~ la_avg: r = +0.58 (225)
- ev_max ~ iz_contact_pct: r = -0.57 (145)
- weight ~ power_proxy_per_kg: r = -0.56 (226)
- pull_pct ~ fb_pct: r = +0.55 (145)
- weight ~ hard_hit_pct: r = +0.55 (251)
- hard_swing_rate ~ iz_contact_pct: r = -0.55 (145)
- blast_per_contact ~ whiff_pct: r = +0.54 (145)
- weight ~ ev_max: r = +0.54 (251)
- ev_max ~ xwoba: r = +0.54 (145)
- weight ~ hard_swing_rate: r = +0.53 (226)
- attack_angle ~ whiff_pct: r = +0.53 (145)
- hard_swing_rate ~ xwoba: r = +0.53 (145)
- weight ~ bat_speed: r = +0.53 (226)
- sprint_speed ~ jump_burst: r = +0.52 (92)
- bat_speed ~ squared_up_per_contact: r = -0.52 (226)
- weight ~ ev_avg: r = +0.52 (251)
- weight ~ xwoba: r = +0.51 (145)
- swing_length ~ whiff_pct: r = +0.51 (145)
- weight ~ barrel_pct_bbe: r = +0.51 (251)
- ev_avg ~ k_pct: r = +0.50 (145)
- weight ~ blast_per_contact: r = +0.50 (226)
- attack_angle ~ iz_contact_pct: r = -0.49 (145)
- bat_speed ~ xwoba: r = +0.49 (145)
- blast_per_contact ~ iz_contact_pct: r = -0.49 (145)
- power_proxy_per_kg ~ hp_to_1b: r = -0.48 (226)
- swing_length ~ hard_swing_rate: r = +0.48 (226)
- hard_swing_rate ~ squared_up_per_contact: r = -0.48 (226)
- attack_angle ~ barrel_pct_bbe: r = +0.47 (225)
- attack_angle ~ k_pct: r = +0.47 (145)
- swing_length ~ iz_contact_pct: r = -0.47 (145)
- height ~ ev_max: r = +0.47 (251)
- power_proxy_per_kg ~ sprint_speed: r = +0.46 (226)
- hard_swing_rate ~ k_pct: r = +0.46 (145)
- height ~ hard_swing_rate: r = +0.46 (226)
- attack_angle ~ ideal_attack_angle_rate: r = +0.46 (226)
- height ~ ev_avg: r = +0.46 (251)
- hp_to_1b ~ jump_burst: r = -0.46 (92)
- jump_reaction ~ jump_burst: r = +0.45 (92)
- ev_max ~ k_pct: r = +0.45 (145)
- weight ~ hp_to_1b: r = +0.45 (513)
- height ~ bat_speed: r = +0.45 (226)
- height ~ hard_hit_pct: r = +0.44 (251)
- height ~ barrel_pct_bbe: r = +0.43 (251)
- swing_length ~ ev_max: r = +0.42 (225)
- ideal_attack_angle_rate ~ pull_pct: r = +0.41 (145)
- height ~ blast_per_contact: r = +0.40 (226)
- swing_length ~ barrel_pct_bbe: r = +0.40 (225)
- chase_pct ~ jump_burst: r = +0.40 (40)
- iz_contact_pct ~ fb_pct: r = -0.40 (145)
- swing_length ~ hard_hit_pct: r = +0.39 (225)
- blast_per_contact ~ k_pct: r = +0.39 (145)
- swing_length ~ blast_per_contact: r = +0.39 (226)
- swing_length ~ squared_up_per_contact: r = -0.39 (226)
- height ~ whiff_pct: r = +0.38 (145)
- whiff_pct ~ fb_pct: r = +0.38 (145)
- barrel_pct_bbe ~ bb_pct: r = +0.38 (145)
- weight ~ sprint_speed: r = -0.37 (579)
- sprint_speed ~ arm_overall: r = +0.37 (395)
- swing_length ~ k_pct: r = +0.36 (145)
- k_pct ~ fb_pct: r = +0.36 (145)
- swing_length ~ fb_pct: r = +0.36 (145)
- ev_avg ~ bb_pct: r = +0.36 (145)
- weight ~ swing_length: r = +0.36 (226)
- chase_pct ~ jump_reaction: r = +0.35 (40)
- swing_tilt ~ ideal_attack_angle_rate: r = -0.35 (226)
- ideal_attack_angle_rate ~ la_avg: r = +0.35 (225)
- ideal_attack_angle_rate ~ fb_pct: r = +0.35 (145)
- swing_length ~ pull_pct: r = +0.34 (145)
- height ~ iz_contact_pct: r = -0.34 (145)
- fb_pct ~ xwoba: r = +0.34 (145)
- hp_to_1b ~ arm_overall: r = -0.34 (386)
- height ~ xwoba: r = +0.34 (145)
- iz_contact_pct ~ xwoba: r = -0.34 (145)
- weight ~ iz_contact_pct: r = -0.33 (145)
- weight ~ whiff_pct: r = +0.33 (145)
- barrel_pct_bbe ~ pull_pct: r = +0.33 (145)
- swing_length ~ ev_avg: r = +0.33 (225)
- age ~ hp_to_1b: r = +0.32 (513)
- swing_tilt ~ fb_pct: r = +0.32 (145)
- hard_hit_pct ~ bb_pct: r = +0.32 (145)
- attack_angle ~ swing_tilt: r = +0.31 (226)
- swing_length ~ xwoba: r = +0.31 (145)
- bb_pct ~ iz_contact_pct: r = -0.31 (145)
- weight ~ bb_pct: r = +0.30 (145)
- bat_speed ~ power_proxy_per_kg: r = +0.30 (226)
- la_avg ~ barrel_pct_bbe: r = +0.30 (251)
- height ~ k_pct: r = +0.30 (145)
- age ~ sprint_speed: r = -0.29 (579)
- swing_length ~ attack_angle: r = +0.29 (226)
- hp_to_1b ~ xwoba: r = +0.29 (145)
- power_proxy_per_kg ~ arm_overall: r = +0.29 (199)
- bb_pct ~ fb_pct: r = +0.29 (145)
- squared_up_per_contact ~ ev_max: r = -0.28 (225)
- hard_hit_pct ~ jump_burst: r = -0.28 (78)
- chase_pct ~ xwoba: r = -0.28 (145)
- whiff_pct ~ pull_pct: r = +0.28 (145)
- bb_pct ~ jump_burst: r = -0.28 (40)
- hard_swing_rate ~ power_proxy_per_kg: r = +0.28 (226)
- height ~ swing_length: r = +0.27 (226)
- whiff_pct ~ xwoba: r = +0.27 (145)
- height ~ swing_tilt: r = +0.27 (226)
- barrel_pct_bbe ~ jump_burst: r = -0.26 (78)
- squared_up_per_contact ~ barrel_pct_bbe: r = -0.26 (225)
- sprint_speed ~ xwoba: r = -0.25 (145)
- ev_avg ~ fb_pct: r = +0.25 (145)
- power_proxy_per_kg ~ jump_reaction: r = +0.25 (69)
- weight ~ jump_reaction: r = -0.25 (92)

## Pitcher correlations

Pearson r across players (n in brackets); only |r| ≥ 0.25 shown, sorted by |r|.

- p_k_pct ~ p_whiff_pct: r = +0.90 (52)
- arm_angle ~ release_height: r = +0.76 (287)
- ff_ivb ~ arm_angle: r = +0.71 (264)
- ff_velo ~ p_whiff_pct: r = +0.56 (51)
- ff_ivb ~ release_height: r = +0.52 (264)
- ff_velo ~ p_k_pct: r = +0.52 (51)
- height ~ weight: r = +0.46 (773)
- p_bb_pct ~ p_chase_pct: r = -0.45 (52)
- p_whiff_pct ~ p_chase_pct: r = +0.42 (52)
- p_k_pct ~ p_chase_pct: r = +0.39 (52)
- ff_spin ~ p_k_pct: r = +0.36 (51)
- ff_spin ~ p_whiff_pct: r = +0.36 (51)
- age ~ ff_velo: r = -0.33 (726)
- p_bb_pct ~ p_ev_avg: r = +0.31 (52)
- p_k_pct ~ p_ev_avg: r = -0.30 (52)
- ff_spin ~ ff_ivb: r = +0.30 (438)
- ff_velo ~ ff_spin: r = +0.27 (726)
- p_chase_pct ~ p_ev_avg: r = -0.27 (52)

## The running game, from the data

- pitch tempo with the bases empty (median, s) is above; the CSV export repeats that value in its men-on column, so the hold (delivery with a runner on) is NOT available from this board
- base stealers' leads: primary and secondary, overall and on attempts (ft), attempt rate per opportunity and success fraction: above
- catchers: pop time to second, exchange time, max-effort arm (mph): above

## What a foul is (pitch level, 2025, 42 days)

Every pitch of 552 regular-season games over three two-week spans (May, early July before the break, September): 165,166 pitches, 78,837 swings. Squared up is Statcast's rule applied pitch by pitch, launch_speed ≥ 0.80 × (1.23 × bat_speed + 0.23 × effective_speed). The tables below were written by `statcast/fouls.py`; this paragraph was written by hand and is not rewritten by the script.

What the data showed, on these dates:

1. **Fouls were half of contact:** .521 of 60,571 contacts (fastballs .548, breaking .489, off-speed .472). The share barely moved with the count: .52 at 0, 1 and 2 strikes. Whiffs were .232 per swing.
2. **Fouls were weaker than balls in play, but they were not "almost never squared up".** Of 25,278 tracked fouls, .225 were squared up. The floor is .184 if every untracked foul and foul tip counts as not squared (n 30,917). Balls in play were .627 (n 27,565). Foul exit speed was a median 76.6 mph (mean 76.7, sd 13.1), against 92.0 for balls in play. 64% of fouls were under 80 mph and 14% were at 90 or more. The ~.05 per foul in CALIBRATION.md v0.8 was an inference, and it was wrong by a factor of four.
3. **Squared-up per contact was .435 by the rule above (n 52,843 tracked), or .392 as a floor, not .337.** The leaderboard's .337 (`squared_up_per_bat_contact`, qualified batters) was not reproduced by any simple variant tried on the same 226 batters in these games. Their mean was .43-.44 on tracked contact, .38-.39 with untracked contact counted as not squared, and .29-.31 counting only squared-up balls in play (each with and without a competitive-swing filter). The per-batter correlation with the leaderboard was r = .69-.75. The leaderboard counts competitive swings and its own tracked contact, so a model that applies the formula to every contact should be held to .39-.44, not .34.
4. **So fouls were not the bulk of the model's contact gap.** Against CALIBRATION v0.8's power_chain (squared-up per foul about .62 on 43% of contact; per ball in play .835 on 57%), the league's fouls contributed .521 × .225 = .12 squared-up per contact, against the model's .27. Balls in play contributed .479 × .627 = .30, against the model's .48. Fair contact (about .18) accounted for at least as much of the gap as fouls (about .15). The fouls are too solid, and so are balls in play.
5. **Contact depth decided fouls.** `intercept_ball_minus_batter_pos_y_inches` measured how far in front of the batter the ball was met (mean 29 in, sd 9.6). At 30-40 in, .425 of contact went foul and .490 was squared up. Deep, late contact (10-20 in) went foul .706 of the time. Far out front (40-50 in) it went foul .607 of the time, and beyond 50 in .780 with only .215 squared up. Reach from the batter (`..._x_inches`, mean 36.5 in) showed the same falling-off at both ends. Attack angle mattered at the extremes: .65-.68 foul below 0° and above 20°, .43 at 5-15°. Swing-path tilt barely mattered.
6. **Fouls were lofted or topped.** The launch angle of tracked fouls had median 31° and p75 51°. 26% of fouls were above 50°, and those averaged 75.9 mph. In-zone contact went foul .500 of the time, out-of-zone .599. Whiffs per swing were .150 in the zone and .430 out of it, with breaking balls out of the zone at .556.
7. **Tracking:** 81.7% of fouls carried a launch speed. Foul tips (5.5% of fouls) never did, and the rest did 86.5% of the time. 98% of fouls carried a bat speed, and 99.7% of balls in play carried a launch speed. Untracked fouls were slightly more often out of the zone (.32 against .23) and off-speed (.14 against .12), with bat speed 67.3 against 69.9 mph, so they were probably a little weaker than tracked ones. Hence the floor. No foul carried hit coordinates, so direction could not be measured.

<!-- fouls.py tables: begin -->

Dates (42 days with games): 2025-05-05..05-18, 2025-06-30..07-13, 2025-09-08..09-21. Pulled by `statcast/fetch_pitches.py`, measured by `statcast/fouls.py`; every rate is a share of the n beside it.

Columns absent from the CSV: none.

Pitches 165166; swings 78837 (whiff 18266, foul 31562, in play 29009). Foul kinds: bunt_foul_tip 7, foul 29530, foul_bunt 297, foul_tip 1728.

Squared-up used effective_speed for 52807 tracked contacts and release_speed for 36.

### 1. What a swing becomes

| swings | whiff | foul | in play | foul / contact | n swings |
|---|---|---|---|---|---|
| all | 0.232 | 0.400 | 0.368 | 0.521 | 78837 |
| fastball | 0.172 | 0.454 | 0.374 | 0.548 | 43154 |
| breaking | 0.308 | 0.339 | 0.353 | 0.489 | 23868 |
| offspeed | 0.299 | 0.331 | 0.370 | 0.472 | 11583 |
| 0 strikes | 0.237 | 0.398 | 0.365 | 0.522 | 22667 |
| 1 strikes | 0.237 | 0.394 | 0.369 | 0.516 | 26478 |
| 2 strikes | 0.223 | 0.408 | 0.369 | 0.525 | 29692 |

### 2. How much is tracked

|  | n | has launch_speed | has launch_angle | has bat_speed | has both (squared-up computable) |
|---|---|---|---|---|---|
| fouls | 31562 | 0.817 | 0.819 | 0.980 | 0.801 |
| fouls excl. foul_tip | 29834 | 0.865 | 0.867 | 0.979 | 0.847 |
| foul tips | 1728 | 0.000 | 0.000 | 0.987 | 0.000 |
| in play | 29009 | 0.997 | 0.997 | 0.953 | 0.950 |
| whiffs | 18266 | 0.000 | 0.000 | 0.986 | 0.000 |

Fouls with and without a launch_speed, by what can be seen of them (shares of each group):

|  | n | 0 str | 1 str | 2 str | fastball | breaking | off-speed | in zone | foul tip | plate_z mean (ft) | |plate_x| mean (ft) | bat speed mean |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fouls with launch_speed | 25798 | 0.282 | 0.331 | 0.387 | 0.628 | 0.253 | 0.117 | 0.768 | 0.000 | 2.524 | 0.452 | 69.9 |
| fouls without | 5764 | 0.303 | 0.329 | 0.368 | 0.585 | 0.271 | 0.142 | 0.681 | 0.300 | 2.424 | 0.482 | 67.3 |

### 3. Squared up (tracked contact only)

|  | per contact | n | per ball in play | n | per foul | n | per contact, release_speed |
|---|---|---|---|---|---|---|---|
| all | 0.435 | 52843 | 0.627 | 27565 | 0.225 | 25278 | 0.436 |
| fastball | 0.429 | 31209 | 0.654 | 15340 | 0.212 | 15869 | 0.430 |
| breaking | 0.452 | 14438 | 0.607 | 8031 | 0.257 | 6407 | 0.453 |
| offspeed | 0.421 | 7000 | 0.565 | 4069 | 0.222 | 2931 | 0.422 |

The same with every swing that has a bat speed but no launch speed counted as not squared up (a floor):

| per | squared up | n with bat_speed |
|---|---|---|
| contact | 0.392 | 58576 |
| ball in play | 0.625 | 27659 |
| foul | 0.184 | 30917 |
| swing | 0.300 | 76589 |

### 4. How hard (launch_speed, mph)

|  | n | mean | sd | p10 | p25 | p50 | p75 | p90 | <60 | <70 | <80 | <90 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fouls | 25798 | 76.7 | 13.1 | 62.5 | 70.3 | 76.6 | 83.7 | 93.0 | 0.076 | 0.240 | 0.640 | 0.862 |
| in play | 28914 | 88.9 | 15.2 | 68.8 | 80.4 | 92.0 | 100.3 | 105.2 | 0.048 | 0.111 | 0.243 | 0.447 |

Launch angle (deg):

|  | n | mean | sd | p10 | p25 | p50 | p75 | p90 |
|---|---|---|---|---|---|---|---|---|
| fouls | 25858 | 23.2 | 35.8 | -33.0 | 0.0 | 31.0 | 51.0 | 64.0 |
| in play | 28936 | 13.1 | 28.7 | -22.0 | -5.0 | 14.0 | 31.0 | 50.0 |

### 5. Where fouls go

Fouls carrying hit coordinates (hc_x, hc_y): 0.000 of 31562. Too few to say anything about direction; stopped here.

### 6. Exit velocity by launch angle, balls in play

| launch angle | n | mean EV | sd |
|---|---|---|---|
| <-30 | 1887 | 66.8 | 17.2 |
| -30..-10 | 3537 | 86.3 | 15.3 |
| -10..10 | 7239 | 92.6 | 13.7 |
| 10..30 | 8348 | 93.7 | 12.8 |
| 30..50 | 4947 | 89.4 | 12.8 |
| >50 | 2955 | 82.3 | 11.7 |

The same for fouls that carry a launch angle:

| launch angle | n | mean EV | sd |
|---|---|---|---|
| <-30 | 2861 | 67.6 | 15.5 |
| -30..-10 | 2692 | 78.6 | 15.6 |
| -10..10 | 1926 | 84.5 | 13.8 |
| 10..30 | 5088 | 80.0 | 12.7 |
| 30..50 | 6389 | 76.0 | 11.9 |
| >50 | 6842 | 75.9 | 9.1 |

### 7. By pitch kind and zone

| kind | zone | swings | whiff / swing | foul / contact | squared / contact | n tracked contact |
|---|---|---|---|---|---|---|
| all | in zone | 55853 | 0.150 | 0.500 | 0.459 | 42003 |
| all | out of zone | 22984 | 0.430 | 0.599 | 0.343 | 10840 |
| fastball | in zone | 33768 | 0.135 | 0.527 | 0.445 | 25809 |
| fastball | out of zone | 9386 | 0.306 | 0.641 | 0.355 | 5400 |
| breaking | in zone | 15117 | 0.165 | 0.460 | 0.486 | 11219 |
| breaking | out of zone | 8751 | 0.556 | 0.586 | 0.334 | 3219 |
| offspeed | in zone | 6822 | 0.194 | 0.450 | 0.468 | 4851 |
| offspeed | out of zone | 4761 | 0.451 | 0.519 | 0.317 | 2149 |

### 8. Contact point and swing plane (tracked contact)

`intercept_ball_minus_batter_pos_y_inches` over contact: n 58563, mean 29.0, sd 9.6, p10/p50/p90 17.0 / 28.8 / 41.5.

| band | n contact | foul / contact | squared / contact | n | mean EV | n | mean EV, fouls | n |
|---|---|---|---|---|---|---|---|---|
| <0 | 119 | 1.000 | 0.795 | 73 | 75.9 | 73 | 75.9 | 73 |
| 0..10 | 1306 | 0.892 | 0.617 | 1052 | 79.8 | 1052 | 80.0 | 918 |
| 10..20 | 8529 | 0.706 | 0.403 | 7408 | 79.9 | 7408 | 76.9 | 4919 |
| 20..30 | 22209 | 0.489 | 0.409 | 20292 | 82.6 | 20292 | 74.8 | 8975 |
| 30..40 | 18727 | 0.425 | 0.490 | 17227 | 86.1 | 17227 | 77.2 | 6472 |
| 40..50 | 6888 | 0.607 | 0.393 | 6118 | 81.6 | 6118 | 80.0 | 3426 |
| >50 | 785 | 0.780 | 0.215 | 662 | 71.6 | 662 | 73.6 | 491 |

`intercept_ball_minus_batter_pos_x_inches` over contact: n 58563, mean 36.5, sd 6.7, p10/p50/p90 27.8 / 36.5 / 45.2.

| band | n contact | foul / contact | squared / contact | n | mean EV | n | mean EV, fouls | n |
|---|---|---|---|---|---|---|---|---|
| <25 | 2496 | 0.671 | 0.325 | 2153 | 74.2 | 2153 | 76.3 | 1337 |
| 25..30 | 7643 | 0.578 | 0.375 | 6829 | 80.7 | 6829 | 77.7 | 3610 |
| 30..35 | 14087 | 0.525 | 0.454 | 12789 | 84.6 | 12789 | 77.8 | 6105 |
| 35..40 | 16337 | 0.501 | 0.485 | 14848 | 85.5 | 14848 | 76.8 | 6729 |
| 40..45 | 11891 | 0.508 | 0.458 | 10782 | 83.7 | 10782 | 76.3 | 4955 |
| >45 | 6109 | 0.524 | 0.327 | 5431 | 77.8 | 5431 | 73.0 | 2538 |

`attack_angle` over contact: n 58576, mean 7.8, sd 11.1, p10/p50/p90 -5.2 / 8.5 / 20.6.

| band | n contact | foul / contact | squared / contact | n | mean EV | n | mean EV, fouls | n |
|---|---|---|---|---|---|---|---|---|
| <0 | 12108 | 0.646 | 0.410 | 10763 | 79.3 | 10763 | 75.8 | 6523 |
| 0..5 | 9315 | 0.523 | 0.400 | 8538 | 82.5 | 8538 | 75.3 | 4107 |
| 5..10 | 11449 | 0.439 | 0.448 | 10596 | 84.6 | 10596 | 75.7 | 4186 |
| 10..15 | 10934 | 0.425 | 0.479 | 10045 | 85.7 | 10045 | 77.1 | 3774 |
| 15..20 | 8201 | 0.499 | 0.465 | 7376 | 85.0 | 7376 | 79.3 | 3272 |
| >20 | 6569 | 0.677 | 0.391 | 5525 | 80.8 | 5525 | 78.4 | 3416 |

`swing_path_tilt` over contact: n 58576, mean 32.1, sd 7.2, p10/p50/p90 23.3 / 32.1 / 41.0.

| band | n contact | foul / contact | squared / contact | n | mean EV | n | mean EV, fouls | n |
|---|---|---|---|---|---|---|---|---|
| <20 | 2389 | 0.523 | 0.500 | 2130 | 83.6 | 2130 | 78.1 | 995 |
| 20..25 | 6456 | 0.521 | 0.450 | 5827 | 83.5 | 5827 | 77.1 | 2742 |
| 25..30 | 13436 | 0.524 | 0.433 | 12238 | 83.4 | 12238 | 77.0 | 5866 |
| 30..35 | 16604 | 0.518 | 0.433 | 15084 | 83.4 | 15084 | 76.7 | 7104 |
| 35..40 | 12327 | 0.533 | 0.426 | 11101 | 83.0 | 11101 | 76.5 | 5366 |
| >40 | 7364 | 0.555 | 0.423 | 6463 | 81.2 | 6463 | 75.7 | 3205 |

<!-- fouls.py tables: end -->

## Swing geometry (pitch level, 2025, one week)

Every pitch of 2025-07-01..07-07 (27,876 pitches; 9,972 contacts with bat tracking), measured by `statcast/swing_geometry.py` (pull with `python3 statcast/fetch_pitches.py --dates 2025-07-01:2025-07-07`). These relations shaped bb_engine v0.9's swing (CALIBRATION.md, "The swing as a tilted circle"). This paragraph was written by hand.

What the data showed, on these dates:

1. **Contact met further out front turned the bat and raised its path.** Per inch of contact depth, the bat's direction of travel turned 1.46 deg (r .83) and its attack angle rose 0.80 deg (r .75). One circle of radius 0.87 m in a plane tilted at the league's swing tilt gives both within 11%.
2. **The ball's spray followed depth** (1.59 deg per inch, r .40, on all balls in play; fair balls went from -13.7 deg on contact met deep to +21.2 out front). At a given depth, what was left of the bat's direction barely moved the ball (r .09).
3. **Met deep, the bat was slower:** full swings ran 69.0 mph at 10-20 in of depth and 73.2 at 35-40.
4. **The swing plane was steeper for low pitches:** 9.4 deg per zone height, from 38.5 below the zone to 20.7 above it.
5. **Contact struck square vertically was squared up only .695 of the time,** and less on pitches inside (.27 beyond a foot) or away (.44).
6. **The vertical miss ran from under the ball to over it as contact moved out front:** +17.8 to +22.9 deg below 20 in of depth, -10.7 at 40-50 in, -24.3 beyond 50.

```
pitches 27876 (2025-07-01:2025-07-07)

1. CONTACT DEPTH (in in front of the batter): contacts 9972, mean 29.1, sd 9.7
   attack angle (deg)                         mean   8.23 sd 10.39 | per inch of depth +0.797 (r 0.75), n 9972
   bat speed (mph)                            mean  70.62 sd  7.38 | per inch of depth +0.280 (r 0.37), n 9972
   attack direction (deg, sign as recorded)   mean   0.99 sd 17.00 | per inch of depth -1.457 (r -0.83), n 9972
   swing path tilt (deg)                      mean  32.01 sd  6.90 | per inch of depth +0.048 (r 0.07), n 9972
   full swings (60+ mph) by depth: n, bat speed, attack angle, vertical miss mean, its sd
     -20..10     145   66.5    -9.5   +17.8   28.2
      10..20    1251   69.0    -2.0   +22.9   26.6
      20..25    1635   70.5    +3.3   +19.2   30.1
      25..30    2008   71.8    +7.4   +15.0   33.2
      30..35    1834   72.8   +11.7    +7.8   35.1
      35..40    1286   73.2   +15.7    +0.6   35.0
      40..50    1166   73.4   +19.3   -10.7   36.1
      50..90     154   73.0   +23.6   -24.3   37.1
   batters with 25+ contacts: 204; within-batter sd 9.0 in; between-batter sd of usual depth 3.5 in
   depth against pitch location: -1.89 in per ft away (r -0.10)

2. SWING TILT AGAINST PITCH HEIGHT (all swings with a tilt)
   swings 13034: mean 32.2 sd 6.9; per unit of zone height -9.4 deg (r -0.55)
     height -9.00..-0.25 n   667  tilt 38.5
     height -0.25..0.15  n  2537  tilt 36.3
     height  0.15..0.50  n  4137  tilt 33.6
     height  0.50..0.85  n  3800  tilt 30.3
     height  0.85..1.25  n  1735  tilt 25.8
     height  1.25..9.00  n   158  tilt 20.7

3. BAT SPEED BY STRIKES (full swings, 60+ mph)
   0 strikes: n  3577  mean 72.6
   1 strikes: n  4094  mean 72.0
   2 strikes: n  4452  mean 70.7

4. SQUARED UP AND EXIT SPEED AGAINST THE VERTICAL MISS (launch angle minus attack angle): tracked contacts 8989, miss mean 10.0 sd 34.7
     band       n   share  squared  EV/max   foul
      -90..-60    265  0.029   0.098   0.601   0.657
      -60..-40    647  0.072   0.190   0.687   0.743
      -40..-25    605  0.067   0.426   0.764   0.445
      -25..-15    549  0.061   0.614   0.813   0.213
      -15..-5     721  0.080   0.663   0.837   0.190
       -5..5      837  0.093   0.695   0.848   0.211
        5..15    1045  0.116   0.626   0.835   0.292
       15..25     967  0.108   0.594   0.808   0.334
       25..40    1294  0.144   0.425   0.768   0.520
       40..60    1634  0.182   0.169   0.721   0.780
       60..90     404  0.045   0.067   0.692   0.777

5. CONTACT STRUCK SQUARE VERTICALLY (miss within 15 deg of +10), BY PITCH LOCATION: n 2849
     away  -9.0..-1.0  ft  n   66  EV/max 0.725  squared 0.273
     away  -1.0..-0.5  ft  n  405  EV/max 0.796  squared 0.523
     away  -0.5..0.0   ft  n  874  EV/max 0.843  squared 0.684
     away   0.0..0.5   ft  n  935  EV/max 0.848  squared 0.692
     away   0.5..1.0   ft  n  479  EV/max 0.827  squared 0.616
     away   1.0..9.0   ft  n   90  EV/max 0.761  squared 0.444

6. SPRAY OF FAIR BALLS (+ = pulled): n 4484, mean +6.1, sd 24.9
     depth -20..22  n  671  spray -13.7  sd 21.4
     depth  22..28  n 1161  spray  -2.5  sd 22.6
     depth  28..34  n 1284  spray +10.3  sd 22.3
     depth  34..40  n  783  spray +19.9  sd 20.2
     depth  40..90  n  420  spray +21.2  sd 21.4
   all balls in play (caught fouls included): spray per inch of depth +1.59 (r 0.40)
   spray against pitch location: -7.9 deg per ft away (r -0.13)
```
