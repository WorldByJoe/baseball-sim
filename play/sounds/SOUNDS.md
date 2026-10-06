# The sounds of the park

`SOUNDS.md · v0.2 · 2026-10-02`

What the game should sound like, and the library of sound files that makes it. The crowd is the home crowd: it wants the home team to win, a small pocket of visiting fans is somewhere in the stands, and it reacts to what it sees, never to what it cannot know. The broadcast brief (`docs/briefs/2026-10-02_broadcast.md`) builds the player; this file is what it plays.

## How the crowd behaves

Two numbers describe the crowd at every moment, and every sound follows from them.

**Arousal** (0 to 1) is how keyed up the park is. It sets the background crowd bed and the size of every reaction.
- It starts from the game situation: higher late in the game, higher when the score is close, low in a blowout, and a little higher in the first inning while the park is fresh.
- It rises with the stakes of the next pitch. The page already estimates the home team's chance of winning; the stakes are how far that chance would swing between the batter reaching and the batter making an out. A big swing means a big moment.
- The count adds to it: two strikes, three balls, and above all a full count with runners on.
- A big reaction lifts it for a while afterwards; a long stretch with nothing happening lets it sag. When it sags long enough, the organ tries to rev the crowd up.

**Valence** is which way an event cuts for the home crowd: plus when it helps the home team, minus when it helps the visitors. Its size is how far the play moved the home team's chance of winning (each play carries the chance before and after). A solo home run in a 10-1 game moves it a little; a go-ahead home run in the ninth moves it a lot. The same event can be a small cheer or an eruption, and that is the point.

From those two numbers:

| situation | what the crowd does |
|---|---|
| between pitches | a background bed at the arousal level: sparse, normal, buzzing or on its feet |
| a big pitch is coming | the bed lifts; rhythmic clapping when the home pitcher has two strikes; a rising rumble at a full count late |
| a long fly ball | a rising "ooooh" while it carries, sized by how far and how high |
| the play resolves for the home team | a cheer sized by the swing in the chance of winning: small, medium, big, or an eruption |
| the play resolves against the home team | a groan sized the same way; after a long drive is caught, the "ooh" collapses into "aww"; a gut punch leaves a stunned murmur |
| visitors do something big | under the home groan, a small pocket of visiting fans cheers |
| the umpire misses a call against the home team | boos, longer when it ends an at-bat or comes at a big moment. A missed call is a called strike on a pitch outside the rulebook zone, or a ball on a pitch inside it, by more than an inch |
| a pitcher leaves | a home pitcher who pitched well gets an ovation on his walk off; one who was hit hard gets thin applause; a visiting pitcher who was hit hard gets a sarcastic cheer |
| a long lull | the organ plays a "Let's go" riff and the crowd claps along |
| the home team threatens late | the organ plays "Charge!" and the crowd shouts back, at most every few batters |
| the middle of the seventh | the seventh-inning stretch: the organ plays "Take Me Out to the Ball Game" |
| the last out | a home win: an eruption on a walk-off, otherwise a big cheer into an ovation and the organ's outro. A visiting win: a groan, a stunned murmur, the visiting pocket cheering, and the bed thinning as the park empties |

Reactions are timed to the picture: a cheer starts when the ball drops or the runner is called safe, not at contact. The play-by-play voice always rides over the crowd: the crowd ducks a few decibels while a line is spoken.

## The library

**What is here now (provisional, chosen without listening):** 124 files for all 42 sounds, 14.7 MB, in `beds/`, `crowd/`, `field/` and `park/`; `manifest.json` lists every file with its source, author, licence and processing; `CREDITS.md` credits the CC-BY files; `catalog.html` (open it from this folder) plays every file, says what to listen for, and offers up to ten further candidates per sound to swap in; `process.sh` is the processing chain. `manifest.js` is what the page loads (`python3 manifest_js.py` rewrites it after any change to `manifest.json`). `organ/` holds offline renders of the organ cues, for listening only.

Each sound is a set of interchangeable recordings; the player picks one at random, with the pick seeded by the game so a replayed game sounds the same. "Variants" is how many to collect: 2 to 10, more for sounds that repeat often.

### Crowd beds: loops, 30 to 90 s, stereo

| sound | what it is | when | variants |
|---|---|---|---|
| `bed_sparse` | a thin crowd: scattered voices, a vendor far off | arousal under .25: a lopsided game, late in a blowout | 3 |
| `bed_normal` | the steady hum of a ballpark | .25 to .5 | 3 |
| `bed_buzz` | a crowd leaning forward: louder chatter, odd shouts and claps | .5 to .75 | 3 |
| `bed_rally` | on its feet: sustained loud cheering and clapping | over .75: late, close, runners on | 2 |

### Anticipation: one-shots

| sound | what it is | when | variants |
|---|---|---|---|
| `swell_fly` | the rising "ooooh" as a long fly carries, 2 to 6 s | fly ball with hang time over 2.5 s and distance over 250 ft | 6 |
| `clap_two_strike` | rhythmic clapping urging the pitcher on | home pitcher, two strikes, stakes above average | 3 |
| `rumble_rising` | a crowd getting to its feet | full count or bases loaded, late and close | 3 |
| `clap_rally` | clapping and stomping | home team threatening | 3 |

### The crowd for the home team

