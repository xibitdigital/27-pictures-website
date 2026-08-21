#!/usr/bin/env node
/**
 * Strip everything a toon config repeats that the reader now derives.
 *
 *   node scripts/slim-toon-config.js --toon redsmile-marcus
 *   node scripts/slim-toon-config.js --all --dry-run
 *
 * A word entry only has to say what is true of *that* caption: where it sits,
 * which variant it is, where the tail points, the text, and the clip. Type
 * size, wrap width, colour, alignment, angle, scale and the house
 * opacity/stroke pair are style, and style belongs in the code — they were
 * copied onto every entry in every config, which is a lot of JSON saying the
 * same thing and a lot of places to change it when the style moves.
 *
 * Only defaults are removed. A value that differs is a decision someone made
 * about that caption and is left exactly as it is.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content", "toons");

/** Mirrors captionModel.defaultSize / bubbles.ts — keep the two in step. */
const DEFAULT_SIZE = { burst: 28, ai: 20, badai: 20, credit: 18 };
const DEFAULT_BUBBLE_OPACITY = 0.75;
const DEFAULT_STROKE_WIDTH = 5;

function variantOf(word) {
  const v = String(word.variant || word.mode || "plain").toLowerCase();
  if (["badai", "bad-ai", "ai-inverted", "ai-bad"].includes(v)) return "badai";
  if (["ai", "hud", "terminal", "caption"].includes(v)) return "ai";
  if (["burst", "spiky", "star", "shout"].includes(v)) return "burst";
  if (["thought", "think", "cloud"].includes(v)) return "thought";
  if (["bubble", "dialog", "speech"].includes(v)) return "bubble";
  if (["credit", "credits"].includes(v)) return "credit";
  return "plain";
}

function defaultColor(variant) {
  if (variant === "ai") return "#f5f5f5";
  if (variant === "badai") return "#0a0a0a";
  if (variant === "bubble" || variant === "thought" || variant === "burst") return "#111111";
  return "#fff";
}

function slimWord(word) {
  const variant = variantOf(word);
  const out = { ...word };
  let dropped = 0;
  const drop = (key) => {
    if (key in out) {
      delete out[key];
      dropped += 1;
    }
  };

  if (out.align === "center") drop("align");
  if (Number(out.size) === (DEFAULT_SIZE[variant] ?? 22)) drop("size");
  if (typeof out.color === "string" && out.color.toLowerCase() === defaultColor(variant)) drop("color");
  if (Number(out.angle) === 0) drop("angle");
  if (Number(out.scale) === 1) drop("scale");
  // The wrap width is computed from the text now. An explicit one is a fraction
  // of the plate and does not travel between sizes, so it goes even when set.
  drop("maxWidth");

  if (out.bubble && typeof out.bubble === "object") {
    const bubble = { ...out.bubble };
    if (Number(bubble.opacity) === DEFAULT_BUBBLE_OPACITY) {
      delete bubble.opacity;
      dropped += 1;
    }
    if (Number(bubble.strokeWidth) === DEFAULT_STROKE_WIDTH) {
      delete bubble.strokeWidth;
      dropped += 1;
    }
    // A lone tail reads better hoisted: `"tail": "bottom-left"` beside the
    // variant, rather than a one-key object. resolveBubbleStyle already accepts
    // the top-level form.
    if (Object.keys(bubble).length === 1 && typeof bubble.tail === "string") {
      out.tail = bubble.tail;
      delete out.bubble;
    } else if (Object.keys(bubble).length === 0) {
      delete out.bubble;
    } else {
      out.bubble = bubble;
    }
  }

  return { word: out, dropped };
}

/** Key order that reads like a sentence: where, what, where it points, what it says. */
const ORDER = [
  "x",
  "y",
  "variant",
  "tail",
  "size",
  "color",
  "angle",
  "scale",
  "align",
  "maxWidth",
  "bubble",
  "text",
  "audio",
  "volume",
];

function ordered(word) {
  const out = {};
  for (const key of ORDER) if (key in word) out[key] = word[key];
  for (const key of Object.keys(word)) if (!(key in out)) out[key] = word[key];
  return out;
}

function slimConfig(config) {
  let dropped = 0;
  for (const page of config.pages || []) {
    page.words = (page.words || []).map((word) => {
      const result = slimWord(word);
      dropped += result.dropped;
      return ordered(result.word);
    });
  }
  return dropped;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const toonIdx = args.indexOf("--toon");
  const toons = all
    ? fs.readdirSync(CONTENT).filter((d) => fs.existsSync(path.join(CONTENT, d, "config.json")))
    : toonIdx >= 0 && args[toonIdx + 1]
      ? [args[toonIdx + 1]]
      : [];

  if (!toons.length) {
    console.error("usage: slim-toon-config.js --toon <id> [--dry-run]   |   --all [--dry-run]");
    process.exit(1);
  }

  for (const toon of toons) {
    const file = path.join(CONTENT, toon, "config.json");
    if (!fs.existsSync(file)) {
      console.error(`skip ${toon}: no config.json`);
      continue;
    }
    const before = fs.readFileSync(file, "utf8");
    const config = JSON.parse(before);
    const dropped = slimConfig(config);
    const after = `${JSON.stringify(config, null, 2)}\n`;
    const savedLines = before.split("\n").length - after.split("\n").length;
    console.log(`${toon}: ${dropped} field(s) removed, ${savedLines} fewer lines${dryRun ? " (dry run)" : ""}`);
    if (!dryRun) fs.writeFileSync(file, after);
  }
}

main();
