import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WordOverlay,
  toFraction,
  imageContentBox,
  loadWords,
  LANG_STORAGE_KEY,
} from "./words";
import type { WordsConfig } from "./types";

const sampleConfig: WordsConfig = {
  designWidth: 1008,
  designHeight: 1792,
  defaultLang: "en",
  languages: [
    { code: "en", label: "EN" },
    { code: "it", label: "IT" },
  ],
  pages: {
    "1": [
      {
        x: 0.5,
        y: 0.2,
        size: 40,
        text: { en: "HELLO", it: "CIAO" },
      },
      {
        x: 0.3,
        y: 0.8,
        size: 30,
        variant: "ai",
        text: { en: "WE ARE IN!" },
      },
    ],
    "2": [],
  },
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

describe("imageContentBox", () => {
  it("returns object-fit contain box within element bounds", () => {
    const img = document.createElement("img");
    Object.defineProperty(img, "naturalWidth", { value: 1008 });
    Object.defineProperty(img, "naturalHeight", { value: 1792 });
    Object.defineProperty(img, "clientWidth", { value: 504 });
    Object.defineProperty(img, "clientHeight", { value: 896 });
    // getBoundingClientRect for completeness
    img.getBoundingClientRect = () =>
      ({
        width: 504,
        height: 896,
        top: 0,
        left: 0,
        right: 504,
        bottom: 896,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const box = imageContentBox(img);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.width).toBeLessThanOrEqual(504 + 0.5);
    expect(box.height).toBeLessThanOrEqual(896 + 0.5);
  });
});

describe("WordOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults language and lists languages", () => {
    const o = new WordOverlay(sampleConfig);
    expect(o.getLang()).toBe("en");
    expect(o.getLanguages()).toHaveLength(2);
  });

  it("persists language choice", () => {
    const o = new WordOverlay(sampleConfig);
    o.setLang("it");
    expect(o.getLang()).toBe("it");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("it");

    const o2 = new WordOverlay(sampleConfig);
    expect(o2.getLang()).toBe("it");
  });

  it("ignores unknown language codes", () => {
    const o = new WordOverlay(sampleConfig);
    o.setLang("xx");
    expect(o.getLang()).toBe("en");
  });

  it("returns words for a page", () => {
    const o = new WordOverlay(sampleConfig);
    expect(o.wordsForPage(1)).toHaveLength(2);
    expect(o.wordsForPage(2)).toHaveLength(0);
    expect(o.wordsForPage(99)).toHaveLength(0);
  });

  it("paints and clears word layers on a slot", () => {
    const o = new WordOverlay(sampleConfig);
    const slot = document.createElement("div");
    slot.className = "page-slot";
    const img = document.createElement("img");
    Object.defineProperty(img, "naturalWidth", { value: 1008 });
    Object.defineProperty(img, "naturalHeight", { value: 1792 });
    Object.defineProperty(img, "clientWidth", { value: 300 });
    Object.defineProperty(img, "clientHeight", { value: 500 });
    img.getBoundingClientRect = () =>
      ({
        width: 300,
        height: 500,
        top: 0,
        left: 0,
        right: 300,
        bottom: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    // isConnected true when in document
    document.body.appendChild(slot);
    slot.appendChild(img);

    o.render(slot, 1);
    expect(slot.querySelector(".jax-word-layer")).toBeTruthy();
    expect(slot.querySelectorAll(".jax-word").length).toBeGreaterThan(0);

    o.render(slot, null);
    expect(slot.querySelector(".jax-word-layer")).toBeNull();
  });

  it("refreshSlots re-paints only provided slots", () => {
    const o = new WordOverlay(sampleConfig);
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    const img = document.createElement("img");
    Object.defineProperty(img, "naturalWidth", { value: 100 });
    Object.defineProperty(img, "naturalHeight", { value: 100 });
    Object.defineProperty(img, "clientWidth", { value: 100 });
    Object.defineProperty(img, "clientHeight", { value: 100 });
    img.getBoundingClientRect = () =>
      ({
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    slot.appendChild(img);
    slot.dataset.pageNum = "1";

    o.refreshSlots([slot]);
    expect(slot.querySelector(".jax-word-layer")).toBeTruthy();
  });
});

describe("loadWords", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and returns JSON config", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleConfig,
      })
    );
    const cfg = await loadWords("words.json");
    expect(cfg.pages?.["1"]).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith("words.json", { cache: "no-cache" });
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );
    await expect(loadWords("missing.json")).rejects.toThrow(/words\.json 404/);
  });
});
