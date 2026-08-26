#!/usr/bin/env python3
"""Named place-reverb types for toon caption audio.

A caption says *where it sounds*, not how ffmpeg is wired. Types live in
`scripts/reverb-types.json`. Config resolution (word > page > book):

  { "reverb": "plaza", "pages": [ { "reverb": "plaza-deep", "words": [...] } ] }

`"none"` (or empty) skips. generate-jax-voice.py applies the resolved type
after TTS so a --from-config run matches the courtyard without a second pass.

Usage:
  python3 scripts/reverb.py --list
  python3 scripts/reverb.py --resolve --toon erin-the-revenge --page 19
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TYPES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reverb-types.json')
NONE_NAMES = {None, '', 'none', 'off', False}


def load_types():
    with open(TYPES_FILE) as f:
        data = json.load(f)
    if not isinstance(data, dict) or not data:
        raise ValueError(f"no reverb types in {TYPES_FILE}")
    return data


def resolve_reverb(cfg=None, page=None, word=None, override=None):
    """Return a type name, or None to leave the clip dry.

    `override` (CLI --reverb) wins. Then word, then page, then book.
    """
    if override is not None:
        name = override
    elif word is not None and 'reverb' in word:
        name = word.get('reverb')
    elif page is not None and 'reverb' in page:
        name = page.get('reverb')
    else:
        name = (cfg or {}).get('reverb')

    if name in NONE_NAMES:
        return None
    name = str(name).strip()
    if not name or name.lower() in ('none', 'off'):
        return None
    types = load_types()
    if name not in types:
        known = ', '.join(sorted(types))
        raise ValueError(f"unknown reverb type {name!r} — known: {known}")
    if 'filter' not in types[name]:
        raise ValueError(f"reverb type {name!r} has no filter")
    return name


def apply_reverb_file(src_path, type_name, *, replace=True):
    """Run the type's ffmpeg chain; write `<md5>.mp3` next to the source.

    Returns (new_hash, dest_path). Deletes `src_path` when `replace` and the
    hash changed (dry TTS should not stay beside the wet clip).
    """
    types = load_types()
    if type_name not in types:
        known = ', '.join(sorted(types))
        raise ValueError(f"unknown reverb type {type_name!r} — known: {known}")
    af = types[type_name]['filter']
    src_path = os.path.abspath(src_path)
    tmp = src_path + '.reverb-tmp.mp3'
    cmd = [
        'ffmpeg',
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        src_path,
        '-af',
        af,
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '192k',
        tmp,
    ]
    try:
        subprocess.check_call(cmd)
    except FileNotFoundError:
        raise SystemExit('error: ffmpeg not found (needed for place reverb)')
    except subprocess.CalledProcessError as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise SystemExit(f"error: ffmpeg reverb {type_name!r} failed ({e.returncode})")

    with open(tmp, 'rb') as f:
        data = f.read()
    new_hash = hashlib.md5(data).hexdigest()
    dest = os.path.join(os.path.dirname(src_path), f"{new_hash}.mp3")
    os.replace(tmp, dest)
    if replace and os.path.abspath(src_path) != dest and os.path.exists(src_path):
        os.remove(src_path)
    return new_hash, dest


def _cli(argv):
    types = load_types()
    if '--list' in argv or not argv:
        for name, spec in sorted(types.items()):
            label = spec.get('label') or ''
            print(f"{name}\t{label}")
        return 0
    if '--resolve' in argv:
        toon = None
        page_n = None
        i = 0
        while i < len(argv):
            if argv[i] == '--toon':
                toon = argv[i + 1]
                i += 2
            elif argv[i] == '--page':
                page_n = int(argv[i + 1])
                i += 2
            else:
                i += 1
        if not toon:
            print('error: --resolve needs --toon', file=sys.stderr)
            return 1
        cfg_path = os.path.join(ROOT, 'content', 'toons', toon, 'config.json')
        with open(cfg_path) as f:
            cfg = json.load(f)
        page = None
        if page_n:
            pages = cfg.get('pages') or []
            if page_n < 1 or page_n > len(pages):
                print(f"error: page {page_n} out of range", file=sys.stderr)
                return 1
            page = pages[page_n - 1]
        print(resolve_reverb(cfg, page) or 'none')
        return 0
    print('usage: reverb.py --list | --resolve --toon TOON [--page N]', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(_cli(sys.argv[1:]))
