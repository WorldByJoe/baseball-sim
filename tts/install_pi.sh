#!/bin/bash
# ---------------------------------------------------------------------------
# install_pi.sh · v0.1 · 2026-10-02
# Reproduces the Piper text-to-speech setup that is on the TV Pi: a Python
# venv with piper-tts and the three voices tried so far. The Pi was set up by
# hand with these same steps on 2026-09-29; this script records them and has
# not itself been run there (the Pi already has everything, in ~/piper).
#
# Usage:  bash install_pi.sh [DIR]      (DIR defaults to ~/piper)
# Then:   DIR/venv/bin/python playbyplay.py atbat.json out.wav --voice en_US-ryan-medium
#
# CHANGED
#   v0.1  first version: venv, piper-tts 1.8.0, three voices
# ---------------------------------------------------------------------------
set -euo pipefail
DIR="${1:-$HOME/piper}"
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US"
mkdir -p "$DIR/voices"
python3 -m venv "$DIR/venv"
"$DIR/venv/bin/pip" install --upgrade pip
"$DIR/venv/bin/pip" install "piper-tts==1.8.0"
# voice  speaker/tier  (each is an .onnx model plus its .onnx.json config)
for v in "ryan/medium/en_US-ryan-medium" "lessac/medium/en_US-lessac-medium" "ryan/high/en_US-ryan-high"; do
  name="${v##*/}"
  for ext in onnx onnx.json; do
    [ -s "$DIR/voices/$name.$ext" ] || curl -L --fail -o "$DIR/voices/$name.$ext" "$BASE/$v.$ext"
  done
done
echo "voices in $DIR/voices:"; ls -la "$DIR/voices"
