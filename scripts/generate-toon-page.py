#!/usr/bin/env python3
"""Generate a toon page plate via the RunComfy model API (Seedream 5.0 Pro i2i).

Submits an asynchronous job, polls until it finishes, then downloads the
output next to the other generated art in ~/Downloads.

Usage:
  set -a; source .env; set +a

  # prompt from a /toon-page .txt (leading "# " header lines are stripped)
  python3 scripts/generate-toon-page.py --prompt-file ~/Downloads/toon-page-foo-20260802-010101.txt \
      --ref-asset toons/nero/assets/1b47ed56a7bf10c527e7b62ef3dd14ca.webp

  # inline prompt + explicit reference URLs
  python3 scripts/generate-toon-page.py --prompt "..." --ref https://example.com/ref.png

  # see the payload without spending credits
  python3 scripts/generate-toon-page.py --prompt-file … --ref-asset … --dry-run

References must be publicly fetchable HTTPS URLs (RunComfy pulls them
server-side). --ref-asset takes an R2 key and expands it against
VITE_ASSET_BASE, so any already-uploaded plate works as a reference:

  toons/nero/assets/<md5>.png  ->  $VITE_ASSET_BASE/toons/nero/assets/<md5>.png

Env:
  COMFY_API_KEY   required — RunComfy bearer token
  COMFY_API_URL   optional — defaults to https://model-api.runcomfy.net/v1
  VITE_ASSET_BASE required only when --ref-asset is used
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime

DEFAULT_BASE = 'https://model-api.runcomfy.net/v1'
DEFAULT_MODEL = 'bytedance/seedream-5.0-pro'
DEFAULT_MODE = 'image-to-image'
POLL_SECONDS = 5
POLL_TIMEOUT = 900
TERMINAL_OK = {'completed'}
TERMINAL_BAD = {'cancelled', 'failed', 'error'}


def api(base, path, token, payload=None, method=None):
    url = f"{base.rstrip('/')}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    verb = method or ('POST' if data else 'GET')
    req = urllib.request.Request(url, data=data, method=verb)
    req.add_header('Authorization', f"Bearer {token}")
    if data:
        req.add_header('Content-Type', 'application/json')
    # Status/result polls 504 when RunComfy is slow; the job is often still running.
    attempts = 6 if verb == 'GET' else 1
    last_err = None
    for i in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors='replace')
            last_err = f"HTTP {e.code} on {verb} {path}\n{body}"
            if verb != 'GET' or e.code not in (502, 503, 504) or i == attempts - 1:
                raise SystemExit(last_err)
            time.sleep(5 * (i + 1))
        except urllib.error.URLError as e:
            last_err = f"URL error on {verb} {path}: {e}"
            if verb != 'GET' or i == attempts - 1:
                raise SystemExit(last_err)
            time.sleep(5 * (i + 1))
    raise SystemExit(last_err)


def read_prompt(path):
    """Prompt body from a /toon-page .txt — drop the leading '# ' header block."""
    with open(os.path.expanduser(path)) as f:
        lines = f.read().splitlines()
    while lines and (lines[0].startswith('#') or not lines[0].strip()):
        lines.pop(0)
    text = '\n'.join(lines).strip()
    if not text:
        raise SystemExit(f"no prompt body left after stripping headers: {path}")
    return text


def slugify(text, default='page'):
    s = re.sub(r'[^a-z0-9]+', '-', text.lower()[:40]).strip('-')
    return re.sub(r'-{2,}', '-', s) or default


def collect_urls(node, out):
    """Result payloads vary in shape; pull every http(s) string we can find."""
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


def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--prompt')
    src.add_argument('--prompt-file')
    ap.add_argument('--ref', action='append', default=[], help='public HTTPS reference URL (repeatable)')
    ap.add_argument('--ref-asset', action='append', default=[], help='R2 key, expanded against VITE_ASSET_BASE (repeatable)')
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--mode', default=DEFAULT_MODE)
    ap.add_argument('--resolution', choices=['1K', '2K'], default='1K', help='1K bills $0.05/image (default), 2K $0.10')
    ap.add_argument(
        '--aspect-ratio',
        choices=['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
        default=None,
        help='output aspect_ratio (API default is 1:1 — omit this and you get a square)',
    )
    ap.add_argument('--output-format', choices=['png', 'jpeg'], default='png')
    ap.add_argument('--out-dir', default='~/Downloads')
    ap.add_argument('--slug', help='override the output filename slug')
    ap.add_argument('--dry-run', action='store_true', help='print the payload and exit — no job submitted')
    args = ap.parse_args()

    token = os.environ.get('COMFY_API_KEY')
    if not token and not args.dry_run:
        raise SystemExit('COMFY_API_KEY missing — run: set -a; source .env; set +a')
    base = os.environ.get('COMFY_API_URL', DEFAULT_BASE)

    prompt = args.prompt or read_prompt(args.prompt_file)

    refs = list(args.ref)
    if args.ref_asset:
        asset_base = os.environ.get('VITE_ASSET_BASE', '').rstrip('/')
        if not asset_base:
            raise SystemExit('--ref-asset needs VITE_ASSET_BASE in the environment')
        refs += [f"{asset_base}/{k.lstrip('/')}" for k in args.ref_asset]
    if not refs:
        raise SystemExit('image-to-image needs at least one --ref / --ref-asset')
    if len(refs) > 10:
        raise SystemExit(f"the model accepts at most 10 reference images, got {len(refs)}")

    words = len(prompt.split())
    if words > 600:
        print(f"! prompt is {words} words; over ~600 the model scatters detail and drops elements", file=sys.stderr)

    payload = {
        'prompt': prompt,
        'image': refs,
        'resolution': args.resolution,
        'output_format': args.output_format,
    }
    if args.aspect_ratio:
        payload['aspect_ratio'] = args.aspect_ratio
    path = f"/models/{args.model}/{args.mode}"

    if args.dry_run:
        print(f"POST {base.rstrip('/')}{path}")
        print(json.dumps(payload, indent=2)[:2000])
        return

    ratio = args.aspect_ratio or '1:1 (API default)'
    print(
        f"→ submit {args.model} {args.mode} "
        f"({len(refs)} ref(s), {words} words, {args.resolution} {ratio} {args.output_format})"
    )
    sub = api(base, path, token, payload)
    rid = sub.get('request_id') or sub.get('id')
    if not rid:
        raise SystemExit(f"no request_id in response:\n{json.dumps(sub, indent=2)[:1000]}")
    print(f"  request_id: {rid}")

    deadline = time.time() + POLL_TIMEOUT
    state = None
    while time.time() < deadline:
        st = api(base, f"/requests/{rid}/status", token)
        new = (st.get('status') or st.get('state') or '').lower()
        if new != state:
            state = new
            print(f"  {state}")
        if state in TERMINAL_OK:
            break
        if state in TERMINAL_BAD:
            raise SystemExit(f"job {state}:\n{json.dumps(st, indent=2)[:1000]}")
        time.sleep(POLL_SECONDS)
    else:
        raise SystemExit(f"timed out after {POLL_TIMEOUT}s — check /requests/{rid}/status")

    res = api(base, f"/requests/{rid}/result", token)
    # the result echoes the inputs, so drop anything we sent before picking the output
    urls = [u for u in collect_urls(res, []) if u not in set(refs)]
    if not urls:
        raise SystemExit(f"no output image URL in result:\n{json.dumps(res, indent=2)[:1500]}")
    if len(urls) > 1:
        print(f"! {len(urls)} candidate outputs, taking the first: {urls[0]}", file=sys.stderr)

    url = urls[0]
    out_dir = os.path.expanduser(args.out_dir)
    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    slug = args.slug or slugify(prompt)
    ext = re.search(r'\.(png|jpe?g|webp)', url, re.I)
    ext = ext.group(1).lower() if ext else args.output_format
    dest = os.path.join(out_dir, f"toon-gen-{slug}-{stamp}.{ext}")
    with urllib.request.urlopen(url, timeout=300) as r, open(dest, 'wb') as f:
        f.write(r.read())
    print(f"→ {dest} ({os.path.getsize(dest)} bytes)")

    print('\nNext:')
    print(f"  make add-image SRC={dest} TOON=nero UPLOAD=1")


if __name__ == '__main__':
    main()
