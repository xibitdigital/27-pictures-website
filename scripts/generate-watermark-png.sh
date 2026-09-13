#!/usr/bin/env bash
# Renders a standalone transparent watermark PNG (white fill, thin black stroke) — the asset a
# series uploads via the editor's "Watermark image" field (SeriesForm.vue), composited onto every
# plate that series generates (worker/toon-editor/src/imageOptimize.ts). Unlike
# scripts/watermark-images.sh, which bakes text directly onto existing images in place, this
# produces the watermark as its own transparent file.
#
# Requires ImageMagick 7+ (`magick`).
#
# Usage:
#   ./scripts/generate-watermark-png.sh [options]
#
# Examples:
#   ./scripts/generate-watermark-png.sh
#   ./scripts/generate-watermark-png.sh --text "my-series.example" --out /tmp/watermark.png
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: generate-watermark-png.sh [options]

Options:
  --text TEXT         Watermark text (default: twentyseven.pictures)
  --font NAME         Font name (default: Helvetica)
  --pointsize N       Font size in px (default: 26)
  --stroke-width N    Black outline width in px (default: 3)
  --out PATH          Output file (default: public/watermark-twentyseven.png)
  -h, --help          Show this help
EOF
}

TEXT="twentyseven.pictures"
FONT="Helvetica"
POINTSIZE=26
STROKE_WIDTH=3
OUT="public/watermark-twentyseven.png"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --text)
      TEXT="${2:?}"
      shift 2
      ;;
    --font)
      FONT="${2:?}"
      shift 2
      ;;
    --pointsize)
      POINTSIZE="${2:?}"
      shift 2
      ;;
    --stroke-width)
      STROKE_WIDTH="${2:?}"
      shift 2
      ;;
    --out)
      OUT="${2:?}"
      shift 2
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v magick >/dev/null 2>&1; then
  echo "error: ImageMagick 'magick' not found. Install with: brew install imagemagick" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

# Two passes onto the same transparent canvas: a stroke-only pass first (the black outline, wider
# than the final glyph), then a fill-only pass on top (white, unstroked) — drawing both in one
# -annotate with fill+stroke set together renders the stroke *centered* on the fill edge and can
# swallow it entirely depending on font/weight, which is what a single-pass attempt here produced.
magick -size "$((POINTSIZE * 12))x$((POINTSIZE * 2))" xc:none \
  -font "$FONT" -pointsize "$POINTSIZE" -gravity center \
  -fill none -stroke black -strokewidth "$STROKE_WIDTH" -annotate +0+0 "$TEXT" \
  -fill white -stroke none -annotate +0+0 "$TEXT" \
  -trim +repage \
  "$OUT"

echo "wrote $OUT"
