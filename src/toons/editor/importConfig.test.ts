import { describe, expect, it } from "vitest";
import { configToImport, rowToWord, wordToRow } from "../../../worker/toon-editor/src/importConfig.js";

describe("config import", () => {
  it("keeps multilingual text and extra caption fields", () => {
    const row = wordToRow(
      {
        x: 0.5,
        y: 0.2,
        variant: "credit",
        tail: "none",
        size: 58,
        color: "#ffffff",
        voice: "narrator",
        audio: "assets/sfx/a.mp3",
        text: { en: "The Revenge", it: "La vendetta" },
      },
      0
    );
    expect(row.textEn).toBe("The Revenge");
    expect(JSON.parse(row.textJson).it).toBe("La vendetta");
    expect(JSON.parse(row.extraJson as string).voice).toBe("narrator");
    const word = rowToWord({
      ...row,
      text_en: row.textEn,
      text_json: row.textJson,
      extra_json: row.extraJson,
    });
    expect(word.text).toEqual({ en: "The Revenge", it: "La vendetta" });
    expect(word.audio).toBe("assets/sfx/a.mp3");
  });

  it("packs Erin-shaped config into pages", () => {
    const pack = configToImport(
      {
        title: "ERIN EP 2: The Revenge",
        defaultLang: "en",
        pages: [
          { file: "assets/a.webp", words: [{ x: 0.2, y: 0.1, text: { en: "Hi" } }] },
          { file: "assets/b.webp", words: [] },
        ],
      },
      {
        slug: "erin-the-revenge",
        subtitle: "The Revenge",
        description: "Erin came back.",
        coverKey: "card-art/erin-the-revenge-intro.jpg",
        assetPageDir: "/toons/erin-the-revenge/",
        readerUrl: "/toons/erin-the-revenge/",
        seriesKey: "erin",
        episodeN: 2,
        designWidth: 1152,
        designHeight: 1728,
      }
    );
    expect(pack.seriesKey).toBe("erin");
    expect(pack.episodeN).toBe(2);
    expect(pack.pages).toHaveLength(2);
    expect(pack.pages[0].words).toHaveLength(1);
    expect(pack.pages[1].words).toHaveLength(0);
    expect(pack.coverKey).toBe("card-art/erin-the-revenge-intro.jpg");
    expect(pack.designWidth).toBe(1152);
  });
});
