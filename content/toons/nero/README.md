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

- **Cyberware is asymmetric.** The **left arm** is steel from the **elbow down** — bare cracked-porcelain upper arm under a dark pauldron, segmented steel forearm, articulated metal fingers. The **right arm** is ordinary flesh ending in a **cybernetic hand**, prosthetic from the wrist down.
- Never a third arm, never two chrome forearms, never a flesh left hand. Sides are set by the `nero.png` key art: facing camera, the steel forearm reads on the viewer's right, i.e. his anatomical left. Pin this in every image prompt.
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
| **11** | **Cybercab** | Eve hails driverless cab → both jump in → ECU faces inside |
| **12** | **Cerberus club** | Drop-off → Eve distracts bouncer → Nero invites Eve in |
| **13** | **Cerberus interior** | Floor crowd → bar / bartender → grand staircase |
| **14** | **Upstairs room** | Eve's glasses scan → fingerprint on the door handle → Nero reads traces on the floor |
| **15** | **Ambush** | Door kicked in, suppressed rifle → Nero shoves Eve clear, steel forearm up → bullet strikes the plating |

Asset for page 4: `assets/f6e5abea5751b52ecd7f6fc07c40dbb4.png` (diagonal interstitial).
Asset for page 11: `assets/8c0cf8ac2ade39ab94d5754fb0381887.jpg`.

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

Bubble tails: `none` | `bottom` | `bottom-left` | `bottom-right` | `top` | `top-left` | `top-right` | `left` | `right`
(Use a `top*` tail when the speaker is *below* the bubble. Unknown values silently fall back to `bottom`.)
Asset for page 12: `assets/46d12d33ef9b8f743d479fc841e00f3d.png` (panels 2–3 mirrored).
Asset for page 13: `assets/9259129bcd03fb78b3d9f4b3ce022057.png` (Victorian + holo Cerberus interior).
Asset for page 14: `assets/97ee861fbf230ef8c8a143aceb412883.png` (upstairs room, forensic scan).
Asset for page 15: `assets/4cd4970454d400d7a90f6345b1fcaf60.png` (ambush; panels 2–3 split on a diagonal).
