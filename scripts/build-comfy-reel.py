#!/usr/bin/env python3
"""Render one ComfyUI graph for the vampire reel: subject generation + 3 clips.

The pipeline is `workflows/vampire-reel/README.md`; this script builds it as a
single API-format graph so a reel is one queue instead of five browser tabs:

    Seedream t2i (hero still)
        -> Seedream i2i (motion-safe still: hands pocketed, coat closed)
            -> i2v  shot 1  (approach)
            -> i2v  shot 2  (boots)
    LoadImage (close-up with fangs, made outside this graph)
            -> i2v  shot 3  (the look)

The i2v engine is `--engine` (default `hailuo`); see the ENGINES table.

`--join` adds the cut to the graph as well: the three clips are decoded to frames,
batched in order and re-encoded as one reel, so a run ends with `reel.mp4` and not
just three shots. It costs memory — 18s of 1080x1920 at 24fps is 432 frames held
as tensors, order-of-10GB at float32 — so it is off by default and `stitch.sh`
remains the cheap way to cut. Use whichever the machine can afford.

Prompts are read out of `workflows/vampire-reel/prompts/`, never inlined here —
same rule as `build-comfy-plate.py`. The `=== SHOT n ===` headers in
`04-shots.kling-i2v.txt` are what the shot prompts are keyed off, so editing that
file changes the graph.

Why shot 3's frame is loaded rather than generated: the close-up is an *edit*
(`03-closeup-fangs.edit.txt`), and the README is explicit that edit models —
Nano Banana, Flux.1 Kontext — hold a single identity through a crop-and-change
far better than Seedream does. Run that step in whatever tool has it, drop the
result into ComfyUI's `input/`, and pass `--closeup <file>`. Without it the graph
still builds and shot 3 starts from the motion-safe still, which is a worse
close-up but a runnable one.

    python3 scripts/build-comfy-reel.py --out workflows/vampire-reel/vampire-reel.api.json
    python3 scripts/build-comfy-reel.py --closeup closeup.png --submit

**Node and input names here are not guesses that pay off silently.** Video API
nodes get renamed between releases — Kling alone has moved through 2.0 / 2.6 /
3.0 / O3 — so the script queries `/object_info` and refuses to write a graph whose
classes or required inputs do not exist on the server. Without a reachable server
it writes the graph and says loudly that nothing was checked.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS = os.path.join(ROOT, 'workflows', 'vampire-reel', 'prompts')
DEFAULT_OUT = os.path.join(ROOT, 'workflows', 'vampire-reel', 'vampire-reel.api.json')
DEFAULT_COMFY_URL = os.environ.get('COMFY_URL', 'http://127.0.0.1:8188')

# Render AT delivery size. These stills exist to feed i2v and to be a poster
# frame for a Reel — 1080x1920 is what Instagram serves, and anything larger is
# re-encoded down by Instagram anyway, so the extra pixels buy nothing and cost
# credits.
#
# Two hard limits of the Seedream node, both learned the expensive way:
#   - minimum width 1024
#   - **maximum height 2496** — 2560 is rejected
# 1080x1920 sits inside both and is exactly 9:16, so no ImageScale is needed at
# all; the downscale nodes only appear if --render asks for something bigger.
RENDER_WIDTH = 1080
RENDER_HEIGHT = 1920
MIN_WIDTH = 1024
MAX_HEIGHT = 2496
DELIVER_WIDTH = 1080
DELIVER_HEIGHT = 1920
SEEDREAM_MODEL = 'seedream 5.0 pro'

ASPECT_RATIO = '9:16'
SEEDREAM_CLASS = 'ByteDanceSeedreamNodeV3'
SAVE_VIDEO_CLASS = 'SaveVideo'

# The i2v engine is a table, not a constant, because it is the thing most likely
# to change: video API nodes get renamed between releases and the shop keeps
# adding models. One entry per engine, `--engine` picks it, and every name in
# here is checked against /object_info before a graph is written.
#
# `inputs` maps this script's role -> that node's actual input name. `settings`
# is passed through verbatim. Numbers come from the README's "Settings that
# decide whether it works": cfg ~0.5 (0.3 lets the model drop the physics
# constraints, 0.7+ repaints the face), 5s, no end frame, quality mode not turbo.
ENGINES = {
    # Hailuo 02 (MiniMax). Two things about it are not interchangeable with Kling:
    #
    #   1. **No negative prompt.** The node takes prompt text only, so the
    #      README's negative block has nowhere to go — and it must NOT be pasted
    #      into the positive, where "motion blur, smearing, ghosting" reads as an
    #      instruction. What carries the same weight is the positive counterweight
    #      already at the end of every shot prompt: "crisp per-frame detail, fast
    #      shutter speed, sharp focus, stable geometry".
    #   2. **6s, not 5s.** Hailuo 02 offers 6 or 10 seconds; there is no 5. Three
    #      clips is an 18s reel rather than 15s, which is still inside Reels
    #      limits but changes the cut — stitch.sh does not retime, so the extra
    #      second lands on each shot's tail.
    #
    # It is the pick for slow subtle motion (a head turn, a push-in) and holds a
    # photoreal face better than anything here except Kling.
    'hailuo': {
        'class': 'MinimaxImageToVideoNode',
        'inputs': {'start': 'image', 'prompt': 'prompt_text', 'negative': None},
        'settings': {
            'model': 'MiniMax-Hailuo-02',
            'duration': 6,
            'resolution': '1080P',
            'prompt_optimizer': False,
        },
    },
    'kling': {
        'class': 'KlingImage2VideoNode',
        'inputs': {'start': 'start_frame', 'prompt': 'prompt', 'negative': 'negative_prompt'},
        'settings': {
            'cfg_scale': 0.5,
            'model_name': 'kling-v2-master',
            'aspect_ratio': ASPECT_RATIO,
            'duration': '5',
            'mode': 'pro',
        },
    },
}
DEFAULT_ENGINE = 'hailuo'


def read_prompt(name):
    """Prompt body with the `#` header stripped.

    The header names the model, the mode and which reference is which — notes to
    whoever runs the prompt, not instructions to the model. One roll went out
    with a header inside the prompt and the model read a note about its own
    output size.
    """
    path = os.path.join(PROMPTS, name)
    with open(path, encoding='utf-8') as fh:
        body = [line for line in fh if not line.startswith('#')]
    text = ''.join(body).strip()
    if not text:
        raise SystemExit(f'error: {path} has no prompt body (only # header lines)')
    return text


def read_shots():
    """The three shot prompts and the negative, out of 04-shots.kling-i2v.txt.

    Sections are `=== SHOT n — ... ===` and `=== NEGATIVE PROMPT ... ===`; the
    shot-3 addendum is appended to the negative for that clip only, which is what
    the file says to do with it.
    """
    path = os.path.join(PROMPTS, '04-shots.kling-i2v.txt')
    with open(path, encoding='utf-8') as fh:
        text = ''.join(line for line in fh if not line.startswith('#'))

    sections = {}
    current = None
    for line in text.splitlines():
        header = re.match(r'^===\s*(.+?)\s*===$', line.strip())
        if header:
            current = header.group(1).upper()
            sections[current] = []
            continue
        if current:
            sections[current].append(line)

    def find(pattern):
        for key, lines in sections.items():
            if re.search(pattern, key):
                body = '\n'.join(lines).strip()
                if body:
                    return body
        raise SystemExit(f'error: {path} has no section matching /{pattern}/')

    negative = find(r'^NEGATIVE PROMPT')
    shot3_extra = None
    for key, lines in sections.items():
        if 'SHOT 3 ONLY' in key:
            shot3_extra = '\n'.join(lines).strip()

    shots = []
    for n in (1, 2, 3):
        prompt = find(rf'^SHOT {n}\b(?!.*ONLY)')
        neg = negative
        if n == 3 and shot3_extra:
            neg = f'{negative}, {shot3_extra}'
        shots.append({'n': n, 'prompt': prompt, 'negative': neg})
    return shots


def dumps(obj):
    """JSON in the repo's prettier style — see build-comfy-plate.py."""

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


