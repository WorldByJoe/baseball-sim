## Fouls and far chases without their costs; reaching contact (engines v3.2-v3.4 built and taken back out; 2026-10-05)

The brief (`docs/briefs/2026-10-05_fouls_chases_costs.md`) asked for three things in order: FL, #31's v3.2 fouls without its BABIP cost; KB, #31's v3.3 far chases without its strikeout overshoot; RE's second half, whether reaching costs the contact's quality. Worked on the Mac on branch `fouls-chases-costs` from `dh-everywhere` (engine v3.1). Runs: the league's pitch-level data (42 days of 2025, tracked contact with bat 50+ mph unless noted), measured with new scripts that have model twins (`tools/diag/fl_*`, `aa_*`, `re_*`, `vmh_*`, `kbcurve.js`, `foldscore.js`); scratch engines with each candidate as a knob (`diag_out/scratch/`); for each engine built, the refit chain (`tools/diag/chain.sh`) and the suite (three seeds of 200 games, `compare.py` against the shared baseline `base_dh`). Three engine versions were built and suited: v3.2 (#31's last look, carried by hand), v3.3 (FL on top of it) and v3.4 (#31's DEC_UNSEEN on v3.1). Each moved its target and broke two or more other lines, so each is committed with its chain values for the record and then taken back out: **the engine at the end of the branch is v3.1, unchanged.** Results below are scoped to these runs.

### 1. FL: where the folded contact lands

**What #31 suspected, tested first: refuted for fastballs.** #31 thought v3.2's under-the-ball contact came down fair as pop-ups where the league's goes back foul. Fastball pop-ups in play (50+ deg) per tracked contact were .054 in the league, .043 in v3.1 and .051 in v3.2: v3.2's fastballs popped up no more than the league's. The extra pop-ups were breaking balls (below).

**The league's fouls are grazes.** A third of the league's tracked fastball contact (.327; .245 over all kinds) was a foul at 10-70 deg whose exit speed followed the pitch's speed and not the bat's: fitted on both, exit speed = 14.9 + 0.655 x pitch speed + 0.006 x bat speed (balls in play: 19.0 + 0.049 x pitch + 0.943 x bat). They left at .817 of the release speed (sd .054); fouls at 10-70 deg piled up at .75-.85 of it (.212 of all fastball contact in those two bins). By launch angle and exit speed, the league's contact at 70-80 mph and 10-70 deg was 7,255 balls (24% of fastball contact), 84-91% of them foul: a ball that barely touched the bat and went on back. v3.2's grazes were .181 of fastball contact (.146 over all kinds), spread from .60 to .95 of the release speed with the most at .60-.70: on the collision's own curve (a 95-mph fastball, a 70-mph square swing, the offset stepped 0.05 in), with the low-speed friction of 0.5 a near-miss 2.2-2.6 in under the ball's centre came off at 62-73 mph, the friction dragging it forward with the bat; with 0.15 at 83-90 mph.

| exit speed / release speed, fouls at 10-70 deg, share of fastball contact | .60-.70 | .70-.75 | .75-.80 | .80-.85 | .85-.90 | .90-.95 | grazes |
|---|---|---|---|---|---|---|---|
| league | .018 | .035 | .091 | .121 | .052 | .029 | .327 at .817 |
| v3.2 (friction 0.5, last look 1 in) | .069 | .042 | .036 | .037 | .035 | .031 | .181 |
| friction 0.25 (scratch on v3.2) | .021 | .029 | .051 | .077 | .050 | .033 | .241 |
| friction 0.15 (scratch on v3.2) | .012 | .012 | .025 | .049 | .088 | .064 | .237 |

**Where v3.2's BABIP cost came from: the breaking balls.** By pitch kind (all tracked contact, bat 50+ mph):