| sound | what it is | when | variants |
|---|---|---|---|
| `cheer_small` | a quick cheer | single, walk, early strikeout, an out that ends a jam | 6 |
| `cheer_medium` | a solid cheer | extra-base hit, a run scores, strikeout with men on, double play | 6 |
| `cheer_big` | a loud, long cheer | home run, go-ahead run, a diving catch | 5 |
| `eruption` | the park explodes, 8 to 15 s | walk-off, grand slam, the last out of a close win | 3 |
| `applause_polite` | warm applause | a good play, a pitcher leaving after a decent outing, the team taking the field | 5 |
| `ovation` | sustained standing ovation | a pitcher leaving after a great game, the end of a home win | 2 |

### The crowd against the home team

| sound | what it is | when | variants |
|---|---|---|---|
| `groan_small` | "aww" | home batter makes an out with men on; a visiting single | 6 |
| `groan_big` | a loud groan | visiting home run, home double play, an error | 4 |
| `letdown` | "ooh" collapsing into "aww" | a home drive caught at the wall (follows `swell_fly`) | 4 |
| `murmur_stunned` | a crowd talking low after a gut punch | after a big visiting home run or lead change | 2 |
| `pocket_visitors` | a small group cheering in a big quiet park | visiting runs and home runs | 3 |
| `ooh_wince` | a sympathetic "ooh" | a batter hit by a pitch | 3 |

### Conflict

| sound | what it is | when | variants |
|---|---|---|---|
| `boo_short` | a burst of boos | a missed call against the home team | 5 |
| `boo_long` | sustained booing | a missed call that ends a home at-bat or comes at a big moment | 3 |
| `cheer_sarcastic` | a mocking cheer | a visiting pitcher pulled after being hit hard | 2 |

### Incidental crowd

| sound | what it is | when | variants |
|---|---|---|---|
| `ooh_close_foul` | a rising "ooh" that dies | a long foul that would have been a home run | 4 |
| `foul_souvenir` | a scramble and a cheer | a foul into the stands | 3 |
| `shout_charge` | the crowd shouting "Charge!" | answers the organ's "Charge!" | 2 |
| `clap_letsgo` | the "clap clap, clap clap clap" pattern | answers the organ's "Let's go" riff | 2 |

### On the field: mono, short

| sound | what it is | when | variants |
|---|---|---|---|
| `bat_solid` | the crack of a squared-up ball | hard contact | 8 |
| `bat_medium` | ordinary contact | middling contact | 4 |
| `bat_weak` | a dull thunk | jammed or off the end of the bat | 4 |
| `foul_tip` | a tick into the mitt | foul tips | 3 |
| `mitt_pop` | the catcher's glove; louder for a harder pitch | every pitch caught | 6 |
| `glove_catch` | a ball into a fielder's glove | catches and received throws | 4 |
| `ball_wall` | a ball off the outfield wall | balls off the fence | 3 |
| `ball_dirt` | a ball skipping on dirt | wild pitches and pitches in the dirt | 3 |
| `slide` | a runner sliding into a bag | steals and close plays | 3 |
| `bat_drop` | a bat tossed down | walks and hit-by-pitches | 3 |
| `ump_strike` | an umpire's "Strike!" and "Strike three!" | called strikes; only if a well-licensed recording exists | 3 |
| `ump_out_safe` | "Out!" and "Safe!" | close plays; optional | 2 each |

### The park

| sound | what it is | when | variants |
|---|---|---|---|
| `pa_chime` | the ballpark chime before an announcement | before the public-address announcer speaks | 2 |
| `vendor` | "Peanuts! Cold drinks!" far off | mixed into the sparse and normal beds now and then; optional | 4 |
| `fireworks` | fireworks after a home home run | optional | 2 |

### The organ: synthesized, not downloaded

The organ is played by the page itself (Web Audio: a tonewheel organ built from drawbar harmonics with a rotating-speaker wobble), from note lists. That way it costs nothing, has no licence, and every riff can be tuned. Only public-domain or original tunes.

| cue | what it is | when |
|---|---|---|
| `organ_charge` | the "Charge!" fanfare, a traditional bugle call | home team threatening late, at most every few batters |
| `organ_lets_go` | the "Let's go" riff | a long lull, low arousal |
| `organ_filler` | 8 short original riffs | half-inning breaks, the walk of a pitching change |
| `organ_take_field` | a bright riff | the home team taking the field |
| `organ_stretch` | "Take Me Out to the Ball Game" (1908, public domain) | the middle of the seventh |
| `organ_hr` | a celebration flourish | after a home home run |
| `organ_win` | an outro | after a home win |

## Production rules

- **Format.** Ogg Vorbis at 44.1 kHz: one-shots mono at about 96 kbps, beds stereo at about 128 kbps. Beds loop without a click (trim at zero crossings, or crossfade the ends).
- **Loudness.** Every file normalized to a common loudness, about −23 LUFS for beds and −18 LUFS for one-shots, so the player's volumes mean the same thing for every variant. No leading silence; a short fade at each end.
- **Names.** `sounds/<group>/<sound>_<nn>.ogg`, for example `sounds/crowd/cheer_medium_03.ogg`.
- **Manifest.** `sounds/manifest.json` lists every file with its sound, duration, loop or one-shot, source URL, author, licence, and what was done to it.
- **Licences.** CC0 first. CC-BY next, credited in `sounds/CREDITS.md`. The BBC Sound Effects archive's licence (personal, educational and research use) is acceptable here because this project is private and non-commercial, and must be marked in the manifest. Never "no derivatives" licences, since every file gets trimmed and normalized, and never broadcast rips or anything of unclear origin.
- **Size.** The whole library under 30 MB.
