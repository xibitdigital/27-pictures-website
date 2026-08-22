# EP 2, page 9 — captions

Plate: the drain — her face ageing in his grip, his hand at her throat, then her
body on the tiles (prompt `docs/story/red-smile/prompts/page-10-lift-drain.txt`).

## The music sting

`𝄞` at x .10, y .29 — a **music cue drawn as a caption**. A glyph, not a word, so
the same entry serves all four languages and nothing needs translating.

```json
{
  "x": 0.1,
  "y": 0.29,
  "align": "left",
  "variant": "plain",
  "size": 34,
  "angle": -8,
  "color": "#e8e8e8",
  "fontFamily": "\"Apple Symbols\", \"Segoe UI Symbol\", \"Noto Music\", serif",
  "text": { "en": "𝄞" },
  "audio": "assets/sfx/031e8985…mp3"
}
```

## Where a 𝄞 goes: bottom-left of a panel, every time

One position rule for all four cues, so the reader learns it as furniture rather
than reading it as part of the scene: **x .10, y .29 — the bottom-left corner of
panel 1** (bands are `p1 .02–.33`, `p2 .34–.65`, `p3 .66–.98` on every ep 2
plate).

Why that corner:

- **Nothing else is there.** Every caption in this episode sits in the _top_ band
  of its own panel, hugging an outer edge, so a panel's bottom-left is reliably
  empty. The cue can never land on a balloon.
- **`align: "left"`** matters at x .10. The default `center` puts half the glyph
  past the plate edge; left-aligned, the corner is a corner.
- **Not the bottom-left of the page.** That is the folio's chip — white on solid
  black at `z-index: 33`. A `𝄞` in panel 3's bottom-left would sit on the page
  number. Panel 1 avoids it entirely.

**The trade-off, stated plainly:** `readingOrder` sorts on position, so at y .29
the cue plays _after_ the panel-1 captions rather than before them. On page 3 the
signal text lands and then the music arrives, which is the right order anyway; on
page 9 the swell now follows _There's nothing I can do._ and still precedes
`sshhkk`. If a cue ever has to hit _first_, it needs a smaller `y` than the thing
it underscores — and it then loses the corner. Position beats array order, always:
that is how ep 2 once shipped a lift chime that played after the thought it was
supposed to interrupt.

## The four music cues

| Page | Beat                             | Clip        | Sound                                                  |
| ---- | -------------------------------- | ----------- | ------------------------------------------------------ |
| 3    | the transmission arrives         | `90443126…` | detuned music box, warped tape, rumble under it        |
| 6    | `KRUNCH` — the cart and the grab | `bcf1643c…` | savage string cluster with a metallic scrape, hard cut |
| 9    | the drain                        | `031e8985…` | bowed bass grinding a microtonal cluster, choked off   |
| 12   | the book changes hands           | `d3252e63…` | one dead detuned piano string decaying into sub-bass   |

Pages 3, 9 and 12 are **one motif in three timbres** — music box, strings, dead
piano. The reader does not have to notice consciously; it is what says _this is
the same thing_ across a tower, a lift and a house. Page 6 is deliberately not
the motif: that violence is physical, not occult.

Nothing on pages 4-5 (the three steps _are_ the score), page 7 (no reply is the
page's content), page 10 (three voiced overlays and two title cards already) or
page 13 (the motif's last statement belongs on 12; music after it would be a
second ending).

## Horror is a post pass, not a prompt

The first four cues were prompted politely — "a single low cello note swelling",
"two low piano notes falling a minor third" — and came back as _sad_, not
_frightening_. Library-clean, in tune, no weight underneath. Asking the Sound
Effects API for dread in words gets you a film-score sketch.

What makes them horror is done in ffmpeg afterwards, and it is the same three
moves every time:

```bash
ffmpeg -y -i raw.mp3 -f lavfi -t 3.4 -i "sine=frequency=44:sample_rate=44100" \
  -filter_complex "[0:a]asetrate=44100*0.94,aresample=44100,\
equalizer=f=70:t=q:w=1.2:g=4,aecho=0.8:0.7:180:0.35[a];\
[1:a]volume=-16dB,afade=t=in:d=0.5,afade=t=out:st=2.7:d=0.7[s];\
[a][s]amix=inputs=2:normalize=0:duration=longest[m]" \
  -map "[m]" -codec:a libmp3lame -b:a 192k /tmp/dread.mp3
```

- **Pitch down.** `asetrate=44100*0.94` (0.92 for the dead piano, 0.95 for the
  swell). Six per cent is enough to make an instrument sound like the wrong size
  of instrument, which is the whole trick. It stretches the clip ~6% longer.
- **A sub under it.** A 44 Hz sine at -16 dB, faded in and out, mixed with
  `normalize=0` so it adds weight instead of ducking the music. This is what the
  model never provides and what makes a stab feel like a hit rather than a chord.
- **A tail, or none.** `aecho` at 180-400 ms for the box and the piano; the page 6
  stab gets a compressor instead and **no echo at all** — it has to stop dead, or
  the violence turns into atmosphere.

Then two-pass `loudnorm` to -15 LUFS / -1.5 dBTP with `linear=true`. Three of the
four land at -17 to -19 LUFS because the ceiling caps the gain on peaky content;
`normalise-audio` correctly leaves them alone, and their peaks are at the ceiling,
which is what carries them.

The prompts still matter — the v2 set says _detuned, warped, sinister, metallic
groan, choked off_ — but they set the raw material, not the dread.

The unresolved ending matters: the page after this one is a wrist on a floor and
two silent title cards, so the music has to leave the door open rather than
close the scene.
