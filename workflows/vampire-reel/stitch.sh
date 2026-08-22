#!/usr/bin/env bash
# Stitch the three clips into one 9:16 Instagram Reel.
#
#   ./stitch.sh shot1.mp4 shot2.mp4 shot3.mp4 [out.mp4]
#
#   FPS=30 ./stitch.sh …    force an output rate instead of the detected one
#   PAD=1  ./stitch.sh …    letterbox anything not 9:16 instead of cropping it
#
# Normalises fps/size first (clips from different models or takes drift), then
# concats and encodes to Instagram's preferred delivery spec.
set -euo pipefail

S1="${1:?shot 1 mp4}"; S2="${2:?shot 2 mp4}"; S3="${3:?shot 4 mp4}"
OUT="${4:-reel.mp4}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

W=1080
H=1920

# Frame rate is DETECTED, not assumed. It used to be hardcoded at 30 because
# Kling delivers 30 — but Hailuo 02 and Seedance deliver 24, and forcing 24 up to
# 30 duplicates every fifth frame, which reads as judder in exactly the same way
# retiming 30 down to 24 dropped one. Both are the same bug in opposite
# directions. So: take the lowest native rate of the three inputs (upsampling
# invents frames, downsampling only discards), and let FPS= override.
probe() { ffprobe -v error -select_streams v:0 -show_entries "$2" -of csv=p=0:nk=1 "$1"; }

detected=""
for f in "$S1" "$S2" "$S3"; do
  r="$(probe "$f" stream=r_frame_rate)"
  fps="$(python3 -c "n,d='$r'.split('/'); print(round(float(n)/float(d), 3))")"
  detected="$detected $fps"
done
# shellcheck disable=SC2086
LOWEST="$(printf '%s\n' $detected | sort -n | head -1)"
FPS="${FPS:-$LOWEST}"

echo "inputs:"
i=0
for f in "$S1" "$S2" "$S3"; do
  i=$((i + 1))
  wh="$(probe "$f" stream=width,height | tr '\n' 'x' | sed 's/x$//')"
  dur="$(probe "$f" format=duration)"
  printf "  shot %d  %-10s %5.2fs  %s fps  %s\n" "$i" "$wh" "$dur" \
    "$(python3 -c "n,d='$(probe "$f" stream=r_frame_rate)'.split('/'); print(round(float(n)/float(d),3))")" \
    "$(basename "$f")"
done
echo "output: ${W}x${H} @ ${FPS} fps"

# A clip that is not already 9:16 loses most of its frame to the crop — worth
# saying out loud rather than discovering in the export.
for f in "$S1" "$S2" "$S3"; do
  ar="$(python3 -c "
w,h='$(probe "$f" stream=width,height | tr '\n' ',' | sed 's/,$//')'.split(',')
print('wide' if int(w)/int(h) > $W/$H else 'ok')")"
  if [ "$ar" = "wide" ]; then
    echo "! $(basename "$f") is wider than 9:16 — the crop will discard the sides. PAD=1 letterboxes instead." >&2
  fi
done

if [ "${PAD:-0}" = "1" ]; then
  FIT="scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black"
else
  FIT="scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}"
fi

i=0
for f in "$S1" "$S2" "$S3"; do
  i=$((i + 1))
  ffmpeg -hide_banner -loglevel error -y -i "$f" \
    -vf "${FIT},fps=${FPS}" \
    -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -an \
    "$TMP/n$i.mp4"
  printf "file '%s'\n" "$TMP/n$i.mp4" >>"$TMP/list.txt"
done

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" \
  -c:v libx264 -crf 19 -preset slow -pix_fmt yuv420p -profile:v high \
  -movflags +faststart -an "$OUT"

echo "wrote $OUT"
ffprobe -hide_banner -v error -show_entries format=duration:stream=width,height,r_frame_rate \
  -of default=noprint_wrappers=1 "$OUT"

# Audio (clips come back silent):
#   ffmpeg -i reel.mp4 -i bed.mp3 -c:v copy -c:a aac -b:a 128k -shortest reel-audio.mp4
