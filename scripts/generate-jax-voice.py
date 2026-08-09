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
  python3 scripts/generate-jax-voice.py "..." --voice eve --toon nero   # write under public/toons/nero/
  # Emotional delivery (Eleven v3 audio tags only — ignored on multilingual_v2):
  python3 scripts/generate-jax-voice.py "[scared] Nero—!" --voice eve --toon nero --model eleven_v3

Prints the output path and md5 hash; paste
  "audio": "assets/sfx/<hash>.mp3"
into the matching word entry in words.json yourself.

Audio tags ([scared], [worried], [gasps], [whispers], …) require
`--model eleven_v3`. See ElevenLabs docs: Text to Speech → Best practices
→ Prompting Eleven v3 → Audio tags.

`--toon` picks the output directory. It matters: captions resolve audio
through the reader's `asset-page-dir`, so a Nero clip written under jax/
uploads to the wrong R2 key and 404s in the reader.

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
VOICES_FILE = os.path.join(ROOT, 'scripts', 'jax-voices.json')
DEFAULT_VOICE_NAME = 'jax'
DEFAULT_TOON = 'jax'


def out_dir_for(toon):
    """Clips must live under the toon that plays them — `asset-page-dir` is what
    resolves "assets/sfx/<hash>.mp3" on the CDN, so a Nero line parked in jax/
    404s there."""
    return os.path.join(ROOT, 'public', 'toons', toon, 'assets', 'sfx')


def load_voices():
    if os.path.exists(VOICES_FILE):
        with open(VOICES_FILE) as f:
            return json.load(f)
    return {}


def main():
    args = sys.argv[1:]
    if not args or args[0].startswith('--'):
        print(
            'usage: generate-jax-voice.py "text" [--voice NAME] [--voice-id ID] [--toon TOON] '
            '[--model MODEL] [--stability N] [--similarity N]',
            file=sys.stderr,
        )
        sys.exit(1)

    voices = load_voices()
    text = args[0]
    voice_name = DEFAULT_VOICE_NAME
    voice_id = None
    toon = DEFAULT_TOON
    # multilingual_v2 for plain dialogue; eleven_v3 when using [audio tags]
    model_id = 'eleven_multilingual_v2'
    stability = 0.45
    similarity = 0.8

    i = 1
    while i < len(args):
        if args[i] == '--voice':
            voice_name = args[i + 1]
            i += 2
        elif args[i] == '--voice-id':
            voice_id = args[i + 1]
            i += 2
        elif args[i] == '--toon':
            toon = args[i + 1]
            i += 2
        elif args[i] == '--model':
            model_id = args[i + 1]
            i += 2
        elif args[i] == '--stability':
            stability = float(args[i + 1])
            i += 2
        elif args[i] == '--similarity':
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

    api_key = os.environ.get('ELEVENLABS_API_KEY')
    if not api_key:
        print('error: ELEVENLABS_API_KEY not set (source .env first)', file=sys.stderr)
        sys.exit(1)

    body = json.dumps(
        {
            'text': text,
            'model_id': model_id,
            'voice_settings': {'stability': stability, 'similarity_boost': similarity},
        }
    ).encode('utf-8')

    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        data=body,
        method='POST',
        headers={'xi-api-key': api_key, 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            audio = resp.read()
    except urllib.error.HTTPError as e:
        print(f"FAIL: {e.code} {e.read().decode(errors='replace')}", file=sys.stderr)
        sys.exit(1)

    h = hashlib.md5(audio).hexdigest()
    out_dir = out_dir_for(toon)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{h}.mp3")
    with open(out_path, 'wb') as f:
        f.write(audio)

    print(
        f"ok: {out_path} ({len(audio)} bytes) — voice={voice_name} ({voice_id}) "
        f"toon={toon} model={model_id}"
    )
    print(f'  "audio": "assets/sfx/{h}.mp3"')


if __name__ == '__main__':
    main()
