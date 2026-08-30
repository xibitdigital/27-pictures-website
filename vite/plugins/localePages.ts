/**
 * Build-time locale pages for translated **site** HTML (homepage, films,
 * `/toons/` catalog, …). Series hubs are not generated here — they are SSR
 * from D1 (`/de/toons/jax/`). Readers stay English + `?lang=`.
 *
 * English `src/<path>/index.html` is the template.
 * `src/site/locales/<name>/<locale>.json` holds the other languages.
 * This plugin writes `src/<locale>/…/index.html` so Vite's MPA build, the
 * CDN token expander and hashed CSS all see a real HTML entry — Google gets
 * unique crawlable HTML at `/it/toons/` etc., without four hand-maintained
 * copies of the same markup.
 *
 * Generated files are gitignored. Do not edit them.
 */

import fs from "node:fs";
import path from "node:path";
import { has, set } from "lodash-es";
import type { Plugin } from "vite";
import { isToonSeriesHubPath } from "../../src/site/i18n";

export const ORIGIN = "https://twentyseven.pictures";
export const DEFAULT_LOCALE = "en";
export const PAGE_LOCALES = ["de", "it", "fr"] as const;
export type PageLocale = (typeof PAGE_LOCALES)[number];

const OG_LOCALE: Record<PageLocale, string> = {
  de: "de_DE",
  it: "it_IT",
  fr: "fr_FR",
};

export interface LocalePageSpec {
  /** Path under src/, e.g. "toons/index.html". */
  template: string;
  /** Directory under src/ that holds <locale>.json files. */
  copyDir: string;
  /** Public URL path of the English page, e.g. "/toons/". */
  urlPath: string;
  /**
   * Fragments of the only `@id`s that may be localized. Needed for the
   * homepage, whose urlPath is the origin root: without it the Organization,
   * WebSite and Person nodes — which every other page references by their
   * canonical `@id` — would be rewritten to `/de/#organization` and the graph
   * would fall apart. Omit on child pages, where the global nodes' `@id`s do
   * not start with the page's own URL and are left alone anyway.
   */
  localizeIds?: string[];
}

/** The five Red Smile film pages — same markup, one copy dir each. */
export const FILM_SLUGS = [
  "the-doll-moved-again",
  "shes-not-running-away",
  "she-asked-for-directions",
  "something-is-wrong-with-my-reflection",
  "he-streamed-the-challenge",
] as const;

export const LOCALE_PAGES: LocalePageSpec[] = [
  {
    template: "index.html",
    copyDir: "site/locales/home",
    urlPath: "/",
    localizeIds: ["#webpage"],
  },
  {
    template: "watch/index.html",
    copyDir: "site/locales/watch",
    urlPath: "/watch/",
  },
  {
    template: "cosplay/index.html",
    copyDir: "site/locales/cosplay",
    urlPath: "/cosplay/",
  },
  {
    template: "horror-shorts/index.html",
    copyDir: "site/locales/horror-shorts",
    urlPath: "/horror-shorts/",
  },
  ...FILM_SLUGS.map((slug) => ({
    template: `horror-shorts/${slug}/index.html`,
    copyDir: `site/locales/horror-shorts-${slug}`,
    urlPath: `/horror-shorts/${slug}/`,
  })),
  {
    template: "toons/index.html",
    copyDir: "site/locales/toons-index",
    urlPath: "/toons/",
  },
];

/** Site pages with generated locale HTML — prefix the path, do not add `?lang=`. */
export const LOCALIZED_PAGE_HREFS = LOCALE_PAGES.map((page) => page.urlPath);

function isPrefixedSitePath(norm: string): boolean {
  return (LOCALIZED_PAGE_HREFS as readonly string[]).includes(norm) || isToonSeriesHubPath(norm);
}

/** Flat keys are the legacy per-type copy; `nodes` is the generic form. */
export interface LocaleSchema {
  [key: string]: string | Record<string, Record<string, string>> | undefined;
  nodes?: Record<string, Record<string, string>>;
}

export interface LocaleCopy {
  [key: string]: string | LocaleSchema | undefined;
  schema?: LocaleSchema;
}

export function localeUrl(urlPath: string, locale: string): string {
  return locale === DEFAULT_LOCALE ? urlPath : `/${locale}${urlPath}`;
}

