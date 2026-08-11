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
