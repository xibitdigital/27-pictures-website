# Nero — cast & synopsis (manual)

Interactive FlipFrame short. Deep-link pages: `/toons/nero/?page=N`.

## Synopsis

In a rain-soaked city of wetwork and wet labs, detective **Nero** — ex-military, one hand lost to a terrorist attack and rebuilt in steel — follows a trail of blood and crystal. His ally **Eve**, a Scotland Yard forensic specialist whose AI-enhanced glasses can tag faces and materials, reads the evidence he cannot. Between them stands **The Dog**: a cold-blooded sicario who never misses. Together Nero and Eve must crack the crystal case, hunt The Dog through the rooftops and the lab, and uncover who hired the bullet — and what near-invisible implant tech it was meant to protect.

## Characters

### Nero

Detective and **ex-military**. Lost a hand in a **terrorist attack** and now fights with a heavy **prosthetic cyber arm**. Hard-edged, street-smart, still capable of being surprised (and charmed). Carries the case: the crystal, the crime scene, the hunt.

- Voice lock: `nero` in `scripts/jax-voices.json`

### Eve

**Forensic specialist** and Nero’s friend; works for **Scotland Yard**. Lab coat by day, field suit and **AI-enhanced glasses** when the case leaves the lab. Glasses can **tag faces and materials**. Professional, sharp, the scientific half of the pair.

- Voice lock: `eve`

### The Dog

The **sicario** — cold-blooded contractor, white-haired rooftop sniper. Not the final boss of the story so much as the weapon aimed at Nero; the deeper question is **who hired him** and what the implant material is for.

- Voice lock: `thedog`

### Nova (Nero’s inner AI)

HUD analysis on crystals / chips (composition, Si spin qubits, fab density, near-invisible implants). System voice, not a face on the page.

- Voice lock: `nova`

## Story spine (so far)

1. Nero engages in the alley / finds the gun / prepares for the night.
2. The Dog takes the shot from the rooftop; Nero is hit.
3. Nero hears the bang, finds a victim, recovers a **crystal** (germanium + unknown).
4. He goes to **Scotland Yard** to **ask Eve**.
5. Lab scan: **silicon spin qubits**, CMOS + photonics, fab-density **brain-implant** tech.
6. Eve drops the lab costume, activates her glasses, and they leave together to hunt denser ghosts.

## Captions / audio

Edit `content/toons/nero/config.json` → publish:

```bash
npm run publish-toon-config -- --toon nero
```

Bubble tail orientation: `"bubble": { "tail": "left" }`
(`none` | `bottom` | `bottom-left` | `bottom-right` | `left` | `right`)
