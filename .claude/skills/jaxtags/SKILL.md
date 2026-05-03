---
name: jaxtags
description: >
  YouTube upload package generator for the Jax Netrunner cyberpunk series.
  Takes an episode title and/or scene description and outputs a ready-to-paste
  YouTube title, description body, and tag block. Fixed series tags always included.
  Use when user says "jaxtags", "/jaxtags", "youtube tags", "generate tags", "title tags",
  "youtube description", or "write description".
user-invokable: true
argument-hint: "[episode title or scene description]"
---

# JAXTAGS — YouTube Upload Package (Jax Netrunner Series)

Generate a complete YouTube upload package: title, description body, and tags.

## Output format

Three clearly labelled copyable blocks. No preamble, no explanation.

## Fixed Series Tags (always included)

These appear in EVERY generation, no exceptions:
- `#JaxNetrunner`
- `#CyberpunkShort`
- `#SciFiShort`

## Rules

### Title
- Use episode title as base if provided; otherwise generate short punchy title (max 60 chars before hashtags)
- Append exactly 2 hashtags: always `#CyberpunkShort` + 1 scene-specific tag

### Description body
- 3 short paragraphs max
- Para 1: setting + characters + stakes (1-2 sentences, vivid but tight)
- Para 2: action/conflict teaser (1 sentence)
- Para 3: single cliffhanger question ending with `…`
- No trademarked IP references (#BladeRunner, #GhostInTheShell, "Blade Runner meets", etc.)
- No subscribe CTAs — YouTube handles this
- Tags go at the very end of description, after a blank line

### Tags
- 5 tags max
- Always include the 3 fixed series tags + 2 scene-specific tags derived from action/theme
- Scene-specific tags: derive from action (heist, chase, implant, confrontation), characters, or setting
- Never use trademarked IP names or low-volume niche tags (#grokai, #aiart)
- CamelCase all hashtags

## Structure

```
TITLE:
[title] #CyberpunkShort #[scene tag]

DESCRIPTION:
[Para 1 — setting, characters, stakes]

[Para 2 — action/conflict teaser]

[Para 3 — cliffhanger question…]

#JaxNetrunner #CyberpunkShort #SciFiShort #[scene tag 1] #[scene tag 2]

TAGS:
#JaxNetrunner #CyberpunkShort #SciFiShort #[scene tag 1] #[scene tag 2]
```

## Example

User: "Jax Episode 1: The Rabbit Door — Jax and Nova heist the Arcology Tower"

Output:
```
TITLE:
Jax Episode 1: The Rabbit Door #CyberpunkShort #CyberpunkHeist

DESCRIPTION:
In a rain-soaked neon megacity, rogue netrunner Jax and his deadly AI partner Nova — who lives inside his head — pull off an impossible heist inside the heavily guarded Arcology Tower.

Seduction, betrayal, plasma fire, and forbidden corporate secrets explode in one brutal night.

Will Jax make it out alive… or will Nova consume him first?

#JaxNetrunner #CyberpunkShort #SciFiShort #CyberpunkHeist #NeonNoir

TAGS:
#JaxNetrunner #CyberpunkShort #SciFiShort #CyberpunkHeist #NeonNoir
```
