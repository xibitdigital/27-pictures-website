import { describe, expect, it } from "vitest";
import {
  clipPathPolygon,
  coverImageRect,
  DEFAULT_GRID_SIZE,
  MAX_IMAGE_SCALE,
  MIN_IMAGE_SCALE,
  moveRegionInStack,
  offsetFromDrag,
  regionBoundingBox,
  regionPoints,
  regionsInStackOrder,
  scaleFromSliderPosition,
  sliderPositionFromScale,
  snapPointToGrid,
  snapToGrid,
} from "./regionFit";
import type { RegionGeometry, RegionRecord } from "./types";

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

  it("centers the image instead of panning it when imageScale < 1 shrinks it below the bbox", () => {
    // bbox 100x100, image 100x100, cover scale 1 -> at imageScale 0.5 the image is 50x50,
    // smaller than the box on both axes: no overflow to pan, so it's centered regardless of offset.
    const shrunk = coverImageRect({ width: 100, height: 100 }, { width: 100, height: 100 }, 0.5, 0, 0);
    expect(shrunk.width).toBe(50);
    expect(shrunk.height).toBe(50);
    expect(shrunk.x).toBeCloseTo(25); // (100-50)/2
    expect(shrunk.y).toBeCloseTo(25);

    // offset is ignored once there's nothing to pan
    const shrunkOtherOffset = coverImageRect({ width: 100, height: 100 }, { width: 100, height: 100 }, 0.5, 1, 1);
    expect(shrunkOtherOffset.x).toBeCloseTo(25);
    expect(shrunkOtherOffset.y).toBeCloseTo(25);
  });

  it("clamps a below-minimum or above-maximum imageScale instead of trusting it blindly", () => {
    const tooLow = coverImageRect({ width: 100, height: 100 }, { width: 100, height: 100 }, 0.001, 0.5, 0.5);
    expect(tooLow.width).toBeCloseTo(100 * MIN_IMAGE_SCALE);
    const tooHigh = coverImageRect({ width: 100, height: 100 }, { width: 100, height: 100 }, 999, 0.5, 0.5);
    expect(tooHigh.width).toBeCloseTo(100 * MAX_IMAGE_SCALE);
  });
});

describe("scaleFromSliderPosition / sliderPositionFromScale", () => {
  it("puts scale 1 (no zoom) exactly at the center of the track", () => {
    expect(scaleFromSliderPosition(50)).toBeCloseTo(1);
    expect(sliderPositionFromScale(1)).toBeCloseTo(50);
  });

  it("puts the track ends at MIN_IMAGE_SCALE and MAX_IMAGE_SCALE", () => {
    expect(scaleFromSliderPosition(0)).toBeCloseTo(MIN_IMAGE_SCALE);
    expect(scaleFromSliderPosition(100)).toBeCloseTo(MAX_IMAGE_SCALE);
    expect(sliderPositionFromScale(MIN_IMAGE_SCALE)).toBeCloseTo(0);
    expect(sliderPositionFromScale(MAX_IMAGE_SCALE)).toBeCloseTo(100);
  });

  it("round-trips a handful of positions", () => {
    for (const position of [0, 10, 25, 50, 60, 75, 90, 100]) {
      const scale = scaleFromSliderPosition(position);
      expect(sliderPositionFromScale(scale)).toBeCloseTo(position, 5);
    }
  });

  it("clamps out-of-range positions/scales instead of extrapolating", () => {
    expect(scaleFromSliderPosition(-20)).toBeCloseTo(MIN_IMAGE_SCALE);
    expect(scaleFromSliderPosition(150)).toBeCloseTo(MAX_IMAGE_SCALE);
    expect(sliderPositionFromScale(0.001)).toBeCloseTo(0);
    expect(sliderPositionFromScale(999)).toBeCloseTo(100);
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

describe("snapToGrid / snapPointToGrid", () => {
  it("rounds to the nearest grid line at the default spacing", () => {
    expect(snapToGrid(0.1)).toBeCloseTo(1 / 12); // nearest multiple of 1/24 to 0.1 is 2/24
    expect(snapToGrid(0.5)).toBeCloseTo(0.5); // already on a grid line
    expect(snapToGrid(0.02)).toBeCloseTo(0); // rounds down to the first line
  });

  it("honors a custom grid size", () => {
    expect(snapToGrid(0.23, 0.1)).toBeCloseTo(0.2);
    expect(snapToGrid(0.27, 0.1)).toBeCloseTo(0.3);
  });

  it("clamps to [0,1] even past the last grid line", () => {
    expect(snapToGrid(0.99, 0.1)).toBeCloseTo(1);
    expect(snapToGrid(-0.05, 0.1)).toBe(0);
  });

  it("passes the value through unchanged when gridSize is 0", () => {
    expect(snapToGrid(0.137, 0)).toBe(0.137);
  });

  it("snaps both axes of a point", () => {
    const snapped = snapPointToGrid({ x: 0.1, y: 0.27 }, 0.1);
    expect(snapped.x).toBeCloseTo(0.1);
    expect(snapped.y).toBeCloseTo(0.3);
  });

  it("DEFAULT_GRID_SIZE is 1/24 of the plate", () => {
    expect(DEFAULT_GRID_SIZE).toBeCloseTo(1 / 24);
  });
});

function region(id: string, sort: number): RegionRecord {
  return {
    id,
    shapeType: "rect",
    geometry: rect,
    fileKey: null,
    fileUrl: null,
    fileWidth: null,
    fileHeight: null,
    imageOffsetX: 0.5,
    imageOffsetY: 0.5,
    imageScale: 1,
    sort,
  };
}

describe("regionsInStackOrder / moveRegionInStack", () => {
  const regions = [region("a", 0), region("b", 1), region("c", 2)];

  it("orders by sort", () => {
    expect(regionsInStackOrder([region("b", 1), region("a", 0)]).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("moves a region forward, swapping with its neighbor", () => {
    const next = moveRegionInStack(regions, "a", "forward");
    expect(next?.map((r) => ({ id: r.id, sort: r.sort }))).toEqual([
      { id: "b", sort: 0 },
      { id: "a", sort: 1 },
      { id: "c", sort: 2 },
    ]);
  });

  it("moves a region backward, swapping with its neighbor", () => {
    const next = moveRegionInStack(regions, "c", "backward");
    expect(next?.map((r) => ({ id: r.id, sort: r.sort }))).toEqual([
      { id: "a", sort: 0 },
      { id: "c", sort: 1 },
      { id: "b", sort: 2 },
    ]);
  });

  it("returns null at either end of the stack", () => {
    expect(moveRegionInStack(regions, "a", "backward")).toBeNull();
    expect(moveRegionInStack(regions, "c", "forward")).toBeNull();
  });
});
