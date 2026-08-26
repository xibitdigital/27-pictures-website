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

Book: **ERIN & THE GOBLINS**. Ep 1 — the missing CHILD (`/toons/erin/`).
Ep 2 — The Revenge (`/toons/erin-the-revenge/`). Same skill for both.
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
- Several shipped plates have lettering **baked in** — page 3 (`646efa4c…`),
  the KRAK/BOOM Goblin King plate (`0fc4824c…`), `80cb37d9…` ("where is
  she???") and `45febe7c…` ("It's time… / Open."). That is legacy. Those plates are still the best refs
  for **border grammar**, so attach them freely — but never without the ban
  clause below, or the model copies their balloons too.
- Words arrive later as FlipFrame overlays: `words[]` in
  `content/toons/erin/config.json` or `content/toons/erin-the-revenge/config.json`,
  with `variant: bubble | burst`, tails aimed at the sound source. See the
  caption rules in `CLAUDE.md`.
- Leave **readable dead space** in the top band of each panel so an overlay
  bubble has somewhere to sit without covering a face.

Ban clause (paste verbatim into every prompt):

```
NO TEXT AT ALL: no speech balloons, no thought balloons, no shout bursts, no caption boxes, no narration plates, no onomatopoeia, no SFX lettering, no signage text, no title, no credits, no watermark, and no empty white balloon shapes reserved for text. Pure artwork only.
```

## Output rules (strict)

- Build the full prompt, **always save it as a `.txt`** under
  `docs/story/erin/e1/prompts/` or `docs/story/erin/e2/prompts/` (tracked)
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
| Goblin King | `toons/erin/assets/0fc4824cf93e4f6b20131f9817b89ef0.jpg` | Crowned armoured boss (has baked KRAK/BOOM lettering — ban clause required) |
| Portal / magic FX | `toons/erin/assets/1f45add7e288635d156651e19f9122b9.jpg` | How energy and light are inked |
| Ink/style + layout | any prior page, e.g. `toons/erin/assets/8cc09933d67fea64fb14a8d81f430edc.jpg` | Line weight, screentone, panel stack |
| Forest pages | `toons/erin/assets/67227f9cd34af508125aa2aeac592031.jpg`, `toons/erin/assets/1856ff73321fdad84ccee2a4f3161336.jpg` | Woodland ink + wedge-band / frame-break layouts |
| Border grammar | `toons/erin/assets/c6b050b7505fd0d514de8f8b57857697.jpg` (lightning outline), `toons/erin/assets/80cb37d9cc1abdab82ecae25676626ec.jpg` (bolt divider + overlap) | Attach when the page wants a non-straight border |

Local copies live in `cdn-backup/toons/erin/assets/`. Character sheet first —
identity drifts fastest.

PIN clause when refs are used:

```
PIN from references: keep Erin's face, short choppy dark bob with straight fringe, large sharp eyes, black zip track jacket, black trousers with thin side stripe, black combat boots from Image [sheet]; keep goblin design from Image [goblins]; keep the B&W ink style and panel framing from Image [style]. Do not redesign identity.
```

## Save the prompt (required)

**Primary location is the repo, tracked:**

```
docs/story/erin/e1/prompts/   # episode 1
docs/story/erin/e2/prompts/   # episode 2
```

Name it for what it makes, **no timestamp** (git already has the dates):

- `erin-ep1-pNN-<slug>.txt` / `erin-ep2-pNN-<slug>.txt` — a story plate
- `erin-epN-pNN-<slug>-fix.txt` — a fix pass against a generated plate
- `erin-epN-character-<name>.txt` — a character sheet
- keep an old slug (or a second file) when a prompt is replaced but worth
  keeping for traceability — do not reuse the current page’s filename

Running order: `content/toons/erin/README.md`. Index: `docs/story/erin/README.md`.

**Why tracked:** the generated images are not in git — plates live on R2 and
generation references live in `references/`, which is gitignored. The prompt is
the only durable record of how an image was made, and an image without its prompt
cannot be re-rolled, fixed or matched by a later plate.

Optionally also drop a copy in `~/Downloads/` if it is about to be pasted into a
web UI. That copy is a convenience, not the record.

Contents = **prompt only** (optional ≤4-line `#` header naming the model, the
mode, and which reference is Image 1, 2, 3). In chat: the fenced prompt plus the
saved path.
## Defaults (encode inside the prompt)

| Spec | Default |
|------|---------|
| Size | Vertical **1152×1728** (2:3) |
| Panels | **1–3**, stacked; splash for big beats (see rhythm) |
| Gutters | Thin white gutters, thin black keylines, white page margin — **borders are not always straight**, see below |
| Colour | Pure **B&W** ink + grey screentone/wash — the cover is the only colour piece |
| Balloons / text | **None**, always — see the bubble rule |
| Layout ban | No triangle crops, no more than one effect border per page |
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
Goblin King: huge broad-shouldered goblin, jagged bone crown, long pale hair, heavy scaled plate armour and spiked pauldrons, cave-throne (ep 1) or gothic cathedral-castle (ep 2)
```

```
Venus (ep 2): adult woman, long dark hair, pale headband, dark frog-button tunic, star-buckle belt, calm, faintly rim-lit; pin the face from the reference
```

Anti-drift: Erin never gets long hair, a skirt, colour, a cape or armour; she
is in the same black track suit and boots every page. Ep 2 keeps the torn left
shoulder after the gargoyle grab. Goblins stay grey-green ink-toned gremlins —
no orcs, no trolls, no humanoid warriors. Ep 2 is 23 plates; names land on
p06. p06 bottom is Venus trapping the gargoyle pieces in dirt — never a
second earth-golem.

## Panel borders — the page grammar

Panels stack, but **the borders are rarely plain rectangles**. The shipped
book uses a specific vocabulary; name the one you want in the FORMAT line or
the model defaults to a boring grid.

| Border | Look | Use it for | Seen in |
|--------|------|------------|---------|
| **Straight rectangles** | Thin black keyline, thin white gutter | Quiet, observational beats | `cd789256…` |
| **Full bleed** | Panel runs off the page edge, keyline only on the inner sides | Establishing shots, deep forest | `67227f9c…` |
| **Tilted panels** | Whole panel rotated a few degrees; gutters stop being parallel | Rising tension, unsteady ground | `c6b050b7…` |
| **Wedge / parallelogram band** | Panel narrows across the page, edges converge — a slanted band, not a box | ECU cut-ins between two wide panels | `67227f9c…`, `8cc09933…` |
| **Lightning-bolt border** | The whole panel outlined in jagged electric spikes | Shock, a scream, magic firing | `c6b050b7…` |
| **Zigzag bolt divider** | A lightning slash cuts diagonally across the page and *is* the gutter between two panels | Hard cut, a reveal, an impact landing | `80cb37d9…`, `d53879ae…` |
| **Overlap / frame break** | Inset panel sits over its neighbour, or art bursts past the keyline | Faces, fists, anything that should feel closer than the page | `80cb37d9…`, `1856ff73…` |
| **Tilted strip of small panels** | Row of 3 narrow slanted panels across the top | Fast staccato beats before a splash | `1856ff73…` |

Rules that keep it readable:

- **One effect border per page, maximum.** A bolt divider *and* a lightning
  outline *and* a tilt is noise; the energy stops meaning anything.
- Quiet pages stay rectangular. Earn the jagged frame.
- Reading order must survive the tilt — top-to-bottom, left-to-right always.
- A frame-break needs somewhere to break into: keep white margin on that side.
- Panels can be non-rectangular; **crops must not be triangles**, and no
  panel may cut a face in half at the keyline.

## Page rhythm

Pick the layout from the beat, do not force three panels:

| Beat | Layout |
|------|--------|
| Establish / discovery | Single full-bleed splash |
| Move → react | 2 stacked panels (~50/50), straight or lightly tilted |
| Setup → turn → payoff | 3 stacked; middle one often a **wedge band** cutting across |
| Ambush / shock | Splash with one tilted inset panel over a corner, or a **bolt divider** |
| Impact | Splash, radial burst lines, subject dead centre; **lightning-bolt border** |
| Staccato → reveal | Tilted strip of 3 small panels over a full-bleed splash |

One short sentence per panel. Vary shot scale — never three identical mediums.

## Prompt skeleton

```
# model: bytedance/seedream-5.0-pro
# mode: image-to-image
# style: Erin & the Goblins — B&W dark fantasy manga, no lettering
# refs: Image 1 = Erin sheet, Image 2 = goblins, Image 3 = prior page (style)

FORMAT: Black and white dark-fantasy manga page, vertical 1152x1728, 2:3 portrait, [N] stacked panels / full-bleed splash, thin white gutters, thin black keylines, white page margin. Crisp ink linework, cross-hatching, grey screentone, deep solid blacks, speed lines. No colour.

PANEL BORDERS: [pick ONE — straight rectangles / top panel full-bleed to the page edge / panels tilted a few degrees / the middle panel a slanted wedge band narrowing across the page / the whole panel outlined in a jagged lightning-bolt border / a zigzag lightning slash running diagonally across the page as the gutter between two panels / one inset panel overlapping its neighbour and breaking past the keyline]. Reading order stays top to bottom. No triangle panels.

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
  --prompt-file docs/story/erin/e2/prompts/erin-ep2-pNN-<slug>.txt \
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

Do not start from `add-image`. Recipe, tool pick, and mid-list insert:
**Claude.md → “Adding a new toon page image”**.

```bash
magick ~/Downloads/plate.png -colorspace Gray -colorspace sRGB /tmp/flat.png
# ep 1 reader folder is erin; ep 2 is erin-the-revenge
make swap-page SRC=/tmp/flat.png TOON=erin-the-revenge          # append
make swap-page SRC=/tmp/flat.png TOON=erin-the-revenge PAGE=7   # replace page 7
# insert after page N: swap-page cannot — flatten / watermark / WebP / splice, see Claude.md
```

Then write `words[]` in that toon’s `content/toons/<toon>/config.json`.
`--publish` / `make ship` only on request. Staging is `make preview-deploy`.

## Bad generation (do not write a -fix i2i against the plate)

Rewrite the **original** prompt and re-roll from the character/style refs.
Never PIN a failed generation as Image 1 — the model copies the mistake.
Keep the old `.txt` only if the beat is worth tracing; do not add `*-fix.txt`.

## Anti-patterns

- **Never** ask for bubbles, captions or SFX in the art — that is the one rule
  this skill exists for
- Do not use 1008×1792 (that is the Jax/Nero ratio)
- Do not add colour outside the cover
- Do not ship over ~550 words
- Do not drop the Erin character sheet ref — prose alone drifts her face
- Do not default to three plain rectangles — say which border the page wants
- Do not stack two or more effect borders on one page
- Do not turn goblins into orcs or the town into a modern city
- Do not target Grok Imagine / photoreal (`/jax`)
