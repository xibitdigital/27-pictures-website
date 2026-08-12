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
| `redsmile-static` | `content/toons/redsmile-static/` | RED SMILE: static — B&W horror short; Elena alone at home, the TV starts watching back |

```bash
# After editing config.json
npm run publish-toon-config -- --toon jax   # or erin | nero

# Restore reference from CDN
npm run download-toon-config -- --toon jax

# Add a page image + append config + upload everything
make add-image SRC=~/page.jpg TOON=nero CONFIG=1 UPLOAD=1
```

**Dev:** `make dev` / `vite` injects this file at `/__dev/toon-config/<toon>.json`
(no publish needed). Edit + refresh.

**Prod:** readers load via `VITE_ASSET_BASE` + `config-lock.json` — never from Pages.
Deploy the site after `config-lock.json` changes so production picks up the new hash.

## Caption placement

Captions go in the **top band of their own panel** (`panel_top + ~0.04`),
hugged to the outer edge, never over a face. `bubble.tail` points back at the
sound source — all eight directions including diagonals. Every variant carries
`"opacity": 0.75` / `"strokeWidth": 5`; onomatopoeia over dark plates add
`"stroke": "#ffffff"` + `"strokeThickness": 8`.

**Auto-read plays `words[]` in array order**, so an SFX that should land before
a line must sit before it in the array. Full notes in the root `CLAUDE.md`.

## Captions / voices

Word overlays live in each page’s `words[]` (`variant`, `text`, optional `audio`).
Locked ElevenLabs names: `scripts/jax-voices.json` (`jax`, `riu`, `nova`, `ripperdoc`,
`badai`, `nero`, `thedog`, `eve`, `barman`, `elena`, `narrator`, …).

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
