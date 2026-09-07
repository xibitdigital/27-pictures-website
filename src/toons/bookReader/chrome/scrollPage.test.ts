import { describe, expect, it, vi } from "vitest";
import { canScrollPageDown, remainingScroll, SCROLL_PAGE_FRACTION, scrollPageDown } from "./scrollPage";

describe("scrollPage", () => {
  it("advances 80% of the viewport", () => {
    expect(SCROLL_PAGE_FRACTION).toBe(0.8);
  });

  it("hides once the remaining strip is a few pixels", () => {
    expect(remainingScroll(0, 800, 2000)).toBe(1200);
    expect(canScrollPageDown(0, 800, 2000)).toBe(true);
    expect(canScrollPageDown(1191, 800, 2000)).toBe(true);
    expect(canScrollPageDown(1192, 800, 2000)).toBe(false);
    expect(canScrollPageDown(1200, 800, 2000)).toBe(false);
  });

  it("prefers visualViewport height when the browser reports one", () => {
    const scrollBy = vi.fn();
    const win = {
      innerHeight: 1000,
      visualViewport: { height: 700 },
      matchMedia: () => ({ matches: false }),
      scrollBy,
    } as unknown as Window;
    scrollPageDown(win);
    expect(scrollBy).toHaveBeenCalledWith({ top: 560, behavior: "smooth" });
  });

  it("scrolls by 80% of innerHeight, smooth unless reduced-motion", () => {
    const scrollBy = vi.fn();
    const win = {
      innerHeight: 1000,
      matchMedia: () => ({ matches: false }),
      scrollBy,
    } as unknown as Window;
    scrollPageDown(win);
    expect(scrollBy).toHaveBeenCalledWith({ top: 800, behavior: "smooth" });

    const reduce = {
      innerHeight: 1000,
      matchMedia: () => ({ matches: true }),
      scrollBy,
    } as unknown as Window;
    scrollBy.mockClear();
    scrollPageDown(reduce);
    expect(scrollBy).toHaveBeenCalledWith({ top: 800, behavior: "auto" });
  });
});
