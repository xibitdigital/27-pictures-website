/**
 * D1 catalog → HTML cards and JSON-LD. No `document` — the Pages Function
 * stamps this into the response so crawlers that do not run JS still see
 * the shelf. The client uses the same builders after fetch.
 */
import { pickDescription, type DescriptionMap } from "../toons/editor/types";
import { localePath, splitLocale, UI, withCaptionLang, type Locale } from "./i18n";

export const APEX = "https://twentyseven.pictures";

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
  assetPageDir?: string | null;
  designWidth?: number | null;
  designHeight?: number | null;
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

export function cardDescription(item: { description?: string; descriptions?: DescriptionMap }, locale: Locale): string {
  return pickDescription(item.descriptions, locale, item.description || "");
}

export function cardTitle(item: { title: string; titles?: DescriptionMap }, locale: Locale): string {
  return pickDescription(item.titles, locale, item.title);
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function seriesItemCount(series: CatalogSeries): number {
  return series.episodes.length;
}

export function episodesHeading(count: number, locale: Locale): string {
  const ui = UI[locale];
  if (count === 1) return ui.episodesOutOne;
  return ui.episodesOut.replace("{n}", String(count));
}

function hubHref(series: CatalogSeries, locale: Locale): string {
  return localePath(series.hubUrl || `/toons/${series.key}/`, locale);
}

function readerHref(ep: CatalogEpisode, locale: Locale): string {
  return withCaptionLang(ep.readerUrl || `/toons/${ep.slug}/`, locale);
}

export function seriesCardHtml(series: CatalogSeries, locale: Locale, assetW = 1152, assetH = 1728): string {
  const href = hubHref(series, locale);
  const img = series.coverUrl
    ? `<img src="${esc(series.coverUrl)}" alt="${esc(
        series.title
      )} interactive toon cover art" width="${assetW}" height="${assetH}" loading="lazy" decoding="async" />`
    : "";
  const n = seriesItemCount(series);
  const cue = episodesHeading(n, locale);
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
    <span class="series-card-desc">${esc(cardDescription(series, locale))}</span>
  </a>`;
}

export function standaloneCardHtml(ep: CatalogEpisode, locale: Locale, assetW = 1152, assetH = 1728): string {
  const href = readerHref(ep, locale);
  const img = ep.coverUrl
    ? `<img src="${esc(ep.coverUrl)}" alt="${esc(
        ep.title
      )} cover art" width="${assetW}" height="${assetH}" loading="lazy" decoding="async" />`
    : "";
  const ui = UI[locale];
  const cue = ep.pageCount > 0 ? ui.pagesCount.replace("{n}", String(ep.pageCount)) : ep.subtitle || "";
  return `<a class="series-card" id="toon-${esc(ep.slug)}" href="${esc(href)}">
    <span class="series-card-face">
      <span class="series-card-art">${img}</span>
      <span class="series-card-meta">${esc(ep.subtitle || "")}</span>
      <h3 class="series-card-title">${esc(cardTitle(ep, locale))}</h3>
      <span class="series-card-cue"><span>${esc(cue)}</span> <span aria-hidden="true">→</span></span>
    </span>
    <span class="series-card-desc">${esc(cardDescription(ep, locale))}</span>
  </a>`;
}

export function episodeCardHtml(ep: CatalogEpisode, locale: Locale, assetW = 1152, assetH = 1728): string {
  const href = readerHref(ep, locale);
  const img = ep.coverUrl
    ? `<img src="${esc(ep.coverUrl)}" alt="${esc(
        ep.title
      )} cover art" width="${assetW}" height="${assetH}" loading="lazy" decoding="async" />`
    : "";
  const ui = UI[locale];
  const cue = ep.pageCount > 0 ? ui.pagesCount.replace("{n}", String(ep.pageCount)) : "";
  const meta = ep.n != null ? `Episode ${ep.n}` : ep.subtitle || "";
  return `<a class="series-card series-card--episode" href="${esc(href)}">
    <span class="series-card-face">
      <span class="series-card-art">${img}</span>
      <span class="series-card-meta">${esc(meta)}</span>
      <h3 class="series-card-title">${esc(cardTitle(ep, locale))}</h3>
      <span class="series-card-cue"><span>${esc(cue)}</span> <span aria-hidden="true">→</span></span>
      <span class="series-card-votes" data-votes-episode="${esc(ep.slug)}" hidden></span>
    </span>
    <span class="series-card-desc">${esc(cardDescription(ep, locale))}</span>
  </a>`;
}

export function landingGridHtml(payload: CatalogPayload, locale: Locale): string {
  return [
    ...payload.series.map((item) => seriesCardHtml(item, locale)),
    ...payload.ungrouped.map((ep) => standaloneCardHtml(ep, locale)),
  ].join("\n");
}

