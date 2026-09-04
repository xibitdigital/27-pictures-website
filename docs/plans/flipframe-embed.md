# Embed a FlipFrame reader in another site

**Not shipped.** Living docs after this lands: `CLAUDE.md` → Toon Reader.
This file is the plan.

A production reader URL cannot be dropped into a foreign `<iframe>` today.
`public/_headers` sends `X-Frame-Options: SAMEORIGIN` on every path, so the
browser refuses the frame. CSP has no `frame-ancestors`. Staging is also HTTP
Basic, so a partner origin cannot load a staging reader even if framing were
allowed.

Do **not** lift SAMEORIGIN on the whole site. That would clickjack `/`,
`/toons/editor/`, and the contact form. Do **not** hang embed mode off
`?embed=1` on the public reader: `_headers` is path-based and cannot drop XFO
for a query string.

## Recommended shape

Dedicated embed URL, same FlipFrame app, path-scoped headers.

```
https://twentyseven.pictures/embed/toons/<series>/<episode>/
```

| Public reader | Embed |
| --- | --- |
| `/toons/nero/the-dog/` | `/embed/toons/nero/the-dog/` |
| `/toons/erin-and-the-goblins/the-revenge/?page=4&lang=it` | `/embed/toons/erin-and-the-goblins/the-revenge/?page=4&lang=it` |

`?page=` and `?lang=` keep working. Theme query keys (below) only apply on
`/embed/…`.

**Embed is not a public URL.** `noindex, nofollow` on the page. `Disallow:
/embed` in `robots.txt`. Never listed in `/sitemap.xml`, `/llms.txt`, IndexNow,
catalog cards, or `LOCALIZED_SITE_PATHS`. Canonical and OG stay on the public
reader.

Partner snippet:

```html
<iframe
  src="https://twentyseven.pictures/embed/toons/nero/the-dog/"
  title="Nero — The Dog"
  style="width:100%;max-width:720px;aspect-ratio:800/1424;border:0;background:#000"
  allow="fullscreen; autoplay"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
```

`aspect-ratio` comes from D1 `designWidth` / `designHeight` (already written as
`--plate-w` / `--plate-h` on the reader). Portrait books are not 16:9; a
560px-tall 16:9 box crops the plate.

## Framing headers

Keep the global `X-Frame-Options: SAMEORIGIN`. Add a path rule for `/embed/*`:

- Omit `X-Frame-Options` (CSP `frame-ancestors` is ignored in some browsers if
  XFO is also present).
- Add `frame-ancestors` to CSP with an explicit host allow-list (start:
  `'self'` plus named partner origins).
- `Permissions-Policy` / iframe `allow`: `fullscreen`, `autoplay` (caption SFX
  and Jax music). Do not grant camera/mic/geo.

Cloudflare Pages `_headers` can do this. If the allow-list needs to be
per-toon later, move the embed response headers into `functions/toonSsr.ts`
instead of a static file.

**Allow-list vs open embed.** Start allow-listed. An open `frame-ancestors *`
lets anyone wrap the book (phishing chrome, like-button clickjacking). Add
partner hosts in one place (`EMBED_FRAME_ANCESTORS` next to the CSP in
`_headers`, or a Pages env var the Function reads). A later D1 `embed_hosts`
column on series/toon is optional; skip it until more than a handful of
partners exist.

Production only. Staging Basic Auth cannot be satisfied by a foreign iframe.
Partners point at `twentyseven.pictures`, and only `published` episodes
resolve (same catalog rule as the public reader).

## What the iframe shows

Reuse `src/toons/_reader/` + `ToonApp.vue`. SSR (`applyReaderHtml` /
`functions/toonSsr.ts` / `vite/plugins/toonSsrDev.ts`) already stamps slug,
asset dir, paper, and episode nav from D1. Embed is a second route onto that
template, not a second reader.

Detect embed via path prefix (or `data-embed` stamped by SSR). Then:

- Hide breadcrumb (`[data-reader-trail]`) and any site chrome that is not
  FlipFrame.
- Keep lang, like, music (Jax), view toggle, fullscreen, progress, auto-read,
  cover start.
- Cover “start” stays: caption audio needs a gesture (`mediaUnlock.ts`).
  Autoplay in a cross-origin iframe is blocked until that tap.
- Fullscreen must request the **iframe** document
  (`document.documentElement.requestFullscreen` already does). Host must pass
  `allow="fullscreen"`.
- Outbound links (`/toons/`, hub, next/prev episode) open `target="_blank"`
  `rel="noopener"` so they do not navigate the host page.
- Small attribution: “FlipFrame — twentyseven.pictures” linking to the
  canonical reader (same line already used on the front cover).
- `localStorage` for lang / continue-reading is partitioned per embedder in
  modern browsers; that is fine. Likes still hit the existing Worker.

Layout: public reader sizes to `100vw` with a 64px gutter for page-turn discs.
Inside an iframe, `100vw` is the iframe, not the host viewport — drop the site
gutter, fill `100%` / `100dvh` of the frame, keep `--plate-aspect`. Host sets
the box; the book fills it.

## Host theming (embed only)

The host can restyle the frame with query params that map onto the existing
`:root` custom properties. No free-form CSS, no `style=` injection.

```
/embed/toons/nero/the-dog/?bg=111111&page-bg=0a0a0c&cover=050505&spine=1a1a22&text=f5f5f5&muted=cccccc&accent=b30000
```

| Query | Sets | Typical use |
| --- | --- | --- |
| `bg` | `--bg` | Scene / letterbox behind the plate |
| `page-bg` | `--page-bg` | Paper (letterbox on mobile) |
| `cover` | `--cover` | Cover boards |
| `spine` | `--spine` | Book spine |
| `text` | `--text` | Primary chrome type |
| `muted` | `--text-muted` | Secondary chrome |
| `accent` | `--red-smile` | Controls / progress |

