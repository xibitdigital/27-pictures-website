import { describe, expect, it } from "vitest";
import { EDITOR_MIN_VIEWPORT, editorViewportFits } from "./viewport";

describe("editorViewportFits", () => {
  it("rejects a phone in either orientation", () => {
    expect(editorViewportFits(390, 844)).toBe(false);
    expect(editorViewportFits(844, 390)).toBe(false);
  });

  it("accepts iPad Mini and up", () => {
    expect(editorViewportFits(744, 1133)).toBe(true);
    expect(editorViewportFits(1133, 744)).toBe(true);
    expect(editorViewportFits(1920, 1080)).toBe(true);
  });

  it("uses the shared floor on both axes", () => {
    expect(editorViewportFits(EDITOR_MIN_VIEWPORT, EDITOR_MIN_VIEWPORT)).toBe(true);
    expect(editorViewportFits(EDITOR_MIN_VIEWPORT - 1, 1200)).toBe(false);
    expect(editorViewportFits(1200, EDITOR_MIN_VIEWPORT - 1)).toBe(false);
  });
});
