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
  --bg-menu: #1c1c1c; /* Floating menus / popovers */
  --bg-input: #242424; /* Form fields (editor) */
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
- **A second page that began as a copy.** `/toons/redsmile/`, `/toons/nero/`
  and `/toons/jax/` are the same series landing as
  `/toons/erin-and-the-goblins/`. One `_hub` shell, `seriesPageMain.ts`, and
  D1 `hub_url` — no per-series HTML. Adding a series is a row in the editor,
  never a new layout.

Before adding a variant, ask which of these it is:

1. **Same thing, different container** → scope the difference to the container
2. **Same thing, different content** → pass a prop, or key off existing data
   (D1 catalog, the `UI` table, `<html lang>`)
3. **Genuinely a different thing** → a new component, and say why in a comment

The D1 catalog is the worked example of (2): series hubs, readers, cards,
JSON-LD, sitemap, `llms.txt` and FlipFrame back-cover next/prev all read
`GET /catalog`. A page that hardcodes an episode list has already forked.

## Project Structure

```
27-pictures-website/
├── src/                     # Vite root (Vue 3 + TS MPA entries)
│   ├── index.html           # Homepage
│   ├── cosplay/             # /cosplay/ service page
│   ├── horror-shorts/       # /horror-shorts/ Red Smile hub
│   ├── site/                # SiteNav, ContactForm, per-page entries
│   │   └── catalogRender.ts # D1 catalog → HTML cards + JSON-LD (no document)
│   ├── toons/index.html     # /toons/ — catalog shell (SSR fills from D1)
│   ├── toons/editor/        # /toons/editor/ — D1 studio (hash router)
│   │   └── bubble-lab/      # /toons/editor/bubble-lab/ — caption gallery (no auth)
│   ├── toons/bookReader/    # FlipFrame package
│   ├── toons/_hub/          # series landing shell — body written by SSR
│   ├── toons/_reader/       # one FlipFrame app for every book
│   └── test/setup.ts        # Vitest (forces empty VITE_ASSET_BASE)
├── functions/               # Cloudflare Pages Functions (ship with the Pages deploy)
│   ├── _middleware.ts       # staging Basic Auth + noindex; withToonSsr
│   ├── toonSsr.ts           # catalog/hub/reader HTML from D1
│   ├── sitemap.xml.ts       # /sitemap.xml from D1 + LOCALIZED_SITE_PATHS
│   └── llms.txt.ts          # /llms.txt from D1 + static film/service links
├── content/toons/           # Per-toon READMEs; live books are D1 (not config.json)
├── worker/toon-editor/      # TypeScript Worker — D1 + R2 editor API (`GET /catalog`)
├── docs/story/              # Series bible + cast bios — never shipped
├── public/                  # Static → site root in dist/
│   ├── styles.css, logo.png, the-red-smile.jpg, qr.html, …
│   ├── toons/               # reader-shared.css; assets on R2
│   │   └── **/assets/       # gitignored (R2 only)
│   ├── card-art/            # gitignored posters (R2)
│   ├── robots.txt           # crawl policy (sitemap + llms.txt are SSR)
│   ├── _redirects           # 301 /experiments* → /toons/
│   └── _headers             # CSP + cache (allow R2 + CF Insights)
├── vite/plugins/cdnMedia.ts # hard CDN gate + token expand + strip media
├── vite/plugins/toonSsrDev.ts # make dev: same catalog inject as the Function
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

1. Check `src/toons/config-lock.json` against every `content/toons/*/config.json`
   hash (`npm run publish-toon-config -- --check`). No R2 put — wrangler talks
   to the REST API and the Actions token 403s without **Workers R2 Storage:
   Admin Read & Write**. Config objects are put **locally** on commit (pre-commit
   hook on staged `content/toons/*/config.json`). A lock that does not match
   fails the job instead of shipping a bundle that asks for a missing JSON.
2. `npm run build` so the JS bundle asks for the locked names.
3. `wrangler pages deploy dist` to that branch's Pages project. That also
   ships `functions/` (catalog/hub/reader SSR, sitemap + llms.txt, staging auth). It does
   **not** deploy `worker/toon-editor` — that is `cd worker/toon-editor &&
   npx wrangler deploy`.
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

**Live books are D1**, edited at `/toons/editor/`. Readers load
`GET /config/:slug` from the toon-editor Worker (local Vite via
`/__editor-api`). New **plates and audio** still have to be on R2 first
(`make ship` / `upload-assets`) or the reader 404s. Local Miniflare D1 is not
the remote one until `npm run restore-db`.

### Local

```bash
make dev           # Vite :5173 + editor Worker :8787 (set VITE_ASSET_BASE so toon media loads)
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

