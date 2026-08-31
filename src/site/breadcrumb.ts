/**
 * One toon trail for SSR HTML and BreadcrumbList JSON-LD.
 * Catalog templates keep tagged markup; hubs/readers stamp this string.
 */
import { localePath, UI, type Locale } from "./i18n";

export type BreadcrumbItem = { href?: string; name: string };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toonTrail(opts: {
  locale: Locale;
  series?: { title: string; hubUrl: string | null };
  episodeName?: string;
}): BreadcrumbItem[] {
  const ui = UI[opts.locale];
  const home: BreadcrumbItem = { href: localePath("/", opts.locale), name: ui.home };
  if (opts.episodeName) {
    const items: BreadcrumbItem[] = [home, { href: localePath("/toons/", opts.locale), name: ui.toons }];
    if (opts.series?.hubUrl) {
      items.push({ href: localePath(opts.series.hubUrl, opts.locale), name: opts.series.title });
    }
    items.push({ name: opts.episodeName });
    return items;
  }
  if (opts.series) {
    return [home, { href: localePath("/toons/", opts.locale), name: ui.toons }, { name: opts.series.title }];
  }
  return [home, { name: ui.toons }];
}

export function breadcrumbNavHtml(items: BreadcrumbItem[], ariaLabel: string): string {
  const parts = items.map((item, i) => {
    const last = i === items.length - 1;
    if (last || !item.href) return `<li aria-current="page">${esc(item.name)}</li>`;
    return `<li><a href="${esc(item.href)}">${esc(item.name)}</a></li>`;
  });
  return `<nav class="page-breadcrumb" data-page-trail aria-label="${esc(ariaLabel)}"><ol>${parts.join("")}</ol></nav>`;
}

export function breadcrumbListJsonLd(
  items: BreadcrumbItem[],
  pageUrl: string,
  origin: string
): {
  "@type": "BreadcrumbList";
  "@id": string;
  itemListElement: Array<{ "@type": "ListItem"; position: number; name: string; item: string }>;
} {
  const page = pageUrl.endsWith("/") ? pageUrl : `${pageUrl}/`;
  const abs = (path: string) =>
    path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  return {
    "@type": "BreadcrumbList",
    "@id": `${page}#breadcrumb`,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: i === items.length - 1 || !item.href ? page : abs(item.href),
    })),
  };
}
