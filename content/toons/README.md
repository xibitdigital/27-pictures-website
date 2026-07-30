# Toon config (local reference)

Editable source of truth for toon page lists + captions. **Not deployed** with the site.

| Path | Role |
|------|------|
| `content/toons/<toon>/config.json` | Edit this (git reference) |
| R2 `toons/<toon>/config.<md5>.json` | Runtime (CDN only) |
| `src/toons/config-lock.json` | App pointer to current hash |

```bash
# After editing config.json
npm run publish-toon-config -- --toon jax

# Restore reference from CDN
npm run download-toon-config -- --toon jax

# Add a page image + append config + upload everything
make add-image SRC=~/page.jpg TOON=jax CONFIG=1 UPLOAD=1
```

**Dev:** `make dev` / `vite` injects this file at `/__dev/toon-config/<toon>.json`
(no publish needed). Edit + refresh.

**Prod:** readers load via `VITE_ASSET_BASE` + `config-lock.json` — never from Pages.