Static card-art URLs use the token **`%VITE_ASSET_BASE%/card-art/…`** in HTML
(expanded at build by `vite/plugins/cdnMedia.ts`). `/sitemap.xml` and
`/llms.txt` are Pages Functions (`functions/sitemap.xml.ts`,
`functions/llms.txt.ts`), not files under `public/`.

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

The plate is on R2 after `add-image --upload`. Attach it to the book in
`/toons/editor/` (D1). Staging/production readers load that D1 config, not a
hashed `config.json` on the CDN.

After an insert, set the page count on the D1 toon (editor) so the SSR
fallback and catalog match, and rename `docs/story/<series>/eN/prompts/`
files from the high number down so names do not collide. `/llms.txt` reads
the catalog — no markdown edit.

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
| `/toons/`                | `src/toons/index.html`      | Interactive Toons catalog — D1 cards SSR’d into the HTML    |
| `/toons/<series>/`       | SSR `src/toons/_hub/`       | Series landing from D1 `hub_url` (no per-series HTML)       |
| `/toons/<series>/<ep>/`  | SSR `src/toons/_reader/`    | FlipFrame reader from D1 `reader_url`                       |
| `/watch/`                | `src/watch/`                | Every release in one place — click-to-play façades          |

Site pages also answer under `/de/`, `/it/` and `/fr/` — generated, not
hand-written. Series hubs take the same locale prefix but are **SSR from D1**
(no `src/de/toons/jax/` files). Readers stay on one English URL + `?lang=`.
See _Adding a page, and translating it_.

Each page mounts the same Vue chrome via its own entry in `src/site/`
(`main.ts`, `toonsMain.ts`, `cosplayMain.ts`, `horrorShortsMain.ts`) and needs a
matching `rollupOptions.input` entry in `vite.config.ts`. `SiteNav`'s `page`
prop drives `aria-current` and whether section anchors are bare (`#contact`) or
homepage-relative (`/#contact`).

**Schema lives with its subject, never duplicated.** The homepage graph keeps
Organization, WebSite, WebPage, the founders and the VFX Service.
`CreativeWorkSeries` for the **films** belongs to `/horror-shorts/`; each
short's `VideoObject` lives on its own film page under
`/horror-shorts/<slug>/`, and the hub `ItemList` points at those pages. The
cosplay `Service` and `FAQPage` belong to `/cosplay/`. Split pages add
`BreadcrumbList` and reference the org by `@id`.

**Toon catalog schema is D1, not a hardcoded episode list.** `/toons/` carries
`data-toon-jsonld`; each series hub carries `data-series-jsonld`. The Pages
Function (`functions/toonSsr.ts`) overwrites those scripts from `GET /catalog`
so the ItemList / CreativeWorkSeries matches what the shelf shows. Do not
hand-edit episode lists in those JSON-LD blocks — they are stubs.

**Homepage `#darkroom` lab cards** link to series landings (`/toons/nero/`,
`/toons/jax/`, `/toons/redsmile/`), not a single episode reader.

**`/experiments/` is gone** — renamed Interactive Toons and moved to `/toons/`,
which was already the parent of every reader URL. `public/_redirects` 301s
`/experiments`, `/experiments/` and `/experiments/*`. Keep those redirects.

**Homepage sections stay as summaries.** `#cosplay` and `#darkroom` were
trimmed rather than deleted, because fragments cannot be redirected — removing
them would break every existing `/#cosplay` link. Each summary links to its
page.

**Shared page furniture:** split pages use the homepage's `THE RED SMILE`
heading treatment (Playfair, `7vw`, `15vw` under 768px) and its `10%` side
gutter, so they read as one site. The **catalog** H1 on `/toons/` is not that
hero: under 768px it is `clamp(2.5rem, 9vw, 3.25rem)` so “Interactive Toons”
does not fill the viewport. Card grids carry no borders — separation is
background only. The catalog puts the **shelf first** (empty
`[data-toon-catalog]`), then continue-reading, then the about copy. Title is
`Interactive Toons | 27 Pictures` — do not prefix a second “Interactive Toons”.
There is no `keywords` meta on the catalog (Google ignores it).

### Adding a page, and translating it (de / it / fr)

English lives at the root; the other locales are generated subdirectories —
`/de/cosplay/`, `/it/horror-shorts/the-doll-moved-again/`. **The locale HTML is
built, never hand-written**: `vite/plugins/localePages.ts` renders the English
template through a per-locale JSON of copy before Vite scans MPA inputs, so
`/fr/watch/` is a real entry with real HTML for crawlers. `src/de/`, `src/it/`
and `src/fr/` are gitignored — editing a file there is editing a build artefact.

