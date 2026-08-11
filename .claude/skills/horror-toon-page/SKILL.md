---
name: horror-toon-page
description: >
  Build a ByteDance Seedream 5.0 Pro (text-to-image) prompt for a full
  black-and-white multi-panel horror manga page (default 3 horizontal panels,
  1008×1792) for 27 Pictures dark / body-horror / occult FlipFrame plates.
  Same prompt skeleton as toon-page, but horror ink style and pure t2i (no refs
  required). Always saves the prompt as a .txt in the user's Downloads folder;
  generates only when the user explicitly asks. Use when the user says "horror
  toon", "horror toon page", "/horror-toon-page", "horror manga page",
  "seedream horror", "dark manga page", or wants a horror FlipFrame plate prompt.
user-invokable: true
argument-hint: "[beat / scene for the horror page]"
---

# Horror Toon Page — Seedream 5.0 Pro (text-to-image) Prompt Generator

Target model: **`bytedance/seedream-5.0-pro` · text-to-image** (not i2i, not Grok Imagine).

Take the user's beat/scene and output a **complete Seedream t2i prompt** for one vertical multi-panel **horror** manga page.

Sibling skill: `/toon-page` is cyberpunk **i2i** with character refs. This skill is **horror t2i** — prose carries style and identity; optional later i2i polish is out of scope unless the user switches to `/toon-page`.

## Output rules (strict)

- Build the full prompt, then **always save it as a `.txt` file** in the user's Downloads folder
- Also show the prompt in chat as a single copyable fenced code block
- **Length: stay under ~550 English words** (Seedream sweet spot <600; longer prompts scatter detail)
- **Default is prompt-only.** Write the `.txt` and stop. User usually generates in ComfyUI / RunComfy web UI.
- **Only generate when the user explicitly asks** — "generate it", "run it", "make the image". A beat alone is never a generate request.
- If the user gives no beat/scene, ask once, then wait

## Model & workflow (Seedream t2i)

| Item | Value |
|------|--------|
| Model | `bytedance/seedream-5.0-pro` |
| Mode | **text-to-image** |
| Max attention | Keep prompt **<600 English words** |
| Structure | Layer: **format → subject → composition → lighting/style → atmosphere → panel beats** |

### Input schema (RunComfy `/v1/models/bytedance/seedream-5.0-pro/text-to-image`)

| Field | Notes |
|-------|-------|
| `prompt` | required. >600 English words → model scatters detail and drops elements |
| `resolution` | **use `1K`** ($0.05/image) — project default. `2K` ($0.10) is often the API default; set `1K` explicitly |
| `output_format` | `png` (default) or `jpeg` |

**There is no width/height parameter.** The model infers shape from the aspect ratio **described in the prompt** — always spell out `vertical 1008x1792` and `three stacked horizontal panels` in the FORMAT line.

No `image` / reference fields for pure t2i. If the user wants identity locks from photos, point them at `/toon-page` (i2i) instead.

## Save prompt to Downloads (required)

After assembling the prompt body (plain text, no markdown fences inside the file):

1. Write a UTF-8 `.txt` under the user's Downloads directory (`$HOME/Downloads/` / `~/Downloads/`)
2. Filename: `horror-toon-page-<slug>-YYYYMMDD-HHMMSS.txt`
   - `slug`: lowercase ASCII from the first ~40 chars of the beat; spaces → `-`; strip non `[a-z0-9-]`; collapse `--`; default `page`
