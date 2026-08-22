# EP 2, page 12 — captions

Plate: `assets/8fc86b7e21fe6e6df06fa08a7521be7e.webp` (prompt
`docs/story/red-smile/prompts/page-12-tokiro-book.txt`). Viktor offers the
closed book in the corridor; the hands take it — his mark, Tokiro's swords;
Tokiro from the nose down, mouth closed.

## The idea

**Page 10 was the order. This page is the tool, and Tokiro's correction.**
Viktor already sent him to Elena's house and to find H. He does not repeat
that. He hands over the book — the scholar's half of the work — and Tokiro
takes it without a word. The last panel is the first time Tokiro speaks, and
he does not echo the order: he sequences it.

**Elena's mother first, then Halina.** Page 10 said *Elena's house.* Tokiro
names the previous agent. That is the point of the line — not a location, a
person of the same tier as H, the reason the house is in the work at all.
*I'll check Elena's mother first. Then Halina.* is the first time her given
name is spoken; Viktor's page used the callsign. He uses people. He also
has not accepted an outcome: both stops are checks, not recoveries. The
*I'll check* is the beat — he is going, not recovering.

**Panel 2 is silent.** The take is the drawing — the mark on one side of the
leather, the swords on the other. A balloon would sit on the book. Do not
invent a leather `SHFF` unless the page feels mute after two quiet panels;
the mouth in panel 3 is where the sound belongs.

He is the calmest person in the room, including this one. Short. No
theatrics. No explanation of the book.

## words[]

| Panel | Overlay | Notes |
| ----- | ------- | ----- |
| 1 | *You'll need this.* | x .55, y .05, bubble, tail **bottom-right** to Viktor's mouth. Dark ceiling between them — **not** on the hat, the book or his face |
| 2 | *(none)* | the take is the beat |
| 3 | *I'll check Elena's mother first. Then Halina.* | x .16, y .78, bubble, tail **bottom-right** to the mouth. Left of the face over the dark hair — **never** on the mouth, and not up into the take |
| 3 | *I'll come with you.* | x .84, y .78, bubble, tail **right** — off-frame, same row so it plays after him. Adaeze. Do not put a face on her |

Bands, measured from the plate: **p1 .02–.33**, **p2 .34–.65**, **p3 .66–.98**.

Read order gives: the tool, the take, his sequence, then a voice from the
right. Same row as his line, larger x, so she answers him. She is not on
the plate.

## Alts worth keeping on file

Panel 1 silent — the handover after the phone order, no restatement. Use this
if *You'll need this.* feels like he is still talking.

Panel 1 as the order-voice: *Take it.*

Panel 3 tighter: *The mother first. Then Halina.* Drops Elena; only if the
link back to episode 1 can live in the art.

Panel 3 with the callsign: *Elena's mother first. Then H.* Matches page 11;
loses the first speaking of her name.

Panel 2 leather `SHFF` at x .18, y .36, over the dark coat, off the book and
off the mark. Only if the page needs a sound before he speaks.

## Audio

`tokiro` → `qjx83Y0UcERgVPICvVpl`. `adaeze` → `jv41DhCf464zw0TI7I1w`.

- *You'll need this.* — `viktor`, `eleven_v3`, `[flatly]`, stability 0.3.
  Same throat as page 11. Not the phone-render pass.
- *I'll check Elena's mother first. Then Halina.* — `tokiro`, `eleven_v3`,
  `[softly]`, stability 0.5 (higher than Viktor; tags used rarely). Measured,
  not grim.
- *I'll come with you.* — `adaeze`, `eleven_v3`, `[softly]`, stability 0.45.
  Warm, unhurried. Never the metallic chain.

Level with `npm run normalise-audio -- redsmile-marcus` after generating.

```bash
set -a; source .env; set +a
python3 scripts/generate-jax-voice.py "[flatly] You'll need this." \
  --voice viktor --toon redsmile-marcus --model eleven_v3 --stability 0.3
python3 scripts/generate-jax-voice.py "[softly] I'll check Elena's mother first. Then Halina." \
  --voice tokiro --toon redsmile-marcus --model eleven_v3 --stability 0.5
python3 scripts/generate-jax-voice.py "[softly] I'll come with you." \
  --voice adaeze --toon redsmile-marcus --model eleven_v3 --stability 0.45
```
