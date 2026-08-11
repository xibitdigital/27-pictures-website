# RED SMILE: static

Black-and-white horror short in the **RED SMILE** series. FlipFrame reader at
`/toons/redsmile-static/`.

**Logline:** Elena waits alone at home. A strange image flickers on the TV.
Something starts watching back.

| Item      | Value                                              |
| --------- | -------------------------------------------------- |
| Toon id   | `redsmile-static`                                  |
| Pages     | 7 (800×1424 PNG, watermarked, R2 only)             |
| Config    | `content/toons/redsmile-static/config.json`        |
| App       | `src/toons/redsmile-static/`                       |
| Card art  | `card-art/redsmile-static.jpg`                     |
| Languages | `en` only                                          |

## Cast / voices

| Character | ElevenLabs voice (`scripts/jax-voices.json`) |
| --------- | -------------------------------------------- |
| Elena     | `elena` → `HBDoL4wkcalemIO0nUAu`             |

```bash
set -a; source .env; set +a
python3 scripts/generate-jax-voice.py "[whispers] Who's there?" \
  --voice elena --toon redsmile-static --model eleven_v3 --stability 0.3
```

## Captions

24 word overlays, every one with audio: 13 Elena lines (`thought` for interior
monologue, `bubble` when she speaks aloud, `burst` for the scream) and 11 SFX
bursts. Three beats stay deliberately silent — the figure in the doorway (p2),
the empty black doorway (p3) and the door swinging open (p7).

**Auto-read plays `words[]` in array order**, so a panel's SFX has to sit ahead
of the line it precedes. Current intent: `BZZT` opens page 1; `kreeeee` follows
"Don't move."; `NNNK` opens page 7 before the shadow line.

SFX slugs live in `scripts/jax-sfx-manifest.json` under the `rs-` prefix:

| Slug                | Caption     | Beat                       |
| ------------------- | ----------- | -------------------------- |
| `rs-phone-buzz`     | `BZZT`      | p1 — message arrives       |
| `rs-static-hiss`    | `KSSHHHH`   | p1 — sigil on the TV       |
| `rs-static-crackle` | `KRRK`      | p2 — dead channel          |
| `rs-breath-dark`    | `hhhhhh`    | p2 — figure in the doorway |
| `rs-door-creak`     | `kreeeee`   | p3 — empty doorway         |
| `rs-switch-click`   | `CLICK`     | p4 — no power              |
| `rs-house-groan`    | `hnnnnn`    | p4 — the staircase         |
| `rs-stair-creak`    | `KREE-K`    | p5 — bare feet climbing    |
| `rs-footstep-thud`  | `tk… tk…`   | p5 — corridor behind her   |
| `rs-handle-turn`    | `SHKK`      | p6 — Victorian handle      |
| `rs-hinge-whine`    | `NNNK`      | p7 — the door opens        |

Ambient beds generate quiet. Check `mean_volume` before shipping (see the SFX
section in the root `CLAUDE.md`) — the static hiss and the breath both needed a
boost to be audible at all.

## Plates

Page art is generated with the `/horror-toon-page` skill (Seedream 5.0 Pro i2i,
B&W horror ink, 3 stacked horizontal panels).

```bash
make add-image SRC=~/Downloads/page8.png TOON=redsmile-static CONFIG=1 UPLOAD=1
npm run publish-toon-config -- --toon redsmile-static
```

## Ship

Assets and config are **staged locally only** until uploaded:

```bash
npm run upload-assets                                  # plates + card art → R2
npm run publish-toon-config -- --toon redsmile-static  # config.<md5>.json → R2 + lock
make deploy                                            # Pages (lock must be live)
```
