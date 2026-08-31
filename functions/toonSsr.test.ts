import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { injectToonHtml } from "./toonSsr";
import { applyHubHtml } from "../src/site/toonPages";
import type { CatalogPayload } from "../src/site/catalogRender";

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

describe("injectToonHtml", () => {
  it("fills the /toons/ shelf and ItemList from D1", () => {
    const html = `<!doctype html><html lang="en"><head>
      <link rel="canonical" href="https://twentyseven.pictures/toons/" />
      <script type="application/ld+json" data-toon-jsonld>{ "@context": "https://schema.org", "@graph": [] }</script>
    </head><body>
      <nav class="page-breadcrumb" aria-label="old"><ol><li>x</li></ol></nav>
      <div class="series-grid" data-toon-catalog></div>
    </body></html>`;
    const out = injectToonHtml(html, payload, "https://twentyseven.pictures/toons/");
    expect(out).toContain('aria-current="page">Toons</li>');
    expect(out).toContain('href="/"');
    expect(out).toContain('data-series="red-smile"');
    expect(out).toContain('href="/toons/redsmile/"');
    expect(out).toContain("RED SMILE");
    expect(out).toContain('"numberOfItems": 1');
    expect(out).toContain("https://twentyseven.pictures/toons/redsmile/#series");
  });

  it("fills a series hub including JSON-LD hasPart from D1", () => {
    const html = `<!doctype html><html lang="en" data-series-key="red-smile"><head>
      <link rel="canonical" href="https://twentyseven.pictures/toons/redsmile/" />
      <script type="application/ld+json" data-series-jsonld>{ "@context": "https://schema.org", "@graph": [] }</script>
    </head><body>
      <h1 data-series-title>RED SMILE</h1>
      <p data-series-lead>old</p>
      <h2 data-series-episodes-heading>1 episode</h2>
      <div class="series-grid" data-series-episodes></div>
    </body></html>`;
    const out = injectToonHtml(html, payload, "https://twentyseven.pictures/toons/redsmile/");
    expect(out).toContain("/toons/redsmile/static/");
    expect(out).toContain("/toons/redsmile/marcus/");
    expect(out).toContain("Elena.");
    expect(out).toContain("2 episodes");
    expect(out).toContain('"numberOfEpisodes": 2');
    expect(out).toContain("Episode 2 — Marcus");
  });

  it("localizes hub card hrefs on /de/toons/", () => {
    const html = `<!doctype html><html lang="de"><head>
      <link rel="canonical" href="https://twentyseven.pictures/de/toons/" />
      <script type="application/ld+json" data-toon-jsonld>{ "@graph": [] }</script>
    </head><body>
      <div class="series-grid" data-toon-catalog></div>
    </body></html>`;
    const out = injectToonHtml(html, payload, "https://twentyseven.pictures/de/toons/");
    expect(out).toContain('href="/de/toons/redsmile/"');
    expect(out).not.toContain('href="/toons/redsmile/?lang=de"');
  });

  it("SSR-fills the shared hub template", () => {
    const html = readFileSync(resolve("src/toons/_hub/index.html"), "utf8");
    const out = applyHubHtml(html, payload.series[0], "https://twentyseven.pictures/toons/redsmile/");
    expect(out).toContain('href="/toons/redsmile/static/"');
    expect(out).toContain('href="/toons/redsmile/marcus/"');
    expect(out).toContain("series-card--episode");
    expect(out).toContain('"numberOfEpisodes": 2');
    expect(out).toContain("Episode 2 — Marcus");
    expect(out).toContain("Elena.");
  });
});
