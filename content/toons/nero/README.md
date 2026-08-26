# Nero — cast & synopsis (manual)

Interactive FlipFrame short. Deep-link pages: `/toons/nero/?page=N` (1-based).

|             |                                                  |
| ----------- | ------------------------------------------------ |
| Config      | `content/toons/nero/config.json` → publish to R2 |
| Lock        | `src/toons/config-lock.json` → `nero` key        |
| Design size | 800 × 1424 (portrait)                            |
| Pages       | **20** (including time-gap plate)                |

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

- Voice lock: `eve` (`jv41DhCf464zw0TI7I1w`)

### The Dog

The **sicario** — cold-blooded contractor, pale hair, rooftop sniper. Not the final boss so much as the weapon aimed at the case; the deeper question is **who hired him** and what the implant material is for.

- Voice lock: `thedog`

### Nova (Nero’s inner AI)

HUD analysis on crystals / chips (composition, Si spin qubits, fab density, near-invisible implants). System voice, not a face on the page.

- Voice lock: `nova`

## Page map (reading order)

| `#`    | Beat                              | Notes                                                                                                                                              |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Nero — alley / eye / rooftop      | “Wrong alley. Right hunt.” / “On the roof.” / “Your move.”                                                                                         |
| 2      | Break-in / drawer / gun           | “I'm through.” / “Come on… where is it.” / “There you are.”                                                                                        |
| 3      | Bench / load / fire               | “Steady hands.” / “You're done.”                                                                                                                   |
| **4**  | **Time gap**                      | Diagonal plate: black title zone + city from above. Captions: **HOURS EARLIER** · **THE DOG** · subline. Flashback: Dog’s story **before** page 3. |
| 5      | The Dog — rooftop / scope / alley | “Found you.”                                                                                                                                       |
| 6      | Shot / blood / dead hand          | BANG / Paid. / THUD…                                                                                                                               |
| 7      | Nero — bang / victim / crystal    | Composition HUD (germanium + unknown)                                                                                                              |
| 8      | Scotland Yard run / gates         | “I'll ask Eve.”                                                                                                                                    |
| 9      | Lab with Eve                      | Si spin qubits / CMOS + photonics / implants                                                                                                       |
| 10     | Eve drops coat, glasses, leave    | AI glasses tag faces & materials                                                                                                                   |
| **11** | **Cybercab**                      | Eve hails driverless cab → both jump in → ECU faces inside                                                                                         |
| **12** | **Cerberus club**                 | Drop-off → Eve distracts bouncer → Nero invites Eve in                                                                                             |
| **13** | **Cerberus interior**             | Floor crowd → bar / bartender → grand staircase                                                                                                    |
| **14** | **Upstairs room**                 | Eve's glasses scan → fingerprint on the door handle → Nero reads traces on the floor                                                               |
| **15** | **Ambush**                        | Door kicked in, suppressed rifle → Nero shoves Eve clear, steel forearm up → bullet strikes the plating                                            |
| **16** | **Knife**                         | Nero draws from the waistband → blade in flight, shooter small in the doorway → hit in the neck gap above the vest                                 |
| **17** | **Unmasked**                      | Mask pulled off → the shooter is the Cerberus **bartender** → Nero lifts a blank keycard from his vest                                             |
| **18** | **Exit**                          | Hallway sprint to the glass → Nero's steel fist shatters the pane → both leap into the rainy night                                                 |
| **19** | **Wall grab**                     | Nero decelerates freefall — steel fingers gouge the wall → drops Eve under a bar awning → both run into a dark alley                               |
| **20** | **Scan / sniper**                 | Face to face after the alley → Eve's glasses scan the tower → window silhouette: The Dog (the killer) with the rifle                               |
| **21** | **The shot**                      | Muzzle flash upper floors → Nova reads the vector onto **Eve** and rotates Nero into it → round takes his chest off-midline → Eve drags him behind the corner |
| **22** | **Field dressing**                | Nero down against the alley wall hands Eve his army sealing gel → her glasses read the wound: through and through → she seals it |
| **23** | **On his feet**                   | Eve's hand on his face, wet eyes → Nero's tired smile through the pain → she hauls him upright and the hunt resumes |
| **24** | **End card**                      | Diagonal interstitial mirroring page 4 — city above, black field below: TO BE CONTINUED / NERO WILL RETURN |

Asset for page 1: `assets/d9643190ccde94ebf82c2561090644ce.webp` (bottom panel replaced: wide alley shot instead of a fist close-up, to sidestep a six-finger render defect).
Asset for page 4: `assets/983a7f6b83ae216b4684f7c0356ebcf4.webp` (diagonal interstitial).
Asset for page 24: `assets/678ffb170688a90be29a2f76cfaba6c3.webp` (same interstitial construction, diagonal flipped so the black title field sits at the bottom; captions use the `credit` variant).

