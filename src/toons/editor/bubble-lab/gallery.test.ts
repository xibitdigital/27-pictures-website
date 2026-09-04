import { describe, expect, it } from "vitest";
import { BUBBLE_TAILS, BUBBLE_VARIANTS, PLACEHOLDER_TEXT } from "../mapConfig";
import { galleryCaption, galleryRows } from "./gallery";

describe("bubble lab gallery", () => {
  it("builds a caption for every variant and tail from the same line", () => {
    const line = "Too slow.";
    let index = 0;
    for (const variant of BUBBLE_VARIANTS) {
      for (const tail of BUBBLE_TAILS) {
        const caption = galleryCaption(variant, tail, index, line);
        index += 1;
        expect(caption, `${variant} / ${tail}`).toBeTruthy();
        expect(caption?.text).toBe(line);
      }
    }
  });

  it("falls back to the studio placeholder when the line is empty", () => {
    const caption = galleryCaption("bubble", "bottom-left", 0, "   ");
    expect(caption?.text).toBe(PLACEHOLDER_TEXT);
  });

  it("returns one row per variant and a cell per tail", () => {
    const rows = galleryRows("Hello.");
    expect(rows.map((row) => row.variant)).toEqual([...BUBBLE_VARIANTS]);
    for (const row of rows) {
      expect(row.cells.map((cell) => cell.tail)).toEqual([...BUBBLE_TAILS]);
    }
  });
});
