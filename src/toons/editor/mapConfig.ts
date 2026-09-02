/**
 * D1 editor records ↔ reader ToonConfig / WordEntry.
 * The live FlipFrame reader still loads hashed JSON; this is how a draft
 * round-trips into that shape without a second schema.
 */
import voicesLock from "../../../scripts/voices.json";
import type { LangCode, ToonConfig, WordEntry, WordTextMap } from "../bookReader/types";
import type { BubbleRecord, PageRecord, ToonRecord } from "./types";

export const VOICE_NAMES = Object.keys(voicesLock as Record<string, string>).sort();

export const BUBBLE_VARIANTS = ["bubble", "thought", "burst", "ai", "badai", "credit"] as const;
export type BubbleVariant = (typeof BUBBLE_VARIANTS)[number];

export const BUBBLE_TAILS = [
  "none",
  "top",
  "top-left",
  "top-right",
  "bottom",
  "bottom-left",
  "bottom-right",
  "left",
  "right",
] as const;
export type BubbleTail = (typeof BUBBLE_TAILS)[number];

export const CAPTION_LANGS = [
  { code: "en" as const, label: "English" },
  { code: "it" as const, label: "Italiano" },
  { code: "de" as const, label: "Deutsch" },
  { code: "fr" as const, label: "Français" },
];

export function bubbleTextMap(bubble: BubbleRecord): WordTextMap {
  if (bubble.textJson) {
    try {
      const parsed = JSON.parse(bubble.textJson) as WordTextMap;
      if (parsed && typeof parsed === "object") {
        return { ...parsed, en: parsed.en ?? bubble.textEn };
      }
    } catch {
      /* fall through */
    }
  }
  return { en: bubble.textEn };
}

export function textPatch(
  bubble: BubbleRecord,
  lang: LangCode,
  value: string
): Pick<BubbleRecord, "textEn" | "textJson"> {
  const map: WordTextMap = { ...bubbleTextMap(bubble), [lang]: value };
  return { textEn: map.en ?? "", textJson: JSON.stringify(map) };
}

