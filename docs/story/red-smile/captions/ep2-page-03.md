# EP 2, page 3 — captions

Plate: `assets/b13ff147406a21082a486e31a17a32e9.webp` (a redo of panel 2 —
the phone left the frame and the close-up tightened; the panel gutters did not
move, so the captions carried over untouched). Her hand and the lit
phone; her face reading it; she walks to the lift with the cart.

## The idea

**The warning arrives after she has already seen the answer.** V tells her there
is a new signal near her. She has just left a man sitting perfectly still in
front of a screen, and she said goodnight to him. Her one thought on this page —
_He didn't look up._ — is the reader connecting it while she does not.

This is also the first crack in the civilian read. `halina.md` wants her played
as a bystander for as long as possible, so the message is kept undecodable: _V_
and _signal_ mean nothing yet. First read, a small mystery. Second read, she was
noticing professionally the whole time.

**She does not reply.** A junior agent does not chat, and a reply would make her
look protected when the canon is that nobody equipped her.

## Read order

Array order: `BZZT`, V's text, her thought, `TNK`.

## Placement notes

Panel bands, measured: **p1 .02–.31**, **p2 .33–.65**, **p3 .66–.98**.

- `BZZT` top right over the dark ceiling, ahead of the message so the buzz lands
  first — the same beat that opens ep 1 page 1 on Elena's phone.
- V's text far left over black, tail **bottom-right** at the phone (x .45): the
  words come off the screen, not out of a mouth. Never over the display itself.
- Her thought at the top of panel 2, dots trailing **bottom-right** to her face
  at x .52.
- `TNK` top of panel 3, right side, near the call panel she is reaching for.
  Small and dry — she is not fleeing, she is finishing a shift.

Panel 3 carries **no dialogue** on purpose. After V's warning, the silence is
the point.

## Chrome

Bursts are **black lettering, no text stroke** (`"color": "#111111"`, and no
`stroke` / `strokeThickness`). The burst body is a light fill; white lettering
with a white outline reads as a smear.

V's line is `variant: "ai"` with the `V›` prefix — the HUD treatment for text
delivered by a device.

## Music cue

`𝄞` at **x .10, y .29, `align: "left"`** — bottom-left of panel 1, the position
every music cue in this episode uses. `assets/sfx/90443126e726c8f2b78ecd223354038e.mp3`:
detuned music box, warped tape, rumble underneath.

The glyph is furniture, not scene: same mark, same corner, four pages. The rule
and the reasons — why the corner is always free, why panel 1 rather than panel 3
(the folio), and what it costs in read order — live in
[`ep2-page-09.md`](ep2-page-09.md), which also carries the ffmpeg dread pass that
makes these clips horror rather than sad.

Cue for: the transmission arrives.

## Audio

- `BZZT` — `redsmile-ep2-phone-buzz`, Sound Effects API. Came back hot (-6.6 dB
  mean) and was pulled down by the levelling pass.
- `TNK` — `redsmile-ep2-lift-button`. Came back at -42.9 dB mean and needed the
  pass to be audible at all.
- Her thought — `halina`, `eleven_v3`, `[softly]`, stability 0.6: she is thinking,
  not performing.
- V's text — `viktor` (`htZQqY7WtacRNV7s62Iy`), `eleven_v3`, `[flatly]`,
  stability 0.3, then the **light phone-render pass** (telephone band + short comb
  echo, no crusher, no pitch shift). Not the `ai`/`badai` chain: `viktor.md` is
  explicit that he is not a machine, and what is processed here is her phone
  speaker, not him.

Generate the two SFX against a **single-slug manifest** — a full run re-spends
credits on every slug whose local file the levelling pass has already replaced.