3. File contents = **the prompt only** (no ``` fences, no commentary)
4. Chat reply: fenced prompt + one line `Saved: ~/Downloads/...`

Optional header (≤4 lines; still counts toward word budget if you keep it short):

```
# model: bytedance/seedream-5.0-pro
# mode: text-to-image
# style: horror manga B&W
```

## Generating (opt-in — never by default)

Only when the user explicitly asks for the image.

**Preferred:** paste the prompt into RunComfy / ComfyUI **Seedream 5.0 Pro text-to-image**, resolution `1K`.

**CLI** (if the project script supports t2i without refs):

```bash
set -a; source .env; set +a
# Only if generate-toon-page.py accepts --mode text-to-image with no --ref.
# If the script still requires refs, use the web UI for t2i — do not invent flags.
python3 scripts/generate-toon-page.py \
  --prompt-file ~/Downloads/horror-toon-page-<slug>-<stamp>.txt \
  --mode text-to-image \
  --resolution 1K
```

- **Costs real money** — $0.05 per `1K` image. State cost before firing; do not re-roll casually.
- After generation: `make add-image SRC=~/Downloads/<file>.jpg TOON=<toon> UPLOAD=1` only if the user asks to ship into FlipFrame.

## Defaults (encode inside the prompt)

| Spec | Default |
|------|---------|
| Size | Vertical **1008×1792** |
| Panels | **3** stacked **horizontal** panels, thick black gutters, black outer border |
| Color | Pure **B&W** horror manga ink — deep blacks, sparse white, harsh contrast |
| Balloons | **None** by default |
| Text in art | **None** by default |
| Layout ban | No diagonal slash panels, no triangle crops |
| Anatomy | Every person has **exactly two arms and two legs** (unless the user asks for deliberate body-horror mutation — then state the mutation once, clearly) |

Change panel count only if the user asks.

## Horror style lock (always include)

Bake these into FORMAT / STYLE (keep compact):

- Dark horror manga / gekiga ink, not cute or shōnen sparkle
- Heavy blacks, crushed shadows, selective white rims
- Cross-hatching, dense blacks in voids, sparse screentone grain
- Unsettling negative space; light is scarce and hostile
- Mood refs (words only, do not name living artists as “style of”): late-night alley dread, wet concrete, clinical fluorescent panic, occult residue, body-horror restraint (suggest, do not gore-spam unless asked)
- **No** cyberpunk neon, no teal-orange grade, no photoreal ARRI / film still look

## Default story rhythm (3 panels)

1. **TOP (~35%)** — Establish dread (space, isolation, wrong quiet)
2. **MID (~30%)** — Intrusion / reveal / action
3. **BOTTOM (~35%)** — Payoff ECU or aftermath beat

Map the user sequence one beat per panel in order.

## Prompt skeleton (Seedream t2i, short)

```
# model: bytedance/seedream-5.0-pro
# mode: text-to-image
# style: horror manga B&W

FORMAT: Black and white horror manga page, vertical 1008x1792, three stacked horizontal panels, thick black gutters, black outer border. High-contrast ink, deep crushed blacks, sparse screentone, light speed lines only if impact. No color, no speech/thought balloons, no dialogue, no captions, no SFX lettering, no logos, no watermarks, no text in the art.

STYLE: Dark horror manga / gekiga atmosphere — wet night, clinical or occult dread, heavy shadow pools, unsettling empty space. Not cyberpunk neon. Not photoreal 3D.

TOP (~35%): [1 sentence — establish dread]
MIDDLE (~30%): [1 sentence — intrusion / action; clear limbs]
BOTTOM (~35%): [1 sentence — ECU or aftermath payoff]

SUBJECT LOCK: [compact character locks if any — faces/outfits consistent all panels]

ANATOMY: exactly two arms and two legs per person unless a single stated mutation. No extra hands. Horizontal panels only, pure B&W horror ink, no empty balloon shapes.
```

**Brevity:** do not restate the full style lock in every panel; 2–3 in-panel cues max. Trim filler if over ~550 words.

## Character locks

If the user names project cast, reuse compact locks (prose only — no refs in t2i):

### Eve + Nero (if horror beat reuses Scotland Yard cast)

```
Eve: long wavy dark hair past shoulders, fair skin, full lips, black rectangular smart glasses always on, fitted dark blazer, slim trousers, composed but terrified forensic analyst
```

```
Nero: lean hard-bitten detective, short dark hair, intense eyes, dark coat, LEFT arm cracked-porcelain bare upper arm with segmented steel forearm from the elbow, RIGHT arm flesh with metal hand at the wrist, two legs, combat boots
```

Left/right = **subject's** left/right. Do not invent dual chrome forearms.

### Original horror cast

Invent a short lock from the beat (face, silhouette, signature prop); hold across all three panels.

## How to expand the user beat

1. Split into 3 concrete visual beats (dread → pressure → payoff)
2. Each panel: **1 short sentence**
3. Prefer implication over gore; escalate only if the user asks
4. Balloons off unless user asks
5. No UI chrome / empty speech circles
6. Always include two-arms / two-legs (or one clear mutation)
7. Word-count → trim → save Downloads txt → show fenced prompt + Saved line

## Optional intensifiers (only if user asks)

- Berserk-level intensity, heavy cross-hatching
- Quiet cosmic dread (less detail, more black field)
- Body-horror: one controlled mutation, stated once
- Dense speed lines / impact for a single panel only

## After the prompt (only if user asks how to ship)

1. User runs **Seedream 5.0 Pro t2i** with prompt → downloads art
2. `make add-image SRC=~/Downloads/<file>.jpg TOON=<toon> UPLOAD=1`
3. Update `content/toons/<toon>/config.json`
4. `npm run publish-toon-config -- --toon <toon>`
5. Deploy only if they ask

## Anti-patterns

- Do not default to image-to-image or require character refs (that is `/toon-page`)
- Do not target Grok Imagine / photoreal ARRI teal-orange (`/jax` skill)
- Do not ship over ~550 words
- Do not split into three separate image prompts
- Do not make all panels the same shot scale
- Do not add neon cyberpunk city candy unless the user mixes genres on purpose
- Do not fill the page with text, balloons, or watermarks
- Do not gore-spam; keep horror readable as ink storytelling
