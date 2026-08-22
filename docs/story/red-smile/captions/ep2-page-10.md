# EP 2, page 10 — captions

Plate: `assets/bd989e9074bf5a36713531adda489dc0.webp` (prompt
`docs/story/red-smile/prompts/page-11-viktor-desk.txt` — the drain plate is
still a prompt, not in the reader; this is the cut after her *Goodnight.*).
His bare right hand on the desk, the mark filling the panel; one pale slit-pupil
eye under the hat brim; from behind, seated at the lamp.

## The idea

**The reader is a scene ahead of him.** Page 9 ended on him killing her. This
page opens on a man waiting for a message that will never come. *Nothing from H.*
is the other side of page 7's *Three tries. Nothing.* — she could not send, and
he has been sitting with that silence.

**He does not explain the feeling.** `viktor.md` wants almost nothing said, and
the eye does the work the words must not: the mark, then the slit, then he acts.
*Have I lost her?* is personal — he placed her. *If so, another agent is
down.* is the count. Elena's mother was one; H would be the next. The
reader already knows; he is still checking.

**The last line is an order, and it brings two names into the episode.** He
calls Tokiro. He sends him to Elena's house — cleanup is what sending the blade
there means, so the caption does not say *clean*. *Find H.* is the second job,
and it is still a search, not a recovery: he felt her fall and he has not seen
the body. Proper nouns stay; first-time readers of ep 2 get a place and a
person, and anyone who read ep 1 hears the house.

He is alone in panels 1 and 2, so those are thoughts. Panel 3 is the call, so
it is spoken. No SFX — the silence of no reply is the page's sound, the same
trick page 4 used on the crossing. There is no phone in the drawing; do not
invent a `CLICK`.

## words[]

| Panel | Overlay | Notes |
| ----- | ------- | ----- |
| 1 | *Nothing from H.* | x .16, y .05, thought, tail **bottom-right** to the cuff. Top-left over the dark wood — **not** on the mark, not on the fingers |
| 2 | *Have I lost her?* | x .16, y .37, thought, tail **bottom-right** toward the eye, never on it. Top-left over the hat brim / shadowed temple |
| 2 | *If so, another agent is down.* | x .16, y .50, thought, tail **bottom-right** toward the eye. Stacked below the question, still in panel 2, clear of the slit |
| 3 | *Tokiro. Elena's house. Find H.* | x .18, y .70, bubble, tail **bottom-right** to the hat. Left wall, clear of the lamp |

Bands, measured from the plate: **p1 .02–.33**, **p2 .34–.65**, **p3 .66–.98**.

Read order gives: the wait, the question, the count, the order.

## Alts worth keeping on file

Panel 3, if the cleanup verb has to be said: *Tokiro. Clear Elena's. Find H.*
*Clear* is operational; *clean* is her job and too close.

Panel 3 as two balloons (call, then the jobs): *Tokiro.* then *Elena's house.
Find H.* Use this if the one-line order feels like a briefing.

## Audio

- *Nothing from H.*, *Have I lost her?* and *If so, another agent is down.* —
  `viktor`, `eleven_v3`, `[softly]`, stability 0.3. Thoughts, not performed
  worry.
- *Tokiro. Elena's house. Find H.* — `viktor`, `eleven_v3`, `[flatly]`,
  stability 0.3. The call. Pronounce Tokiro *toh-KEE-ro*; if the model
  mangels it, spell it in the TTS input only.

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
