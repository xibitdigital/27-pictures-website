# EP 2, page 11 — captions

Plate: `assets/bd989e9074bf5a36713531adda489dc0.webp` (prompt
`docs/story/red-smile/prompts/page-11-viktor-desk.txt` — the drain plate is
still a prompt, not in the reader; this is the cut after her _Goodnight._).
His bare right hand on the desk, the mark filling the panel; one pale slit-pupil
eye under the hat brim; from behind, seated at the lamp.

## The idea

**The reader is a scene ahead of him.** Page 9 ended on him killing her. This
page opens on a man waiting for a message that will never come. _Nothing from H._
is the other side of page 7's _Three tries. Nothing._ — she could not send, and
he has been sitting with that silence.

**He does not explain the feeling.** `viktor.md` wants almost nothing said, and
the eye does the work the words must not: the mark, then the slit, then he acts.
_Have I lost her?_ is personal — he placed her. _If so, another agent is
down._ is the count. Elena's mother was one; H would be the next. The
reader already knows; he is still checking.

**The order is two balloons, and it says her name.** _Tokiro. An hour of
silence from H._ / _Elena's house. Then Halina — and nobody else finds that
wrist._ The one-line version (_Tokiro. Elena's house. Find H._) read as a
briefing: three fragments, no urgency, no reason.

What the longer order buys:

- **An hour** gives the silence a duration, so his waiting has a shape. Page 7
  was her _Three tries. Nothing._; this is the same hour from the other end.
- **First, then** makes it a sequence rather than a list. Sending the blade to
  Elena's house _is_ cleanup, so the caption still never says _clean_.
- **Halina**, spoken, is the payoff for page 10's _Nobody in the tower knew her
  name._ He is the man who knows it. He uses the callsign in the first balloon
  and her name in the second — the switch is the character beat.
- **Nobody else finds that wrist** is new plot logic: the mark must not be found
  on a body. It retro-justifies the whole insert page and tells the reader the
  tattoo matters to _them_, not just to us. It also keeps the search a search —
  he felt her fall, he has not seen the body.

He is alone in panels 1 and 2, so those are thoughts. Panel 3 is the call, so
it is spoken. No SFX — the silence of no reply is the page's sound, the same
trick page 4 used on the crossing. There is no phone in the drawing; do not
invent a `CLICK`.

## words[]

| Panel | Overlay                                     | Notes                                                                                                                                                     |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | _Nothing from H._                           | x .16, y .05, thought, tail **bottom-right** to the cuff. Top-left over the dark wood — **not** on the mark, not on the fingers                           |
| 2     | _Have I lost her?_                          | x .16, y .37, thought, tail **bottom-right** toward the eye, never on it. Top-left over the hat brim / shadowed temple                                    |
| 2     | _If so, another agent is down._             | x .16, y .50, thought, tail **bottom-right** toward the eye. Stacked below the question, still in panel 2, clear of the slit                              |
| 3     | _Tokiro. An hour of silence from H._        | x .18, y .69, bubble, size 22, tail **bottom-right** to the hat. Left wall, clear of the lamp                                                             |
| 3     | _Elena's house. Then Halina — …that wrist._ | x .18, y .83, bubble, size **19**, tail **bottom-right**. Stacked under the first; the smaller size is what keeps three wrapped lines inside the .98 band |

Bands, measured from the plate: **p1 .02–.33**, **p2 .34–.65**, **p3 .66–.98**.

Read order gives: the wait, the question, the count, the order.

## Alts worth keeping on file

The superseded one-liner: _Tokiro. Elena's house. Find H._ Kept for the record —
it is the version that was too short.

If the cleanup verb ever has to be said: _Clear Elena's_ rather than _clean_ —
_clean_ is Halina's job and too close.

Softer second balloon, if _wrist_ tips the reader toward the body too early:
_Elena's house. Then find her — and the mark comes back with you._

## Audio

- _Nothing from H._, _Have I lost her?_ and _If so, another agent is down._ —
  `viktor`, `eleven_v3`, `[softly]`, stability 0.3. Thoughts, not performed
  worry.
- _Tokiro. An hour of silence from H._ — `viktor`, `eleven_v3`, `[flatly]`,
  stability 0.3 → `assets/sfx/123d644adfb2dc8eed12f0cb06f20c1a.mp3` (4.0s).
- _Elena's house. Then Halina — and nobody else finds that wrist._ — same voice
  and settings → `assets/sfx/3a008a24c97f8d2f1da864eecce06674.mp3` (6.1s). The
  **em dash is a full stop in the TTS input** (`Then Halina. And nobody else…`);
  fed the dash, the model runs the clause on and the pause the caption implies
  disappears. Display text keeps the dash.

Pronounce Tokiro _toh-KEE-ro_; if the model mangles it, spell it phonetically in
the TTS input only.

Not the `ai`/`badai` chain, and not the phone-render pass from page 3: that
pass was her speaker reading his text. This is his throat, in the room.

Level with `npm run normalise-audio -- redsmile-marcus` after generating.

```bash
set -a; source .env; set +a
python3 scripts/generate-jax-voice.py "[softly] Nothing from H." \
  --voice viktor --toon redsmile-marcus --model eleven_v3 --stability 0.3
python3 scripts/generate-jax-voice.py "[softly] Have I lost her?" \
  --voice viktor --toon redsmile-marcus --model eleven_v3 --stability 0.3
python3 scripts/generate-jax-voice.py "[softly] If so, another agent is down." \
  --voice viktor --toon redsmile-marcus --model eleven_v3 --stability 0.3
python3 scripts/generate-jax-voice.py "[flatly] Tokiro. Elena's house. Find H." \
  --voice viktor --toon redsmile-marcus --model eleven_v3 --stability 0.3
```
