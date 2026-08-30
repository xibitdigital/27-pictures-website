/**
 * Sitemap XML: static site pages + D1 series hubs and published (or staging)
 * readers. Drafts and /toons/editor/ never appear.
 */

export const SITEMAP_LOCALES = ["en", "it", "de", "fr"] as const;
export const DEFAULT_SITE_ORIGIN = "https://twentyseven.pictures";

/**
 * English paths for **site pages** that have a real `/de|/it|/fr` cluster.
 * The sitemap emits all four locales for each entry.
 *
 * Put a path here when you add a translated HTML page that is **not** a toon
 * series hub or a reader:
 *
 * 1. `src/<path>/index.html` + `LOCALE_PAGES` (`vite/plugins/localePages.ts`)
 *    + `LOCALIZED_PATHS` (`src/site/i18n.ts`) — those write the HTML and drive
 *    the language switcher.
 * 2. This list — so crawlers see en/it/de/fr in `/sitemap.xml`.
 * 3. Optional: an `images` entry in `staticSitemapUrls()` for OG/card art.
 *
 * Do **not** add:
 * - Series hubs (`/toons/jax/`, `/toons/redsmile/`, …) — D1 `series.hub_url`
 *   plus at least one visible episode.
 * - Readers (`/toons/redsmile/static/`, `/toons/nero/the-dog/`, …) — D1
 *   `reader_url` when the toon is Public (or Staging on a staging host).
 *   English only.
 * - `/toons/editor/` — robots Disallow, never in the sitemap.
 *
 * Trailing slash required. Keep this list a subset of `LOCALIZED_PATHS`
 * (hubs are D1 + `isToonSeriesHubPath`, not this list). A **Pages** deploy
 * picks the list up (`src/site/crawlerDocs.ts`). Redeploy this Worker only
 * if you still curl `GET /sitemap.xml` on the Worker host.
 */
export const LOCALIZED_SITE_PATHS = [
  "/",
  "/watch/",
  "/cosplay/",
  "/horror-shorts/",
  "/horror-shorts/the-doll-moved-again/",
  "/horror-shorts/shes-not-running-away/",
  "/horror-shorts/she-asked-for-directions/",
  "/horror-shorts/something-is-wrong-with-my-reflection/",
  "/horror-shorts/he-streamed-the-challenge/",
  "/toons/",
] as const;

export type SitemapImage = { loc: string; title: string; caption: string };
export type SitemapUrl = { loc: string; lastmod?: string; images?: SitemapImage[] };

