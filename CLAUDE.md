# Claude Code Instructions

## Code Formatting

**Always format with Prettier** after making changes:

```bash
npm run format
# or: npx prettier --write "src/**/*.{vue,ts,js,css,html,json}" "public/**/*.{css,html,js,json}" "vite/**/*.ts"
```

## CSS Guidelines

**Never hardcode colors.** Always use CSS custom properties defined in `:root`.

### Available CSS Variables

```css
:root {
  /* Backgrounds */
  --bg: #030303; /* Main background */
  --bg-dark: #000; /* Pure black sections */
  --bg-card: #111; /* Card/frame backgrounds */
  --bg-assembly: #050505; /* Assembly section */

  /* Text */
  --text: #fff; /* Primary text */
  --text-muted: #ccc; /* Secondary/muted text */
  --silver: #888; /* Tertiary text */

  /* Accent Colors */
  --red-smile: #b30000; /* Primary accent (brand red) */
  --success: #4caf50; /* Success states */

  /* Borders */
  --border: #222; /* Dark borders */
  --border-light: #333; /* Light borders (forms) */

  /* Animation */
  --transition: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Usage Examples

```css
/* Good */
.element {
  color: var(--text);
  background: var(--bg-card);
}

/* Bad - never do this */
.element {
  color: #fff;
  background: #111;
}
```

## Project Structure

```
27-pictures-website/
├── src/                     # Vite root (Vue 3 + TS MPA entries)
│   ├── index.html           # Homepage
│   ├── experiments/         # Experiments lab
│   ├── site/                # SiteNav, ContactForm, directives
│   ├── toons/bookReader/    # FlipFrame package
│   ├── toons/jax|erin|nero/ # Toon apps
│   └── test/setup.ts        # Vitest (forces empty VITE_ASSET_BASE)
├── content/toons/           # Editable config.json per toon (publish → R2)
├── public/                  # Static → site root in dist/
│   ├── styles.css, logo.png, the-red-smile.jpg, qr.html, …
│   ├── toons/               # reader-shared.css; assets on R2
│   │   └── **/assets/       # gitignored (R2 only)
│   ├── card-art/            # gitignored posters (R2)
│   ├── sitemap.xml          # uses %VITE_ASSET_BASE% for card images
│   └── _headers             # CSP + cache (allow R2 + CF Insights)
├── vite/plugins/cdnMedia.ts # hard CDN gate + token expand + strip media
├── scripts/
│   ├── lib/r2-media.js      # shared R2 put/lock
│   ├── upload-r2-assets.js
│   ├── add-toon-image.js
│   ├── serve-protected.js
│   ├── hash-assets.js
│   └── generate-qr.js
├── worker/                  # Contact form Worker
├── dist/                    # build output (deploy this)
├── Makefile
└── .env.example
```

## Deployment

### Website (Cloudflare Pages)

**Artifact:** `dist/` (not raw `public/`).
**Domain:** `twentyseven.pictures`.

```bash
# .env must set VITE_ASSET_BASE or `vite build` fails
make deploy        # require base → build → Pages production (main)
make deploy-cdn    # upload R2, then make deploy
make preview-deploy  # CDN build → preview branch
```

### Local

```bash
make dev           # Vite on 127.0.0.1 (set VITE_ASSET_BASE so toon media loads)
make local         # serve dist/ + HTTP Basic Auth (127.0.0.1)
make local-cdn     # require base → CDN build → protected serve
make test          # unit tests (CDN base forced empty)
```

`PREVIEW_USER` / `PREVIEW_PASS` in `.env` (empty pass on `make local` → random printed once).

### Media on R2 (CDN) — required

Binary media is **not in git**. `VITE_ASSET_BASE` is **required** for `npm run build`
and all deploy targets (**hard fail** if missing). Vitest sets `VITE_ASSET_BASE=""` so
tests never inherit a developer `.env`.

```bash
# .env (required for build/deploy)
VITE_ASSET_BASE=https://pub-e60c8fa8eea343fbac708bf75981d19c.r2.dev
# or: VITE_ASSET_BASE=https://assets.twentyseven.pictures

