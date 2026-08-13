---
name: erin-toon-page
description: >
  Build a ByteDance Seedream 5.0 Pro (image-to-image) prompt for a page of
  "ERIN & THE GOBLINS" — black-and-white dark-fantasy manga plates
  (vertical 1152×1728) for the 27 Pictures Erin FlipFrame reader. Renders
  NO speech bubbles, caption boxes or SFX lettering: all words are added
  later as FlipFrame word overlays in content/toons/erin/config.json. Use
  when the user says "erin", "erin page", "/erin-toon-page", "erin toon",
  "goblins page", or wants a new Erin plate prompt.
user-invokable: true
argument-hint: "[beat / scene for the Erin page]"
---

# Erin Toon Page — Seedream 5.0 Pro (i2i) Prompt Generator

Book: **ERIN & THE GOBLINS — the missing CHILD** (Volume 1 Prequel).
Reader: `/toons/erin/`, config `content/toons/erin/config.json`.
Target model: **`bytedance/seedream-5.0-pro` · image-to-image**.

Siblings: `/toon-page` (cyberpunk), `/horror-toon-page` (horror). This one is
**dark-fantasy urban goblin manga** and, unlike both, **never bakes text into
the art**.

## The bubble rule (this skill's whole point)

**No rendered bubbles. Ever.**

- No speech balloons, thought balloons, jagged shout bursts, caption boxes,
  narration plates, onomatopoeia / SFX lettering, title text, credits.
- No empty balloon shapes either — the model likes to leave white ovals
  "for text"; ban them explicitly.
- Page 3 and the KRAK/BOOM plate in the existing book have lettering **baked
  in**. That is legacy. Do not copy it, and do not use those plates as style
  refs without the ban clause below.
- Words arrive later as FlipFrame overlays: `words[]` entries in
  `content/toons/erin/config.json`, with `variant: bubble | burst`, tails
  aimed at the sound source. See the caption rules in `CLAUDE.md`.
- Leave **readable dead space** in the top band of each panel so an overlay
  bubble has somewhere to sit without covering a face.

Ban clause (paste verbatim into every prompt):

```
NO TEXT AT ALL: no speech balloons, no thought balloons, no shout bursts, no caption boxes, no narration plates, no onomatopoeia, no SFX lettering, no signage text, no title, no credits, no watermark, and no empty white balloon shapes reserved for text. Pure artwork only.
```

## Output rules (strict)

- Build the full prompt, **always save it as a `.txt`** in `~/Downloads/`
- Also show it in chat as one copyable fenced block
- **Under ~550 English words** (Seedream scatters detail past ~600)
- **Prompt-only by default.** Write the file and stop — user attaches refs and
  generates in RunComfy / ComfyUI
- **Generate only on explicit request** ("generate it", "run it"). A beat
  description is not a generate request
- No beat given → ask once, wait

## Model & schema

| Item | Value |
|------|-------|
| Model | `bytedance/seedream-5.0-pro` |
| Mode | **image-to-image** |
| `image` | 1–10 refs, <30 MB each |
| `resolution` | **`1K`** ($0.05/image) — set explicitly, API defaults to 2K |
| `output_format` | `png` or `jpeg` |

**No width/height parameter.** Shape comes from the prompt, so the FORMAT line
must always say `vertical 1152x1728, 2:3 portrait page`. Erin plates are
**2:3**, not the 9:16 used by Jax/Nero — mixing them up gives a wrong-shaped
page the reader letterboxes.

## References (attach these)

| Ref | R2 key | Role |
|-----|--------|------|
| Erin character sheet | `toons/erin/assets/c363b4d490e8b574c61f92716bdc7dd4.jpg` | **Always** — face, hair, outfit, boots |
| Cover | `toons/erin/assets/6bfcd46718a6a8defd3b22e4998c7ddf.jpg` | Goblin design + title-page look (colour — do not pin colour from it) |
| Goblin pack | `toons/erin/assets/b19084ec3aa6db1355311aea48adfd23.jpg` | Goblin anatomy in B&W ink |
| Goblin King | `toons/erin/assets/1f45add7e288635d156651e19f9122b9.jpg` | Crowned armoured boss |
| Ink/style + layout | any prior page, e.g. `toons/erin/assets/8cc09933d67fea64fb14a8d81f430edc.jpg` | Line weight, screentone, panel stack |