| | attack | launch minus attack | launch | launch in play | foul share of contact | pop-ups in play per contact | in play GB / LD / FB / PU % |
|---|---|---|---|---|---|---|---|
| league fastballs | 5.5 | 18.1 | 23.6 | 14.8 | .506 | .054 | 42 / 22 / 25 / 11 |
| v3.2 fastballs | 6.7 | 12.7 | 19.4 | 12.8 | .474 | .051 | 44 / 20 / 27 / 10 |
| league breaking | 11.6 | 1.1 | 12.7 | 14.0 | .442 | .058 | 42 / 22 / 25 / 10 |
| v3.1 breaking | 15.9 | -6.2 | 9.7 | 16.0 | .565 | .052 | 41 / 20 / 27 / 12 |
| v3.2 breaking | 17.1 | 0.9 | 18.0 | 21.1 | .560 | .076 | 34 / 19 / 30 / 17 |
| league off-speed | 12.5 | -4.8 | 7.7 | 9.1 | .416 | .049 | 50 / 22 / 19 / 8 |
| v3.2 off-speed | 14.2 | 1.3 | 15.6 | 18.8 | .513 | .069 | 37 / 19 / 29 / 14 |

v3.2's aim under the ball (1.0 in for every kind) brought the breaking balls' launch minus attack to the league's (0.9 against 1.1); in v3.1 the breaking balls had been topped (-6.2), which hid a bat path 4-5 deg too steep. Unmasked, it launched them 5 deg too high (in play 21 against 14), and they were fouled too often by spray, so what stayed fair was the under-struck part. Both come from where breaking balls are met:

| about each hitter's mean depth (in) | FF | SI | FC | SL | ST | CU | CH | FS |
|---|---|---|---|---|---|---|---|---|
| league | -4.2 | -4.0 | +0.4 | +4.0 | +5.6 | +6.6 | +4.8 | +5.1 |
| model (v3.2) | -4.2 | -3.5 | 0.0 | +5.2 | +6.8 | +9.4 | +4.0 | +5.1 |
| league attack (deg) | 5.2 | 4.5 | 9.0 | 11.2 | 12.3 | 13.1 | 12.8 | 13.1 |
| model attack | 6.0 | 6.6 | 10.2 | 15.2 | 17.0 | 19.6 | 14.1 | 15.1 |

The league's contact depth rose about 1 in per mph of speed below the fastball up to about 9 mph and then flattened (curveballs, 15 mph slower, met 10.8 in further out front than four-seamers); the model's kept rising at 1 in per mph (13.6 in). And across pitch types the league's attack rose only 0.73-0.84 deg per inch of depth (within fastballs 0.97), the model's 1.0 everywhere. The bat's direction on breaking-ball contact pointed +10.2 deg to the pull side against the league's +5.7 (fastballs -5.5 against -5.6). So contact struck square vertically (launch minus attack -15 to +15) went foul .464 of the time on breaking balls against the league's .234, and .362 on off-speed against .206, nearly all pulled foul; on fastballs .231 against .226. The brief's "square contact fouled by spray .31 against .21" is the breaking and off-speed pitches. With the fouls at the bottom of the vertical spread removed, the breaking balls left in play were the high ones.

**Built: v3.2 carried over, then v3.3 (FL).** v3.2 as #31 built it (LOOK_GAIN 1.3, LOOK_SD 1 in, raw barrel scatter x1.7, aim under the ball 1.0 in, VERT_MISS 0.09, SWING_R 0.82 m, pullBias -0.4; fit_population v0.7). v3.3 added the two things the grazes measure: the ball-bat friction 0.27 (was 0.5), fitted to the grazes' speed (0.2 gave .84 of the release speed, 0.25 .82, 0.3 .81; league .817; Cross & Nathan 2006 measured at least 0.50 at 4 m/s, Nathan et al. 2012 about 0.15 at game speed beyond 40 deg of incidence; square contact rolls on the bat under either cap); and the last look's error 0.5 in (was 1 in), fitted to the grazes' share of contact, with the raw barrel scatter x1.15 to keep the fastball whiffs (in a scratch engine on chained v3.2: 1 in gave grazes .233 of fastball contact and whiffs .173; 0.5 in x1.15 .303 and .170; 0.3 in .318 and .152). At 1 in, the correction had scattered the folded swings back across the barrel, many of them square; at 0.5 they stop at the edge of the ball.

