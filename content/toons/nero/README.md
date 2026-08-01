# Nero — cast & synopsis (manual)

Interactive FlipFrame short. Deep-link pages: `/toons/nero/?page=N` (1-based).

| | |
|--|--|
| Config | `content/toons/nero/config.json` → publish to R2 |
| Lock | `src/toons/config-lock.json` → `nero` key |
| Design size | 800 × 1424 (portrait) |
| Pages | **10** (including time-gap plate) |

## Synopsis

In a rain-soaked city of wetwork and wet labs, detective **Nero** — ex-military, one hand lost to a terrorist attack and rebuilt in steel — follows a trail of blood and crystal. His ally **Eve**, a Scotland Yard forensic specialist whose AI-enhanced glasses can tag faces and materials, reads the evidence he cannot. Between them stands **The Dog**: a cold-blooded sicario who never misses. Together Nero and Eve must crack the crystal case, hunt The Dog through the rooftops and the lab, and uncover who hired the bullet — and what near-invisible implant tech it was meant to protect.

The same prose is on the **front cover** (`coverSynopsis` in `NeroApp.vue`) and in the **mobile Story guide** popup.

## Characters

### Nero

Detective and **ex-military**. Lost a hand in a **terrorist attack** and now fights with a heavy **prosthetic cyber arm**. Hard-edged, street-smart, still capable of being surprised (and charmed). Carries the case: the crystal, the crime scene, the hunt.

- Voice lock: `nero` in `scripts/jax-voices.json`

### Eve

**Forensic specialist** and Nero’s friend; works for **Scotland Yard**. Lab coat by day, field suit and **AI-enhanced glasses** when the case leaves the lab. Glasses can **tag faces and materials**. Professional, sharp, the scientific half of the pair.

- Voice lock: `eve` (`fgDJOgmENIR82PueQrVs`)

### The Dog

The **sicario** — cold-blooded contractor, pale hair, rooftop sniper. Not the final boss so much as the weapon aimed at the case; the deeper question is **who hired him** and what the implant material is for.

- Voice lock: `thedog`

### Nova (Nero’s inner AI)

HUD analysis on crystals / chips (composition, Si spin qubits, fab density, near-invisible implants). System voice, not a face on the page.

- Voice lock: `nova`

## Page map (reading order)

| `#` | Beat | Notes |
|-----|------|--------|
| 1 | Nero — alley / eye / punch | “Wrong alley.” |
| 2 | Break-in / drawer / gun | “No more hiding.” |
| 3 | Bench / load / fire | “Steady hands.” / “You're done.” |
| **4** | **Time gap** | Diagonal plate: black title zone + city from above. Captions: **HOURS EARLIER** · **THE DOG** · subline. Flashback: Dog’s story **before** page 3. |
| 5 | The Dog — rooftop / scope / alley | “Found you.” |
| 6 | Shot / blood / dead hand | BANG / Paid. / THUD… |
| 7 | Nero — bang / victim / crystal | Composition HUD (germanium + unknown) |
| 8 | Scotland Yard run / gates | “I'll ask Eve.” |
| 9 | Lab with Eve | Si spin qubits / CMOS + photonics / implants |
| 10 | Eve drops coat, glasses, leave | AI glasses tag faces & materials |

Asset for page 4: `assets/f6e5abea5751b52ecd7f6fc07c40dbb4.png` (diagonal interstitial).

## Reader UX

- **Desktop cover:** title → story (scrollable column) → FlipFrame → how to read.
- **Mobile / vertical scroll:** story + how-to as a **popup** once per session; toolbar **Story** button reopens it (`CoverGuideDialog`).
- **Captions:** tap for audio; organic bubbles support `"bubble": { "tail": "left" }` etc.
- **SFX onomatopoeia:** plain text + white stroke (not bubble), same as Jax.

## Captions / audio workflow

```bash
# Edit words in content/toons/nero/config.json
npm run publish-toon-config -- --toon nero

# New plate
make add-image SRC=~/Downloads/page.png TOON=nero UPLOAD=1
# then edit config pages[] order / captions, publish again

# Voice
set -a; source .env; set +a
python3 scripts/generate-jax-voice.py "Line." --voice nero   # or eve | thedog | nova
# copy mp3 under public/toons/nero/assets/sfx/ if generated under jax
npm run upload-assets
```

Bubble tails: `none` | `bottom` | `bottom-left` | `bottom-right` | `left` | `right`
