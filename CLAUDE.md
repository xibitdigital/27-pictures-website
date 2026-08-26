# Claude Code Instructions

## Code Formatting

**Always format with Prettier** after making changes:

```bash
npm run format
# or: npx prettier --write "src/**/*.{vue,ts,js,css,html,json}" "public/**/*.{css,html,js,json}" "vite/**/*.ts"
```

## DOM Guidelines

**Never target an element by class name.** Class names belong to styling — a
rename in CSS silently breaks any script that queried it, and the coupling is
invisible from either side. Reach for, in order:

1. A **template ref** (or the element a child already emits, e.g. the slot list
   `VerticalStrip` hands to `onStripReady`) — no lookup at all.
2. A **`data-*` attribute** that states intent: `[data-page-num="3"]`,
   `[data-quick-view]`, `[data-series-page]`.
3. A **semantic selector** — `a[href]`, `img`, `[role="dialog"]`.

Adding a class purely so `<body>` can be styled (`body.dialog-open`) is fine:
that is a CSS hook written _to_ the DOM, not a query read _from_ it.

## CSS Guidelines

**Reach for a native CSS layout before scripting one.** If a panel will not
size or scroll, fix the box model — a definite height, a real scrollport, the
right containing block — instead of measuring in JS and writing inline styles
back. Scripted geometry (pinning `position: fixed` at `-scrollY`, restoring
scroll offsets, flushing reflows) is a repair for a layout that was already
wrong, and it fails differently on every engine.

Worked example: the mobile cover guide would not scroll on iOS. Three rounds of
JS body-locking, offset pinning and scroll restoration all failed; the actual
fix was one media query — on `(pointer: coarse)` the guide is a full-screen
sheet whose height is `100%` of a `position: fixed; inset: 0` parent, so the
scrollport finally has a definite box. All the JS came back out.

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

## Component Guidelines

**Reuse the component; do not re-cut it.** If two places show the same thing,
they share one implementation and differ by a container, a prop or a token —
never by a second copy that starts identical and drifts.

Three ways this has actually gone wrong here, each with the fix:

- **A second layout for the same card.** The quick-view dialog and the series
  page both list episodes. The dialog got its own grid under `.episode-block`,
  which also matched the page — so the page silently lost the card layout it
  shared with `/toons/`, and the dialog's rules had to fight a card they were
  never written for. Fix: the row density is scoped to `.episode-dialog`, and
  both surfaces use the same `.series-card` / `.series-grid`. **Density is a
  property of the container, not of a different card.**
- **A second copy of the same strings.** `ContactForm.vue` and `SiteNav.vue`
  hardcoded English while every page around them was translated, because the
  locale-page generator rewrites HTML templates and cannot reach inside a Vue
  component. Fix: both read `<html lang>` via `documentLocale()` and pull from
  the one `UI` table in `src/site/i18n.ts`. **A component that renders text owns
  no text.**
- **A second page that began as a copy.** `/toons/red-smile/`, `/toons/nero/`
  and `/toons/jax/` are the same series page as `/toons/erin-and-the-goblins/`.
  They share `seriesPageMain.ts`, the `[data-series-page]` region, the CSS and
  the schema shape; only copy and the `SERIES` entry differ. Adding a series
  should be a template plus a locale JSON, never a new layout.

Before adding a variant, ask which of these it is:

1. **Same thing, different container** → scope the difference to the container
2. **Same thing, different content** → pass a prop, or key off existing data
   (`SERIES`, the `UI` table, `<html lang>`)
3. **Genuinely a different thing** → a new component, and say why in a comment

`src/toons/series.ts` is the worked example of (2): one registry knows which
books are episodes of what, and the readers' back covers, the `/toons/` cards,
the series pages and the schema all read from it. A page that hardcodes an
episode list has already forked.

## Project Structure

```
27-pictures-website/
├── src/                     # Vite root (Vue 3 + TS MPA entries)
│   ├── index.html           # Homepage
│   ├── cosplay/             # /cosplay/ service page
│   ├── horror-shorts/       # /horror-shorts/ Red Smile hub
│   ├── site/                # SiteNav, ContactForm, per-page entries
│   ├── toons/index.html     # /toons/ — Interactive Toons index (was /experiments/)
│   ├── toons/bookReader/    # FlipFrame package
│   ├── toons/jax|erin|nero|redsmile-static/  # Toon apps
│   └── test/setup.ts        # Vitest (forces empty VITE_ASSET_BASE)
├── content/toons/           # Editable config.json per toon (publish → R2)
├── docs/story/              # Series bible + cast bios — never shipped
├── public/                  # Static → site root in dist/
│   ├── styles.css, logo.png, the-red-smile.jpg, qr.html, …
│   ├── toons/               # reader-shared.css; assets on R2
│   │   └── **/assets/       # gitignored (R2 only)
│   ├── card-art/            # gitignored posters (R2)
│   ├── sitemap.xml          # uses %VITE_ASSET_BASE% for card images
│   ├── _redirects           # 301 /experiments* → /toons/
│   └── _headers             # CSP + cache (allow R2 + CF Insights)
├── vite/plugins/cdnMedia.ts # hard CDN gate + token expand + strip media
├── scripts/
│   ├── lib/r2-media.js      # shared R2 put/lock
│   ├── upload-r2-assets.js
│   ├── add-toon-image.js
│   ├── swap-toon-page.js       # replace a plate, keep its captions
│   ├── normalise-toon-audio.py # EBU R128 + true-peak levelling
│   ├── purge-r2-objects.js     # delete superseded CDN objects
│   ├── backup-cdn-assets.js    # cdn-backup/ before any purge
│   ├── serve-protected.js
│   └── generate-qr.js
├── worker/                  # Contact form Worker
├── dist/                    # build output (deploy this)
├── Makefile
└── .env.example
```

## Deployment

### Website (Cloudflare Pages)

**Artifact:** `dist/` (not raw `public/`).
**Usual path:** push the branch; GitHub Actions builds and deploys.
**Workflow:** `.github/workflows/deploy.yml` (Node 24, `wrangler@4.86.0`).

| Push to | Pages project | Site |
| --- | --- | --- |
| `staging` | `twentyseven-pictures-staging` | https://staging.twentyseven.pictures |
| `main` | `twentyseven-pictures` | https://twentyseven.pictures |

A push never updates both. Merge `staging` → `main` to ship production. Manual
runs from the Actions tab use whichever branch you pick.

Each Actions run, in order:

1. Hash every `content/toons/*/config.json` and put **new** objects on R2
   (`config.<md5>.json` — each toon keeps its own md5; unchanged books skip the
   put). Rewrite `src/toons/config-lock.json` **in the job**.
   `CLOUDFLARE_API_TOKEN` must include **Workers R2 Storage: Admin Read & Write**.
   Wrangler talks to the REST API; Object Read & Write tokens (and Pages Edit
   alone) 403 with `Authentication error [code: 10000]`. Unchanged hashes hide
   this until a config actually changes.
