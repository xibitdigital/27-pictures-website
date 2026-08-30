# RED SMILE: Marcus — cast & synopsis (manual)

**Episode 2** of the RED SMILE series. Episode 1 is `redsmile-static`.

Interactive FlipFrame short. Deep-link pages: `/toons/redsmile/marcus/?page=N`.

|             |                                                             |
| ----------- | ----------------------------------------------------------- |
| Book        | D1 `redsmile-marcus` — edit in `/toons/editor/`             |
| Reader      | `/toons/redsmile/marcus/` (series hub `/toons/redsmile/`)    |
| Design size | 800 × 1424 (portrait)                                       |
| Pages       | **13**                                                      |

## Status

Visibility is D1 (`/toons/editor/`). This episode is **Public**. Old
`/toons/redsmile-marcus/` 301s to `/toons/redsmile/marcus/`.

## Page 10 is an insert

The wrist plate sits between Halina's death and Viktor's desk, so the pages
after it shifted by one: Viktor's desk is 11, the handover 12, the credits 13.
Its prompt is `docs/story/red-smile/prompts/page-10b-halina-mark.txt` — named
`10b` on purpose, so no earlier prompt file had to be renumbered. Caption docs
`captions/ep2-page-1{0,1,2}.md` were renamed to match the reader.

Deep links move with it: `?page=10` was Viktor's desk and is now the wrist.

## Logline

Marcus is CEO of NEXORA. He works until late. Halina cleans the tower, and
nobody in it knows her name. A transmission starts on his laptop. Something
darker is lurking.

## Cast / voices

| Character | ElevenLabs voice (`scripts/voices.json`) |
| --------- | -------------------------------------------- |
| Marcus    | `marcus` → `yhf80q1381zd2JJQ4tM7`            |
| Halina    | `halina` → `USEQXnsXRJlw2k9LUzG4`            |
| Viktor    | `viktor` → `htZQqY7WtacRNV7s62Iy`            |
| Tokiro    | `tokiro` → `qjx83Y0UcERgVPICvVpl`            |
| Adaeze    | `adaeze` → `jv41DhCf464zw0TI7I1w`            |

Full bios, appearance locks and voice direction:
`docs/story/red-smile/{marcus,halina,viktor,tokiro,adaeze}.md`.

## Music cues (4)

Pages 3, 9 and 12 carry **one three-note motif in three timbres** — music box,
strings, dead piano — so the reader hears _the same thing_ across a tower, a lift
and a house without being told. Page 6 is deliberately outside the motif: that
violence is physical, not occult.

Each is a caption, not a background track: a single `𝄞` (U+1D11E) at **x .10,
y .29, `align: "left"`** — bottom-left of panel 1, every time. Nothing else is
ever there, because every other caption in this episode sits in the top band of
its own panel. Details, and the ffmpeg dread pass that makes these clips
frightening rather than merely sad, are in
`docs/story/red-smile/captions/ep2-page-09.md`.

Nothing on pages 4-5 (the three steps _are_ the score), 7 (no reply is the page's
content), 10 (three voiced overlays and two title cards) or 13 (the motif ends on
12; music after it would be a second ending).

## Captions

**Page 4 has no captions yet.** Its panels are: his eye at the desk with the
**sigil in the iris**, him walking the corridor far too fast, and her finger on
the `-1` button. The page was restaged once — the first version opened on the
lift button and closed on a **black sclera** eye, which skipped a step ep 1 had
already taught the reader.

**The two host tells are sequential, not interchangeable.** The iris mark means
it has crossed (ep 1 page 1 ends on exactly that shot of Elena); black sclera
means the vessel is being used, and belongs on the page where he acts — page 5.
Keep them in that order, and take the mark's geometry from **ep 1 page 1**, never
from ep 2 page 1, which drew it as an equilateral hexagram.

The middle panel is the one to protect in any re-roll: he is upright, arms down,
jacket undisturbed, face calm, and the _walls_ carry the motion blur. `marcus.md`
forbids transforming or lunging — the speed is the only thing wrong with him, and
that reads worse than a charge.

Page 3 carries 4 overlays — `BZZT`, V's text, her thought, `TNK`. **Every burst
on this toon is black lettering with no text stroke**: the burst body is already a
light fill, so white-on-white-stroke reads as a smear. Pages 1 and 2 shipped the
wrong way round and were corrected in the same pass.

**V's message is `variant: "ai"`.** It arrives as characters on a screen, so it
takes the HUD treatment and a `V›` prefix, exactly like Nova's `N›`. The voice is
`viktor` (`htZQqY7WtacRNV7s62Iy`) through a **light phone-render pass** — telephone
band plus a short comb echo, no bit-crush and no pitch shift:

```bash
ffmpeg -y -i in.mp3 -af "highpass=f=300,lowpass=f=3400,aecho=0.8:0.6:4:0.18,\
dynaudnorm=f=200:g=5" -codec:a libmp3lame -b:a 192k /tmp/out.mp3
```

That is deliberately _not_ the `ai`/`badai` chain `docs/story/red-smile/viktor.md`
forbids. What is being processed is her phone reading his text aloud, not Viktor's
throat — he is not a machine, and the chain must never be heavy enough to suggest
he is.

Page 2 carries 5 overlays, **all of them hers** — `SHHK` (the bin), _Sir?_,
_I've finished, sir._, _Goodnight._, then `TIC`. Marcus has no bubble on the
page at all: he is asked a question and does not answer, and the silence is the
beat. The closing `TIC` reuses page 1's popup clip, so the machine speaks again
after she has left the corridor. Draft and placement reasoning:
`docs/story/red-smile/captions/ep2-page-02.md`.

