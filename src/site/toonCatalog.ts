/**
 * Browser extras for the D1 catalog: continue-reading and an empty-grid
 * fallback for the quick-view dialog. Cards and JSON-LD are SSR.
 */
import { editorApiBase, withSiteQuery } from "../toons/editor/api";
import { documentLocale, splitLocale } from "./i18n";
import {
  cardDescription as cardDescriptionAt,
  episodeCardHtml as episodeCardHtmlAt,
  episodesHeading as episodesHeadingAt,
  landingGridHtml,
  parseCatalog,
  seriesCardHtml as seriesCardHtmlAt,
  seriesJsonLd as seriesJsonLdAt,
  standaloneCardHtml as standaloneCardHtmlAt,
  type CatalogEpisode,
  type CatalogPayload,
  type CatalogSeries,
} from "./catalogRender";
import { initSeriesVotes, setSeriesEpisodeMarkup, setSeriesFill } from "./seriesCards";
import { initToonRows, type RowEpisode } from "./toonRows";

export type { CatalogEpisode, CatalogPayload, CatalogSeries };
export { seriesItemCount, seriesJsonLd } from "./catalogRender";

export function catalogUrl(): string | null {
  const base = editorApiBase();
  if (!base) return null;
  return withSiteQuery(`${base}/catalog`);
}

export function seriesCardHtml(series: CatalogSeries, assetW = 1152, assetH = 1728): string {
  return seriesCardHtmlAt(series, documentLocale(), assetW, assetH);
}

export function standaloneCardHtml(ep: CatalogEpisode, assetW = 1152, assetH = 1728): string {
  return standaloneCardHtmlAt(ep, documentLocale(), assetW, assetH);
}

export function episodeCardHtml(ep: CatalogEpisode, assetW = 1152, assetH = 1728): string {
  return episodeCardHtmlAt(ep, documentLocale(), assetW, assetH);
}

export async function loadCatalog(fetcher: typeof fetch = fetch): Promise<CatalogPayload | null> {
  const url = catalogUrl();
  if (!url) return null;
  try {
    const res = await fetcher(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return parseCatalog(await res.json());
  } catch {
    return null;
  }
}

/** Replace the landing grid with DB series containers + ungrouped toons. */
export function renderLandingGrid(grid: Element, payload: CatalogPayload): void {
  if (!payload.series.length && !payload.ungrouped.length) return;
  grid.innerHTML = landingGridHtml(payload, documentLocale());
}

export function applyEpisodeCatalog(grid: Element, episodes: CatalogEpisode[]): void {
  const locale = documentLocale();
  grid.innerHTML = episodes.map((ep) => episodeCardHtmlAt(ep, locale)).join("\n");
}

export function episodesHeading(count: number): string {
  return episodesHeadingAt(count, documentLocale());
}

function jsonLdPageUrl(series: CatalogSeries, doc: Document): string {
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
  if (canonical) return canonical.endsWith("/") ? canonical : `${canonical}/`;
  const hub = series.hubUrl || `/toons/${series.key}/`;
  return `https://twentyseven.pictures${hub.startsWith("/") ? hub : `/${hub}`}`;
}

export function applySeriesJsonLd(series: CatalogSeries, doc: Document = document): void {
  const el = doc.querySelector("script[data-series-jsonld]");
  if (!el) return;
  const graph = seriesJsonLdAt(series, { pageUrl: jsonLdPageUrl(series, doc), locale: documentLocale(doc) });
  el.textContent = `\n${JSON.stringify(graph, null, 2)}\n    `;
}

/** Title, lead, episode heading, cards and JSON-LD from D1. */
export function applySeriesPage(root: ParentNode, series: CatalogSeries, doc: Document = document): void {
  const locale = documentLocale(doc);
  for (const el of root.querySelectorAll("[data-series-title]")) {
    el.textContent = series.title;
  }
  const lead = cardDescriptionAt(series, locale);
  if (lead) {
    for (const el of root.querySelectorAll("[data-series-lead]")) {
      el.textContent = lead;
    }
  }
  const heading = episodesHeadingAt(series.episodes.length, locale);
  for (const el of root.querySelectorAll("[data-series-episodes-heading]")) {
    el.textContent = heading;
  }
  const grid = root.querySelector("[data-series-episodes]");
  if (grid) applyEpisodeCatalog(grid, series.episodes);
  applySeriesJsonLd(series, doc);
}

export function seriesForDocument(items: CatalogPayload, doc: Document = document): CatalogSeries | undefined {
  const key = doc.documentElement.dataset.seriesKey;
  if (key) {
    const hit = items.series.find((s) => s.key === key);
    if (hit) return hit;
  }
  const path = splitLocale(typeof location !== "undefined" ? location.pathname : "").path;
  return items.series.find((s) => {
    const hub = s.hubUrl || `/toons/${s.key}/`;
    return splitLocale(hub).path === path;
  });
}

export function catalogAsRowEpisodes(payload: CatalogPayload): RowEpisode[] {
  const fromSeries = payload.series.flatMap((s) =>
    s.episodes.map(
      (ep): RowEpisode => ({
        id: ep.slug,
        n: ep.n ?? 0,
        title: ep.title,
        url: ep.readerUrl || `/toons/${ep.slug}/`,
        pages: ep.pageCount,
        status: "published",
        seriesTitle: s.title,
        coverUrl: ep.coverUrl ?? undefined,
      })
    )
  );
  const loose = payload.ungrouped.map(
    (ep): RowEpisode => ({
      id: ep.slug,
      n: ep.n ?? 0,
      title: ep.title,
      url: ep.readerUrl || `/toons/${ep.slug}/`,
      pages: ep.pageCount,
      status: "published",
      seriesTitle: ep.title,
      coverUrl: ep.coverUrl ?? undefined,
    })
  );
  return [...fromSeries, ...loose];
}

export async function initToonCatalog(root: ParentNode = document): Promise<CatalogPayload | null> {
  const items = await loadCatalog();
  if (!items) return null;

  const locale = documentLocale();
  const markup = new Map<string, string>();
  for (const s of items.series) {
    markup.set(s.key, s.episodes.map((ep) => episodeCardHtmlAt(ep, locale)).join("\n"));
  }
  setSeriesEpisodeMarkup(markup);
  setSeriesFill((fillRoot, key) => {
    const series = items.series.find((s) => s.key === key);
    if (!series) return false;
    const grid = fillRoot.querySelector("[data-series-episodes]") || fillRoot.querySelector(".series-grid");
    if (grid && !grid.querySelector(".series-card")) {
      applyEpisodeCatalog(grid, series.episodes);
    }
    return true;
  });

  if (root.querySelector("[data-toon-catalog]")) {
    initSeriesVotes(root);
    initToonRows(catalogAsRowEpisodes(items));
  }
  return items;
}
