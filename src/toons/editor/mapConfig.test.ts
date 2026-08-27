import { describe, expect, it } from "vitest";
import {
  bubbleAudio,
  bubbleTextMap,
  bubbleToWordEntry,
  exportToonConfig,
  extraPatch,
  PLACEHOLDER_TEXT,
  textPatch,
} from "./mapConfig";
import type { BubbleRecord, PageRecord } from "./types";

function bubble(partial: Partial<BubbleRecord> = {}): BubbleRecord {
  return {
    id: "b1",
    x: 0.2,
    y: 0.15,
    variant: "bubble",
    tail: "bottom-left",
    size: 22,
    angle: null,
    textEn: "Hello",
    sort: 0,
    ...partial,
  };
}

describe("bubbleToWordEntry", () => {
  it("maps a D1 bubble onto a reader WordEntry", () => {
    const word = bubbleToWordEntry(bubble());
    expect(word.x).toBe(0.2);
    expect(word.y).toBe(0.15);
    expect(word.align).toBe("center");
    expect(word.variant).toBe("bubble");
    expect(word.tail).toBe("bottom-left");
    expect(word.size).toBe(22);
    expect(word.text).toEqual({ en: "Hello" });
  });

  it("uses a placeholder so empty text still renders in the studio", () => {
    expect(bubbleToWordEntry(bubble({ textEn: "  " })).text).toEqual({ en: PLACEHOLDER_TEXT });
  });

  it("reads the full language map and patches one locale", () => {
    const b = bubble({ textJson: JSON.stringify({ en: "Hello", de: "Hallo" }) });
    expect(bubbleTextMap(b)).toEqual({ en: "Hello", de: "Hallo" });
    const patch = textPatch(b, "fr", "Bonjour");
    expect(patch.textEn).toBe("Hello");
    expect(JSON.parse(patch.textJson)).toEqual({ en: "Hello", de: "Hallo", fr: "Bonjour" });
  });

  it("patches audio into extraJson without dropping other extras", () => {
    const b = bubble({ extraJson: JSON.stringify({ voice: "erin", audio: "old.mp3" }) });
    expect(bubbleAudio(b)).toBe("old.mp3");
    const patch = extraPatch(b, "audio", "assets/sfx/a.mp3");
    expect(JSON.parse(patch.extraJson as string)).toEqual({ voice: "erin", audio: "assets/sfx/a.mp3" });
    expect(extraPatch(b, "audio", "").extraJson).toBe(JSON.stringify({ voice: "erin" }));
  });
});

describe("exportToonConfig", () => {
  it("emits ToonConfig pages in position order with empty text left empty", () => {
    const pages: PageRecord[] = [
      {
        id: "p2",
        position: 1,
        fileKey: "editor/demo/assets/b.webp",
        fileUrl: "https://cdn/editor/demo/assets/b.webp",
        width: 800,
        height: 1424,
        bubbles: [bubble({ id: "late", sort: 0, textEn: "Second" })],
      },
      {
        id: "p1",
        position: 0,
        fileKey: "editor/demo/assets/a.webp",
        fileUrl: "https://cdn/editor/demo/assets/a.webp",
        width: 800,
        height: 1424,
        bubbles: [bubble({ id: "empty", sort: 0, textEn: "" })],
      },
    ];
    const cfg = exportToonConfig({ title: "Demo", designWidth: 800, designHeight: 1424 }, pages);
    expect(cfg.title).toBe("Demo");
    expect(cfg.defaultLang).toBe("en");
    expect(cfg.pages).toHaveLength(2);
    expect(cfg.pages?.[0].file).toBe("editor/demo/assets/a.webp");
    expect(cfg.pages?.[0].words?.[0].text).toEqual({ en: "" });
    expect(cfg.pages?.[1].words?.[0].text).toEqual({ en: "Second" });
  });
});
