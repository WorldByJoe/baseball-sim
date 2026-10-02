# Text to speech on the TV Pi

`tts/README.md · v0.1 · 2026-10-02`

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

## Limits worth knowing before building

- **No emotion or style control.** Piper has no SSML. The only knobs are pace, the two noise scales (variability), sentence silence and punctuation. Excitement has to come from pace, short sentences and exclamation marks.
- **The TV must be on** to hear anything (`~/tv_art/tv_state.log` records its state), and the volume is the TV's: HDMI carries full-scale digital audio and the Pi has no mixer.
- **Over ssh**, `pw-play` needs `XDG_RUNTIME_DIR=/run/user/1000` to find the desktop session's PipeWire. `wpctl status` shows a `pw-play` stream while it plays.
- **The game page cannot run Python.** `baseball.html` runs in the kiosk's Chromium from `file:///home/joe/tv_art/`. The wall already solves this kind of problem with a tiny local HTTP server: `ratings_server.py` listens on `127.0.0.1:8899`, answers with `Access-Control-Allow-Origin: *`, and the kiosk and plume pages `fetch()` it from `file://`. `~/tv_art/keepalive.sh` (cron, every 5 minutes) restarts it if it dies. A speech server for the announcers would follow the same pattern on its own port. The wall's files (`keepalive.sh`, `wall.js`) belong to the wall's own repository, not this one.
- **Better voices** need more than the Pi's CPU for live speech: Kokoro (82M) runs at about half real time on a Pi 5, so it suits pre-rendered lines; style-controllable voices (Chatterbox, Orpheus, cloud TTS) are out of reach locally.