The two interstitials (pages 4 and 24) are read by the `narrator` voice — every caption in the book now has audio.
Asset for page 11: `assets/0f70a3aaea8fd95c39f61142401d7cd4.webp`.
Asset for page 21: `assets/5c667e7cf56667d4e424bc1f9980d04f.webp` (4 panels — the only Nero plate that is not 3; re-rolled several times over Nero's right arm, which the model keeps drawing as a full prosthetic in camera-facing shots instead of flesh-to-the-wrist).
Asset for page 22: `assets/c569fead7ea4659652cc2aa39a28704e.webp` (re-rolled; an earlier pass drew entry and exit on the same visible surface).
Asset for page 23: `assets/410c1237863c5d55ac9a98815615646c.webp` (shot/reverse ECU pair, then the wide; re-rolled plate, captions kept via `npm run swap-page`).

## Reader UX

- **Desktop cover:** title → story (scrollable column) → FlipFrame → how to read.
- **Mobile / vertical scroll:** story + how-to as a **popup** once per session; toolbar **Story** button reopens it (`CoverGuideDialog`).
- **Captions:** tap for audio; organic bubbles point with a top-level `"tail": "left"` (all eight directions). Size, padding, wrap width and the 0.75/5 chrome are defaults — see `content/toons/README.md`.
- **SFX onomatopoeia:** plain text + white stroke (not bubble), same as Jax.

## Captions / audio workflow

```bash
# Edit words in content/toons/nero/config.json
npm run publish-toon-config -- --toon nero

# New plate
make add-image SRC=~/Downloads/page.png TOON=nero UPLOAD=1
# then edit config pages[] order / captions, publish again

# Voice (always --toon nero so the clip lands under asset-page-dir)
set -a; source .env; set +a
python3 scripts/generate-jax-voice.py "Line." --voice nero --toon nero   # or eve | thedog | nova

# Emotional line — audio tags need Eleven v3 (multilingual_v2 ignores them)
python3 scripts/generate-jax-voice.py "[gasps] [scared] Nero—!" \
  --voice eve --toon nero --model eleven_v3 --stability 0.3
# Display text in config stays clean ("Nero—!"); tags are TTS input only

npm run upload-assets
npm run publish-toon-config -- --toon nero
```

| Flag                   | Notes                                                      |
| ---------------------- | ---------------------------------------------------------- |
| `--toon nero`          | Required — writes `public/toons/nero/assets/sfx/<md5>.mp3` |
| `--model eleven_v3`    | Required for `[scared]`, `[worried]`, `[gasps]`, …         |
| `--stability 0.2–0.35` | More expressive / tag-responsive (Creative–Natural)        |

Bubble tails: `none` | `bottom` | `bottom-left` | `bottom-right` | `top` | `top-left` | `top-right` | `left` | `right`
(Use a `top*` tail when the speaker is _below_ the bubble. Unknown values silently fall back to `bottom`.)

## Replacing or adding one page's plate (WebP + watermark, no `public/`)

`make add-image` is for _new_ JPG/PNG pages with the classic `--config`
append flow. For a single WebP page **swap** or **append** — watermark, WebP,
content hash, straight to R2, update `config.json` — use the one-shot script.
It cannot **insert** mid-list (`PAGE=4` replaces page 4). Recipe for that,
flatten, and `TOON` slugs: Claude.md → “Adding a new toon page image”.

```bash
# Replace page 1's art, keeping its existing captions
node scripts/swap-toon-page.js ~/Downloads/new-plate.png --toon nero --page 1
# or: make swap-page SRC=~/Downloads/new-plate.png TOON=nero PAGE=1

# Omit --page (or pass count+1) to append a brand new page instead
node scripts/swap-toon-page.js ~/Downloads/new-plate.png --toon nero

# See what it would do first — writes and uploads nothing
node scripts/swap-toon-page.js ~/Downloads/new-plate.png --toon nero --page 1 --dry-run

# Publish the config to R2 in the same run instead of doing it separately
node scripts/swap-toon-page.js ~/Downloads/new-plate.png --toon nero --page 1 --publish
```

It warns (doesn't block) if the source's dimensions don't match the book's
`designWidth`/`designHeight`, replaces `pages[N-1].file` while leaving that
page's `words[]` untouched, and — without `--publish` — prints the
`publish-toon-config` command instead of running it, so a batch of edits can
be reviewed before going live. It never touches `public/toons/<toon>/assets/`
— that directory is dev-serving + `add-image` staging only, not a CDN detour.

**Captions don't move themselves.** Replacing a page's art keeps its old
`x`/`y` positions; if the new plate's panel gutters land somewhere else,
captions can drift onto the wrong panel or a face. Check before trusting them:

```bash
magick new-plate.png -colorspace gray -resize 1x1424! -depth 8 txt:- \
  | awk -F'[(),]' 'NR>1 && $2<30 {print}'   # rows darker than 30/255 = likely gutter
```

Compare against the old plate's bands (same command) — if they differ by
more than a few px, reposition the affected captions by hand (there's no
script for this yet).

Superseded R2 objects are **not** deleted automatically — `swap-toon-page.js`
prints the old key as a note. They're orphaned but harmless until purged
(see `scripts/purge-r2-objects.js`, and keep a `npm run backup-cdn` snapshot
before deleting anything from R2 — it's irreversible).

For converting a _whole toon's_ existing plates to WebP in bulk (not a
one-off swap), see `scripts/convert-toon-plates.js`
(`make convert-plates TOON=nero`) instead — it works from `cdn-backup/`
and can hash + upload every page in one pass with `--upload`.
Asset for page 12: `assets/1b47ed56a7bf10c527e7b62ef3dd14ca.webp` (panels 2–3 mirrored).
Asset for page 13: `assets/abca70594fb25e9ba093ba48d3965938.webp` (Victorian + holo Cerberus interior).
Asset for page 14: `assets/94c4ceac33c898f4ad5bfb3a2d861a78.webp` (upstairs room, forensic scan).
Asset for page 15: `assets/5bb0e9e737adc372181810c9f89a3272.webp` (ambush; panels 2–3 split on a diagonal).
Asset for page 16: `assets/72089337f0ac4334436127317b9f81fa.webp` (knife throw; straight horizontal panels).
Asset for page 17: `assets/3124bcdc7106f49cf07712c411e44cfd.webp` (unmasking; the bartender is the shooter).
