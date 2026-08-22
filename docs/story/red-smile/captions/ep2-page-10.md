# EP 2, page 10 — captions

Plate: `assets/188263c3655617103bb624b78eefc02f.webp` (prompt
`docs/story/red-smile/prompts/page-10b-halina-mark.txt`). Her arm on the lift
tiles, palm up, the mark on the inner wrist; then a black band; then the house
from above, one upper window lit. The page is the whole cut in one plate. Inserted between the drain plate and Viktor's desk, which is why
its prompt is numbered `10b` — every later prompt file keeps the number it had.

## The idea

**The reveal is the mark, and the caption is the cut.** Everything the reader
needs about who she was is in the tattoo; the words do the other job, which is
to move the story out of the tower before Viktor speaks. Naming her employer,
her rank or the Society here would spend on exposition what the wrist already
says for free — so the line says only _where we are going_, not _what she was_.

Viktor's "another agent is down" on page 11 then lands as confirmation of
something the reader worked out a page earlier, instead of information.

## The black is the caption canvas

The plate is composed for this: art in the top ~45%, the rest solid flat black,
one clean diagonal between them. So the caption sits in real negative space, not
over ink — no bubble, no stroke, nothing to lift it off a plate.

`credit` is the right variant for that. It is what page 1's _NEXORA. After
hours._ uses, and its CSS is already written for black
(`.jax-word--credit` in `reader-shared.css`: Bangers, weight 400,
`color-mix(--text 72%)`, `line-height 1.35`). `align: left` keeps it a block
rather than a centred banner.

## words[]

Three overlays: her last breath, the location card, one line of subtitle under
it. All three are voiced.

```json
{ "x": 0.30, "y": 0.46, "size": 22, "angle": -2,
  "variant": "thought", "tail": "top-right",
  "text": { "en": "…sorry, Viktor." }, "speaker": "halina",
  "audio": "assets/sfx/2fc4c880120c95b32e5a183ecd26c125.mp3" },
{ "x": 0.11, "y": 0.56, "size": 34, "align": "left", "variant": "credit",
  "text": { "en": "A HOUSE ACROSS THE CITY.\nThe same night." }, "speaker": "narrator",
  "audio": "assets/sfx/77509422754e5b9299b2bd6469722b66.mp3" },
{ "x": 0.11, "y": 0.64, "size": 22, "align": "left", "variant": "credit",
  "text": { "en": "Where her reports went." }, "speaker": "narrator",
  "audio": "assets/sfx/28d20f7bac7df358549a960dda3e29b8.mp3" }
```

Full it/de/fr in the config; `Viktor` stays `Viktor` in every language.

## What the reader is told, and what is held back

The society is **not named on this page** — [Sub Signo](../the-society.md) waits
for a character to say it. But the reader still has to understand what the cut
means, so the page explains the _function_ and withholds the _name_:

- **`…sorry, Viktor.`** — she is reporting in, and failing to, with her last
  breath. The name closes a chain the episode already laid: `V›` texts her on
  page 3, she apologises to him here, and he is at the desk on page 11. Saying
  _Viktor_ rather than _V_ costs nothing the society's name protects — he is a
  person, not the organisation — and it removes the one hop the reader would
  otherwise have to make on a page with no faces in it.
- **The card** says where we are going, in page 1's grammar — _NEXORA. After
  hours._ / _A HOUSE ACROSS THE CITY. The same night._ Two location cards, one
  device, bracketing the episode.
- **`Where her reports went.`** is the whole explanation, in four words. It makes
  the house her handlers' house, retro-fits the mark on her wrist into a job, and
  turns Viktor's _another agent is down_ on page 11 into confirmation rather than
  news. It never says who they are.

Set as a subtitle to the card — same `x`, `.085` below it, `22` against the
card's `34` — so it reads as one block with the card, not as a third thought.

The explicit `\n` in the card keeps the break after the place name in all four
languages; Italian and French are long enough that `autoWrapCh` would put it
elsewhere. The house is described, never named.

Read order falls out of `y`: she speaks, then we leave, then we are told what we
are looking at.

## Audio

All three overlays are voiced — her whisper by `halina`, both cards by
`narrator`.

```bash
set -a; source .env; set +a
python3 scripts/generate-jax-voice.py "[weakly] [exhales] …sorry, Viktor." \
  --voice halina --toon redsmile-marcus --model eleven_v3 --stability 0.3
python3 scripts/generate-jax-voice.py "A house across the city. The same night." \
  --voice narrator --toon redsmile-marcus --model eleven_v3 --stability 0.5
python3 scripts/generate-jax-voice.py "Where her reports went." \
  --voice narrator --toon redsmile-marcus --model eleven_v3 --stability 0.5
npm run normalise-audio -- redsmile-marcus
```

| Clip        | Line                                     | Length |
| ----------- | ---------------------------------------- | ------ |
| `2fc4c880…` | …sorry, Viktor.                          | 2.3s   |
| `77509422…` | A HOUSE ACROSS THE CITY. The same night. | 3.2s   |
| `28d20f7b…` | Where her reports went.                  | 1.7s   |

Three points that matter if these are ever regenerated:

- **`[weakly]` and `[exhales]` need `eleven_v3`.** On multilingual v2 the tags
  are ignored or read aloud. Halina's stability is `0.3` here and `0.5`
  everywhere else — flat and unimpressed is her register, and it is exactly
  wrong for a dying whisper.
- **The cards are typed in sentence case for the TTS**, not in the caps the
  caption shows. `A HOUSE ACROSS THE CITY` fed to the model as caps reads as
  shouting; the display text carries the caps, the spoken input does not.
- Generated at -19.2 and -21.2 LUFS, relevelled to the -18 LUFS voice target
  with a -1.5 dBTP ceiling. `normalise-toon-audio.py` rewrote both `audio` paths
  to the new hashes and deleted the superseded files, which is why the hash in
  this file is not the one the generator printed.

All three are on R2 (`npm run upload-assets`).

## The plate carries the cut, so the page needs no second plate

The current plate is three zones down one column: her wrist on the tiles at the
top, a wide black band, then the house seen steeply from above with one upper
window lit. The descent that was going to be its own three-panel page
(`page-10c-london-night.txt`) is compressed into the bottom third — the city
went, the arrival stayed.

That makes the black band the middle of the page rather than its floor, and all
three overlays live in it: whisper at `.46`, card at `.56`, subtitle at `.64`.
The order is now spatial as well as temporal — she speaks over the tiles she is
lying on, the words cross the dark, and the house is underneath them, waiting.
Nothing sits on ink.

Two things to watch on any re-roll:

- **Keep the black band tall enough.** Three overlays and a 34px card need
  roughly a third of the page. A roll that fills more of the plate pushes the
  subtitle onto the roofline.
- **The mark is six-pointed here** — one unbroken interlaced line, lens void at
  the centre. Earlier rolls came back as pentagrams; it is the only hard link
  between Halina, Viktor, Adaeze and Elena's iris, so it is the first thing to
  check.

`page-10c-london-night.txt` stays in the prompts folder unrun. If the city ever
wants its own page, it is written — but the reader does not need it now.
