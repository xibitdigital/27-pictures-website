import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useSmoothScroll } from "./useSmoothScroll";

describe("useSmoothScroll", () => {
  let raf: ReturnType<typeof vi.fn>;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    raf = vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("requestAnimationFrame", raf);
    delete (window as Window & { Lenis?: unknown }).Lenis;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as Window & { Lenis?: unknown }).Lenis;
  });

  it("no-ops when viewport is mobile-sized", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 400,
    });
    let constructed = false;
    function LenisCtor() {
      constructed = true;
    }
    window.Lenis = LenisCtor as unknown as typeof window.Lenis;
    useSmoothScroll();
    expect(constructed).toBe(false);
  });

  it("no-ops when Lenis is not loaded", () => {
    useSmoothScroll();
    expect(raf).not.toHaveBeenCalled();
  });

  it("starts Lenis + rAF loop on desktop when Lenis exists", () => {
    const rafSpy = vi.fn();
    function LenisCtor(this: { raf: typeof rafSpy }) {
      this.raf = rafSpy;
    }
    window.Lenis = LenisCtor as unknown as typeof window.Lenis;

    useSmoothScroll();

    expect(raf).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
    // Drive one frame: should call lenis.raf and schedule the next frame
    frames[0](16);
    expect(rafSpy).toHaveBeenCalledWith(16);
    expect(raf).toHaveBeenCalledTimes(2);
  });
});
