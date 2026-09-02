# Editor AI generation (ComfyUI plates + ElevenLabs audio)

Branch: `feature/ai-integration` (from `staging`). Do not implement on `staging` directly.

## Goal

Keep `/toons/editor/` as it is (upload plate, upload mp3, place bubbles). Add two optional generate paths that land on the **same** D1/R2 records the studio already uses:

1. **Plate** — filmstrip “Generate” (append) and plate “Generate” (replace, captions stay). Bytes come from ComfyUI Seedream, then the Worker stores them like an upload.
2. **Bubble audio** — inspector magic wand. Bytes come from ElevenLabs TTS, then the Worker stores them like `POST /toons/:id/audio` and patches `extra.audio`.

The browser never talks to ComfyUI or ElevenLabs. Keys stay on the Worker.

## Non-goals (v1)

- No blank page without a plate (`pages.file_key` stays NOT NULL).
- No RunComfy **model** API (`generate-toon-page.py`) — it returns square images.
- No ffmpeg chain (reverb, metallic `ai`/`badai`, pitch, EBU loudnorm). Those stay CLI.
- No prompt-file browser over `docs/story/**`.
- No WebP/watermark in the Worker. Editor already accepts PNG; stamp happens later on `swap-page` if you ship to CDN keys.
- No SFX wand (`/v1/sound-generation`). Empty voice → wand disabled; upload still works.
- No change to public catalog/reader contracts.

## Current surfaces (leave in place)

| Today | Keep |
| --- | --- |
| Filmstrip **+ Add page** file input | yes |
| Plate **Replace** file input | yes |
| Inspector audio upload + path field + copy-prompt | yes |
| `POST /toons/:id/pages`, `/pages/:id/file`, `/toons/:id/audio` | yes |

ElevenLabs is copy-only today (`suggestElevenPrompt`). Generation is CLI (`scripts/build-comfy-plate.py`, `scripts/generate-jax-voice.py`).

## Architecture

```
Vue studio  --JWT-->  toon-editor Worker  --fetch-->  ComfyUI (COMFY_URL)
                      |                    --fetch-->  api.elevenlabs.io
                      +-- D1 pages/bubbles/jobs
                      +-- R2 editor/<slug>/assets|sfx/…
```

**Audio** is one request (TTS is a few seconds). Same put path as upload: `editor/<slug>/sfx/<sha256>.mp3`. Client writes `extra.audio` and the existing Save still PATCHes the bubble.

**Plates** cannot be one Worker request (Seedream is 1–5+ minutes). Pattern:

1. `POST` creates a `generation_jobs` row, uploads refs to Comfy `/upload/image`, `POST {COMFY_URL}/prompt`, stores `prompt_id`.
2. Studio polls `GET /jobs/:id` (~3s).
3. Each poll: Worker `GET {COMFY_URL}/history/{prompt_id}`. When output exists, `GET /view` the PNG, `putPageAsset`, INSERT or UPDATE the page, mark job `done`.
4. Studio reloads the toon (append → navigate to last page; replace → `mergeReplacedPage`).

Local `make dev`: `COMFY_URL=http://127.0.0.1:8188` in `worker/toon-editor/.dev.vars` (same machine as Comfy). Staging/production need a **reachable hosted Comfy** (RunComfy *machine* / self-host), not the square model API. If `COMFY_URL` is unset, generate plate returns 503 with a clear error; upload still works.

## Data

New migration `worker/toon-editor/migrations/000N_generation_jobs.sql`:

```sql
CREATE TABLE generation_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,          -- 'page'
  toon_id TEXT NOT NULL,
  page_id TEXT,                -- null = append; set = replace that plate
  status TEXT NOT NULL,        -- queued | running | done | error
  prompt TEXT NOT NULL,
  payload_json TEXT NOT NULL,  -- refs, seed, includePrevious
  error TEXT,
  result_page_id TEXT,
  comfy_prompt_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

No new bubble columns. Voice stays in `extraJson`; audio key stays `editor/<slug>/sfx/…`.

**Refs for a job** (in `payload_json` / request body), PIN order:

1. Files the dialog uploads this turn (character sheets, crops) — Worker puts them on R2 under `editor/_refs/<toonId>/…` **and** Comfy `/upload/image`.
2. Optional previous plate last: current page on replace, last page on append. Use the **editor** object (un-watermarked generate/upload). Do not pull watermarked CDN `toons/…` WebP.

Port `build_api_graph` from `scripts/build-comfy-plate.py` to `worker/toon-editor/src/comfyGraph.ts`:

`LoadImage ×N → ByteDanceSeedreamNodeV3 → Rec.709 flatten → ImageScale to toon.designWidth × designHeight → SaveImage`

Model default `seedream 5.0 pro`. Render size default 1024×1824 (script default). Scale to the book’s design size so Erin 1152×1728 is not forced to 800×1424. Strip `#` header lines if the pasted prompt has them. Reject >10 refs. Warn (not fail) if prompt word count >600.

Import `scripts/voices.json` in the Worker (same lock the inspector already uses). Never `GET /v1/voices`.

## Worker API (JWT)

### `POST /toons/:id/audio/generate`

Body:

```json
{ "text": "[whispers] Nero—!", "voice": "eve", "model": "eleven_v3", "stability": 0.3 }
```

