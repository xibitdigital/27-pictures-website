import { describe, it, expect, afterEach, vi } from "vitest";
import {
  pagesFromConfig,
  loadConfig,
  loadConfigPages,
  createConfigLoader,
  resolveConfigUrl,
  clearConfigCache,
} from "./loadConfig";

afterEach(() => {
  clearConfigCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("resolveConfigUrl", () => {
  it("returns http URLs unchanged", () => {
    expect(resolveConfigUrl("https://cdn.example/toons/jax/config.json")).toBe(
      "https://cdn.example/toons/jax/config.json"
    );
  });

  it("prefixes root-absolute paths when VITE_ASSET_BASE is set", () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://assets.twentyseven.pictures");
    expect(resolveConfigUrl("/toons/jax/config.json")).toBe(
      "https://assets.twentyseven.pictures/toons/jax/config.json"
    );
  });

  it("joins relative names with pageDir", () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://assets.twentyseven.pictures");
    expect(resolveConfigUrl("config.json", "/toons/jax/")).toBe(
      "https://assets.twentyseven.pictures/toons/jax/config.json"
    );
  });

  it("throws when empty", () => {
    expect(() => resolveConfigUrl("")).toThrow(/required/);
  });

  it("keeps dev local config paths off the CDN", () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://assets.twentyseven.pictures");
    expect(resolveConfigUrl("/__dev/toon-config/jax.json")).toBe("/__dev/toon-config/jax.json");
  });

  it("keeps editor-API config paths off the CDN", () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://assets.twentyseven.pictures");
    expect(resolveConfigUrl("/__editor-api/config/erin-the-revenge")).toBe("/__editor-api/config/erin-the-revenge");
  });
});

describe("pagesFromConfig", () => {
  it("reads file from each page object", () => {
    expect(
      pagesFromConfig({
        pages: [{ file: "a.jpg", words: [] }, { file: "b.jpg" }],
      })
    ).toEqual(["a.jpg", "b.jpg"]);
  });

  it("skips empty file entries", () => {
    expect(
      pagesFromConfig({
        pages: [{ file: "a.jpg" }, { file: "" }, { file: "c.jpg" }],
      })
    ).toEqual(["a.jpg", "c.jpg"]);
  });

  it("returns empty when no pages", () => {
    expect(pagesFromConfig({})).toEqual([]);
    expect(pagesFromConfig({ pages: [] })).toEqual([]);
  });
});

describe("loadConfig / loadConfigPages", () => {
  it("fetches and caches config", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pages: [{ file: "x.jpg", words: [] }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const a = await loadConfig("cfg.json");
    const b = await loadConfig("cfg.json");
    expect(a.pages?.[0]?.file).toBe("x.jpg");
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("cfg.json", { cache: "no-cache" });
  });

  it("expands pages from config", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ pages: [{ file: "x.jpg" }] }),
      })
    );
    await expect(loadConfigPages("m.json")).resolves.toEqual(["x.jpg"]);
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadConfig("config.json")).rejects.toThrow(/toon config 500/);
  });

  it("dedupes editor-API config in memory, still fetch no-store", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pages: [{ file: "x.jpg" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const url = "/__editor-api/config/erin-the-revenge";
    const a = await loadConfig(url);
    const b = await loadConfig(url);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, { cache: "no-store" });
  });
});

describe("createConfigLoader", () => {
  it("dedupes concurrent and cached loads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pages: [{ file: "1.jpg" }, { file: "2.jpg" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const load = createConfigLoader("shared.json");
    const [a, b] = await Promise.all([load(), load()]);
    expect(a).toEqual(["1.jpg", "2.jpg"]);
    expect(b).toEqual(["1.jpg", "2.jpg"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const c = await load();
    expect(c).toEqual(["1.jpg", "2.jpg"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
