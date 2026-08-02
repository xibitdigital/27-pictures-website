---
name: toon-page
description: >
  Build a ByteDance Seedream 5.0 Pro (image-to-image) prompt for a full
  black-and-white multi-panel toon page (default 3 horizontal panels,
  1008×1792) for 27 Pictures cyberpunk manga. Always saves the prompt as a
  .txt in the user's Downloads folder; generates the image only when the user
  explicitly asks. Use when the user says "toon page", "/toon-page", "toon
  panel", "new page prompt", "seedream", "i2i", or wants a FlipFrame/toon
  reader plate prompt.
user-invokable: true
argument-hint: "[beat / scene for the page]"
---

# Toon Page — Seedream 5.0 Pro (image-to-image) Prompt Generator

Target model: **`bytedance/seedream-5.0-pro` · image-to-image** (not Grok Imagine).

Take the user's beat/scene and output a **complete Seedream i2i prompt** for one vertical multi-panel toon page.

## Output rules (strict)

- Build the full prompt, then **always save it as a `.txt` file** in the user's Downloads folder
- Also show the prompt in chat as a single copyable fenced code block
- **Length: stay under ~550 English words** (Seedream sweet spot <600 words; longer prompts scatter detail). Prefer tight panel lines + short locks.
- **Default is prompt-only.** Write the `.txt` and stop. The user normally attaches reference images in the ComfyUI / RunComfy web interface and generates there.
- **Only generate when the user explicitly asks** — "generate it", "run it", "make the image". A beat description alone is never a request to generate. See *Generating (opt-in)* below.
- If the user gives no beat/scene, ask once, then wait

## Model & workflow (Seedream i2i)

| Item | Value |
|------|--------|
| Model | `bytedance/seedream-5.0-pro` |
| Mode | **image-to-image** (prefer refs over pure prose for identity) |
| Max attention | Keep prompt **<600 English words** |
| Structure | Layer: **format → subject → composition → lighting/style → pin (keep) → change** |

### Input schema (RunComfy `/v1/models/bytedance/seedream-5.0-pro/image-to-image`)

| Field | Notes |
|-------|-------|
| `prompt` | required. >600 English words → the model scatters detail and drops elements |
| `image` | required, **1–10** refs. JPEG/PNG/WEBP/BMP/TIFF/GIF/HEIC/HEIF, <30 MB each, aspect ratio between 1:16 and 16:1, min 14 px per side |
| `resolution` | **use `1K`** ($0.05/image) — project default. `2K` ($0.10) is the API default, so set this explicitly |
| `output_format` | `png` (default) or `jpeg` |

**There is no width/height parameter.** The model infers the output shape from the aspect ratio *described in the prompt* — which is why the FORMAT line must always spell out `vertical 1008x1792` and `three stacked horizontal panels`. Drop that phrasing and the page comes back the wrong shape.

Cap refs at 10; if more character sheets than that are relevant, pick the ones carrying identity (face, cyberware) over mood/style.

### Reference images (when available)

Attach / tell the user to attach in Seedream i2i:

1. **Layout ref** (optional): prior 3-panel page to preserve gutters / stack
2. **Character refs**: Eve, Nero, Jax face/outfit sheets
3. **Style ref**: B&W manga ink page they already like

Always include a **pin clause** when refs are used, e.g.:

```
Pin from references: keep Eve face/hair/glasses/outfit from Image [Eve]; keep Nero face/hair/steel-left-forearm/metal-right-hand from Image [Nero]; keep B&W manga ink style and three-panel vertical stack from Image [layout] if provided.
```

Name what must **not** change vs what must **change** (i2i rule: unmentioned elements drift).

## Save prompt to Downloads (required)

After assembling the prompt body (plain text, no markdown fences inside the file):

1. Write a UTF-8 `.txt` file under the user's Downloads directory.
2. Path: `$HOME/Downloads/` or `~/Downloads/` (typically `/Users/<user>/Downloads/`)
3. Filename: `toon-page-<slug>-YYYYMMDD-HHMMSS.txt`
   - `slug`: lowercase ASCII from the first ~40 chars of the beat; spaces → `-`; strip non `[a-z0-9-]`; collapse `--`; default `page`
