# EP 2, page 7 — captions

Plate: `assets/720c54e50ee943f45442537d87830c58.webp`, source id
`02178729926732939debe34dc0faea573b1e9db2da7e27bd4ea3a`. Her phone in the descending car with no signal; her face under the `-1`
readout, spray bottle still in her fist; her POV as the doors open on Marcus
standing in the middle of the basement corridor as a silhouette.

## The idea

**Panel 1 is silent, and this time the silence is the phone.** Page 4 already
used a silent opener for the crossing; here nothing sounds because nothing sends.
Every other page in the episode opens on a noise, so a mute panel with a lit
screen reads as *cut off* before the reader works out why.

**The second roll is the one that shipped, and the reason is panel 1.** The
first roll (`021787298971563c41b39946b92a3163d51611244fc4a0d83c3ab`) lost the
struck-through signal icon entirely — the screen read as `V` plus two blank
bubbles, so *No signal.* was carrying the whole beat alone. This roll draws the
failed send twice, as a struck-through glyph by the send key with her thumb still
on the keyboard, and gives panel 2 a **bright door face** — which is where both
bursts sit, so black lettering needs no white stroke anywhere on the page. The
cost is a softer expression than the first roll's, and a paler garment in panel 1
than the tunic in panel 2.

**She counts the failures before she names the cause.** *Three tries. Nothing.*
then *No signal.* — the art already draws the failed send twice, so the thoughts
add the one thing a drawing cannot: that she has been at it long enough to count.
V does not know she is in this lift, and page 3's warning was the last thing that
reached her.

**She is still working the plan when the doors open.** *Car park. Then the
street.* is a woman with an exit, one beat before it turns out she does not have
one. Her sound budget is spent — she screamed on page 5 and shouted on page 6 —
so she says nothing on this page at all. Both her overlays are thoughts.

**Marcus gets the page's only spoken line, and it is a joke.** He is a black
shape with no face, so the devilishness cannot be in the drawing; it has to be
in what he says. *I took the stairs.* answers the question the reader is asking
— how is he already down here — with dry courtesy, and it is worse than a
threat. He is still not threatening her. He is being funny about it.

**The page ends on an instruction, not a threat.** *Put the phone away, Mrs
Nowak.* is courteous, uses the surname the thing took off her on page 6, and is
the most on-canon thing he could say: `the-entity.md` makes a phone a surface it
can arrive through, and the phone is also her only line to V. He is closing both
at once, politely.

Two lines were weighed against it and are worth keeping on file: *After you.*
(lift courtesy inverted, two words, the tighter joke) and *Nobody clocked you
out.* (nobody will come looking). Both land in the same slot.

## words[]

| Panel | Overlay | Notes |
| ----- | ------- | ----- |
| 1 | *Three tries. Nothing.* | x .20, y .15, thought, tail **top-left**. Stacked above *No signal.* on the dark sleeve — **not** at x .72, which is the phone screen and the struck-through send glyph |
| 1 | *No signal.* | x .20, y .27, thought, tail **top-left** to her off-frame face. Below her jaw, clear of the phone — the screen is the panel's subject and nothing sits on it |
| 2 | `DING` | x .22, y .50, on the lit door face, clear of the `-1` readout at x .36 and the call buttons at x .10 |
| 2 | *Car park. Then the street.* | x .74, y .36, tail **bottom-left** to her face — she is on the right of this roll |
| 3 | `SSHK` | x .17, y .70, on the lighter left door pilaster — the doors parting |
| 3 | *I took the stairs.* | x .74, tail **bottom-left** to the silhouette's head at x .50 |
| 3 | *Put the phone away, Mrs Nowak.* | x .22, y .88, tail **top-right** — the last words on the page |

Bands, measured: **p1 .02–.33**, **p2 .34–.65**, **p3 .66–.98**. Bursts are black
lettering, no text stroke.

**Both bursts are placed on light ground on purpose** — the lit door in panel 2,
the door pilaster in panel 3. That is the whole reason no `"stroke": "#ffffff"`
appears on this page. Move either one onto the readout, the silhouette or the
black corridor and it needs the stroke back.

Read order gives: the phone fails, the lift arrives, her exit plan, the doors,
his voice. The last thing on the page is him being pleasant.

## Audio

- `DING` — slug `redsmile-ep2-lift-arrive-chime`, generated against a single-slug
  manifest. A flat, cheap, correct lift chime; do not let it be ominous, the
  dissonance is the point. **Came back at -36 dB mean** and needed the levelling
  pass, like page 4's steps.
- `SSHK` — slug `redsmile-ep2-lift-doors-open`.
- *Three tries. Nothing.* and *No signal.* — `halina`, `eleven_v3`, `[softly]`,
  stability 0.6. Same register: counted under her breath, not narrated.
- *Car park. Then the street.* — `halina`, `eleven_v3`, `[whispers]`, stability
  0.5. Under her breath, not narration.
- *I took the stairs.* and *Put the phone away, Mrs Nowak.* — `marcus`,
  `eleven_v3`, `[softly]`, stability 0.4, then
  **pitched down 12%** (`asetrate=44100*0.88`). Every line he speaks while the
  sclera is black takes that pass, and a silhouette is no exception — the voice
  is the only thing identifying him in the panel.

Level with `npm run normalise-audio -- redsmile-marcus` after generating, and
read reused hashes out of `config.json`, never out of a generation log.
