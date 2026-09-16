# twentyseven-assets Worker

Passthrough CDN for plates, audio, and card-art. Binds the **existing**
`twentyseven-assets` R2 bucket (same keys as `scripts/lib/r2-media.js` and
`toon-editor`). No second bucket.

Editor originals (`editor/…`) stay on `toon-editor` `GET /media/`.

## Cutover

1. Deploy this Worker.
2. Attach `assets.twentyseven.pictures` (CNAME + custom domain).
3. Set `VITE_ASSET_BASE=https://assets.twentyseven.pictures` and ship Pages
   (and `ASSET_BASE` on `toon-editor`).
4. Confirm readers load plates from that host.
5. **Then** disable public access on `twentyseven-assets` (the `r2.dev` URL).
   The Worker binding still reads the same objects.

Until step 5, `pub-….r2.dev` still works. The Worker can go live first.

```bash
cd worker/assets
npx wrangler deploy
```
