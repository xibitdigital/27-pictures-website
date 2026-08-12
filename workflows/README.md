# ComfyUI workflows

Node graphs for generating toon plates, as an alternative to
`scripts/generate-toon-page.py` (which talks to the RunComfy **model API**, not
to ComfyUI).

| File                       | Format | Use                                                              |
| -------------------------- | ------ | ---------------------------------------------------------------- |
| `nero-seedream.json`        | UI     | Drag onto the ComfyUI canvas and edit visually                   |
| `nero-seedream.api.json`    | API    | `POST /prompt`, or CI — named inputs, no widget-order ambiguity  |

Both build the same graph:

```
LoadImage (Nero sheet)  ─┐
LoadImage (Eve sheet)   ─┼→ ImageBatch → ImageBatch → ByteDanceSeedreamNode ─┐
LoadImage (prev page)   ─┴──────────────────────────────────┐                │
                                                            ▼                ▼
                                                 ColorMatch(ref, target) ────┘
                                                            │
                                          ImageToMask → MaskToImage → SaveImage
```

## Post steps: tone match, then greyscale

Two fixes that used to happen by hand now run in the graph, in this order:

1. **`ColorMatch`** (ComfyUI-KJNodes) pulls the plate's tonal distribution
   toward the **previous page** — the same `LoadImage` that feeds the
   references — so a new plate does not land brighter or flatter than the page
   before it. `method: mkl` is the safe default; `hm` matches the histogram
   harder if a generation comes back badly off.
2. **`ImageToMask` → `MaskToImage`** flattens to neutral grey. Seedream returns
   a faint blue cast (measured 0.3–1.2 of 255 mean deviation across this book),
   and taking a single channel back out as RGB forces `R=G=B`, so the cast
   cannot survive. It runs *after* the match, so nothing the match introduces
   gets through.

Greyscale last is deliberate — swap the order and `ColorMatch` can put a tint
back in.

**Channel choice:** the pair uses the **green** channel, which carries most of
the luma weight. It is a channel extraction, not a Rec.709 luma mix, which is
fine here because the plate is already near-neutral. If you have
`ComfyUI_essentials`, its `ImageDesaturate+` does a proper weighted mix and can
replace both nodes.

## Reference order matters

`ByteDanceSeedreamNode` takes one batched IMAGE input, and the prompt refers to
"Image 1 / Image 2 / Image 3". The two `ImageBatch` nodes are chained so the
order comes out **Nero sheet, Eve sheet, previous page** — matching the PIN
clause. Re-wire them and the pins point at the wrong pictures.

Drop the three files into `ComfyUI/input/` first, or re-pick them in each
`LoadImage`:

- `nero-character-sheet.png`
- `eve-character-sheet.png`
- `nero-previous-page.png` — the last published plate, so rain, gutters and ink
  carry over. Pull it from `content/toons/nero/config.json` → last `file`, or
  from `cdn-backup/toons/nero/assets/`.

## Model name

The workflow ships `model: "seedream 5.0 lite"`, which is what the node
documents today. The plates in this repo were generated with
**`bytedance/seedream-5.0-pro`** through the RunComfy model API — a different
surface with a different model list. **Check the `model` dropdown after loading
and pick the Pro entry if your install exposes it**, otherwise the ink will not
match the existing pages.

## Size

`width`/`height` are 1024×1792, not the 1008×1792 the prompt names: the node's
minimum width is 1024. The prompt still says 1008×1792 because that phrasing is
what holds the three-panel vertical shape — the small difference is absorbed
when the plate goes through `swap-page`, which converts to WebP anyway.

## After a good generation

```bash
# replace an existing page, keeping its captions, coordinates and audio
node scripts/swap-toon-page.js ~/Downloads/plate.png --toon nero --page 21 --publish

# or append a new page
npm run add-image -- ~/Downloads/plate.png --toon nero --config --upload
```

The graph already flattens the cast, so the ImageMagick pass is only needed for
plates generated elsewhere:

```bash
magick <src> -colorspace Gray -colorspace sRGB /tmp/flat.png   # Seedream tints blue
npm run normalise-audio -- nero                                # if the page brought new clips
```

## Dependencies

`ColorMatch` comes from **ComfyUI-KJNodes** (install via Manager). Everything
else is core. Without KJNodes the graph still loads — delete the ColorMatch
node and wire Seedream straight into `ImageToMask`, then match tone by hand
afterwards.

## Caveats

- **Widget order** — the UI file lists `widgets_values` positionally, so a node
  update that adds or reorders an input silently shifts the values. After
  loading, confirm the prompt is in the prompt box and the size reads 1024×1792.
  The API file is immune to this; prefer it when scripting.
- The seed widget carries an extra `"fixed"` control value in the UI format.
  That is the frontend's `control_after_generate`, not a node input, and it has
  no counterpart in the API file.
- API-node runs need Comfy API credits and an account signed in to the ComfyUI
  frontend; they are billed by ComfyUI/RunComfy, not by this repo's `.env`.
