# RED SMILE — cast bios

Character bios for the **RED SMILE** series. Series level on purpose: these
people span episodes, and `content/toons/redsmile-static/` is episode 1's
folder, not the series'.

| File | Who | Side |
| ---- | --- | ---- |
| [viktor.md](viktor.md) | Half vampire, 350, looks 60. Occultist and master banisher | Sub Signo — principal |
| [adaeze.md](adaeze.md) | Half demon, early 40s. Finds them | Sub Signo — principal |
| [tokiro.md](tokiro.md) | Akuma banisher, late 30s. Ends them | Sub Signo — principal |
| [marcus.md](marcus.md) | CEO, late 30s. Owns the screens | Victim — **vessel** |
| [halina.md](halina.md) | The cleaner, mid 50s. Undercover in Marcus's building | Sub Signo — **placed agent**, killed ep 2 |
| [elena.md](elena.md) | Episode 1's host. Agent's daughter | Victim — **vessel**. The only character in a config |
| [the-society.md](the-society.md) | **Sub Signo** — the three principals, the agent tier, the boundary | — |
| [the-entity.md](the-entity.md) | What they hunt. Moves through media, crosses by image | — |

The society is called **Sub Signo** — Latin, *under the sign*, for the mark its
members carry. Its **three
principals** are Viktor, Adaeze and Tokiro — that top tier
is exactly three. Below them sit **placed agents**: [Halina](halina.md) is one,
undercover as a cleaner inside Marcus's building. **Marcus and Elena are
victims**, not members. See [the-society.md](the-society.md).

**Everything here except the Appearance sections is a proposal.** Episode 1 has
exactly one on-page character, Elena, and `content/toons/redsmile-static/config.json`
names nobody else. Treat the story material as a pitch to accept, edit or throw
out; treat the Appearance sections as binding, because they match the generated
character sheets and every future plate is pinned against them.

## What each bio is for

- **Appearance — locked.** What the character sheet actually shows. Never
  paraphrase this into a plate prompt; copy it.
- **Compact prose lock.** Paste straight into a `/horror-toon-page` prompt when
  the sheet is not attached. Same purpose as the *Character locks* section in
  that skill.
- **Voice.** None of these three has an entry in `scripts/jax-voices.json` yet.
  Add one before generating any line — see CLAUDE.md, *Generating a spoken voice
  line*.

## The mark

Viktor and Adaeze both carry the **unicursal hexagram**: a six-pointed star drawn
as one continuous unbroken interlaced line, taller than wide, elongated vertical
axis, a small lens-shaped void at its centre. Not two overlapping triangles, not
a Star of David, not a pentagram, and no surrounding circle.

It is the mark that fills the television on episode 1 page 1 and surfaces inside
Elena's iris in that page's last panel, so it has to be drawn exactly, every
time. Tokiro carries no mark at all — that absence is characterisation.

## Reference images — generation only

The approved character sheet for each member, by reference id. **Pass these when
generating a plate so the likeness holds.** They are not URLs, not assets to
publish, and must not appear in a config, a page, a sitemap or any shipped file.

| Character | Local copy (untracked) | Source id |
| --------- | ---------------------- | --------- |
| Tokiro | `references/red-smile/tokiro.png` | `0217871348162824b2f64bfb09d213dd2215030b1eaaf1f6f068a` |
| Adaeze | `references/red-smile/adaeze.png` | `021787134144124d82d61e1341a38f1d55b18f5893f198b8aebc5` |
| Viktor | `references/red-smile/viktor.png` | `0217871339337299ded32e803badef81244c2c5f5c7f1beed02f6` |
| Marcus | `references/red-smile/marcus.png` | `021787157496622378c141953f92ec627da9d675fe03be0184455` |
| Halina | `references/red-smile/halina.png` | `0217871376017938547934892c4038781a87d514f9a9196cac1cb` |

Recorded 2026-08-19. Every mapping verified by rendering the sheet before
recording it — a swapped id silently generates the wrong face.

Marcus was recast younger the same day and then re-rolled. Superseded ids are
listed in [marcus.md](marcus.md) — the mid-50s original and the first recast.
Neither should be generated against.

`references/` is gitignored — the sheets are generation inputs, not site assets.
