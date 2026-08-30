# toon-editor Worker

TypeScript Cloudflare Worker (`src/*.ts`; Wrangler compiles it) for the Vue
studio at `/toons/editor/`. Toons, series, pages and bubbles live in D1.
Covers and plates go to the `twentyseven-assets` R2 bucket under
`editor/<slug>/…` (series covers under `editor/_series/<key>/cover/…`).

JSON the studio and the public site share is in `src/apiTypes.ts` (camelCase
records, no Cloudflare types). Worker-only D1 rows and bindings stay in
`src/types.ts`. The Vue app re-exports the contract from
`src/toons/editor/types.ts`.

`GET /config/:slug` is public FlipFrame JSON. Staging hosts (and local Vite)
also see `status=staging`; production only sees `published`. Drafts never
appear on `/toons/` or in the public config. `GET /toons/:id/export` is the
same shape, JWT-gated, by UUID — drafts included.

Cover and plate `fileUrl`s that start `editor/` are served at
`GET /media/editor/<slug>/…` (hashed keys, no auth). CDN keys (`toons/…`,
`card-art/…`) still resolve through `ASSET_BASE`.

## Auth

Email + password accounts in D1. Passwords are PBKDF2 (SHA-256, 100k). Login
returns an HS256 JWT signed with `JWT_SECRET` (7-day `exp`). The Vue app keeps
it in `sessionStorage` and sends `Authorization: Bearer <jwt>` on studio
requests. Public catalog / config / likes / media stay unauthenticated. A
missing or short `JWT_SECRET` fails closed.

Local scripts (`npm run import-toon`) sign in with `EDITOR_EMAIL` /
`EDITOR_PASSWORD` from `.env` (gitignored). Do not put the password in this
file.

The first person to open `/toons/editor/` sees **Create editor account**. After
that, registration is closed and the form is log in. Extra accounts:
`POST /auth/users` while logged in.

## Studio routes (hash)

`/toons/editor/` is an MPA entry with hash history (reload-safe on Pages).

| Hash | Screen |
| ---- | ------ |
| `#/` | Episodes grouped under each series + ungrouped toons |
| `#/series/new` | Create series |
| `#/series/:key` | Edit series (cover, hub URL, descriptions) + episode list |
| `#/new` | Create toon (visibility, series, episode number) |
| `#/:id` | Edit toon metadata |
| `#/:id/pages/:pageId?` | Plate studio (captions, replace file) |

Visibility on a toon is `draft` | `staging` | `published` (the form labels
published as Public). Catalog and public config use the calling site: staging
and local see published + staging; production sees published only.

## HTTP

| Method | Path | Who | Notes |
| ------ | ---- | --- | ----- |
| GET | `/auth/status` | public | `{ hasUsers }` |
| POST | `/auth/register` | public while no users | first account |
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | JWT | `{ user }` |
| POST | `/auth/logout` | JWT | client drops the token |
| POST | `/auth/users` | JWT | add another editor |
| GET | `/catalog` | public | `{ series, ungrouped }` — filtered by site |
| GET | `/sitemap.xml` | public | Same XML as the site Function (debug). Crawlers should hit the **site origin** |
| GET | `/config/:slug` | public | FlipFrame JSON if status is visible for the site |
| GET | `/likes` | public | `{ likes: { [toon]: n } }` |
| GET | `/likes?toon=` | public | `{ toon, likes }` |
| POST | `/likes` `{ toon }` | listed origins | `{ toon, likes, counted }` |
| GET | `/media/editor/…` | public | R2 object under `editor/` |
| GET | `/series` | JWT | `{ series: SeriesOption[] }` with `toonCount` |
| GET | `/series/:key` | JWT | `{ series, toons }` |
| PUT | `/series` | JWT | create/update series metadata |
| POST | `/series/:key/cover` | JWT | series cover upload |
| GET | `/toons` | JWT | list items (`seriesKey`, `episodeN`, `status`) |
| POST | `/toons` | JWT | create |
| GET | `/toons/:id` | JWT | full record |
| PATCH | `/toons/:id` | JWT | metadata + series + visibility |
| POST | `/toons/:id/cover` | JWT | cover |
| POST | `/toons/:id/audio` | JWT | caption clip |
| POST | `/toons/:id/pages` | JWT | append plate |
| POST | `/toons/import` | JWT | load a reader config JSON |
| GET | `/toons/:id/export` | JWT | FlipFrame JSON including drafts |
| POST | `/pages/:id/file` | JWT | replace plate, keep captions |
| DELETE | `/pages/:id` | JWT | drop page, reindex |
| POST | `/pages/:id/bubbles` | JWT | add caption |
| PATCH | `/bubbles/:id` | JWT | caption |
| DELETE | `/bubbles/:id` | JWT | caption |