2. `npm run build` so the JS bundle asks for those names.
3. `wrangler pages deploy dist` to that branch's Pages project.
4. Prune superseded unique `<hash>.<project>.pages.dev` snapshots. Keep the
   newest (the live custom domain) and any still-aliased deploy; never
   `--force`.

The unique `pages.dev` URL **is** that snapshot — deleting the current one
takes the custom domain down. Cloudflare always mints it; the job summary
lists only the custom hostname. Those aliases use the same HTTP Basic Auth as
staging.

**Staging is `https://staging.twentyseven.pictures` and is password gated** —
it answers 401 without credentials (Cloudflare Pages secrets), so `curl`
checks against it need auth. To verify a deploy without credentials, grep the
built `dist/assets/*.js` instead (cover copy stamps `VITE_FLIPFRAME_BUILD` =
git short SHA). The old `staging.twentyseven-pictures.pages.dev` alias is
gone; `<hash>.twentyseven-pictures-staging.pages.dev` still exists for the
current snapshot and is password gated the same way.

Local wrangler still works when you need it:

```bash
# .env must set VITE_ASSET_BASE or `vite build` fails
make deploy        # require base → build → Pages production (main)
make deploy-cdn    # upload R2, then make deploy
make preview-deploy  # CDN build → staging project
```

**A toon config JSON is not the live book until the lock is in the bundle.**
Actions publishes configs before build, so a push of `content/toons/*/config.json`
is enough for the JSON. New **plates and audio** still have to be on R2 first
(`make ship` / `upload-assets`) or the reader 404s. Local `vite` reads
`content/` via `/__dev/toon-config/` and will look different from staging until
you push.

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

Local workflow for **new** plates — pick the tool in _Adding a new toon page
image_ below. Do not start from `add-image` for Erin/Nero WebP books.

- Readers: `resolveAssetUrl()` + `asset-page-dir` on `ToonReaderShell`
- Keys: `toons/jax/assets/<hash>.jpg`, `card-art/erin.jpg`
- Shared put/lock: `scripts/lib/r2-media.js`
- One-time: `npm run create-assets-bucket` && `npm run upload-assets -- --setup-cors`

### Plate colour: keep toons neutral greyscale

Seedream returns a faint colour cast on every generation — measured 0.3-1.2
(of 255) mean per-pixel deviation from grey across Nero, which reads as a blue
tone on dark plates. Flatten before publishing:

```bash
magick <src> -colorspace Gray -colorspace sRGB /tmp/flat.png
# check any plate: 0 = truly neutral
magick <file> \( +clone -colorspace Gray \) -compose difference -composite \
  -colorspace Gray -format "%[fx:mean*255]\n" info:
```

Re-swapping an already-published plate uses `--no-watermark`, or the site
stamp gets baked in twice:

```bash
node scripts/swap-toon-page.js /tmp/flat.png --toon nero --page 7 --no-watermark
npm run publish-toon-config -- --toon nero   # once, after a batch of swaps
```

### Purging superseded plates from R2

`swap-page` never deletes the plate it replaces, so re-rolls accumulate.
Purge them in a batch, and only ever after a fresh backup:

```bash
npm run backup-cdn                              # must cover every key first
node scripts/purge-r2-objects.js --file keys.txt
```

Build `keys.txt` by diffing `scripts/r2-assets-lock.json` against everything
referenced by `content/toons/*/config.json`, `src/toons/config-lock.json` and
`grep`-able paths in `src/` + `public/`. Verify each key exists under
`cdn-backup/` before deleting — the bucket delete is irreversible.

### ComfyUI workflows (`workflows/`)

Alternative to `scripts/generate-toon-page.py`, which calls the RunComfy
**model API** rather than ComfyUI itself:

| File                               | Format | Use                                           |
| ---------------------------------- | ------ | --------------------------------------------- |
| `workflows/nero-seedream.json`     | UI     | Drag onto the canvas, edit visually           |
| `workflows/nero-seedream.api.json` | API    | `POST /prompt`; named inputs, no widget drift |

`LoadImage ×3 → ImageBatch → ImageBatch → ByteDanceSeedreamNode → SaveImage`.
The batch chain fixes the reference order as **Nero sheet, Eve sheet, previous
page**, which is what the prompt's `Image 1/2/3` pins refer to — rewire it and
the pins point at the wrong pictures. Full notes in `workflows/README.md`.

Two gotchas: the node's model list differs from the model API (check the
dropdown for the Pro entry), and its minimum width is 1024, so the graph
renders 1024×1792 while the prompt still says 1008×1792.

### Adding a new toon page image

`TOON` is the **folder under `content/toons/`**, not a display name:
`jax` · `erin` · `erin-the-revenge` · `nero` · `redsmile-static`.
`add-image` warns “unknown toon” for anything outside `jax|erin|nero` — ignore
it; dest is still `public/toons/<toon>/assets/` and the R2 key is
`toons/<toon>/assets/<md5>.<ext>`. `swap-page` needs that folder’s
`config.json`. Flatten colour first (see _Plate colour_ above). Do **not**
`--publish` / `CONFIG=1` / `make ship` unless asked.

Pick the tool by what the page is doing:

| Job | Tool | Why |
| --- | --- | --- |
| **Replace** page N (keep captions) | `make swap-page SRC=… TOON=… PAGE=N` | watermark → WebP q90 → hash → R2 → rewrite `pages[N-1].file` |
| **Append** at the end | `make swap-page SRC=… TOON=…` (omit `PAGE`, or pass count+1) | same pipeline; new page with `words: []` |
| **Insert mid-list** (e.g. after page 3) | flatten + watermark + WebP by hand, then splice `config.json` | `swap-page` **cannot insert** — `PAGE=4` on a 17-page book *replaces* page 4 |
| Stage a raw JPG/PNG, no WebP | `make add-image SRC=… TOON=jax` | keeps the source extension; `--config` **only appends** and publishes |

Erin EP 2 / Nero / RED SMILE plates are **WebP**. `add-image` will upload a
PNG if that is what you hand it — use `swap-page` (or the mid-insert recipe)
so the book stays WebP.

```bash
# Replace page 7, keep its words[] (flatten first)
magick ~/Downloads/plate.png -colorspace Gray -colorspace sRGB /tmp/flat.png
make swap-page SRC=/tmp/flat.png TOON=nero PAGE=7

# Already watermarked? skip the stamp or it bakes in twice
make swap-page SRC=/tmp/flat.png TOON=nero PAGE=7 ARGS='--no-watermark'

# Append
make swap-page SRC=/tmp/flat.png TOON=erin-the-revenge

# Dry-run
make swap-page SRC=/tmp/flat.png TOON=erin-the-revenge PAGE=4 DRY=1
```

