# RED SMILE: Marcus — cast & synopsis (manual)

**Episode 2** of the RED SMILE series. Episode 1 is `redsmile-static`.

Interactive FlipFrame short. Deep-link pages: `/toons/redsmile-marcus/?page=N`.

|             |                                                          |
| ----------- | -------------------------------------------------------- |
| Config      | `content/toons/redsmile-marcus/config.json` → publish to R2 |
| Lock        | `src/toons/config-lock.json` → `redsmile-marcus` key     |
| Design size | 800 × 1424 (portrait)                                    |
| Pages       | **1** — work in progress                                 |

## Status: unlisted

`noindex, nofollow` on the reader, no card on `/toons/`, no series-page episode
card, no sitemap or `llms.txt` entry. Same treatment Erin EP 2 gets: a
work-in-progress badge does not stop Google ranking half a story. The URL builds
and answers, so it can be shared directly.

Shipping the episode = remove the noindex, add the card on
`/toons/red-smile/`, add the sitemap `<url>` and the `llms.txt` line.

## Logline

Halina cleans the tower every night and nobody in it knows her name. Marcus is
pleasant to her, asks how she is, and waits for the answer. Behind him a browser
window opens by itself.

## Cast / voices

| Character | ElevenLabs voice (`scripts/jax-voices.json`) |
| --------- | -------------------------------------------- |
| Marcus    | `marcus` → `yhf80q1381zd2JJQ4tM7`            |
| Halina    | `halina` → `USEQXnsXRJlw2k9LUzG4`            |

Full bios, appearance locks and voice direction:
`docs/story/red-smile/{marcus,halina}.md`.

## Captions

Page 1 carries 5 overlays — 2 Marcus lines, 2 Halina lines, 1 SFX. Draft,
placement reasoning and the generation commands are in
`docs/story/red-smile/captions/ep2-page-01.md`.

**No audio yet.** Every `words[]` entry is missing its `audio` key; generate the
four voice lines and the chime, then add the hashed paths and
`npm run normalise-audio -- redsmile-marcus`.

## Plates

| Page | Prompt |
| ---- | ------ |
| 1    | `docs/story/red-smile/prompts/page-02-marcus-halina-office.txt` |

**Page 1 has a continuity defect.** The sigil in the laptop popup is a roughly
equilateral hexagram; the series mark is notably taller than wide with a long
vertical axis (see episode 1 page 1). Three generations have failed to reproduce
it. Fix by compositing the real mark from episode 1 rather than re-rolling.
