/**
 * Stamp D1 into the shared hub / reader HTML templates.
 */
import { HUB_COPY, localizeHubCopy } from "./hubCopy";
import {
  APEX,
  absApex,
  assetDirForEpisode,
  cardDescription,
  cardTitle,
  catalogPath,
  episodeCardHtml,
  episodeNavFromCatalog,
  episodesHeading,
  esc,
  readerTokens,
  seriesJsonLd,
  type CatalogEpisode,
  type CatalogSeries,
} from "./catalogRender";
import { localeAlternates, localePath, splitLocale, UI, type Locale } from "./i18n";

export const HUB_TEMPLATE_PATH = "/toons/_hub/";
export const READER_TEMPLATE_PATH = "/toons/_reader/";

function replaceAttr(html: string, attr: string, value: string): string {
  const re = new RegExp(`(\\s${attr}=")[^"]*(")`);
  if (re.test(html)) return html.replace(re, `$1${esc(value)}$2`);
  return html.replace("<html", `<html ${attr}="${esc(value)}"`);
}

function replaceScript(html: string, attr: string, json: unknown, type = "application/ld+json"): string {
  const open = `<script type="${type}" ${attr}>`;
  const start = html.indexOf(open);
  if (start < 0) return html;
  const end = html.indexOf("</script>", start);
  if (end < 0) return html;
  return `${html.slice(0, start)}${open}\n${JSON.stringify(json, null, 2)}\n    </script>${html.slice(
    end + "</script>".length
  )}`;
}

function setMeta(html: string, attr: string, name: string, content: string): string {
  const re = new RegExp(`(<meta[^>]*${attr}="${name}"[^>]*content=")[^"]*(")`);
  if (re.test(html)) return html.replace(re, `$1${esc(content)}$2`);
  const re2 = new RegExp(`(<meta[^>]*content=")[^"]*("[^>]*${attr}="${name}")`);
  if (re2.test(html)) return html.replace(re2, `$1${esc(content)}$2`);
  return html;
}

function setCanonical(html: string, url: string): string {
  return html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${esc(url)}" />`);
}