make deploy        # require base + build + Pages
make deploy-cdn    # upload R2 first, then deploy
```

Static card-art URLs use the token **`%VITE_ASSET_BASE%/card-art/…`** in HTML/sitemap
(expanded at build by `vite/plugins/cdnMedia.ts`).

Local workflow for **new** plates:

1. `make add-image SRC=… TOON=jax` → writes under `public/toons/…/assets/` (untracked)
2. `make add-image … UPLOAD=1` or `npm run upload-assets` → R2
3. Commit only manifest/words changes, not the binaries

- Readers: `resolveAssetUrl()` + `asset-page-dir` on `ToonReaderShell`
- Keys: `toons/jax/assets/<hash>.jpg`, `card-art/erin.jpg`
- Shared put/lock: `scripts/lib/r2-media.js`
- One-time: `npm run create-assets-bucket` && `npm run upload-assets -- --setup-cors`

### Adding a new toon page image

Images are content-hashed (`md5.ext`) under `public/toons/<toon>/assets/` — same convention as
Jax / Erin / Nero plates. Prefer the one-shot command (watermark + hash + R2):

```bash
# Watermark + hash + optional local stage
make add-image SRC=~/Downloads/page17.jpg TOON=jax

# Upload to R2 + append page to content/ config + publish hashed config
make add-image SRC=~/Downloads/page17.jpg TOON=jax CONFIG=1 UPLOAD=1

# npm equivalent (toon: jax | erin | nero)
npm run add-image -- ~/Downloads/page17.jpg --toon nero --config --upload
```

What it does:

1. Copies the source into a temp dir
2. Bakes `twentyseven.pictures` (ImageMagick via `scripts/watermark-images.sh`) unless `--no-watermark`
3. Renames by **md5 of the final bytes** → `assets/<md5>.jpg` (CDN key `toons/<toon>/assets/…`)
4. `--config` / `--manifest` — appends the page to `content/toons/<toon>/config.json` and publishes
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

## Toon Reader (FlipFrame — Erin, Jax, Nero, …)

Readers are **Vue apps** under `src/toons/`, not the old standalone JS shells.

| Path                                 | Role                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `src/toons/bookReader/`              | FlipFrame package: engine, shell, chrome, captions, audio |
| `src/toons/jax/` · `erin/` · `nero/` | App entry + `ToonReaderShell` config                      |
| `content/toons/<name>/config.json`   | **Edit here** — pages list, captions, audio paths         |
| `src/toons/config-lock.json`         | Points prod at `config.<md5>.json` on R2                  |
| `public/toons/reader-shared.css`     | Shared book chrome + word/bubble CSS (all toons)          |
| `public/toons/**/assets/`            | **Gitignored** — load via `VITE_ASSET_BASE`               |

| Toon | URL            | Notes                                                                                                                  |
| ---- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Erin | `/toons/erin/` | Page-turner prototype                                                                                                  |
| Jax  | `/toons/jax/`  | Netrunner / Robin Hood of mind-tech; cover synopsis + multilingual SFX (see `content/toons/jax/README.md`)             |
| Nero | `/toons/nero/` | Scotland Yard case — Nero, Eve, The Dog; page 4 = _HOURS EARLIER_ flashback plate (see `content/toons/nero/README.md`) |
| RED SMILE: static | `/toons/redsmile-static/` | B&W horror short — Elena alone at home, a flickering TV, something watching back; plates from `/horror-toon-page` |

Wire-up pattern:

```vue
<ToonReaderShell
  alt-prefix="Jax"
  :config-url="toonConfigUrl('jax')"
  asset-page-dir="/toons/jax/"
  front-cover-logo="/logosquare.png"
  :cover-texture="COVER_TEXTURE"
  :book-options="bookOptions"
/>
```

- **`config-url`** — `toonConfigUrl("<toon>")` (dev → `content/`; prod → locked CDN hash).
- **`asset-page-dir`** is required so relative plate/SFX paths resolve on the CDN.
- Product attribution **“FlipFrame — by twentyseven.pictures”** lives in
  `FrontCoverInstructions.vue` (shared), not per-toon config.

```bash
# After editing content/toons/<toon>/config.json
npm run publish-toon-config -- --toon jax   # or erin | nero
# Deploy site so config-lock.json is live
```

### Reader chrome (progress bar, back link)

There is **no page-number indicator**. Reading position is a fixed hairline
progress bar (`chrome/ReadingProgress.vue`, `.toon-progress` in
`reader-shared.css`): 4px, top of the viewport on desktop, **bottom edge under
768px** (safe-area inset on `padding-bottom`, so the fill clears the home
indicator). Book mode drives it from `engine.state.progress` (view index / last
index), scroll mode from document scroll.

- `state.indicator` still holds "3 / 20" — it feeds `aria-valuetext`, so the
  count stays available to screen readers. Do not delete it.
- The old `.controls` / `#indicator` element now renders **only** when
  `engine.state.error` is set; it is the sole surface for "Failed to load" /
  "No pages found".
- The top-left logo links to `/experiments/`, not the homepage — readers are
  reached from the lab, and the back cover already pointed there.
