#!/usr/bin/env python3
"""Normalise a toon's caption audio to EBU R128 with a true-peak ceiling.

ElevenLabs returns wildly inconsistent levels — HUD readouts land ~9 dB under
dialogue, and generated SFX regularly peak above 0 dBFS (measured up to
+2.4 dBTP), which clips on playback. This runs a two-pass `loudnorm` over every
clip a config references, rewrites `audio` to the new content hash, and drops
the superseded local files.

  python3 scripts/normalise-toon-audio.py jax
  python3 scripts/normalise-toon-audio.py jax nero redsmile-static
  python3 scripts/normalise-toon-audio.py jax --dry-run
  python3 scripts/normalise-toon-audio.py jax --voice -18 --sfx -15 --tp -1.5

Voices sit 3 dB under the SFX on purpose, so onomatopoeia still punch while
dialogue stays even. Both share the true-peak ceiling.

Two-pass means measure first, then apply with `measured_*` + `linear=true`, so
the gain is a single linear move rather than a dynamic one — no pumping, and
the relative dynamics inside a clip survive.

After running:
  npm run upload-assets
  npm run publish-toon-config -- --toon <toon>
"""
import argparse
import collections
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# A word is a "voice" if it speaks: dialogue bubbles, HUD readouts, credits, or
# anything carrying a `speaker`. Everything else is onomatopoeia.
VOICE_VARIANTS = {'bubble', 'thought', 'ai', 'badai', 'credit'}


def config_path(toon):
    return os.path.join(ROOT, 'content', 'toons', toon, 'config.json')


def toon_root(toon):
    return os.path.join(ROOT, 'public', 'toons', toon)


def classify(word):
    if word.get('speaker'):
        return 'voice'
    return 'voice' if word.get('variant') in VOICE_VARIANTS else 'sfx'


def measure(path, target_i, tp):
    """First pass — returns loudnorm's JSON stats, or None if it could not read."""
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af',
         f"loudnorm=I={target_i}:TP={tp}:LRA=11:print_format=json", '-f', 'null', '/dev/null'],
        capture_output=True, text=True).stderr
    m = re.search(r'\{[^{]*"input_i".*?\}', out, re.S)
    return json.loads(m.group(0)) if m else None


def normalise(toon, targets, tp, dry_run=False):
    cfg_path = config_path(toon)
    if not os.path.exists(cfg_path):
        print(f"error: no config at {os.path.relpath(cfg_path, ROOT)}", file=sys.stderr)
        return 1
    data = json.load(open(cfg_path))
    root = toon_root(toon)

    # A clip shared between a voice and an SFX word is treated as a voice.
    kind = {}
    for page in data['pages']:
        for word in page.get('words', []):
            rel = word.get('audio')
            if not rel:
                continue
            k = classify(word)
            kind[rel] = 'voice' if kind.get(rel) == 'voice' or k == 'voice' else k

    mapping, report, missing = {}, [], []
    for rel, k in sorted(kind.items()):
        src = os.path.join(root, rel)
        if not os.path.exists(src):
            missing.append(rel)
            continue
        target_i = targets[k]
        stats = measure(src, target_i, tp)
        if not stats:
            print(f"  measure failed: {rel}", file=sys.stderr)
            continue
        report.append((k, float(stats['input_i']), float(stats['input_tp'])))
        if dry_run:
            continue
        af = (
            f"loudnorm=I={target_i}:TP={tp}:LRA=11:"
            f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:"
            f"measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:"
            f"offset={stats['target_offset']}:linear=true"
        )
        tmp = '/tmp/normalise-toon-audio.mp3'
        subprocess.run(
            ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', af,
             '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '192k', tmp], check=True)
        digest = hashlib.md5(open(tmp, 'rb').read()).hexdigest()
        os.replace(tmp, os.path.join(root, 'assets', 'sfx', f"{digest}.mp3"))
        mapping[rel] = f"assets/sfx/{digest}.mp3"

    words = 0
    if not dry_run:
        for page in data['pages']:
            for word in page.get('words', []):
                if word.get('audio') in mapping:
                    word['audio'] = mapping[word['audio']]
                    words += 1
        with open(cfg_path, 'w') as f:
            f.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
        # superseded clips: only drop what nothing points at any more
        still = {w.get('audio') for p in data['pages'] for w in p.get('words', []) if w.get('audio')}
        for old in mapping:
            path = os.path.join(root, old)
            if old not in still and os.path.exists(path):
                os.remove(path)

    grouped = collections.defaultdict(list)
    for k, loud, peak in report:
        grouped[k].append((loud, peak))
    prefix = '[dry-run] ' if dry_run else ''
    print(f"{prefix}{toon}: {len(report)} clips, {words} words repointed")
    for k, vals in sorted(grouped.items()):
        avg = sum(v[0] for v in vals) / len(vals)
        print(f"  {k:>5}: was {avg:6.1f} LUFS avg, peaks to {max(v[1] for v in vals):+5.1f} dBTP"
              f"  ->  {targets[k]} LUFS / {tp} dBTP")
    if missing:
        print(f"  {len(missing)} referenced clip(s) not on disk — run `npm run backup-cdn` first:")
        for rel in missing[:5]:
            print(f"    {rel}")
    return 0


def main():
    ap = argparse.ArgumentParser(description='Normalise toon caption audio (EBU R128 + true peak).')
    ap.add_argument('toons', nargs='+', help='toon id(s): jax, nero, erin, redsmile-static …')
    ap.add_argument('--voice', type=float, default=-18.0, help='target LUFS for spoken clips (default -18)')
    ap.add_argument('--sfx', type=float, default=-15.0, help='target LUFS for onomatopoeia (default -15)')
    ap.add_argument('--tp', type=float, default=-1.5, help='true-peak ceiling in dBTP (default -1.5)')
    ap.add_argument('--dry-run', action='store_true', help='measure and report; touch nothing')
    args = ap.parse_args()

    targets = {'voice': args.voice, 'sfx': args.sfx}
    rc = 0
    for toon in args.toons:
        rc |= normalise(toon, targets, args.tp, args.dry_run)
    if not args.dry_run:
        print('\nNext: npm run upload-assets && npm run publish-toon-config -- --toon <toon>')
    return rc


if __name__ == '__main__':
    sys.exit(main())