function setTitle(html: string, title: string): string {
  return html.replace(/<title[^>]*>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
}

function hreflangBlock(pagePath: string): string {
  const links = localeAlternates(pagePath)
    .map((alt) => {
      const href = absApex(alt.path);
      const lang = alt.locale === "x-default" ? "x-default" : alt.locale;
      return `    <link rel="alternate" hreflang="${lang}" href="${href}" />`;
    })
    .join("\n");
  return `<!-- hreflang:start -->\n${links}\n    <!-- hreflang:end -->`;
}

function replaceHreflang(html: string, pagePath: string): string {
  if (html.includes("<!-- hreflang:start -->")) {
    return html.replace(/<!-- hreflang:start -->[\s\S]*?<!-- hreflang:end -->/, hreflangBlock(pagePath));
  }
  return html.replace("</head>", `    ${hreflangBlock(pagePath)}\n  </head>`);
}

export function hubMainHtml(series: CatalogSeries, locale: Locale): string {
  const copy = localizeHubCopy(HUB_COPY[locale], locale);
  const ui = UI[locale];
  const lead = cardDescription(series, locale);
  const heading = episodesHeading(series.episodes.length, locale);
  const cards = series.episodes.map((ep) => episodeCardHtml(ep, locale)).join("\n");
  const toonsHref = localePath("/toons/", locale);
  const homeHref = localePath("/", locale);
  return `<main class="page series-page" id="main-content" role="main">
      <nav aria-label="${esc(copy.footerNav)}" class="sr-only-seo">
        <a href="${esc(homeHref)}">${esc(ui.home)}</a>
        <span aria-hidden="true">/</span>
        <a href="${esc(toonsHref)}">${esc(ui.toons)}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">${esc(series.title)}</span>
      </nav>
      <div data-series-page>
        <header class="page-header series-header">
          <p class="section-tag">${esc(copy.sectionTag)}</p>
          <h1>${esc(series.title)}</h1>
          ${lead ? `<p class="lead">${esc(lead)}</p>` : ""}
        </header>
        <section class="series-section" aria-labelledby="episodes-title">
          <p class="series-section-label">${esc(copy.episodesLabel)}</p>
          <h2 id="episodes-title" class="series-body">${esc(heading)}</h2>
          <div class="episode-block">
            <div class="series-grid" data-series-episodes>
${cards}
            </div>
          </div>
        </section>
        <section class="series-section series-body is-divided" aria-labelledby="about-title">
          <p class="series-section-label">${esc(copy.howLabel)}</p>
          <h2 id="about-title">${esc(copy.howTitle)}</h2>
          <p>${copy.how1}</p>
          <p>${copy.how2}</p>
        </section>
      </div>
      <footer class="page-footer series-footer">
        <p>${esc(copy.footer)}</p>
        <nav class="page-footer-nav series-footer-nav" aria-label="${esc(copy.footerNav)}">
          <a href="${esc(toonsHref)}">${esc(copy.footerToons)}</a>
          <a href="${esc(localePath("/horror-shorts/", locale))}">${esc(copy.footerDarkroom)}</a>
          <a href="${esc(localePath("/watch/", locale))}">${esc(copy.footerWatch)}</a>
          <a href="${esc(localePath("/#contact", locale))}">${esc(copy.footerContact)}</a>
        </nav>
      </footer>
    </main>`;
}

export function applyHubHtml(html: string, series: CatalogSeries, requestUrl: string): string {
  const { locale, path } = splitLocale(new URL(requestUrl).pathname);
  const pagePath = catalogPath(path);
  const pageUrl = `${APEX}${localePath(pagePath, locale)}`;
  const lead = cardDescription(series, locale);
  const title = `${series.title} | 27 Pictures`;
  const desc = lead;
  const ep1 = series.episodes.find((e) => e.readerUrl);
  let out = html;
  out = replaceAttr(out, "lang", locale);
  out = replaceAttr(out, "data-series-key", series.key);
  if (ep1?.readerUrl) out = replaceAttr(out, "data-episode-one", ep1.readerUrl);
  out = setTitle(out, title);
  out = setCanonical(out, pageUrl);
  out = replaceHreflang(out, pagePath);
  out = setMeta(out, "name", "description", desc);
  out = setMeta(out, "property", "og:url", pageUrl);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", desc);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", desc);
  if (series.coverUrl) {
    out = setMeta(out, "property", "og:image", series.coverUrl);
    out = setMeta(out, "name", "twitter:image", series.coverUrl);
  }
  out = setMeta(out, "property", "og:locale", locale === "en" ? "en_US" : `${locale}_${locale.toUpperCase()}`);
  out = replaceScript(out, "data-series-jsonld", seriesJsonLd(series, { pageUrl, locale }));
  out = out.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, hubMainHtml(series, locale));
  return out;
}