`swap-page` always uploads the plate. It does **not** write
`public/toons/<toon>/assets/` (that dir is gitignored staging for `add-image`).
Without `PUBLISH=1` it prints `npm run publish-toon-config -- --toon <toon>`
instead of running it. It never deletes the old R2 object — purge later.

#### Insert mid-list (swap-page cannot do this)

`PAGE=N` with `N <= count` replaces. To put a new plate **after** page 3,
process the bytes, then `splice(3, 0, …)` into `pages[]`. Worked example
(Erin EP 2 descent, 2026-08):

```bash
SRC=~/Downloads/erin-generate_scene_00001_\ \(3\).png
TOON=erin-the-revenge
WORK=$(mktemp -d)

magick "$SRC" -colorspace Gray -colorspace sRGB "$WORK/plate.png"
bash scripts/watermark-images.sh "$WORK" --text twentyseven.pictures --force
magick "$WORK/plate.png" -quality 90 -define webp:method=6 "$WORK/plate.webp"

# hash + R2 + local staging (no --config — that would append)
node scripts/add-toon-image.js "$WORK/plate.webp" \
  --toon "$TOON" --no-watermark --upload --keep-local
# prints: config path: "assets/<md5>.webp"
```

Then splice — index `3` is “after page 3” — and add `words[]` by hand:

```js
// node, from repo root
const fs = require("fs");
const p = "content/toons/erin-the-revenge/config.json";
const data = JSON.parse(fs.readFileSync(p, "utf8"));
data.pages.splice(3, 0, { file: "assets/<md5>.webp", words: [/* captions */] });
fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
```

Vite dev reads `content/toons/<toon>/config.json` via `__dev/toon-config`, so
the new page shows locally once the plate is on R2 (`VITE_ASSET_BASE`). Staging
and production still serve the **locked** hashed config until
`make ship TOON=<toon>`.

After an insert, bump page counts (reader fallback, series `pages`, locales
`ep2Cue`, `llms.txt`) and rename `docs/story/<series>/eN/prompts/` files from
the high number down so names do not collide.

#### `add-image` (JPG/PNG append / local stage only)

```bash
make add-image SRC=~/Downloads/page17.jpg TOON=jax              # local stage
make add-image SRC=~/Downloads/page17.jpg TOON=jax UPLOAD=1     # + R2
make add-image SRC=~/Downloads/page17.jpg TOON=jax CONFIG=1 UPLOAD=1  # + append + publish
```

1. Temp copy → `watermark-images.sh` unless `--no-watermark`
2. Rename by **md5 of the final bytes** → `assets/<md5>.<ext>` (keeps jpg/png/webp)
3. `--upload` → R2 + `scripts/r2-assets-lock.json`
4. `--config` / `--manifest` → **append** to `content/toons/<toon>/config.json` and publish

Batch watermark only (no hash, no R2):

```bash
make watermark ARGS='public/toons/jax/assets --backup'
```

Requires ImageMagick 7+ (`brew install imagemagick`). Re-running a watermark
without restoring from backup **doubles** the stamp.

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
- **Copy:** every string comes from the `UI` table in `src/site/i18n.ts`, keyed
  off `<html lang>`. `ContactForm.vue` is a Vue component, so the locale-page
  generator — which rewrites HTML templates only — never touched it, and every
  `/de/`, `/it/`, `/fr/` page shipped an English form inside a translated page.
- **`novalidate` is required on the form.** With `required` + `type="email"` the
  browser runs its own constraint check first and shows a native bubble worded in
  the _browser's_ UI language, not the page's — and `onSubmit` never fires, so
  the localized messages become unreachable code. Keep the `required`
  attributes; they are the accessible semantics.
- **Backend:** Cloudflare Worker
- **Email Service:** Resend API
- **CORS:** origin allow-list in `ALLOWED_ORIGINS` (apex + staging), echoed per request

### Worker Configuration

Environment variables in `worker/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://twentyseven.pictures,https://staging.twentyseven.pictures"
TO_EMAIL = "27pictures@proton.me"
FROM_EMAIL = "noreply@twentyseven.pictures"
FROM_NAME = "27 Pictures Contact Form"
```

**`ALLOWED_ORIGINS` is why the form works off production at all.** The origin
used to be one hardcoded apex string, so a staging POST got a reply the browser
discarded — surfacing to the visitor as the generic "An error occurred", which
is indistinguishable from the mail genuinely failing. The Worker now echoes the
matching origin and sends `Vary: Origin`; an `Origin` that is present but
unlisted gets a 403, an absent one (curl, health check) is left alone.

Adding an origin means editing that var **and** `npx wrangler deploy` — the var
lives in the deployed Worker, not the repo. Verify with a cache-buster, because
preflights are cached and a stale one is what `Vary: Origin` exists to prevent:

```bash
curl -s -o /dev/null -D - -X OPTIONS "https://contact-form.sangalli-marco.workers.dev/?cb=$RANDOM" \
  -H "Origin: https://staging.twentyseven.pictures" -H "Access-Control-Request-Method: POST" \
  | grep -i "^HTTP/\|^access-control-allow-origin\|^vary"
```

**Turnstile is a second, separate gate.** Its sitekey is domain-scoped in the
Cloudflare dashboard; a host missing there never gets a token, so the button
sticks on "Verifying…" no matter what CORS says. That list is dashboard-only —
nothing in this repo controls it.

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

## Printable QR code

The printed QR encodes the **Instagram profile**, not a page on this site:

```bash
npm run generate-qr
# Output: ~/Downloads/27pictures-qr.pdf
```

There used to be a `/qr.html` landing page behind it. It was removed
(2026-08-19) and 301s to `/#contact` — the printed codes never pointed at it,
so no physical material was invalidated.

## Site pages

| URL                      | Source                      | Role                                                        |
| ------------------------ | --------------------------- | ----------------------------------------------------------- |
| `/`                      | `src/index.html`            | Studio homepage — sections + summaries that link out        |
| `/horror-shorts/`        | `src/horror-shorts/`        | The Red Smile anthology hub; links out to one page per film |
| `/horror-shorts/<slug>/` | `src/horror-shorts/<slug>/` | One Red Smile short: player, writeup, `VideoObject`         |
| `/cosplay/`              | `src/cosplay/`              | Cosplay production service page + FAQ                       |
| `/toons/`                | `src/toons/index.html`      | Interactive Toons index (readers live at `/toons/<name>/`)  |
| `/watch/`                | `src/watch/`                | Every release in one place — click-to-play façades          |

