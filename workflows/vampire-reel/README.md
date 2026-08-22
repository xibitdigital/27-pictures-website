# Vampire reel — 3-shot 9:16 Instagram piece

Photoreal goth-vampire character walking the hall of a regal gothic house at
night — marble floor, oak panelling, candlelight. Three clips cut to one Reel.
Everything here is prompts + a stitch script; no binaries.

**Wardrobe and setting changed 2026-08-22**: a fitted modern goth dress in a
grand house, replacing the leather coat on a wet street. The earlier take is kept
under `docs/story/vampire/prompts/` — it is a different piece, not a worse draft.

## Pipeline

| Step | Model                             | Mode              | Prompt                                           | Output               |
| ---- | --------------------------------- | ----------------- | ------------------------------------------------ | -------------------- |
| 1    | Seedream 5.0 Pro                  | text-to-image     | `prompts/01-hero-still.seedream.txt`             | hero still, 2K, 9:16 |
| 2    | Seedream 5.0 Pro                  | image-to-image    | `prompts/02-fix-trousers.seedream-i2i.txt`       | fixed hero still     |
| 2b   | Seedream 5.0 Pro                  | image-to-image    | `prompts/02b-motion-safe-still.seedream-i2i.txt` | motion-safe still    |
| 3    | Nano Banana **or** Flux.1 Kontext | single-image edit | `prompts/03-closeup-fangs.edit.txt`              | close-up with fangs  |
| 4    | **Hailuo 02** (Kling as fallback) | image-to-video    | `prompts/04-shots.kling-i2v.txt`                 | 3× 6s mp4            |
| 5    | ffmpeg                            | —                 | `stitch.sh`                                      | `reel.mp4`           |

```bash
./stitch.sh shot1.mp4 shot2.mp4 shot3.mp4 reel.mp4
```

## Which still feeds which shot

- **Shots 1 and 2** → the step-**2b** motion-safe still
- **Shot 3** → the step-3 close-up

The hero still is the poster frame, not the animation input. It is posed for a
poster — hip pushed out, arms free, a slit in the skirt — so animating it means
simulating a swinging arm, a slit that opens and closes, and a hem near the
floor. That is exactly where limb warping and torn hems come from, and no video
prompt can talk a model out of them.

Step 2b fixes it upstream, and the fixes are wardrobe decisions rather than
prompt pleading:

- **Elbow-length gloves** (in the hero still already). Fingers are the least
  stable thing i2v renders; gloves delete knuckles, nails and rings from the
  problem entirely.
- **Both hands closed around one candleholder** at the waist. A dress has no
  pockets, so the hands get a prop instead — two gloved hands holding one object
  is the most stable arm configuration available, and it kills the arm swing.
- **A fitted skirt with the slit closed**, hem clearing the marble by a hand's
  width. Every metre of loose fabric is cloth the model has to simulate; a full
  skirt or a train is a torn hem waiting to happen.
- **Squared shoulders, weight even**, standing rather than contrapposto.

Same face, same hall, same framing, so it still cuts against shot 3.

**Never chain a frame out of one clip into the next.** Identity drift compounds;
by shot 3 it is a different woman. Every clip descends from the same photo.

## Model choices, and why