CORS allows `GET, POST, PUT, PATCH, DELETE, OPTIONS`. Origins: `ALLOWED_ORIGINS`
plus localhost / `127.0.0.1` / `local.twentyseven.test`.

Likes sit in D1 (`toon_likes` / `toon_like_votes`). A toon is allowed if it has
a `toons` row or is listed in `ALLOWED_TOONS`. One counted vote per IP per toon
per day.

## One-time setup

```bash
cd worker/toon-editor
npx wrangler d1 create toon-editor
# paste database_id into wrangler.toml
npx wrangler d1 migrations apply toon-editor --remote
npx wrangler secret put JWT_SECRET
npx wrangler deploy
```

Must deploy from `worker/toon-editor` (this package’s Wrangler), not the Pages
project at the repo root.

## Local

```bash
make dev              # Vite :5173 + this Worker on :8787
make editor-worker    # Worker only
```

`make dev` does **not** need `VITE_EDITOR_API`: Vite proxies `/__editor-api` to
`:8787`. That Worker uses **local Miniflare D1**, not the remote one. Ctrl-C
stops both.

`.env` (repo root, gitignored):

```
EDITOR_EMAIL=…
EDITOR_PASSWORD=…
```

Used by `npm run import-toon`. The browser login form does not read `.env`.

Typecheck: `npx tsc -p worker/toon-editor --noEmit` (also part of
`npm run typecheck`). Tests: `npx vitest run worker/toon-editor`.

## Catalog HTML is not this Worker

`GET /catalog` is JSON. The HTML shelf on `/toons/`, series hubs
(`/toons/<series>/`) and readers (`/toons/<series>/<episode>/`) is stamped
at the **site origin** by the Pages Function `functions/toonSsr.ts`
(`withToonSsr` in `_middleware.ts`), using `src/site/catalogRender.ts` and
`src/site/toonPages.ts`. Local `make dev` does the same inject via
`vite/plugins/toonSsrDev.ts`. Vue does not paint those cards.

Crawlers that skip JavaScript (Claude, GPTBot, Perplexity) therefore see
cards and JSON-LD in the first response. Do not serve catalog HTML from
this Worker host — keep it an API.

## Sitemap (site origin, not this Worker)

Crawlers should fetch `https://twentyseven.pictures/sitemap.xml` (and
`/llms.txt`). Those are Pages Functions (`functions/sitemap.xml.ts`,
`functions/llms.txt.ts`) that call `GET /catalog` and render with
`src/site/crawlerDocs.ts`. Local `make dev` does the same via
`vite/plugins/toonSsrDev.ts`.

This Worker still serves `GET /sitemap.xml` as the **same XML** for debugging.
Do not submit the Worker host to Search Console.

Body = `LOCALIZED_SITE_PATHS` × locales + D1 series hubs (locales) + D1
readers (English). Drafts and `/toons/editor/` are omitted. Staging hosts
include `status=staging`; production is `published` only.

### Updating `LOCALIZED_SITE_PATHS`

File: `src/sitemap.ts` (imported by `src/site/crawlerDocs.ts`). English path,
trailing slash. The helper emits `/path/`, `/it/path/`, `/de/path/`,
`/fr/path/`.

**Add a path** when you ship a new **translated site page** that is not a toon
series hub or reader (homepage, `/watch/`, `/cosplay/`, a horror short, …):

1. The page already has HTML and is in `LOCALE_PAGES` + `LOCALIZED_PATHS`
   (`src/site/i18n.ts`) so `/de/…` is a real document.
2. Append the English path to `LOCALIZED_SITE_PATHS`.
3. Optional OG/card image: `images["/your-path/"]` in `staticSitemapUrls()`.
4. Push **Pages**. The Function imports this file. Redeploy this Worker only
   if you still curl the Worker host.

**Do not add**

| URL | Why |
| --- | --- |
| `/toons/jax/`, `/toons/redsmile/`, … | Series `hub_url` from D1 when an episode is visible |
| `/toons/redsmile/static/`, `/toons/nero/the-dog/`, … | `reader_url` from D1 when Public (Staging on staging) |
| `/toons/editor/` | `robots.txt` Disallow |

Hubs are **not** in `LOCALIZED_PATHS`. The language switcher treats
`/toons/<one-segment>/` as a hub (`isToonSeriesHubPath` in `src/site/i18n.ts`).

Check (site origin, not the Worker):

```bash
curl -sS https://twentyseven.pictures/sitemap.xml | grep '<loc>'
curl -sS "https://toon-editor.sangalli-marco.workers.dev/sitemap.xml?site=https://twentyseven.pictures" \
  | grep '<loc>'   # debug only
```

## Staging / production

Staging and production Pages both call the same deployed Worker, so they share
the remote D1. Dump it with `npm run backup-db`. Copy a dump into local
Miniflare with `npm run restore-db` (or `npm run restore-db -- --dump` to
export first). Restart `make dev` after a restore.