**Every indexable site page is translated. Readers are not** — their captions
are already multilingual, and a `/de/toons/nero/the-dog/` whose chrome is
German and whose story is English is a language mismatch Google drops the
whole cluster for. Hubs are the localized series landings
(`/de/toons/nero/`).

Adding a page:

1. `src/<path>/index.html` + an entry module in `src/site/`, and a matching
   `rollupOptions.input` line only if `htmlEntries()` cannot find it (it walks
   for `index.html`, so usually nothing to do).
2. A real internal link — `/llms.txt` is SSR from D1 + static site pages; see
   _Sitemap + getting new URLs indexed_.
3. Then translate it, below. After the path is in `LOCALE_PAGES` and
   `LOCALIZED_PATHS`, add it to `LOCALIZED_SITE_PATHS` unless it is a toon
   series hub (those come from D1). A **Pages** deploy picks the list up
   (`src/site/crawlerDocs.ts` imports it).

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
   in one and not the other is a switcher pointing at a 404. If it is a site
   page (not a series hub), also append it to `LOCALIZED_SITE_PATHS` in
   `worker/toon-editor/src/sitemap.ts`. Push Pages; do not list hubs there
   (`isToonSeriesHubPath` + D1 `hub_url`).
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

6. **Sitemap**: if it is a translated **site** page (not a series hub or
   reader), append the English path to `LOCALIZED_SITE_PATHS` in
   `worker/toon-editor/src/sitemap.ts`. The Pages Function emits `/path/`,
   `/it/path/`, `/de/path/`, `/fr/path/`. Series hubs and readers come from
   D1 — do not list them there. Push Pages.
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

## Toon editor (`/toons/editor/`)

Live books, series and captions are **D1**, not `content/toons/*/config.json`.
The Vue studio talks to `worker/toon-editor` (TypeScript). Staging and
production share that Worker’s remote D1. `make dev` proxies `/__editor-api` to
the Worker on `:8787` (Miniflare D1 — a different database until you
`npm run restore-db`).

**Desktop and iPad, not phones.** Do not add a phone layout. iPad uses the
existing `(pointer: coarse)` studio (filmstrip on top, inspector below); a
pointer keeps the three-column studio. Forms stack the cover preview below
900px (iPad portrait). The top bar is out of the scrollport
(`.editor-bar` `flex-shrink: 0`; `.editor-list-body` / `.editor-form` /
`.editor-page-body` scroll). A series with no episodes still gets a 2:3
card — cover art, or `.editor-cover-placeholder` if none.

**Bar order is the same on every screen** (`EditorBar.vue`): ghost actions
(`#actions`) → All toons (hidden on the list home) → red CTA (`#primary`:
Save / Create / New toon / Send invite) → account avatar **last**. Ghosts
never sit after the CTA. An existing series page (`#/series/:key`) puts
**New toon** in `#actions` (pre-fills `?series=&episode=` for the next
number). Lucide icons on those bar buttons match the list (BookPlus,
FolderPlus, Save, Library). The plate studio shows a one-shot hint —
“Click the page to add a bubble” — until dismissed (`localStorage`
`editor-plate-click-hint`).

JSON the studio and the Worker agree on lives in
`worker/toon-editor/src/apiTypes.ts` (no Cloudflare types). The Worker keeps D1
row types in `src/types.ts`. Vue re-exports the contract from
`src/toons/editor/types.ts`.

| Hash | Screen |
| ---- | ------ |
| `#/` | Episodes grouped under each series, ungrouped toons, visibility badges. Empty series: 2:3 cover card (placeholder if no art) |
| `#/series/new` · `#/series/:key` | Create / edit series (cover, hub URL, descriptions, Comfy flow + sheets). Edit: New toon in the bar, next episode pre-filled |
| `#/new` · `#/:id` | Create / edit toon (series + episode number + visibility) |
| `#/:id/pages/:pageId?` | Plate studio (upload or Generate) |

**Bubble lab** (`/toons/editor/bubble-lab/`) is a separate MPA, not a hash
screen. `src/toons/editor/bubble-lab/` mounts `WordCaption` through
`buildCaption` — the same path as the reader and plate studio — for every
`BUBBLE_VARIANTS` × `BUBBLE_TAILS` cell. One Line input (`name="lab-line"`)
feeds all of them; empty uses `PLACEHOLDER_TEXT`. No AuthGate, no D1, nothing
saved. `htmlEntries()` picks up its `index.html`. The page is `noindex,
nofollow`; `robots.txt` already `Disallow`s `/toons/editor` and it is not in
the sitemap. Local: `make dev` →
`http://127.0.0.1:5173/toons/editor/bubble-lab/`.

