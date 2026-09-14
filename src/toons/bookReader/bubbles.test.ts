import { describe, it, expect } from "vitest";
import {
  bubbleBodyPoints,
  defaultBubblePoints,
  organicBubblePathFromPoints,
  organicBubblePoints,
  organicTailSplit,
  parseBubblePoints,
  sketchyBubblePath,
  thoughtBubblePath,
  thoughtTailDots,
  resolveBubbleStyle,
  resolveBubbleVariantClass,
  squircleEdge,
} from "./bubbles";

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

  it("aims corner tails 45 degrees outward from the mouth", () => {
    const expectAngle = (tail: string, want: number) => {
      const pts = organicBubblePoints(tail, 1);
      const { body, tip } = organicTailSplit(pts);
      const mx = (body[0][0] + body[body.length - 1][0]) / 2;
      const my = (body[0][1] + body[body.length - 1][1]) / 2;
      const got = Math.atan2(tip[1] - my, tip[0] - mx);
      const err = Math.abs(Math.atan2(Math.sin(got - want), Math.cos(got - want)));
      expect(err, tail).toBeLessThan(0.25);
    };
    expectAngle("bottom-left", (3 * Math.PI) / 4);
    expectAngle("bottom-right", Math.PI / 4);
    expectAngle("top-left", (-3 * Math.PI) / 4);
    expectAngle("top-right", -Math.PI / 4);
  });

  it("hangs corner tails off the rounded corner, not the flat side", () => {
    const mouth = (tail: string) => {
      const pts = organicBubblePoints(tail, 42);
      const { body } = organicTailSplit(pts);
      const a = body[0];
      const b = body[body.length - 1];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    };
    const bl = mouth("bottom-left");
    const br = mouth("bottom-right");
    const tl = mouth("top-left");
    const tr = mouth("top-right");
    expect(bl[0]).toBeLessThan(30);
    expect(bl[1]).toBeGreaterThan(70);
    expect(br[0]).toBeGreaterThan(70);
    expect(br[1]).toBeGreaterThan(70);
    expect(tl[0]).toBeLessThan(30);
    expect(tl[1]).toBeLessThan(30);
    expect(tr[0]).toBeGreaterThan(70);
    expect(tr[1]).toBeLessThan(30);
  });

  it("falls back to a bottom tail for unknown values", () => {
    const [, ys] = coords(sketchyBubblePath("sideways", 42));
    expect(Math.max(...ys)).toBeGreaterThan(110);
  });

  it("passes a top tail through resolveBubbleStyle", () => {
    const style = resolveBubbleStyle({ x: 0, y: 0, bubble: { tail: "top-right" } } as never, "bubble");
    expect(style.tail).toBe("top-right");
  });

  it("rebuilds the seeded path from its own control points", () => {
    for (const tail of ["none", "bottom", "bottom-left", "top-right", "left"]) {
      const pts = organicBubblePoints(tail, 42);
      expect(organicBubblePathFromPoints(pts, tail)).toBe(sketchyBubblePath(tail, 42));
    }
  });

  it("uses authored control points instead of the seed", () => {
    const pts = organicBubblePoints("none", 1);
    const moved: typeof pts = pts.map((p, i) => (i === 0 ? [p[0], 8] : p));
    expect(sketchyBubblePath("none", 1, moved)).not.toBe(sketchyBubblePath("none", 1));
    expect(sketchyBubblePath("none", 1, moved)).toBe(organicBubblePathFromPoints(moved, "none"));
  });

  it("sits on a squircle, not a pure ellipse", () => {
    const pts = organicBubblePoints("none", 1);
    let maxR2 = 0;
    for (const [x, y] of pts) {
      const dx = (x - 50) / 46;
      const dy = (y - 50) / 44;
      maxR2 = Math.max(maxR2, dx * dx + dy * dy);
    }
    // Ellipse of rx/ry: dx²+dy² ≈ 1. A squircle's diagonal anchors push past that.
    expect(maxR2).toBeGreaterThan(1.15);
  });

  it("draws the tail as a sharp triangle, not a rounded spline", () => {
    const d = sketchyBubblePath("bottom", 42);
    expect(d).toMatch(/ L [-.\d]+ [-.\d]+ L [-.\d]+ [-.\d]+ Z$/);
    expect(organicBubblePoints("bottom", 42).length).toBe(
      organicTailSplit(organicBubblePoints("bottom", 42)).body.length + 1
    );
  });

  it("keeps the tail mouth a thin pointer", () => {
    const pts = organicBubblePoints("bottom", 42);
    const { body } = organicTailSplit(pts);
    const mouth = Math.hypot(body[0][0] - body[body.length - 1][0], body[0][1] - body[body.length - 1][1]);
    expect(mouth).toBeLessThan(10);
    expect(mouth).toBeGreaterThan(4);
  });

  it("reads bubblePoints on the word into the resolved style", () => {
    const pts = [
      [20, 20],
      [80, 20],
      [80, 80],
      [20, 80],
    ];
    const style = resolveBubbleStyle({ x: 0, y: 0, bubblePoints: pts } as never, "bubble");
    expect(style.points).toEqual(pts);
  });
});

