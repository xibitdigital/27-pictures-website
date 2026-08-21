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
speed only as blur; the tempo of three fast steps is what tells the reader how
fast he is coming. She is inside a steel box while it happens.

Array order is the page: he is coming, she presses the button, she thinks about
going home. The last thought before the doors open is a woman checking the clock.

## words[]

| Panel | Overlay | Notes |
| ----- | ------- | ----- |
| 1 | *(none)* | silent by design |
| 2 | `TOK TOK TOK` | x .20, left over the dark wall, clear of him at x .50 |
| 3 | `TK` | x .78, over the plate above the buttons — the same lift-button clip page 3 uses |
| 3 | *Home in twenty.* | x .30, thought, dots **bottom-left** to her off-frame body |

Bands, measured: **p1 .02–.33**, **p2 .34–.65**, **p3 .66–.98**.

Bursts are black lettering with no text stroke.

## Audio

- `TOK TOK TOK` — `redsmile-ep2-fast-steps`, **one clip of three steps**, not three
  clips: the tempo has to be baked in, or it depends on how fast the reader taps.
  Came back at -35.9 dB mean and needed the levelling pass.
- `TK` — the lift-button clip, shared with page 3's `TNK`.
- *Home in twenty.* — `halina`, `eleven_v3`, `[softly]`, stability 0.6.

**Reusing a clip: read the hash out of the config, never out of an old note.**
Page 4 first shipped pointing at the lift-button hash from page 3's *generation*,
but `normalise-audio` had already relevelled that clip, rewritten the path and
deleted the old file. The levelling pass catches it — "referenced clip(s) not on
disk" — but a re-publish before that check would have shipped a 404.