Page 1 carries 5 overlays — 2 Marcus lines, 2 Halina lines, 1 SFX. Draft,
placement reasoning and the generation commands are in
`docs/story/red-smile/captions/ep2-page-01.md`.

**Voiced.** Every overlay on every page carries `audio`: four ElevenLabs `eleven_v3` lines
(marcus ×2 at stability 0.4, halina ×2 at 0.5) and the popup chime from the
Sound Effects API, slug `redsmile-ep2-popup-tic` in
`scripts/jax-sfx-manifest.json`. Levelled with
`npm run normalise-audio -- redsmile-marcus` (voices to -18 LUFS; the chime was
already on target).

The chime took two takes: the first came back at -60 dB mean — inaudible — and
a 0.4 s request is under what the API renders usefully. The shipped one asks for
0.8 s and a _loud, dry, close_ tick.

## Page 6 — she fights back, and what it cost to get the panel

**Page 6 has no captions yet.** She rams the cart into him, sprays cleaning fluid
in his face, and the doors shut while he is on one knee. The cleaner's cart is
both her cover and her only weapon — nobody equipped her, per `halina.md`.

Three rolls, and the prompt now carries what each one taught:

1. **Front-on grin.** He posed at the camera. A grin at the viewer is a poster; a
   grin at the person you are about to kill is the beat. Fixed by pinning him
   three-quarter with his eyes on her, plus three explicit negatives.
2. **Inverted geography** — her in the corridor, him in the car. Caused by the
   phrase _"in the doorway"_, which reads from either side. Fixed by a **STAGING**
   clause above the panels that states who is where and applies to all of them.
   Do not delete it, and never write "in the doorway" on this page.
3. **Normal eyes, and a cart that missed.** Both wide-shot rolls treated the black
   sclera as detail and the shove as a pose. Fixed by shooting panel 1 as a
   **medium close** with him large in frame, naming his face as the panel's
   subject, and describing the impact in the **past tense** — _the cart has already
   hit him_ — with its consequences rather than the action.

The grin stays **small and tight**. "The smile" is the series' last stage and is
not spent on a page where she gets away.

**If a plate comes back with light gutters, fix it locally — do not re-roll.** One
roll of this page returned the gutters and outer border in pale grey instead of
black, which is the only thing separating panels in this book. The gutter region
is one contiguous shape, so a single flood fill takes all of it and leaves the
panels untouched:

```bash
magick <src> -colorspace Gray -colorspace sRGB \
  -fill black -fuzz 18% -draw "color 2,2 floodfill" /tmp/fixed.png
# verify: corner and a gutter midpoint should both read gray(0)
magick /tmp/fixed.png -format "%[pixel:p{2,2}] %[pixel:p{400,573}]\n" info:
```

Re-rolling for a gutter is a waste — the art is what is expensive, and the border
is a five-second repair.

## Page 5 — two breaks from the sheets, both deliberate

- **No eyeglasses.** `docs/story/red-smile/marcus.md` locks the slim rectangular
  glasses into _every_ view. They come off here because the human upkeep has
  stopped — and because a lens is the one thing that would hide the black. State
  it twice in any re-roll (in the PIN and in the panel), or i2i puts them back.
- **Black sclera at distance**, both eyes, readable at corridor range. This is the
  escalation from page 4's iris mark, and no sigil is visible now — the black
  swallows it.

**His line is pitched down, and nothing else.** _Mrs…?_ is his own take dropped
12% in pitch — one voice, lower than his:

```bash
ffmpeg -y -i in.mp3 -af "asetrate=44100*0.88,aresample=44100,highpass=f=80,\
dynaudnorm=f=200:g=5" -codec:a libmp3lame -b:a 192k /tmp/out.mp3
```

A doubled version was tried first — his take mixed with a detuned copy of itself —
and it was worse: two voices in one mouth reads as a possession trope and pulls
attention to the effect. One voice a few semitones too low is the same man saying
something polite in a register that is not his, which is what a vessel should
sound like. It also stretches the clip ~14%, so the delivery slows with it.

Not V's phone-render pass — that says "a device is reading text aloud", and he is
standing in the corridor. Not `ai`/`badai` either: those are machines, and
`marcus.md` insists he is not one. **Any line he speaks while the sclera is black
takes this pass**; his page 1 lines, spoken before the crossing, stay clean —
which is itself a tell on a reread.

His courtesy is the last thing in the episode, not the violence: he is invisible
except four fingers in a lift door, and what he says is _Mrs…?_ — still polite,
still without her name. Ep 1 built that man on purpose (he asks how she is and
waits for the answer); this is where it is spent. Do not give him a threat line
here.

## Plates

| Page | Prompt                                                               |
| ---- | -------------------------------------------------------------------- |
| 1    | `docs/story/red-smile/prompts/page-02-marcus-halina-office.txt`      |
| 2    | `docs/story/red-smile/prompts/page-03-halina-goodnight-corridor.txt` |
| 3    | `docs/story/red-smile/prompts/page-04-halina-phone-lift.txt`         |
| 4    | `docs/story/red-smile/prompts/page-05-lift-marcus-eye.txt`           |

**Page 1 has a continuity defect.** The sigil in the laptop popup is a roughly
equilateral hexagram; the series mark is notably taller than wide with a long
vertical axis (see episode 1 page 1). Three generations have failed to reproduce
it. Fix by compositing the real mark from episode 1 rather than re-rolling.