| (seeds 3 / 11 / 29) | base_dh (v3.1) | v3.2 | v3.3 | league |
|---|---|---|---|---|
| fastball fouls per swing | .327 | .389 | .446 | .451 |
| fastball whiffs per swing | .162 | .169 | .168 | .174 |
| K% | 19.5 / 19.1 / 18.7 | 19.9 / 19.8 / 20.2 | 22.3 / 22.3 / 23.0 | 22.2 |
| BB% | 8.6 / 9.5 / 9.4 | 9.7 / 10.3 / 10.0 | 10.2 / 10.2 / 10.4 | 8.4 |
| BABIP | .268 / .263 / .267 | .242 / .242 / .234 | .227 / .224 / .232 | .291 |
| runs / team-game | 4.37 / 4.50 / 4.39 | 4.00 / 4.07 / 3.99 | 3.45 / 3.38 / 3.42 | 4.45 |
| AVG | .240 / .238 / .240 | .219 / .217 / .213 | .199 / .195 / .198 | .245 |
| pitches / team-game | 139 / 139 / 141 | 141 / 143 / 144 | 147 / 147 / 147 | 146 |
| in play GB / LD / FB / PU % | 45 / 20-21 / 25 / 9-10 | 39-41 / 18 / 27-28 / 14-15 | 40-41 / 17 / 26-27 / 16 | 43 / 24 / 24 / 9 |
| chase | .225 | .234 | .244 | .283 |
| breaking balls chased 6-9 / 9-12 in below the zone | .16 / .09 | .17 / .11 | .19 / .10 | .36 / .28 |
| contact score (90 targets) | .0630 | .0576 | .0601 | |

v3.3 brought the fastball fouls, strikeouts and pitches to the league's, and the squared-up panel of the contact score from .060 to .021; on the worst seed (29) runs fell from 4.39 to 3.42 and BABIP from .267 to .232. With the breaking-ball contact as it is, every extra foul is a breaking ball pulled foul or a fastball graze, and what reaches the field is lofted: by kind in chained v3.3, breaking balls were fouled .620 of contact (league .442) and 20% of those in play were pop-ups (league 10%); fastball liners were 16% of fastballs in play (22). Recorded, not kept.

**Tried and not built (scratch engines).**
- The breaking balls' attack lowered by hand (5 deg): their launch did not fall (18.0 to 19.8): the vertical offset's timing term uses the planned path, so a flatter path put the barrel further under an out-front ball. Not a mechanism; it located the problem in the bat's path at the contact point, not in the aim.
- RESID_S 0.07-0.10 with the aim re-raised: the breaking balls' launch came to the league's only with their launch minus attack 7-10 deg below it (the fastball-to-breaking gap by height 11-20 deg against 7-9). One aim cannot fit both kinds while the breaking balls' path is 5 deg too steep.
- A lower aim with the sharper last look (0.7 in, 0.4 in): pop-ups per contact .051 and .044, but fastball launch in play 8.5 and 7.7 deg against the league's 14.8: the aim was measured from the fastballs.
- The timing of slow pitches flattening (a soft cap on the prior's pull on timing, tanh with 18 ms): measured from the depth by pitch type above, and it reproduced it (curveballs +8.9 to +6.3 in, sweepers +6.7 to +5.3; league +6.6, +5.6); on v3.1 breaking balls were fouled .565 to .521 and popped up .052 to .042 per contact (in play 45 / 21 / 24 / 9 against the league's 42 / 22 / 25 / 10), but strikeouts per plate appearance fell .195 to .179 (fewer fouls and whiffs). On v3.3 it took the breaking balls' fouls from .620 to .571 and left the pop-ups. Not built alone (it would take two points of K from a model already short); it is half of the breaking-ball fix.

