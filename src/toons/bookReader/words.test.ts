import { describe, it, expect, afterEach, vi } from "vitest";
import { loadWords } from "./words";
import { clearConfigCache } from "./loadConfig";
import type { WordsConfig } from "./types";

const sampleConfig: WordsConfig = {
  designWidth: 1008,
  designHeight: 1792,
  defaultLang: "en",
  languages: [
    { code: "en", label: "EN" },
    { code: "it", label: "IT" },
  ],
  pages: [
    {
      file: "assets/1.jpg",
      words: [
        { x: 0.5, y: 0.2, size: 40, text: { en: "HELLO", it: "CIAO" } },
        { x: 0.3, y: 0.8, size: 30, variant: "ai", text: { en: "WE ARE IN!" } },
      ],
    },
    { file: "assets/2.jpg", words: [] },
  ],
};

describe("loadWords", () => {
  afterEach(() => {
    clearConfigCache();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("fetches and returns JSON config", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleConfig,
      })
    );
    const cfg = await loadWords("config.json");
    expect(cfg.pages?.[0]?.words).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith("config.json", { cache: "no-cache" });
  });

  it("resolves SFX paths when VITE_ASSET_BASE is set", async () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://assets.twentyseven.pictures");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          pages: [
            {
              file: "assets/1.jpg",
              words: [{ x: 0.5, y: 0.5, text: "BOOM", audio: "assets/sfx/x.mp3" }],
            },
          ],
        }),
      })
    );
    const cfg = await loadWords("config.json", "/toons/jax/");
    expect(cfg.pages?.[0]?.words?.[0]?.audio).toBe("https://assets.twentyseven.pictures/toons/jax/assets/sfx/x.mp3");
    expect(cfg.pages?.[0]?.file).toBe("https://assets.twentyseven.pictures/toons/jax/assets/1.jpg");
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(loadWords("missing.json")).rejects.toThrow(/toon config 404/);
  });
});