export function siteOriginFromRequest(request: { url: string }): string {
  try {
    const site = new URL(request.url).searchParams.get("site") || "";
    if (site) return new URL(site).origin.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  return DEFAULT_SITE_ORIGIN;
}

export function localePath(path: string, locale: string): string {
  if (locale === "en") return path;
  if (path === "/") return `/${locale}/`;
  return `/${locale}${path}`;
}

export function lastmodDay(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const day = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderSitemapXml(urls: SitemapUrl[]): string {
  const body = urls
    .map((url) => {
      const imageXml = (url.images || [])
        .map(
          (img) => `    <image:image>
      <image:loc>${esc(img.loc)}</image:loc>
      <image:title>${esc(img.title)}</image:title>
      <image:caption>${esc(img.caption)}</image:caption>
    </image:image>`
        )
        .join("\n");
      const lastmod = url.lastmod ? `\n    <lastmod>${esc(url.lastmod)}</lastmod>` : "";
      return `  <url>
    <loc>${esc(url.loc)}</loc>${lastmod}${imageXml ? `\n${imageXml}` : ""}
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`;
}

export function staticSitemapUrls(origin: string, assetBase: string): SitemapUrl[] {
  const site = origin.replace(/\/$/, "");
  const cdn = assetBase.replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);
  const homeImg: SitemapImage[] = [
    {
      loc: `${site}/the-red-smile.jpg`,
      title: "The Red Smile - Psychological Horror Short Film by 27 Pictures",
      caption: "Cinematic clown portrait from The Red Smile horror series",
    },
    {
      loc: `${site}/logo.1a83b92ec2.png`,
      title: "27 Pictures Logo",
      caption: "27 Pictures - Horror Film Production Studio",
    },
  ];
  const images: Record<string, SitemapImage> = {
    "/horror-shorts/": {
      loc: `${cdn}/card-art/horror-shorts-og.jpg`,
      title: "The Red Smile horror short anthology — 27 Pictures",
      caption: "Psychological horror shorts by 27 Pictures",
    },
    "/horror-shorts/he-streamed-the-challenge/": {
      loc: "https://i.ytimg.com/vi/QMRlBqAdNGg/hq720.jpg",
      title: "He Streamed the Challenge. The Monster Streamed Back.",
      caption: "Red Smile fragment 05",
    },
    "/horror-shorts/the-doll-moved-again/": {
      loc: "https://i.ytimg.com/vi/J-iZl-XkVxg/hq720.jpg",
      title: "The Doll Moved Again. No One Was Home.",
      caption: "Red Smile fragment 02",
    },
    "/horror-shorts/something-is-wrong-with-my-reflection/": {
      loc: "https://i.ytimg.com/vi/VEmf9eq62zo/hq720.jpg",
      title: "Something Is Wrong With My Reflection",
      caption: "Red Smile fragment 04",
    },
    "/horror-shorts/shes-not-running-away/": {
      loc: "https://i.ytimg.com/vi/qjBL4zRIFbg/hq720.jpg",
      title: "She's Not Running Away. She's Hunting.",
      caption: "Red Smile fragment 03",
    },
    "/horror-shorts/she-asked-for-directions/": {
      loc: "https://i.ytimg.com/vi/BOtFWCENtTc/hq720.jpg",
      title: "She Asked for Directions. She Should've Run.",
      caption: "Red Smile fragment 01",
    },
    "/cosplay/": {
      loc: `${cdn}/card-art/cosplay-og.jpg`,
      title: "Cinematic cosplay production — 27 Pictures",
      caption: "Cosplay produced as short-form cinema by 27 Pictures",
    },
    "/watch/": {
      loc: `${cdn}/card-art/horror-shorts-og.jpg`,
      title: "Watch — every 27 Pictures release",
      caption: "Horror shorts, the Jax cyberpunk series and the cosplay showcase",
    },
    "/toons/": {
      loc: `${cdn}/card-art/erin-dark.jpg`,
      title: "Interactive Toons — 27 Pictures",
      caption: "FlipFrame interactive webcomics by 27 Pictures",
    },
  };

  const urls: SitemapUrl[] = [];
  for (const path of LOCALIZED_SITE_PATHS) {
    const img = path === "/" ? homeImg : images[path] ? [images[path]] : undefined;
    for (const locale of SITEMAP_LOCALES) {
      urls.push({ loc: `${site}${localePath(path, locale)}`, lastmod: today, images: img });
    }
  }
  return urls;
}

export function toonSitemapUrls(
  origin: string,
  series: { hubUrl: string | null; coverUrl: string | null; title: string; updatedAt?: string | null }[],
  toons: {
    readerUrl: string | null;
    slug: string;
    coverUrl: string | null;
    title: string;
    updatedAt?: string | null;
    status?: string | null;
  }[]
): SitemapUrl[] {
  const site = origin.replace(/\/$/, "");
  const urls: SitemapUrl[] = [];
  const seen = new Set<string>();

  const add = (path: string, lastmod: string | undefined, image?: SitemapImage) => {
    const loc = path.startsWith("http") ? path : `${site}${path.startsWith("/") ? path : `/${path}`}`;
    if (seen.has(loc) || loc.includes("/toons/editor")) return;
    seen.add(loc);
    urls.push({ loc, lastmod, images: image ? [image] : undefined });
  };

  for (const row of series) {
    const hub = row.hubUrl || "";
    if (!hub.startsWith("/toons/") || hub === "/toons/") continue;
    const image: SitemapImage | undefined = row.coverUrl
      ? { loc: row.coverUrl, title: row.title, caption: row.title }
      : undefined;
    for (const locale of SITEMAP_LOCALES) {
      add(localePath(hub, locale), lastmodDay(row.updatedAt), image);
    }
  }

  for (const row of toons) {
    if (row.status === "draft") continue;
    const path = row.readerUrl || `/toons/${row.slug}/`;
    if (!path.startsWith("/toons/") || path === "/toons/") continue;
    const image: SitemapImage | undefined = row.coverUrl
      ? { loc: row.coverUrl, title: row.title, caption: row.title }
      : undefined;
    add(path, lastmodDay(row.updatedAt), image);
  }

  return urls;
}
