#!/usr/bin/env python3
"""Generate a one-off spoken voice line via the ElevenLabs Text-to-Speech API.

Unlike generate-jax-sfx.py (non-verbal SFX via the Sound Effects endpoint),
this hits POST /v1/text-to-speech/{voice_id} to get an actual spoken line —
use it for dialogue captions (variant "plain"/"ai" with real speech, not
onomatopoeia).

Usage:
  set -a; source .env; set +a
  python3 scripts/generate-jax-voice.py "Too slow, man!"                # default voice (jax)
  python3 scripts/generate-jax-voice.py "Get down!" --voice riu         # named voice from jax-voices.json
  python3 scripts/generate-jax-voice.py "..." --voice-id <raw voice id> # bypass the name map

Prints the output path and md5 hash; paste
  "audio": "assets/sfx/<hash>.mp3"
into the matching word entry in words.json yourself.

Voice names are locked in scripts/jax-voices.json (name -> ElevenLabs
voice_id) so the same character keeps the same voice across generations.
To add a new locked voice: open the voice on elevenlabs.io/app/voice-library,
copy its voiceId from the URL, add `"name": "voiceId"` to jax-voices.json.

Notes:
  - Listing voices (GET /v1/voices) needs a separate `voices_read` scope
    that isn't exposed as a simple toggle in the ElevenLabs key-permission
    UI; generation itself only needs "Text to Speech: Access". That's why
    voices are looked up by a locked ID here rather than by searching.
"""
import hashlib
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "toons", "jax", "assets", "sfx")
VOICES_FILE = os.path.join(ROOT, "scripts", "jax-voices.json")
DEFAULT_VOICE_NAME = "jax"


def load_voices():
    if os.path.exists(VOICES_FILE):
        with open(VOICES_FILE) as f:
            return json.load(f)
    return {}


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith("--"):
        print(
            'usage: generate-jax-voice.py "text" [--voice NAME] [--voice-id ID] [--stability N] [--similarity N]',
            file=sys.stderr,
        )
        sys.exit(1)

    voices = load_voices()
    text = args[0]
    voice_name = DEFAULT_VOICE_NAME
    voice_id = None
    stability = 0.45
    similarity = 0.8

    i = 1
    while i < len(args):
        if args[i] == "--voice":
            voice_name = args[i + 1]
            i += 2
        elif args[i] == "--voice-id":
            voice_id = args[i + 1]
            i += 2
        elif args[i] == "--stability":
            stability = float(args[i + 1])
            i += 2
        elif args[i] == "--similarity":
            similarity = float(args[i + 1])
            i += 2
        else:
            i += 1

    if voice_id is None:
        voice_id = voices.get(voice_name)
        if voice_id is None:
            print(
                f"error: unknown voice '{voice_name}' — known: {', '.join(voices) or '(none in jax-voices.json)'}",
                file=sys.stderr,
            )
            sys.exit(1)

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("error: ELEVENLABS_API_KEY not set (source .env first)", file=sys.stderr)
        sys.exit(1)

    body = json.dumps(
        {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": stability, "similarity_boost": similarity},
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        data=body,
        method="POST",
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            audio = resp.read()
    except urllib.error.HTTPError as e:
        print(f"FAIL: {e.code} {e.read().decode(errors='replace')}", file=sys.stderr)
        sys.exit(1)

    h = hashlib.md5(audio).hexdigest()
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{h}.mp3")
    with open(out_path, "wb") as f:
        f.write(audio)

    print(f"ok: {out_path} ({len(audio)} bytes) — voice={voice_name} ({voice_id})")
    print(f'  "audio": "assets/sfx/{h}.mp3"')


if __name__ == "__main__":
    main()
