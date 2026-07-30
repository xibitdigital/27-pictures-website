import { describe, it, expect } from "vitest";
import { parsePageQuery, contentPageToViewIndex } from "./pageQuery";

describe("parsePageQuery", () => {
  it("parses 1-based page from search string", () => {
    expect(parsePageQuery("?page=3")).toBe(3);
    expect(parsePageQuery("page=17")).toBe(17);
    expect(parsePageQuery("?foo=1&page=2")).toBe(2);
  });

  it("returns null for missing or invalid", () => {
    expect(parsePageQuery("")).toBeNull();
    expect(parsePageQuery("?page=")).toBeNull();
    expect(parsePageQuery("?page=0")).toBeNull();
    expect(parsePageQuery("?page=-1")).toBeNull();
    expect(parsePageQuery("?page=abc")).toBeNull();
    expect(parsePageQuery("?other=3")).toBeNull();
  });

  it("floors decimals", () => {
    expect(parsePageQuery("?page=3.9")).toBe(3);
  });
});

describe("contentPageToViewIndex", () => {
  it("maps content page to single-page viewIndex (cover at 0)", () => {
    // 4 pages → views: cover,1,2,3,4,back
    expect(contentPageToViewIndex(1, 4, true, 3)).toBe(1);
    expect(contentPageToViewIndex(3, 4, true, 3)).toBe(3);
    expect(contentPageToViewIndex(4, 4, true, 3)).toBe(4);
  });

  it("clamps to page count", () => {
    expect(contentPageToViewIndex(99, 4, true, 3)).toBe(4);
    expect(contentPageToViewIndex(0, 4, true, 3)).toBe(1);
  });

  it("maps to spread index in book mode", () => {
    // page 1 → spread 0, page 2 → spread 1, page 3 → spread 1, page 4 → spread 2
    expect(contentPageToViewIndex(1, 4, false, 3)).toBe(0);
    expect(contentPageToViewIndex(2, 4, false, 3)).toBe(1);
    expect(contentPageToViewIndex(3, 4, false, 3)).toBe(1);
    expect(contentPageToViewIndex(4, 4, false, 3)).toBe(2);
  });
});
