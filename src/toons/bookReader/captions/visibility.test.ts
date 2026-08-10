import { describe, it, expect } from "vitest";
import { isRectOnScreen, orderedOnScreenLayers, orderedOnScreenIds, VISIBLE_RATIO } from "./visibility";

function rect(partial: Partial<DOMRect> & { top: number; left: number; width: number; height: number }): DOMRect {
  const top = partial.top;
  const left = partial.left;
  const width = partial.width;
  const height = partial.height;
  return {
    x: left,
    y: top,
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("visibility", () => {
  it("exports a soft ratio below half-height (tall plates)", () => {
    expect(VISIBLE_RATIO).toBeLessThan(0.5);
  });

  it("treats a tall plate with ~25% in view as on screen", () => {
    const r = rect({ top: 0, left: 0, width: 300, height: 800 });
    expect(isRectOnScreen(r, 200)).toBe(true);
  });

  it("rejects fully off-screen plates", () => {
    const r = rect({ top: 2000, left: 0, width: 300, height: 400 });
    expect(isRectOnScreen(r, 800)).toBe(false);
  });

  it("orders on-screen layers top-to-bottom then left-to-right and dedupes ids", () => {
    const layers = [
      { id: "2", getRect: () => rect({ top: 100, left: 0, width: 100, height: 100 }) },
      { id: "1", getRect: () => rect({ top: 0, left: 0, width: 100, height: 100 }) },
      { id: "1", getRect: () => rect({ top: 0, left: 50, width: 100, height: 100 }) },
      { id: "3", getRect: () => rect({ top: 0, left: 0, width: 100, height: 100 }) },
    ];
    const ordered = orderedOnScreenLayers(layers, 800, (l) => l.id !== "3");
    expect(ordered.map((l) => l.id)).toEqual(["1", "2"]);
    expect(
      orderedOnScreenIds(
        layers.filter((l) => l.id !== "3"),
        800
      )
    ).toEqual(["1", "2"]);
  });
});