describe("parseBubblePoints", () => {
  it("rejects short or non-numeric lists", () => {
    expect(parseBubblePoints(null)).toBeNull();
    expect(parseBubblePoints([[1, 2]])).toBeNull();
    expect(
      parseBubblePoints([
        [1, 2],
        [3, 4],
        ["x", 5],
      ])
    ).toBeNull();
  });

  it("accepts at least three finite vertices", () => {
    expect(
      parseBubblePoints([
        [1, 2],
        [3, 4],
        [5, 6],
      ])
    ).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it("returns organic handles for a speech balloon", () => {
    expect(defaultBubblePoints("organic", "bottom-left", 7)?.length).toBeGreaterThan(3);
    expect(defaultBubblePoints("box", "none", 7)).toBeNull();
  });
});

describe("bubbleBodyPoints", () => {
  it("drops the tail handles so wrap follows the body, not the lobe", () => {
    const pts = organicBubblePoints("bottom-left", 7);
    expect(pts.length).toBeGreaterThan(6);
    expect(bubbleBodyPoints("organic", "bottom-left", pts).length).toBe(pts.length - 1);
    expect(bubbleBodyPoints("organic", "none", pts).length).toBe(pts.length);
  });
});

describe("thoughtBubblePath", () => {
  it("closes every tail variant, including none", () => {
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
      expect(thoughtBubblePath(tail, 7).trim().endsWith("Z"), tail).toBe(true);
    }
  });

  it("has no trailing dots when tail is none", () => {
    // 3 subpaths (body + 2 dots) normally, 1 (body only) when tailless.
    const withTail = (thoughtBubblePath("bottom", 7).match(/M /g) || []).length;
    const noTail = (thoughtBubblePath("none", 7).match(/M /g) || []).length;
    expect(withTail).toBe(3);
    expect(noTail).toBe(1);
  });

  it("keeps every trailing dot clear of the body and of each other", () => {
    // Body outline incl. per-anchor wobble; dots must sit strictly outside it.
    const cx = 50;
    const cy = 50;
    const rx = 46 + 1.2;
    const ry = 44 + 1.2;
    for (const tail of ["bottom", "bottom-left", "bottom-right", "top", "top-left", "top-right", "left", "right"]) {
      for (const seed of [1, 7, 42, 9001, 123456]) {
        const dots = thoughtTailDots(tail, seed);
        expect(dots.length, tail).toBe(2);
        for (const d of dots) {
          const ux = d.x - cx;
          const uy = d.y - cy;
          const len = Math.hypot(ux, uy) || 1;
          const edge = squircleEdge(ux / len, uy / len, rx, ry);
          expect(len, `${tail}/${seed}`).toBeGreaterThan(edge + d.r);
        }
        const gap = Math.hypot(dots[0].x - dots[1].x, dots[0].y - dots[1].y) - dots[0].r - dots[1].r;
        expect(gap, `${tail}/${seed} dot gap`).toBeGreaterThan(0);
        expect(dots[0].r, tail).toBeGreaterThan(dots[1].r);
      }
    }
  });

  it("has no dots for a tailless thought bubble", () => {
    expect(thoughtTailDots("none", 7)).toEqual([]);
  });

  it("resolves to the thought shape via resolveBubbleStyle", () => {
    const style = resolveBubbleStyle({ x: 0, y: 0 } as never, "thought");
    expect(style.shape).toBe("thought");
  });
});

describe("resolveBubbleVariantClass", () => {
  it("maps each variant to its class(es)", () => {
    expect(resolveBubbleVariantClass("badai")).toBe(" jax-word--ai jax-word--badai");
    expect(resolveBubbleVariantClass("ai")).toBe(" jax-word--ai");
    expect(resolveBubbleVariantClass("burst")).toBe(" jax-word--burst");
    expect(resolveBubbleVariantClass("thought")).toBe(" jax-word--thought");
    expect(resolveBubbleVariantClass("bubble")).toBe("");
    expect(resolveBubbleVariantClass("plain")).toBe("");
  });
});
