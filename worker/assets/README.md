# twentyseven-assets Worker

Passthrough CDN for plates, audio, and card-art. Binds the **existing**
`twentyseven-assets` R2 bucket (same keys as `scripts/lib/r2-media.js` and
`toon-editor`). No second bucket.

Editor originals (`editor/…`) stay on `toon-editor` `GET /media/`.

## Status (2026-09): cutover complete

`assets.twentyseven.pictures` is the only way to reach plate/card-art bytes.
`twentyseven-assets`'s public `r2.dev` URL is **disabled** — the Worker still
reads the same objects via its R2 binding, everything else (a hotlinker, a
bulk scraper) gets a 401. `VITE_ASSET_BASE` is `https://assets.twentyseven.pictures`
everywhere it's set: build `.env`, the **Pages project's own environment
variable** (Production + Preview — Functions don't read the build `.env` at
request time), and `ASSET_BASE` in `worker/toon-editor/wrangler.toml`.

Re-enabling the dev URL (`npx wrangler r2 bucket dev-url enable twentyseven-assets`)
puts the bucket back on an unprotected host with none of this Worker's
crawler blocks (`robots.txt`, `X-Robots-Tag: noai, noimageai`) — only do that
for a specific, temporary reason, and disable it again after.

```bash
cd worker/assets
npx wrangler deploy
```
