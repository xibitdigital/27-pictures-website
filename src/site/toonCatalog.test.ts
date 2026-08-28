import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyEpisodeCatalog,
  catalogAsRowEpisodes,
  episodeCardHtml,
  renderLandingGrid,
  seriesCardHtml,
  standaloneCardHtml,
} from "./toonCatalog";
import type { CatalogEpisode, CatalogSeries } from "./toonCatalog";

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

  it("fills the series-page episode grid and keeps coming-soon", () => {
    const grid = document.createElement("div");
    grid.innerHTML = `<div class="series-card series-card--soon">Coming soon</div>`;
    applyEpisodeCatalog(grid, [episode]);
    expect(grid.querySelector(".series-card--episode")).toBeTruthy();
    expect(grid.querySelector(".series-card--soon")?.textContent).toContain("Coming soon");
  });

  it("flattens catalog episodes for continue-reading / most-loved", () => {
    const rows = catalogAsRowEpisodes({ series: [series], ungrouped: [loose] });
    expect(rows.map((r) => r.id)).toEqual(["erin-the-revenge", "studio-demo"]);
    expect(rows[0].seriesTitle).toBe("Erin & the Goblins");
    expect(rows[0].coverUrl).toContain("erin-the-revenge-intro");
  });
});
