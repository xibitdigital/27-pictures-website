import { describe, expect, it, vi } from "vitest";
import {
  canScrollPageDown,
  chromeOffsetPx,
  CHROME_GAP_PX,
  DEFAULT_CHROME_OFFSET_PX,
  nextPageAlignY,
  remainingScroll,
  SCROLL_PAGE_FRACTION,
  scrollPageDown,
  scrollTargetY,
  USER_SCROLL_EVENT,
} from "./scrollPage";

function box(top: number): { getBoundingClientRect: () => { top: number } } {
  return { getBoundingClientRect: () => ({ top }) };
}

describe("scrollPage", () => {
  it("advances 90% of the viewport", () => {
    expect(SCROLL_PAGE_FRACTION).toBe(0.9);
  });

  it("hides once the remaining strip is a few pixels", () => {
    expect(remainingScroll(0, 800, 2000)).toBe(1200);
    expect(canScrollPageDown(0, 800, 2000)).toBe(true);
    expect(canScrollPageDown(1191, 800, 2000)).toBe(true);
    expect(canScrollPageDown(1192, 800, 2000)).toBe(false);
    expect(canScrollPageDown(1200, 800, 2000)).toBe(false);
  });

  it("aligns the next plate just under the chrome when that is within the jump", () => {
    const align = nextPageAlignY([box(0), box(500)], 0, 40);
    expect(align).toBe(460);
    expect(scrollTargetY(0, 1000, align)).toBe(460);
  });

  it("keeps the 90% jump when the next plate is further away", () => {
    const align = nextPageAlignY([box(0), box(2000)], 0, 40);
    expect(align).toBe(1960);
    expect(scrollTargetY(0, 1000, align)).toBe(900);
  });

  it("skips a plate already sitting under the chrome", () => {
    const align = nextPageAlignY([box(40), box(900)], 100, 40);
    expect(align).toBe(960);
  });

  it("does not spend a press micro-snapping the current plate up to the chrome", () => {
    // Load / reader padding: plate 1 a few px below the bar. Old logic snapped ~40px.
    expect(nextPageAlignY([box(12), box(1500)], 0, 50)).toBe(1450);
    expect(nextPageAlignY([box(80), box(1500)], 0, 50)).toBe(1450);
    expect(scrollTargetY(0, 1000, 1450)).toBe(900);
  });

  it("snaps when the next plate is on this screen, even if past the 90% jump", () => {
    expect(scrollTargetY(0, 1000, 950)).toBe(950);
    // Nero-sized plate on a phone: 858 vs 844 — one pixel past the viewport.
    expect(scrollTargetY(0, 844, 858)).toBe(858);
  });

  it("prefers visualViewport height when the browser reports one", () => {
    const scrollTo = vi.fn();
    const win = {
      innerHeight: 1000,
      scrollY: 0,
      visualViewport: { height: 700 },
      matchMedia: () => ({ matches: false }),
      scrollTo,
    } as unknown as Window;
    scrollPageDown(win, { pages: [] });
    expect(scrollTo).toHaveBeenCalledWith({ top: 630, behavior: "smooth" });
  });

  it("scrolls by 90% of innerHeight, smooth unless reduced-motion or a coarse pointer", () => {
    const scrollTo = vi.fn();
    const win = {
      innerHeight: 1000,
      scrollY: 0,
      matchMedia: () => ({ matches: false }),
      scrollTo,
    } as unknown as Window;
    scrollPageDown(win, { pages: [] });
    expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: "smooth" });

    const reduce = {
      innerHeight: 1000,
      scrollY: 0,
      matchMedia: () => ({ matches: true }),
      scrollTo,
    } as unknown as Window;
    scrollTo.mockClear();
    scrollPageDown(reduce, { pages: [] });
    expect(scrollTo).toHaveBeenCalledWith(0, 900);

    const coarse = {
      innerHeight: 1000,
      scrollY: 0,
      matchMedia: (q: string) => ({ matches: q.includes("pointer: coarse") }),
      scrollTo,
    } as unknown as Window;
    scrollTo.mockClear();
    scrollPageDown(coarse, { pages: [] });
    expect(scrollTo).toHaveBeenCalledWith(0, 900);
  });

  it("signals a user scroll so the deep-link retry cannot yank back", () => {
    const scrollTo = vi.fn();
    const dispatchEvent = vi.fn();
    const win = {
      innerHeight: 1000,
      scrollY: 0,
      matchMedia: () => ({ matches: false }),
      scrollTo,
      dispatchEvent,
    } as unknown as Window;
    scrollPageDown(win, { pages: [] });
    expect(dispatchEvent).toHaveBeenCalledWith(expect.any(Event));
    expect((dispatchEvent.mock.calls[0][0] as Event).type).toBe(USER_SCROLL_EVENT);
  });

  it("snaps to the next plate on the last press of a page", () => {
    const scrollTo = vi.fn();
    const win = {
      innerHeight: 1000,
      scrollY: 200,
      matchMedia: () => ({ matches: false }),
      scrollTo,
    } as unknown as Window;
    // Plate 2's top is 400px below the viewport top → document Y 600; chrome 40 → align 560.
    // Jump from 200 is 1000, so 560 is within the jump.
    scrollPageDown(win, { pages: [box(-200), box(400)], chromeOffset: 40 });
    expect(scrollTo).toHaveBeenCalledWith({ top: 560, behavior: "smooth" });
  });

  it("measures top chrome marked with data-reader-chrome", () => {
    const chrome = document.createElement("div");
    chrome.setAttribute("data-reader-chrome", "");
    chrome.getBoundingClientRect = () =>
      ({ top: 8, bottom: 48, height: 40, left: 0, right: 40, width: 40, x: 0, y: 8, toJSON: () => {} }) as DOMRect;
    document.body.appendChild(chrome);
    try {
      expect(chromeOffsetPx(document)).toBe(48 + CHROME_GAP_PX);
    } finally {
      chrome.remove();
    }
  });

  it("falls back to the progress hairline when no chrome is marked", () => {
    expect(chromeOffsetPx(document)).toBe(DEFAULT_CHROME_OFFSET_PX + CHROME_GAP_PX);
  });
});