Local copies live in `cdn-backup/toons/erin/assets/`. Character sheet first —
identity drifts fastest.

PIN clause when refs are used:

```
PIN from references: keep Erin's face, short choppy dark bob with straight fringe, large sharp eyes, black zip track jacket, black trousers with thin side stripe, black combat boots from Image [sheet]; keep goblin design from Image [goblins]; keep the B&W ink style and panel framing from Image [style]. Do not redesign identity.
```

## Save prompt to Downloads (required)

1. UTF-8 `.txt` under `~/Downloads/`
2. Filename `erin-toon-page-<slug>-YYYYMMDD-HHMMSS.txt`
   (slug: lowercase ASCII from first ~40 chars of the beat, spaces → `-`)
3. Contents = prompt only, optional ≤4-line `#` header:

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# style: Erin & the Goblins — B&W dark fantasy manga, no lettering
# refs: [what to attach, in order]
```

4. Chat: fenced prompt + `Saved: ~/Downloads/...`

## Defaults (encode inside the prompt)

| Spec | Default |
|------|---------|
| Size | Vertical **1152×1728** (2:3) |
| Panels | **1–3**, horizontal stack; splash for big beats (see rhythm) |
| Gutters | Thin white gutters, thin black panel keylines, white page margin |
| Colour | Pure **B&W** ink + grey screentone/wash — the cover is the only colour piece |
| Balloons / text | **None**, always — see the bubble rule |
| Layout ban | Diagonal slash panels only for shock beats; never triangle crops |
| Anatomy | Two arms, two legs per human; goblins keep four limbs |

## Style lock (always include)

- High-contrast western-manga ink: crisp black linework, dense cross-hatching,
  grey screentone/ink-wash midtones, deep solid blacks
- Erin is the light source of the page — white rim glow separating her black
  outfit from the dark background
- Speed lines and radial burst lines for motion and impact
- Crumbling medieval slum: cobbles, cracked plaster, timber, brick alleys,
  cellars, moonlit rooftops, cave tunnels with stalactites
- Grounded fantasy horror for young readers: menace, no gore, no blood pools
- **Not** cyberpunk neon, **not** teal-orange photoreal, **not** cute chibi

## Cast locks

Full detail in `references/erin-lock.md`. Compact in-prompt versions:

```
Erin: teenage girl, pale skin, short choppy dark bob with a straight fringe and side tufts, large sharp eyes with heavy lashes, hard determined brow, black zip-up track jacket with high collar and ribbed cuffs, black trousers with a thin side stripe, black lace-up combat boots, wiry athletic build
```

```
Goblins: hunched knee-high-to-waist creatures, warty knobbed skulls, long pointed ears, bulging pale eyes, wide fanged grins, sinewy long-fingered arms, ragged rags, knotted wooden clubs, moving in packs from the shadows
```

```
Goblin King: huge broad-shouldered goblin, jagged bone crown, long pale hair, heavy scaled plate armour and spiked pauldrons, cave-throne setting
```

Anti-drift: Erin never gets long hair, a skirt, colour, a cape or armour; she
is in the same black track suit and boots every page. Goblins stay grey-green
ink-toned gremlins — no orcs, no trolls, no humanoid warriors.

## Page rhythm

Pick the layout from the beat, do not force three panels:

| Beat | Layout |
|------|--------|
| Establish / discovery | Single full-bleed splash |
| Move → react | 2 stacked horizontal panels (~50/50) |
| Setup → turn → payoff | 3 stacked horizontals (~35/30/35) |
| Ambush / shock | Splash with one tilted inset panel over a corner |
| Impact | Splash, radial burst lines, subject dead centre |

One short sentence per panel. Vary shot scale — never three identical mediums.

## Prompt skeleton

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# style: Erin & the Goblins — B&W dark fantasy manga, no lettering
# refs: Image 1 = Erin sheet, Image 2 = goblins, Image 3 = prior page (style)

FORMAT: Black and white dark-fantasy manga page, vertical 1152x1728, 2:3 portrait, [N] stacked horizontal panels / full-bleed splash, thin white gutters, thin black keylines. Crisp ink linework, cross-hatching, grey screentone, deep solid blacks, speed lines. No colour.

NO TEXT AT ALL: no speech balloons, no thought balloons, no shout bursts, no caption boxes, no narration plates, no onomatopoeia, no SFX lettering, no signage text, no title, no credits, no watermark, and no empty white balloon shapes reserved for text. Pure artwork only.

PIN (keep from refs): Erin's face/hair/black track suit/boots, goblin design, B&W ink style. Do not redesign identity.

TOP: [1 sentence]
MIDDLE: [1 sentence]
BOTTOM: [1 sentence]

SUBJECT LOCK: Erin — [compact lock]. Goblins — [compact lock if present]. Same face and outfit in every panel.

COMPOSITION: leave clear dark or flat space in the top band of each panel for later caption overlays; never crowd the frame edge with faces.

ANATOMY: exactly two arms and two legs per figure. No extra hands, no ghost limbs.

CHANGE: only the scene described above; preserve identity and ink style from the pins.
```

