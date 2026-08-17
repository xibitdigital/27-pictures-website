import { describe, it, expect, beforeEach } from "vitest";
import {
  parsePageQuery,
  contentPageToViewIndex,
  writePageQuery,
  resetPageQueryCache,
  deepLinkReleased,
  DEEP_LINK_RELEASE_PX,
} from "./pageQuery";

/** Put the jsdom window on a given URL without touching the module cache. */
function setUrl(search: string): void {
  window.history.replaceState(null, "", `/toons/nero/${search}`);
  resetPageQueryCache();
}

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

describe("writePageQuery", () => {
  beforeEach(() => setUrl(""));

  it("writes, updates and removes the param without adding history entries", () => {
    const before = window.history.length;
    writePageQuery(3);
    expect(window.location.search).toBe("?page=3");
    writePageQuery(4);
    expect(window.location.search).toBe("?page=4");
    writePageQuery(null);
    expect(window.location.search).toBe("");
    // replaceState, not pushState — Back must leave the book, not walk it.
    expect(window.history.length).toBe(before);
  });

  it("keeps other params and the hash intact", () => {
    setUrl("?lang=it#top");
    writePageQuery(7);
    expect(window.location.search).toContain("lang=it");
    expect(window.location.search).toContain("page=7");
    expect(window.location.hash).toBe("#top");
  });

  it("ignores pages below 1 rather than clamping them", () => {
    writePageQuery(0);
    expect(window.location.search).toBe("");
  });

  it("does not clobber the load-time page for a later reader", () => {
    // The regression: flip engine lands on the cover and clears ?page=, then
    // the vertical strip resolves its deep-link and finds nothing.
    setUrl("?page=12");
    expect(parsePageQuery()).toBe(12);
    writePageQuery(null); // engine reaches the cover
    expect(window.location.search).toBe("");
    // A consumer that reads later still sees the page the document loaded with.
    expect(parsePageQuery()).toBe(12);
  });

  it("still parses an explicit search string uncached", () => {
    setUrl("?page=12");
    expect(parsePageQuery()).toBe(12);
    expect(parsePageQuery("?page=4")).toBe(4);
    expect(parsePageQuery()).toBe(12);
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

describe("deepLinkReleased", () => {
  it("ignores the small reflow the deep link itself causes", () => {
    expect(deepLinkReleased(32, 32)).toBe(false);
    expect(deepLinkReleased(32, 60)).toBe(false);
  });

  it("releases once the reader has scrolled away", () => {
    expect(deepLinkReleased(32, 212)).toBe(true);
    expect(deepLinkReleased(32, 32 + DEEP_LINK_RELEASE_PX)).toBe(true);
    // Upward flings count too — the direction is not the point.
    expect(deepLinkReleased(400, 100)).toBe(true);
  });

  it("stays put while nothing has been applied yet", () => {
    expect(deepLinkReleased(null, 5000)).toBe(false);
  });
});
