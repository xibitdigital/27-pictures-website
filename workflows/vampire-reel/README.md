# Vampire reel — 3-shot 9:16 Instagram piece

Photoreal goth-vampire character walking a wet city street at night. Three 5s
clips cut to ~15s. Everything here is prompts + a stitch script; no binaries.

## Pipeline

| Step | Model                             | Mode              | Prompt                                           | Output               |
| ---- | --------------------------------- | ----------------- | ------------------------------------------------ | -------------------- |
| 1    | Seedream 5.0 Pro                  | text-to-image     | `prompts/01-hero-still.seedream.txt`             | hero still, 2K, 9:16 |
| 2    | Seedream 5.0 Pro                  | image-to-image    | `prompts/02-fix-trousers.seedream-i2i.txt`       | fixed hero still     |
| 2b   | Seedream 5.0 Pro                  | image-to-image    | `prompts/02b-motion-safe-still.seedream-i2i.txt` | motion-safe still    |
| 3    | Nano Banana **or** Flux.1 Kontext | single-image edit | `prompts/03-closeup-fangs.edit.txt`              | close-up with fangs  |
| 4    | Kling 2.5+ (Hailuo 02 for shot 3) | image-to-video    | `prompts/04-shots.kling-i2v.txt`                 | 3× 5s mp4            |
| 5    | ffmpeg                            | —                 | `stitch.sh`                                      | `reel.mp4`           |

```bash
./stitch.sh shot1.mp4 shot2.mp4 shot3.mp4 reel.mp4
```

## Which still feeds which shot

- **Shots 1 and 2** → the step-**2b** motion-safe still
- **Shot 3** → the step-3 close-up

The step-2 hero still is the poster frame, not the animation input. It has a
hand on the hip, silver rings and a long open coat — so i2v has to invent an arm
swing off a planted hand, animate fingers with jewellery on them, and carry two
free coat panels through a stride. That is exactly where the limb warping and
hem tearing come from, and no video prompt can talk it out of them.

Step 2b fixes it upstream: hands into the pockets and out of frame, rings gone,
coat belted shut into one continuous front, hem straight and clear of the boots.
Same face, same street, same framing, so it still cuts against shot 3.

**Never chain a frame out of one clip into the next.** Identity drift compounds;
by shot 3 it is a different woman. Every clip descends from the same photo.

## Model choices, and why

- **Veo 3.1 is out.** Strictest people filter of any video model; it refuses this
  photoreal input (the reseller surfaces that as a generic "did not generate the
  expected output"). It is also $0.20/s silent, $0.40/s with audio.
- **Kling** for walking — best gait and cloth physics of the models that accept
  photoreal people, and cheap enough to re-roll.
- **Hailuo 02** for shot 3 if Kling drifts — it is better at slow, subtle motion
  (a head turn, a slow push-in) than at full-body walking.
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
| `swinging open`, `hem flaring`, `coat billowing`    | instructed cloth deformation → torn hem        |
| anything a hand does                                | fingers are the least stable thing i2v renders |

Positive counterweights that help: `crisp per-frame detail`, `fast shutter
speed`, `sharp focus`, `stable geometry`.

## Quality gate

Judge takes on **feet first**: boots planting = keep, feet skating = discard.
Sliding feet is i2v's signature failure and it shows in the first second.

Then, in order, scrub frame by frame:

1. **Hem** — one unbroken edge for all 5s. A hem that splits, grows or eats a
   boot shaft is a discard; it never recovers later in the clip.
2. **Arms** — silhouette stays two arms wide. Any elbow bending backwards, any
   third sleeve, discard.
3. **Hands** — should be invisible. If a hand surfaces out of a pocket, the 2b
   still leaked fingers into frame; re-roll the still, not the clip.
4. **Moving edges** — pause on a mid-stride frame. A boot edge that reads as two
   overlapping copies is motion blur: you are on Turbo, or a blur word survived
   in the prompt.

Shot 3 needs 2–3 takes — a head turn with eye contact is the hardest thing in
the sequence. Keep the take where the eyes stay stable through the turn.

## ComfyUI

To run this as one graph instead of a browser playground, start from the
official template rather than hand-authored JSON — the Kling node has moved
through 2.0 / 2.6 / 3.0 / O3 and `widgets_values` is positional, so a
hand-written graph silently binds the wrong parameters.

There are 34 Kling templates; three are relevant:

| Template                         | Use                                                 |
| -------------------------------- | --------------------------------------------------- |
| **Kling 3.0: Video Generation**  | **all three shots** — plain start-frame i2v         |
| **Kling O3: Reference to Video** | fallback only, see below                            |
| **Kling 3.0: 1 Click Multishot** | optional — several shots in one run, worth one test |

**Reference-to-video is not a drop-in for shot 3.** It carries a subject
likeness into a scene it generates from the prompt, rather than animating the
frame you hand it — so the street, lighting and framing come back re-invented
and will not cut against shots 1–2, which are locked to the 2b still. Use it
only if i2v drifts the face on the close-up push-in, and expect to prompt the
environment back in by hand.

Skip **2.6: Animate Images with Audio** (synced sound you do not need, costs
more) and **First Last Frame to Video** (wants two frames, interpolates rather
than animates).

- Templates: <https://comfy.org/workflows/model/kling/>
- Nodes involved: `LoadImage` → `KlingImage2VideoNode` → `SaveVideo`

Load the template, drop in the prompt from step 4, set 9:16 / 5s /
`cfg_scale` ~0.5 / Master mode, and duplicate the chain three times — one per
shot. Save the result next to this README as `vampire-reel.api.json` so it is
reproducible, same convention as `workflows/nero-seedream.api.json`.

## Instagram delivery

`stitch.sh` already outputs the right spec: 1080×1920, H.264 High, 30fps,
CRF 19, yuv420p, `+faststart` (without it the upload sometimes stalls).

Keep the character clear of the bottom ~250px and top ~150px — Reels UI sits
there.

Clips come back silent. Lay a rain/city bed under the cut:

```bash
ffmpeg -i reel.mp4 -i bed.mp3 -c:v copy -c:a aac -b:a 128k -shortest reel-audio.mp4
```