Visibility: `draft` (editor only) · `staging` (staging + local catalog) ·
`published` (Public — production catalog too). `/toons/`, `GET /catalog`,
`GET /config/:slug` and `/sitemap.xml` never list drafts. Series
membership is `seriesKey` + `episodeN` on the toon. Episode count on a
catalog card is **visible** episodes only (a draft sibling does not make
“2 episodes”). `/llms.txt` is SSR from the catalog. `/toons/editor/` is
`Disallow` in `robots.txt` and is not in the sitemap.

The toon form has no Reader URL field. `POST /toons` and `PATCH /toons/:id`
derive it from the series' `hub_url` + the toon's own slug
(`deriveReaderUrl` in `worker/toon-editor/src/index.ts`) whenever the toon
has a series and no `reader_url` yet — never clobbers one already set.
A toon created before this existed self-heals the next time it's saved.
Ungrouped toons (no series) still end up with `reader_url = null`, falling
back to `/toons/<slug>/` everywhere that reads it.

Deploy the Worker from its directory (`cd worker/toon-editor && npx wrangler
deploy`), not the Pages project at the repo root. Full routes:
`worker/toon-editor/README.md`.

**Reka UI is scoped to this editor, never the public site.** Dialogs, checkboxes
and selects under `src/toons/editor/components/ui/` wrap `reka-ui` primitives
(`EditorDialog.vue`, `EditorCheckbox.vue`, `EditorSelect.vue`). Site pages
(`SiteNav`, readers, hubs, quick-view dialogs) stay on native `<dialog>` /
`@headlessui/vue` / plain JS — the site is progressive-enhancement, crawlable
and usable without JS, and Reka needs a Vue mount point that would break that.
Docs mirror pulled to `docs/reka-ui/llms.txt`.

`.env` (gitignored) for scripts such as `npm run import-toon`:

```
EDITOR_EMAIL=…
EDITOR_PASSWORD=…
```

The browser login form does not read `.env`. JWT signing secret is
`JWT_SECRET` in `worker/toon-editor/.dev.vars` locally, a Wrangler secret in
production.

Caption TTS / SFX from the inspector wand is
`POST /toons/:id/audio/generate` — `ELEVENLABS_API_KEY` in `.dev.vars` locally
and `npx wrangler secret put ELEVENLABS_API_KEY` on the Worker (repo-root
`.env` is only for the Python CLI). Upload an mp3 still works without it.

Plate **Generate** on the filmstrip plus card (after the last thumb) is
`POST /toons/:id/pages/generate`. The series owns one Comfy **Save API**
`.json` plus character-sheet slots (`POST /series/:key/flow` and `/refs`).
The dialog sends a prompt and optional previous plate; the Worker uploads
slot files to Comfy `/upload/image`, writes LoadImage names, then writes the
typed prompt onto the flow before `POST {COMFY_URL}/prompt`, then the studio
polls `GET /jobs/:id`. Upload a plate still works without Comfy.

