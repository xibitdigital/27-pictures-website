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
});
