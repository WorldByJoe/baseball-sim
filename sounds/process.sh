#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# process.sh · v0.1 · 2026-10-02
# Turns one source recording into a library file that follows the production
# rules in SOUNDS.md: Ogg Vorbis 44.1 kHz; beds stereo ~128 kbps, seamless loop,
# about -23 LUFS; one-shots mono ~96 kbps, no leading silence, short fades,
# about -18 LUFS. Needs ffmpeg (with libvorbis) and awk. Works on macOS and Linux.
#
# Usage:
#   ./process.sh INPUT SOUND bed|shot OUTPUT [START_S] [LENGTH_S] [FADE_OUT_S]
#     INPUT     any file ffmpeg reads (wav, flac, mp3, ...)
#     SOUND     the sound name from SOUNDS.md (only used for messages)
#     bed       loop: takes LENGTH_S (default 60) from START_S, crossfades the
#               2 s after the loop end into the loop start, so it loops clean
#     shot      one-shot: trims leading silence, keeps at most LENGTH_S
#               (default: whole file), fades in 10 ms and out FADE_OUT_S
#               (default 0.03 s; use ~0.3-1.0 s for crowd reactions cut short)
#     OUTPUT    e.g. crowd/cheer_small_07.ogg
#   Prints "OK <output> dur=<s> lufs=<LUFS> method=<...>" at the end.
#
# Loudness: two passes. Pass 1 measures integrated loudness and true peak
# (ffmpeg loudnorm, print_format=json); pass 2 applies a plain linear gain to
# reach the target. If that gain would push the true peak above -1 dBTP, a
# peak limiter (alimiter) holds it at -1 dBFS; the gain is capped so the
# limiter never takes more than 6 dB, so very peaky material (claps, sparse
# murmur) may end up a little under the target. The real result is printed.
# Very short one-shots (under 1.5 s, e.g. a bat crack) make the integrated
# measure unreliable, so they are levelled on their loudest 400 ms
# (momentary max) to the same -18 target; a fast peak limiter holds the peak
# at -1 dBFS, and the gain is capped so it never limits more than 6 dB (very
# spiky transients therefore end up a little under the target).
#
# CHANGED
#   v0.1  first version
# ---------------------------------------------------------------------------
set -eu

