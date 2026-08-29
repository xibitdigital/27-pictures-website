/**
 * /toons/ catalog from the editor D1.
 *
 * Fills `[data-toon-catalog]` on /toons/ from D1 (no static card fallback).
 * Series hubs (`data-series-key`) take title, lead, episode heading and cards
 * from the same catalog.
 */
import { editorApiBase, withSiteQuery } from "../toons/editor/api";
import { pickDescription, type DescriptionMap } from "../toons/editor/types";
import { documentLocale, splitLocale, UI, withCaptionLang } from "./i18n";
import {
  fillSeriesEpisodeGrid,
  initEpisodeVotes,
  initSeriesVotes,
  setSeriesEpisodeMarkup,
  setSeriesFill,
} from "./seriesCards";
import { initToonRows, type RowEpisode } from "./toonRows";

export interface CatalogEpisode {
  id: string;
  slug: string;
  title: string;
  titles?: DescriptionMap;
  subtitle: string;
  description: string;
  descriptions?: DescriptionMap;
  coverUrl: string | null;
  pageCount: number;
  readerUrl: string | null;
  n: number | null;
}

export interface CatalogSeries {
  key: string;
  title: string;
  tagline: string;
  description: string;
  descriptions?: DescriptionMap;
  coverUrl: string | null;
  hubUrl: string | null;
  episodes: CatalogEpisode[];
}

export interface CatalogPayload {
  series: CatalogSeries[];
  ungrouped: CatalogEpisode[];
}

export function catalogUrl(): string | null {
  const base = editorApiBase();
  if (!base) return null;
  return withSiteQuery(`${base}/catalog`);
}

function cardDescription(item: { description?: string; descriptions?: DescriptionMap }): string {
  return pickDescription(item.descriptions, documentLocale(), item.description || "");
}