- `voice` required, must be a `voices.json` key.
- `text` required (studio sends the spoken line from `suggestElevenPrompt`, not the display-only caption).
- `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with `xi-api-key`.
- SHA-256 put like `readAudioUpload`.
- **201** same shape as upload: `{ key, url, audio }`.
- Does not PATCH the bubble (inspector already patches locally + Save). Keeps generate aligned with upload.

Missing `ELEVENLABS_API_KEY` → 503 `"ElevenLabs is not configured"`.

### `POST /toons/:id/pages/generate`

`multipart/form-data`: `prompt` (required), `seed?`, `includePrevious` (`"1"`/`"0"`), `pageId?` (replace), `ref` files (repeatable).

**202** `{ id, status: "running", comfyPromptId }`.

### `GET /jobs/:id`

**200** `{ id, kind, status, error, resultPageId, toon? }`. When `done`, include the full `ToonRecord` so the client does not need a second fetch.

Auth: same JWT as studio writes. Jobs are per-toon; 404 if the toon is missing.

Comfy helpers in `worker/toon-editor/src/comfyClient.ts`: upload image, submit prompt, history, view. Auth header from `COMFY_API_KEY` when set.

## Studio UI

Reuse icon-button language already in the inspector (14px SVG, `editor-icon-btn`). No second layout, no second card.

### Filmstrip (`PageFilmstrip.vue`)

Keep the file `+ Add page` label. Add a sibling wand button `name="add-page-generate"` that emits `generate` (no file).

### Plate (`PlateCanvas.vue`)

Keep **Replace**. Add a wand next to it `name="replace-page-generate"`.

### Dialog (`GeneratePageDialog.vue` — new, used by `PageStudio`)

- Prompt textarea (required).
- “Include previous page” checkbox, default on when a previous plate exists; hidden on page 1 append.
- Ref file inputs (png/jpeg/webp), list of attached names, cap 10 including previous.
- Generate / Cancel. While running: disable controls, poll, status “Generating page…”.
- On `done`: parent applies toon the same way as `onUpload` / `onReplace`.
- On `error`: `editor-error` with Worker message.

CSS: native dialog / existing editor panel tokens only (`var(--bg-card)`, `var(--text)`, …). No hardcoded colours. No class-name DOM queries.

### Inspector (`CaptionInspector.vue`)

Next to the upload icon, wand `name="audio-generate"`:

- Disabled when `!toonId`, generating, no English line, or voice is empty.
- `generating` reuses the upload disabled/busy pattern (`Generating…` on aria-label).
- Calls `generateAudio(toonId, { text: spokenLine, voice, model: "eleven_v3", stability: 0.3 })`.
- On success: `extraPatch(bubble, "audio", out.audio)` — same as upload; still dirty until Save.
- Leave the copy-prompt field; it remains the fallback when the key is unset.

`src/toons/editor/api.ts`: `generateAudio`, `generatePage`, `getJob`.

## Secrets / config

In `worker/toon-editor` (not Pages, not repo `.env` for production):

| Name | Where | Purpose |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | wrangler secret + `.dev.vars` | TTS |
| `COMFY_URL` | `.dev.vars` / `[vars]` or secret | Comfy origin |
| `COMFY_API_KEY` | secret, optional | hosted Comfy auth |

Document in `worker/toon-editor/README.md` and a short note in `Claude.md` under the editor section. Browser CSP unchanged (studio already `connect-src`s the Worker).

`Env` type in `worker/toon-editor/src/types.ts` gains those optional bindings.

## Implementation order

1. Branch `feature/ai-integration` from updated `staging` (done).
2. **Audio** (smaller, sync, high value): Worker generate route + secret; `api.ts`; wand on inspector; tests with mocked `fetch`.
3. **Jobs + Comfy client + graph**: migration, poll route, graph unit tests (node class names, Image N order, scale = design size).
4. **Page generate UI**: filmstrip + plate wands + dialog; PageStudio poll loop.
5. `npm run format`, `npm run typecheck`, `npx vitest` for editor + worker.
6. Manual: `make dev` + local Comfy for one plate; wand on a bubble with `voice` set.

Worker deploy is separate from Pages (`cd worker/toon-editor && npx wrangler deploy`) and is required before staging studio can TTS. Pages push only ships the Vue MPA.

## Tests

- Worker audio: mock ElevenLabs 200 mp3 → R2 put key shape; unknown voice 400; missing secret 503.
- Worker graph: 2 sheets + previous → LoadImage titles `Image 1/2/3`, previous last; 11 refs fail; design 1152×1728 on ImageScale.
- Worker jobs: history empty → `running`; history with image → page row + `done`.
- CaptionInspector: wand disabled without voice/text; success patches `audio`; upload path still works.
- PageFilmstrip: file add still emits `upload`; wand emits `generate`.

## Follow-ups (not this branch)

- Series-level named ref library (durable sheets, episode-wide PIN slots).
- SFX wand + reverb/metallic via a sidecar that can run ffmpeg.
- Prompt library from `docs/story`.
- Cloudflare Queue/cron so a closed tab still finishes a plate (v1 dies with the poll).
- Cost/credit display.

## Risks

- **Hosted Comfy required off-localhost.** Staging Worker cannot see `127.0.0.1:8188`.
- **Watermarked previous plates** teach Seedream the site stamp. Only use `editor/` objects as refs.
- **Worker/Comfy timeouts.** Polling avoids the 30s CPU limit; a stuck Comfy job needs a client-side timeout (~10 min) then `error`.
- **Credits.** JWT-gated only; no spend cap in v1.
