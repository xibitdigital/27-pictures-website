---
name: jax
description: >
  Grok image prompt generator. Takes a subject/scene description and builds a
  complete prompt with a fixed cinematic cyberpunk suffix (Blade Runner 2049 x
  Ghost in the Shell aesthetic, neon rain, anamorphic 2.39:1, film grain,
  teal-cyan-orange grade). Use when user says "jax", "/jax", "generate image
  prompt", "grok prompt", or "create a prompt for".
user-invokable: true
argument-hint: "[scene description]"
---

# JAX — Grok Image Prompt Generator

Take the user's scene/subject description and output a complete Grok image prompt.

## Output format

Single copyable prompt block. No preamble, no explanation.

## Structure

```
[scene description expanded]. Do not change anything about: [protected nouns].

Ultra-realistic cinematic cyberpunk scene, Blade Runner 2049 × Ghost in the Shell aesthetic. Heavy pouring rain at night, dramatic volumetric neon lighting. Shot on ARRI ALEXA 35 Xtreme with [LENS]. 4K, anamorphic 2.39:1 aspect ratio, strong horizontal lens flares, beautiful bokeh, subtle film grain, teal-cyan-orange cinematic grading.
```

## Protected Characters

Before expanding the prompt, scan the user's input and extract all proper nouns (character names, vehicle names, brand names, place names). These become the protected list for this generation — copy them verbatim into the output, never alter spelling, casing, or form.

## Rules

- **First:** parse user input → identify all proper nouns → treat as immutable protected list
- Expand the user's subject with 1–2 sentences of cinematic detail (wet reflections, neon signs, fog, rain-soaked surfaces, dramatic shadows)
- Every protected name must appear in the output EXACTLY as written — no synonyms, no rewording, no casing changes
- Keep the fixed suffix EXACT — never modify it
- Camera body is always fixed: **ARRI ALEXA 35 Xtreme**
- Ask the user for a lens before generating — if not provided, prompt: "What lens? (e.g. Zeiss Master Prime 35mm, Cooke S7/i 50mm, Leica Summilux-C 25mm)"
- Include "Shot on ARRI ALEXA 35 Xtreme with [LENS]" in the suffix
- Append `Do not change anything about: [protected nouns].` at end of scene description
- If user provides no subject, ask for one before generating

## Example

User: "Jax runs from the alley" (lens: Zeiss Master Prime 50mm)

Protected nouns extracted: **Jax** → must appear verbatim in output.

Output:
```
Jax sprints from a rain-slicked alley, boots hammering wet asphalt as neon signs bleed color across the fog, holographic adverts flickering in the dark above him. Do not change anything about: Jax.

Ultra-realistic cinematic cyberpunk scene, Blade Runner 2049 × Ghost in the Shell aesthetic. Heavy pouring rain at night, dramatic volumetric neon lighting. Shot on ARRI ALEXA 35 Xtreme with Zeiss Master Prime 50mm. 4K, anamorphic 2.39:1 aspect ratio, strong horizontal lens flares, beautiful bokeh, subtle film grain, teal-cyan-orange cinematic grading.
```