export function absApex(path: string): string {
  if (path.startsWith("http")) return path;
  return `${APEX}${path.startsWith("/") ? path : `/${path}`}`;
}

export function seriesJsonLd(
  series: CatalogSeries,
  opts: { pageUrl: string; locale: Locale }
): { "@context": string; "@graph": Record<string, unknown>[] } {
  const page = opts.pageUrl.endsWith("/") ? opts.pageUrl : `${opts.pageUrl}/`;
  const desc = cardDescription(series, opts.locale);
  const locale = opts.locale;
  const ui = UI[locale];
  const hasPart = series.episodes.map((ep) => {
    const part: Record<string, unknown> = {
      "@type": "CreativeWork",
      name: ep.n != null ? `Episode ${ep.n} — ${cardTitle(ep, locale)}` : cardTitle(ep, locale),
      url: absApex(ep.readerUrl || `/toons/${ep.slug}/`),
    };
    if (ep.pageCount > 0) part.numberOfPages = ep.pageCount;
    return part;
  });
  const seriesNode: Record<string, unknown> = {
    "@type": "CreativeWorkSeries",
    "@id": `${page}#series`,
    name: series.title,
    url: page,
    inLanguage: ["en", "it", "de", "fr"],
    numberOfEpisodes: series.episodes.length,
    creator: { "@id": `${APEX}/#organization` },
    hasPart,
  };
  if (desc) seriesNode.description = desc;
  if (series.coverUrl) seriesNode.image = { "@type": "ImageObject", url: series.coverUrl };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${page}#webpage`,
        url: page,
        name: `${series.title} | 27 Pictures`,
        ...(desc ? { description: desc } : {}),
        isPartOf: { "@id": `${APEX}/#website` },
        publisher: { "@id": `${APEX}/#organization` },
        inLanguage: locale,
        mainEntity: { "@id": `${page}#series` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${page}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: ui.home, item: absApex(localePath("/", locale)) },
          { "@type": "ListItem", position: 2, name: ui.toons, item: absApex(localePath("/toons/", locale)) },
          { "@type": "ListItem", position: 3, name: series.title, item: page },
        ],
      },
      seriesNode,
    ],
  };
}

export function catalogJsonLd(
  payload: CatalogPayload,
  opts: { pageUrl: string; locale: Locale }
): { "@context": string; "@graph": Record<string, unknown>[] } {
  const page = opts.pageUrl.endsWith("/") ? opts.pageUrl : `${opts.pageUrl}/`;
  const locale = opts.locale;
  const ui = UI[locale];
  const items = [
    ...payload.series.map((s, i) => {
      const hub = absApex(localePath(s.hubUrl || `/toons/${s.key}/`, locale));
      return {
        "@type": "ListItem",
        position: i + 1,
        name: s.title,
        url: hub,
        item: {
          "@type": "CreativeWorkSeries",
          "@id": `${hub}#series`,
          name: s.title,
          url: hub,
          ...(cardDescription(s, locale) ? { description: cardDescription(s, locale) } : {}),
        },
      };
    }),
    ...payload.ungrouped.map((ep, i) => {
      const url = absApex(ep.readerUrl || `/toons/${ep.slug}/`);
      return {
        "@type": "ListItem",
        position: payload.series.length + i + 1,
        name: cardTitle(ep, locale),
        url,
        item: {
          "@type": "CreativeWork",
          "@id": `${url}#work`,
          name: cardTitle(ep, locale),
          url,
        },
      };
    }),
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${page}#webpage`,
        url: page,
        name: `${ui.toons} | 27 Pictures`,
        headline: ui.toons,
        inLanguage: locale,
        isPartOf: { "@id": `${APEX}/#website` },
        about: { "@id": `${APEX}/#organization` },
        publisher: { "@id": `${APEX}/#organization` },
        mainEntity: { "@id": `${page}#itemlist` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${page}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: ui.home, item: absApex(localePath("/", locale)) },
          { "@type": "ListItem", position: 2, name: ui.toons, item: page },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${page}#itemlist`,
        name: ui.toons,
        numberOfItems: items.length,
        itemListElement: items,
      },
    ],
  };
}

export function parseCatalog(body: unknown): CatalogPayload | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as { series?: unknown; ungrouped?: unknown };
  const series = Array.isArray(rec.series) ? (rec.series as CatalogSeries[]) : [];
  const ungrouped = Array.isArray(rec.ungrouped) ? (rec.ungrouped as CatalogEpisode[]) : [];
  return { series, ungrouped };
}

export function seriesForPath(pathname: string, payload: CatalogPayload): CatalogSeries | undefined {
  const { path } = splitLocale(pathname);
  const norm = path.endsWith("/") ? path : `${path}/`;
  return payload.series.find((s) => {
    const hub = s.hubUrl || `/toons/${s.key}/`;
    const hubPath = splitLocale(hub).path;
    const hubNorm = hubPath.endsWith("/") ? hubPath : `${hubPath}/`;
    return hubNorm === norm;
  });
}