- **Veo 3.1 is out.** Strictest people filter of any video model; it refuses this
  photoreal input (the reseller surfaces that as a generic "did not generate the
  expected output"). It is also $0.20/s silent, $0.40/s with audio.
- **Hailuo 02** is the default now — best of the alternatives at slow subtle
  motion (a head turn, a push-in, breath) and it holds a photoreal face as well as
  anything here except Kling. No negative prompt and 6s minimum; see the ComfyUI
  section.
- **Kling** stays the fallback for walking — best gait and cloth physics of the
  models that accept photoreal people, and cheap enough to re-roll. If shot 1's
  boots skate, switch that shot with `--engine kling`.
- **Nano Banana / Kontext, not Seedream, for the close-up.** Edit models hold a
  single reference identity far better on a crop-and-change. They also want
  short imperative instructions — a Seedream-style structured block hurts them.

## Settings that decide whether it works

- **Master / Pro mode, never Turbo.** Turbo is the cheap re-roll and it smears
  every moving edge. If motion looks like a long exposure, check this first.
- `cfg_scale` **~0.5**, not 0.3. Identity is held by the start frame; cfg that
  low also lets Kling ignore the prompt's physics constraints, which is how
  "coat stays closed" and "boot plants flat" get dropped. Above ~0.7 it starts
  repainting the face.
- **5s** per clip; 10s drifts
- **end frame / tail frame empty** — single-image start keeps identity tighter
- one action **or** one camera move per clip, **not both**. Shot 1 used to walk
  her at the camera while dollying back — opposed motion, maximum pixel
  velocity, guaranteed smear. The camera is locked now.
- 9:16, 1080p — Instagram re-encodes anything larger
- **30fps out.** Kling renders 30; `stitch.sh` used to retime to 24, which drops
  every 5th frame and reads as smeared motion.

### Words that generate artifacts

Kling treats these as render instructions, so they are banned from the shot
prompts and listed in the negative:

| Don't write                                         | Why                                            |
| --------------------------------------------------- | ---------------------------------------------- |
| `drift`, `streak`, `soft`, `shallow depth of field` | all render as blur                             |
| `swinging open`, `hem flaring`, `skirt billowing`   | instructed cloth deformation → torn hem        |
| anything a hand does                                | fingers are the least stable thing i2v renders |
| `flickering candles`, `guttering flame`             | the brightest thing in frame, animated → smear |

Positive counterweights that help: `crisp per-frame detail`, `fast shutter
speed`, `sharp focus`, `stable geometry`.

## Quality gate

Judge takes on **feet first**: heels setting down on the marble = keep, feet
skating = discard. Sliding feet is i2v's signature failure and it shows in the
first second — and a polished floor makes it more obvious, because the reflection
skates too.

Then, in order, scrub frame by frame:

1. **Hem** — one unbroken edge for the whole clip. A hem that splits, grows, or
   opens the slit back up is a discard; it never recovers later in the clip.
2. **Arms** — silhouette stays two arms wide. Any elbow bending backwards, any
   third sleeve, discard.
3. **Hands** — should stay one closed shape around the candleholder. If fingers
   separate or the prop changes shape, the 2b still leaked finger detail through
   the gloves; re-roll the still, not the clip.
4. **Moving edges** — pause on a mid-stride frame. A boot edge that reads as two
   overlapping copies is motion blur: you are on Turbo, or a blur word survived
   in the prompt.

Shot 3 needs 2–3 takes — a head turn with eye contact is the hardest thing in
the sequence. Keep the take where the eyes stay stable through the turn.

## ComfyUI — one graph, generated

`scripts/build-comfy-reel.py` builds the whole pipeline as a single API-format
graph, so a reel is one queue instead of five browser tabs:

```bash
python3 scripts/build-comfy-reel.py                      # write the graph, send nothing
python3 scripts/build-comfy-reel.py --closeup fangs.png  # shot 3 from the edit-model frame
python3 scripts/build-comfy-reel.py --submit             # queue it (costs credits)
```

```
Seedream t2i (01 hero still)  -> ImageScale -> SaveImage        poster frame
      |
      +-> Seedream i2i (02b motion-safe)  -> ImageScale -> SaveImage
                 |
                 +-> i2v shot 1 -> SaveVideo ─┐
                 +-> i2v shot 2 -> SaveVideo ─┤  --join:
LoadImage (03 close-up, made elsewhere)       ├─ GetVideoComponents x3
      +-> i2v shot 3 -> SaveVideo ────────────┘  -> ImageBatch x2
                                                 -> CreateVideo -> SaveVideo  reel
```

### `--join` puts the cut in the graph too

Without it the run ends with three clips and `stitch.sh` makes the reel. With it
the graph also decodes the clips to frames, batches them in order and re-encodes
one `reel.mp4`, so a single queue produces the finished piece.

Core nodes only, because ComfyUI has no concat-video node: `GetVideoComponents`
x3 -> `ImageBatch` x2 -> `CreateVideo` -> `SaveVideo`. The output fps is **read
off shot 1** (`GetVideoComponents` slot 2) rather than asserted — Hailuo delivers
24 and Kling 30, and asserting a rate is precisely the bug `stitch.sh` had.

**It is memory-hungry.** Three 6s clips at 1080x1920 / 24fps is 432 frames held
as image tensors — order of 10 GB at float32, before the encode. On a machine that
cannot hold that, generate without `--join` and cut with `stitch.sh`; the result is
identical and the frames never all exist at once.

The three shots save individually either way. A reel gets re-cut far more often
than it gets re-generated, and one bad take should not cost the other two.

### The engine is a flag: `--engine hailuo` (default) or `--engine kling`

`ENGINES` at the top of the script is the one place a node class or input name
lives, and `--engine` picks the entry. Two differences that are not settings but
consequences:

- **Hailuo 02 has no negative prompt.** The node takes prompt text only, so the
  negative block in `prompts/04-shots.kling-i2v.txt` is _dropped_, not folded in
  — pasted into the positive, "motion blur, smearing, ghosting" reads as an
  instruction and you get exactly what it lists. What carries the same weight is
  the positive counterweight already ending every shot prompt: _crisp per-frame
  detail, fast shutter speed, sharp focus, stable geometry_. Keep writing those.
- **Hailuo 02 is 6s or 10s — there is no 5s.** Three clips make an **18s** reel,
  not 15s. `stitch.sh` concatenates without retiming, so the extra second lands
  on each shot's tail; trim in the stitch if the cut drags.

Why Hailuo over Kling for this: it is the better model for slow subtle motion — a
head turn, a push-in, breath — and it holds a photoreal face as well as anything
except Kling itself. Kling keeps the edge on full-body gait and cloth physics, so
if shot 1's walk skates, that is the one to switch back with `--engine kling`.

Written to `vampire-reel.api.json`, same convention as
`workflows/nero-seedream.api.json`. The graph is an **output**, not a
hand-maintained file — re-run the script rather than editing it.

**The prompts are the source.** All four bodies are read out of `prompts/` with
their `#` headers stripped, and the shot prompts are keyed off the
`=== SHOT n ===` headers in `04-shots.kling-i2v.txt` — so editing that file
changes the graph, and the shot-3 teeth addendum is appended to shot 3's negative
only. Nothing is inlined in the script.

**Step 3 is deliberately not in the graph.** The close-up is an _edit_, and edit
models hold one identity through a crop-and-change far better than Seedream does.
Run it in Nano Banana or Kontext, drop the result in ComfyUI's `input/`, pass
`--closeup <file>`. Without it the graph still runs and shot 3 starts from the
motion-safe still — a worse close-up, but not a blocked pipeline.

**Sizes: render at delivery size, 1080x1920.** These stills exist to feed i2v and
to be a poster frame for a Reel. Instagram serves 1080x1920 and re-encodes
anything larger, so extra pixels buy nothing and cost credits — and at 1080x1920
there is no `ImageScale` in the graph at all (17 nodes with `--join`, not 19).

Two hard limits of the Seedream node, both worth not rediscovering:

| Limit          | Value                       |
| -------------- | --------------------------- |
| minimum width  | **1024**                    |
| maximum height | **2496** — 2560 is rejected |

`--render WxH` overrides, refuses anything outside those bounds, and adds the
downscale back only when the render is larger than delivery:

```bash
python3 scripts/build-comfy-reel.py --render 1404x2496   # 9:16 at the node's ceiling
python3 scripts/build-comfy-reel.py --render 900x1600     # error: under the 1024 minimum
```

There is no 3.68 MP floor here. `build-comfy-plate.py` still asserts one for
plates, but its own docstring records that a 1.87 MP roll rendered fine — and
1080x1920 is 2.07 MP.

Settings come from _Settings that decide whether it works_ above and are constants
at the top of the script: `cfg_scale` 0.5, 5s, `pro` mode, 9:16, no end frame.

### It refuses to write a graph it cannot verify

The Kling node has moved through 2.0 / 2.6 / 3.0 / O3 and its inputs were renamed
on the way. A hosted API node reports a bad input as a BadRequest _after_ it has
taken the credits, so the script queries `/object_info` and checks every class and
required input before writing. A mismatch is a non-zero exit with the server's own
input list; an unreachable server writes the graph and says loudly that nothing
was checked.

That check has **not** yet passed here — it was written against the node names in
this README (`KlingImage2VideoNode`, `SaveVideo`, `ByteDanceSeedreamNodeV3`) with
no ComfyUI running. Start the server and run it once before spending anything:

```bash
python3 scripts/build-comfy-reel.py            # expect: "verified against …"
```

If it lists mismatches, fix the constants at the top of the script — that is the
one place class names live. The templates remain the reference for what the node
is called this month:

- Templates: <https://comfy.org/workflows/model/kling/>
- **Kling 3.0: Video Generation** is the plain start-frame i2v the graph builds
- **Kling O3: Reference to Video** re-invents the environment from the prompt, so
  it will not cut against shots 1-2 — fallback only, see above

## Instagram delivery

`stitch.sh` already outputs the right spec: 1080×1920, H.264 High, 30fps,
CRF 19, yuv420p, `+faststart` (without it the upload sometimes stalls).

Keep the character clear of the bottom ~250px and top ~150px — Reels UI sits
there.

Clips come back silent. Lay a rain/city bed under the cut:

```bash
ffmpeg -i reel.mp4 -i bed.mp3 -c:v copy -c:a aac -b:a 128k -shortest reel-audio.mp4
```
