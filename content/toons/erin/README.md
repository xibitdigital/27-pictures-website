# Erin — cast & running order (manual)

Interactive FlipFrame book. Deep-link pages: `/toons/erin/?page=N` (1-based).

|             |                                                     |
| ----------- | --------------------------------------------------- |
| Config      | `content/toons/erin/config.json` → publish to R2     |
| Lock        | `src/toons/config-lock.json` → `erin` key           |
| Plate size  | **1152 × 1728** (2:3 portrait) — not the 9:16 others |
| Episode 1   | **27 pages**, shipped                               |
| Prompts     | `/erin-toon-page` skill, `.claude/skills/erin-toon-page/` |

Episode 1 is **ERIN & THE GOBLINS — the missing CHILD** (Volume 1 Prequel):
Erin hunts a kidnapping ring through a crumbling town, finds goblins behind it,
opens a runic portal and fights her way to the Goblin King.

Episode 2 ships as its **own reader**: `/toons/erin-ep2/`, config
`content/toons/erin-ep2/config.json`, app `src/toons/erin-ep2/`. Ten plates
staged locally; **not uploaded to R2 and not published** yet.

## Episode 2 — running order (in progress)

Working on branch `erin-ep-2`. New plates carry **no baked lettering**; all
words land later as FlipFrame overlays in `config.json` → `words[]`.

| Page | Beats | Border | Prompt |
| ---- | ----- | ------ | ------ |
| **1** | Erin tears a portal open → steps into deep forest, alone → asleep by a campfire, a pair of glowing eyes in the bushes | Lightning-bolt outline on the portal panel | `erin-toon-page-portal-forest-campfire-eyes-20260814-111553.txt` |
| **2** | Single splash: the gargoyle's stone talons clamp both of Erin's shoulders and lift her off the ground, a goblin riding its shoulders; her face in pain | Full-bleed splash, no keyline | `erin-ep2-p02-gargoyle-claws-kidnap-splash-20260814-112624.txt` |
| **3** | Aerial over the gargoyle's shoulder above the canopy → Erin wrenches the talons off and breaks free → a dirt platform assembles in mid-air and catches her fall | Zigzag bolt slash as the gutter before the impact | `erin-ep2-p03-aerial-break-free-dirt-platform-20260814-113524.txt` |
| **4** | Erin's POV down off the platform edge: Venus below, arms raised, holding it up → close on Venus straining → the two meet, Erin thanks her without words | Middle panel a slanted wedge band | `erin-ep2-p04-venus-holds-platform-thanks-20260814-115321.txt` |

Unplaced drafts (written, not yet assigned a page):

- **Venus teaches matter** — forest clearing, Venus demonstrates matter
  manipulation, Erin lifts her first pebble
  (`erin-toon-page-forest-venus-shows-erin-matter-20260813-135839.txt`).
  Now belongs **after page 4**: the platform is Venus's doing, so Erin has no
  power of her own until Venus teaches her. Keep page 3's catch ambiguous —
  the reveal is page 4.

Superseded drafts, safe to delete:

- `erin-toon-page-portal-forest-gargoyle-capture-20260813-202342.txt`
- `erin-toon-page-gargoyle-claws-fall-campfire-eyes-20260813-202751.txt`
  (its beats are now split across pages 1 and 3)
- `erin-ep2-p02-goblin-rider-kidnap-drone-flight-20260814-111310.txt`
  (the drone view is now page 3's top panel)

## Characters

### Erin

Teenage protagonist, unchanged from episode 1: pale, short choppy dark bob with
a straight fringe, large sharp eyes, black zip-up track jacket, black trousers
with a thin side stripe, black combat boots. Fights bare-handed. Never long
hair, never a skirt, never armour.

- Sheet plate: `toons/erin/assets/c363b4d490e8b574c61f92716bdc7dd4.jpg`
- Voice lock: `erin` (`esy0r39YPLQjOczyOib8`)
- New in ep 2: she can **move matter** — stone, soil and wood lift and re-form
  at her hand. Drawn as ink (suspended fragments, white seams, grit), never as
  sparkle or lightning.

### Venus

Mentor figure who teaches Erin to manipulate matter. Named for the planet and
its alchemical metal, copper. Calm, unhurried, faintly luminous. Identity comes
from the user's reference image — do not describe her face in prose, pin it.

- Voice lock: `venus` (`4tRn1lSkEn13EVTuqb0g`)

### The gargoyle

Winged stone beast twice Erin's size: cracked grey granite hide with moss in
the crevices, blunt horned brow, blank pale glowing eyes, heavy ribbed bat
wings, four clawed talons per hand, stone dust flaking off it in motion. A
carved statue made flesh — not a dragon, not a demon. Used as a **mount** by
the goblins.

### Goblin rider

One goblin, standard ep-1 design (warty knobbed skull, pointed ears, bulging
pale eyes, fanged grin, ragged rags), riding hunched on the gargoyle's
shoulders. It does the grabbing; the gargoyle does the carrying.

## Full cast and world locks

`.claude/skills/erin-toon-page/references/erin-lock.md` — character, goblin,
Goblin King, world and **panel-border** vocabulary, all derived from the
shipped plates.
