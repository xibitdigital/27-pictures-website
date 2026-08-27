import { describe, expect, it } from "vitest";
import { clamp01, clientToPlateFraction, grabOffset } from "./plateCoords";

const box = { left: 100, top: 50, width: 200, height: 400 };

describe("plateCoords", () => {
  it("clamps to 0–1", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it("converts client coordinates into plate fractions", () => {
    expect(clientToPlateFraction(100, 50, box)).toEqual({ x: 0, y: 0 });
    expect(clientToPlateFraction(200, 250, box)).toEqual({ x: 0.5, y: 0.5 });
    expect(clientToPlateFraction(400, 900, box)).toEqual({ x: 1, y: 1 });
  });

  it("keeps the grab offset so a drag does not jump to the pointer", () => {
    const off = grabOffset(150, 90, box, 0.2, 0.1);
    expect(off.offsetX).toBeCloseTo(0.05);
    expect(off.offsetY).toBeCloseTo(0);
    const next = clientToPlateFraction(170, 90, box, off.offsetX, off.offsetY);
    expect(next.x).toBeCloseTo(0.3);
    expect(next.y).toBeCloseTo(0.1);
  });
});
