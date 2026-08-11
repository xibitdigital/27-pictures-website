---
name: horror-toon-page
description: >
  Build a ByteDance Seedream 5.0 Pro (image-to-image) prompt for a full
  black-and-white multi-panel horror manga page (default 3 horizontal panels,
  1008×1792) for 27 Pictures dark / body-horror / occult FlipFrame plates.
  Same prompt skeleton as toon-page, but horror ink style. Always saves the
  prompt as a .txt in the user's Downloads folder; generates only when the user
  explicitly asks. Use when the user says "horror toon", "horror toon page",
  "/horror-toon-page", "horror manga page", "seedream horror", "dark manga page",
  or wants a horror FlipFrame plate prompt.
user-invokable: true
argument-hint: "[beat / scene for the horror page]"
---

# Horror Toon Page — Seedream 5.0 Pro (image-to-image) Prompt Generator

Target model: **`bytedance/seedream-5.0-pro` · image-to-image** (not pure t2i, not Grok Imagine).

Take the user's beat/scene and output a **complete Seedream i2i prompt** for one vertical multi-panel **horror** manga page.

Sibling skill: `/toon-page` is cyberpunk **i2i**. This skill is the same engine/mode with **horror** ink and atmosphere.

## Output rules (strict)

- Build the full prompt, then **always save it as a `.txt` file** in the user's Downloads folder
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

### Reference images (when available)

Tell the user to attach in Seedream i2i:

1. **Layout ref** (optional): prior 3-panel page for gutters / stack
2. **Character refs**: face/outfit sheets for the cast
3. **Style ref**: B&W horror / bande dessinée ink page they already like

Always include a **PIN clause** when refs are used, e.g.:

```
PIN from references: keep [face/hair/outfit] from Image [char]; keep B&W horror ink, heavy blacks, three-panel vertical stack from Image [style/layout] if provided.
```

Name what must **not** change vs what must **change** (i2i rule: unmentioned elements drift).

## Save prompt to Downloads (required)

1. Write UTF-8 `.txt` under `~/Downloads/`
2. Filename: `horror-toon-page-<slug>-YYYYMMDD-HHMMSS.txt`
3. Contents = **prompt only** (optional ≤4-line `#` header)
4. Chat: fenced prompt + `Saved: ~/Downloads/...`

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# style: horror manga B&W
# refs: [list what to attach]
```

## Generating (opt-in — never by default)

Only when the user explicitly asks.

```bash
set -a; source .env; set +a
python3 scripts/generate-toon-page.py \
  --prompt-file ~/Downloads/horror-toon-page-<slug>-<stamp>.txt \
  --mode image-to-image \
  --ref-asset toons/<toon>/assets/<md5>.png \
  --ref https://…/style-ref.png
```

- **Costs real money** — $0.05 per `1K` image. State cost before firing.
- Refs must be **public HTTPS** (or `--ref-asset` via `VITE_ASSET_BASE`). Local-only files: user attaches in web UI.
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
# refs: attach character [and style / layout] if available

FORMAT: Black and white horror manga page, vertical 1008x1792, three stacked horizontal panels, thick black gutters, black outer border. Sharp decisive linework, heavy dark ink washes, strong solid blacks, high-contrast shadows, grey midtones. No color, no speech/thought balloons, no dialogue, no captions, no SFX lettering, no logos, no watermarks, no text in the art.

PIN (keep from refs): [faces, outfit, ink style, 3-panel stack if layout ref]. Do not redesign identity.

STYLE: Dark psychological horror ink — crushed shadows, sparse hostile light. Not cyberpunk neon. Not photoreal 3D.

TOP (~35%): [1 sentence — establish dread]
MIDDLE (~30%): [1 sentence — intrusion / action; clear limbs]
BOTTOM (~35%): [1 sentence — ECU or aftermath]

SUBJECT LOCK: [compact locks if no ref, or reinforce ref identity]

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
6. Word-count → trim → save Downloads txt → show fenced prompt + Saved line

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
- Do not forget i2i **PIN** when a reference is attached
- Do not gore-spam; keep horror readable as ink storytelling
