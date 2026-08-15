#!/usr/bin/env python3
"""Restyle a toon's existing plates into another toon's art style, page by page,
via the RunComfy model API (Seedream 5.0 Pro image-to-image).

Each source plate is sent as the first reference — the model is asked to keep
its panel layout, shot composition and character blocking and to change only
the rendering. Style references from the target book follow. Baked-in
lettering is banned in the prompt, so speech balloons and SFX painted into
legacy plates are dropped on the way through; words come back as FlipFrame
overlays from config.json.

  set -a; source .env; set +a

  # plan only, no credits spent
  python3 scripts/restyle-toon-plates.py --toon erin --pages 3,5 --dry-run

  # two test pages at 2K
  python3 scripts/restyle-toon-plates.py --toon erin --pages 3,5

  # the whole book, skipping anything already downloaded
  python3 scripts/restyle-toon-plates.py --toon erin --resume

Output goes to restyled/<toon>/page-NN-<srchash>.png (gitignored). Nothing is
uploaded and no config is rewritten — review the pages first, then:

  npm run watermark -- restyled/erin --backup
  make add-image SRC=restyled/erin/page-01-....png TOON=erin UPLOAD=1

Env:
  COMFY_API_KEY   required — RunComfy bearer token
  COMFY_API_URL   optional — defaults to https://model-api.runcomfy.net/v1
  VITE_ASSET_BASE required — source and style plates are pulled from R2
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

DEFAULT_BASE = 'https://model-api.runcomfy.net/v1'
DEFAULT_MODEL = 'bytedance/seedream-5.0-pro'
MODE = 'image-to-image'
POLL_SECONDS = 5
POLL_TIMEOUT = 900
TERMINAL_OK = {'completed'}
TERMINAL_BAD = {'cancelled', 'failed', 'error'}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# R2 key prefix per toon — the config only stores "assets/<hash>.jpg".
KEY_PREFIX = {
    'erin': 'toons/erin/assets',
    'erin-the-revenge': 'toons/erin-the-revenge/assets',
    'jax': 'toons/jax/assets',
    'nero': 'toons/nero/assets',
    'redsmile-static': 'toons/redsmile-static/assets',
}

# Erin EP 2 plates that carry the target look: black gutters, painterly
# grayscale render, deep blacks, volumetric rim light, dense backgrounds.
STYLE_REFS = {
    'erin-the-revenge': [
        'toons/erin-the-revenge/assets/874d3cb762df239a8666abc70e1268d4.jpg',
        'toons/erin-the-revenge/assets/521437fdaaea4a1461f725b790084603.jpg',
        'toons/erin-the-revenge/assets/32f49f480c564209399ef5c69ed30b29.jpg',
    ],
}

NO_TEXT = (
    'NO TEXT AT ALL: no speech balloons, no thought balloons, no shout bursts, no caption '
    'boxes, no narration plates, no onomatopoeia, no SFX lettering, no signage text, no title, '
    'no credits, no watermark, and no empty white balloon shapes reserved for text. If the '
    'source page has lettering or balloons painted into the art, remove them and paint the '
    'artwork that belongs underneath. Pure artwork only.'
)

PROMPT = f"""RESTYLE, DO NOT REDESIGN. Image 1 is the source page. Redraw it as a black and white \
dark-fantasy manga page, vertical 1152x1728, 2:3 portrait. Keep Image 1's panel count, panel \
shapes and stacking order, every character's pose, gesture, expression and screen position, the \
shot scale of each panel and the staging of the background exactly as they are. This is a \
repaint of the same page, not a new page.

CHANGE ONLY THE RENDERING, to match Images 2 and onward: painterly grayscale rendering with \
smooth tonal gradients instead of flat screentone dots, deep solid blacks holding most of the \
frame, dense fully rendered backgrounds with no blank white paper, volumetric light and a bright \
white rim glow separating figures from the dark, glossy highlights on skin and fabric, fine \
rendered detail in foliage, stone and cloth. High contrast, cinematic, moody.

PAGE FURNITURE: panels sit on a black page — black gutters and a black outer margin, thin bright \
keylines around each panel. No white page margin and no white gutters anywhere.

{NO_TEXT}

