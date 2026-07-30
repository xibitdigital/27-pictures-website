# 27 Pictures — Website

Production site for [27 Pictures](https://twentyseven.pictures/) — psychological horror shorts and cinematic cosplay production.

## Stack

| Layer | Tech |
|--------|------|
| App | Vue 3 + Vite + TypeScript (MPA) |
| Hosting | Cloudflare Pages (`dist/`) |
| Media | Cloudflare R2 (CDN) — **required** at build time |
| Contact form | Cloudflare Worker + Resend + Turnstile |
| Fonts | Google Fonts (Playfair Display, Inter) |

## Quick start

```bash
cp .env.example .env
# Set VITE_ASSET_BASE (required for npm run build / make deploy)
# VITE_ASSET_BASE=https://pub-….r2.dev

npm install
make dev          # http://127.0.0.1:5173
make test
make deploy       # requires VITE_ASSET_BASE in .env
```

## Project layout

```
27-pictures-website/
├── src/                         # Vite root (HTML entries + Vue/TS)
│   ├── index.html               # Homepage
│   ├── experiments/index.html   # Experiments lab
│   ├── site/                    # SiteNav, ContactForm, directives
│   ├── toons/
│   │   ├── bookReader/          # FlipFrame package
│   │   ├── jax/ | erin/         # Toon apps + entries
│   └── test/                    # Vitest setup
├── public/                      # Static assets → site root in dist/
│   ├── styles.css, logo.png, …
│   ├── toons/                   # reader-shared.css; assets gitignored (R2)
│   ├── card-art/                # gitignored posters (R2)
│   ├── robots.txt, llms.txt     # crawl policy (AI search allowed)
│   ├── sitemap.xml, _headers, …
├── content/toons/               # editable toon config.json (publish → R2)
├── cdn-backup/                  # local R2 image backup (gitignored)
├── vite/plugins/cdnMedia.ts     # CDN gate + %VITE_ASSET_BASE% expand
├── scripts/                     # QR, watermark, R2 upload, toon config
├── worker/                      # Contact form Worker
├── dist/                        # Production build (gitignored)
├── Makefile
└── CLAUDE.md                    # Agent / contributor ops notes (incl. SEO)
```

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_ASSET_BASE` | **Yes** for build/deploy | R2/CDN origin (no trailing slash) |
| `R2_BUCKET` | No (default `twentyseven-assets`) | Upload target |
| `PREVIEW_USER` / `PREVIEW_PASS` | No | Basic auth for `make local` |
| `ELEVENLABS_API_KEY` | For SFX scripts only | Jax audio generation |

Copy `.env.example` → `.env`. Unit tests **force an empty** `VITE_ASSET_BASE` so they never depend on your local `.env`.

## Common commands

```bash
make help

make dev              # Vite dev (127.0.0.1)
make test
make build            # fails without VITE_ASSET_BASE
make deploy           # build + Pages production (main)
make deploy-cdn       # upload R2 media, then deploy
make local            # serve dist/ with basic auth on 127.0.0.1
make local-cdn        # CDN build + protected local serve
make upload-assets    # sync public/toons + card-art → R2
make add-image SRC=… TOON=jax [MANIFEST=1] [UPLOAD=1]
```

## Media (R2)

Toon plates, SFX, music, and experiment card art are **not in git**. Source of truth is R2.

- Keys mirror site paths: `toons/jax/assets/<md5>.jpg`, `card-art/erin.jpg`
- Static HTML uses `%VITE_ASSET_BASE%/card-art/…` (expanded at build)
- Readers use `resolveAssetUrl()` + `asset-page-dir` on `ToonReaderShell`
- Shared upload helpers: `scripts/lib/r2-media.js`
- Optional local image backup (untracked): `cdn-backup/` (see `.gitignore`)

## SEO / crawlers

- `public/robots.txt` + `public/llms.txt` — allow search and AI *citation* crawlers; block Bytespider/CCBot and `/qr`
- Cloudflare **managed robots.txt** must stay **disabled** (it used to inject `Disallow: /` for GPTBot/ClaudeBot)
- AI Crawl Control per-bot **Block** toggles: leave **off** for citation bots
- Details and IndexNow: `CLAUDE.md` → **SEO State**

```bash
# One-time bucket + CORS
npm run create-assets-bucket
npm run upload-assets -- --setup-cors

# Day-to-day
make deploy-cdn
```

New page plate:

```bash
make add-image SRC=~/Downloads/page.jpg TOON=jax MANIFEST=1 UPLOAD=1
# commit only manifest/words changes — not the binary
```

## Contact form Worker

```bash
cd worker && npm install && npx wrangler deploy
# Secret: npx wrangler secret put RESEND_API_KEY
```

**Worker:** `https://contact-form.sangalli-marco.workers.dev`
CORS locked to `https://twentyseven.pictures`.

## Deploy notes

- Production domain: **https://twentyseven.pictures**
- Deploy artifact is **`dist/`**, not raw `public/`
- `npm run build` **hard-fails** if `VITE_ASSET_BASE` is missing
- After shared CSS changes, `npm run hash-assets` (also runs as part of `build`)

## Git

- **Branch:** `main`
- **Remote:** `git@github.com:xibitdigital/27-pictures-website.git`

More detail for agents and long-running workflows: **[CLAUDE.md](./CLAUDE.md)**.
