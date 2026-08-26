# Erin — cast & running order (manual)

Interactive FlipFrame books. Deep-link pages: `/toons/erin/?page=N` and
`/toons/erin-the-revenge/?page=N` (1-based).

|             |                                                                  |
| ----------- | ---------------------------------------------------------------- |
| Ep 1 config | `content/toons/erin/config.json`                                 |
| Ep 2 config | `content/toons/erin-the-revenge/config.json`                     |
| Lock        | `src/toons/config-lock.json` → `erin` / `erin-the-revenge`       |
| Plate size  | **1152 × 1728** (2:3 portrait) — not the 9:16 others             |
| Prompts     | `docs/story/erin/e1/prompts/` and `docs/story/erin/e2/prompts/`   |
| Skill       | `/erin-toon-page` → `.claude/skills/erin-toon-page/`             |

Episode 1 is **ERIN & THE GOBLINS — the missing CHILD** (Volume 1 Prequel),
**27 plates**, `/toons/erin/`. Erin hunts a kidnapping ring through a crumbling
town, finds goblins behind it, opens a portal and fights the Goblin King, then
walks the child home.

Episode 2 is **The Revenge**, own reader `/toons/erin-the-revenge/`, **21
plates**. Erin tears a portal back into the goblin world to **defeat the Goblin
King**. Venus — a stranger who can move matter — catches her, teaches her, and
walks with her. They name themselves on page 5 (handshake). Captions EN/IT/DE/FR.
New plates carry **no baked lettering**; words live in `config.json` → `words[]`.

Ep-2 voices: `erin`, `venus`, `goblinking` (`scripts/voices.json`). The
goblin rider is `goblinking` pitched **+12%**. Place reverb is `plaza` on
the book, `plaza-deep` on pages 19–20 (`scripts/reverb-types.json`).

## Prompt archive

Reverse-engineered from the **shipped** plates so a re-roll can match. Naming:
`erin-ep1-pNN-<slug>.txt` / `erin-ep2-pNN-<slug>.txt`. No timestamps.

| Episode | Reader                       | Prompts                          |
| ------- | ---------------------------- | -------------------------------- |
| 1       | `/toons/erin/`               | `docs/story/erin/e1/prompts/`    |
| 2       | `/toons/erin-the-revenge/`   | `docs/story/erin/e2/prompts/`    |

When two files share a page number, the one **without** a second slug collision
that matches the config caption is current; older beats keep a distinct slug
(see ep 2 p01 campfire vs sleep, p04 descent vs the old handshake slug now p05).

## Episode 1 — running order (shipped)

| Page | Beats | Prompt |
| ---- | ----- | ------ |
| 1 | Title splash: cave mouth, moon, castle, goblins, daggers | `erin-ep1-p01-title-cave-moon-goblins.txt` |
| 2 | Room, desk, newspaper | `erin-ep1-p02-room-desk-newspaper.txt` |
| 3 | Child photo + clue insets | `erin-ep1-p03-child-photo-clue-stack.txt` |
| 4 | Door → run | `erin-ep1-p04-door-then-run.txt` |
| 5 | Kneel, claw prints, glare | `erin-ep1-p05-kneel-clawprints-glare.txt` |
| 6 | Ambush hands, two kicks | `erin-ep1-p06-ambush-hands-double-kick.txt` |
| 7 | Grab, grin, punch | `erin-ep1-p07-grab-grin-punch.txt` |
| 8 | Goblin down, talisman | `erin-ep1-p08-goblin-down-talisman.txt` |
| 9 | Pack chase, bolt divider | `erin-ep1-p09-alley-pack-bolt-run.txt` |
| 10 | Room, holds talisman | `erin-ep1-p10-room-holds-talisman.txt` |
| 11 | Talisman glow, eye inset | `erin-ep1-p11-talisman-glow-eye-inset.txt` |
| 12 | Steps through a portal in the room | `erin-ep1-p12-room-portal-step.txt` |
| 13 | Forest arch, arrives | `erin-ep1-p13-forest-arch-arrive.txt` |
| 14 | Forest walk, cave mouth | `erin-ep1-p14-forest-then-cave-mouth.txt` |
| 15 | Surrounded, kick | `erin-ep1-p15-cave-surrounded-kick.txt` |
| 16 | Spin, punch, ring of goblins | `erin-ep1-p16-spin-punch-glare-ring.txt` |
| 17 | Throne approach, two faces | `erin-ep1-p17-throne-approach-two-faces.txt` |
| 18 | Splash punch vs King | `erin-ep1-p18-splash-punch-king.txt` |
| 19 | King down, crawls, laughs | `erin-ep1-p19-king-down-crawls-laughs.txt` |
| 20 | Fight grid, King flees | `erin-ep1-p20-fight-grid-then-flee.txt` |
| 21 | Silhouette, shout | `erin-ep1-p21-silhouette-then-shout.txt` |
| 22 | Empty tunnel | `erin-ep1-p22-empty-tunnel-search.txt` |
| 23 | Child runs free | `erin-ep1-p23-child-runs-free.txt` |
| 24 | Find the child | `erin-ep1-p24-find-child-four-panels.txt` |
| 25 | Home at night, a goblin watches | `erin-ep1-p25-home-night-goblin-watch.txt` |
| 26 | Walk into the dark | `erin-ep1-p26-walk-into-dark-end.txt` |
| 27 | Character sheet, arches | `erin-ep1-p27-sheet-arches-insets.txt` |

Daggers only on page 1. Interior Erin fights bare-handed. Title/end lettering is
FlipFrame overlay, not baked in (legacy exceptions noted in the skill).

## Episode 2 — running order (reader)

Config order today (`content/toons/erin-the-revenge/config.json`):