PIN identity from Image 1: same faces, same hair, same clothing, same number of characters in \
each panel. Erin keeps her short choppy dark bob with a straight fringe, large sharp eyes, black \
zip-up track jacket with a high collar, black trousers with a thin side stripe and black lace-up \
combat boots. Goblins stay hunched warty gremlins with long pointed ears and fanged grins. Two \
arms and two legs per figure. No colour anywhere."""


def api(base, path, token, payload=None, method=None):
    url = f"{base.rstrip('/')}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method or ('POST' if data else 'GET'))
    req.add_header('Authorization', f"Bearer {token}")
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code} on {method or 'GET'} {path}\n{e.read().decode(errors='replace')}")


def collect_urls(node, out):
    if isinstance(node, str):
        if node.startswith('http') and re.search(r'\.(png|jpe?g|webp)(\?|$)', node, re.I):
            out.append(node)
    elif isinstance(node, dict):
        for v in node.values():
            collect_urls(v, out)
    elif isinstance(node, list):
        for v in node:
            collect_urls(v, out)
    return out


def parse_pages(spec, total):
    """'3,5' or '1-9' or '3,7-9' -> sorted 1-based page numbers."""
    if not spec:
        return list(range(1, total + 1))
    out = set()
    for part in spec.split(','):
        part = part.strip()
        if '-' in part:
            a, b = part.split('-', 1)
            out.update(range(int(a), int(b) + 1))
        elif part:
            out.add(int(part))
    bad = [n for n in out if n < 1 or n > total]
    if bad:
        raise SystemExit(f"page(s) out of range 1-{total}: {sorted(bad)}")
    return sorted(out)


def restyle_page(base, token, args, src_url, style_urls, dest):
    prompt = PROMPT + (f"\n\n{args.prompt_extra}" if args.prompt_extra else '')
    payload = {
        'prompt': prompt,
        'image': [src_url] + style_urls,
        'resolution': args.resolution,
        'output_format': args.output_format,
    }
    path = f"/models/{args.model}/{MODE}"

    if args.dry_run:
        print(f"    POST {base.rstrip('/')}{path}  refs={len(payload['image'])} {args.resolution}")
        return None

    sub = api(base, path, token, payload)
    rid = sub.get('request_id') or sub.get('id')
    if not rid:
        raise SystemExit(f"no request_id in response:\n{json.dumps(sub, indent=2)[:800]}")

    deadline = time.time() + POLL_TIMEOUT
    state = None
    while time.time() < deadline:
        st = api(base, f"/requests/{rid}/status", token)
        new = (st.get('status') or st.get('state') or '').lower()
        if new != state:
            state = new
            print(f"    {state}")
        if state in TERMINAL_OK:
            break
        if state in TERMINAL_BAD:
            print(f"    job {state} — skipping (request_id {rid})", file=sys.stderr)
            return None
        time.sleep(POLL_SECONDS)
    else:
        print(f"    timed out after {POLL_TIMEOUT}s (request_id {rid})", file=sys.stderr)
        return None

    res = api(base, f"/requests/{rid}/result", token)
    sent = set(payload['image'])
    urls = [u for u in collect_urls(res, []) if u not in sent]
    if not urls:
        # /status can say "completed" while /result carries status=failed and an
        # error string — reference downloads time out on big files. Show it.
        err = res.get('error') or res.get('message')
        detail = f": {err}" if err else f" (request_id {rid})"
        print(f"    no output image{detail}", file=sys.stderr)
        return None

    with urllib.request.urlopen(urls[0], timeout=300) as r, open(dest, 'wb') as f:
        f.write(r.read())
    return dest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--toon', default='erin', help='toon whose pages are restyled')
    ap.add_argument('--style-toon', default='erin-the-revenge', help='toon supplying the target look')
    ap.add_argument('--pages', help='1-based page list, e.g. 3,5 or 1-9 (default: all)')
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--resolution', choices=['1K', '2K'], default='2K', help='2K ($0.10/image) keeps plate detail')
    ap.add_argument('--output-format', choices=['png', 'jpeg'], default='png')
    ap.add_argument('--out', help='output root, default restyled/<toon>')
    ap.add_argument('--style-refs', type=int, default=3,
                    help='how many style references to attach (default 3). Drop to 1 for '
                         'title/end cards — with three refs the model sometimes redraws a '
                         'reference instead of the source page')
    ap.add_argument('--identity-ref', action='append', default=[],
                    help='R2 key of a character sheet, attached right after the source so the '
                         'model has the canonical face to pin (repeatable). Identity drifts '
                         'fastest on single-figure pages — covers, end cards, splashes')
    ap.add_argument('--source-key',
                    help='R2 key to restyle instead of whatever the config points at. Needed to '
                         're-run a page that has already been wired — otherwise the source is the '
                         'previous restyle and the drift compounds. Single page only.')
    ap.add_argument('--prompt-extra',
                    help='sentence appended to the prompt for this run — use it to re-describe a '
                         'page the model keeps returning empty on')
    ap.add_argument('--resume', action='store_true', help='skip pages already downloaded')
    ap.add_argument('--dry-run', action='store_true', help='print the plan, submit nothing')
    args = ap.parse_args()

    token = os.environ.get('COMFY_API_KEY')
    if not token and not args.dry_run:
        raise SystemExit('COMFY_API_KEY missing — run: set -a; source .env; set +a')
    base = os.environ.get('COMFY_API_URL', DEFAULT_BASE)
    asset_base = os.environ.get('VITE_ASSET_BASE', '').rstrip('/')
    if not asset_base:
        raise SystemExit('VITE_ASSET_BASE missing — run: set -a; source .env; set +a')

    prefix = KEY_PREFIX.get(args.toon)
    if not prefix:
        raise SystemExit(f"unknown --toon {args.toon}; add its R2 prefix to KEY_PREFIX")
    style_keys = STYLE_REFS.get(args.style_toon)
    if not style_keys:
        raise SystemExit(f"no style references for --style-toon {args.style_toon}; add them to STYLE_REFS")
    # 0 is legitimate: the source plate is itself ref 1, and on pages the model
    # keeps mistaking for a comic page (title cards, character sheets) any
    # style ref at all gets redrawn in place of the source.
    style_urls = [f"{asset_base}/{k}" for k in style_keys][: max(0, args.style_refs)]
    # identity first: the sheet has to outrank the style pages, or a lone figure
    # comes back as somebody else wearing the right jacket.
    style_urls = [f"{asset_base}/{k.lstrip('/')}" for k in args.identity_ref] + style_urls

    config_path = os.path.join(ROOT, 'content', 'toons', args.toon, 'config.json')
    with open(config_path) as f:
        config = json.load(f)
    pages = config['pages']
    wanted = parse_pages(args.pages, len(pages))

    out_dir = os.path.abspath(args.out or os.path.join(ROOT, 'restyled', args.toon))
    if not args.dry_run:
        os.makedirs(out_dir, exist_ok=True)

    print(f"Restyle {args.toon} -> {args.style_toon} look  ({len(wanted)} page(s), {args.resolution})")
    print(f"  style refs: {len(style_urls)}")
    print(f"  output:     {os.path.relpath(out_dir, ROOT)}/\n")

    done = 0
    for n in wanted:
        page = pages[n - 1]
        name = page['file'].split('/')[-1]
        stem = os.path.splitext(name)[0]
        dest = os.path.join(out_dir, f"page-{n:02d}-{stem}.{args.output_format}")
        print(f"  {n:2}: {stem[:12]}")
        if args.resume and os.path.exists(dest):
            print('    already downloaded, skipping')
            continue
        src_url = (f"{asset_base}/{args.source_key.lstrip('/')}" if args.source_key
                   else f"{asset_base}/{prefix}/{name}")
        got = restyle_page(base, token, args, src_url, style_urls, dest)
        if got:
            print(f"    -> {os.path.relpath(got, ROOT)} ({os.path.getsize(got)} bytes)")
            done += 1

    if args.dry_run:
        print(f"\n[dry-run] {len(wanted)} page(s) would be submitted "
              f"(~${len(wanted) * (0.10 if args.resolution == '2K' else 0.05):.2f})")
        return
    print(f"\nDone: {done}/{len(wanted)} page(s) in {os.path.relpath(out_dir, ROOT)}/")
    print('Review, then:  npm run watermark -- restyled/%s --backup' % args.toon)


if __name__ == '__main__':
    main()
