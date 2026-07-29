# Vue + TypeScript frontend branch (`feat/vue-frontend`)

Work-in-progress migration of frontend JS to **Vue 3 + Vite + TypeScript**.  
**Do not deploy this branch to production until the migration is validated.**

## Layout

```
27-pictures-website/
├── src/                          # Vite root (HTML entries + app code)
│   ├── index.html                # Homepage MPA entry
│   ├── experiments/index.html    # Experiments lab entry
│   ├── site/                     # Site Vue app (nav, contact, …)
│   ├── toons/
│   │   ├── shared/               # FlipFrame engine, view-mode, components
│   │   ├── jax/                  # JaxApp + index.html entry
│   │   └── erin/                 # ErinApp + index.html entry
│   └── test/                     # Vitest setup
├── public/                       # Static assets only (CSS, images, plates)
├── dist/                         # Production build (same URL tree)
├── scripts/                      # Tooling (hash-assets, QR, …)
├── worker/                       # Cloudflare Worker (contact form)
├── package.json / Makefile
└── vite.config.ts                # root: src/ (project root during tests)
```

| Path | Role |
|------|------|
| `src/index.html` | Homepage Vite MPA entry |
| `src/experiments/index.html` | Experiments lab entry |
| `src/toons/jax\|erin/index.html` | Toon reader entries (next to their Vue apps) |
| `src/site/` | `SiteApp.vue`, `SiteNav.vue`, `ContactForm.vue`, directives |
| `src/toons/shared/` | `useToonBook`, `useViewMode`, `book-reader`, `words`, `types` |
| `src/toons/jax/` | `JaxApp.vue`, `LangSwitcher.vue`, `main.ts` |
| `src/toons/erin/` | `ErinApp.vue` + `main.ts` |
| `src/env.d.ts` | Vue / Window ambient types |
| `public/` | Static assets only (CSS, images, plates, manifests, qr, …) |
| `dist/` | Production build output (`make build`) |

Repo root stays config/tooling only — no page HTML mixed with `package.json` / `Makefile`.

`book-reader.ts` / `words.ts` use `// @ts-nocheck` on the large imperative DOM ports; public option/API shapes live in `types.ts`. Shells and site code are fully typed.

### Book reader + Vue refs

- `initToonBook(els, opts)` takes explicit DOM nodes (`ToonBookEls`) — no `getElementById` for the flip surface.
- `useToonBook(refs, opts)` maps Vue template refs → `initToonBook`, and calls `destroy()` on unmount.
- Jax / Erin templates use `ref="bookEl"`, `ref="slotLeft"`, etc. (ids kept for CSS / a11y where useful).

## UI library

**[Headless UI](https://headlessui.com/) (`@headlessui/vue`)** — unstyled accessible primitives.
Keeps existing brand CSS; used for:

- Mobile nav → `Dialog`
- Jax language switcher → `Listbox`
- Sound enable prompt → `Dialog`

## Commands

Prefer the Makefile (mirrors every npm script):

```bash
make install
make dev           # http://localhost:5173/
make typecheck     # vue-tsc
make test          # vitest run
make test-watch    # vitest
make build         # vue-tsc -b && vite build → dist/
make preview       # preview dist/
make hash-assets   # cache-bust public CSS hashes in src/**/*.html
```

### Tests

Vitest + Vue Test Utils + happy-dom. Specs live next to source:

| Spec | Covers |
|------|--------|
| `book-reader.test.ts` | FlipFrame: cover, spreads, keyboard/zones/buttons, indicator, single-page, flip smoke |
| `useToonBook.test.ts` | Vue ref wiring, init/destroy, goNext |
| `words.test.ts` | fractions, WordOverlay, loadWords |
| `useViewMode.test.ts` | manifest load, vertical toggle |
| `VerticalStrip.test.ts` | page slots / ready emit |
| `FullscreenButton.test.ts` | FS request / body class |
| `ContactForm.test.ts` | validation + submit |
| `SiteNav.test.ts` | home vs experiments links |

### Dev URLs

- Site: http://localhost:5173/
- Experiments: http://localhost:5173/experiments/
- Jax: http://localhost:5173/toons/jax/
- Erin: http://localhost:5173/toons/erin/

Vite uses `appType: "mpa"` with `root: src/`, so each HTML entry keeps its URL path
(`/`, `/experiments/`, `/toons/jax/`, `/toons/erin/`) without SPA fallback.

## Deploy

### Preview (safe — does not update the custom domain)

```bash
make preview-deploy
# → Cloudflare Pages branch "feat/vue-frontend"
# URL like: https://feat-vue-frontend.twentyseven-pictures.pages.dev
```

**Known preview gaps (expected):**

| Check | Preview | Notes |
|-------|---------|--------|
| Contact form submit | ❌ CORS | Worker only allows `https://twentyseven.pictures` |
| Turnstile widget | ⚠ | May need preview host added in Turnstile dashboard |
| Nav / readers / CSS / plates | ✅ | Full static + Vue bundles from `dist/` |
| Production domain | untouched | Preview uses `--branch=feat/vue-frontend` |

### Production (later — only after preview sign-off)

```bash
make deploy   # builds dist/ and deploys as production
```

## Design notes

- **Book flip engine** stays imperative DOM (ported ESM); Vue owns the shell and site UI.
- **View mode** is the shared ESM module with mobile scroll default.
- **Contact form** is a Vue SFC with Turnstile hooks.
- Hash-assets rewrites `?v=` on CSS in `src/**/*.html` (and any leftover `public/**/*.html`); Vue bundles are content-hashed by Vite.
