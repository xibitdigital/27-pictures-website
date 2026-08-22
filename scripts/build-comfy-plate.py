#!/usr/bin/env python3
"""Render a ComfyUI graph for one toon plate from a tracked prompt file.

Why this exists: the RunComfy **model API** cannot produce a portrait plate.
Measured 2026-08-21 — every reference portrait (sheets 1584x2816, previous page
800x1424), `aspect_ratio: "9:16"` sent explicitly, and the delivered file was
still 1024x1024. The field is documented for other models on that API and is
accepted without error for Seedream, but it does not reach the model. The
ComfyUI node takes real `width`/`height`, which is the only scripted route to a
portrait plate.

One generator, one graph per series — never a workflow file per page. Everything
that differs between pages is an argument here:

  # build the graph, print the curl, send nothing
  python3 scripts/build-comfy-plate.py \
      --prompt-file docs/story/red-smile/prompts/page-10-lift-drain.txt \
      --ref halina --ref marcus --ref page08 \
      --prefix redsmile-marcus/page-10 \
      --out workflows/redsmile-seedream.api.json

  # same, and queue it
  python3 scripts/build-comfy-plate.py … --submit

`--ref` takes an alias from REFS below, or the filename as ComfyUI sees it in
its own `input/` dir, in Image 1..N order — the order the prompt's PIN clause
counts in, previous page last. Upload them before running the graph.

The `# ` header lines of the prompt file are stripped: they are notes to whoever
runs the prompt, not instructions to the model. One roll went out with that
header inside the prompt, so the model read a note about its own output size.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

# 1024x1824 is the verified-working render: aspect 0.5614 against the plate's
# 0.5618, so it needs no crop, and the API accepts it — the "3.68 MP floor" this
# file used to assert was wrong, disproved 2026-08-21 by a 1.87 MP roll that
# rendered fine. The node caps height at 2496, so 1408x2512 is the largest
# aspect-matched size available and is worth trying for the extra detail (3.54
# MP, 1.9x the pixels) — untested as of this writing.
# Resizing and converting locally is free; only generation costs credits. So
# render as large as the model allows and downsample, never the reverse.
DEFAULT_WIDTH = 1024
DEFAULT_HEIGHT = 1824
PLATE_WIDTH = 800
PLATE_HEIGHT = 1424
MIN_MEGAPIXELS = 3.68
# seedream-4-0 is the one model with a lower floor
MIN_MEGAPIXELS_4_0 = 0.92
# What pages 1-9 were made with. Lite runs but the ink will not match.
DEFAULT_MODEL = 'seedream 5.0 pro'
DEFAULT_COMFY_URL = os.environ.get('COMFY_URL', 'http://127.0.0.1:8188')

# ComfyUI renames every upload to the sha256 of its bytes, so an `input/`
# filename records nothing about what it is. These aliases are that record — add
# a line rather than pasting a hash into a command where nobody can tell which
# reference it is.
REFS = {
    'halina': '19f0f1f640d5016041f90d7fac523ecd2f67fba45670b55e1e4b7b954628c396.png',
    'marcus': 'be8903d63745c54d93082c9a58ff8c932a5643b88cbb7c276c328e30704438d4.png',
    'page08': '9bdb1524bfa35e7ecad59cadbfea54755b96a06e751988a53906affb76e2349c.png',
    # Uploaded again under different bytes when the four-slot graph was wired by
    # hand; ComfyUI keys uploads by sha256, so a re-upload is a new name.
    'marcus2': 'f69e14e0a4dc1b6a2173818fa4bc063b17ab2900ee7356e966208766045634a7.png',
    'page08b': '2545d7fdc4cf7a9eb1291c72f4f0052370d2c53cdf54169f61ed41ca4c3db8a9.png',
    # page 5 — its panel 1 is the black sclera drawn as an eye, which is what the
    # EYES clause pins against. A cropped eye study taught a roll sunglasses.
    'page05': 'c98d4c5374a359b29b6b3ffcf57531fcc4477aba886990efadd781e47fcda387.png',
    # the shipped page 9 plate — Image 3 for the drain page
    'page09': '63bed0610ccaf89475acf565fe779f970c8694788567e5aaa77a9ff088ac2f64.png',
    # page 11 Viktor desk, un-watermarked ComfyUI upload — Image 3 on the Tokiro page
    'page11': '90d14cfdfdd250c521c03469e435a29e6bd106479676dc70b5091485256b02f9.png',
    'viktor': '4981daab45709b1fda8d2f25dcc6bd13effe39770d83a1f6a6955133c850d753.png',
    'tokiro': 'f77f85de644b96fb0cafc6fc1a6b37e81d035a92b06f1aa358a473a181926577.png',
}

# Rec.709 luma out of core nodes only: ImageBlend in "normal" mode computes
# image1*(1-f) + image2*f, so 0.7708 then 0.0722 lands on
# 0.2126 R + 0.7152 G + 0.0722 B to within 0.02/255. ComfyUI ships no grayscale
# node — ImageDesaturate is Comfy Essentials / WAS, and a graph in this repo has
# to load on a stock install.
BLEND_RG = 0.7708
BLEND_B = 0.0722


def dumps(obj):
    """JSON in the repo's prettier style.

    Prettier keeps a short scalar array on one line, so a plainly dumped graph is
    rewritten by the pre-commit hook the moment it is generated — the builder and
    the formatter then take turns dirtying the same file. Matching the style here
    ends that: `["6", 0]` links in the API format, the `pos` / `size` pairs the
    canvas format is full of.
    """

    def enc(value, depth):
        pad = '  ' * depth
        inner = '  ' * (depth + 1)
        if isinstance(value, dict):
            if not value:
                return '{}'
            body = ',\n'.join(f'{inner}{json.dumps(k, ensure_ascii=False)}: {enc(v, depth + 1)}' for k, v in value.items())
            return '{\n' + body + '\n' + pad + '}'
        if isinstance(value, list):
            if not value:
                return '[]'
            if all(not isinstance(v, (dict, list)) for v in value):
                flat = '[' + ', '.join(json.dumps(v, ensure_ascii=False) for v in value) + ']'
                if len(pad) + len(flat) <= 80:
                    return flat
            body = ',\n'.join(f'{inner}{enc(v, depth + 1)}' for v in value)
            return '[\n' + body + '\n' + pad + ']'
        return json.dumps(value, ensure_ascii=False)

    return enc(obj, 0) + '\n'


def read_prompt(path):
    with open(path, encoding='utf-8') as fh:
        body = [line for line in fh if not line.startswith('#')]
    text = ''.join(body).strip()
    if not text:
        raise SystemExit(f'error: {path} has no prompt body (only # header lines)')
    words = len(text.split())
    if words > 600:
        print(f'! prompt is {words} words; over ~600 Seedream scatters detail', file=sys.stderr)
    return text


def resolve_ref(name):
    if name in REFS:
        return REFS[name]
    if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
        return name
    raise SystemExit(
        f"error: unknown reference '{name}' — pass a filename with an extension, "
        f'or add it to REFS in scripts/build-comfy-plate.py (known: {', '.join(REFS)})'
    )


def build_api_graph(prompt, refs, width, height, model, prefix, seed):
    """LoadImage xN -> Seedream V3 -> Rec.709 flatten -> ImageScale -> SaveImage.

    `ByteDanceSeedreamNodeV3` takes references in numbered autogrow slots, so
    there is no ImageBatch chain: `model.images.image_N` *is* the "Image N" the
    prompt's PIN clause names. The dotted keys are not invented here — they are
    what `finalize_prefix` produced for a live graph, read back out of a ComfyUI
    `Export (API)`. Getting them wrong is a BadRequest hours later on a hosted
    setup, which is why they are copied rather than derived.
    """
    graph = {}
    for i, (alias, name) in enumerate(refs, start=1):
        graph[str(i)] = {
            'class_type': 'LoadImage',
            '_meta': {'title': f'Image {i} — {alias}'},
            'inputs': {'image': name},
        }

    nid = len(refs)

    def nxt():
        nonlocal nid
        nid += 1
        return str(nid)

    seedream = nxt()
    inputs = {
        'prompt': prompt,
        'model': model,
        'model.size_preset': 'Custom',
        'model.width': width,
        'model.height': height,
        'model.prompt_optimization': 'standard',
        'model.seed': seed,
        # The site stamp is baked later by swap-toon-page; twice looks wrong.
        'model.watermark': False,
        'model.thinking': True,
    }
    for i in range(1, len(refs) + 1):
        inputs[f'model.images.image_{i}'] = [str(i), 0]
    graph[seedream] = {
        'class_type': 'ByteDanceSeedreamNodeV3',
        '_meta': {'title': f'Seedream — {model} (i2i)'},
        'inputs': inputs,
    }

    # Seedream returns a faint colour cast on every generation (measured 1.68 of
    # 255 mean deviation from grey on one roll), which reads as a blue tone on
    # dark plates. Flattening in-graph means swap-toon-page gets a neutral plate
    # and the `magick -colorspace Gray` pass is no longer a separate step.
    channels = {}
    for channel in ('red', 'green', 'blue'):
        split = nxt()
        graph[split] = {
            'class_type': 'ImageToMask',
            '_meta': {'title': f'Split — {channel}'},
            'inputs': {'image': [seedream, 0], 'channel': channel},
        }
        as_image = nxt()
        graph[as_image] = {
            'class_type': 'MaskToImage',
            '_meta': {'title': f'{channel.capitalize()} as image'},
            'inputs': {'mask': [split, 0]},
        }
        channels[channel] = as_image

    luma_rg = nxt()
    graph[luma_rg] = {
        'class_type': 'ImageBlend',
        '_meta': {'title': f'Luma — {1 - BLEND_RG:.4f} R + {BLEND_RG} G'},
        'inputs': {
            'image1': [channels['red'], 0],
            'image2': [channels['green'], 0],
            'blend_factor': BLEND_RG,
            'blend_mode': 'normal',
        },
    }
    luma = nxt()
    graph[luma] = {
        'class_type': 'ImageBlend',
        '_meta': {'title': f'Luma — + {BLEND_B} B (Rec.709 grey)'},
        'inputs': {
            'image1': [luma_rg, 0],
            'image2': [channels['blue'], 0],
            'blend_factor': BLEND_B,
            'blend_mode': 'normal',
        },
    }

    scale = nxt()
    graph[scale] = {
        'class_type': 'ImageScale',
        '_meta': {'title': f'Down to {PLATE_WIDTH}x{PLATE_HEIGHT} (plate size)'},
        'inputs': {
            'image': [luma, 0],
            'upscale_method': 'lanczos',
            'width': PLATE_WIDTH,
            'height': PLATE_HEIGHT,
            'crop': 'center',
        },
    }

    graph[nxt()] = {
        'class_type': 'SaveImage',
        '_meta': {'title': 'Save plate (flattened)'},
        'inputs': {'images': [scale, 0], 'filename_prefix': prefix},
    }
    # The flatten is lossy in principle and an API-node run costs credits;
    # losing a good roll to a bad conversion is not worth saving one file.
    graph[nxt()] = {
        'class_type': 'SaveImage',
        '_meta': {'title': 'Save raw (pre-flatten)'},
        'inputs': {'images': [seedream, 0], 'filename_prefix': f'{prefix}-raw'},
    }
    return graph


def submit(graph, url):
    body = json.dumps({'prompt': graph}).encode('utf-8')
    req = urllib.request.Request(
        f'{url.rstrip('/')}/prompt',
        data=body,
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req) as res:
            print(f'queued: {res.read().decode('utf-8', 'replace')}')
    except urllib.error.HTTPError as err:
        detail = err.read().decode('utf-8', 'replace')
        raise SystemExit(f'error: POST {url}/prompt -> {err.code}\n{detail}')
    except urllib.error.URLError as err:
        raise SystemExit(f'error: cannot reach {url} ({err.reason}) — pass --url')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prompt-file', required=True)
    ap.add_argument('--ref', action='append', default=[],
                    help=f'REFS alias or ComfyUI input filename, Image 1..N order (known: {', '.join(REFS)})')
    ap.add_argument('--out', help='write the API-format graph here')
    ap.add_argument('--width', type=int, default=DEFAULT_WIDTH)
    ap.add_argument('--height', type=int, default=DEFAULT_HEIGHT)
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--prefix', default='plate', help='SaveImage filename_prefix')
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--url', default=DEFAULT_COMFY_URL, help='ComfyUI base URL (or $COMFY_URL)')
    ap.add_argument('--submit', action='store_true', help='POST /prompt. Costs API credits.')
    args = ap.parse_args()

    if not args.ref:
        raise SystemExit('error: at least one --ref (the previous page goes LAST)')
    if len(args.ref) > 10:
        raise SystemExit(f'error: the node takes at most 10 references, got {len(args.ref)}')

    megapixels = args.width * args.height / 1e6
    floor = MIN_MEGAPIXELS_4_0 if '4-0' in args.model else MIN_MEGAPIXELS
    if megapixels < floor:
        raise SystemExit(
            f'error: {args.width}x{args.height} is {megapixels:.2f} MP; {args.model} '
            f'rejects anything under {floor} MP'
        )

    prompt = read_prompt(args.prompt_file)
    refs = [(name, resolve_ref(name)) for name in args.ref]
    graph = build_api_graph(prompt, refs, args.width, args.height, args.model, args.prefix, args.seed)

    if args.out:
        os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
        with open(args.out, 'w', encoding='utf-8') as fh:
            fh.write(dumps(graph))
        print(f'→ {args.out} ({len(graph)} nodes)')
    elif not args.submit:
        print(dumps(graph), end='')

    print(f'model:  {args.model}')
    print(f'render: {args.width}x{args.height} ({megapixels:.2f} MP) → {PLATE_WIDTH}x{PLATE_HEIGHT}')
    print(f'prompt: {len(prompt)} chars')
    print(f'save:   {args.prefix}  (+ {args.prefix}-raw)')
    print('references, in Image order — put these in ComfyUI/input/ first:')
    for i, (alias, name) in enumerate(refs, start=1):
        print(f'  Image {i}: {alias:<8} {name}')

    if args.submit:
        submit(graph, args.url)
    else:
        print(f'\nnot submitted. Add --submit, or POST it yourself:')
        target = args.out or '<--out file>'
        print(f'  curl -s -X POST "{args.url}/prompt" -H \'Content-Type: application/json\' \\')
        print(f"    -d \"$(python3 -c 'import json,sys;print(json.dumps({{\"prompt\":json.load(open(sys.argv[1]))}}))' {target})\"")


if __name__ == '__main__':
    main()
