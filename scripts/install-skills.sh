#!/usr/bin/env bash
# Install Claude skills from this repo into ~/.claude/skills/
set -e

REPO_SKILLS="$(cd "$(dirname "$0")/.." && pwd)/.claude/skills"
TARGET="$HOME/.claude/skills"

if [ ! -d "$REPO_SKILLS" ]; then
  echo "No skills found at $REPO_SKILLS"
  exit 1
fi

mkdir -p "$TARGET"

for skill_dir in "$REPO_SKILLS"/*/; do
  skill_name=$(basename "$skill_dir")
  dest="$TARGET/$skill_name"

  if [ -d "$dest" ]; then
    echo "  updating: $skill_name"
  else
    echo "installing: $skill_name"
    mkdir -p "$dest"
  fi

  cp "$skill_dir/SKILL.md" "$dest/SKILL.md"
done

echo "Done. Skills installed to $TARGET"