export function bubbleExtra(bubble: BubbleRecord): Record<string, unknown> {
  if (!bubble.extraJson) return {};
  try {
    const parsed = JSON.parse(bubble.extraJson) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function extraPatch(bubble: BubbleRecord, key: string, value: unknown): Pick<BubbleRecord, "extraJson"> {
  const extra = { ...bubbleExtra(bubble) };
  if (value == null || value === "") delete extra[key];
  else extra[key] = value;
  return { extraJson: Object.keys(extra).length ? JSON.stringify(extra) : null };
}

/** `#rgb` / `#rrggbb` → `#rrggbb`. Null when empty or not a hex color. */
export function parseHexColor(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => `${c}${c}`)
      .join("");
  return `#${h}`;
}

export function bubbleColor(bubble: BubbleRecord): string {
  const extra = bubbleExtra(bubble);
  return typeof extra.color === "string" ? extra.color : "";
}

export function bubbleStrokeColor(bubble: BubbleRecord): string {
  const extra = bubbleExtra(bubble);
  if (typeof extra.strokeColor === "string") return extra.strokeColor;
  if (typeof extra.stroke === "string") return extra.stroke;
  if (extra.stroke && typeof extra.stroke === "object") {
    const s = extra.stroke as Record<string, unknown>;
    if (typeof s.color === "string") return s.color;
    if (typeof s.strokeColor === "string") return s.strokeColor;
  }
  return "";
}

export function bubbleStrokeThickness(bubble: BubbleRecord): number | null {
  const extra = bubbleExtra(bubble);
  if (typeof extra.strokeThickness === "number" && Number.isFinite(extra.strokeThickness)) {
    return extra.strokeThickness;
  }
  if (typeof extra.strokeWidth === "number" && Number.isFinite(extra.strokeWidth)) {
    return extra.strokeWidth;
  }
  if (extra.stroke && typeof extra.stroke === "object") {
    const s = extra.stroke as Record<string, unknown>;
    const t = s.thickness ?? s.width;
    if (typeof t === "number" && Number.isFinite(t)) return t;
  }
  return null;
}

/**
 * Lettering extras the reader already understands (`color`, `stroke`,
 * `strokeThickness`). Object-shaped `stroke` from old configs is flattened.
 */
export function letteringPatch(
  bubble: BubbleRecord,
  patch: { color?: string | null; stroke?: string | null; strokeThickness?: number | null }
): Pick<BubbleRecord, "extraJson"> {
  const extra: Record<string, unknown> = { ...bubbleExtra(bubble) };
  if (extra.stroke && typeof extra.stroke === "object") {
    const s = extra.stroke as Record<string, unknown>;
    const color = s.color || s.strokeColor;
    const t = s.thickness ?? s.width;
    delete extra.stroke;
    if (typeof color === "string" && extra.strokeColor == null) extra.stroke = color;
    if (typeof t === "number" && extra.strokeThickness == null && extra.strokeWidth == null) {
      extra.strokeThickness = t;
    }
  }
  if ("color" in patch) {
    if (!patch.color) delete extra.color;
    else extra.color = patch.color;
  }
  if ("stroke" in patch) {
    if (!patch.stroke) {
      delete extra.stroke;
      delete extra.strokeColor;
    } else {
      extra.stroke = patch.stroke;
      delete extra.strokeColor;
    }
  }
  if ("strokeThickness" in patch) {
    if (patch.strokeThickness == null) {
      delete extra.strokeThickness;
      delete extra.strokeWidth;
    } else {
      extra.strokeThickness = patch.strokeThickness;
      delete extra.strokeWidth;
    }
  }
  return { extraJson: Object.keys(extra).length ? JSON.stringify(extra) : null };
}

export function bubbleAudio(bubble: BubbleRecord): string {
  const audio = bubbleExtra(bubble).audio;
  return typeof audio === "string" ? audio : "";
}

export function bubbleVoice(bubble: BubbleRecord): string {
  const voice = bubbleExtra(bubble).voice;
  return typeof voice === "string" ? voice : "";
}

const VARIANT_AUDIO_TAG: Record<string, string> = {
  burst: "[shouts]",
  thought: "[whispers]",
  credit: "[flatly]",
  ai: "[flatly]",
  badai: "[angry]",
};

/** Spoken TTS line: variant audio tag + English caption. Display text stays clean. */
export function spokenElevenLine(input: { text: string; variant: string }): string {
  const line = String(input.text || "").trim();
  const tag = VARIANT_AUDIO_TAG[input.variant] || "";
  return [tag, line].filter(Boolean).join(" ");
}

/** Fields the Worker PATCH accepts for a caption. */
export function bubbleWritePayload(bubble: BubbleRecord): Partial<BubbleRecord> {
  return {
    x: bubble.x,
    y: bubble.y,
    variant: bubble.variant,
    tail: bubble.tail,
    size: bubble.size,
    angle: bubble.angle,
    textEn: bubble.textEn,
    textJson: bubble.textJson ?? null,
    extraJson: bubble.extraJson ?? null,
  };
}

/** Empty captions still need a glyph so WordCaption / buildCaption will render. */
export const PLACEHOLDER_TEXT = "…";

export function bubbleToWordEntry(bubble: BubbleRecord): WordEntry {
  let textMap: Record<string, string> | null = null;
  if (bubble.textJson) {
    try {
      textMap = JSON.parse(bubble.textJson) as Record<string, string>;
    } catch {
      textMap = null;
    }
  }
  const text = (textMap?.en || bubble.textEn).trim() ? textMap?.en || bubble.textEn : PLACEHOLDER_TEXT;
  const entry: WordEntry = {
    x: bubble.x,
    y: bubble.y,
    align: "center",
    variant: bubble.variant || "bubble",
    text: textMap && Object.keys(textMap).length ? textMap : { en: text },
  };
  if (bubble.tail) entry.tail = bubble.tail;
  if (bubble.size != null) entry.size = bubble.size;
  if (bubble.angle != null) entry.angle = bubble.angle;
  if (bubble.extraJson) {
    try {
      Object.assign(entry, JSON.parse(bubble.extraJson) as Record<string, unknown>);
    } catch {
      /* ignore */
    }
  }
  return entry;
}

export function exportToonConfig(
  toon: Pick<ToonRecord, "title" | "designWidth" | "designHeight">,
  pages: PageRecord[]
): ToonConfig {
  const ordered = pages.slice().sort((a, b) => a.position - b.position);
  return {
    title: toon.title,
    designWidth: toon.designWidth,
    designHeight: toon.designHeight,
    defaultLang: "en",
    languages: [{ code: "en", label: "EN" }],
    pages: ordered.map((page) => ({
      file: page.fileKey,
      words: page.bubbles
        .slice()
        .sort((a, b) => a.sort - b.sort)
        .map((bubble) => {
          const word = bubbleToWordEntry(bubble);
          const map = word.text as { en: string };
          if (map.en === PLACEHOLDER_TEXT && !bubble.textEn.trim()) {
            word.text = { en: "" };
          }
          return word;
        }),
    })),
  };
}
