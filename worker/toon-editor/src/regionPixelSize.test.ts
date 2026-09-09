import { describe, expect, it } from "vitest";
import { regionPixelSize } from "./index";
import type { RegionGeometry } from "./apiTypes";

describe("regionPixelSize", () => {
  it("scales a rect's own fraction of the page, not the page's full size", () => {
    // The Doll: victim panel — w 0.4128, h 0.6084 of a 1152x1728 page.
    const geometry: RegionGeometry = { kind: "rect", x: 0.0793, y: 0.3649, w: 0.4128, h: 0.6084 };
    const size = regionPixelSize(geometry, 1152, 1728);
    expect(size).toEqual({ width: 476, height: 1051 });
  });

  it("is far smaller than the full plate for a small panel", () => {
    const geometry: RegionGeometry = { kind: "rect", x: 0.6389, y: 0.7894, w: 0.2654, h: 0.1762 };
    const size = regionPixelSize(geometry, 1152, 1728);
    expect(size.width).toBeLessThan(1152);
    expect(size.height).toBeLessThan(1728);
    expect(size).toEqual({ width: 306, height: 304 });
  });

  it("uses the polygon's own bounding box", () => {
    const geometry: RegionGeometry = {
      kind: "polygon",
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.1 },
        { x: 0.6, y: 0.6 },
      ],
    };
    // bbox: x 0.1..0.6 (w 0.5), y 0.1..0.6 (h 0.5)
    const size = regionPixelSize(geometry, 1000, 1000);
    expect(size).toEqual({ width: 500, height: 500 });
  });

  it("never returns a zero dimension, even for a degenerate box", () => {
    const geometry: RegionGeometry = { kind: "rect", x: 0.5, y: 0.5, w: 0, h: 0 };
    const size = regionPixelSize(geometry, 800, 1424);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });
});
