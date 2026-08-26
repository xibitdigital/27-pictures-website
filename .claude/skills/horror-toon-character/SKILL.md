---
name: horror-toon-character
description: >
  Build a ByteDance Seedream 5.0 Pro (image-to-image) prompt for a full-page
  black-and-white horror CHARACTER SHEET generated from a reference — front,
  three-quarter and back full-body turnaround plus an expression row and detail
  insets, on a neutral seamless ground with no panels. The sheet is the identity
  ref that later /horror-toon-page plates PIN against. Always saves the prompt as a
  tracked .txt under docs/story/<series>/prompts/; generates only when the user
  explicitly asks. Use when the user says "horror toon character", "/horror-toon-character",
  "character sheet", "model sheet", "turnaround", "reference sheet", or wants a
  character built from an existing plate or face reference.
user-invokable: true
argument-hint: "[character name + who they are, and which reference to build from]"
---

# Horror Toon Character — Seedream 5.0 Pro (image-to-image) Sheet Generator

Target model: **`bytedance/seedream-5.0-pro` · image-to-image**.

Take a reference the user already has — a plate from a published toon, a face
crop, an earlier sheet — and output a **complete Seedream i2i prompt** for one
vertical **character sheet**.

Sibling skills: `/horror-toon-page` is the horror **story page** (3 panels);
`/toon-page` is the cyberpunk story page. This skill shares their engine, mode
and ink lock, and differs in exactly one way that matters — **what a sheet is
for**.

## What makes a sheet different from a page

A page tells a beat. A sheet is a **measuring instrument**: it exists so every
later plate can PIN identity against it. Three consequences override the page
skill's defaults, and getting them wrong produces a beautiful, useless image:

| | Story page | Character sheet |
|---|---|---|
| Panels | 3 horizontal, thick gutters, black border | **None.** One open field, no gutters, no border |
| Light | Scarce and hostile; crushed blacks | **Even and legible.** Ink is still black-and-white horror, but the face must read |
| Background | The scene | **Neutral seamless mid-grey/white ground**, no room, no props except held ones |
| Pose | Whatever the beat needs | **Neutral A-pose / relaxed stand**, weight even, arms clear of the torso |
| Crop | Whatever the beat needs | **Full body, head to feet, feet visible and uncropped** |

If the horror lock and the sheet's job conflict, **the sheet's job wins.** A
character whose face is inside a shadow pool cannot be pinned against.

## Output rules (strict)

- Build the full prompt, then **always save it as a `.txt`** under `docs/story/<series>/prompts/` (tracked)
- Also show the prompt in chat as a single copyable fenced code block
- **Length: stay under ~550 English words** (Seedream sweet spot <600; longer prompts scatter detail)
- **Default is prompt-only.** Write the `.txt` and stop
- **Only generate when the user explicitly asks** — "generate it", "run it", "make the image". Naming a character is never a generate request
- If the user names no character *or* no reference, ask once, then wait

## Model & workflow (Seedream i2i)

| Item | Value |
|------|--------|
| Model | `bytedance/seedream-5.0-pro` |
| Mode | **image-to-image** — a sheet built from prose alone is a new character, not this one |
| Max attention | Keep prompt **<600 English words** |
| Structure | Layer: **format → PIN (keep) → views → change → bans** |

### Input schema (RunComfy `/v1/models/bytedance/seedream-5.0-pro/image-to-image`)

| Field | Notes |
|-------|-------|
| `prompt` | required. >600 English words → model scatters detail and drops views |
| `image` | required, **1–10** refs. JPEG/PNG/WEBP/BMP/TIFF/GIF/HEIC/HEIF, <30 MB each |
| `resolution` | **`1K`** ($0.05/image) for drafts; **`2K`** is worth it for a sheet you will reuse for months |
| `output_format` | `png` (default) or `jpeg` |

**There is no width/height parameter.** Always spell out `vertical 1008x1792` in
the FORMAT line.

### Reference images — order matters

The batch order is what `Image 1/2/3` in the prompt refers to. Fix it:

1. **Image 1 — identity source.** The clearest existing view of the face. A plate crop beats a full page: less for the model to average
2. **Image 2 — costume / full-body source**, if identity and outfit live in different pictures
3. **Image 3 — style ref** (optional): a B&W horror ink page whose linework you want

Cap refs at 10, and prefer one sharp face over four soft ones. Redundant mood
shots dilute identity.

## Sheet layout (default, encode inside the prompt)

Vertical page, three stacked bands, **no gutters and no borders between them** —
they are regions of one open sheet, not panels:

