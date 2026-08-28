# toon-editor Worker

Draft store for the Vue studio at `/toons/editor/`. Toons, pages and bubbles live in D1; cover and plate bytes go to the existing `twentyseven-assets` R2 bucket under `editor/<slug>/…`.

`GET /config/:slug` is public and returns FlipFrame `ToonConfig` JSON for a **published** toon (the Erin EP 2 reader uses this in local Vite via `/__editor-api/config/erin-the-revenge`). `GET /toons/:id/export` is the same shape, JWT-gated, by UUID — drafts included.

Cover and plate `fileUrl`s are served by this Worker at `GET /media/editor/<slug>/…` (hashed keys, no auth) so local Miniflare R2 and production share one URL shape. Only keys under `editor/` are readable that way.

## Auth

Email + password accounts in D1. Passwords are PBKDF2 (SHA-256, 100k). Login returns an HS256 JWT signed with `JWT_SECRET` (7-day `exp`). The Vue app keeps it in `sessionStorage` and sends `Authorization: Bearer <jwt>` on every studio request. Public catalog / config / likes / media stay unauthenticated. A missing or short `JWT_SECRET` fails closed (no unsigned tokens).

| Method | Path                | Who                                                      |
| ------ | ------------------- | -------------------------------------------------------- |
| GET    | `/auth/status`      | public `{ hasUsers }`                                    |
| POST   | `/auth/register`    | public **only while there are no users**                 |
| POST   | `/auth/login`       | public `{ email, password }` → `{ token, user }`         |
| GET    | `/auth/me`          | JWT `{ user }`                                           |
| POST   | `/auth/logout`      | JWT — client drops the token (stateless)                 |
| POST   | `/auth/users`       | JWT — add another editor `{ email, password }`           |
| GET    | `/catalog`          | public `{ series, ungrouped }` published cards           |
| GET    | `/config/:slug`     | public FlipFrame JSON for a published toon               |
| GET    | `/likes`            | public `{ likes: { [toon]: n } }`                        |
| GET    | `/likes?toon=`      | public `{ toon, likes }`                                 |
| POST   | `/likes` `{ toon }` | public, listed origins only — `{ toon, likes, counted }` |

Likes sit in D1 (`toon_likes` / `toon_like_votes`). A toon is allowed if it has a `toons` row or is listed in `ALLOWED_TOONS`. One counted vote per IP per toon per day.

The first person to open `/toons/editor/` sees **Create editor account**. After that, registration is closed and the form is log in.

## One-time setup

```bash
cd worker/toon-editor
npx wrangler d1 create toon-editor
# paste database_id into wrangler.toml
npx wrangler d1 migrations apply toon-editor --remote
npx wrangler secret put JWT_SECRET
npx wrangler deploy
```

Local:

```bash
npx wrangler d1 migrations apply toon-editor --local
npx wrangler dev
```

Local Vite (`make dev`) does **not** need `VITE_EDITOR_API`: it proxies `/__editor-api` to this Worker on `:8787`. Keep `make editor-worker` running in a second terminal. That process uses a **local Miniflare D1**, not the remote one.

Staging and production Pages both call the same deployed Worker, so they share the remote D1. Dump it with `npm run backup-db`. Copy that dump into local Miniflare with `npm run restore-db` (or `npm run restore-db -- --dump` to export first). Restart `make editor-worker` after a restore.
