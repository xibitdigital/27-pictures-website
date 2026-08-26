# Toon config (local reference)

Editable source of truth for toon page lists + captions. **Not deployed** with the site.

| Path                                | Role                        |
| ----------------------------------- | --------------------------- |
| `content/toons/<toon>/config.json`  | Edit this (git reference)   |
| R2 `toons/<toon>/config.<md5>.json` | Runtime (CDN only)          |
| `src/toons/config-lock.json`        | App pointer to current hash |

## Current toons

| Toon   | Directory             | Notes                                                                                           |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------- |
| `erin` | `content/toons/erin/` | Interactive manga reader                                                                        |
| `jax`  | `content/toons/jax/`  | Netrunner chronicles — synopsis on cover; multilingual SFX/music (see `jax/README.md`)          |
| `nero` | `content/toons/nero/` | Scotland Yard case: Nero / Eve / The Dog; `?page=N` deep-links; full manual in `nero/README.md` |
| `redsmile-static` | `content/toons/redsmile-static/` | RED SMILE: static — B&W horror short; the static learns Elena, and something walks out wearing her |
| `redsmile-marcus` | `content/toons/redsmile-marcus/` | RED SMILE ep 2 — Marcus and the cleaner; unlisted while it is short (see `redsmile-marcus/README.md`) |
| `erin-the-revenge` | `content/toons/erin-the-revenge/` | ERIN & THE GOBLINS ep 2 — The Revenge |

```bash
# After editing config.json, commit it. Pre-commit puts config.<md5>.json on
# R2 and stages the lock. CI only checks the lock (the Actions token cannot put).
# One toon by hand:
npm run publish-toon-config -- --toon jax   # or erin | nero | erin-the-revenge
npm run publish-toon-config -- --check      # what CI runs

# Restore reference from CDN
npm run download-toon-config -- --toon jax

# Add a page image + append config + upload everything
make add-image SRC=~/page.jpg TOON=nero CONFIG=1 UPLOAD=1
```

**Dev:** `make dev` / `vite` injects this file at `/__dev/toon-config/<toon>.json`
(no publish needed). Edit + refresh. That is why local can show a different book
than staging until you push.

**Staging / prod:** readers load via `VITE_ASSET_BASE` + the hashed name in
`config-lock.json` — never from Pages. Puts happen on commit (`--staged`).
Actions runs `--check` before `vite build`. New plates/audio still need to be
on R2 first (`make ship` / `upload-assets`).

## What a word entry says

Only what is true of *that* caption. Everything else is style, and style lives in
the reader:

```json
{
  "x": 0.2,
  "y": 0.15,
  "variant": "thought",
  "tail": "top-left",
  "text": { "en": "No signal.", "it": "Nessun segnale." },
  "audio": "assets/sfx/acb3f6ef….mp3"
}
```

| Derived | Where from |
| ------- | ---------- |
| Wrap width | The text itself — `autoWrapCh` in `captions/captionModel.ts`, in `ch` so a balloon keeps its shape at any size. **Do not add `maxWidth`**; the box already sizes to its content |
| Padding | `resolveBubbleStyle` (`padX`/`padY`), per variant |
| Type size | The variant — bursts 28, HUD 20, speech 22 (`defaultSize`) |
| Fill opacity | `BUBBLE_FILL_OPACITY` = 0.75, the house style |
| Stroke width | `BUBBLE_STROKE_WIDTH` = 5 |
| Colour | The variant — dark ink on organic bubbles, light on the HUD |
| Alignment | `center` |

Add `size`, `angle`, `scale` or `color` only when that caption wants something
other than the default — an explicit value always wins. `tail` is top level;
`"bubble": { … }` is for the rarer overrides (`fill`, `stroke`, `shape`).

These configs were rewritten to this shape (~2,100 lines of repeated style
removed). If one drifts back, `node scripts/slim-toon-config.js --all --dry-run`
says what is redundant and `--all` strips it.

## Caption placement

Captions go in the **top band of their own panel** (`panel_top + ~0.04`),
hugged to the outer edge, never over a face. `bubble.tail` points back at the
sound source — all eight directions including diagonals. 0.75 opacity and a
stroke width of 5 are the defaults now, so a caption says neither; onomatopoeia
over dark plates still add `"stroke": "#ffffff"` + `"strokeThickness": 8`.

**Auto-read follows position, not array order** — `readingOrder` in
`captions/captionModel.ts` sorts top→bottom and merges captions within
`ROW_TOLERANCE` (0.06) into one row read left→right. So an SFX that must land
before a line needs a smaller `y` than that line, or the same row and a smaller
`x`. Moving it earlier in `words[]` changes nothing. Full notes in the root
`CLAUDE.md`.

## Captions / voices

Word overlays live in each page’s `words[]` (`variant`, `text`, optional `audio`).
Locked ElevenLabs names: `scripts/voices.json` (`jax`, `riu`, `nova`, `ripperdoc`,
`badai`, `nero`, `thedog`, `eve`, `barman`, `elena`, `narrator`, …).

Place reverb (outdoor courtyard, keep, …) is a config key, not a caption
style: book `"reverb": "plaza"`, a page may override (`plaza-deep`), a word
may set `"none"`. Types and ffmpeg chains: `scripts/reverb-types.json`.
`--from-config` applies it after TTS. The reader never reads this field.

```bash
set -a; source .env; set +a

# Plain dialogue (default: eleven_multilingual_v2)
python3 scripts/generate-jax-voice.py "Line here." --voice nero --toon nero

# Emotion / delivery — audio tags require Eleven v3 (ignored on multilingual_v2)
python3 scripts/generate-jax-voice.py "[scared] Nero—!" \
  --voice eve --toon nero --model eleven_v3 --stability 0.3
# Tags are TTS-only direction; config display text stays "Nero—!" (no brackets)

# paste printed "audio": "assets/sfx/<hash>.mp3" into config
npm run upload-assets
npm run publish-toon-config -- --toon nero
```

Useful tags: `[scared]`, `[worried]`, `[nervously]`, `[gasps]`, `[whispers]`,
`[shouts]`, `[excited]`, `[sighs]`. Combine: `"[gasps] [scared] Nero—!"`.
Docs: ElevenLabs TTS best practices → Prompting Eleven v3 → Audio tags.
