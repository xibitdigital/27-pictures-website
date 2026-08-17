/**
 * Build-time locale pages for translated hub HTML.
 *
 * English `src/toons/index.html` (and the Erin series page) is the template.
 * `src/site/locales/<name>/<locale>.json` holds the other languages.
 * This plugin writes `src/<locale>/toons/index.html` so Vite's MPA build, the
 * CDN token expander and hashed CSS all see a real HTML entry — Google gets
 * unique crawlable HTML at `/it/toons/` etc., without four hand-maintained
 * copies of the same markup.
 *
 * Generated files are gitignored. Do not edit them.
 */

import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

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
}

export const LOCALE_PAGES: LocalePageSpec[] = [
  {
    template: "toons/index.html",
    copyDir: "site/locales/toons-index",
    urlPath: "/toons/",
  },
  {
    template: "toons/erin-and-the-goblins/index.html",
    copyDir: "site/locales/erin-and-the-goblins",
    urlPath: "/toons/erin-and-the-goblins/",
  },
];

/** Site pages that exist in every locale — prefix the path, do not add ?lang=. */
export const LOCALIZED_PAGE_HREFS = ["/toons/", "/toons/erin-and-the-goblins/"] as const;

export interface LocaleCopy {
  [key: string]: string | Record<string, string> | undefined;
  schema?: Record<string, string>;
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

/** The landing page's own URL, or that URL plus a fragment — never a child path. */
export function localizePageUrl(value: string, urlPath: string, locale: PageLocale): string {
  const from = `${ORIGIN}${urlPath}`;
  const to = `${ORIGIN}${localeUrl(urlPath, locale)}`;
  if (value === from) return to;
  if (value.startsWith(`${from}#`)) return `${to}${value.slice(from.length)}`;
  return value;
}

function walkPageUrls(node: unknown, urlPath: string, locale: PageLocale): void {
  if (Array.isArray(node)) {
    for (const item of node) walkPageUrls(item, urlPath, locale);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as JsonLd;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && (key === "@id" || key === "url" || key === "item")) {
      obj[key] = localizePageUrl(value, urlPath, locale);
    } else {
      walkPageUrls(value, urlPath, locale);
    }
  }
}

function applySchema(
  html: string,
  locale: PageLocale,
  urlPath: string,
  schema: Record<string, string> | undefined
): string {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_all, raw: string) => {
    const data = JSON.parse(raw) as { "@graph"?: JsonLd[] };
    walkPageUrls(data, urlPath, locale);
    for (const node of data["@graph"] ?? []) {
      const type = node["@type"];
      if (type === "CollectionPage" || type === "WebPage") {
        if (schema?.name) node.name = schema.name;
        if (schema?.headline) node.headline = schema.headline;
        if (schema?.description) node.description = schema.description;
        node.inLanguage = locale;
        const image = node.primaryImageOfPage as JsonLd | undefined;
        if (image && schema?.imageCaption) image.caption = schema.imageCaption;
      }
      if (type === "BreadcrumbList") {
        const items = (node.itemListElement as JsonLd[] | undefined) ?? [];
        if (items[0] && schema?.breadcrumbHome) items[0].name = schema.breadcrumbHome;
        if (items.length === 2 && items[1] && schema?.breadcrumbHere) items[1].name = schema.breadcrumbHere;
        if (items.length >= 3) {
          if (items[1] && schema?.breadcrumbToons) items[1].name = schema.breadcrumbToons;
          const last = items[items.length - 1];
          if (last && schema?.breadcrumbHere) last.name = schema.breadcrumbHere;
        }
      }
      if (type === "CreativeWorkSeries") {
        if (schema?.erinDescription) node.description = schema.erinDescription;
        if (schema?.seriesDescription) node.description = schema.seriesDescription;
        const parts = node.hasPart as JsonLd[] | undefined;
        if (parts?.[0]) {
          if (schema?.erinEp1Name) parts[0].name = schema.erinEp1Name;
          if (schema?.ep1Name) parts[0].name = schema.ep1Name;
          if (schema?.erinEp1Description) parts[0].description = schema.erinEp1Description;
        }
        if (parts?.[1] && schema?.ep2Name) parts[1].name = schema.ep2Name;
      }
      if (type === "ItemList") {
        if (schema?.itemListName) node.name = schema.itemListName;
        for (const li of (node.itemListElement as JsonLd[] | undefined) ?? []) {
          const item = li.item as JsonLd | undefined;
          const id = typeof item?.["@id"] === "string" ? item["@id"] : "";
          if (id.includes("/jax/") && schema?.jaxDescription) item!.description = schema.jaxDescription;
          if (id.includes("/nero/") && schema?.neroDescription) item!.description = schema.neroDescription;
          if (id.includes("/redsmile") && schema?.redsmileDescription) item!.description = schema.redsmileDescription;
        }
      }
    }
    const pretty = JSON.stringify(data, null, 2)
      .split("\n")
      .map((line, i) => (i === 0 ? line : `      ${line}`))
      .join("\n");
    return `<script type="application/ld+json">\n      ${pretty}\n    </script>`;
  });
}

/** Localized hub pages get a prefix; readers get `?lang=` so captions start right. */
export function addLangToToonHrefs(html: string, locale: PageLocale): string {
  return html.replace(/href="(\/toons\/[^"]*)"/g, (full, path: string) => {
    const q = path.search(/[?#]/);
    const pathname = q === -1 ? path : path.slice(0, q);
    const rest = q === -1 ? "" : path.slice(q);
    const norm = pathname.endsWith("/") ? pathname : `${pathname}/`;
    if ((LOCALIZED_PAGE_HREFS as readonly string[]).includes(norm)) {
      return `href="/${locale}${pathname}${rest}"`;
    }
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

export function renderLocalePage(template: string, locale: PageLocale, copy: LocaleCopy, urlPath: string): string {
  const strings = stringsOf(copy);
  let html = template;

  html = html.replace(/<html lang="[^"]*">/, `<html lang="${locale}">`);
  html = html.replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${OG_LOCALE[locale]}$2`);
  html = rewriteHeadUrls(html, urlPath, locale);

  html = replaceTagged(html, "data-i18n", (key) => (strings[key] != null ? escapeHtml(strings[key]) : undefined));
  html = replaceTagged(html, "data-i18n-html", (key) => (strings[key] != null ? strings[key] : undefined));
  html = replaceAttr(html, "data-i18n-content", "content", strings);
  html = replaceAttr(html, "data-i18n-alt", "alt", strings);
  html = replaceAttr(html, "data-i18n-aria-label", "aria-label", strings);

  html = applySchema(html, locale, urlPath, copy.schema);
  html = addLangToToonHrefs(html, locale);
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
      const out = renderLocalePage(template, locale, copy, page.urlPath);
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
