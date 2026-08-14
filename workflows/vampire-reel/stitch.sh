#!/usr/bin/env bash
# Stitch the three Kling clips into one 9:16 Instagram Reel.
#
#   ./stitch.sh shot1.mp4 shot2.mp4 shot3.mp4 [out.mp4]
#
# Normalises fps/size first (clips from different models or takes drift), then
# concats and encodes to Instagram's preferred delivery spec.
set -euo pipefail

S1="${1:?shot 1 mp4}"; S2="${2:?shot 2 mp4}"; S3="${3:?shot 3 mp4}"
OUT="${4:-reel.mp4}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Kling delivers 30fps. Retiming to 24 drops every 5th frame, and that judder
# reads as smeared motion on top of whatever the model produced. Instagram
# accepts 30 — keep the native rate.
FPS=30
W=1080
H=1920

i=0
for f in "$S1" "$S2" "$S3"; do
  i=$((i + 1))
  ffmpeg -hide_banner -loglevel error -y -i "$f" \
    -vf "scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},fps=${FPS}" \
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

# Audio (clips are silent — Kling has no native audio):
#   ffmpeg -i reel.mp4 -i bed.mp3 -c:v copy -c:a aac -b:a 128k -shortest reel-audio.mp4