- Content pages carry a small folio (page number) bottom-left, drawn purely in
  CSS from the `data-page-num` attribute that `BookSlot` / `FlipLeaf` /
  `VerticalStrip` already set. Covers have no attribute, so they stay
  unnumbered, and no plate on the CDN is modified. It sits at `z-index: 33` —
  above `.nav-zone` (30), below the word overlay (35).
- Reader padding is sized for that 4px bar, not for the old counter row. Book
  mode keeps ~2.75rem of top padding so the spread clears the fixed top-right
  controls; the side gutter stays >=52px because the page-nav buttons hang 22px
  past each edge.

### What goes where (CSS)

A toon entry’s own `<style>` should contain **only**:

1. Book-aspect tokens (`--book-width`, `--book-height`, `--page-bg`, …) + fullscreen/single-page overrides.
2. Genuinely unique extras (e.g. Jax language switcher / music chrome).

Everything shared belongs in `public/toons/reader-shared.css` — including
`.jax-word*` / bubble SVG chrome (class names are historical; used by every
toon). Caption pages should load **Bangers** + **VT323** from Google Fonts.

### Cache-busting shared CSS (`?v=<hash>`)

`styles.css` and `toons/reader-shared.css` are linked with `?v=<sha256 prefix>`.
Automatic:

```bash
npm run hash-assets   # also runs as part of npm run build
```

Rewrites references under `src/**/*.html` (and legacy public HTML if present).

## Toon captions / SFX (ElevenLabs)

Captions live in **`content/toons/<toon>/config.json`** under each page’s
`words[]` (not legacy `public/toons/*/words.json`). Optional
`"audio": "assets/sfx/<md5>.mp3"` is resolved via `asset-page-dir`.

SFX/music binaries are content-hashed and live on **R2** (not in git).

Playback is in `src/toons/bookReader` caption code. Caption SFX play on tap
(no mute gate). Background music toggle lives in `JaxApp.vue` (`BG_MUSIC` via
`resolveAssetUrl`). Shared `useSoundGate` remains available for other toons
that want an opt-in SFX prompt.

**Bubble variants (word overlays):**

| `variant` | Look                             | Use                |
| --------- | -------------------------------- | ------------------ |
| `bubble`  | Organic speech balloon           | Character dialogue |
| `burst`   | Spiky shout                      | Impact lines       |
| `ai`      | Dark HUD + optional `N›` prefix  | Nova / good system |
| `badai`   | Inverted light HUD + `!›` prefix | Hostile AI         |
| `credit`  | Bangers, muted                   | End-card colophon  |

**Caption placement:** put each caption in the **top band of its own panel**
(`panel_top + ~0.04` in page-normalised `y`) and hug `x` to the outer edge —
never over a face, never centred on the speaker. Work out the panel bands
first: a 3-panel plate is roughly `.03–.31 / .34–.63 / .66–.97`, a 4-panel one
`.03–.24 / .26–.47 / .50–.71 / .73–.97`.

**Tails do the pointing.** `bubble.tail` aims back at whatever makes the sound
— the speaker's head, the hand on the object, the TV — using all eight values
(`top`, `bottom`, `left`, `right` + the four diagonals, see `BUBBLE_TAIL_TIPS`
in `bubbles.ts`). Diagonals are the common case; a caption in the top band
almost always wants `bottom-left` / `bottom-right`.

**Chrome to match the book:** every variant carries
`bubble: { "opacity": 0.75, "strokeWidth": 5 }` (bursts included) so lettering
never sits on flat white. Onomatopoeia over dark plates also take
`"stroke": "#ffffff"`, `"strokeThickness": 8` to lift off the ink.

**Auto-read follows array order**, not position on the page. An SFX that should
land before a line has to sit before it in `words[]` — e.g. the phone buzz
opens RED SMILE page 1, the hinge whine opens its page 7.

**Word-layer z-index matters**: `.nav-zone` (the full-height page-turn click
areas) sits at `z-index: 30`. The word overlay layer must stay above it
(`z-index: 35` in `words.ts`) or nav-zone silently wins hit-testing and no
hover/click ever reaches the word captions — this was a real regression once,
don't reintroduce it. Bubbles (and any word with audio) must capture clicks
(`pointer-events: auto` + `stopPropagation`).

### Regenerating / adding SFX clips (Jax)

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
   exact `"audio": "assets/sfx/<hash>.mp3"` lines to paste into that toon’s
   `content/toons/…/config.json`.
4. Update the matching word entry/entries (multiple entries can share one clip).