Trim filler adjectives first if over ~550 words.

## Generating (opt-in — never by default)

```bash
set -a; source .env; set +a
python3 scripts/generate-toon-page.py \
  --prompt-file ~/Downloads/erin-toon-page-<slug>-<stamp>.txt \
  --mode image-to-image \
  --ref-asset toons/erin/assets/c363b4d490e8b574c61f92716bdc7dd4.jpg \
  --ref-asset toons/erin/assets/b19084ec3aa6db1355311aea48adfd23.jpg \
  --resolution 1K
```

- **Costs money** — $0.05 per `1K` image. State the cost before firing; a bad
  result is a prompt fix, not a re-roll
- Refs must be public HTTPS; `--ref-asset` expands R2 keys against
  `VITE_ASSET_BASE`. A local-only file cannot be passed — upload it or tell the
  user to attach it in the web UI
- Ref order sets Image 1, Image 2… — keep it matching the `# refs:` header
- `--dry-run` prints the payload and spends nothing

## Shipping a finished plate (only if asked)

```bash
make add-image SRC=~/Downloads/<file>.jpg TOON=erin UPLOAD=1
# add captions to content/toons/erin/config.json → words[]
npm run publish-toon-config -- --toon erin
```

Erin plates are near-neutral already, but flatten any colour cast before
publishing (`magick <src> -colorspace Gray -colorspace sRGB /tmp/flat.png`).
Deploy only on request — and "deploy live" means `make preview-deploy`.

## Fix mode (user attaches a bad generation)

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# refs: Image 1 = page to fix; Image 2 = Erin sheet

PIN from Image 1: keep the panel layout, B&W ink style, alley setting, Erin's pose.

CHANGE / FIX:
- remove every balloon, caption box and lettering; fill that area with artwork
- Erin keeps the short dark bob and black track jacket from Image 2
- each figure exactly two arms and two legs
- do not restyle faces into different people

FORMAT: same vertical 1152x1728 B&W manga page, no text of any kind.
```

## Anti-patterns

- **Never** ask for bubbles, captions or SFX in the art — that is the one rule
  this skill exists for
- Do not use 1008×1792 (that is the Jax/Nero ratio)
- Do not add colour outside the cover
- Do not ship over ~550 words
- Do not drop the Erin character sheet ref — prose alone drifts her face
- Do not turn goblins into orcs or the town into a modern city
- Do not target Grok Imagine / photoreal (`/jax`)
