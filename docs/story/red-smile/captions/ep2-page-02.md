# EP 2, page 2 — captions

Plate: `assets/541502fa97985f995fe38a63b920cfd0.png`. Halina empties the desk
bin and notices Marcus; she tells him she has finished; she walks the corridor
out with the cart.

## The idea

**Every line on this page is hers.** Marcus gets no bubble at all — she asks him
a direct question and the page simply does not answer it. Nothing needs to be
drawn wrong with him for that to land; the missing balloon does the work that a
description of his face could not.

She calls him *sir* twice and never has a name for him, which is the ep 1
asymmetry running the other way: he asks how she is and waits for the answer, and
she has never been told what to call him.

The last sound is **`TIC` — page 1's clip, reused.** She is out of the room, the
corridor is empty, and the machine opens something again. Sound is the tell and
the image is the harm: the reader hears it and she does not.

## Read order

Array order, not position: bin, *Sir?*, *I've finished, sir.*, *Goodnight.*, then
the chime.

## Placement notes

Panel bands on this plate, measured: **p1 .02–.33**, **p2 .34–.66**,
**p3 .67–.98**. Every caption sits in the top band of its own panel.

- `SHHK` far left over the window glass, clear of her face at x .40.
- *Sir?* centre-right at x .53, tail **bottom-left** back to her head — it must
  not cross Marcus at x .68.
- *I've finished, sir.* far left, tail **bottom-right** to her face at x .35.
- *Goodnight.* goes right, tail **bottom-left**, clear of the raised hand and of
  Marcus.
- `TIC` right side of panel 3 over black, **no tail** — it comes from the room
  behind her, not from a mouth. White lettering with a white stroke.

## Audio

Three new Halina lines (`eleven_v3`, stability 0.4 for the tentative *Sir?*, 0.5
for the other two) and one Sound Effects slug, `redsmile-ep2-bin-tip`. The chime
is page 1's file, referenced twice — one clip, two pages.

Run the SFX generator against a **single-slug manifest**: it treats any slug
whose local mp3 is missing as ungenerated, and `normalise-audio` has already
deleted the superseded files, so a plain full run re-spends credits on the whole
manifest.

The bin came back at -32 dB mean and needed the levelling pass; it is
peak-limited, so it sits near -15 LUFS rather than exactly on it.
