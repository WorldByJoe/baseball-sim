#!/usr/bin/env python3
# playbyplay.py · v0.1 · 2026-09-29
# Reads a JSON list of segments, speaks each with Piper at its own pace,
# joins them into one wav, and plays it on the TV over HDMI.
#
# Segment forms:
#   {"pace": 1.5, "text": "..."}      pace = Piper length_scale (1.0 = the voice's
#                                     native rate, bigger = slower)
#   {"pause": 0.8}                    silence in seconds
# Optional per-text keys: "gap" (silence between sentences, s, default 0.25),
#   "noise" (noise_scale, default from voice), "noise_w" (noise_w_scale).
#
# usage: playbyplay.py script.json out.wav [--voice NAME] [--no-play]
# CHANGED: first version.

import json, sys, time, wave, os, subprocess
from piper import PiperVoice, SynthesisConfig

args = sys.argv[1:]
play = "--no-play" not in args
args = [a for a in args if a != "--no-play"]
voice_name = "en_US-ryan-high"
if "--voice" in args:
    i = args.index("--voice"); voice_name = args[i + 1]; del args[i:i + 2]
script_path, out_path = args[0], args[1]

here = os.path.dirname(os.path.abspath(__file__))
t0 = time.time()
voice = PiperVoice.load(os.path.join(here, "voices", voice_name + ".onnx"))
rate = voice.config.sample_rate
print(f"loaded {voice_name} ({rate} Hz) in {time.time() - t0:.1f} s")

def silence(seconds):
    return b"\x00\x00" * int(rate * seconds)

pcm = bytearray()
for seg in json.load(open(script_path)):
    if "pause" in seg:
        pcm += silence(seg["pause"]); continue
    cfg = SynthesisConfig(length_scale=seg.get("pace", 1.0))
    if "noise" in seg:   cfg.noise_scale = seg["noise"]
    if "noise_w" in seg: cfg.noise_w_scale = seg["noise_w"]
    gap = silence(seg.get("gap", 0.25))
    t1 = time.time(); n0 = len(pcm)
    for chunk in voice.synthesize(seg["text"], cfg):
        pcm += chunk.audio_int16_bytes + gap
    made = (len(pcm) - n0) / 2 / rate
    words = len(seg["text"].split())
    print(f"pace {seg.get('pace', 1.0):.2f}: {words:3d} words -> {made:5.1f} s audio "
          f"({words / made * 60:3.0f} wpm) synth {time.time() - t1:.1f} s")

with wave.open(out_path, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(bytes(pcm))
total = len(pcm) / 2 / rate
print(f"wrote {out_path}: {total:.1f} s of audio, {time.time() - t0:.1f} s wall")

if play:
    env = dict(os.environ, XDG_RUNTIME_DIR="/run/user/1000")
    subprocess.run(["pw-play", out_path], env=env, check=True)
    print("played")
