#!/usr/bin/env bash
# Bake a site watermark into images (bottom-right corner by default).
# Requires ImageMagick 7+ (`magick`).
#
# Usage:
#   ./scripts/watermark-images.sh <input-dir-or-glob> [options]
#
# Examples:
#   ./scripts/watermark-images.sh public/toons/assets --backup
#   ./scripts/watermark-images.sh public/toons/assets --text "twentyseven.pictures" --backup
#   ./scripts/watermark-images.sh "./exports/*.jpg" --pointsize 28 --quality 90 --force
#
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: watermark-images.sh <input-dir-or-glob> [options]

Bake a text watermark into every matching image (in place).

Arguments:
  input               Directory of images, or a quoted glob (e.g. "./out/*.jpg")

Options:
  --text TEXT         Watermark text (default: twentyseven.pictures)
  --gravity POS       ImageMagick gravity (default: southeast)
  --pointsize N       Font size in px (default: 22)
  --font NAME         Font name (default: Helvetica)
  --quality N         JPEG quality 1–100 (default: 92)
  --offset-x N        Right/left inset in px (default: 20)
  --offset-y N        Bottom/top inset in px (default: 16)
  --backup [DIR]      Copy originals before writing (default dir: <input>/.watermark-backup)
  --force             Allow re-run when a backup dir already exists (risks double-mark)
  --dry-run           List files that would be processed, then exit
  -h, --help          Show this help

Notes:
  - Re-running on already-watermarked files will double the mark.
  - If a backup dir already exists, pass --force (or restore from backup first).
  - Writes via temp file then mv (atomic replace per image).
  - Skips non-image files and the .watermark-backup directory.
EOF
}

if ! command -v magick >/dev/null 2>&1; then
  echo "error: ImageMagick 'magick' not found. Install with: brew install imagemagick" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

INPUT=""
TEXT="twentyseven.pictures"
GRAVITY="southeast"
POINTSIZE=22
FONT="Helvetica"
QUALITY=92
OFFSET_X=20
OFFSET_Y=16
DO_BACKUP=0
BACKUP_DIR=""
DRY_RUN=0
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --text)
      TEXT="${2:?}"
      shift 2
      ;;
    --gravity)
      GRAVITY="${2:?}"
      shift 2
      ;;
    --pointsize)
      POINTSIZE="${2:?}"
      shift 2
      ;;
    --font)
      FONT="${2:?}"
      shift 2
      ;;
    --quality)
      QUALITY="${2:?}"
      shift 2
      ;;
    --offset-x)
      OFFSET_X="${2:?}"
      shift 2
      ;;
    --offset-y)
      OFFSET_Y="${2:?}"
      shift 2
      ;;
    --backup)
      DO_BACKUP=1
      if [[ $# -ge 2 && ! "$2" =~ ^-- ]]; then
        BACKUP_DIR="$2"
        shift 2
      else
        shift 1
      fi
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -*)
      echo "error: unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      if [[ -z "$INPUT" ]]; then
        INPUT="$1"
        shift
      else
        echo "error: unexpected argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$INPUT" ]]; then
  echo "error: missing input directory or glob" >&2
  usage
  exit 1
fi

# Collect files
FILES=()
if [[ -d "$INPUT" ]]; then
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find "$INPUT" -maxdepth 1 -type f \
    \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
    ! -path '*/.watermark-backup/*' -print0 | sort -z)
  DEFAULT_BACKUP="$INPUT/.watermark-backup"
else
  shopt -s nullglob
  # shellcheck disable=SC2206
  CANDIDATES=($INPUT)
  shopt -u nullglob
  for f in "${CANDIDATES[@]}"; do
    if [[ -f "$f" ]]; then
      FILES+=("$f")
    fi
  done
  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "error: no files matched: $INPUT" >&2
    exit 1
  fi
  DEFAULT_BACKUP="$(dirname "${FILES[0]}")/.watermark-backup"
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "error: no images found in: $INPUT" >&2
  exit 1
fi

if [[ "$DO_BACKUP" -eq 1 ]]; then
  BACKUP_DIR="${BACKUP_DIR:-$DEFAULT_BACKUP}"
fi

# Guard against accidental double-watermark when a previous backup exists
EXISTING_BACKUP=""
if [[ -d "${BACKUP_DIR:-$DEFAULT_BACKUP}" ]]; then
  EXISTING_BACKUP="${BACKUP_DIR:-$DEFAULT_BACKUP}"
fi
if [[ -n "$EXISTING_BACKUP" && "$FORCE" -ne 1 && "$DRY_RUN" -ne 1 ]]; then
  echo "error: backup already exists at $EXISTING_BACKUP" >&2
  echo "  Refusing to re-watermark (would double the mark)." >&2
  echo "  Restore originals, or pass --force if you intend to re-run." >&2
  exit 1
fi

SHADOW_X=$((OFFSET_X + 1))
SHADOW_Y=$((OFFSET_Y + 1))

echo "Watermark: \"$TEXT\""
echo "Files:     ${#FILES[@]}"
echo "Gravity:   $GRAVITY  pointsize=$POINTSIZE  quality=$QUALITY"
if [[ "$DO_BACKUP" -eq 1 ]]; then
  echo "Backup:    $BACKUP_DIR"
fi
if [[ "$FORCE" -eq 1 ]]; then
  echo "Force:     yes"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  printf '  %s\n' "${FILES[@]}"
  echo "(dry-run — no files modified)"
  exit 0
fi

backed_up=0
if [[ "$DO_BACKUP" -eq 1 ]]; then
  mkdir -p "$BACKUP_DIR"
  for f in "${FILES[@]}"; do
    base="$(basename "$f")"
    if [[ ! -f "$BACKUP_DIR/$base" ]]; then
      cp "$f" "$BACKUP_DIR/$base"
      backed_up=$((backed_up + 1))
    fi
  done
  echo "Backed up $backed_up new file(s) → $BACKUP_DIR"
fi

count=0
for f in "${FILES[@]}"; do
  dir="$(dirname "$f")"
  base="$(basename "$f")"
  ext="${base##*.}"
  tmp="$(mktemp "$dir/.wm-XXXXXX.${ext}")"

  if ! magick "$f" \
    -gravity "$GRAVITY" \
    -font "$FONT" \
    -pointsize "$POINTSIZE" \
    -fill 'rgba(0,0,0,0.55)' -annotate "+${SHADOW_X}+${SHADOW_Y}" "$TEXT" \
    -fill 'rgba(255,255,255,0.82)' -annotate "+${OFFSET_X}+${OFFSET_Y}" "$TEXT" \
    -quality "$QUALITY" \
    "$tmp"
  then
    rm -f "$tmp"
    echo "error: watermark failed for $f" >&2
    exit 1
  fi

  mv "$tmp" "$f"
  count=$((count + 1))
  echo "  ✓ $f"
done

echo "Done. Watermarked $count image(s)."
