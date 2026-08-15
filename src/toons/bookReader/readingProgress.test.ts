import { describe, it, expect, beforeEach } from "vitest";
import { readProgress, writeProgress, clearProgress, PROGRESS_STORAGE_PREFIX } from "./readingProgress";

describe("readingProgress", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores the page, the total and when it happened", () => {
    writeProgress("erin", 5, 27, 1234);
    expect(readProgress("erin")).toEqual({ page: 5, pages: 27, at: 1234 });
  });

  it("does not count the first page — opening a book is not progress", () => {
    writeProgress("erin", 1, 27);
    expect(readProgress("erin")).toBeNull();
  });

  it("forgets a finished book so it leaves the continue-reading row", () => {
    writeProgress("erin", 5, 27);
    writeProgress("erin", 27, 27);
    expect(readProgress("erin")).toBeNull();
  });

  it("ignores a stored value that is not usable progress", () => {
    window.localStorage.setItem(`${PROGRESS_STORAGE_PREFIX}erin`, JSON.stringify({ page: 40, pages: 27, at: 1 }));
    expect(readProgress("erin")).toBeNull();
  });

  it("survives junk in storage", () => {
    window.localStorage.setItem(`${PROGRESS_STORAGE_PREFIX}erin`, "not json");
    expect(readProgress("erin")).toBeNull();
  });

  it("clears on request", () => {
    writeProgress("erin", 5, 27);
    clearProgress("erin");
    expect(readProgress("erin")).toBeNull();
  });
});
