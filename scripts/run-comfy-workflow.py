#!/usr/bin/env python3
"""Run the Nero plate workflow on a RunComfy serverless deployment.

Sibling to generate-toon-page.py, which calls the *model API*
(model-api.runcomfy.net) and runs Seedream on its own. This one drives a
deployed **ComfyUI workflow** (api.runcomfy.net), so the graph's extra steps —
tone match against the previous page, greyscale flatten — happen server-side
too, and the plate comes back ready to swap in.

Deploy once (Deployments -> "Deploy workflow as API", upload
workflows/nero-seedream.api.json), copy the deployment id, then:

  set -a; source .env; set +a

  python3 scripts/run-comfy-workflow.py \\
      --prompt-file ~/Downloads/toon-page-nero-25-....txt \\
      --ref-prev-asset toons/nero/assets/<md5>.webp

  # explicit references, fixed seed, harder histogram match
  python3 scripts/run-comfy-workflow.py --prompt-file … \\
      --ref-nero https://…/nero-sheet.png \\
      --ref-eve  https://…/eve-sheet.png \\
      --ref-prev https://…/page24.webp \\
      --seed 12345 --method hm

  # show the payload, spend nothing
  python3 scripts/run-comfy-workflow.py --prompt-file … --dry-run

References must be publicly fetchable HTTPS URLs — RunComfy pulls them
server-side. The --ref-*-asset flags take an R2 key and expand it against
VITE_ASSET_BASE, so any published plate works as-is.

Env:
  COMFY_API_KEY        required — RunComfy bearer token (Profile page)
  RUNCOMFY_DEPLOYMENT  required unless --deployment is passed
  RUNCOMFY_API_URL     optional — defaults to https://api.runcomfy.net/prod/v2
  VITE_ASSET_BASE      required only for the --ref-*-asset flags

Node ids come from workflows/nero-seedream.api.json. Re-number the graph and
these break — keep NODES in step with the file.
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

DEFAULT_BASE = 'https://api.runcomfy.net/prod/v2'
POLL_SECONDS = 5
POLL_TIMEOUT = 900

# node ids in workflows/nero-seedream.api.json
NODES = {
    'ref_nero': '1',
    'ref_eve': '2',
    'ref_prev': '3',
    'seedream': '6',
    'colormatch': '10',
}


def die(msg):
    print(f'error: {msg}', file=sys.stderr)
    sys.exit(1)


def read_prompt(path):
    text = open(os.path.expanduser(path), encoding='utf-8').read()
    # strip the "# model: …" header the /toon-page skill writes
    body = '\n'.join(ln for ln in text.splitlines() if not ln.startswith('# '))
    body = body.strip()
    if not body:
        die(f'no prompt body in {path}')
    return body


def asset_url(key):
    base = os.environ.get('VITE_ASSET_BASE', '').rstrip('/')
    if not base:
        die('VITE_ASSET_BASE is required for --ref-*-asset (or pass a full URL)')
    return f"{base}/{key.lstrip('/')}"


def request(url, token, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f'Bearer {token}')
    if data:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors='replace')[:400]
        die(f'{method} {url} -> {e.code} {detail}')


def main():
    ap = argparse.ArgumentParser(description='Run the Nero workflow on a RunComfy deployment.')
    ap.add_argument('--prompt-file', required=True, help='.txt from the /toon-page skill')
    ap.add_argument('--deployment', default=os.environ.get('RUNCOMFY_DEPLOYMENT'))
    ap.add_argument('--ref-nero', help='Nero character sheet URL')
    ap.add_argument('--ref-eve', help='Eve character sheet URL')
    ap.add_argument('--ref-prev', help='previous page URL')
    ap.add_argument('--ref-nero-asset', help='R2 key for the Nero sheet')
    ap.add_argument('--ref-eve-asset', help='R2 key for the Eve sheet')
    ap.add_argument('--ref-prev-asset', help='R2 key for the previous page')
    ap.add_argument('--seed', type=int, help='Seedream seed (default: leave the graph value)')
    ap.add_argument('--method', choices=['mkl', 'hm', 'reinhard', 'mvgd', 'hm-mvgd-hm', 'hm-mkl-hm'],
                    help='ColorMatch method override')
    ap.add_argument('--out-dir', default=os.path.expanduser('~/Downloads'))
    ap.add_argument('--dry-run', action='store_true', help='print the payload and exit')
    args = ap.parse_args()

    token = os.environ.get('COMFY_API_KEY')
    if not token and not args.dry_run:
        die('COMFY_API_KEY not set (source .env first)')
    if not args.deployment and not args.dry_run:
        die('pass --deployment or set RUNCOMFY_DEPLOYMENT')

    overrides = {NODES['seedream']: {'inputs': {'prompt': read_prompt(args.prompt_file)}}}
    if args.seed is not None:
        overrides[NODES['seedream']]['inputs']['seed'] = args.seed
    if args.method:
        overrides[NODES['colormatch']] = {'inputs': {'method': args.method}}

    for name in ('nero', 'eve', 'prev'):
        url = getattr(args, f'ref_{name}')
        key = getattr(args, f'ref_{name}_asset')
        if key:
            url = asset_url(key)
        if url:
            overrides[NODES[f'ref_{name}']] = {'inputs': {'image': url}}

    payload = {'overrides': overrides}
    if args.dry_run:
        print(json.dumps(payload, indent=2, ensure_ascii=False)[:4000])
        print('\n[dry-run] nothing submitted')
        return 0

    base = os.environ.get('RUNCOMFY_API_URL', DEFAULT_BASE).rstrip('/')
    dep = f'{base}/deployments/{args.deployment}'

    print(f'→ submitting to {args.deployment}')
    sub = request(f'{dep}/inference', token, 'POST', payload)
    rid = sub.get('request_id') or die(f'no request_id in response: {sub}')
    print(f'  request {rid}')

    started = time.time()
    while True:
        st = request(f'{dep}/requests/{rid}/status', token)
        state = st.get('status', '?')
        if state in ('completed', 'succeeded', 'failed', 'cancelled', 'error'):
            break
        if time.time() - started > POLL_TIMEOUT:
            die(f'timed out after {POLL_TIMEOUT}s (last status: {state})')
        pos = st.get('queue_position')
        print(f'  {state}' + (f' (queue {pos})' if pos is not None else ''))
        time.sleep(POLL_SECONDS)

    if state in ('failed', 'cancelled', 'error'):
        die(f'run {state}: {json.dumps(st)[:400]}')

    res = request(f'{dep}/requests/{rid}/result', token)
    urls = []
    for node_out in (res.get('outputs') or {}).values():
        for item in node_out.get('images', []):
            if item.get('url'):
                urls.append(item['url'])
    if not urls:
        die(f'no images in result: {json.dumps(res)[:400]}')

    os.makedirs(args.out_dir, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    saved = []
    for i, url in enumerate(urls, 1):
        ext = os.path.splitext(url.split('?')[0])[1] or '.png'
        suffix = '' if len(urls) == 1 else f'-{i}'
        dest = os.path.join(args.out_dir, f'nero-plate-{stamp}{suffix}{ext}')
        urllib.request.urlretrieve(url, dest)
        saved.append(dest)
        print(f'→ {dest}')

    print('\nNext: node scripts/swap-toon-page.js '
          f'{saved[0]} --toon nero --page <N> --publish')
    print('  (the graph already flattened the colour cast)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
