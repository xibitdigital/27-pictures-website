import { describe, it, expect } from "vitest";
import { sketchyBubblePath, resolveBubbleStyle } from "./bubbles";

/** Every coordinate pair in a path, as [xs, ys]. */
function coords(d: string): [number[], number[]] {
  const nums = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  return [nums.filter((_, i) => i % 2 === 0), nums.filter((_, i) => i % 2 === 1)];
}

describe("sketchyBubblePath tails", () => {
  const BODY_TOP = 0;
  const BODY_BOTTOM = 100;

  it("closes every tail variant", () => {
    for (const tail of [
      "none",
      "bottom",
      "bottom-left",
      "bottom-right",
      "top",
      "top-left",
      "top-right",
      "left",
      "right",
    ]) {
      expect(sketchyBubblePath(tail, 42).trim().endsWith("Z"), tail).toBe(true);
    }
  });

  it("keeps a tailless bubble inside the body box", () => {
    const [xs, ys] = coords(sketchyBubblePath("none", 42));
    expect(Math.min(...ys)).toBeGreaterThan(BODY_TOP);
    expect(Math.max(...ys)).toBeLessThan(BODY_BOTTOM);
    expect(Math.min(...xs)).toBeGreaterThan(BODY_TOP);
    expect(Math.max(...xs)).toBeLessThan(BODY_BOTTOM);
  });

  it("points top tails above the body, mirroring the bottom ones", () => {
    for (const tail of ["top", "top-left", "top-right"]) {
      const [, ys] = coords(sketchyBubblePath(tail, 42));
      expect(Math.min(...ys), tail).toBeLessThan(-10);
      expect(Math.max(...ys), tail).toBeLessThan(BODY_BOTTOM);
    }
    for (const tail of ["bottom", "bottom-left", "bottom-right"]) {
      const [, ys] = coords(sketchyBubblePath(tail, 42));
      expect(Math.max(...ys), tail).toBeGreaterThan(110);
      expect(Math.min(...ys), tail).toBeGreaterThan(BODY_TOP);
    }
  });

  it("skews top-left and top-right tips to their side", () => {
    const tip = (tail: string) => {
      const [xs, ys] = coords(sketchyBubblePath(tail, 42));
      return xs[ys.indexOf(Math.min(...ys))];
    };
    expect(tip("top-left")).toBeLessThan(tip("top"));
    expect(tip("top-right")).toBeGreaterThan(tip("top"));
  });

  it("falls back to a bottom tail for unknown values", () => {
    const [, ys] = coords(sketchyBubblePath("sideways", 42));
    expect(Math.max(...ys)).toBeGreaterThan(110);
  });

  it("passes a top tail through resolveBubbleStyle", () => {
    const style = resolveBubbleStyle({ x: 0, y: 0, bubble: { tail: "top-right" } } as never, "bubble");
    expect(style.tail).toBe("top-right");
  });
});
