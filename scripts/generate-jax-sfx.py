#!/usr/bin/env python3
"""Generate Jax toon SFX clips via the ElevenLabs Sound Effects API.

Reads scripts/jax-sfx-manifest.json, calls POST /v1/sound-generation for
each entry, and writes the mp3 to public/toons/jax/assets/sfx/<md5>.mp3 —
files are named by content hash (site convention), not by slug. A lockfile
(scripts/jax-sfx-lock.json) maps slug -> hash so re-runs can skip slugs
already generated (idempotent, avoids re-spending credits) unless --force
is passed.

After generating, update the matching "audio" field(s) in words.json to
"assets/sfx/<hash>.mp3" for any new/changed slug (the script prints exactly
which slugs changed).

Usage:
  set -a; source .env; set +a
  python3 scripts/generate-jax-sfx.py [--force]
"""
import hashlib
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "scripts", "jax-sfx-manifest.json")
LOCKFILE = os.path.join(ROOT, "scripts", "jax-sfx-lock.json")
OUT_DIR = os.path.join(ROOT, "public", "toons", "jax", "assets", "sfx")
API_URL = "https://api.elevenlabs.io/v1/sound-generation"


def load_lock():
    if os.path.exists(LOCKFILE):
        with open(LOCKFILE) as f:
            return json.load(f)
    return {}


def save_lock(lock):
    with open(LOCKFILE, "w") as f:
        json.dump(lock, f, indent=2, sort_keys=True)
        f.write("\n")


def main():
    force = "--force" in sys.argv
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("error: ELEVENLABS_API_KEY not set (source .env first)", file=sys.stderr)
        sys.exit(1)

    with open(MANIFEST) as f:
        items = json.load(f)

    os.makedirs(OUT_DIR, exist_ok=True)
    lock = load_lock()
    changed = []

    for item in items:
        slug = item["slug"]
        prior_hash = lock.get(slug)
        if prior_hash and not force and os.path.exists(os.path.join(OUT_DIR, f"{prior_hash}.mp3")):
            print(f"skip  {slug} (exists as {prior_hash}.mp3)")
            continue

        body = json.dumps(
            {
                "text": item["prompt"],
                "duration_seconds": item["duration"],
                "prompt_influence": 0.4,
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            API_URL,
            data=body,
            method="POST",
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                audio = resp.read()
        except urllib.error.HTTPError as e:
            print(f"FAIL  {slug}: {e.code} {e.read().decode(errors='replace')}", file=sys.stderr)
            continue

        new_hash = hashlib.md5(audio).hexdigest()
        out_path = os.path.join(OUT_DIR, f"{new_hash}.mp3")
        with open(out_path, "wb") as f:
            f.write(audio)

        if prior_hash and prior_hash != new_hash:
            old_path = os.path.join(OUT_DIR, f"{prior_hash}.mp3")
            if os.path.exists(old_path):
                os.remove(old_path)

        lock[slug] = new_hash
        changed.append((slug, new_hash))
        print(f"ok    {slug} -> {new_hash}.mp3 ({len(audio)} bytes)")

    save_lock(lock)

    if changed:
        print("\nUpdate words.json audio fields for:")
        for slug, h in changed:
            print(f'  {slug}: "assets/sfx/{h}.mp3"')


if __name__ == "__main__":
    main()