**What is left.** The fold and the graze physics are measured and ready (friction 0.27, last look 0.5 in); what stops them is the breaking-ball contact: met too far out front on the slowest pitches (timing linear in the speed gap where the league's flattens), and with a path that rises too fast across pitch types. That is a new suspect (BC below), to fix before the fold is adopted again.

### 2. KB: the two-strike picture

**DEC_UNSEEN, carried over and fitted by direction.** On v3.1 with the policy refitted twice (scratch, 500 hitters; plate-appearance level strikeouts and walks, the far chases of breaking balls by direction, two-strike swings at breaking balls 6+ in inside the zone, the policy's rms):

| | K / BB per PA | below 6-9 / 9-12 | away 6-9 / 9-12 | in 6-9 / 9-12 | two strikes, deep in the zone | rms by count / kind |
|---|---|---|---|---|---|---|
| v3.1 | .206 / .093 | .17 / .10 | .13 / .08 | .13 / .09 | .90 | .048 / .053 |
| 0.5 both axes (#31) | .248 / .079 | .38 / .24 | .27 / .14 | .25 / .19 | .81 | .035 / .041 |
| 0.5 up-down only | .219 / .084 | .35 / .26 | .12 / .06 | .13 / .06 | .88 | .033 / .036 |
| 0.5 up-down, 0.25 across (built, v3.4) | .231 / .080 | .36 / .25 | .17 / .10 | .18 / .10 | .83 | .030 / .036 |
| the same, two-strike commit 0.12 s (KB) | .211 / .081 | .34 / .23 | .18 / .08 | .15 / .11 | .88 | .028 / .036 |
| league (game K% / BB%) | 22.2 / 8.4 | .36 / .28 | .21 / .15 | .25 / .14 | .96 | |

**KB refuted on its premise.** A later two-strike commit point needs a quicker two-strike swing. The league's two-strike swing was shorter but slower, so it took as long: swing length over bat speed 69.4 ms with no strikes, 69.7 with one, 70.5 with two (7.35 / 7.29 / 7.19 ft at 72.4 / 71.5 / 69.8 mph, 74,000 swings). As a knob, a commit 55 ms later with two strikes did cut the strikeouts (.231 to .211 per plate appearance) and kept the far chases, but nothing measured says it is later, so it was not built. The two-strike curve is sharper than the no-strike one in the league, but on the model's policy that follows from the single two-strike threshold (with no strikes the 'on' and 'off' thresholds mix two curves), not from a sharper eye.

**Built: v3.4 (DEC_UNSEEN 0.5 up-down, 0.25 across; class O, fitted to the league's chases by direction).** The chain and the suite:

| (seeds 3 / 11 / 29) | base_dh | v3.4 | league |
|---|---|---|---|
| K% | 19.5 / 19.1 / 18.7 | 22.8 / 22.7 / 22.0 | 22.2 |
| BB% | 8.6 / 9.5 / 9.4 | 7.6 / 6.9 / 7.5 | 8.4 |
| BABIP | .268 / .263 / .267 | .267 / .271 / .255 | .291 |
| runs / team-game | 4.37 / 4.50 / 4.39 | 3.91 / 3.99 / 3.63 | 4.45 |
| OBP | .312 / .317 / .320 | .292 / .291 / .287 | .315 |
| pitches / team-game | 139 / 139 / 141 | 135 / 136 / 135 | 146 |
| chase | .225 | .274 | .283 |
| breaking balls swung at, heart to 8+ in out | .70 .55 .37 .20 .06 | .61 .57 .47 .34 .14 | .69 .60 .46 .33 .15 |
| breaking balls chased below, 6-9 / 9-12 / 12+ in (whiff per swing) | .16 / .09 / .03 (.74 / .75 / .92) | .41 / .28 / .12 (.59 / .67 / .71) | .36 / .28 / .11 (.78 / .91 / .97) |
| two-strike swings at breaking balls, deep in the zone to the edge | .89 .91 .87 .79 | .82 .81 .79 .76 | .96 .92 .88 .82 |
| fastball fouls per swing | .327 | .317 | .451 |
| contact score (90 targets; by reach) | .0630 (.051) | .0708 (.073) | |

It met the step's stated aim: the league's far chases with strikeouts at 22.0-22.8%, no overshoot (#31's v3.3 on v3.2 had 23.8-24.6). But walks fell past the league's (6.9-7.6), runs to 3.63-3.99 (worst seed 3.63 against 4.39), pitches to 135 and the contact score by reach worsened. The cause is in the curve: the picture's shift is proportional to each pitch's break still to come (measured in v3.4: curveballs pictured 9.6 in higher than their true place on average, sliders 5.7, sweepers 5.5, splitters 4.9, changeups 3.5), so it spreads the pictures and flattens the swing curve; the policy's one two-strike threshold then trades swings deep in the zone for chases, and breaking balls in the zone are taken for strikes (.82 against .96). The far chases are also missed too rarely (.59 / .67 / .71 against .78 / .91 / .97): reaching contact is too good. Recorded, not kept.

**What is left.** The far chases come with DEC_UNSEEN, but its shift makes strikes look like balls. A form that shifts the picture only for pitches whose break carries them out of the zone has no measured basis yet; the next measurement is the league's swing rate at breaking balls by where they ended against where a pitch of that shape was headed at the commit point (the in-zone takes are the test). With the strikeouts the league's, the run gap would be BABIP's.

### 3. RE: the quality of reaching contact (measured; nothing built)

Fastball contact by distance from the zone's edge and by direction out of it (league from 42 days; model v3.1, 600 hitters x 40 PA). "Efficiency" is exit speed over Statcast's squared-up ceiling (1.23 x bat + 0.23 x pitch), so the bat speed lost to reaching (BAT_LOC, v3.0) is taken out; balls in play only:

| | league n | league EV in play | league efficiency | model EV in play | model efficiency |
|---|---|---|---|---|---|
| heart (4+ in inside) | 15,186 | 94.3 | .851 | 91.9 | .838 |
| edge, 0-4 in inside | 10,447 | 89.3 | .817 | 89.6 | .826 |
| edge, 0-4 in outside | 4,220 | 82.9 | .772 | 85.4 | .801 |
| 4-8 in outside | 839 | 74.5 | .709 | 79.7 | .767 |
| 8+ in outside | 109 | 62.5 | .634 | 72.1 | .716 |
| in toward the batter 0-4 / 4+ | 1,600 / 392 | 75.5 / 62.2 | .702 / .586 | 79.0 / 74.7 | .731 / .709 |
| away 0-4 / 4+ | 1,099 / 193 | 86.6 / 77.7 | .802 / .752 | 87.5 / 79.7 | .823 / .768 |
| below 0-4 / 4+ | 344 / 47 | 90.8 / 74.3 | .821 / .682 | 90.1 / 84.9 | .827 / .792 |
| above 0-4 / 4+ | 1,177 / 316 | 88.7 / 87.7 | .848 / .853 | 84.3 / 78.5 | .811 / .779 |

**Confirmed, and it depends on the direction.** Reaching cost the league's contact its quality beyond the bat speed: efficiency in play fell .14 from the heart to 4-8 in outside (the model's .07) and .22 to 8+ in (the model's .12). Most of it was inside (jammed: .586 at 4+ in against the model's .709) and below (.682 against .792, a thin sample); away the model was close (.768 against .752); above, the league's contact lost nothing (.85, as in the heart) while the model's lost .03-.06. The launch spread grew with reach alike in both (launch sd from the heart to 8+ in outside: 29 to 35 deg in the league, 29 to 37 in the model). So the model's reach cost (every execution error x (1 + reach / coverage), the same in every direction) is too small inside and below and too large above.

**Tried: the hands cover less of a reach (HAND_MISS split in and out; scratch on v3.1 with DEC_UNSEEN).** HAND_MISS (0.3, the share of a pitch's distance in or out that the hands do not cover) has no stated measurement. Out 0.45 brought the away efficiency to the league's (0-4 in .793, 4+ in .753 against .802 and .752); in 0.5 took the inside 0-4 in to .630 (league .702, too far) while 4+ in stayed .685 (league .586), because the deepest jams became misses inside the hands rather than weak contact. Both raised the fastball whiffs (.174 to .183-.195, misses past the end and inside the hands; the league's swings missing by 3+ in are already .014 against the model's .023). Not built: the league's reaching contact gets weak without missing more.

**What is left.** The cost of a reach should depend on its direction: inside jams the ball on the handle as contact, not as a miss (the model counts contact to 14 in from the sweet spot, where its collision efficiency is about -0.11; the league's jammed balls in play imply about -0.05); a low reach tops the ball; a high reach costs bat speed (BAT_LOC has it) but not the strike. Proposed as hypothesis RD.

### Proposed changes to the mysteries and hypotheses tables

- **Mystery 1 (fouls and strikeouts):** the fouls are grazes (a third of the league's tracked fastball contact; exit speed follows the pitch's speed, at .817 of it). v3.2 + v3.3 brought fastball fouls to .446 and K% to 22.3-23.0 but BABIP to .224-.232 and runs to 3.4: blocked by BC.
- **Mystery 4 (far chases):** v3.4 brought them (chase .274; 6-9 / 9-12 in below .41 / .28) with K% 22.0-22.8, but walks to 6.9-7.6 and runs to 3.6-4.0: the in-zone takes (DF).
- **Mystery 5 (batted-ball mix and BABIP):** add that breaking balls are fouled .565 of contact against .442 (pulled foul) and that their path is 4-5 deg too steep, hidden in v3.1 by topping; any change that raises the aim exposes it.
- **Mystery 7 (reaching contact):** restate with the efficiency in play by direction (table above): inside .709 against .586, below .792 against .682, above .779 against .853.
- **New hypotheses:**
  - **BC, breaking-ball contact** (mysteries 1, 5): slow pitches are met too far out front because the timing's pull toward the expected pitch grows linearly with the speed gap where the league's flattens past about 9 mph (curveballs +9.4 in against +6.6), and the bat's path rises 1.0 deg per inch across pitch types where the league's rises 0.73-0.84. Test: the timing cap (measured from depth by pitch type) with the attack across types; judge by the breaking balls' foul share (.442), pop-ups (.058 per contact) and attack (11.6). First in line: it blocks FL.
  - **DF, the decision's picture flattens** (mysteries 4, 1): DEC_UNSEEN's shift spreads with each pitch's break and takes breaking balls in the zone. Test: the league's swings at breaking balls by where they ended against where their shape was headed at the commit point.
  - **RD, the reach's cost by direction** (mystery 7): see section 3.
  - **KB:** refuted (two-strike swings take as long: 70.5 ms of swing length over bat speed against 69.4).
  - **FG and FL:** FG confirmed with its physics measured (the grazes); FL's suspect (fastball under-contact landing fair) refuted, replaced by BC.
- **Order:** BC first (it unblocks the fold, which is ready), then DF (it unblocks DEC_UNSEEN), then RD.

### Proposed trait map constants (none adopted on this branch)

- `MU_BAT` 0.27: ball-bat friction on a glancing strike, fitted to its own measurement (the grazes' speed, .817 of release); ready when the fold returns.
- `LOOK_SD` 0.5 in with `motorIn` x1.15 (x1.96 over v3.1 in all): the last look's error, fitted to the grazes' share of contact (.33 of fastball contact); with v3.2's `LOOK_GAIN` 1.3 (class O).
- `DEC_UNSEEN` 0.5 up-down, 0.25 across: class O, fitted to the league's chases by direction.
- A timing cap of about 18 ms on the prior's pull (candidate for BC), fitted to the league's contact depth by pitch type.
- `HAND_MISS`: no measurement found; a split (out 0.45) fits the away efficiency but costs whiffs.

### Commits on the branch

`14c4454` FL diag scripts; `3d467d9` v3.2 carried over and chained (recorded); `d1e273e` v3.3 FL and chained (recorded); `bd6e19d` v3.2 and v3.3 taken back out; `c7075d2` v3.4 DEC_UNSEEN and chained (recorded); `a8e3b8a` v3.4 taken back out; `b3b296b` KB and RE diag scripts. The chained engines can be restored from their commits (`git show d1e273e:bb_engine.js`, `git show c7075d2:bb_engine.js`).
