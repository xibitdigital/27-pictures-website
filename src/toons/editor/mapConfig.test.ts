import { describe, expect, it } from "vitest";
import {
  bubbleAudio,
  bubbleColor,
  bubbleStrokeColor,
  bubbleStrokeThickness,
  bubbleTextMap,
  bubbleToWordEntry,
  exportToonConfig,
  extraPatch,
  letteringPatch,
  parseHexColor,
  bubbleWritePayload,
  bubbleVoice,
  spokenElevenLine,
  suggestElevenPrompt,
  VOICE_NAMES,
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

  it("reads the locked voice key and builds an ElevenLabs Studio prompt", () => {
    expect(VOICE_NAMES).toContain("erin");
    expect(bubbleVoice(bubble({ extraJson: JSON.stringify({ voice: "erin" }) }))).toBe("erin");
    const prompt = suggestElevenPrompt({ voice: "eve", text: "Nero—!", variant: "burst" });
    expect(prompt).toContain("eleven_v3");
    expect(prompt).toContain("Voice: eve");
    expect(prompt).toContain("[shouts] Nero—!");
    expect(spokenElevenLine({ text: "Nero—!", variant: "burst" })).toBe("[shouts] Nero—!");
    expect(spokenElevenLine({ text: "Hi", variant: "bubble" })).toBe("Hi");
  });

  it("normalises hex colors and reads lettering extras", () => {
    expect(parseHexColor("#fff")).toBe("#ffffff");
    expect(parseHexColor("b30000")).toBe("#b30000");
    expect(parseHexColor("nope")).toBeNull();
    expect(parseHexColor("")).toBeNull();
    const ink = bubble({
      extraJson: JSON.stringify({
        color: "#111111",
        stroke: { color: "#ffffff", thickness: 8 },
        voice: "erin",
      }),
    });
    expect(bubbleColor(ink)).toBe("#111111");
    expect(bubbleStrokeColor(ink)).toBe("#ffffff");
    expect(bubbleStrokeThickness(ink)).toBe(8);
    const patch = letteringPatch(ink, { strokeThickness: 6 });
    expect(JSON.parse(patch.extraJson as string)).toEqual({
      color: "#111111",
      stroke: "#ffffff",
      strokeThickness: 6,
      voice: "erin",
    });
    expect(JSON.parse(letteringPatch(ink, { color: null }).extraJson as string).color).toBeUndefined();
  });

  it("builds a Worker write payload from a bubble", () => {
    const payload = bubbleWritePayload(
      bubble({
        extraJson: JSON.stringify({ audio: "assets/sfx/a.mp3" }),
        textJson: JSON.stringify({ en: "Hello" }),
      })
    );
    expect(payload).toEqual({
      x: 0.2,
      y: 0.15,
      variant: "bubble",
      tail: "bottom-left",
      size: 22,
      angle: null,
      textEn: "Hello",
      textJson: JSON.stringify({ en: "Hello" }),
      extraJson: JSON.stringify({ audio: "assets/sfx/a.mp3" }),
    });
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