> **`--force` regenerates every slug in the manifest, not just the new one**,
> and the script deletes the previous file whenever a hash changes. That wipes
> locally staged clips other toons' configs still point at (R2 is untouched, so
> production keeps working). To redo a single clip: change its `prompt`, delete
> just that slug's entry from `scripts/jax-sfx-lock.json`, and run **without**
> `--force`. If `--force` already ran, restore with
> `git checkout scripts/jax-sfx-lock.json` + `npm run backup-cdn` files from
> `cdn-backup/`.

Clips land in `public/toons/jax/assets/sfx/` regardless of which toon needs
them — move them to `public/toons/<toon>/assets/sfx/` before referencing, or
`asset-page-dir` 404s on the CDN.

**Audibility:** ambient beds (static, breath, drones) often come back too quiet
to hear under playback. Check before shipping and boost anything below ~-20 dB
mean:

```bash
ffmpeg -hide_banner -nostats -i clip.mp3 -filter:a volumedetect -f null /dev/null 2>&1 | grep mean_volume
ffmpeg -y -i clip.mp3 -af "volume=12dB" -codec:a libmp3lame -b:a 192k /tmp/out.mp3
# rename to md5 of the new bytes, update config, re-upload
```

### Generating a spoken voice line (dialogue, not onomatopoeia)

Onomatopoeia (`CLANK`, `WHOOSH`, …) go through `generate-jax-sfx.py` (Sound
Effects API — non-verbal). Actual dialogue should be Text-to-Speech:

1. Voices are locked by name in `scripts/jax-voices.json` (`name ->
voice_id`). Current cast includes: `jax`, `riu`, `nova`, `ripperdoc`,
   `badai`, `nero`, `thedog`, `eve`, `barman`, `elena`, `narrator`. To add a new one: open the voice
   on `elevenlabs.io/app/voice-library?voiceId=...`, copy the ID from the URL,
   add `"name": "voiceId"` to that file. (Listing/searching voices via
   `GET /v1/voices` needs a separate `voices_read` scope — grab the ID from
   the dashboard URL instead.)
2. Run:

   ```bash
   set -a; source .env; set +a
   # Plain line (default model: eleven_multilingual_v2)
   python3 scripts/generate-jax-voice.py "Too slow, man!" --voice jax
   python3 scripts/generate-jax-voice.py "Contract closed." --voice thedog --toon nero

   # Emotional / directed delivery — MUST use Eleven v3 + audio tags
   python3 scripts/generate-jax-voice.py "[scared] Nero—!" \
     --voice eve --toon nero --model eleven_v3 --stability 0.3
   ```

   `--toon` writes under `public/toons/<toon>/assets/sfx/<md5>.mp3` so
   `asset-page-dir` resolves on the CDN (default toon is `jax`). Prints the
   `"audio": "assets/sfx/<hash>.mp3"` line to paste into config.

3. Paste into `content/toons/<toon>/config.json`, then
   `npm run upload-assets` and `npm run publish-toon-config -- --toon <toon>`.

#### Metallic voice pass for `ai` captions

HUD/AI readouts (`variant: "ai"` — Nova's `N›`, Eve's glasses `E›`) run their
TTS through an ffmpeg chain so the machine voices do not sound human. Apply it
to a fresh clip before pasting the hash into config:

```bash
ffmpeg -y -i in.mp3 -af "highpass=f=180,lowpass=f=7000,\
acrusher=bits=10:mode=log:mix=0.22,chorus=0.7:0.9:14:0.5:0.35:2,\
aecho=0.85:0.7:5:0.32,aphaser=type=t:speed=1.1:decay=0.28,dynaudnorm=f=200:g=5" \
  -codec:a libmp3lame -b:a 192k /tmp/out.mp3
HASH=$(md5 -q /tmp/out.mp3)   # rename to <hash>.mp3, this is the config path
```

The comb `aecho` at 5 ms is what reads as metal; `acrusher` adds the digital
edge; `dynaudnorm` keeps it level with the spoken lines. Duration grows by the
echo tail only (~25 ms). `badai` is deliberately left dry — the hostile AI
should not share Nova's timbre.

#### Eleven v3 audio tags (emotion / delivery)

Bracketed tags are **performance direction**, not spoken words. They only work
with **`model_id: eleven_v3`** (`--model eleven_v3`). On
`eleven_multilingual_v2` / turbo they are ignored (or may be read aloud).

| Kind      | Examples                                                                             |
| --------- | ------------------------------------------------------------------------------------ |
| Emotions  | `[scared]`, `[worried]`, `[nervously]`, `[excited]`, `[angry]`, `[sad]`, `[curious]` |
| Delivery  | `[whispers]`, `[shouts]`, `[softly]`, `[flatly]`                                     |
| Reactions | `[gasps]`, `[sighs]`, `[laughs]`, `[gulps]`, `[exhales]`                             |