Every row above also answers under `/de/`, `/it/` and `/fr/`
— generated, not hand-written; see _Adding a page, and translating it_.

Each page mounts the same Vue chrome via its own entry in `src/site/`
(`main.ts`, `toonsMain.ts`, `cosplayMain.ts`, `horrorShortsMain.ts`) and needs a
matching `rollupOptions.input` entry in `vite.config.ts`. `SiteNav`'s `page`
prop drives `aria-current` and whether section anchors are bare (`#contact`) or
homepage-relative (`/#contact`).

**Schema lives with its subject, never duplicated.** The homepage graph keeps
Organization, WebSite, WebPage, the founders and the VFX Service.
`CreativeWorkSeries` belongs to `/horror-shorts/`; each short's `VideoObject`
lives on its own film page under `/horror-shorts/<slug>/`, and the hub
`ItemList` points at those pages. The cosplay `Service` and `FAQPage` belong
to `/cosplay/`. Split pages add `BreadcrumbList` and reference the org by `@id`.

**`/experiments/` is gone** — renamed Interactive Toons and moved to `/toons/`,
which was already the parent of every reader URL. `public/_redirects` 301s
`/experiments`, `/experiments/` and `/experiments/*`. Keep those redirects.

**Homepage sections stay as summaries.** `#cosplay` and `#darkroom` were
trimmed rather than deleted, because fragments cannot be redirected — removing
them would break every existing `/#cosplay` link. Each summary links to its
page.

**Shared page furniture:** split pages use the homepage's `THE RED SMILE`
heading treatment (Playfair, `7vw`, `15vw` under 768px) and its `10%` side
gutter, so they read as one site. Card grids carry no borders — separation is
background only.

### Adding a page, and translating it (de / it / fr)

English lives at the root; the other locales are generated subdirectories —
`/de/cosplay/`, `/it/horror-shorts/the-doll-moved-again/`. **The locale HTML is
built, never hand-written**: `vite/plugins/localePages.ts` renders the English
template through a per-locale JSON of copy before Vite scans MPA inputs, so
`/fr/watch/` is a real entry with real HTML for crawlers. `src/de/`, `src/it/`
and `src/fr/` are gitignored — editing a file there is editing a build artefact.

**Every indexable site page is translated. Readers are not** — their captions
are already multilingual, and a `/de/toons/nero/` whose chrome is German and
whose story is English is a language mismatch Google drops the whole cluster
for.

Adding a page:

1. `src/<path>/index.html` + an entry module in `src/site/`, and a matching
   `rollupOptions.input` line only if `htmlEntries()` cannot find it (it walks
   for `index.html`, so usually nothing to do).
2. `public/sitemap.xml`, `public/llms.txt`, and a real internal link — see
   _Sitemap + getting new URLs indexed_.
3. Then translate it, below.

Translating it:

1. **Tag the English template.** Text nodes take `data-i18n="key"`; a node with
   inline markup (`<strong>`, `<a>`, `<em>`, `<br />`) takes
   `data-i18n-html="key"` and its copy value carries that markup. Attributes take
   `data-i18n-content` (meta), `data-i18n-alt`, `data-i18n-aria-label`. Keys are
   stripped from the generated file, so they never ship.
2. **Add the hreflang cluster** to the template's `<head>`, between
   `<!-- hreflang:start -->` and `<!-- hreflang:end -->`: `en`, `de`, `it`, `fr`
   and `x-default`, all five, on every variant. An incomplete or non-reciprocal
   cluster is ignored wholesale. `canonical`, `og:url`, `og:locale` and
   `<html lang>` are rewritten for you.
3. **Register the page** in `LOCALE_PAGES` (`vite/plugins/localePages.ts`) with
   its `template`, `copyDir` and `urlPath`, and add the same `urlPath` to
   `LOCALIZED_PATHS` in `src/site/i18n.ts`. The plugin list writes the files;
   the `i18n.ts` list is what the nav and the language switcher believe. A path
   in one and not the other is a switcher pointing at a 404.
4. **Write `src/site/locales/<copyDir>/{de,it,fr}.json`** — one key per tag. A
   missing key keeps the English text, which is a silent half-translated page,
   so diff the keys against the template rather than trusting the build.
   Proper nouns stay: film titles, `The Red Smile`, `RED SMILE: static`, toon
   names. Leave those keys out entirely instead of copying English into them.
5. **Translate the JSON-LD** under `"schema"`. `name` / `headline` /
   `description` hit the WebPage, `breadcrumbHome` / `breadcrumbToons` /
   `breadcrumbHere` the BreadcrumbList, and anything else goes through
   `"nodes"`, keyed by a node's `@id` fragment with dotted paths inside it:

   ```json
   "nodes": {
     "#faq": { "mainEntity.0.acceptedAnswer.text": "…" },
     "#cosplay-service": { "hasOfferCatalog.itemListElement.0.itemOffered.name": "…" }
   }
   ```

   Paths that do not already exist are ignored, so a stale key cannot invent a
   property. `inLanguage` is set for you.

6. **Sitemap**: one `<url>` per locale (`/de/<path>/`, …) beside the English
   one, with the locale's own `<image:title>` / `<image:caption>`.
7. `npm run format && npm test`, then build — the pages are written at build
   time, so `dist/de/<path>/index.html` existing is the real check.

Two things the generator handles that are easy to get wrong by hand:

- **Internal links.** A localized page's own hrefs are rewritten to the locale
  (`/cosplay/` → `/de/cosplay/`) for every path in `LOCALIZED_PAGE_HREFS`;
  reader links get `?lang=de` instead so captions open in that language;
  assets and `/qr.html` are left alone.
- **Global schema entities.** `#organization`, `#website`, the founders — every
  page references those by one canonical `@id`, so URLs hanging off the origin
  root with a fragment are never localized. The homepage needs
  `localizeIds: ["#webpage"]` for exactly this reason: its `urlPath` is `/`, so
  without it the whole graph would be rewritten to `/de/#organization` and stop
  resolving.

## Toon Reader (FlipFrame — Erin, Jax, Nero, …)

Readers are **Vue apps** under `src/toons/`, not the old standalone JS shells.

| Path                                 | Role                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `src/toons/bookReader/`              | FlipFrame package: engine, shell, chrome, captions, audio |
| `src/toons/jax-the-chip/` · `erin/` · `nero-the-dog/` | App entry + `ToonReaderShell` config          |
| `content/toons/<name>/config.json`   | **Edit here** — pages list, captions, audio paths         |
| `src/toons/config-lock.json`         | Points prod at `config.<md5>.json` on R2                  |
| `public/toons/reader-shared.css`     | Shared book chrome + word/bubble CSS (all toons)          |
| `public/toons/**/assets/`            | **Gitignored** — load via `VITE_ASSET_BASE`               |