Rules:

- Embed path only. The public reader ignores these keys so a shared `?bg=`
  cannot recolour `/toons/nero/the-dog/`.
- Values are hex only (`RGB`, `RRGGBB`, optional `#` / `RRGGBBAA`). Anything
  else is dropped.
- Unknown keys are ignored. Never assign an arbitrary property name from the
  URL.
- Applied as inline custom properties on `<html>` after `data-paper` defaults,
  so they override light/dark paper without a second stylesheet.
- Snippet in the editor includes the keys with that toon’s paper defaults
  filled in, so a partner can change two values and leave the rest.

v2 (not first cut): `postMessage({ type: "flipframe-theme", vars: { … } })`
from the parent for live restyle without a reload.

## Routing

`functions/toonSsr.ts` today matches hub/reader paths from D1 `hub_url` /
`reader_url`. Add an `/embed` prefix:

1. Strip `/embed`, resolve the remaining path the same way as a public reader.
2. If it is not a published reader → 404 (do not embed hubs, catalog, editor,
   or drafts).
3. Stamp `data-embed` on `<html>`, `robots noindex`, canonical = public reader
   URL.
4. Mirror in `vite/plugins/toonSsrDev.ts` so `make dev` serves `/embed/toons/…`.

No new Vite MPA entry. Same `_reader` shell. `htmlEntries()` stays as-is.

Sitemap / crawlers: `functions/sitemap.xml.ts` and `src/site/crawlerDocs.ts`
must not emit `/embed/` locs. Worker `GET /sitemap.xml` the same.
`public/robots.txt` adds `Disallow: /embed`. Tests assert no `<loc>` contains
`/embed/`.

## Partner kit (editor, later)

On the toon form (Public only), a read-only snippet: iframe markup +
`aspect-ratio` from design size + copy button. Derive embed src from
`reader_url` (`/toons/…` → `/embed/toons/…`). No new D1 field unless we add
per-toon host allow-lists.

Optional v2 (not in the first cut):

- `postMessage` height (`ResizeObserver` → parent) if the host cannot set
  `aspect-ratio`.
- `postMessage` page/lang if the host wants to drive the book.
- Start page / lang / theme baked into the snippet (`?page=` / `?lang=` /
  colour keys).

## Risks

- **Clickjacking:** mitigated by path-only framing + allow-list + no framing of
  editor/forms.
- **Audio:** first tap is still the cover start; host cannot autoplay captions.
- **Cookies / likes:** third-party iframe storage is partitioned; likes API is
  origin `toon-likes` and should keep working over `connect-src`.
- **CSP on the host:** they must allow
  `frame-src https://twentyseven.pictures`. Document that; we cannot fix their
  CSP.
- **iOS Safari:** iframe + audio unlock + fullscreen are historically flaky;
  keep the existing gesture path and test on a phone, not only desktop Chrome.

## Implementation order

1. `_headers` `/embed/*` (drop XFO, add `frame-ancestors` allow-list). Confirm
   a throwaway HTML file on another origin can frame `/embed/…` and still
   cannot frame `/` or `/toons/editor/`.
2. SSR route: `/embed` + public reader path → same `applyReaderHtml` with embed
   stamps. 404 otherwise. Dev plugin parity.
3. Reader chrome: `data-embed` → fill the frame, hide breadcrumb, blank-target
   outbound, attribution. Parse allowlisted colour query keys onto `<html>`
   style.
4. Tests: SSR path + header presence; no sitemap/`llms.txt` embed locs;
   `robots.txt` Disallow; invalid hex ignored; public reader ignores theme
   keys; non-reader `/embed/toons/` 404s.
5. Docs (same change, not a follow-up):
   - `CLAUDE.md` → Toon Reader: embed URL pattern, iframe snippet, theme query
     keys, `allow` flags, production-only, `Disallow: /embed` / not in sitemap
     or `/llms.txt`.
   - `README.md` Interactive toons: one line + URL, pointing at that section.
   - `public/robots.txt`: `Disallow: /embed`.
   - Do not add a second embed README; the living doc is `CLAUDE.md`.
6. Editor copy-snippet (can ship in a follow-up).

## Docs to update (with the code)

Living place is `CLAUDE.md` **Toon Reader (FlipFrame)**, next to the public URL
table. Add an **Embed** subsection:

- URL: `/embed` + the episode’s `reader_url` (`/toons/nero/the-dog/` →
  `/embed/toons/nero/the-dog/`).
- Copy-paste iframe (including `allow="fullscreen; autoplay"` and
  `aspect-ratio` from `--plate-w` / `--plate-h`).
- Theme query keys (`bg`, `page-bg`, `cover`, `spine`, `text`, `muted`,
  `accent`) → existing CSS variables; hex only; embed path only.
- Host CSP must allow `frame-src https://twentyseven.pictures`.
- Framing allow-list lives in `_headers` `/embed/*` (`frame-ancestors`); rest
  of the site stays `X-Frame-Options: SAMEORIGIN`.
- Production `published` only. Staging Basic Auth cannot be satisfied by a
  foreign iframe.
- **Not in sitemap, `/llms.txt`, IndexNow, or catalog.** `robots.txt`
  `Disallow: /embed`. Canonical is the public reader.

`README.md` Interactive toons gets one pointer (same pattern as the bubble
lab). `robots.txt` is the crawl rule, not a prose doc.

Do not write a standalone `docs/embed.md`.

## Out of scope

- Embedding series hubs or the catalog.
- Open `frame-ancestors *`.
- A second FlipFrame build or npm package for the host to mount.
- Changing public reader URLs or D1 `reader_url`.
- Arbitrary CSS from the host (only the hex → token map above).
