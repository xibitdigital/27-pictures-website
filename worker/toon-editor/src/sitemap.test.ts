import { describe, expect, it } from "vitest";
import { localePath, renderSitemapXml, siteOriginFromRequest, staticSitemapUrls, toonSitemapUrls } from "./sitemap";

describe("sitemap", () => {
  it("prefixes locale paths and leaves English at the root", () => {
    expect(localePath("/toons/", "en")).toBe("/toons/");
    expect(localePath("/toons/", "it")).toBe("/it/toons/");
    expect(localePath("/", "de")).toBe("/de/");
  });

  it("reads the site origin from ?site=", () => {
    expect(
      siteOriginFromRequest({ url: "https://worker.example/sitemap.xml?site=https://staging.twentyseven.pictures" })
    ).toBe("https://staging.twentyseven.pictures");
  });

  it("lists localized static pages and D1 series/readers, skipping drafts and the editor", () => {
    const staticUrls = staticSitemapUrls("https://twentyseven.pictures", "https://cdn.example");
    expect(staticUrls.some((u) => u.loc === "https://twentyseven.pictures/toons/")).toBe(true);
    expect(staticUrls.some((u) => u.loc === "https://twentyseven.pictures/it/toons/")).toBe(true);
    expect(staticUrls.some((u) => u.loc.includes("/toons/editor"))).toBe(false);

    const toonUrls = toonSitemapUrls(
      "https://twentyseven.pictures",
      [
        {
          hubUrl: "/toons/erin-and-the-goblins/",
          coverUrl: "https://cdn.example/erin.jpg",
          title: "Erin & the Goblins",
          updatedAt: "2026-08-29T00:00:00.000Z",
        },
      ],
      [
        {
          readerUrl: "/toons/erin/",
          slug: "erin",
          coverUrl: "https://cdn.example/erin.jpg",
          title: "The Missing Child",
          updatedAt: "2026-08-29T00:00:00.000Z",
        },
        {
          readerUrl: "/toons/editor/",
          slug: "nope",
          coverUrl: null,
          title: "Editor",
        },
      ]
    );
    const locs = toonUrls.map((u) => u.loc);
    expect(locs).toContain("https://twentyseven.pictures/toons/erin-and-the-goblins/");
    expect(locs).toContain("https://twentyseven.pictures/fr/toons/erin-and-the-goblins/");
    expect(locs).toContain("https://twentyseven.pictures/toons/erin/");
    expect(locs).not.toContain("https://twentyseven.pictures/it/toons/erin/");
    expect(locs.some((l) => l.includes("/toons/editor"))).toBe(false);

    const xml = renderSitemapXml(toonUrls);
    expect(xml).toContain("<lastmod>2026-08-29</lastmod>");
    expect(xml).toContain("&amp;");
  });
});