export function readerJsonLd(
  ep: CatalogEpisode,
  series: CatalogSeries | undefined,
  opts: { pageUrl: string }
): { "@context": string; "@graph": Record<string, unknown>[] } {
  const page = opts.pageUrl.endsWith("/") ? opts.pageUrl : `${opts.pageUrl}/`;
  const name = series ? `${series.title}: ${cardTitle(ep, "en")}` : cardTitle(ep, "en");
  const desc = cardDescription(ep, "en");
  const work: Record<string, unknown> = {
    "@type": ["CreativeWork", "ComicStory"],
    "@id": `${page}#toon`,
    name,
    url: page,
    description: desc,
    inLanguage: ["en", "it", "de", "fr"],
    creator: { "@id": `${APEX}/#organization` },
    publisher: { "@id": `${APEX}/#organization` },
    isAccessibleForFree: true,
  };
  if (ep.pageCount > 0) work.numberOfPages = ep.pageCount;
  if (ep.coverUrl) work.image = { "@type": "ImageObject", url: ep.coverUrl };
  if (series?.hubUrl) {
    work.isPartOf = { "@id": `${absApex(series.hubUrl)}#series` };
    if (ep.n != null) work.position = ep.n;
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${page}#webpage`,
        url: page,
        name: `${name} — Interactive Toon | 27 Pictures`,
        description: desc,
        isPartOf: { "@id": `${APEX}/#website` },
        about: { "@id": `${page}#toon` },
        inLanguage: ["en", "it", "de", "fr"],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${page}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${APEX}/` },
          { "@type": "ListItem", position: 2, name: "Interactive Toons", item: `${APEX}/toons/` },
          ...(series?.hubUrl
            ? [{ "@type": "ListItem", position: 3, name: series.title, item: absApex(series.hubUrl) }]
            : []),
          {
            "@type": "ListItem",
            position: series?.hubUrl ? 4 : 3,
            name,
            item: page,
          },
        ],
      },
      work,
    ],
  };
}

export function readerFallbackHtml(ep: CatalogEpisode, series: CatalogSeries | undefined): string {
  const title = series ? `${series.title}: ${cardTitle(ep, "en")}` : cardTitle(ep, "en");
  const desc = cardDescription(ep, "en");
  const pages = ep.pageCount > 0 ? `${ep.pageCount} pages` : "interactive toon";
  const sub = series && ep.n != null ? `Episode ${ep.n} of ${esc(series.title)}` : "Interactive toon";
  const sibs = series?.episodes.filter((s) => s.slug !== ep.slug && s.readerUrl) ?? [];
  const sib =
    sibs.length > 0
      ? `<p>${sibs
          .map((s) => {
            const label = s.n != null ? `Episode ${s.n}, ${cardTitle(s, "en")}` : cardTitle(s, "en");
            return `<a href="${esc(s.readerUrl || `/toons/${s.slug}/`)}">${esc(label)}</a>`;
          })
          .join(" · ")}</p>`
      : "";
  const hub = series?.hubUrl ? `<a href="${esc(series.hubUrl)}">${esc(series.title)} series</a> · ` : "";
  return `<article class="reader-fallback">
        <p class="reader-fallback-tag">Interactive toon · ${esc(pages)} · English, Italian, German, French</p>
        <h1>${esc(title)}</h1>
        <p class="reader-fallback-sub">${sub}</p>
        <p>${esc(desc)}</p>
        ${sib}
        <p>
          This is a FlipFrame reader: full-screen plates you turn like a book, with captions that read themselves aloud
          in English, Italian, German, French. It needs JavaScript — the pages and audio stream from our CDN as you
          read.
        </p>
        <p>
          ${hub}<a href="/toons/">All interactive toons</a> ·
          <a href="/horror-shorts/">Horror shorts</a> ·
          <a href="/#contact">Commission one</a>
        </p>
      </article>`;
}

export function applyReaderHtml(
  html: string,
  ep: CatalogEpisode,
  series: CatalogSeries | undefined,
  requestUrl: string
): string {
  const pageUrl = `${APEX}${catalogPath(new URL(requestUrl).pathname)}`;
  const name = series ? `${series.title}: ${cardTitle(ep, "en")}` : cardTitle(ep, "en");
  const title = `${name} — Interactive Toon | 27 Pictures`;
  const desc = cardDescription(ep, "en");
  const tokens = readerTokens(ep);
  const dir = assetDirForEpisode(ep);
  let out = html;
  out = replaceAttr(out, "data-toon-slug", ep.slug);
  out = replaceAttr(out, "data-asset-page-dir", dir);
  out = replaceAttr(out, "data-paper", tokens.paper);
  out = out.replace(
    /style="--plate-w:[^"]*"/,
    `style="--plate-w: ${tokens.width}; --plate-h: ${tokens.height}; --spread-aspect: ${tokens.spread}; --strip-cap: ${tokens.stripCap}"`
  );
  out = setTitle(out, title);
  out = setCanonical(out, pageUrl);
  out = setMeta(out, "name", "description", desc);
  out = setMeta(out, "name", "robots", "index, follow, max-image-preview:large, max-snippet:-1");
  out = setMeta(out, "property", "og:url", pageUrl);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", desc);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", desc);
  if (ep.coverUrl) {
    out = setMeta(out, "property", "og:image", ep.coverUrl);
    out = setMeta(out, "name", "twitter:image", ep.coverUrl);
  }
  out = replaceScript(out, "data-toon-jsonld", readerJsonLd(ep, series, { pageUrl }));
  const nav = episodeNavFromCatalog(series, ep.slug);
  out = replaceScript(out, "data-episode-nav", nav, "application/json");
  const fallback = readerFallbackHtml(ep, series);
  out = out.replace(/<article class="reader-fallback">[\s\S]*?<\/article>/, fallback);
  return out;
}
