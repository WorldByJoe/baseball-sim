# Text to speech on the TV Pi

`tts/README.md · v0.2 · 2026-10-02`

The TV's Raspberry Pi can speak with [Piper](https://github.com/OHF-Voice/piper1-gpl), a local neural text-to-speech engine. It was installed and tested on 2026-09-29 for a radio-style baseball call; this folder is that capacity, copied into the baseball repository so the announcers can be built here.

## What is on the Pi

| | |
|---|---|
| machine | Raspberry Pi 5, Debian 13 (trixie), aarch64; hostname `tvpi.local`, user `joe` |
| Python | 3.13.5, in a venv at `~/piper/venv` |
| packages | `piper-tts` 1.8.0, `onnxruntime` 1.30.0 |
| voices | `~/piper/voices/`: `en_US-ryan-medium`, `en_US-lessac-medium`, `en_US-ryan-high` (22.05 kHz) |
| speaker script | `~/piper/playbyplay.py` (identical to `tts/playbyplay.py` here) |
| audio out | PipeWire, sink "Built-in Audio Digital Stereo (HDMI)": the TV's own speakers |

The voice models are 63 MB (medium) and 121 MB (high) and are not in git; `install_pi.sh` downloads them from the `rhasspy/piper-voices` collection on Hugging Face (links checked 2026-10-02).

## Speaking

One line from the shell on the Pi:

```bash
cd ~/piper && echo "Swung on and missed." | ./venv/bin/piper -m voices/en_US-ryan-medium.onnx -f out.wav && XDG_RUNTIME_DIR=/run/user/1000 pw-play out.wav
```

From Python, loading the voice once and speaking many lines (what `playbyplay.py` does):

```python
from piper import PiperVoice, SynthesisConfig
voice = PiperVoice.load("voices/en_US-ryan-medium.onnx")           # about 2.3 s, once
for chunk in voice.synthesize("Ball one.", SynthesisConfig(length_scale=1.0)):
    pcm = chunk.audio_int16_bytes                                    # 16-bit mono at voice.config.sample_rate
```

`playbyplay.py script.json out.wav [--voice NAME] [--no-play]` speaks a JSON list of segments, `{"pace": 1.45, "gap": 0.45, "text": "..."}` or `{"pause": 0.9}`, joins them into one wav and plays it. `atbat.json` is the demo: one at-bat, a double to the gap, 72 s.

## What was measured (Pi 5, 2026-09-29)

| voice | real-time factor | use |
|---|---|---|
| ryan-medium, loaded once | 0.25-0.32 per segment (70 s of audio in 20.8 s) | live: keeps up with the game |
| lessac-medium, one-shot CLI with model load | 0.53 | live with the voice loaded once |
| ryan-high, loaded once | about 1.3 (slower than real time) | pre-rendered clips only |

Pace is Piper's `length_scale` (1.0 = the voice's own rate, larger = slower). With Ryan, pace 0.92 and 0.12 s between sentences gave about 220 words a minute (the action); pace 1.3-1.45 with 0.45-0.5 s gaps gave 125-180 (tension and colour).

## The announcers: speech_server.py

`baseball.html` writes the whole game's broadcast at load (`bb_call.js`) and plays it on the clock (`bb_sound.js`). The voices come from `speech_server.py`, a standard-library HTTP server on `127.0.0.1:8898` that renders the game's lines with Piper (or Kokoro) ahead of the picture. Every answer, the OPTIONS preflight included, carries `Access-Control-Allow-Origin: *`, the pattern of the wall's `ratings_server.py`.

| request | what it does |
|---|---|
| `POST /script` | the game's voice lines: `{seed, version, lines: [{id, t, role, text, pace, energy, maxDur}]}`; `t` is seconds from the start of the game. Rendered in time order into the cache (`~/piper/speech_cache/<seed>-<version>/`); a reload of the same game keeps what is there |
| `POST /cursor` | `{t, speed, playing}`: where the game is. After a seek it renders from there; a line whose moment has passed (or is under a second away) is skipped, never queued |
| `GET /status` | the voice per role, lines rendered and skipped, how far ahead of the game the rendering runs, and `ready`: each rendered line's real length |
| `GET /voice/<id>` | one rendered line, a WAV |

The page posts the script at load (and again if the server appears later), the cursor on a seek, a pause, a change of speed and every 8 s, and asks `/status` every 2 s (backing off to a minute when there is no server). It plays a line only if it is ready and fits its air; otherwise it skips it. No server: no voices, no errors.

