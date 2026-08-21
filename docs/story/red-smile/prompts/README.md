# Generation prompts — tracked

Every Seedream prompt written for RED SMILE, kept in the repo so a plate or a
character sheet can always be traced back to the words that made it.

**Tracked on purpose.** The generated images are not — they live in
`references/`, which is gitignored, because they are large binaries and
generation inputs. The prompts are small text and they are the actual record: an
image without its prompt cannot be re-rolled, fixed or matched.

| File | What it makes |
| ---- | ------------- |
| `character-viktor.txt` | Viktor's character sheet |
| `character-viktor-fix.txt` | Fix pass — taller, wider shoulders, consistent view scale, correct sigil. **Not yet run** |
| `character-adaeze.txt` | Adaeze's character sheet |
| `character-tokiro.txt` | Tokiro's character sheet |
| `character-halina.txt` | Halina's character sheet |
| `character-marcus.txt` | Marcus, recast younger — the current one |
| `character-marcus-mid50s-superseded.txt` | The original mid-50s Marcus. Kept for the record; do not run |
| `page-02-marcus-halina-office.txt` | Episode 2 plate: the night office, the greeting, the popup |

## Naming

- `character-<name>.txt` — a full character sheet
- `character-<name>-fix.txt` — a fix pass against an existing sheet
- `page-<episode>-<slug>.txt` — a story plate
- `-superseded` — kept for traceability, never run again

Filenames carry no timestamps: git already has the dates, and a timestamped name
stops being the obvious current version the moment there are two of them.

## Reading one

Each file opens with a `#` header naming the model, the mode and **which
reference is Image 1, 2, 3**. That order is not decoration — the prompt body
refers to the references by number, so attaching them in a different order pins
the wrong things.

## Before running any of these

- **Cost is real.** ~$0.05 per image at `1K`; `2K` is worth it for a sheet that
  will be reused for months.
- Refs must be public HTTPS, or `--ref-asset` against `VITE_ASSET_BASE`. Local
  files like `references/red-smile/*.png` have to be attached in the web UI.
- After a plate: flatten the colour cast to neutral grey before anything else —
  see CLAUDE.md, *Plate colour*.
- A character sheet must **not** go through `make add-image`; that watermarks it
  and appends it to a toon's config as a story page.
