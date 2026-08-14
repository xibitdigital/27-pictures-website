# toon-likes Worker

Shared like counter behind the heart in the reader top bar.

| Route | Behaviour |
| ----- | --------- |
| `GET /likes?toon=<id>` | `{ toon, likes }` |
| `POST /likes` `{ toon }` | increments, `{ toon, likes, counted }` |

Counts live in KV as `likes:<toon>`. `counted:false` means the vote was seen but
not added (same IP already liked that toon today) — the client still fills the
heart, because the reader's own vote is tracked in `localStorage`, not here.

## Deploy

```bash
cd worker/likes
npx wrangler kv namespace create TOON_LIKES
npx wrangler kv namespace create TOON_LIKES --preview
# paste both ids into wrangler.toml, then
npx wrangler deploy
```

Then point the site at it and redeploy:

```bash
# .env
VITE_LIKES_API=https://toon-likes.sangalli-marco.workers.dev
```

The Worker origin must also be in `connect-src` in `public/_headers` (it is).

## Adding a toon

Add its id to `ALLOWED_TOONS` in `wrangler.toml` and redeploy. Unknown ids are
rejected with 400 — without that allow-list, anyone could mint unbounded KV keys
by POSTing invented toon names.

## Known limits

- **KV has no atomic increment.** Read-modify-write can drop a like under
  concurrent writes. Fine for a vanity counter; Durable Objects would be the
  fix if the number ever has to be exact.
- **One like per IP per toon per day**, keyed by a truncated SHA-256 of
  `toon:ip` with a 24h TTL. The address itself is never stored.
- **Un-likes are local only.** Without identity there is no honest way to take a
  vote back, and accepting decrements would let anyone zero the counter.
- **The origin check is not security.** It stops a browser on another site, not
  curl. A like is unauthenticated by nature.
