import { describe, it, expect } from "vitest";
import { DEFAULT_COVER_STORY, resolveCoverStory } from "./coverStory";

describe("resolveCoverStory", () => {
  it("returns trimmed synopsis when provided", () => {
    expect(resolveCoverStory("  Hello case.  ")).toBe("Hello case.");
  });

  it("falls back for null, empty, or whitespace", () => {
    expect(resolveCoverStory(null)).toBe(DEFAULT_COVER_STORY);
    expect(resolveCoverStory(undefined)).toBe(DEFAULT_COVER_STORY);
    expect(resolveCoverStory("")).toBe(DEFAULT_COVER_STORY);
    expect(resolveCoverStory("   ")).toBe(DEFAULT_COVER_STORY);
  });

  it("picks a locale from a map and falls back to English", () => {
    const map = { en: "English case.", fr: "Affaire française." };
    expect(resolveCoverStory(map, "fr")).toBe("Affaire française.");
    expect(resolveCoverStory(map, "de")).toBe("English case.");
  });
});
