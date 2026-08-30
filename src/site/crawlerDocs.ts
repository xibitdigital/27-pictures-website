/**
 * Request-time sitemap.xml and llms.txt from D1 catalog + static site pages.
 * Used by Pages Functions (`functions/sitemap.xml.ts`, `functions/llms.txt.ts`)
 * and `vite/plugins/toonSsrDev.ts`. New films go in `FILM_LINKS` here; new
 * translated site paths go in `LOCALIZED_SITE_PATHS` (imported from the
 * Worker sitemap module — a Pages deploy picks them up).
 */
import {
  LOCALIZED_SITE_PATHS,
  renderSitemapXml,
  staticSitemapUrls,
  toonSitemapUrls,
  type SitemapUrl,
} from "../../worker/toon-editor/src/sitemap";
import { catalogEpisodes, type CatalogPayload } from "./catalogRender";
import { UI, type Locale } from "./i18n";

export const DEFAULT_ASSET_BASE = "https://pub-e60c8fa8eea343fbac708bf75981d19c.r2.dev";

const FILM_LINKS: Array<{ href: string; title: string; note: string }> = [
  {
    href: "/",
    title: "Homepage",
    note: "studio overview — The Red Smile anthology, the Jax cyberpunk series, cosplay production, interactive toons, contact",
  },
  {
    href: "/horror-shorts/",
    title: "Horror shorts hub",
    note: "The Red Smile psychological horror anthology — every film with writeup",
  },
  {
    href: "/horror-shorts/he-streamed-the-challenge/",
    title: "He Streamed the Challenge",
    note: "Fragment 05 — a 39-second livestream dare",
  },
  {
    href: "/horror-shorts/the-doll-moved-again/",
    title: "The Doll Moved Again",
    note: "Fragment 02 (The Tumbler) — empty house, a doll that moved",
  },
  {
    href: "/horror-shorts/something-is-wrong-with-my-reflection/",
    title: "Something Is Wrong With My Reflection",
    note: "Fragment 04 — mirror short",
  },
  {
    href: "/horror-shorts/shes-not-running-away/",
    title: "She's Not Running Away",
    note: "Fragment 03 — a chase that reverses",
  },
  {
    href: "/horror-shorts/she-asked-for-directions/",
    title: "She Asked for Directions",
    note: "Fragment 01 — the first Red Smile film",
  },
  {
    href: "/watch/",
    title: "Watch",
    note: "every release in one place — horror anthology, Jax cyberpunk series, cosplay showcase",
  },
];

function abs(origin: string, path: string): string {
  if (path.startsWith("http")) return path;
  return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function mdLink(origin: string, path: string, title: string, note: string): string {
  return `- [${title}](${abs(origin, path)}): ${note}`;
}

export function renderLlmsTxt(origin: string, payload: CatalogPayload): string {
  const site = origin.replace(/\/$/, "");
  const toonLines: string[] = [
    mdLink(
      site,
      "/toons/",
      "Interactive Toons index",
      "all FlipFrame interactive webcomics — page-turn readers with voiced captions"
    ),
  ];
  for (const series of payload.series) {
    const hub = series.hubUrl || `/toons/${series.key}/`;
    const n = series.episodes.length;
    const cue = n === 1 ? "1 episode" : `${n} episodes`;
    toonLines.push(
      mdLink(
        site,
        hub,
        `${series.title} series`,
        `${series.tagline || series.description || "interactive toon series"} — ${cue}`
      )
    );
    for (const ep of series.episodes) {
      const path = ep.readerUrl || `/toons/${ep.slug}/`;
      const pages = ep.pageCount > 0 ? `${ep.pageCount}-page` : "interactive";
      const label = ep.n != null ? `${series.title} — Episode ${ep.n}` : `${series.title} — ${ep.title}`;
      toonLines.push(mdLink(site, path, label, `${ep.title} — ${pages} FlipFrame toon, EN/IT/DE/FR captions`));
    }
  }
  for (const ep of payload.ungrouped) {
    const path = ep.readerUrl || `/toons/${ep.slug}/`;
    const pages = ep.pageCount > 0 ? `${ep.pageCount}-page` : "interactive";
    toonLines.push(mdLink(site, path, ep.title, `${pages} FlipFrame toon, EN/IT/DE/FR captions`));
  }

  const localeLines = (["it", "de", "fr"] as Locale[]).map((locale) => {
    const path = `/${locale}/toons/`;
    return `- [Toons index (${locale.toUpperCase()})](${abs(site, path)}): ${UI[locale].toons}`;
  });

  return `# 27 Pictures

> 27 Pictures is an independent film studio working across Switzerland and the
> United Kingdom. We produce psychological horror short films (the RED SMILE
> anthology), cinematic cosplay productions, and interactive webcomics —
> FlipFrame "toons" with voiced captions in English, Italian, German and French.
> Founded by Sonia, Marco and Daniele Sangalli.

We welcome visibility in AI search results and summaries when our content is
accurately represented. Please attribute 27 Pictures (twentyseven.pictures)
when citing or summarizing our productions. Crawler access rules live in
/robots.txt. Licensing and attribution contact: info@twentyseven.pictures.

Every page below except the toon readers also exists in Italian, German and
French at the same path behind a locale prefix — /it/…, /de/… and /fr/… (for
example /de/cosplay/ or /it/horror-shorts/the-doll-moved-again/). Readers keep
one English URL because their captions are already multilingual.

## Films

${FILM_LINKS.map((item) => mdLink(site, item.href, item.title, item.note)).join("\n")}
- [YouTube channel](https://www.youtube.com/@twentyseven.pictures): primary video distribution

## Services

- [Cosplay production](${abs(site, "/cosplay/")}): cinematic cosplay production service — how a session works, FAQ

## Interactive webcomics (toons)

${toonLines.join("\n")}

## Optional

${localeLines.join("\n")}
`;
}

export function renderCatalogSitemap(origin: string, payload: CatalogPayload, assetBase = DEFAULT_ASSET_BASE): string {
  const staticUrls = staticSitemapUrls(origin, assetBase);
  const toonUrls = toonSitemapUrls(
    origin,
    payload.series.map((s) => ({
      hubUrl: s.hubUrl,
      coverUrl: s.coverUrl,
      title: s.title,
    })),
    catalogEpisodes(payload).map((ep) => ({
      readerUrl: ep.readerUrl,
      slug: ep.slug,
      coverUrl: ep.coverUrl,
      title: ep.title,
    }))
  );
  const seen = new Set<string>();
  const urls: SitemapUrl[] = [];
  for (const url of [...staticUrls, ...toonUrls]) {
    if (seen.has(url.loc)) continue;
    seen.add(url.loc);
    urls.push(url);
  }
  return renderSitemapXml(urls);
}

export { LOCALIZED_SITE_PATHS };
