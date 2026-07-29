import { afterEach, describe, expect, it, vi } from "vitest";
import { getAssetBase, pageDirFromPathname, resolveAssetUrl, resolvePageUrls, toSitePath } from "./assetUrl";

describe("pageDirFromPathname", () => {
  it("keeps trailing slash directories", () => {
    expect(pageDirFromPathname("/toons/jax/")).toBe("/toons/jax/");
  });

  it("strips index.html and other files", () => {
    expect(pageDirFromPathname("/toons/jax/index.html")).toBe("/toons/jax/");
    expect(pageDirFromPathname("/toons/erin/index.html")).toBe("/toons/erin/");
  });

  it("adds slash for path without file extension", () => {
    expect(pageDirFromPathname("/toons/jax")).toBe("/toons/jax/");
  });

  it("handles root", () => {
    expect(pageDirFromPathname("/")).toBe("/");
    expect(pageDirFromPathname("")).toBe("/");
  });
});

describe("toSitePath", () => {
  it("passes through root-absolute paths", () => {
    expect(toSitePath("/toons/assets/x.jpg")).toBe("/toons/assets/x.jpg");
  });

  it("joins relative paths against pageDir", () => {
    expect(toSitePath("assets/a.jpg", "/toons/jax/")).toBe("/toons/jax/assets/a.jpg");
    expect(toSitePath("./assets/sfx/b.mp3", "/toons/jax")).toBe("/toons/jax/assets/sfx/b.mp3");
  });

  it("throws when relative path lacks pageDir", () => {
    expect(() => toSitePath("assets/a.jpg")).toThrow(/pageDir required/);
  });
});

describe("resolveAssetUrl / getAssetBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns path unchanged when VITE_ASSET_BASE is empty", () => {
    vi.stubEnv("VITE_ASSET_BASE", "");
    expect(getAssetBase()).toBe("");
    expect(resolveAssetUrl("assets/1.jpg")).toBe("assets/1.jpg");
    expect(resolveAssetUrl("/toons/assets/x.jpg")).toBe("/toons/assets/x.jpg");
  });

  it("prefixes site paths when base is set", () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://assets.twentyseven.pictures/");
    expect(getAssetBase()).toBe("https://assets.twentyseven.pictures");
    expect(resolveAssetUrl("/toons/assets/x.jpg")).toBe("https://assets.twentyseven.pictures/toons/assets/x.jpg");
    expect(resolveAssetUrl("assets/1.jpg", "/toons/jax/")).toBe(
      "https://assets.twentyseven.pictures/toons/jax/assets/1.jpg"
    );
  });

  it("leaves relative paths alone when CDN is set but pageDir is missing", () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://cdn.example");
    expect(resolveAssetUrl("assets/1.jpg")).toBe("assets/1.jpg");
  });

  it("leaves absolute and data URLs alone", () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://assets.twentyseven.pictures");
    expect(resolveAssetUrl("https://cdn.example/a.jpg")).toBe("https://cdn.example/a.jpg");
    expect(resolveAssetUrl("data:image/png;base64,xx")).toBe("data:image/png;base64,xx");
  });

  it("resolvePageUrls maps a list", () => {
    vi.stubEnv("VITE_ASSET_BASE", "https://cdn.example");
    expect(resolvePageUrls(["assets/a.jpg", "assets/b.jpg"], "/toons/erin/")).toEqual([
      "https://cdn.example/toons/erin/assets/a.jpg",
      "https://cdn.example/toons/erin/assets/b.jpg",
    ]);
  });
});