**Roles and voices** are in `voices.json` (`pbp`, `colour`, `pa`; `piper:<model>` or `kokoro:<voice>`). The defaults are `en_US-ryan-medium` (play-by-play), `en_US-norman-medium` (colour) and `en_US-kristin-medium` (public address): three different voices, all medium quality, because the high-quality models render too slowly on the Pi to keep up (`samples/README.md` has every candidate to listen to).

**Energy** (`calm`, `building`, `excited`, `peak`, `deflated`) comes with every line, with a pace. Piper has no emotion control, so `energy.json` turns it into the pause between sentences, Piper's two variability settings, a pitch lift (synthesised that much slower, then resampled up by the same factor, so the pace is kept) and a little gain. The writer adds short sentences and exclamation marks for the big calls. The `pa` role is filtered to a horn speaker's band and given a short echo off the stands. A line that would outrun its air is re-rendered up to 15% faster; if it still does not fit it is marked and the page skips it.

**Running it on the Pi:**

```bash
~/piper/venv/bin/pip install kokoro-onnx soundfile        # only for Kokoro voices
~/piper/venv/bin/python speech_server.py                  # voices in ~/piper/voices, cache in ~/piper/speech_cache
~/piper/venv/bin/python speech_server.py --dry-run script.json out/   # a whole game, no page: speeds and the timing table
```

`headless/call_check.js -- SEED none json` prints a game's voice lines as the script for `--dry-run`. The dry run reports the real-time factor and fits the timing table `bb_call.js` uses (`out/timing.json`): per role a lead-in, seconds per word at each energy, and a margin nine lines in ten fall within. Re-measure it on the Pi with the chosen voices and paste it into `bb_call.js` (TIMING).

## What was measured here (cloud machine, 2026-10-02)

Rendering 1,130 of the broadcast's own lines from seeds 7, 48 and 59 (every PA and colour line, a quarter of the play-by-play, and 30 lines per role re-rendered at every energy) with the default voices, `--dry-run` measured:

| role (voice) | lead-in | seconds per word: calm · building · excited · peak · deflated | at pace | margin (9 lines in 10) | real-time factor |
|---|---|---|---|---|---|
| pbp (ryan-medium) | 0.22 s | 0.282 · 0.268 · 0.252 · 0.241 · 0.279 | 1.08 · 1.0 · 0.92 · 0.88 · 1.12 | 0.44 s | 0.19 |
| colour (norman-medium) | 0.21 s | 0.302 · 0.309 · 0.285 · 0.273 · 0.314 | 1.30 · 1.2 · 1.08 · 1.0 · 1.32 | 0.79 s | 0.15 |
| pa (kristin-medium) | −1.06 s | 0.545 · 0.533 · 0.522 · 0.517 · 0.549 | 1.05 · 1.0 · 0.95 · 0.95 · 1.05 | 0.44 s | 0.14 |

That is about 200-250 words a minute for the play-by-play, 190-220 for colour (Norman is a quick reader even at pace 1.3) and 110 for the PA, whose name lists carry long pauses (hence its lead-in fitting below zero). The sentence pauses (`energy.json`) and the PA's 0.6 s echo tail come on top. The real-time factors were measured with the machine shared with other work; idle, the medium voices rendered at 0.06-0.08 (`samples/README.md`). A whole game (seed 48, 645 lines, 28 min of speech) rendered in 6.4 minutes.

## Limits worth knowing before building

- **No emotion or style control.** Piper has no SSML. The only knobs are pace, the two noise scales (variability), sentence silence and punctuation. Excitement has to come from pace, short sentences and exclamation marks.
- **The TV must be on** to hear anything (`~/tv_art/tv_state.log` records its state), and the volume is the TV's: HDMI carries full-scale digital audio and the Pi has no mixer.
- **Over ssh**, `pw-play` needs `XDG_RUNTIME_DIR=/run/user/1000` to find the desktop session's PipeWire. `wpctl status` shows a `pw-play` stream while it plays.
- **The game page cannot run Python** (hence the speech server above): `baseball.html` runs in the kiosk's Chromium from `file:///home/joe/tv_art/`. The wall already solves this kind of problem with a tiny local HTTP server: `ratings_server.py` listens on `127.0.0.1:8899`, answers with `Access-Control-Allow-Origin: *`, and the kiosk and plume pages `fetch()` it from `file://`. `~/tv_art/keepalive.sh` (cron, every 5 minutes) restarts it if it dies. A speech server for the announcers would follow the same pattern on its own port. The wall's files (`keepalive.sh`, `wall.js`) belong to the wall's own repository, not this one.
- **Better voices** need more than the Pi's CPU for live speech: Kokoro (82M) runs at about half real time on a Pi 5, so it suits pre-rendered lines; style-controllable voices (Chatterbox, Orpheus, cloud TTS) are out of reach locally.