function cardTitle(item: { title: string; titles?: DescriptionMap }): string {
  return pickDescription(item.titles, documentLocale(), item.title);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Episodes this site can show (catalog already dropped drafts). */
export function seriesItemCount(series: CatalogSeries): number {
  return series.episodes.length;
}

export function seriesCardHtml(series: CatalogSeries, assetW = 1152, assetH = 1728): string {
  const href = withCaptionLang(series.hubUrl || `/toons/${series.key}/`);
  const img = series.coverUrl
    ? `<img src="${esc(series.coverUrl)}" alt="${esc(
        series.title
      )} interactive toon cover art" width="${assetW}" height="${assetH}" loading="lazy" decoding="async" />`
    : "";
  const n = seriesItemCount(series);
  const cue = n === 1 ? "1 episode" : `${n} episodes`;
  return `<a class="series-card series-card--series" id="series-${esc(series.key)}" data-series="${esc(
    series.key
  )}" data-quick-view href="${esc(href)}">
    <span class="series-card-face">
      <span class="series-card-art">${img}</span>
      <span class="series-card-meta">${esc(series.tagline || "")}</span>
      <h3 class="series-card-title">${esc(series.title)}</h3>
      <span class="series-card-cue"><span>${esc(cue)}</span> <span aria-hidden="true">→</span></span>
      <span class="series-card-votes" data-votes-for="${esc(series.key)}" hidden></span>
    </span>
    <span class="series-card-desc">${esc(cardDescription(series))}</span>
  </a>`;
}

export function standaloneCardHtml(ep: CatalogEpisode, assetW = 1152, assetH = 1728): string {
  const href = withCaptionLang(ep.readerUrl || `/toons/${ep.slug}/`);
  const img = ep.coverUrl
    ? `<img src="${esc(ep.coverUrl)}" alt="${esc(
        ep.title
      )} cover art" width="${assetW}" height="${assetH}" loading="lazy" decoding="async" />`
    : "";
  const ui = UI[documentLocale()];
  const cue = ep.pageCount > 0 ? ui.pagesCount.replace("{n}", String(ep.pageCount)) : ep.subtitle || "";
  return `<a class="series-card" id="toon-${esc(ep.slug)}" href="${esc(href)}">
    <span class="series-card-face">
      <span class="series-card-art">${img}</span>
      <span class="series-card-meta">${esc(ep.subtitle || "")}</span>
      <h3 class="series-card-title">${esc(cardTitle(ep))}</h3>
      <span class="series-card-cue"><span>${esc(cue)}</span> <span aria-hidden="true">→</span></span>
    </span>
    <span class="series-card-desc">${esc(cardDescription(ep))}</span>
  </a>`;
}

export function episodeCardHtml(ep: CatalogEpisode, assetW = 1152, assetH = 1728): string {
  const href = withCaptionLang(ep.readerUrl || `/toons/${ep.slug}/`);
  const img = ep.coverUrl
    ? `<img src="${esc(ep.coverUrl)}" alt="${esc(
        ep.title
      )} cover art" width="${assetW}" height="${assetH}" loading="lazy" decoding="async" />`
    : "";
  const ui = UI[documentLocale()];
  const cue = ep.pageCount > 0 ? ui.pagesCount.replace("{n}", String(ep.pageCount)) : "";
  const meta = ep.n != null ? `Episode ${ep.n}` : ep.subtitle || "";
  return `<a class="series-card series-card--episode" href="${esc(href)}">
    <span class="series-card-face">
      <span class="series-card-art">${img}</span>
      <span class="series-card-meta">${esc(meta)}</span>
      <h3 class="series-card-title">${esc(cardTitle(ep))}</h3>
      <span class="series-card-cue"><span>${esc(cue)}</span> <span aria-hidden="true">→</span></span>
      <span class="series-card-votes" data-votes-episode="${esc(ep.slug)}" hidden></span>
    </span>
    <span class="series-card-desc">${esc(cardDescription(ep))}</span>
  </a>`;
}

export async function loadCatalog(fetcher: typeof fetch = fetch): Promise<CatalogPayload | null> {
  const url = catalogUrl();
  if (!url) return null;
  try {
    const res = await fetcher(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    if (!body || typeof body !== "object") return null;
    const rec = body as { series?: unknown; ungrouped?: unknown };
    const series = Array.isArray(rec.series) ? (rec.series as CatalogSeries[]) : [];
    const ungrouped = Array.isArray(rec.ungrouped) ? (rec.ungrouped as CatalogEpisode[]) : [];
    return { series, ungrouped };
  } catch {
    return null;
  }
}

/** Replace the landing grid with DB series containers + ungrouped toons. */
export function renderLandingGrid(grid: Element, payload: CatalogPayload): void {
  if (!payload.series.length && !payload.ungrouped.length) return;
  grid.innerHTML = [
    ...payload.series.map((item) => seriesCardHtml(item)),
    ...payload.ungrouped.map((ep) => standaloneCardHtml(ep)),
  ].join("\n");
}

export function applyEpisodeCatalog(grid: Element, episodes: CatalogEpisode[]): void {
  grid.innerHTML = episodes.map((ep) => episodeCardHtml(ep)).join("\n");
}

export function episodesHeading(count: number): string {
  const ui = UI[documentLocale()];
  if (count === 1) return ui.episodesOutOne;
  return ui.episodesOut.replace("{n}", String(count));
}

/** Title, lead, episode heading and cards from D1. */
export function applySeriesPage(root: ParentNode, series: CatalogSeries): void {
  for (const el of root.querySelectorAll("[data-series-title]")) {
    el.textContent = series.title;
  }
  const lead = cardDescription(series);
  if (lead) {
    for (const el of root.querySelectorAll("[data-series-lead]")) {
      el.textContent = lead;
    }
  }
  const heading = episodesHeading(series.episodes.length);
  for (const el of root.querySelectorAll("[data-series-episodes-heading]")) {
    el.textContent = heading;
  }
  const grid = root.querySelector("[data-series-episodes]");
  if (grid) applyEpisodeCatalog(grid, series.episodes);
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

  const markup = new Map<string, string>();
  for (const s of items.series) {
    markup.set(s.key, s.episodes.map((ep) => episodeCardHtml(ep)).join("\n"));
  }
  setSeriesEpisodeMarkup(markup);
  setSeriesFill((fillRoot, key) => {
    const series = items.series.find((s) => s.key === key);
    if (!series) return false;
    applySeriesPage(fillRoot, series);
    return true;
  });

  const shelf = root.querySelector("[data-toon-catalog]");
  if (shelf) {
    renderLandingGrid(shelf, items);
    const blurb = root.querySelector(".series-shelf .toon-series-head p");
    if (blurb) {
      const n = items.series.length + items.ungrouped.length;
      blurb.textContent = n === 1 ? "1 book · pick it to start reading" : `${n} books · pick one to start reading`;
    }
    initSeriesVotes(root);
    initToonRows(catalogAsRowEpisodes(items));
  }

  const series = seriesForDocument(items);
  if (series) {
    applySeriesPage(root, series);
    const grid = root.querySelector("[data-series-episodes]");
    if (grid) initEpisodeVotes(grid);
  } else {
    const seriesKey = document.documentElement.dataset.seriesKey;
    if (seriesKey) fillSeriesEpisodeGrid(root, seriesKey);
  }
  return items;
}