| Page | Beats | Prompt |
| ---- | ----- | ------ |
| 1 | Portal → forest walk → sleep + eyes (no campfire) | `erin-ep2-p01-portal-forest-sleep-eyes.txt` |
| 2 | Aerial carry / claw through jacket / face ECU | `erin-ep2-p02-gargoyle-carry-claw-tear-face.txt` |
| 3 | Canopy / break free / dirt platform | `erin-ep2-p03-aerial-break-dirt-platform.txt` |
| 4 | Venus lowers Erin on the dirt platform | `erin-ep2-p04-platform-descent-venus.txt` |
| 5 | They name themselves (handshake), walk, gargoyle dives | `erin-ep2-p05-handshake-walk-gargoyle-dive.txt` |
| 6 | Erin punches the gargoyle; Venus traps the pieces | `erin-ep2-p06-erin-punch-venus-earthform.txt` |
| 7 | She felt Erin’s door; lifts a boulder; Erin asks to be taught | `erin-ep2-p07-venus-meet-boulder.txt` |
| 8 | Climb, army + castle, both using power | `erin-ep2-p08-climb-army-powers.txt` |
| 9 | Rider reports; King slams the floor; rider ECU | `erin-ep2-p09-throne-fist-rider-terror.txt` |
| 10 | Chasm, Erin punches a goblin, gates | `erin-ep2-p10-chasm-punch-gates.txt` |
| 11 | King on the wall, Erin’s eye, gargoyles on pillars | `erin-ep2-p11-king-battlement-eye-gargoyles.txt` |
| 12 | King leaps, throws a column, Venus raises a wall | `erin-ep2-p12-king-leap-column-venus-wall.txt` |
| 13 | Column vs dirt cone | `erin-ep2-p13-column-dirt-block.txt` |
| 14 | Boulder, Erin catches, King blasted | `erin-ep2-p14-boulder-catch-king-blast.txt` |
| 15 | King comes back — knee, black eyes (generate_scene 13) | `erin-ep2-p15-king-knee-black-eyes.txt` |
| 16 | King hits Erin (generate_scene 12) | `erin-ep2-p17-king-final-blow.txt` |
| 17 | Erin white-eyes, dirt spear (generate_scene 16) | `erin-ep2-erin-white-eyes-dirt-spear.txt` |
| 18 | Army flees, King down | `erin-ep2-p15-army-flees-king-down.txt` |
| 19 | Erin glows; Venus holds the King on a slab | `erin-ep2-p16-erin-glow-eyes-venus-slab.txt` |
| 20 | Erin opens a portal; King falls in | `erin-ep2-p17-portal-vortex-king-falls.txt` |
| 21 | King in the spiral; goblins hide; both smiling | `erin-ep2-p18-king-spiral-goblins-hide-smile.txt` |

From page 2 on, Erin’s **left shoulder seam is torn**. Jacket stays that way.

Forest-stretch captions (do not re-invent): p4 *She's flying this. / Stay on
it. / Don't miss. / I don't.* · p5 *Erin. I'm here for the King. / Venus. Then
you don't go alone. / FWOOSH / Move!* · p6 *Stay behind me. / WHAMM / I've got
the pieces.* · p7 *You caught me. / I felt your door. / The ground can answer
you. / Then teach me.* · p8 *Almost. / I know the way. / That's the whole
army. / That's his house. / Together. Push the earth down.*
Climax: p15 *Not done. / Fog her eyes.* · p16 *Stay down. / KRAKK / Erin—!* ·
p17 *Get off me. / SKRRK* · p18 *The King! / Nnh— I need the known! / Nnh— give me my krown! / Get up! / On your feet, King!* · p19 *This time you stay. / I'll hold
him.* · p20 *Doors go both ways. / This one is mine. / NO—!* · p21 *AAAAAH—! / Race you
home.*

## Characters

### Erin

Teenage protagonist: pale, short choppy dark bob with a straight fringe, large
sharp eyes, black zip-up track jacket, black trousers with a thin side stripe,
black combat boots. Fights bare-handed (daggers on ep 1 page 1 only). Never
long hair, never a skirt, never armour.

- Sheet plate: `toons/erin/assets/c363b4d490e8b574c61f92716bdc7dd4.jpg`
- Voice lock: `erin` (`esy0r39YPLQjOczyOib8`)
- Ep 2: she learns to **move matter** — stone, soil and wood. Drawn as ink
  (suspended fragments, white seams, grit), never sparkle or lightning.

### Venus (ep 2)

Mentor. Named for the planet and its metal, copper. Calm, unhurried, faintly
luminous. Pin her from the reference — do not paraphrase the face.

- Long dark hair, pale headband, dark frog-button tunic, star-buckle belt
- Voice lock: `venus` (`4tRn1lSkEn13EVTuqb0g`)
- Named on page 5 (“Venus.”). She felt Erin’s door, drives the dirt platform
  (page 4), traps the shattered gargoyle in dirt and roots (page 6 — not a
  second creature), teaches the ground (page 7), walks with Erin against the
  King

### The gargoyle

Winged stone beast twice Erin’s size: cracked granite hide, blunt horned brow,
blank pale glowing eyes, heavy ribbed bat wings, four clawed talons per hand.
A statue made flesh — not a dragon, not a demon. Goblin **mount**. Erin
breaks it on page 6; Venus traps the pieces in dirt and roots (caption:
“I've got the pieces.”).

### Goblin rider

One standard ep-1 goblin on the gargoyle’s shoulders. It grabs; the gargoyle
carries. Voice: `goblinking` pitched +12%.

## Full cast and world locks

`.claude/skills/erin-toon-page/references/erin-lock.md` — character, goblin,
Goblin King, world and **panel-border** vocabulary, from the shipped plates.