1. **TOP BAND (~45%)** — full-body **front** and **three-quarter** views, side by side, same height, feet on a common baseline
2. **MIDDLE BAND (~25%)** — full-body **back** view, plus one **silhouette** of the same figure in solid black
3. **BOTTOM BAND (~30%)** — **head sheet**: three expressions (neutral, the character's dominant emotion, one extreme), plus 1–2 detail insets (hands, a signature prop, a costume fastening)

Same character height across every full-body view. That shared baseline is what
makes it a turnaround rather than three drawings.

## Horror ink lock (adapted for legibility)

- Dark horror manga / gekiga or European bande dessinée ink — not cute shōnen
- Confident black linework, cross-hatching for form, sparse screentone grain
- **Even, neutral lighting on the figure.** Solid shadow pools belong on pages, not sheets
- Blacks stay rich in hair, coat and costume mass — but never across the face
- **No** cyberpunk neon, no teal-orange grade, no photoreal 3D
- Neutral seamless ground: flat light grey or white, no environment, no cast shadow beyond a soft contact shadow at the feet

## Prompt skeleton (Seedream i2i)

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# style: horror manga / bande dessinée B&W character sheet
# refs: Image 1 = face/identity, Image 2 = costume (optional), Image 3 = ink style (optional)

FORMAT: Black and white horror manga CHARACTER SHEET, vertical 1008x1792. One open sheet on a neutral seamless light grey ground — no panels, no gutters, no borders, no background scene. Confident black linework, cross-hatching, grey midtones, rich blacks in hair and clothing. Even legible lighting on the face. No color, no speech balloons, no captions, no SFX lettering, no logos, no watermarks, no text or labels anywhere in the art.

PIN from references: keep the exact face, hair, build and costume of the character in Image 1 [and Image 2]. Same person, same age, same proportions. Do not redesign, do not beautify, do not change hairstyle or outfit.

TOP BAND (~45%): full-body front view and full-body three-quarter view, side by side, identical height, feet on one shared baseline, neutral A-pose, arms clear of the torso, hands open and visible.

MIDDLE BAND (~25%): full-body back view at the same height, plus one full-body silhouette of the same figure filled solid black.

BOTTOM BAND (~30%): head sheet — three head-and-shoulders portraits at the same scale, expressions [neutral] / [dominant emotion] / [extreme], plus small detail insets of [hands / prop / costume detail].

SUBJECT LOCK: [name] — [age, build, hair, distinguishing marks, costume, one signature prop].

ANATOMY: exactly two arms and two legs, five fingers per hand, feet fully visible and uncropped in every full-body view. Consistent height across all full-body views.

CHANGE: only the viewing angle and expression between views. Identity, costume and ink style stay exactly as pinned.
```

**Brevity:** trim the detail insets first if over ~550 words. The turnaround
matters more than the insets.

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

## ## Generating (opt-in — never by default)

Only when the user explicitly asks.

```bash
set -a; source .env; set +a
python3 scripts/generate-toon-page.py \
  --prompt-file docs/story/<series>/prompts/character-<name>.txt \
  --mode image-to-image \
  --ref-asset toons/<toon>/assets/<md5>.png \
  --ref https://…/style-ref.png
```

- **Costs real money** — $0.05 per `1K` image. State the cost before firing
- Refs must be **public HTTPS** (or `--ref-asset`, which resolves against `VITE_ASSET_BASE`). Local-only files: the user attaches them in the web UI instead

## After the sheet — this is the point of it

A sheet is an input, not a deliverable. Once the user is happy with it:

1. **Flatten the colour cast** before anything else — Seedream returns a faint tint on every generation:
   ```bash
   magick <src> -colorspace Gray -colorspace sRGB /tmp/flat.png
   magick /tmp/flat.png \( +clone -colorspace Gray \) -compose difference -composite \
     -colorspace Gray -format "%[fx:mean*255]\n" info:   # 0 = truly neutral
   ```
2. **Do not run it through `make add-image`.** That bakes the `twentyseven.pictures` watermark and appends the image to a toon's config as a story page. A sheet is neither. If you want it on the CDN so `--ref-asset` can reach it, put it under a reference path and upload with `npm run upload-assets`, or use `--no-watermark` deliberately
3. Add the character's compact lock to the **Character locks** section of `/horror-toon-page`, so pages can be prompted even when the sheet is not attached
4. If the character speaks, add a voice to `scripts/voices.json` — see CLAUDE.md, *Generating a spoken voice line*

## Fix mode (user attaches a bad sheet)

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# refs: Image 1 = the sheet to fix; Image 2 = original identity ref

PIN from Image 2: the face, hair and costume are correct there. Keep them.
PIN from Image 1: keep the sheet layout — open neutral ground, no panels, front / three-quarter / back turnaround, head sheet below.

CHANGE / FIX:
- [specific view fixes, e.g. "back view is a different person — rebuild it from Image 2"]
- all full-body views the same height on one baseline
- exactly two arms and two legs, five fingers per hand, feet uncropped
- remove any labels, arrows, measurement lines or text

FORMAT: same vertical 1008x1792 B&W horror character sheet, neutral seamless ground, no borders, no text in art.
```

## Anti-patterns

- **Do not draw panels.** The single most common failure: the page skeleton's gutters and black border turn a sheet into a comic page and it stops working as a reference
- **Do not let the horror lighting eat the face.** Crushed shadow across the eyes is right for a plate and wrong here
- **Do not let the model add labels.** It loves writing "FRONT / SIDE / BACK", height rules and arrows into the art. Ban text explicitly — lettering is FlipFrame's job, and baked text cannot be translated
- Do not crop the feet; a turnaround without feet cannot be scaled against
- Do not build a sheet from prose when a reference exists — that is a new character wearing the same name
- Do not default to pure text-to-image (use i2i + PIN)
- Do not target Grok Imagine / photoreal ARRI (`/jax`)
- Do not ship over ~550 words
- Do not gore-spam; a sheet is an identity document
