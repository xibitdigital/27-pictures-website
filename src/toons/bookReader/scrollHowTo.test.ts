import { describe, it, expect, beforeEach } from "vitest";
import { SCROLL_HOWTO_KEY, hasSeenScrollHowTo, markScrollHowToSeen, shouldShowScrollHowTo } from "./scrollHowTo";

const ready = {
  seen: false,
  mobile: true,
  vertical: true,
  guideOpen: false,
  promptOpen: false,
};

describe("scrollHowTo", () => {
  beforeEach(() => {
    localStorage.removeItem(SCROLL_HOWTO_KEY);
  });

  it("remembers the toast in localStorage", () => {
    expect(hasSeenScrollHowTo()).toBe(false);
    markScrollHowToSeen();
    expect(hasSeenScrollHowTo()).toBe(true);
  });

  it("shows immediately on a mobile vertical strip", () => {
    expect(shouldShowScrollHowTo(ready)).toBe(true);
    expect(shouldShowScrollHowTo({ ...ready, mobile: false })).toBe(false);
    expect(shouldShowScrollHowTo({ ...ready, vertical: false })).toBe(false);
    expect(shouldShowScrollHowTo({ ...ready, seen: true })).toBe(false);
  });

  it("waits while another surface owns the screen", () => {
    expect(shouldShowScrollHowTo({ ...ready, guideOpen: true })).toBe(false);
    // The sound prompt is a modal overlay — the toast would render behind it.
    expect(shouldShowScrollHowTo({ ...ready, promptOpen: true })).toBe(false);
  });
});
