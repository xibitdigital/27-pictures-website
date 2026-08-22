# EP 2, page 1 — captions

Plate: Marcus seated at his desk at night, Halina in the doorway, the popup on
his laptop. Reference id `021787215296407124404eabe9b927fceaa7c0eaca8bf7ac61c87`.

## The idea

**He is warm, and he does not know her name.** She calls him *sir*; he calls her
nothing at all, because nobody in that building knows what she is called. That
asymmetry is free — it costs one word of dialogue and characterises both of them
permanently.

He also asks how she is **and waits for the answer**, which is what makes him
likeable and what will make episode 2 unbearable. Nothing in this page is wrong
with him.

Her reply is the deflection working people give to a boss who asks: pleasant,
closed, already moving on.

Panel 3 has **no dialogue.** The only thing on it is the sound of the popup
opening — and per the entity's rules, sound is the tell and the image is the
harm. He is turned away. The reader is the only one who sees it.

## Read order

Auto-read follows position. The narrator sits top-left of panel 1
(*NEXORA. After hours.*) so it lands before *Evening.* — same row, smaller x.

## words[]

```json
"words": [
  {
    "x": 0.5, "y": 0.075, "align": "center", "size": 22,
    "variant": "bubble", "color": "#111111", "angle": -2,
    "scale": 1.0, "maxWidth": 0.34,
    "bubble": { "opacity": 0.75, "strokeWidth": 5, "tail": "bottom-left" },
    "text": {
      "en": "Evening.",
      "it": "Buonasera.",
      "de": "Guten Abend.",
      "fr": "Bonsoir."
    },
    "audio": "assets/sfx/441637ea16d70f9faffdabc425941f13.mp3"
  },
  {
    "x": 0.5, "y": 0.155, "align": "center", "size": 22,
    "variant": "bubble", "color": "#111111", "angle": 1,
    "scale": 1.0, "maxWidth": 0.38,
    "bubble": { "opacity": 0.75, "strokeWidth": 5, "tail": "bottom-left" },
    "text": {
      "en": "How are you keeping?",
      "it": "Come sta?",
      "de": "Wie geht es Ihnen?",
      "fr": "Comment allez-vous ?"
    },
    "audio": "assets/sfx/9f865da32030145c979638085b05ab36.mp3"
  },
  {
    "x": 0.2, "y": 0.39, "align": "center", "size": 22,
    "variant": "bubble", "color": "#111111", "angle": -3,
    "scale": 1.0, "maxWidth": 0.32,
    "bubble": { "opacity": 0.75, "strokeWidth": 5, "tail": "bottom-right" },
    "text": {
      "en": "Can't complain, sir.",
      "it": "Non mi lamento, signore.",
      "de": "Ich kann nicht klagen, mein Herr.",
      "fr": "Je ne me plains pas, monsieur."
    },
    "audio": "assets/sfx/6b03b2c50b2cc8c2a1183ffa8379c69f.mp3"
  },
  {
    "x": 0.79, "y": 0.43, "align": "center", "size": 20,
    "variant": "bubble", "color": "#111111", "angle": 2,
    "scale": 0.95, "maxWidth": 0.3,
    "bubble": { "opacity": 0.75, "strokeWidth": 5, "tail": "bottom-left" },
    "text": {
      "en": "I won't be long.",
      "it": "Faccio in fretta.",
      "de": "Ich bin gleich fertig.",
      "fr": "Je ne serai pas longue."
    },
    "audio": "assets/sfx/b7013fea7d05716aa27f2d54521417bc.mp3"
  },
  {
    "x": 0.22, "y": 0.72, "align": "center", "size": 26,
    "variant": "burst", "color": "#ffffff", "angle": -6,
    "scale": 1.0, "maxWidth": 0.28,
    "bubble": { "opacity": 0.75, "strokeWidth": 5, "stroke": "#ffffff", "strokeThickness": 8 },
    "text": { "en": "TIC", "it": "TIC", "de": "TIC", "fr": "TIC" },
    "audio": "assets/sfx/acc7102c4f71dc864f6d1109d85bf686.mp3"
  }
]
```

## Placement notes

Panel bands on this plate, measured: **p1 .034–.33**, **p2 .35–.67**,
**p3 .69–.98**. Every caption sits in the top band of its own panel and hugs an
outer edge.

- *NEXORA. After hours.* is `credit`, x .18 y .05, over the night window —
  no tail, narrator. Names the company as the place.
- Marcus's two lines sit centre-right of panel 1 over the dark glass, tails
  **bottom-left** toward his seated head at roughly x .28.
- Halina's first line is far left over the dark doorframe, tail
  **bottom-right** toward her face at about x .45 — never across it.
- Her second line goes right, tail **bottom-left**, clear of the cart.
- The chime sits left of the laptop in panel 3 over black, no tail: it comes from
  the machine, not from a mouth. White lettering with a white stroke so it lifts
  off the dark plate.

## Audio to generate

```bash
set -a; source .env; set +a
python3 scripts/generate-jax-voice.py "[softly] Evening." \
  --voice marcus --toon redsmile-marcus --model eleven_v3 --stability 0.4
python3 scripts/generate-jax-voice.py "How are you keeping?" \
  --voice marcus --toon redsmile-marcus --model eleven_v3 --stability 0.4
python3 scripts/generate-jax-voice.py "Can't complain, sir." \
  --voice halina --toon redsmile-marcus --model eleven_v3 --stability 0.5
python3 scripts/generate-jax-voice.py "[softly] I won't be long." \
  --voice halina --toon redsmile-marcus --model eleven_v3 --stability 0.5
```

Marcus is warm and unhurried, never arch. Halina is low, flat, polite, tired —
higher stability so she does not perform. Neither takes the `ai`/`badai` metallic
chain.

The chime is **not** a voice line: it comes from `scripts/generate-jax-sfx.py`
(Sound Effects API), slug `redsmile-ep2-popup-tic` — a single dry UI
notification tick, no music. Ask for **0.8s and "loud, dry, close"**: the first
take, worded *soft* at 0.4s, returned -60 dB mean and was inaudible under
playback. Then level everything with
`npm run normalise-audio -- redsmile-marcus`.