| Toon              | URL                        | Notes                                                                                                                                                                                            |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Erin              | `/toons/erin/`             | Page-turner prototype                                                                                                                                                                            |
| Jax               | `/toons/jax-the-chip/`     | **Jax is the series; `The Chip` is episode 1.** Series landing at `/toons/jax/`. Netrunner / Robin Hood of mind-tech; multilingual SFX (see `content/toons/jax/README.md`)                       |
| Nero              | `/toons/nero-the-dog/`     | **Nero is the series; `The Dog` is episode 1.** Series landing at `/toons/nero/`. Scotland Yard case — Nero, Eve, The Dog; page 4 = _HOURS EARLIER_ flashback (see `content/toons/nero/README.md`) |
| RED SMILE: static | `/toons/redsmile-static/`  | **RED SMILE is the series; `static` is episode 1** — 12 plates. Elena alone at home, a flickering TV, something watching back; plates from `/horror-toon-page`                                     |
| Erin EP 2         | `/toons/erin-the-revenge/` | **ERIN & THE GOBLINS — The Revenge**, 23 plates, EN/IT/DE/FR. Erin returns to defeat the Goblin King; Venus teaches matter. Prompts in `docs/story/erin/e2/prompts/` (`erin-ep2-*`). See `content/toons/erin/README.md` |

**Erin EP 2 has shipped (2026-08)**: `/toons/erin-the-revenge/` is live and
`index, follow`, listed in the sitemap and `llms.txt`, and reachable through
the localized series hub `/toons/erin-and-the-goblins/` (which links both
episodes and carries the canonical `#series` entity the `/toons/` ItemList
references by `@id`). The old hide-on-`main` arrangement is history.

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
# After new plates/audio — one command, right order (then push, or it deploys itself)
make ship TOON=jax              # → staging (local wrangler)
make ship TOON=jax PROD=1       # → twentyseven.pictures
make ship TOON=jax DRY=1        # plan + asset check only
```

Caption-only edits: commit `content/toons/<toon>/config.json` and push. Actions
hashes every toon, puts new JSON on R2, compiles the lock, deploys.

New **media**: `ship-toon.js` still chains upload → **verify every plate and
clip the config references resolves on R2** → publish the config → build and
deploy. Publish a config whose plates are not up yet and the live page breaks.
It refuses a production run on a dirty tree, because `wrangler pages deploy`
ships `dist/` built from the working directory.

The individual steps still exist (`npm run upload-assets`,
`npm run publish-toon-config -- --toon jax`,
`npm run prune-pages-deployments -- --project twentyseven-pictures-staging`)
for when you want one of them alone.

### YouTube embeds: click-to-play façades

No page embeds a player on load. Each video is a placeholder that builds the
iframe on click (`src/site/ytFacade.ts`, styles under `.yt-facade` in
`styles.css`):

```html
<div class="yt-facade" data-embed="https://www.youtube.com/embed/<id>" data-poster="<video id>" data-title="…"></div>
```

Call `initYouTubeFacades()` from the page's entry module — `main.ts`,
`horrorShortsMain.ts` and `cosplayMain.ts` all do. **Add an embed and you must
add the init call**, or the placeholder renders empty.

- Six players on the homepage cost ~1MB each before anyone pressed play; a cold
  load now fetches nothing from youtube.com, only lazy thumbnails from
  `i.ytimg.com` (already allowed by the CSP in `public/_headers`).
- The generated iframe carries `autoplay=1`, so the click that reveals it also
  starts the video.
- **Playlists have no thumbnail of their own** — `data-poster` takes a
  representative video id instead.
- `hq720.jpg`, not `maxresdefault.jpg`: maxres is missing on some uploads and
  would leave blank cards.

### Story bible (`docs/story/<series>/`)

Cast bios and series canon live under **`docs/story/<series>/`** — deliberately
outside `content/`. Only `content/toons/<toon>/config.json` is ever read by the
dev plugin or `publish-toon-config`, so markdown there would never have shipped
— but `content/` is where publishable toon material lives, and unpublished
pre-production notes do not belong in it.

Series level, not per episode: the cast spans episodes, and
`content/toons/redsmile-static/` is episode 1's folder.

Each bio splits into two halves that are read very differently:

- **Appearance — locked.** What the generated character sheet actually shows.
  Binding: every plate is pinned against it. Copy it into prompts, never
  paraphrase.
- **Everything else — proposed.** Story, relationships, how to stage them. A
  pitch to accept or throw out. Only Elena is established in a config today.

Each also carries a **compact prose lock** — a paste-ready block for a
`/horror-toon-page` prompt when the sheet is not attached — and voice direction,
since none of these characters has an entry in `scripts/voices.json` yet.

Two things a bio is the right place to record, because they are invisible in the
art and expensive to rediscover: how a character must be **inked** (Adaeze's deep
skin tone has to be mid-grey with rim light, never flat black, or she vanishes
into the plate), and what must be **absent** (Tokiro carries no occult mark, and
that has to be stated in prompts or it leaks in from the other sheets).

### Toon series pages

A toon with more than one episode — or one that will have — gets a **series
landing page** listing its episodes, separate from the readers:

| Series | Landing | Episode 1 reader |
| ------ | ------- | ---------------- |
| Erin & the Goblins | `/toons/erin-and-the-goblins/` | `/toons/erin/` |
| Nero | `/toons/nero/` | `/toons/nero-the-dog/` |
| Jax | `/toons/jax/` | `/toons/jax-the-chip/` |
| RED SMILE | `/toons/red-smile/` | `/toons/redsmile-static/` |

Landings are indexable and translated (`LOCALE_PAGES` + `LOCALIZED_PATHS`);
**readers are not** — they keep one URL and take `?lang=`. All four landings
share `src/site/seriesPageMain.ts`, the `[data-series-page]` region the
quick-view dialog injects, and one CSS component; only copy differs.

**Nero and Jax used to be readers at those clean URLs.** Two consequences:

- `/toons/nero/` and `/toons/jax/` are **not** redirected — they cannot be, they
  now serve the series page. The URLs keep their signals but changed content;
  the readers start fresh at the episode slugs.
- Their READMEs document `?page=N` deep links against the old URLs.
  `seriesPageMain.ts` forwards any `?page=` on a landing to episode one, keyed
  off `data-series-key` on `<html>`. Keep that attribute — and note that
  `localePages.ts` rewrites the `lang` attribute **in place** precisely so
  `data-*` on `<html>` survives; replacing the whole tag once shipped every
  Italian series page as `lang="en"`.

`ASSET_PAGE_DIR` in each reader app is a **CDN key prefix, not a route**. It
still reads `/toons/nero/` and `/toons/jax/` because the plates are keyed
`toons/<toon>/assets/<md5>` on R2. Moving it with the route 404s every page.

### Reader SEO (crawlable fallback)

The readers are client-rendered: without this, `/toons/<name>/` serves an empty
`<body>` and the story text arrives from a CDN JSON, so crawlers see nothing on
the four most distinctive URLs on the site.

Each `src/toons/<name>/index.html` therefore carries:

- a **fallback article inside `#app`** — premise, page count, languages, links
  out. Vue replaces it on mount (verified: `.reader-fallback` is gone once
  `.book-scene` exists), so it is a genuine no-JS view, not hidden text. Style
  lives in `reader-shared.css` under `.reader-fallback`.
