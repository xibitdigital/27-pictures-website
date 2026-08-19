# Horror toon character sheet — lock (compact)

Expanded reference for `/horror-toon-character`. Keep the live prompt short; use
this when a sheet comes back wrong and you need the specific clause to add.

## Ink & value

- Pure black and white manga / gekiga ink, confident line
- Cross-hatching for form; sparse screentone grain
- Rich blacks in **hair, coat, costume mass** — never across the face
- **Even, neutral key light on the figure.** This is the one place the horror
  page's "light is scarce and hostile" rule is deliberately suspended: the sheet
  exists to be pinned against, and a face in shadow cannot be

## Ground

- Flat seamless light grey or white
- No environment, no furniture, no scene
- Soft contact shadow at the feet only — no cast shadow across the ground
- No vignette, no texture overlay, no paper grain that reads as a location

## Views (vertical 1008×1792)

| Band | Share | Contents |
|---|---|---|
| Top | ~45% | Full-body **front** + **three-quarter**, side by side, one baseline |
| Middle | ~25% | Full-body **back** + solid-black **silhouette** |
| Bottom | ~30% | **Head sheet**: 3 expressions + 1–2 detail insets |

- One shared height across every full-body view — this is what makes it a
  turnaround instead of three unrelated drawings
- Neutral A-pose or relaxed stand; arms clear of the torso; hands open
- Feet fully visible and uncropped in every full-body view

## Expression row

Pick three that span the character's range, not three moods:

- **Neutral** — the resting face, what appears in most panels
- **Dominant** — the emotion this character is usually in the room to carry
- **Extreme** — the one page the story is building toward

## Avoid

- Panels, gutters, borders, frames — a sheet is one open field
- **Text of any kind**: view labels ("FRONT / SIDE / BACK"), height rules,
  arrows, callouts, names, watermarks. The model volunteers these constantly.
  Lettering is FlipFrame's job, and baked text cannot be translated
- Cyberpunk neon, teal-orange grade, photoreal 3D
- Cute / shōnen sparkle eyes as default
- Dynamic action poses in the turnaround band (fine as an extra, never as the
  view a later page pins against)
- Extra limbs, missing fingers, cropped feet
- Beautifying the reference — same age, same build, same scars

## Reuse checklist

Before a sheet becomes the project's reference for a character:

- [ ] Colour cast flattened to neutral grey (`0` from the difference check)
- [ ] Face reads at 200px wide — it will be pinned from a thumbnail
- [ ] All full-body views the same height
- [ ] No text anywhere in the art
- [ ] Compact prose lock written into `/horror-toon-page` → *Character locks*,
      so a page can be prompted without attaching the sheet