export function seriesForRequest(html: string, pathname: string, payload: CatalogPayload): CatalogSeries | undefined {
  const key = html.match(/\bdata-series-key="([^"]+)"/)?.[1];
  if (key) {
    const hit = payload.series.find((s) => s.key === key);
    if (hit) return hit;
  }
  return seriesForPath(pathname, payload);
}

export function isToonIndexPath(pathname: string): boolean {
  const { path } = splitLocale(pathname);
  const norm = path.endsWith("/") ? path : `${path}/`;
  return norm === "/toons/";
}

export function catalogPath(pathname: string): string {
  const { path } = splitLocale(pathname);
  return path.endsWith("/") ? path : `${path}/`;
}

export function catalogEpisodes(payload: CatalogPayload): CatalogEpisode[] {
  return [...payload.series.flatMap((s) => s.episodes), ...payload.ungrouped];
}

const LEGACY_READER_SLUG: Record<string, string> = {
  "/toons/redsmile-static/": "redsmile-static",
  "/toons/redsmile-marcus/": "redsmile-marcus",
  "/toons/jax-the-chip/": "jax",
  "/toons/nero-the-dog/": "nero",
  "/toons/erin/": "erin",
  "/toons/erin-the-revenge/": "erin-the-revenge",
};

export function episodeForPath(pathname: string, payload: CatalogPayload): CatalogEpisode | undefined {
  const norm = catalogPath(pathname);
  const episodes = catalogEpisodes(payload);
  const aliased = LEGACY_READER_SLUG[norm];
  if (aliased) return episodes.find((ep) => ep.slug === aliased);
  return episodes.find((ep) => {
    const url = ep.readerUrl || `/toons/${ep.slug}/`;
    const p = splitLocale(url).path;
    return (p.endsWith("/") ? p : `${p}/`) === norm;
  });
}

export function seriesOfEpisode(ep: CatalogEpisode, payload: CatalogPayload): CatalogSeries | undefined {
  return payload.series.find((s) => s.episodes.some((item) => item.slug === ep.slug));
}

export type ToonRoute =
  | { kind: "catalog" }
  | { kind: "hub"; series: CatalogSeries }
  | { kind: "reader"; episode: CatalogEpisode; series?: CatalogSeries };

export function matchToonRoute(pathname: string, payload: CatalogPayload): ToonRoute | null {
  const { path } = splitLocale(pathname);
  const norm = catalogPath(path);
  if (norm === "/toons/" || norm === "/toons/editor/" || norm.startsWith("/toons/_")) return null;
  if (!norm.startsWith("/toons/")) return null;
  const episode = episodeForPath(pathname, payload);
  if (episode) return { kind: "reader", episode, series: seriesOfEpisode(episode, payload) };
  const series = seriesForPath(pathname, payload);
  if (series) return { kind: "hub", series };
  return null;
}

export function readerTokens(ep: CatalogEpisode): {
  width: number;
  height: number;
  spread: number;
  stripCap: string;
  paper: "light" | "dark";
} {
  const width = ep.designWidth && ep.designWidth > 0 ? ep.designWidth : 800;
  const height = ep.designHeight && ep.designHeight > 0 ? ep.designHeight : 1424;
  const spread = height / (2 * width);
  return {
    width,
    height,
    spread: Math.round(spread * 1000) / 1000,
    stripCap: `${Math.min(Math.max(width, 720), 1008)}px`,
    paper: ep.slug.startsWith("erin") ? "light" : "dark",
  };
}

export function assetDirForEpisode(ep: CatalogEpisode): string {
  const dir = ep.assetPageDir || `/toons/${ep.slug}/`;
  return dir.endsWith("/") ? dir : `${dir}/`;
}

export interface EpisodeNav {
  seriesTitle: string;
  current: string;
  prev?: { href: string; label: string };
  /** Absent href = listed in the series but not a readable URL yet. */
  next?: { href?: string; label: string };
}

export function episodeNavFromCatalog(series: CatalogSeries | undefined, slug: string): EpisodeNav | null {
  if (!series || series.episodes.length < 2) return null;
  const index = series.episodes.findIndex((ep) => ep.slug === slug);
  if (index < 0) return null;
  const current = series.episodes[index];
  const prevEp = series.episodes[index - 1];
  const nextEp = series.episodes[index + 1];
  const label = (ep: CatalogEpisode) => (ep.n != null ? `Episode ${ep.n} — ${ep.title}` : ep.title);
  return {
    seriesTitle: series.title,
    current: current.n != null ? `Episode ${current.n}` : current.title,
    prev: prevEp?.readerUrl ? { href: prevEp.readerUrl, label: label(prevEp) } : undefined,
    next: nextEp ? { href: nextEp.readerUrl || undefined, label: label(nextEp) } : undefined,
  };
}
