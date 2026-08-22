# EP 2, page 4 — captions

Plate: `assets/86f02a0e7c61e861c3601a5f807df8dc.webp`. His eye at the desk with
the sigil in the iris; him walking the corridor far too fast; her finger on the
`-1` button.

## The idea

**Panel 1 is silent, on purpose.** `the-entity.md`: sound is the tell, the image
is the harm. The crossing completing is the harm, so it gets no bubble and no
SFX. Every other page in this episode opens on a sound — the buzz, the bin, the
phone — so the silence reads as wrong before a reader can say why.

**The only warning on the page is a sound she cannot hear.** The art can show
speed only as blur; the tempo of three steps is what tells the reader how
fast he is coming. She is inside a steel box while it happens.

Array order is the page: he is coming, she presses the button, she thinks about
going home. The last thought before the doors open is a woman checking the clock.

## words[]

| Panel | Overlay           | Notes                                                                           |
| ----- | ----------------- | ------------------------------------------------------------------------------- |
| 1     | _(none)_          | silent by design                                                                |
| 2     | `TOK TOK TOK`     | x .20, left over the dark wall, clear of him at x .50                           |
| 3     | `TK`              | x .78, over the plate above the buttons — the same lift-button clip page 3 uses |
| 3     | _Home in twenty._ | x .30, thought, dots **bottom-left** to her off-frame body                      |

Bands, measured: **p1 .02–.33**, **p2 .34–.65**, **p3 .66–.98**.

Bursts are black lettering with no text stroke.

## Audio

- `TOK TOK TOK` — `assets/sfx/a86a5a5d76be7e8312151c1ac36d8786.mp3`, shared with
  page 5. **One clip of three steps**, not three clips: the tempo has to be baked
  in, or it depends on how fast the reader taps.

  **This one is not generated from the manifest.** The Sound Effects API collapses
  "three steps" into a single knock every time — asked for three distinct heel
  strikes with silence between them, it returns one hit and 1.8s of nothing
  (measured: audio ends at 0.52s of a 2.25s clip). The slug
  `redsmile-ep2-fast-steps` and a later `redsmile-ep2-three-steps` both failed the
  same way, so the second was dropped from the manifest rather than left there
  looking usable.

  What ships is a supplied library clip, `HMNMisc-foot_steps-Elevenlabs.mp3` — a
  six-step walk at ~0.58s spacing — trimmed to its first three steps and levelled:

  ```bash
  ffmpeg -y -ss 0.40 -t 1.82 -i HMNMisc-foot_steps-Elevenlabs.mp3 \
    -af "afade=t=out:st=1.70:d=0.12,\
  acompressor=threshold=-30dB:ratio=3:attack=5:release=140:makeup=4,\
  volume=8dB,alimiter=limit=0.84:attack=3:release=60,volume=-1.5dB,aresample=44100" \
    -codec:a libmp3lame -b:a 192k /tmp/tok3.mp3
  ```

  1.85s, -24.3 LUFS, **-1.71 dBTP**. Three transients in under two seconds is
  peak-limited by nature, so it cannot reach the -15 LUFS SFX target and
  `normalise-audio` leaves it alone by design — the peaks are at the ceiling,
  which is what makes it audible.

  Check any replacement with `silencedetect`, not by eye: three step clusters, two
  gaps.

  ```bash
  ffmpeg -i clip.mp3 -af "silencedetect=noise=-30dB:d=0.05" -f null /dev/null
  ```

- `TK` — the lift-button clip, shared with page 3's `TNK`.
- _Home in twenty._ — `halina`, `eleven_v3`, `[softly]`, stability 0.6.

**Reusing a clip: read the hash out of the config, never out of an old note.**
Page 4 first shipped pointing at the lift-button hash from page 3's _generation_,
but `normalise-audio` had already relevelled that clip, rewritten the path and
deleted the old file. The levelling pass catches it — "referenced clip(s) not on
disk" — but a re-publish before that check would have shipped a 404.
