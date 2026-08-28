import { describe, expect, it } from "vitest";
import { configToImport, rowToWord, wordToRow } from "../../../worker/toon-editor/src/importConfig";

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

  it("writes page-copy descriptions into extra.description", () => {
    const pack = configToImport(
      { title: "The Chip", pages: [] },
      {
        slug: "jax",
        title: "The Chip",
        titles: { en: "The Chip", it: "Il Chip", de: "Der Chip", fr: "La Puce" },
        description: "English fallback.",
        descriptions: {
          en: "A netrunner with a rare sickness who steals corporate mind-control tech — a future Robin Hood in chrome.",
          it: "Un netrunner con una malattia rara che ruba alle corporazioni la tecnologia per il controllo mentale — un Robin Hood del futuro in cromo.",
          de: "Ein Netrunner mit einer seltenen Krankheit, der Konzernen die Technik zur Gedankenkontrolle stiehlt — ein Robin Hood der Zukunft in Chrom.",
          fr: "Un netrunner atteint d'une maladie rare qui vole aux entreprises leur techno de contrôle mental — un Robin des Bois du futur, en chrome.",
        },
      }
    );
    expect(pack.description).toContain("netrunner");
    expect(JSON.parse(pack.extraJson as string).title).toEqual({
      en: "The Chip",
      it: "Il Chip",
      de: "Der Chip",
      fr: "La Puce",
    });
    expect(JSON.parse(pack.extraJson as string).description).toEqual({
      en: "A netrunner with a rare sickness who steals corporate mind-control tech — a future Robin Hood in chrome.",
      it: "Un netrunner con una malattia rara che ruba alle corporazioni la tecnologia per il controllo mentale — un Robin Hood del futuro in cromo.",
      de: "Ein Netrunner mit einer seltenen Krankheit, der Konzernen die Technik zur Gedankenkontrolle stiehlt — ein Robin Hood der Zukunft in Chrom.",
      fr: "Un netrunner atteint d'une maladie rare qui vole aux entreprises leur techno de contrôle mental — un Robin des Bois du futur, en chrome.",
    });
  });
});