- **`WebPage` + `BreadcrumbList` + `CreativeWork`** JSON-LD. The CreativeWork
  description reuses the app's `COVER_SYNOPSIS`, so cover copy and schema
  cannot drift.
- **og/twitter tags** pointing at `card-art/<toon>-og.jpg` (1200×630 landscape
  crops — the portrait card art crops badly on `summary_large_image`), and a title built from
  the hook rather than "… | Experiments", which no one searches.

Keep the fallback in step with the synopsis when a toon's story changes, and
keep it inside `#app` — moved outside, it would render twice.

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
- The top-left logo links to `/toons/`, not the homepage — readers are reached
  from the toons index, and the back cover already pointed there.
- Prev/next arrows are red-outlined discs with a red glyph that invert to a
  solid red fill with white outline and glyph on hover, focus or press.
- Content pages carry a small folio (page number) bottom-left, drawn purely in
  CSS from the `data-page-num` attribute that `BookSlot` / `FlipLeaf` /
  `VerticalStrip` already set. Covers have no attribute, so they stay
  unnumbered, and no plate on the CDN is modified. It sits at `z-index: 33` —
  above `.nav-zone` (30), below the word overlay (35).
- Reader padding is sized for that 4px bar, not for the old counter row. Book
  mode keeps ~2.75rem of top padding so the spread clears the fixed top-right
  controls. The page-nav arrows are centred **on** the page edges, half over
  the plate and half over the margin, so `--book-width` must keep at least the
  disc radius clear on each side — that is the `100vw - 64px` term in every
  toon's `<style>`. Shrink that gutter and `.reader`'s overflow slices the
  outer half of the disc off.

### Per-toon geometry tokens (`--plate-aspect`, `--strip-width`)

`reader-shared.css` used to hardcode Jax's plate shape in two places, which
silently mis-sized every other toon:

| Token            | What it drives                                | Default (fallback) |
| ---------------- | --------------------------------------------- | ------------------ |
| `--plate-aspect` | `aspect-ratio` of a vertical-scroll page slot | `1008 / 1792`      |
| `--strip-width`  | Width cap of the scroll strip                 | `min(98vw, 720px)` |

Each toon declares its real values next to its book tokens: Erin and Erin EP 2
are `1152 / 1728` and raise the strip to `900px`, Nero and RED SMILE are
`800 / 1424`, Jax keeps the defaults. Get `--plate-aspect` wrong and every page
scrolls with bands above and below it; leave `--strip-width` at the 9:16 value
and a wider 2:3 book reads as a narrow locked column next to the same page in
flip view.

The slot keeps an `aspect-ratio` on purpose — it reserves plate height before
lazy images decode, so a fast fling does not stall as pages expand under the
finger.

**Dark plates need dark paper.** `--page-bg` shows wherever the slot
letterboxes (`object-fit: contain`), which on mobile is every page: a book of
black plates on episode 1's cream paper is framed in white. Set `--page-bg`,
`--spine` and `--cover` to the dark-toon values for such a book.

The folio (page number) is white on a solid black chip flush into the
bottom-left corner. It used to be a 52%-opacity glyph with a text-shadow, which
vanished into any plate that was busy or already black.

### One stylesheet for site pages

`/cosplay/`, `/horror-shorts/`, `/toons/` and `404.html` each carried their own
`<style>` block — the same footer, section labels and breadcrumb rule copied
four times, none of it cached across pages. It all lives in
`public/styles.css` now, under `Site page styles`, and those pages have no
inline CSS at all.

**Reader pages keep their `<style>` blocks**: those are per-toon book tokens
(`--book-width`, `--page-bg`, fullscreen overrides), not site chrome.

Anything shared by more than one page belongs in `styles.css`; run
a build after touching it; `vite/plugins/hashedCss.ts` re-hashes the filename.

### What goes where (CSS)

A toon entry’s own `<style>` should contain **only**:

1. Book-aspect tokens (`--book-width`, `--book-height`, `--page-bg`, …) + fullscreen/single-page overrides.
2. Genuinely unique extras (e.g. Jax language switcher / music chrome).

Everything shared belongs in `public/toons/reader-shared.css` — including
`.jax-word*` / bubble SVG chrome (class names are historical; used by every
toon). Caption pages should load **Bangers** + **VT323** from Google Fonts.

### Cache-busting shared CSS (hashed filenames)

`styles.css` and `toons/reader-shared.css` live in `public/`, so Vite copies
them verbatim and cannot hash them itself. `vite/plugins/hashedCss.ts` does it
at the end of the build: it writes `styles.<sha256 prefix>.css`, rewrites every
reference in `dist/**/*.html`, and **deletes the unhashed copy**. Nothing to run
by hand — edit the CSS and build.

Source HTML links plain `/styles.css`, which is what the dev server serves. Do
not reintroduce `?v=` there; the plugin replaces such a query if it finds one.

**Why not `?v=`, which is what this used to do.** `_headers` serves these
`immutable, max-age=1y`, and a CDN keys on the whole URL including the query. So
`?v=` created a new cache key while the _path_ still pointed at a file whose
body changes. One request for a new `?v=` landing before a deploy finished
propagating cached the old body under the new key — immutably, for a year, with
no way out but changing the content again to get a different key. That reached
production, and the request that poisoned the entry was the one verifying the
deploy. A hashed filename means a URL has exactly one possible body, so
`immutable` is true and a stale fetch can only land under a name nothing
references.

Only hashed names get the immutable header (`/styles.*.css`,
`/toons/reader-shared.*.css`). If you add another `public/` stylesheet, add it
to `SHEETS` in the plugin and give it a matching `_headers` rule.

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

**Tails do the pointing.** `tail` aims back at whatever makes the sound
— the speaker's head, the hand on the object, the TV — using all eight values
(`top`, `bottom`, `left`, `right` + the four diagonals, see `BUBBLE_TAIL_TIPS`
in `bubbles.ts`). Diagonals are the common case; a caption in the top band
almost always wants `bottom-left` / `bottom-right`.

