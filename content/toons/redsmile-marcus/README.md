# RED SMILE: Marcus — cast & synopsis (manual)

**Episode 2** of the RED SMILE series. Episode 1 is `redsmile-static`.

Interactive FlipFrame short. Deep-link pages: `/toons/redsmile-marcus/?page=N`.

|             |                                                          |
| ----------- | -------------------------------------------------------- |
| Config      | `content/toons/redsmile-marcus/config.json` → publish to R2 |
| Lock        | `src/toons/config-lock.json` → `redsmile-marcus` key     |
| Design size | 800 × 1424 (portrait)                                    |
| Pages       | **2** — work in progress                                 |

## Status: published, unlisted

The config and every asset are on R2 and the reader resolves the locked hash
like every other toon, so `/toons/redsmile-marcus/` works in a production build.

It is still **unlisted**: `noindex, nofollow` on the reader, no card on
`/toons/`, no sitemap or `llms.txt` entry — two pages are not something to rank,
and a work-in-progress badge does not stop Google ranking half a story. What it
does have is an episode card on `/toons/red-smile/` (with a *Work in progress*
badge, same as Erin EP 2) and an entry in that page's `CreativeWorkSeries`
`hasPart`, because the series page must not claim fewer episodes than it shows.

Shipping the episode = remove the noindex, add the sitemap `<url>` and the
`llms.txt` line, and drop the WIP badge and the `1 page` cue.

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

Page 2 carries 5 overlays, **all of them hers** — `SHHK` (the bin), *Sir?*,
*I've finished, sir.*, *Goodnight.*, then `TIC`. Marcus has no bubble on the
page at all: he is asked a question and does not answer, and the silence is the
beat. The closing `TIC` reuses page 1's popup clip, so the machine speaks again
after she has left the corridor. Draft and placement reasoning:
`docs/story/red-smile/captions/ep2-page-02.md`.

Page 1 carries 5 overlays — 2 Marcus lines, 2 Halina lines, 1 SFX. Draft,
placement reasoning and the generation commands are in
`docs/story/red-smile/captions/ep2-page-01.md`.

**Voiced.** All ten overlays carry `audio`: four ElevenLabs `eleven_v3` lines
(marcus ×2 at stability 0.4, halina ×2 at 0.5) and the popup chime from the
Sound Effects API, slug `redsmile-ep2-popup-tic` in
`scripts/jax-sfx-manifest.json`. Levelled with
`npm run normalise-audio -- redsmile-marcus` (voices to -18 LUFS; the chime was
already on target).

The chime took two takes: the first came back at -60 dB mean — inaudible — and
a 0.4 s request is under what the API renders usefully. The shipped one asks for
0.8 s and a *loud, dry, close* tick.

## Plates

| Page | Prompt |
| ---- | ------ |
| 1    | `docs/story/red-smile/prompts/page-02-marcus-halina-office.txt` |
| 2    | `docs/story/red-smile/prompts/page-03-halina-goodnight-corridor.txt` |

**Page 1 has a continuity defect.** The sigil in the laptop popup is a roughly
equilateral hexagram; the series mark is notably taller than wide with a long
vertical axis (see episode 1 page 1). Three generations have failed to reproduce
it. Fix by compositing the real mark from episode 1 rather than re-rolling.