def build_graph(closeup, seed, engine_name, join, render=(RENDER_WIDTH, RENDER_HEIGHT)):
    engine = ENGINES[engine_name]
    rw, rh = render
    if rw < MIN_WIDTH:
        raise SystemExit(f'error: width {rw} is under the node minimum of {MIN_WIDTH}')
    if rh > MAX_HEIGHT:
        raise SystemExit(f'error: height {rh} is over the node maximum of {MAX_HEIGHT}')
    hero_prompt = read_prompt('01-hero-still.seedream.txt')
    safe_prompt = read_prompt('02b-motion-safe-still.seedream-i2i.txt')
    shots = read_shots()

    graph = {}
    nid = 0

    def nxt():
        nonlocal nid
        nid += 1
        return str(nid)

    def seedream(title, prompt, ref=None, seed_offset=0):
        node = nxt()
        inputs = {
            'prompt': prompt,
            'model': SEEDREAM_MODEL,
            'model.size_preset': 'Custom',
            'model.width': rw,
            'model.height': rh,
            'model.prompt_optimization': 'standard',
            'model.seed': seed + seed_offset,
            'model.watermark': False,
            'model.thinking': True,
        }
        if ref is not None:
            inputs['model.images.image_1'] = [ref, 0]
        graph[node] = {
            'class_type': SEEDREAM_CLASS,
            '_meta': {'title': title},
            'inputs': inputs,
        }
        return node

    def scale(title, src):
        node = nxt()
        graph[node] = {
            'class_type': 'ImageScale',
            '_meta': {'title': title},
            'inputs': {
                'image': [src, 0],
                'width': DELIVER_WIDTH,
                'height': DELIVER_HEIGHT,
                'upscale_method': 'lanczos',
                'crop': 'center',
            },
        }
        return node

    def save_image(title, src, prefix):
        node = nxt()
        graph[node] = {
            'class_type': 'SaveImage',
            '_meta': {'title': title},
            'inputs': {'images': [src, 0], 'filename_prefix': prefix},
        }
        return node

    needs_scale = (rw, rh) != (DELIVER_WIDTH, DELIVER_HEIGHT)

    hero = seedream('Seedream — hero still (t2i)', hero_prompt)
    hero_out = scale(f'Hero still -> {DELIVER_WIDTH}x{DELIVER_HEIGHT}', hero) if needs_scale else hero
    save_image('Save hero still (poster frame)', hero_out, 'vampire-reel/01-hero')

    # The motion-safe still is the one that feeds Kling: hands pocketed, coat
    # belted shut, no rings. It is a separate generation and not a crop, because
    # what it changes is what i2v would otherwise have to invent.
    safe = seedream('Seedream — motion-safe still (i2i)', safe_prompt, ref=hero, seed_offset=1)
    safe_out = scale(f'Motion-safe still -> {DELIVER_WIDTH}x{DELIVER_HEIGHT}', safe) if needs_scale else safe
    save_image('Save motion-safe still (i2v input, shots 1-2)', safe_out, 'vampire-reel/02b-motion-safe')

    if closeup:
        node = nxt()
        graph[node] = {
            'class_type': 'LoadImage',
            '_meta': {'title': 'Close-up with fangs (edit model, shot 3 input)'},
            'inputs': {'image': closeup},
        }
        shot3_start = node
    else:
        shot3_start = safe_out

    clips = []
    for shot in shots:
        start = shot3_start if shot['n'] == 3 else safe_out
        clip = nxt()
        names = engine['inputs']
        inputs = {
            names['start']: [start, 0],
            names['prompt']: shot['prompt'],
        }
        if names.get('negative'):
            inputs[names['negative']] = shot['negative']
        inputs.update(engine['settings'])
        graph[clip] = {
            'class_type': engine['class'],
            '_meta': {'title': f"{engine_name} i2v — shot {shot['n']}"},
            'inputs': inputs,
        }
        clips.append(clip)
        out = nxt()
        graph[out] = {
            'class_type': SAVE_VIDEO_CLASS,
            '_meta': {'title': f"Save shot {shot['n']}"},
            'inputs': {
                'video': [clip, 0],
                'filename_prefix': f"vampire-reel/shot-{shot['n']}",
                'format': 'mp4',
                'codec': 'h264',
            },
        }

    # The three shots always save individually — a reel is re-cut far more often
    # than it is re-generated, and one bad take should not cost the other two.
    if join:
        # Core nodes only, same rule as the Rec.709 flatten in build-comfy-plate:
        # there is no "concat videos" node in ComfyUI, so the clips are decoded to
        # image batches, batched together, and re-encoded as one video.
        frames = []
        for clip in clips:
            node = nxt()
            graph[node] = {
                'class_type': 'GetVideoComponents',
                '_meta': {'title': f'Frames of shot {len(frames) + 1}'},
                'inputs': {'video': [clip, 0]},
            }
            frames.append(node)

        joined = None
        for idx, node in enumerate(frames):
            if joined is None:
                joined = (node, 0)
                continue
            batch = nxt()
            graph[batch] = {
                'class_type': 'ImageBatch',
                '_meta': {'title': f'Join shots 1-{idx + 1}'},
                'inputs': {'image1': list(joined), 'image2': [node, 0]},
            }
            joined = (batch, 0)

        reel = nxt()
        graph[reel] = {
            'class_type': 'CreateVideo',
            '_meta': {'title': 'Reel — three shots in order'},
            # fps comes off shot 1 rather than being asserted: Hailuo delivers 24
            # and Kling 30, and inventing a rate here is what stitch.sh had to
            # stop doing.
            'inputs': {'images': list(joined), 'fps': [frames[0], 2]},
        }
        out = nxt()
        graph[out] = {
            'class_type': SAVE_VIDEO_CLASS,
            '_meta': {'title': 'Save reel'},
            'inputs': {
                'video': [reel, 0],
                'filename_prefix': 'vampire-reel/reel',
                'format': 'mp4',
                'codec': 'h264',
            },
        }
    return graph