4. File contents = **the prompt only** (no ``` fences, no commentary)
5. Chat reply: fenced prompt + one line `Saved: ~/Downloads/...`

Optional: first lines of the file may be a short header block the user can strip:

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# refs: [list what to attach]
```

If you include a header, keep it to ≤4 lines; prompt body still counts toward word budget.

## Generating (opt-in — never by default)

Only when the user explicitly asks for the image. Otherwise the `.txt` is the whole deliverable.

```bash
set -a; source .env; set +a
python3 scripts/generate-toon-page.py \
  --prompt-file ~/Downloads/toon-page-<slug>-<stamp>.txt \
  --ref-asset toons/nero/assets/<md5>.png \
  --ref https://…/nero.png
```

- **Costs real money** — $0.05 per image at the project default `1K`. One request produces one image. Say the cost before firing, and never re-run on a whim; a bad result is a prompt fix, not a re-roll.
- **References must be publicly fetchable HTTPS URLs** — RunComfy pulls them server-side, so a local file path cannot work. Two ways:
  - `--ref-asset <r2-key>` expands against `VITE_ASSET_BASE`, so any plate already uploaded to R2 works with no re-upload (`toons/nero/assets/<md5>.png`)
  - `--ref <url>` for anything already hosted
- **A local-only ref (e.g. `~/Downloads/nero.png`) cannot be used from the script.** Either upload it first, or tell the user to attach it in the web UI instead — do not silently drop a reference the prompt names.
- Ref order matters: the prompt's `# refs:` header labels Image 1, Image 2… in the order passed.
- `--dry-run` prints the payload and spends nothing. Use it to sanity-check refs before a real run.
- After a successful generation, the script prints the matching `make add-image …` line; do not run it unless asked.

## Defaults (encode inside the prompt)

| Spec | Default |
|------|---------|
| Size | Vertical **1008×1792** (or "vertical 9:16 / toon page ratio") |
| Panels | **3** stacked **horizontal** panels, thick black gutters, black outer border |
| Color | Pure **B&W** manga ink — no color, no gray watercolor wash |
| Balloons | **None** by default |
| Text in art | **None** by default |
| Layout ban | No diagonal slash panels, no triangle crops |
| Anatomy | Every person has **exactly two arms and two legs** |

Change panel count only if the user asks.

## Default story rhythm (3 panels)

1. **TOP (~35%)** — Establish
2. **MID (~30%)** — Focus / action
3. **BOTTOM (~35%)** — Payoff / ECU

Map user sequence one beat per panel in order.

## Prompt skeleton (Seedream i2i, short)

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# refs: attach Eve [and Nero / layout] if available

FORMAT: Black and white cyberpunk manga page, vertical 1008x1792, three stacked horizontal panels, thick black gutters, black outer border. High-contrast ink, screentone, light speed lines. No color, no speech/thought balloons, no dialogue, no captions, no SFX, no logos, no watermarks, no text in the art.

PIN (keep from refs): [faces, glasses, cyber arm side, outfit, B&W manga style, 3-panel stack if layout ref]. Do not redesign identity.

TOP (~35%): [1 sentence — establish]
MIDDLE (~30%): [1 sentence — action; one door / clear limbs]
BOTTOM (~35%): [1 sentence — ECU payoff; glasses stay on]

SUBJECT LOCK: Eve — [compact]. Nero — [compact if present]. Same faces/outfits all panels.

ANATOMY: exactly two arms and two legs per person. Nero's LEFT arm is steel from the elbow down over a bare cracked-porcelain upper arm; his RIGHT arm is flesh with a metal hand from the wrist — never a third arm. No extra hands. Horizontal panels only, pure B&W manga, no photoreal 3D, no empty balloon shapes.

CHANGE: only the scene/action described above; preserve identity and ink style from pins.
```

**Brevity:** do not restate the full lock in every panel; 2–3 in-panel cues max. Cut filler adjectives first if over ~550 words.

## Character locks

### Jax (Jax book)

See `references/jax-lock.md`.

```
Jax: lean cyberpunk male, messy spiky black hair, cracked porcelain-like skin on face and arms, sharp intense eyes, long dark trench coat with straps and shoulder armor, heavy plated mechanical cyber arm, combat boots
```

### Eve + Nero (Scotland Yard book)

See `references/eve-lock.md`. Prefer **user reference image** for Eve over prose. Use compact locks in the prompt:

```
Eve: long wavy dark hair past shoulders, fair skin, full lips, black rectangular smart glasses always on, fitted dark blazer over dark top, slim trousers, belt, slim wristwatch, composed forensic analyst
```

```
Nero: lean hard-bitten detective, short dark hair, intense eyes, dark coat, LEFT arm cracked-porcelain bare upper arm with a segmented steel forearm and metal hand from the elbow down, RIGHT arm flesh ending in a metal cybernetic hand at the wrist, two legs, combat boots
```

Eve anti-drift: no short bob, no missing glasses (including ECU), no tactical armor, no bare midriff.

**Nero's cyber limbs — both sides, asymmetric:**

- **LEFT arm: bare cracked-porcelain upper arm, steel from the elbow down.** The bicep and shoulder are skin with fine crack lines running through it, under a rounded dark pauldron; the chrome begins at the elbow — segmented plated forearm, exposed cable seams, articulated metal fingers. Set by the `nero.png` key art: facing camera, that arm reads on the viewer's right, i.e. his anatomical left.
- **RIGHT arm: ordinary flesh, cybernetic HAND only** — the prosthetic starts at the wrist. Forearm and upper arm are skin.
- Never a third arm, never two chrome forearms, never a flesh left hand.
- Do **not** ask for "full steel shoulder to fingertips" — that contradicts the key art, and the model will keep drawing the elbow join no matter how the prompt is worded.
- Beware mirroring: flopping a panel moves the full arm to the wrong side, so mirror the pose, not the character.

**Left and right always mean the SUBJECT's own left and right, never the viewer's.** Which side of the frame the steel forearm lands on therefore depends on which way he faces:

| Nero is | His LEFT (steel forearm) appears | His RIGHT (flesh + metal hand) appears |
|---------|-------------------------------|----------------------------------------|
| facing the camera | on the viewer's **right** | on the viewer's **left** |
| seen from behind | on the viewer's **left** | on the viewer's **right** |
| profile facing frame-left | nearer the camera | far side, occluded |
| profile facing frame-right | far side, occluded | nearer the camera |

When a panel puts him back-to-camera, say so in the prompt *and* spell out which side of the frame each arm falls on — the model does not reliably work this out, and a coat covering the flesh arm makes both read as prosthetic.

### Other characters

Invent a short lock from cues or refs; hold across panels.

## How to expand the user beat

1. Split into 3 concrete visual beats
2. Each panel: **1 short sentence**
3. Balloons off unless user asks
4. No UI chrome / empty speech circles
5. No watermarks in the art prompt
6. Always include two-arms / two-legs + cyber-replacement language when relevant
7. If **i2i fix** of an attached page: open with PIN (what to keep from Image 1) + CHANGE (what to fix)
8. Word-count → trim if needed → save Downloads txt → show fenced prompt + Saved line

## Fix mode (user attaches a bad generation)

Diagnose: extra limbs, dropped glasses, dual-door chaos, etc. Rewrite a **short** Seedream i2i edit prompt:

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# refs: Image 1 = current page to fix; Image 2+ = character refs if any

PIN from Image 1: keep overall three-panel layout, rainy cyberpunk street, cab design, Eve long wavy hair and blazer, Nero short dark hair and dark coat, B&W manga ink.

CHANGE / FIX:
- MIDDLE: only ONE open car door; each person exactly two arms and two legs; Nero left forearm steel from the elbow, right arm flesh with a metal hand (not a third arm); no ghost limbs.
- BOTTOM: Eve keeps black rectangular glasses on her face.
- Do not restyle faces into different people.

FORMAT: same vertical 1008x1792 B&W manga page, three horizontal panels, no balloons, no text in art.
```

## Optional intensifiers (only if user asks)

- Berserk-level intensity, heavy cross-hatching
- Ghost in the Shell mechanical detail
- Dense speed lines / impact
- Quiet/stealth (less speed lines, more shadow)

## After the prompt (only if user asks how to ship)

1. User runs **Seedream 5.0 Pro i2i** with prompt + refs → downloads art
2. `make add-image SRC=~/Downloads/<file>.jpg TOON=nero UPLOAD=1` (or `jax` / `erin`)
3. Update `content/toons/<toon>/config.json`
4. `npm run publish-toon-config -- --toon <toon>`
5. Deploy only if they ask

## Anti-patterns

- Do not target Grok Imagine / photoreal ARRI teal-orange (`/jax` skill)
- Do not ship over ~550 words
- Do not split into three separate image prompts
- Do not make all panels the same shot scale
- Do not omit limb count or cyber-as-extra-arm
- Do not forget i2i **PIN** when a reference image is attached
- On multi-person action: one door/entry, cyber limb = replacement only