export function hreflangBlock(urlPath: string, indent = "    "): string {
  const locales = [DEFAULT_LOCALE, ...PAGE_LOCALES];
  const lines = locales.map(
    (l) => `${indent}<link rel="alternate" hreflang="${l}" href="${ORIGIN}${localeUrl(urlPath, l)}" />`
  );
  lines.push(`${indent}<link rel="alternate" hreflang="x-default" href="${ORIGIN}${urlPath}" />`);
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

/** Replace the inner HTML of every element that carries `attr="key"`. */
function replaceTagged(html: string, attr: string, apply: (key: string, inner: string) => string | undefined): string {
  // Allow Prettier's `</span\\n              >` closers — a strict `</span>`
  // swallows every following card until it finds a same-tag closer on one line.
  const re = new RegExp(`(<([a-zA-Z][\\w:-]*)\\b[^>]*\\s${attr}="([^"]+)"[^>]*>)([\\s\\S]*?)(<\\/\\s*\\2\\s*>)`, "g");
  return html.replace(re, (all, open, _tag, key, inner, close) => {
    const next = apply(key, inner);
    return next === undefined ? all : `${open}${next}${close}`;
  });
}

/** Set `targetAttr` on any tag that also has `dataAttr="key"`. */
function replaceAttr(html: string, dataAttr: string, targetAttr: string, copy: Record<string, string>): string {
  return html.replace(/<[^>]+>/g, (tag) => {
    const key = tag.match(new RegExp(`\\s${dataAttr}="([^"]+)"`))?.[1];
    if (!key || copy[key] == null) return tag;
    const value = escapeAttr(copy[key]);
    // Require a leading space so `content` does not match inside `data-i18n-content`.
    if (!new RegExp(`\\s${targetAttr}="`).test(tag)) return tag;
    return tag.replace(new RegExp(`(\\s${targetAttr}=")[^"]*(")`), `$1${value}$2`);
  });
}

function stripI18nAttrs(html: string): string {
  return html.replace(/\s+data-i18n(?:-[a-z]+)*="[^"]*"/g, "");
}

function stringsOf(copy: LocaleCopy): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

type JsonLd = Record<string, unknown>;

/**
 * A URL inside the graph, moved to this locale when — and only when — it names
 * a page that has a translated document:
 *
 * - this page itself, with or without a fragment (`localizeIds` narrows which
 *   fragments count, for the homepage: `#webpage` is the page, `#organization`
 *   is not);
 * - another localized page, so `/de/horror-shorts/` lists the German film pages
 *   and its `hasPart` still resolves to the nodes those pages declare;
 * - never a reader URL, an asset, or an entity hanging off the origin root —
 *   `#organization`, `#website` and the founders are one entity per site, and
 *   every page references them by that one `@id`.
 */
export function localizePageUrl(value: string, urlPath: string, locale: PageLocale, localizeIds?: string[]): string {
  if (!value.startsWith(ORIGIN)) return value;
  const rest = value.slice(ORIGIN.length);
  const hash = rest.indexOf("#");
  const pathname = hash === -1 ? rest : rest.slice(0, hash);
  const fragment = hash === -1 ? "" : rest.slice(hash);
  const norm = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (!isPrefixedSitePath(norm)) return value;
  if (fragment) {
    if (norm === urlPath) {
      if (localizeIds && !localizeIds.includes(fragment)) return value;
    } else if (norm === "/") {
      return value;
    }
  }
  return `${ORIGIN}/${locale}${pathname}${fragment}`;
}

function walkPageUrls(node: unknown, urlPath: string, locale: PageLocale, localizeIds?: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) walkPageUrls(item, urlPath, locale, localizeIds);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as JsonLd;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && (key === "@id" || key === "url" || key === "item")) {
      obj[key] = localizePageUrl(value, urlPath, locale, localizeIds);
    } else {
      walkPageUrls(value, urlPath, locale, localizeIds);
    }
  }
}

/**
 * Generic schema copy: `schema.nodes` keys a graph node by its `@id` fragment
 * and gives dotted paths inside it. Every schema type a page uses — Service,
 * FAQPage, VideoObject, Person — is reachable this way, so a new page needs
 * copy, not another branch in this file.
 */