**A word entry says what it is, never how it is styled.** Position, variant,
`tail`, text, clip — that is a complete caption. Spoken lines also carry
`voice`: a key from `scripts/voices.json` (`erin`, `venus`, `goblinking`,
`jax`, …), never the ElevenLabs UUID. Onomatopoeia omit it.

```json
{ "x": 0.2, "y": 0.15, "variant": "thought", "tail": "top-left",
  "voice": "erin",
  "text": { "en": "No signal." }, "audio": "assets/sfx/….mp3" }
```

Wrap width comes from the text (`autoWrapCh`, in `ch`), padding from
`resolveBubbleStyle`, type size from the variant (`defaultSize`: bursts 28, HUD
20, speech 22), and 0.75 fill opacity / stroke width 5 are the defaults — so
lettering never sits on flat white without anyone asking. **Do not add
`maxWidth`**: the balloon already sizes to its own content, and a plate-fraction
width does not survive a size change. Add `size`, `angle`, `scale` or `color`
only where that caption wants something else; an explicit value always wins.
Onomatopoeia over dark plates still take `"stroke": "#ffffff"`,
`"strokeThickness": 8` to lift off the ink. `node scripts/slim-toon-config.js
--all --dry-run` reports anything a config repeats that the reader already
derives.

**Auto-read follows position, not array order.** `readingOrder` in
`captions/captionModel.ts` sorts top→bottom and merges captions within
`ROW_TOLERANCE` (0.06) into a row read left→right. An SFX that must land before
a line needs a smaller `y` — or the same row and a smaller `x`. Moving it
earlier in `words[]` does nothing, which is how RED SMILE ep 2 shipped a lift
chime that played after the thought it was supposed to interrupt.

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
> just that slug's entry from `scripts/jax-sfx-lock.json`, and run **without** > `--force`. If `--force` already ran, restore with
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

1. Voices are locked by name in `scripts/voices.json` (`name ->
voice_id`). Current cast includes: `jax`, `riu`, `nova`, `ripperdoc`,
   `badai`, `nero`, `thedog`, `eve`, `barman`, `elena`, `erin`, `venus`, `goblinking`,
   `narrator`. To add a new one: open the voice
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

   Prefer the config as the source of truth. Each spoken word should already
   have `"voice": "<voices.json key>"`. Generate every line that has a voice
   and no clip (or regenerate with `--force`):

   ```bash
   python3 scripts/generate-jax-voice.py --from-config --toon erin-the-revenge
   python3 scripts/generate-jax-voice.py --from-config --toon erin-the-revenge --force
   ```

   **Place reverb** is a named acoustic space on the config, not a bubble
   style. Book default, page override, word `"none"` to skip. Types live in
   `scripts/reverb-types.json` (`plaza`, `plaza-deep`). `--from-config`
   applies the resolved type after TTS so a regenerate matches the courtyard.
   One-off: `--reverb plaza` (or `--reverb none`).

   ```json
   { "reverb": "plaza", "pages": [ { "reverb": "plaza-deep", "file": "…", "words": [] } ] }
   ```

   Erin EP 2 is `plaza`; pages 19–20 are `plaza-deep` (keep / chamber). The
   reader ignores the key — it is baked into the mp3.

3. Paste into `content/toons/<toon>/config.json` (one-off), or let
   `--from-config` write `audio` for you, then
   `npm run upload-assets` and `npm run publish-toon-config -- --toon <toon>`.

#### Levelling caption audio (EBU R128 + true peak)

ElevenLabs returns inconsistent levels: HUD readouts landed ~9 dB under
dialogue (-28 vs -19 LUFS), and generated SFX regularly peaked **above 0 dBFS**
(measured +2.4 dBTP), which clips on playback. Level a whole toon in one pass:

```bash
npm run normalise-audio -- jax                 # or: nero redsmile-static erin-the-revenge
npm run normalise-audio -- jax --dry-run       # measure only, touch nothing
npm run normalise-audio -- jax --voice -18 --sfx -15 --tp -1.5
npm run normalise-audio -- jax --all           # relevel everything, even on-target clips
```

**It only touches clips that need it.** Re-encoding an on-target clip changes
its content hash and forces a full re-upload plus a config publish for the sake
of two new sound effects. Clips within `--tolerance` (0.5 LU) are left alone,
and so are **peak-limited** ones: a punchy SFX or a scream has a high
peak-to-loudness ratio, so `linear=true` caps the gain to protect the -1.5 dBTP
ceiling and the clip can never reach the LUFS target — without that rule it
would be re-encoded on every run, forever.

Two-pass `loudnorm` (measure, then apply with `measured_*` + `linear=true`), so
the gain is one linear move — no pumping, and dynamics inside a clip survive.
Voices target **-18 LUFS**, onomatopoeia **-15 LUFS** so they still punch, and
everything shares a **-1.5 dBTP** ceiling. The script rewrites each `audio`
path to the new content hash and deletes superseded local files; follow with
`npm run upload-assets` and `publish-toon-config`.

Run it **after** the metallic passes below — those change level, so normalise
last.

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
echo tail only (~25 ms).

`badai` (the hostile AI) runs a harsher tilt of the same chain so it reads as
the same kind of machine without sharing Nova's voice — pitched down 6%,
crushed to 8 bits at 38% wet, tighter band and a longer comb:

```bash
ffmpeg -y -i in.mp3 -af "asetrate=44100*0.94,aresample=44100,\
highpass=f=150,lowpass=f=5200,acrusher=bits=8:mode=log:mix=0.38,\
chorus=0.7:0.9:22:0.55:0.4:2.4,aecho=0.85:0.75:7:0.42,\
aphaser=type=t:speed=0.9:decay=0.35,dynaudnorm=f=200:g=5" \
  -codec:a libmp3lame -b:a 192k /tmp/out.mp3
```

The pitch shift stretches these clips ~8% longer, unlike the `ai` pass.

#### One actor, several creatures (pitch shift)

Erin EP 2 has three goblin voices and one voice id. The **Goblin King** is
`goblinking` straight; the **rider** is the same clip pitched **up 12%**; the
**captain** is pitched **down 6%**. Same species, different characters, no
extra casting and no extra credits:

```bash
# rider: smaller, meaner
ffmpeg -y -i in.mp3 -af "asetrate=44100*1.12,aresample=44100,highpass=f=170,\
acrusher=bits=12:mode=log:mix=0.12,aphaser=type=t:speed=1.3:decay=0.2,\
dynaudnorm=f=200:g=5" -codec:a libmp3lame -b:a 192k /tmp/out.mp3

# captain: older, worn
ffmpeg -y -i in.mp3 -af "asetrate=44100*0.94,aresample=44100,highpass=f=110,\
dynaudnorm=f=200:g=5" -codec:a libmp3lame -b:a 192k /tmp/out.mp3
```

