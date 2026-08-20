---
name: horror-toon-page
description: >
  Build a ByteDance Seedream 5.0 Pro (image-to-image) prompt for a full
  black-and-white multi-panel horror manga page (default 3 horizontal panels,
  1008×1792) for 27 Pictures dark / body-horror / occult FlipFrame plates.
  Same prompt skeleton as toon-page, but horror ink style. Always saves the
  prompt as a tracked .txt under docs/story/<series>/prompts/; generates only when
  the user explicitly asks. Use when the user says "horror toon", "horror toon page",
  "/horror-toon-page", "horror manga page", "seedream horror", "dark manga page",
  or wants a horror FlipFrame plate prompt.
user-invokable: true
argument-hint: "[beat / scene for the horror page]"
---

# Horror Toon Page — Seedream 5.0 Pro (image-to-image) Prompt Generator

Target model: **`bytedance/seedream-5.0-pro` · image-to-image** (not pure t2i, not Grok Imagine).

Take the user's beat/scene and output a **complete Seedream i2i prompt** for one vertical multi-panel **horror** manga page.

Sibling skills: `/toon-page` is cyberpunk **i2i** — same engine/mode, different
ink. `/horror-toon-character` builds the **character sheet** a page like this one
PINs against; make the sheet first when a new character appears, and the pages
stay on-model for free.

## Output rules (strict)

- Build the full prompt, then **always save it as a `.txt` file** under `docs/story/<series>/prompts/` (tracked)
- Also show the prompt in chat as a single copyable fenced code block
- **Length: stay under ~550 English words** (Seedream sweet spot <600; longer prompts scatter detail)
- **Default is prompt-only.** Write the `.txt` and stop. User usually attaches refs in ComfyUI / RunComfy and generates there.
- **Only generate when the user explicitly asks** — "generate it", "run it", "make the image". A beat alone is never a generate request.
- If the user gives no beat/scene, ask once, then wait

## Model & workflow (Seedream i2i)

| Item | Value |
|------|--------|
| Model | `bytedance/seedream-5.0-pro` |
| Mode | **image-to-image** (prefer refs over pure prose for identity / layout / ink style) |
| Max attention | Keep prompt **<600 English words** |
| Structure | Layer: **format → PIN (keep) → subject → panels → CHANGE** |

### Input schema (RunComfy `/v1/models/bytedance/seedream-5.0-pro/image-to-image`)

| Field | Notes |
|-------|-------|
| `prompt` | required. >600 English words → model scatters detail and drops elements |
| `image` | required, **1–10** refs. JPEG/PNG/WEBP/BMP/TIFF/GIF/HEIC/HEIF, <30 MB each |
| `resolution` | **use `1K`** ($0.05/image) — project default. Set explicitly |
| `output_format` | `png` (default) or `jpeg` |

**There is no width/height parameter.** Always spell out `vertical 1008x1792` and `three stacked horizontal panels` in the FORMAT line.

Cap refs at 10. Prefer identity / style / layout sheets over redundant mood shots.

### Reference images (order matters)

Attach in Seedream i2i **in this order** — character sheets first, the previous
page **last**:

1. **Character refs**: face/outfit sheets for the cast, one per character present
2. **Style ref** (optional): B&W horror / bande dessinée ink page they already like
3. **Previous page — always last.** The plate immediately before this one in the
   same episode, whenever one exists.

**The previous page is not optional.** Any page after page 1 of an episode gets
it, as the final image, and the `# refs:` header says which page it is. It is
carrying three things at once that nothing else in the ref stack can: the ink
style as this episode actually renders it, the three-panel stack and gutter
weight, and — the expensive one — the **set**. Episode 2's office desk, chair,
glass wall and corridor were invented by a generation, not by a prompt; without
that plate in the refs they are re-invented every page and the episode stops
being one place.

Last, not first, and for the same reason the ComfyUI batch chain ends on it (see
`workflows/README.md`): the pins refer to images by position, so the character
sheets must hold the low, stable numbers. Insert the previous page anywhere but
the end and every `Image N` in the PIN clause points at the wrong picture.

