# Claude Code Instructions

## Code Formatting

**Always format files with Prettier** after making changes:

```bash
npx prettier --write public/styles.css public/index.html public/script.js public/qr.html
```

## CSS Guidelines

**Never hardcode colors.** Always use CSS custom properties defined in `:root`.

### Available CSS Variables

```css
:root {
    /* Backgrounds */
    --bg: #030303;           /* Main background */
    --bg-dark: #000;         /* Pure black sections */
    --bg-card: #111;         /* Card/frame backgrounds */
    --bg-assembly: #050505;  /* Assembly section */

    /* Text */
    --text: #fff;            /* Primary text */
    --text-muted: #ccc;      /* Secondary/muted text */
    --silver: #888;          /* Tertiary text */

    /* Accent Colors */
    --red-smile: #b30000;    /* Primary accent (brand red) */
    --success: #4caf50;      /* Success states */

    /* Borders */
    --border: #222;          /* Dark borders */
    --border-light: #333;    /* Light borders (forms) */

    /* Animation */
    --transition: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Usage Examples

```css
/* Good */
.element { color: var(--text); background: var(--bg-card); }

/* Bad - never do this */
.element { color: #fff; background: #111; }
```

## Project Structure

```
27-pictures-website/
├── public/                  # Static site files (deployed to Cloudflare Pages)
│   ├── index.html
│   ├── qr.html              # Mobile landing page for QR code (noindex)
│   ├── styles.css
│   ├── script.js
│   ├── logo.png
│   ├── the-red-smile.jpg
│   ├── sitemap.xml
│   ├── robots.txt
│   └── bdd5e80e21a8430d9316de0deacdb208.txt  # IndexNow key file
├── scripts/
│   └── generate-qr.js       # Generates branded QR code PDF → ~/Downloads/
├── worker/                  # Cloudflare Worker (contact form API)
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
├── package.json             # Root package (qrcode + pdfkit for QR generator)
├── .github/workflows/       # GitHub Actions (legacy GitHub Pages)
│   └── deploy.yml
├── CLAUDE.md                # This file
└── .gitignore
```

## Deployment

### Website (Cloudflare Pages)

```bash
make deploy        # build (uses VITE_ASSET_BASE from .env if set) + deploy production
make deploy-cdn    # require VITE_ASSET_BASE, upload R2, then deploy
make preview-cdn   # CDN build + Pages preview branch
```

**Custom domain:** `twentyseven.pictures`

### Local

```bash
make dev           # Vite on 127.0.0.1 (same-origin media from public/)
make local         # serve dist/ on 127.0.0.1 + HTTP Basic Auth
make local-cdn     # require VITE_ASSET_BASE, CDN build, then protected serve
```

`PREVIEW_USER` / `PREVIEW_PASS` in `.env` (empty pass on `make local` → random printed once).

### Media on R2 (CDN)

One media host when `VITE_ASSET_BASE` is set: toon plates + experiment cards.

```bash
# One-time
npm run create-assets-bucket
npm run upload-assets -- --setup-cors
# Optional custom domain:
# npx wrangler r2 bucket domain add twentyseven-assets --domain assets.twentyseven.pictures

# .env
VITE_ASSET_BASE=https://pub-e60c8fa8eea343fbac708bf75981d19c.r2.dev
# or: VITE_ASSET_BASE=https://assets.twentyseven.pictures

make deploy-cdn    # upload + build + deploy
# or make deploy after media already uploaded
```

- `resolveAssetUrl()` + `asset-page-dir` on readers; static HTML card-art rewritten at build (`vite/plugins/cdnMedia.ts`)
- Strip `dist/toons/**` media + `dist/card-art/` when CDN is on
- Keys mirror `public/`: `toons/jax/assets/<hash>.jpg`, `card-art/erin.jpg`
- Shared put/lock: `scripts/lib/r2-media.js`
- See `.env.example`

### Adding a new toon page image

Images are content-hashed (`md5.ext`) under `public/toons/<toon>/assets/` — same convention as
existing Jax/Erin plates. Prefer the one-shot command (watermark + hash + place):

```bash
# Watermark + write public/toons/jax/assets/<md5>.jpg
make add-image SRC=~/Downloads/page17.jpg TOON=jax

# Also append manifest.json and upload to R2
make add-image SRC=~/Downloads/page17.jpg TOON=jax MANIFEST=1 UPLOAD=1

# npm equivalent
npm run add-image -- ~/Downloads/page17.jpg --toon erin --manifest --upload
```

What it does:

1. Copies the source into a temp dir
2. Bakes `twentyseven.pictures` (ImageMagick via `scripts/watermark-images.sh`) unless `--no-watermark`
3. Renames by **md5 of the final bytes** → `public/toons/<toon>/assets/<md5>.jpg`
4. `--manifest` — appends `"assets/<md5>.jpg"` to that toon’s `manifest.json` and sets `pages`
5. `--upload` — `wrangler r2 object put` + updates `scripts/r2-assets-lock.json`

Batch watermark only (existing folder, no hash/rename):

```bash
make watermark ARGS='public/toons/jax/assets --backup'
# or: npm run watermark -- public/toons/jax/assets --backup
```

Requires ImageMagick 7+ (`brew install imagemagick`).

### Contact Form Worker

Deploy the Cloudflare Worker:

```bash
cd worker
npm install
npx wrangler deploy
```

**Worker URL:** `https://contact-form.sangalli-marco.workers.dev`

## Contact Form

### Architecture

- **Frontend:** AJAX form submission (stays on page)
- **Backend:** Cloudflare Worker
- **Email Service:** Resend API
- **CORS:** Only allows `https://twentyseven.pictures`

### Worker Configuration

Environment variables in `worker/wrangler.toml`:

```toml
[vars]
TO_EMAIL = "sangalli.marco@gmail.com"
FROM_EMAIL = "noreply@twentyseven.pictures"
FROM_NAME = "27 Pictures Contact Form"
```

### Secrets

The Resend API key is stored as a secret:

```bash
npx wrangler secret put RESEND_API_KEY
```

### Resend Setup

1. Domain `twentyseven.pictures` verified at https://resend.com/domains
2. API key created at https://resend.com/api-keys

## Email Routing

To receive emails at `info@twentyseven.pictures`:

1. Cloudflare Dashboard → Email → Email Routing
2. Add route: `info` → forward to personal email
3. Add MX records if prompted

## Experiments Page

`public/experiments/index.html` carries the **same main site nav** as the
homepage (`<header><nav>...</nav></header>` + mobile menu overlay), copied
from `public/index.html` with the hash links rewritten to be homepage-
relative (`/#darkroom` instead of `#darkroom`, since this page isn't the
homepage). It also loads `../script.js` (burger menu + magnetic hover) —
keep both the nav markup and that script tag if this page is ever
regenerated or restructured; the page's own top padding (140px desktop) was
already sized to clear a fixed header, they just weren't in sync before.

## QR Code Landing Page

- **URL:** `https://twentyseven.pictures/qr.html`
- **Purpose:** Mobile contact/inquiry page linked from a printed QR code
- **SEO:** `noindex, nofollow` — also blocked in `robots.txt`
- **Content:** Contact form (Turnstile + Resend), Instagram and YouTube links

### Generate printable QR code PDF

```bash
npm run generate-qr
# Output: ~/Downloads/27pictures-qr.pdf
```

## Toon Reader (shared by Erin, Jax, …)

Every toon page (`public/toons/<name>/index.html`) is a thin shell around
shared reader files:

- **`public/toons/book-reader.js`** — the page-turning engine (flip
  animation, keyboard/swipe/click nav, fullscreen, front-cover
  instructions/logo/sound-button). `ToonBook.init({...})` wires it up; see
  the JSDoc at the top of the file for every option. The reader's product
  name/attribution — "FlipFrame — by twentyseven.pictures" (`.front-cover-brand`)
  — is baked into `renderFrontCoverInstructions()` here, so it shows on
  every toon automatically; it isn't per-toon config.
- **`public/toons/view-mode.js`** — scroll vs book view toggle
  (`ToonViewMode.init({...})`). Defaults to vertical scroll on viewports
  ≤768px (same breakpoint as single-page book mode). CSS for the strip is
  in `reader-shared.css` (`body.view-vertical`).
- **`public/toons/reader-shared.css`** — the reader's visual chrome (book,
  pages, spine, flip overlay, nav zones, controls, front-cover panel,
  vertical scroll mode). Any rule here applies to **every** toon reader —
  changing it changes Erin and Jax (and any future toon) at once.

### What goes where

A toon's own `<style>` block should contain **only**:

1. Its book-aspect `:root` tokens — `--book-width`, `--book-height`,
   `--page-bg`, `--spine`, `--cover` — plus the matching
   `body.is-fullscreen .book-scene`, `body.is-fullscreen.single-page
   .book-scene`, and `body.single-page` overrides of those same tokens
   (every toon's pages have a different aspect ratio, so these can't be
   shared).
2. Page-specific extras that don't apply to other toons — e.g. Jax's word/
   caption overlay (`.jax-word*`), language switcher, sound/music buttons.

Everything else (book-scene, page-slot, flip-page, nav-zone, controls,
reader-btn, page-nav-btn, front-cover-instructions + logo, back-cover-link,
single-page layout, the 768px media query) belongs in `reader-shared.css`.
Before adding a CSS rule to a toon's own `<style>` block, check whether it's
actually shared behavior that should go in `reader-shared.css` instead —
don't recreate a rule that already exists there.

### Adding a new toon reader

```html
<link rel="stylesheet" href="../reader-shared.css?v=<current version>" />
<style>
  :root {
    --book-width: min(92vw, 900px, calc((100dvh - 240px) / <aspect>));
    --book-height: calc(var(--book-width) * <aspect>);
    --page-bg: ...;
    --spine: ...;
    --cover: ...;
  }
  /* + the matching fullscreen/single-page token overrides, + anything
     genuinely unique to this toon */
</style>
...
<script src="../book-reader.js?v=<current version>"></script>
<script src="../view-mode.js?v=<current version>"></script>
<script>
  ToonViewMode.init({ altPrefix: "Name", mobileDefault: true });
  ToonBook.init({ altPrefix: "Name", frontCoverLogo: "../../logosquare.png" });
</script>
```

### Cache-busting (`?v=<hash>`)

`styles.css`, `script.js`, `book-reader.js`, `view-mode.js`, `words.js`, and
`reader-shared.css` are all linked with a `?v=<hash>` query string, the
first 10 hex chars of that file's own sha256. Browsers (and this repo's
local dev server) cache them aggressively by URL — without a cache-bust, a
hard-refreshed page can still run the old script/CSS while `curl`/`fetch`
on the same URL shows the new content.

This used to be a manually incremented `?v=N` — hand-bumping across
multiple HTML files that all reference the same asset (Jax + Erin both
link `reader-shared.css`, both site pages link `styles.css`/`script.js`)
was error-prone and repeatedly caused exactly the stale-asset confusion
this convention exists to prevent. Now it's automatic:

```bash
npm run hash-assets
```

Run this before every deploy that touched any of those shared assets — it
hashes each one and rewrites every `?v=...` reference to it across every
`public/**/*.html` file, so the query string always matches content and
never needs manual bumping or cross-file bookkeeping.

## Jax Toon — SFX (ElevenLabs) + background music

Word overlays in `public/toons/jax/words.json` can carry an `"audio"` field
(e.g. `"assets/sfx/12cd3501a258f305455ed5bf3cf76ed3.mp3"`) pointing at a short
SFX clip baked for that onomatopoeia/caption. All audio assets — SFX and
music — are named by content hash (`md5.mp3`), matching the site's existing
image-asset convention; **there is no human-readable filename to guess from**,
always resolve the current hash from `words.json` / the source files
themselves.

Playback: `public/toons/jax/words.js` wires `mouseenter` (desktop, gated on
`(hover: hover) and (pointer: fine)`) and `click` (touch fallback) on each
word that has an `audio` field. Both check `window.__jaxSoundEnabled` — set
by the Sound toggle button in `index.html` — before calling `play()`, so
nothing plays until the user opts in.

The **Sound** button (top-right, next to the language switcher) is the single
gate for all audio: first click plays a confirmation beep (satisfies the
browser's user-gesture requirement for audio) and starts the looping
background track (`#bgMusic` in `index.html`, `loop`, volume `0.22`); a
second click pauses the music and mutes future SFX.

**Word-layer z-index matters**: `.nav-zone` (the full-height page-turn click
areas) sits at `z-index: 30`. The word overlay layer must stay above it
(`z-index: 35` in `words.js`) or nav-zone silently wins hit-testing and no
hover/click ever reaches the word captions, regardless of `pointer-events` on
the word itself — this was a real regression once, don't reintroduce it.

### Regenerating / adding SFX clips

1. `ELEVENLABS_API_KEY` lives in `.env` (gitignored, never commit it).
2. Add/edit an entry in `scripts/jax-sfx-manifest.json` (`slug`, `prompt`,
   `duration` in seconds). `slug` is only a human-readable key for the
   generator/lockfile — it is never the output filename.
3. Run:
   ```bash
   set -a; source .env; set +a
   python3 scripts/generate-jax-sfx.py
   ```
   Calls the ElevenLabs Sound Effects API (`POST /v1/sound-generation`),
   writes `public/toons/jax/assets/sfx/<md5>.mp3`, and records `slug -> hash`
   in `scripts/jax-sfx-lock.json` so re-runs skip already-generated slugs
   (idempotent, avoids re-spending credits) unless `--force`. Prints the
   exact `"audio": "assets/sfx/<hash>.mp3"` lines to paste into `words.json`
   for anything new/changed.
4. Update the matching word entry/entries in `words.json` (multiple entries
   can share one clip, e.g. both `WHOOSH` instances point at the same hash).

### Generating a spoken voice line (dialogue, not onomatopoeia)

Onomatopoeia (`CLANK`, `WHOOSH`, …) go through `generate-jax-sfx.py` (Sound
Effects API — non-verbal). Actual dialogue captions (e.g. "Too slow, man!")
should be a real spoken line instead, via Text-to-Speech:

1. Voices are locked by name in `scripts/jax-voices.json` (`name ->
   voice_id`), so a character keeps the same voice across generations. To
   add a new one: open the voice on
   `elevenlabs.io/app/voice-library?voiceId=...`, copy the ID from the URL,
   add `"name": "voiceId"` to that file. (Listing/searching voices via
   `GET /v1/voices` needs a separate `voices_read` scope that isn't exposed
   as a toggle in the key-permission UI — grab the ID from the dashboard
   URL instead of trying to list voices from a script.)
2. Run:
   ```bash
   set -a; source .env; set +a
   python3 scripts/generate-jax-voice.py "Too slow, man!" --voice jax
   ```
   Writes `public/toons/jax/assets/sfx/<md5>.mp3` and prints the
   `"audio": "assets/sfx/<hash>.mp3"` line to paste into `words.json`.
3. Delete the old hashed file for that entry if you're replacing a line —
   these aren't tracked in the lockfile like SFX slugs are.

### Replacing the background track

Drop a new source file in `public/toons/jax/assets/music/`, convert + hash it:
```bash
ffmpeg -y -i public/toons/jax/assets/music/<source> -codec:a libmp3lame -b:a 192k /tmp/bg.mp3
HASH=$(md5 -q /tmp/bg.mp3)
mv /tmp/bg.mp3 "public/toons/jax/assets/music/$HASH.mp3"
```
then update the `#bgMusic` `src` in `index.html` to the new hash and delete
the old hashed file (and the original source, once converted — the source
format, e.g. a large `.wav`, shouldn't be committed).

## SEO State

### Completed
- Page title: `27 Pictures | AI Horror Shorts & Cinematic Cosplay Production`
- Meta description updated (matches YouTube channel description)
- JSON-LD schema: Organization, WebSite, WebPage, CreativeWorkSeries, 6× VideoObject, 2× Service
- Organization location: Switzerland & United Kingdom
- IndexNow key deployed + submitted (`bdd5e80e21a8430d9316de0deacdb208`)
- All VideoObject uploadDates and durations use real YouTube values

### Video ID → Title Map (as of 2026-05)
| YouTube ID | Title | Duration | Upload |
|---|---|---|---|
| `J-iZl-XkVxg` | The Doll Moved Again. No One Was Home. | PT1M20S | 2026-04-27 |
| `qjBL4zRIFbg` | She's Not Running Away. She's Hunting. | PT1M7S | 2026-04-23 |
| `BOtFWCENtTc` | She Asked for Directions. She Should've Run. | PT1M25S | 2026-04-15 |
| `VEmf9eq62zo` | Something Is Wrong With My Reflection | PT2M19S | 2026-04-26 |
| `QMRlBqAdNGg` | He Streamed the Challenge. The Monster Streamed Back. | PT39S | 2026-04-30 |
| `nuMPi_Rnxg0` | Cosplay showcase (unlisted) | — | — |

### Remaining TODOs
- ~~Person schema~~ — done: 3 founders (Sonia, Marco, Daniele Sangalli) with `jobTitle`/`description`/`worksFor`, linked from `Organization.founder`
- Update VideoObject entries when new Shorts are published
- Submit new URLs to IndexNow after each deploy:
  ```bash
  curl -X POST "https://api.indexnow.org/indexnow" \
    -H "Content-Type: application/json" \
    -d '{"host":"twentyseven.pictures","key":"bdd5e80e21a8430d9316de0deacdb208","keyLocation":"https://twentyseven.pictures/bdd5e80e21a8430d9316de0deacdb208.txt","urlList":["https://twentyseven.pictures/"]}'
  ```

## Git Workflow

- **Main branch:** `main`
- **Remote:** `git@github.com:xibitdigital/27-pictures-website.git`
- **Contributors:**
  - Marco Sangalli (sangalli.marco@gmail.com)
  - Daniele Sangalli (daniele@xibitdigital.com)