Pitch the **original** TTS clip, never an already-pitched one — the artefacts
compound. To change the amount, regenerate the line and shift once.

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
- JSON-LD schema split across pages (2026-08): homepage keeps Organization, WebSite, WebPage, 3× Person, the Jax-short VideoObject and the VFX Service — the cosplay showcase VideoObject lives on `/cosplay/#showcase` and the homepage references it by bare `@id` only (a typed stub would parse as its own VideoObject missing required fields); `/horror-shorts/` owns CreativeWorkSeries + ItemList of 5 VideoObjects; `/cosplay/` owns the cosplay Service + FAQPage; both add BreadcrumbList
- Person schema: 3 founders (Sonia, Marco, Daniele Sangalli) with `jobTitle`/`description`/`worksFor`, linked from `Organization.founder`
- Organization location: Switzerland & United Kingdom
- IndexNow key deployed + submitted (`bdd5e80e21a8430d9316de0deacdb208`)
- All VideoObject uploadDates and durations use real YouTube values
- `public/llms.txt` — llms.txt-convention markdown (H1 + blockquote summary +
  H2 link sections); crawler directives live only in `robots.txt`
- `public/robots.txt` — search + AI _citation_ crawlers allowed
- Indexable hub pages added (2026-08): `/horror-shorts/` and `/cosplay/`, each 800+ words of unique copy; sitemap now lists them with 1200×630 OG art
- `/experiments/` → `/toons/` with 301s in `public/_redirects`

### 404s

`public/404.html` exists so Cloudflare Pages returns a **real 404**. Without it
Pages served `index.html` at HTTP 200 for every unknown path, which made each
typo an indexable duplicate of the homepage and a soft-404 in Search Console.

Verify after any deploy that changes routing:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://twentyseven.pictures/nope-1234   # 404
curl -s -o /dev/null -w '%{http_code}\n' https://twentyseven.pictures/toons/      # 200
```

Statuses take ~30s to propagate after a deploy; check twice before concluding
anything is wrong.

### Sitemap + getting new URLs indexed

**URL:** `https://twentyseven.pictures/sitemap.xml` (in Search Console paste just
`sitemap.xml`). Source is `public/sitemap.xml` — hand-maintained, referenced
from `robots.txt`, and shipped in `dist/`. Image URLs use the
`%VITE_ASSET_BASE%` token, expanded at build by `vite/plugins/cdnMedia.ts`.

**Adding a page** — every new indexable URL needs three edits, or it exists but
nothing points at it:

1. `public/sitemap.xml` — `<url>` block with `<lastmod>` and an `<image:image>`
   when there is card art
2. `public/llms.txt` — the key-pages list
3. an internal link from somewhere real (nav, homepage section, footer)

**Then tell the engines:**

```bash
# IndexNow — Bing, Yandex, Seznam, Naver. NOT Google.
curl -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json" \
  -d '{"host":"twentyseven.pictures",
       "key":"bdd5e80e21a8430d9316de0deacdb208",
       "keyLocation":"https://twentyseven.pictures/bdd5e80e21a8430d9316de0deacdb208.txt",
       "urlList":["https://twentyseven.pictures/<new-page>/"]}'
```

Include the **old** URL too when a page moves, so the 301 gets crawled.

**Google needs Search Console — there is no API-free ping.** The old
`google.com/ping?sitemap=` endpoint returns **404** and Bing's returns **410**;
both were retired in 2023. Submitting the sitemap requires signing in, so it is
a human step:

1. [search.google.com/search-console](https://search.google.com/search-console)
   → add a **Domain** property (`twentyseven.pictures`) → add the TXT record it
   gives you to the Cloudflare DNS zone → Verify.
   File verification also works: drop the `google<hash>.html` into `public/` and
   deploy.
2. **Sitemaps** → submit `sitemap.xml`.
3. **URL Inspection → Request indexing** for anything urgent; the sitemap alone
   can take days.

**After a URL move**, keep the `public/_redirects` 301 in place — Google needs
to crawl the old URL to transfer signals, and removing the redirect too early
strands them.

### Crawlers / AI search policy (2026-07)

**Intent:** maximize classic search + AI search / citation visibility. Block only aggressive bulk scrapers.

| File                              | Role                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/robots.txt`               | Authoritative crawl rules shipped in `dist/`                                                                                                    |
| `public/llms.txt`                 | Markdown site guide for AI engines (llms.txt spec); crawler rules live in robots.txt                                                            |
| Cloudflare **AI Crawl Control**   | Per-bot **Block** toggles (leave **off** for GPT/Claude/Google/Perplexity)                                                                      |
| Cloudflare **managed robots.txt** | **Must stay disabled** — when enabled it prepends `Disallow: /` for GPTBot, ClaudeBot, Google-Extended, etc. and conflicts with our Allow rules |

**Allowed explicitly in robots:** GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, meta-externalagent (+ default `User-agent: * Allow: /`).

**Disallowed:** Bytespider, CCBot.

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

- When a new Short is published: add `/horror-shorts/<slug>/` (VideoObject + writeup), then update the hub ItemList, sitemap, `llms.txt` and the homepage film list
- Submit `/toons/`, `/cosplay/`, `/horror-shorts/` (and the retired `/experiments/`) to IndexNow once live on production
- Watch GSC for homepage vs `/cosplay/` cannibalisation; trim the homepage summary further if both rank for the same query
- A `/studio/` page for the assembly/beyond copy once it passes ~400 words
- Submit new URLs to IndexNow after each public URL change:
  ```bash
  curl -X POST "https://api.indexnow.org/indexnow" \
    -H "Content-Type: application/json" \
    -d '{"host":"twentyseven.pictures","key":"bdd5e80e21a8430d9316de0deacdb208","keyLocation":"https://twentyseven.pictures/bdd5e80e21a8430d9316de0deacdb208.txt","urlList":["https://twentyseven.pictures/"]}'
  ```

## Git Workflow

- **Main branch:** `main` — push deploys production (`https://twentyseven.pictures`)
  via GitHub Actions.
- **Staging branch:** `staging` — push deploys
  `https://staging.twentyseven.pictures` (HTTP Basic Auth). Carries work in
  review. Merge `staging` → `main` to ship.
- **Local fallback:** `make preview-deploy` / `make deploy` still talk to
  Wrangler directly when you need a one-off without a push.
- **Remote:** `git@github.com:xibitdigital/27-pictures-website.git`
- **Contributors:**
  - Marco Sangalli (sangalli.marco@gmail.com)
  - Daniele Sangalli (daniele@xibitdigital.com)
