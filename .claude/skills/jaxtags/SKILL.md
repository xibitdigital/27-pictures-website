---
name: jaxtags
description: >
  YouTube Shorts tag and title generator for the Jax Netrunner cyberpunk series.
  Takes a scene description or episode title and outputs a ready-to-paste YouTube
  title with hashtags + description tag block. Fixed series tags always included.
  Use when user says "jaxtags", "/jaxtags", "youtube tags", "generate tags", or "title tags".
user-invokable: true
argument-hint: "[episode title or scene description]"
---

# JAXTAGS — YouTube Shorts Tag Generator (Jax Netrunner Series)

Generate a YouTube title with hashtags and a description tag block for upload.

## Output format

Two clearly labelled copyable blocks. No preamble, no explanation.

## Fixed Series Tags (always included)

These appear in EVERY generation, no exceptions:
- `#JaxNetrunner`
- `#CyberpunkShort`
- `#SciFiShort`

## Rules

- If user provides an episode title, use it as the base for the YouTube title
- If user provides only a scene description, generate a short punchy title from it (max 60 chars before hashtags)
- TITLE: append exactly 2 hashtags — always `#CyberpunkShort` + 1 scene-specific tag
- DESCRIPTION TAGS: 5 tags max — always include the 3 fixed series tags + 2 scene-specific tags derived from the action/theme
- Scene-specific tags: derive from action (heist, chase, implant, confrontation), characters, or setting
- Never use trademarked IP names as tags (#BladeRunner, #GhostInTheShell)
- Never use low-volume niche tags (#grokai, #aiart)
- CamelCase all hashtags for readability

## Structure

```
TITLE:
[Episode title or generated title] #CyberpunkShort #[scene tag]

DESCRIPTION TAGS:
#JaxNetrunner #CyberpunkShort #SciFiShort #[scene tag 1] #[scene tag 2]
```

## Example

User: "Jax Episode 1: The Rabbit Door - Cyberpunk Heist Short"

Output:
```
TITLE:
Jax Episode 1: The Rabbit Door - Cyberpunk Heist Short #CyberpunkShort #CyberpunkHeist

DESCRIPTION TAGS:
#JaxNetrunner #CyberpunkShort #SciFiShort #CyberpunkHeist #NeonNoir
```
