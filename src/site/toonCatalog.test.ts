import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyEpisodeCatalog,
  applySeriesPage,
  catalogAsRowEpisodes,
  episodeCardHtml,
  episodesHeading,
  initToonCatalog,
  renderLandingGrid,
  seriesCardHtml,
  seriesForDocument,
  seriesItemCount,
  seriesJsonLd,
  standaloneCardHtml,
} from "./toonCatalog";
import type { CatalogEpisode, CatalogSeries } from "./toonCatalog";
import { resetSeriesQuickView } from "./seriesCards";

const episode: CatalogEpisode = {
  id: "erin-the-revenge",
  slug: "erin-the-revenge",
  title: "The Revenge",
  subtitle: "The Revenge",
  description: "Erin came back to defeat the Goblin King.",
  coverUrl: "https://cdn.example/card-art/erin-the-revenge-intro.jpg",
  pageCount: 23,
  readerUrl: "/toons/erin-the-revenge/",
  n: 2,
};

const series: CatalogSeries = {
  key: "erin",
  title: "Erin & the Goblins",
  tagline: "Dark fantasy · a town that is really a door",
  description: "Half human, half vampire.",
  coverUrl: "https://cdn.example/card-art/erin-dark.jpg",
  hubUrl: "/toons/erin-and-the-goblins/",
  episodes: [episode],
};

const loose: CatalogEpisode = {
  id: "studio-demo",
  slug: "studio-demo",
  title: "Studio Demo",
  subtitle: "",
  description: "A draft.",
  coverUrl: null,
  pageCount: 2,
  readerUrl: null,
  n: null,
};

