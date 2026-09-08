import { describe, expect, it } from "vitest";
import { clipPathPolygon, coverImageRect, offsetFromDrag, regionBoundingBox, regionPoints } from "./regionFit";
import type { RegionGeometry } from "./types";

const rect: RegionGeometry = { kind: "rect", x: 0.2, y: 0.1, w: 0.4, h: 0.3 };
const polygon: RegionGeometry = {
  kind: "polygon",
  points: [
    { x: 0.1, y: 0.2 },
    { x: 0.5, y: 0.1 },
    { x: 0.6, y: 0.6 },
  ],
};

describe("regionPoints / regionBoundingBox", () => {
  it("expands a rect into its 4 corners", () => {
    const points = regionPoints(rect).map((p) => ({ x: Number(p.x.toFixed(5)), y: Number(p.y.toFixed(5)) }));
    expect(points).toEqual([
      { x: 0.2, y: 0.1 },
      { x: 0.6, y: 0.1 },
      { x: 0.6, y: 0.4 },
      { x: 0.2, y: 0.4 },
    ]);
  });

  it("passes a polygon's own points through unchanged", () => {
    expect(regionPoints(polygon)).toBe(polygon.points);
  });

  it("computes a rect's bbox as itself", () => {
    const bbox = regionBoundingBox(rect);
    expect(bbox.x).toBeCloseTo(0.2);
    expect(bbox.y).toBeCloseTo(0.1);
    expect(bbox.w).toBeCloseTo(0.4);
    expect(bbox.h).toBeCloseTo(0.3);
  });

  it("computes a polygon's bbox from min/max of its points", () => {
    expect(regionBoundingBox(polygon)).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
  });
});

describe("clipPathPolygon", () => {
  it("expresses a rect's corners as 0%/100% of its own bbox", () => {
    expect(clipPathPolygon(rect)).toBe("polygon(0.00% 0.00%, 100.00% 0.00%, 100.00% 100.00%, 0.00% 100.00%)");
  });
});

describe("coverImageRect", () => {
  it("covers the bbox at scale 1, centered by default", () => {
    // bbox 100x200, image 100x100 -> cover scale = max(100/100, 200/100) = 2
    const rect2 = coverImageRect({ width: 100, height: 200 }, { width: 100, height: 100 }, 1, 0.5, 0.5);
    expect(rect2.width).toBe(200);
    expect(rect2.height).toBe(200);
    expect(rect2.x).toBeCloseTo(-50); // (200-100)/2 overflow, centered
    expect(rect2.y).toBeCloseTo(0); // no vertical overflow at scale 1
  });

  it("pans to the far edge when offset is 0 or 1", () => {
    const topLeft = coverImageRect({ width: 100, height: 200 }, { width: 100, height: 100 }, 1, 0, 0);
    expect(topLeft.x).toBeCloseTo(0);
    const bottomRight = coverImageRect({ width: 100, height: 200 }, { width: 100, height: 100 }, 1, 1, 1);
    expect(bottomRight.x).toBeCloseTo(-100);
  });

  it("zooms in further with imageScale > 1", () => {
    const zoomed = coverImageRect({ width: 100, height: 100 }, { width: 100, height: 100 }, 2, 0.5, 0.5);
    expect(zoomed.width).toBe(200);
    expect(zoomed.height).toBe(200);
  });
});

describe("offsetFromDrag", () => {
  it("dragging the image right/down reveals more of its left/top (offset decreases)", () => {
    const bbox = { width: 100, height: 100 };
    const image = { width: 100, height: 100 };
    const next = offsetFromDrag({ offsetX: 0.5, offsetY: 0.5 }, { x: 25, y: 0 }, bbox, image, 2);
    // overflow at scale 2 = 200-100 = 100, so a 25px drag is a 0.25 offset shift
    expect(next.offsetX).toBeCloseTo(0.25);
    expect(next.offsetY).toBeCloseTo(0.5);
  });

  it("clamps to [0,1]", () => {
    const bbox = { width: 100, height: 100 };
    const image = { width: 100, height: 100 };
    const next = offsetFromDrag({ offsetX: 0.1, offsetY: 0.9 }, { x: 500, y: -500 }, bbox, image, 2);
    expect(next.offsetX).toBe(0);
    expect(next.offsetY).toBe(1);
  });

  it("leaves offset unchanged when the image has no overflow to pan", () => {
    const bbox = { width: 100, height: 100 };
    const image = { width: 100, height: 100 };
    const next = offsetFromDrag({ offsetX: 0.5, offsetY: 0.5 }, { x: 40, y: 40 }, bbox, image, 1);
    expect(next).toEqual({ offsetX: 0.5, offsetY: 0.5 });
  });
});