Combine tags for layered delivery:

```bash
python3 scripts/generate-jax-voice.py "[gasps] [scared] Nero—!" \
  --voice eve --toon nero --model eleven_v3 --stability 0.3
```

- **Stability:** lower / Creative (~0.2–0.35) is more responsive to tags;
  higher / Robust is flatter and less tag-sensitive.
- Caption **display text** in `config.json` stays clean (`"Nero—!"`); only the
  TTS input string carries tags.
- Official docs: [TTS best practices → Prompting Eleven v3 → Audio tags](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
  and [Audio tags 101](https://elevenlabs.io/blog/v3-audiotags).

### Replacing the background track

```bash
ffmpeg -y -i <source> -codec:a libmp3lame -b:a 192k /tmp/bg.mp3
HASH=$(md5 -q /tmp/bg.mp3)
mkdir -p public/toons/jax/assets/music
mv /tmp/bg.mp3 "public/toons/jax/assets/music/$HASH.mp3"
npm run upload-assets   # push to R2 (path is gitignored)
```

Update `BG_MUSIC` in `src/toons/jax/JaxApp.vue` to the new hash, then deploy.
Do not commit the binary.

## SEO State

### Completed

- Page title: `27 Pictures | AI Horror Shorts & Cinematic Cosplay Production`
- Meta description updated (matches YouTube channel description)
- JSON-LD schema: Organization, WebSite, WebPage, CreativeWorkSeries, 6× VideoObject, 2× Service
- Person schema: 3 founders (Sonia, Marco, Daniele Sangalli) with `jobTitle`/`description`/`worksFor`, linked from `Organization.founder`
- Organization location: Switzerland & United Kingdom
- IndexNow key deployed + submitted (`bdd5e80e21a8430d9316de0deacdb208`)
- All VideoObject uploadDates and durations use real YouTube values
- `public/llms.txt` — AI crawler allow-list + key pages (aligned with robots)
- `public/robots.txt` — search + AI _citation_ crawlers allowed; QR landing blocked

### Crawlers / AI search policy (2026-07)

**Intent:** maximize classic search + AI search / citation visibility. Block only aggressive bulk scrapers.

| File                              | Role                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/robots.txt`               | Authoritative crawl rules shipped in `dist/`                                                                                                    |
| `public/llms.txt`                 | Human/AI policy note; must stay consistent with robots                                                                                          |
| Cloudflare **AI Crawl Control**   | Per-bot **Block** toggles (leave **off** for GPT/Claude/Google/Perplexity)                                                                      |
| Cloudflare **managed robots.txt** | **Must stay disabled** — when enabled it prepends `Disallow: /` for GPTBot, ClaudeBot, Google-Extended, etc. and conflicts with our Allow rules |

**Allowed explicitly in robots:** GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, meta-externalagent (+ default `User-agent: * Allow: /`).

**Disallowed:** Bytespider, CCBot, `/qr.html`, `/qr`.

**Verify after CF changes:**

```bash
curl -sS https://twentyseven.pictures/robots.txt
# Expect: no "# BEGIN Cloudflare Managed content", GPTBot/ClaudeBot → Allow: /
```

**Do not re-enable** Cloudflare “Block AI scrapers” / managed robots for this zone without updating both files and this section.

### Video ID → Title Map (as of 2026-05)

| YouTube ID    | Title                                                 | Duration | Upload     |
| ------------- | ----------------------------------------------------- | -------- | ---------- |
| `J-iZl-XkVxg` | The Doll Moved Again. No One Was Home.                | PT1M20S  | 2026-04-27 |
| `qjBL4zRIFbg` | She's Not Running Away. She's Hunting.                | PT1M7S   | 2026-04-23 |
| `BOtFWCENtTc` | She Asked for Directions. She Should've Run.          | PT1M25S  | 2026-04-15 |
| `VEmf9eq62zo` | Something Is Wrong With My Reflection                 | PT2M19S  | 2026-04-26 |
| `QMRlBqAdNGg` | He Streamed the Challenge. The Monster Streamed Back. | PT39S    | 2026-04-30 |
| `nuMPi_Rnxg0` | Cosplay showcase (unlisted)                           | —        | —          |

### Remaining TODOs

- Update VideoObject entries when new Shorts are published
- Add more indexable hub pages (series / cosplay) when ready — sitemap is still thin
- Submit new URLs to IndexNow after each public URL change:
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
