import { describe, it, expect, afterEach, vi } from "vitest";
import {
  pagesFromManifest,
  loadManifest,
  createManifestLoader,
} from "./loadManifest";

describe("pagesFromManifest", () => {
  it("prefers explicit files list", () => {
    expect(
      pagesFromManifest({ files: ["a.jpg", "b.jpg"], pages: 99 })
    ).toEqual(["a.jpg", "b.jpg"]);
  });

  it("expands pages + pattern", () => {
    expect(pagesFromManifest({ pages: 3, pattern: "p/{n}.jpg" })).toEqual([
      "p/1.jpg",
      "p/2.jpg",
      "p/3.jpg",
    ]);
  });

  it("returns empty when no usable data", () => {
    expect(pagesFromManifest({})).toEqual([]);
    expect(pagesFromManifest({ pages: 0 })).toEqual([]);
  });
});

describe("loadManifest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and expands", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ files: ["x.jpg"] }),
      })
    );
    await expect(loadManifest("m.json")).resolves.toEqual(["x.jpg"]);
    expect(fetch).toHaveBeenCalledWith("m.json", { cache: "no-cache" });
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    await expect(loadManifest()).rejects.toThrow(/manifest\.json 500/);
  });
});

describe("createManifestLoader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dedupes concurrent and cached loads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: ["1.jpg", "2.jpg"] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const load = createManifestLoader("shared.json");
    const [a, b] = await Promise.all([load(), load()]);
    expect(a).toEqual(["1.jpg", "2.jpg"]);
    expect(b).toEqual(["1.jpg", "2.jpg"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const c = await load();
    expect(c).toEqual(["1.jpg", "2.jpg"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
