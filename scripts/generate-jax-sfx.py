#!/usr/bin/env python3
"""Generate Jax toon SFX clips via the ElevenLabs Sound Effects API.

Reads scripts/jax-sfx-manifest.json, calls POST /v1/sound-generation for
each entry, and writes the mp3 to public/toons/jax/assets/sfx/<slug>.mp3.
Skips slugs whose file already exists (idempotent, avoids re-spending
credits) unless --force is passed.

Usage:
  set -a; source .env; set +a
  python3 scripts/generate-jax-sfx.py [--force]
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "scripts", "jax-sfx-manifest.json")
OUT_DIR = os.path.join(ROOT, "public", "toons", "jax", "assets", "sfx")
API_URL = "https://api.elevenlabs.io/v1/sound-generation"


def main():
    force = "--force" in sys.argv
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("error: ELEVENLABS_API_KEY not set (source .env first)", file=sys.stderr)
        sys.exit(1)

    with open(MANIFEST) as f:
        items = json.load(f)

    os.makedirs(OUT_DIR, exist_ok=True)

    for item in items:
        slug = item["slug"]
        out_path = os.path.join(OUT_DIR, f"{slug}.mp3")
        if os.path.exists(out_path) and not force:
            print(f"skip  {slug} (exists)")
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

        with open(out_path, "wb") as f:
            f.write(audio)
        print(f"ok    {slug} ({len(audio)} bytes)")


if __name__ == "__main__":
    main()