def verify(graph, url):
    """Check every class and required input against the live server.

    Returns a list of complaints, or None when the server could not be reached.
    A hosted API node reports a bad input as a BadRequest hours later, once the
    credits are spent, so this runs before anything is written.
    """
    try:
        with urllib.request.urlopen(f'{url}/object_info', timeout=8) as fh:
            info = json.load(fh)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return None

    problems = []
    for node_id, node in graph.items():
        cls = node['class_type']
        spec = info.get(cls)
        if spec is None:
            close = sorted(k for k in info if k.lower().startswith(cls[:5].lower()))
            hint = f' — similar on this server: {', '.join(close[:6])}' if close else ''
            problems.append(f'node {node_id}: no such class "{cls}"{hint}')
            continue
        declared = set()
        for group in ('required', 'optional'):
            declared |= set((spec.get('input') or {}).get(group, {}))
        # Dotted keys are how the Seedream node exposes its nested model config;
        # object_info reports the parent, not the leaves.
        unknown = sorted(k for k in node['inputs'] if k.split('.')[0] not in declared)
        if unknown:
            problems.append(f'node {node_id} ({cls}): unknown input(s) {', '.join(unknown)}; declared: {', '.join(sorted(declared))}')
        missing = sorted(k for k in (spec.get('input') or {}).get('required', {}) if k not in node['inputs'] and not any(i.startswith(k + '.') for i in node['inputs']))
        if missing:
            problems.append(f'node {node_id} ({cls}): missing required input(s) {', '.join(missing)}')
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=DEFAULT_OUT, help='write the API-format graph here')
    ap.add_argument('--closeup', help="ComfyUI input/ filename of the edit-model close-up (shot 3's start frame)")
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--render', default=f'{RENDER_WIDTH}x{RENDER_HEIGHT}',
                    help=f'still render size, WxH (min width {MIN_WIDTH}, max height {MAX_HEIGHT}); larger than {DELIVER_WIDTH}x{DELIVER_HEIGHT} adds an ImageScale')
    ap.add_argument('--engine', default=DEFAULT_ENGINE, choices=sorted(ENGINES), help='image-to-video engine (see ENGINES)')
    ap.add_argument('--join', action='store_true', help='also concatenate the three clips into one reel in-graph (memory-hungry, see --help notes)')
    ap.add_argument('--url', default=DEFAULT_COMFY_URL, help='ComfyUI base URL (or $COMFY_URL)')
    ap.add_argument('--skip-verify', action='store_true', help='do not check node names against /object_info')
    ap.add_argument('--submit', action='store_true', help='POST /prompt. Costs API credits.')
    args = ap.parse_args()

    try:
        rw, rh = (int(v) for v in args.render.lower().split('x'))
    except ValueError:
        raise SystemExit(f'error: --render wants WxH, got "{args.render}"')
    graph = build_graph(args.closeup, args.seed, args.engine, args.join, (rw, rh))

    if args.skip_verify:
        print('! not verified against a server (--skip-verify)', file=sys.stderr)
    else:
        problems = verify(graph, args.url)
        if problems is None:
            print(f'! {args.url} unreachable: node and input names are UNVERIFIED.', file=sys.stderr)
            print('! Start ComfyUI and re-run before submitting — the Kling node has been', file=sys.stderr)
            print('! renamed across versions and a hosted node bills before it complains.', file=sys.stderr)
        elif problems:
            print('error: graph does not match this server:', file=sys.stderr)
            for p in problems:
                print(f'  {p}', file=sys.stderr)
            raise SystemExit(1)
        else:
            print(f'verified against {args.url}: every class and input exists')

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as fh:
        fh.write(dumps(graph))

    print(f'wrote {os.path.relpath(args.out, ROOT)}  ({len(graph)} nodes)')
    if (rw, rh) == (DELIVER_WIDTH, DELIVER_HEIGHT):
        print(f'  stills      {rw}x{rh} (delivery size, no downscale)')
    else:
        print(f'  stills      {rw}x{rh} -> {DELIVER_WIDTH}x{DELIVER_HEIGHT}')
    eng = ENGINES[args.engine]
    print(f"  3 clips     {args.engine}: {eng['class']}, " + ', '.join(f'{k} {v}' for k, v in eng['settings'].items()))
    if args.join:
        print('  reel        three clips joined in-graph -> vampire-reel/reel')
    if args.closeup:
        print(f'  shot 3 from {args.closeup}')
    else:
        print('  shot 3 from the motion-safe still — pass --closeup for the fanged close-up')

    if not args.submit:
        print('\nnot submitted. Add --submit, or POST it yourself:')
        print(f'  curl -s -X POST "{args.url}/prompt" -H \'Content-Type: application/json\' \\')
        print(f'    -d "$(python3 -c \'import json,sys;print(json.dumps({{"prompt":json.load(open(sys.argv[1]))}}))\' {args.out})"')
        return

    payload = json.dumps({'prompt': graph}).encode()
    req = urllib.request.Request(f'{args.url}/prompt', data=payload, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as fh:
            print('queued:', json.load(fh).get('prompt_id'))
    except urllib.error.HTTPError as err:
        raise SystemExit(f'submit failed: HTTP {err.code} {err.read().decode(errors='replace')[:400]}')
    except urllib.error.URLError as err:
        raise SystemExit(f'submit failed: {err.reason}')


if __name__ == '__main__':
    main()
