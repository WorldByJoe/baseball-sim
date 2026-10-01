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
