---
name: watermark
description: >
  Bake a site watermark into image files (bottom-right by default) using
  ImageMagick. Use for toons pages, exports, or any batch of JPGs/PNGs.
  Triggers: "watermark", "/watermark", "add watermark", "embed website on
  images", "bake watermark", or "brand these images".
user-invokable: true
argument-hint: "[path-to-images] [--text twentyseven.pictures]"
---

# Watermark — Bake site mark into images

Permanently embed a text watermark into image files (not a CSS overlay).
Default mark: **twentyseven.pictures**, bottom-right corner.

## When to use

- New toons / manga / experiment page batches
- Any export that should carry brand attribution if shared or downloaded
- User asks to watermark, brand, or embed the website on images

## Prerequisites

- ImageMagick 7+ (`magick` on PATH). Install: `brew install imagemagick`
- Script in repo: `scripts/watermark-images.sh` (executable)

## Default recipe (27 Pictures)

### New single page (preferred)

Watermark + content-hash + place under the toon assets dir (optional manifest + R2):

```bash
make add-image SRC=~/Downloads/page.jpg TOON=jax
make add-image SRC=~/Downloads/page.jpg TOON=jax MANIFEST=1 UPLOAD=1
# or: npm run add-image -- ~/Downloads/page.jpg --toon erin --manifest --upload
```

Script: `scripts/add-toon-image.js`. See Claude.md → “Adding a new toon page image”.

### Batch folder (existing files)

```bash
./scripts/watermark-images.sh public/toons/assets --backup
```

That:

1. Backs up originals to `public/toons/assets/.watermark-backup/` (skips files already backed up)
2. Bakes `twentyseven.pictures` bottom-right on every `.jpg` / `.jpeg` / `.png` / `.webp` in the folder
3. Writes via temp file then atomic `mv` at JPEG quality 92
4. Refuses to re-run if a backup dir already exists unless `--force` is passed

## Workflow for the agent

1. **Confirm target path** — directory or glob of images. Prefer paths under `public/` only when the user intends deployable assets.
2. **Always backup first** for first-time runs on a folder (`--backup`). Warn that re-running without clean sources **doubles** the mark.
3. **Dry-run optional** if the set is large or path is ambiguous:
   ```bash
   ./scripts/watermark-images.sh <path> --dry-run
   ```
4. **Run watermark**:
   ```bash
   ./scripts/watermark-images.sh <path> --backup
   ```
5. **Spot-check** 1–2 crops (bottom-right) with ImageMagick if useful:
   ```bash
   magick <file> -gravity southeast -crop 400x100+0+0 +repage /tmp/wm-check.png
   ```
6. Do **not** also add a CSS overlay watermark unless the user asks — baked-in is enough.
7. Do **not** commit `.watermark-backup/` unless the user explicitly wants originals in git. Prefer adding that dir to `.gitignore` if backups land inside the repo.

## Common options

| Option | Default | Purpose |
|--------|---------|---------|
| `--text TEXT` | `twentyseven.pictures` | Watermark string |
| `--gravity POS` | `southeast` | Corner/edge (`southeast`, `southwest`, `northeast`, …) |
| `--pointsize N` | `22` | Font size (raise for higher-res art) |
| `--font NAME` | `Helvetica` | ImageMagick font name |
| `--quality N` | `92` | JPEG quality |
| `--offset-x N` | `20` | Horizontal inset from edge |
| `--offset-y N` | `16` | Vertical inset from edge |
| `--backup [DIR]` | `<input>/.watermark-backup` | Copy originals before write |
| `--force` | — | Allow re-run when backup already exists (double-mark risk) |
| `--dry-run` | — | List targets only |

### Examples

```bash
# Default site mark on toons pages
./scripts/watermark-images.sh public/toons/assets --backup

# Custom text / larger type for 2K pages
./scripts/watermark-images.sh public/toons/assets \
  --text "twentyseven.pictures" \
  --pointsize 28 \
  --backup

# Explicit backup location (outside deploy tree)
./scripts/watermark-images.sh public/toons/assets \
  --backup /tmp/toons-assets-backup

# Single-folder export with custom mark
./scripts/watermark-images.sh ./exports --text "© 27 Pictures" --backup
```

## Style (locked defaults)

Matches the 27 Pictures experiment recipe:

- White text `rgba(255,255,255,0.82)` over dark shadow `rgba(0,0,0,0.55)` offset +1px
- Bottom-right (`southeast`)
- Subtle size — readable, not a stamp across the art

Only change text/size/position when the user asks.

## Safety rules

- **Never watermark** logos, favicons, or unrelated site chrome (`logo.png`, `logosquare.png`, etc.) unless explicitly requested
- **Never re-watermark** a folder that already has the mark without restoring from backup first
- If originals exist only in `.watermark-backup` or `/tmp`, restore then re-apply:
  ```bash
  cp public/toons/assets/.watermark-backup/*.jpg public/toons/assets/
  ./scripts/watermark-images.sh public/toons/assets --text "…"
  ```
- Keep experiments/toons SEO posture unchanged (`noindex` / robots) — watermarking is brand protection, not SEO

## Output to the user

After a successful run, report:

- Path processed and file count
- Text / gravity used
- Backup location (if any)
- Reminder: re-run doubles the mark; restore from backup to change style
