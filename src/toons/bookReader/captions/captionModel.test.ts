import { describe, it, expect } from "vitest";
import {
  buildCaption,
  buildCaptions,
  imageContentBox,
  readingOrder,
  resolveVariant,
  toFraction,
  type CaptionContext,
} from "./captionModel";
import type { WordEntry } from "../types";

const ctx: CaptionContext = {
  lang: "en",
  pageNum: 1,
  designWidth: 1008,
  designHeight: 1792,
  designScale: 0.5,
  fontFamily: '"Bangers", cursive',
};

describe("toFraction", () => {
  it("treats values ≤1 as fractions", () => {
    expect(toFraction(0.5, 1008)).toBe(0.5);
    expect(toFraction(0, 1008)).toBe(0);
    expect(toFraction(1, 1008)).toBe(1);
  });

  it("treats values >1 as design pixels", () => {
    expect(toFraction(504, 1008)).toBeCloseTo(0.5);
    expect(toFraction(1008, 1008)).toBe(1);
  });

  it("clamps and handles nullish", () => {
    expect(toFraction(null, 1008)).toBe(0);
    expect(toFraction(undefined, 1008)).toBe(0);
    // Values >1 are design pixels → 2/1008
    expect(toFraction(2, 1008)).toBeCloseTo(2 / 1008);
    expect(toFraction(99999, 1008)).toBe(1);
  });
});

describe("resolveVariant", () => {
  it("maps every variant + alias, and only unknown words fall back to plain", () => {
    const cases: Record<string, string[]> = {
      thought: ["thought", "think", "cloud"],
      bubble: ["bubble", "dialog", "speech"],
      burst: ["burst", "spiky", "star", "shout"],
      ai: ["ai", "hud", "terminal", "caption"],
      badai: ["badai", "bad-ai", "ai-inverted", "ai-bad"],
      credit: ["credit", "credits"],
    };
    for (const [expected, aliases] of Object.entries(cases)) {
      for (const alias of aliases) {
        // Every alias must survive — a missing case silently degrades to "plain",
        // which drops the bubble chrome entirely (thought did exactly that).
        expect(resolveVariant({ variant: alias }), alias).toBe(expected);
        expect(resolveVariant({ variant: alias.toUpperCase() }), alias).toBe(expected);
        expect(resolveVariant({ mode: alias }), `mode:${alias}`).toBe(expected);
      }
    }
    expect(resolveVariant({})).toBe("plain");
    expect(resolveVariant({ variant: "nonsense" })).toBe("plain");
  });
});

describe("imageContentBox", () => {
  it("returns object-fit contain box within element bounds", () => {
    const img = document.createElement("img");
    Object.defineProperty(img, "naturalWidth", { value: 1008 });
    Object.defineProperty(img, "naturalHeight", { value: 1792 });
    Object.defineProperty(img, "clientWidth", { value: 504 });
    Object.defineProperty(img, "clientHeight", { value: 896 });

    const box = imageContentBox(img);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.width).toBeLessThanOrEqual(504 + 0.5);
    expect(box.height).toBeLessThanOrEqual(896 + 0.5);
  });
});

describe("buildCaption", () => {
  it("places a plain word by fraction and keeps position out of `transform`", () => {
    const c = buildCaption({ x: 0.5, y: 0.25, text: "HELLO" } as WordEntry, 0, ctx)!;
    expect(c.text).toBe("HELLO");
    expect(c.style.left).toBe("50%");
    expect(c.style.top).toBe("25%");
    expect(c.style["--jax-transform"]).toContain("translate(-50%, -50%)");
    expect(c.style.transform).toBeUndefined();
    expect(c.classes).toContain("jax-word");
    expect(c.bubble).toBeNull();
  });

  it("picks the caption language, falling back to English", () => {
    const w = { x: 0.5, y: 0.5, text: { en: "HELLO", it: "CIAO" } } as unknown as WordEntry;
    expect(buildCaption(w, 0, ctx)!.text).toBe("HELLO");
    expect(buildCaption(w, 0, { ...ctx, lang: "it" })!.text).toBe("CIAO");
    expect(buildCaption(w, 0, { ...ctx, lang: "de" })!.text).toBe("HELLO");
  });

  it("gives bubbles chrome and makes them (and any SFX word) clickable", () => {
    const bubble = buildCaption({ x: 0.5, y: 0.5, variant: "bubble", text: "Hi" } as WordEntry, 0, ctx)!;
    expect(bubble.classes).toContain("jax-word--bubble");
    expect(bubble.bubble?.paths.length).toBeGreaterThan(0);
    // Layer is pointer-events:none — captures clicks so .nav-zone can't turn the page.
    expect(bubble.style["pointer-events"]).toBe("auto");

    const sfx = buildCaption({ x: 0.5, y: 0.5, text: "BOOM", audio: "sfx/x.mp3" } as WordEntry, 1, ctx)!;
    expect(sfx.classes).toContain("jax-word--sfx");
    expect(sfx.audio).toBe("sfx/x.mp3");
    expect(sfx.style["pointer-events"]).toBe("auto");
    expect(sfx.style.cursor).toBe("pointer");
  });

  it("drops words with no text for the current language", () => {
    const words = [
      { x: 0.1, y: 0.1, text: { it: "SOLO ITALIANO" } },
      { x: 0.2, y: 0.2, text: "KEEP" },
    ] as unknown as WordEntry[];
    // Falls back to any available language rather than dropping silently.
    expect(buildCaptions(words, ctx)).toHaveLength(2);
    expect(buildCaptions([{ x: 0, y: 0 } as WordEntry], ctx)).toHaveLength(0);
  });
});

describe("readingOrder", () => {
  it("reads top→bottom, left→right inside a row", () => {
    const items = [
      { id: "bottom", x: 0.5, y: 0.8 },
      { id: "top-right", x: 0.8, y: 0.1 },
      // Same row as top-right (within tolerance) → left one speaks first.
      { id: "top-left", x: 0.2, y: 0.12 },
    ];
    expect(readingOrder(items).map((i) => i.id)).toEqual(["top-left", "top-right", "bottom"]);
  });
});