`POST /toons/:id/pages/generate` is multipart, not JSON — a `previous` slot
can take an operator-attached image (`previousFile` field) instead of the
real last plate: the toon's first page has no previous plate to auto-fill,
and this also lets you swap in a different reference for one generation.
The override always wins over the actual last plate when both are present
(`startPageGenerate`'s `previousOverride` in `generatePage.ts`); it's never
written to R2 or the series config, just uploaded straight to Comfy for that
one job.

**Where the prompt lands is configurable, not always the Seedream node.** A
flow can build the prompt upstream (`StringConcatenate` / `PrimitiveStringMultiline`
nodes feeding Seedream's `prompt` as a link, e.g. to stack a fixed character-pin
block under the per-page text — see `erin-ep2-generate-switch.api.json`).
Every flow upload scans the graph for literal string inputs at least 20 chars
(`findPromptCandidates` in `comfyFlow.ts`) and the series form
(`SeriesForm.vue`, "Prompt goes into") picks one, stored as `generate.promptTarget`
(`{nodeId, inputKey}`). `applyPagePrompt` writes there if set; with no target
picked it falls back to every Seedream node's own `prompt` — but skips any
whose `prompt` is a link rather than a literal, so a flow with an upstream
chain and no target chosen yet leaves that chain alone instead of silently
severing it. Re-uploading a flow drops a stored target that no longer matches
a candidate in the new graph.

Comfy hands back PNG (occasionally JPEG). `worker/toon-editor/src/imageOptimize.ts`
re-encodes it to WebP q90 before it hits R2, via `@jsquash/webp` + `@jsquash/png`/
`@jsquash/jpeg` — same target as the hand-placed swap-page pipeline, so a
generated plate doesn't ship 3-5x heavier than everything else. Workers can't
do dynamic wasm fetches, so each codec's `.wasm` is a static import handed to
that codec's own `init()`; Vitest can't load raw `.wasm` either, so
`vite.config.ts` aliases the three specifiers to `src/test/wasmStub.ts` under
`VITEST` only. Encode failure falls back to the original bytes rather than
losing the generation.

The browser never talks to Comfy or ElevenLabs. For Seedream (a Comfy
**partner node**) you need both:

| Secret | What it is |
| --- | --- |
| `COMFY_URL` | Comfy origin the Worker can `fetch` (`/prompt`, `/upload/image`, `/jobs` or `/history`, `/view`). Staging: `https://cloud.comfy.org/api` (Comfy Cloud) or another public host. **Cannot** use `http://127.0.0.1:8188` on staging. Not the RunComfy square **model** API. |
| `COMFY_API_KEY` | Comfy **account** key from [platform.comfy.org](https://platform.comfy.org/login) → API Keys (`comfyui-…`). Sent as `extra_data.api_key_comfy_org` (and `Authorization: Bearer`). |

```bash
cd worker/toon-editor
npx wrangler secret put COMFY_URL      # https://your-hosted-comfy
npx wrangler secret put COMFY_API_KEY  # comfyui-…
npx wrangler deploy
```

Local `make dev` reads the same names from `worker/toon-editor/.dev.vars`.
Missing `COMFY_URL` → 503 `ComfyUI is not configured`; the dialog shows that
string (not the unreachable-API hint).

```bash
make dev              # Vite :5173 + editor Worker :8787
npm run typecheck     # vue-tsc + tsc -p worker/toon-editor
```

## Toon catalog SSR

Google’s renderer eventually runs JavaScript; most AI crawlers (Claude,
GPTBot, Perplexity) do not. The catalog, series landings and readers therefore
cannot depend on Vue painting the first HTML.

| Layer | What it does |
| ----- | ------------ |
| `/toons/` shell | Empty `[data-toon-catalog]`; stub JSON-LD on `data-toon-jsonld` |
| `src/toons/_hub/` | Empty `<main>` + `seriesPageMain.ts` (nav chrome) |
| `src/toons/_reader/` | One FlipFrame app (`ToonApp.vue`) for every book |
| `functions/toonSsr.ts` | `GET /catalog?site=<origin>` (60s cache). Catalog inject; **hubs and readers are written from D1** (`hubMainHtml` / `applyReaderHtml`) |
| `functions/sitemap.xml.ts` · `llms.txt.ts` | Same catalog: static site pages + hubs + readers |
| `functions/_middleware.ts` | `withToonSsr`, then staging Basic Auth + `X-Robots-Tag: noindex` |
| `vite/plugins/toonSsrDev.ts` | Same HTML + `/sitemap.xml` + `/llms.txt` on `make dev` |
| Browser | Continue-reading, like counts, quick-view. **Does not paint the shelf or hub cards.** |

`src/site/catalogRender.ts` and `src/site/toonPages.ts` are the builders (no
`document`). A second client-only card template will drift from what crawlers
see.

A hub URL is D1 `series.hub_url` (`/toons/<series>/`). An episode URL is D1
`reader_url` (`/toons/<series>/<episode>/`). CDN plates stay under
`asset_page_dir` (`/toons/<slug>/` — not the public reader path). The D1
series **key** may differ from the hub slug (`red-smile` vs `/toons/redsmile/`).

Staging and production share one remote D1. Production catalog is `published`
only; staging (and local Vite, `site=http://127.0.0.1:…`) also shows
`staging`. Drafts never appear on either. Verify crawler HTML with curl, not
a screenshot of the Vue app:

```bash
# production (no auth)
curl -sS https://twentyseven.pictures/toons/ | grep -E 'series-card|data-toon-jsonld'
# staging (HTTP Basic — Pages secrets; do not put this in GSC)
curl -sS -u "$PREVIEW_USER:$PREVIEW_PASS" https://staging.twentyseven.pictures/toons/ \
  | grep -E 'series-card|X-Robots-Tag'
```

The Worker host is the API. Crawlers should hit the **site origin** (`/toons/`,
`/sitemap.xml`, `/llms.txt`). Do not put catalog HTML on
`toon-editor.sangalli-marco.workers.dev`.

## Toon Reader (FlipFrame — Erin, Jax, Nero, …)

One reader app (`src/toons/_reader/ToonApp.vue`) serves every book. The Pages
Function stamps `data-toon-slug` (D1 slug) and `data-asset-page-dir` (CDN
prefix). Config is `GET /config/:slug`. Jax music is the only slug-specific
chrome.

| Path | Role |
| ---- | ---- |
| `src/toons/bookReader/` | FlipFrame package |
| `src/toons/_reader/` | Shared reader HTML + `ToonApp.vue` |
| Worker `GET /config/:slug` | Live book JSON from D1 |
| `public/toons/reader-shared.css` | Shared book chrome |
| `public/toons/<slug>/assets/` | **Gitignored** — R2 via `VITE_ASSET_BASE` |

| Toon | Public URL | D1 slug / CDN prefix | Notes |
| ---- | ---------- | -------------------- | ----- |
| Erin EP 1 | `/toons/erin-and-the-goblins/the-missing-child/` | `erin` · `/toons/erin/` | 27 plates. Old `/toons/erin/` 301s |
| Erin EP 2 | `/toons/erin-and-the-goblins/the-revenge/` | `erin-the-revenge` | 23 plates. Old `/toons/erin-the-revenge/` 301s |
| Jax EP 1 | `/toons/jax/the-chip/` | `jax` · `/toons/jax/` | Hub `/toons/jax/`. Old `/toons/jax-the-chip/` 301s |
| Nero EP 1 | `/toons/nero/the-dog/` | `nero` · `/toons/nero/` | Hub `/toons/nero/`. Old `/toons/nero-the-dog/` 301s |
| RED SMILE EP 1 | `/toons/redsmile/static/` | `redsmile-static` | Hub `/toons/redsmile/` (`key` `red-smile`). Old `/toons/redsmile-static/` 301s |
| RED SMILE EP 2 | `/toons/redsmile/marcus/` | `redsmile-marcus` | Old `/toons/redsmile-marcus/` 301s |

`ASSET_PAGE_DIR` is a **CDN key prefix, not a route**. Jax plates stay
`toons/jax/assets/<md5>` even though the reader is `/toons/jax/the-chip/`.

- **`config-url`** — `readerConfigUrl("<slug>")` (D1; local Vite `/__editor-api`).
- Product attribution **“FlipFrame — by twentyseven.pictures”** lives in
  `FrontCoverInstructions.vue` (shared).

```bash
# After new plates/audio — one command, right order (then push, or it deploys itself)
make ship TOON=jax              # → staging (local wrangler)
make ship TOON=jax PROD=1       # → twentyseven.pictures
make ship TOON=jax DRY=1        # plan + asset check only
```

Caption-only edits: change the bubbles in `/toons/editor/` (D1). There is no
`config.json` publish step for the live reader.

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
outside `content/` and never shipped. Live books are D1 (`/toons/editor/`).
`content/toons/` holds READMEs and optional import snapshots; unpublished
pre-production notes do not belong there.

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
| Erin & the Goblins | `/toons/erin-and-the-goblins/` | `/toons/erin-and-the-goblins/the-missing-child/` |
| Nero | `/toons/nero/` | `/toons/nero/the-dog/` |
| Jax | `/toons/jax/` | `/toons/jax/the-chip/` |
| RED SMILE | `/toons/redsmile/` | `/toons/redsmile/static/` |

Landings are indexable and take a locale prefix (`/de/toons/jax/`). The
language switcher treats `/toons/<series>/` as a hub (one extra path segment);
readers (`/toons/<series>/<episode>/`) stay on one English URL + `?lang=`.
`src/toons/_hub/index.html` is an empty shell; `hubMainHtml()` writes the
`<main>` from D1. Vue only mounts site chrome, like counts, and forwards
`?page=` using `data-episode-one`. Back-cover next/prev is
`episodeNavFromCatalog` (D1), not a hardcoded `SERIES` table.

`/toons/red-smile/` 301s to `/toons/redsmile/`. After a hub URL change, set D1
`series.hub_url` (editor series form). Catalog, sitemap and llms.txt all read
that field.

**Nero and Jax used to be readers at those clean URLs.** `/toons/nero/` and
`/toons/jax/` are **not** redirected — they serve the series page. Deep links
are `/toons/nero/the-dog/?page=N` (1-based). `seriesPageMain.ts` forwards any
`?page=` on a landing to episode one using `data-episode-one` (and
`data-series-key` on `<html>`). Keep those attributes.

### Reader SEO (crawlable fallback)

Without the Function, a reader URL would serve the empty `_reader` shell and
the story would arrive from D1 JSON after JS. `applyReaderHtml` stamps the
shared `src/toons/_reader/index.html`:

- a **fallback article inside `#app`** — title, logline, page count, languages,
  links to the hub and `/toons/`. Vue replaces it on mount (`.reader-fallback`
  is gone once `.book-scene` exists). Style is `.reader-fallback` in
  `reader-shared.css`.
- **`WebPage` + `BreadcrumbList` + `CreativeWork`** on `data-toon-jsonld`.
  Cover copy and schema both come from D1.
- **og/twitter** from D1 cover/OG art (1200×630 landscape crops — portrait
  card art crops badly on `summary_large_image`).
- **`data-episode-nav`** JSON (`episodeNavFromCatalog`) so FlipFrame back
  covers point at the next/prev episode.

Keep the fallback inside `#app`. There is no per-toon `index.html`.

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
  disc radius clear on each side — that is the `100vw - 64px` term in the
  shared `_reader` `<style>`. Shrink that gutter and `.reader`'s overflow
  slices the outer half of the disc off.

### Per-toon geometry tokens (`--plate-aspect`, `--strip-width`)

`reader-shared.css` used to hardcode Jax's plate shape in two places, which
silently mis-sized every other toon:

| Token            | What it drives                                | Default (fallback) |
| ---------------- | --------------------------------------------- | ------------------ |
| `--plate-aspect` | `aspect-ratio` of a vertical-scroll page slot | `1008 / 1792`      |
| `--strip-width`  | Width cap of the scroll strip                 | `min(98vw, 720px)` |

SSR writes `--plate-w` / `--plate-h` / `--strip-cap` and `data-paper` on the
shared `_reader` `<html>` from D1 (`designWidth` / `designHeight`). Erin is
`1152 / 1728` with a 900px strip; Nero and RED SMILE are `800 / 1424`; Jax
keeps the 9:16 defaults. Get `--plate-aspect` wrong and every page scrolls
with bands above and below it; leave `--strip-width` at the 9:16 value and a
wider 2:3 book reads as a narrow locked column next to the same page in flip
view.

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

**The shared `_reader` template keeps one `<style>` block**: book tokens
(`--book-width`, `--page-bg`, fullscreen overrides), not site chrome. Paper
colour is `data-paper="dark"|"light"` on `<html>`.

Anything shared by more than one page belongs in `styles.css`; run
a build after touching it; `vite/plugins/hashedCss.ts` re-hashes the filename.

### What goes where (CSS)

There is no per-toon HTML. Book-aspect tokens and fullscreen overrides live
on `src/toons/_reader/index.html`. Jax music is the only slug-specific chrome
(`ToonApp.vue` when `data-toon-slug="jax"`).

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

Captions live in **D1**, edited at `/toons/editor/` (not
`content/toons/*/config.json`). Optional `"audio": "assets/sfx/<md5>.mp3"` on a
bubble is resolved via `asset-page-dir`.

SFX/music binaries are content-hashed and live on **R2** (not in git).

Playback is in `src/toons/bookReader` caption code. Caption SFX play on tap
(no mute gate). Background music toggle lives in `ToonApp.vue` when the D1
slug is `jax` (`BG_MUSIC` via `resolveAssetUrl`). Shared `useSoundGate`
remains available for other toons that want an opt-in SFX prompt.

**Bubble variants (word overlays):** gallery at `/toons/editor/bubble-lab/`
(every variant × tail, same caption pipeline; nothing saved).

| `variant` | Look                             | Use                |
| --------- | -------------------------------- | ------------------ |
| `bubble`  | Organic speech balloon           | Character dialogue |
| `thought` | Cloud / lobe balloon             | Inner voice        |
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

Update `BG_MUSIC` in `src/toons/_reader/ToonApp.vue` to the new hash, then
deploy. Do not commit the binary.

## SEO State

### Completed

- Page title: `27 Pictures | AI Horror Shorts & Cinematic Cosplay Production`
- Meta description updated (matches YouTube channel description)
- JSON-LD schema split across pages (2026-08): homepage keeps Organization, WebSite, WebPage, 3× Person, the Jax-short VideoObject and the VFX Service — the cosplay showcase VideoObject lives on `/cosplay/#showcase` and the homepage references it by bare `@id` only (a typed stub would parse as its own VideoObject missing required fields); `/horror-shorts/` owns CreativeWorkSeries + ItemList of 5 VideoObjects; `/cosplay/` owns the cosplay Service + FAQPage; both add BreadcrumbList
- Person schema: 3 founders (Sonia, Marco, Daniele Sangalli) with `jobTitle`/`description`/`worksFor`, linked from `Organization.founder`
- Organization location: Switzerland & United Kingdom
- IndexNow key deployed + submitted (`bdd5e80e21a8430d9316de0deacdb208`)
- All VideoObject `uploadDate` values are ISO-8601 with a timezone
  (`YYYY-MM-DDT00:00:00Z`). A bare date (`2026-04-27`) fails Google’s
  rich-result check. Durations use real YouTube values.
- `/llms.txt` — Pages Function; films/services are static, toon hubs and
  readers come from D1. Crawler directives live only in `robots.txt`
- `public/robots.txt` — search + AI _citation_ crawlers allowed
- Indexable hub pages added (2026-08): `/horror-shorts/` and `/cosplay/`, each 800+ words of unique copy
- `/experiments/` → `/toons/` with 301s in `public/_redirects`
- Toon catalog + series hubs SSR from D1 (`functions/toonSsr.ts`) so
  crawlers that do not run JS still see cards and JSON-LD
- Sitemap is a Pages Function at `/sitemap.xml` (static site pages + D1 hubs
  and readers). Drafts omitted; Public (and Staging on staging) come from D1.
  Worker `GET /sitemap.xml` still exists as the same list for debugging.
- RED SMILE: Marcus is Public (`index, follow`)
- Staging is HTTP Basic + `X-Robots-Tag: noindex` — never submit
  `staging.twentyseven.pictures` to Search Console
- No on-site analytics (GA4 / Cloudflare Web Analytics). `privacy.html`
  says so. Search Console is a Google account, not a tag on the page.

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
`sitemap.xml`). Pages Function (`functions/sitemap.xml.ts` +
`src/site/crawlerDocs.ts`): `LOCALIZED_SITE_PATHS` × locales plus **D1**
series hubs (localized) and readers (English). `/llms.txt` is the same catalog
plus a fixed film/service list. Drafts and `/toons/editor/` are omitted.
Staging includes `staging` toons. `make dev` serves both the same way.
`robots.txt` points at `/sitemap.xml`.

Flipping a toon to Public is enough (no XML or markdown edit).

**`LOCALIZED_SITE_PATHS`** (`worker/toon-editor/src/sitemap.ts`) is the list of
**site** English paths expanded to en/it/de/fr. Hubs and readers are **not**
on that list — they come from D1 `hub_url` / `reader_url`. The Pages Function
imports this file, so a **Pages** deploy picks up a new static path. Worker
`GET /sitemap.xml` is the same list for debugging; redeploy the Worker only
if you still curl that host.

When you add a translated site page (`/studio/`, a new short, …):

1. HTML + `LOCALE_PAGES` + `LOCALIZED_PATHS` (so `/de/studio/` exists).
2. Append `"/studio/"` to `LOCALIZED_SITE_PATHS` (trailing slash).
3. Optional: add `images["/studio/"]` in `staticSitemapUrls()`.
4. Push Pages. Toons appear when Public in `/toons/editor/`.
5. An internal link.

Do not put readers or `/toons/editor/` on that list. Verify:

```bash
curl -sS https://twentyseven.pictures/sitemap.xml | grep '<loc>'
curl -sS https://twentyseven.pictures/llms.txt | head
```

**Adding a page** — every new indexable URL needs these, or it exists but
nothing points at it:

1. A real HTML page (and locale copies if it is a site page, not a reader)
2. An internal link from somewhere real (nav, homepage section, footer)
3. Toon readers/series: Public in `/toons/editor/` — the Pages Function
   sitemap and `/llms.txt` pick them up. Other site URLs:
   `LOCALIZED_SITE_PATHS` as above.

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

**GSC “Discovered – currently not indexed”** with Last crawled N/A means the
URL is in the sitemap (or linked) and sitting in the crawl queue — not that
the page is broken. Request indexing if it is urgent; otherwise wait.

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
| `/llms.txt`                       | Pages Function: films/services + D1 toon hubs/readers (llms.txt spec)                                                                           |
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

- When a new Short is published: add `/horror-shorts/<slug>/` (VideoObject + writeup, `uploadDate` as `YYYY-MM-DDT00:00:00Z`), then update the hub ItemList, `LOCALIZED_SITE_PATHS` (push Pages), the film list in `src/site/crawlerDocs.ts` (`FILM_LINKS`) and the homepage film list
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
  `https://staging.twentyseven.pictures` (HTTP Basic Auth + `X-Robots-Tag:
  noindex`). Carries work in review. Merge `staging` → `main` to ship.
- A Pages push ships `functions/` (catalog/hub/reader SSR, `/sitemap.xml`,
  `/llms.txt`). Editor API changes need
  `cd worker/toon-editor && npx wrangler deploy`. `LOCALIZED_SITE_PATHS`
  is imported by the Function — a Pages deploy is enough for a new site path.
- **Local fallback:** `make preview-deploy` / `make deploy` still talk to
  Wrangler directly when you need a one-off without a push.
- **Remote:** `git@github.com:xibitdigital/27-pictures-website.git`
- **Contributors:**
  - Marco Sangalli (sangalli.marco@gmail.com)
  - Daniele Sangalli (daniele@xibitdigital.com)
