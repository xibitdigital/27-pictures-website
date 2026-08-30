import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { matchToonRoute, type CatalogPayload } from "./catalogRender";
import { applyHubHtml, applyReaderHtml } from "./toonPages";

const payload: CatalogPayload = {
  series: [
    {
      key: "red-smile",
      title: "RED SMILE",
      tagline: "Horror",
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
          assetPageDir: "/toons/redsmile-static/",
          designWidth: 800,
          designHeight: 1424,
        },
        {
          id: "redsmile-marcus",
          slug: "redsmile-marcus",
          title: "Marcus",
          subtitle: "",
          description: "Marcus works late.",
          coverUrl: "https://cdn.example/marcus.jpg",
          pageCount: 12,
          readerUrl: "/toons/redsmile/marcus/",
          n: 2,
        },
      ],
    },
  ],
  ungrouped: [],
};

describe("matchToonRoute", () => {
  it("matches a series hub and a nested episode", () => {
    expect(matchToonRoute("/toons/redsmile/", payload)).toEqual({
      kind: "hub",
      series: payload.series[0],
    });
    const reader = matchToonRoute("/toons/redsmile/static/", payload);
    expect(reader?.kind).toBe("reader");
    if (reader?.kind !== "reader") throw new Error("expected reader");
    expect(reader.episode.slug).toBe("redsmile-static");
  });

  it("still resolves the old reader URL", () => {
    const reader = matchToonRoute("/toons/redsmile-static/", payload);
    expect(reader?.kind).toBe("reader");
    if (reader?.kind !== "reader") throw new Error("expected reader");
    expect(reader.episode.slug).toBe("redsmile-static");
  });
});

describe("applyHubHtml / applyReaderHtml", () => {
  it("stamps D1 into the hub template", () => {
    const html = readFileSync(resolve("src/toons/_hub/index.html"), "utf8");
    const out = applyHubHtml(html, payload.series[0], "https://twentyseven.pictures/toons/redsmile/");
    expect(out).toContain('data-series-key="red-smile"');
    expect(out).toContain('href="/toons/redsmile/static/"');
    expect(out).toContain('data-episode-one="/toons/redsmile/static/"');
    expect(out).toContain("Elena.");
    expect(out).toMatch(/<h1>RED SMILE<\/h1>/);
    expect(html).not.toContain("<h1>RED SMILE</h1>");
  });

  it("stamps D1 into the reader template", () => {
    const html = readFileSync(resolve("src/toons/_reader/index.html"), "utf8");
    const ep = payload.series[0].episodes[0];
    const out = applyReaderHtml(html, ep, payload.series[0], "https://twentyseven.pictures/toons/redsmile/static/");
    expect(out).toContain('data-toon-slug="redsmile-static"');
    expect(out).toContain('data-asset-page-dir="/toons/redsmile-static/"');
    expect(out).toContain("index, follow");
    expect(out).toContain("/toons/redsmile/marcus/");
    expect(out).toContain('"label": "Episode 2 — Marcus"');
  });
});