function applyNodeOverrides(graph: JsonLd[], nodes: Record<string, Record<string, string>> | undefined): void {
  if (!nodes) return;
  for (const node of graph) {
    const id = typeof node["@id"] === "string" ? node["@id"] : "";
    const hash = id.indexOf("#");
    const patch = hash === -1 ? undefined : nodes[id.slice(hash)];
    if (!patch) continue;
    // `has` first: a copy key that no longer matches the schema must not invent
    // a property — lodash `set` would happily create the whole path.
    for (const [dotted, value] of Object.entries(patch)) if (has(node, dotted)) set(node, dotted, value);
  }
}

function applySchema(
  html: string,
  locale: PageLocale,
  urlPath: string,
  schema: LocaleSchema | undefined,
  localizeIds?: string[]
): string {
  return html.replace(
    /<script type="application\/ld\+json"([^>]*)>([\s\S]*?)<\/script>/,
    (_all, attrs: string, raw: string) => {
      const data = JSON.parse(raw) as { "@graph"?: JsonLd[] };
      const graph = data["@graph"] ?? [];
      if (localizeIds) {
        for (const node of graph) {
          const id = typeof node["@id"] === "string" ? node["@id"] : "";
          const hash = id.indexOf("#");
          if (hash !== -1 && localizeIds.includes(id.slice(hash))) walkPageUrls(node, urlPath, locale, localizeIds);
        }
      } else {
        walkPageUrls(data, urlPath, locale);
      }
      applyNodeOverrides(graph, schema?.nodes);
      for (const node of graph) {
        // "@type" may be a string or an array (e.g. ["CreativeWorkSeries", "ComicSeries"]).
        const rawType = node["@type"];
        const hasType = (t: string) => (Array.isArray(rawType) ? rawType.includes(t) : rawType === t);
        if (hasType("CollectionPage") || hasType("WebPage")) {
          if (schema?.name) node.name = schema.name;
          if (schema?.headline) node.headline = schema.headline;
          if (schema?.description) node.description = schema.description;
          node.inLanguage = locale;
          const image = node.primaryImageOfPage as JsonLd | undefined;
          if (image && schema?.imageCaption) image.caption = schema.imageCaption;
        }
        if (hasType("BreadcrumbList")) {
          const items = (node.itemListElement as JsonLd[] | undefined) ?? [];
          if (items[0] && schema?.breadcrumbHome) items[0].name = schema.breadcrumbHome;
          if (items.length === 2 && items[1] && schema?.breadcrumbHere) items[1].name = schema.breadcrumbHere;
          if (items.length >= 3) {
            if (items[1] && schema?.breadcrumbToons) items[1].name = schema.breadcrumbToons;
            const last = items[items.length - 1];
            if (last && schema?.breadcrumbHere) last.name = schema.breadcrumbHere;
          }
        }
        if (hasType("CreativeWorkSeries")) {
          if (schema?.seriesDescription) node.description = schema.seriesDescription;
          const parts = node.hasPart as JsonLd[] | undefined;
          if (parts?.[0] && schema?.ep1Name) parts[0].name = schema.ep1Name;
          if (parts?.[1] && schema?.ep2Name) parts[1].name = schema.ep2Name;
        }
        if (hasType("ItemList")) {
          if (schema?.itemListName) node.name = schema.itemListName;
          for (const li of (node.itemListElement as JsonLd[] | undefined) ?? []) {
            const item = li.item as JsonLd | undefined;
            const id = typeof item?.["@id"] === "string" ? item["@id"] : "";
            if (id.includes("/jax/") && schema?.jaxDescription) item!.description = schema.jaxDescription;
            if (id.includes("/nero/") && schema?.neroDescription) item!.description = schema.neroDescription;
            if (id.includes("/redsmile/") && schema?.redsmileDescription)
              item!.description = schema.redsmileDescription;
          }
        }
      }
      const pretty = JSON.stringify(data, null, 2)
        .split("\n")
        .map((line, i) => (i === 0 ? line : `      ${line}`))
        .join("\n");
      return `<script type="application/ld+json"${attrs}>\n      ${pretty}\n    </script>`;
    }
  );
}

/** Localized site pages get a prefix; readers get `?lang=` so captions start right. */
export function localizeHrefs(html: string, locale: PageLocale): string {
  return html.replace(/href="(\/[^"]*)"/g, (full, path: string) => {
    const q = path.search(/[?#]/);
    const pathname = q === -1 ? path : path.slice(0, q);
    const rest = q === -1 ? "" : path.slice(q);
    const norm = pathname.endsWith("/") ? pathname : `${pathname}/`;
    if (isPrefixedSitePath(norm)) {
      return `href="/${locale}${pathname}${rest}"`;
    }
    // Everything else that is not a reader — stylesheets, images, the QR page —
    // has one URL in every locale.
    if (!pathname.startsWith("/toons/")) return full;
    if (/[?&]lang=/.test(path)) return full;
    const sep = path.includes("?") ? "&" : "?";
    return `href="${path}${sep}lang=${locale}"`;
  });
}