Say so explicitly in the header, e.g.:

```
# refs: Image 1 = references/<series>/<char>.png (identity)
#       Image 2 = <SERIES>: <episode> page <N-1> (ink style, layout, the set)
```

Always include a **PIN clause** when refs are used, e.g.:

```
PIN from references: keep [face/hair/outfit] from Image [char]; keep the [room / set pieces], B&W horror ink, heavy blacks and three-panel vertical stack from Image [previous page].
```

Name what must **not** change vs what must **change** (i2i rule: unmentioned elements drift).

Two cases where the previous page is *not* the right last ref, and both need
saying in the header rather than silently dropping it:

- **Page 1 of an episode** — there is no previous page. Use the previous
  episode's opening plate if the set carries over, otherwise character sheets
  and a style ref only.
- **A scene cut** — a new location with nothing shared. Keep it for ink and
  layout, and state in the CHANGE line that the set is new, or it drags the old
  room in.

## Save the prompt (required)

**Primary location is the repo, tracked:**

```
docs/story/<series>/prompts/
```

Name it for what it makes, with no timestamp — git already has the dates, and a
timestamped filename stops being the obvious current version as soon as there are
two of them:

- `character-<name>.txt` — a full character sheet
- `character-<name>-fix.txt` — a fix pass against an existing sheet
- `page-<episode>-<slug>.txt` — a story plate
- add `-superseded` when a prompt is replaced but worth keeping for traceability

**Why tracked:** the generated images are not in git — they live in
`references/`, which is gitignored. The prompt is the only durable record of how
an image was made, and an image without its prompt cannot be re-rolled, fixed or
matched.

Optionally also drop a copy in `~/Downloads/` if it is about to be pasted into a
web UI. That copy is a convenience, not the record.

Contents = **prompt only** (optional ≤4-line `#` header naming the model, the
mode, and which reference is Image 1, 2, 3). In chat: the fenced prompt plus the
saved path.

## Generating (opt-in — never by default)

Only when the user explicitly asks.

```bash
set -a; source .env; set +a
python3 scripts/generate-toon-page.py \
  --prompt-file docs/story/<series>/prompts/page-<episode>-<slug>.txt \
  --mode image-to-image \
  --ref https://…/character-sheet.png \
  --ref-asset toons/<toon>/assets/<previous-page-md5>.png
```

- **Ref order on the command line is the `Image N` order in the prompt.** The
  previous page's `--ref-asset` goes **last**, after the character sheets.
- **Costs real money** — $0.05 per `1K` image. State cost before firing.
- Refs must be **public HTTPS** (or `--ref-asset` via `VITE_ASSET_BASE`). Local-only files: user attaches in web UI.
- The previous page is already on R2 if the episode is published, so it is
  reachable with `--ref-asset`; character sheets in gitignored `references/` are
  not, which is the usual reason a run has to happen in the web UI instead.
- After success: `make add-image …` only if asked.

## Defaults (encode inside the prompt)

| Spec | Default |
|------|---------|
| Size | Vertical **1008×1792** |
| Panels | **3** stacked **horizontal** panels, thick black gutters, black outer border |
| Color | Pure **B&W** horror / bande dessinée ink — deep blacks, grey midtones, harsh contrast |
| Balloons | **None** by default |
| Text in art | **None** by default |
| Layout ban | No diagonal slash panels, no triangle crops |
| Anatomy | Exactly **two arms and two legs** (or one clear stated mutation) |
| Scale | **One human scale per page** — 7 heads tall, shoulders <2 head-widths, hands ≤ own face; props sized to the people |

## Horror style lock (always include)

- Dark horror manga / gekiga or European bande dessinée ink — not cute shōnen
- Heavy blacks, ink washes, solid shadow pools, selective white rims
- Cross-hatching, sparse screentone grain
- Unsettling negative space; light is scarce and hostile
- **No** cyberpunk neon, no teal-orange grade, no photoreal ARRI

## Default story rhythm (3 panels)

1. **TOP (~35%)** — Establish dread
2. **MID (~30%)** — Intrusion / reveal / action
3. **BOTTOM (~35%)** — Payoff ECU or aftermath

