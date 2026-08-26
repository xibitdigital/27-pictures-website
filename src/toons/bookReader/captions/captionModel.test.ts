import { describe, it, expect } from "vitest";
import {
  buildCaption,
  buildCaptions,
  imageContentBox,
  readingOrder,
  resolveVariant,
  toFraction,
  type CaptionContext,
  autoWrapCh,
  ellipsePadding,
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

describe("config defaults (a lean word entry)", () => {
  const ctx = {
    lang: "en" as const,
    pageNum: 1,
    designWidth: 800,
    designHeight: 1424,
    designScale: 1,
    fontFamily: "Bangers, cursive",
  };

  it("renders a balloon from position, variant, tail and text alone", () => {
    const c = buildCaption(
      { x: 0.2, y: 0.15, variant: "bubble", tail: "top-left", text: { en: "No signal." } },
      0,
      ctx
    )!;
    expect(c).not.toBeNull();
    expect(c.tail).toBe("top-left");
    // Size, colour and wrap width all come from the code now.
    expect(c.style["font-size"]).toBe("22px");
    expect(c.textStyle.color).toBe("#111111");
    expect(c.style["max-width"]).toMatch(/^calc\(14ch \+/);
    // Padding is derived from the bubble style, never authored per caption.
    expect(c.textStyle.padding).toBeTruthy();
  });

  it("gives a long burst room for its spike padding so it wraps to two lines", () => {
    const shout = "BRING ME THE DOOR-BREAKER!";
    const c = buildCaption({ x: 0.72, y: 0.06, variant: "burst", text: { en: shout } }, 0, ctx)!;
    expect(autoWrapCh(shout)).toBe(14);
    expect(c.style["max-width"]).toBe("calc(20ch + 6.4em)");
  });

  it("draws onomatopoeia larger than speech without being told", () => {
    const burst = buildCaption({ x: 0.2, y: 0.4, variant: "burst", text: { en: "DING" } }, 0, ctx)!;
    const line = buildCaption({ x: 0.2, y: 0.4, variant: "bubble", text: { en: "DING" } }, 0, ctx)!;
    expect(burst.style["font-size"]).toBe("28px");
    expect(line.style["font-size"]).toBe("22px");
  });

  it("still obeys an explicit size and maxWidth", () => {
    const c = buildCaption(
      { x: 0.2, y: 0.4, variant: "bubble", size: 40, maxWidth: 0.25, text: { en: "Loud." } },
      0,
      ctx
    )!;
    expect(c.style["font-size"]).toBe("40px");
    expect(c.style["max-width"]).toBe("25%");
  });
});

describe("autoWrapCh", () => {
  it("keeps a long line to about two lines", () => {
    const text = "Car park, then the street and I'll be safe.";
    expect(autoWrapCh(text)).toBe(22);
    expect(Math.ceil(text.length / autoWrapCh(text))).toBe(2);
  });

  it("never wraps narrower than the longest word", () => {
    // Would otherwise compute 14 and break the word across lines.
    expect(autoWrapCh("Unterschriftenmappe")).toBe(19);
  });

  it("caps the widest balloon so a long caption is not a strip", () => {
    expect(autoWrapCh("x".repeat(20) + " " + "y".repeat(20) + " " + "z".repeat(20))).toBeLessThanOrEqual(28);
  });
});

describe("ellipsePadding", () => {
  const base = { padX: 1, padY: 1 };

  it("opens a wide balloon out so the first and last lines clear the curve", () => {
    // A rectangle inscribed in an ellipse only touches it at the mid-points of
    // its sides, so a flat 1em left the outer lines running into the outline.
    const wide = ellipsePadding("Car park, then the street and I'll be safe.", 22, base);
    expect(wide.padX).toBeGreaterThan(base.padX * 2);
  });

  it("leaves a short caption on the variant's own padding", () => {
    expect(ellipsePadding("No signal.", 14, base)).toEqual({ padX: 1, padY: 1 });
  });

  it("gives a burst more room than an ellipse, because the spikes cut in", () => {
    // starBurstPath: inner radius 27 against an outer 48 — the usable middle is
    // barely half the balloon, which is what put the lettering on the points.
    const burst = ellipsePadding("KRUNCH", 14, { padX: 1.1, padY: 0.9 }, "star");
    const oval = ellipsePadding("KRUNCH", 14, { padX: 1.1, padY: 0.9 });
    expect(burst.padX).toBeGreaterThan(oval.padX);
  });

  it("caps the padding so a long caption is not mostly air", () => {
    const huge = ellipsePadding("x".repeat(200), 28, base);
    expect(huge.padX).toBeLessThanOrEqual(2.6);
    expect(huge.padY).toBeLessThanOrEqual(1.8);
  });

  it("never returns less than the variant asked for", () => {
    const generous = ellipsePadding("Hm.", 14, { padX: 1.4, padY: 1.2 });
    expect(generous.padX).toBe(1.4);
    expect(generous.padY).toBe(1.2);
  });
});
