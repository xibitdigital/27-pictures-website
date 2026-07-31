# Toon config (local reference)

Editable source of truth for toon page lists + captions. **Not deployed** with the site.

| Path | Role |
|------|------|
| `content/toons/<toon>/config.json` | Edit this (git reference) |
| R2 `toons/<toon>/config.<md5>.json` | Runtime (CDN only) |
| `src/toons/config-lock.json` | App pointer to current hash |

## Current toons

| Toon | Directory | Notes |
|------|-----------|--------|
| `erin` | `content/toons/erin/` | Interactive manga reader |
| `jax` | `content/toons/jax/` | Multilingual captions, SFX, music, AI HUD bubbles |
| `nero` | `content/toons/nero/` | Sicario cyberpunk short (pages + optional dialogue) |

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

## Captions / voices

Word overlays live in each page’s `words[]` (`variant`, `text`, optional `audio`).
Locked ElevenLabs names: `scripts/jax-voices.json` (`jax`, `riu`, `nova`, `ripperdoc`,
`badai`, `nero`, `thedog`, …).

```bash
set -a; source .env; set +a
python3 scripts/generate-jax-voice.py "Line here." --voice nero
# paste printed audio path into config, copy mp3 under public/toons/<toon>/assets/sfx/ if needed
npm run upload-assets
npm run publish-toon-config -- --toon nero
```
