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
│   │   ├── bookReader/           # FlipFrame package (engine + shell + chrome)
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
| `src/toons/bookReader/` | Entire FlipFrame package (see below) |
| `src/toons/jax/` | `JaxApp.vue`, `LangSwitcher.vue`, `main.ts` |
| `src/toons/erin/` | `ErinApp.vue` + `main.ts` |
| `public/` | Static assets only (CSS, images, plates, manifests, qr, …) |
| `dist/` | Production build output (`make build`) |

Repo root stays config/tooling only — no page HTML mixed with `package.json` / `Makefile`.

### File naming

| Kind | Convention | Examples |
|------|------------|----------|
| Vue SFCs | PascalCase | `SiteNav.vue`, `ToonReaderShell.vue` |
| TypeScript modules | camelCase | `loadManifest.ts`, `experimentsMain.ts` |
| Composables | camelCase + `use` prefix | `useToonBook.ts`, `useSoundGate.ts` |
| Colocated tests | match source + `.test.ts` | `bookReader.test.ts`, `SiteNav.test.ts` |
| HTML entries | `index.html` per route | `src/toons/jax/index.html` |

### Book reader (`src/toons/bookReader/`)

Everything the FlipFrame / toon readers need lives in this package — nothing reader-only remains as a loose sibling.

| Path | Role |
|------|------|
| `bookReader.ts` / `bookModels.ts` | Reactive flip engine (no DOM) |
| `useToonBook.ts` | Engine lifecycle composable |
| `BookSurface.vue` / `BookSlot.vue` / `FlipLeaf.vue` | Book markup |
| `FrontCoverInstructions.vue` / `BackCoverLink.vue` | Cover chrome |
| `ToonReaderShell.vue` | App shell (top bar + book + scroll strip) |
| `VerticalStrip.vue` / `useViewMode.ts` | Vertical scroll mode |
| `loadManifest.ts` | Shared page list loader |
| `words.ts` | Caption overlays (Jax) |
| `types.ts` | Public option / API types |
| `chrome/` | `ReaderTopBar`, `ViewModeToggle`, `FullscreenButton` |
| `audio/` | `useSoundGate`, `preloadAudio` |
| `index.ts` | Barrel re-exports |

- Apps import the shell: `from "../bookReader/ToonReaderShell.vue"`.
- Prefer `from "../bookReader"` (or deeper paths) for types / audio / words.
- Jax-only UI (lang switcher, sound/music buttons) stays under `jax/`.

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
make hash-assets         # bump ?v=<content-hash> for public CSS in all HTML
make hash-assets-check   # fail if HTML hashes are stale
# `make build` / `npm run build` always run hash-assets first
```

### Tests

Vitest + Vue Test Utils + happy-dom. Specs live next to source under `bookReader/` and each app.

### Dev URLs

- Home: `/`
- Experiments: `/experiments/`
- Jax: `/toons/jax/`
- Erin: `/toons/erin/`