if [ $# -lt 4 ]; then
  sed -n '3,22p' "$0"; exit 1
fi
IN=$1; SOUND=$2; KIND=$3; OUT=$4
START=${5:-0}; LEN=${6:-}; FADEOUT=${7:-0.03}
XF=2                       # bed loop crossfade, seconds
TMP=$(mktemp -d 2>/dev/null || mktemp -d -t procsh)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$(dirname "$OUT")"

num() { awk -v x="$1" 'BEGIN{printf "%.6f", x}'; }

measure() {   # prints "I TP" for a file
  ffmpeg -nostdin -hide_banner -i "$1" -af loudnorm=print_format=json -f null - 2>&1 |
    awk -F'"' '/"input_i"/{i=$4} /"input_tp"/{tp=$4} END{print i, tp}'
}

if [ "$KIND" = bed ]; then
  LEN=${LEN:-60}
  TOT=$(awk -v l="$LEN" -v x="$XF" 'BEGIN{print l+x}')
  # seg = START .. START+LEN+XF ; loop = seg[XF..LEN+XF] crossfaded with seg[0..XF]
  ffmpeg -nostdin -v error -ss "$START" -t "$TOT" -i "$IN" -ac 2 -ar 44100 -c:a pcm_f32le "$TMP/seg.wav"
  ffmpeg -nostdin -v error -i "$TMP/seg.wav" -i "$TMP/seg.wav" -filter_complex \
    "[0:a]atrim=start=$XF,asetpts=PTS-STARTPTS[body];[1:a]atrim=end=$XF,asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=$XF:c1=qsin:c2=qsin[o]" \
    -map "[o]" -c:a pcm_f32le "$TMP/pre.wav"
  TARGET=-23; CH=2; BR=128k
else
  TRIM=""
  [ -n "$LEN" ] && TRIM="-t $LEN"
  # leading-silence trim happens before the length cut
  ffmpeg -nostdin -v error -ss "$START" -i "$IN" -ac 1 -ar 44100 \
    -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.005" -c:a pcm_f32le "$TMP/a.wav"
  ffmpeg -nostdin -v error -i "$TMP/a.wav" $TRIM -c:a pcm_f32le "$TMP/b.wav"
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/b.wav")
  FO=$(awk -v d="$D" -v f="$FADEOUT" 'BEGIN{if (f>d/3) f=d/3; printf "%.3f", f}')
  FS=$(awk -v d="$D" -v f="$FO" 'BEGIN{printf "%.4f", d-f}')
  ffmpeg -nostdin -v error -i "$TMP/b.wav" -af "afade=t=in:d=0.01,afade=t=out:st=$FS:d=$FO" -c:a pcm_f32le "$TMP/pre.wav"
  TARGET=-18; CH=1; BR=96k
fi

D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/pre.wav")
set -- $(measure "$TMP/pre.wav"); I=$1; TP=$2
METHOD=""
if [ "$KIND" = shot ] && awk -v d="$D" 'BEGIN{exit !(d<1.5)}'; then
  # short transient: level on momentary max (400 ms), cap peak at -1 dBFS
  MMAX=$(ffmpeg -nostdin -hide_banner -i "$TMP/pre.wav" -af "apad=pad_dur=0.5,ebur128=peak=sample" -f null - 2>&1 |
         awk '/ M:/{for(i=1;i<=NF;i++) if($i=="M:"){v=$(i+1)+0; if(v>m||m=="") m=v}} END{print m}')
  PK=$(ffmpeg -nostdin -hide_banner -i "$TMP/pre.wav" -af volumedetect -f null - 2>&1 | awk '/max_volume/{print $5}')
  # gain to reach the target, but never more than 6 dB of peak limiting
  G=$(awk -v t="$TARGET" -v m="$MMAX" -v p="$PK" 'BEGIN{g=t-m; if (p+g>5) g=5-p; printf "%.2f", g}')
  LIM=$(awk -v p="$PK" -v g="$G" 'BEGIN{printf "%.1f", (p+g>-1)?p+g+1:0}')
  ffmpeg -nostdin -v error -i "$TMP/pre.wav" -af "volume=${G}dB,alimiter=limit=0.891:attack=0.5:release=30:level=disabled" -ac $CH -ar 44100 -c:a libvorbis -b:a $BR -y "$OUT"
  METHOD="short shot: momentary-max ${MMAX} LUFS, peak ${PK} dBFS -> gain ${G} dB, ${LIM} dB peak limiting at -1 dBFS"
else
  # linear gain to the target, but never more than 6 dB of peak limiting
  G=$(awk -v t="$TARGET" -v i="$I" -v tp="$TP" 'BEGIN{g=t-i; if (tp+g>5) g=5-tp; printf "%.2f", g}')
  NEEDLIM=$(awk -v tp="$TP" -v g="$G" 'BEGIN{print (tp+g>-1)?1:0}')
  if [ "$NEEDLIM" = 1 ]; then
    LIM=$(awk -v tp="$TP" -v g="$G" 'BEGIN{printf "%.1f", tp+g+1}')
    AF="volume=${G}dB,alimiter=limit=0.891:attack=1:release=50:level=disabled"
    METHOD="two-pass: I ${I} TP ${TP} -> gain ${G} dB, up to ${LIM} dB peak limiting at -1 dBFS"
  else
    AF="volume=${G}dB"
    METHOD="two-pass: I ${I} TP ${TP} -> gain ${G} dB"
  fi
  ffmpeg -nostdin -v error -i "$TMP/pre.wav" -af "$AF" -ac $CH -ar 44100 -c:a libvorbis -b:a $BR -y "$OUT"
fi

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
set -- $(measure "$OUT"); LUFS=$1
echo "OK $OUT sound=$SOUND dur=$(num "$DUR") lufs=$LUFS method=$METHOD"