function rewriteHeadUrls(html: string, urlPath: string, locale: PageLocale): string {
  const to = `${ORIGIN}${localeUrl(urlPath, locale)}`;
  const escaped = `${ORIGIN}${urlPath}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  html = html.replace(new RegExp(`(<link rel="canonical" href=")${escaped}(")`), `$1${to}$2`);
  html = html.replace(new RegExp(`(<meta property="og:url" content=")${escaped}(")`), `$1${to}$2`);
  return html;
}

export function renderLocalePage(
  template: string,
  locale: PageLocale,
  copy: LocaleCopy,
  urlPath: string,
  localizeIds?: string[]
): string {
  const strings = stringsOf(copy);
  let html = template;

  // Rewrite the lang attribute in place rather than the whole tag: <html> also
  // carries data-* the page needs (data-series-key drives the deep-link
  // forward), and replacing the tag wholesale silently dropped them — the
  // Italian Nero page shipped lang="en".
  html = html.replace(/<html\b[^>]*>/, (tag) =>
    /\blang="/.test(tag)
      ? tag.replace(/\blang="[^"]*"/, `lang="${locale}"`)
      : tag.replace(/^<html\b/, `<html lang="${locale}"`)
  );
  html = html.replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${OG_LOCALE[locale]}$2`);
  html = rewriteHeadUrls(html, urlPath, locale);

  html = replaceTagged(html, "data-i18n", (key) => (strings[key] != null ? escapeHtml(strings[key]) : undefined));
  html = replaceTagged(html, "data-i18n-html", (key) => (strings[key] != null ? strings[key] : undefined));
  html = replaceAttr(html, "data-i18n-content", "content", strings);
  html = replaceAttr(html, "data-i18n-alt", "alt", strings);
  html = replaceAttr(html, "data-i18n-aria-label", "aria-label", strings);

  html = applySchema(html, locale, urlPath, copy.schema, localizeIds);
  html = localizeHrefs(html, locale);
  html = stripI18nAttrs(html);

  const banner = `<!-- generated from the English template + src/site/locales — do not edit -->\n`;
  if (!html.startsWith(banner) && html.startsWith("<!doctype html>")) {
    html = html.replace("<!doctype html>\n", `<!doctype html>\n${banner}`);
  }

  return html.endsWith("\n") ? html : `${html}\n`;
}

export function generateLocalePages(srcDir: string): string[] {
  const written: string[] = [];
  for (const page of LOCALE_PAGES) {
    const templatePath = path.join(srcDir, page.template);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`locale template missing: ${templatePath}`);
    }
    const template = fs.readFileSync(templatePath, "utf8");
    for (const locale of PAGE_LOCALES) {
      const copyPath = path.join(srcDir, page.copyDir, `${locale}.json`);
      if (!fs.existsSync(copyPath)) {
        throw new Error(`locale copy missing: ${copyPath}`);
      }
      const copy = JSON.parse(fs.readFileSync(copyPath, "utf8")) as LocaleCopy;
      const out = renderLocalePage(template, locale, copy, page.urlPath, page.localizeIds);
      const dest = path.join(srcDir, locale, page.template);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, out);
      written.push(dest);
    }
  }
  return written;
}

function isLocaleSource(file: string, srcDir: string): boolean {
  const rel = path.relative(srcDir, file).split(path.sep).join("/");
  return LOCALE_PAGES.some((page) => rel === page.template || rel.startsWith(`${page.copyDir}/`));
}

export function localePagesPlugin(srcDir: string): Plugin {
  return {
    name: "locale-pages",
    configureServer(server) {
      const watched = LOCALE_PAGES.flatMap((page) => [
        path.join(srcDir, page.template),
        path.join(srcDir, page.copyDir),
      ]);
      server.watcher.add(watched);
      server.watcher.on("change", (file) => {
        if (!isLocaleSource(file, srcDir)) return;
        generateLocalePages(srcDir);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