describe("toonCatalog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.lang = "en";
    delete document.documentElement.dataset.seriesKey;
    resetSeriesQuickView();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("renders a series container that opens the series hub, not the episode", () => {
    const html = seriesCardHtml(series);
    expect(html).toContain("series-card--series");
    expect(html).toContain('data-series="erin"');
    expect(html).toContain("data-quick-view");
    expect(html).toContain('href="/toons/erin-and-the-goblins/"');
    expect(html).toContain("Erin &amp; the Goblins");
    expect(html).toContain("1 episode");
    expect(html).not.toContain("/toons/erin-the-revenge/");
  });

  it("counts only catalog episodes, not drafts or the static registry", () => {
    const html = seriesCardHtml({
      ...series,
      episodes: [episode],
    });
    expect(html).toContain("1 episode");
    expect(html).not.toContain("2 episodes");
    expect(seriesItemCount(series)).toBe(1);
  });

  it("does not count a draft series member on the public card", () => {
    const redSmile: CatalogSeries = {
      key: "red-smile",
      title: "RED SMILE",
      tagline: "Horror",
      description: "Elena.",
      coverUrl: null,
      hubUrl: "/toons/redsmile/",
      episodes: [{ ...episode, id: "redsmile-static", slug: "redsmile-static", title: "static", n: 1 }],
    };
    expect(seriesItemCount(redSmile)).toBe(1);
    expect(seriesCardHtml(redSmile)).toContain("1 episode");
  });

  it("renders an episode card for the series page grid", () => {
    const html = episodeCardHtml(episode);
    expect(html).toContain("series-card--episode");
    expect(html).toContain("Episode 2");
    expect(html).toContain("23 pages");
    expect(html).toContain("/toons/erin-the-revenge/");
  });

  it("uses the page locale for a toon title", () => {
    document.documentElement.lang = "fr";
    const html = episodeCardHtml({
      ...episode,
      titles: { en: "The Revenge", it: "La vendetta", de: "Die Rache", fr: "La vengeance" },
    });
    expect(html).toContain('<h3 class="series-card-title">La vengeance</h3>');
    expect(html).not.toContain('<h3 class="series-card-title">The Revenge</h3>');
  });

  it("uses the page locale for a toon description", () => {
    document.documentElement.lang = "it";
    const html = episodeCardHtml({
      ...episode,
      descriptions: {
        en: "Erin came back to defeat the Goblin King.",
        it: "Erin è tornata per sconfiggere il Re Goblin.",
        de: "",
        fr: "",
      },
    });
    expect(html).toContain("Erin è tornata per sconfiggere il Re Goblin.");
    expect(html).not.toContain("Erin came back to defeat the Goblin King.");
  });

  it("uses the page locale for a series description", () => {
    document.documentElement.lang = "fr";
    const html = seriesCardHtml({
      ...series,
      descriptions: {
        en: "Half human, half vampire.",
        it: "",
        de: "",
        fr: "Mi-humaine, mi-vampire.",
      },
    });
    expect(html).toContain("Mi-humaine, mi-vampire.");
    expect(html).not.toContain("Half human, half vampire.");
  });

  it("fills an empty landing grid from the catalog", () => {
    const grid = document.createElement("div");
    renderLandingGrid(grid, { series: [series], ungrouped: [loose] });
    expect(grid.querySelector("[data-series=erin]")?.textContent).toContain("Erin & the Goblins");
    expect(grid.querySelector("#toon-studio-demo")?.textContent).toContain("Studio Demo");
    expect(standaloneCardHtml(loose)).toContain("/toons/studio-demo/");
  });

  it("fills the series-page episode grid from the catalog only", () => {
    const grid = document.createElement("div");
    grid.innerHTML = `<div class="series-card series-card--soon">Coming soon</div>`;
    applyEpisodeCatalog(grid, [episode]);
    expect(grid.querySelector(".series-card--episode")).toBeTruthy();
    expect(grid.querySelector(".series-card--soon")).toBeNull();
  });

  it("flattens catalog episodes for continue-reading", () => {
    const rows = catalogAsRowEpisodes({ series: [series], ungrouped: [loose] });
    expect(rows.map((r) => r.id)).toEqual(["erin-the-revenge", "studio-demo"]);
    expect(rows[0].seriesTitle).toBe("Erin & the Goblins");
    expect(rows[0].coverUrl).toContain("erin-the-revenge-intro");
  });

  it("the hub shell has no series copy — SSR writes the page from D1", () => {
    const html = readFileSync(resolve("src/toons/_hub/index.html"), "utf8");
    expect(html).toContain("data-series-key");
    expect(html).toContain("data-series-jsonld");
    expect(html).toContain('src="/site/seriesPageMain.ts"');
    expect(html).not.toContain("RED SMILE");
    expect(html).not.toContain("data-series-title");
  });

  it("paints title, lead, heading and cards from the catalog series", () => {
    document.body.innerHTML = `
      <h1 data-series-title>Old</h1>
      <p data-series-lead>Old lead</p>
      <h2 data-series-episodes-heading>Old heading</h2>
      <div data-series-episodes></div>`;
    applySeriesPage(document.body, { ...series, episodes: [episode, { ...episode, id: "erin", slug: "erin", n: 1 }] });
    expect(document.querySelector("[data-series-title]")?.textContent).toBe("Erin & the Goblins");
    expect(document.querySelector("[data-series-lead]")?.textContent).toBe("Half human, half vampire.");
    expect(document.querySelector("[data-series-episodes-heading]")?.textContent).toBe("2 episodes");
    expect(document.querySelectorAll(".series-card--episode")).toHaveLength(2);
  });

  it("counts one episode with the singular heading", () => {
    expect(episodesHeading(1)).toBe("1 episode");
    expect(episodesHeading(2)).toBe("2 episodes");
  });

  it("builds series JSON-LD from the catalog, not a hardcoded episode list", () => {
    const graph = seriesJsonLd(
      {
        ...series,
        episodes: [
          { ...episode, id: "erin", slug: "erin", n: 1, title: "The Missing Child", readerUrl: "/toons/erin/" },
          episode,
        ],
      },
      { pageUrl: "https://twentyseven.pictures/toons/erin-and-the-goblins/", locale: "en" }
    );
    const nodes = graph["@graph"];
    const seriesNode = nodes.find((n) => n["@type"] === "CreativeWorkSeries") as {
      numberOfEpisodes: number;
      hasPart: { url: string; name: string }[];
    };
    expect(seriesNode.numberOfEpisodes).toBe(2);
    expect(seriesNode.hasPart.map((p) => p.url)).toEqual([
      "https://twentyseven.pictures/toons/erin/",
      "https://twentyseven.pictures/toons/erin-the-revenge/",
    ]);
    expect(JSON.stringify(graph)).not.toContain("redsmile-marcus");
  });

  it("matches a hub by data-series-key, then by hub URL", () => {
    const payload = { series: [series], ungrouped: [] };
    document.documentElement.dataset.seriesKey = "erin";
    expect(seriesForDocument(payload)?.key).toBe("erin");
    document.documentElement.dataset.seriesKey = "missing";
    expect(seriesForDocument(payload)?.key).toBeUndefined();
    delete document.documentElement.dataset.seriesKey;
  });

  it("does not paint series cards in the browser — SSR owns the shelf", async () => {
    vi.stubEnv("VITE_EDITOR_API", "https://editor.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          series: [
            {
              key: "red-smile",
              title: "RED SMILE",
              tagline: "Horror",
              description: "Elena.",
              coverUrl: null,
              hubUrl: "/toons/redsmile/",
              episodes: [
                {
                  ...episode,
                  id: "redsmile-static",
                  slug: "redsmile-static",
                  title: "static",
                  n: 1,
                  readerUrl: "/toons/redsmile/static/",
                },
              ],
            },
          ],
          ungrouped: [],
        }),
      })
    );
    document.documentElement.dataset.seriesKey = "red-smile";
    document.body.innerHTML = `
      <h1 data-series-title>RED SMILE</h1>
      <p data-series-lead>static lead</p>
      <h2 data-series-episodes-heading>Two out</h2>
      <div data-series-page><div class="series-grid" data-series-episodes></div></div>`;
    await initToonCatalog();
    expect(document.querySelector("[data-series-lead]")?.textContent).toBe("static lead");
    expect(document.querySelector(".series-card--episode")).toBeNull();
    delete document.documentElement.dataset.seriesKey;
  });
});
