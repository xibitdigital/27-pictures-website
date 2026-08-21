import { describe, it, expect } from "vitest";
import {
  isRectOnScreen,
  orderedOnScreenLayers,
  orderedOnScreenIds,
  VISIBLE_RATIO,
  FOCUS_BAND_END,
  isInFocusBand,
  captionScreenPoint,
  collectFocusClips,
  keysOutOfView,
  keyLayerId,
} from "./visibility";
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

  it("focus band is the top 90% of the viewport by default", () => {
    expect(FOCUS_BAND_END).toBe(0.9);
    expect(isInFocusBand(100, 800)).toBe(true); // y=100 < 720
    expect(isInFocusBand(719, 800)).toBe(true);
    expect(isInFocusBand(720, 800)).toBe(false);
    expect(isInFocusBand(-1, 800)).toBe(false);
  });

  it("maps caption plate coords to screen points", () => {
    const plate = rect({ top: 100, left: 50, width: 200, height: 400 });
    expect(captionScreenPoint(plate, 0.5, 0.25)).toEqual({ x: 150, y: 200 });
  });

  it("collects only captions whose anchors sit in the top 90% — even on a misaligned plate", () => {
    // Plate partially scrolled: top at -200, height 800, viewport 400.
    // Default band = [0, 360). Anchors: y=0.3 → screen 40 (in); y=0.85 → screen 480 (out).
    // Page height / alignment is irrelevant — only caption screen Y matters.
    const plate = rect({ top: -200, left: 0, width: 300, height: 800 });
    const layers = [
      {
        id: "1",
        getRect: () => plate,
        captions: [
          { index: 0, audio: "a.mp3", volume: 1, x: 0.5, y: 0.3 },
          { index: 1, audio: "b.mp3", volume: 1, x: 0.5, y: 0.85 },
        ],
      },
    ];
    const clips = collectFocusClips(layers, 400);
    expect(clips.map((c) => c.caption.audio)).toEqual(["a.mp3"]);
    expect(clips[0].key).toBe("1:0");
  });

  it("after scroll, a lower bubble enters the band without needing full page align", () => {
    // Same plate scrolled further up so the lower bubble is now mid-band.
    const plate = rect({ top: -400, left: 0, width: 300, height: 800 });
    const layers = [
      {
        id: "1",
        getRect: () => plate,
        captions: [
          { index: 0, audio: "a.mp3", volume: 1, x: 0.5, y: 0.3 }, // screen y = -160 → out
          { index: 1, audio: "b.mp3", volume: 1, x: 0.5, y: 0.7 }, // screen y = 160 → in
        ],
      },
    ];
    const clips = collectFocusClips(layers, 400);
    expect(clips.map((c) => c.caption.audio)).toEqual(["b.mp3"]);
  });

  it("still applies the band when the plate fits the viewport (mobile emulator case)", () => {
    // Mobile plates often fit in the viewport height; band must stay caption-based.
    // Viewport 720 → band [0, 648). Plate height 700 at top=0 — it fits.
    // y=0.2 → 140 (in); y=0.95 → 665 (out of the top 90%).
    const plate = rect({ top: 0, left: 0, width: 300, height: 700 });
    const layers = [
      {
        id: "1",
        getRect: () => plate,
        captions: [
          { index: 0, audio: "a.mp3", volume: 1, x: 0.5, y: 0.2 }, // 140 → in
          { index: 1, audio: "b.mp3", volume: 1, x: 0.5, y: 0.95 }, // 665 → out of 80%
        ],
      },
    ];
    const clips = collectFocusClips(layers, 720, FOCUS_BAND_END);
    expect(clips.map((c) => c.caption.audio)).toEqual(["a.mp3"]);
  });

  it("book mode (bandEnd=1) plays every caption still on screen", () => {
    const plate = rect({ top: 0, left: 0, width: 300, height: 400 });
    const layers = [
      {
        id: "1",
        getRect: () => plate,
        captions: [
          { index: 0, audio: "a.mp3", volume: 1, x: 0.5, y: 0.2 },
          { index: 1, audio: "b.mp3", volume: 1, x: 0.5, y: 0.85 },
        ],
      },
    ];
    const clips = collectFocusClips(layers, 800, 1);
    expect(clips.map((c) => c.caption.audio)).toEqual(["a.mp3", "b.mp3"]);
  });

  it("orders plates top→bottom / left→right, finishing each page before the next", () => {
    const layers = [
      {
        id: "2",
        getRect: () => rect({ top: 0, left: 200, width: 100, height: 200 }),
        captions: [
          { index: 0, audio: "r1.mp3", volume: 1, x: 0.5, y: 0.1 },
          { index: 1, audio: "r2.mp3", volume: 1, x: 0.5, y: 0.8 },
        ],
      },
      {
        id: "1",
        getRect: () => rect({ top: 0, left: 0, width: 100, height: 200 }),
        captions: [
          { index: 0, audio: "l1.mp3", volume: 1, x: 0.5, y: 0.1 },
          { index: 1, audio: "l2.mp3", volume: 1, x: 0.5, y: 0.8 },
        ],
      },
    ];
    // Full band (book); left page fully before right; within page, array order.
    const clips = collectFocusClips(layers, 800, 1);
    expect(clips.map((c) => c.caption.audio)).toEqual(["l1.mp3", "l2.mp3", "r1.mp3", "r2.mp3"]);
  });

  it("plays in-band captions in config array order, not geometric top→bottom", () => {
    // Bottom bubble listed first in words[] — still plays first when both in band.
    const plate = rect({ top: 0, left: 0, width: 300, height: 400 });
    const layers = [
      {
        id: "1",
        getRect: () => plate,
        captions: [
          { index: 0, audio: "first.mp3", volume: 1, x: 0.5, y: 0.85 },
          { index: 1, audio: "second.mp3", volume: 1, x: 0.5, y: 0.15 },
        ],
      },
    ];
    const clips = collectFocusClips(layers, 800, 1);
    expect(clips.map((c) => c.caption.audio)).toEqual(["first.mp3", "second.mp3"]);
  });

  it("Nero bar page: Everyone (index 3) before Be careful (index 4) despite left/right geometry", () => {
    // Geometric LTR would play Be careful (x=0.18) first; array order must win.
    const plate = rect({ top: 0, left: 0, width: 390, height: 700 });
    const layers = [
      {
        id: "13",
        getRect: () => plate,
        captions: [
          { index: 2, audio: "looking.mp3", volume: 1, x: 0.42, y: 0.4 },
          { index: 3, audio: "everyone.mp3", volume: 1, x: 0.83, y: 0.465 },
          { index: 4, audio: "careful.mp3", volume: 1, x: 0.18, y: 0.455 },
        ],
      },
    ];
    const clips = collectFocusClips(layers, 844, 0.8);
    expect(clips.map((c) => c.caption.audio)).toEqual(["looking.mp3", "everyone.mp3", "careful.mp3"]);
  });

  it("splits the layer id off a caption key", () => {
    expect(keyLayerId("12:3")).toBe("12");
    expect(keyLayerId("cover:0")).toBe("cover");
    expect(keyLayerId("7")).toBe("7");
  });

  describe("keysOutOfView", () => {
    // Plate top -300, height 800, viewport 400.
    // Anchors: y=0.1 → -220 (above screen), y=0.5 → 100 (on screen),
    //          y=0.95 → 460 (below screen).
    const layers = [
      {
        id: "1",
        getRect: () => rect({ top: -300, left: 0, width: 300, height: 800 }),
        captions: [
          { index: 0, audio: "a.mp3", volume: 1, x: 0.5, y: 0.1 },
          { index: 1, audio: "b.mp3", volume: 1, x: 0.5, y: 0.5 },
          { index: 2, audio: "c.mp3", volume: 1, x: 0.5, y: 0.95 },
        ],
      },
    ];

    it("forgets played captions that scrolled off screen, keeps on-screen ones", () => {
      const stale = keysOutOfView(layers, 400, ["1:0", "1:1", "1:2"]);
      expect(stale.sort()).toEqual(["1:0", "1:2"]);
    });

    it("forgets keys whose layer unmounted", () => {
      expect(keysOutOfView(layers, 400, ["9:0"])).toEqual(["9:0"]);
      expect(keysOutOfView([{ ...layers[0], released: true }], 400, ["1:1"])).toEqual(["1:1"]);
    });

    it("keeps keys on unmeasured plates so a reflow does not replay them", () => {
      const unmeasured = [{ id: "1", getRect: () => null, captions: layers[0].captions }];
      expect(keysOutOfView(unmeasured, 400, ["1:0", "1:1"])).toEqual([]);
    });
  });
});
