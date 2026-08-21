# EP 2, page 5 — captions

Plate: `assets/eb43fcdecb99d055c56d8f08304f1c57.webp`. **Panel 1 is now an extreme
close-up of his black eye**, not the corridor wide shot the prompt describes — the
approach is carried by sound alone while the reader looks straight into it. Panel
2 her face, panel 3 his fingers inside the car.

## The idea

**The episode ends on his courtesy, not on violence.** He is invisible except
four fingers in a door, and what he says is *Mrs…?* — still polite, still without
her name. Ep 1 built that man deliberately: he asks how she is and waits for the
answer. This is where it is spent, and it is worse than a threat. Do not give him
a threat line here.

**`KLNK` is the cliffhanger.** Not the hand — the sound of the doors failing to
close. The image shows fingers; the sound tells you the lift is not going
anywhere.

Her *No—* is the first word she has spoken since *Goodnight.* on page 2, and it
is one syllable, cut off. Her scream is spent here, so whatever follows cannot
escalate on sound — it has to cut away. `halina.md` proposes closing the episode
on Viktor elsewhere, knowing; that would make this the penultimate page.

## words[]

| Panel | Overlay | Notes |
| ----- | ------- | ----- |
| 1 | `TOK TOK TOK` | x .19, over the brow — **the same clip as page 4**. With panel 1 now an eye ECU, the steps are the *only* thing telling you he is still moving |
| 2 | *No—* | x .17, tail **bottom-right** to her mouth, top band so it clears her face |
| 3 | `KLNK` | x .18 — the doors striking his fingers |
| 3 | *Mrs…?* | x .72, tail **bottom-left** at the hand in the gap |

Bands, measured: **p1 .02–.33**, **p2 .34–.65**, **p3 .66–.98**. Bursts are black
lettering, no text stroke.

Read order gives: his steps, her refusal, the doors failing, his voice.

## Audio

- `TOK TOK TOK` — page 4's `redsmile-ep2-fast-steps` clip, reused. **Read the hash
  out of `config.json`,** not out of a generation log: `normalise-audio` rewrites
  paths and deletes superseded files, which already produced one dead reference on
  page 4.
- `KLNK` — `redsmile-ep2-door-clunk`, generated against a single-slug manifest.
- *No—* — `halina`, `eleven_v3`, `[scared]`, stability 0.3 so the tag lands.
- *Mrs…?* — `marcus`, `eleven_v3`, `[softly]`, stability 0.4, then **pitched down
  12%** (`asetrate=44100*0.88`) and nothing else. One voice, lower than his own.

  A detuned double was tried and dropped: two voices in one mouth reads as a
  possession trope and draws attention to the effect. The same man in a register
  that is not his is quieter and worse. Not V's phone-render pass (he is in the
  corridor, not in a speaker), not `ai`/`badai` (those are machines). **Every line
  he speaks while the sclera is black takes this pass**; his page 1 lines stay
  clean.
