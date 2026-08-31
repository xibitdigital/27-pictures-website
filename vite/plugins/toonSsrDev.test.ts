import { describe, expect, it } from "vitest";
import { createDevCatalogLoader, isToonShellPath } from "./toonSsrDev";

describe("isToonShellPath", () => {
  it("skips hub and reader templates so transformIndexHtml does not re-fetch catalog", () => {
    expect(isToonShellPath("/toons/_hub/index.html")).toBe(true);
    expect(isToonShellPath("/toons/_reader/index.html")).toBe(true);
    expect(isToonShellPath("/toons/index.html")).toBe(false);
    expect(isToonShellPath("/toons/nero/")).toBe(false);
  });
});

describe("createDevCatalogLoader", () => {
  const body = { series: [], ungrouped: [] };

  it("coalesces in-flight fetches and then serves cache", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      await new Promise((r) => setTimeout(r, 30));
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const load = createDevCatalogLoader({ fetchImpl, ttlMs: 60_000 });
    const [a, b] = await Promise.all([load("http://127.0.0.1:5173"), load("http://127.0.0.1:5173")]);
    expect(n).toBe(1);
    expect(a?.series).toEqual([]);
    expect(b?.series).toEqual([]);
    await load("http://127.0.0.1:5173");
    expect(n).toBe(1);
  });
});
