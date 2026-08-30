import { describe, expect, it } from "vitest";
import { renderCatalogSitemap, renderLlmsTxt } from "./crawlerDocs";
import type { CatalogPayload } from "./catalogRender";

const payload: CatalogPayload = {
  series: [
    {
      key: "red-smile",
      title: "RED SMILE",
      tagline: "Horror · the anthology, as something you read",
      description: "Elena.",
      coverUrl: "https://cdn.example/red.jpg",
      hubUrl: "/toons/redsmile/",
      episodes: [
        {
          id: "redsmile-static",
          slug: "redsmile-static",
          title: "static",
          subtitle: "",
          description: "Elena is alone.",
          coverUrl: "https://cdn.example/static.jpg",
          pageCount: 12,
          readerUrl: "/toons/redsmile/static/",
          n: 1,
        },
      ],
    },
  ],
  ungrouped: [],
};

describe("renderLlmsTxt", () => {
  it("lists D1 hubs and nested readers, not a hardcoded toon table", () => {
    const txt = renderLlmsTxt("https://twentyseven.pictures", payload);
    expect(txt).toContain("# 27 Pictures");
    expect(txt).toContain("https://twentyseven.pictures/toons/redsmile/");
    expect(txt).toContain("https://twentyseven.pictures/toons/redsmile/static/");
    expect(txt).toContain("RED SMILE — Episode 1");
    expect(txt).not.toContain("/toons/redsmile-static/");
    expect(txt).toContain("/cosplay/");
    expect(txt).toContain("/it/toons/");
  });
});

describe("renderCatalogSitemap", () => {
  it("emits static pages, localized hubs, and English readers from D1", () => {
    const xml = renderCatalogSitemap("https://twentyseven.pictures", payload);
    expect(xml).toContain("<loc>https://twentyseven.pictures/</loc>");
    expect(xml).toContain("<loc>https://twentyseven.pictures/de/toons/</loc>");
    expect(xml).toContain("<loc>https://twentyseven.pictures/toons/redsmile/</loc>");
    expect(xml).toContain("<loc>https://twentyseven.pictures/de/toons/redsmile/</loc>");
    expect(xml).toContain("<loc>https://twentyseven.pictures/toons/redsmile/static/</loc>");
    expect(xml).not.toContain("/toons/editor");
    expect(xml).not.toContain("/toons/redsmile-static/");
  });
});