## Prompt skeleton (Seedream i2i, short)

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# style: horror manga / bande dessinée B&W
# refs: Image 1..N = character sheets; LAST = previous page of this episode
#       (previous page is required whenever one exists — ink, layout, the set)

FORMAT: Black and white horror manga page, vertical 1008x1792, three stacked horizontal panels, thick black gutters, black outer border. Sharp decisive linework, heavy dark ink washes, strong solid blacks, high-contrast shadows, grey midtones. No color, no speech/thought balloons, no dialogue, no captions, no SFX lettering, no logos, no watermarks, no text in the art.

PIN (keep from refs): [faces, outfit] from the character images; [the set / room, ink style, 3-panel stack] from the previous page. Do not redesign identity.

STYLE: Dark psychological horror ink — crushed shadows, sparse hostile light. Not cyberpunk neon. Not photoreal 3D.

TOP (~35%): [1 sentence — establish dread]
MIDDLE (~30%): [1 sentence — intrusion / action; clear limbs]
BOTTOM (~35%): [1 sentence — ECU or aftermath]

SUBJECT LOCK: [compact locks if no ref, or reinforce ref identity]

SCALE: one human scale across all three panels — head is one seventh of standing height, shoulders under two head-widths, hands no larger than the person's own face. Furniture is drawn to the people. Nobody towers over the room.

ANATOMY: exactly two arms and two legs per person unless a single stated mutation. Horizontal panels only, pure B&W horror ink, no empty balloon shapes.

CHANGE: only the scene/action described above; preserve identity and ink style from pins.
```

**Brevity:** 2–3 in-panel cues max; trim if over ~550 words.

## Character locks

### Eve + Nero (if cast reappears)

Prefer **refs** over prose. Compact fallbacks:

```
Eve: long wavy dark hair past shoulders, fair skin, full lips, black rectangular smart glasses always on, fitted dark blazer, slim trousers
```

```
Nero: lean detective, short dark hair, dark coat, LEFT arm cracked-porcelain upper arm + steel forearm from elbow, RIGHT arm flesh + metal hand at wrist, two legs
```

Left/right = **subject's** left/right.

### Original horror cast

Short lock (face, silhouette, prop); hold across panels. Prefer a face/style ref when available.

## How to expand the user beat

1. Split into 3 concrete visual beats
2. Each panel: **1 short sentence**
3. Prefer implication over gore
4. Balloons off unless asked
5. Always PIN when refs are used
6. **Find the previous page and list it last** — read the toon's
   `content/toons/<toon>/config.json` for the plate before this one, and name it
   in the `# refs:` header. Only page 1 of an episode is exempt.
7. Word-count → trim → save the tracked txt → show fenced prompt + saved path

## Fix mode (user attaches a bad generation)

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# refs: Image 1 = current page to fix; Image 2+ = character/style refs if any

PIN from Image 1: keep three-panel layout, B&W horror ink, [identity].

CHANGE / FIX:
- [specific panel fixes]
- each person exactly two arms and two legs
- Do not restyle faces into different people.

FORMAT: same vertical 1008x1792 B&W horror page, three horizontal panels, no balloons, no text in art.
```

## After the prompt (only if user asks how to ship)

1. Seedream 5.0 Pro **i2i** + prompt + refs → download
2. `make add-image SRC=… TOON=<toon> UPLOAD=1`
3. Update config + `publish-toon-config` if needed
4. Deploy only if asked

## Anti-patterns

- Do not default to pure text-to-image when the user has refs (use i2i + PIN)
- Do not target Grok Imagine / photoreal ARRI (`/jax`)
- Do not ship over ~550 words
- Do not omit limb count
- Do not omit the **SCALE** line — Seedream's most common failure here is a foreground figure drawn giant against a background one, plus props (a cleaning cart, a chair, a desk) shrunk to toys. Name the head-count, the shoulder width and the prop's height on the body
- Do not forget i2i **PIN** when a reference is attached
- Do not omit the previous page from the refs, and do not list it anywhere but last
- Do not gore-spam; keep horror readable as ink storytelling
